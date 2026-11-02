"use client";

import { FC, useCallback, useMemo } from "react";
import { hashKey } from "@tanstack/react-query";
import {
  ARTICLES_PAGE_SIZE,
  IArticleArchive,
  IArticleType,
  IGetArticlesQuery,
  IGetArticlesResponse,
} from "@mooncellar/schemas";
import {
  articleQueryKeys,
  useArticleArchiveQuery,
  useArticlesQuery,
} from "@/src/lib/entities/article/api";
import {
  formatArchiveMonth,
  NEWS_HREF,
} from "@/src/lib/entities/article/model";
import {
  ArticleRow,
  ArticleRowSkeleton,
} from "@/src/lib/entities/article/ui/ArticleRow";
import { useGamesByIdsQuery } from "@/src/lib/entities/game/api/game.queries";
import {
  hasNewsFilters,
  parseNewsQuery,
  pushNewsQuery,
} from "@/src/lib/features/news/model/news-query.utils";
import { NewsArchive } from "@/src/lib/features/news/ui/NewsArchive";
import { NewsArchiveSelect } from "@/src/lib/features/news/ui/NewsArchiveSelect";
import { NewsGameFilter } from "@/src/lib/features/news/ui/NewsGameFilter";
import { useAdvancedRouter } from "@/src/lib/shared/hooks/useAdvancedRouter";
import { useIsAuthHydrated } from "@/src/lib/shared/hooks/useIsAuthHydrated";
import { useMinimumLoading } from "@/src/lib/shared/hooks/useMinimumLoading";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import {
  AppliedFilters,
  IAppliedFilter,
} from "@/src/lib/shared/ui/AppliedFilters";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { EmptyState } from "@/src/lib/shared/ui/EmptyState";
import { Pagination } from "@/src/lib/shared/ui/Pagination";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { Tabs } from "@/src/lib/shared/ui/Tabs";
import { SvgPlus } from "@/src/lib/shared/ui/svg";
import styles from "./NewsPage.module.scss";

interface INewsPageProps {
  initialParams?: IGetArticlesQuery;
  initialData?: IGetArticlesResponse;
  initialArchive?: IArticleArchive;
}

const TYPE_TABS: { type?: IArticleType; label: string }[] = [
  { label: "All" },
  { type: "news", label: "Site news" },
  { type: "game", label: "Game articles" },
];

export const NewsPage: FC<INewsPageProps> = ({
  initialParams,
  initialData,
  initialArchive,
}) => {
  const { queryString } = useAdvancedRouter();
  const isAuthHydrated = useIsAuthHydrated();
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const params = useMemo(
    () => parseNewsQuery(new URLSearchParams(queryString)),
    [queryString]
  );

  const seededData = useMemo(() => {
    if (!initialData || !initialParams) return undefined;

    return hashKey(articleQueryKeys.feed(params)) ===
      hashKey(articleQueryKeys.feed(initialParams))
      ? initialData
      : undefined;
  }, [params, initialParams, initialData]);

  const { data, isLoading: isFeedLoading } = useArticlesQuery(
    params,
    seededData
  );
  const isLoading = useMinimumLoading(isFeedLoading);
  const { data: archive } = useArticleArchiveQuery(initialArchive);
  const filterGameIds = useMemo(
    () => (params.game ? [params.game] : []),
    [params.game]
  );
  const { data: filterGames } = useGamesByIdsQuery(filterGameIds);

  const changePage = useCallback(
    (page: number) => {
      if (page === params.page) return;

      pushNewsQuery({ ...params, page });
    },
    [params]
  );

  const applied = useMemo<IAppliedFilter[]>(() => {
    const base = { ...params, page: 1 };
    const result: IAppliedFilter[] = [];

    if (params.year) {
      result.push({
        key: "date",
        label: params.month
          ? `${formatArchiveMonth(params.month)} ${params.year}`
          : String(params.year),
        onRemove: () =>
          pushNewsQuery({ ...base, year: undefined, month: undefined }),
      });
    }

    if (params.game) {
      const name =
        data?.results.find((article) => article.game?._id === params.game)?.game
          ?.name ??
        filterGames?.find((game) => game._id === params.game)?.name ??
        "…";

      result.push({
        key: "game",
        label: `About: ${name}`,
        onRemove: () => pushNewsQuery({ ...base, game: undefined }),
      });
    }

    return result;
  }, [params, data, filterGames]);

  const articles = data?.results ?? [];
  const total = data?.total ?? 0;
  const tabIndex = Math.max(
    TYPE_TABS.findIndex((tab) => tab.type === params.type),
    0
  );

  return (
    <>
      <BGImage />
      <div className={styles.page}>
        <Box
          className={styles.page__head}
          contentStyle={{ gap: "var(--gap-x4)" }}
        >
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "News", href: NEWS_HREF },
            ]}
          />
          <SectionTitle
            as="h1"
            action={
              isAuthHydrated && isAdmin ? (
                <Button href="/admin/news/new" color={ButtonColor.ACCENT}>
                  <SvgPlus size="16" style={{ color: "inherit" }} />
                  Write a post
                </Button>
              ) : undefined
            }
          >
            News
          </SectionTitle>
          <Tabs
            theme="segmented"
            ariaLabel="Show posts"
            isWrap
            defaultTabIndex={tabIndex}
            isUseDefaultIndex
            contents={TYPE_TABS.map((tab) => ({
              tabName: tab.label,
              count: data?.counts[tab.type ?? "all"],
              onTabClick: () =>
                pushNewsQuery({ ...params, type: tab.type, page: 1 }),
            }))}
          />
          <AppliedFilters
            filters={applied}
            onClearAll={() => pushNewsQuery({ type: params.type, page: 1 })}
          />
          {!!archive?.total && (
            <div className={styles.page__compactFilters}>
              <NewsArchiveSelect archive={archive} params={params} />
              <NewsGameFilter params={params} />
            </div>
          )}
        </Box>

        <Box
          className={styles.page__list}
          contentStyle={{ gap: "var(--gap-x4)" }}
        >
          {isLoading ? (
            <ul className={styles.list} role="status" aria-label="Loading">
              {Array.from({ length: 4 }, (_, index) => (
                <li key={index}>
                  <ArticleRowSkeleton />
                </li>
              ))}
            </ul>
          ) : !articles.length ? (
            <EmptyState
              title={hasNewsFilters(params) ? "No posts found" : "No posts yet"}
              description={
                hasNewsFilters(params)
                  ? "Nothing was published for these filters. Remove one, or clear them all."
                  : "Site news and articles about games will appear here."
              }
            />
          ) : (
            <ul className={styles.list}>
              {articles.map((article, index) => (
                <li key={article._id}>
                  <ArticleRow article={article} isPriority={index < 2} />
                </li>
              ))}
            </ul>
          )}
          {total > ARTICLES_PAGE_SIZE && (
            <Pagination
              take={ARTICLES_PAGE_SIZE}
              total={total}
              isDisabled={isLoading}
              page={Number(params.page) || 1}
              onPageChange={changePage}
              isWithoutSummary
            />
          )}
        </Box>

        {!!archive?.total && (
          <aside className={styles.page__side}>
            <Box
              title="Archive"
              isTitleStart
              contentStyle={{ gap: "var(--gap-x4)" }}
            >
              <NewsArchive archive={archive} params={params} />
              <div className={styles.page__gameFilter}>
                <NewsGameFilter params={params} />
              </div>
            </Box>
          </aside>
        )}
      </div>
    </>
  );
};
