import type {
  IConflictAiVerdict,
  IConflictItem,
  IConflictSource,
} from "@mooncellar/schemas";

export const CONFLICTS_AI_CONCURRENCY = 5;

export type TAiConfidence = IConflictAiVerdict["confidence"];

export const CONFLICTS_AI_APPLY_CONFIDENCES: TAiConfidence[] = ["high"];

const SOURCE_NOTES: Record<IConflictSource, string> = {
  vndb: "The entry is a VNDB visual novel. VNDB keeps one entry per visual novel for all its releases, platforms and translations, so a port, a translation or a re-release is the entry, while a fan disc, an append, a sequel or a remake with an entry of its own is not.",
  igdb: "The entry is an IGDB game that is not in the catalogue yet. IGDB keeps an entry per edition, remaster and collection, so a candidate is the entry only when it is that same release, added to the catalogue by hand or from another source. The base game of an edition, or an edition of the base game, is not the entry.",
  steam:
    "The entry is a Steam store app. A catalogue game can carry several Steam apps, so the entry is a candidate when the app sells that game: the game itself, its PC release or re-release, or an edition that only bundles or renames it. A soundtrack, a demo, a playtest, a DLC, a tool or a different game that shares the title is not.",
  ra: 'The entry is a RetroAchievements achievement set for one console. One set can cover several catalogue games when they are the same release on that console under different names, or paired versions named together with "|" (Pokémon HeartGold | SoulSilver). A candidate is the set\'s game when it is that game on that console; a hack, a homebrew, a prototype or a subset is only its own game.',
  hltb: "The entry is a HowLongToBeat entry. HLTB keeps one entry per game for all platforms, so a port, a re-release or an edition that only bundles or renames the same game is the entry.",
};

export const conflictAiInstructions = (
  source: IConflictSource,
  isMultiMatch: boolean
) => `You decide which games of a video game catalogue are the same game as one entry of an external source, so that the entry can be linked to them. You get the entry and the catalogue games an automatic matcher could not decide on; none of them may be the entry.

${SOURCE_NOTES[source]}

A candidate is not the entry when:
- it is a sequel, a prequel, a spin-off or another number in a series;
- it is a DLC, an expansion, an episode or a season of the entry, or the entry is an add-on of it;
- it is a remake or a remaster released on its own, unless the entry clearly is that version;
- it only shares the title: a different developer, an unrelated description or releases decades apart mean a different game.

A candidate marked linkedToAnotherEntry already carries another entry of this source; take it only when the source note allows a game several entries. Release dates can differ by a year or two between sources, and platform lists are often incomplete on both sides. Missing data is not evidence against a match; a contradiction is.

Answer with the ids of the candidates that are the entry, or an empty list when none is.${isMultiMatch ? " Several candidates can be the entry." : " Name at most one candidate."} Set confidence to "high" only when the title, the developer or the description, and the dates agree and nothing contradicts them; "medium" when the match is likely but a key fact is missing; "low" when you are guessing. Write the reason as one sentence that names the deciding facts and the chosen game by its title, never by its id.`;

export const conflictAiSchema = (gameIds: string[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["gameIds", "confidence", "reason"],
  properties: {
    gameIds: { type: "array", items: { type: "string", enum: gameIds } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reason: { type: "string" },
  },
});

export const clip = (text: string | null | undefined, max: number) =>
  text && text.length > max ? `${text.slice(0, max)}…` : text || null;

export const companiesWith = (
  companies: { name: string; developer?: boolean; publisher?: boolean }[] = [],
  role: "developer" | "publisher"
) => companies.filter((company) => company[role]).map(({ name }) => name);

const namesOf = (ids: string[], platformNames: Map<string, string>) =>
  ids.flatMap((id) => {
    const name = platformNames.get(id);

    return name ? [name] : [];
  });

export const buildConflictAiInput = (
  item: IConflictItem,
  platformNames: Map<string, string>
) => {
  const subject = item.subject!;

  return JSON.stringify({
    entry: {
      name: subject.name,
      originalName: subject.originalName || null,
      alternativeNames: subject.alternativeNames,
      released: subject.released,
      platforms: namesOf(subject.platformIds, platformNames),
      developers: subject.developers,
      hours: subject.lengthMinutes
        ? Math.round(subject.lengthMinutes / 6) / 10
        : null,
      description: clip(subject.description, 800),
    },
    candidates: item.candidates.flatMap(
      ({ gameId, name, matchedTitle, game }) =>
        game
          ? [
              {
                id: gameId,
                name,
                matchedTitle,
                alternativeNames: game.alternativeNames,
                type: game.type,
                released: game.firstRelease
                  ? new Date(game.firstRelease * 1000)
                      .toISOString()
                      .slice(0, 10)
                  : null,
                platforms: namesOf(game.platformIds, platformNames),
                developers: companiesWith(game.companies, "developer"),
                publishers: companiesWith(game.companies, "publisher"),
                description: clip(game.summary, 500),
                linkedToAnotherEntry:
                  !!game.linkedExternalId &&
                  game.linkedExternalId !== item.externalId,
              },
            ]
          : []
    ),
  });
};

export const toConflictAiVerdict = (
  text: string,
  gameIds: string[],
  model: string
): IConflictAiVerdict => {
  const answer = JSON.parse(text) as Partial<
    Pick<IConflictAiVerdict, "gameIds" | "confidence" | "reason">
  >;
  const allowed = new Set(gameIds);

  return {
    gameIds: [...new Set(answer.gameIds ?? [])].filter((id) => allowed.has(id)),
    confidence:
      answer.confidence === "high" || answer.confidence === "medium"
        ? answer.confidence
        : "low",
    reason: answer.reason?.trim() || "The AI gave no reason.",
    model,
    judgedAt: new Date().toISOString(),
  };
};

export const noMatchVerdict = (
  reason: string,
  model: string
): IConflictAiVerdict => ({
  gameIds: [],
  confidence: "low",
  reason,
  model,
  judgedAt: new Date().toISOString(),
});

export const isConflictAiNoMatch = (
  verdict: IConflictAiVerdict | null | undefined,
  confidences = CONFLICTS_AI_APPLY_CONFIDENCES
) =>
  !!verdict &&
  !verdict.gameIds.length &&
  !verdict.undoneAt &&
  confidences.includes(verdict.confidence);

export const isConflictAiMatch = (
  verdict: IConflictAiVerdict | null | undefined,
  confidences = CONFLICTS_AI_APPLY_CONFIDENCES
) =>
  !!verdict?.gameIds.length &&
  !verdict.undoneAt &&
  confidences.includes(verdict.confidence);
