import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const CIPHER = "aes-256-gcm";

const keyFor = (secret: string) => createHash("sha256").update(secret).digest();

export const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const twoFactorKey = (jwtSecret: string): string =>
  `${jwtSecret}:two-factor`;

export const encryptSecret = (value: string, secret: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, keyFor(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
};

export const decryptSecret = (value: string, secret: string): string => {
  const [iv, tag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv(CIPHER, keyFor(secret), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
};
