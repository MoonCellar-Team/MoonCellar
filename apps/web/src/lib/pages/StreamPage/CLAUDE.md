# StreamPage

The host side of MoonStream, the admin-only screen-sharing module. It lives at `/admin/stream`,
under the admin segment, so the server layout already gates it on the `admin` role; the
`/stream` Socket.IO namespace checks the role again on the handshake.

## Routes

- `/admin/stream` — `src/app/admin/stream/page.tsx` renders `<StreamPage />`.
- `/admin/stream/watch/[code]` — the viewer side, `pages/StreamWatchPage`; `/admin/stream/watch`
  renders the same page without a code, ready for one to be typed.

## Data

- `useStreamHost` (`features/stream/model`) owns the socket, the `RTCPeerConnection`, the room
  code and the local capture stream. It creates a room on mount, keeps the code while the tab is
  open, and negotiates only when a viewer is present and a source has been chosen.
- `useStreamStats` polls `getStats()` once a second for resolution, frame rate, bitrate, RTT and
  the selected candidate pair (`relay` or direct).
- The socket is the `/stream` namespace on the shared account `Manager`
  (`shared/socket/stream.socket.ts`), so it carries the same `accessMoonToken` cookie.

## Composition

1. `Box` → `Breadcrumbs` (Home / Admin / MoonStream).
2. Page header: eyebrow, title, description, "Admins only" badge and a "Watch a stream" link to
   the viewer page.
3. `StreamHost`:
   - stage: local preview, empty state, live/preview/waiting badge, stats, fullscreen;
   - side: code, viewer link with an icon "Open viewer" and "Copy link", room status, quality
     presets, sound source, audio toggle;
   - actions: choose a source, share another, stop, remove the viewer, start a new stream;
   - platform note from `capturePlatformNote()`.

## Rules and gotchas

- **The host never adds a viewer's stream to its own preview; the preview is muted.** The same
  `MediaStream` is sent to the viewer through a send-only transceiver, so muting the element is
  what stops the host from hearing itself.
- **A room outlives the capture but not the tab.** Stopping the capture ends the room; the viewer
  leaves and the host keeps the page and can start a new code. Closing the tab leaves the room
  through `stream:leave`, and the viewer receives `stream:closed`.
- **`startCapture` always calls `getDisplayMedia` from a click.** Browsers require a user gesture,
  and the OS picker is the only place the host can choose a screen, a window or a tab; there is
  no source list in the page.
- **A relayed session is close to coturn's `--max-bps` cap.** The path badge and the "Relay safe"
  preset exist for that; do not raise the preset default without checking the relay config.
- **Sound is the platform's, and on Linux it is a tab's only.** Chromium captures the desktop's
  audio on Windows and ChromeOS; on Linux and macOS it captures only a browser tab's, so a screen or
  a window share there always arrives without an audio track. The checkbox label and the
  explanation are `capturePlatformNote()`'s `audioLabel`/`audioNote` — never hard-code "system
  audio" in the widget and never remove the `audioShared` check that disables the mute toggle.
- **`audioTrackRef` is the one track that is sent, not `getAudioTracks()[0]`.** The capture stream
  can hold the screen's own audio and an input device's at the same time, so `addAudioDevice` /
  `selectScreenAudio` move the ref and `replaceTrack` it; reading the stream's first track sends
  the wrong one after a switch. The chosen input can be picked before anything is shared and
  survives a re-share: `capture()` removes it from the old stream before stopping that stream and
  adds it to the new one, so the device is not reopened, and `stopLocal()` stops it because it may
  not belong to any stream yet. The mute toggle is `!!stream && audioShared` — before a capture
  there is nothing to mute and the button must not claim otherwise.
- **"Open viewer" is an `isOnlyIcon` link-mode `Button` in the link row, with `target="_blank"`
  and the relative href `/admin/stream/watch/<code>`.** Leaving the host page ends the room, so a
  same-tab navigation closes the stream the host opened the page to watch; the href stays relative
  while the copied link keeps `FRONT_URL`, so the button opens the host's own origin in development
  and the copy stays pasteable for a colleague. The tooltip is its only accessible name, so it
  cannot be dropped. The alternatives are recorded in
  [`docs/mockups/stream-viewer-entry.html`](../../../../../../docs/mockups/stream-viewer-entry.html).
- **"Watch a stream" in the page header is the way to the code form for an admin who was given a
  code by someone else.** The invite panel's link exists only once this host has a room, so without
  it `/admin/stream` has no path to `/admin/stream/watch`; the header link always points there,
  with no code, and opens in a new tab for the same reason as "Open viewer" — a same-tab
  navigation would end the host's room. It is a link-mode `Button`, not an `onClick` with the
  router.
- **List audio inputs through `listAudioInputs()`, never `enumerateDevices()` directly.** Device
  labels are empty until the page has microphone access, and the function asks for it once. The
  Sound field is a `Dropdown` that is always on screen — no "add a device" button — because an
  empty list would leave a button as the only way in: while the list is empty it keeps
  `isWithSearch` so the field stays clickable, and `onLoad` fetches the devices; a granted
  permission is filled on mount instead, so a returning host sees the list at once. Chromium hides
  PulseAudio/PipeWire monitor sources, so the list is ordinary inputs only — the Linux workaround
  (a remapped virtual source) belongs in `docs/stream.md`, not in a promise the UI cannot keep.
- **The input may be switched while a stream is live.** `addAudioDevice` `replaceTrack`s the new
  track onto the existing audio sender, so nothing renegotiates and the viewer keeps the same audio
  track; disabling the list during a stream would be a rule the transport does not have.
- **"No sound" is a source, not a mute.** It is the first item of the list and calls
  `silenceAudio()`, which stops the device track and sends `replaceTrack(null)`; the mute toggle
  keeps the track and only flips `enabled`. Collapsing the two would make "no audio" and "muted
  audio" impossible to tell apart, and `audioSilent` is what the field reads to show the item.
- **The link row is measured by the viewer URL, not by taste.** `https://mooncellar.space/admin/stream/watch/<code>`
  needs ~310 px of text at 12 px, and the field adds 26 px of padding and borders on top. That is
  why the sidebar is `minmax(340px, 1fr)` against `minmax(0, 1.5fr)` for the preview — narrowing it
  breaks the URL, not just its look. The field keeps `flex: 1 1 320px` and the two actions travel
  as one `.link__actions` group, so below ~1300 px they move to a second line together instead of
  leaving the icon stranded on the first one.
