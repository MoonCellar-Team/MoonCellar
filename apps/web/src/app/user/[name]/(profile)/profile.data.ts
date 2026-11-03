import { cache } from "react";
import { Metadata } from "next";
import { GetUserByStringSchema } from "@mooncellar/schemas";
import { userAPI } from "@/src/lib/shared/api";
import { fetchOrNull } from "@/src/lib/shared/utils/not-found.utils";
import { getProfileHref } from "@/src/lib/shared/utils/links.utils";
import {
  profileTabLabels,
  profileTabs,
} from "@/src/lib/shared/constants/user.const";

const isValidName = (name: string) =>
  GetUserByStringSchema.safeParse({ searchString: name }).success;

export const getProfileUser = cache(async (name: string) =>
  isValidName(name) ? fetchOrNull(userAPI.getByString(name)) : null
);

export const getProfileTabMetadata = async (
  name: string,
  tab: string
): Promise<Metadata> => {
  const user = await getProfileUser(name).catch((error: unknown) => {
    console.error("Failed to load profile tab metadata:", error);

    return null;
  });

  if (!user || !profileTabs.includes(tab)) return {};

  return {
    title: `${profileTabLabels[tab]}: ${user.userName}`,
    alternates: { canonical: getProfileHref(user.userName, tab) },
    robots: { index: false, follow: tab !== "settings" },
  };
};
