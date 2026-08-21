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

export function newPersonId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
