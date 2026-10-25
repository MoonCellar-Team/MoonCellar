# Game sign-in

The game ports sign in with a MoonCellar account the way TV apps do: no password is typed in the
game. The launcher asks the API for a code, shows it (and a QR code of the link), and opens
`mooncellar.space/link`; the player confirms the code there with the account they are signed in
with — on the computer or on a phone. The launcher then receives a long-lived **game token**.

## Flow

1. `POST /auth/game/device` `{ deviceName }` → `{ deviceCode, userCode, verificationUrl,
verificationUrlComplete, expiresIn, interval }`. `userCode` is eight characters
   (`ABCD-EFGH`, no `0/O/1/I`), valid for ten minutes; `deviceCode` stays in the launcher.
2. The launcher polls `POST /auth/game/device/token` `{ deviceCode }` every `interval` seconds:
   `{ status: "pending" }` until the code is confirmed, then `{ status: "approved", token,
account }` once — the code is deleted after that. An expired code answers 410, an unknown
   one 404.
3. The site page `/link` reads `GET /auth/game/device/:userCode` (the device name to show) and
   confirms with `POST /auth/game/device/approve` `{ userCode }`. Both need the site session.
   The code is accepted in any case and with or without the dash.

## Game tokens

- A game token is a JWT `{ id, sid, typ: "game" }` valid for a year, signed with
  `JWT_SECRET + ":game"`. The different key keeps it from ever working as the site's
  `accessMoonToken` cookie, and a site token from working as a game token.
- Every token belongs to a game session (`game_sessions`: user, device name, last use,
  revocation). `GET /auth/game/sessions` lists the active ones of the signed-in user,
  `DELETE /auth/game/sessions/:id` signs that device out, and the game signs itself out with
  `POST /auth/game/token/revoke` `{ token }`.
- Services check a token with `POST /auth/game/token/introspect` `{ token }` →
  `{ active, sessionId, account: { id, userName, avatar } }`. A revoked session, a deleted user
  or a bad signature answer `{ active: false }`, so signing a device out on the site cuts the
  game off at its next check. The game service (`apps/game`) asks this endpoint instead of
  holding the JWT key itself, and `apps/game` repeats the device sign-in under `/account/*`
  ([game-service.md](game-service.md)), so a game needs only `game.mooncellar.space`.
- The device sign-in and introspection routes have their own, stricter rate limits on both hosts,
  and the game service never asks about a token that is not a game JWT; the numbers are in
  [rate-limits.md](rate-limits.md).
