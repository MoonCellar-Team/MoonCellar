"use client";

import { FC } from "react";
import { Box } from "@/src/lib/shared/ui/Box";
import { PageCrumbsSkeleton } from "@/src/lib/shared/ui/PageSkeleton";
import { CharacterEditorSkeleton } from "@/src/lib/widgets/admin/CharacterEditor";
import styles from "./CharacterEditPage.module.scss";

export const CharacterEditPageSkeleton: FC = () => (
  <Box classNameContent={styles.content}>
    <PageCrumbsSkeleton />
    <CharacterEditorSkeleton />
  </Box>
);
