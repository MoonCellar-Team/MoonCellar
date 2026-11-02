import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { buildAuthorization, getGameExtended } from "@retroachievements/api";
import { isValidObjectId, type Model, type Types } from "mongoose";
import {
  GAME_IMAGE_CANDIDATES_MAX,
  PAGE_IMAGE_CANDIDATES_MAX,
  type IFindGameImagesRequest,
  type IFindGameImagesResponse,
  type IGameImageKind,
  ADULT_THEME_NAME,
  CHARACTER_AI_DRAFT_MAX_COUNT,
  GAME_STATUSES,
  GAME_TYPES,
  type IAddGameRequest,
  type ISaveCharacterRequest,
} from "@mooncellar/schemas";
import { Game } from "../schemas/game.schema";
import { Platform } from "../schemas/platform.schema";
import {
  GameAiDraft,
  type IAiDraftKind,
} from "../schemas/game-ai-draft.schema";
import { FileService } from "../../user/services/file-upload.service";
import { S3_FOLDERS } from "../../../shared/s3";
import {
  SEARCH_ENGINES_UNAVAILABLE,
  searchImages,
  searchWeb,
  searchYoutube,
} from "../../../shared/searxng";
import {
  downloadRemoteImage,
  downloadRemotePage,
  extractPageImageUrls,
  findPageImages,
  isHttpUrl,
} from "../../../shared/remote-image";
import { toReleaseDate } from "../../../shared/release-date";
import { uniqueSlug } from "../../../shared/utils";
import {
  callOpenAi,
  type IOpenAiOutput,
  openAiModel,
  outputText,
} from "../../../shared/openai";
import { assertAiKey } from "../../../shared/ai";
import { normalizeTitle } from "../utils/title-match.utils";
import { FRONT_URL, RA_MAIN_USER_NAME } from "../../../shared/constants";
import { VNDB_WORLDWIDE_REGION } from "../constants/vndb";
import {
  RA_MEDIA_URL,
  toRaSetEntry,
} from "../../retroach/utils/retroach.utils";

const STEAMGRIDDB_URL = "https://www.steamgriddb.com/api/v2";
const STEAMGRIDDB_IMAGES_LIMIT = 5;
const MAX_TURNS = 12;
const TOOL_FAILED = "Tool failed:";
const IMAGE_SEARCH_LIMIT = 20;
const IMAGE_SEARCH_SUFFIX: Record<IGameImageKind, string> = {
  cover: "cover art box art",
  screenshots: "screenshot gameplay",
  artworks: "key art artwork wallpaper",
};
const ADMIN_FETCH = { useSessions: true };
const AI_SEARCH_PREFIX = "AI web search results";
const RA_HOSTS = new Set([
  "retroachievements.org",
  "www.retroachievements.org",
]);
const RA_NO_IMAGE = "/Images/000002.png";
const GENERIC_QUERY_WORDS = new Set([
  "the",
  "and",
  "game",
  "games",
  "character",
  "characters",
  "cast",
  "list",
  "official",
  "wiki",
  "vndb",
  "dlsite",
  "steam",
  "キャラ",
  "キャラクター",
  "登場人物",
]);

const queryTokens = (query: string) =>
  query
    .toLowerCase()
    .split(/[\s"'()[\],:;!?「」『』・]+/)
    .filter(
      (token) =>
        !GENERIC_QUERY_WORDS.has(token) &&
        (/\P{ASCII}/u.test(token) ? token.length >= 2 : token.length >= 3)
    );

const isRelevant = (
  results: { title: string; url: string; content?: string }[],
  query: string
) => {
  const tokens = queryTokens(query);

  if (!tokens.length) return results.length > 0;

  return results.some((result) => {
    const text =
      `${result.title} ${result.url} ${result.content ?? ""}`.toLowerCase();

    return tokens.some((token) => text.includes(token));
  });
};
const AI_SEARCH_INSTRUCTIONS = `Search the web for the query and report what the pages say, as a list: for each relevant page its title, URL and the facts it gives about the query. Keep names in their original language as written (for example Japanese) and add a romanised form. Report only what the pages say; when nothing relevant is found, say so.`;
const ADULT_KEYWORD = "pay gorn";
const SEARCH_TOOLS = new Set(["search_web", "search_images", "search_youtube"]);
const CONNECTION_FAILURE =
  /Unable to connect|ECONNREFUSED|fetch failed|ENOTFOUND|timed out/i;
const PAGE_TEXT_LIMIT = 30_000;
const PAGE_IMAGES_LIMIT = 40;
const RUNS_LIMIT = 20;
const STEPS_LIMIT = 100;

type IFilters = Record<
  | "genres"
  | "themes"
  | "modes"
  | "player_perspectives"
  | "game_engines"
  | "languages"
  | "companies",
  string[]
>;

type IDraft = {
  name: string;
  alternative_names: string[];
  type: string;
  status: string | null;
  summary: string | null;
  storyline: string | null;
  first_release: string | null;
  genres: string[];
  themes: string[];
  is_adult: boolean;
  modes: string[];
  player_perspectives: string[];
  game_engines: string[];
  languages: string[];
  keywords: string[];
  franchises: string[];
  companies: {
    name: string;
    developer: boolean;
    publisher: boolean;
    porting: boolean;
    supporting: boolean;
  }[];
  platforms: string[];
  release_dates: { date: string; platform: string }[];
  cover: string | null;
  screenshots: string[];
  artworks: string[];
  videos: string[];
  websites: string[];
  externalPages: { name: string; uid: string; url: string }[];
};

const str = { type: "string" };
const nullableStr = { type: ["string", "null"] };
const strList = { type: "array", items: str };
const enumList = (values: string[]) => ({
  type: "array",
  items: { type: "string", enum: values },
});
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const QUERY_TOOL = object({ query: str });

const TOOLS = [
  {
    name: "search_web",
    description:
      "Web search. Use it to research release dates, developers, platforms, genres, store pages.",
    parameters: QUERY_TOOL,
  },
  {
    name: "search_images",
    description:
      "Image search. Returns img_src URLs usable as cover, screenshots or artworks.",
    parameters: QUERY_TOOL,
  },
  {
    name: "search_youtube",
    description: "YouTube search for trailers and gameplay videos.",
    parameters: QUERY_TOOL,
  },
  {
    name: "search_steamgriddb",
    description:
      "SteamGridDB artwork for a game: portrait covers (grids) and wide banners (heroes). Pass the Steam app id when the game is on Steam, otherwise the game name.",
    parameters: object({ steam_app_id: nullableStr, name: nullableStr }),
  },
  {
    name: "fetch_page",
    description:
      "Fetch a web page and return its title, text and image URLs. Use it on the link the admin gave and on store/wiki pages found by search.",
    parameters: object({ url: str }),
  },
].map((tool) => ({ type: "function", strict: true, ...tool }));

const INSTRUCTIONS = `You research one video game and fill a database record for it, the way a careful editor would.
The admin gives either a game name or a link to a page about the game. When it is a link, fetch it first.
Research with the tools, then answer with the record only.
Rules:
- There is no way to ask the admin anything: never ask questions or put requests, notes or apologies into the answer.
- Every text field is in English, whatever language the sources use; translate.
- Use only facts a source supports. Leave a field empty or null rather than guess.
- type, status, genres, themes, modes and player_perspectives must be picked from the allowed values in the schema.
- is_adult is true for adult games: pornographic or sexually explicit content, eroge, hentai games, titles sold as 18+ for sexual content. Decide from the sources (store age gates, VNDB/DLsite/F95Zone listings, ratings); violence or mild fan service alone does not make a game adult.
- game_engines, languages and company names: prefer the exact spelling from the known lists given below when one matches.
- platforms and release_dates.platform are platform slugs from the schema enum.
- Dates are "YYYY-MM-DD", or "YYYY-MM" / "YYYY" when the day or month is unknown. first_release is the earliest release date.
- Always call search_steamgriddb. cover is its best portrait grid; only when it has none, use another portrait image close to a 3:4 ratio (box art, poster), never a landscape banner. Never build or guess an image URL.
- artworks are promotional or key art, at most 5: put the best SteamGridDB heroes there first (largest first), then other key art. screenshots are in-game captures, at most 10. Do not put the same image in both.
- videos are YouTube links to trailers or gameplay.
- externalPages: for a Steam game always add {name: "Steam", uid: "<app id>", url: "https://store.steampowered.com/app/<app id>"}, plus other store or database pages found (GOG, itch.io, Epic Games, DLsite...).
- websites are official sites and social pages.
- Image URLs must be direct links to image files, taken from tool results.
- Research in few rounds: call several tools at once whenever the calls do not depend on each other, and answer as soon as the main fields are covered. You have at most ${MAX_TURNS} rounds of tool calls.`;

const CHARACTER_TOOLS = TOOLS.filter(({ name }) =>
  ["search_web", "search_images", "fetch_page"].includes(name)
);

const CHARACTER_RESEARCH_STEPS = `Work in two stages:
1. Identify the game. Read the links you are given and the pages the catalogue record lists, and note the title in every form (English, original Japanese, romaji), the developer or circle, and the store IDs (DLsite RJ code, VNDB v-id, Steam app id).
2. Search the whole web for the characters, not only the given pages. Links identify the game; the characters are usually described elsewhere. Try several queries: the original-language title with 登場人物 or キャラクター, the romaji title, the developer name with the title, the store ID, and database sites (VNDB character pages, Getchu, ErogameScape, DLsite, F95Zone, fandom wikis, anime character databases). Store descriptions and reviews often name the heroine too.`;

const CHARACTER_INSTRUCTIONS = `You research one video game character and fill a database record for it, the way a careful editor would.
The admin gives a character name, usually with the game, or a link to a page about the character. When it is a link, fetch it first.
When the admin gives a game instead of a character (a game title or a link to a game page), research the game's main character: the protagonist, or the heroine the title is about.
${CHARACTER_RESEARCH_STEPS}
Then answer with the record only.
Rules:
- There is no way to ask the admin anything: never ask questions or put requests, notes or apologies into the answer.
- identified is true when you found the character in the sources, including the main character picked for a game. Set it to false, with every other field empty, only when you could not find the game or any character of it.
- Every text field is in English, whatever language the sources use; translate.
- Use only facts a source supports. Leave a field empty or null rather than guess.
- akas are other names the character goes by: nicknames, titles, original-language names in Latin script. At most 20.
- gender and species are short: "Female", "Male", "Human", "Android", "Demon"...
- countryName is where the character is from, only when a source states it.
- description is two or three paragraphs about who the character is and their role in the story, without major spoilers.
- mug_shots are up to 5 direct links to portraits of this exact character, best first: official art or a clean crop showing the face, square or portrait. Search for them once you know who the character is (search_images with the name and the game title), and take links only from tool results. Never build or guess an image URL. Candidates are tried in order and the first one that downloads is kept, so prefer image hosts over pages that block bots.
- games are the exact titles of the games the character appears in, main entries first, at most 20.
- Research in few rounds: call several tools at once whenever the calls do not depend on each other, and answer as soon as the main fields are covered. You have at most ${MAX_TURNS} rounds of tool calls.`;

const LIST_CONCURRENCY = 3;
const SITE_HOSTS = new Set([
  new URL(FRONT_URL).host,
  "mooncellar.space",
  "www.mooncellar.space",
]);

const PORTRAIT_CANDIDATES_LIMIT = 5;

const CHARACTER_LIST_INSTRUCTIONS = `You find the characters of one video game so that each of them can be researched separately afterwards.
The admin names a game, or gives a link to a page about the game or its characters. When it is a link, fetch it first.
${CHARACTER_RESEARCH_STEPS}
Return at most {count} characters: the most important ones first (protagonists, main cast, major antagonists), then notable supporting characters. Small or adult games rarely have a cast list, so gather them from every source; return every character you find, even a single one, rather than an empty list.
For every character give the name as the sources spell it in English, and a research query that identifies the character unambiguously: the name followed by the game title in parentheses.
game is the exact title of the game you researched, even when you found no characters. There is no way to ask the admin anything: never ask questions or put requests into the answer. When you cannot identify the game with confidence, return game null and an empty list.
Research in few rounds and answer as soon as the list is complete. You have at most ${MAX_TURNS} rounds of tool calls.`;

const CHARACTER_LIST_SCHEMA = object({
  game: nullableStr,
  characters: {
    type: "array",
    items: object({ name: str, query: str }),
  },
});

const CHARACTER_SCHEMA = object({
  identified: { type: "boolean" },
  name: str,
  akas: strList,
  gender: nullableStr,
  species: nullableStr,
  countryName: nullableStr,
  description: nullableStr,
  mug_shots: strList,
  games: strList,
});

type ICharacterDraft = {
  identified: boolean;
  name: string;
  akas: string[];
  gender: string | null;
  species: string | null;
  countryName: string | null;
  description: string | null;
  mug_shots: string[];
  games: string[];
};

type IResearch = {
  instructions: string;
  input: string;
  tools: typeof TOOLS;
  schemaName: string;
  schema: Record<string, unknown>;
};

type IToolOutput = { id: string; name: string; output: string };

type IResearchTurn = (
  outputs: IToolOutput[],
  isLastTurn: boolean
) => Promise<{
  calls: { id: string; name: string; arguments: string }[];
  text: string;
}>;

const openAiTurns = ({
  instructions,
  input,
  tools,
  schemaName,
  schema,
}: IResearch): IResearchTurn => {
  let body: Record<string, unknown> = {
    model: openAiModel(),
    instructions,
    input,
    tools,
    text: {
      format: { type: "json_schema", name: schemaName, strict: true, schema },
    },
  };

  return async (outputs, isLastTurn) => {
    if (outputs.length) {
      body = {
        ...body,
        input: outputs.map(({ id, output }) => ({
          type: "function_call_output",
          call_id: id,
          output,
        })),
      };
    }

    const response = await callOpenAi(process.env.OPENAI_API_KEY!, {
      ...body,
      tool_choice: isLastTurn ? "none" : "auto",
    });

    body = { ...body, previous_response_id: response.id };

    return {
      calls: response.output
        .filter(
          (item): item is Extract<IOpenAiOutput, { type: "function_call" }> =>
            item.type === "function_call"
        )
        .map((call) => ({
          id: call.call_id,
          name: call.name,
          arguments: call.arguments,
        })),
      text: outputText(response.output),
    };
  };
};

const kindFilter = (kind: IAiDraftKind) =>
  kind === "character" ? { kind } : { kind: { $ne: "character" } };

const clip = (value: string | null | undefined, max: number) =>
  value?.trim() ? value.trim().slice(0, max) : null;

@Injectable()
export class GameAiDraftService implements OnModuleInit {
  private readonly logger = new Logger(GameAiDraftService.name);

  constructor(
    @InjectModel(Game.name) private readonly Games: Model<Game>,
    @InjectModel(Platform.name) private readonly Platforms: Model<Platform>,
    @InjectModel(GameAiDraft.name)
    private readonly Drafts: Model<GameAiDraft>,
    private readonly fileService: FileService
  ) {}

  async onModuleInit() {
    await this.Drafts.updateMany(
      { status: "running" },
      { status: "failed", error: "Interrupted by an API restart" }
    );
  }

  getRuns(kind: IAiDraftKind = "game") {
    return this.Drafts.find(kindFilter(kind))
      .sort({ createdAt: -1 })
      .limit(RUNS_LIMIT)
      .lean();
  }

  async deleteRun(id: string) {
    const run = isValidObjectId(id)
      ? await this.Drafts.findById(id).select("status").lean()
      : null;

    if (!run) throw new NotFoundException("AI draft run not found");
    if (run.status === "running") {
      throw new ConflictException("A running AI draft cannot be deleted");
    }

    await this.Drafts.deleteOne({ _id: id });
  }

  private async pruneRuns(kind: IAiDraftKind) {
    const stale = await this.Drafts.find({
      ...kindFilter(kind),
      status: { $ne: "running" },
    })
      .sort({ createdAt: -1 })
      .skip(RUNS_LIMIT)
      .select("_id")
      .lean();

    if (stale.length) {
      await this.Drafts.deleteMany({
        _id: { $in: stale.map(({ _id }) => _id) },
      });
    }
  }

  async startRun(query: string, kind: IAiDraftKind = "game", count = 1) {
    assertAiKey();

    const run = await this.Drafts.create({ query, kind, count });
    await this.pruneRuns(kind);
    void this.execute(run._id, query, kind, count);

    return run.toObject();
  }

  async retryRun(id: string) {
    assertAiKey();

    const run = isValidObjectId(id)
      ? await this.Drafts.findOneAndUpdate(
          { _id: id, status: { $ne: "running" } },
          { status: "running", steps: [], error: null },
          { new: true }
        ).lean()
      : null;

    if (!run) {
      throw new ConflictException("AI draft run not found or still running");
    }

    void this.execute(run._id, run.query, run.kind ?? "game", run.count ?? 1);

    return run;
  }

  private execute(
    runId: Types.ObjectId,
    query: string,
    kind: IAiDraftKind,
    count = 1
  ): Promise<unknown> {
    const addStep = (step: string) =>
      this.Drafts.updateOne(
        { _id: runId },
        { $push: { steps: { $each: [step], $slice: -STEPS_LIMIT } } }
      ).catch((err) => this.logger.error(err, "Failed to save a draft step"));

    const work =
      kind === "character"
        ? count > 1
          ? this.draftCharacterList(query, count, addStep)
          : this.createCharacterDraft(query, addStep)
        : this.createDraft(query, addStep);

    return work
      .then((draft) =>
        this.Drafts.updateOne({ _id: runId }, { status: "done", draft })
      )
      .catch((err: Error) => {
        this.logger.error(err, `AI draft failed: ${query}`);

        return this.Drafts.updateOne(
          { _id: runId },
          { status: "failed", error: err.message }
        );
      })
      .catch((err) => this.logger.error(err, "Failed to save a draft result"));
  }

  async createDraft(
    query: string,
    addStep: (step: string) => Promise<unknown> = async () => undefined
  ): Promise<Partial<IAddGameRequest>> {
    const [platforms, filters] = await Promise.all([
      this.Platforms.find().select("_id name slug").lean(),
      this.getFilters(),
    ]);

    const schema = this.getSchema(
      platforms.map(({ slug }) => slug),
      filters
    );
    const knownLists = [
      `Platforms (slug: name): ${platforms.map(({ slug, name }) => `${slug}: ${name}`).join("; ")}`,
      `Known game engines: ${filters.game_engines.join("; ")}`,
      `Known languages: ${filters.languages.join("; ")}`,
    ].join("\n");

    const { context, retroachievements } = await this.describeLink(query);
    const draft = await this.research<IDraft>({
      instructions: `${INSTRUCTIONS}\n\n${knownLists}`,
      input: context ? `${query}\n\n${context}` : query,
      tools: TOOLS,
      schemaName: "game",
      schema,
      addStep,
    });

    await addStep("Building the draft");

    return {
      ...(await this.toGame(draft, platforms, filters)),
      ...(retroachievements && { retroachievements }),
    };
  }

  private async draftCharacterList(
    query: string,
    count: number,
    addStep: (step: string) => Promise<unknown>
  ) {
    const { context } = await this.describeLink(query);
    const { game, characters } = await this.research<{
      game: string | null;
      characters: { name: string; query: string }[];
    }>({
      instructions: CHARACTER_LIST_INSTRUCTIONS.replaceAll(
        "{count}",
        String(count)
      ),
      input: context ? `${query}\n\n${context}` : query,
      tools: CHARACTER_TOOLS,
      schemaName: "characters",
      schema: CHARACTER_LIST_SCHEMA,
      addStep,
    });

    const found = characters
      .filter(
        ({ name, query }) =>
          name.trim() && !name.includes("?") && !query.includes("?")
      )
      .slice(0, Math.min(count, CHARACTER_AI_DRAFT_MAX_COUNT));

    if (!game?.trim()) {
      throw new BadGatewayException(
        `Could not identify the game "${query}". Start a new draft with its exact title or a link to its page.`
      );
    }

    if (!found.length) {
      throw new BadGatewayException(
        `Found "${game}" but no characters in the sources. Start a draft with a link to a page that names them, or research one character by name.`
      );
    }

    await addStep(
      `Started ${found.length} character drafts: ${found.map(({ name }) => name).join(", ")}`
    );

    for (let i = 0; i < found.length; i += LIST_CONCURRENCY) {
      await Promise.all(
        found.slice(i, i + LIST_CONCURRENCY).map(async (character) => {
          const run = await this.Drafts.create({
            query: character.query.trim() || character.name,
            kind: "character",
            count: 1,
          });

          await this.execute(run._id, run.query, "character");
        })
      );
    }

    await this.pruneRuns("character");

    return null;
  }

  private async createCharacterDraft(
    query: string,
    addStep: (step: string) => Promise<unknown>
  ): Promise<ISaveCharacterRequest> {
    const { context } = await this.describeLink(query);
    const draft = await this.research<ICharacterDraft>({
      instructions: CHARACTER_INSTRUCTIONS,
      input: context ? `${query}\n\n${context}` : query,
      tools: CHARACTER_TOOLS,
      schemaName: "character",
      schema: CHARACTER_SCHEMA,
      addStep,
    });

    if (!draft.identified || !draft.name.trim()) {
      throw new BadGatewayException(
        `Could not identify the character "${query}". Start a new draft with the game title next to the name, or a link to the character's page.`
      );
    }

    await addStep("Building the draft");

    const mugShotUrl = await this.pickPortrait(draft.mug_shots, addStep);
    const gameIds = await this.findGameIds(draft.games);

    return {
      name: draft.name.trim().slice(0, 200),
      akas: [
        ...new Set(
          draft.akas
            .map((aka) => aka.trim().slice(0, 200))
            .filter((aka) => aka && aka !== draft.name.trim())
        ),
      ].slice(0, 20),
      gender: clip(draft.gender, 40),
      species: clip(draft.species, 80),
      countryName: clip(draft.countryName, 120),
      description: clip(draft.description, 10000),
      gameIds,
      ...(mugShotUrl && { mugShotUrl }),
    };
  }

  private async pickPortrait(
    urls: string[],
    addStep: (step: string) => Promise<unknown>
  ) {
    if (!urls.length) {
      await addStep("No portrait candidates");
      return undefined;
    }

    for (const url of urls.slice(0, PORTRAIT_CANDIDATES_LIMIT)) {
      try {
        await downloadRemoteImage(url, ADMIN_FETCH);
        await addStep(`Portrait: ${url}`);

        return url;
      } catch (err) {
        await addStep(`Portrait rejected (${(err as Error).message}): ${url}`);
      }
    }

    return undefined;
  }

  private async describeLink(query: string) {
    const catalogue = await this.describeCatalogueGame(query);

    if (catalogue) return { context: catalogue };

    const raGame = await this.findRaGame(query);

    if (!raGame) return {};

    return {
      context: this.describeRaGame(raGame),
      retroachievements: [toRaSetEntry(raGame)],
    };
  }

  private async findRaGame(query: string) {
    let gameId: number | undefined;

    try {
      const url = new URL(query.trim());

      if (RA_HOSTS.has(url.host)) {
        gameId = Number(url.pathname.match(/^\/game\/(\d+)\/?$/)?.[1]);
      }
    } catch {
      return null;
    }

    const webApiKey = process.env.RETROACHIEVEMENTS_API_KEY;

    if (!gameId || !webApiKey) return null;

    const game = await getGameExtended(
      buildAuthorization({ username: RA_MAIN_USER_NAME, webApiKey }),
      { gameId }
    ).catch(() => null);

    return game?.title ? game : null;
  }

  private describeRaGame(game: Awaited<ReturnType<typeof getGameExtended>>) {
    const images = [game.imageBoxArt, game.imageTitle, game.imageIngame]
      .filter((path) => !!path && path !== RA_NO_IMAGE)
      .map((path) => `${RA_MEDIA_URL}${path}`);

    return [
      "The link is this game on RetroAchievements. The site blocks fetching its pages, so do not fetch the link; search by the title instead.",
      `Title: ${game.title}`,
      "A ~Tag~ in a RetroAchievements title marks the kind of release (Prototype, Hack, Homebrew, Unlicensed, Demo, Subset), not part of the name.",
      `Platform: ${game.consoleName}`,
      game.developer && `Developer: ${game.developer}`,
      game.publisher && `Publisher: ${game.publisher}`,
      game.genre && `Genre: ${game.genre}`,
      game.released && `Released: ${game.released}`,
      images.length && `Images from RetroAchievements: ${images.join(" ")}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private async describeCatalogueGame(query: string) {
    let slug: string | undefined;

    try {
      const url = new URL(query.trim());

      if (SITE_HOSTS.has(url.host)) {
        slug = url.pathname.match(/^\/games\/([a-z0-9-]+)\/?$/)?.[1];
      }
    } catch {
      return null;
    }

    const game = slug
      ? await this.Games.findOne({ slug })
          .select(
            "name alternative_names summary first_release companies websites externalPages"
          )
          .lean()
      : null;

    if (!game) return null;

    const links = [
      ...(game.websites ?? []),
      ...(game.externalPages ?? []).map(({ url }) => url),
    ].filter(Boolean);

    return [
      "The link is this game in our catalogue:",
      `Title: ${game.name}`,
      game.alternative_names?.length &&
        `Also known as: ${game.alternative_names.join("; ")}`,
      game.first_release &&
        `First release: ${new Date(game.first_release * 1000).toISOString().slice(0, 10)}`,
      game.companies?.length &&
        `Companies: ${game.companies.map(({ name }) => name).join("; ")}`,
      game.summary && `Summary: ${game.summary}`,
      links.length && `Pages about it (fetch them): ${links.join(" ")}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private async findGameIds(names: string[]) {
    const ids = await Promise.all(
      names.slice(0, 20).map((name) =>
        this.Games.findOne({ nameNormalized: normalizeTitle(name) })
          .sort({ "igdb.total_rating_count": -1 })
          .select("_id")
          .lean()
          .then((game) => (game ? String(game._id) : null))
      )
    );

    return [...new Set(ids.filter((id): id is string => !!id))];
  }

  private research<T>({
    addStep,
    ...research
  }: IResearch & {
    addStep: (step: string) => Promise<unknown>;
  }): Promise<T> {
    assertAiKey();

    return this.runResearch<T>(openAiTurns(research), addStep);
  }

  private async runResearch<T>(
    nextTurn: IResearchTurn,
    addStep: (step: string) => Promise<unknown>
  ): Promise<T> {
    let outputs: IToolOutput[] = [];

    for (let turn = 0; turn <= MAX_TURNS; turn++) {
      const isLastTurn = turn === MAX_TURNS;

      await addStep(
        isLastTurn
          ? "Out of research rounds, asking for the draft"
          : turn
            ? "Reading the results"
            : "Asking OpenAI"
      );
      const { calls, text } = await nextTurn(outputs, isLastTurn);

      if (!calls.length) {
        if (!text) throw new BadGatewayException("OpenAI returned no draft");

        return JSON.parse(text) as T;
      }

      outputs = await Promise.all(
        calls.map(async (call) => {
          const step = `${call.name} ${this.describeArgs(call.arguments)}`;

          await addStep(step);
          const output = await this.runTool(call.name, call.arguments);

          if (output.startsWith(TOOL_FAILED)) {
            await addStep(`${step}: ${output}`);
          } else if (output.startsWith(AI_SEARCH_PREFIX)) {
            await addStep(`${step}: answered by AI web search`);
          }

          return { id: call.id, name: call.name, output };
        })
      );
      const searches = outputs.filter(({ name }) => SEARCH_TOOLS.has(name));
      const allSearchesFailed = (isFailure: (output: string) => boolean) =>
        !!searches.length &&
        searches.every(
          ({ output }) =>
            !output.startsWith(AI_SEARCH_PREFIX) && isFailure(output)
        );

      if (
        allSearchesFailed((output) =>
          output.includes(SEARCH_ENGINES_UNAVAILABLE)
        )
      ) {
        throw new ServiceUnavailableException(
          "Web search engines are rate-limited or ask for a CAPTCHA right now: retry the draft in a few minutes"
        );
      }

      if (allSearchesFailed((output) => CONNECTION_FAILURE.test(output))) {
        throw new ServiceUnavailableException(
          "Web search is not reachable: check that SearXNG runs at SEARXNG_URL, then retry the draft"
        );
      }
    }

    throw new BadGatewayException("OpenAI did not finish the research");
  }

  private async searchWebWithFallback(query = "") {
    let reason = "no results";

    try {
      const results = await searchWeb(query);

      if (isRelevant(results, query)) return results;

      if (results.length) reason = "only unrelated results";
    } catch (err) {
      reason = (err as Error).message;
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error(`SearXNG: ${reason}`);
    }

    const text = outputText(
      (
        await callOpenAi(process.env.OPENAI_API_KEY, {
          model: openAiModel(),
          instructions: AI_SEARCH_INSTRUCTIONS,
          input: query,
          tools: [{ type: "web_search" }],
          tool_choice: "required",
        })
      ).output
    );

    return `${AI_SEARCH_PREFIX} (SearXNG: ${reason})\n${text.trim() || "Nothing found."}`;
  }

  private describeArgs(rawArgs: string) {
    try {
      const { query, url, steam_app_id, name } = JSON.parse(rawArgs) as {
        query?: string;
        url?: string;
        steam_app_id?: string | null;
        name?: string | null;
      };

      return query ?? url ?? steam_app_id ?? name ?? "";
    } catch {
      return "";
    }
  }

  private async runTool(name: string, rawArgs: string) {
    try {
      const args = JSON.parse(rawArgs) as {
        query?: string;
        url?: string;
        steam_app_id?: string | null;
        name?: string | null;
      };
      const result =
        name === "search_web"
          ? await this.searchWebWithFallback(args.query)
          : name === "search_images"
            ? await searchImages(args.query)
            : name === "search_youtube"
              ? await searchYoutube(args.query)
              : name === "search_steamgriddb"
                ? await this.searchSteamGridDb(args)
                : name === "fetch_page"
                  ? await this.fetchPage(args.url)
                  : `Unknown tool: ${name}`;

      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err) {
      return `${TOOL_FAILED} ${(err as Error).message}`;
    }
  }

  private async keepImages(urls: (string | null)[]) {
    const checked = await Promise.all(
      urls.map((url) =>
        url
          ? downloadRemoteImage(url, ADMIN_FETCH)
              .then(() => url)
              .catch(() => null)
          : null
      )
    );

    return checked.filter((url): url is string => !!url);
  }

  async findImageCandidates({
    name,
    kind,
    steamAppId,
    page = 1,
  }: IFindGameImagesRequest): Promise<IFindGameImagesResponse> {
    if (isHttpUrl(name)) {
      if (page > 1) return { urls: [] };

      return {
        urls: await this.pageImages(name),
      };
    }

    const isFirstPage = page === 1;
    const [steam, steamGridDb, search] = await Promise.all([
      steamAppId && isFirstPage
        ? this.steamImages(steamAppId, kind).catch(() => [])
        : Promise.resolve([]),
      kind === "screenshots" || !isFirstPage
        ? Promise.resolve([])
        : this.searchSteamGridDb({ steam_app_id: steamAppId, name })
            .then((result) =>
              typeof result === "string"
                ? []
                : (kind === "cover" ? result.covers : result.heroes).map(
                    ({ url }) => url
                  )
            )
            .catch(() => []),
      searchImages(
        `${name} ${IMAGE_SEARCH_SUFFIX[kind]}`,
        IMAGE_SEARCH_LIMIT,
        page
      )
        .then((results) =>
          results.flatMap(({ img_src }) => (img_src ? [img_src] : []))
        )
        .catch(() => []),
    ]);

    const candidates = [...new Set([...steam, ...steamGridDb, ...search])];
    const checked = await Promise.all(
      candidates.map((url) =>
        downloadRemoteImage(url, ADMIN_FETCH)
          .then(() => url)
          .catch(() => null)
      )
    );

    return {
      urls: checked
        .filter((url): url is string => !!url)
        .slice(0, GAME_IMAGE_CANDIDATES_MAX),
    };
  }

  private pageImages(url: string) {
    return findPageImages(url, PAGE_IMAGE_CANDIDATES_MAX, ADMIN_FETCH).catch(
      (err: Error) => {
        throw new BadRequestException(`Could not read ${url}: ${err.message}`);
      }
    );
  }

  private async steamImages(appId: string, kind: IGameImageKind) {
    const cdn = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}`;

    if (kind === "cover") return [`${cdn}/library_600x900_2x.jpg`];
    if (kind === "artworks") return [`${cdn}/library_hero.jpg`];

    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=screenshots`
    );
    const json = (await res.json()) as Record<
      string,
      { data?: { screenshots?: { path_full: string }[] } }
    >;

    return (json[appId]?.data?.screenshots ?? []).map(
      ({ path_full }) => path_full
    );
  }

  private async steamGridDb<T>(path: string): Promise<T> {
    const apiKey = process.env.STEAMGRIDDB_API_KEY;

    if (!apiKey) throw new Error("STEAMGRIDDB_API_KEY is not set");

    const res = await fetch(`${STEAMGRIDDB_URL}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`SteamGridDB ${res.status}`);

    return ((await res.json()) as { data: T }).data;
  }

  private async searchSteamGridDb({
    steam_app_id,
    name,
  }: {
    steam_app_id?: string | null;
    name?: string | null;
  }) {
    const game = steam_app_id
      ? await this.steamGridDb<{ id: number; name: string }>(
          `/games/steam/${encodeURIComponent(steam_app_id)}`
        )
      : name
        ? (
            await this.steamGridDb<{ id: number; name: string }[]>(
              `/search/autocomplete/${encodeURIComponent(name)}`
            )
          )?.[0]
        : null;

    if (!game) return "Game not found on SteamGridDB";

    const images = async (kind: "grids" | "heroes", query: string) =>
      (
        (await this.steamGridDb<
          { url: string; width: number; height: number; score: number }[]
        >(`/${kind}/game/${game.id}?${query}`)) ?? []
      )
        .sort((a, b) => b.score - a.score || b.width - a.width)
        .slice(0, STEAMGRIDDB_IMAGES_LIMIT)
        .map(({ url, width, height }) => ({ url, width, height }));

    const [covers, heroes] = await Promise.all([
      images("grids", "dimensions=600x900,660x930&nsfw=any&humor=false"),
      images("heroes", "nsfw=any&humor=false"),
    ]);

    return { game: game.name, covers, heroes };
  }

  private async fetchPage(url: string) {
    const html = await downloadRemotePage(url, ADMIN_FETCH);
    const images = extractPageImageUrls(html, url);
    const text = html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    return {
      title: html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim(),
      text: text.slice(0, PAGE_TEXT_LIMIT),
      images: images.slice(0, PAGE_IMAGES_LIMIT),
    };
  }

  private async getFilters(): Promise<IFilters> {
    const { content } = await this.fileService.getFile(
      S3_FOLDERS.common,
      "filters"
    );
    const filters = JSON.parse(content as string) as Partial<IFilters>;

    return {
      genres: filters.genres ?? [],
      themes: filters.themes ?? [],
      modes: filters.modes ?? [],
      player_perspectives: filters.player_perspectives ?? [],
      game_engines: filters.game_engines ?? [],
      languages: filters.languages ?? [],
      companies: filters.companies ?? [],
    };
  }

  private getSchema(platformSlugs: string[], filters: IFilters) {
    return object({
      name: str,
      alternative_names: strList,
      type: { type: "string", enum: [...GAME_TYPES] },
      status: { type: ["string", "null"], enum: [...GAME_STATUSES, null] },
      summary: nullableStr,
      storyline: nullableStr,
      first_release: nullableStr,
      genres: enumList(filters.genres),
      themes: enumList(filters.themes),
      is_adult: { type: "boolean" },
      modes: enumList(filters.modes),
      player_perspectives: enumList(filters.player_perspectives),
      game_engines: strList,
      languages: strList,
      keywords: strList,
      franchises: strList,
      companies: {
        type: "array",
        items: object({
          name: str,
          developer: { type: "boolean" },
          publisher: { type: "boolean" },
          porting: { type: "boolean" },
          supporting: { type: "boolean" },
        }),
      },
      platforms: enumList(platformSlugs),
      release_dates: {
        type: "array",
        items: object({
          date: str,
          platform: { type: "string", enum: platformSlugs },
        }),
      },
      cover: nullableStr,
      screenshots: strList,
      artworks: strList,
      videos: strList,
      websites: strList,
      externalPages: {
        type: "array",
        items: object({ name: str, uid: str, url: str }),
      },
    });
  }

  private async toGame(
    draft: IDraft,
    platforms: { _id: unknown; slug: string }[],
    filters: IFilters
  ): Promise<Partial<IAddGameRequest>> {
    const platformId = new Map(
      platforms.map(({ _id, slug }) => [slug, String(_id)])
    );
    const canonical = (known: string[]) => {
      const byLower = new Map(
        known.map((value) => [value.toLowerCase(), value])
      );

      return (value: string) => byLower.get(value.toLowerCase()) ?? value;
    };
    const toKnown = (values: string[], known: string[]) => {
      const byLower = new Map(
        known.map((value) => [value.toLowerCase(), value])
      );

      return [
        ...new Set(
          values
            .map((value) => byLower.get(value.toLowerCase()))
            .filter(Boolean)
        ),
      ];
    };
    const companyName = canonical(filters.companies);
    const firstRelease = toReleaseDate(draft.first_release);

    return {
      name: draft.name,
      slug: await uniqueSlug((slug) => this.Games.exists({ slug }), draft.name),
      alternative_names: draft.alternative_names,
      type: draft.type as IAddGameRequest["type"],
      status: draft.status as IAddGameRequest["status"],
      summary: draft.summary ?? undefined,
      storyline: draft.storyline ?? undefined,
      first_release: firstRelease?.date ?? null,
      genres: draft.genres,
      themes: draft.is_adult
        ? [...new Set([...draft.themes, ADULT_THEME_NAME])]
        : draft.themes,
      modes: draft.modes,
      player_perspectives: draft.player_perspectives,
      game_engines: toKnown(draft.game_engines, filters.game_engines),
      languages: toKnown(draft.languages, filters.languages),
      keywords: draft.is_adult
        ? [...new Set([...draft.keywords, ADULT_KEYWORD])]
        : draft.keywords,
      franchises: draft.franchises,
      companies: draft.companies.map((company) => ({
        ...company,
        name: companyName(company.name),
      })),
      platformIds: [
        ...new Set(
          draft.platforms.map((slug) => platformId.get(slug)).filter(Boolean)
        ),
      ],
      release_dates: draft.release_dates.flatMap(({ date, platform }) => {
        const releaseDate = toReleaseDate(date);
        const id = platformId.get(platform);

        return releaseDate && id
          ? [{ ...releaseDate, platformId: id, region: VNDB_WORLDWIDE_REGION }]
          : [];
      }),
      cover: (await this.keepImages([draft.cover]))[0] ?? null,
      screenshots: await this.keepImages(draft.screenshots.slice(0, 10)),
      artworks: await this.keepImages(draft.artworks.slice(0, 5)),
      videos: draft.videos,
      websites: draft.websites,
      externalPages: draft.externalPages,
    };
  }
}
