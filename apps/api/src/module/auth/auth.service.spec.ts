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
});
