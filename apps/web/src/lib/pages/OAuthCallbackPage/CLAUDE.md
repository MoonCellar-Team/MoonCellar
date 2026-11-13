# OAuthCallbackPage

Where the provider sign-in lands after the API finished the exchange: it reads the query the API
appended, fills the store, shows the two-factor step when the account needs it, or explains why
the sign-in did not happen.

## Routes

- `mooncellar.space/auth/oauth` — `src/app/auth/oauth/page.tsx`, metadata title "Signing in",
  `noindex`. The route is a `Suspense` wrapper only (`useSearchParams`).

## Data

The API redirects here with one of four `status` values:

| Query | What the page does |
|---|---|
| `status=signed-in&userId=…` | `authUpdate(userId)`; the store's `profile` then sends the visitor home |
| `status=two-factor&method=email\|app&ticket=…` | renders `AuthModal isPage initialStep="two-factor"` with the ticket; the code is confirmed by `POST /auth/two-factor/ticket` |
| `status=linked&provider=…` | toasts the link and returns to Settings |
| `status=error&error=<code>[&provider=…]` | maps the code to a sentence, with "Try again" and "Back to settings" |

## Composition

A centred `Box` at `--status-card-width`, the same frame as `StatusLoginPage`: a heading and one
line of copy, then the code step when the API asked for one. Nothing else is on the page.

## Rules and gotchas

- **The API cannot answer JSON for a failed sign-in — it is a browser navigation** — so every
  outcome is a `302` with `error=<code>`, and the copy for those codes lives here.
- **It leaves only when the store's `profile` changes after mount** (`useAuthStore.subscribe`),
  never because a profile is already there: the store is persisted, and a stale profile would
  send the visitor home before `authUpdate` ran.
- The linked branch redirects immediately; the success toast survives the client navigation.
- A provider link with no ticket renders the loading card and does nothing else, which is what a
  reload of the callback URL does.
