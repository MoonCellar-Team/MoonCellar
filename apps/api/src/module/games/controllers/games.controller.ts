import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import mongoose from "mongoose";
import { GameMatcherService } from "../matching/game-matcher.service";
import {
  AddGameDto,
  FindGameImagesDto,
  FindGameImagesResponseDto,
  ImportGameImageDto,
  PossibleDuplicatesResponseDto,
  GameAiDraftDto,
  GameAiDraftRunDto,
  GameResponseDto,
  GetGameByIdDto,
  GetGameBySlugDto,
  GetGameResponseDto,
  GetGamesByIdsDto,
  GetGamesDto,
  GetGamesResponseDto,
  GetGameSlugsDto,
  GetGameSlugsResponseDto,
  GetRandomGameSlugResponseDto,
  GetRelatedGamesResponseDto,
  UpdateGameDto,
} from "../../../shared/zod/dto/games.dto";
import {
  GetGameFollowingsStatusRequestDto,
  GetGameFollowingsStatusResponseDto,
} from "../../../shared/zod/dto/game-followings-status.dto";
import {
  GetGamesStatsRequestDto,
  GetGameStatsResponseDto,
  GetGamesStatsResponseDto,
} from "../../../shared/zod/dto/game-stats.dto";
import { GamesService } from "../services/games.service";
import { GameAiDraftService } from "../services/game-ai-draft.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { RolesGuard } from "../../roles/roles.guard";
import { Roles } from "../../roles/roles.decorator";
import { RolesEnum } from "@mooncellar/schemas";
import { UserIdGuard } from "../../auth/user.guard";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { DAY, HOUR, MINUTE, WEEK } from "../../../shared/constants";

@ApiTags("Games")
@Controller("games")
export class GamesController {
  constructor(
    private readonly games: GamesService,
    private readonly gameAiDraft: GameAiDraftService,
    private readonly gameMatcher: GameMatcherService
  ) {}

  @Get("/:gameId/followings-status")
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  @ApiOperation({ summary: "Get followings status for a game" })
  @ApiCreatedResponse({ type: GetGameFollowingsStatusResponseDto })
  async getFollowingsStatus(
    @Param("gameId") gameId: string,
    @Query() dto: GetGameFollowingsStatusRequestDto
  ) {
    return this.games.getFollowingsStatus(gameId, dto);
  }

  @Get("/stats")
  @ApiOperation({ summary: "Get playthrough stats for games" })
  @ApiCreatedResponse({ type: GetGamesStatsResponseDto })
  async getGamesStats(@Query() dto: GetGamesStatsRequestDto) {
    return this.games.getGamesStats(dto.gameIds);
  }

  @Get("/:gameId/stats")
  @ApiOperation({ summary: "Get playthrough stats for a game" })
  @ApiCreatedResponse({ type: GetGameStatsResponseDto })
  async getGameStats(@Param("gameId") gameId: string) {
    return this.games.getGameStats(gameId);
  }

  @Get("/by-id/:id")
  @ApiOperation({ summary: "Get games" })
  @ApiCreatedResponse({ type: GetGameResponseDto })
  async getGameById(@Query() dto: GetGameByIdDto) {
    return this.games.getGameById(dto);
  }

  @Get("/by-ids")
  @ApiOperation({ summary: "Get games" })
  @ApiCreatedResponse({ type: GetGamesResponseDto })
  async getGameByIds(@Query() dto: GetGamesByIdsDto) {
    return this.games.getGamesByIds(dto);
  }

  @Post("/by-ids")
  @ApiOperation({
    summary:
      "Get games by ids, optionally fuzzy-filtered by name within those ids. Use this instead of the GET variant when the id list is too long for a query string",
  })
  @ApiCreatedResponse({ type: GetGamesResponseDto })
  async getGameByIdsPost(@Body() dto: GetGamesByIdsDto) {
    return this.games.getGamesByIds(dto);
  }

  @Get("/by-slug/:slug")
  @ApiOperation({ summary: "Get games" })
  @ApiCreatedResponse({ type: GetGameResponseDto })
  async getGameBySlug(@Query() dto: GetGameBySlugDto) {
    return this.games.getGameBySlug(dto);
  }

  @Get("/:gameId/related")
  @ApiOperation({ summary: "Get related games grouped by relation" })
  @ApiCreatedResponse({ type: GetRelatedGamesResponseDto })
  async getRelatedGames(@Param("gameId") gameId: string) {
    return this.games.getRelatedGames(gameId);
  }

  @Get("/top-rated-random")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(15 * MINUTE)
  @ApiOperation({ summary: "Get 3 random top rated games" })
  @ApiCreatedResponse({ type: GetGamesResponseDto })
  async getTopRatedRandomGames() {
    return this.games.getTopRatedRandomGames();
  }

  @Get("/count-by-genre")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(WEEK)
  @ApiOperation({ summary: "Get total games count grouped by genre" })
  @ApiCreatedResponse({
    description: "Array of objects with genre and count",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          genre: { type: "string" },
          count: { type: "number" },
        },
      },
    },
  })
  async getTotalGamesCountByGenre() {
    return this.games.getTotalGamesCountByGenre();
  }

  @Get("/count-by-platform")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(WEEK)
  @ApiOperation({ summary: "Get total games count grouped by platform" })
  @ApiCreatedResponse({
    description: "Array of objects with platform slug and count",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          platform: { type: "string" },
          count: { type: "number" },
        },
      },
    },
  })
  async getTotalGamesCountByPlatform() {
    return this.games.getTotalGamesCountByPlatform();
  }

  @Get("/upcoming")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(HOUR)
  @ApiOperation({ summary: "Get upcoming releases grouped by quarter" })
  @ApiCreatedResponse({
    description: "Array of quarter groups with games",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          year: { type: "number" },
          quarter: { type: "number" },
          games: { type: "array", items: { type: "object" } },
        },
      },
    },
  })
  async getUpcomingReleases() {
    return this.games.getUpcomingReleases();
  }

  @Get("/slugs")
  @ApiOperation({
    summary: "Get slugs of all games",
    description:
      "Returns the `count` most popular game slugs (default 1000) by IGDB rating and rating count, plus the 100 most hyped releases of the next year. Used for sitemap generation.",
  })
  @ApiCreatedResponse({ type: GetGameSlugsResponseDto })
  async getAllSlugs(@Query() dto: GetGameSlugsDto) {
    return this.games.getAllSlugs(dto);
  }

  @Get("/random-slug")
  @ApiOperation({ summary: "Get a random game slug" })
  @ApiCreatedResponse({ type: GetRandomGameSlugResponseDto })
  async getRandomSlug() {
    return this.games.getRandomSlug();
  }

  @Get("/recent")
  @ApiOperation({ summary: "Get recently released games" })
  @ApiCreatedResponse({ type: GetGamesResponseDto })
  async getRecentReleases() {
    return this.games.getRecentReleases();
  }

  @Post("/")
  @ApiOperation({ summary: "Get games" })
  @ApiCreatedResponse({ type: GetGamesResponseDto })
  async getGames(@Body() dto: GetGamesDto) {
    return this.games.getGames(dto);
  }

  @Post("/add/duplicates")
  @ApiOperation({
    summary:
      "List catalogue games that look like the game about to be added, without adding it",
  })
  @ApiOkResponse({ type: PossibleDuplicatesResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  async findDuplicates(@Body() dto: AddGameDto) {
    return { duplicates: await this.gameMatcher.findLikelyDuplicates(dto) };
  }

  @Post("/add")
  @ApiOperation({ summary: "Add game" })
  @ApiCreatedResponse({ type: GameResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: "force",
    required: false,
    type: Boolean,
    description: "Create the game even when it looks like a duplicate",
  })
  async addGame(@Body() dto: AddGameDto, @Query("force") force?: string) {
    return this.games.addGame(dto, force === "true");
  }

  @Get("/ai-drafts")
  @ApiOperation({ summary: "Get the latest AI game draft runs" })
  @ApiCreatedResponse({ type: [GameAiDraftRunDto] })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  async getAiDrafts() {
    return this.gameAiDraft.getRuns();
  }

  @Post("/ai-drafts")
  @ApiOperation({
    summary: "Start an AI game draft",
    description:
      "Starts researching a game by name or link with OpenAI in the background and returns the run; poll GET /games/ai-drafts for its status and the unsaved add-game payload.",
  })
  @ApiCreatedResponse({ type: GameAiDraftRunDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  async startAiDraft(@Body() dto: GameAiDraftDto) {
    return this.gameAiDraft.startRun(dto.query);
  }

  @Post("/ai-drafts/:id/retry")
  @ApiOperation({ summary: "Run a finished AI game draft again" })
  @ApiCreatedResponse({ type: GameAiDraftRunDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  async retryAiDraft(@Param("id") id: string) {
    return this.gameAiDraft.retryRun(id);
  }

  @Delete("/ai-drafts/:id")
  @ApiOperation({ summary: "Delete a finished AI game draft run" })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAiDraft(@Param("id") id: string) {
    return this.gameAiDraft.deleteRun(id);
  }

  @Put("/update/:id")
  @ApiOperation({ summary: "Update game" })
  @ApiCreatedResponse({ type: GameResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateGame(@Param("id") id: string, @Body() dto: UpdateGameDto) {
    return this.games.updateGame(new mongoose.Types.ObjectId(id), dto);
  }

  @Delete("/delete/:id")
  @ApiOperation({ summary: "Delete game" })
  @ApiCreatedResponse({ type: GameResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteGame(@Param("id") id: string) {
    return this.games.deleteGame(new mongoose.Types.ObjectId(id));
  }

  @Post("/parse-common")
  @ApiOperation({ summary: "Parse filters" })
  async parseCommon() {
    return this.games.parseFieldsToJson();
  }

  @Post("/image-candidates")
  @ApiOperation({
    summary:
      "Find cover, screenshot or artwork candidates on Steam, SteamGridDB and image search",
  })
  @ApiOkResponse({ type: FindGameImagesResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  async findImageCandidates(@Body() dto: FindGameImagesDto) {
    return this.gameAiDraft.findImageCandidates(dto);
  }

  @Post("/import-image/:id")
  @ApiOperation({
    summary:
      "Copy an image from a link into the game's storage and return its URL",
  })
  @ApiOkResponse({ type: String })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  async importImage(@Param("id") id: string, @Body() dto: ImportGameImageDto) {
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestException(`Invalid game id: ${id}`);
    }

    return this.games.importImage(
      new mongoose.Types.ObjectId(id),
      dto.url,
      dto.type
    );
  }

  @Post("/upload-image/:id")
  @ApiOperation({ summary: "Upload image" })
  @ApiCreatedResponse({ type: String })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @ApiQuery({
    name: "type",
    type: String,
    enum: ["cover", "screenshot", "artwork"],
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async uploadImage(
    @Query("gameId") gameId: string,
    @Query("type") type: "cover" | "screenshot" | "artwork",
    @UploadedFile() image: Express.Multer.File
  ) {
    return this.games.uploadImage(
      new mongoose.Types.ObjectId(gameId),
      image,
      type
    );
  }
}
