import { MongoClient, type Db, type ObjectId } from "mongodb";
import { INDEXABLE_GAME_SLUGS } from "../apps/web/src/lib/shared/constants/games.const.ts";
import {
  getGameRecordParagraphs,
  type IGameRecordFacts,
} from "../apps/web/src/lib/shared/utils/game-record.utils.ts";

const PORTS_URL = "https://game.mooncellar.space/games";
const TARGET_CHARS = 600;
const ALSO_PLAYED_LIMIT = 6;

const USAGE = `Measure the first-party text a game card renders in its MoonCellar record block.

  bun --env-file=apps/api/.env scripts/audit-game-card-text.ts

The database is reached through the tunnel, so run \`bun run mongo\` first.

The record block is built by getGameRecordParagraphs (apps/web/src/lib/shared/utils/
game-record.utils.ts) out of what MoonCellar itself knows: our rating, the playthroughs and the
hours accounts logged, Steam and RetroAchievements counts, the MoonCellar port, the public lists
that hold the game and the games the same accounts tracked. This script rebuilds those facts from
the database and prints how many characters of our own text each indexable card gets, so a card
can be indexed only while it carries something of ours.`;

interface IPort {
  siteGame: string | null;
  name: string;
  achievements: number;
}

interface ICard {
  slug: string;
  name: string;
  facts: IGameRecordFacts;
  alsoPlayed: { name: string; accounts: number }[];
  lists: string[];
}

const withStringIds = (ids: ObjectId[]) => [...ids, ...ids.map(String)];

const loadPorts = async (): Promise<Map<string, IPort>> => {
  try {
    const response = await fetch(PORTS_URL);

    if (!response.ok) return new Map();

    const ports = (await response.json()) as IPort[];

    return new Map(
      ports
        .filter((port) => port.siteGame)
        .map((port) => [port.siteGame as string, port])
    );
  } catch {
    return new Map();
  }
};

const loadCard = async (
  db: Db,
  slug: string,
  ports: Map<string, IPort>
): Promise<ICard | null> => {
  const game = await db.collection("games").findOne({ slug });

  if (!game) return null;

  const ids = withStringIds([game._id as ObjectId]);
  const playthroughs = await db
    .collection("playthroughs")
    .find({ gameId: { $in: ids } })
    .toArray();

  const accounts = new Set(playthroughs.map((play) => String(play.userId)));
  const users = new Set(
    playthroughs
      .filter((play) => play.category !== "wishlist")
      .map((play) => String(play.userId))
  );
  const has = (category: string) =>
    playthroughs.filter((play) => play.category === category).length;
  const hours = playthroughs.reduce(
    (sum, play) => sum + (Number(play.time) || 0),
    0
  );
  const lastLoggedAt = playthroughs
    .map((play) => play.createdAt)
    .filter((date): date is string => typeof date === "string")
    .sort()
    .at(-1);

  const alsoPlayed = users.size
    ? await getAlsoPlayed(db, users, ids)
    : [];
  const lists = await db
    .collection("customlists")
    .find({ isPrivate: { $ne: true }, "games.gameId": { $in: ids } })
    .project({ name: 1 })
    .toArray();

  const port = ports.get(slug);

  return {
    slug,
    name: game.name,
    facts: {
      name: game.name,
      rating:
        game.ratingsCount && game.averageRating != null
          ? { average: game.averageRating, count: game.ratingsCount }
          : null,
      stats: {
        players: accounts.size,
        completed: has("completed"),
        mastered: playthroughs.filter((play) => play.isMastered).length,
        playing: has("playing"),
        played: has("played"),
        backlog: has("backlog"),
        wishlist: has("wishlist"),
        dropped: has("dropped"),
      },
      playtime: {
        hours,
        accounts: accounts.size,
        lastLoggedAt: lastLoggedAt ?? null,
      },
      achievements: {
        steam: game.steamAchievements?.total ?? 0,
        retroachievements: (game.retroachievements ?? []).length,
      },
      port: port
        ? { name: port.name, achievements: port.achievements }
        : null,
    },
    alsoPlayed,
    lists: lists.map((list) => String(list.name)),
  };
};

const getAlsoPlayed = async (
  db: Db,
  users: Set<string>,
  gameIds: unknown[]
) => {
  const forms: unknown[] = [];

  for (const userId of users) {
    forms.push(userId);

    if (/^[a-f\d]{24}$/i.test(userId)) forms.push(userId);
  }

  const rows = await db
    .collection("playthroughs")
    .aggregate<{ _id: ObjectId; accounts: number; name: string }>([
      {
        $match: {
          userId: { $in: forms },
          gameId: { $nin: gameIds },
          category: { $ne: "wishlist" },
        },
      },
      {
        $group: {
          _id: {
            $convert: {
              input: "$gameId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
          accounts: { $addToSet: "$userId" },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $project: { accounts: { $size: "$accounts" } } },
      { $sort: { accounts: -1, _id: 1 } },
      { $limit: ALSO_PLAYED_LIMIT },
      {
        $lookup: {
          from: "games",
          localField: "_id",
          foreignField: "_id",
          as: "game",
        },
      },
      { $unwind: "$game" },
      { $project: { accounts: 1, name: "$game.name" } },
    ])
    .toArray();

  return rows.map((row) => ({ name: row.name, accounts: row.accounts }));
};

const cardText = (card: ICard) =>
  [
    ...getGameRecordParagraphs(card.facts),
    ...card.alsoPlayed.map((entry) => entry.name),
    ...card.lists,
  ].join(" ");

const main = async () => {
  const client = new MongoClient(process.env.MONGO_CONNECTION_STRING as string);

  await client.connect();

  const db = client.db("games");
  const ports = await loadPorts();
  const cards: ICard[] = [];

  for (const slug of INDEXABLE_GAME_SLUGS) {
    const card = await loadCard(db, slug, ports);

    if (card) cards.push(card);
  }

  const measured = cards
    .map((card) => ({ slug: card.slug, text: cardText(card) }))
    .sort((a, b) => b.text.length - a.text.length);
  const lengths = measured.map((card) => card.text.length).sort((a, b) => a - b);
  const overTarget = measured.filter(
    (card) => card.text.length >= TARGET_CHARS
  ).length;

  console.log(USAGE);
  console.log(`\nCards measured: ${measured.length}`);

  for (const card of measured) {
    const mark = card.text.length >= TARGET_CHARS ? "ok " : "   ";

    console.log(`${mark}${String(card.text.length).padStart(4)}  ${card.slug}`);
  }

  console.log(
    `\nCharacters of our own text: ${lengths[0]}–${lengths.at(-1)}, median ${
      lengths[Math.floor(lengths.length / 2)]
    }`
  );
  console.log(
    `Cards at or above ${TARGET_CHARS} characters: ${overTarget} of ${measured.length}`
  );

  await client.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
