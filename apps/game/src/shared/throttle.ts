import type { ExecutionContext } from "@nestjs/common";
import type { ThrottlerModuleOptions } from "@nestjs/throttler";

const MINUTE_MS = 60_000;

const isProxied = (context: ExecutionContext) =>
  context.getType() === "http" &&
  !!context.switchToHttp().getRequest().headers?.["x-forwarded-for"];

export const THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [{ ttl: MINUTE_MS, limit: 600 }],
  skipIf: (context) => !isProxied(context),
  errorMessage: (_context, { timeToBlockExpire }) =>
    `Too many requests from this address. Try again in ${Math.max(1, timeToBlockExpire)} seconds`,
};

export const DEVICE_SIGN_IN_THROTTLE = {
  default: { limit: 10, ttl: 10 * MINUTE_MS },
};
export const DEVICE_POLL_THROTTLE = { default: { limit: 30, ttl: MINUTE_MS } };
export const INTROSPECT_MISSES = { limit: 30, ttl: MINUTE_MS };
