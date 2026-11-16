"use client";

import { FC } from "react";
import { Box } from "@/src/lib/shared/ui/Box";
import { PageCrumbsSkeleton } from "@/src/lib/shared/ui/PageSkeleton";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import styles from "./GauntletPage.module.scss";

const MODE_WIDTHS = [
  "calc(var(--padding-x25) + var(--padding-x6))",
  "calc(var(--padding-x25) + var(--padding-x2))",
];
const STEP_ROWS = 3;

export const GauntletPageSkeleton: FC = () => (
  <>
    <Box contentStyle={{ gap: "var(--gap-x2)" }}>
      <div className={styles.skeleton}>
        <PageCrumbsSkeleton />
        <div className={styles.skeleton__bar}>
          <SectionTitle as="h1">
            <Skeleton shape="text" width="var(--page-skeleton-title-width)" />
          </SectionTitle>
          <div className={styles.skeleton__modes}>
            {MODE_WIDTHS.map((width) => (
              <Skeleton
                key={width}
                width={width}
                height="var(--padding-x8)"
                radius="var(--radius-x3)"
              />
            ))}
          </div>
          <div className={styles.skeleton__applied}>
            <Skeleton shape="text" width="var(--padding-x14)" />
            <Skeleton shape="text" width="var(--padding-x25)" />
          </div>
        </div>
      </div>
    </Box>
    <div className={styles.page}>
      <div
        className={styles.skeleton__container}
        role="status"
        aria-label="Loading"
      >
        <div className={styles.skeleton__wheel}>
          <Skeleton shape="circle" />
        </div>
        <div className={styles.skeleton__panel}>
          <Box
            wrapperStyle={{ flex: 1, minHeight: 0 }}
            templateStyle={{ height: "100%", minHeight: 0 }}
            contentStyle={{ padding: "var(--padding-x6)" }}
          >
            <div className={styles.skeleton__intro}>
              <Skeleton
                className={styles.skeleton__icon}
                aspectRatio="1"
                radius="var(--radius-x4)"
              />
              <Skeleton width="40%" height="var(--padding-x7)" />
              <Skeleton shape="text" count={2} gap="0" />
              <div className={styles.skeleton__steps}>
                {Array.from({ length: STEP_ROWS }, (_, index) => (
                  <Skeleton
                    key={index}
                    height="calc(var(--padding-x12) + var(--padding-x2))"
                    radius="var(--radius-x4)"
                  />
                ))}
              </div>
            </div>
          </Box>
        </div>
      </div>
    </div>
  </>
);
