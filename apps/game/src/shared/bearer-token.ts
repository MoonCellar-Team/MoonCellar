import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

export const isBearerToken = (
  header: string | undefined,
  token: string | undefined
) =>
  !!token && timingSafeEqual(digest(header ?? ""), digest(`Bearer ${token}`));
