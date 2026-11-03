import { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { articlesAPI, collectionsAPI, gamesApi } from "@/src/lib/shared/api";
import { toSlug } from "@/src/lib/shared/utils/slug.utils";
import { IGetGameSlugsResponse } from "@mooncellar/schemas";
import { FRONT_URL, links } from "@/src/lib/shared/constants";
import {
  INDEXABLE_GAME_SLUGS,
  MIN_GAMES_FOR_INDEX,
  isIndexableGame,
} from "@/src/lib/shared/constants/games.const";

export const dynamic = "force-dynamic";

const getAllGameSlugs = unstable_cache(
  async (): Promise<IGetGameSlugsResponse> => {
    const { data } = await gamesApi.getSlugs();

    return data;
  },
  ["sitemap-game-slugs"],
  { revalidate: 3600 }
);

const getArticleSlugs = unstable_cache(
  async () => {
    const { data } = await articlesAPI.getSlugs();

    return data;
  },
  ["sitemap-article-slugs"],
  { revalidate: 3600 }
);

const getGenreCounts = unstable_cache(
  async () => {
    const { data } = await gamesApi.getTotalGamesByCount();

    return data;
  },
  ["sitemap-genre-counts"],
  { revalidate: 3600 }
);

const getPlatformCounts = unstable_cache(
  async () => {
    const { data } = await gamesApi.getTotalGamesByPlatformCount();

    return data;
  },
  ["sitemap-platform-counts"],
  { revalidate: 3600 }
);

const getCollections = unstable_cache(
  async () => {
    const { data } = await collectionsAPI.getAll();

    return data.results;
  },
  ["sitemap-collections"],
  { revalidate: 3600 }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const gameSlugs = await getAllGameSlugs().catch(() => []);
  const genres = await getGenreCounts().catch(() => []);
  const platformCounts = await getPlatformCounts().catch(() => []);
  const articleSlugs = await getArticleSlugs().catch(() => []);
  const collections = await getCollections().catch(() => []);
  const listedGames = new Set(gameSlugs.map(({ slug }) => slug));
  const unlistedGames = [...INDEXABLE_GAME_SLUGS].filter(
    (slug) => !listedGames.has(slug)
  );

  return [
    ...links.map(({ link }) => ({
      url: `${FRONT_URL}${link}`,
    })),
    ...gameSlugs
      .filter(({ slug }) => isIndexableGame(slug))
      .map(({ slug, updatedAt, cover }) => ({
        url: `${FRONT_URL}/games/${slug}`,
        lastModified: new Date(updatedAt),
        ...(cover && {
          images: [
            `${FRONT_URL}/img/image-proxy?url=${encodeURIComponent(cover)}`,
          ],
        }),
      })),
    ...unlistedGames.map((slug) => ({
      url: `${FRONT_URL}/games/${slug}`,
    })),
    ...genres
      .filter(({ count }) => count >= MIN_GAMES_FOR_INDEX)
      .map(({ genre }) => ({
        url: `${FRONT_URL}/games/genre/${toSlug(genre)}`,
      })),
    ...platformCounts
      .filter(({ count }) => count >= MIN_GAMES_FOR_INDEX)
      .map(({ platform }) => ({
        url: `${FRONT_URL}/games/platform/${platform}`,
      })),
    ...articleSlugs.map(({ slug, updatedAt }) => ({
      url: `${FRONT_URL}/news/${slug}`,
      lastModified: new Date(updatedAt),
    })),
    ...collections.map(({ slug, updatedAt }) => ({
      url: `${FRONT_URL}/collections/${slug}`,
      lastModified: new Date(updatedAt),
    })),
  ];
}
