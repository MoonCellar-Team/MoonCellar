import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

const base32Encode = (buffer: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const base32Decode = (input: string): Buffer => {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
};

export const generateTotpSecret = (bytes = 20): string =>
  base32Encode(randomBytes(bytes));

export const generateTotpCode = (
  secret: string,
  timeMs: number = Date.now()
): string => {
  const counter = Math.floor(timeMs / 1000 / STEP_SECONDS);
  const message = Buffer.alloc(8);
  message.writeUInt32BE(counter, 4);

  const digest = createHmac("sha1", base32Decode(secret))
    .update(message)
    .digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
};

export const verifyTotpCode = (secret: string, code: string): boolean => {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  const now = Math.floor(Date.now() / 1000);
  for (let step = -WINDOW; step <= WINDOW; step++) {
    const candidate = generateTotpCode(secret, (now + step * STEP_SECONDS) * 1000);
    if (candidate === normalized) return true;
  }

  return false;
};

export const buildOtpauthUri = (secret: string, email: string): string => {
  const label = encodeURIComponent(`MoonCellar:${email}`);
  const query = new URLSearchParams({
    secret,
    issuer: "MoonCellar",
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${query.toString()}`;
};
