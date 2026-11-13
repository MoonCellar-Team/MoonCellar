import {
  buildOtpauthUri,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from "./totp";

describe("totp", () => {
  it("generates a 6-digit code and verifies it within the window", () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret);

    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("rejects a non-numeric code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "abcdef")).toBe(false);
  });

  it("returns a stable code for a fixed time", () => {
    const secret = generateTotpSecret();
    const at = 1700000000000;

    expect(generateTotpCode(secret, at)).toEqual(generateTotpCode(secret, at));
  });

  it("generates a base32 secret", () => {
    const secret = generateTotpSecret();

    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret).toHaveLength(32);
  });

  it("builds an otpauth uri with the secret and email", () => {
    const uri = buildOtpauthUri("JBSWY3DPEHPK3PXP", "user@example.com");

    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=MoonCellar");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
