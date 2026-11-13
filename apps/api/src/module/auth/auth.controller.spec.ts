import { UnauthorizedException } from "@nestjs/common";
import { type JwtService } from "@nestjs/jwt";
import { type Request, type Response } from "express";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../shared/constants";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

const origin = "https://mooncellar.space";

const createResponse = () => {
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

const createController = (
  overrides: Partial<Pick<AuthService, "refreshToken" | "logout">>
) => {
  const authService = Object.assign(
    new AuthService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    ),
    overrides
  );
  const jwtService = {
    verify: () => ({ id: "user-id" }),
  } as unknown as JwtService;

  return new AuthController(
    undefined as never,
    authService,
    undefined as never,
    jwtService
  );
};

const clearedNames = (res: ReturnType<typeof createResponse>) =>
  res.clearCookie.mock.calls.map(([name]) => name);

describe("AuthController session cookies", () => {
  const req = {
    cookies: { [REFRESH_TOKEN]: "refresh" },
  } as unknown as Request;

  it("clears the cookies when the stored refresh token is gone", async () => {
    const res = createResponse();
    const controller = createController({
      refreshToken: jest.fn().mockRejectedValue(new UnauthorizedException()),
    });

    await expect(
      controller.refreshToken(res as unknown as Response, req, { origin })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(clearedNames(res)).toEqual([ACCESS_TOKEN, REFRESH_TOKEN]);
  });

  it("keeps the cookies when the refresh fails for another reason", async () => {
    const res = createResponse();
    const controller = createController({
      refreshToken: jest.fn().mockRejectedValue(new Error("connection lost")),
    });

    await expect(
      controller.refreshToken(res as unknown as Response, req, { origin })
    ).rejects.toThrow("connection lost");
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it("clears the cookies on logout even when the user update fails", async () => {
    const res = createResponse();
    const controller = createController({
      logout: jest.fn().mockRejectedValue(new Error("user not found")),
    });

    await expect(
      controller.logout("user-id", res as unknown as Response, { origin })
    ).rejects.toThrow("user not found");
    expect(clearedNames(res)).toEqual([ACCESS_TOKEN, REFRESH_TOKEN]);
  });
});
