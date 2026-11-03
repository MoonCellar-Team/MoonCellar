import {
  IAddCustomListGameRequest,
  ICreateCustomListRequest,
  ICustomList,
  ICustomListDetails,
  ICustomListGameCountsResponse,
  ICustomListGamesFilters,
  ICustomListLikeResponse,
  ICustomListSort,
  IGetCustomListsRequest,
  IGetCustomListsResponse,
  IGameListsResponse,
  IReorderCustomListRequest,
  IReorderCustomListsRequest,
  IUpdateCustomListRequest,
} from "@mooncellar/schemas";
import { API_URL } from "@/src/lib/shared/constants";
import agent from "./agent.api";

const LISTS_URL = `${API_URL}/lists`;

export const listsAPI = {
  getLists: (params: IGetCustomListsRequest) =>
    agent.get<IGetCustomListsResponse>(LISTS_URL, {
      params: {
        ...params,
        games: params.games?.length
          ? Array.isArray(params.games)
            ? params.games.join(",")
            : params.games
          : undefined,
      },
    }),
  getUserLists: (userId: string, gameId?: string) =>
    agent.get<ICustomList[]>(`${LISTS_URL}/user/${userId}`, {
      params: { gameId },
    }),
  getLikedLists: (userId: string) =>
    agent.get<ICustomList[]>(`${LISTS_URL}/liked/${userId}`),
  getByGame: (gameId: string) =>
    agent.get<IGameListsResponse>(`${LISTS_URL}/game/${gameId}`),
  getMyGameCounts: () =>
    agent.get<ICustomListGameCountsResponse>(`${LISTS_URL}/mine/game-counts`),
  getBySlug: (
    userName: string,
    slug: string,
    sort: ICustomListSort = {},
    filters?: ICustomListGamesFilters
  ) =>
    filters
      ? agent.post<ICustomListDetails>(`${LISTS_URL}/by-slug`, {
          userName,
          slug,
          ...sort,
          filters,
        })
      : agent.get<ICustomListDetails>(`${LISTS_URL}/by-slug`, {
          params: { userName, slug, ...sort },
        }),
  create: (dto: ICreateCustomListRequest) =>
    agent.post<ICustomList>(LISTS_URL, dto),
  update: (id: string, dto: IUpdateCustomListRequest) =>
    agent.patch<ICustomList>(`${LISTS_URL}/${id}`, dto),
  remove: (id: string) => agent.delete<{ _id: string }>(`${LISTS_URL}/${id}`),
  like: (id: string) =>
    agent.put<ICustomListLikeResponse>(`${LISTS_URL}/${id}/like`),
  unlike: (id: string) =>
    agent.delete<ICustomListLikeResponse>(`${LISTS_URL}/${id}/like`),
  addGame: (id: string, dto: IAddCustomListGameRequest) =>
    agent.post<ICustomList>(`${LISTS_URL}/${id}/games`, dto),
  removeGame: (id: string, gameId: string) =>
    agent.delete<ICustomList>(`${LISTS_URL}/${id}/games/${gameId}`),
  reorderLists: (dto: IReorderCustomListsRequest) =>
    agent.patch<IReorderCustomListsRequest>(`${LISTS_URL}/order`, dto),
  reorder: (id: string, dto: IReorderCustomListRequest) =>
    agent.patch<ICustomList>(`${LISTS_URL}/${id}/order`, dto),
};
