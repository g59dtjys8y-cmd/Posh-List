export async function createRoom(name) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Could not create list');
  return res.json();
}

export async function fetchRoom(slug) {
  const res = await fetch(`/api/rooms/${slug}`);
  if (!res.ok) return null;
  return res.json();
}
