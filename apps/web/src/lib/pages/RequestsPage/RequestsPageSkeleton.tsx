"use client";

import { FC, ReactNode } from "react";
import { Box } from "@/src/lib/shared/ui/Box";
import { PageCrumbsSkeleton } from "@/src/lib/shared/ui/PageSkeleton";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import styles from "./RequestsPage.module.scss";

const TAB_WIDTHS = ["var(--padding-x18)", "var(--padding-x25)"];
const REQUEST_ROWS = 3;

const FormGroup: FC<{ children: ReactNode }> = ({ children }) => (
  <div className={styles.skeleton__group}>{children}</div>
);

export const RequestsPageSkeleton: FC = () => (
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

      <div className={styles.skeleton__layout}>
        <div className={styles.skeleton__form}>
          <div className={styles.skeleton__switches}>
            {TAB_WIDTHS.map((width) => (
              <Skeleton
                key={width}
                width={width}
                height="var(--padding-x8)"
                radius="var(--radius-x3)"
              />
            ))}
          </div>
          <FormGroup>
            <Skeleton shape="text" width="30%" />
            <Skeleton
              height="var(--field-control-height)"
              radius="var(--radius-control)"
            />
            <div className={styles.skeleton__grid}>
              <Skeleton
                height="var(--field-control-height)"
                radius="var(--radius-control)"
              />
              <Skeleton
                height="var(--field-control-height)"
                radius="var(--radius-control)"
              />
            </div>
          </FormGroup>
          <FormGroup>
            <Skeleton shape="text" width="40%" />
            <Skeleton
              height="calc(var(--field-control-height) * 2)"
              radius="var(--radius-control)"
            />
          </FormGroup>
          <FormGroup>
            <Skeleton
              width="var(--padding-x25)"
              height="var(--padding-x8)"
              radius="var(--radius-button)"
            />
          </FormGroup>
        </div>

        <aside className={styles.skeleton__mine}>
          <SectionTitle as="h3">
            <Skeleton shape="text" width="40%" />
          </SectionTitle>
          {Array.from({ length: REQUEST_ROWS }, (_, index) => (
            <div key={index} className={styles.skeleton__item}>
              <Skeleton shape="text" width="70%" />
              <Skeleton shape="text" width="40%" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  </Box>
);
