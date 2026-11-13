import { randomInt } from "node:crypto";
import { sha256 } from "./two-factor-crypto";
import type { UserEmailCode } from "../user/schemas/user.schema";

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
export const BACKUP_CODES_COUNT = 8;

const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const newEmailCode = (): string => randomInt(100000, 1000000).toString();

export const newBackupCodes = (count = BACKUP_CODES_COUNT): string[] =>
  Array.from({ length: count }, () =>
    Array.from(
      { length: 10 },
      () => BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)]
    ).join("")
  );

export const buildEmailCodeFields = (code: string): UserEmailCode => ({
  codeHash: sha256(code),
  expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
  attempts: 0,
  resendAt: new Date(Date.now() + EMAIL_CODE_RESEND_COOLDOWN_MS),
});

export const emailCodeIsExpired = (code?: UserEmailCode | null): boolean =>
  !code?.expiresAt || code.expiresAt.getTime() <= Date.now();

export const emailCodeAttemptsExhausted = (
  code?: UserEmailCode | null
): boolean => (code?.attempts ?? 0) >= EMAIL_CODE_MAX_ATTEMPTS;

export const emailCodeMatches = (
  code?: UserEmailCode | null,
  entered?: string
): boolean => !!code?.codeHash && sha256(entered ?? "") === code.codeHash;
