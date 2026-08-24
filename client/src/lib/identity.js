// Per-device, per-room identity. No accounts: a display name typed once on
// this device, kept in localStorage, plus a colour the server assigns the
// first time this id shows up in a room.

function key(slug) {
  return `posh-shop:identity:${slug}`;
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
const ROOMS_KEY = 'posh-shop:rooms';
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

/** Record (or refresh) this device having opened `slug`, named `name`. */
export function rememberVisitedRoom(slug, name) {
  try {
    const rooms = getVisitedRooms().filter((r) => r.slug !== slug);
    rooms.unshift({ slug, name: name || 'Shopping list', lastVisitedAt: Date.now() });
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms.slice(0, MAX_REMEMBERED_ROOMS)));
  } catch {
    // localStorage unavailable — just won't be remembered next time.
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

export function newPersonId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
