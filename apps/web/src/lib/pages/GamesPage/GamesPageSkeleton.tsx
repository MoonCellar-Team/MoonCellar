"use client";

import { FC } from "react";
import { takeGames } from "@/src/lib/shared/constants/games.const";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { Box } from "@/src/lib/shared/ui/Box";
import { PageCrumbsSkeleton } from "@/src/lib/shared/ui/PageSkeleton";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import { GamesCards } from "@/src/lib/widgets/game/GamesCards";
import styles from "./GamesPage.module.scss";

const APPLIED_FILTER_WIDTHS = [
  "calc(var(--padding-x25) + var(--padding-x2))",
  "calc(var(--padding-x25) + var(--padding-x9))",
];

interface IGamesPageSkeletonProps {
  isFiltered?: boolean;
}

export const GamesPageSkeleton: FC<IGamesPageSkeletonProps> = ({
  isFiltered,
}) => (
  <>
    <BGImage />
    <Box
      contentStyle={{
        minHeight: "var(--page-height-available)",
        position: "relative",
      }}
    >
      <div className={styles.page}>
        <PageCrumbsSkeleton />
        <SectionTitle as="h1">
          <Skeleton shape="text" width="var(--page-skeleton-title-width)" />
        </SectionTitle>
        {isFiltered && (
          <div className={styles.page__chips}>
            {APPLIED_FILTER_WIDTHS.map((width) => (
              <Skeleton
                key={width}
                width={width}
                height="var(--padding-x5)"
                radius="var(--radius-x4)"
              />
            ))}
          </div>
        )}
        <GamesCards
          isLoading
          skeletonCount={takeGames}
          columns={6}
          isWithoutScroll
        />
      </div>
    </Box>
  </>
);
