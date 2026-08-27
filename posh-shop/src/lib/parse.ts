export type ParsedItem = { name: string; qty: string | null };

const UNITS = "kg|g|ml|l|pack|packs|bottle|bottles|tin|tins|can|cans|box|boxes";
const LEADING = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${UNITS})?\\s+(.*)$`, "i");
const TRAILING = new RegExp(`^(.*?)\\s*(?:x\\s*)?(\\d+(?:\\.\\d+)?)\\s*(${UNITS})?$`, "i");

/**
 * "2 oat milk" / "oat milk x2" / "500g pasta" -> { name, qty }.
 * Quantity is normalised for display: a bare count becomes "×2".
 */
export function parseQuantity(input: string): ParsedItem {
  const text = input.trim();

  const lead = text.match(LEADING);
  if (lead && lead[3].trim()) {
    return { name: tidy(lead[3]), qty: fmtQty(lead[1], lead[2]) };
  }

  const trail = text.match(TRAILING);
  if (trail && trail[1].trim() && (trail[2] || /x\s*\d/i.test(text))) {
    return { name: tidy(trail[1]), qty: fmtQty(trail[2], trail[3]) };
  }

  return { name: tidy(text), qty: null };
}

/** "bread, milk, eggs" -> three ParsedItems. */
export function parseAddInput(input: string): ParsedItem[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseQuantity);
}

function fmtQty(n: string, unit?: string): string {
  return unit ? `${n}${unit.toLowerCase()}` : `×${n}`;
}

function tidy(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
