import { describe, expect, it } from "bun:test";
import {
  auditGameCards,
  compareWithConstants,
  findDuplicates,
  normaliseName,
  renderDuplicates,
  type IDuplicateCandidate,
  type IGameCardInput,
} from "./audit-game-cards";

const card = (
  input: Partial<IGameCardInput> & { slug: string }
): IGameCardInput => ({
  name: input.slug,
  type: "Main Game",
  inSitemap: true,
  votes: 0,
  summaryLength: 400,
  players: 0,
  ratings: 0,
  notes: 0,
  publicReviews: 0,
  discussions: 0,
  lists: 0,
  versionParent: null,
  port: null,
  portAchievements: 0,
  ...input,
});

describe("auditGameCards", () => {
  it("keeps the most searched cards that carry our data", () => {
    const audit = auditGameCards(
      [
        card({ slug: "popular-with-data", votes: 900, players: 1 }),
        card({ slug: "popular-thin", votes: 1000 }),
        card({ slug: "quiet-with-data", votes: 10, ratings: 2 }),
        card({
          slug: "unlisted-with-data",
          votes: 5000,
          inSitemap: false,
          players: 3,
        }),
      ],
      1
    );

    expect(audit.keep).toEqual(["popular-with-data"]);
    expect(
      audit.cards.find(({ slug }) => slug === "popular-thin")?.verdict
    ).toBe("noindex");
    expect(
      audit.cards.find(({ slug }) => slug === "unlisted-with-data")?.verdict
    ).toBe("noindex");
  });

  it("keeps the card of a MoonCellar port whatever its data and placement", () => {
    const audit = auditGameCards([
      card({ slug: "popular", votes: 900, players: 1 }),
      card({
        slug: "port-card",
        inSitemap: false,
        port: "Glassline",
        portAchievements: 28,
      }),
    ]);

    expect(audit.keep).toEqual(["popular", "port-card"]);
    expect(
      audit.cards.find(({ slug }) => slug === "port-card")?.reason
    ).toContain("Glassline with 28 achievements");
  });

  it("merges an edition into the base card in the sitemap", () => {
    const audit = auditGameCards([
      card({ slug: "base", votes: 900, players: 2 }),
      card({ slug: "base-goty", votes: 10, versionParent: "base" }),
      card({ slug: "base-goty-remaster", versionParent: "base-goty" }),
    ]);

    expect(audit.merged).toEqual({ "base-goty": "base" });
    expect(
      audit.cards.find(({ slug }) => slug === "base-goty-remaster")?.verdict
    ).toBe("noindex");
  });

  it("files a card with no own data as thin", () => {
    const audit = auditGameCards(
      [
        card({ slug: "thin", summaryLength: 412 }),
        card({ slug: "weak", players: 1 }),
      ],
      0
    );

    expect(audit.counts).toMatchObject({ thin: 1, weak: 1, keep: 0 });
    expect(audit.cards.find(({ slug }) => slug === "thin")?.reason).toContain(
      "412-character IGDB summary"
    );
  });
});

const candidate = (
  input: Partial<IDuplicateCandidate> & { slug: string }
): IDuplicateCandidate => ({
  name: input.slug,
  releaseYear: 2013,
  hasIgdb: false,
  votes: 0,
  inSitemap: false,
  ...input,
});

describe("findDuplicates", () => {
  it("normalises the name away to letters and digits", () => {
    expect(normaliseName("Demon's Souls")).toBe("demon s souls");
    expect(normaliseName("  FIFA 14 ")).toBe("fifa 14");
  });

  it("sends a card of the same name and year to the listed one", () => {
    expect(
      findDuplicates([
        candidate({
          slug: "base",
          name: "FIFA 14",
          inSitemap: true,
          votes: 900,
        }),
        candidate({ slug: "base--1", name: "fifa-14" }),
        candidate({ slug: "other", name: "Other", releaseYear: 2014 }),
      ])
    ).toEqual({ "base--1": "base" });
  });

  it("keeps the listed card with the IGDB link as the target", () => {
    expect(
      findDuplicates([
        candidate({
          slug: "listed-without-igdb",
          name: "FIFA 14",
          inSitemap: true,
        }),
        candidate({
          slug: "listed-with-igdb",
          name: "FIFA 14",
          inSitemap: true,
          hasIgdb: true,
        }),
        candidate({ slug: "extra", name: "FIFA 14" }),
      ])
    ).toEqual({ extra: "listed-with-igdb" });
  });

  it("leaves a card without a release year and a port alone", () => {
    expect(
      findDuplicates([
        candidate({ slug: "base", name: "FIFA 14", inSitemap: true }),
        candidate({ slug: "no-year", name: "FIFA 14", releaseYear: null }),
        candidate({ slug: "port", name: "FIFA 14", isPort: true }),
      ])
    ).toEqual({});
  });
});

describe("renderDuplicates", () => {
  it("writes the constant", () => {
    expect(renderDuplicates({ b: "base", a: "base" })).toBe(
      'export const GAME_CARD_DUPLICATES: Readonly<Record<string, string>> = {\n  "a": "base",\n  "b": "base",\n};\n'
    );
  });

  it("breaks a long entry the way prettier does", () => {
    const slug = "harry-potter-and-the-chamber-of-secrets--1";
    const target = "harry-potter-and-the-chamber-of-secrets";

    expect(renderDuplicates({ [slug]: target })).toContain(
      `  "${slug}":\n    "${target}",`
    );
  });
});

describe("compareWithConstants", () => {
  const source = `export const INDEXABLE_GAME_SLUGS: ReadonlySet<string> = new Set([
  "a",
  "b",
]);

export const GAME_CARD_REDIRECTS: Readonly<Record<string, string>> = {
  "edition": "a",
};`;

  const duplicates = `export const GAME_CARD_DUPLICATES: Readonly<Record<string, string>> = {
  "base--1": "a",
};`;

  it("accepts a matching file", () => {
    expect(
      compareWithConstants(source, duplicates, {
        keep: ["a", "b"],
        merged: { edition: "a" },
        duplicates: { "base--1": "a" },
      })
    ).toEqual([]);
  });

  it("reports every disagreement", () => {
    expect(
      compareWithConstants(source, duplicates, {
        keep: ["a", "c"],
        merged: { other: "a" },
        duplicates: { "base--1": "a", "base--2": "b" },
      })
    ).toEqual([
      "keep: add c",
      "keep: drop b",
      "merge: add other",
      "merge: drop edition",
      'duplicate: add "base--2": "b",',
    ]);
  });
});
