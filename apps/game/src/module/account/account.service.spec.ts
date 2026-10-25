import type { IncomingMessage } from "node:http";
import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import type { ConfigService } from "@nestjs/config";
import { ThrottlerStorageService } from "@nestjs/throttler";
import { INTROSPECT_MISSES } from "../../shared/throttle";
import { clientAddress } from "../signal/signal.gateway";
import { AccountService, isGameTokenShaped } from "./account.service";

const token = (claims: object) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const gameToken = (sid: string) =>
  token({ id: "u1", sid, typ: "game", exp: 4_000_000_000 });

const storage = new ThrottlerStorageService();
const config = { get: () => "http://api.test" } as unknown as ConfigService;
const realFetch = globalThis.fetch;
const fetchMock = mock(async () => Response.json({ active: false }));
globalThis.fetch = fetchMock as unknown as typeof fetch;

afterEach(() => fetchMock.mockClear());
afterAll(() => {
  globalThis.fetch = realFetch;
  storage.onApplicationShutdown();
});

describe("isGameTokenShaped", () => {
  it("accepts a game JWT and refuses anything else", () => {
    expect(isGameTokenShaped(gameToken("s1"))).toBe(true);
    expect(isGameTokenShaped("random-garbage")).toBe(false);
    expect(isGameTokenShaped(token({ id: "u1", sid: "s1" }))).toBe(false);
    expect(
      isGameTokenShaped(token({ id: "u1", sid: "s1", typ: "game", exp: 1 }))
    ).toBe(false);
  });
});

describe("AccountService.accountOf", () => {
  it("answers a malformed token without asking the API", async () => {
    const accounts = new AccountService(config, storage);
    expect(await accounts.accountOf("random-garbage", "10.0.0.1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the API once per token within the cache window", async () => {
    const accounts = new AccountService(config, storage);
    await accounts.accountOf(gameToken("cached"), "10.0.0.2");
    await accounts.accountOf(gameToken("cached"), "10.0.0.2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops one address at the miss budget and lets another through", async () => {
    const accounts = new AccountService(config, storage);
    for (let i = 0; i < INTROSPECT_MISSES.limit; i++) {
      await accounts.accountOf(gameToken(`flood-${i}`), "10.0.0.3");
    }
    expect(
      accounts.accountOf(gameToken("flood-over"), "10.0.0.3")
    ).rejects.toMatchObject({ status: 429 });
    expect(await accounts.accountOf(gameToken("other"), "10.0.0.4")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(INTROSPECT_MISSES.limit + 1);
  });
});

describe("clientAddress", () => {
  const request = (forwarded?: string) =>
    ({
      headers: forwarded ? { "x-forwarded-for": forwarded } : {},
      socket: { remoteAddress: "::ffff:172.18.0.1" },
    }) as unknown as IncomingMessage;

  it("takes the address nginx appended, not one the client sent", () => {
    expect(clientAddress(request("1.1.1.1, 203.0.113.7"))).toBe("203.0.113.7");
    expect(clientAddress(request("203.0.113.7"))).toBe("203.0.113.7");
    expect(clientAddress(request())).toBe("172.18.0.1");
  });
});
