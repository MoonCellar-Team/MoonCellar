import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ICustomListDetails, IGameResponse } from "@mooncellar/schemas";
import { CollectionPage } from "@/src/lib/pages/CollectionPage";
import { collectionsAPI, gamesApi } from "@/src/lib/shared/api";
import { JsonLd } from "@/src/lib/shared/ui/JsonLd";
import { fetchOrNull } from "@/src/lib/shared/utils/not-found.utils";
import {
  getBreadcrumbJsonLd,
  getItemListJsonLd,
} from "@/src/lib/shared/utils/json-ld.utils";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

const DEFAULT_OG_IMAGE = "/images/og-default.png";
const OG_IMAGE_WIDTH = 200;
const OG_IMAGE_HEIGHT = 266;

const getCollection = cache(async (slug: string) =>
  fetchOrNull(collectionsAPI.getBySlug(encodeURIComponent(slug)))
);

const getGames = async (collection: ICustomListDetails) => {
  const { data } = await gamesApi
    .getByIds({ _ids: collection.games.map(({ gameId }) => gameId) })
    .catch((error: unknown) => {
      console.error("Failed to load collection games:", error);

      return { data: [] as IGameResponse[] };
    });
  const byId = new Map(data.map((game) => [game._id, game]));

  return collection.games.flatMap(({ gameId }) => {
    const game = byId.get(gameId);

    return game ? [game] : [];
  });
};

const getDescription = (collection: ICustomListDetails) =>
  collection.description ||
  `${collection.gamesCount} games ranked by MoonCellar from the combined rating of IGDB, HowLongToBeat and MoonCellar players.`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  let collection: ICustomListDetails | null;

  try {
    collection = await getCollection(slug);
  } catch (error) {
    console.error("Failed to load collection metadata:", error);

    return { title: "Collection" };
  }

  if (!collection) {
    return { title: "Page not found", robots: { index: false, follow: false } };
  }

  const description = getDescription(collection);
  const cover = collection.covers[0];

  return {
    title: collection.name,
    description,
    keywords: [collection.name, "best games", "game ranking", "MoonCellar"],
    alternates: {
      canonical: `/collections/${collection.slug}`,
    },
    openGraph: {
      siteName: "MoonCellar",
      type: "website",
      locale: "en_US",
      title: collection.name,
      description,
      images: [
        {
          url: cover
            ? `/img/image-proxy?url=${encodeURIComponent(cover)}`
            : DEFAULT_OG_IMAGE,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: cover ? collection.name : "MoonCellar — game tracker & database",
        },
      ],
    },
  };
}

const CollectionRoute = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const collection = await getCollection(slug);

  if (!collection) notFound();

  const games = await getGames(collection);
  const path = `/collections/${collection.slug}`;

  return (
    <>
      <JsonLd
        data={getBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Collections", path: "/collections" },
          { name: collection.name, path },
        ])}
      />
      <JsonLd data={getItemListJsonLd(games)} />
      <CollectionPage collection={collection} games={games} />
    </>
  );
};

export default CollectionRoute;
