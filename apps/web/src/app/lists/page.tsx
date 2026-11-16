import { Metadata } from "next";
import { Suspense } from "react";
import { ListsPage, ListsPageSkeleton } from "@/src/lib/pages/ListsPage";
import {
  hasListsFilters,
  parseListsQuery,
} from "@/src/lib/features/lists/model/lists-query.utils";
import { listsAPI } from "@/src/lib/shared/api";
import { JsonLd } from "@/src/lib/shared/ui/JsonLd";
import { getBreadcrumbJsonLd } from "@/src/lib/shared/utils/json-ld.utils";

export const metadata: Metadata = {
  title: "Lists",
  description:
    "Browse public game lists made by MoonCellar players and filter them by name, author and the games they contain",
  keywords: [
    "game lists",
    "games lists",
    "video game lists",
    "curated game lists",
    "player lists",
  ],
  alternates: {
    canonical: "/lists",
  },
};

type ISearchParams = Record<string, string | string[] | undefined>;

const toSearchParams = (searchParams: ISearchParams) => {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined) return;

    (Array.isArray(value) ? value : [value]).forEach((item) =>
      params.append(key, item)
    );
  });

  return params;
};

const ListsPageIndex = async ({
  searchParams,
}: {
  searchParams: Promise<ISearchParams>;
}) => {
  const params = parseListsQuery(toSearchParams(await searchParams));

  const initialData = await listsAPI
    .getLists(params)
    .then(({ data }) => data)
    .catch((error) => {
      console.error("Failed to load lists:", error);
      return undefined;
    });

  return (
    <>
      <JsonLd
        data={getBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Lists", path: "/lists" },
        ])}
      />
      <Suspense
        fallback={<ListsPageSkeleton isFiltered={hasListsFilters(params)} />}
      >
        <ListsPage initialParams={params} initialData={initialData} />
      </Suspense>
    </>
  );
};

export default ListsPageIndex;
