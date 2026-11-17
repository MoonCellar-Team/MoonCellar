import { createHmac } from "node:crypto";
import type { IStreamNetwork } from "@mooncellar/schemas";

export const STREAM_TURN_TTL_SECONDS = 12 * 60 * 60;

export const splitUrls = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

/**
 * The deploy appends `TURN_URLS=game.mooncellar.space:3478`, without a scheme,
 * because the game service hands the value to its own client. WebRTC needs the
 * scheme, so add it here; coturn in this stack is UDP-only.
 */
export const normalizeTurnUrl = (value: string): string => {
  let url = value;
  if (!/^(turn|turns|stun|stuns):/i.test(url)) url = `turn:${url}`;
  if (url.toLowerCase().startsWith("turn:") && !url.includes("?transport=")) {
    url += "?transport=udp";
  }
  return url;
};

export const turnUrls = (value: string | undefined): string[] =>
  splitUrls(value).map(normalizeTurnUrl);

export const stunUrls = (
  value: string | undefined,
  turns: string[]
): string[] => {
  const configured = splitUrls(value).map((url) =>
    /^(stun|stuns):/i.test(url) || /^turn/i.test(url) ? url : `stun:${url}`
  );
  if (configured.length > 0) return configured;

  return turns
    .filter((url) => url.toLowerCase().startsWith("turn:"))
    .map((url) => url.replace(/^turn:/i, "stun:").split("?")[0] ?? url);
};

/**
 * coturn REST credentials: `<expiry unix time>:<room code>` signed with the
 * shared static-auth-secret. This is the same scheme the game service uses, so
 * one relay serves both.
 */
export const turnCredentials = (
  secret: string,
  urls: string[],
  room: string,
  nowMs: number,
  ttlSeconds = STREAM_TURN_TTL_SECONDS
) => {
  const expiry = Math.floor(nowMs / 1000) + ttlSeconds;
  const username = `${expiry}:${room}`;
  const credential = createHmac("sha1", secret)
    .update(username)
    .digest("base64");
  return { urls, username, credential, ttl: ttlSeconds };
};

export type StreamNetworkOptions = {
  turnSecret: string;
  turnUrls: string[];
  stunUrls: string[];
  ttlSeconds?: number;
};

export const buildStreamNetwork = (
  options: StreamNetworkOptions,
  room: string,
  nowMs: number
): IStreamNetwork => {
  const iceServers: IStreamNetwork["iceServers"] = [];
  if (options.stunUrls.length > 0) {
    iceServers.push({ urls: [...new Set(options.stunUrls)] });
  }

  if (options.turnSecret.length === 0 || options.turnUrls.length === 0) {
    return { iceServers, relay: false };
  }

  const turn = turnCredentials(
    options.turnSecret,
    [...new Set(options.turnUrls)],
    room,
    nowMs,
    options.ttlSeconds
  );
  iceServers.push({
    urls: turn.urls,
    username: turn.username,
    credential: turn.credential,
  });
  return { iceServers, relay: true };
};
