import { z } from "zod";

/**
 * MoonStream is the admin-only screen-sharing module. Signalling travels over
 * Socket.IO `/stream`; the media stays between two browsers, or through the
 * MoonCellar coturn relay when a direct path is impossible.
 */
export const STREAM_SOCKET_NAMESPACE = "/stream";
export const STREAM_CODE_LENGTH = 6;
export const STREAM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const STREAM_MAX_SDP_LENGTH = 96 * 1024;
export const STREAM_MAX_ICE_LENGTH = 4 * 1024;

export enum StreamSocketEvent {
  HOST = "stream:host",
  JOIN = "stream:join",
  SIGNAL = "stream:signal",
  LEAVE = "stream:leave",
  STOP = "stream:stop",
  KICK = "stream:kick",
  VIEWER_JOINED = "stream:viewer-joined",
  VIEWER_LEFT = "stream:viewer-left",
  STOPPED = "stream:stopped",
  CLOSED = "stream:closed",
}

export const StreamOfferSchema = z.object({
  kind: z.literal("offer"),
  sdp: z.string().min(1).max(STREAM_MAX_SDP_LENGTH),
});

export const StreamAnswerSchema = z.object({
  kind: z.literal("answer"),
  sdp: z.string().min(1).max(STREAM_MAX_SDP_LENGTH),
});

export const StreamIceCandidateSchema = z.object({
  kind: z.literal("ice"),
  candidate: z.string().max(STREAM_MAX_ICE_LENGTH),
  sdpMid: z.string().nullable(),
  sdpMLineIndex: z.number().int().nullable(),
  usernameFragment: z.string().nullable().optional(),
});

export const StreamSignalPayloadSchema = z.discriminatedUnion("kind", [
  StreamOfferSchema,
  StreamAnswerSchema,
  StreamIceCandidateSchema,
]);

export const StreamJoinRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .describe("Six-character code shown on the host's screen"),
});

export const StreamSignalRequestSchema = z.object({
  payload: StreamSignalPayloadSchema,
});

export const StreamIceServerSchema = z.object({
  urls: z.string().array(),
  username: z.string().optional(),
  credential: z.string().optional(),
});

export const StreamNetworkSchema = z.object({
  iceServers: StreamIceServerSchema.array(),
  relay: z.boolean().describe("A TURN relay is available for this session"),
});

export const StreamFailureSchema = z.object({
  ok: z.literal(false),
  error: z.string().describe("What the caller can do about it"),
});

export const StreamAckSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  StreamFailureSchema,
]);

export const StreamHostResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    code: z.string().length(STREAM_CODE_LENGTH),
    network: StreamNetworkSchema,
    expiresAt: z.number().describe("Room idle deadline, epoch milliseconds"),
  }),
  StreamFailureSchema,
]);

export const StreamJoinResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    network: StreamNetworkSchema,
  }),
  StreamFailureSchema,
]);

export const StreamClosedReasonSchema = z.enum([
  "host-left",
  "host-stopped",
  "removed",
  "idle",
]);

export const StreamClosedEventSchema = z.object({
  reason: StreamClosedReasonSchema,
});

export const StreamSignalEventSchema = z.object({
  payload: StreamSignalPayloadSchema,
});

export type IStreamSignalPayload = z.infer<typeof StreamSignalPayloadSchema>;
export type IStreamJoinRequest = z.infer<typeof StreamJoinRequestSchema>;
export type IStreamSignalRequest = z.infer<typeof StreamSignalRequestSchema>;
export type IStreamNetwork = z.infer<typeof StreamNetworkSchema>;
export type IStreamFailure = z.infer<typeof StreamFailureSchema>;
export type IStreamAck = z.infer<typeof StreamAckSchema>;
export type IStreamHostResponse = z.infer<typeof StreamHostResponseSchema>;
export type IStreamJoinResponse = z.infer<typeof StreamJoinResponseSchema>;
export type IStreamClosedReason = z.infer<typeof StreamClosedReasonSchema>;
export type IStreamClosedEvent = z.infer<typeof StreamClosedEventSchema>;
export type IStreamSignalEvent = z.infer<typeof StreamSignalEventSchema>;

type IStreamHostAck = (response: IStreamHostResponse) => void;
type IStreamJoinAck = (response: IStreamJoinResponse) => void;
type IStreamAckCallback = (response: IStreamAck) => void;

export type IStreamClientEvents = {
  [StreamSocketEvent.HOST]: (
    request: Record<string, never>,
    ack: IStreamHostAck
  ) => void;
  [StreamSocketEvent.JOIN]: (
    request: IStreamJoinRequest,
    ack: IStreamJoinAck
  ) => void;
  [StreamSocketEvent.SIGNAL]: (
    request: IStreamSignalRequest,
    ack?: IStreamAckCallback
  ) => void;
  [StreamSocketEvent.LEAVE]: (
    request: Record<string, never>,
    ack?: IStreamAckCallback
  ) => void;
  [StreamSocketEvent.STOP]: (
    request: Record<string, never>,
    ack?: IStreamAckCallback
  ) => void;
  [StreamSocketEvent.KICK]: (
    request: Record<string, never>,
    ack?: IStreamAckCallback
  ) => void;
};

export type IStreamServerEvents = {
  [StreamSocketEvent.VIEWER_JOINED]: () => void;
  [StreamSocketEvent.VIEWER_LEFT]: () => void;
  [StreamSocketEvent.STOPPED]: () => void;
  [StreamSocketEvent.CLOSED]: (event: IStreamClosedEvent) => void;
  [StreamSocketEvent.SIGNAL]: (event: IStreamSignalEvent) => void;
};

export const normalizeStreamCode = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, STREAM_CODE_LENGTH);

export const isStreamCode = (value: string): boolean =>
  value.length === STREAM_CODE_LENGTH &&
  Array.from(value).every((character) =>
    STREAM_CODE_ALPHABET.includes(character)
  );
