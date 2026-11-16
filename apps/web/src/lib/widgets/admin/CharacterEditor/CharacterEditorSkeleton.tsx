"use client";

import { FC, ReactNode } from "react";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import styles from "./CharacterEditor.module.scss";

const FORM_ROWS = 2;
const BUTTON_WIDTH = "calc(var(--padding-x25) + var(--padding-x4))";

const FieldRow: FC<{ children: ReactNode; labelWidth?: string }> = ({
  children,
  labelWidth = "30%",
}) => (
  <div className={styles.editor__skeletonField}>
    <Skeleton shape="text" width={labelWidth} />
    {children}
  </div>
);

const Control: FC = () => (
  <Skeleton
    height="var(--field-control-height)"
    radius="var(--radius-control)"
  />
);

export const CharacterEditorSkeleton: FC = () => (
  <section className={styles.editor} role="status" aria-label="Loading">
    <div className={styles.editor__form}>
      <SectionTitle
        as="h3"
        action={
          <Skeleton
            width={BUTTON_WIDTH}
            height="var(--padding-x8)"
            radius="var(--radius-button)"
          />
        }
      >
        <Skeleton shape="text" width="40%" />
      </SectionTitle>
      <div className={styles.editor__grid}>
        {Array.from({ length: 4 }, (_, index) => (
          <FieldRow key={index} labelWidth="35%">
            <Control />
          </FieldRow>
        ))}
      </div>
      <FieldRow labelWidth="15%">
        <Control />
      </FieldRow>
      <FieldRow labelWidth="35%">
        <Control />
      </FieldRow>
      <FieldRow labelWidth="12%">
        <Control />
      </FieldRow>
      <FieldRow labelWidth="35%">
        <Skeleton
          height="calc(var(--field-control-height) * 2)"
          radius="var(--radius-control)"
        />
      </FieldRow>
      <div className={styles.editor__actions}>
        <Skeleton
          width={BUTTON_WIDTH}
          height="var(--padding-x9)"
          radius="var(--radius-button)"
        />
        <Skeleton
          width={BUTTON_WIDTH}
          height="var(--padding-x9)"
          radius="var(--radius-button)"
        />
      </div>
    </div>
    <div className={styles.editor__portrait}>
      <SectionTitle as="h4">
        <Skeleton shape="text" width="40%" />
      </SectionTitle>
      <Skeleton className={styles.editor__image} />
      {Array.from({ length: FORM_ROWS }, (_, index) => (
        <FieldRow key={index} labelWidth="60%">
          <Control />
        </FieldRow>
      ))}
      <Skeleton
        width={BUTTON_WIDTH}
        height="var(--padding-x9)"
        radius="var(--radius-button)"
      />
    </div>
  </section>
);
