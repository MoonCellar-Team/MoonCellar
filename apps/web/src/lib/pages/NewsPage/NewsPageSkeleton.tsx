"use client";

import { FC } from "react";
import { ArticleRowSkeleton } from "@/src/lib/entities/article/ui/ArticleRow";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { Box } from "@/src/lib/shared/ui/Box";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import styles from "./NewsPage.module.scss";

const SKELETON_ROWS = 4;
const ARCHIVE_ROWS = 6;

const TAB_WIDTHS = [
  "var(--padding-x18)",
  "calc(var(--padding-x25) + var(--padding-x3))",
  "calc(var(--padding-x25) + var(--padding-x4))",
];

export const NewsPageSkeleton: FC = () => (
  <>
    <BGImage />
    <div className={styles.page} role="status" aria-label="Loading">
      <Box
        className={styles.page__head}
        contentStyle={{ gap: "var(--gap-x4)" }}
      >
        <div className={styles.page__crumbs}>
          <Skeleton shape="text" width="var(--page-skeleton-crumbs-width)" />
        </div>
        <SectionTitle as="h1">
          <Skeleton shape="text" width="var(--page-skeleton-title-width)" />
        </SectionTitle>
        <div className={styles.page__tabs}>
          {TAB_WIDTHS.map((width) => (
            <Skeleton
              key={width}
              width={width}
              height="var(--padding-x8)"
              radius="var(--radius-x3)"
            />
          ))}
        </div>
        <div className={styles.page__compactFilters}>
          <Skeleton
            height="var(--padding-x16)"
            radius="var(--radius-control)"
          />
          <Skeleton
            height="var(--padding-x16)"
            radius="var(--radius-control)"
          />
        </div>
      </Box>

      <Box
        className={styles.page__list}
        contentStyle={{ gap: "var(--gap-x4)" }}
      >
        <ul className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index}>
              <ArticleRowSkeleton />
            </li>
          ))}
        </ul>
      </Box>

      <aside className={styles.page__side}>
        <Box
          title={<Skeleton shape="text" width="var(--padding-x14)" />}
          isTitleStart
          contentStyle={{ gap: "var(--gap-x4)" }}
        >
          <Skeleton
            height="var(--padding-x7)"
            count={ARCHIVE_ROWS}
            gap="var(--gap-x05)"
          />
          <div className={styles.page__gameFilter}>
            <div className={styles.page__field}>
              <Skeleton shape="text" width="var(--padding-x16)" />
              <Skeleton
                height="var(--field-control-height)"
                radius="var(--radius-control)"
              />
            </div>
          </div>
        </Box>
      </aside>
    </div>
  </>
);
