import { FC } from "react";
import Link from "next/link";
import { IGameCommunity, IGameListsResponse, IGameResponse, IGameStats } from "@mooncellar/schemas";
import { Box } from "@/src/lib/shared/ui/Box";
import { IPortGameAchievements } from "@/src/lib/entities/port-achievement/model";
import { getGameRecordParagraphs } from "@/src/lib/shared/utils/game-record.utils";
import styles from "./GameRecord.module.scss";

interface IGameRecordProps {
  game: IGameResponse;
  stats?: IGameStats;
  community?: IGameCommunity;
  lists?: IGameListsResponse;
  port?: { name: string };
  portAchievements?: IPortGameAchievements;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export const GameRecord: FC<IGameRecordProps> = ({
  game,
  stats,
  community,
  lists = [],
  port,
  portAchievements,
}) => {
  const paragraphs = getGameRecordParagraphs({
    name: game.name,
    rating:
      game.ratingsCount && game.averageRating != null
        ? { average: game.averageRating, count: game.ratingsCount }
        : null,
    stats,
    playtime: community?.playtime,
    achievements: {
      steam: game.steamAchievements?.total,
      retroachievements: game.retroachievements?.length,
    },
    port: port
      ? { name: port.name, achievements: portAchievements?.total ?? 0 }
      : null,
  });

  const alsoPlayed = community?.alsoPlayed ?? [];

  if (!paragraphs.length && !alsoPlayed.length && !lists.length) return null;

  return (
    <Box
      title="MoonCellar record"
      isTitleStart
      contentStyle={{ padding: "var(--padding-x4)" }}
    >
      <div className={styles.record}>
        {paragraphs.map((paragraph) => (
          <p className={styles.record__paragraph} key={paragraph}>
            {paragraph}
          </p>
        ))}

        {!!alsoPlayed.length && (
          <div className={styles.record__block}>
            <h3 className={styles.record__subtitle}>
              The same accounts also tracked
            </h3>
            <ul className={styles.record__list}>
              {alsoPlayed.map((entry) => (
                <li className={styles.record__entry} key={entry._id}>
                  <Link
                    className={styles.record__link}
                    href={`/games/${entry.slug}`}
                  >
                    {entry.name}
                  </Link>
                  <span className={styles.record__meta}>
                    {plural(entry.accounts, "account", "accounts")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!!lists.length && (
          <div className={styles.record__block}>
            <h3 className={styles.record__subtitle}>Lists that include it</h3>
            <ul className={styles.record__list}>
              {lists.map((list) => (
                <li className={styles.record__entry} key={list.slug}>
                  {list.authorName ? (
                    <Link
                      className={styles.record__link}
                      href={`/user/${list.authorName}/lists/${list.slug}`}
                    >
                      {list.name}
                    </Link>
                  ) : (
                    <span className={styles.record__link}>{list.name}</span>
                  )}
                  <span className={styles.record__meta}>
                    {list.isGenerated
                      ? `MoonCellar list, ${plural(list.gamesCount, "game", "games")}`
                      : `${plural(list.gamesCount, "game", "games")}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Box>
  );
};
