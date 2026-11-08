import { API_URL } from "@/src/lib/shared/constants";
import { IGamesListResponse } from "@/src/lib/shared/types/games.type";
import {
  IAddGameRequest,
  IGameAiDraftRequest,
  IGameAiDraftRun,
  IGameResponse,
  IGenreResponse,
  IGetGameByIdRequest,
  IGetGameBySlugRequest,
  IGetGamesByIdsRequest,
  IGetGamesRequest,
  IGetGameSlugsResponse,
  IGetRandomGameSlugResponse,
  IPlatformCountResponse,
  IUpcomingReleaseGroup,
  IUpdateGameRequest,
  IGetGameFollowingsStatusResponse,
  IGameStats,
  IGetGamesStatsResponse,
  IRelatedGamesResponse,
  IFindGameImagesRequest,
  IFindGameImagesResponse,
  IImportGameImageRequest,
} from "@mooncellar/schemas";
import agent from "./agent.api";
import { filesAPI } from "./files.api";

const GAMES_URL = `${API_URL}/games`;
const GET_BY_IDS_MAX = 100;

export const gamesApi = {
  getSlugs: () => {
    return agent.get<IGetGameSlugsResponse>(`${GAMES_URL}/slugs`);
  },

  getRandomSlug: () => {
    return agent.get<IGetRandomGameSlugResponse>(`${GAMES_URL}/random-slug`);
  },

  getById: (params: IGetGameByIdRequest) => {
    return agent.get<IGameResponse>(`${GAMES_URL}/by-id/${params._id}`);
  },

  getFollowingsStatus: (gameId: string, userId: string) => {
    return agent.get<IGetGameFollowingsStatusResponse>(
      `${GAMES_URL}/${gameId}/followings-status`,
      { params: { userId } }
    );
  },

  getStats: (gameId: string) => {
    return agent.get<IGameStats>(`${GAMES_URL}/${gameId}/stats`);
  },

  getRelated: (gameId: string) => {
    return agent.get<IRelatedGamesResponse>(`${GAMES_URL}/${gameId}/related`);
  },

  getStatsByIds: (gameIds: string[]) => {
    return agent.get<IGetGamesStatsResponse>(`${GAMES_URL}/stats`, {
      params: { gameIds },
    });
  },

  getByIds: (params: IGetGamesByIdsRequest) => {
    const ids = Array.isArray(params._ids) ? params._ids : [params._ids];

    if (!params.search && ids.length <= GET_BY_IDS_MAX) {
      return agent.get<IGameResponse[]>(
        `${GAMES_URL}/by-ids?_ids=${ids.join("&_ids=")}`
      );
    }

    return agent.post<IGameResponse[]>(`${GAMES_URL}/by-ids`, params);
  },

  getBySlug: (params: IGetGameBySlugRequest) => {
    return agent.get<IGameResponse>(`${GAMES_URL}/by-slug/${params.slug}`, {
      params,
    });
  },

  getAll: async (data: IGetGamesRequest) => {
    return agent.post<IGamesListResponse>(`${GAMES_URL}`, data);
  },

  getAiDrafts: () => {
    return agent.get<IGameAiDraftRun[]>(`${GAMES_URL}/ai-drafts`);
  },

  retryAiDraft: (id: string) => {
    return agent.post<IGameAiDraftRun>(`${GAMES_URL}/ai-drafts/${id}/retry`);
  },

  deleteAiDraft: (id: string) => {
    return agent.delete(`${GAMES_URL}/ai-drafts/${id}`);
  },

  startAiDraft: (dto: IGameAiDraftRequest) => {
    return agent.post<IGameAiDraftRun>(`${GAMES_URL}/ai-drafts`, dto);
  },

  add: (dto: IAddGameRequest, force?: boolean) => {
    return agent.post<IGameResponse>(`${GAMES_URL}/add`, dto, {
      params: force ? { force } : undefined,
    });
  },

  update: (id: string, dto: IUpdateGameRequest) => {
    return agent.put<IGameResponse>(`${GAMES_URL}/update/${id}`, dto);
  },

  findImageCandidates: (dto: IFindGameImagesRequest) => {
    return agent.post<IFindGameImagesResponse>(
      `${GAMES_URL}/image-candidates`,
      dto
    );
  },

  importImage: (gameId: string, dto: IImportGameImageRequest) => {
    return agent.post<string>(`${GAMES_URL}/import-image/${gameId}`, dto);
  },

  uploadImage: (
    gameId: string,
    type: "cover" | "screenshot" | "artwork",
    file: File
  ) => {
    const formData = new FormData();

    formData.append("file", file);

    return agent.post<string>(`${GAMES_URL}/upload-image/${gameId}`, formData, {
      params: { gameId, type },
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  remove: async (id: string) => {
    return agent.delete<IGameResponse>(`${GAMES_URL}/delete/${id}`);
  },

  getTopRatedRandom: async () => {
    return agent.get<IGameResponse[]>(`${GAMES_URL}/top-rated-random`);
  },

  getTotalGamesByCount: async () => {
    return agent.get<IGenreResponse[]>(`${GAMES_URL}/count-by-genre`);
  },

  getTotalGamesByPlatformCount: async () => {
    return agent.get<IPlatformCountResponse[]>(
      `${GAMES_URL}/count-by-platform`
    );
  },

  getUpcomingReleases: async () => {
    return agent.get<IUpcomingReleaseGroup[]>(`${GAMES_URL}/upcoming`);
  },

  getRecentReleases: async () => {
    return agent.get<IGameResponse[]>(`${GAMES_URL}/recent`);
  },

  getFilters: async (): Promise<
    | {
        modes: string[];
        themes: string[];
        keywords: string[];
        genres: string[];
        companies: string[];
        type: string[];
        franchises?: string[];
        game_engines: string[];
        player_perspectives: string[];
        languages: string[];
        status: string[];
        ageRatings: string[];
      }
    | undefined
  > => {
    const res = await filesAPI.getFile({
      key: "filters",
      bucketName: "mooncellar-common",
    });
    return JSON.parse(res.data.content as string);
  },
};
