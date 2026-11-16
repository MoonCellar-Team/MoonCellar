"use client";

import { FC } from "react";
import { Box } from "@/src/lib/shared/ui/Box";
import { PageCrumbsSkeleton } from "@/src/lib/shared/ui/PageSkeleton";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import { ArticleEditorSkeleton } from "@/src/lib/widgets/admin/ArticleEditor";

export const ArticleEditPageSkeleton: FC = () => (
  <Box contentStyle={{ gap: "var(--gap-x5)" }}>
    <PageCrumbsSkeleton />
    <SectionTitle as="h1">
      <Skeleton shape="text" width="var(--page-skeleton-title-width)" />
    </SectionTitle>
    <ArticleEditorSkeleton />
  </Box>
);
