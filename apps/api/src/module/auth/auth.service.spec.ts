import { type CookieOptions, type Response } from "express";
import { AuthService } from "./auth.service";

type ICookieCall = [name: string, options: CookieOptions];

const recordCookies = (origin?: string) => {
  const set: ICookieCall[] = [];
  const cleared: ICookieCall[] = [];
  const res = {
    cookie: (name: string, _value: string, options: CookieOptions) =>
      set.push([name, options]),
    clearCookie: (name: string, options: CookieOptions) =>
      cleared.push([name, options]),
  } as unknown as Response;

  const service = new AuthService(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never
  );

  service.setCookies(res, "access", "refresh", origin);
  service.clearCookies(res, origin);

  return { set, cleared };
};

describe("AuthService cookies", () => {
  it.each(["http://localhost:3000", "https://mooncellar.space", undefined])(
    "clears the cookies it sets for origin %s",
    (origin) => {
      const { set, cleared } = recordCookies(origin);

      expect(cleared.map(([name]) => name)).toEqual(set.map(([name]) => name));

      cleared.forEach(([name, options]) => {
        const [, setOptions] = set.find(([setName]) => setName === name)!;

        expect(options).toEqual({
          ...setOptions,
          expires: undefined,
          maxAge: undefined,
        });
      });
    }
  );

  it.each([
    ["http://localhost:3000", undefined],
    ["http://127.0.0.1:3228", undefined],
    ["http://status.mooncellar.test:3000", "mooncellar.test"],
    ["http://api.mooncellar.test:3228", "mooncellar.test"],
    ["https://status.mooncellar.space", "mooncellar.space"],
    ["https://mooncellar.space", "mooncellar.space"],
    [undefined, "mooncellar.space"],
  ])("sets the cookie of %s on the domain %s", (origin, domain) => {
    const { set } = recordCookies(origin);

    expect(set[0][1].domain).toBe(domain);
  });

  it("keeps the cookie host-only and unsafe on plain http", () => {
    const { set } = recordCookies("http://localhost:3000");

    expect(set[0][1]).toMatchObject({ secure: false });
    expect(set[0][1].sameSite).toBeUndefined();
  });
});
