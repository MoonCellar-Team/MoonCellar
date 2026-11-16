import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { RolesEnum } from "@mooncellar/schemas";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import {
  CreateProjectRequestDto,
  CreateProjectTokenRequestDto,
  ProjectConnectCodeDto,
  ProjectConnectRequestDto,
  ProjectDto,
  ProjectTokenDto,
  ProjectTokenExchangeDto,
  ProjectTokenExchangeRequestDto,
  ProjectUploadDto,
  UpdateProjectRequestDto,
} from "../../shared/zod/dto/projects.dto";
import { ProjectsService } from "./projects.service";
import { ProjectPlansService } from "./project-plans.service";

@ApiTags("Projects")
@Controller("projects")
@ApiCookieAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(RolesEnum.ADMIN)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly plans: ProjectPlansService
  ) {}

  @Get()
  @ApiOperation({
    summary: "Every project with its blocks, uploads and tokens",
  })
  @ApiOkResponse({ type: [ProjectDto] })
  list() {
    return this.projectsService.list();
  }

  @Post()
  @ApiOperation({ summary: "Add a project" })
  @ApiOkResponse({ type: ProjectDto })
  @HttpCode(HttpStatus.OK)
  create(@Body() dto: CreateProjectRequestDto) {
    return this.projectsService.create(dto);
  }

  @Get(":slug")
  @ApiOperation({ summary: "One project with its blocks, uploads and tokens" })
  @ApiOkResponse({ type: ProjectDto })
  get(@Param("slug") slug: string) {
    return this.projectsService.get(slug);
  }

  @Patch(":slug")
  @ApiOperation({ summary: "Rename a project or change its blocks" })
  @ApiOkResponse({ type: ProjectDto })
  update(@Param("slug") slug: string, @Body() dto: UpdateProjectRequestDto) {
    return this.projectsService.update(slug, dto);
  }

  @Delete(":slug")
  @ApiOperation({ summary: "Delete a project and everything it uploaded" })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("slug") slug: string) {
    return this.projectsService.remove(slug);
  }

  @Post(":slug/tokens")
  @ApiOperation({ summary: "Add an upload token; the answer carries it once" })
  @ApiOkResponse({ type: ProjectTokenDto })
  @HttpCode(HttpStatus.OK)
  addToken(
    @Param("slug") slug: string,
    @Body() dto: CreateProjectTokenRequestDto
  ) {
    return this.projectsService.addToken(slug, dto.name);
  }

  @Delete(":slug/tokens/:id")
  @ApiOperation({ summary: "Revoke one upload token" })
  @ApiOkResponse({ type: ProjectDto })
  revokeToken(@Param("slug") slug: string, @Param("id") id: string) {
    return this.projectsService.revokeToken(slug, id);
  }

  @Post(":slug/connect")
  @ApiOperation({
    summary: "A one-time code that a connect command exchanges for its token",
  })
  @ApiOkResponse({ type: ProjectConnectCodeDto })
  @HttpCode(HttpStatus.OK)
  connect(@Param("slug") slug: string, @Body() dto: ProjectConnectRequestDto) {
    return this.projectsService.createConnectCode(slug, dto.name);
  }

  @Get(":slug/data/decomp/functions")
  @ApiOperation({
    summary:
      "What every cell of the Decompilation map is: address, size, file, name",
  })
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header("Cache-Control", "private, max-age=300")
  getFunctions(@Param("slug") slug: string) {
    return this.projectsService.getFunctions(slug);
  }

  @Get(":slug/data/:block")
  @ApiOperation({ summary: "The block as the project last uploaded it" })
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async getData(@Param("slug") slug: string, @Param("block") block: string) {
    if (block === "plan") return JSON.stringify(await this.plans.getPlan(slug));
    return this.projectsService.getData(slug, block);
  }
}

@ApiTags("Projects")
@Controller("projects")
export class ProjectUploadsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly plans: ProjectPlansService
  ) {}

  @Post(":slug/tokens/exchange")
  @ApiOperation({
    summary: "Exchange a connection code from the hub for an upload token",
  })
  @ApiOkResponse({ type: ProjectTokenExchangeDto })
  @HttpCode(HttpStatus.OK)
  exchange(
    @Param("slug") slug: string,
    @Body() dto: ProjectTokenExchangeRequestDto
  ) {
    return this.projectsService.exchangeCode(slug, dto.code);
  }

  @Put(":slug/data/decomp/functions")
  @ApiOperation({
    summary:
      "Upload what the Decompilation map's cells are (DecompFunctionsSchema) with a project token",
  })
  @ApiBearerAuth()
  @ApiBody({ description: "DecompFunctionsSchema from @mooncellar/schemas" })
  putFunctions(
    @Param("slug") slug: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown
  ) {
    return this.projectsService.putFunctions(slug, authorization, body);
  }

  @Patch(":slug/data/decomp/live")
  @ApiOperation({
    summary:
      "Replace the Decompilation block's live claims with a project token, without waiting for the next upload",
  })
  @ApiBearerAuth()
  @ApiBody({ description: "DecompLiveSchema from @mooncellar/schemas" })
  @ApiOkResponse({
    description: "The files in work and the functions waiting to merge",
  })
  patchLive(
    @Param("slug") slug: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown
  ) {
    return this.projectsService.patchDecompLive(slug, authorization, body);
  }

  @Put(":slug/data/:block")
  @ApiOperation({
    summary:
      "Upload a block with one of the project's tokens (Authorization: Bearer <token>)",
  })
  @ApiBearerAuth()
  @ApiBody({
    description:
      "PlanBlockSchema or DecompBlockSchema from @mooncellar/schemas",
  })
  @ApiOkResponse({ type: ProjectUploadDto })
  putData(
    @Param("slug") slug: string,
    @Param("block") block: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown
  ) {
    if (block === "plan") return this.importPlan(slug, authorization, body);
    return this.projectsService.putData(slug, block, authorization, body);
  }

  private async importPlan(
    slug: string,
    authorization: string | undefined,
    body: unknown
  ) {
    const { token } = await this.projectsService.authorizeToken(
      slug,
      authorization
    );
    const plan = await this.plans.importPlan(slug, body, {
      kind: "token",
      name: token.name,
      tokenId: token.id,
    });
    const tasks = plan.sections.flatMap((section) => section.tasks);
    return {
      block: "plan",
      updatedAt: new Date().toISOString(),
      size: 0,
      done: tasks.filter((task) => task.state === "done").length,
      total: tasks.length,
    };
  }
}
