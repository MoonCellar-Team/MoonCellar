export const API_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || "http://host.containers.internal:3228"
    : process.env.NEXT_PUBLIC_API_URL || "https://api.mooncellar.space";

export const FRONT_URL =
  process.env.NEXT_PUBLIC_FRONT_URL || "https://mooncellar.space";

// The game service of the MoonCellar Team ports (apps/game): their achievements. Links and icons
// in the page always take the public address; server components may reach the container directly
export const GAME_PUBLIC_URL =
  process.env.NEXT_PUBLIC_GAME_URL || "https://game.mooncellar.space";

export const GAME_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_GAME_URL || GAME_PUBLIC_URL
    : GAME_PUBLIC_URL;

export const ACCESS_TOKEN = "accessMoonToken";
export const REFRESH_TOKEN = "refreshMoonToken";

export const accentColor = "#6951ee";
export const accentColorRGB = "105,81,238";

export const links = [
  { name: "Home", link: "/" },
  { name: "Games", link: "/games" },
  { name: "Collections", link: "/collections" },
  { name: "Gauntlet", link: "/gauntlet" },
  { name: "News", link: "/news" },
];

export const dateRegions = [
  "Europe",
  "North America",
  "Australia",
  "New Zealand",
  "Japan",
  "China",
  "Asia",
  "Worldwide",
  "Korea",
  "Brazil",
];

export const gameCategories: { [key: string]: number } = {
  main_game: 0,
  dlc_addon: 1,
  expansion: 2,
  bundle: 3,
  standalone_expansion: 4,
  mod: 5,
  episode: 6,
  season: 7,
  remake: 8,
  remaster: 9,
  expanded_game: 10,
  port: 11,
  fork: 12,
  pack: 13,
  update: 14,
};

export const gameCategoryNames: { [key: string]: string } = {
  main_game: "Game",
  dlc_addon: "DLC",
  expansion: "Expansion",
  bundle: "Bundle",
  standalone_expansion: "Standalone expansion",
  mod: "Mod",
  episode: "Episode",
  season: "Season",
  remake: "Remake",
  remaster: "Remaster",
  expanded_game: "Expanded game",
  port: "Port",
  fork: "Fork",
  pack: "Pack",
  update: "Update",
};

export const coverRatio = 528 / 704;

export const AUTH_MODAL_ID = "auth";

export const STATUS_SEGMENT = "status";
export const STATUS_HOST_PREFIX = "status.";
