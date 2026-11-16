"use client";

import { FC } from "react";
import { notFound } from "next/navigation";
import { useAdminArticleQuery } from "@/src/lib/entities/article/api";
import { ArticleEditor } from "@/src/lib/widgets/admin/ArticleEditor";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { EmptyState } from "@/src/lib/shared/ui/EmptyState";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import {
  ADMIN_HREF,
  getAdminHref,
} from "@/src/lib/shared/utils/admin-url.utils";
import { ArticleEditPageSkeleton } from "./ArticleEditPageSkeleton";

interface IArticleEditPageProps {
  articleId?: string;
}

export const ArticleEditPage: FC<IArticleEditPageProps> = ({ articleId }) => {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked);
  const {
    data: article,
    isLoading,
    isError,
  } = useAdminArticleQuery(isAdmin ? articleId : undefined);

  if (isAuthChecked && !isAdmin) notFound();

  if (!isAdmin || isLoading) return <ArticleEditPageSkeleton />;

  const title = articleId ? "Edit post" : "New post";

  return (
    <Box contentStyle={{ gap: "var(--gap-x5)" }}>
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Admin", href: ADMIN_HREF },
          { name: "News", href: getAdminHref("news") },
          {
            name: article?.title ?? title,
            href: `/admin/news/${articleId ?? "new"}`,
          },
        ]}
      />
      <SectionTitle as="h1">{title}</SectionTitle>
      {articleId && (isError || !article) ? (
        <EmptyState
          title="The post was not found"
          description="It may have been deleted. Go back to the list of posts."
        />
      ) : (
        <ArticleEditor key={article?._id ?? "new"} article={article} />
      )}
    </Box>
  );
};
