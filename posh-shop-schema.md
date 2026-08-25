# Posh Shop — data model and Supabase schema

Household shopping list. Next.js on Vercel, Supabase for data, realtime and identity.
Design constraint that drives everything: **the second person opens a link and is in.**

---

## The identity decision

"No account" doesn't mean "no identity". You still need a stable per-device identity for
two things: who added an item, and Realtime authorisation.

Use **Supabase anonymous sign-in**. It creates a real `auth.users` row and a real JWT, with
no email, password or user-visible step. Opening the link signs the device in silently,
then redeems the share token to join the list.

The alternative — passing the share token in a request header and matching it in RLS —
is simpler on paper but fights Realtime, which authorises subscriptions from the JWT, not
from custom headers. You'd end up polling. Not worth it.

Enable it under **Auth → Sign In / Providers → Anonymous sign-ins**.

---

## Tables

| Table | Holds |
|---|---|
| `lists` | The household lists, pinned order, share token, soft delete |
| `list_members` | Devices that have redeemed the link, with nickname and colour |
| `aisles` | Your store's sections, in walking order |
| `items` | The list itself |
| `known_items` | Learned autocomplete, aisle memory, and regulars |

Plus a bundled static file, `posh-shop-catalogue.json` — the starter item library.

```sql
create extension if not exists pgcrypto;

-- URL-safe ~72-bit token
create or replace function new_share_token() returns text
language sql volatile as $$
  select replace(replace(encode(gen_random_bytes(9), 'base64'), '+', '-'), '/', '_');
$$;

create table lists (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Shopping',
  share_token  text not null unique default new_share_token(),
  is_pinned    boolean not null default false,  -- the main list, always first, never deletable
  position     int not null default 100,
  archived_at  timestamptz,                     -- soft delete, purged after 30 days
  created_at   timestamptz not null default now()
);

-- exactly one pinned list
create unique index lists_one_pinned on lists (is_pinned) where is_pinned;

create table list_members (
  list_id      uuid not null references lists on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  display_name text not null,
  colour       text not null default '#1D6FE0',
  joined_at    timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table aisles (
  id        uuid primary key default gen_random_uuid(),
  list_id   uuid not null references lists on delete cascade,
  name      text not null,
  colour    text not null default '#5C646E',
  position  int  not null,
  unique (list_id, name)
);

create table items (
  id          uuid primary key,          -- generated on the client, see offline notes
  list_id     uuid not null references lists on delete cascade,
  name        text not null,
  qty         text,
  aisle_id    uuid references aisles on delete set null,
  checked     boolean not null default false,
  checked_at  timestamptz,
  checked_by  uuid,
  added_by    uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                -- soft delete, see offline notes
);

create index items_live_idx on items (list_id, aisle_id) where deleted_at is null;

create table known_items (
  list_id       uuid not null references lists on delete cascade,
  name_key      text not null,           -- lower(trim(name))
  display_name  text not null,
  aisle_id      uuid references aisles on delete set null,
  times_added   int  not null default 1,
  last_added_at timestamptz not null default now(),
  is_regular    boolean not null default false,
  primary key (list_id, name_key)
);
```

`known_items` is doing more work than it looks. It powers autocomplete, remembers which
aisle "chorizo" belongs in so you only categorise it once, and — with `is_regular` —
gives you the one-tap staples screen without a separate table.

---

## Making typing faster

`known_items` already does most of this — it's the learned half. The gap is the cold start:
on day one it's empty, so there's nothing to suggest.

Fill it with a **static starter catalogue**, not a table. `posh-shop-catalogue.json` ships
about 200 common UK grocery items, each already mapped to an aisle. Bundle it with the app.

Doing it client-side rather than as a Postgres lookup isn't laziness — autocomplete has to
work in a supermarket dead spot, and a server round-trip per keystroke doesn't. Two hundred
items is a few kilobytes; filter it in memory and results appear instantly.

**How a suggestion list gets built, in order:**

1. **Your regulars** — `known_items` where `is_regular`, matching the prefix. These are the
   things this household actually buys.
2. **Everything you've bought before** — the rest of `known_items`, ranked by
   `times_added desc, last_added_at desc`.
3. **The starter catalogue** — anything not already covered.

Prefix match first, then substring. Cache `known_items` into IndexedDB on load so the whole
thing works offline and survives a refresh.

**On add**, upsert into `known_items` so the app learns. The aisle comes from the catalogue
the first time and from memory after that, so you categorise anything unusual exactly once:

```sql
create or replace function add_item(
  p_id uuid, p_list uuid, p_name text, p_qty text, p_aisle uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare k text := lower(trim(p_name));
begin
  if not is_member(p_list) then
    raise exception 'not your list';
  end if;

  insert into items (id, list_id, name, qty, aisle_id, added_by)
  values (p_id, p_list, trim(p_name), nullif(trim(coalesce(p_qty,'')),''), p_aisle, auth.uid())
  on conflict (id) do nothing;

  insert into known_items (list_id, name_key, display_name, aisle_id)
  values (p_list, k, trim(p_name), p_aisle)
  on conflict (list_id, name_key) do update
    set times_added   = known_items.times_added + 1,
        last_added_at = now(),
        aisle_id      = coalesce(excluded.aisle_id, known_items.aisle_id),
        is_regular    = known_items.times_added + 1 >= 4;

  update items set aisle_id = coalesce(p_aisle,
    (select aisle_id from known_items where list_id = p_list and name_key = k))
  where id = p_id;
end $$;

grant execute on function add_item(uuid, uuid, text, text, uuid) to authenticated;
```

Four purchases promotes something to a regular, which is what feeds the one-tap staples
screen. Tune the threshold once you've used it for a month.

**Two parsing tricks worth having in the add field**, both client-side:

- **Quantity split.** "2 oat milk" or "oat milk x2" becomes name `Oat milk`, qty `×2`.
  Leading or trailing number, optionally with a unit — kg, g, ml, l, pack, bottles.
- **Comma multi-add.** "bread, milk, eggs" adds three items in one go. This is the single
  biggest speed-up when you're standing at an open fridge.

---

## Row level security

`is_member()` is `security definer` so that the policy on `list_members` doesn't
recurse into itself.

```sql
alter table lists        enable row level security;
alter table list_members enable row level security;
alter table aisles       enable row level security;
alter table items        enable row level security;
alter table known_items  enable row level security;

create or replace function is_member(l uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from list_members m
    where m.list_id = l and m.user_id = auth.uid()
  );
$$;

create policy list_read     on lists        for select using (is_member(id));
create policy member_read   on list_members for select using (is_member(list_id));
create policy member_self   on list_members for update using (user_id = auth.uid());

create policy aisle_rw on aisles
  for all using (is_member(list_id)) with check (is_member(list_id));
create policy item_rw on items
  for all using (is_member(list_id)) with check (is_member(list_id));
create policy known_rw on known_items
  for all using (is_member(list_id)) with check (is_member(list_id));
```

Note there is no insert policy on `lists` or `list_members` — joining happens only
through the RPC below, so a share token is the only way in.

---

## Joining by link

```sql
create or replace function join_list(token text, nickname text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare l uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select id into l from lists where share_token = token;
  if l is null then
    raise exception 'unknown link';
  end if;

  insert into list_members (list_id, user_id, display_name)
  values (l, auth.uid(), nickname)
  on conflict (list_id, user_id)
    do update set display_name = excluded.display_name;

  return l;
end $$;

grant execute on function join_list(text, text) to anon, authenticated;
```

Client flow on `/h/[token]`:

1. `supabase.auth.getSession()` — if none, `signInAnonymously()`
2. `rpc('join_list', { token, nickname })` — nickname prompted once, then cached
3. Subscribe and render

Rotating `share_token` revokes nothing on its own — members are already joined. To fully
reset, rotate the token *and* delete `list_members` rows other than your own.

---

## More than one list, and deleting them

The main shopping list is pinned: it sorts first, it can't be deleted, and it's the one the
share link points at. Everything else — Christmas, DIY, the butcher — is ordinary and
disposable. Sort by `is_pinned desc, position, created_at`.

Deletion is a soft archive rather than a `DELETE`, for the same reason items are: a device
that's been offline will otherwise resurrect rows it still thinks exist. Thirty days of
grace, then a purge.

```sql
create or replace function delete_list(p_list uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_list) then
    raise exception 'not your list';
  end if;
  if (select is_pinned from lists where id = p_list) then
    raise exception 'the main list cannot be deleted';
  end if;

  update lists set archived_at = now() where id = p_list and archived_at is null;
end $$;

create or replace function restore_list(p_list uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_list) then
    raise exception 'not your list';
  end if;
  update lists set archived_at = null where id = p_list;
end $$;

-- daily cron
create or replace function purge_archived_lists()
returns void
language sql security definer set search_path = public as $$
  delete from lists
   where archived_at is not null
     and archived_at < now() - interval '30 days';
$$;

grant execute on function delete_list(uuid), restore_list(uuid) to authenticated;
```

`lists` cascades to `list_members`, `aisles`, `items` and `known_items`, so the purge takes
everything with it. Filter `archived_at is null` in the app rather than in RLS — you still
need to read archived rows to offer the undo.

Add an update policy so lists can be renamed and reordered:

```sql
create policy list_update on lists
  for update using (is_member(id)) with check (is_member(id));
```

---

## Ticking off, and why it needs an RPC

Everything else can be last-write-wins. `checked` can't: a phone that ticked "oat milk"
in a basement aisle at 10:02 and syncs at 10:25 must not overwrite an unticking someone
made at 10:20. So the tick carries its own timestamp and only applies if it's newer.

```sql
create or replace function set_checked(p_item uuid, p_checked boolean, p_at timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update items
     set checked    = p_checked,
         checked_at = p_at,
         checked_by = auth.uid(),
         updated_at = now()
   where id = p_item
     and is_member(list_id)
     and p_at > coalesce(checked_at, '-infinity'::timestamptz);
end $$;

grant execute on function set_checked(uuid, boolean, timestamptz) to authenticated;
```

For two or three people this is enough. It's not a CRDT and doesn't need to be.

---

## Realtime

```sql
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table list_members;
```

Subscribe with a filter on `list_id`. `list_members` gives you the presence row —
"Kate's on the list now" — and the avatar colours without a second query.

---

## Offline

The supermarket dead spot is the only genuinely hard part. Five rules cover it:

1. **Client-generated UUIDs.** Insert with `crypto.randomUUID()` so an item created
   offline keeps its identity when it syncs. No server round-trip to get a key.
2. **A write queue in IndexedDB.** Every mutation is appended locally and applied to the
   local state immediately. On reconnect, replay in order.
3. **Soft delete.** `deleted_at`, never a real `DELETE`. A device that's been offline for
   an hour will otherwise re-insert rows it thinks still exist.
4. **Ticks carry their own time**, per `set_checked` above. Everything else is
   last-write-wins on server `updated_at`.
5. **Show the state honestly.** A small "not synced" marker beats silently pretending.
   People trust a list that admits when it's behind.

---

## Seed

```sql
insert into lists (name, is_pinned, position) values ('Shopping', true, 0);

insert into aisles (list_id, name, colour, position)
select id, a.name, a.colour, a.pos
from lists,
  (values
    ('Fruit & veg', '#2FA36B', 1),
    ('Bakery',      '#C97B2A', 2),
    ('Meat & fish', '#B0472F', 3),
    ('Chilled',     '#3A7BD5', 4),
    ('Frozen',      '#4FB6D6', 5),
    ('Cupboard',    '#8A6A3F', 6),
    ('Drinks',      '#8C0E3A', 7),
    ('Household',   '#8B3DFF', 8)
  ) as a(name, colour, pos)
where lists.name = 'Shopping';
```

Reorder `position` once to match your actual store and the list sorts itself forever after.

---

## Addendum: which supermarket has the wine offer on

Neither Tesco nor Sainsbury's publishes an offers API, and both sites sit behind bot
protection that makes direct scraping fragile and against their terms. Don't build on it.

The tractable source is the trackers that already do this work daily — MoneySavingCentral,
WinesDirect and TopCashback all maintain a "who has 25% off six bottles right now" page.
Fetch one primary and one fallback, once a day, and cache the result.

```sql
create table offers (
  id          uuid primary key default gen_random_uuid(),
  retailer    text not null,              -- 'Tesco' | 'Sainsbury''s'
  headline    text not null,              -- '25% off 6+ bottles of wine'
  starts_on   date,
  ends_on     date,
  source_url  text,
  checked_at  timestamptz not null default now(),
  confirmed   boolean not null default false   -- you ticked it yourself
);

create index offers_live_idx on offers (ends_on desc);

alter table offers enable row level security;
create policy offers_read on offers for select using (auth.uid() is not null);
```

Shape of the job:

1. Vercel cron, once daily, hits an API route.
2. Route fetches the tracker pages and pulls retailer + date range. Regex first; fall back
   to a small model call if the markup shifts, which it will.
3. Upsert into `offers`. Never overwrite a row where `confirmed` is true — your own
   correction always wins over a scrape.
4. The app shows a banner above the list when an offer is live: *"Tesco, 25% off 6+ wines
   until Mon 24 Aug"*, with a tap to dismiss for that shop.

Two things worth knowing before you build it:

- **The offer is predictable.** Tesco's runs roughly every couple of months for about six
  days, clustered around bank holidays and the run-up to Christmas. A calendar heuristic
  gets you most of the value with none of the scraping.
- **Tesco's needs a Clubcard**, and Express stores and Scotland are excluded. Worth
  encoding in the banner text so the nudge isn't wrong at the till.

Given that, the honest build order is: put the banner and the `offers` table in, populate
it by hand at first, and only automate once you're bored of typing it.
