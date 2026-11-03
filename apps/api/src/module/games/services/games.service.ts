import { sortCharactersByRole } from "../utils/character-order.utils";
import { pickEmptyFields } from "../utils/fill-fields.utils";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import * as fuzzysort from "fuzzysort";
import {
  type IAddGameRequest,
  type IGetGameByIdRequest,
  type IGetGameBySlugRequest,
  type IGetGamesByIdsRequest,
  type IGetGamesRequest,
  type IGetGameSlugsRequest,
  type IUpdateGameRequest,
  type IGetGameFollowingsStatusRequest,
  type IGetGameFollowingsStatusResponse,
  type IGameStats,
  type IGetGamesStatsResponse,
  type IRelatedGamesResponse,
  type IGameCommunity,
  type IGameCommunityGame,
} from "@mooncellar/schemas";
import { Game, type GameDocument } from "../schemas/game.schema";
import {
  type IPlaythroughDocument,
  Playthrough,
} from "../schemas/playthroughs.schema";
import {
  gamesFilters,
  combinedRatingsCountExpr,
  weightedRatingExpr,
} from "../../../shared/games";
import { GameMatcherService } from "../matching/game-matcher.service";
import { ConflictsService } from "../../conflicts/services/conflicts.service";
import { FileService } from "../../user/services/file-upload.service";
import { User } from "../../user/schemas/user.schema";
import { Rating } from "../../user/schemas/user-ratings.schema";
import { UserLogs } from "../../user/schemas/user-logs.schema";
import { IndexNowService } from "../../indexnow/indexnow.service";
import { FRONT_URL } from "../../../shared/constants";
import { normalizeSearchText } from "../../../shared/utils";
import {
  normalizeTitle,
  replaceRomanNumerals,
} from "../utils/title-match.utils";
import { pickFollowingsStatus } from "../utils/followings-status.utils";
import { parseS3ImageUrl, S3_FOLDERS, type S3Folder } from "../../../shared/s3";

const SEARCH_CANDIDATES_LIMIT = 1000;
const SEARCH_SCORE_THRESHOLD = 0.3;
const SEARCH_INDEX_TTL_MS = 10 * 60 * 1000;

const SEARCH_RELEVANCE_FALLBACK_TIER = 4;
const SEARCH_RELEVANCE_FIELD = "_searchRelevanceTier";
const ALSO_PLAYED_LIMIT = 6;

export const getSearchRelevanceTier = (query: string, name: string) => {
  if (name === query) return 0;
  if (`${name} `.startsWith(`${query} `)) return 1;
  if (` ${name} `.includes(` ${query} `)) return 2;
  if (name.includes(query)) return 3;
  return SEARCH_RELEVANCE_FALLBACK_TIER;
};

export const getSearchNames = ({
  name,
  alternative_names,
}: {
  name: string;
  alternative_names?: string[] | null;
}) => {
  const names = [name, ...(alternative_names ?? [])]
    .map(normalizeSearchText)
    .filter(Boolean);

  return [...new Set(names.flatMap((n) => [n, replaceRomanNumerals(n)]))];
};

const SORT_FIELD_MAP: Record<string, string> = {
  total_rating: "igdb.total_rating",
  total_rating_count: "igdb.total_rating_count",
  first_release: "first_release",
  name: "name",
  createdAt: "createdAt",
};

const COMBINED_RATING_FIELD = "_combinedRating";
const COMBINED_RATINGS_COUNT_FIELD = "_combinedRatingsCount";

const COMBINED_RATING_STAGE = {
  $addFields: {
    [COMBINED_RATING_FIELD]: weightedRatingExpr,
  },
};

const COMBINED_RATINGS_COUNT_STAGE = {
  $addFields: {
    [COMBINED_RATINGS_COUNT_FIELD]: combinedRatingsCountExpr,
  },
};

const SEARCH_PROJECTION_STAGE = {
  $project: {
    _id: 1,
    slug: 1,
    name: 1,
    cover: 1,
    first_release: 1,
    platformIds: 1,
    themes: 1,
    averageRating: 1,
    ratingsCount: 1,
    retroachievements: 1,
    "igdb.gameId": 1,
    "igdb.total_rating": 1,
    "hltb.reviewScore": 1,
  },
};

const RELATED_GAMES_PER_RELATION_LIMIT = 24;

const CHARACTERS_LOOKUP_STAGE = {
  $lookup: {
    from: "characters",
    localField: "_id",
    foreignField: "gameIds",
    as: "characters",
    pipeline: [{ $sort: { name: 1 as const } }],
  },
};

export const STRIP_CHARACTERS_STAGE = { $unset: "characters" };

const withOrderedCharacters = <
  T extends {
    _id: unknown;
    vndb?: { vnId?: string | null } | null;
    characters?: Parameters<typeof sortCharactersByRole>[0];
  },
>(
  game: T
) => ({
  ...game,
  characters: sortCharactersByRole(
    game.characters ?? [],
    game.vndb?.vnId,
    String(game._id)
  ),
});

export const TRIM_IGDB_STAGE = {
  $addFields: {
    igdb: {
      $cond: [
        { $ifNull: ["$igdb", false] },
        {
          gameId: "$igdb.gameId",
          total_rating: "$igdb.total_rating",
          total_rating_count: "$igdb.total_rating_count",
        },
        "$$REMOVE",
      ],
    },
  },
};

type SearchIndexEntry = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

@Injectable()
export class GamesService implements OnModuleInit {
  private readonly logger = new Logger(GamesService.name);
  private searchIndexCache: SearchIndexEntry[] | null = null;
  private searchIndexCachedAt = 0;
  private searchIndexRefreshPromise: Promise<SearchIndexEntry[]> | null = null;

  constructor(
    @InjectModel(Game.name)
    private Games: Model<GameDocument>,
    @InjectModel(User.name)
    private users: Model<User>,
    @InjectModel(Playthrough.name)
    private playthroughs: Model<IPlaythroughDocument>,
    @InjectModel(Rating.name)
    private ratings: Model<Rating>,
    @InjectModel(UserLogs.name)
    private userLogs: Model<UserLogs>,
    private fileService: FileService,
    private indexNow: IndexNowService,
    private gameMatcher: GameMatcherService,
    private conflicts: ConflictsService
  ) {}

  onModuleInit() {
    this.conflicts.useDeleteGame((gameId) => this.deleteGame(gameId));
    this.getSearchIndex().catch((err) =>
      this.logger.error(err, "Failed to warm up search index")
    );
  }

  private async getSearchIndex(): Promise<SearchIndexEntry[]> {
    const isStale = Date.now() - this.searchIndexCachedAt > SEARCH_INDEX_TTL_MS;

    if (this.searchIndexCache && !isStale) {
      return this.searchIndexCache;
    }

    if (!this.searchIndexRefreshPromise) {
      this.searchIndexRefreshPromise = this.Games.find({
        _id: { $exists: true },
      })
        .select("_id name alternative_names")
        .lean<
          {
            _id: mongoose.Types.ObjectId;
            name: string;
            alternative_names?: string[];
          }[]
        >()
        .then((docs) => {
          const entries = docs.flatMap((doc) =>
            getSearchNames(doc).map((name) => ({ _id: doc._id, name }))
          );
          this.searchIndexCache = entries;
          this.searchIndexCachedAt = Date.now();
          this.searchIndexRefreshPromise = null;
          return entries;
        })
        .catch((err) => {
          this.searchIndexRefreshPromise = null;
          throw err;
        });
    }

    return this.searchIndexCache ?? this.searchIndexRefreshPromise;
  }

  private async searchIndex(
    search: string,
    filter?: (entry: SearchIndexEntry) => boolean
  ) {
    const query = normalizeSearchText(search);
    const index = await this.getSearchIndex();
    const matches = fuzzysort.go(query, filter ? index.filter(filter) : index, {
      key: "name",
      limit: SEARCH_CANDIDATES_LIMIT,
      threshold: SEARCH_SCORE_THRESHOLD,
    });
    const best = new Map<
      string,
      { _id: mongoose.Types.ObjectId; tier: number }
    >();

    for (const match of matches) {
      const id = match.obj._id.toString();
      const tier = getSearchRelevanceTier(query, match.obj.name);

      if ((best.get(id)?.tier ?? Infinity) > tier) {
        best.set(id, { _id: match.obj._id, tier });
      }
    }

    return [...best.values()];
  }

  async importImage(
    gameId: mongoose.Types.ObjectId,
    url: string,
    type: "cover" | "screenshot" | "artwork"
  ) {
    if (!(await this.Games.exists({ _id: gameId }))) {
      throw new NotFoundException("Game not found");
    }

    try {
      return await this.fileService.uploadRemoteImage(
        url,
        `${gameId.toString()}/${new mongoose.Types.ObjectId().toString()}`,
        {
          cover: S3_FOLDERS.covers,
          screenshot: S3_FOLDERS.screenshots,
          artwork: S3_FOLDERS.artworks,
        }[type],
        { useSessions: true }
      );
    } catch (err) {
      throw new BadRequestException(
        `Could not copy the image: ${(err as Error).message}`
      );
    }
  }

  async uploadImage(
    gameId: mongoose.Types.ObjectId,
    image: Express.Multer.File,
    type: "cover" | "screenshot" | "artwork"
  ) {
    try {
      const game = await this.Games.findOne({
        _id: new mongoose.Types.ObjectId(gameId),
      });
      if (!game) throw new NotFoundException("Game not found");
      const _id = new mongoose.Types.ObjectId();
      const folder = {
        cover: S3_FOLDERS.covers,
        screenshot: S3_FOLDERS.screenshots,
        artwork: S3_FOLDERS.artworks,
      }[type];

      const storedKey = await this.fileService.uploadFile(
        image,
        `${gameId.toString()}/${_id.toString()}`,
        folder
      );

      if (!storedKey) throw new BadRequestException("No image uploaded");

      return this.fileService.getPublicUrl(folder, storedKey);
    } catch (err) {
      this.logger.error(err, `Failed to upload image for game: ${gameId}`);
      throw err;
    }
  }

  async getGameBySlug({ slug }: IGetGameBySlugRequest) {
    try {
      const game = (
        await this.Games.aggregate([
          { $match: { slug } },
          CHARACTERS_LOOKUP_STAGE,
          TRIM_IGDB_STAGE,
        ])
      ).pop();

      if (!game) throw new NotFoundException(`Game not found: ${slug}`);

      return withOrderedCharacters(game);
    } catch (err) {
      this.logger.error(err, `Failed to get game by slug: ${slug}`);
      throw err;
    }
  }

  async getGameById({ _id }: IGetGameByIdRequest) {
    try {
      const game = (
        await this.Games.aggregate([
          { $match: { _id } },
          CHARACTERS_LOOKUP_STAGE,
          TRIM_IGDB_STAGE,
        ])
      ).pop();

      if (!game) throw new NotFoundException(`Game not found: ${_id}`);

      return withOrderedCharacters(game);
    } catch (err) {
      this.logger.error(err, `Failed to get game by id: ${_id}`);
      throw err;
    }
  }

  async getGamesByIds(dto: IGetGamesByIdsRequest) {
    if (!dto._ids?.length) {
      return [];
    }

    try {
      const ids = Array.isArray(dto._ids) ? dto._ids : [dto._ids];
      const search = dto.search?.trim();

      if (!search) {
        return await this.Games.aggregate([
          {
            $match: {
              _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
            },
          },
          TRIM_IGDB_STAGE,
          STRIP_CHARACTERS_STAGE,
        ]);
      }

      const idSet = new Set(ids);
      const matches = await this.searchIndex(search, (entry) =>
        idSet.has(entry._id.toString())
      );

      if (!matches.length) {
        return [];
      }

      const matchedIds = matches.map((match) => match._id);

      return await this.Games.aggregate([
        { $match: { _id: { $in: matchedIds } } },
        SEARCH_PROJECTION_STAGE,
      ]);
    } catch (err) {
      this.logger.error(err, `Failed to get games by ids: ${dto._ids}`);
      throw err;
    }
  }

  async getGames({
    take = 50,
    isRandom = false,
    isOnlyWithAchievements = false,
    isOnlyWithSteamAchievements = false,
    isOnlySteam = false,
    achievements,
    page = 1,
    selected,
    excluded,
    search,
    mode,
    years,
    rating,
    votes,
    excludeGames,
    sortBy,
    sortOrder = "desc",
  }: IGetGamesRequest) {
    try {
      const baseFilters = {
        isOnlyWithAchievements,
        isOnlyWithSteamAchievements,
        isOnlySteam,
        achievements,
        selected,
        excluded,
        mode,
        years,
        excludeGames,
        rating,
        votes,
      };

      let searchedIds: mongoose.Types.ObjectId[] | undefined;
      let searchRelevanceTiers: number[] | undefined;

      if (search) {
        const matches = await this.searchIndex(search);

        searchedIds = matches.map((match) => match._id);
        searchRelevanceTiers = matches.map((match) => match.tier);

        if (!searchedIds.length) {
          return { results: [], total: 0 };
        }
      }

      const pagination = [{ $skip: (+page - 1) * +take }, { $limit: +take }];

      const isDefaultSearchSort = !!search && !sortBy;
      const effectiveSortBy = sortBy ?? (search ? "ratingsCount" : undefined);
      const isCombinedRatingSort = effectiveSortBy === "rating";
      const isCombinedVotesSort = effectiveSortBy === "ratingsCount";
      const sortField = effectiveSortBy
        ? SORT_FIELD_MAP[effectiveSortBy]
        : "igdb.total_rating_count";
      const sortDirection = sortOrder === "asc" ? 1 : -1;

      const matchStage = gamesFilters(baseFilters, searchedIds);
      const matchFilter = matchStage.$match;

      const results = await this.Games.aggregate([
        matchStage,
        ...(isCombinedRatingSort ? [COMBINED_RATING_STAGE] : []),
        ...(isCombinedVotesSort ? [COMBINED_RATINGS_COUNT_STAGE] : []),
        ...(isDefaultSearchSort
          ? [
              {
                $addFields: {
                  [SEARCH_RELEVANCE_FIELD]: {
                    $let: {
                      vars: {
                        idx: { $indexOfArray: [searchedIds, "$_id"] },
                      },
                      in: {
                        $cond: [
                          { $gte: ["$$idx", 0] },
                          { $arrayElemAt: [searchRelevanceTiers, "$$idx"] },
                          SEARCH_RELEVANCE_FALLBACK_TIER,
                        ],
                      },
                    },
                  },
                },
              },
            ]
          : []),
        {
          $sort: {
            ...(isDefaultSearchSort ? { [SEARCH_RELEVANCE_FIELD]: 1 } : {}),
            [isCombinedRatingSort
              ? COMBINED_RATING_FIELD
              : isCombinedVotesSort
                ? COMBINED_RATINGS_COUNT_FIELD
                : sortField]: sortDirection as 1 | -1,
          },
        },
        ...(isRandom ? [{ $sample: { size: +take } }] : pagination),
        ...(isCombinedRatingSort ? [{ $unset: COMBINED_RATING_FIELD }] : []),
        ...(isCombinedVotesSort
          ? [{ $unset: COMBINED_RATINGS_COUNT_FIELD }]
          : []),
        ...(isDefaultSearchSort ? [{ $unset: SEARCH_RELEVANCE_FIELD }] : []),
        TRIM_IGDB_STAGE,
        STRIP_CHARACTERS_STAGE,
      ]);

      const total = searchedIds
        ? searchedIds.length
        : Object.keys(matchFilter).length === 0
          ? await this.Games.estimatedDocumentCount()
          : await this.Games.countDocuments(matchFilter);

      return { results, total };
    } catch (err) {
      this.logger.error(err, `Failed to get games`);
      throw err;
    }
  }

  async addGame(data: IAddGameRequest, force = false) {
    try {
      const slugTaken = await this.Games.exists({ slug: data.slug });
      if (slugTaken) {
        throw new ConflictException(`Slug already exists: ${data.slug}`);
      }

      if (!force) await this.gameMatcher.assertNoDuplicates(data);

      const now = new Date().toISOString();
      const _id = new mongoose.Types.ObjectId();

      const game = await this.Games.create({
        ...data,
        ...(await this.storeRemoteImages(_id, data)),
        _id,
        nameNormalized: normalizeTitle(data.name),
        isCustom: true,
        createdAt: now,
        updatedAt: now,
      });

      if (data.retroachievements?.length) {
        await this.conflicts.pin(
          "ra",
          data.retroachievements.map(({ gameId }) => String(gameId)),
          game._id
        );
      }

      this.indexNow.submitUrl(`${FRONT_URL}/games/${game.slug}`);

      return game;
    } catch (err) {
      this.logger.error(err, `Failed to add game: ${JSON.stringify(data)}`);
      throw err;
    }
  }

  async fillEmptyFields(
    gameId: mongoose.Types.ObjectId,
    data: Partial<IAddGameRequest>
  ): Promise<string[]> {
    const game = await this.Games.findById(gameId).lean();

    if (!game) return [];

    const fill = pickEmptyFields(
      game as unknown as Record<string, unknown>,
      data
    );
    const keys = Object.keys(fill);

    if (!keys.length) return [];

    const images = await this.storeRemoteImages(
      gameId,
      fill as IAddGameRequest
    );

    await this.Games.updateOne(
      { _id: gameId },
      {
        $set: {
          ...fill,
          ...Object.fromEntries(
            Object.entries(images).filter(([key]) => key in fill)
          ),
          updatedAt: new Date().toISOString(),
        },
      }
    );
    this.indexNow.submitUrl(`${FRONT_URL}/games/${game.slug}`);

    return keys;
  }

  private async storeRemoteImages(
    gameId: mongoose.Types.ObjectId,
    {
      cover,
      screenshots,
      artworks,
      bannerImage,
      backgroundImage,
    }: IAddGameRequest
  ) {
    const stored = new Map<string, string>();
    const store = async (url: string, folder: S3Folder) => {
      if (parseS3ImageUrl(url)) return url;

      try {
        const link = await this.fileService.uploadRemoteImage(
          url,
          `${gameId.toString()}/${new mongoose.Types.ObjectId().toString()}`,
          folder,
          { useSessions: true }
        );
        stored.set(url, link);

        return link;
      } catch (err) {
        throw new BadRequestException(
          `Failed to store image ${url}: ${(err as Error).message}`
        );
      }
    };
    const storeAll = async (urls: string[] | undefined, folder: S3Folder) =>
      urls && Promise.all(urls.map((url) => store(url, folder)));
    const pageImage = (url?: string | null) => (url && stored.get(url)) || url;

    const images = {
      cover: cover && (await store(cover, S3_FOLDERS.covers)),
      screenshots: await storeAll(screenshots, S3_FOLDERS.screenshots),
      artworks: await storeAll(artworks, S3_FOLDERS.artworks),
    };

    return {
      ...images,
      bannerImage: pageImage(bannerImage),
      backgroundImage: pageImage(backgroundImage),
    };
  }

  async updateGame(_id: mongoose.Types.ObjectId, data: IUpdateGameRequest) {
    try {
      if (data.slug) {
        const slugTaken = await this.Games.exists({
          slug: data.slug,
          _id: { $ne: _id },
        });
        if (slugTaken) {
          throw new ConflictException(`Slug already exists: ${data.slug}`);
        }
      }

      const game = await this.Games.findOneAndUpdate(
        { _id },
        {
          ...data,
          ...(data.name && { nameNormalized: normalizeTitle(data.name) }),
          updatedAt: new Date().toISOString(),
        },
        { new: true }
      );

      if (!game) throw new NotFoundException(`Game not found: ${_id}`);

      this.indexNow.submitUrl(`${FRONT_URL}/games/${game.slug}`);

      return game;
    } catch (err) {
      this.logger.error(err, `Failed to update game: ${_id}`);
      throw err;
    }
  }

  async deleteGame(_id: mongoose.Types.ObjectId) {
    try {
      const game = await this.Games.findOneAndDelete({ _id });

      if (!game) throw new NotFoundException(`Game not found: ${_id}`);

      await Promise.all([
        this.playthroughs.deleteMany({ gameId: _id }),
        this.ratings.deleteMany({ gameId: _id }),
        this.userLogs.deleteMany({ gameId: _id }),
        this.users.updateMany(
          { "presets.preset": _id.toString() },
          { $pull: { "presets.$[].preset": _id.toString() } }
        ),
        this.Games.db
          .collection<{
            gameIds: mongoose.Types.ObjectId[];
            spoilerGameIds: mongoose.Types.ObjectId[];
          }>("characters")
          .updateMany(
            { $or: [{ gameIds: _id }, { spoilerGameIds: _id }] },
            { $pull: { gameIds: _id, spoilerGameIds: _id } }
          ),
      ]);

      await this.deleteGameImages(game);

      this.indexNow.submitUrl(`${FRONT_URL}/games/${game.slug}`);

      return game;
    } catch (err) {
      this.logger.error(err, `Failed to delete game: ${_id}`);
      throw err;
    }
  }

  private async deleteGameImages(game: Game) {
    const keysByFolder = new Map<S3Folder, Set<string>>();

    [
      game.cover,
      game.backgroundImage,
      game.bannerImage,
      ...(game.screenshots ?? []),
      ...(game.artworks ?? []),
    ].forEach((url) => {
      const ref = parseS3ImageUrl(url);

      if (!ref) return;

      keysByFolder.set(
        ref.folder,
        (keysByFolder.get(ref.folder) ?? new Set()).add(ref.key)
      );
    });

    for (const [folder, keys] of keysByFolder) {
      await this.fileService
        .deleteFiles([...keys], folder)
        .catch((err: Error) =>
          this.logger.error(err, `Failed to delete images of ${game.slug}`)
        );
    }
  }

  async getTopRatedRandomGames() {
    try {
      const games = await this.Games.aggregate([
        {
          $match: {
            "igdb.total_rating": { $exists: true, $gt: 80 },
            "igdb.total_rating_count": { $exists: true, $gt: 100 },
          },
        },
        {
          $sample: { size: 3 },
        },
        TRIM_IGDB_STAGE,
        STRIP_CHARACTERS_STAGE,
      ]);

      return games;
    } catch (err) {
      this.logger.error(err, `Failed to get top rated random games`);
      throw err;
    }
  }

  async getUpcomingReleases() {
    try {
      const nowSeconds = Math.floor(Date.now() / 1000);

      const groups = await this.Games.aggregate([
        {
          $match: {
            first_release: { $gt: nowSeconds },
            cover: { $ne: null },
          },
        },
        { $sort: { "igdb.hypes": -1, first_release: 1 } },
        TRIM_IGDB_STAGE,
        STRIP_CHARACTERS_STAGE,
        {
          $addFields: {
            _releaseDate: {
              $toDate: { $multiply: ["$first_release", 1000] },
            },
          },
        },
        {
          $addFields: {
            _year: { $year: "$_releaseDate" },
            _quarter: {
              $ceil: { $divide: [{ $month: "$_releaseDate" }, 3] },
            },
          },
        },
        {
          $group: {
            _id: { year: "$_year", quarter: "$_quarter" },
            games: { $push: "$$ROOT" },
          },
        },
        { $sort: { "_id.year": 1, "_id.quarter": 1 } },
        { $limit: 4 },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            quarter: "$_id.quarter",
            label: {
              $concat: [
                "Q",
                { $toString: "$_id.quarter" },
                " ",
                { $toString: "$_id.year" },
              ],
            },
            games: {
              $map: {
                input: { $slice: ["$games", 12] },
                as: "game",
                in: {
                  $unsetField: {
                    field: "_releaseDate",
                    input: {
                      $unsetField: {
                        field: "_year",
                        input: {
                          $unsetField: { field: "_quarter", input: "$$game" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ]);

      return groups;
    } catch (err) {
      this.logger.error(err, `Failed to get upcoming releases`);
      throw err;
    }
  }

  async getAllSlugs({ count = 1000 }: IGetGameSlugsRequest = {}) {
    try {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const project = { $project: { _id: 0, slug: 1, updatedAt: 1, cover: 1 } };

      const [popular, upcoming] = await Promise.all([
        this.Games.aggregate([
          { $match: { "igdb.total_rating": { $gt: 0 } } },
          { $sort: { "igdb.total_rating_count": -1 } },
          { $limit: count * 5 },
          {
            $addFields: {
              _score: {
                $multiply: [
                  "$igdb.total_rating",
                  { $ln: { $add: ["$igdb.total_rating_count", 1] } },
                ],
              },
            },
          },
          { $sort: { _score: -1 } },
          { $limit: count },
          project,
        ]),
        this.Games.aggregate([
          {
            $match: {
              first_release: {
                $gt: nowSeconds,
                $lte: nowSeconds + 365 * 86400,
              },
              cover: { $ne: null },
            },
          },
          { $sort: { "igdb.hypes": -1, first_release: 1 } },
          { $limit: 100 },
          project,
        ]),
      ]);

      const seen = new Set<string>();

      return [...popular, ...upcoming].filter(
        ({ slug }) => !seen.has(slug) && seen.add(slug)
      );
    } catch (err) {
      this.logger.error(err, `Failed to get all game slugs`);
      throw err;
    }
  }

  async getRandomSlug() {
    try {
      const [game] = await this.Games.aggregate([
        { $sample: { size: 1 } },
        { $project: { _id: 0, slug: 1 } },
      ]);

      if (!game) throw new NotFoundException("No games found");

      return game;
    } catch (err) {
      this.logger.error(err, "Failed to get random game slug");
      throw err;
    }
  }

  async getRecentReleases() {
    try {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const windowStart = nowSeconds - 45 * 86400;

      const games = await this.Games.aggregate([
        {
          $match: {
            first_release: { $gte: windowStart, $lte: nowSeconds },
            cover: { $ne: null },
          },
        },
        { $sort: { first_release: -1 } },
        { $limit: 18 },
        TRIM_IGDB_STAGE,
        STRIP_CHARACTERS_STAGE,
      ]);

      return games;
    } catch (err) {
      this.logger.error(err, `Failed to get recent releases`);
      throw err;
    }
  }

  async parseFieldsToJson() {
    try {
      this.logger.log("Started parsing common fields to json");

      const fieldsToParse: Record<string, string> = {
        modes: "modes",
        genres: "genres",
        keywords: "keywords",
        themes: "themes",
        franchises: "franchises",
        type: "type",
        companies: "companies.name",
        game_engines: "game_engines",
        player_perspectives: "player_perspectives",
        languages: "languages",
        status: "status",
      };

      const entries = await Promise.all(
        Object.entries(fieldsToParse).map(async ([key, field]) => {
          const values = await this.Games.distinct(field);
          return [key, values.filter(Boolean)] as const;
        })
      );

      const ageRatingGroups = (await this.Games.aggregate([
        { $unwind: "$ageRatings" },
        {
          $group: {
            _id: {
              organization: "$ageRatings.organization",
              rating: "$ageRatings.rating",
            },
          },
        },
      ])) as { _id: { organization: string; rating: string } }[];

      const ageRatings = ageRatingGroups
        .map((group) => group._id)
        .filter((combo) => combo.organization && combo.rating)
        .sort((a, b) =>
          a.organization === b.organization
            ? a.rating.localeCompare(b.rating)
            : a.organization.localeCompare(b.organization)
        )
        .map((combo) => `${combo.organization} | ${combo.rating}`);

      const result = {
        ...Object.fromEntries(entries),
        ageRatings,
      };

      const uploaded = await this.fileService.uploadObject(
        JSON.stringify(result),
        "filters",
        S3_FOLDERS.common
      );

      this.logger.log("Finished parsing common fields to json");

      return uploaded;
    } catch (err) {
      this.logger.error(err, `Failed to parse fields to json`);
      throw err;
    }
  }

  async getTotalGamesCountByGenre() {
    try {
      const result = (await this.Games.aggregate([
        {
          $match: {
            genres: { $exists: true, $ne: [] },
          },
        },
        {
          $unwind: "$genres",
        },
        {
          $group: {
            _id: "$genres",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $project: {
            _id: 0,
            genre: "$_id",
            count: 1,
          },
        },
      ])) as unknown as { genre: string; count: number }[];

      return result;
    } catch (err) {
      this.logger.error(err, `Failed to get total games count by genre`);
      throw err;
    }
  }

  async getTotalGamesCountByPlatform() {
    try {
      const result = (await this.Games.aggregate([
        {
          $match: {
            platformIds: { $exists: true, $ne: [] },
          },
        },
        {
          $unwind: "$platformIds",
        },
        {
          $group: {
            _id: "$platformIds",
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "platforms",
            localField: "_id",
            foreignField: "_id",
            as: "platform",
          },
        },
        {
          $unwind: "$platform",
        },
        {
          $sort: { count: -1 },
        },
        {
          $project: {
            _id: 0,
            platform: "$platform.slug",
            count: 1,
          },
        },
      ])) as unknown as { platform: string; count: number }[];

      return result;
    } catch (err) {
      this.logger.error(err, `Failed to get total games count by platform`);
      throw err;
    }
  }

  async getFollowingsStatus(
    gameId: string,
    { userId }: IGetGameFollowingsStatusRequest
  ): Promise<IGetGameFollowingsStatusResponse> {
    const viewer = await this.users
      .findById(userId)
      .select("followings")
      .lean();
    if (!viewer?.followings?.length) return [];

    const followingIds = viewer.followings.map(
      (id) => new mongoose.Types.ObjectId(String(id))
    );
    const gameObjectId = new mongoose.Types.ObjectId(gameId);

    const [plays, ratings, followingUsers] = await Promise.all([
      this.playthroughs
        .find({
          gameId: gameObjectId,
          userId: { $in: followingIds },
        })
        .select("userId category isMastered")
        .lean(),
      this.ratings
        .find({
          gameId: gameObjectId,
          userId: { $in: followingIds },
        })
        .select("userId rating")
        .lean(),
      this.users
        .find({ _id: { $in: followingIds } })
        .select("_id userName avatar")
        .lean(),
    ]);

    const usersById = new Map(
      followingUsers.map((user) => [String(user._id), user])
    );
    const ratingByUserId = new Map(
      ratings.map((rating) => [String(rating.userId), rating.rating ?? null])
    );

    const playsByUserId = new Map<string, typeof plays>();
    for (const play of plays) {
      const key = String(play.userId);
      const list = playsByUserId.get(key) || [];
      list.push(play);
      playsByUserId.set(key, list);
    }

    const result: IGetGameFollowingsStatusResponse = [];

    for (const [followingUserId, userPlays] of playsByUserId) {
      const picked = pickFollowingsStatus(userPlays);
      const user = usersById.get(followingUserId);
      if (!picked || !user) continue;

      result.push({
        userId: followingUserId,
        userName: user.userName,
        avatar: user.avatar || "",
        category: picked.category,
        count: picked.count,
        rating: ratingByUserId.get(followingUserId) ?? null,
      });
    }

    result.sort((a, b) => a.userName.localeCompare(b.userName));
    return result;
  }

  async getGamesStats(gameIds: string[]): Promise<IGetGamesStatsResponse> {
    try {
      const gameObjectIds = gameIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      const countPerCategory = (category: string) => ({
        $sum: { $cond: [{ $in: [category, "$categories"] }, 1, 0] },
      });

      const rows = await this.playthroughs.aggregate<
        Omit<IGameStats, "gameId"> & { _id: mongoose.Types.ObjectId }
      >([
        { $match: { gameId: { $in: gameObjectIds } } },
        {
          $group: {
            _id: { gameId: "$gameId", userId: "$userId" },
            categories: { $addToSet: "$category" },
            isMastered: { $max: { $ifNull: ["$isMastered", false] } },
          },
        },
        {
          $group: {
            _id: "$_id.gameId",
            players: { $sum: 1 },
            mastered: { $sum: { $cond: ["$isMastered", 1, 0] } },
            completed: countPerCategory("completed"),
            playing: countPerCategory("playing"),
            backlog: countPerCategory("backlog"),
            wishlist: countPerCategory("wishlist"),
            dropped: countPerCategory("dropped"),
            played: countPerCategory("played"),
          },
        },
      ]);

      const statsByGameId = new Map(
        rows.map(({ _id, ...stats }) => [String(_id), stats])
      );

      return gameIds.map((gameId) => ({
        gameId,
        players: 0,
        mastered: 0,
        completed: 0,
        playing: 0,
        backlog: 0,
        wishlist: 0,
        dropped: 0,
        played: 0,
        ...statsByGameId.get(gameId),
      }));
    } catch (err) {
      this.logger.error(
        err,
        `Failed to get games stats: ${gameIds.join(", ")}`
      );
      throw err;
    }
  }

  async getGameStats(gameId: string): Promise<IGameStats> {
    const [stats] = await this.getGamesStats([gameId]);

    return stats;
  }

  private async getAlsoPlayed(
    gameIds: unknown[],
    userIds: unknown[]
  ): Promise<IGameCommunityGame[]> {
    const userForms = new Set<unknown>();

    for (const userId of userIds) {
      const text = String(userId);

      userForms.add(userId);
      userForms.add(text);

      if (mongoose.isValidObjectId(text)) {
        userForms.add(new mongoose.Types.ObjectId(text));
      }
    }

    const rows = await this.playthroughs.aggregate<{
      gameId: mongoose.Types.ObjectId;
      accounts: number;
      name: string;
      slug: string;
      cover?: string;
    }>([
      {
        $match: {
          userId: { $in: [...userForms] },
          gameId: { $nin: gameIds },
          category: { $ne: "wishlist" },
        },
      },
      {
        $group: {
          _id: {
            $convert: {
              input: "$gameId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
          accounts: { $addToSet: "$userId" },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $project: { accounts: { $size: "$accounts" } } },
      { $sort: { accounts: -1, _id: 1 } },
      { $limit: ALSO_PLAYED_LIMIT },
      {
        $lookup: {
          from: "games",
          localField: "_id",
          foreignField: "_id",
          as: "game",
        },
      },
      { $unwind: "$game" },
      {
        $project: {
          _id: 0,
          accounts: 1,
          gameId: "$game._id",
          name: "$game.name",
          slug: "$game.slug",
          cover: "$game.cover",
        },
      },
    ]);

    return rows.map((row) => ({
      _id: String(row.gameId),
      name: row.name,
      slug: row.slug,
      cover: row.cover ?? "",
      accounts: row.accounts,
    }));
  }

  async getGameCommunity(gameId: string): Promise<IGameCommunity> {
    if (!mongoose.isValidObjectId(gameId)) {
      throw new BadRequestException(`Invalid game id: ${gameId}`);
    }

    const gameIds = [new mongoose.Types.ObjectId(gameId), gameId];

    const [playtimeRow, trackedIds] = await Promise.all([
      this.playthroughs
        .aggregate<{
          accounts: unknown[];
          hours: number;
          lastLoggedAt: string | null;
        }>([
          { $match: { gameId: { $in: gameIds } } },
          {
            $group: {
              _id: null,
              accounts: { $addToSet: "$userId" },
              hours: {
                $sum: {
                  $cond: [{ $gt: [{ $ifNull: ["$time", 0] }, 0] }, "$time", 0],
                },
              },
              lastLoggedAt: { $max: "$createdAt" },
            },
          },
        ])
        .then(([row]) => row),
      this.playthroughs.distinct("userId", {
        gameId: { $in: gameIds },
        category: { $ne: "wishlist" },
      }),
    ]);

    const alsoPlayed = trackedIds.length
      ? await this.getAlsoPlayed(gameIds, trackedIds)
      : [];

    return {
      gameId,
      playtime: {
        accounts: playtimeRow?.accounts.length ?? 0,
        hours: Math.round(playtimeRow?.hours ?? 0),
        lastLoggedAt: playtimeRow?.lastLoggedAt ?? null,
      },
      alsoPlayed,
    };
  }

  async getRelatedGames(gameId: string): Promise<IRelatedGamesResponse> {
    if (!mongoose.isValidObjectId(gameId)) {
      throw new BadRequestException(`Invalid game id: ${gameId}`);
    }

    try {
      const game = await this.Games.findById(gameId)
        .select("relatedGames")
        .lean();

      if (!game) throw new NotFoundException(`Game not found: ${gameId}`);

      const idsByKey = Object.entries(game.relatedGames ?? {})
        .map(
          ([key, value]) =>
            [
              key,
              [value]
                .flat()
                .filter((id) => !!id && mongoose.isValidObjectId(id))
                .slice(0, RELATED_GAMES_PER_RELATION_LIMIT)
                .map(String),
            ] as const
        )
        .filter(([, ids]) => ids.length);

      const ids = [...new Set(idsByKey.flatMap(([, ids]) => ids))];

      if (!ids.length) return {};

      const games = await this.Games.aggregate([
        {
          $match: {
            _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
          },
        },
        TRIM_IGDB_STAGE,
        STRIP_CHARACTERS_STAGE,
      ]);

      const byId = new Map(games.map((item) => [item._id.toString(), item]));

      return Object.fromEntries(
        idsByKey
          .map(([key, ids]) => [key, ids.flatMap((id) => byId.get(id) ?? [])])
          .filter(([, items]) => items.length)
      );
    } catch (err) {
      this.logger.error(err, `Failed to get related games: ${gameId}`);
      throw err;
    }
  }
}
