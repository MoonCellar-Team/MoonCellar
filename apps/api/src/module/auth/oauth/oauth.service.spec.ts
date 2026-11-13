import { OAuthService } from "./oauth.service";
import { OAuthFlowError } from "./oauth.types";

const profile = {
  provider: "google" as const,
  providerId: "google-1",
  providerUserName: "John Doe",
  email: "john@example.com",
  emailVerified: true,
};

const buildService = () => {
  const users = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    exists: jest.fn().mockResolvedValue(false),
  };
  const metrics = { recordRegistration: jest.fn() };
  const indexNow = { submitUrl: jest.fn() };
  const config = {
    get: jest.fn().mockReturnValue(undefined),
  };

  const service = new OAuthService(
    users as never,
    undefined as never,
    config as never,
    metrics as never,
    indexNow as never
  );

  return { service, users, metrics, indexNow };
};

describe("OAuthService.signIn", () => {
  it("signs in the account a provider id is already linked to", async () => {
    const { service, users } = buildService();
    const linked = { _id: "user-1" };
    users.findOne.mockResolvedValueOnce(linked);

    await expect(service.signIn(profile)).resolves.toEqual({
      user: linked,
      created: false,
    });
    expect(users.findOne).toHaveBeenCalledWith({
      "oauth.google.providerId": "google-1",
    });
    expect(users.create).not.toHaveBeenCalled();
  });

  it("links a verified provider e-mail to the account holding it", async () => {
    const { service, users } = buildService();
    const existing = {
      _id: "user-2",
      email: "john@example.com",
      emailVerified: true,
    };
    users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);

    await expect(service.signIn(profile)).resolves.toEqual({
      user: existing,
      created: false,
    });
    expect(users.updateOne).toHaveBeenCalledWith(
      { _id: "user-2" },
      {
        $set: {
          "oauth.google": expect.objectContaining({ providerId: "google-1" }),
        },
      },
      { timestamps: false }
    );
  });

  it("refuses to link the e-mail of an account that is not confirmed", async () => {
    const { service, users } = buildService();
    users.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "user-3", emailVerified: false });

    await expect(service.signIn(profile)).rejects.toMatchObject({
      code: "account-unverified",
    });
    expect(users.updateOne).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
  });

  it("creates an account without an e-mail when the provider has none", async () => {
    const { service, users, metrics } = buildService();
    users.findOne.mockResolvedValue(null);
    users.exists.mockResolvedValue(false);
    users.create.mockImplementation((data) =>
      Promise.resolve({ _id: "user-4", ...data })
    );

    const result = await service.signIn({
      ...profile,
      provider: "reddit",
      providerId: "reddit-1",
      providerUserName: "johnny",
      email: null,
      emailVerified: false,
    });

    expect(result.created).toBe(true);
    expect(users.create).toHaveBeenCalledWith({
      userName: "johnny",
      emailVerified: false,
      oauth: {
        reddit: expect.objectContaining({ providerId: "reddit-1" }),
      },
    });
    expect(metrics.recordRegistration).toHaveBeenCalled();
  });

  it("takes a free variant of a user name that is already used", async () => {
    const { service, users } = buildService();
    users.findOne.mockResolvedValue(null);
    users.exists.mockResolvedValueOnce(true).mockResolvedValue(false);
    users.create.mockImplementation((data) => Promise.resolve(data));

    await service.signIn(profile);

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ userName: "JohnDoe2" })
    );
  });

  it("reports a provider account that another user linked meanwhile", async () => {
    const { service, users } = buildService();
    users.findOne.mockResolvedValue(null);
    users.create.mockRejectedValue({ code: 11000 });

    await expect(service.signIn(profile)).rejects.toBeInstanceOf(
      OAuthFlowError
    );
    await expect(service.signIn(profile)).rejects.toMatchObject({
      code: "link-taken",
    });
  });
});

describe("OAuthService.unlink", () => {
  it("refuses to remove the only way to sign in", async () => {
    const { service, users } = buildService();

    await expect(
      service.unlink(
        {
          _id: "user-1",
          oauth: { google: { providerId: "1", linkedAt: new Date() } },
        } as never,
        "google"
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining("only way you sign in"),
    });
    expect(users.updateOne).not.toHaveBeenCalled();
  });

  it("removes a provider next to a password sign-in", async () => {
    const { service, users } = buildService();

    await service.unlink(
      {
        _id: "user-1",
        email: "john@example.com",
        emailVerified: true,
        password: "hash",
        oauth: { google: { providerId: "1", linkedAt: new Date() } },
      } as never,
      "google"
    );

    expect(users.updateOne).toHaveBeenCalledWith(
      { _id: "user-1" },
      { $set: { "oauth.google": null } },
      { timestamps: false }
    );
  });

  it("answers 404 for a provider that is not linked", async () => {
    const { service } = buildService();

    await expect(
      service.unlink({ _id: "user-1", oauth: {} } as never, "github")
    ).rejects.toMatchObject({
      message: "That provider is not linked to your account",
    });
  });
});

describe("OAuthService provider availability", () => {
  it("offers only the providers that have a client id and secret", async () => {
    const { service } = buildService();

    expect(service.availableProviders()).toEqual([]);
  });
});
