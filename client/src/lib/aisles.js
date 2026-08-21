// Mirrors server/aisles.js — the seven fixed aisle keys and their rail
// colours (walking order is whatever the active layout says; this is just
// the lookup table from key -> label/colour).
export const AISLES = [
  { key: 'fruit_veg', label: 'Fruit & veg', color: 'var(--aisle-fruit-veg)', hex: '#57C000' },
  { key: 'bakery', label: 'Bakery', color: 'var(--aisle-bakery)', hex: '#FF7A00' },
  { key: 'meat_fish', label: 'Meat & fish', color: 'var(--aisle-meat-fish)', hex: '#FF2E7E' },
  { key: 'chilled', label: 'Chilled', color: 'var(--aisle-chilled)', hex: '#0AA3FF' },
  { key: 'frozen', label: 'Frozen', color: 'var(--aisle-frozen)', hex: '#00CDDC' },
  { key: 'cupboard', label: 'Cupboard', color: 'var(--aisle-cupboard)', hex: '#8A6A3F' },
  { key: 'household', label: 'Household', color: 'var(--aisle-household)', hex: '#8B3DFF' },
];

export const AISLE_BY_KEY = Object.fromEntries(AISLES.map((a) => [a.key, a]));
export const AISLE_KEYS = AISLES.map((a) => a.key);

export function aisleLabel(key) {
  return AISLE_BY_KEY[key]?.label || key;
}
export function aisleColor(key) {
  return AISLE_BY_KEY[key]?.color || 'var(--text-muted)';
}
