import { type INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { getModelToken } from "@nestjs/mongoose";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { Test } from "@nestjs/testing";
import { io, type Socket } from "socket.io-client";
import {
  STREAM_SOCKET_NAMESPACE,
  StreamSocketEvent,
  type IStreamHostResponse,
  type IStreamJoinResponse,
} from "@mooncellar/schemas";
import { User } from "../user/schemas/user.schema";
import { StreamGateway } from "./stream.gateway";
import { StreamService } from "./stream.service";

const SECRET = "moonstream-spec";
const ADMIN_ID = "0123456789abcdef01234567";
const USER_ID = "fedcba9876543210fedcba98";

const users = new Map<
  string,
  { _id: string; userName: string; roles: string[] }
>([
  [ADMIN_ID, { _id: ADMIN_ID, userName: "admin", roles: ["admin"] }],
  [USER_ID, { _id: USER_ID, userName: "player", roles: ["user"] }],
]);

const usersModel = {
  findById: jest.fn((id: string) => ({
    select: jest.fn(() => ({
      lean: jest.fn(async () => users.get(id) ?? null),
    })),
  })),
};

describe("StreamGateway", () => {
  const originalEnv = { ...process.env };
  const jwt = new JwtService({});
  let app: INestApplication;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    process.env.TURN_SECRET = "";
    process.env.TURN_URLS = "";

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreamGateway,
        StreamService,
        { provide: JwtService, useValue: jwt },
        { provide: getModelToken(User.name), useValue: usersModel },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0, "127.0.0.1");
    url = `${await app.getUrl()}${STREAM_SOCKET_NAMESPACE}`;
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    process.env = originalEnv;
    await app.close();
  });

  const cookie = (userId: string, secret = SECRET) =>
    `accessMoonToken=${jwt.sign({ id: userId }, { secret })}`;

  const open = (session?: string) => {
    const socket = io(url, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: session ? { cookie: session } : {},
    });
    sockets.push(socket);

    return new Promise<Socket>((resolve, reject) => {
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });
  };

  const once = <T>(socket: Socket, event: StreamSocketEvent) =>
    new Promise<T>((resolve) => socket.once(event, resolve));

  it("refuses a connection without a session cookie", async () => {
    await expect(open()).rejects.toThrow("Unauthorized");
  });

  it("refuses a signed-in account without the admin role", async () => {
    await expect(open(cookie(USER_ID))).rejects.toThrow("Forbidden");
  });

  it("refuses a handshake from an origin the API does not serve", async () => {
    const socket = io(url, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: {
        cookie: cookie(ADMIN_ID),
        origin: "https://example.test",
      },
    });
    sockets.push(socket);

    await expect(
      new Promise((_resolve, reject) => socket.once("connect_error", reject))
    ).rejects.toThrow("Forbidden");
  });

  it("opens a room for an admin and connects one viewer", async () => {
    const host = await open(cookie(ADMIN_ID));
    const viewer = await open(cookie(ADMIN_ID));

    const hosted = (await host.emitWithAck(
      StreamSocketEvent.HOST,
      {}
    )) as IStreamHostResponse;
    expect(hosted.ok).toBe(true);
    if (!hosted.ok) return;

    const viewerJoined = once(host, StreamSocketEvent.VIEWER_JOINED);
    const joined = (await viewer.emitWithAck(StreamSocketEvent.JOIN, {
      code: hosted.code,
    })) as IStreamJoinResponse;
    expect(joined.ok).toBe(true);
    await expect(viewerJoined).resolves.toBeUndefined();

    const relayed = once<{ payload: { kind: string; sdp: string } }>(
      viewer,
      StreamSocketEvent.SIGNAL
    );
    await expect(
      host.emitWithAck(StreamSocketEvent.SIGNAL, {
        payload: { kind: "offer", sdp: "v=0" },
      })
    ).resolves.toEqual({ ok: true });
    await expect(relayed).resolves.toEqual({
      payload: { kind: "offer", sdp: "v=0" },
    });

    const closed = once(viewer, StreamSocketEvent.CLOSED);
    await expect(host.emitWithAck(StreamSocketEvent.STOP, {})).resolves.toEqual(
      { ok: true }
    );
    await expect(closed).resolves.toEqual({ reason: "host-stopped" });
  });

  it("does not let a viewer read a room it is not in", async () => {
    const admin = await open(cookie(ADMIN_ID));

    await expect(
      admin.emitWithAck(StreamSocketEvent.JOIN, { code: "ZZZZZZ" })
    ).resolves.toMatchObject({ ok: false });

    await expect(
      admin.emitWithAck(StreamSocketEvent.SIGNAL, {
        payload: { kind: "offer", sdp: "v=0" },
      })
    ).resolves.toMatchObject({ ok: false });
  });

  it("keeps the room alive when a viewer leaves", async () => {
    const host = await open(cookie(ADMIN_ID));
    const viewer = await open(cookie(ADMIN_ID));
    const hosted = (await host.emitWithAck(
      StreamSocketEvent.HOST,
      {}
    )) as IStreamHostResponse;
    if (!hosted.ok) throw new Error("host failed");
    await viewer.emitWithAck(StreamSocketEvent.JOIN, { code: hosted.code });

    const left = once(host, StreamSocketEvent.VIEWER_LEFT);
    viewer.disconnect();
    await expect(left).resolves.toBeUndefined();

    const again = await open(cookie(ADMIN_ID));
    await expect(
      again.emitWithAck(StreamSocketEvent.JOIN, { code: hosted.code })
    ).resolves.toMatchObject({ ok: true });
  });
});
