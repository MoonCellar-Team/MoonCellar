import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { OnModuleDestroy } from "@nestjs/common";
import { RolesEnum } from "@mooncellar/schemas";
import {
  StreamJoinRequestSchema,
  StreamSignalRequestSchema,
  StreamSocketEvent,
  STREAM_SOCKET_NAMESPACE,
  type IStreamAck,
  type IStreamClientEvents,
  type IStreamHostResponse,
  type IStreamJoinResponse,
  type IStreamServerEvents,
} from "@mooncellar/schemas";
import { Model } from "mongoose";
import type { Namespace, Socket } from "socket.io";
import { ACCESS_TOKEN } from "../../shared/constants";
import { getCorsOrigins } from "../../shared/cors";
import { getCookie } from "../../shared/utils/cookie.utils";
import { User } from "../user/schemas/user.schema";
import { StreamService, type StreamPeer } from "./stream.service";

export const STREAM_UNAUTHORIZED = "Unauthorized";
export const STREAM_FORBIDDEN = "Forbidden";

type IStreamSocketData = {
  userId: string;
  userName: string;
};

type IStreamNamespace = Namespace<
  IStreamClientEvents,
  IStreamServerEvents,
  Record<string, never>,
  IStreamSocketData
>;

type IStreamSocket = Socket<
  IStreamClientEvents,
  IStreamServerEvents,
  Record<string, never>,
  IStreamSocketData
>;

const invalidJoin: IStreamJoinResponse = {
  ok: false,
  error: "Enter the six-character code shown on the host's screen.",
};

const invalidSignal: IStreamAck = {
  ok: false,
  error: "The connection message was malformed. Try again.",
};

@WebSocketGateway({ namespace: STREAM_SOCKET_NAMESPACE })
export class StreamGateway
  implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(StreamGateway.name);
  private expiry?: ReturnType<typeof setInterval>;

  constructor(
    private readonly stream: StreamService,
    private readonly jwtService: JwtService,
    @InjectModel(User.name)
    private readonly usersModel: Model<User>
  ) {}

  afterInit(server: IStreamNamespace) {
    server.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        (error: Error) => next(error)
      );
    });

    this.expiry = setInterval(() => {
      const expired = this.stream.expire();
      if (expired > 0) {
        this.logger.log(`Closed ${expired} idle MoonStream room(s)`);
      }
    }, 60_000);
  }

  @SubscribeMessage(StreamSocketEvent.HOST)
  host(@ConnectedSocket() socket: IStreamSocket): IStreamHostResponse {
    return this.stream.host(this.peer(socket));
  }

  @SubscribeMessage(StreamSocketEvent.JOIN)
  join(
    @ConnectedSocket() socket: IStreamSocket,
    @MessageBody() payload: unknown
  ): IStreamJoinResponse {
    const request = StreamJoinRequestSchema.safeParse(payload);
    if (!request.success) return invalidJoin;
    return this.stream.join(this.peer(socket), request.data.code);
  }

  @SubscribeMessage(StreamSocketEvent.SIGNAL)
  signal(
    @ConnectedSocket() socket: IStreamSocket,
    @MessageBody() payload: unknown
  ): IStreamAck {
    const request = StreamSignalRequestSchema.safeParse(payload);
    if (!request.success) return invalidSignal;
    return this.stream.signal(this.peer(socket), request.data.payload);
  }

  @SubscribeMessage(StreamSocketEvent.LEAVE)
  leave(@ConnectedSocket() socket: IStreamSocket): IStreamAck {
    return this.stream.leave(this.peer(socket));
  }

  @SubscribeMessage(StreamSocketEvent.STOP)
  stop(@ConnectedSocket() socket: IStreamSocket): IStreamAck {
    return this.stream.stop(this.peer(socket));
  }

  @SubscribeMessage(StreamSocketEvent.KICK)
  kick(@ConnectedSocket() socket: IStreamSocket): IStreamAck {
    return this.stream.kick(this.peer(socket));
  }

  handleDisconnect(socket: IStreamSocket) {
    this.stream.disconnect(this.peer(socket));
  }

  onModuleDestroy() {
    if (this.expiry) clearInterval(this.expiry);
  }

  private peer(socket: IStreamSocket): StreamPeer {
    return {
      id: socket.id,
      viewerJoined: () => socket.emit(StreamSocketEvent.VIEWER_JOINED),
      viewerLeft: () => socket.emit(StreamSocketEvent.VIEWER_LEFT),
      stopped: () => socket.emit(StreamSocketEvent.STOPPED),
      closed: (event) => socket.emit(StreamSocketEvent.CLOSED, event),
      signal: (payload) => socket.emit(StreamSocketEvent.SIGNAL, { payload }),
    };
  }

  private async authenticate(socket: IStreamSocket) {
    const origin = socket.handshake.headers.origin;
    if (origin && !getCorsOrigins().includes(origin)) {
      throw new Error(STREAM_FORBIDDEN);
    }

    const token = getCookie(socket.handshake.headers.cookie, ACCESS_TOKEN);
    if (!token) throw new Error(STREAM_UNAUTHORIZED);

    let userId: string;
    try {
      const payload = this.jwtService.verify<{ id: string }>(token, {
        secret: process.env.JWT_SECRET,
      });
      userId = String(payload.id);
    } catch {
      throw new Error(STREAM_UNAUTHORIZED);
    }

    const user = await this.usersModel
      .findById(userId)
      .select("userName roles")
      .lean();

    if (!user) throw new Error(STREAM_UNAUTHORIZED);
    if (!user.roles?.includes(RolesEnum.ADMIN)) {
      throw new Error(STREAM_FORBIDDEN);
    }

    socket.data.userId = String(user._id);
    socket.data.userName = user.userName;
  }
}
