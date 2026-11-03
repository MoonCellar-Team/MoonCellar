import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  AddCustomListGameRequestDto,
  CreateCustomListRequestDto,
  CustomListDetailsResponseDto,
  CustomListLikeResponseDto,
  CustomListResponseDto,
  FilterCustomListBySlugRequestDto,
  GameListsResponseDto,
  GetCustomListBySlugRequestDto,
  GetCustomListsRequestDto,
  GetCustomListsResponseDto,
  GetUserCustomListsRequestDto,
  ReorderCustomListRequestDto,
  ReorderCustomListsRequestDto,
  UpdateCustomListRequestDto,
} from "../../../shared/zod/dto/custom-lists.dto";
import { RolesEnum } from "@mooncellar/schemas";
import { OptionalJwtGuard } from "../../auth/optional-jwt.guard";
import { UserIdGuard } from "../../auth/user.guard";
import { Roles } from "../../roles/roles.decorator";
import { RolesGuard } from "../../roles/roles.guard";
import { CustomListsService } from "../services/custom-lists.service";
import { GeneratedListsService } from "../services/generated-lists.service";
import type {
  IOptionalViewerRequest,
  IViewerRequest,
} from "../types/collections.type";

@ApiTags("Custom Lists")
@Controller("lists")
export class CustomListsController {
  constructor(
    private readonly lists: CustomListsService,
    private readonly generatedLists: GeneratedListsService
  ) {}

  @Get()
  @ApiOperation({ summary: "Search public lists with filters" })
  @ApiCreatedResponse({ type: GetCustomListsResponseDto })
  @UseGuards(OptionalJwtGuard)
  async getLists(
    @Query() dto: GetCustomListsRequestDto,
    @Req() request: IOptionalViewerRequest
  ) {
    return this.lists.getLists(dto, request.user);
  }

  @Get("by-slug")
  @ApiOperation({ summary: "Get a list with its games by owner and slug" })
  @ApiCreatedResponse({ type: CustomListDetailsResponseDto })
  @UseGuards(OptionalJwtGuard)
  async getBySlug(
    @Query() dto: GetCustomListBySlugRequestDto,
    @Req() request: IOptionalViewerRequest
  ) {
    return this.lists.getBySlug(dto.userName, dto.slug, request.user, dto);
  }

  @Post("by-slug")
  @ApiOperation({
    summary: "Get a list with only its games that match catalogue filters",
  })
  @ApiCreatedResponse({ type: CustomListDetailsResponseDto })
  @UseGuards(OptionalJwtGuard)
  @HttpCode(HttpStatus.OK)
  async filterBySlug(
    @Body() dto: FilterCustomListBySlugRequestDto,
    @Req() request: IOptionalViewerRequest
  ) {
    return this.lists.getBySlug(
      dto.userName,
      dto.slug,
      request.user,
      dto,
      dto.filters
    );
  }

  @Get("mine/game-counts")
  @ApiOperation({ summary: "How many of the viewer's lists hold each game" })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  async getGameCounts(@Req() request: IViewerRequest) {
    return this.lists.getGameCounts(request.user);
  }

  @Get("game/:gameId")
  @ApiOperation({
    summary:
      "Public lists that hold a game: the ones people made first, then the MoonCellar ones",
  })
  @ApiCreatedResponse({ type: GameListsResponseDto })
  async getListsByGame(@Param("gameId") gameId: string) {
    return this.lists.getListsByGame(gameId);
  }

  @Get("liked/:userId")
  @ApiOperation({ summary: "Public lists a user liked, newest like first" })
  @ApiCreatedResponse({ type: [CustomListResponseDto] })
  @UseGuards(OptionalJwtGuard)
  async getLikedLists(
    @Param("userId") userId: string,
    @Req() request: IOptionalViewerRequest
  ) {
    return this.lists.getLikedLists(userId, request.user);
  }

  @Get("user/:userId")
  @ApiOperation({
    summary: "Lists of a user; private ones only for the owner",
  })
  @ApiCreatedResponse({ type: [CustomListResponseDto] })
  @UseGuards(OptionalJwtGuard)
  async getUserLists(
    @Param("userId") userId: string,
    @Query() dto: GetUserCustomListsRequestDto,
    @Req() request: IOptionalViewerRequest
  ) {
    return this.lists.getUserLists(userId, request.user, dto.gameId);
  }

  @Post("generated/refresh")
  @ApiOperation({
    summary:
      "Rebuild the MoonCellar lists by decade, by each of the last five years, of standalone expansions, by company and by keyword in the background. Runs every Monday at 05:00 (Europe/Moscow); use this to re-run it manually",
  })
  @ApiResponse({ status: 200, description: "Successfully started" })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  refreshGeneratedLists() {
    if (this.generatedLists.isRefreshing) {
      return { message: "Refresh is already running" };
    }

    void this.generatedLists.refreshAll().catch(() => undefined);

    return { message: "Refresh started" };
  }

  @Post()
  @ApiOperation({ summary: "Create a list" })
  @ApiCreatedResponse({ type: CustomListResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  @HttpCode(HttpStatus.OK)
  async createList(
    @Body() dto: CreateCustomListRequestDto,
    @Req() request: IViewerRequest
  ) {
    return this.lists.createList(dto, request.user);
  }

  @Patch("order")
  @ApiOperation({ summary: "Save the order of the viewer's lists" })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  async reorderLists(
    @Body() dto: ReorderCustomListsRequestDto,
    @Req() request: IViewerRequest
  ) {
    return this.lists.reorderLists(dto, request.user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename, describe or change the privacy of a list" })
  @ApiCreatedResponse({ type: CustomListResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  async updateList(
    @Param("id") id: string,
    @Body() dto: UpdateCustomListRequestDto,
    @Req() request: IViewerRequest
  ) {
    return this.lists.updateList(id, dto, request.user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a list" })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  async deleteList(@Param("id") id: string, @Req() request: IViewerRequest) {
    return this.lists.deleteList(id, request.user);
  }

  @Put(":id/like")
  @ApiOperation({ summary: "Like someone else's list" })
  @ApiCreatedResponse({ type: CustomListLikeResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  @HttpCode(HttpStatus.OK)
  async likeList(@Param("id") id: string, @Req() request: IViewerRequest) {
    return this.lists.setLike(id, request.user, true);
  }

  @Delete(":id/like")
  @ApiOperation({ summary: "Remove a like from a list" })
  @ApiCreatedResponse({ type: CustomListLikeResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  @HttpCode(HttpStatus.OK)
  async unlikeList(@Param("id") id: string, @Req() request: IViewerRequest) {
    return this.lists.setLike(id, request.user, false);
  }

  @Post(":id/games")
  @ApiOperation({ summary: "Add a game to a list" })
  @ApiCreatedResponse({ type: CustomListResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  @HttpCode(HttpStatus.OK)
  async addGame(
    @Param("id") id: string,
    @Body() dto: AddCustomListGameRequestDto,
    @Req() request: IViewerRequest
  ) {
    return this.lists.addGame(id, dto, request.user);
  }

  @Delete(":id/games/:gameId")
  @ApiOperation({ summary: "Remove a game from a list" })
  @ApiCreatedResponse({ type: CustomListResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  async removeGame(
    @Param("id") id: string,
    @Param("gameId") gameId: string,
    @Req() request: IViewerRequest
  ) {
    return this.lists.removeGame(id, gameId, request.user);
  }

  @Patch(":id/order")
  @ApiOperation({ summary: "Save the order of the games in a list" })
  @ApiCreatedResponse({ type: CustomListResponseDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"), UserIdGuard)
  async reorderGames(
    @Param("id") id: string,
    @Body() dto: ReorderCustomListRequestDto,
    @Req() request: IViewerRequest
  ) {
    return this.lists.reorderGames(id, dto, request.user);
  }
}
