// The seven fixed aisle keys, in the canonical "walking order" used as the
// default layout for every new room. Colours match the design tokens.
export const AISLES = [
  { key: 'fruit_veg', label: 'Fruit & veg', color: '#57C000' },
  { key: 'bakery', label: 'Bakery', color: '#FF7A00' },
  { key: 'meat_fish', label: 'Meat & fish', color: '#FF2E7E' },
  { key: 'chilled', label: 'Chilled', color: '#0AA3FF' },
  { key: 'frozen', label: 'Frozen', color: '#00CDDC' },
  { key: 'cupboard', label: 'Cupboard', color: '#8A6A3F' },
  { key: 'household', label: 'Household', color: '#8B3DFF' },
];

export const AISLE_KEYS = AISLES.map((a) => a.key);

export function isValidAisleKey(key) {
  return AISLE_KEYS.includes(key);
}

export function isValidLayoutOrder(order) {
  if (!Array.isArray(order)) return false;
  if (order.length !== AISLE_KEYS.length) return false;
  const set = new Set(order);
  if (set.size !== AISLE_KEYS.length) return false;
  return order.every((k) => AISLE_KEYS.includes(k));
}
