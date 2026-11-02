import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  ConflictSourceSchema,
  type IConflictAiVerdict,
  type IConflictsAiStatus,
  type IConflictSource,
} from "@mooncellar/schemas";
import { Model } from "mongoose";
import { withDbLock } from "../../../shared/cron-mutex";
import { assertAiKey, generateJson } from "../../../shared/ai";
import { openAiModel } from "../../../shared/openai";
import { parsePartialDate } from "../../../shared/release-date";
import { GameMatcherService } from "../../games/matching/game-matcher.service";
import { Game, type GameDocument } from "../../games/schemas/game.schema";
import {
  Platform,
  type PlatformDocument,
} from "../../games/schemas/platform.schema";
import type { User } from "../../user/schemas/user.schema";
import {
  buildConflictAiInput,
  CONFLICTS_AI_APPLY_CONFIDENCES,
  CONFLICTS_AI_CONCURRENCY,
  conflictAiInstructions,
  conflictAiSchema,
  isConflictAiMatch,
  isConflictAiNoMatch,
  type TAiConfidence,
  noMatchVerdict,
  toConflictAiVerdict,
} from "../utils/conflicts-ai.utils";
import { ConflictsService } from "./conflicts.service";

type TReviewOptions = {
  limit: number;
  apply: boolean;
  confidences?: TAiConfidence[];
};
type TReviewer = Pick<User, "_id" | "userName">;

export type TUndecidedConflict = Awaited<
  ReturnType<ConflictsService["findUndecided"]>
>[number];

export type TConflictJudge = (
  conflict: TUndecidedConflict,
  platformNames: Map<string, string>
) => Promise<IConflictAiVerdict>;

type TPlan = {
  source: IConflictSource;
  stored: TUndecidedConflict[];
  queue: TUndecidedConflict[];
  confidences: TAiConfidence[];
};

const IDLE_STATUS: IConflictsAiStatus = {
  isRunning: false,
  action: null,
  source: null,
  total: 0,
  done: 0,
  judged: 0,
  matches: 0,
  decided: 0,
  undone: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
};

const errorMessage = (err: unknown) => (err as Error)?.message ?? String(err);

const verdictOf = (conflict: TUndecidedConflict) =>
  conflict.externalData?.aiVerdict as IConflictAiVerdict | undefined;

@Injectable()
export class ConflictsAiService {
  private readonly logger = new Logger(ConflictsAiService.name);
  private readonly judges = new Map<IConflictSource, TConflictJudge>();
  private readonly createFilters = new Map<
    IConflictSource,
    (conflict: TUndecidedConflict) => boolean
  >();
  private status: IConflictsAiStatus = { ...IDLE_STATUS };

  constructor(
    @InjectModel(Game.name) private readonly gamesModel: Model<GameDocument>,
    @InjectModel(Platform.name)
    private readonly platformsModel: Model<PlatformDocument>,
    private readonly conflicts: ConflictsService,
    private readonly matcher: GameMatcherService
  ) {}

  register(
    source: IConflictSource,
    {
      judge,
      canCreate,
    }: {
      judge?: TConflictJudge;
      canCreate?: (conflict: TUndecidedConflict) => boolean;
    }
  ) {
    if (judge) this.judges.set(source, judge);
    if (canCreate) this.createFilters.set(source, canCreate);
  }

  getStatus(): IConflictsAiStatus {
    return this.status;
  }

  start(
    source: IConflictSource | undefined,
    options: TReviewOptions,
    user: TReviewer
  ) {
    assertAiKey();

    const sources = source ? [source] : ConflictSourceSchema.options;
    const scope = source ? `${source} conflicts` : "conflicts of each source";

    this.runInBackground(
      { action: options.limit ? "review" : "apply", source: source ?? null },
      async () => {
        const plans: TPlan[] = [];

        for (const next of sources) plans.push(await this.plan(next, options));
        this.status.total = plans.reduce(
          (sum, { stored, queue }) => sum + stored.length + queue.length,
          0
        );

        for (const plan of plans) await this.execute(plan, options.apply, user);
      }
    );

    return {
      message: options.limit
        ? `AI review of ${options.limit} ${scope} started${options.apply ? ", applying confident matches" : ", dry run"}`
        : `Applying the ${(options.confidences ?? CONFLICTS_AI_APPLY_CONFIDENCES).join(" and ")}-confidence AI matches of ${source ?? "every source"}`,
    };
  }

  getMatches(source: IConflictSource | undefined) {
    return this.conflicts.getAiMatches(
      source ? [source] : ConflictSourceSchema.options
    );
  }

  startUndo(
    source: IConflictSource | undefined,
    user: TReviewer,
    items?: { source: IConflictSource; externalId: string }[]
  ) {
    const sources = source ? [source] : ConflictSourceSchema.options;

    this.runInBackground(
      { action: "undo", source: source ?? null },
      async () => {
        const plans: { source: IConflictSource; externalIds: string[] }[] = [];

        for (const next of sources) {
          const resolved = await this.conflicts.findAiResolvedIds(next);
          const picked = items
            ? new Set(
                items
                  .filter((item) => item.source === next)
                  .map(({ externalId }) => externalId)
              )
            : null;

          plans.push({
            source: next,
            externalIds: picked
              ? resolved.filter((externalId) => picked.has(externalId))
              : resolved,
          });
        }
        this.status.total = plans.reduce(
          (sum, { externalIds }) => sum + externalIds.length,
          0
        );

        for (const plan of plans) {
          await this.undoIds(plan.source, plan.externalIds, user);
        }
      }
    );

    return {
      message: items
        ? `Undoing ${items.length} AI ${items.length === 1 ? "match" : "matches"}`
        : `Undoing every ${source ? `${source} ` : ""}match the AI made`,
    };
  }

  startCreate(
    source: IConflictSource | undefined,
    user: TReviewer,
    confidences = CONFLICTS_AI_APPLY_CONFIDENCES
  ) {
    const sources = source ? [source] : ConflictSourceSchema.options;

    this.runInBackground(
      { action: "create", source: source ?? null },
      async () => {
        const plans: {
          source: IConflictSource;
          conflicts: TUndecidedConflict[];
        }[] = [];

        for (const next of sources) {
          const canCreate = this.createFilters.get(next) ?? (() => true);
          const undecided = await this.conflicts.findUndecided(next, {
            limit: 0,
          });

          plans.push({
            source: next,
            conflicts: undecided.filter(
              (conflict) =>
                isConflictAiNoMatch(verdictOf(conflict), confidences) &&
                canCreate(conflict)
            ),
          });
        }
        this.status.total = plans.reduce(
          (sum, { conflicts }) => sum + conflicts.length,
          0
        );

        for (const plan of plans) await this.createGames(plan, user);
      }
    );

    return {
      message: `Adding games for the ${confidences.join(" and ")}-confidence no-match verdicts of ${source ?? sources.join(", ")}`,
    };
  }

  private async createGames(
    {
      source,
      conflicts,
    }: { source: IConflictSource; conflicts: TUndecidedConflict[] },
    user: TReviewer
  ) {
    const status = this.status;

    for (const { externalId } of conflicts) {
      await this.findDuplicates(source, externalId)
        .then(async (duplicates) => {
          if (duplicates.length) {
            this.logger.warn(
              `${source} AI left ${externalId} for review, the catalogue may already have it: ${duplicates.map(({ name }) => name).join(", ")}`
            );
            return;
          }

          await this.conflicts.decide(
            source,
            externalId,
            { gameId: null },
            user,
            { isAi: true }
          );
          status.decided += 1;
        })
        .catch((err) =>
          this.logger.warn(
            `${source} AI could not skip ${externalId}: ${errorMessage(err)}`
          )
        );
      status.done += 1;
    }

    this.logger.log(
      `${source} AI queued ${status.decided} of ${conflicts.length} entries as new games`
    );
  }

  private async findDuplicates(source: IConflictSource, externalId: string) {
    const subject = (await this.conflicts.getItem(source, externalId))?.subject;

    if (!subject) return [];

    const released = parsePartialDate(subject.released);

    return this.matcher.findLikelyDuplicates({
      name: subject.name,
      alternative_names: subject.alternativeNames,
      first_release: released ? released.getTime() / 1000 : null,
      companies: subject.developers.map((name) => ({
        name,
        developer: true,
        publisher: false,
        porting: false,
        supporting: false,
      })),
      platformIds: subject.platformIds,
      summary: subject.description,
    });
  }

  private runInBackground(
    job: Pick<IConflictsAiStatus, "action" | "source">,
    run: () => Promise<unknown>
  ) {
    if (this.status.isRunning) {
      throw new ConflictException("An AI review is already running");
    }

    const status: IConflictsAiStatus = {
      ...IDLE_STATUS,
      ...job,
      isRunning: true,
      startedAt: new Date().toISOString(),
    };

    this.status = status;
    withDbLock(this.gamesModel.db, "conflicts-ai", run)
      .then((lock) => {
        if (!lock.locked) {
          status.error = "An AI review is running in another process";
        }
      })
      .catch((err) => {
        this.logger.error(`AI job failed: ${errorMessage(err)}`);
        status.error = errorMessage(err);
      })
      .finally(() => {
        status.isRunning = false;
        status.finishedAt = new Date().toISOString();
      });
  }

  async undoAll(source: IConflictSource, user: TReviewer) {
    return this.undoIds(
      source,
      await this.conflicts.findAiResolvedIds(source),
      user
    );
  }

  private async undoIds(
    source: IConflictSource,
    externalIds: string[],
    user: TReviewer
  ) {
    const status = this.status;
    let undone = 0;

    for (const externalId of externalIds) {
      await this.conflicts
        .undo(source, externalId, user)
        .then(() => {
          undone += 1;
          status.undone += 1;
        })
        .catch((err) =>
          this.logger.warn(
            `${source} AI could not undo ${externalId}: ${errorMessage(err)}`
          )
        );
      status.done += 1;
    }

    this.logger.log(
      `${source} AI undo finished: ${undone} of ${externalIds.length} matches undone`
    );

    return undone;
  }

  async review(
    source: IConflictSource,
    options: TReviewOptions,
    user: TReviewer
  ) {
    const plan = await this.plan(source, options);

    this.status.total += plan.stored.length + plan.queue.length;
    await this.execute(plan, options.apply, user);

    const { judged, matches, failed, decided } = this.status;

    return { judged, matches, failed, decided };
  }

  private async plan(
    source: IConflictSource,
    {
      limit,
      apply,
      confidences = CONFLICTS_AI_APPLY_CONFIDENCES,
    }: TReviewOptions
  ): Promise<TPlan> {
    const undecided = await this.conflicts.findUndecided(source, { limit: 0 });

    return {
      source,
      confidences,
      stored: apply
        ? undecided.filter((conflict) =>
            isConflictAiMatch(verdictOf(conflict), confidences)
          )
        : [],
      queue: undecided
        .filter((conflict) => !verdictOf(conflict))
        .slice(0, limit),
    };
  }

  private async execute(
    { source, stored, queue, confidences }: TPlan,
    apply: boolean,
    user: TReviewer
  ) {
    const status = this.status;
    const platformNames = new Map(
      (await this.platformsModel.find({}).select("_id name").lean()).map(
        ({ _id, name }) => [String(_id), name]
      )
    );
    const judge = this.judges.get(source) ?? this.judgeItem(source);
    const decide = async (externalId: string, verdict?: IConflictAiVerdict) => {
      if (!apply || !isConflictAiMatch(verdict, confidences)) return;

      await this.conflicts
        .decide(source, externalId, { gameIds: verdict!.gameIds }, user, {
          isAi: true,
        })
        .then(() => (status.decided += 1))
        .catch((err) =>
          this.logger.warn(
            `${source} AI could not decide ${externalId}: ${errorMessage(err)}`
          )
        );
    };

    this.logger.log(
      `${source} AI review: ${stored.length} stored verdicts to apply, ${queue.length} conflicts to judge`
    );

    for (const conflict of stored) {
      await decide(conflict.externalId, verdictOf(conflict));
      status.done += 1;
    }

    for (let i = 0; i < queue.length; i += CONFLICTS_AI_CONCURRENCY) {
      const batch = queue.slice(i, i + CONFLICTS_AI_CONCURRENCY);
      const verdicts = await Promise.all(
        batch.map((conflict) =>
          judge(conflict, platformNames).catch((err) => {
            this.logger.warn(
              `${source} AI failed on ${conflict.externalId}: ${errorMessage(err)}`
            );
            status.failed += 1;

            return null;
          })
        )
      );

      if (verdicts.every((verdict) => !verdict)) {
        throw new Error(
          `${source} AI review stopped: a whole batch failed (${status.judged} judged, ${status.failed} failed)`
        );
      }

      await this.conflicts.setExternalData(
        source,
        batch.flatMap((conflict, index) => {
          const verdict = verdicts[index];

          return verdict
            ? [
                {
                  externalId: conflict.externalId,
                  externalData: { aiVerdict: verdict },
                },
              ]
            : [];
        })
      );

      for (const [index, verdict] of verdicts.entries()) {
        if (!verdict) continue;

        status.judged += 1;
        if (isConflictAiMatch(verdict, confidences)) status.matches += 1;
        await decide(batch[index].externalId, verdict);
      }

      status.done += batch.length;
    }

    this.logger.log(
      `${source} AI review finished: ${status.judged} judged, ${status.matches} matches, ${status.decided} decided, ${status.failed} failed`
    );
  }

  private judgeItem(source: IConflictSource): TConflictJudge {
    return async (conflict, platformNames) => {
      const model = openAiModel();
      const item = await this.conflicts.getItem(source, conflict.externalId);

      if (!item?.subject) {
        return noMatchVerdict("The source no longer has this entry.", model);
      }

      const gameIds = item.candidates
        .filter(({ game }) => game)
        .map(({ gameId }) => gameId);

      if (!gameIds.length) {
        return noMatchVerdict("No candidate game exists any more.", model);
      }

      const answer = await generateJson({
        instructions: conflictAiInstructions(source, item.isMultiMatch),
        input: buildConflictAiInput(item, platformNames),
        name: "conflict_match",
        schema: conflictAiSchema(gameIds),
      });

      return toConflictAiVerdict(answer.text, gameIds, answer.model);
    };
  }
}
