import { type CookieOptions, type Response } from "express";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../shared/constants";

/** Where the site and the API are served from in production; the cookie has to cover both. */
const PRODUCTION_COOKIE_DOMAIN = "mooncellar.space";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/**
 * The domain the session cookie is set for: the site, the hub and the API share one session, so
 * the cookie belongs to the domain they have in common (`mooncellar.space`, or `mooncellar.test`
 * for a local pair of test hosts), never to a single host.
 *
 * `localhost` has no domain of its own — Chromium refuses a cookie whose `Domain` is `.localhost`
 * — so there the cookie is host-only, which every port of the host already shares.
 */
export const getCookieDomain = (origin?: string): string | undefined => {
  if (!origin) return PRODUCTION_COOKIE_DOMAIN;

  let hostname: string;

  try {
    hostname = new URL(origin).hostname;
  } catch {
    return PRODUCTION_COOKIE_DOMAIN;
  }

  if (LOCAL_HOSTNAMES.includes(hostname)) return undefined;

  const labels = hostname.split(".");

  return labels.length > 2 ? labels.slice(-2).join(".") : hostname;
};

export const getAuthCookieOptions = (origin?: string): CookieOptions => {
  const domain = getCookieDomain(origin);
  const secure = !!origin?.includes("https");

  return {
    httpOnly: true,
    ...(domain && { domain }),
    secure,
    sameSite: !secure ? undefined : "none",
  };
};

export const clearAuthCookies = (res: Response, origin?: string): void => {
  const options = getAuthCookieOptions(origin);

  res.clearCookie(ACCESS_TOKEN, options);
  res.clearCookie(REFRESH_TOKEN, options);
};
