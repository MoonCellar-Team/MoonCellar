import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { ICustomList } from "@mooncellar/schemas";
import { CollectionsPage } from "@/src/lib/pages/CollectionsPage";
import { collectionsAPI } from "@/src/lib/shared/api";
import { JsonLd } from "@/src/lib/shared/ui/JsonLd";
import { getBreadcrumbJsonLd } from "@/src/lib/shared/utils/json-ld.utils";

export const dynamic = "force-dynamic";

const getCollections = unstable_cache(
  async () => {
    const { data } = await collectionsAPI.getAll();

    return data.results;
  },
  ["collections-hub"],
  { revalidate: 3600 }
);

export const metadata: Metadata = {
  title: "Collections",
  description:
    "MoonCellar's own rankings of the game catalogue: the best games by genre, theme, studio and year, rebuilt every week from our data.",
  keywords: [
    "game collections",
    "best games",
    "best games by genre",
    "best games of all time",
    "game rankings",
    "what to play",
  ],
  alternates: {
    canonical: "/collections",
  },
};

const CollectionsPageIndex = async () => {
  const collections = await getCollections().catch((error: unknown) => {
    console.error("Failed to load collections:", error);

    return [] as ICustomList[];
  });

  return (
    <>
      <JsonLd
        data={getBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Collections", path: "/collections" },
        ])}
      />
      <CollectionsPage collections={collections} />
    </>
  );
};

export default CollectionsPageIndex;
