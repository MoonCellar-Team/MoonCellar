"use client";

import { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./GameHero.module.scss";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { Badge } from "@/src/lib/shared/ui/Badge";
import { GameCard } from "@/src/lib/widgets/game/GameCard";
import { GameRating } from "@/src/lib/features/game/ui/GameRating";
import { SvgCrown } from "@/src/lib/shared/ui/svg/SvgCrown";
import {
  IGameDefinitionInfo,
  IGameResponse,
  IGameStats,
} from "@mooncellar/schemas";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { GameStatsCounters } from "@/src/lib/entities/game/ui/GameStatsCounters";
import { useRoyalGames } from "@/src/lib/entities/royal/model/useRoyalGames";
import { useHideAdult } from "@/src/lib/shared/hooks/useHideAdult";
import { isAdultGame } from "@/src/lib/shared/utils/adult.utils";
import { toSlug } from "@/src/lib/shared/utils/slug.utils";
import { getGameBanner } from "@/src/lib/shared/utils/game-images.utils";
import { GameFacts } from "@/src/lib/entities/game/ui/GameFacts";

interface IGameHeroProps {
  game: IGameResponse;
  stats?: IGameStats;
  port?: IGameDefinitionInfo;
}

export const GameHero: FC<IGameHeroProps> = ({ game, stats, port }) => {
  const { royalGames } = useRoyalGames();
  const hideMedia = useHideAdult() && isAdultGame(game);

  const artwork = hideMedia ? undefined : getGameBanner(game);

  const isRoyal = !!royalGames?.includes(game._id);

  return (
    <Box
      className={styles.hero}
      templateStyle={{
        overflow: "hidden",
        background: "var(--color-bg-secondary)",
      }}
      contentStyle={{ padding: 0, gap: 0 }}
    >
      <div className={styles.hero__banner}>
        {!!artwork && (
          <Image
            src={artwork}
            alt={`${game.name} artwork`}
            fill
            priority
            sizes="100vw"
            className={styles.hero__artwork}
          />
        )}
        <div className={styles.hero__scrim} />
        <Breadcrumbs
          className={styles.hero__crumbs}
          items={[
            { name: "Games", href: "/games" },
            ...(game.genres?.length
              ? [
                  {
                    name: game.genres[0],
                    href: `/games/genre/${toSlug(game.genres[0])}`,
                  },
                ]
              : []),
            { name: game.name, href: `/games/${game.slug}` },
          ]}
        />
        <div className={styles.hero__actions}>
          {isRoyal && (
            <Badge size="md">
              <SvgCrown size="16" />
              In royal games
            </Badge>
          )}
          <Link
            href={`/requests?kind=game&targetId=${game._id}&targetName=${encodeURIComponent(game.name)}`}
            className={styles.hero__suggest}
            rel="nofollow"
          >
            Suggest an edit
          </Link>
        </div>
      </div>

      <div className={styles.hero__body}>
        <div className={styles.hero__cover}>
          <GameCard game={game} isInfoDisabled />
        </div>

        <div className={styles.hero__main}>
          <div className={styles.hero__title}>
            <h1>{game.name}</h1>
            {!!game.alternative_names?.length && (
              <p className={styles.hero__altNames}>
                {game.alternative_names.join(", ")}
              </p>
            )}
          </div>

          <GameFacts game={game} isCenteredOnMobile />

          <GameRating game={game} />

          {!!port?.playUrl && (
            <Button
              href={port.playUrl}
              target="_blank"
              rel="noopener"
              color={ButtonColor.ACCENT}
              className={styles.hero__play}
            >
              Play {port.name} in the browser
            </Button>
          )}
        </div>

        <GameStatsCounters
          gameId={game._id}
          initialStats={stats}
          className={styles.hero__counters}
        />
      </div>
    </Box>
  );
};
