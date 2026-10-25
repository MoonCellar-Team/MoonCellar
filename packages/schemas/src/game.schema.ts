import { z } from "zod";
import { GameAccountSchema } from "./game-auth.schema";

export const GameHealthSchema = z.object({
  status: z.literal("ok"),
  database: z.enum(["up", "down"]),
  uptimeSeconds: z.number().int().nonnegative(),
});
export type IGameHealth = z.infer<typeof GameHealthSchema>;

export const GAME_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
export const GAME_BOARD_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const GAME_REPLAY_MAX_BYTES = 256 * 1024;

const gameSlug = z.string().regex(GAME_SLUG_PATTERN);
const boardId = z.string().regex(GAME_BOARD_PATTERN);
const objectId = z.string().regex(/^[0-9a-f]{24}$/);
const replay = z
  .base64()
  .min(1)
  .max(Math.ceil(GAME_REPLAY_MAX_BYTES / 3) * 4);

export const GameDefinitionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  scoreOrder: z.enum(["asc", "desc"]),
  scoreUnit: z.enum(["ms", "points"]),
  replayRequired: z.boolean(),
  // The game's page on the site (the API's catalogue slug), where its achievements are shown
  siteGame: z.string().nullable(),
  achievements: z.number().int().nonnegative(),
});
export type IGameDefinitionInfo = z.infer<typeof GameDefinitionSchema>;

export const GameParamsSchema = z.object({ game: gameSlug });
export type IGameParams = z.infer<typeof GameParamsSchema>;

export const GameBoardParamsSchema = z.object({
  game: gameSlug,
  board: boardId,
});
export type IGameBoardParams = z.infer<typeof GameBoardParamsSchema>;

export const GameLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type IGameLeaderboardQuery = z.infer<typeof GameLeaderboardQuerySchema>;

export const GameLeaderboardEntrySchema = z.object({
  entryId: z.string(),
  rank: z.number().int().positive(),
  userId: z.string(),
  displayName: z.string(),
  score: z.number().int(),
  hasReplay: z.boolean(),
  recordedAt: z.string(),
});
export type IGameLeaderboardEntry = z.infer<typeof GameLeaderboardEntrySchema>;

export const GameLeaderboardSchema = z.object({
  game: z.string(),
  board: z.string(),
  total: z.number().int().nonnegative(),
  entries: z.array(GameLeaderboardEntrySchema),
});
export type IGameLeaderboard = z.infer<typeof GameLeaderboardSchema>;

export const GameSubmitScoreSchema = z.object({
  score: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  replay: replay.optional(),
});
export type IGameSubmitScore = z.infer<typeof GameSubmitScoreSchema>;

export const GameSubmitResultSchema = z.object({
  improved: z.boolean(),
  entry: GameLeaderboardEntrySchema,
});
export type IGameSubmitResult = z.infer<typeof GameSubmitResultSchema>;

export const GameEntryParamsSchema = z.object({
  game: gameSlug,
  entryId: objectId,
});
export type IGameEntryParams = z.infer<typeof GameEntryParamsSchema>;

export const GameReplaySchema = z.object({
  entryId: z.string(),
  game: z.string(),
  board: z.string(),
  userId: z.string(),
  displayName: z.string(),
  score: z.number().int(),
  replay: z.string(),
});
export type IGameReplay = z.infer<typeof GameReplaySchema>;

export const GAME_SIGNAL_MAX_BYTES = 4096;

export const GameSignalClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("host"),
    port: z.number().int().min(0).max(65535).default(0),
  }),
  z.object({
    type: z.literal("join"),
    code: z.string().trim().min(1).max(8),
    port: z.number().int().min(0).max(65535).default(0),
  }),
  z.object({
    type: z.literal("signal"),
    data: z.string().max(GAME_SIGNAL_MAX_BYTES),
  }),
  z.object({ type: z.literal("leave") }),
]);
export type IGameSignalClientMessage = z.infer<
  typeof GameSignalClientMessageSchema
>;

export const GameSignalPeerSchema = z.object({
  name: z.string(),
  address: z.string(),
  port: z.number().int(),
});
export type IGameSignalPeer = z.infer<typeof GameSignalPeerSchema>;

export const GameSignalTurnSchema = z.object({
  urls: z.array(z.string()),
  username: z.string(),
  credential: z.string(),
  ttl: z.number().int(),
});
export type IGameSignalTurn = z.infer<typeof GameSignalTurnSchema>;

export const GameSignalServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hosted"),
    code: z.string(),
    turn: GameSignalTurnSchema.optional(),
  }),
  z.object({
    type: z.literal("joined"),
    code: z.string(),
    peer: GameSignalPeerSchema,
    turn: GameSignalTurnSchema.optional(),
  }),
  z.object({
    type: z.literal("peer"),
    peer: GameSignalPeerSchema,
    turn: GameSignalTurnSchema.optional(),
  }),
  z.object({ type: z.literal("signal"), data: z.string() }),
  z.object({ type: z.literal("left") }),
  z.object({ type: z.literal("closed") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type IGameSignalServerMessage = z.infer<
  typeof GameSignalServerMessageSchema
>;

export const GameFriendSchema = GameAccountSchema;
export type IGameFriend = z.infer<typeof GameFriendSchema>;

export const GAME_CHALLENGE_COMMENT_MAX = 255;

export const GameChallengeCreateSchema = z.object({
  toUserId: objectId,
  board: boardId,
  score: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  comment: z.string().trim().max(GAME_CHALLENGE_COMMENT_MAX).default(""),
  replay: replay.optional(),
});
export type IGameChallengeCreate = z.infer<typeof GameChallengeCreateSchema>;

export const GameChallengeParamsSchema = z.object({
  game: gameSlug,
  challengeId: objectId,
});
export type IGameChallengeParams = z.infer<typeof GameChallengeParamsSchema>;

export const GameChallengeSchema = z.object({
  id: z.string(),
  game: z.string(),
  board: z.string(),
  fromUserId: z.string(),
  fromName: z.string(),
  toUserId: z.string(),
  score: z.number().int(),
  comment: z.string(),
  createdAt: z.string(),
});
export type IGameChallenge = z.infer<typeof GameChallengeSchema>;

export const GameChallengeWithReplaySchema = GameChallengeSchema.extend({
  replay: z.string().nullable(),
});
export type IGameChallengeWithReplay = z.infer<
  typeof GameChallengeWithReplaySchema
>;

// Player levels: a level is the game's own map format, opaque to the service except for the
// game's check; it holds only the player's layout and numbers of pieces from the game's data.

export const GAME_LEVEL_MAX_BYTES = 256 * 1024;
export const GAME_LEVEL_NAME_MAX = 64;
export const GAME_LEVEL_DESCRIPTION_MAX = 500;
export const GAME_LEVEL_REPORT_MAX = 300;

const levelData = z
  .base64()
  .min(1)
  .max(Math.ceil(GAME_LEVEL_MAX_BYTES / 3) * 4);

export const GameLevelParamsSchema = z.object({
  game: gameSlug,
  levelId: objectId,
});
export type IGameLevelParams = z.infer<typeof GameLevelParamsSchema>;

export const GAME_LEVEL_MODES = ["race", "bags"] as const;
export const GAME_LEVEL_TIME_LIMITS = [120000, 180000, 300000] as const;
export const gameLevelMode = z.enum(GAME_LEVEL_MODES);
export type IGameLevelMode = z.infer<typeof gameLevelMode>;

export const GameLevelListQuerySchema = z.object({
  sort: z.enum(["new", "best"]).default("new"),
  mode: gameLevelMode.optional(),
  q: z.string().trim().max(GAME_LEVEL_NAME_MAX).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type IGameLevelListQuery = z.infer<typeof GameLevelListQuerySchema>;

export const GameLevelSchema = z.object({
  id: z.string(),
  game: z.string(),
  name: z.string(),
  description: z.string(),
  base: z.string(),
  mode: gameLevelMode,
  timeLimit: z.number().int().nonnegative(),
  authorId: z.string(),
  authorName: z.string(),
  version: z.number().int().positive(),
  board: z.string(),
  size: z.number().int().nonnegative(),
  hash: z.string(),
  rating: z.number().min(0).max(5),
  ratings: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IGameLevel = z.infer<typeof GameLevelSchema>;

export const GameLevelListSchema = z.object({
  game: z.string(),
  total: z.number().int().nonnegative(),
  levels: z.array(GameLevelSchema),
});
export type IGameLevelList = z.infer<typeof GameLevelListSchema>;

export const GameLevelOwnSchema = GameLevelSchema.extend({
  hidden: z.boolean(),
});
export type IGameLevelOwn = z.infer<typeof GameLevelOwnSchema>;

export const GameLevelOwnListSchema = z.object({
  game: z.string(),
  authorId: z.string(),
  levels: z.array(GameLevelOwnSchema),
});
export type IGameLevelOwnList = z.infer<typeof GameLevelOwnListSchema>;

export const GameLevelUploadSchema = z
  .object({
    name: z.string().trim().min(1).max(GAME_LEVEL_NAME_MAX),
    description: z.string().trim().max(GAME_LEVEL_DESCRIPTION_MAX).default(""),
    base: z.string().regex(/^[a-z0-9_]{1,40}$/),
    mode: gameLevelMode.default("race"),
    timeLimit: z.number().int().nonnegative().default(0),
    data: levelData,
  })
  .refine(
    (level) =>
      level.mode === "race"
        ? level.timeLimit === 0
        : (GAME_LEVEL_TIME_LIMITS as readonly number[]).includes(
            level.timeLimit
          ),
    {
      message: `A bags level takes a time limit of ${GAME_LEVEL_TIME_LIMITS.join(", ")} ms, a race level none`,
      path: ["timeLimit"],
    }
  );
export type IGameLevelUpload = z.infer<typeof GameLevelUploadSchema>;

export const GameLevelFileSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  data: z.string(),
});
export type IGameLevelFile = z.infer<typeof GameLevelFileSchema>;

export const GameLevelRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
});
export type IGameLevelRating = z.infer<typeof GameLevelRatingSchema>;

export const GameLevelReportSchema = z.object({
  reason: z.string().trim().min(1).max(GAME_LEVEL_REPORT_MAX),
});
export type IGameLevelReport = z.infer<typeof GameLevelReportSchema>;

export const GameLevelReportResultSchema = z.object({
  reported: z.literal(true),
  hidden: z.boolean(),
});
export type IGameLevelReportResult = z.infer<
  typeof GameLevelReportResultSchema
>;

export const GameLevelModerationSchema = z.object({
  hidden: z.boolean(),
});
export type IGameLevelModeration = z.infer<typeof GameLevelModerationSchema>;

export const GameLevelReportedSchema = GameLevelSchema.extend({
  hidden: z.boolean(),
  reports: z.array(
    z.object({ userId: z.string(), reason: z.string(), at: z.string() })
  ),
});
export type IGameLevelReported = z.infer<typeof GameLevelReportedSchema>;

export const GAME_STORAGE_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const GAME_STORAGE_BUCKET_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
export const GAME_STORAGE_PATH_PATTERN =
  /^(?!.*(^|\/)\.{1,2}(\/|$))[A-Za-z0-9._-]{1,100}(\/[A-Za-z0-9._-]{1,100}){0,3}$/;

const storagePath = z.string().regex(GAME_STORAGE_PATH_PATTERN);

export const GameStorageParamsSchema = z.object({
  game: gameSlug,
  bucket: z.string().regex(GAME_STORAGE_BUCKET_PATTERN),
});
export type IGameStorageParams = z.infer<typeof GameStorageParamsSchema>;

export const GameStorageFileQuerySchema = z.object({
  path: storagePath,
});
export type IGameStorageFileQuery = z.infer<typeof GameStorageFileQuerySchema>;

export const GameStorageWriteQuerySchema = GameStorageFileQuerySchema.extend({
  revision: z.coerce.number().int().nonnegative().optional(),
});
export type IGameStorageWriteQuery = z.infer<
  typeof GameStorageWriteQuerySchema
>;

export const GameStorageFileSchema = z.object({
  path: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string(),
  updatedAt: z.string(),
});
export type IGameStorageFile = z.infer<typeof GameStorageFileSchema>;

export const GameStorageListSchema = z.object({
  game: z.string(),
  bucket: z.string(),
  revision: z.number().int().nonnegative(),
  createdAt: z.string().nullable(),
  usedBytes: z.number().int().nonnegative(),
  maxBytes: z.number().int().positive(),
  maxFileBytes: z.number().int().positive(),
  maxFiles: z.number().int().positive(),
  files: z.array(GameStorageFileSchema),
});
export type IGameStorageList = z.infer<typeof GameStorageListSchema>;

export const GameStorageWriteResultSchema = z.object({
  revision: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  file: GameStorageFileSchema.nullable(),
});
export type IGameStorageWriteResult = z.infer<
  typeof GameStorageWriteResultSchema
>;

// Achievements of the ports: a catalog per game in one format for every game (the port
// project's docs/achievements.md), and the player's state of each achievement.
export const GAME_ACHIEVEMENT_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const GAME_ACHIEVEMENT_ICON_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*\.svg$/;
export const GAME_LANGUAGE_PATTERN = /^[a-z]{2}(_[A-Z]{2})?$/;

const achievementKey = z.string().regex(GAME_ACHIEVEMENT_KEY_PATTERN);
const achievementTexts = z
  .record(z.string().regex(GAME_LANGUAGE_PATTERN), z.string().min(1))
  .refine((texts) => !!texts.en, "English (en) is required");
const achievementGoal = z.object({
  target: z.number().int().min(2),
  unit: z.enum(["count", "m", "s"]),
});

// The catalog file as the port writes it (format 1); `trigger` belongs to the port
export const GameAchievementCatalogFileSchema = z.object({
  format: z.literal(1),
  game: gameSlug,
  achievements: z
    .array(
      z.object({
        key: achievementKey,
        icon: z.string().regex(GAME_ACHIEVEMENT_ICON_PATTERN),
        title: achievementTexts,
        description: achievementTexts,
        progress: achievementGoal.optional(),
        hidden: z.boolean().optional(),
        trigger: z.record(z.string(), z.unknown()),
      })
    )
    .min(1),
});
export type IGameAchievementCatalogFile = z.infer<
  typeof GameAchievementCatalogFileSchema
>;

// Texts are null for a hidden achievement the player has not unlocked
export const GameAchievementSchema = z.object({
  key: z.string(),
  title: z.record(z.string(), z.string()).nullable(),
  description: z.record(z.string(), z.string()).nullable(),
  icon: z.string(),
  hidden: z.boolean(),
  progress: achievementGoal.nullable(),
});
export type IGameAchievement = z.infer<typeof GameAchievementSchema>;

export const GameAchievementListSchema = z.object({
  game: z.string(),
  total: z.number().int().nonnegative(),
  achievements: z.array(GameAchievementSchema),
});
export type IGameAchievementList = z.infer<typeof GameAchievementListSchema>;

export const GamePlayerAchievementSchema = GameAchievementSchema.extend({
  unlocked: z.boolean(),
  unlockedAt: z.string().nullable(),
  current: z.number().int().nonnegative().nullable(),
});
export type IGamePlayerAchievement = z.infer<
  typeof GamePlayerAchievementSchema
>;

export const GamePlayerAchievementsSchema = z.object({
  game: z.string(),
  userId: z.string(),
  total: z.number().int().nonnegative(),
  unlocked: z.number().int().nonnegative(),
  achievements: z.array(GamePlayerAchievementSchema),
});
export type IGamePlayerAchievements = z.infer<
  typeof GamePlayerAchievementsSchema
>;

export const GameAchievementParamsSchema = z.object({
  game: gameSlug,
  key: achievementKey,
});
export type IGameAchievementParams = z.infer<
  typeof GameAchievementParamsSchema
>;

export const GameAchievementIconParamsSchema = z.object({
  game: gameSlug,
  icon: z.string().regex(GAME_ACHIEVEMENT_ICON_PATTERN),
});
export type IGameAchievementIconParams = z.infer<
  typeof GameAchievementIconParamsSchema
>;

export const GameAchievementPlayerParamsSchema = z.object({
  game: gameSlug,
  userId: objectId,
});
export type IGameAchievementPlayerParams = z.infer<
  typeof GameAchievementPlayerParamsSchema
>;

export const GamePlayerParamsSchema = z.object({ userId: objectId });
export type IGamePlayerParams = z.infer<typeof GamePlayerParamsSchema>;

// What the game reports: the unlock (once; repeating it changes nothing) and/or how far the
// player is. `unlockedAt` — when it happened in the game, for unlocks sent later from a queue
export const GameAchievementReportSchema = z
  .object({
    unlocked: z.literal(true).optional(),
    unlockedAt: z.iso.datetime({ offset: true }).optional(),
    current: z.number().int().nonnegative().max(2_000_000_000).optional(),
  })
  .refine(
    (body) => body.unlocked !== undefined || body.current !== undefined,
    "Send unlocked, current or both"
  );
export type IGameAchievementReport = z.infer<
  typeof GameAchievementReportSchema
>;

export const GamePlayerGameAchievementsSchema = z.object({
  game: z.string(),
  name: z.string(),
  total: z.number().int().nonnegative(),
  unlocked: z.number().int().nonnegative(),
  lastUnlockedAt: z.string().nullable(),
});
export type IGamePlayerGameAchievements = z.infer<
  typeof GamePlayerGameAchievementsSchema
>;
