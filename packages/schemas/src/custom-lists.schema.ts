import { z } from "zod";
import { CommunityAuthorSchema } from "./comments.schema";
import { GetGamesRequestSchema } from "./games.schema";
import { ObjectIdSchema } from "./utils";

export const CUSTOM_LIST_NAME_MIN = 3;
export const CUSTOM_LIST_NAME_MAX = 60;
export const CUSTOM_LIST_DESCRIPTION_MAX = 300;
export const CUSTOM_LISTS_PER_USER_MAX = 50;
export const CUSTOM_LIST_GAMES_MAX = 500;
export const CUSTOM_LISTS_PAGE_SIZE = 24;
export const CUSTOM_LIST_GAMES_PAGE_SIZE = 30;
export const CUSTOM_LIST_PREVIEW_COVERS = 5;

export const CustomListsSortSchema = z.enum([
  "popular",
  "updatedAt",
  "createdAt",
  "gamesCount",
  "name",
]);
export const CustomListsOrderSchema = z.enum(["asc", "desc"]);
export const CustomListsUpdatedSchema = z.enum(["week", "month", "year"]);
export const CustomListsGamesModeSchema = z.enum(["any", "all"]);
export const CustomListGamePositionSchema = z.enum(["start", "end"]);
export const CustomListGamesSortSchema = z.enum([
  "position",
  "addedAt",
  "name",
  "release",
  "rating",
]);
export const DEFAULT_CUSTOM_LIST_GAMES_SORT = "position";
export const DEFAULT_CUSTOM_LIST_GAMES_ORDER = "asc";

export const CustomListNameSchema = z
  .string()
  .trim()
  .min(CUSTOM_LIST_NAME_MIN)
  .max(CUSTOM_LIST_NAME_MAX)
  .describe("List name");

export const CustomListDescriptionSchema = z
  .string()
  .trim()
  .max(CUSTOM_LIST_DESCRIPTION_MAX)
  .describe("List description");

export const CustomListSourceSchema = z.enum(["steam"]);

export const CustomListGameSchema = z.object({
  gameId: z.string().describe("Game id"),
  addedAt: z.string().describe("Date the game was added"),
  position: z.number().describe("Place in the list order, from 1"),
});

export const CustomListSchema = z.object({
  _id: z.string().describe("List id"),
  userId: z.string().describe("Owner id"),
  name: z.string().describe("List name"),
  slug: z.string().describe("Current slug, unique per owner"),
  description: z.string().describe("List description"),
  isPrivate: z.boolean().describe("Visible to the owner only"),
  isRanked: z.boolean().describe("Games show their position in the list"),
  sortBy: CustomListGamesSortSchema.describe("Default order of the games"),
  sortOrder: CustomListsOrderSchema.describe("Default direction of the order"),
  gamesCount: z.number().describe("Games in the list"),
  source: CustomListSourceSchema.optional().describe(
    "Imported from an account; the games follow it and the list goes when it is unlinked"
  ),
  isGenerated: z
    .boolean()
    .optional()
    .describe(
      "Built by MoonCellar from its own data; it lives at /collections/<slug>, not on a profile"
    ),
  likesCount: z.number().describe("Likes from other players"),
  isLiked: z
    .boolean()
    .optional()
    .describe("The signed-in viewer liked the list"),
  covers: z
    .string()
    .array()
    .describe("Covers of the first games, in list order"),
  author: CommunityAuthorSchema.nullable().describe("Owner"),
  containsGame: z
    .boolean()
    .optional()
    .describe("The game from the request is in the list"),
  createdAt: z.string().describe("Creation date"),
  updatedAt: z.string().describe("Last update date"),
});

export const CustomListDetailsSchema = CustomListSchema.extend({
  games: CustomListGameSchema.array().describe(
    "Games in the requested order, or the list's default one"
  ),
});

export const CreateCustomListRequestSchema = z.object({
  name: CustomListNameSchema,
  description: CustomListDescriptionSchema.optional(),
  isPrivate: z.boolean().default(false),
  isRanked: z.boolean().default(false),
  sortBy: CustomListGamesSortSchema.default(DEFAULT_CUSTOM_LIST_GAMES_SORT),
  sortOrder: CustomListsOrderSchema.default(DEFAULT_CUSTOM_LIST_GAMES_ORDER),
  gameId: ObjectIdSchema.optional().describe("Game to add right away"),
});

export const UpdateCustomListRequestSchema = z.object({
  name: CustomListNameSchema.optional(),
  description: CustomListDescriptionSchema.optional(),
  isPrivate: z.boolean().optional(),
  isRanked: z.boolean().optional(),
  sortBy: CustomListGamesSortSchema.optional(),
  sortOrder: CustomListsOrderSchema.optional(),
});

export const AddCustomListGameRequestSchema = z.object({
  gameId: ObjectIdSchema,
  position: CustomListGamePositionSchema.default("end"),
});

export const ReorderCustomListRequestSchema = z.object({
  gameIds: ObjectIdSchema.array().max(CUSTOM_LIST_GAMES_MAX),
});

export const ReorderCustomListsRequestSchema = z.object({
  listIds: ObjectIdSchema.array().max(CUSTOM_LISTS_PER_USER_MAX),
});

export const GetCustomListsRequestSchema = z.object({
  search: z.string().trim().max(100).optional().describe("Name or description"),
  author: z.string().trim().max(15).optional().describe("Author user name"),
  games: z
    .union([ObjectIdSchema.array(), z.string()])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split(","))
        .map((id) => id.trim())
        .filter(Boolean)
    )
    .pipe(ObjectIdSchema.array().max(20))
    .optional()
    .describe("Game ids the list contains"),
  gamesMode: CustomListsGamesModeSchema.default("any"),
  minGames: z.coerce.number().int().min(1).optional(),
  updated: CustomListsUpdatedSchema.optional(),
  sortBy: CustomListsSortSchema.default("popular"),
  sortOrder: CustomListsOrderSchema.default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  take: z.coerce.number().int().min(1).max(50).default(CUSTOM_LISTS_PAGE_SIZE),
});

export const GetCustomListsResponseSchema = z.object({
  results: CustomListSchema.array(),
  total: z.number(),
});

export const GetUserCustomListsRequestSchema = z.object({
  gameId: ObjectIdSchema.optional().describe("Mark lists containing the game"),
});

export const GetUserCustomListsResponseSchema = CustomListSchema.array();

export const GetCustomListBySlugRequestSchema = z.object({
  userName: z.string().min(3).max(15),
  slug: z.string().min(1).max(80),
  sortBy: CustomListGamesSortSchema.optional().describe(
    "Order of the games, the list's default when omitted"
  ),
  sortOrder: CustomListsOrderSchema.optional(),
});

export const CustomListGamesFiltersSchema = GetGamesRequestSchema.pick({
  selected: true,
  excluded: true,
  mode: true,
  years: true,
  rating: true,
  votes: true,
  search: true,
  isOnlyWithAchievements: true,
  isOnlyWithSteamAchievements: true,
  isOnlySteam: true,
  achievements: true,
});

export const FilterCustomListBySlugRequestSchema =
  GetCustomListBySlugRequestSchema.extend({
    filters: CustomListGamesFiltersSchema.optional().describe(
      "Catalogue filters applied to the games of the list"
    ),
  });

export const CustomListLikeResponseSchema = z.object({
  likesCount: z.number().describe("Likes after the change"),
  isLiked: z.boolean().describe("Whether the viewer's like is set"),
});

export const CustomListGameCountsResponseSchema = z.record(
  z.string(),
  z.number()
);

export type ICustomListsSort = z.infer<typeof CustomListsSortSchema>;
export type ICustomListsOrder = z.infer<typeof CustomListsOrderSchema>;
export type ICustomListGamesSort = z.infer<typeof CustomListGamesSortSchema>;
export type ICustomListsUpdated = z.infer<typeof CustomListsUpdatedSchema>;
export type ICustomListsGamesMode = z.infer<typeof CustomListsGamesModeSchema>;
export type ICustomListGamePosition = z.infer<
  typeof CustomListGamePositionSchema
>;
export type ICustomListGame = z.infer<typeof CustomListGameSchema>;
export type ICustomList = z.infer<typeof CustomListSchema>;
export type ICustomListSource = z.infer<typeof CustomListSourceSchema>;
export type ICustomListDetails = z.infer<typeof CustomListDetailsSchema>;
export type ICreateCustomListRequest = z.input<
  typeof CreateCustomListRequestSchema
>;
export type IUpdateCustomListRequest = z.infer<
  typeof UpdateCustomListRequestSchema
>;
export type IAddCustomListGameRequest = z.input<
  typeof AddCustomListGameRequestSchema
>;
export type IReorderCustomListRequest = z.infer<
  typeof ReorderCustomListRequestSchema
>;
export type IReorderCustomListsRequest = z.infer<
  typeof ReorderCustomListsRequestSchema
>;
export type IGetCustomListsRequest = z.input<
  typeof GetCustomListsRequestSchema
>;
export type IGetCustomListsQuery = z.output<typeof GetCustomListsRequestSchema>;
export type IGetCustomListsResponse = z.infer<
  typeof GetCustomListsResponseSchema
>;
export type IGetUserCustomListsRequest = z.infer<
  typeof GetUserCustomListsRequestSchema
>;
export type IGetCustomListBySlugRequest = z.infer<
  typeof GetCustomListBySlugRequestSchema
>;
export type ICustomListGamesFilters = z.infer<
  typeof CustomListGamesFiltersSchema
>;
export type IFilterCustomListBySlugRequest = z.infer<
  typeof FilterCustomListBySlugRequestSchema
>;
export type ICustomListSort = Pick<
  IGetCustomListBySlugRequest,
  "sortBy" | "sortOrder"
>;
export type ICustomListLikeResponse = z.infer<
  typeof CustomListLikeResponseSchema
>;
export type ICustomListGameCountsResponse = z.infer<
  typeof CustomListGameCountsResponseSchema
>;
