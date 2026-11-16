"use client";

import { FC } from "react";
import { GAME_SECTIONS } from "@/src/lib/features/game/model/game-edit-sections";
import { Box } from "@/src/lib/shared/ui/Box";
import { PageCrumbsSkeleton } from "@/src/lib/shared/ui/PageSkeleton";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import styles from "./GameEditPage.module.scss";

const ACTION_WIDTHS = [
  "calc(var(--padding-x25) + var(--padding-x4))",
  "calc(var(--padding-x25) + var(--padding-x8))",
  "calc(var(--padding-x25) + var(--padding-x5))",
];

export const GameEditPageSkeleton: FC = () => (
  <Box>
    <div className={styles.content} role="status" aria-label="Loading">
      <PageCrumbsSkeleton />
      <div className={styles.header}>
        <SectionTitle as="h1">
          <Skeleton shape="text" width="var(--page-skeleton-title-width)" />
        </SectionTitle>
        <div className={styles.actions}>
          {ACTION_WIDTHS.map((width) => (
            <Skeleton
              key={width}
              width={width}
              height="var(--padding-x9)"
              radius="var(--radius-button)"
            />
          ))}
        </div>
      </div>
      <div className={styles.form}>
        {GAME_SECTIONS.map((section) => (
          <div key={section.title} className={styles.section}>
            <Skeleton shape="text" width="25%" />
          </div>
        ))}
        <div className={styles.footer}>
          <Skeleton
            width="calc(var(--padding-x25) + var(--padding-x6))"
            height="var(--padding-x9)"
            radius="var(--radius-button)"
          />
        </div>
      </div>
    </div>
  </Box>
);
