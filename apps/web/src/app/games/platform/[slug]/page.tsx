import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { gamesApi } from "@/src/lib/shared/api";
import { platformsAPI } from "@/src/lib/shared/api/platforms.api";
import {
  MIN_GAMES_FOR_INDEX,
  takeGames,
  takeHubGames,
  takeHubRecentGames,
} from "@/src/lib/shared/constants/games.const";
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
const TOP_COUNT = 5;

const getPlatforms = cache(async () =>
  platformsAPI.getAll().then(({ data }) => data)
);

const getPlatform = cache(async (slug: string) => {
  const platforms = await getPlatforms();

  return platforms.find((platform) => platform.slug === slug) ?? null;
});

const emptyOnError = (error: unknown) => {
  console.error("Failed to load platform hub block:", error);

  return { results: [] as IGameResponse[], total: 0 };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lookup = await getPlatform(slug)
    .then(async (platform) => {
      if (!platform) return null;

      const { data } = await gamesApi.getAll({
        selected: { platforms: [platform._id] },
        take: 1,
        page: 1,
      });

      return { platform, total: data.total };
    })
    .catch((error: unknown) => {
      console.error("Failed to load platform hub metadata:", error);

      return undefined;
    });

  if (lookup === undefined) {
    return { title: "Games" };
  }

  if (!lookup) {
    return { title: "Page not found", robots: { index: false, follow: false } };
  }

  const { platform, total } = lookup;

  const description = `${total.toLocaleString("en-US")} ${platform.name} games on MoonCellar — ratings from IGDB, HowLongToBeat and players, release years and playthrough tracking.`;

  return {
    title: `${platform.name} Games`,
    description,
    alternates: { canonical: `/games/platform/${slug}` },
    ...(total < MIN_GAMES_FOR_INDEX && {
      robots: { index: false, follow: true },
    }),
    openGraph: {
      title: `${platform.name} Games`,
      description,
      siteName: "MoonCellar",
      type: "website",
      locale: "en_US",
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

const PlatformHubPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const platform = await getPlatform(slug);

  if (!platform) {
    notFound();
  }

  const currentYear = new Date().getFullYear();
  const selected = { platforms: [platform._id] };

  const [top, all, recent, platforms] = await Promise.all([
    gamesApi
      .getAll({
        selected: { ...selected, types: ["Main Game"] },
        sortBy: "rating",
        sortOrder: "desc",
        votes: 20,
        take: TOP_COUNT,
        page: 1,
      })
      .then(({ data }) => data)
      .catch(emptyOnError),
    gamesApi
      .getAll({ selected, take: takeHubGames, page: 1 })
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
    getPlatforms(),
  ]);

  const breadcrumb = [
    { name: "Home", href: "/" },
    { name: "Games", href: "/games" },
    { name: platform.name, href: `/games/platform/${slug}` },
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
        title={`${platform.name} Games`}
        intro={`${all.total.toLocaleString("en-US")} ${platform.name} games in the MoonCellar catalogue, synced from IGDB. Every entry carries a playthrough log and a rating combined from IGDB, HowLongToBeat and MoonCellar players.`}
        stats={[
          { value: all.total.toLocaleString("en-US"), label: "games" },
          { value: `${Math.ceil(all.total / takeGames)}`, label: "pages" },
        ]}
        breadcrumb={breadcrumb}
        topGames={top.results}
        topNote="Ranked by combined rating from IGDB, HowLongToBeat and MoonCellar players, limited to titles with enough votes to be meaningful."
        middleTitle="Recent releases"
        middleHint="Main games only — no DLC, editions or unreleased titles. Dates are a game's first release anywhere, not its release on this platform."
        recentGames={recent.results}
        allGames={all.results}
        allTitle="All games on the platform"
        total={all.total}
        moreHref={`/games?selectedPlatforms[]=${platform._id}`}
        linkSections={[
          {
            label: "Platforms",
            items: platforms
              .slice(0, 24)
              .map(({ name, slug: platformSlug }) => ({
                name,
                href: `/games/platform/${platformSlug}`,
                isActive: platformSlug === slug,
              })),
          },
        ]}
      />
    </>
  );
};

export default PlatformHubPage;
