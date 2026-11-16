import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";
import type { IDecompBlock } from "@mooncellar/schemas";
import {
  FIRST_TOKEN_NAME,
  ProjectsService,
  hashProjectToken,
  isProjectToken,
  readBearerToken,
} from "./projects.service";

const TOKEN = "mcp_secret";
const CREATED = new Date("2026-10-23T10:00:00Z");

const plan = {
  sections: [
    {
      id: "H",
      title: "Status hub",
      tasks: [
        { id: "H1", title: "Sign-in page", state: "done" },
        { id: "H2", title: "Plan block", state: "free" },
      ],
    },
  ],
};

const chain = <T>(value: T) => {
  const query = {
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value),
  };
  return query;
};

const storedToken = {
  id: "a1b2c3",
  name: "deck@HistMate",
  hash: hashProjectToken(TOKEN),
  createdAt: CREATED,
  lastUsedAt: null,
};

const createService = (stored: Record<string, unknown> | null) => {
  const project = stored && {
    slug: "mooncellar",
    name: "MoonCellar",
    blocks: ["plan"],
    defaultBlock: "plan",
    uploads: [],
    tokens: [storedToken],
    createdAt: CREATED,
    ...stored,
  };
  const projects = {
    findOne: jest.fn(() => chain(project)),
    find: jest.fn(() => chain(project ? [project] : [])),
    exists: jest.fn().mockResolvedValue(project ? { _id: "x" } : null),
    create: jest.fn(async (doc: Record<string, unknown>) => ({
      ...doc,
      createdAt: CREATED,
    })),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    findOneAndUpdate: jest.fn(
      (
        _filter: unknown,
        _update: {
          $push?: { tokens?: Record<string, unknown> };
          $set?: Record<string, unknown>;
        },
        _options?: unknown
      ) => chain(project)
    ),
    deleteOne: jest.fn(),
  };
  const data = {
    findOne: jest.fn(() => chain(null)),
    findOneAndUpdate: jest.fn(async () => ({ updatedAt: CREATED })),
    updateOne: jest.fn(),
    deleteMany: jest.fn(),
  };
  const codes = {
    create: jest.fn(),
    findOneAndDelete: jest.fn(() => chain(null)),
    deleteMany: jest.fn(),
  };
  const plans = { deleteMany: jest.fn() };
  const planEvents = { deleteMany: jest.fn() };
  const service = new ProjectsService(
    projects as never,
    data as never,
    codes as never,
    plans as never,
    planEvents as never
  );
  return { service, projects, data, codes, plans, planEvents };
};

describe("project tokens", () => {
  it("reads a bearer token", () => {
    expect(readBearerToken("Bearer abc")).toBe("abc");
    expect(readBearerToken("bearer abc ")).toBe("abc");
    expect(readBearerToken("Basic abc")).toBeNull();
    expect(readBearerToken(undefined)).toBeNull();
  });

  it("matches only the token the hash was made from", () => {
    expect(isProjectToken(TOKEN, hashProjectToken(TOKEN))).toBe(true);
    expect(isProjectToken("mcp_other", hashProjectToken(TOKEN))).toBe(false);
  });
});

describe("ProjectsService.create", () => {
  it("creates a project without tokens", async () => {
    const { service } = createService(null);
    await expect(
      service.create({ name: "Glassline", slug: "glassline", blocks: ["plan"] })
    ).resolves.toEqual({
      slug: "glassline",
      name: "Glassline",
      blocks: ["plan"],
      defaultBlock: "plan",
      uploads: [],
      tokens: [],
      createdAt: CREATED.toISOString(),
    });
  });

  it("refuses a taken address", async () => {
    const { service } = createService({});
    await expect(
      service.create({ name: "Again", slug: "mooncellar", blocks: ["plan"] })
    ).rejects.toThrow("already belongs to another project");
  });

  it("lists the project under the group it is given", async () => {
    const { service } = createService(null);

    await expect(
      service.create({
        name: "Glassline",
        slug: "glassline",
        group: "Ongoing",
        blocks: ["plan"],
      })
    ).resolves.toMatchObject({ group: "Ongoing" });
  });

  it("leaves out a group that was cleared", async () => {
    const { service } = createService(null);

    const project = await service.create({
      name: "Glassline",
      slug: "glassline",
      group: "",
      blocks: ["plan"],
    });

    expect(project).not.toHaveProperty("group");
  });
});

describe("ProjectsService.update", () => {
  it("changes the group only when one is given", async () => {
    const { service, projects } = createService({});

    await service.update("mooncellar", { group: "Fan patches" });
    await service.update("mooncellar", { name: "MoonCellar" });

    expect(projects.findOneAndUpdate.mock.calls[0][1].$set.group).toBe(
      "Fan patches"
    );
    expect(projects.findOneAndUpdate.mock.calls[1][1].$set).not.toHaveProperty(
      "group"
    );
  });
});

describe("ProjectsService tokens", () => {
  it("adds a named token, stores only its hash and never lists it", async () => {
    const { service, projects } = createService({});
    const issued = await service.addToken("mooncellar", "CI");
    expect(issued.token).toMatch(/^mcp_/);
    const pushed = projects.findOneAndUpdate.mock.calls[0][1].$push.tokens;
    expect(pushed).toMatchObject({
      name: "CI",
      hash: hashProjectToken(issued.token),
    });
    expect(pushed).not.toHaveProperty("token");
    expect(issued.tokenId).toBe(pushed.id);
    expect(issued.project.tokens[0]).toEqual({
      id: "a1b2c3",
      name: "deck@HistMate",
      createdAt: CREATED.toISOString(),
      lastUsedAt: null,
    });
  });

  it("says which token it could not revoke", async () => {
    const { service, projects } = createService({});
    projects.findOneAndUpdate.mockReturnValue(chain(null) as never);
    await expect(service.revokeToken("mooncellar", "nope")).rejects.toThrow(
      new NotFoundException(
        'The project at "mooncellar" has no token with the id "nope"'
      )
    );
  });

  it("moves a single token of an older project into the list", async () => {
    const { service, projects } = createService({});
    projects.find.mockReturnValue(
      chain([
        { slug: "medecomp", tokenHash: "abc", createdAt: CREATED },
      ]) as never
    );
    await service.moveSingleTokens();
    expect(projects.updateOne).toHaveBeenCalledWith(
      { slug: "medecomp", tokenHash: "abc" },
      {
        $push: {
          tokens: expect.objectContaining({
            name: FIRST_TOKEN_NAME,
            hash: "abc",
          }),
        },
        $unset: { tokenHash: "" },
      }
    );
  });
});

describe("ProjectsService connect", () => {
  it("stores only the hash of a connect code that expires", async () => {
    const { service, codes } = createService({});
    const before = Date.now();
    const { code, expiresAt } = await service.createConnectCode(
      "mooncellar",
      "deck@HistMate"
    );
    const stored = codes.create.mock.calls[0][0];
    expect(stored).toMatchObject({
      codeHash: hashProjectToken(code),
      slug: "mooncellar",
      name: "deck@HistMate",
    });
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(before);
  });

  it("exchanges a code once for a token named after the device", async () => {
    const { service, codes, projects } = createService({});
    codes.findOneAndDelete.mockReturnValue(
      chain({ slug: "mooncellar", name: "deck@HistMate" }) as never
    );
    const result = await service.exchangeCode("mooncellar", "the-code");
    expect(codes.findOneAndDelete).toHaveBeenCalledWith({
      codeHash: hashProjectToken("the-code"),
      slug: "mooncellar",
      expiresAt: { $gt: expect.any(Date) },
    });
    expect(result).toMatchObject({ slug: "mooncellar", name: "deck@HistMate" });
    expect(projects.findOneAndUpdate.mock.calls[0][1].$push.tokens.name).toBe(
      "deck@HistMate"
    );
  });

  it("refuses an unknown or used code", async () => {
    const { service } = createService({});
    await expect(service.exchangeCode("mooncellar", "used")).rejects.toThrow(
      BadRequestException
    );
  });
});

describe("ProjectsService.putData", () => {
  it("stores a valid block, records its progress and the token's use", async () => {
    const { service, data, projects } = createService({});
    const upload = await service.putData(
      "mooncellar",
      "plan",
      `Bearer ${TOKEN}`,
      plan
    );
    expect(upload).toEqual({
      block: "plan",
      updatedAt: CREATED.toISOString(),
      size: Buffer.byteLength(JSON.stringify(plan)),
      done: 1,
      total: 2,
    });
    expect(data.findOneAndUpdate).toHaveBeenCalledWith(
      { slug: "mooncellar", block: "plan" },
      { $set: { body: JSON.stringify(plan) } },
      { upsert: true, new: true }
    );
    expect(projects.updateOne).toHaveBeenLastCalledWith(
      { slug: "mooncellar", "tokens.id": "a1b2c3" },
      {
        $push: {
          uploads: expect.objectContaining({
            block: "plan",
            done: 1,
            total: 2,
          }),
        },
        $set: { "tokens.$.lastUsedAt": expect.any(Date) },
      }
    );
  });

  it("refuses a missing or wrong token without telling which projects exist", async () => {
    const { service } = createService({});
    await expect(
      service.putData("mooncellar", "plan", undefined, plan)
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.putData("mooncellar", "plan", "Bearer mcp_wrong", plan)
    ).rejects.toThrow(UnauthorizedException);
    const missing = createService(null);
    await expect(
      missing.service.putData("nothing", "plan", `Bearer ${TOKEN}`, plan)
    ).rejects.toThrow(UnauthorizedException);
  });

  it("refuses a revoked token", async () => {
    const { service } = createService({ tokens: [] });
    await expect(
      service.putData("mooncellar", "plan", `Bearer ${TOKEN}`, plan)
    ).rejects.toThrow(UnauthorizedException);
  });

  it("refuses a block the project does not have", async () => {
    const { service } = createService({});
    await expect(
      service.putData("mooncellar", "decomp", `Bearer ${TOKEN}`, {})
    ).rejects.toThrow("MoonCellar has no Decompilation block");
  });

  it("refuses an unknown block name", async () => {
    const { service } = createService({});
    await expect(
      service.putData("mooncellar", "wiki", `Bearer ${TOKEN}`, {})
    ).rejects.toThrow(BadRequestException);
  });

  it("validates the body against the block's schema", async () => {
    const { service, data } = createService({});
    await expect(
      service.putData("mooncellar", "plan", `Bearer ${TOKEN}`, {
        sections: [{ id: "H" }],
      })
    ).rejects.toThrow(ZodValidationException);
    expect(data.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("ProjectsService.getData", () => {
  it("says when nothing was uploaded yet", async () => {
    const { service } = createService({});
    await expect(service.getData("mooncellar", "plan")).rejects.toThrow(
      new NotFoundException("MoonCellar has not uploaded its Plan block yet")
    );
  });

  it("returns the stored JSON as it is", async () => {
    const { service, data } = createService({});
    data.findOne.mockReturnValue(chain({ body: '{"sections":[]}' }) as never);
    await expect(service.getData("mooncellar", "plan")).resolves.toBe(
      '{"sections":[]}'
    );
  });
});

describe("ProjectsService.update", () => {
  it("drops the data of a removed block", async () => {
    const { service, data, projects } = createService({
      blocks: ["decomp", "plan"],
    });
    await service.update("mooncellar", { blocks: ["plan"] });
    expect(projects.findOneAndUpdate).toHaveBeenCalledWith(
      { slug: "mooncellar" },
      {
        $set: {
          name: "MoonCellar",
          blocks: ["plan"],
          defaultBlock: "plan",
        },
        $pull: { uploads: { block: { $in: ["decomp"] } } },
      },
      { new: true }
    );
    expect(data.deleteMany).toHaveBeenCalledWith({
      slug: "mooncellar",
      block: { $in: ["decomp", "decomp/functions"] },
    });
  });
});

describe("ProjectsService.remove", () => {
  it("deletes the project with its uploads, codes, plan and plan history", async () => {
    const { service, projects, data, codes, plans, planEvents } = createService(
      {}
    );
    await service.remove("mooncellar");
    expect(projects.deleteOne).toHaveBeenCalledWith({ slug: "mooncellar" });
    for (const model of [data, codes, plans, planEvents]) {
      expect(model.deleteMany).toHaveBeenCalledWith({ slug: "mooncellar" });
    }
  });
});

describe("ProjectsService functions", () => {
  const functions = {
    units: ["src/game/a.cpp", "src/game/b.cpp"],
    functions: [
      [0x1000, 64, 0, "A::run()"],
      [0x1040, 32, 1, "B::stop()"],
    ],
  };

  it("stores what the map's cells are beside the Decompilation block", async () => {
    const { service, data, projects } = createService({ blocks: ["decomp"] });
    const answer = await service.putFunctions(
      "mooncellar",
      `Bearer ${TOKEN}`,
      functions
    );
    expect(answer).toEqual({
      functions: 2,
      size: Buffer.byteLength(JSON.stringify(functions)),
    });
    expect(data.updateOne).toHaveBeenCalledWith(
      { slug: "mooncellar", block: "decomp/functions" },
      { $set: { body: JSON.stringify(functions) } },
      { upsert: true }
    );
    expect(projects.updateOne).toHaveBeenCalledWith(
      { slug: "mooncellar", "tokens.id": "a1b2c3" },
      { $set: { "tokens.$.lastUsedAt": expect.any(Date) } }
    );
  });

  it("refuses a function that points past the files", async () => {
    const { service } = createService({ blocks: ["decomp"] });
    await expect(
      service.putFunctions("mooncellar", `Bearer ${TOKEN}`, {
        units: ["src/game/a.cpp"],
        functions: [[0x1000, 64, 1, "A::run()"]],
      })
    ).rejects.toBeInstanceOf(ZodValidationException);
  });

  it("needs the Decompilation block", async () => {
    const { service } = createService({});
    await expect(
      service.putFunctions("mooncellar", `Bearer ${TOKEN}`, functions)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("says when nothing was uploaded yet", async () => {
    const { service } = createService({ blocks: ["decomp"] });
    await expect(service.getFunctions("mooncellar")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

describe("ProjectsService.patchDecompLive", () => {
  const block = (): IDecompBlock => ({
    commit: "3eecb3c",
    totals: {
      functions: 4,
      done: 2,
      pending: 5,
      bytes: 400,
      bytesDone: 200,
      claimed: 0,
    },
    categories: [
      {
        id: "game",
        functions: 4,
        done: 2,
        pending: 5,
        bytes: 400,
        bytesDone: 200,
      },
    ],
    areas: [],
    units: [
      {
        id: "src/game/a.cpp",
        category: "game",
        functions: 2,
        done: 0,
        pending: 0,
        bytes: 200,
        bytesDone: 0,
      },
      {
        id: "src/game/b.cpp",
        category: "game",
        functions: 2,
        done: 2,
        pending: 0,
        bytes: 200,
        bytesDone: 200,
      },
    ],
    map: "..dd",
    events: [],
  });

  const functions = {
    commit: "3eecb3c",
    units: ["src/game/a.cpp", "src/game/b.cpp"],
    functions: [
      [0x1000, 100, 0, "A::run()"],
      [0x1064, 100, 0, "A::stop()"],
      [0x10c8, 100, 1, "B::run()"],
      [0x112c, 100, 1, "B::stop()"],
    ],
  };

  const createLiveService = (
    stored: unknown,
    mapFunctions: unknown | null = functions
  ) => {
    const context = createService({ blocks: ["decomp"] });
    (context.data.findOne as jest.Mock).mockImplementation(
      (filter: { block: string }) =>
        chain(
          stored && filter.block === "decomp"
            ? { body: JSON.stringify(stored) }
            : mapFunctions && filter.block === "decomp/functions"
              ? { body: JSON.stringify(mapFunctions) }
              : null
        )
    );
    return context;
  };

  const storedBody = (data: { updateOne: jest.Mock }) =>
    JSON.parse(data.updateOne.mock.calls[0][1].$set.body);

  it("claims the files the block has and skips unknown and complete ones", async () => {
    const { service, data } = createLiveService(block());

    await expect(
      service.patchDecompLive("mooncellar", `Bearer ${TOKEN}`, {
        claims: [
          { unit: "src/game/a.cpp", name: "sergeyhist", note: "menu" },
          { unit: "src/game/b.cpp", name: "sergeyhist" },
          { unit: "src/game/gone.cpp", name: "someone" },
        ],
      })
    ).resolves.toEqual({ claimed: 1, pending: 5 });

    const body = storedBody(data);
    expect(body.totals.claimed).toBe(1);
    expect(body.totals.pending).toBe(5);
    expect(body.units[0]).toMatchObject({
      claimedBy: "sergeyhist",
      note: "menu",
    });
    expect(body.units[1]).not.toHaveProperty("claimedBy");
    expect(body.map).toBe("ttdd");
    expect(data.updateOne).toHaveBeenCalledWith(
      { slug: "mooncellar", block: "decomp" },
      { $set: { body: expect.any(String) } }
    );
  });

  it("releases a claim, takes its cells out of the map and keeps the upload's progress", async () => {
    const claimed = block();
    claimed.totals.claimed = 1;
    claimed.units[0].claimedBy = "sergeyhist";
    claimed.units[0].note = "menu";
    claimed.map = "ttdd";
    const { service, data, projects } = createLiveService(claimed);

    await expect(
      service.patchDecompLive("mooncellar", `Bearer ${TOKEN}`, {
        claims: [],
        pending: 0,
      })
    ).resolves.toEqual({ claimed: 0, pending: 0 });

    const body = storedBody(data);
    expect(body.totals.claimed).toBe(0);
    expect(body.totals.pending).toBe(0);
    expect(body.units[0]).not.toHaveProperty("claimedBy");
    expect(body.units[0]).not.toHaveProperty("note");
    expect(body.map).toBe("..dd");
    expect(
      projects.updateOne.mock.calls.every(([, update]) => !update.$push)
    ).toBe(true);
  });

  it("leaves the map alone when its functions came from another commit", async () => {
    const { service, data } = createLiveService(block(), {
      ...functions,
      commit: "older123",
    });

    await service.patchDecompLive("mooncellar", `Bearer ${TOKEN}`, {
      claims: [{ unit: "src/game/a.cpp", name: "sergeyhist" }],
    });

    expect(storedBody(data).map).toBe("..dd");
  });

  it("validates the body against DecompLiveSchema", async () => {
    const { service, data } = createLiveService(block());
    await expect(
      service.patchDecompLive("mooncellar", `Bearer ${TOKEN}`, {
        claims: "sergeyhist",
      })
    ).rejects.toBeInstanceOf(ZodValidationException);
    expect(data.updateOne).not.toHaveBeenCalled();
  });

  it("needs the Decompilation block and something uploaded", async () => {
    const withoutBlock = createService({});
    await expect(
      withoutBlock.service.patchDecompLive("mooncellar", `Bearer ${TOKEN}`, {
        claims: [],
      })
    ).rejects.toThrow("MoonCellar has no Decompilation block");

    const empty = createLiveService(null);
    await expect(
      empty.service.patchDecompLive("mooncellar", `Bearer ${TOKEN}`, {
        claims: [],
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses a missing or wrong token", async () => {
    const { service } = createLiveService(block());
    await expect(
      service.patchDecompLive("mooncellar", undefined, { claims: [] })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.patchDecompLive("mooncellar", "Bearer mcp_wrong", { claims: [] })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
