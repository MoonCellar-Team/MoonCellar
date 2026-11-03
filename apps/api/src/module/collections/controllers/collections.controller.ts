import { Controller, Get, Param } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CustomListDetailsResponseDto,
  GetCustomListsResponseDto,
} from "../../../shared/zod/dto/custom-lists.dto";
import { CustomListsService } from "../services/custom-lists.service";

@ApiTags("Collections")
@Controller("collections")
export class CollectionsController {
  constructor(private readonly lists: CustomListsService) {}

  @Get()
  @ApiOperation({
    summary: "MoonCellar collections built from the site's own data",
  })
  @ApiCreatedResponse({ type: GetCustomListsResponseDto })
  async getCollections() {
    return this.lists.getGeneratedCollections();
  }

  @Get(":slug")
  @ApiOperation({
    summary: "Get a MoonCellar collection with its games, in rank order",
  })
  @ApiCreatedResponse({ type: CustomListDetailsResponseDto })
  async getCollection(@Param("slug") slug: string) {
    return this.lists.getGeneratedCollection(slug);
  }
}
