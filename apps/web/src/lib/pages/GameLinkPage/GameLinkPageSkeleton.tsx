"use client";

import { FC } from "react";
import { Box } from "@/src/lib/shared/ui/Box";
import { PageCrumbsSkeleton } from "@/src/lib/shared/ui/PageSkeleton";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import styles from "./GameLinkPage.module.scss";

export const GameLinkPageSkeleton: FC = () => (
  <Box classNameContent={styles.page}>
    <div className={styles.skeleton} role="status" aria-label="Loading">
      <PageCrumbsSkeleton />
      <header className={styles.head}>
        <SectionTitle as="h1">
          <Skeleton shape="text" width="var(--page-skeleton-title-width)" />
        </SectionTitle>
        <p className={styles.lede}>
          <Skeleton shape="text" count={2} gap="0" />
        </p>
      </header>
      <div className={styles.skeleton__form}>
        <div className={styles.skeleton__field}>
          <Skeleton
            shape="text"
            width="calc(var(--padding-x25) + var(--padding-x4))"
          />
          <Skeleton
            height="var(--field-control-height)"
            radius="var(--radius-control)"
          />
        </div>
        <Skeleton
          width="calc(var(--padding-x25) + var(--padding-x8))"
          height="var(--padding-x8)"
          radius="var(--radius-button)"
        />
      </div>
    </div>
  </Box>
);
