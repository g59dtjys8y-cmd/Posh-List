const FORMAT = 'posh-list/loyalty-cards';
const VERSION = 1;

// Loyalty card data lives only in Render's disk — daily snapshots restore
// the whole service or nothing, and nothing survives the service itself
// being deleted. This is the file-you-hold alternative: everything needed
// to recreate the cards (not the ids or positions — a fresh room mints its
// own, and carrying stale ids across rooms would only invite collisions).
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/**
 * Builds the backup object for every card in `cards` (the lightweight
 * `room.loyaltyCards` list off the WS state — no photo bytes in it).
 * Photos are fetched one at a time from the existing per-card REST
 * endpoint — a household has a handful of cards, not enough to justify
 * concurrency, and going one at a time is easiest on the server. A photo
 * that fails to fetch just gets left off that card rather than failing the
 * whole export — a partial backup beats none.
 */
export async function exportCards(slug, cards, roomName) {
  const exported = [];
  for (const card of cards) {
    const entry = { label: card.label, codeValue: card.codeValue || '' };
    if (card.hasPhoto) {
      try {
        const res = await fetch(`/api/rooms/${slug}/loyalty-cards/${card.id}/photo`);
        if (!res.ok) throw new Error(`photo fetch failed: ${res.status}`);
        entry.photoDataUrl = await blobToDataUrl(await res.blob());
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Could not fetch photo for "${card.label}" — exporting without it`, err);
      }
    }
    exported.push(entry);
  }
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    roomName,
    cards: exported,
  };
}

/**
 * Parses and validates a backup file's text. Throws a message meant to be
 * shown as-is rather than a generic parse error — a bad file is rejected
 * outright, never half-imported.
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That doesn't look like a valid backup file — check you picked the right one.");
  }

  if (!data || data.format !== FORMAT) {
    throw new Error("This isn't a Posh List loyalty-cards backup file.");
  }
  if (data.version !== VERSION) {
    throw new Error("This backup was made with a different version of Posh List and can't be read here.");
  }
  if (!Array.isArray(data.cards)) {
    throw new Error('This backup file is missing its card list.');
  }

  return data.cards.map((card, i) => {
    if (!card || typeof card.label !== 'string' || !card.label.trim()) {
      throw new Error(`Card ${i + 1} in this file has no name — the file may be corrupted.`);
    }
    return {
      label: card.label,
      codeValue: typeof card.codeValue === 'string' ? card.codeValue : '',
      photoDataUrl: typeof card.photoDataUrl === 'string' ? card.photoDataUrl : undefined,
    };
  });
}
