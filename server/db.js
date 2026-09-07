import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid, nanoidFrom } from './id.js';
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

  -- id is only ever unique *within* a room (see identity.js — a device gets
  -- a fresh id per room, not one global id), so the primary key is the pair,
  -- not id alone. A global id PK would reject a second room the instant
  -- some id happened to already exist in a different room.
  CREATE TABLE IF NOT EXISTS people (
    id TEXT NOT NULL,
    room_slug TEXT NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    last_seen INTEGER NOT NULL,
    join_order INTEGER NOT NULL,
    PRIMARY KEY (room_slug, id)
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

// Lightweight migrations for columns added after a room/item already
// existed — SQLite has no `ADD COLUMN IF NOT EXISTS`, so just swallow the
// "duplicate column" error on every startup after the first.
for (const migration of [
  'ALTER TABLE rooms ADD COLUMN offer_who_has TEXT',
  'ALTER TABLE items ADD COLUMN note TEXT',
]) {
  try {
    db.exec(migration);
  } catch (err) {
    if (!String(err.message).includes('duplicate column')) throw err;
  }
}

// A deploy that already has a `people` table from before the composite-key
// change above still has the old single-column `id` PRIMARY KEY — SQLite
// can't ALTER a primary key, so rebuild the table under a transaction and
// copy every row across. PRAGMA table_info's `pk` column is 0 for any
// column not in the primary key, so room_slug being 0 means this is the
// old shape; a fresh table (or one already migrated) has it at 1.
const roomSlugIsPartOfPk = db
  .prepare("SELECT pk FROM pragma_table_info('people') WHERE name = 'room_slug'")
  .get();
if (roomSlugIsPartOfPk && roomSlugIsPartOfPk.pk === 0) {
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE people_new (
        id TEXT NOT NULL,
        room_slug TEXT NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        last_seen INTEGER NOT NULL,
        join_order INTEGER NOT NULL,
        PRIMARY KEY (room_slug, id)
      )
    `);
    db.exec(
      'INSERT INTO people_new (id, room_slug, name, color, last_seen, join_order) ' +
        'SELECT id, room_slug, name, color, last_seen, join_order FROM people'
    );
    db.exec('DROP TABLE people');
    db.exec('ALTER TABLE people_new RENAME TO people');
    db.exec('CREATE INDEX IF NOT EXISTS idx_people_room ON people(room_slug)');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// How many times an item has to be added before it's treated as a "usual".
// Tune after a month of real use.
const REGULAR_THRESHOLD = 4;

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function makeSlug() {
  // Lowercase alnum, 10 chars, drawn uniformly — about 52 bits of entropy.
  // The slug is this app's only secret (no accounts, no login), so it's
  // worth more than "short enough to say out loud" alone: the old 6-char
  // nanoid()-then-lowercase scheme collapsed to ~31 bits with a bias
  // toward letters, from a 62-char alphabet mapped down to 36 after the
  // fact. Existing rooms keep their old, shorter slugs — this only changes
  // what a *new* room gets.
  return nanoidFrom(SLUG_ALPHABET, 10);
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
      note: i.note || '',
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
    offerWhoHas: room.offer_who_has || null,
  };
}

export function renameRoom(slug, name) {
  db.prepare('UPDATE rooms SET name = ? WHERE slug = ?').run(name, slug);
}

/** Plain informational note — who in the household holds the loyalty card
 *  an offer needs, e.g. "Sam". Empty string clears it back to unset. */
export function setOfferWhoHas(slug, text) {
  db.prepare('UPDATE rooms SET offer_who_has = ? WHERE slug = ?').run(text || null, slug);
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

/** Returns false (no-op) if `layoutId` doesn't belong to this room — a
 *  client can only activate a layout that's actually theirs. Without this,
 *  a stale or spoofed layoutId (e.g. copied from a different room's link)
 *  would point `rooms.active_layout_id` at a layout `getRoom` never
 *  returns, and the client has nothing to render. */
export function setActiveLayout(slug, layoutId) {
  const owned = db.prepare('SELECT 1 FROM layouts WHERE id = ? AND room_slug = ?').get(layoutId, slug);
  if (!owned) return false;
  db.prepare('UPDATE rooms SET active_layout_id = ? WHERE slug = ?').run(layoutId, slug);
  return true;
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

const insertItemStmt = db.prepare(
  `INSERT INTO items (id, room_slug, name, qty, aisle_key, added_by, added_color, done, done_by, position, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`
);

function insertItemRow(slug, { name, qty, aisleKey, addedBy, addedColor }, position, now) {
  const id = nanoid();
  insertItemStmt.run(id, slug, name, qty || 1, aisleKey, addedBy || null, addedColor || null, position, now);
  learnKnownItem(slug, name, aisleKey, now);
  return id;
}

export function addItem(slug, opts) {
  const now = Date.now();
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM items WHERE room_slug = ?')
    .get(slug).m;
  return insertItemRow(slug, opts, maxPos + 1, now);
}

/**
 * Adds many items as one transaction — used by every bulk-add path ("paste
 * a recipe", "add the usuals", the external REST API) instead of each one
 * looping over `addItem` individually. A loop of separate inserts leaves a
 * half-added batch permanently on the list if a later item in it throws;
 * wrapping the whole batch in BEGIN/COMMIT makes it all-or-nothing.
 * `items` is already-validated `{ name, qty, aisleKey }` objects — callers
 * differ slightly in how they fill in a missing aisleKey (REST guesses it,
 * WS trusts the client), so that stays their job, not this one's.
 */
export function addItems(slug, items, { addedBy, addedColor } = {}) {
  if (!items.length) return [];
  const now = Date.now();
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM items WHERE room_slug = ?')
    .get(slug).m;

  const added = [];
  db.exec('BEGIN');
  try {
    items.forEach((item, i) => {
      const id = insertItemRow(slug, { ...item, addedBy, addedColor }, maxPos + 1 + i, now);
      added.push({ id, name: item.name, qty: item.qty, aisleKey: item.aisleKey });
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return added;
}

/**
 * Quick-add's one-tap behaviour: bump an already-on-the-list quantity
 * instead of adding a second line for the same thing — tapping "Milk"
 * three times should read "Milk ×3", not three separate "Milk" rows. Only
 * matches a *live* item (not done) by name — a ticked-off "Milk" from last
 * week doesn't count as still being on the list, so this rightly starts a
 * fresh line rather than un-ticking someone else's finished shop.
 */
export function incrementOrAddItem(slug, { name, aisleKey, addedBy, addedColor }) {
  const key = name.toLowerCase().trim();
  const existing = db
    .prepare("SELECT id, name, qty, aisle_key FROM items WHERE room_slug = ? AND done = 0 AND lower(trim(name)) = ?")
    .get(slug, key);

  if (existing) {
    const qty = existing.qty + 1;
    db.prepare('UPDATE items SET qty = ? WHERE id = ?').run(qty, existing.id);
    // Bumping a differently-cased tap ("WINE" while "wine" is on the list)
    // still just increments the existing line — the display name it
    // already has stays put rather than getting silently retyped.
    learnKnownItem(slug, existing.name, existing.aisle_key, Date.now());
    return { id: existing.id, name: existing.name, qty, aisleKey: existing.aisle_key, incremented: true };
  }

  const id = addItem(slug, { name, qty: 1, aisleKey, addedBy, addedColor });
  return { id, name, qty: 1, aisleKey, incremented: false };
}

/** A short free-text note on an item (e.g. "no substitutions", "the big
 *  carton") — set or changed any time after the item's already on the
 *  list, not part of adding it. Empty string clears it back to none. */
export function setItemNote(slug, itemId, note) {
  db.prepare('UPDATE items SET note = ? WHERE id = ? AND room_slug = ?').run(
    note || null,
    itemId,
    slug
  );
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
  const toAdd = getRegulars(slug).filter((r) => !live.has(r.nameKey));
  const added = addItems(
    slug,
    toAdd.map((r) => ({ name: r.name, qty: 1, aisleKey: r.aisleKey })),
    { addedBy, addedColor }
  );
  return added.map((a) => a.name);
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
