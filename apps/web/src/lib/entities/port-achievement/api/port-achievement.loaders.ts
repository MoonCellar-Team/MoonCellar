import type { IGameDefinitionInfo } from "@mooncellar/schemas";
import { portAchievementsApi } from "@/src/lib/shared/api";
import { IPortGameAchievements } from "../model/port-achievement.type";

// The achievements of the port whose page on the site is `siteGame`, for the game page's server
// render; undefined when no port has that page or it has no achievements
export const getPortGameAchievements = async (
  siteGame: string
): Promise<IPortGameAchievements | undefined> => {
  const { data: games } = await portAchievementsApi.getGames();
  const game = games.find(
    (item) => item.siteGame === siteGame && item.achievements > 0
  );

  if (!game) return undefined;

  const { data } = await portAchievementsApi.getAchievements(game.slug);

  return { ...data, port: game };
};

export const getSitePort = async (
  siteGame: string
): Promise<IGameDefinitionInfo | undefined> => {
  const { data: games } = await portAchievementsApi.getGames();

  return games.find((item) => item.siteGame === siteGame);
};
