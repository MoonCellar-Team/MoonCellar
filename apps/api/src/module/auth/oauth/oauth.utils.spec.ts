import {
  countSignInWays,
  hasPasswordSignIn,
  linkedProviders,
  toUserName,
  userNameVariants,
} from "./oauth.utils";

describe("toUserName", () => {
  it("keeps the letters and digits of a provider name", () => {
    expect(toUserName("John Doe")).toBe("JohnDoe");
    expect(toUserName("john-doe")).toBe("johndoe");
  });

  it("drops non-latin names instead of storing an empty user name", () => {
    expect(toUserName("Иван")).toBeNull();
    expect(toUserName("***")).toBeNull();
    expect(toUserName(null)).toBeNull();
  });

  it("cuts the name to the longest user name", () => {
    expect(toUserName("a".repeat(40))).toHaveLength(15);
  });
});

describe("userNameVariants", () => {
  it("tries the plain name first and then numbered ones", () => {
    const variants = userNameVariants("john", ["abcdefgh"]);

    expect(variants[0]).toBe("john");
    expect(variants[1]).toBe("john2");
    expect(variants).toContain("john_abcdefgh");
  });

  it("keeps every variant inside the user name limit", () => {
    const variants = userNameVariants("a".repeat(15), ["abcdefgh"]);

    expect(variants.every((variant) => variant.length <= 15)).toBe(true);
    expect(variants).toContain(`${"a".repeat(14)}2`);
  });
});

describe("sign-in ways", () => {
  it("counts a confirmed email with a password", () => {
    expect(
      countSignInWays({ password: "hash", email: "a@b.c", emailVerified: true })
    ).toBe(1);
  });

  it("does not count an account whose email is not confirmed", () => {
    expect(hasPasswordSignIn({ password: "hash", email: "a@b.c" })).toBe(true);
    expect(
      hasPasswordSignIn({
        password: "hash",
        email: "a@b.c",
        emailVerified: false,
      })
    ).toBe(false);
    expect(countSignInWays({ password: "hash", email: "a@b.c", emailVerified: false })).toBe(0);
  });

  it("counts every linked provider next to the password", () => {
    const user = {
      password: "hash",
      email: "a@b.c",
      emailVerified: true,
      oauth: {
        google: { providerId: "1" },
        github: null,
        reddit: null,
      },
    };

    expect(linkedProviders(user as never)).toEqual(["google"]);
    expect(countSignInWays(user as never)).toBe(2);
  });

  it("counts a provider account without an email as one way", () => {
    expect(
      countSignInWays({
        oauth: { google: null, github: null, reddit: { providerId: "7" } },
      } as never)
    ).toBe(1);
  });
});
