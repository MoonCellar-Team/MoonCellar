"use client";

import { FC, ReactNode } from "react";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import styles from "./ArticleEditor.module.scss";

const TAB_WIDTHS = [
  "calc(var(--padding-x25) + var(--padding-x2))",
  "calc(var(--padding-x25) + var(--padding-x9))",
];
const BUTTON_WIDTHS = [
  "calc(var(--padding-x25) + var(--padding-x2))",
  "calc(var(--padding-x25) + var(--padding-x6))",
];

const FieldRow: FC<{ children: ReactNode; labelWidth?: string }> = ({
  children,
  labelWidth = "30%",
}) => (
  <div className={styles.editor__skeletonField}>
    <Skeleton shape="text" width={labelWidth} />
    {children}
  </div>
);

export const ArticleEditorSkeleton: FC = () => (
  <div className={styles.editor} role="status" aria-label="Loading">
    <FieldRow>
      <div className={styles.editor__skeletonTabs}>
        {TAB_WIDTHS.map((width) => (
          <Skeleton
            key={width}
            width={width}
            height="var(--padding-x8)"
            radius="var(--radius-x3)"
          />
        ))}
      </div>
    </FieldRow>
    <FieldRow labelWidth="15%">
      <Skeleton
        height="var(--field-control-height)"
        radius="var(--radius-control)"
      />
    </FieldRow>
    <FieldRow labelWidth="12%">
      <Skeleton
        height="var(--field-control-height)"
        radius="var(--radius-control)"
      />
    </FieldRow>
    <FieldRow labelWidth="35%">
      <Skeleton
        height="calc(var(--field-control-height) * 2)"
        radius="var(--radius-control)"
      />
    </FieldRow>
    <FieldRow labelWidth="12%">
      <div className={styles.editor__image}>
        <div className={styles.editor__imageActions}>
          <Skeleton
            width="calc(var(--padding-x25) + var(--padding-x8))"
            height="var(--padding-x8)"
            radius="var(--radius-button)"
          />
        </div>
        <Skeleton shape="text" width="60%" />
      </div>
    </FieldRow>
    <FieldRow labelWidth="10%">
      <Skeleton
        height="calc(var(--field-control-height) * 4)"
        radius="var(--radius-x2)"
      />
    </FieldRow>
    <footer className={styles.editor__footer}>
      <div className={styles.editor__status}>
        <Skeleton
          width="calc(var(--padding-x25) + var(--padding-x4))"
          height="var(--padding-x5)"
          radius="var(--radius-x4)"
        />
      </div>
      <div className={styles.editor__buttons}>
        {BUTTON_WIDTHS.map((width) => (
          <Skeleton
            key={width}
            width={width}
            height="var(--padding-x9)"
            radius="var(--radius-button)"
          />
        ))}
      </div>
    </footer>
  </div>
);
