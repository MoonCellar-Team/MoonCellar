import { USER_NAME_MAX_LENGTH } from "@mooncellar/schemas";
import { randomBytes } from "node:crypto";
import { OAUTH_PROVIDERS, type TOAuthProvider } from "./oauth.types";
import type { UserOAuthLinks } from "../../user/schemas/user.schema";

const USER_NAME_MIN_LENGTH = 3;
const USER_NAME_SUFFIX_ATTEMPTS = 50;
const USER_NAME_RANDOM_TAILS = 20;

export const randomUserNameTails = (count = USER_NAME_RANDOM_TAILS): string[] =>
  Array.from({ length: count }, () => randomBytes(4).toString("hex"));

export const linkedProviders = (user: {
  oauth?: UserOAuthLinks | null;
}): TOAuthProvider[] =>
  OAUTH_PROVIDERS.filter((provider) => !!getOAuthLink(user, provider));

export const getOAuthLink = (
  user: { oauth?: UserOAuthLinks | null },
  provider: TOAuthProvider
) => user.oauth?.[provider] ?? null;

export const hasPasswordSignIn = (user: {
  password?: string | null;
  email?: string | null;
  emailVerified?: boolean;
}): boolean =>
  !!user.password && !!user.email && user.emailVerified !== false;

export const countSignInWays = (user: {
  password?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  oauth?: UserOAuthLinks | null;
}): number =>
  (hasPasswordSignIn(user) ? 1 : 0) + linkedProviders(user).length;

export const toUserName = (source: string | null | undefined): string | null => {
  if (!source) return null;

  const cleaned = source
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, USER_NAME_MAX_LENGTH);

  return cleaned.length >= USER_NAME_MIN_LENGTH ? cleaned : null;
};

export const userNameVariants = (
  base: string,
  randomTails: string[]
): string[] => {
  const variants = [base];

  for (let number = 2; number <= USER_NAME_SUFFIX_ATTEMPTS; number++) {
    const suffix = String(number);
    variants.push(
      `${base.slice(0, USER_NAME_MAX_LENGTH - suffix.length)}${suffix}`
    );
  }

  for (const tail of randomTails) {
    variants.push(
      `${base.slice(0, USER_NAME_MAX_LENGTH - tail.length - 1)}_${tail}`
    );
  }

  return variants;
};
