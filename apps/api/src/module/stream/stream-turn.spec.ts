import {
  turnCredentials,
  normalizeTurnUrl,
  stunUrls,
  turnUrls,
} from "./stream-turn";

describe("stream TURN credentials", () => {
  it("signs the expiry and the room code with the shared secret", () => {
    const turn = turnCredentials(
      "secret",
      ["turn:relay:3478"],
      "ABC234",
      0,
      3600
    );

    expect(turn).toEqual({
      urls: ["turn:relay:3478"],
      username: "3600:ABC234",
      credential: "sZbQ6hIucen1hBUQFrXdI/rnn2c=",
      ttl: 3600,
    });
  });

  it("adds the scheme and the UDP transport the deploy omits", () => {
    expect(normalizeTurnUrl("game.mooncellar.space:3478")).toBe(
      "turn:game.mooncellar.space:3478?transport=udp"
    );
    expect(normalizeTurnUrl("turn:relay:3478")).toBe(
      "turn:relay:3478?transport=udp"
    );
    expect(normalizeTurnUrl("stun:relay:3478")).toBe("stun:relay:3478");
  });

  it("derives STUN from the relay when STUN_URLS is empty", () => {
    const turns = turnUrls("game.mooncellar.space:3478");

    expect(stunUrls(undefined, turns)).toEqual([
      "stun:game.mooncellar.space:3478",
    ]);
    expect(stunUrls("example.test:3478", turns)).toEqual([
      "stun:example.test:3478",
    ]);
  });
});
