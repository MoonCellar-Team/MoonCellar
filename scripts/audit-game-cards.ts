import { readFileSync, writeFileSync } from "node:fs";
import { MongoClient, type Collection, type Db, type ObjectId } from "mongodb";

const DB_NAME = "games";
const KEEP_LIMIT = 30;
const PORTS_URL = "https://game.mooncellar.space/games";
const CONSTANTS_PATH = new URL(
  "../apps/web/src/lib/shared/constants/games.const.ts",
  import.meta.url
);

const USAGE = `Audit the game cards the sitemap publishes and file each one as keep, merge or noindex.

  bun --env-file=apps/api/.env scripts/audit-game-cards.ts [--csv <path>] [--check]

The database is reached through the tunnel, so run \`bun run mongo\` first.

A card is keep when it carries our own data (a MoonCellar port, a playthrough, a rating, a written
note, a discussion post or a public list) and is one of the ${KEEP_LIMIT} most searched of those cards,
so the keeper list stays small enough to rewrite by hand; the card of a MoonCellar port is always
keep. A card is merge when it is an edition of another card in the sitemap: the two pages carry the
same IGDB text. Everything else is noindex — thin when it has no own data at all, weak when it has
some but is not on the shortlist.

--csv writes the whole table, --check fails when apps/web's INDEXABLE_GAME_SLUGS or
GAME_CARD_REDIRECTS disagree with the database (run it after a catalogue change).`;

export type ICardVerdict = "keep" | "merge" | "noindex";

export interface IGameCardInput {
  slug: string;
  name: string;
  type: string;
  inSitemap: boolean;
  votes: number;
  summaryLength: number;
  players: number;
  ratings: number;
  notes: number;
  publicReviews: number;
  discussions: number;
  lists: number;
  versionParent: string | null;
  port: string | null;
  portAchievements: number;
}

export interface IGameCardVerdict extends IGameCardInput {
  verdict: ICardVerdict;
  reason: string;
  mergeInto: string | null;
}

export interface IGameCardAudit {
  cards: IGameCardVerdict[];
  keep: string[];
  merged: Record<string, string>;
  counts: {
    total: number;
    sitemap: number;
    keep: number;
    merge: number;
    noindex: number;
    thin: number;
    weak: number;
    withFirstPartyData: number;
  };
}

const ownData = (card: IGameCardInput) =>
  card.players + card.ratings + card.notes + card.discussions + card.lists > 0;

const byVotes = (a: IGameCardInput, b: IGameCardInput) =>
  b.votes - a.votes || a.slug.localeCompare(b.slug);

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const describeSignals = (card: IGameCardInput) =>
  [
    card.players ? plural(card.players, "playthrough") : "",
    card.ratings ? plural(card.ratings, "rating") : "",
    card.notes ? plural(card.notes, "written note") : "",
    card.discussions ? plural(card.discussions, "discussion post") : "",
    card.lists ? plural(card.lists, "public list") : "",
  ]
    .filter(Boolean)
    .join(", ") || "no playthrough, rating, note, discussion or list";

export const auditGameCards = (
  input: IGameCardInput[],
  keepLimit = KEEP_LIMIT
): IGameCardAudit => {
  const bySlug = new Map(input.map((card) => [card.slug, card]));
  const merged: Record<string, string> = {};

  for (const card of input) {
    const parent = card.versionParent
      ? bySlug.get(card.versionParent)
      : undefined;

    if (parent && !parent.versionParent && parent.slug !== card.slug) {
      merged[card.slug] = parent.slug;
    }
  }

  const ranked = input
    .filter((card) => card.inSitemap && !merged[card.slug] && ownData(card))
    .sort(byVotes);

  const keep = new Set(ranked.slice(0, keepLimit).map((card) => card.slug));

  for (const card of input) {
    if (card.port && !merged[card.slug]) keep.add(card.slug);
  }

  const cards: IGameCardVerdict[] = [...input].sort(byVotes).map((card) => {
    const mergeInto = merged[card.slug] ?? null;

    if (mergeInto) {
      return {
        ...card,
        verdict: "merge",
        mergeInto,
        reason: `edition of ${mergeInto}`,
      };
    }

    if (keep.has(card.slug)) {
      const position = ranked.findIndex((item) => item.slug === card.slug) + 1;

      return {
        ...card,
        verdict: "keep",
        mergeInto: null,
        reason: card.port
          ? `MoonCellar port ${card.port} with ${plural(card.portAchievements, "achievement")}, ${describeSignals(card)}`
          : `shortlist ${position} of ${keepLimit}: ${describeSignals(card)}, ${card.votes} IGDB votes`,
      };
    }

    return {
      ...card,
      verdict: "noindex",
      mergeInto: null,
      reason: ownData(card)
        ? `below the shortlist: ${describeSignals(card)}`
        : `thin: ${describeSignals(card)}, ${card.summaryLength}-character IGDB summary`,
    };
  });

  const noindex = cards.filter((card) => card.verdict === "noindex");

  return {
    cards,
    keep: cards
      .filter((card) => card.verdict === "keep")
      .map((card) => card.slug),
    merged,
    counts: {
      total: cards.length,
      sitemap: cards.filter((card) => card.inSitemap).length,
      keep: cards.filter((card) => card.verdict === "keep").length,
      merge: cards.filter((card) => card.verdict === "merge").length,
      noindex: noindex.length,
      thin: noindex.filter((card) => !ownData(card)).length,
      weak: noindex.filter((card) => ownData(card)).length,
      withFirstPartyData: cards.filter(ownData).length,
    },
  };
};

const withStringIds = (ids: ObjectId[]) => [...ids, ...ids.map(String)];

const sitemapGameIds = async (Games: Collection) => {
  const now = Math.floor(Date.now() / 1000);

  const [popular, upcoming] = await Promise.all([
    Games.aggregate([
      { $match: { "igdb.total_rating": { $gt: 0 } } },
      { $sort: { "igdb.total_rating_count": -1 } },
      { $limit: 5000 },
      {
        $addFields: {
          _score: {
            $multiply: [
              "$igdb.total_rating",
              { $ln: { $add: ["$igdb.total_rating_count", 1] } },
            ],
          },
        },
      },
      { $sort: { _score: -1 } },
      { $limit: 1000 },
      { $project: { _id: 1 } },
    ]).toArray(),
    Games.aggregate([
      {
        $match: {
          first_release: { $gt: now, $lte: now + 365 * 86400 },
          cover: { $ne: null },
        },
      },
      { $sort: { "igdb.hypes": -1, first_release: 1 } },
      { $limit: 100 },
      { $project: { _id: 1 } },
    ]).toArray(),
  ]);

  const seen = new Set<string>();

  return [...popular, ...upcoming]
    .map((game) => game._id as ObjectId)
    .filter((id) => !seen.has(String(id)) && Boolean(seen.add(String(id))));
};

const loadPorts = async (): Promise<
  { siteGame: string | null; name: string; achievements: number }[]
> => {
  try {
    const response = await fetch(PORTS_URL);

    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
};

export const loadCards = async (db: Db): Promise<IGameCardInput[]> => {
  const Games = db.collection("games");
  const [sitemapIds, ports] = await Promise.all([
    sitemapGameIds(Games),
    loadPorts(),
  ]);
  const portSlugs = ports
    .map((port) => port.siteGame)
    .filter((slug): slug is string => !!slug);
  const games = await Games.aggregate([
    {
      $match: {
        $or: [{ _id: { $in: sitemapIds } }, { slug: { $in: portSlugs } }],
      },
    },
    {
      $project: {
        _id: 1,
        slug: 1,
        name: 1,
        type: 1,
        votes: { $ifNull: ["$igdb.total_rating_count", 0] },
        summaryLength: { $strLenCP: { $ifNull: ["$summary", ""] } },
        versionParent: {
          $convert: {
            input: "$relatedGames.version_parent",
            to: "string",
            onError: null,
            onNull: null,
          },
        },
      },
    },
  ]).toArray();

  const ids = games.map((game) => game._id as ObjectId);
  const stringIds = withStringIds(ids);

  const [playthroughs, ratings, comments, lists] = await Promise.all([
    db
      .collection("playthroughs")
      .aggregate([
        { $match: { gameId: { $in: stringIds } } },
        {
          $group: {
            _id: { $toString: "$gameId" },
            players: { $addToSet: { $toString: "$userId" } },
            notes: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: [{ $type: "$comment" }, "string"] },
                      { $ne: ["$comment", ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            publicReviews: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isPublic", true] },
                      { $ne: ["$category", "wishlist"] },
                      { $eq: [{ $type: "$comment" }, "string"] },
                      { $ne: ["$comment", ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray(),
    db
      .collection("ratings")
      .aggregate([
        { $match: { gameId: { $in: stringIds } } },
        { $group: { _id: { $toString: "$gameId" }, n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("gamecomments")
      .aggregate([
        {
          $match: {
            gameId: { $in: stringIds },
            status: "normal",
            body: { $type: "string", $ne: "" },
          },
        },
        { $group: { _id: { $toString: "$gameId" }, n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("customlists")
      .find({ isPrivate: { $ne: true }, generator: { $exists: false } })
      .project({ games: 1 })
      .toArray(),
  ]);

  const playthroughsByGame = new Map(
    playthroughs.map((row) => [String(row._id), row])
  );
  const ratingsByGame = new Map(ratings.map((row) => [String(row._id), row.n]));
  const commentsByGame = new Map(
    comments.map((row) => [String(row._id), row.n])
  );
  const listsByGame = new Map<string, number>();

  for (const list of lists) {
    for (const entry of (list.games ?? []) as { gameId?: unknown }[]) {
      const key = String(entry?.gameId ?? entry);

      listsByGame.set(key, (listsByGame.get(key) ?? 0) + 1);
    }
  }

  const portByGame = new Map(
    ports
      .filter((port) => port.siteGame)
      .map((port) => [port.siteGame as string, port])
  );
  const sitemapIdSet = new Set(sitemapIds.map(String));
  const slugById = new Map(games.map((game) => [String(game._id), game.slug]));

  return games.map((game) => {
    const id = String(game._id);
    const playthrough = playthroughsByGame.get(id);
    const port = portByGame.get(game.slug);

    return {
      slug: game.slug,
      name: game.name,
      type: game.type,
      inSitemap: sitemapIdSet.has(id),
      votes: game.votes,
      summaryLength: game.summaryLength,
      players: playthrough ? playthrough.players.length : 0,
      ratings: ratingsByGame.get(id) ?? 0,
      notes: playthrough ? playthrough.notes : 0,
      publicReviews: playthrough ? playthrough.publicReviews : 0,
      discussions: commentsByGame.get(id) ?? 0,
      lists: listsByGame.get(id) ?? 0,
      versionParent: game.versionParent
        ? (slugById.get(game.versionParent) ?? null)
        : null,
      port: port?.name ?? null,
      portAchievements: port?.achievements ?? 0,
    };
  });
};

const printReport = ({ cards, counts }: IGameCardAudit) => {
  console.log(
    `\nCards audited: ${counts.total} — ${counts.sitemap} in the sitemap, ${counts.total - counts.sitemap} with a MoonCellar port outside it\n` +
      `  keep     ${counts.keep}\n` +
      `  merge    ${counts.merge}\n` +
      `  noindex  ${counts.noindex} — thin ${counts.thin}, weak ${counts.weak}\n` +
      `  cards carrying our data: ${counts.withFirstPartyData}\n`
  );

  const section = (title: string, verdict: ICardVerdict) => {
    const rows = cards.filter((card) => card.verdict === verdict);

    if (!rows.length) return;

    console.log(`${title} (${rows.length})`);

    for (const card of rows) console.log(`  ${card.slug} — ${card.reason}`);

    console.log();
  };

  section("Keep", "keep");
  section("Merge", "merge");

  const thin = cards.filter(
    (card) => card.verdict === "noindex" && card.reason.startsWith("thin:")
  );

  if (!thin.length) return;

  const lengths = thin.map((card) => card.summaryLength).sort((a, b) => a - b);

  console.log(
    `Thin cards: ${thin.length}, IGDB summary ${lengths[0]}–${lengths[lengths.length - 1]} characters (median ${lengths[Math.floor(lengths.length / 2)]})\n`
  );
};

export const toCsv = ({ cards }: IGameCardAudit) => {
  const header = [
    "slug",
    "name",
    "type",
    "inSitemap",
    "verdict",
    "reason",
    "mergeInto",
    "igdbVotes",
    "players",
    "ratings",
    "notes",
    "publicReviews",
    "summaryLength",
  ];

  const escape = (value: string | number | boolean | null) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const rows = cards.map((card) =>
    [
      card.slug,
      card.name,
      card.type,
      card.inSitemap,
      card.verdict,
      card.reason,
      card.mergeInto,
      card.votes,
      card.players,
      card.ratings,
      card.notes,
      card.publicReviews,
      card.summaryLength,
    ]
      .map(escape)
      .join(",")
  );

  return [header.join(","), ...rows].join("\n") + "\n";
};

const readConstantSlugs = (source: string) => {
  const start = source.indexOf("INDEXABLE_GAME_SLUGS:");
  const block = source.slice(start, source.indexOf("]);", start));

  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
};

const readConstantRedirects = (source: string) => {
  const start = source.indexOf("GAME_CARD_REDIRECTS:");
  const block = source.slice(start, source.indexOf("};", start));

  return new Map(
    [...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((match) => [
      match[1],
      match[2],
    ])
  );
};

export const compareWithConstants = (
  source: string,
  { keep, merged }: Pick<IGameCardAudit, "keep" | "merged">
) => {
  const listed = new Set(readConstantSlugs(source));
  const redirects = readConstantRedirects(source);

  return [
    ...keep
      .filter((slug) => !listed.has(slug))
      .map((slug) => `keep: add ${slug}`),
    ...[...listed]
      .filter((slug) => !keep.includes(slug))
      .map((slug) => `keep: drop ${slug}`),
    ...Object.keys(merged)
      .filter((slug) => !redirects.has(slug))
      .map((slug) => `merge: add ${slug}`),
    ...[...redirects.keys()]
      .filter((slug) => !merged[slug])
      .map((slug) => `merge: drop ${slug}`),
    ...Object.entries(merged)
      .filter(
        ([slug, target]) =>
          redirects.has(slug) && redirects.get(slug) !== target
      )
      .map(([slug, target]) => `merge: ${slug} should point at ${target}`),
  ];
};

const main = async () => {
  const args = process.argv.slice(2);
  const csvIndex = args.indexOf("--csv");
  const csvPath = csvIndex === -1 ? undefined : args[csvIndex + 1];

  if (!process.env.MONGO_CONNECTION_STRING) {
    console.error(`MONGO_CONNECTION_STRING is not set.\n\n${USAGE}`);
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGO_CONNECTION_STRING, {
    appName: "mooncellar-audit-game-cards",
    autoSelectFamily: true,
  });

  await client.connect();

  try {
    const audit = auditGameCards(await loadCards(client.db(DB_NAME)));

    printReport(audit);

    if (csvPath) {
      writeFileSync(csvPath, toCsv(audit));
      console.log(`Wrote ${csvPath}\n`);
    }

    if (args.includes("--check")) {
      const problems = compareWithConstants(
        readFileSync(CONSTANTS_PATH, "utf8"),
        audit
      );

      if (problems.length) {
        console.log("The web constants are out of date:\n");
        for (const problem of problems) console.log(`  ${problem}`);
        console.log();
        process.exitCode = 1;
      } else {
        console.log("The web constants match the database.\n");
      }
    }
  } finally {
    await client.close();
  }
};

if (import.meta.main) await main();
