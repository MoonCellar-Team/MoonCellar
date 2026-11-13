# AuthModal

The sign-in / sign-up form shown in a modal. It switches between registration and login,
validates with `createAuthSchema` (zod) and calls `login`/`signup` from the shared `useAuth`
hook. A successful sign-up does not sign the user in: the modal moves to a code step that
confirms the e-mail, and a sign-in on a two-factor account moves to a code step as well. Under
the form sit the provider buttons, which leave the site for the API.

## When to use

- Open it with `openAuthModal()` whenever a guest triggers something that needs an
  account (the header avatar, `useRequireAuth` in the game community).
- Do not embed it inline in a page: its close button calls `modal.close()`, which only makes
  sense inside `ModalsConnector`. The one exception is `isPage`: the bare sign-in form, without the
  modal's frame, background, close button and sign-up switch — the page frames it, as the status hub's
  sign-in card does (`pages/StatusLoginPage`: a `Box` with the logo and heading above it).
- Do not build a second login form; extend this one.

## API

| Prop       | Type      | Default | Purpose                                                                                                                                                                        |
| ---------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isSignIn` | `boolean` | `false` | Open in login mode instead of sign-up; the user can still switch.                                                                                                              |
| `isPage`   | `boolean` | `false` | Sign in only, as a bare form for a page to frame: stacked labelled fields, the error line and a full-width submit; no modal frame, background, close button or sign-up switch. |
| `initialStep` | `"form" \| "verify-email" \| "two-factor"` | `"form"` | Which step to render first. Meant for Storybook: the code steps are otherwise reached only after a submit. |
| `initialEmail` | `string` | `""` | The address the code steps say the code was sent to; Storybook only, like `initialStep`. |
| `initialTwoFactorMethod` | `"email" \| "app"` | `"email"` | Which two-factor code the step asks for; the OAuth callback passes the method the API named. |
| `twoFactorTicket` | `string` | – | Set with `initialStep: "two-factor"`: the code is confirmed against `POST /auth/two-factor/ticket` instead of e-mail + code. The OAuth callback renders it this way after the account turns out to have two-factor sign-in. |

`openAuthModal(props?)` passes the same props.

| Export             | Type                                 | Purpose                                                                                                                       |
| ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `AuthModal`        | `FC<{ isSignIn?: boolean }>`         | The form itself. Opens in sign-up mode unless `isSignIn`.                                                                     |
| `createAuthSchema` | `(isRegister: boolean) => ZodObject` | Login schema, or the stricter sign-up schema (username 3–15 `[a-zA-Z0-9_]`, password 6–100). Not re-exported from the barrel. |
| `AuthSchema`       | type                                 | Inferred form values (`userName?`, `email`, `password`).                                                                      |

## Usage

```tsx
import { AuthModal } from "@/src/lib/shared/ui/AuthModal";
import { modal } from "@/src/lib/shared/ui/Modal";

<button type="button" onClick={() => openAuthModal()}>
  Sign in
</button>;
```

## Rules and gotchas

- Requires `ModalsConnector` (the `#modals` root) to be mounted; it is in `Layout`. Without it
  `modal.open` does nothing.
- Success closes every open modal: `useAuth().authUpdate` calls `modal.close()` without an id,
  so anything stacked beneath the auth modal goes too.
- The schema is chosen per submit from `isRegister`; switching modes calls `reset()` and
  clears errors, so typed values are lost on purpose.
- `onSubmit` copies every `FormData` entry into the form with `setValue` before validating,
  so browser autofill that bypasses React's change events is still submitted.
- The submit button's pending state is `Button isLoading`, driven through `useMinimumLoading`
  so it stays visible for a minimum time even on a fast response. Do not bring back a `Loader`
  plus a hidden label inside the button.
- Every control is a `Button`: the mode switch is a `type="button"` transparent compact button
  (it must not submit the form), and the close control is an icon-only transparent button with
  the "Close" tooltip that calls `modal.close(AUTH_MODAL_ID)`.
- A failed login or sign-up shows the API's `message` (or a fallback) under the inputs. The
  agent's response interceptor toasts the same error as well; the inline line exists so the
  message stays next to the form.
- The username field is unmounted in login mode; the login schema keeps `userName` optional
  for that reason.
- A successful sign-up moves to the `verify-email` step without signing in: the API sends a
  6-digit code and the modal asks for it, with a "Resend code" action. `verifyEmail` signs in
  only after the code is confirmed.
- A sign-in on an account with two-factor moves to the `two-factor` step: it asks for the
  e-mail code or the authenticator/backup code, whichever the API names in the challenge. A
  successful code signs in and closes the modal through `authUpdate`.
- Both code steps accept any non-empty value; the API decides whether a 6-digit code, an
  authenticator code or a backup code is valid. A step can go back to the form without
  clearing the typed e-mail.
- The provider buttons are `Button href` links to `PUBLIC_API_URL/auth/oauth/<provider>`, not
  requests: the API answers redirects and sets the cookies itself. They are hidden in `isPage`
  mode, whose page carries a `next` target the provider redirect cannot keep.
- Storybook shows them in `Inline` and `SignIn`; no story submits or follows a link.

## Storybook

`Shared/AuthModal`: `Inline`, `SignIn`, `Page`, `InModal`, `CodeStep`, `TwoFactorStep`,
`TwoFactorTicketStep`. The code steps are rendered through `initialStep`/`initialEmail`, and
the ticket step through `twoFactorTicket` — the shape `/auth/oauth` renders. No story submits —
submitting would hit the auth API.
