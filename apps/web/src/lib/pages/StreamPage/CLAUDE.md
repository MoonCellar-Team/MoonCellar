# StreamPage

The host side of MoonStream, the admin-only screen-sharing module. It lives at `/admin/stream`,
under the admin segment, so the server layout already gates it on the `admin` role; the
`/stream` Socket.IO namespace checks the role again on the handshake.

## Routes

- `/admin/stream` — `src/app/admin/stream/page.tsx` renders `<StreamPage />`.
- `/admin/stream/watch/[code]` — the viewer side, `pages/StreamWatchPage`.

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
2. Page header: eyebrow, title, description, "Admins only" badge.
3. `StreamHost`:
   - stage: local preview, empty state, live/preview/waiting badge, stats, fullscreen;
   - side: code, viewer link, room status, quality presets, audio toggle;
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
