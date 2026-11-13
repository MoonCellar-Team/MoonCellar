import type { Response } from "express";
import { FRONT_URL } from "../../../shared/constants";
import { OAuthController } from "./oauth.controller";
import { OAuthFlowError } from "./oauth.types";

const buildRes = () => {
  const redirect = jest.fn();
  const cookie = jest.fn();
  const clearCookie = jest.fn();

  return {
    res: { redirect, cookie, clearCookie } as unknown as Response,
    redirect,
    cookie,
    clearCookie,
  };
};

const buildController = () => {
  const oauth = {
    createState: jest.fn(() => ({ state: "state", nonce: "nonce" })),
    authorizeUrl: jest.fn(() => "https://accounts.example/authorize"),
    readState: jest.fn(),
    exchange: jest.fn(),
    signIn: jest.fn(),
    link: jest.fn(),
    unlink: jest.fn(),
    accounts: jest.fn(),
    accountsFor: jest.fn(),
  };
  const auth = {
    startTwoFactorChallenge: jest.fn().mockResolvedValue("off"),
    createTwoFactorTicket: jest.fn(() => "ticket"),
    generateTokensAndUpdateUser: jest
      .fn()
      .mockResolvedValue({ accessToken: "access", refreshToken: "refresh" }),
    setCookies: jest.fn(),
  };

  const controller = new OAuthController(oauth as never, auth as never);

  return { controller, oauth, auth };
};

const request = (overrides: Record<string, unknown> = {}) =>
  ({
    protocol: "https",
    headers: {},
    cookies: {},
    get: (name: string) =>
      name === "host" ? "api.mooncellar.space" : undefined,
    ...overrides,
  }) as never;

const errorUrl = (code: string) =>
  `${FRONT_URL}/auth/oauth?status=error&error=${code}&provider=google`;

describe("OAuthController.start", () => {
  it("answers a redirect instead of a body when the provider has no credentials", () => {
    const { controller, oauth } = buildController();
    const { res, redirect, cookie } = buildRes();
    oauth.authorizeUrl.mockImplementation(() => {
      throw new OAuthFlowError("provider-unavailable");
    });

    controller.start("google", undefined, request(), res);

    expect(redirect).toHaveBeenCalledWith(302, errorUrl("provider-unavailable"));
    expect(cookie).not.toHaveBeenCalled();
  });

  it("starts a sign-in, not a link, for a guest who asks to link", () => {
    const { controller, oauth } = buildController();
    const { res, redirect } = buildRes();

    controller.start("google", "1", request({ user: null }), res);

    expect(oauth.createState).toHaveBeenCalledWith(
      "google",
      "sign-in",
      undefined
    );
    expect(redirect).toHaveBeenCalledWith(302, "https://accounts.example/authorize");
  });

  it("carries the viewer into the state of a link request", () => {
    const { controller, oauth } = buildController();
    const { res, cookie } = buildRes();

    controller.start("google", "1", request({ user: { _id: "user-1" } }), res);

    expect(oauth.createState).toHaveBeenCalledWith("google", "link", "user-1");
    expect(cookie).toHaveBeenCalledWith(
      "oauthStateMoonToken",
      "nonce",
      expect.objectContaining({ path: "/auth/oauth" })
    );
  });
});

describe("OAuthController.callback", () => {
  it("refuses a callback whose state does not verify", async () => {
    const { controller, oauth } = buildController();
    const { res, redirect } = buildRes();
    oauth.readState.mockImplementation(() => {
      throw new OAuthFlowError("state-expired");
    });

    await controller.callback(
      "google",
      { code: "code", state: "state" },
      request(),
      res
    );

    expect(redirect).toHaveBeenCalledWith(302, errorUrl("state-expired"));
    expect(oauth.exchange).not.toHaveBeenCalled();
  });

  it("refuses a callback opened in another browser", async () => {
    const { controller, oauth } = buildController();
    const { res, redirect } = buildRes();
    oauth.readState.mockReturnValue({
      scope: "oauth-state",
      provider: "google",
      mode: "sign-in",
      nonce: "nonce",
    });

    await controller.callback(
      "google",
      { code: "code", state: "state" },
      request({ cookies: { oauthStateMoonToken: "other" } }),
      res
    );

    expect(redirect).toHaveBeenCalledWith(302, errorUrl("state-expired"));
    expect(oauth.exchange).not.toHaveBeenCalled();
  });

  it("sets the cookies and returns to the site after a sign-in", async () => {
    const { controller, oauth, auth } = buildController();
    const { res, redirect } = buildRes();
    oauth.readState.mockReturnValue({
      scope: "oauth-state",
      provider: "google",
      mode: "sign-in",
      nonce: "nonce",
    });
    oauth.exchange.mockResolvedValue({ providerId: "1" });
    oauth.signIn.mockResolvedValue({ user: { _id: "user-1" }, created: false });

    await controller.callback(
      "google",
      { code: "code", state: "state" },
      request({ cookies: { oauthStateMoonToken: "nonce" } }),
      res
    );

    expect(auth.setCookies).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      302,
      `${FRONT_URL}/auth/oauth?status=signed-in&userId=user-1`
    );
  });

  it("asks for the second factor instead of setting cookies", async () => {
    const { controller, oauth, auth } = buildController();
    const { res, redirect } = buildRes();
    oauth.readState.mockReturnValue({
      scope: "oauth-state",
      provider: "google",
      mode: "sign-in",
      nonce: "nonce",
    });
    oauth.exchange.mockResolvedValue({ providerId: "1" });
    oauth.signIn.mockResolvedValue({ user: { _id: "user-1" }, created: false });
    auth.startTwoFactorChallenge.mockResolvedValue("app");

    await controller.callback(
      "google",
      { code: "code", state: "state" },
      request({ cookies: { oauthStateMoonToken: "nonce" } }),
      res
    );

    expect(auth.setCookies).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("status=two-factor&method=app&ticket=ticket")
    );
  });

  it("links the provider and returns to the settings page", async () => {
    const { controller, oauth, auth } = buildController();
    const { res, redirect } = buildRes();
    oauth.readState.mockReturnValue({
      scope: "oauth-state",
      provider: "github",
      mode: "link",
      userId: "user-1",
      nonce: "nonce",
    });
    oauth.exchange.mockResolvedValue({ providerId: "2" });

    await controller.callback(
      "github",
      { code: "code", state: "state" },
      request({ cookies: { oauthStateMoonToken: "nonce" } }),
      res
    );

    expect(oauth.link).toHaveBeenCalledWith({ providerId: "2" }, "user-1");
    expect(oauth.signIn).not.toHaveBeenCalled();
    expect(auth.setCookies).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      302,
      `${FRONT_URL}/auth/oauth?status=linked&provider=github`
    );
  });

  it("passes the provider's refusal back to the site", async () => {
    const { controller } = buildController();
    const { res, redirect } = buildRes();

    await controller.callback(
      "google",
      { error: "access_denied", state: "state" },
      request(),
      res
    );

    expect(redirect).toHaveBeenCalledWith(302, errorUrl("cancelled"));
  });
});

describe("OAuthController.unlink", () => {
  it("answers the remaining providers", async () => {
    const { controller, oauth } = buildController();
    const accounts = { providers: [], linked: [], hasPassword: true, email: null };
    oauth.accountsFor.mockResolvedValue(accounts);

    await expect(
      controller.unlink("google", request({ user: { _id: "user-1" } }))
    ).resolves.toBe(accounts);
    expect(oauth.accountsFor).toHaveBeenCalledWith("user-1");
  });
});
