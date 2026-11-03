import { describe, expect, it } from "bun:test";
import {
  auditGameCards,
  compareWithConstants,
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

describe("compareWithConstants", () => {
  const source = `export const INDEXABLE_GAME_SLUGS: ReadonlySet<string> = new Set([
  "a",
  "b",
]);

export const GAME_CARD_REDIRECTS: Readonly<Record<string, string>> = {
  "edition": "a",
};`;

  it("accepts a matching file", () => {
    expect(
      compareWithConstants(source, {
        keep: ["a", "b"],
        merged: { edition: "a" },
      })
    ).toEqual([]);
  });

  it("reports every disagreement", () => {
    expect(
      compareWithConstants(source, {
        keep: ["a", "c"],
        merged: { other: "a" },
      })
    ).toEqual([
      "keep: add c",
      "keep: drop b",
      "merge: add other",
      "merge: drop edition",
    ]);
  });
});
