import { Metadata } from "next";
import { Suspense } from "react";
import { NewsPage, NewsPageSkeleton } from "@/src/lib/pages/NewsPage";
import { parseNewsQuery } from "@/src/lib/features/news/model/news-query.utils";
import { articlesAPI } from "@/src/lib/shared/api";
import { JsonLd } from "@/src/lib/shared/ui/JsonLd";
import { getBreadcrumbJsonLd } from "@/src/lib/shared/utils/json-ld.utils";

export const metadata: Metadata = {
  title: "News",
  description:
    "MoonCellar site news and articles about the games players track: updates, retrospectives and what the community is playing",
  keywords: ["game news", "video game articles", "MoonCellar news"],
  alternates: {
    canonical: "/news",
  },
};

type ISearchParams = Record<string, string | string[] | undefined>;

const NewsPageIndex = async ({
  searchParams,
}: {
  searchParams: Promise<ISearchParams>;
}) => {
  const query = await searchParams;
  const params = parseNewsQuery({
    get: (key) => {
      const value = query[key];

      return (Array.isArray(value) ? value[0] : value) ?? null;
    },
  });

  const [initialData, initialArchive] = await Promise.all([
    articlesAPI
      .getArticles(params)
      .then(({ data }) => data)
      .catch((error) => {
        console.error("Failed to load news:", error);
        return undefined;
      }),
    articlesAPI
      .getArchive()
      .then(({ data }) => data)
      .catch(() => undefined),
  ]);

  return (
    <>
      <JsonLd
        data={getBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "News", path: "/news" },
        ])}
      />
      <Suspense fallback={<NewsPageSkeleton />}>
        <NewsPage
          initialParams={params}
          initialData={initialData}
          initialArchive={initialArchive}
        />
      </Suspense>
    </>
  );
};

export default NewsPageIndex;
