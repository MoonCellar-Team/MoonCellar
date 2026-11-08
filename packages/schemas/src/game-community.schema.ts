import { z } from "zod";
import { CustomListSchema } from "./custom-lists.schema";

export const GameCommunityPlaytimeSchema = z.object({
  accounts: z
    .number()
    .int()
    .min(0)
    .describe("Accounts with at least one playthrough of the game"),
  hours: z
    .number()
    .int()
    .min(0)
    .describe("Hours the accounts logged across their playthroughs"),
  lastLoggedAt: z
    .string()
    .nullable()
    .describe("When the newest playthrough was logged"),
});

export const GameCommunityGameSchema = z.object({
  _id: z.string().nonempty().describe("Game id"),
  name: z.string().nonempty().describe("Game name"),
  slug: z.string().nonempty().describe("Game slug"),
  cover: z.string().describe("Cover URL"),
  accounts: z
    .number()
    .int()
    .min(1)
    .describe("Accounts of this game that tracked the game too"),
});

export const GameCommunitySchema = z.object({
  gameId: z.string().nonempty().describe("Game id"),
  playtime: GameCommunityPlaytimeSchema,
  alsoPlayed: GameCommunityGameSchema
    .array()
    .describe("Games the same accounts tracked, most shared first"),
});

export const GameListsResponseSchema = CustomListSchema.array();

export type IGameCommunityPlaytime = z.infer<
  typeof GameCommunityPlaytimeSchema
>;
export type IGameCommunityGame = z.infer<typeof GameCommunityGameSchema>;
export type IGameCommunity = z.infer<typeof GameCommunitySchema>;
export type IGameListsResponse = z.infer<typeof GameListsResponseSchema>;
