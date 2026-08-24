import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from './id.js';
import { AISLE_KEYS } from './aisles.js';
import { personColorForIndex } from './colors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_DIR can be pointed at a mounted persistent disk in production (e.g.
// Render's disk mount path) via the DB_DIR env var — without it, data lives
// on the service's local filesystem and will not survive a redeploy.
const DB_DIR = process.env.DB_DIR || path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'posh-shop.sqlite3');
fs.mkdirSync(DB_DIR, { recursive: true });

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

  CREATE INDEX IF NOT EXISTS idx_layouts_room ON layouts(room_slug);
  CREATE INDEX IF NOT EXISTS idx_items_room ON items(room_slug);
  CREATE INDEX IF NOT EXISTS idx_people_room ON people(room_slug);
  CREATE INDEX IF NOT EXISTS idx_room_aliases_room ON room_aliases(room_slug);
`);

function makeSlug() {
  // Lowercase alnum, 6 chars — short enough to say out loud, long enough
  // that guessing someone else's list is impractical.
  return nanoid(6).toLowerCase().replace(/[^a-z0-9]/g, () => '0');
}

export function createRoom(name) {
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
    insertLayout.run(defaultLayoutId, slug, 'Default order', JSON.stringify(AISLE_KEYS), 0, now);
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

  return {
    slug: room.slug,
    alias: aliasRow?.alias || null,
    name: room.name,
    activeLayoutId: room.active_layout_id,
    aisleLayouts: layouts,
    items,
    people,
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
  return id;
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
