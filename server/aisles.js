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

// Ordered most-specific-first so e.g. "peanut butter" (cupboard) is checked
// before a bare "butter" keyword (chilled) could steal the match.
const AISLE_KEYWORDS = [
  ['cupboard', [
    'peanut butter', 'almond butter', 'nut butter', 'flour', 'sugar', 'rice', 'pasta',
    'spaghetti', 'noodle', 'lentil', 'chickpea', 'bean', 'oil', 'vinegar', 'stock',
    'broth', 'honey', 'vanilla', 'baking powder', 'baking soda', 'cocoa', 'chocolate chip',
    'cumin', 'paprika', 'cinnamon', 'nutmeg', 'oregano', 'thyme', 'bay leaf', 'yeast',
    'tahini', 'coffee', 'tea bag', 'ketchup', 'mustard', 'mayonnaise', 'jam', 'syrup',
    'salt', 'pepper', 'spice', 'canned', 'tin of', 'cereal', 'oats', 'breadcrumb',
    'cracker', 'nuts', 'raisin', 'dried fruit', 'stock cube', 'gelatine', 'cornstarch',
    'cornflour', 'soy sauce', 'fish sauce', 'coconut milk', 'peanut', 'almond', 'walnut',
    'sesame',
  ]],
  ['bakery', [
    'bread', 'baguette', 'roll', 'bun', 'tortilla', 'pita', 'bagel', 'ladyfinger',
    'croissant', 'naan', 'pastry', 'pie crust', 'pizza dough',
  ]],
  ['meat_fish', [
    'chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'turkey', 'mince', 'steak',
    'ham', 'salami', 'chorizo', 'pancetta', 'guanciale', 'fish', 'salmon', 'tuna',
    'shrimp', 'prawn', 'anchov', 'cod', 'haddock', 'crab', 'mussel',
  ]],
  ['chilled', [
    'milk', 'cream', 'yogurt', 'yoghurt', 'cheese', 'butter', 'egg', 'mascarpone',
    'feta', 'parmesan', 'pecorino', 'mozzarella', 'cheddar', 'ricotta', 'buttermilk',
    'crème fraîche', 'sour cream',
  ]],
  ['frozen', [
    'frozen', 'ice cream', 'ice lolly', 'peas',
  ]],
  ['fruit_veg', [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'onion', 'garlic', 'potato', 'carrot',
    'tomato', 'pepper', 'lettuce', 'spinach', 'cucumber', 'avocado', 'mushroom', 'celery',
    'broccoli', 'cauliflower', 'parsley', 'basil', 'cilantro', 'coriander', 'mint',
    'rosemary', 'ginger', 'chilli', 'chili', 'jalapeno', 'jalapeño', 'kale', 'zucchini',
    'courgette', 'aubergine', 'eggplant', 'sweet potato', 'squash', 'pumpkin', 'grape',
    'berry', 'berries', 'melon', 'pineapple', 'mango', 'peach', 'pear', 'plum', 'fig',
    'leek', 'radish', 'beetroot', 'cabbage', 'sprout', 'scallion', 'spring onion',
    'shallot',
  ]],
  ['household', [
    'foil', 'cling film', 'paper towel', 'kitchen roll', 'dish soap', 'trash bag',
    'bin bag', 'napkin', 'sponge',
  ]],
];

/**
 * Best-effort keyword guess at which aisle a free-text ingredient/item name
 * belongs in — used when a caller (e.g. an external recipe import) doesn't
 * supply an aisleKey. Not meant to be perfect: `learnKnownItem` already lets
 * a room's own history override a bad guess the next time the same item is
 * added, and a wrongly-categorised item is a one-tap fix like any other.
 */
export function guessAisleKey(name) {
  const lower = String(name || '').toLowerCase();
  for (const [aisleKey, keywords] of AISLE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return aisleKey;
  }
  return 'cupboard';
}
