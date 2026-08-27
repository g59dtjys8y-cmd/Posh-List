import raw from "@/data/catalogue.json";

export type CatalogueItem = { name: string; aisle: string };

// posh-shop-catalogue.json ships ~200 common UK grocery items already mapped to
// an aisle, so autocomplete has something to offer on day one (known_items is
// empty until the household starts adding things). Bundled, not a table: it has
// to work in a supermarket dead spot with no round-trip.
export const CATALOGUE: CatalogueItem[] = (
  raw as { items: { n: string; a: string }[] }
).items.map((i) => ({ name: i.n, aisle: i.a }));

const byKey = new Map(CATALOGUE.map((i) => [i.name.toLowerCase(), i]));

export function catalogueAisle(name: string): string | undefined {
  return byKey.get(name.trim().toLowerCase())?.aisle;
}

/** Prefix matches first, then substring; deduped, capped. */
export function searchCatalogue(query: string, limit = 8): CatalogueItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix: CatalogueItem[] = [];
  const substr: CatalogueItem[] = [];
  for (const item of CATALOGUE) {
    const n = item.name.toLowerCase();
    if (n.startsWith(q)) prefix.push(item);
    else if (n.includes(q)) substr.push(item);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...substr].slice(0, limit);
}
