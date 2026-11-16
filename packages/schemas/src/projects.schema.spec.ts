import {
  CreateProjectRequestSchema,
  DecompBlockSchema,
  DecompLiveSchema,
  PlanBlockSchema,
  ProjectSlugSchema,
  getProjectBlockProgress,
} from "./projects.schema";

const progress = {
  functions: 4,
  done: 2,
  pending: 1,
  bytes: 400,
  bytesDone: 200,
};

const decomp = {
  totals: { ...progress, claimed: 1 },
  categories: [{ id: "game", ...progress }],
  areas: [{ id: "world", owners: ["sergeyhist"], functions: 4, done: 2 }],
  units: [
    {
      id: "game/Level.cpp",
      category: "game",
      ...progress,
      claimedBy: "sergeyhist",
    },
  ],
  map: "ddpt",
  events: [
    { at: "2026-10-23T10:00:00Z", kind: "merge", text: "Merged work/a/world" },
  ],
};

const plan = {
  sections: [
    {
      id: "H",
      title: "Status hub",
      tasks: [
        {
          id: "H1",
          title: "Sign-in page",
          state: "taken",
          owner: "sergeyhist",
        },
        { id: "H2", title: "Projects API", state: "done" },
        { id: "H3", title: "Plan block", state: "waiting", waitsFor: ["H1"] },
      ],
    },
  ],
};

describe("ProjectSlugSchema", () => {
  it.each(["mooncellar", "a", "glass-line", "j2"])("accepts %s", (slug) => {
    expect(ProjectSlugSchema.safeParse(slug).success).toBe(true);
  });

  it.each([
    "",
    "-a",
    "a-",
    "Upper",
    "with space",
    "a".repeat(41),
    "login",
    "manage",
  ])("rejects %p", (slug) => {
    expect(ProjectSlugSchema.safeParse(slug).success).toBe(false);
  });
});

describe("CreateProjectRequestSchema", () => {
  it("keeps blocks in the hub's order without duplicates", () => {
    const result = CreateProjectRequestSchema.parse({
      name: " Rooftops ",
      slug: "rooftops",
      blocks: ["plan", "decomp", "plan"],
    });
    expect(result).toEqual({
      name: "Rooftops",
      slug: "rooftops",
      blocks: ["decomp", "plan"],
    });
  });

  it("needs at least one block", () => {
    expect(
      CreateProjectRequestSchema.safeParse({ name: "X", slug: "x", blocks: [] })
        .success
    ).toBe(false);
  });
});

describe("project blocks", () => {
  it("accept a full decompilation block", () => {
    expect(DecompBlockSchema.safeParse(decomp).success).toBe(true);
  });

  it("reject a map with other characters", () => {
    expect(DecompBlockSchema.safeParse({ ...decomp, map: "ddx" }).success).toBe(
      false
    );
  });

  it("reject an unknown task state", () => {
    const broken = {
      sections: [
        {
          ...plan.sections[0],
          tasks: [{ id: "H9", title: "?", state: "later" }],
        },
      ],
    };
    expect(PlanBlockSchema.safeParse(broken).success).toBe(false);
  });

  it("take the whole list of claims, with or without a pending count", () => {
    expect(
      DecompLiveSchema.parse({ claims: [{ unit: "a", name: "x" }] })
    ).toEqual({ claims: [{ unit: "a", name: "x" }] });
    expect(DecompLiveSchema.parse({ claims: [], pending: 3 }).pending).toBe(3);
  });

  it("list every claimed file once", () => {
    expect(
      DecompLiveSchema.safeParse({ claims: [{ unit: "a" }, { unit: "a" }] })
        .success
    ).toBe(false);
  });

  it("count progress per block", () => {
    expect(
      getProjectBlockProgress("decomp", DecompBlockSchema.parse(decomp))
    ).toEqual({
      done: 2,
      total: 4,
    });
    expect(
      getProjectBlockProgress("plan", PlanBlockSchema.parse(plan))
    ).toEqual({
      done: 1,
      total: 3,
    });
  });
});
