import {
  buildEmailCodeFields,
  emailCodeAttemptsExhausted,
  emailCodeIsExpired,
  emailCodeMatches,
  newEmailCode,
} from "./auth-codes";

describe("auth codes", () => {
  it("generates a 6-digit code", () => {
    expect(newEmailCode()).toMatch(/^\d{6}$/);
  });

  it("builds fields that match the code", () => {
    const fields = buildEmailCodeFields("123456");

    expect(emailCodeMatches(fields, "123456")).toBe(true);
    expect(emailCodeMatches(fields, "654321")).toBe(false);
    expect(emailCodeIsExpired(fields)).toBe(false);
    expect(emailCodeAttemptsExhausted(fields)).toBe(false);
  });

  it("detects exhausted attempts", () => {
    const fields = buildEmailCodeFields("123456");
    fields.attempts = 5;

    expect(emailCodeAttemptsExhausted(fields)).toBe(true);
  });

  it("detects an expired code", () => {
    const fields = buildEmailCodeFields("123456");
    fields.expiresAt = new Date(Date.now() - 1000);

    expect(emailCodeIsExpired(fields)).toBe(true);
  });
});
