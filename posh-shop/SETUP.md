# Posh Shop — setup

## 1. Supabase project

`.env.local` already points at the project (`jjvctbvrttefrqkiocoh`). Two things to do
in the dashboard:

1. **Auth → Sign In / Providers → Anonymous sign-ins** → enable.
2. **SQL Editor → New query** → paste all of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → Run.

The migration is safe to re-run. It creates the tables, RLS policies, the RPCs
(`join_list`, `create_list`, `add_item`, `set_checked`, `delete_list`,
`restore_list`), adds `items` and `list_members` to the realtime publication, and
seeds the pinned **Shopping** list with eight aisles in walking order.

## 2. First device (the "installer")

Joining a list only happens through a share token — there is no other way in, by
design. So the first person needs the seeded list's token once:

1. Dashboard → **Table editor → lists** → copy `share_token` from the Shopping row.
2. On your phone, open `https://<app-host>/h/<that-token>` → pick a nickname → you're on.
3. From then on, use the **Share** screen to bring everyone else in.

## 3. Run locally

```bash
npm run dev
```

Then open http://localhost:3000/h/<share_token> for the first join.

## What's built so far

| Route            | Screen                                                        |
| ---------------- | ------------------------------------------------------------- |
| `/`              | Your lists (visited lists from this device + New list)       |
| `/h/[token]`     | Join by link — silent anon sign-in, nickname once            |
| `/l/[id]`        | The list — aisle grouping, realtime, add bar, tick, remove   |
| `/l/[id]/share`  | Share link, copy, native share, who's on it                  |

## Not built yet

- QR code on the Share screen
- In-shop one-handed mode (`/l/[id]/shop`)
- Offer banner + `offers` table wiring
- Offline write queue (IndexedDB) — currently optimistic updates only, no replay
- Swipe-to-delete on list cards (delete is a plain button / RPC for now)
- Regulars / one-tap staples screen (data is there: `known_items.is_regular`)
- Design pass against `../posh-shop-concept.html` (colours are wired, type/tickets aren't)
