# SignInMethods

The "Sign-in methods" section of the profile settings: the provider accounts linked to the
viewer, with Link and Unlink, and — for an account that has no address — the form that adds an
e-mail and confirms it with the code from the letter.

## Data

- `GET /auth/oauth` (`authAPI.getOAuthAccounts`) under the `["oauth-accounts"]` query key returns
  the providers this server is configured for, the linked ones, `hasPassword` and `email`.
- `DELETE /auth/oauth/:provider` (`authAPI.unlinkOAuth`) answers the same shape, which replaces
  the cached query directly.
- `POST /auth/email` sends the code, `POST /auth/email/confirm` confirms it; the profile is
  re-read afterwards so the Account section shows the address.

## Rules and gotchas

- **Link is `Button href` to `authAPI.getOAuthStartUrl(provider, { link: true })`** — the browser
  leaves the site for the API, which returns to `/auth/oauth` and then to this page. A request
  cannot do it: the session cookies are set by a redirect, not by a JSON answer.
- **Unlink is disabled while it would leave the account without a way to sign in** — no
  password sign-in (missing password, or an unconfirmed address) and no other provider. The API
  answers `409` with the same rule; the tooltip says what to do first.
- A provider the server has no credentials for is listed as "Not set up on this server yet"
  instead of a button that would land on an error page.
- The e-mail form appears only while `accounts.email` is empty. An address is never replaced
  from here: `PATCH /user/email` would set one without proving it belongs to the viewer.
- Successes are toasted here; failures are toasted by the agent interceptor.
