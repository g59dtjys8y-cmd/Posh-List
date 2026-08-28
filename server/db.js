import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from './id.js';
import { AISLE_KEYS, isValidLayoutOrder } from './aisles.js';
import { personColorForIndex } from './colors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_DIR can be pointed at a mounted persistent disk in production (e.g.
// Render's disk mount path) via the DB_DIR env var — without it, data lives
// on the service's local filesystem and will not survive a redeploy.
const DB_DIR = process.env.DB_DIR || path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'posh-list.sqlite3');
fs.mkdirSync(DB_DIR, { recursive: true });

// The database file was named after the app's old name ("posh-shop"). If a
// deploy still has that file (and no new-name file yet), rename it in place
// — along with its WAL/SHM sidecars — so existing data carries over.
const LEGACY_DB_PATH = path.join(DB_DIR, 'posh-shop.sqlite3');
if (fs.existsSync(LEGACY_DB_PATH) && !fs.existsSync(DB_PATH)) {
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(LEGACY_DB_PATH + suffix)) {
      fs.renameSync(LEGACY_DB_PATH + suffix, DB_PATH + suffix);
    }
  }
}

// Node's built-in SQLite (stable-ish since Node 22.5, still flagged
// "experimental" in console warnings) stands in for better-sqlite3 here —
// this sandbox has no npm registry access, see the project report for why.
// Its prepared-statement API (.run/.get/.all with positional params) is
// close enough to better-sqlite3's that the rest of this file barely differs.
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active_layout_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS layouts (
    id TEXT PRIMARY KEY,
    room_slug TEXT NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_json TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    room_slug TEXT NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    aisle_key TEXT NOT NULL,
    added_by TEXT,
    added_color TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    done_by TEXT,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    room_slug TEXT NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    last_seen INTEGER NOT NULL,
    join_order INTEGER NOT NULL
  );

  -- A memorable, permanent alternative to the random slug a room is
  -- created with (e.g. "smith-family" instead of "a3f9k2") — the room
  -- keeps its original slug too, so any link already shared with that
  -- keeps working. One alias per room; set_alias replaces it rather than
  -- accumulating a history.
  CREATE TABLE IF NOT EXISTS room_aliases (
    alias TEXT PRIMARY KEY,
    room_slug TEXT NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  -- Every distinct item name a room has ever added, with a running count.
  -- Once something has been added enough times it becomes a "usual" and can
  -- be re-added to next week's list in one tap. The aisle is learned once so
  -- an odd item only ever needs categorising by hand a single time.
  CREATE TABLE IF NOT EXISTS known_items (
    room_slug        TEXT NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
    name_key         TEXT NOT NULL,            -- lower(trim(name))
    display_name     TEXT NOT NULL,            -- most-recent casing
    aisle_key        TEXT NOT NULL,
    times_added      INTEGER NOT NULL DEFAULT 1,
    last_added_at    INTEGER NOT NULL,
    is_regular       INTEGER NOT NULL DEFAULT 0,   -- auto: set once times_added >= threshold
    regular_override INTEGER,                       -- NULL = auto, 1 = force on, 0 = force off
    PRIMARY KEY (room_slug, name_key)
  );

  CREATE INDEX IF NOT EXISTS idx_layouts_room ON layouts(room_slug);
  CREATE INDEX IF NOT EXISTS idx_items_room ON items(room_slug);
  CREATE INDEX IF NOT EXISTS idx_people_room ON people(room_slug);
  CREATE INDEX IF NOT EXISTS idx_room_aliases_room ON room_aliases(room_slug);
  CREATE INDEX IF NOT EXISTS idx_known_items_room ON known_items(room_slug);
`);

// How many times an item has to be added before it's treated as a "usual".
// Tune after a month of real use.
const REGULAR_THRESHOLD = 4;

function makeSlug() {
  // Lowercase alnum, 6 chars — short enough to say out loud, long enough
  // that guessing someone else's list is impractical.
  return nanoid(6).toLowerCase().replace(/[^a-z0-9]/g, () => '0');
}

export function createRoom(name, layoutOrder) {
  let slug = makeSlug();
  // Practically never collides at 6 chars, but guard anyway.
  while (db.prepare('SELECT 1 FROM rooms WHERE slug = ?').get(slug)) {
    slug = makeSlug();
  }
  const now = Date.now();
  const defaultLayoutId = nanoid();

  const insertRoom = db.prepare(
    'INSERT INTO rooms (slug, name, active_layout_id, created_at) VALUES (?, ?, ?, ?)'
  );
  const insertLayout = db.prepare(
    'INSERT INTO layouts (id, room_slug, name, order_json, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    insertRoom.run(slug, name || 'Shopping list', defaultLayoutId, now);
    const order = isValidLayoutOrder(layoutOrder) ? layoutOrder : AISLE_KEYS;
    insertLayout.run(defaultLayoutId, slug, 'Default order', JSON.stringify(order), 0, now);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getRoom(slug);
}

export function roomExists(slug) {
  return !!db.prepare('SELECT 1 FROM rooms WHERE slug = ?').get(slug);
}

export function getRoom(slug) {
  const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(slug);
  if (!room) return null;

  const layouts = db
    .prepare('SELECT * FROM layouts WHERE room_slug = ? ORDER BY position ASC')
    .all(slug)
    .map((l) => ({ id: l.id, name: l.name, order: JSON.parse(l.order_json) }));

  const items = db
    .prepare('SELECT * FROM items WHERE room_slug = ? ORDER BY position ASC')
    .all(slug)
    .map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      aisleKey: i.aisle_key,
      addedBy: i.added_by,
      addedColor: i.added_color,
      done: !!i.done,
      doneBy: i.done_by,
    }));

  const people = db
    .prepare('SELECT * FROM people WHERE room_slug = ? ORDER BY join_order ASC')
    .all(slug)
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      lastSeen: p.last_seen,
      connected: false, // filled in by the caller from live socket state
    }));

  const aliasRow = db.prepare('SELECT alias FROM room_aliases WHERE room_slug = ?').get(slug);

  const liveNames = new Set(
    items.filter((i) => !i.done).map((i) => i.name.toLowerCase().trim())
  );
  const regulars = getRegulars(slug).map((r) => ({ ...r, onList: liveNames.has(r.nameKey) }));

  return {
    slug: room.slug,
    alias: aliasRow?.alias || null,
    name: room.name,
    activeLayoutId: room.active_layout_id,
    aisleLayouts: layouts,
    items,
    people,
    regulars,
  };
}

export function renameRoom(slug, name) {
  db.prepare('UPDATE rooms SET name = ? WHERE slug = ?').run(name, slug);
}

const ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

/**
 * A room's slug (its real, permanent identity) never changes once
 * created — this just adds a friendlier alternative name that also
 * resolves to it, so an existing share link never breaks.
 */
export function resolveSlug(input) {
  if (typeof input !== 'string' || !input) return null;
  if (roomExists(input)) return input;
  const aliasRow = db.prepare('SELECT room_slug FROM room_aliases WHERE alias = ?').get(input);
  return aliasRow?.room_slug || null;
}

/** Set (replacing any existing) alias for a room. Returns an error code on failure. */
export function setAlias(roomSlug, alias) {
  if (!ALIAS_PATTERN.test(alias)) return { ok: false, error: 'invalid' };
  if (roomExists(alias) && alias !== roomSlug) return { ok: false, error: 'taken' };
  const existingOwner = db.prepare('SELECT room_slug FROM room_aliases WHERE alias = ?').get(alias);
  if (existingOwner && existingOwner.room_slug !== roomSlug) return { ok: false, error: 'taken' };

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM room_aliases WHERE room_slug = ?').run(roomSlug);
    db.prepare('INSERT INTO room_aliases (alias, room_slug, created_at) VALUES (?, ?, ?)').run(
      alias,
      roomSlug,
      Date.now()
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { ok: true };
}

export function setActiveLayout(slug, layoutId) {
  db.prepare('UPDATE rooms SET active_layout_id = ? WHERE slug = ?').run(layoutId, slug);
}

export function addLayout(slug, name, order) {
  const id = nanoid();
  const now = Date.now();
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM layouts WHERE room_slug = ?')
    .get(slug).m;
  db.prepare(
    'INSERT INTO layouts (id, room_slug, name, order_json, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, slug, name, JSON.stringify(order), maxPos + 1, now);
  return id;
}

export function updateLayout(slug, layoutId, { name, order }) {
  if (name !== undefined) {
    db.prepare('UPDATE layouts SET name = ? WHERE id = ? AND room_slug = ?').run(
      name,
      layoutId,
      slug
    );
  }
  if (order !== undefined) {
    db.prepare('UPDATE layouts SET order_json = ? WHERE id = ? AND room_slug = ?').run(
      JSON.stringify(order),
      layoutId,
      slug
    );
  }
}

export function deleteLayout(slug, layoutId) {
  const room = db.prepare('SELECT active_layout_id FROM rooms WHERE slug = ?').get(slug);
  const remaining = db
    .prepare('SELECT id FROM layouts WHERE room_slug = ? AND id != ? ORDER BY position ASC')
    .all(slug, layoutId);
  if (remaining.length === 0) return false; // never delete the last layout

  db.prepare('DELETE FROM layouts WHERE id = ? AND room_slug = ?').run(layoutId, slug);

  if (room && room.active_layout_id === layoutId) {
    setActiveLayout(slug, remaining[0].id);
  }
  return true;
}

export function addItem(slug, { name, qty, aisleKey, addedBy, addedColor }) {
  const id = nanoid();
  const now = Date.now();
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM items WHERE room_slug = ?')
    .get(slug).m;
  db.prepare(
    `INSERT INTO items (id, room_slug, name, qty, aisle_key, added_by, added_color, done, done_by, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`
  ).run(id, slug, name, qty || 1, aisleKey, addedBy || null, addedColor || null, maxPos + 1, now);
  learnKnownItem(slug, name, aisleKey, now);
  return id;
}

/**
 * Record that `name` was added to this room's list — bumping its count and,
 * once it crosses the threshold, marking it a "usual". The aisle is written
 * on first sight and then left alone unless it was only ever the `cupboard`
 * catch-all, so a hand-categorised item stays where it was put.
 * `clear_done` / `delete_item` deliberately do NOT call this — buying an
 * item and then tidying it off the list is the normal flow, not a signal
 * that it isn't a usual.
 */
function learnKnownItem(slug, name, aisleKey, now) {
  const key = name.toLowerCase().trim();
  if (!key) return;
  db.prepare(
    `INSERT INTO known_items (room_slug, name_key, display_name, aisle_key, times_added, last_added_at)
     VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(room_slug, name_key) DO UPDATE SET
       times_added   = times_added + 1,
       last_added_at = excluded.last_added_at,
       display_name  = excluded.display_name,
       aisle_key     = CASE WHEN known_items.aisle_key = 'cupboard'
                            THEN excluded.aisle_key ELSE known_items.aisle_key END,
       is_regular    = CASE WHEN times_added + 1 >= ${REGULAR_THRESHOLD} THEN 1 ELSE is_regular END`
  ).run(slug, key, name, aisleKey, now);
}

/** All "usuals" for a room — most-added first. `onList` is filled by getRoom. */
export function getRegulars(slug) {
  return db
    .prepare(
      `SELECT name_key, display_name, aisle_key, times_added
         FROM known_items
        WHERE room_slug = ? AND COALESCE(regular_override, is_regular) = 1
        ORDER BY times_added DESC, last_added_at DESC`
    )
    .all(slug)
    .map((r) => ({
      nameKey: r.name_key,
      name: r.display_name,
      aisleKey: r.aisle_key,
      timesAdded: r.times_added,
    }));
}

/** Every item name this room has ever added — for the "Your usuals" manage screen. */
export function getKnownItems(slug) {
  return db
    .prepare(
      `SELECT name_key, display_name, aisle_key, times_added, is_regular, regular_override
         FROM known_items
        WHERE room_slug = ?
        ORDER BY times_added DESC, last_added_at DESC`
    )
    .all(slug)
    .map((r) => ({
      nameKey: r.name_key,
      name: r.display_name,
      aisleKey: r.aisle_key,
      timesAdded: r.times_added,
      isRegular: !!(r.regular_override == null ? r.is_regular : r.regular_override),
      overridden: r.regular_override != null,
    }));
}

/**
 * Add every usual that isn't already sitting un-ticked on the list.
 * Returns the display names actually added.
 */
export function addRegularsToList(slug, { addedBy, addedColor } = {}) {
  const live = new Set(
    db
      .prepare('SELECT name FROM items WHERE room_slug = ? AND done = 0')
      .all(slug)
      .map((r) => r.name.toLowerCase().trim())
  );
  const added = [];
  for (const regular of getRegulars(slug)) {
    if (live.has(regular.nameKey)) continue;
    addItem(slug, { name: regular.name, qty: 1, aisleKey: regular.aisleKey, addedBy, addedColor });
    added.push(regular.name);
  }
  return added;
}

/** Force a known item on (1) / off (0) the usuals list, or clear back to auto (null). */
export function setRegularOverride(slug, nameKey, value) {
  const v = value === 1 || value === 0 ? value : null;
  db.prepare('UPDATE known_items SET regular_override = ? WHERE room_slug = ? AND name_key = ?').run(
    v,
    slug,
    String(nameKey || '').toLowerCase().trim()
  );
}

export function setItemDone(slug, itemId, done, doneBy) {
  db.prepare('UPDATE items SET done = ?, done_by = ? WHERE id = ? AND room_slug = ?').run(
    done ? 1 : 0,
    done ? doneBy || null : null,
    itemId,
    slug
  );
}

export function deleteItem(slug, itemId) {
  db.prepare('DELETE FROM items WHERE id = ? AND room_slug = ?').run(itemId, slug);
}

/** Removes every ticked item — the "tidy up after the shop" action. Returns how many were removed. */
export function clearDoneItems(slug) {
  return db.prepare('DELETE FROM items WHERE room_slug = ? AND done = 1').run(slug).changes;
}

export function upsertPerson(slug, { id, name, color }) {
  const now = Date.now();
  const existing = id
    ? db.prepare('SELECT * FROM people WHERE id = ? AND room_slug = ?').get(id, slug)
    : null;

  if (existing) {
    db.prepare('UPDATE people SET name = ?, last_seen = ? WHERE id = ?').run(
      name || existing.name,
      now,
      existing.id
    );
    return { id: existing.id, name: name || existing.name, color: existing.color };
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM people WHERE room_slug = ?').get(slug).c;
  const assignedColor = color || personColorForIndex(count);
  // Honour the client-supplied id as the primary key (it's a locally
  // generated identity, not a server-assigned one) so this device maps to
  // the same person row on every reconnect, which is also what live
  // presence tracking keys off.
  const newId = id || nanoid();
  db.prepare(
    'INSERT INTO people (id, room_slug, name, color, last_seen, join_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(newId, slug, name || 'Someone', assignedColor, now, count);
  return { id: newId, name: name || 'Someone', color: assignedColor };
}

export function touchPerson(slug, personId) {
  db.prepare('UPDATE people SET last_seen = ? WHERE id = ? AND room_slug = ?').run(
    Date.now(),
    personId,
    slug
  );
}

export default db;
