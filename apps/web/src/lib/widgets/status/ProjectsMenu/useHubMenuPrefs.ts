"use client";

import { useCallback, useEffect, useState } from "react";

const FAVOURITES_KEY = "status-hub-favourites";
const FOLDED_KEY = "status-hub-folded-groups";

const readList = (key: string) => {
  try {
    const stored = window.localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

const writeList = (key: string, values: string[]) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    return;
  }
};

/** A list of ids or keys kept in this browser: the menu's favourites and folded groups. */
const useStoredList = (key: string) => {
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    setValues(readList(key));
  }, [key]);

  const toggle = useCallback(
    (value: string) => {
      setValues((previous) => {
        const next = previous.includes(value)
          ? previous.filter((item) => item !== value)
          : [...previous, value];

        writeList(key, next);
        return next;
      });
    },
    [key]
  );

  return { values, toggle };
};

/**
 * What a reader arranged in the projects menu — their favourites and the groups they folded.
 * Both belong to this browser and are read after mount, so the server render stays the plain
 * list and hydration never disagrees with it.
 */
export const useHubMenuPrefs = () => {
  const favourites = useStoredList(FAVOURITES_KEY);
  const folded = useStoredList(FOLDED_KEY);

  return {
    favourites: favourites.values,
    toggleFavourite: favourites.toggle,
    folded: folded.values,
    toggleFolded: folded.toggle,
  };
};
