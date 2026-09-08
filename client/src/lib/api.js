import { rememberCreatedRoom } from './identity.js';

/**
 * Create a new list. `layoutOrder` optionally seeds the new room's default
 * aisle order (so a guest starting their own list keeps the walking order
 * they just learned); `from` is the slug it was started from, logged
 * server-side for guest→owner conversion tracking only.
 */
export async function createRoom(name, { layoutOrder, from } = {}) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, layoutOrder, from }),
  });
  if (!res.ok) throw new Error('Could not create list');
  const data = await res.json();
  if (data?.slug) rememberCreatedRoom(data.slug);
  return data;
}

export async function fetchRoom(slug) {
  const res = await fetch(`/api/rooms/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Rename a room from a screen with no live WS connection to it (My lists
 * manages every list this device knows about, not just whichever one is
 * currently open). A room page itself renames over its own WS connection
 * instead — see the `rename_room` message in RoomContext's `send`.
 */
export async function renameRoom(slug, name) {
  const res = await fetch(`/api/rooms/${slug}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Could not rename list');
  return res.json();
}

/**
 * The standalone recovery flow (Recover.jsx) — no room open yet, just an
 * email to look up. Always resolves the same way regardless of whether
 * anything matched (the server deliberately doesn't say either way, so
 * this can't be used to probe whether an email is registered to a list).
 */
export async function requestRecoveryEmail(email) {
  const res = await fetch('/api/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Could not send recovery email');
  return res.json();
}

