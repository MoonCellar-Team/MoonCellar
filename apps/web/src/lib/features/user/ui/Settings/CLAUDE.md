# Settings

The profile settings form on `/user/<name>/settings`. One `CollapsibleSection` per group —
Account, Two-factor sign-in, Sign-in methods, Notifications, Steam, RetroAchievements, Game
devices, Profile page, Appearance, App, Preferences (geo-gated) and the Danger zone — with a
single Save that sends the changed fields.

## Data

- The profile comes from `useAuthStore().profile`; the form is reset from it whenever it changes.
- Profile edits go through `useUpdateProfileMutation`, which batches the changed description,
  avatar, background and `settings` payload and re-reads the profile afterwards.
- The two-factor section is `TwoFactorSettings`, which reads and writes through `authAPI`
  (`GET/POST /auth/two-factor*`) and refreshes its own `["two-factor"]` query; it does not go
  through the Save button.
- The Sign-in methods section is `SignInMethods` (`features/user/ui/SignInMethods`): linked
  providers with Link and Unlink, and the e-mail address of an account that has none.
- The Account section's e-mail field is `readOnly` and is not part of the Save; an account
  without an address adds one in Sign-in methods, through a code letter. The form schema keeps
  `email` optional for that reason — a required field would block every other save on a
  Reddit-created account.

## Rules and gotchas

- `settings` must stay a partial patch: the API merges it over the stored object, because
  `user.settings` is a Mixed field and assigning one key wipes the rest.
- `bgOpacity` lives in `user.settings`; the form keeps it as a percentage (0–100) and the
  `RangeSelector` previews through `settings.store`'s non-persisted `bgOpacityPreview`, cleared
  on unmount and on save.
- The adult-content toggle exists only when `useGeoStore` resolved and the country is not
  blocked; do not render it otherwise.
- The username field is shown but not saved: `useUpdateProfileMutation` sends only the
  description, the images and the settings, and a rename would move `/user/<name>`, so it needs
  a flow of its own.

## Two-factor sign-in

`TwoFactorSettings` (`features/user/ui/TwoFactorSettings`) shows the current method and switches
between off, e-mail codes and an authenticator app:

- E-mail: `setup` sends a code, `confirm` enables the method.
- App: `setup` returns the secret and `otpauth://` URI, which the component renders as a QR code
  (`QRCodeSVG` from `qrcode.react`), and `confirm` enables it and returns the one-time backup
  codes, shown once.
- Off: `disable/request` sends a code for the e-mail method, then `disable` turns it off after
  the code.

A failed request is toasted by the agent interceptor; success is toasted by the component.
