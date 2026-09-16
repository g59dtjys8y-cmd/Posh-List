// Per-device, per-room identity. No accounts: a display name typed once on
// this device, kept in localStorage, plus a colour the server assigns the
// first time this id shows up in a room.

function key(slug) {
  return `posh-list:identity:${slug}`;
}

export function getIdentity(slug) {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveIdentity(slug, identity) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(identity));
  } catch {
    // localStorage unavailable (private mode etc.) — identity just won't
    // persist across reloads; the app still works for this session.
  }
}

// Global (not per-room) — every room this device has opened, so opening the
// site fresh (home screen icon, bare domain, an old bookmark of "/") can
// return to a list instead of the "start a new list" form silently
// spinning up a brand new room nobody else is on, and so a menu can show
// "your lists" instead of losing track of every list but the very last one.
const ROOMS_KEY = 'posh-list:rooms';
const MAX_REMEMBERED_ROOMS = 50;

/** Every room this device has opened, most recently visited first. */
export function getVisitedRooms() {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && typeof r.slug === 'string');
  } catch {
    return [];
  }
}

/** Record (or refresh) this device having opened `slug`, named `name`, of `kind`. */
export function rememberVisitedRoom(slug, name, kind) {
  try {
    const rooms = getVisitedRooms().filter((r) => r.slug !== slug);
    rooms.unshift({ slug, name: name || 'Shopping list', kind: kind || 'shopping', lastVisitedAt: Date.now() });
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms.slice(0, MAX_REMEMBERED_ROOMS)));
  } catch {
    // localStorage unavailable — just won't be remembered next time.
  }
}

/** A visited-room entry's kind — entries saved before list kinds existed
 *  have no `kind` at all, so every read site should go through this rather
 *  than scattering `|| 'shopping'` fallbacks of its own. */
export function roomKindOf(entry) {
  return entry?.kind || 'shopping';
}

/** Which visited room a shop-context destination (the loyalty cards link,
 *  the offers card) should point at — never `rooms[0]` unchecked, since
 *  that may be an `other` list with no loyalty cards or offers to speak
 *  of (the ambiguity behind the earlier loyalty-card data-loss incident).
 *  Prefers the most recently visited shopping room that's known to hold
 *  at least one loyalty card (`cardCount`, folded onto an entry once a
 *  caller has fetched it) over one that's merely more recent — landing on
 *  a correct-but-empty loyalty page looks just as broken as the old
 *  redirect. Falls back to the most recently visited shopping room while
 *  card counts haven't loaded yet (`cardCount` undefined), and to
 *  `undefined` if the device has no shopping list at all — callers must
 *  let that mean "don't render", never fall further back to rooms[0]. */
export function resolveShoppingRoom(rooms) {
  const shoppingRooms = rooms.filter((r) => roomKindOf(r) === 'shopping');
  return shoppingRooms.find((r) => r.cardCount > 0)?.slug ?? shoppingRooms[0]?.slug;
}

/** Overwrites the whole visited-rooms array — for quick-remove's undo,
 *  which needs to restore the exact prior array rather than re-adding one
 *  room via `rememberVisitedRoom` (that would unshift it to the front and
 *  stamp a fresh `lastVisitedAt`, silently reordering the list and
 *  misreporting when it was last opened). */
export function saveVisitedRooms(rooms) {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms.slice(0, MAX_REMEMBERED_ROOMS)));
  } catch {
    // localStorage unavailable — same as everywhere else here, just won't persist.
  }
}

export function forgetVisitedRoom(slug) {
  try {
    const rooms = getVisitedRooms().filter((r) => r.slug !== slug);
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch {
    // no-op
  }
}

// Which rooms this device *created* (vs. was only ever invited into via a
// share link). Used to decide whether to nudge someone to start their own
// house's list — a guest in someone else's room is the person that nudge is
// for; the owner never sees it for their own room.
const CREATED_KEY = 'posh-list:created';

export function getCreatedRooms() {
  try {
    const raw = localStorage.getItem(CREATED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberCreatedRoom(slug) {
  try {
    const rooms = getCreatedRooms();
    if (!rooms.includes(slug)) {
      rooms.push(slug);
      localStorage.setItem(CREATED_KEY, JSON.stringify(rooms));
    }
  } catch {
    // localStorage unavailable — worst case this device sees the "start
    // your own list" nudge in a room it actually created. Not harmful.
  }
}

export function didCreateRoom(slug) {
  return getCreatedRooms().includes(slug);
}

export function newPersonId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
