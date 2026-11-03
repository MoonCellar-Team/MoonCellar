"use client";

import { FC, useCallback, useMemo } from "react";
import { hashKey } from "@tanstack/react-query";
import {
  CUSTOM_LISTS_PAGE_SIZE,
  IGetCustomListsRequest,
  IGetCustomListsResponse,
} from "@mooncellar/schemas";
import { useGamesByIdsQuery } from "@/src/lib/entities/game/api/game.queries";
import { useListsQuery } from "@/src/lib/entities/list/api/list.queries";
import { listQueryKeys } from "@/src/lib/entities/list/api/list.query-keys";
import { ListsFilters } from "@/src/lib/features/lists/ui/ListsFilters";
import { LIST_UPDATED_OPTIONS } from "@/src/lib/features/lists/ui/ListsFilters";
import { useAdvancedRouter } from "@/src/lib/shared/hooks/useAdvancedRouter";
import { useMinimumLoading } from "@/src/lib/shared/hooks/useMinimumLoading";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { Button } from "@/src/lib/shared/ui/Button";
import { EmptyState } from "@/src/lib/shared/ui/EmptyState";
import { ExpandMenu } from "@/src/lib/shared/ui/ExpandMenu";
import { ListCard, ListCardSkeleton } from "@/src/lib/shared/ui/ListCard";
import { ListCardsGrid } from "@/src/lib/shared/ui/ListCardsGrid";
import { Pagination } from "@/src/lib/shared/ui/Pagination";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import {
  AppliedFilters,
  IAppliedFilter,
} from "@/src/lib/shared/ui/AppliedFilters";
import {
  getListsGameIds,
  hasListsFilters,
  parseListsQuery,
  pushListsQuery,
} from "@/src/lib/features/lists/model/lists-query.utils";
import styles from "./ListsPage.module.scss";

interface IListsPageProps {
  initialParams?: IGetCustomListsRequest;
  initialData?: IGetCustomListsResponse;
}

export const ListsPage: FC<IListsPageProps> = ({
  initialParams,
  initialData,
}) => {
  const { queryString } = useAdvancedRouter();

  const params = useMemo(
    () => parseListsQuery(new URLSearchParams(queryString)),
    [queryString]
  );

  const seededData = useMemo(() => {
    if (!initialData || !initialParams) return undefined;

    return hashKey(listQueryKeys.catalogue(params)) ===
      hashKey(listQueryKeys.catalogue(initialParams))
      ? initialData
      : undefined;
  }, [params, initialParams, initialData]);

  const { data, isLoading: isListsLoading } = useListsQuery(params, {
    initialData: seededData,
  });
  const isLoading = useMinimumLoading(isListsLoading);

  const gameIds = useMemo(() => getListsGameIds(params), [params]);
  const { data: filterGames } = useGamesByIdsQuery(gameIds);

  const changePage = useCallback(
    (page: number) => {
      if (page === params.page) return;

      pushListsQuery({ ...params, page });
    },
    [params]
  );

  const applied = useMemo<IAppliedFilter[]>(() => {
    const base = { ...params, page: 1 };
    const result: IAppliedFilter[] = [];

    if (params.search) {
      result.push({
        key: "search",
        label: `Name: ${params.search}`,
        onRemove: () => pushListsQuery({ ...base, search: undefined }),
      });
    }

    if (params.author) {
      result.push({
        key: "author",
        label: `Author: ${params.author}`,
        onRemove: () => pushListsQuery({ ...base, author: undefined }),
      });
    }

    if (gameIds.length) {
      const names = gameIds.map(
        (id) => filterGames?.find((game) => game._id === id)?.name ?? "…"
      );

      result.push({
        key: "games",
        label: `${params.gamesMode === "all" && gameIds.length > 1 ? "Contains all" : "Contains"}: ${names.join(", ")}`,
        onRemove: () =>
          pushListsQuery({ ...base, games: undefined, gamesMode: undefined }),
      });
    }

    if (params.minGames) {
      result.push({
        key: "minGames",
        label: `From ${params.minGames} games`,
        onRemove: () => pushListsQuery({ ...base, minGames: undefined }),
      });
    }

    if (params.updated) {
      const label = LIST_UPDATED_OPTIONS.find(
        (option) => option.value === params.updated
      )?.label;

      result.push({
        key: "updated",
        label: `Updated: ${label?.toLowerCase() ?? params.updated}`,
        onRemove: () => pushListsQuery({ ...base, updated: undefined }),
      });
    }

    return result;
  }, [params, gameIds, filterGames]);

  const lists = data?.results ?? [];
  const total = data?.total ?? 0;
  const isFiltered = hasListsFilters(params);

  return (
    <>
      <BGImage />
      <ExpandMenu position="left" titleOpen="Filters">
        <ListsFilters />
      </ExpandMenu>
      <Pagination
        take={CUSTOM_LISTS_PAGE_SIZE}
        total={total}
        isFixed
        isDisabled={isLoading}
        page={Number(params.page) || 1}
        onPageChange={changePage}
      />
      <Box
        contentStyle={{
          minHeight: "var(--page-height-available)",
          position: "relative",
          gap: "var(--gap-x4)",
        }}
      >
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Lists", href: "/lists" },
          ]}
        />
        <SectionTitle
          as="h1"
          count={isLoading ? undefined : total}
          action={
            <Button href="/collections" compact>
              Collections
            </Button>
          }
        >
          Lists
        </SectionTitle>
        <AppliedFilters
          filters={applied}
          onClearAll={() =>
            pushListsQuery({
              sortBy: params.sortBy,
              sortOrder: params.sortOrder,
            })
          }
        />
        {isLoading ? (
          <ListCardsGrid isLoading>
            {Array.from({ length: CUSTOM_LISTS_PAGE_SIZE }, (_, index) => (
              <ListCardSkeleton key={index} />
            ))}
          </ListCardsGrid>
        ) : !lists.length ? (
          <EmptyState
            className={styles.page__empty}
            title="No lists found"
            description={
              isFiltered
                ? "Nothing matches all of these filters. Remove one, or clear them all."
                : "Public lists appear here as soon as players publish them."
            }
          />
        ) : (
          <ListCardsGrid>
            {lists.map((list) => (
              <ListCard key={list._id} list={list} query={params.search} />
            ))}
          </ListCardsGrid>
        )}
      </Box>
    </>
  );
};
