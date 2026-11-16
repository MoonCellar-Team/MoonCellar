import { GamesPage, GamesPageSkeleton } from "@/src/lib/pages/GamesPage";
import { gamesApi } from "@/src/lib/shared/api";
import { takeGames } from "@/src/lib/shared/constants/games.const";
import {
  hasGameFilters,
  parseQueryFilters,
} from "@/src/lib/shared/utils/filters.utils";
import { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/src/lib/shared/ui/JsonLd";
import {
  getBreadcrumbJsonLd,
  getItemListJsonLd,
} from "@/src/lib/shared/utils/json-ld.utils";

export const metadata: Metadata = {
  title: "Games",
  description: "Search games with various filters",
  keywords: [
    "game search",
    "games search",
    "game filters",
    "games filters",
    "game list",
    "games list",
    "video games",
  ],
  alternates: {
    canonical: "/games",
  },
};

type ISearchParams = Record<string, string | string[] | undefined>;

const buildQueryString = (searchParams: ISearchParams) => {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined) return;

    (Array.isArray(value) ? value : [value]).forEach((item) =>
      params.append(key, item)
    );
  });

  const query = params.toString();

  return query ? `?${query}` : "";
};

const GamesPageIndex = async ({
  searchParams,
}: {
  searchParams: Promise<ISearchParams>;
}) => {
  const resolvedParams = await searchParams;

  const params = {
    ...parseQueryFilters(buildQueryString(resolvedParams)),
    page: Number(resolvedParams.page) || 1,
    take: takeGames,
  };

  const initialData = await gamesApi
    .getAll(params)
    .then(({ data }) => data)
    .catch((error) => {
      console.error("Failed to load games:", error);
      return undefined;
    });

  return (
    <>
      <JsonLd
        data={getBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Games", path: "/games" },
        ])}
      />
      {!!initialData?.results.length && (
        <JsonLd data={getItemListJsonLd(initialData.results)} />
      )}
      <Suspense
        fallback={<GamesPageSkeleton isFiltered={hasGameFilters(params)} />}
      >
        <GamesPage initialParams={params} initialData={initialData} />
      </Suspense>
    </>
  );
};

export default GamesPageIndex;
