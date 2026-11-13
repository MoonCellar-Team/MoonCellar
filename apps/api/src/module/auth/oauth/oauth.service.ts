import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { randomBytes } from "node:crypto";
import { FRONT_URL } from "../../../shared/constants";
import { BusinessMetricsService } from "../../metrics/business-metrics.service";
import { IndexNowService } from "../../indexnow/indexnow.service";
import { User } from "../../user/schemas/user.schema";
import type { IOAuthAccounts, IOAuthAccount } from "@mooncellar/schemas";
import { OAUTH_PROVIDER_CONFIGS } from "./oauth.providers";
import {
  OAUTH_PROVIDERS,
  OAUTH_STATE_SCOPE,
  OAUTH_STATE_TTL_MS,
  OAuthFlowError,
  type IOAuthProfile,
  type IOAuthProviderConfig,
  type IOAuthState,
  type TOAuthMode,
  type TOAuthProvider,
} from "./oauth.types";
import {
  countSignInWays,
  getOAuthLink,
  hasPasswordSignIn,
  linkedProviders,
  randomUserNameTails,
  toUserName,
  userNameVariants,
} from "./oauth.utils";

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: number }).code === 11000;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface IOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

interface ITokenResponse {
  access_token?: string;
  error?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly metrics: BusinessMetricsService,
    private readonly indexNow: IndexNowService
  ) {}

  private providerConfig(provider: TOAuthProvider): IOAuthProviderConfig {
    return OAUTH_PROVIDER_CONFIGS[provider];
  }

  private credentials(provider: TOAuthProvider): IOAuthCredentials {
    const providerConfig = this.providerConfig(provider);
    const clientId = this.config.get<string>(providerConfig.clientIdEnv);
    const clientSecret = this.config.get<string>(
      providerConfig.clientSecretEnv
    );

    if (!clientId || !clientSecret) {
      throw new OAuthFlowError("provider-unavailable");
    }

    return { clientId, clientSecret };
  }

  availableProviders(): TOAuthProvider[] {
    return OAUTH_PROVIDERS.filter((provider) => {
      const providerConfig = this.providerConfig(provider);
      return (
        !!this.config.get<string>(providerConfig.clientIdEnv) &&
        !!this.config.get<string>(providerConfig.clientSecretEnv)
      );
    });
  }

  createState(
    provider: TOAuthProvider,
    mode: TOAuthMode,
    userId?: string
  ): { state: string; nonce: string } {
    const nonce = randomBytes(16).toString("hex");
    const state = this.jwtService.sign(
      {
        scope: OAUTH_STATE_SCOPE,
        provider,
        mode,
        ...(userId ? { userId } : {}),
        nonce,
      },
      { expiresIn: Math.floor(OAUTH_STATE_TTL_MS / 1000) }
    );

    return { state, nonce };
  }

  readState(state: string): IOAuthState {
    let payload: IOAuthState;

    try {
      payload = this.jwtService.verify<IOAuthState>(state);
    } catch {
      throw new OAuthFlowError("state-expired");
    }

    if (
      payload?.scope !== OAUTH_STATE_SCOPE ||
      !OAUTH_PROVIDERS.includes(payload.provider) ||
      !payload.nonce
    ) {
      throw new OAuthFlowError("state-expired");
    }

    return payload;
  }

  authorizeUrl(
    provider: TOAuthProvider,
    state: string,
    redirectUri: string
  ): string {
    const providerConfig = this.providerConfig(provider);
    const { clientId } = this.credentials(provider);

    const url = new URL(providerConfig.authorizeUrl);

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", providerConfig.scope);
    url.searchParams.set("state", state);

    Object.entries(providerConfig.extraAuthorizeParams ?? {}).forEach(
      ([key, value]) => url.searchParams.set(key, value)
    );

    return url.toString();
  }

  async exchange(
    provider: TOAuthProvider,
    code: string,
    redirectUri: string
  ): Promise<IOAuthProfile> {
    const providerConfig = this.providerConfig(provider);
    const { clientId, clientSecret } = this.credentials(provider);

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };

    if (providerConfig.isTokenBasicAuth) {
      headers.Authorization = `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`;
    } else {
      body.set("client_id", clientId);
      body.set("client_secret", clientSecret);
    }

    if (providerConfig.userAgent) {
      headers["User-Agent"] = providerConfig.userAgent;
    }

    const token = await this.readToken(providerConfig.tokenUrl, headers, body);

    return providerConfig.fetchProfile(token.access_token);
  }

  private async readToken(
    url: string,
    headers: Record<string, string>,
    body: URLSearchParams
  ): Promise<{ access_token: string }> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new OAuthFlowError("provider-failed");
    }

    let token: ITokenResponse = {};

    try {
      token = (await response.json()) as ITokenResponse;
    } catch {
      token = {};
    }

    if (!response.ok || token.error || !token.access_token) {
      this.logger.warn(
        `The token exchange answered ${response.status} ${token.error ?? ""}`.trim()
      );
      throw new OAuthFlowError("provider-failed");
    }

    return { access_token: token.access_token };
  }

  private async findByEmail(email: string): Promise<User | null> {
    const exact = await this.users.findOne({ email });

    if (exact) return exact;

    return this.users.findOne({
      email: { $regex: `^${escapeRegExp(email)}$`, $options: "i" },
    });
  }

  private async findByProviderId(
    provider: TOAuthProvider,
    providerId: string
  ): Promise<User | null> {
    return this.users.findOne({
      [`oauth.${provider}.providerId`]: providerId,
    });
  }

  async signIn(
    profile: IOAuthProfile
  ): Promise<{ user: User; created: boolean }> {
    const linked = await this.findByProviderId(
      profile.provider,
      profile.providerId
    );

    if (linked) return { user: linked, created: false };

    if (profile.email && profile.emailVerified) {
      const existing = await this.findByEmail(profile.email);

      if (existing) {
        if (existing.emailVerified === false) {
          throw new OAuthFlowError("account-unverified");
        }

        await this.attach(existing, profile);
        return { user: existing, created: false };
      }
    }

    const created = await this.create(profile);

    return { user: created, created: true };
  }

  async link(profile: IOAuthProfile, userId: string): Promise<void> {
    const user = await this.users.findById(userId);

    if (!user) throw new OAuthFlowError("provider-failed");

    await this.attach(user, profile);
  }

  private async attach(user: User, profile: IOAuthProfile): Promise<void> {
    const entry = {
      providerId: profile.providerId,
      providerUserName: profile.providerUserName,
      linkedAt: new Date(),
    };

    try {
      await this.users.updateOne(
        { _id: user._id },
        { $set: { [`oauth.${profile.provider}`]: entry } },
        { timestamps: false }
      );
    } catch (error) {
      if (isDuplicateKey(error)) throw new OAuthFlowError("link-taken");
      throw error;
    }
  }

  private async create(profile: IOAuthProfile): Promise<User> {
    const userName = await this.pickUserName(
      toUserName(profile.providerUserName)
    );

    try {
      const user = await this.users.create({
        userName,
        ...(profile.email ? { email: profile.email } : {}),
        emailVerified: profile.email ? profile.emailVerified : false,
        oauth: {
          [profile.provider]: {
            providerId: profile.providerId,
            providerUserName: profile.providerUserName,
            linkedAt: new Date(),
          },
        },
      });

      this.metrics.recordRegistration();
      this.indexNow.submitUrl(`${FRONT_URL}/user/${user.userName}`);

      return user;
    } catch (error) {
      if (isDuplicateKey(error)) {
        const existing = profile.email
          ? await this.findByEmail(profile.email)
          : null;

        if (existing) {
          await this.attach(existing, profile);
          return existing;
        }

        throw new OAuthFlowError("link-taken");
      }

      throw error;
    }
  }

  private async pickUserName(base: string | null): Promise<string> {
    const root = base ?? `moon${randomBytes(4).toString("hex")}`;
    const variants = userNameVariants(root, randomUserNameTails());

    for (const variant of variants) {
      if (!(await this.users.exists({ userName: variant }))) return variant;
    }

    throw new OAuthFlowError("provider-failed");
  }

  async unlink(user: User, provider: TOAuthProvider): Promise<void> {
    if (!getOAuthLink(user, provider)) {
      throw new NotFoundException("That provider is not linked to your account");
    }

    if (countSignInWays(user) <= 1) {
      throw new ConflictException(
        "This is the only way you sign in. Link another provider before unlinking it."
      );
    }

    await this.users.updateOne(
      { _id: user._id },
      { $set: { [`oauth.${provider}`]: null } },
      { timestamps: false }
    );
  }

  async accountsFor(userId: string): Promise<IOAuthAccounts> {
    const user = await this.users.findById(userId);

    if (!user) throw new NotFoundException("User not found");

    return this.accounts(user);
  }

  accounts(user: User): IOAuthAccounts {
    const linked: IOAuthAccount[] = linkedProviders(user).map((provider) => {
      const link = getOAuthLink(user, provider)!;

      return {
        provider,
        providerId: link.providerId,
        providerUserName: link.providerUserName ?? null,
        linkedAt: new Date(link.linkedAt).toISOString(),
      };
    });

    return {
      providers: this.availableProviders(),
      linked,
      hasPassword: hasPasswordSignIn(user),
      email: user.email ?? null,
    };
  }
}
