export const OAUTH_PROVIDERS = ["google", "github", "reddit"] as const;

export type TOAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_MODES = ["sign-in", "link"] as const;

export type TOAuthMode = (typeof OAUTH_MODES)[number];

export const OAUTH_ERRORS = [
  "cancelled",
  "provider-unavailable",
  "provider-failed",
  "link-taken",
  "account-unverified",
  "state-expired",
] as const;

export type TOAuthError = (typeof OAUTH_ERRORS)[number];

export const OAUTH_STATE_SCOPE = "oauth-state";
export const TWO_FACTOR_TICKET_SCOPE = "two-factor-ticket";
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_STATE_COOKIE = "oauthStateMoonToken";
export const TWO_FACTOR_TICKET_TTL_MS = 10 * 60 * 1000;

export interface IOAuthState {
  scope: typeof OAUTH_STATE_SCOPE;
  provider: TOAuthProvider;
  mode: TOAuthMode;
  userId?: string;
  nonce: string;
}

export interface IOAuthProfile {
  provider: TOAuthProvider;
  providerId: string;
  providerUserName: string | null;
  email: string | null;
  emailVerified: boolean;
}

export interface IOAuthProviderConfig {
  id: TOAuthProvider;
  clientIdEnv: string;
  clientSecretEnv: string;
  scope: string;
  authorizeUrl: string;
  tokenUrl: string;
  extraAuthorizeParams?: Record<string, string>;
  isTokenBasicAuth?: boolean;
  userAgent?: string;
  fetchProfile: (accessToken: string) => Promise<IOAuthProfile>;
}

export class OAuthFlowError extends Error {
  constructor(readonly code: TOAuthError) {
    super(code);
    this.name = "OAuthFlowError";
  }
}
