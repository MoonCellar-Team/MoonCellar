import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { normalizeIp } from "@nestjs/throttler";
import {
  GAME_SIGNAL_MAX_BYTES,
  type IGameSignalServerMessage,
} from "@mooncellar/schemas";
import { type WebSocket, WebSocketServer } from "ws";
import { AccountService } from "../account/account.service";
import { type ISignalClient, SignalService } from "./signal.service";

export const SIGNAL_PATH = "/signal";
const HEARTBEAT_MS = 30_000;
export const SIGNAL_SOCKETS_PER_ADDRESS = 8;

export const clientAddress = (request: IncomingMessage) => {
  const forwarded = request.headers["x-forwarded-for"];
  const last = String(forwarded ?? "")
    .split(",")
    .pop()
    ?.trim();
  return (last || request.socket.remoteAddress || "").replace(/^::ffff:/, "");
};

const tokenOf = (request: IncomingMessage, url: URL) => {
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token;
  return url.searchParams.get("token");
};

@Injectable()
export class SignalGateway
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SignalGateway.name);
  private readonly server = new WebSocketServer({
    noServer: true,
    maxPayload: GAME_SIGNAL_MAX_BYTES * 2,
  });
  private readonly alive = new WeakSet<WebSocket>();
  private readonly socketsByAddress = new Map<string, number>();
  private heartbeat?: ReturnType<typeof setInterval>;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly signal: SignalService,
    private readonly accounts: AccountService
  ) {}

  onApplicationBootstrap() {
    const http = this.adapterHost.httpAdapter?.getHttpServer();
    if (!http) return;
    http.on(
      "upgrade",
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (url.pathname !== SIGNAL_PATH) {
          socket.destroy();
          return;
        }
        this.server.handleUpgrade(request, socket, head, (ws) =>
          this.connect(ws, request, url)
        );
      }
    );
    this.heartbeat = setInterval(() => {
      for (const ws of this.server.clients) {
        if (!this.alive.has(ws)) {
          ws.terminate();
          continue;
        }
        this.alive.delete(ws);
        ws.ping();
      }
    }, HEARTBEAT_MS);
  }

  onApplicationShutdown() {
    clearInterval(this.heartbeat);
    this.server.close();
  }

  private async connect(ws: WebSocket, request: IncomingMessage, url: URL) {
    const address = clientAddress(request);
    const key = normalizeIp(address);
    const open = this.socketsByAddress.get(key) ?? 0;
    if (open >= SIGNAL_SOCKETS_PER_ADDRESS) {
      const refusal: IGameSignalServerMessage = {
        type: "error",
        message:
          "Too many games are connected from this address. Close one and try again",
      };
      ws.send(JSON.stringify(refusal));
      ws.close(1013);
      return;
    }
    this.socketsByAddress.set(key, open + 1);
    ws.on("close", () => {
      const left = (this.socketsByAddress.get(key) ?? 1) - 1;
      if (left > 0) this.socketsByAddress.set(key, left);
      else this.socketsByAddress.delete(key);
    });

    this.alive.add(ws);
    ws.on("pong", () => this.alive.add(ws));
    const client: ISignalClient = {
      socket: ws,
      name: "Player",
      address,
      port: 0,
      room: null,
    };
    const pending: string[] = [];
    let ready = false;
    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const text = data.toString();
      if (ready) this.signal.handleMessage(client, text);
      else pending.push(text);
    });
    ws.on("close", () => this.signal.leave(client));
    ws.on("error", (error) => this.logger.warn(`Signal socket: ${error}`));

    const token = tokenOf(request, url);
    if (token) {
      try {
        const account = await this.accounts.accountOf(token, address);
        if (account) client.name = account.userName;
      } catch (error) {
        this.logger.warn(`Signal sign-in check failed: ${error}`);
      }
    }
    ready = true;
    for (const text of pending.splice(0))
      this.signal.handleMessage(client, text);
  }
}
