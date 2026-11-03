"use client";

import { FC } from "react";
import { ICustomListDetails, IGameResponse } from "@mooncellar/schemas";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { Button } from "@/src/lib/shared/ui/Button";
import { EmptyState } from "@/src/lib/shared/ui/EmptyState";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { GamesCards } from "@/src/lib/widgets/game/GamesCards";
import { getCollectionHref } from "@/src/lib/shared/utils/links.utils";
import styles from "./CollectionPage.module.scss";

interface ICollectionPageProps {
  collection: ICustomListDetails;
  games: IGameResponse[];
}

export const CollectionPage: FC<ICollectionPageProps> = ({
  collection,
  games,
}) => {
  const ranks = new Map(
    collection.games.map(({ gameId, position }) => [gameId, position])
  );

  return (
    <>
      <BGImage game={games[0]} />
      <div className={styles.page}>
        <Box contentStyle={{ gap: "var(--gap-x4)" }}>
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "Collections", href: "/collections" },
              {
                name: collection.name,
                href: getCollectionHref(collection.slug),
              },
            ]}
          />
          <SectionTitle as="h1" variant="display">
            {collection.name}
          </SectionTitle>
          <div className={styles.page__stats}>
            <span className={styles.page__stat}>
              <b>{games.length}</b> games
            </span>
          </div>
          {!!collection.description && (
            <p className={styles.page__intro}>{collection.description}</p>
          )}
        </Box>

        <Box contentStyle={{ gap: "var(--gap-x5)", position: "relative" }}>
          {games.length ? (
            <GamesCards
              games={games}
              isWithoutScroll
              getRank={(game) => ranks.get(game._id)}
            />
          ) : (
            <EmptyState
              title="This collection is empty"
              description="MoonCellar rebuilds it every week, so games appear here after the next rebuild."
            />
          )}
          <Button href="/collections" className={styles.page__more}>
            All collections
          </Button>
        </Box>
      </div>
    </>
  );
};
