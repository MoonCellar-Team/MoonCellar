# Sign-in with Google, GitHub and Reddit

A MoonCellar account signs in with a password, a provider account, or both. A provider account
is linked to exactly one MoonCellar account, and the site never asks for a provider password.

The three providers live in the auth module (`apps/api/src/module/auth/oauth`), and the flow is
a plain OAuth 2.0 authorization-code exchange written against `fetch` — not `passport-google-oauth20`
and friends. Passport's OAuth strategies keep their `state` in an express session the API does
not have, and Reddit has no maintained strategy; the flow here carries its own signed `state`
and reads every provider's profile in one place.

## The flow

1. `GET /auth/oauth/:provider` (`google`, `github` or `reddit`) answers a `302` to the
   provider's consent screen. Add `?link=1` while signed in to link a provider to the current
   account instead of signing in with it; without a session the flag is ignored and the request
   signs in.
2. The provider redirects the browser to `GET /auth/oauth/:provider/callback?code=…&state=…`,
   which exchanges the code, finds or creates the account and answers a `302` to
   `/auth/oauth` on the site (`FRONT_URL`).
3. The site's `/auth/oauth` page reads the query and finishes the job: `status=signed-in`
   refills the store and goes home, `status=two-factor` shows the code step, `status=linked`
   returns to Settings, and `status=error` explains what went wrong.

The state is a JWT signed with `JWT_SECRET` (`scope: "oauth-state"`, ten minutes) carrying the
provider, the mode, the viewer id when linking, and a nonce. The same nonce goes into an
`httpOnly` `oauthStateMoonToken` cookie scoped to `/auth/oauth`; the callback refuses a state
whose nonce is not the cookie's, which is what stops a link to the callback from signing a
visitor into someone else's account.

A signed-in account with two-factor sign-in still needs its second factor: the callback instead
issues a ticket (a JWT with `scope: "two-factor-ticket"`, ten minutes) and redirects to the code
step, and `POST /auth/two-factor/ticket` verifies the ticket and the code before it sets the
cookies. Both `JwtStrategy` and `JwtRefreshStrategy` refuse a token carrying a `scope`, so a
ticket cannot be used as a session.

## Creating and linking accounts

- A provider account already linked to a user signs that user in.
- **A provider e-mail that the provider marks verified links to the existing account with that
  address, and never creates a duplicate.** Google's `email_verified` and GitHub's primary
  verified e-mail count; Reddit returns none, so a Reddit-only account has no e-mail until its
  owner adds one in Settings (`POST /auth/email`, then `POST /auth/email/confirm` with the
  letter's code).
- An existing account whose own e-mail is not confirmed is not linked: sign in with it and
  confirm the address first.
- A new account takes its user name from the provider profile, stripped to `[a-zA-Z0-9_]` and
  cut to 15 characters; a taken name gets a number (`john2`) or a random tail (`john_1f3c9a20`).
  The account is created with `emailVerified: true` only when the provider verified its e-mail.
- A provider avatar is not imported: `users.avatar` holds Space URLs and `next/image` only loads
  the hosts in `images.remotePatterns`.

## Settings

Settings lists every provider this server is configured for, with **Link** and **Unlink**. The
last way to sign in cannot be removed: an account whose password cannot sign it in (no
password, or no confirmed e-mail) and whose only provider would be unlinked answers
`409 This is the only way you sign in`. Link another provider first.

## Environment

Each provider needs a client id and a secret in `HOST_ENV_API`; the full list and the callback
URLs per environment are in [deploy-env.md](deploy-env.md). A provider without both values is
not offered: `/auth/oauth/:provider` answers a redirect to `/auth/oauth?status=error&error=provider-unavailable`
and Settings marks its row "Not set up on this server yet".

The redirect URI sent to the provider is `<API_PUBLIC_ORIGIN>/auth/oauth/<provider>/callback`,
taken from the request (`X-Forwarded-Proto` and `Host`, which nginx passes), so it is
`https://api.mooncellar.space/…` in production and `http://localhost:3228/…` locally. Register
exactly that address in each provider's app settings.

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /auth/oauth` | cookie | The configured providers, the linked ones, whether a password signs in, the e-mail |
| `GET /auth/oauth/:provider[?link=1]` | cookie, optional | Start signing in, or linking while signed in |
| `GET /auth/oauth/:provider/callback` | state + cookie | Finish the exchange, set the cookies and redirect to the site |
| `DELETE /auth/oauth/:provider` | cookie | Unlink a provider |
| `POST /auth/two-factor/ticket` | ticket | Finish an OAuth sign-in with a two-factor code |
| `POST /auth/email` | cookie | Add an e-mail address to an account without one; sends a code |
| `POST /auth/email/confirm` | cookie | Confirm the added address with that code |

## The e-mail index

`users.email` is unique only where it exists: a Reddit-only account has no address, and MongoDB
indexes a missing field as `null`, so the former unique index accepted exactly one such user.
`AuthService.onModuleInit` drops that index when it is not partial and creates
`{ email: 1 }` unique with `partialFilterExpression: { email: { $exists: true } }`. It runs on
every start and is a no-op once the index is partial.
