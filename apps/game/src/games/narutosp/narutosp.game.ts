import { loadAchievements } from "../achievements";
import type { IGameDefinition } from "../game-definition";

// The port's own name, as Glassline for rooftops: the game keeps its published title, the port
// is shown under its own name.
export const narutosp: IGameDefinition = {
  slug: "narutosp",
  name: "Bamboo Duel",
  scoreOrder: "desc",
  scoreUnit: "points",
  // The port keeps no leaderboards yet: one board id the game accepts, so a score can be
  // submitted when it does.
  board: /^default$/,
  replay: {
    required: false,
    maxBytes: 256 * 1024,
  },
  // The port's catalog (its config/achievements/narutosp.json), our own texts and icons
  achievements: loadAchievements(__dirname, "narutosp"),
};
