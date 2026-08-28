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
