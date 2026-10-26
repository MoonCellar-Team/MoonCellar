import { loadAchievements } from "../achievements";
import type { IGameDefinition } from "../game-definition";
import { checkEnds, checkRun, endsOf, parseGhost } from "./ghost";
import { checkLevel } from "./level";

export const rooftops: IGameDefinition = {
  slug: "rooftops",
  name: "Glassline",
  // The iOS version's page in the site's catalogue
  siteGame: "mirrors-edge",
  playUrl: "https://play.mooncellar.space/glassline/",
  scoreOrder: "asc",
  scoreUnit: "ms",
  // The game's levels, and player levels `u<levelId>v<version>` (levelBoard)
  board: /^(level-([1-9]|[1-9][0-9])|u[0-9a-f]{24}v[1-9][0-9]{0,3})$/,
  replay: {
    required: true,
    maxBytes: 256 * 1024,
    check: (replay, score, accepted) => {
      const run = parseGhost(replay);
      if (typeof run === "string") return run;
      const ends = accepted.flatMap((data) => {
        const other = parseGhost(data);
        return typeof other === "string" ? [] : [endsOf(other)];
      });
      return checkRun(run, score) ?? checkEnds(run, ends);
    },
  },
  levels: {
    maxBytes: 128 * 1024,
    check: checkLevel,
  },
  storage: {
    save: {
      maxFileBytes: 1024 * 1024,
      maxFiles: 64,
      maxBytes: 4 * 1024 * 1024,
    },
    skins: {
      maxFileBytes: 8 * 1024 * 1024,
      maxFiles: 256,
      maxBytes: 64 * 1024 * 1024,
      maxFolders: 10,
    },
    levels: {
      maxFileBytes: 512 * 1024,
      maxFiles: 400,
      maxBytes: 32 * 1024 * 1024,
    },
    prefs: {
      maxFileBytes: 4 * 1024 * 1024,
      maxFiles: 8,
      maxBytes: 8 * 1024 * 1024,
    },
  },
  // The port's catalog (its config/achievements/rooftops.json), our own texts and icons
  achievements: loadAchievements(__dirname, "rooftops"),
};
