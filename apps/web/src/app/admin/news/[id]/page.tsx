import { Suspense } from "react";
import {
  ArticleEditPage,
  ArticleEditPageSkeleton,
} from "@/src/lib/pages/ArticleEditPage";

const AdminArticleEditPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  return (
    <Suspense fallback={<ArticleEditPageSkeleton />}>
      <ArticleEditPage articleId={id === "new" ? undefined : id} />
    </Suspense>
  );
};

export default AdminArticleEditPage;
