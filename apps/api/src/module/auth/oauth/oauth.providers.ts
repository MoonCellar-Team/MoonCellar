import {
  OAuthFlowError,
  type IOAuthProfile,
  type IOAuthProviderConfig,
  type TOAuthProvider,
} from "./oauth.types";

const REQUEST_TIMEOUT_MS = 10_000;

const fetchJson = async <T>(
  url: string,
  init: RequestInit,
  { allowFailure = false }: { allowFailure?: boolean } = {}
): Promise<T | null> => {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new OAuthFlowError("provider-failed");
  }

  if (!response.ok) {
    if (allowFailure) return null;
    throw new OAuthFlowError("provider-failed");
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new OAuthFlowError("provider-failed");
  }
};

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const asId = (value: unknown): string | null => {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

interface IGoogleProfile {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
}

interface IGithubProfile {
  id?: unknown;
  login?: unknown;
  name?: unknown;
}

interface IGithubEmail {
  email?: unknown;
  primary?: unknown;
  verified?: unknown;
}

interface IRedditProfile {
  id?: unknown;
  name?: unknown;
}

const google: IOAuthProviderConfig = {
  id: "google",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  scope: "openid email profile",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  extraAuthorizeParams: {
    access_type: "online",
    prompt: "select_account",
  },
  fetchProfile: async (accessToken): Promise<IOAuthProfile> => {
    const profile = await fetchJson<IGoogleProfile>(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const providerId = asId(profile?.sub);
    if (!providerId) throw new OAuthFlowError("provider-failed");

    const email = asText(profile?.email);
    const emailVerified = profile?.email_verified === true;

    return {
      provider: "google",
      providerId,
      providerUserName: asText(profile?.name),
      email: emailVerified ? email : null,
      emailVerified: emailVerified && !!email,
    };
  },
};

const github: IOAuthProviderConfig = {
  id: "github",
  clientIdEnv: "GITHUB_CLIENT_ID",
  clientSecretEnv: "GITHUB_CLIENT_SECRET",
  scope: "read:user user:email",
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  userAgent: "MoonCellar",
  fetchProfile: async (accessToken): Promise<IOAuthProfile> => {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "MoonCellar",
    };

    const profile = await fetchJson<IGithubProfile>(
      "https://api.github.com/user",
      { headers }
    );

    const providerId = asId(profile?.id);
    if (!providerId) throw new OAuthFlowError("provider-failed");

    const emails = await fetchJson<IGithubEmail[]>(
      "https://api.github.com/user/emails",
      { headers },
      { allowFailure: true }
    );

    const verified =
      emails?.find((entry) => entry?.primary === true && entry?.verified === true) ??
      emails?.find((entry) => entry?.verified === true) ??
      null;
    const email = asText(verified?.email);

    return {
      provider: "github",
      providerId,
      providerUserName: asText(profile?.login) ?? asText(profile?.name),
      email,
      emailVerified: !!email,
    };
  },
};

const reddit: IOAuthProviderConfig = {
  id: "reddit",
  clientIdEnv: "REDDIT_CLIENT_ID",
  clientSecretEnv: "REDDIT_CLIENT_SECRET",
  scope: "identity",
  authorizeUrl: "https://www.reddit.com/api/v1/authorize",
  tokenUrl: "https://www.reddit.com/api/v1/access_token",
  extraAuthorizeParams: { duration: "temporary" },
  isTokenBasicAuth: true,
  userAgent: "web:mooncellar.space:v1 (by /u/mooncellar)",
  fetchProfile: async (accessToken): Promise<IOAuthProfile> => {
    const profile = await fetchJson<IRedditProfile>(
      "https://oauth.reddit.com/api/v1/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "web:mooncellar.space:v1 (by /u/mooncellar)",
        },
      }
    );

    const providerId = asId(profile?.id);
    if (!providerId) throw new OAuthFlowError("provider-failed");

    return {
      provider: "reddit",
      providerId,
      providerUserName: asText(profile?.name),
      email: null,
      emailVerified: false,
    };
  },
};

export const OAUTH_PROVIDER_CONFIGS: Record<
  TOAuthProvider,
  IOAuthProviderConfig
> = { google, github, reddit };
