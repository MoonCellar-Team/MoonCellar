import { MongoClient, type Db, type ObjectId } from "mongodb";
import { INDEXABLE_GAME_SLUGS } from "../apps/web/src/lib/shared/constants/games.const.ts";
import {
  GAME_EDITORIAL,
  getGameEditorial,
} from "../apps/web/src/lib/shared/constants/game-editorial.const.ts";

const TARGET_CHARS = 400;

const USAGE = `Measure the first-party text a game card renders: the MoonCellar note above the IGDB
summary and the titles of the lists and collections that hold the game.

  bun --env-file=apps/api/.env scripts/audit-game-card-text.ts [--check]

The database is reached through the tunnel, so run \`bun run mongo\` first.

What Google cannot get from IGDB is the card's note (shared/constants/game-editorial.const.ts, one
per indexable slug) and the names of the public lists and generated collections in the
widgets/game/GameLists block. This script rebuilds both from the database and prints how many
characters of our own text each indexable card gets.

--check fails when a card of INDEXABLE_GAME_SLUGS has no editorial note, when the note map holds a
slug that is not in that list, or when a card measures less than the ${TARGET_CHARS}-character bar.`;

interface ICard {
  slug: string;
  note: string;
  lists: string[];
}

const withStringIds = (ids: ObjectId[]) => [...ids, ...ids.map(String)];

const loadCard = async (db: Db, slug: string): Promise<ICard | null> => {
  const game = await db.collection("games").findOne({ slug });

  if (!game) return null;

  const ids = withStringIds([game._id as ObjectId]);
  const lists = await db
    .collection("customlists")
    .find({ isPrivate: { $ne: true }, "games.gameId": { $in: ids } })
    .project({ name: 1 })
    .toArray();

  return {
    slug,
    note: getGameEditorial(slug)?.trim() ?? "",
    lists: lists.map((list) => String(list.name)),
  };
};

const cardText = (card: ICard) => [card.note, ...card.lists].join(" ");

const isCheck = process.argv.includes("--check");

const main = async () => {
  const client = new MongoClient(process.env.MONGO_CONNECTION_STRING as string);

  await client.connect();

  const db = client.db("games");
  const cards: ICard[] = [];

  for (const slug of INDEXABLE_GAME_SLUGS) {
    const card = await loadCard(db, slug);

    if (card) cards.push(card);
  }

  const measured = cards
    .map((card) => ({ card, text: cardText(card) }))
    .sort((a, b) => b.text.length - a.text.length);
  const lengths = measured.map((card) => card.text.length).sort((a, b) => a - b);
  const overTarget = measured.filter(
    (card) => card.text.length >= TARGET_CHARS
  ).length;

  console.log(USAGE);
  console.log(`\nCards measured: ${measured.length}`);

  for (const card of measured) {
    const mark = card.text.length >= TARGET_CHARS ? "ok " : "   ";

    console.log(
      `${mark}${String(card.text.length).padStart(4)}  ${card.card.slug}`
    );
  }

  console.log(
    `\nCharacters of our own text: ${lengths[0]}–${lengths.at(-1)}, median ${
      lengths[Math.floor(lengths.length / 2)]
    }`
  );
  console.log(
    `Cards at or above ${TARGET_CHARS} characters: ${overTarget} of ${measured.length}`
  );

  const withoutNote = cards
    .filter((card) => !card.note)
    .map((card) => card.slug);
  const unknownNote = Object.keys(GAME_EDITORIAL).filter(
    (slug) => !INDEXABLE_GAME_SLUGS.has(slug)
  );
  const belowTarget = measured
    .filter((card) => card.text.length < TARGET_CHARS)
    .map((card) => card.card.slug);

  if (!withoutNote.length && !unknownNote.length && !belowTarget.length) {
    console.log("\nEvery indexable card carries a note and clears the bar.");
  }

  if (withoutNote.length) {
    console.log(`\nNo editorial note: ${withoutNote.join(", ")}`);
  }

  if (unknownNote.length) {
    console.log(
      `\nEditorial note for a slug outside INDEXABLE_GAME_SLUGS: ${unknownNote.join(", ")}`
    );
  }

  if (belowTarget.length) {
    console.log(`\nBelow ${TARGET_CHARS} characters: ${belowTarget.join(", ")}`);
  }

  await client.close();

  if (isCheck && (withoutNote.length || unknownNote.length || belowTarget.length)) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
