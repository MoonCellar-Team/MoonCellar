import { describe, expect, it } from "bun:test";
import {
  formatDate,
  isMonday,
  parsePerformanceCsv,
  parseWeek,
  renderLog,
  renderWeek,
  splitCsvLine,
  table,
  summarisePages,
  weekStats,
  type IWeek,
} from "./seo-report";

const week = (overrides: Partial<IWeek> = {}): IWeek => ({
  week: "2026-10-26",
  crawlRequestsPerDay: [832, 901, 877, 940, 1003, 1105, 1088],
  indexedPages: 412,
  impressions: 18200,
  position: 14.7,
  pages: [
    { url: "/games/hades", impressions: 1200, position: 8.4 },
    { url: "/collections/best-of-2025", impressions: 900, position: 12.1 },
  ],
  ...overrides,
});

const flat = (markdown: string) => markdown.replace(/[ \t]+/g, " ");

const csv = [
  "Top pages,Clicks,Impressions,CTR,Position",
  '/games/hades,12,"1,200",1.0%,8.4',
  "/games/celeste,3,900,0.3%,12.1",
].join("\n");

describe("csv", () => {
  it("splits quoted fields", () => {
    expect(splitCsvLine("Top pages,Clicks")).toEqual(["Top pages", "Clicks"]);
    expect(splitCsvLine('"/games/a,b",2')).toEqual(["/games/a,b", "2"]);
    expect(splitCsvLine('"say ""hi""",1')).toEqual(['say "hi"', "1"]);
  });

  it("reads the pages export", () => {
    const rows = parsePerformanceCsv(csv);

    expect(rows).toEqual([
      { url: "/games/hades", impressions: 1200, position: 8.4 },
      { url: "/games/celeste", impressions: 900, position: 12.1 },
    ]);
  });

  it("reads a byte-order mark, windows line endings and absolute urls", () => {
    const rows = parsePerformanceCsv(
      `\uFEFFTop pages,Clicks,Impressions,CTR,Position\r\nhttps://mooncellar.space/games/hades?page=2,1,50,0.1%,7.5\r\n`
    );

    expect(rows).toEqual([
      { url: "/games/hades?page=2", impressions: 50, position: 7.5 },
    ]);
  });

  it("adds the rows of one page together", () => {
    const rows = parsePerformanceCsv(
      ["Top pages,Impressions,Position", "/games/a,10,5", "/games/a,30,6"].join(
        "\n"
      )
    );

    expect(rows).toEqual([{ url: "/games/a", impressions: 40, position: 5 }]);
  });

  it("sorts by impressions", () => {
    const rows = parsePerformanceCsv(
      ["Top pages,Impressions,Position", "/games/a,10,5", "/games/b,30,6"].join(
        "\n"
      )
    );

    expect(rows.map((row) => row.url)).toEqual(["/games/b", "/games/a"]);
  });

  it("says what it saw when the header is missing", () => {
    expect(() => parsePerformanceCsv("Date,Requests\n2026-10-26,900")).toThrow(
      /no header/
    );
  });
});

describe("numbers", () => {
  it("weights the position by impressions", () => {
    expect(
      summarisePages([
        { url: "/a", impressions: 100, position: 10 },
        { url: "/b", impressions: 300, position: 20 },
      ])
    ).toEqual({ impressions: 400, position: 17.5 });
  });

  it("has no position without impressions", () => {
    expect(summarisePages([])).toEqual({ impressions: 0, position: 0 });
  });

  it("counts both targets, at the boundary", () => {
    const met = weekStats(
      week({
        crawlRequestsPerDay: [1000],
        position: 15,
      })
    );

    expect(met).toEqual({
      crawlPerDay: 1000,
      indexedPages: 412,
      impressions: 18200,
      position: 15,
      crawlMet: true,
      positionMet: true,
      targetsMet: true,
    });

    expect(weekStats(week({ crawlRequestsPerDay: [999] })).crawlMet).toBe(
      false
    );
    expect(weekStats(week({ position: 15.1 })).positionMet).toBe(false);
  });
});

describe("table", () => {
  it("pads the columns the way prettier does", () => {
    expect(
      table([
        ["A", "B"],
        ["longer", "1"],
      ])
    ).toBe("| A      | B   |\n| ------ | --- |\n| longer | 1   |");
  });
});

describe("dates", () => {
  it("knows the first day of the week", () => {
    expect(isMonday("2026-10-26")).toBe(true);
    expect(isMonday("2026-10-27")).toBe(false);
  });

  it("writes the week out", () => {
    expect(formatDate("2026-10-26")).toBe("26 October 2026");
  });
});

describe("week report", () => {
  it("states the four numbers against the targets", () => {
    const report = renderWeek(week(), null);

    expect(report).toMatch(/^# Week of 26 October 2026/);
    expect(flat(report)).toContain(
      "| Crawl requests per day | 964 | — | — | 1,000+ a day |"
    );
    expect(flat(report)).toContain(
      "| Indexed pages | 412 | — | — | up week over week |"
    );
    expect(flat(report)).toContain(
      "| Impressions | 18,200 | — | — | up week over week |"
    );
    expect(flat(report)).toContain(
      "| Average position | 14.7 | — | — | 15 or better |"
    );
    expect(report).toContain(
      "Daily crawl requests: 832, 901, 877, 940, 1,003, 1,105, 1,088."
    );
    expect(report).toContain("**Recovering.**");
    expect(report).toContain("below 1,000");
  });

  it("compares with the week before", () => {
    const report = renderWeek(
      week(),
      week({
        week: "2026-10-19",
        crawlRequestsPerDay: [987],
        indexedPages: 398,
        impressions: 17640,
        position: 16.2,
        pages: [{ url: "/games/hades", impressions: 1100, position: 9.1 }],
      })
    );

    expect(flat(report)).toContain("| Average position | 14.7 | 16.2 | -1.5 |");
    expect(report).toContain("17,640");
    expect(flat(report)).toContain("| `/games/hades` | 1,200 | 8.4 | 9.1 |");
    expect(flat(report)).toContain(
      "| `/collections/best-of-2025` | 900 | 12.1 | — |"
    );
  });

  it("shows no change when the difference rounds to nothing", () => {
    const report = renderWeek(
      week({ crawlRequestsPerDay: [964] }),
      week({ week: "2026-10-19", crawlRequestsPerDay: [964.3] })
    );

    expect(flat(report)).toContain(
      "| Crawl requests per day | 964 | 964 | 0 | 1,000+ a day |"
    );
  });

  it("holds a week on target until the next one keeps it", () => {
    const onTarget = week({ crawlRequestsPerDay: [1200], position: 11.2 });
    const report = renderWeek(onTarget, null);

    expect(report).toContain("**On target.**");
    expect(report).toContain("two weeks in a row");
    expect(
      renderWeek(
        onTarget,
        week({ week: "2026-10-19", crawlRequestsPerDay: [1100] })
      )
    ).toContain("**Recovered.**");
  });

  it("keeps the note", () => {
    expect(
      renderWeek(
        week({ note: "The collection pages went out on Tuesday." }),
        null
      )
    ).toContain("## Note\n\nThe collection pages went out on Tuesday.");
  });
});

describe("week table", () => {
  it("says there is no week yet", () => {
    expect(renderLog([])).toContain("No week yet");
  });

  it("lists the newest week first and links its report", () => {
    const log = renderLog([
      week(),
      week({
        week: "2026-10-19",
        crawlRequestsPerDay: [987],
        position: 16.2,
      }),
    ]);

    expect(log).toContain("[26 October 2026](seo-recovery/2026-10-26.md)");
    expect(log.indexOf("26 October 2026")).toBeLessThan(
      log.indexOf("19 October 2026")
    );
    expect(flat(log)).toContain("| 964 | 412 | 18,200 | 14.7 | recovering |");
  });
});

describe("week file", () => {
  it("reads a week", () => {
    expect(parseWeek(week(), "2026-10-26.json")).toEqual(week());
  });

  it("refuses a day that is not a Monday", () => {
    expect(() =>
      parseWeek(week({ week: "2026-10-27" }), "2026-10-27.json")
    ).toThrow(/not a Monday/);
  });

  it("refuses a week that does not match its file", () => {
    expect(() =>
      parseWeek(week({ week: "2026-10-19" }), "2026-10-26.json")
    ).toThrow(/week is 2026-10-19/);
  });

  it("refuses more than seven days of crawl", () => {
    expect(() =>
      parseWeek(
        week({ crawlRequestsPerDay: [1, 2, 3, 4, 5, 6, 7, 8] }),
        "2026-10-26.json"
      )
    ).toThrow(/1 to 7 daily totals/);
  });

  it("refuses a broken count and a missing position", () => {
    expect(() =>
      parseWeek(week({ indexedPages: 1.5 }), "2026-10-26.json")
    ).toThrow(/whole number/);
    expect(() =>
      parseWeek({ ...week(), position: 0 }, "2026-10-26.json")
    ).toThrow(/position/);
  });
});
