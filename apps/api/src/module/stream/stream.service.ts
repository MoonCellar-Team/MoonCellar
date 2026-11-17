import { randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  isStreamCode,
  normalizeStreamCode,
  STREAM_CODE_ALPHABET,
  STREAM_CODE_LENGTH,
  type IStreamAck,
  type IStreamClosedEvent,
  type IStreamHostResponse,
  type IStreamJoinResponse,
  type IStreamNetwork,
  type IStreamSignalPayload,
} from "@mooncellar/schemas";
import { buildStreamNetwork, stunUrls, turnUrls } from "./stream-turn";

export type StreamPeer = {
  id: string;
  viewerJoined: () => void;
  viewerLeft: () => void;
  stopped: () => void;
  closed: (event: IStreamClosedEvent) => void;
  signal: (payload: IStreamSignalPayload) => void;
};

type StreamRoom = {
  code: string;
  host: StreamPeer;
  viewer: StreamPeer | null;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
};

export type StreamStats = {
  rooms: number;
  viewers: number;
};

const STREAM_ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
const STREAM_MAX_ROOMS = 200;

const ok: IStreamAck = { ok: true };
const fail = (error: string): IStreamAck => ({ ok: false, error });

/**
 * The signalling state machine. It holds no media and knows nothing about
 * Socket.IO: the gateway gives it peers and the service talks to them through
 * callbacks, which keeps room transitions testable.
 */
@Injectable()
export class StreamService {
  private readonly rooms = new Map<string, StreamRoom>();
  private readonly roomOfPeer = new Map<string, StreamRoom>();
  private readonly turnSecret = process.env.TURN_SECRET ?? "";
  private readonly turnUrls = turnUrls(process.env.TURN_URLS);
  private readonly stunUrls = stunUrls(process.env.STUN_URLS, this.turnUrls);

  host(peer: StreamPeer): IStreamHostResponse {
    this.leave(peer);

    if (this.rooms.size >= STREAM_MAX_ROOMS) {
      return {
        ok: false,
        error: "MoonStream is at capacity. Wait a minute and try again.",
      };
    }

    const now = Date.now();
    const room: StreamRoom = {
      code: this.newCode(),
      host: peer,
      viewer: null,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + STREAM_ROOM_IDLE_MS,
    };
    this.rooms.set(room.code, room);
    this.roomOfPeer.set(peer.id, room);

    return {
      ok: true,
      code: room.code,
      network: this.network(room),
      expiresAt: room.expiresAt,
    };
  }

  join(peer: StreamPeer, rawCode: string): IStreamJoinResponse {
    this.leave(peer);

    const code = normalizeStreamCode(rawCode);
    if (!isStreamCode(code)) {
      return {
        ok: false,
        error: "Enter the six-character code shown on the host's screen.",
      };
    }

    const room = this.rooms.get(code);
    if (!room) {
      return {
        ok: false,
        error: "No stream with that code. Check it with the host.",
      };
    }
    if (room.viewer) {
      return {
        ok: false,
        error: "Someone is already watching this stream.",
      };
    }

    room.viewer = peer;
    this.roomOfPeer.set(peer.id, room);
    this.touch(room);
    room.host.viewerJoined();
    return { ok: true, network: this.network(room) };
  }

  signal(peer: StreamPeer, payload: IStreamSignalPayload): IStreamAck {
    const room = this.roomOfPeer.get(peer.id);
    if (!room) return fail("Start or join a stream first.");

    const other = room.host.id === peer.id ? room.viewer : room.host;
    if (!other) return fail("The other side has not connected yet.");

    other.signal(payload);
    this.touch(room);
    return ok;
  }

  stop(peer: StreamPeer): IStreamAck {
    const room = this.roomOfPeer.get(peer.id);
    if (!room) return fail("No stream to stop.");
    if (room.host.id !== peer.id) {
      return fail("Only the computer sharing its screen can stop the stream.");
    }

    if (room.viewer) {
      room.viewer.closed({ reason: "host-stopped" });
      this.roomOfPeer.delete(room.viewer.id);
      room.viewer = null;
    }
    this.rooms.delete(room.code);
    this.roomOfPeer.delete(room.host.id);
    room.host.stopped();
    return ok;
  }

  kick(peer: StreamPeer): IStreamAck {
    const room = this.roomOfPeer.get(peer.id);
    if (!room) return fail("No stream to manage.");
    if (room.host.id !== peer.id) {
      return fail("Only the host can remove a viewer.");
    }
    if (!room.viewer) return fail("Nobody is watching right now.");

    room.viewer.closed({ reason: "removed" });
    this.roomOfPeer.delete(room.viewer.id);
    room.viewer = null;
    room.host.viewerLeft();
    this.touch(room);
    return ok;
  }

  leave(peer: StreamPeer): IStreamAck {
    const room = this.roomOfPeer.get(peer.id);
    if (!room) return ok;
    this.roomOfPeer.delete(peer.id);

    if (room.host.id === peer.id) {
      this.rooms.delete(room.code);
      if (room.viewer) {
        room.viewer.closed({ reason: "host-left" });
        this.roomOfPeer.delete(room.viewer.id);
        room.viewer = null;
      }
      return ok;
    }

    if (room.viewer?.id === peer.id) {
      room.viewer = null;
      room.host.viewerLeft();
      this.touch(room);
    }
    return ok;
  }

  disconnect(peer: StreamPeer): void {
    this.leave(peer);
  }

  /** Closes rooms that have been silent longer than the idle window. */
  expire(now = Date.now()): number {
    let expired = 0;
    for (const room of this.rooms.values()) {
      if (now < room.expiresAt) continue;
      expired += 1;
      this.rooms.delete(room.code);
      this.roomOfPeer.delete(room.host.id);
      room.host.closed({ reason: "idle" });
      if (room.viewer) {
        this.roomOfPeer.delete(room.viewer.id);
        room.viewer.closed({ reason: "idle" });
        room.viewer = null;
      }
    }
    return expired;
  }

  stats(): StreamStats {
    let viewers = 0;
    for (const room of this.rooms.values()) {
      if (room.viewer) viewers += 1;
    }
    return { rooms: this.rooms.size, viewers };
  }

  private network(room: StreamRoom): IStreamNetwork {
    return buildStreamNetwork(
      {
        turnSecret: this.turnSecret,
        turnUrls: this.turnUrls,
        stunUrls: this.stunUrls,
      },
      room.code,
      Date.now()
    );
  }

  private newCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = "";
      for (let index = 0; index < STREAM_CODE_LENGTH; index += 1) {
        code += STREAM_CODE_ALPHABET[randomInt(STREAM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("Could not allocate a MoonStream code");
  }

  private touch(room: StreamRoom): void {
    room.lastActivity = Date.now();
    room.expiresAt = room.lastActivity + STREAM_ROOM_IDLE_MS;
  }
}
