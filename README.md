# Posh-List

A shared household shopping list. No accounts, no sign-up — one person creates a list, everyone else opens the link and lands straight on the live, shared list.

## Screens

- **List** — items grouped by supermarket aisle in walking order, a coloured rail per aisle, a dot showing who added each item, and a live "who's here" presence line. A "+ Add the usuals" shelf-ticket rebuilds next week's list in one tap; a "someone's shopping now" bar nudges the house to add what's missing.
- **Your usuals** — every item name the list has ever added, with a running count; star one to force it on or off the usuals regardless of count.
- **Share** — the room link, a copy button, a QR code, and who's currently connected. Meant to take five seconds.
- **In the shop** — one-handed mode: bigger tap targets, a live progress readout, and a toast when someone at home adds something while you're out. "Finish shop" produces a shareable recap card.
- **Layouts** — save an aisle order per supermarket you actually use, switch between them, drag to reorder.
- **Offer banner** — a dismissible strip for a single retailer offer, dismissed per device.

Anyone who joins via a share link and uses the list is offered a one-tap "start your own house's list", seeded with the aisle order they just learned.

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

## Deliberately not in this app

Accounts and profiles, prices or spend tracking, meal planning, chores, calendars, and any advertising beyond the one designed offer banner.
