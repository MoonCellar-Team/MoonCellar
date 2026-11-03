import { z } from "zod";
import { CharacterSchema } from "./characters.schema";

export const ADULT_THEME_NAME = "Erotic";

export const GAME_TYPES = [
  "Main Game",
  "DLC",
  "Expansion",
  "Bundle",
  "Standalone Expansion",
  "Mod",
  "Episode",
  "Season",
  "Remake",
  "Remaster",
  "Expanded Game",
  "Port",
  "Fork",
  "Pack / Addon",
  "Update",
  "Fan Disc",
] as const;

export const GAME_STATUSES = [
  "Released",
  "Alpha",
  "Beta",
  "Early Access",
  "Offline",
  "Cancelled",
  "Rumored",
  "Delisted",
] as const;

export const RetroachievementsSchema = z.object({
  gameId: z.number(),
  consoleId: z.number(),
  consoleName: z.string().optional(),
  imageIcon: z.string().url().optional(),
  numAchievements: z.number().optional(),
});

export const SteamGameSchema = z.object({
  appId: z.number().describe("Steam app id"),
  name: z.string().describe("Name of the app on Steam"),
  updatedAt: z.string().describe("When the link was last confirmed"),
});

export const SteamAchievementsSchema = z.object({
  appId: z.number().describe("Steam app the count was read from"),
  total: z
    .number()
    .describe("Achievements in the Steam app, 0 when it has none"),
  updatedAt: z.string().describe("When the count was read"),
});

export const VndbSchema = z.object({
  vnId: z.string(),
  lengthMinutes: z.number().nullable().optional(),
  rating: z.number().nullable().optional(),
  votecount: z.number().nullable().optional(),
  relations: z
    .object({ vnId: z.string(), relation: z.string() })
    .array()
    .optional(),
  syncedAt: z.string().optional(),
});

export const IGDBSchema = z.object({
  gameId: z.number(),
  total_rating: z.number().nullable().optional(),
  total_rating_count: z.number().nullable().optional(),
  aggregated_rating: z.number().nullable().optional(),
  aggregated_rating_count: z.number().nullable().optional(),
  rating: z.number().nullable().optional(),
  rating_count: z.number().nullable().optional(),
  hypes: z.number().nullable().optional(),
  screenshotsCount: z.number().nullable().optional(),
  artworksCount: z.number().nullable().optional(),
  status: z.number().nullable().optional(),
  version_parent: z.number().nullable().optional(),
  parent_game: z.number().nullable().optional(),
  url: z.string().nullable().optional(),
  genres: z.number().array().optional(),
  keywords: z.number().array().optional(),
  themes: z.number().array().optional(),
  modes: z.number().array().optional(),
  websites: z.number().array().optional(),
  release_dates: z.number().array().optional(),
  platforms: z.number().array().optional(),
  involved_companies: z.number().array().optional(),
  game_type: z.number().nullable().optional(),
  cover: z.number().array().optional(),
  screenshots: z.number().array().optional(),
  artworks: z.number().array().optional(),
  franchises: z.number().array().optional(),
  videos: z.number().array().optional(),
  alternative_names: z.number().array().optional(),
  game_engines: z.number().array().optional(),
  player_perspectives: z.number().array().optional(),
  dlcs: z.number().array().optional(),
  expansions: z.number().array().optional(),
  standalone_expansions: z.number().array().optional(),
  bundles: z.number().array().optional(),
  expanded_games: z.number().array().optional(),
  forks: z.number().array().optional(),
  ports: z.number().array().optional(),
  remakes: z.number().array().optional(),
  remasters: z.number().array().optional(),
  similar_games: z.number().array().optional(),
});

export const MultiplayerModeSchema = z.object({
  platformId: z.string().nullable().optional(),
  campaignCoop: z.boolean().optional(),
  dropIn: z.boolean().optional(),
  lanCoop: z.boolean().optional(),
  offlineCoop: z.boolean().optional(),
  offlineCoopMax: z.number().nullable().optional(),
  offlineMax: z.number().nullable().optional(),
  onlineCoop: z.boolean().optional(),
  onlineCoopMax: z.number().nullable().optional(),
  onlineMax: z.number().nullable().optional(),
  splitscreen: z.boolean().optional(),
  splitscreenOnline: z.boolean().optional(),
});

export const AgeRatingSchema = z.object({
  organization: z.string(),
  rating: z.string(),
  synopsis: z.string().optional(),
});

export const ExternalPageSchema = z.object({
  name: z.string().optional(),
  uid: z.string(),
  url: z.string().nullable().optional(),
});

export const RelatedGamesSchema = z.object({
  parent_game: z.string().nullable().optional(),
  version_parent: z
    .string()
    .nullable()
    .optional()
    .describe("The game this edition is a version of (IGDB version_parent)"),
  editions: z
    .string()
    .array()
    .optional()
    .describe("Editions of the same game: its versions, or its siblings"),
  dlcs: z.string().array().optional(),
  expansions: z.string().array().optional(),
  standalone_expansions: z.string().array().optional(),
  bundles: z.string().array().optional(),
  expanded_games: z.string().array().optional(),
  forks: z.string().array().optional(),
  ports: z.string().array().optional(),
  remakes: z.string().array().optional(),
  remasters: z.string().array().optional(),
  similar_games: z.string().array().optional(),
  sequels: z.string().array().optional(),
  prequels: z.string().array().optional(),
  side_stories: z.string().array().optional(),
  parent_stories: z.string().array().optional(),
  same_series: z.string().array().optional(),
  same_setting: z.string().array().optional(),
  shared_characters: z.string().array().optional(),
  alternative_versions: z.string().array().optional(),
});

export const HltbSchema = z.object({
  hltbId: z.string(),
  mainStory: z.number().nullable().optional(),
  mainExtra: z.number().nullable().optional(),
  completionist: z.number().nullable().optional(),
  allStyles: z.number().nullable().optional(),
  coop: z.number().nullable().optional(),
  multiplayer: z.number().nullable().optional(),
  mainStoryCount: z.number().nullable().optional(),
  mainExtraCount: z.number().nullable().optional(),
  completionistCount: z.number().nullable().optional(),
  allStylesCount: z.number().nullable().optional(),
  coopCount: z.number().nullable().optional(),
  multiplayerCount: z.number().nullable().optional(),
  reviewScore: z.number().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  platforms: z.string().array().optional(),
  releaseYear: z.number().nullable().optional(),
  similarity: z.number().nullable().optional(),
  alias: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  sourceName: z.string().optional(),
  updatedAt: z.string(),
});

export const CompanySchema = z.object({
  name: z.string(),
  developer: z.boolean().default(false),
  porting: z.boolean().default(false),
  publisher: z.boolean().default(true),
  supporting: z.boolean().default(false),
});

export const GameFiltersSchema = z.object({
  genres: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Genre name(s)")
    .optional(),
  platforms: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Platform id(s)")
    .optional(),
  modes: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Game mode name(s)")
    .optional(),
  keywords: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Keyword name(s)")
    .optional(),
  themes: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Theme name(s)")
    .optional(),
  types: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Game type name(s)")
    .optional(),
  franchises: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Franchise name(s)")
    .optional(),
  companies: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Company name(s)")
    .optional(),
  game_engines: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Game engine name(s)")
    .optional(),
  player_perspectives: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Player perspective name(s)")
    .optional(),
  languages: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Language name(s)")
    .optional(),
  status: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe("Game status value(s)")
    .optional(),
  ageRatings: z
    .string()
    .array()
    .or(z.string().nullish())
    .describe('Age rating(s) as "Organization | Rating" (e.g. "ESRB | Mature")')
    .optional(),
});

export const FilterModeSchema = z.object({
  genres: z.enum(["any", "all"]).optional(),
  platforms: z.enum(["any", "all"]).optional(),
  modes: z.enum(["any", "all"]).optional(),
  keywords: z.enum(["any", "all"]).optional(),
  themes: z.enum(["any", "all"]).optional(),
  types: z.enum(["any", "all"]).optional(),
  franchises: z.enum(["any", "all"]).optional(),
  companies: z.enum(["any", "all"]).optional(),
  game_engines: z.enum(["any", "all"]).optional(),
  player_perspectives: z.enum(["any", "all"]).optional(),
  languages: z.enum(["any", "all"]).optional(),
  status: z.enum(["any", "all"]).optional(),
  ageRatings: z.enum(["any", "all"]).optional(),
});

export const ReleaseDateSchema = z.object({
  date: z.number(),
  human: z.string(),
  month: z.number(),
  year: z.number(),
  platformId: z.string(),
  region: z.coerce.number(),
});

export const GameSchema = z.object({
  _id: z.string(),
  slug: z.string(),
  name: z.string(),
  type: z.string(),
  cover: z.string().nullable(),
  storyline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  modes: z.string().array().optional(),
  genres: z.string().array().optional(),
  keywords: z.string().array().optional(),
  themes: z.string().array().optional(),
  screenshots: z.string().array().optional(),
  artworks: z.string().array().optional(),
  backgroundImage: z
    .string()
    .nullable()
    .optional()
    .describe("Screenshot or artwork URL used as the page background"),
  bannerImage: z
    .string()
    .nullable()
    .optional()
    .describe("Screenshot or artwork URL used as the hero banner"),
  franchises: z.string().array().optional(),
  videos: z.string().array().optional(),
  alternative_names: z.string().array().optional(),
  companies: CompanySchema.array().optional(),
  websites: z.string().array().optional(),
  first_release: z.number().nullable().optional(),
  release_dates: ReleaseDateSchema.array().optional(),
  platformIds: z.string().array(),
  status: z.string().nullable().optional(),
  versionTitle: z.string().nullable().optional(),
  game_engines: z.string().array().optional(),
  player_perspectives: z.string().array().optional(),
  multiplayer_modes: MultiplayerModeSchema.array().optional(),
  ageRatings: AgeRatingSchema.array().optional(),
  languages: z.string().array().optional(),
  externalPages: ExternalPageSchema.array().optional(),
  relatedGames: RelatedGamesSchema.optional(),
  characters: CharacterSchema.array().optional(),
  averageRating: z.number().nullable().optional(),
  ratingsCount: z.number().nullable().optional(),
  isStopParsingPictures: z.boolean().optional(),
  isStopParsing: z.boolean().optional(),
  isCustom: z.boolean().optional(),
  retroachievements: RetroachievementsSchema.array().optional(),
  igdb: IGDBSchema.optional(),
  vndb: VndbSchema.optional(),
  hltb: HltbSchema.optional(),
  steamAchievements: SteamAchievementsSchema.optional(),
  steam: SteamGameSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GetGameBySlugSchema = z.object({
  slug: z.string(),
});

export const GetGameByIdSchema = z.object({
  _id: z.string(),
});

export const GetGamesByIdsSchema = z.object({
  _ids: z.string().array().or(z.string()),
  search: z
    .string()
    .describe("Fuzzy search by game name within the given ids")
    .optional(),
});

export const ACHIEVEMENTS_FILTERS = ["steam", "ra", "both", "any"] as const;

export const AchievementsFilterSchema = z.enum(ACHIEVEMENTS_FILTERS);

export const GetGamesRequestSchema = z.object({
  take: z.coerce
    .number()
    .min(1)
    .max(1000)
    .describe("Amount of games to return")
    .default(50)
    .optional(),
  isRandom: z
    .union([z.string(), z.boolean()])
    .transform((val) =>
      typeof val === "boolean"
        ? val
        : ["false", "0", "no"].includes(val.toLowerCase())
          ? false
          : Boolean(val)
    )
    .describe("Return games in random order")
    .optional(),
  isOnlyWithAchievements: z
    .union([z.string(), z.boolean()])
    .transform((val) =>
      typeof val === "boolean"
        ? val
        : ["false", "0", "no"].includes(val.toLowerCase())
          ? false
          : Boolean(val)
    )
    .describe("Deprecated, use achievements: games with RetroAchievements")
    .optional(),
  isOnlyWithSteamAchievements: z
    .union([z.string(), z.boolean()])
    .transform((val) =>
      typeof val === "boolean"
        ? val
        : ["false", "0", "no"].includes(val.toLowerCase())
          ? false
          : Boolean(val)
    )
    .describe("Deprecated, use achievements: games with Steam achievements")
    .optional(),
  achievements: AchievementsFilterSchema.optional().describe(
    "Games by achievement source: Steam, RetroAchievements, both or either"
  ),
  isOnlySteam: z
    .union([z.string(), z.boolean()])
    .transform((val) =>
      typeof val === "boolean"
        ? val
        : ["false", "0", "no"].includes(val.toLowerCase())
          ? false
          : Boolean(val)
    )
    .describe("Return only games with a Steam store page")
    .optional(),
  page: z.coerce.number().min(1).describe("Page number").default(1).optional(),
  selected: GameFiltersSchema.describe(
    "Filters to include games by"
  ).optional(),
  excluded: GameFiltersSchema.describe(
    "Filters to exclude games by"
  ).optional(),
  search: z.string().describe("Search query for game name").optional(),
  rating: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Minimum combined rating (average of IGDB, HLTB and user ratings, normalized to 0-100)"
    )
    .optional(),
  votes: z
    .number()
    .min(0)
    .describe(
      "Minimum combined ratings count (average of IGDB and user ratings count)"
    )
    .optional(),
  years: z
    .union([
      z
        .tuple([z.coerce.number().min(1900).max(2100)])
        .describe("Exact release year"),
      z
        .tuple([
          z.coerce.number().min(1900).max(2100).nullable(),
          z.coerce.number().min(1900).max(2100).nullable(),
        ])
        .describe(
          "Release year range [start, end]. Pass null for an open end: " +
            "[year, null] means released in or after year, [null, year] means released in or before year"
        ),
    ])
    .describe("Filter by release year")
    .optional(),
  mode: FilterModeSchema.describe(
    "Per-filter match mode: whether each selected filter should match any or all of its values"
  ).optional(),
  excludeGames: z.string().array().describe("Game ids to exclude").optional(),
  sortBy: z
    .enum([
      "total_rating",
      "total_rating_count",
      "first_release",
      "name",
      "rating",
      "ratingsCount",
      "createdAt",
    ])
    .describe("Field to sort games by")
    .optional(),
  sortOrder: z
    .enum(["asc", "desc"])
    .describe("Sort order")
    .default("desc")
    .optional(),
});

export const AddGameRequestSchema = GameSchema.omit({
  _id: true,
  updatedAt: true,
  createdAt: true,
  averageRating: true,
  ratingsCount: true,
  isCustom: true,
}).extend({
  type: z.enum(GAME_TYPES),
  status: z.enum(GAME_STATUSES).nullable().optional(),
});

export const UpdateGameRequestSchema = AddGameRequestSchema.partial();

export const GameAiDraftRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe("Game name or a link to a page about the game"),
});

export const GAME_AI_DRAFT_STATUSES = ["running", "done", "failed"] as const;

export const GameAiDraftRunSchema = z.object({
  _id: z.string(),
  query: z.string(),
  status: z.enum(GAME_AI_DRAFT_STATUSES),
  steps: z.string().array(),
  error: z.string().nullable(),
  draft: AddGameRequestSchema.partial().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GetCustomGameResponseSchema = GameSchema.array();

export const GAME_IMAGE_KINDS = ["cover", "screenshots", "artworks"] as const;
export const GAME_IMAGE_CANDIDATES_MAX = 12;
export const PAGE_IMAGE_CANDIDATES_MAX = 40;

export const FindGameImagesRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .describe("Game name, or a page link to take the images from"),
  kind: z.enum(GAME_IMAGE_KINDS).describe("What to look for"),
  steamAppId: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe("Steam app id, when the game is on Steam"),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(1)
    .describe(
      "Result page; 2 and later return only further image search results"
    ),
});

export const FindGameImagesResponseSchema = z.object({
  urls: z
    .string()
    .array()
    .max(PAGE_IMAGE_CANDIDATES_MAX)
    .describe("Image links that downloaded, best sources first"),
});

export const ImportGameImageRequestSchema = z.object({
  url: z.string().url().max(2048).describe("Image to copy into storage"),
  type: z.enum(["cover", "screenshot", "artwork"]),
});

export const RelatedGameKeySchema = RelatedGamesSchema.keyof();

export const GetRelatedGamesResponseSchema = z.partialRecord(
  RelatedGameKeySchema,
  GameSchema.array()
);

export const GetGameSlugsRequestSchema = z.object({
  count: z.coerce
    .number()
    .min(1)
    .describe("Amount of popular game slugs to return")
    .default(1000)
    .optional(),
});

export const GetGameSlugsResponseSchema = z
  .object({
    slug: z.string(),
    updatedAt: z.string(),
    cover: z.string().nullable(),
  })
  .array();

export const GetRandomGameSlugResponseSchema = z.object({
  slug: z.string(),
});

export const UpcomingReleaseGroupSchema = z.object({
  label: z.string(),
  year: z.number(),
  quarter: z.number(),
  games: GameSchema.array(),
});

export type IRetroachievementsField = z.infer<typeof RetroachievementsSchema>;
export type IGDBField = z.infer<typeof IGDBSchema>;
export type IVndbField = z.infer<typeof VndbSchema>;
export type IHltbField = z.infer<typeof HltbSchema>;
export type ISteamAchievementsField = z.infer<typeof SteamAchievementsSchema>;
export type ISteamGameField = z.infer<typeof SteamGameSchema>;
export type ICompanyField = z.infer<typeof CompanySchema>;
export type IGameFilters = z.infer<typeof GameFiltersSchema>;
export type IFilterMode = z.infer<typeof FilterModeSchema>;
export type IReleaseDate = z.infer<typeof ReleaseDateSchema>;
export type IMultiplayerModeField = z.infer<typeof MultiplayerModeSchema>;
export type IAgeRatingField = z.infer<typeof AgeRatingSchema>;
export type IExternalPageField = z.infer<typeof ExternalPageSchema>;
export type IRelatedGamesField = z.infer<typeof RelatedGamesSchema>;

export type IAddGameRequest = z.infer<typeof AddGameRequestSchema>;
export type IUpdateGameRequest = z.infer<typeof UpdateGameRequestSchema>;
export type IGameAiDraftRequest = z.infer<typeof GameAiDraftRequestSchema>;
export type IGameAiDraftRun = z.infer<typeof GameAiDraftRunSchema>;
export type IGetGamesRequest = z.infer<typeof GetGamesRequestSchema>;
export type IGetGameByIdRequest = z.infer<typeof GetGameByIdSchema>;
export type IGetGameBySlugRequest = z.infer<typeof GetGameBySlugSchema>;
export type IGetGameSlugsRequest = z.infer<typeof GetGameSlugsRequestSchema>;
export type IGetGamesByIdsRequest = z.infer<typeof GetGamesByIdsSchema>;

export type IGameResponse = z.infer<typeof GameSchema>;
export type IRelatedGameKey = z.infer<typeof RelatedGameKeySchema>;
export type IRelatedGamesResponse = z.infer<
  typeof GetRelatedGamesResponseSchema
>;

export type IUpcomingReleaseGroup = z.infer<typeof UpcomingReleaseGroupSchema>;

export type IGetGameSlugsResponse = z.infer<typeof GetGameSlugsResponseSchema>;

export type IGetRandomGameSlugResponse = z.infer<
  typeof GetRandomGameSlugResponseSchema
>;

export type IGenreResponse = { genre: string; count: number };
export type IPlatformCountResponse = { platform: string; count: number };
export type IGameImageKind = (typeof GAME_IMAGE_KINDS)[number];
export type IFindGameImagesRequest = z.infer<
  typeof FindGameImagesRequestSchema
>;
export type IFindGameImagesResponse = z.infer<
  typeof FindGameImagesResponseSchema
>;
export type IImportGameImageRequest = z.infer<
  typeof ImportGameImageRequestSchema
>;

export type IAchievementsFilter = z.infer<typeof AchievementsFilterSchema>;
