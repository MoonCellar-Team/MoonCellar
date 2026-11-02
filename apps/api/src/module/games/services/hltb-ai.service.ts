import { Injectable, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { IConflictAiVerdict } from "@mooncellar/schemas";
import { HowLongToBeatService } from "howlongtobeat-ts";
import { Model } from "mongoose";
import { generateJson } from "../../../shared/ai";
import { openAiModel } from "../../../shared/openai";
import {
  ConflictsAiService,
  type TUndecidedConflict,
} from "../../conflicts/services/conflicts-ai.service";
import {
  conflictAiSchema,
  noMatchVerdict,
  toConflictAiVerdict,
} from "../../conflicts/utils/conflicts-ai.utils";
import { Game, type GameDocument } from "../schemas/game.schema";
import { type HltbSearchEntry, readHltbPage } from "../utils/hltb.utils";
import { buildHltbAiInput, HLTB_AI_INSTRUCTIONS } from "../utils/hltb-ai.utils";

@Injectable()
export class HltbAiService implements OnModuleInit {
  private readonly hltbClient = new HowLongToBeatService();

  constructor(
    @InjectModel(Game.name)
    private readonly gamesModel: Model<GameDocument>,
    private readonly conflictsAi: ConflictsAiService
  ) {}

  onModuleInit() {
    this.conflictsAi.register("hltb", {
      judge: (conflict, platformNames) => this.judge(conflict, platformNames),
      canCreate: (conflict) =>
        (conflict.externalData as HltbSearchEntry | null)?.type === "game",
    });
  }

  async judge(
    conflict: TUndecidedConflict,
    platformNames: Map<string, string>
  ): Promise<IConflictAiVerdict> {
    const model = openAiModel();
    const entry = {
      ...(conflict.externalData as HltbSearchEntry),
      id: Number(conflict.externalId),
    };
    const [games, page] = await Promise.all([
      this.gamesModel
        .find({
          _id: { $in: conflict.candidates.map(({ gameId }) => gameId) },
          "hltb.hltbId": { $exists: false },
        })
        .select(
          "name alternative_names type first_release platformIds companies summary"
        )
        .lean(),
      this.hltbClient
        .getById(entry.id)
        .then((response) =>
          response.success && response.data
            ? readHltbPage(
                response.data.raw as unknown as Record<string, unknown>
              )
            : null
        )
        .catch(() => null),
    ]);

    if (!games.length) {
      return noMatchVerdict(
        "Every candidate is already linked to an HLTB entry.",
        model
      );
    }

    const gameIds = games.map(({ _id }) => String(_id));
    const answer = await generateJson({
      instructions: HLTB_AI_INSTRUCTIONS,
      input: buildHltbAiInput({ entry, page, games, platformNames }),
      name: "hltb_match",
      schema: conflictAiSchema(gameIds),
    });

    return toConflictAiVerdict(answer.text, gameIds, answer.model);
  }
}
