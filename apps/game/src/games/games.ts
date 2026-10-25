import { NotFoundException } from "@nestjs/common";
import type { IGameDefinitionInfo } from "@mooncellar/schemas";
import type { IGameDefinition } from "./game-definition";
import { rooftops } from "./rooftops/rooftops.game";

export const GAMES: readonly IGameDefinition[] = [rooftops];

export const findGame = (slug: string, board?: string): IGameDefinition => {
  const game = GAMES.find((candidate) => candidate.slug === slug);
  if (!game) throw new NotFoundException(`There is no game "${slug}"`);
  if (board !== undefined && !game.board.test(board)) {
    throw new NotFoundException(`${game.name} has no leaderboard "${board}"`);
  }
  return game;
};

export const describeGame = (game: IGameDefinition): IGameDefinitionInfo => ({
  slug: game.slug,
  name: game.name,
  scoreOrder: game.scoreOrder,
  scoreUnit: game.scoreUnit,
  replayRequired: game.replay.required,
  siteGame: game.siteGame ?? null,
  playUrl: game.playUrl ?? null,
  achievements: game.achievements?.list.length ?? 0,
});
