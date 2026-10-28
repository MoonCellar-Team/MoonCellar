import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { ZodValidationException } from "nestjs-zod";
import {
  DecompFunctionsSchema,
  PROJECT_BLOCK_SCHEMAS,
  ProjectBlockSchema,
  getProjectBlockProgress,
  type ICreateProjectRequest,
  type IProject,
  type IProjectBlock,
  type IProjectConnectCode,
  type IProjectToken,
  type IProjectTokenExchange,
  type IProjectUpload,
  type IUpdateProjectRequest,
} from "@mooncellar/schemas";
import { Project, type ProjectToken } from "./schemas/project.schema";
import { ProjectData } from "./schemas/project-data.schema";
import { ProjectConnectCode } from "./schemas/project-connect-code.schema";
import { ProjectPlan, ProjectPlanEvent } from "./schemas/project-plan.schema";

export const PROJECT_TOKEN_PREFIX = "mcp_";
export const CONNECT_CODE_TTL_MS = 10 * 60 * 1000;
export const FIRST_TOKEN_NAME = "First token";
/** Stored beside the Decompilation block: what every cell of its map is. */
export const DECOMP_FUNCTIONS = "decomp/functions";

/** What is stored beside a block and goes away with it. */
const BLOCK_EXTRAS: Record<IProjectBlock, string[]> = {
  decomp: [DECOMP_FUNCTIONS],
  plan: [],
};

export const PROJECT_BLOCK_TITLES: Record<IProjectBlock, string> = {
  plan: "Plan",
  decomp: "Decompilation",
};

export const createProjectToken = () =>
  `${PROJECT_TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;

export const hashProjectToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const readBearerToken = (header?: string) =>
  /^Bearer\s+(\S+)\s*$/i.exec(header ?? "")?.[1] ?? null;

export const isProjectToken = (token: string, tokenHash: string) => {
  const actual = Buffer.from(hashProjectToken(token), "hex");
  const expected = Buffer.from(tokenHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const findProjectToken = (token: string, tokens: ProjectToken[]) =>
  tokens.find((entry) => isProjectToken(token, entry.hash));

type IStoredProject = Pick<
  Project,
  "slug" | "name" | "blocks" | "createdAt"
> & {
  defaultBlock?: IProjectBlock;
  uploads?: Project["uploads"];
  tokens?: Project["tokens"];
};

const toIso = (date: Date | string | null | undefined) =>
  date ? new Date(date).toISOString() : null;

export const toProject = (project: IStoredProject): IProject => ({
  slug: project.slug,
  name: project.name,
  blocks: project.blocks,
  defaultBlock:
    project.defaultBlock && project.blocks.includes(project.defaultBlock)
      ? project.defaultBlock
      : project.blocks[0],
  uploads: (project.uploads ?? []).map((upload) => ({
    block: upload.block,
    updatedAt: new Date(upload.updatedAt).toISOString(),
    size: upload.size,
    done: upload.done,
    total: upload.total,
  })),
  tokens: (project.tokens ?? []).map((token) => ({
    id: token.id,
    name: token.name,
    createdAt: new Date(token.createdAt).toISOString(),
    lastUsedAt: toIso(token.lastUsedAt),
  })),
  createdAt: new Date(project.createdAt).toISOString(),
});

const parseBlock = (block: string): IProjectBlock => {
  const parsed = ProjectBlockSchema.safeParse(block);
  if (!parsed.success) {
    throw new BadRequestException(
      `Unknown block "${block}". Use one of: ${ProjectBlockSchema.options.join(", ")}`
    );
  }
  return parsed.data;
};

const newToken = (name: string) => {
  const token = createProjectToken();
  const entry: ProjectToken = {
    id: randomBytes(6).toString("hex"),
    name,
    hash: hashProjectToken(token),
    createdAt: new Date(),
    lastUsedAt: null,
  };
  return { token, entry };
};

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectModel(Project.name) private readonly projects: Model<Project>,
    @InjectModel(ProjectData.name)
    private readonly data: Model<ProjectData>,
    @InjectModel(ProjectConnectCode.name)
    private readonly codes: Model<ProjectConnectCode>,
    @InjectModel(ProjectPlan.name) private readonly plans: Model<ProjectPlan>,
    @InjectModel(ProjectPlanEvent.name)
    private readonly planEvents: Model<ProjectPlanEvent>
  ) {}

  async onModuleInit() {
    await this.moveSingleTokens().catch((error) =>
      this.logger.error(error, "Could not move project tokens into the list")
    );
  }

  async moveSingleTokens() {
    const legacy = await this.projects
      .find({ tokenHash: { $exists: true } })
      .select("+tokenHash")
      .lean();
    for (const project of legacy) {
      await this.projects.updateOne(
        { slug: project.slug, tokenHash: project.tokenHash },
        {
          $push: {
            tokens: {
              id: randomBytes(6).toString("hex"),
              name: FIRST_TOKEN_NAME,
              hash: project.tokenHash,
              createdAt: project.createdAt,
              lastUsedAt: null,
            },
          },
          $unset: { tokenHash: "" },
        }
      );
    }
  }

  async list(): Promise<IProject[]> {
    const projects = await this.projects.find().sort({ name: 1 }).lean();
    return projects.map(toProject);
  }

  async get(slug: string): Promise<IProject> {
    return toProject(await this.findProject(slug));
  }

  async create(dto: ICreateProjectRequest): Promise<IProject> {
    const defaultBlock = dto.defaultBlock ?? dto.blocks[0];
    if (!dto.blocks.includes(defaultBlock)) {
      throw new BadRequestException(
        "The default page must be one of this project's enabled blocks"
      );
    }
    if (await this.projects.exists({ slug: dto.slug })) {
      throw new ConflictException(
        `The address "${dto.slug}" already belongs to another project`
      );
    }
    const project = await this.projects.create({
      slug: dto.slug,
      name: dto.name,
      blocks: dto.blocks,
      defaultBlock,
      tokens: [],
      uploads: [],
    });
    return toProject(project);
  }

  async update(slug: string, dto: IUpdateProjectRequest): Promise<IProject> {
    const project = await this.findProject(slug);
    const blocks = (dto.blocks ?? project.blocks) as IProjectBlock[];
    const dropped = project.blocks.filter((block) => !blocks.includes(block));
    const defaultBlock =
      dto.defaultBlock ??
      (project.defaultBlock && blocks.includes(project.defaultBlock)
        ? project.defaultBlock
        : blocks[0]);
    if (!blocks.includes(defaultBlock)) {
      throw new BadRequestException(
        "The default page must be one of this project's enabled blocks"
      );
    }
    const updated = await this.projects
      .findOneAndUpdate(
        { slug },
        {
          $set: { name: dto.name ?? project.name, blocks, defaultBlock },
          $pull: { uploads: { block: { $in: dropped } } },
        },
        { new: true }
      )
      .lean();
    if (dropped.length) {
      const stored = dropped.flatMap((block) => [
        block,
        ...BLOCK_EXTRAS[block],
      ]);
      await this.data.deleteMany({ slug, block: { $in: stored } });
    }
    return toProject(updated ?? project);
  }

  async remove(slug: string): Promise<void> {
    await this.findProject(slug);
    await this.projects.deleteOne({ slug });
    await this.data.deleteMany({ slug });
    await this.codes.deleteMany({ slug });
    await this.plans.deleteMany({ slug });
    await this.planEvents.deleteMany({ slug });
  }

  async addToken(slug: string, name: string): Promise<IProjectToken> {
    const { token, entry } = newToken(name);
    const updated = await this.projects
      .findOneAndUpdate({ slug }, { $push: { tokens: entry } }, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException(`There is no project at "${slug}"`);
    }
    return { project: toProject(updated), tokenId: entry.id, token };
  }

  async revokeToken(slug: string, id: string): Promise<IProject> {
    const updated = await this.projects
      .findOneAndUpdate(
        { slug, "tokens.id": id },
        { $pull: { tokens: { id } } },
        { new: true }
      )
      .lean();
    if (!updated) {
      throw new NotFoundException(
        `The project at "${slug}" has no token with the id "${id}"`
      );
    }
    return toProject(updated);
  }

  async createConnectCode(
    slug: string,
    name: string
  ): Promise<IProjectConnectCode> {
    await this.findProject(slug);
    const code = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + CONNECT_CODE_TTL_MS);
    await this.codes.create({
      codeHash: hashProjectToken(code),
      slug,
      name,
      expiresAt,
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }

  async exchangeCode(
    slug: string,
    code: string
  ): Promise<IProjectTokenExchange> {
    const pending = await this.codes
      .findOneAndDelete({
        codeHash: hashProjectToken(code),
        slug,
        expiresAt: { $gt: new Date() },
      })
      .lean();
    if (!pending) {
      throw new BadRequestException(
        "The connection code is unknown, used or expired. Run the connect command again"
      );
    }
    const { token } = await this.addToken(slug, pending.name);
    return { slug, name: pending.name, token };
  }

  async getData(slug: string, rawBlock: string): Promise<string> {
    const block = parseBlock(rawBlock);
    const project = await this.findProject(slug);
    this.assertHasBlock(project, block);
    const stored = await this.data.findOne({ slug, block }).lean();
    if (!stored) {
      throw new NotFoundException(
        `${project.name} has not uploaded its ${PROJECT_BLOCK_TITLES[block]} block yet`
      );
    }
    return stored.body;
  }

  async putData(
    slug: string,
    rawBlock: string,
    authorization: string | undefined,
    body: unknown
  ): Promise<IProjectUpload> {
    const block = parseBlock(rawBlock);
    const { project, token: used } = await this.authorizeToken(
      slug,
      authorization
    );
    this.assertHasBlock(project, block);
    const parsed = PROJECT_BLOCK_SCHEMAS[block].safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);

    const json = JSON.stringify(parsed.data);
    const stored = await this.data.findOneAndUpdate(
      { slug, block },
      { $set: { body: json } },
      { upsert: true, new: true }
    );
    const upload = {
      block,
      updatedAt: stored.updatedAt ?? new Date(),
      size: Buffer.byteLength(json),
      ...getProjectBlockProgress(block, parsed.data),
    };
    await this.projects.updateOne({ slug }, { $pull: { uploads: { block } } });
    await this.projects.updateOne(
      { slug, "tokens.id": used.id },
      {
        $push: { uploads: upload },
        $set: { "tokens.$.lastUsedAt": new Date() },
      }
    );
    return { ...upload, updatedAt: new Date(upload.updatedAt).toISOString() };
  }

  async getFunctions(slug: string): Promise<string> {
    const project = await this.findProject(slug);
    this.assertHasBlock(project, "decomp");
    const stored = await this.data
      .findOne({ slug, block: DECOMP_FUNCTIONS })
      .lean();
    if (!stored) {
      throw new NotFoundException(
        `${project.name} has not uploaded what its map's functions are yet`
      );
    }
    return stored.body;
  }

  async putFunctions(
    slug: string,
    authorization: string | undefined,
    body: unknown
  ): Promise<{ functions: number; size: number }> {
    const { project, token } = await this.authorizeToken(slug, authorization);
    this.assertHasBlock(project, "decomp");
    const parsed = DecompFunctionsSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    const json = JSON.stringify(parsed.data);
    await this.data.updateOne(
      { slug, block: DECOMP_FUNCTIONS },
      { $set: { body: json } },
      { upsert: true }
    );
    await this.touchToken(slug, token.id);
    return {
      functions: parsed.data.functions.length,
      size: Buffer.byteLength(json),
    };
  }

  async authorizeToken(slug: string, authorization: string | undefined) {
    const token = readBearerToken(authorization);
    if (!token) {
      throw new UnauthorizedException(
        "Send the project's token as Authorization: Bearer <token>"
      );
    }
    const project = await this.projects.findOne({ slug }).lean();
    const used = project
      ? findProjectToken(token, project.tokens ?? [])
      : undefined;
    if (!project || !used) {
      throw new UnauthorizedException(
        "The token does not match this project. Connect again or add a token in Manage projects"
      );
    }
    return { project, token: used };
  }

  async touchToken(slug: string, tokenId: string) {
    await this.projects.updateOne(
      { slug, "tokens.id": tokenId },
      { $set: { "tokens.$.lastUsedAt": new Date() } }
    );
  }

  async recordProgress(
    slug: string,
    block: IProjectBlock,
    progress: { done: number; total: number; size: number }
  ) {
    const upload = { block, updatedAt: new Date(), ...progress };
    await this.projects.updateOne({ slug }, { $pull: { uploads: { block } } });
    await this.projects.updateOne({ slug }, { $push: { uploads: upload } });
  }

  async findProject(slug: string) {
    const project = await this.projects.findOne({ slug }).lean();
    if (!project) {
      throw new NotFoundException(`There is no project at "${slug}"`);
    }
    return project;
  }

  assertHasBlock(project: IStoredProject, block: IProjectBlock) {
    if (!project.blocks.includes(block)) {
      throw new BadRequestException(
        `${project.name} has no ${PROJECT_BLOCK_TITLES[block]} block. Add it in Manage projects first`
      );
    }
  }
}
