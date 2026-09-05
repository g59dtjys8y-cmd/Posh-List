# Posh-List

A shared household shopping list. No accounts, no sign-up — one person creates a list, everyone else opens the link and lands straight on the live, shared list.

## Screens

- **List** — items grouped by supermarket aisle in walking order, a coloured rail per aisle, a dot showing who added each item, and a live "who's here" presence line. A "+ Add the usuals" shelf-ticket rebuilds next week's list in one tap; a "someone's shopping now" bar nudges the house to add what's missing.
- **Add from a recipe** — paste recipe text from anywhere (a blog, a note, a text someone sent) and get back an editable, checkable list of what it found in the ingredients — edit any line, remove ones you don't want, add one it missed — before anything touches the real list. Looks for an "Ingredients" heading first; falls back to a per-line guess (skips the title, skips lines that read like a method step) when there isn't one.
- **Your usuals** — every item name the list has ever added, with a running count; star one to force it on or off the usuals regardless of count.
- **Share** — the room link, a copy button, a QR code, and who's currently connected. Meant to take five seconds.
- **In the shop** — one-handed mode: bigger tap targets, a live progress readout, and a toast when someone at home adds something while you're out. "Finish shop" produces a shareable recap card.
- **Layouts** — save an aisle order per supermarket you actually use, switch between them, drag to reorder.
- **Offer banner** — a dismissible strip for a single retailer offer, dismissed per device.

Anyone who joins via a share link and uses the list is offered a one-tap "start your own house's list", seeded with the aisle order they just learned.

Recipe apps can add ingredients straight onto a list, given its share link — see [External API](#external-api-adding-items-from-another-app) below.

## Requirements

- Node.js **22.5+** (the server uses the built-in `node:sqlite` module, which needs it)
- Internet access for `npm install` (see [Architecture notes](#architecture-notes) for what actually gets installed)

## Setup

```bash
cd client && npm install
cd ../server && npm install   # no-op today — the server has zero npm dependencies
cd ..
node dev.js
```

Then open `http://localhost:8787`.

Want your family actually using it? See [DEPLOY.md](./DEPLOY.md) for how to put it on a real URL.

`node dev.js` runs two things together: an esbuild watcher that rebuilds the client bundle on save, and the Node server (REST + WebSocket + static file serving) on port 8787. Open the same URL in a second tab (or a private window, to get a separate identity) to see the live sync in action.

## Architecture notes

- **Frontend**: React 19, bundled with esbuild (`client/build.js`) instead of Vite, and a small hand-rolled `pushState` router (`client/src/router.jsx`) instead of `react-router-dom`. Plain CSS custom properties for design tokens (`client/src/styles/tokens.css`) — no CSS framework, the palette is small and exact.
- **Backend**: Node core only — `node:http` for the server, `node:sqlite` (`DatabaseSync`) for storage, and a small hand-rolled WebSocket implementation (`server/wsServer.js`) instead of Express/`ws`. Zero npm dependencies.
- **QR codes**: a from-scratch QR encoder (`client/src/lib/qrcode.js`, ISO/IEC 18004, versions 1–6, level M) instead of the `qrcode` package.
- **Drag-to-reorder** on the Layouts screen: plain pointer events, no `@dnd-kit`.

These were built as hand-rolled equivalents to the originally specified stack (Vite, Express, `ws`, `better-sqlite3`, `react-router-dom`, `@dnd-kit/core`, `qrcode`, `vite-plugin-pwa`) because the environment this app was first built in had no npm registry access. They're tested and working as they are — there's no requirement to change them. If you'd rather use the original packages, it's a mechanical swap: the component and route logic doesn't depend on which implementation sits underneath.

## Data model

Each list is a "room" identified by a short slug in its URL (e.g. `/r/8fk3q2`) — the slug is the only thing gating access, there's no login. Joining asks for a display name only, stored per device in `localStorage`, and assigns a colour (starting from the app's two base person colours, extending by rotating hue for a third or later person). Room state — items, people, and saved aisle layouts — lives server-side in SQLite and is broadcast to everyone connected to that room over WebSocket.

## External API: adding items from another app

`POST /api/rooms/:slug/items` lets an external app add items to a list without an open WebSocket connection — this is what [Posh Nosh](https://github.com/g59dtjys8y-cmd/Posh-Nosh) (a recipe app by the same author) uses for its "add ingredients to shopping list" feature, given a room's share link.

```
POST /api/rooms/8fk3q2/items
Content-Type: application/json

{ "items": [{ "name": "2 cups flour" }, { "name": "200g chicken breast" }], "source": "Posh Nosh" }
```

- `items` — required, up to 100 per call. Each needs `name` (a free-text string, used as-is); `qty` (integer, defaults to 1) and `aisleKey` (one of the seven keys in `server/aisles.js`) are optional — an omitted or invalid `aisleKey` is guessed from the item name via a keyword heuristic (`guessAisleKey`), falling back to `cupboard`.
- `source` — optional, up to 40 characters, shown in the "X added Y" toast to everyone with the list open (defaults to "Posh Nosh" since that's the only caller today).
- Response: `201` with `{ "added": [{ id, name, qty, aisleKey }, ...] }` (empty items are silently dropped, so this can be shorter than the request).
- Added items broadcast over WebSocket exactly like a live `add_item` message, so anyone with the list open sees them appear immediately — no polling needed on the caller's end.
- CORS is open (`Access-Control-Allow-Origin: *`) on all `/api/*` routes — a room's slug is its only access control (same trust model as the share link itself), and there's no auth token to leak.

## Deliberately not in this app

Accounts and profiles, prices or spend tracking, meal planning, chores, calendars, and any advertising beyond the one designed offer banner.
