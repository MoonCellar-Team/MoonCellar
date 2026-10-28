import { z } from "zod";

export const ProjectBlockSchema = z.enum(["decomp", "plan"]);
export type IProjectBlock = z.infer<typeof ProjectBlockSchema>;

export const PROJECT_BLOCKS: readonly IProjectBlock[] =
  ProjectBlockSchema.options;

export const RESERVED_PROJECT_SLUGS = [
  "login",
  "manage",
  "status",
  "api",
  "images",
  "img",
  "connect",
];

export const ProjectSlugSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/,
    "Use 1–40 lowercase letters, digits and dashes, not starting or ending with a dash"
  )
  .refine(
    (slug) => !RESERVED_PROJECT_SLUGS.includes(slug),
    "This address is used by the status hub itself"
  );

export const ProjectUploadSchema = z.object({
  block: ProjectBlockSchema,
  updatedAt: z.string(),
  size: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type IProjectUpload = z.infer<typeof ProjectUploadSchema>;

export const ProjectTokenInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export type IProjectTokenInfo = z.infer<typeof ProjectTokenInfoSchema>;

export const ProjectSchema = z.object({
  slug: ProjectSlugSchema,
  name: z.string(),
  blocks: z.array(ProjectBlockSchema),
  defaultBlock: ProjectBlockSchema,
  uploads: z.array(ProjectUploadSchema),
  tokens: z.array(ProjectTokenInfoSchema),
  createdAt: z.string(),
});
export type IProject = z.infer<typeof ProjectSchema>;

const ProjectBlocksFieldSchema = z
  .array(ProjectBlockSchema)
  .min(1, "Choose at least one block")
  .transform((blocks) =>
    PROJECT_BLOCKS.filter((block) => blocks.includes(block))
  );

export const CreateProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: ProjectSlugSchema,
  blocks: ProjectBlocksFieldSchema,
  defaultBlock: ProjectBlockSchema.optional(),
});
export type ICreateProjectRequest = z.input<typeof CreateProjectRequestSchema>;

export const UpdateProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  blocks: ProjectBlocksFieldSchema.optional(),
  defaultBlock: ProjectBlockSchema.optional(),
});
export type IUpdateProjectRequest = z.input<typeof UpdateProjectRequestSchema>;

export const ProjectTokenNameSchema = z.string().trim().min(1).max(80);

export const CreateProjectTokenRequestSchema = z.object({
  name: ProjectTokenNameSchema,
});
export type ICreateProjectTokenRequest = z.infer<
  typeof CreateProjectTokenRequestSchema
>;

export const ProjectTokenSchema = z.object({
  project: ProjectSchema,
  tokenId: z.string(),
  token: z.string(),
});
export type IProjectToken = z.infer<typeof ProjectTokenSchema>;

export const ProjectConnectRequestSchema = z.object({
  name: ProjectTokenNameSchema,
});
export type IProjectConnectRequest = z.infer<
  typeof ProjectConnectRequestSchema
>;

export const ProjectConnectCodeSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
});
export type IProjectConnectCode = z.infer<typeof ProjectConnectCodeSchema>;

export const ProjectTokenExchangeRequestSchema = z.object({
  code: z.string().min(1).max(200),
});
export type IProjectTokenExchangeRequest = z.infer<
  typeof ProjectTokenExchangeRequestSchema
>;

export const ProjectTokenExchangeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  token: z.string(),
});
export type IProjectTokenExchange = z.infer<typeof ProjectTokenExchangeSchema>;

export const PlanTaskStateSchema = z.enum(["done", "taken", "free", "waiting"]);
export type IPlanTaskState = z.infer<typeof PlanTaskStateSchema>;

const PlanTaskIdSchema = z.string().trim().min(1).max(16);
const PlanTextSchema = z.string().max(20_000);
const PlanShortTextSchema = z.string().max(4_000);
const PlanSizeSchema = z.string().trim().max(8);
const PlanPersonSchema = z.string().trim().min(1).max(64);

export const PlanTaskSchema = z.object({
  id: PlanTaskIdSchema,
  title: PlanTextSchema,
  state: PlanTaskStateSchema,
  owner: z.string().max(64).optional(),
  waitsFor: z.array(z.string().max(16)).max(50).optional(),
  depends: z.array(z.string().max(16)).max(50).optional(),
  where: PlanShortTextSchema.optional(),
  doneWhen: PlanShortTextSchema.optional(),
  size: z.string().max(8).optional(),
  note: z.string().max(300).optional(),
  takenAt: z.string().nullable().optional(),
  doneAt: z.string().nullable().optional(),
  doneBy: z.string().max(64).nullable().optional(),
});
export type IPlanTask = z.infer<typeof PlanTaskSchema>;

export const PlanSectionSchema = z.object({
  id: z.string().max(16),
  title: z.string().max(200),
  tasks: z.array(PlanTaskSchema).max(1_000),
});
export type IPlanSection = z.infer<typeof PlanSectionSchema>;

export const PlanBlockSchema = z.object({
  commit: z.string().max(64).optional(),
  version: z.number().int().nonnegative().optional(),
  sections: z.array(PlanSectionSchema).max(100),
});
export type IPlanBlock = z.infer<typeof PlanBlockSchema>;

const CountSchema = z.number().int().nonnegative();

export const DecompProgressSchema = z.object({
  functions: CountSchema,
  done: CountSchema,
  pending: CountSchema,
  bytes: CountSchema,
  bytesDone: CountSchema,
});
export type IDecompProgress = z.infer<typeof DecompProgressSchema>;

export const DecompCategorySchema = DecompProgressSchema.extend({
  id: z.string().max(64),
});
export type IDecompCategory = z.infer<typeof DecompCategorySchema>;

export const DecompAreaSchema = z.object({
  id: z.string().max(64),
  title: z.string().max(120).optional(),
  owners: z.array(z.string().max(64)).max(20),
  functions: CountSchema,
  done: CountSchema,
});
export type IDecompArea = z.infer<typeof DecompAreaSchema>;

export const DecompUnitSchema = DecompProgressSchema.extend({
  id: z.string().max(300),
  category: z.string().max(64),
  area: z.string().max(64).optional(),
  claimedBy: z.string().max(64).optional(),
  note: z.string().max(300).optional(),
});
export type IDecompUnit = z.infer<typeof DecompUnitSchema>;

export const DecompEventKindSchema = z.enum([
  "merge",
  "push",
  "commit",
  "claim",
  "release",
  "done",
  "area",
]);
export type IDecompEventKind = z.infer<typeof DecompEventKindSchema>;

export const DecompEventSchema = z.object({
  at: z.string(),
  kind: DecompEventKindSchema,
  text: z.string().max(500),
  who: z.string().max(64).optional(),
});
export type IDecompEvent = z.infer<typeof DecompEventSchema>;

export const DECOMP_MAP_CELLS = {
  done: "d",
  pending: "p",
  claimed: "t",
  todo: ".",
} as const;

export const DecompBlockSchema = z.object({
  commit: z.string().max(64).optional(),
  totals: DecompProgressSchema.extend({ claimed: CountSchema }),
  categories: z.array(DecompCategorySchema).max(100),
  areas: z.array(DecompAreaSchema).max(100),
  units: z.array(DecompUnitSchema).max(20_000),
  map: z
    .string()
    .max(500_000)
    .regex(/^[dpt.]*$/, "The map holds one of d, p, t or . per function"),
  events: z.array(DecompEventSchema).max(200),
});
export type IDecompBlock = z.infer<typeof DecompBlockSchema>;

/** One function of the map: address, size in bytes, index into `units`, name. */
export const DecompFunctionSchema = z.tuple([
  CountSchema,
  CountSchema,
  CountSchema,
  z.string().max(300),
]);
export type IDecompFunction = z.infer<typeof DecompFunctionSchema>;

/**
 * What the Decompilation map's cells are: every function in the map's order (by address), its
 * file as an index into `units`. Uploaded beside the block (`PUT /projects/:slug/data/decomp/functions`)
 * and read once per page for the map's tooltip, so the block itself stays small.
 */
export const DecompFunctionsSchema = z
  .object({
    commit: z.string().max(64).optional(),
    units: z.array(z.string().max(300)).max(20_000),
    functions: z.array(DecompFunctionSchema).max(500_000),
  })
  .refine(
    ({ units, functions }) =>
      functions.every(([, , unit]) => unit < units.length),
    "Every function points at one of units"
  );
export type IDecompFunctions = z.infer<typeof DecompFunctionsSchema>;

export const PROJECT_BLOCK_SCHEMAS = {
  plan: PlanBlockSchema,
  decomp: DecompBlockSchema,
} as const;

export const getProjectBlockProgress = (
  block: IProjectBlock,
  data: IPlanBlock | IDecompBlock
): { done: number; total: number } => {
  if (block === "decomp") {
    const { totals } = data as IDecompBlock;
    return { done: totals.done, total: totals.functions };
  }
  const tasks = (data as IPlanBlock).sections.flatMap(
    (section) => section.tasks
  );
  return {
    done: tasks.filter((task) => task.state === "done").length,
    total: tasks.length,
  };
};

export const PlanSectionIdSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Z]{1,3}$/,
    "A section id is one to three capital letters, like H"
  );

export const CreatePlanSectionRequestSchema = z.object({
  id: PlanSectionIdSchema.optional(),
  title: z.string().trim().min(1).max(200),
});
export type ICreatePlanSectionRequest = z.infer<
  typeof CreatePlanSectionRequestSchema
>;

export const UpdatePlanSectionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
});
export type IUpdatePlanSectionRequest = z.infer<
  typeof UpdatePlanSectionRequestSchema
>;

export const CreatePlanTaskRequestSchema = z.object({
  section: PlanSectionIdSchema,
  title: PlanTextSchema.trim().min(1),
  where: PlanShortTextSchema.trim().optional(),
  depends: z.array(PlanTaskIdSchema).max(50).optional(),
  doneWhen: PlanShortTextSchema.trim().optional(),
  size: PlanSizeSchema.optional(),
});
export type ICreatePlanTaskRequest = z.infer<
  typeof CreatePlanTaskRequestSchema
>;

export const UpdatePlanTaskRequestSchema =
  CreatePlanTaskRequestSchema.partial();
export type IUpdatePlanTaskRequest = z.infer<
  typeof UpdatePlanTaskRequestSchema
>;

export const PlanTaskActionSchema = z.enum([
  "take",
  "release",
  "done",
  "reopen",
]);
export type IPlanTaskAction = z.infer<typeof PlanTaskActionSchema>;

export const PlanTaskActionRequestSchema = z.object({
  as: PlanPersonSchema.optional(),
  note: z.string().trim().max(300).optional(),
  force: z.boolean().optional(),
});
export type IPlanTaskActionRequest = z.infer<
  typeof PlanTaskActionRequestSchema
>;

export const PlanEventSchema = z.object({
  at: z.string(),
  by: z.string(),
  action: z.string(),
  taskId: z.string().optional(),
  sectionId: z.string().optional(),
  text: z.string().optional(),
});
export type IPlanEvent = z.infer<typeof PlanEventSchema>;

export const getPlanTaskState = (
  task: { done: boolean; owner?: string | null; depends?: string[] },
  done: ReadonlySet<string>
): { state: IPlanTaskState; waitsFor: string[] } => {
  const waitsFor = (task.depends ?? []).filter((id) => !done.has(id));
  if (task.done) return { state: "done", waitsFor: [] };
  if (task.owner) return { state: "taken", waitsFor };
  return { state: waitsFor.length ? "waiting" : "free", waitsFor };
};
