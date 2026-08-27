-- Posh Shop — initial schema
-- Consolidated from ../../../posh-shop-schema.md. Run this once in the Supabase
-- SQL editor (Dashboard -> SQL -> New query -> paste -> Run).
--
-- Two dashboard toggles this migration cannot set for you:
--   1. Auth -> Sign In / Providers -> enable "Anonymous sign-ins".
--   2. Realtime is enabled by the publication statements near the bottom.
--
-- Safe to re-run: every object uses "if not exists" / "or replace" / a guard.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

-- URL-safe ~72-bit share token
create or replace function new_share_token() returns text
language sql volatile as $$
  select replace(replace(encode(gen_random_bytes(9), 'base64'), '+', '-'), '/', '_');
$$;

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------

create table if not exists lists (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Shopping',
  share_token  text not null unique default new_share_token(),
  is_pinned    boolean not null default false,   -- the main list: always first, never deletable
  position     int not null default 100,
  archived_at  timestamptz,                      -- soft delete, purged after 30 days
  created_at   timestamptz not null default now()
);

-- at most one pinned list
create unique index if not exists lists_one_pinned on lists (is_pinned) where is_pinned;

create table if not exists list_members (
  list_id      uuid not null references lists on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  display_name text not null,
  colour       text not null default '#1D6FE0',
  joined_at    timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table if not exists aisles (
  id        uuid primary key default gen_random_uuid(),
  list_id   uuid not null references lists on delete cascade,
  name      text not null,
  colour    text not null default '#5C646E',
  position  int  not null,
  unique (list_id, name)
);

create table if not exists items (
  id          uuid primary key,           -- generated on the client (offline-safe)
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
  deleted_at  timestamptz                 -- soft delete
);

create index if not exists items_live_idx on items (list_id, aisle_id) where deleted_at is null;

create table if not exists known_items (
  list_id       uuid not null references lists on delete cascade,
  name_key      text not null,            -- lower(trim(name))
  display_name  text not null,
  aisle_id      uuid references aisles on delete set null,
  times_added   int  not null default 1,
  last_added_at timestamptz not null default now(),
  is_regular    boolean not null default false,
  primary key (list_id, name_key)
);

create table if not exists offers (
  id          uuid primary key default gen_random_uuid(),
  retailer    text not null,
  headline    text not null,
  starts_on   date,
  ends_on     date,
  source_url  text,
  checked_at  timestamptz not null default now(),
  confirmed   boolean not null default false   -- a human ticked it; a scrape never overwrites this
);

create index if not exists offers_live_idx on offers (ends_on desc);

-- ---------------------------------------------------------------------------
-- membership predicate (security definer so the list_members policy
-- does not recurse into itself)
-- ---------------------------------------------------------------------------

create or replace function is_member(l uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from list_members m
    where m.list_id = l and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table lists        enable row level security;
alter table list_members enable row level security;
alter table aisles       enable row level security;
alter table items        enable row level security;
alter table known_items  enable row level security;
alter table offers       enable row level security;

drop policy if exists list_read   on lists;
drop policy if exists list_update on lists;
drop policy if exists member_read on list_members;
drop policy if exists member_self on list_members;
drop policy if exists aisle_rw    on aisles;
drop policy if exists item_rw     on items;
drop policy if exists known_rw    on known_items;
drop policy if exists offers_read on offers;

-- no insert policy on lists / list_members: joining is only via join_list()
create policy list_read   on lists        for select using (is_member(id));
create policy list_update on lists        for update using (is_member(id)) with check (is_member(id));
create policy member_read on list_members for select using (is_member(list_id));
create policy member_self on list_members for update using (user_id = auth.uid());

create policy aisle_rw on aisles
  for all using (is_member(list_id)) with check (is_member(list_id));
create policy item_rw on items
  for all using (is_member(list_id)) with check (is_member(list_id));
create policy known_rw on known_items
  for all using (is_member(list_id)) with check (is_member(list_id));

create policy offers_read on offers for select using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- join a list by its share token; prompts once for a nickname client-side
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

-- create an ordinary (non-pinned) list, make the caller a member, and copy the
-- aisle layout from the pinned list so grouping works from the first item.
create or replace function create_list(p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  nick   text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  insert into lists (name, is_pinned, position)
  values (coalesce(nullif(trim(p_name), ''), 'New list'), false,
          coalesce((select max(position) from lists where not is_pinned), 100) + 1)
  returning id into new_id;

  select display_name into nick
  from list_members where user_id = auth.uid()
  order by joined_at limit 1;

  insert into list_members (list_id, user_id, display_name)
  values (new_id, auth.uid(), coalesce(nick, 'Me'));

  insert into aisles (list_id, name, colour, position)
  select new_id, name, colour, position
  from aisles
  where list_id = (select id from lists where is_pinned);

  return new_id;
end $$;

grant execute on function create_list(text) to authenticated;

-- add an item and teach known_items (aisle from catalogue first time, from memory after)
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

-- tick / untick, carrying the client's own timestamp so a late sync can't stomp a newer change
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

-- soft archive / restore a non-pinned list
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

grant execute on function delete_list(uuid)  to authenticated;
grant execute on function restore_list(uuid) to authenticated;

-- purge archived lists after 30 days (wire to pg_cron / a scheduled Edge Function)
create or replace function purge_archived_lists()
returns void
language sql security definer set search_path = public as $$
  delete from lists
   where archived_at is not null
     and archived_at < now() - interval '30 days';
$$;

-- If pg_cron is enabled (Dashboard -> Database -> Extensions -> pg_cron):
--   select cron.schedule('purge-archived-lists', '17 3 * * *', $$select purge_archived_lists()$$);

-- ---------------------------------------------------------------------------
-- realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    execute 'alter publication supabase_realtime add table items';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'list_members'
  ) then
    execute 'alter publication supabase_realtime add table list_members';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- seed: the pinned Shopping list + aisles in walking order
-- (aisle names match posh-shop-catalogue.json)
-- ---------------------------------------------------------------------------

insert into lists (name, is_pinned, position)
select 'Shopping', true, 0
where not exists (select 1 from lists where is_pinned);

insert into aisles (list_id, name, colour, position)
select l.id, a.name, a.colour, a.pos
from lists l,
  (values
    ('Fruit & veg', '#57C000', 1),
    ('Bakery',      '#FF9E00', 2),
    ('Meat & fish', '#FF2E7E', 3),
    ('Chilled',     '#0AA3FF', 4),
    ('Frozen',      '#00CDDC', 5),
    ('Cupboard',    '#8A6A3F', 6),
    ('Drinks',      '#8C0E3A', 7),
    ('Household',   '#8B3DFF', 8)
  ) as a(name, colour, pos)
where l.is_pinned
  and not exists (select 1 from aisles x where x.list_id = l.id and x.name = a.name);

commit;
