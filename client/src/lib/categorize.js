// A light keyword lookup that buckets a typed item name into one of the
// seven fixed aisles, so adding something to the list doesn't require a
// separate aisle picker — type "bananas" and it lands in Fruit & veg on
// its own. Falls back to Cupboard (the catch-all dry-goods aisle) for
// anything unrecognised; the aisle can always be moved later by editing
// the layout order the item's rail follows.
const KEYWORDS = {
  fruit_veg: [
    'banana', 'apple', 'pear', 'grape', 'orange', 'lemon', 'lime', 'berry', 'berries',
    'broccoli', 'carrot', 'onion', 'potato', 'tomato', 'pepper', 'cucumber', 'lettuce',
    'salad', 'spinach', 'avocado', 'mushroom', 'garlic', 'ginger', 'courgette', 'kale',
    'sprout', 'cauliflower', 'leek', 'celery', 'melon', 'peach', 'plum', 'mango',
  ],
  bakery: [
    'bread', 'loaf', 'sourdough', 'bagel', 'bun', 'roll', 'croissant', 'baguette',
    'muffin', 'cake', 'pastry', 'pitta', 'naan', 'crumpet', 'brioche', 'doughnut',
  ],
  meat_fish: [
    'chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'mince', 'steak', 'ham',
    'turkey', 'salmon', 'fish', 'prawn', 'tuna', 'cod', 'burger', 'chorizo', 'salami',
  ],
  chilled: [
    'milk', 'cheese', 'cheddar', 'yoghurt', 'yogurt', 'butter', 'cream', 'egg',
    'hummus', 'houmous', 'margarine', 'mozzarella', 'feta', 'paneer', 'quark',
  ],
  frozen: [
    'frozen', 'peas', 'ice cream', 'ice lolly', 'chips', 'pizza', 'fish finger',
    'freezer',
  ],
  cupboard: [
    'pasta', 'rice', 'flour', 'sugar', 'tea', 'coffee', 'cereal', 'tin', 'tinned',
    'can', 'sauce', 'oil', 'vinegar', 'spice', 'herb', 'salt', 'pepper corn', 'stock',
    'biscuit', 'crisp', 'snack', 'jam', 'honey', 'peanut butter', 'noodle', 'lentil',
    'bean', 'soup', 'wine', 'beer', 'squash', 'juice', 'water', 'crackers', 'oats',
  ],
  household: [
    'washing up', 'washing-up', 'liquid', 'kitchen roll', 'toilet roll', 'loo roll',
    'bin bag', 'bin liner', 'sponge', 'cloth', 'detergent', 'softener', 'bleach',
    'foil', 'cling film', 'batteries', 'lightbulb', 'candle', 'tissue', 'soap',
    'shampoo', 'toothpaste', 'deodorant', 'nappy', 'nappies', 'cotton wool',
  ],
};

// Checked before the general keyword scan below: "tinned tomatoes" should
// land in Cupboard even though "tomato" would otherwise match Fruit & veg,
// and likewise for other packaging words that override what's inside.
const OVERRIDES = [
  { test: /\btinned\b|\bcanned\b|\btin of\b|\bcan of\b/, aisleKey: 'cupboard' },
  { test: /\bfrozen\b/, aisleKey: 'frozen' },
];

export function categorize(name) {
  const lower = name.toLowerCase();
  for (const override of OVERRIDES) {
    if (override.test.test(lower)) return override.aisleKey;
  }
  for (const [aisleKey, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return aisleKey;
  }
  return 'cupboard';
}

/** Pulls a trailing "x2" / "×3" quantity off a typed name, if present. */
export function parseNameAndQty(raw) {
  const match = raw.trim().match(/^(.*?)\s*[x×]\s*(\d{1,2})$/i);
  if (match && match[1].trim()) {
    return { name: match[1].trim(), qty: Math.max(1, parseInt(match[2], 10)) };
  }
  return { name: raw.trim(), qty: 1 };
}
