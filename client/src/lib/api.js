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
 * Home's quick-add row has no live WebSocket connection to the room it's
 * adding to, so this goes over REST instead — and unlike a normal add, a
 * repeat tap bumps the existing line's quantity rather than adding a
 * second "Wine" row, which is the whole point of a one-tap shortcut.
 * Broadcasts to anyone with the list open, same as any other add.
 */
export async function quickAddItem(slug, name, source) {
  const res = await fetch(`/api/rooms/${slug}/quick-add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, source }),
  });
  if (!res.ok) throw new Error('Could not add item');
  return res.json();
}
