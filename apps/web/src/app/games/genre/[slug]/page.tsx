import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { gamesApi } from "@/src/lib/shared/api";
import {
  MIN_GAMES_FOR_INDEX,
  takeGames,
  takeHubGames,
  takeHubRecentGames,
} from "@/src/lib/shared/constants/games.const";
import { toSlug } from "@/src/lib/shared/utils/slug.utils";
import { HubPage } from "@/src/lib/pages/HubPage";
import { JsonLd } from "@/src/lib/shared/ui/JsonLd";
import {
  getBreadcrumbJsonLd,
  getItemListJsonLd,
} from "@/src/lib/shared/utils/json-ld.utils";
import { IGameResponse } from "@mooncellar/schemas";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

const DEFAULT_OG_IMAGE = "/images/og-default.png";
const LARGE_GENRE_SIZE = 5000;
const TOP_COUNT = 5;

const getGenres = cache(async () =>
  gamesApi.getTotalGamesByCount().then(({ data }) => data)
);

const getGenre = cache(async (slug: string) => {
  const genres = await getGenres();

  return genres.find(({ genre }) => toSlug(genre) === slug) ?? null;
});

const emptyOnError = (error: unknown) => {
  console.error("Failed to load genre hub block:", error);

  return { results: [] as IGameResponse[], total: 0 };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenre(slug).catch((error: unknown) => {
    console.error("Failed to load genre hub metadata:", error);

    return undefined;
  });

  if (genre === undefined) {
    return { title: "Games" };
  }

  if (!genre) {
    return { title: "Page not found", robots: { index: false, follow: false } };
  }

  const description = `${genre.count.toLocaleString("en-US")} ${genre.genre} games on MoonCellar — ratings from IGDB, HowLongToBeat and players, release dates and playthrough tracking.`;

  return {
    title: `${genre.genre} Games`,
    description,
    alternates: { canonical: `/games/genre/${slug}` },
    ...(genre.count < MIN_GAMES_FOR_INDEX && {
      robots: { index: false, follow: true },
    }),
    openGraph: {
      title: `${genre.genre} Games`,
      description,
      siteName: "MoonCellar",
      type: "website",
      locale: "en_US",
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

const GenreHubPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const genre = await getGenre(slug);

  if (!genre) {
    notFound();
  }

  const currentYear = new Date().getFullYear();
  const votes = genre.count >= LARGE_GENRE_SIZE ? 100 : 20;
  const selected = { genres: [genre.genre] };

  const [top, recent, all, genres] = await Promise.all([
    gamesApi
      .getAll({
        selected: { ...selected, types: ["Main Game"] },
        sortBy: "rating",
        sortOrder: "desc",
        votes,
        take: TOP_COUNT,
        page: 1,
      })
      .then(({ data }) => data)
      .catch(emptyOnError),
    gamesApi
      .getAll({
        selected: { ...selected, types: ["Main Game"] },
        sortBy: "first_release",
        sortOrder: "desc",
        years: [null, currentYear],
        take: takeHubRecentGames,
        page: 1,
      })
      .then(({ data }) => data)
      .catch(emptyOnError),
    gamesApi
      .getAll({ selected, take: takeHubGames, page: 1 })
      .then(({ data }) => data)
      .catch(emptyOnError),
    getGenres(),
  ]);

  const breadcrumb = [
    { name: "Home", href: "/" },
    { name: "Games", href: "/games" },
    { name: genre.genre, href: `/games/genre/${slug}` },
  ];

  return (
    <>
      <JsonLd
        data={getBreadcrumbJsonLd(
          breadcrumb.map(({ name, href }) => ({ name, path: href }))
        )}
      />
      {!!all.results.length && <JsonLd data={getItemListJsonLd(all.results)} />}
      <HubPage
        title={`${genre.genre} Games`}
        intro={`${genre.count.toLocaleString("en-US")} ${genre.genre} games in the MoonCellar catalogue, synced from IGDB. Every entry carries a playthrough log, a rating combined from IGDB, HowLongToBeat and MoonCellar players, and RetroAchievements progress where the platform supports it.`}
        stats={[
          { value: genre.count.toLocaleString("en-US"), label: "games" },
          { value: `${Math.ceil(all.total / takeGames)}`, label: "pages" },
        ]}
        breadcrumb={breadcrumb}
        topGames={top.results}
        topNote="Ranked by combined rating from IGDB, HowLongToBeat and MoonCellar players, limited to titles with enough votes to be meaningful."
        middleTitle="Recent releases"
        middleHint="Main games only — no DLC, editions or unreleased titles."
        recentGames={recent.results}
        allGames={all.results}
        allTitle="All games in the genre"
        total={all.total}
        moreHref={`/games?selectedGenres[]=${encodeURIComponent(genre.genre)}`}
        linkSections={[
          {
            label: "Genres",
            items: genres
              .filter(({ count }) => count >= MIN_GAMES_FOR_INDEX)
              .map(({ genre: name, count }) => ({
                name,
                count,
                href: `/games/genre/${toSlug(name)}`,
                isActive: name === genre.genre,
              })),
          },
        ]}
      />
    </>
  );
};

export default GenreHubPage;
