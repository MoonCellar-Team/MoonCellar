import { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { jwtDecode } from "jwt-decode";
import {
  CUSTOM_LIST_GAMES_PAGE_SIZE,
  GetCustomListBySlugRequestSchema,
  GetUserByStringSchema,
  ICustomListDetails,
  ICustomListGamesSort,
  ICustomListsOrder,
  IGameResponse,
} from "@mooncellar/schemas";
import {
  LIST_ORDER_PARAM,
  LIST_SORT_PARAM,
  parseListSortQuery,
} from "@/src/lib/features/lists/model/list-sort-query.utils";
import { CustomListPage } from "@/src/lib/pages/CustomListPage";
import {
  agent,
  gamesApi,
  playthroughsAPI,
  userAPI,
} from "@/src/lib/shared/api";
import { ACCESS_TOKEN, API_URL } from "@/src/lib/shared/constants";
import { IAuthToken } from "@/src/lib/shared/types/auth.type";
import {
  getCollectionHref,
  getListHref,
} from "@/src/lib/shared/utils/links.utils";
import { fetchOrNull } from "@/src/lib/shared/utils/not-found.utils";

interface IListRouteProps {
  params: Promise<{ name: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const isValidRequest = (userName: string, slug: string) =>
  GetUserByStringSchema.safeParse({ searchString: userName }).success &&
  GetCustomListBySlugRequestSchema.safeParse({ userName, slug }).success;

const getList = cache(
  async (
    userName: string,
    slug: string,
    cookieHeader: string,
    sortBy?: ICustomListGamesSort,
    sortOrder?: ICustomListsOrder
  ) =>
    isValidRequest(userName, slug)
      ? fetchOrNull(
          agent.get<ICustomListDetails>(`${API_URL}/lists/by-slug`, {
            params: { userName, slug, sortBy, sortOrder },
            headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
          })
        )
      : null
);

const getUser = cache(async (userName: string) =>
  fetchOrNull(userAPI.getByString(userName))
);

const getCookieHeader = async () => (await cookies()).toString();

export async function generateMetadata({
  params,
  searchParams,
}: IListRouteProps): Promise<Metadata> {
  const { name, slug } = await params;
  const query = await searchParams;
  const { sortBy, sortOrder } = parseListSortQuery((key) => query[key]);

  try {
    const list = await getList(
      name,
      slug,
      await getCookieHeader(),
      sortBy,
      sortOrder
    );

    if (!list) {
      return {
        title: "Page not found",
        robots: { index: false, follow: false },
      };
    }

    const author = list.author?.userName ?? name;

    return {
      title: `${list.name} — a list by ${author}`,
      description:
        list.description ||
        `${list.gamesCount} games collected by ${author} on MoonCellar`,
      alternates: { canonical: getListHref(list) },
      ...(list.isPrivate && { robots: { index: false, follow: false } }),
    };
  } catch {
    return { title: "List" };
  }
}

export default async function CustomListRoute({
  params,
  searchParams,
}: IListRouteProps) {
  const { name, slug } = await params;
  const query = await searchParams;
  const { sortBy, sortOrder } = parseListSortQuery((key) => query[key]);
  const cookieStore = await cookies();

  const list = await getList(
    name,
    slug,
    cookieStore.toString(),
    sortBy,
    sortOrder
  );

  if (!list) {
    notFound();
  }

  if (list.isGenerated) {
    permanentRedirect(getCollectionHref(list.slug));
  }

  const page = Math.max(1, Number(query.page) || 1);

  if (list.slug !== slug) {
    const kept = new URLSearchParams(
      Object.entries({
        page: page > 1 ? `${page}` : undefined,
        [LIST_SORT_PARAM]: sortBy,
        [LIST_ORDER_PARAM]: sortOrder,
      }).filter((entry): entry is [string, string] => !!entry[1])
    ).toString();

    permanentRedirect(`${getListHref(list)}${kept ? `?${kept}` : ""}`);
  }

  const user = await getUser(list.author?.userName ?? name);

  if (!user) {
    notFound();
  }

  const accessToken = cookieStore.get(ACCESS_TOKEN)?.value;
  const authUserInfo: IAuthToken | undefined = accessToken
    ? jwtDecode(accessToken)
    : undefined;

  const pageIds = list.games
    .slice(
      (page - 1) * CUSTOM_LIST_GAMES_PAGE_SIZE,
      page * CUSTOM_LIST_GAMES_PAGE_SIZE
    )
    .map((game) => game.gameId);

  const [playthroughs, pageGames] = await Promise.all([
    playthroughsAPI
      .getAll({ userId: user._id })
      .then(({ data }) => data)
      .catch(() => []),
    pageIds.length
      ? gamesApi
          .getByIds({ _ids: pageIds })
          .then(({ data }) => data)
          .catch((): IGameResponse[] => [])
      : Promise.resolve<IGameResponse[]>([]),
  ]);

  const initialGames = pageIds.flatMap((id) => {
    const game = pageGames.find((item) => item._id === id);

    return game ? [game] : [];
  });

  return (
    <CustomListPage
      list={list}
      user={user}
      playthroughs={playthroughs}
      authUserId={authUserInfo?.id}
      initialPage={page}
      initialGames={initialGames}
    />
  );
}
