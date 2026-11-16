"use client";

import { FC } from "react";
import { CUSTOM_LISTS_PAGE_SIZE } from "@mooncellar/schemas";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { Box } from "@/src/lib/shared/ui/Box";
import { ListCardSkeleton } from "@/src/lib/shared/ui/ListCard";
import { ListCardsGrid } from "@/src/lib/shared/ui/ListCardsGrid";
import { PageCrumbsSkeleton } from "@/src/lib/shared/ui/PageSkeleton";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import styles from "./ListsPage.module.scss";

const APPLIED_FILTER_WIDTHS = [
  "calc(var(--padding-x25) + var(--padding-x3))",
  "calc(var(--padding-x25) + var(--padding-x8))",
];

interface IListsPageSkeletonProps {
  isFiltered?: boolean;
}

export const ListsPageSkeleton: FC<IListsPageSkeletonProps> = ({
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
        <SectionTitle
          as="h1"
          action={
            <Skeleton
              width="var(--padding-x25)"
              height="var(--padding-x6)"
              radius="var(--radius-button)"
            />
          }
        >
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
        <ListCardsGrid isLoading>
          {Array.from({ length: CUSTOM_LISTS_PAGE_SIZE }, (_, index) => (
            <ListCardSkeleton key={index} />
          ))}
        </ListCardsGrid>
      </div>
    </Box>
  </>
);
