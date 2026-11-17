# StreamWatchPage

The viewer side of MoonStream. It lives under `/admin`, so it is admin-only like the host page;
the `/stream` socket checks the role again on the handshake.

## Routes

- `/admin/stream/watch/[code]` — `src/app/admin/stream/watch/[code]/page.tsx` reads the code and
  renders `<StreamWatchPage code={code} />`.
- `/admin/stream` — the host page, `pages/StreamPage`.

## Data

- `useStreamViewer` (`features/stream/model`) joins the room with `stream:join`, creates the
  `RTCPeerConnection` from the network the ack returns, answers the host's offer and relays ICE.
- `useStreamStats` shows the viewer's inbound stats.
- The code in the URL only prefills the field; the viewer still confirms with "Watch stream", so
  the connection starts from a click and the browser may play audio.

## Composition

- `Box` → `Breadcrumbs` (Home / Admin / MoonStream / Watch).
- No room yet: intro, six-character `StreamCodeInput`, "Watch stream".
- Joined: stage with video, live/waiting badge, mute, fullscreen, leave, stats.
- Host stopped, left or removed the viewer: `EmptyState` with the reason and a way to join another
  stream.

## Rules and gotchas

- **Do not auto-join from the URL.** Autoplay with audio needs the click, and a mistaken link
  should not put a viewer into a session before they read the code.
- **The viewer has no source list and no controls over the host.** Quality, audio and the shared
  surface belong to the host; the viewer can only mute, go fullscreen or leave.
- **`closed` is the only event that ends a session cleanly.** A dropped socket also closes the
  local peer, but the result is an error, not "the host stopped": the reason the viewer shows comes
  from the event when the server sent one.
