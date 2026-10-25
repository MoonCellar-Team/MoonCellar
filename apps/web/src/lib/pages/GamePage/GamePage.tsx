"use client";

import { FC } from "react";
import styles from "./GamePage.module.scss";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import {
  IGameDefinitionInfo,
  IGameResponse,
  IGameStats,
  IRelatedGamesResponse,
  IReviewsResponse,
} from "@mooncellar/schemas";
import { useHideAdult } from "@/src/lib/shared/hooks/useHideAdult";
import { isAdultGame } from "@/src/lib/shared/utils/adult.utils";
import { GameAdminControls } from "@/src/lib/features/game/ui/GameAdminControls";
import { GameHero } from "@/src/lib/widgets/game/GameHero";
import { GameOverview } from "@/src/lib/entities/game/ui/GameOverview";
import { GameScoreColumn } from "@/src/lib/widgets/game/GameScoreColumn";
import { GameLinksPanel } from "@/src/lib/widgets/game/GameLinksPanel";
import { GameFriendsStatus } from "@/src/lib/features/game/ui/GameFriendsStatus";
import { GameMedia } from "@/src/lib/entities/game/ui/GameMedia";
import { GameDetails } from "@/src/lib/entities/game/ui/GameDetails";
import { GameReleaseDates } from "@/src/lib/entities/game/ui/GameReleaseDates";
import { GameMultiplayer } from "@/src/lib/entities/game/ui/GameMultiplayer";
import { GameCharacters } from "@/src/lib/widgets/game/GameCharacters";
import { GameRelated } from "@/src/lib/widgets/game/GameRelated";
import { GameCommunity } from "@/src/lib/widgets/game/GameCommunity";
import { IPortGameAchievements } from "@/src/lib/entities/port-achievement/model";

interface IGamePageProps {
  game: IGameResponse;
  stats?: IGameStats;
  reviews?: IReviewsResponse;
  related?: IRelatedGamesResponse;
  portAchievements?: IPortGameAchievements;
  port?: IGameDefinitionInfo;
}

export const GamePage: FC<IGamePageProps> = ({
  game,
  stats,
  reviews,
  related,
  portAchievements,
  port,
}) => {
  const hideMedia = useHideAdult() && isAdultGame(game);

  return (
    <div className={styles.page}>
      <BGImage game={game} />
      <GameHero game={game} stats={stats} port={port} />
      <div className={styles.page__overview}>
        <div className={styles.page__stack}>
          <GameOverview game={game} />
          <GameLinksPanel game={game} className={styles.page__links} />
        </div>
        <div className={styles.page__stack}>
          <GameScoreColumn game={game} portAchievements={portAchievements} />
          <GameFriendsStatus gameId={game._id} />
        </div>
      </div>
      {!hideMedia && <GameMedia game={game} />}
      {!hideMedia && (
        <GameCharacters characters={game.characters} gameId={game._id} />
      )}
      <GameDetails game={game} />
      <GameRelated related={related} />
      <GameCommunity game={game} initialReviews={reviews} />
      <div className={styles.page__columns}>
        <GameReleaseDates game={game} className={styles.page__column} />
        <GameMultiplayer game={game} className={styles.page__column} />
      </div>
      <GameAdminControls key={game._id} game={game} />
    </div>
  );
};
