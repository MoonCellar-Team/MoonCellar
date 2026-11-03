import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_DIR = fileURLToPath(new URL("../docs", import.meta.url));
const DOC_PATH = join(DOCS_DIR, "seo-recovery.md");
const REPORT_DIR = join(DOCS_DIR, "seo-recovery");
const LOG_START = "<!-- weeks:start -->";
const LOG_END = "<!-- weeks:end -->";

export const CRAWL_TARGET = 1000;
export const POSITION_TARGET = 15;
export const KEPT_PAGES = 100;
export const REPORTED_PAGES = 20;

const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const USAGE = `The weekly SEO recovery report: crawl requests, indexed pages, impressions and average position.

  bun scripts/seo-report.ts new <week> --from <performance.csv> --crawl <totals> --indexed <count>
  bun scripts/seo-report.ts render [--check]

<week> is the Monday that starts the week, in ISO form: 2026-11-09 covers 9-15 November.

new writes docs/seo-recovery/<week>.json out of the Search Console export of that week and renders
everything built from it:
  --from     the Pages export of Performance → Search results (Export → CSV). Columns are matched by
             name, so their wording does not have to match this script.
  --crawl    the daily totals of Crawl stats for the same seven days, comma-separated (832,901,…),
             or one number when the graph was read as an average.
  --indexed  the "indexed" count of Page indexing for the same day.
  --note     a sentence for the week report, for something the numbers do not say.
  --force    replace a week that is already there.

render rewrites docs/seo-recovery/<week>.md and the week table in docs/seo-recovery.md from the week
files. --check writes nothing and fails when either is out of date, which is what a pull request that
hand-edited a report trips.`;

export interface IPageRow {
  url: string;
  impressions: number;
  position: number;
}

export interface IWeek {
  week: string;
  crawlRequestsPerDay: number[];
  indexedPages: number;
  impressions: number;
  position: number;
  pages: IPageRow[];
  note?: string;
}

export interface IWeekStats {
  crawlPerDay: number;
  indexedPages: number;
  impressions: number;
  position: number;
  crawlMet: boolean;
  positionMet: boolean;
  targetsMet: boolean;
}

export const splitCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }

  fields.push(field);

  return fields;
};

const number = (value: string) => Number(value.replace(/[,%\s]/g, ""));

export const normalizeUrl = (value: string) => {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed, "https://mooncellar.space");

    return `${url.pathname}${url.search}`;
  } catch {
    return trimmed;
  }
};

export const parsePerformanceCsv = (text: string): IPageRow[] => {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const headerIndex = lines.findIndex((line) => {
    const lower = line.toLowerCase();

    return lower.includes("impression") && lower.includes("position");
  });

  if (headerIndex === -1) {
    const start = lines.slice(0, 3).join("\n");

    throw new Error(
      `The export has no header with an impressions and a position column. It starts with:\n${start}`
    );
  }

  const header = splitCsvLine(lines[headerIndex]).map((cell) =>
    cell.trim().toLowerCase()
  );
  const urlIndex = header.findIndex((cell) => /page|url/.test(cell));
  const impressionsIndex = header.findIndex((cell) =>
    cell.includes("impression")
  );
  const positionIndex = header.findIndex((cell) => cell.includes("position"));

  if (urlIndex === -1) {
    throw new Error(
      `The export has no page column: ${splitCsvLine(lines[headerIndex]).join(", ")}`
    );
  }

  const rows = new Map<string, IPageRow>();

  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitCsvLine(line);
    const url = normalizeUrl(cells[urlIndex] ?? "");
    const impressions = number(cells[impressionsIndex] ?? "");
    const position = number(cells[positionIndex] ?? "");

    if (!url || !Number.isFinite(impressions) || !Number.isFinite(position)) {
      continue;
    }

    if (position <= 0 || impressions < 0) continue;

    const seen = rows.get(url);

    if (seen) {
      seen.impressions += impressions;
    } else {
      rows.set(url, { url, impressions, position });
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.impressions - a.impressions || a.url.localeCompare(b.url)
  );
};

export const summarisePages = (pages: IPageRow[]) => {
  const impressions = pages.reduce((sum, page) => sum + page.impressions, 0);
  const position =
    impressions > 0
      ? pages.reduce((sum, page) => sum + page.position * page.impressions, 0) /
        impressions
      : 0;

  return { impressions, position };
};

export const weekStats = (week: IWeek): IWeekStats => {
  const crawlPerDay =
    week.crawlRequestsPerDay.reduce((sum, value) => sum + value, 0) /
    week.crawlRequestsPerDay.length;
  const crawlMet = crawlPerDay >= CRAWL_TARGET;
  const positionMet = week.position <= POSITION_TARGET;

  return {
    crawlPerDay,
    indexedPages: week.indexedPages,
    impressions: week.impressions,
    position: week.position,
    crawlMet,
    positionMet,
    targetsMet: crawlMet && positionMet,
  };
};

export const isRecovered = (stats: IWeekStats, previous: IWeekStats | null) =>
  stats.targetsMet && previous !== null && previous.targetsMet;

export const formatDate = (week: string) =>
  new Date(`${week}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const formatCount = (value: number) =>
  Math.round(value).toLocaleString("en-GB");

const formatPosition = (value: number) => value.toFixed(1);

export const table = (rows: string[][]): string => {
  const widths = rows[0].map((_, column) =>
    Math.max(3, ...rows.map((row) => row[column].length))
  );
  const line = (row: string[]) =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;

  return [
    line(rows[0]),
    `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`,
    ...rows.slice(1).map(line),
  ].join("\n");
};

const delta = (
  current: number,
  previous: number | null,
  format: (value: number) => string
) => {
  if (previous === null) return "—";

  const difference = current - previous;

  if (Math.abs(difference) < 0.05) return "0";

  const size = format(Math.abs(difference));

  if (size === "0") return "0";

  return `${difference > 0 ? "+" : "-"}${size}`;
};

const stateOf = (stats: IWeekStats, previous: IWeekStats | null) => {
  const numbers = `Crawl requests are at ${formatCount(stats.crawlPerDay)} a day and the average position is ${formatPosition(stats.position)}`;

  if (isRecovered(stats, previous)) {
    return `**Recovered.** ${numbers}: both targets have held for two weeks in a row.`;
  }

  if (stats.targetsMet) {
    return `**On target.** ${numbers}: both targets hold this week, and the site counts as recovered once they hold two weeks in a row.`;
  }

  const crawl = stats.crawlMet
    ? `Crawl requests are at ${formatCount(stats.crawlPerDay)} a day`
    : `Crawl requests are at ${formatCount(stats.crawlPerDay)} a day, below 1,000`;
  const position = stats.positionMet
    ? "the average position is 15 or better"
    : `the average position is ${formatPosition(stats.position)}, worse than 15`;

  return `**Recovering.** ${crawl}, and ${position}.`;
};

export const renderWeek = (week: IWeek, previous: IWeek | null): string => {
  const stats = weekStats(week);
  const before = previous ? weekStats(previous) : null;
  const lines = [
    `# Week of ${formatDate(week.week)}`,
    "",
    table([
      ["Measurement", "This week", "Previous week", "Change", "Target"],
      [
        "Crawl requests per day",
        formatCount(stats.crawlPerDay),
        before ? formatCount(before.crawlPerDay) : "—",
        delta(
          stats.crawlPerDay,
          before ? before.crawlPerDay : null,
          formatCount
        ),
        "1,000+ a day",
      ],
      [
        "Indexed pages",
        formatCount(stats.indexedPages),
        before ? formatCount(before.indexedPages) : "—",
        delta(
          stats.indexedPages,
          before ? before.indexedPages : null,
          formatCount
        ),
        "up week over week",
      ],
      [
        "Impressions",
        formatCount(stats.impressions),
        before ? formatCount(before.impressions) : "—",
        delta(
          stats.impressions,
          before ? before.impressions : null,
          formatCount
        ),
        "up week over week",
      ],
      [
        "Average position",
        formatPosition(stats.position),
        before ? formatPosition(before.position) : "—",
        delta(stats.position, before ? before.position : null, formatPosition),
        "15 or better",
      ],
    ]),
    "",
    stateOf(stats, before),
  ];

  if (week.crawlRequestsPerDay.length > 1) {
    lines.push(
      "",
      `Daily crawl requests: ${week.crawlRequestsPerDay.map(formatCount).join(", ")}.`
    );
  }

  lines.push(
    "",
    "A lower average position is better, so a negative change under it is an improvement. The position is impression-weighted across every page the export returned.",
    "",
    "## Pages",
    "",
    week.pages.length > REPORTED_PAGES
      ? `The ${REPORTED_PAGES} pages with the most impressions, of the ${formatCount(week.pages.length)} this report keeps.`
      : `The ${formatCount(week.pages.length)} pages this report keeps, most impressions first.`,
    ""
  );

  if (!week.pages.length) {
    lines.push("The export carried no page.");
  } else {
    const previousPositions = new Map(
      (previous?.pages ?? []).map((page) => [page.url, page.position])
    );

    lines.push(
      table([
        ["Page", "Impressions", "Position", "Position last week"],
        ...[...week.pages]
          .sort(
            (a, b) =>
              b.impressions - a.impressions || a.url.localeCompare(b.url)
          )
          .slice(0, REPORTED_PAGES)
          .map((page) => {
            const past = previousPositions.get(page.url);

            return [
              `\`${page.url}\``,
              formatCount(page.impressions),
              formatPosition(page.position),
              past === undefined ? "—" : formatPosition(past),
            ];
          }),
      ])
    );
  }

  if (week.note) lines.push("", "## Note", "", week.note);

  return `${lines.join("\n")}\n`;
};

export const renderLog = (weeks: IWeek[]): string => {
  if (!weeks.length) {
    return "_No week yet: the first `bun scripts/seo-report.ts new …` adds one._";
  }

  const ordered = [...weeks].sort((a, b) => a.week.localeCompare(b.week));
  const states = new Map<string, string>();

  ordered.forEach((week, index) => {
    const stats = weekStats(week);
    const before = index > 0 ? weekStats(ordered[index - 1]) : null;

    states.set(
      week.week,
      isRecovered(stats, before)
        ? "recovered"
        : stats.targetsMet
          ? "on target"
          : "recovering"
    );
  });

  return table([
    ["Week", "Crawl per day", "Indexed", "Impressions", "Position", "State"],
    ...[...weeks]
      .sort((a, b) => b.week.localeCompare(a.week))
      .map((week) => {
        const stats = weekStats(week);

        return [
          `[${formatDate(week.week)}](seo-recovery/${week.week}.md)`,
          formatCount(stats.crawlPerDay),
          formatCount(stats.indexedPages),
          formatCount(stats.impressions),
          formatPosition(stats.position),
          states.get(week.week) ?? "recovering",
        ];
      }),
  ]);
};

export const isMonday = (week: string) =>
  new Date(`${week}T00:00:00Z`).getUTCDay() === 1;

const numberArray = (value: unknown, file: string) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) {
    throw new Error(
      `${file}: crawlRequestsPerDay must hold 1 to 7 daily totals`
    );
  }

  if (
    value.some(
      (item) => typeof item !== "number" || !Number.isFinite(item) || item < 0
    )
  ) {
    throw new Error(
      `${file}: crawlRequestsPerDay must hold non-negative numbers`
    );
  }

  return value as number[];
};

const counter = (value: unknown, name: string, file: string) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    Math.round(value) !== value
  ) {
    throw new Error(`${file}: ${name} must be a whole number, zero or more`);
  }

  return value;
};

const pageRows = (value: unknown, file: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`${file}: pages must be a list`);
  }

  return value.map((page, index) => {
    if (typeof page !== "object" || page === null || Array.isArray(page)) {
      throw new Error(`${file}: page ${index + 1} must be an object`);
    }

    const record = page as Record<string, unknown>;

    if (typeof record.url !== "string" || !record.url.trim()) {
      throw new Error(`${file}: page ${index + 1} has no url`);
    }

    if (
      typeof record.impressions !== "number" ||
      !Number.isFinite(record.impressions) ||
      record.impressions < 0
    ) {
      throw new Error(`${file}: page ${index + 1} has no impressions`);
    }

    if (
      typeof record.position !== "number" ||
      !Number.isFinite(record.position) ||
      record.position <= 0
    ) {
      throw new Error(`${file}: page ${index + 1} has no position`);
    }

    return {
      url: record.url,
      impressions: record.impressions,
      position: record.position,
    };
  });
};

export const parseWeek = (value: unknown, file: string): IWeek => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${file}: expected an object`);
  }

  const record = value as Record<string, unknown>;

  if (typeof record.week !== "string" || !WEEK_PATTERN.test(record.week)) {
    throw new Error(`${file}: week must be an ISO date, such as 2026-11-09`);
  }

  if (!isMonday(record.week)) {
    throw new Error(`${file}: ${record.week} is not a Monday`);
  }

  if (record.week !== basename(file, ".json")) {
    throw new Error(`${file}: week is ${record.week}`);
  }

  if (
    typeof record.position !== "number" ||
    !Number.isFinite(record.position) ||
    record.position <= 0
  ) {
    throw new Error(`${file}: position must be a number above zero`);
  }

  const week: IWeek = {
    week: record.week,
    crawlRequestsPerDay: numberArray(record.crawlRequestsPerDay, file),
    indexedPages: counter(record.indexedPages, "indexedPages", file),
    impressions: counter(record.impressions, "impressions", file),
    position: record.position,
    pages: pageRows(record.pages, file),
  };

  if (record.note !== undefined) {
    if (typeof record.note !== "string") {
      throw new Error(`${file}: note must be text`);
    }

    week.note = record.note;
  }

  return week;
};

const option = (args: string[], name: string) => {
  const index = args.indexOf(name);

  return index === -1 ? undefined : args[index + 1];
};

const readWeeks = () =>
  (existsSync(REPORT_DIR) ? readdirSync(REPORT_DIR) : [])
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) =>
      parseWeek(JSON.parse(readFileSync(join(REPORT_DIR, file), "utf8")), file)
    );

const previousWeek = (week: string, weeks: IWeek[]) =>
  weeks
    .filter((item) => item.week < week)
    .sort((a, b) => b.week.localeCompare(a.week))[0] ?? null;

const renderAll = (check: boolean) => {
  const weeks = readWeeks();
  const problems: string[] = [];

  for (const week of weeks) {
    const markdown = renderWeek(week, previousWeek(week.week, weeks));
    const path = join(REPORT_DIR, `${week.week}.md`);

    if (!check) {
      writeFileSync(path, markdown);
      continue;
    }

    const current = existsSync(path) ? readFileSync(path, "utf8") : null;

    if (current !== markdown) problems.push(`${basename(path)} is out of date`);
  }

  const doc = readFileSync(DOC_PATH, "utf8");
  const start = doc.indexOf(LOG_START);
  const end = doc.indexOf(LOG_END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${DOC_PATH} has no ${LOG_START} … ${LOG_END} block`);
  }

  const next = `${doc.slice(0, start + LOG_START.length)}\n\n${renderLog(weeks)}\n\n${doc.slice(end)}`;

  if (check) {
    if (next !== doc) {
      problems.push("the week table in docs/seo-recovery.md is out of date");
    }

    if (existsSync(REPORT_DIR)) {
      problems.push(
        ...readdirSync(REPORT_DIR)
          .filter(
            (file) =>
              file.endsWith(".md") &&
              !weeks.some((week) => `${week.week}.md` === file)
          )
          .map((file) => `${file} has no week file`)
      );
    }

    if (problems.length) {
      console.error("The reports are out of date:\n");

      for (const problem of problems) console.error(`  ${problem}`);

      console.error("\nRun `bun scripts/seo-report.ts render` and commit.\n");
      process.exitCode = 1;

      return;
    }

    console.log(
      weeks.length
        ? `The ${weeks.length} week reports and the week table are current.`
        : "No week has been added yet."
    );

    return;
  }

  writeFileSync(DOC_PATH, next);

  console.log(
    weeks.length
      ? `Rendered ${weeks.length} week reports and the week table.`
      : "Rendered the week table without a week yet."
  );
};
const createWeek = (args: string[]) => {
  const week = args[0];
  const from = option(args, "--from");
  const crawl = option(args, "--crawl");
  const indexed = option(args, "--indexed");
  const note = option(args, "--note");

  if (!week || !WEEK_PATTERN.test(week)) {
    throw new Error(`A week is an ISO date, such as 2026-11-09.\n\n${USAGE}`);
  }

  if (!isMonday(week)) {
    throw new Error(
      `${week} is not a Monday: the report week runs Monday to Sunday.`
    );
  }

  if (!from)
    throw new Error(`--from is the Pages export of the week.\n\n${USAGE}`);
  if (!crawl)
    throw new Error(`--crawl is the daily totals of Crawl stats.\n\n${USAGE}`);
  if (!indexed)
    throw new Error(`--indexed is the count of Page indexing.\n\n${USAGE}`);

  const path = join(REPORT_DIR, `${week}.json`);

  if (existsSync(path) && !args.includes("--force")) {
    throw new Error(
      `${basename(path)} already exists: pass --force to replace it.`
    );
  }

  const rows = parsePerformanceCsv(readFileSync(from, "utf8"));

  if (!rows.length) {
    throw new Error(`${from} carries no page with impressions and a position.`);
  }

  const { impressions, position } = summarisePages(rows);

  if (impressions <= 0) {
    throw new Error(`${from} carries no impression.`);
  }

  const daily = crawl
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number);

  if (daily.length < 1 || daily.length > 7) {
    throw new Error("--crawl takes 1 to 7 daily totals, comma-separated.");
  }

  if (daily.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("--crawl takes non-negative numbers, comma-separated.");
  }

  const indexedPages = Number(indexed.replace(/[,\s]/g, ""));

  if (!Number.isInteger(indexedPages) || indexedPages < 0) {
    throw new Error("--indexed takes a whole number, zero or more.");
  }

  const data: IWeek = {
    week,
    crawlRequestsPerDay: daily,
    indexedPages,
    impressions,
    position,
    pages: rows.slice(0, KEPT_PAGES),
  };

  if (note) data.note = note;

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);

  console.log(
    `Wrote docs/seo-recovery/${week}.json: ${rows.length} pages in the export, ${formatCount(impressions)} impressions, average position ${formatPosition(position)}; kept the ${data.pages.length} with the most impressions.`
  );

  renderAll(false);
};

const main = () => {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "new") {
    createWeek(args.slice(1));

    return;
  }

  if (command === "render") {
    renderAll(args.includes("--check"));

    return;
  }

  console.error(USAGE);
  process.exitCode = 1;
};

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
