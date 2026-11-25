import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAchievements } from "./achievements";
import { narutosp } from "./narutosp/narutosp.game";
import { rooftops } from "./rooftops/rooftops.game";

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/></svg>\n';

const achievement = (key: string) => ({
  key,
  icon: `${key}.svg`,
  title: { en: "Title", ru: "Название" },
  description: { en: "Description", ru: "Описание" },
  trigger: { index: 0 },
});

const catalogDir = (achievements: object[], icons: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), "achievements-"));
  writeFileSync(
    join(dir, "achievements.json"),
    JSON.stringify({ format: 1, game: "test", achievements })
  );
  mkdirSync(join(dir, "achievements"));
  for (const [name, svg] of Object.entries(icons)) {
    writeFileSync(join(dir, "achievements", name), svg);
  }
  return dir;
};

describe("loadAchievements", () => {
  it("loads the rooftops catalog with its icons", () => {
    const loaded = rooftops.achievements!;
    expect(loaded.list.length).toBe(28);
    expect(new Set(loaded.list.map((a) => a.key)).size).toBe(28);
    expect(loaded.icons.size).toBe(28);
  });

  it("loads the narutosp catalog with its icons", () => {
    const loaded = narutosp.achievements!;
    expect(loaded.list.length).toBe(25);
    expect(new Set(loaded.list.map((a) => a.key)).size).toBe(25);
    expect(loaded.icons.size).toBe(25);
  });

  it("loads a catalog of another game", () => {
    const dir = catalogDir([achievement("one")], { "one.svg": ICON });
    expect(loadAchievements(dir, "test").list[0].key).toBe("one");
  });

  it("refuses a catalog of another game slug", () => {
    const dir = catalogDir([achievement("one")], { "one.svg": ICON });
    expect(() => loadAchievements(dir, "other")).toThrow();
  });

  it("refuses a key used twice", () => {
    const dir = catalogDir([achievement("one"), achievement("one")], {
      "one.svg": ICON,
    });
    expect(() => loadAchievements(dir, "test")).toThrow("used twice");
  });

  it("refuses an icon that is not an outline of paths", () => {
    const dir = catalogDir([achievement("one")], {
      "one.svg": ICON.replace('<path d="M4 4h16v16H4z"/>', '<circle r="3"/>'),
    });
    expect(() => loadAchievements(dir, "test")).toThrow("outline");
  });

  it("refuses an achievement without English", () => {
    const dir = catalogDir(
      [{ ...achievement("one"), title: { ru: "Название" } }],
      { "one.svg": ICON }
    );
    expect(() => loadAchievements(dir, "test")).toThrow();
  });

  it("refuses an icon no achievement uses", () => {
    const dir = catalogDir([achievement("one")], {
      "one.svg": ICON,
      "two.svg": ICON,
    });
    expect(() => loadAchievements(dir, "test")).toThrow("two.svg");
  });
});
