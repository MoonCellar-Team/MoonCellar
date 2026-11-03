export interface IGameRecordRating {
  average: number;
  count: number;
}

export interface IGameRecordStats {
  players: number;
  completed: number;
  mastered: number;
  playing: number;
  played: number;
  backlog: number;
  wishlist: number;
  dropped: number;
}

export interface IGameRecordPlaytime {
  hours: number;
  accounts: number;
  lastLoggedAt: string | null;
}

export interface IGameRecordAchievements {
  steam?: number;
  retroachievements?: number;
}

export interface IGameRecordPort {
  name: string;
  achievements: number;
}

export interface IGameRecordFacts {
  name: string;
  rating?: IGameRecordRating | null;
  stats?: IGameRecordStats | null;
  playtime?: IGameRecordPlaytime | null;
  achievements?: IGameRecordAchievements | null;
  port?: IGameRecordPort | null;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

const trackParts = (stats: IGameRecordStats) => {
  const parts = [
    stats.completed ? `${stats.completed} completed it` : "",
    stats.playing ? `${stats.playing} ${stats.playing === 1 ? "is" : "are"} playing it` : "",
    stats.played ? `${stats.played} played it` : "",
    stats.backlog
      ? `${stats.backlog} ${stats.backlog === 1 ? "has" : "have"} it in a backlog`
      : "",
    stats.dropped ? `${stats.dropped} dropped it` : "",
    stats.wishlist
      ? `${stats.wishlist} ${stats.wishlist === 1 ? "has" : "have"} it on a wishlist`
      : "",
  ].filter(Boolean);

  if (parts.length < 2) return parts.join("");

  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
};

export const getGameRecordRating = (
  facts: IGameRecordFacts
): string | null => {
  const { rating, name } = facts;

  if (!rating?.count) return null;

  const average = rating.average.toFixed(1);

  return rating.count === 1
    ? `One reader has rated ${name} on MoonCellar: ${average} out of 10.`
    : `${plural(rating.count, "reader has", "readers have")} rated ${name} on MoonCellar, averaging ${average} out of 10.`;
};

export const getGameRecordTrack = (facts: IGameRecordFacts): string | null => {
  const { stats } = facts;

  if (!stats?.players) return null;

  const parts = trackParts(stats);

  if (!parts) return null;

  const subject = facts.rating?.count ? "it" : facts.name;

  return `${plural(stats.players, "account tracks", "accounts track")} ${subject} on MoonCellar: ${parts}.`;
};

export const getGameRecordPlaytime = (
  facts: IGameRecordFacts
): string | null => {
  const { playtime } = facts;

  if (!playtime) return null;

  const parts: string[] = [];

  if (playtime.hours > 0) {
    parts.push(`They logged ${plural(playtime.hours, "hour", "hours")} of playtime`);
  }

  if (playtime.lastLoggedAt) {
    parts.push(
      `the newest entry was logged on ${formatDate(playtime.lastLoggedAt)}`
    );
  }

  if (!parts.length) return null;

  const sentence = parts.join("; ");

  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};

export const getGameRecordAchievements = (
  facts: IGameRecordFacts
): string | null => {
  const parts: string[] = [];
  const steam = facts.achievements?.steam ?? 0;
  const retro = facts.achievements?.retroachievements ?? 0;

  if (steam > 0) {
    parts.push(`Steam lists ${plural(steam, "achievement", "achievements")} for it`);
  }

  if (retro > 0) {
    parts.push(
      `RetroAchievements covers it with ${plural(retro, "set", "sets")}`
    );
  }

  if (facts.port?.name) {
    parts.push(
      `MoonCellar Team's ${facts.port.name} brings it to the browser with ${plural(
        facts.port.achievements,
        "achievement",
        "achievements"
      )}`
    );
  }

  if (!parts.length) return null;

  const sentence = parts.join(", ");

  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};

export const getGameRecordParagraphs = (
  facts: IGameRecordFacts
): string[] =>
  [
    getGameRecordRating(facts),
    getGameRecordTrack(facts),
    getGameRecordPlaytime(facts),
    getGameRecordAchievements(facts),
  ].filter((paragraph): paragraph is string => !!paragraph);

export const getGameRecordText = (facts: IGameRecordFacts) =>
  getGameRecordParagraphs(facts).join(" ");
