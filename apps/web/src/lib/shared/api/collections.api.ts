import {
  ICustomListDetails,
  IGetCustomListsResponse,
} from "@mooncellar/schemas";
import { API_URL } from "@/src/lib/shared/constants";
import agent from "./agent.api";

const COLLECTIONS_URL = `${API_URL}/collections`;

export const collectionsAPI = {
  getAll: () => agent.get<IGetCustomListsResponse>(COLLECTIONS_URL),
  getBySlug: (slug: string) =>
    agent.get<ICustomListDetails>(`${COLLECTIONS_URL}/${slug}`),
};
