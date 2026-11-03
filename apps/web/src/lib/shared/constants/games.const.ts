import { IGameResponse } from "@mooncellar/schemas";

export const emptyGames: IGameResponse[] = Array(16)
  .fill("")
  .map(() => ({
    name: "",
    _id: "-1",
    artworks: [],
    type: "",
    cover: "",
    first_release: 0,
    modes: [],
    genres: [],
    companies: [],
    keywords: [],
    platforms: [],
    release_dates: [],
    screenshots: [],
    slug: "",
    storyline: "",
    summary: "",
    themes: [],
    websites: [],
    createdAt: "",
    updatedAt: "",
    platformIds: [],
    igdbId: 0,
    retroachievements: [],
  }));

export const takeGames = 60;

export const takeUserGames = 30;

export const takeHubGames = 30;

export const takeHubRecentGames = 6;

export const MIN_GAMES_FOR_INDEX = 100;

export const INDEXABLE_GAME_SLUGS: ReadonlySet<string> = new Set([
  "grand-theft-auto-v",
  "the-witcher-3-wild-hunt",
  "portal-2",
  "the-elder-scrolls-v-skyrim",
  "grand-theft-auto-san-andreas",
  "portal",
  "red-dead-redemption-2",
  "god-of-war--1",
  "the-last-of-us",
  "half-life-2",
  "bioshock",
  "assassin-s-creed-ii",
  "grand-theft-auto-vice-city",
  "the-legend-of-zelda-breath-of-the-wild",
  "half-life",
  "mass-effect-2",
  "bioshock-infinite",
  "batman-arkham-asylum",
  "red-dead-redemption",
  "mass-effect",
  "fallout-new-vegas",
  "tomb-raider--2",
  "elden-ring",
  "hollow-knight",
  "far-cry-3",
  "marvels-spider-man",
  "minecraft-java-edition",
  "super-mario-64",
  "super-mario-world",
  "dark-souls-iii",
  "mirrors-edge",
]);

export const isIndexableGame = (slug: string) => INDEXABLE_GAME_SLUGS.has(slug);

export const GAME_CARD_REDIRECTS: Readonly<Record<string, string>> = {
  "batman-arkham-asylum-game-of-the-year-edition": "batman-arkham-asylum",
  "batman-arkham-city-game-of-the-year-edition": "batman-arkham-city",
  "bloodborne-game-of-the-year-edition": "bloodborne",
  "control-ultimate-edition": "control",
  "cyberpunk-2077-ultimate-edition": "cyberpunk-2077",
  "dark-souls-prepare-to-die-edition": "dark-souls",
  "fallout-3-game-of-the-year-edition": "fallout-3",
  "grand-theft-auto-iv-complete-edition": "grand-theft-auto-iv",
  "grand-theft-auto-v--2": "grand-theft-auto-v",
  "grand-theft-auto-v-special-edition": "grand-theft-auto-v",
  "heroes-of-might-and-magic-iii-complete":
    "heroes-of-might-and-magic-iii-the-restoration-of-erathia",
  "horizon-zero-dawn-complete-edition": "horizon-zero-dawn",
  "the-witcher-3-wild-hunt-complete-edition--1": "the-witcher-3-wild-hunt",
  "the-witcher-3-wild-hunt-game-of-the-year-edition": "the-witcher-3-wild-hunt",
};

export const getGameCardRedirect = (slug: string) =>
  GAME_CARD_REDIRECTS[slug] as string | undefined;
