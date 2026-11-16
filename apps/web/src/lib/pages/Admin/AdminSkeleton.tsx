"use client";

import { CSSProperties, FC, ReactNode } from "react";
import classNames from "classnames";
import { Box } from "@/src/lib/shared/ui/Box";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import { ADMIN_TABS, TAdminTab } from "@/src/lib/shared/utils/admin-url.utils";
import styles from "./Admin.module.scss";

const COUNTED_TABS: TAdminTab[] = [
  "games",
  "comments",
  "conflicts",
  "characters",
];
const SKELETON_ROWS = 8;
const SKELETON_CARDS = 3;
const CONTROL_HEIGHT = "var(--padding-x9)";
const BUTTON_WIDTH = "calc(var(--padding-x18) + var(--padding-x5))";

const TabsRow: FC = () => (
  <>
    <div className={styles.skeletonTabs}>
      {ADMIN_TABS.map((tab) => (
        <span key={tab} className={styles.skeletonTabs__item}>
          <Skeleton height="var(--padding-x8)" radius="var(--radius-x1)" />
          {COUNTED_TABS.includes(tab) && (
            <Skeleton
              shape="circle"
              width="var(--padding-x2)"
              height="var(--padding-x2)"
            />
          )}
        </span>
      ))}
    </div>
    <div className={styles.skeletonTabs__menu}>
      <Skeleton height="var(--padding-x8)" radius="var(--radius-button)" />
    </div>
  </>
);

const Segmented: FC<{ count: number; isFit?: boolean }> = ({
  count,
  isFit,
}) => (
  <div
    className={classNames(styles.skeletonSegmented, {
      [styles.skeletonSegmented_fit]: isFit,
    })}
  >
    {Array.from({ length: count }, (_, index) => (
      <Skeleton key={index} className={styles.skeletonSegmented__pill} />
    ))}
  </div>
);

const Search: FC<{ className?: string }> = ({ className }) => (
  <Skeleton
    className={classNames(styles.skeletonField, className)}
    height={CONTROL_HEIGHT}
    radius="var(--radius-control)"
  />
);

const ButtonBar: FC<{ width?: string }> = ({ width = BUTTON_WIDTH }) => (
  <Skeleton
    width={width}
    height="var(--padding-x8)"
    radius="var(--radius-button)"
  />
);

const Pagination: FC = () => (
  <div className={styles.skeletonPagination}>
    {Array.from({ length: 6 }, (_, index) => (
      <Skeleton
        key={index}
        shape="circle"
        width="var(--padding-x8)"
        height="var(--padding-x8)"
      />
    ))}
  </div>
);

const Card: FC = () => (
  <div className={styles.skeletonCard}>
    <Skeleton shape="text" width="40%" />
    <div className={styles.skeletonCard__body}>
      <Skeleton shape="text" width="var(--padding-x25)" />
      <Skeleton shape="text" count={3} gap="var(--gap-x05)" />
    </div>
  </div>
);

interface ITableSkeletonProps {
  columns: string[];
  rowHeight?: string;
}

const Table: FC<ITableSkeletonProps> = ({
  columns,
  rowHeight = "var(--padding-x10)",
}) => (
  <div
    className={styles.skeletonTable}
    style={
      {
        "--admin-skeleton-columns": columns.join(" "),
        "--admin-skeleton-row": rowHeight,
      } as CSSProperties
    }
  >
    <div className={styles.skeletonTable__head}>
      {columns.map((column, index) => (
        <Skeleton
          key={index}
          className={styles.skeletonTable__cell}
          radius="var(--radius-x1)"
        />
      ))}
    </div>
    <div className={styles.skeletonTable__rows}>
      {Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
        <div key={rowIndex} className={styles.skeletonTable__row}>
          {columns.map((column, index) => (
            <Skeleton
              key={index}
              className={styles.skeletonTable__cell}
              radius="var(--radius-x1)"
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const TAB_BODIES: Record<TAdminTab, ReactNode> = {
  users: (
    <Table
      columns={["1fr", "1fr", "1fr", "1fr", "1fr"]}
      rowHeight="var(--padding-x14)"
    />
  ),

  games: (
    <div className={styles.skeletonSection}>
      <Segmented count={2} />
      <div>
        <div
          className={classNames(
            styles.skeletonToolbar,
            styles.skeletonToolbar_spaced
          )}
        >
          <Search />
          <ButtonBar />
        </div>
        <Table
          columns={[
            "100px",
            "minmax(160px, 250px)",
            "1fr",
            "1fr",
            "1fr",
            "90px",
          ]}
          rowHeight="var(--padding-x18)"
        />
        <Pagination />
      </div>
    </div>
  ),

  comments: (
    <div className={styles.skeletonSection}>
      <Segmented count={2} />
      <div
        className={classNames(
          styles.skeletonSection,
          styles.skeletonSection_padded
        )}
      >
        <div
          className={classNames(
            styles.skeletonToolbar,
            styles.skeletonToolbar_between
          )}
        >
          <Segmented count={4} isFit />
          <Skeleton shape="text" width="var(--padding-x16)" />
        </div>
        <div className={styles.skeletonCards}>
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <Card key={index} />
          ))}
        </div>
        <Pagination />
      </div>
    </div>
  ),

  conflicts: (
    <div
      className={classNames(styles.skeletonList, styles.skeletonList_padded)}
    >
      <div className={styles.skeletonToolbar}>
        <Skeleton shape="text" width="40%" />
        <ButtonBar />
      </div>
      <Segmented count={6} isFit />
      <div className={styles.skeletonToolbar}>
        <Skeleton
          width="var(--padding-x25)"
          height="var(--padding-x8)"
          radius="var(--radius-control)"
        />
        <Skeleton shape="text" width="var(--padding-x18)" />
        <Skeleton
          width="var(--conflicts-ai-limit-width)"
          height="var(--padding-x8)"
          radius="var(--radius-control)"
        />
      </div>
      <div className={styles.skeletonList}>
        <div className={styles.skeletonFilters}>
          <Search className={styles.skeletonFilters__search} />
          <Skeleton
            width="var(--padding-x25)"
            height="var(--padding-x8)"
            radius="var(--radius-control)"
          />
          <Skeleton shape="text" width="var(--padding-x20)" />
          <Skeleton
            width="calc(var(--padding-x25) + var(--padding-x18))"
            height="var(--padding-x8)"
            radius="var(--radius-control)"
          />
        </div>
        <Table columns={["1fr", "1fr", "1fr", "1fr", "1fr"]} />
        <Pagination />
      </div>
    </div>
  ),

  characters: (
    <div className={styles.skeletonSection}>
      <Segmented count={2} />
      <div
        className={classNames(
          styles.skeletonSection,
          styles.skeletonSection_start
        )}
      >
        <div className={styles.skeletonToolbar}>
          <Search className={styles.skeletonToolbar__search} />
          <Segmented count={4} isFit />
          <ButtonBar />
        </div>
        <Table
          columns={[
            "minmax(320px, 1fr)",
            "minmax(100px, 1fr)",
            "minmax(110px, 1fr)",
            "minmax(110px, 1fr)",
            "minmax(130px, 1fr)",
          ]}
          rowHeight="var(--padding-x12)"
        />
        <Pagination />
      </div>
    </div>
  ),

  images: (
    <div
      className={classNames(
        styles.skeletonSection,
        styles.skeletonSection_padded
      )}
    >
      <div className={styles.skeletonForm}>
        <div className={styles.skeletonForm__selects}>
          <Skeleton height={CONTROL_HEIGHT} radius="var(--radius-control)" />
          <Skeleton height={CONTROL_HEIGHT} radius="var(--radius-control)" />
        </div>
        <Skeleton
          className={styles.skeletonForm__prompt}
          radius="var(--radius-control)"
        />
        <div
          className={classNames(
            styles.skeletonToolbar,
            styles.skeletonToolbar_between
          )}
        >
          <Skeleton shape="text" width="calc(var(--padding-x25) * 2)" />
          <ButtonBar />
        </div>
      </div>
      <div className={styles.skeletonEmpty}>
        <Skeleton
          className={styles.skeletonEmpty__image}
          radius="var(--radius-x4)"
        />
        <Skeleton shape="text" width="var(--padding-x25)" />
        <Skeleton
          shape="text"
          width="calc(var(--padding-x25) + var(--padding-x18))"
        />
      </div>
    </div>
  ),

  sites: (
    <div
      className={classNames(
        styles.skeletonSection,
        styles.skeletonSection_padded
      )}
    >
      <div className={styles.skeletonToolbar}>
        <Skeleton shape="text" width="55%" />
        <ButtonBar />
      </div>
      <Table
        columns={[
          "minmax(240px, 1fr)",
          "minmax(120px, 1fr)",
          "minmax(240px, 1fr)",
          "minmax(200px, 1fr)",
          "minmax(130px, 1fr)",
        ]}
      />
    </div>
  ),

  news: (
    <div className={styles.skeletonSection}>
      <div
        className={classNames(
          styles.skeletonToolbar,
          styles.skeletonToolbar_end
        )}
      >
        <ButtonBar />
      </div>
      <Table columns={["40%", "1fr", "1fr", "1fr", "1fr", "1fr", "1fr"]} />
      <Pagination />
    </div>
  ),
};

interface IAdminSkeletonProps {
  tab: TAdminTab;
}

export const AdminSkeleton: FC<IAdminSkeletonProps> = ({ tab }) => (
  <Box>
    <div className={styles.page} role="status" aria-label="Loading">
      <Skeleton shape="text" width="var(--page-skeleton-crumbs-width)" />
      <TabsRow />
      {TAB_BODIES[tab]}
    </div>
  </Box>
);
