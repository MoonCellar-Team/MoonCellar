import type { IGameLevelMode } from "@mooncellar/schemas";
import type { IGameAchievements } from "./achievements";

export type IReplayCheck = (
  replay: Buffer,
  score: number,
  accepted: Buffer[]
) => string | null;

export type ILevelCheck = (
  level: Buffer,
  mode: IGameLevelMode
) => string | null;

export type IGameStorageBucket = {
  maxFileBytes: number;
  maxFiles: number;
  maxBytes: number;
  maxFolders?: number;
};

export type IGameDefinition = {
  slug: string;
  name: string;
  // The slug of the game's page on mooncellar.space (the API's catalogue), if the site has it
  siteGame?: string;
  playUrl?: string;
  scoreOrder: "asc" | "desc";
  scoreUnit: "ms" | "points";
  board: RegExp;
  replay: {
    required: boolean;
    maxBytes: number;
    check?: IReplayCheck;
  };
  // Player levels: present when the game takes levels made by its players. A level's leaderboard
  // is the board `u<levelId>v<version>`, so the game's `board` pattern must accept it.
  levels?: {
    maxBytes: number;
    check?: ILevelCheck;
  };
  storage?: Record<string, IGameStorageBucket>;
  // Achievements: the game's catalog (loadAchievements), when the game has them
  achievements?: IGameAchievements;
};

export const levelBoard = (levelId: string, version: number) =>
  `u${levelId}v${version}`;
