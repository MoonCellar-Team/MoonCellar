import { BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { sha256 } from "./two-factor-crypto";

jest.mock("bcryptjs", () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue("hashed"),
}));

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  _id: "user-id",
  email: "user@example.com",
  password: "hashed",
  userName: "alex",
  roles: ["user"],
  refreshToken: null,
  emailVerified: false,
  verificationCode: {
    codeHash: sha256("123456"),
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    resendAt: null,
  },
  twoFactorCode: null,
  twoFactor: null,
  save: jest.fn().mockResolvedValue(undefined),
  markModified: jest.fn(),
  ...overrides,
});

const makeService = (userModel: { findOne: jest.Mock }) =>
  new AuthService(
    userModel as never,
    { sign: jest.fn().mockReturnValue("token") } as never,
    { get: jest.fn().mockReturnValue("jwt-secret") } as never,
    { recordRegistration: jest.fn() } as never,
    { submitUrl: jest.fn() } as never,
    { send: jest.fn().mockResolvedValue(undefined) } as never
  );

describe("AuthService verification and two-factor", () => {
  it("confirms the email code and signs the user in", async () => {
    const user = makeUser();
    const userModel = { findOne: jest.fn().mockResolvedValue(user) };
    const service = makeService(userModel);

    const result = await service.verifyEmail({
      email: user.email,
      code: "123456",
    });

    expect(user.emailVerified).toBe(true);
    expect(user.verificationCode).toBeNull();
    expect(result).toEqual({
      accessToken: "token",
      refreshToken: "token",
      userId: "user-id",
    });
  });

  it("rejects a wrong code and counts the attempt", async () => {
    const user = makeUser();
    const userModel = { findOne: jest.fn().mockResolvedValue(user) };
    const service = makeService(userModel);

    await expect(
      service.verifyEmail({ email: user.email, code: "000000" })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(user.verificationCode.attempts).toBe(1);
    expect(user.emailVerified).toBe(false);
  });

  it("answers a two-factor challenge for an app method", async () => {
    const user = makeUser({
      emailVerified: true,
      twoFactor: {
        method: "app",
        pendingMethod: null,
        totpSecretEncrypted: "encrypted",
        backupCodes: [],
        backupCodesGeneratedAt: null,
      },
    });
    const userModel = { findOne: jest.fn().mockResolvedValue(user) };
    const service = makeService(userModel);

    const result = await service.login({
      email: user.email,
      password: "password",
    });

    expect(result).toEqual({ twoFactorRequired: true, method: "app" });
  });

  it("sends an email code and answers a challenge for an email method", async () => {
    const user = makeUser({
      emailVerified: true,
      twoFactor: {
        method: "email",
        pendingMethod: null,
        totpSecretEncrypted: null,
        backupCodes: [],
        backupCodesGeneratedAt: null,
      },
    });
    const userModel = { findOne: jest.fn().mockResolvedValue(user) };
    const service = makeService(userModel);

    const result = await service.login({
      email: user.email,
      password: "password",
    });

    expect(result).toEqual({ twoFactorRequired: true, method: "email" });
    expect(user.twoFactorCode?.codeHash).toBeDefined();
  });

  it("refuses to sign in an unconfirmed account", async () => {
    const user = makeUser({ emailVerified: false });
    const userModel = { findOne: jest.fn().mockResolvedValue(user) };
    const service = makeService(userModel);

    await expect(
      service.login({ email: user.email, password: "password" })
    ).rejects.toThrow("Confirm your email before signing in");
  });
});
