import {
  decryptSecret,
  encryptSecret,
  sha256,
  twoFactorKey,
} from "./two-factor-crypto";

describe("two-factor crypto", () => {
  it("encrypts and decrypts a secret", () => {
    const key = "test-secret";
    const value = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(value, key);

    expect(encrypted).not.toContain(value);
    expect(decryptSecret(encrypted, key)).toBe(value);
  });

  it("produces different ciphertext for the same value", () => {
    const key = "test-secret";
    const a = encryptSecret("JBSWY3DPEHPK3PXP", key);
    const b = encryptSecret("JBSWY3DPEHPK3PXP", key);

    expect(a).not.toBe(b);
  });

  it("hashes deterministically with sha256", () => {
    expect(sha256("123456")).toBe(sha256("123456"));
    expect(sha256("123456")).not.toBe(sha256("123457"));
  });

  it("separates the key namespace from the jwt secret", () => {
    expect(twoFactorKey("secret")).toBe("secret:two-factor");
  });
});
