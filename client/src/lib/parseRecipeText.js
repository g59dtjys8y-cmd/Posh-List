// Best-effort extraction of ingredient lines from a block of pasted recipe
// text — a blog post's text, a note, whatever someone copied. Not meant to
// be perfect: the caller shows the result as an editable, checkable list
// before anything touches the shopping list, so a wrong guess is a one-tap
// fix, not a silent error.

const INGREDIENTS_HEADING = /^(ingredients?|shopping list|you('|wi)ll need|what you need)\s*:?\s*$/i;
const INSTRUCTIONS_HEADING = /^(instructions?|method|directions?|steps?|preparation|to make|how to make)\s*:?\s*$/i;

const BULLET_PREFIX = /^[-*•–—]\s*/;

// Common leading imperative verbs a method step starts with — used only in
// the no-headings fallback, to avoid pulling instruction sentences in as
// if they were ingredients.
const INSTRUCTION_VERB_START = new RegExp(
  '^(preheat|heat|mix|stir|whisk|bake|cook|add|combine|pour|place|remove|serve|garnish|' +
    'season|cover|chill|refrigerate|simmer|boil|drain|fold|beat|blend|roast|grill|fry|' +
    'saute|sauté|melt|knead|chop|slice|dice|mince|arrange|transfer|spread|sprinkle|' +
    'reduce|bring|let|allow|repeat|continue|meanwhile|once|when|preparing|prepare|mash|' +
    'toss|top|layer|squeeze|peel|cut|trim|rinse|marinate|brush|drizzle|form|shape|divide|' +
    'wrap|roll|dust|crumble|shred|grate|puree|process|pulse|line|grease|assemble|check|' +
    'insert|turn|flip|rest|warm|cool|set)\\b',
  'i'
);

const QTY_START = /^(\d|½|¼|¾|⅓|⅔|a\s|an\s|one\s|two\s|three\s|four\s|five\s|six\s)/i;

function cleanLine(line) {
  return line.replace(BULLET_PREFIX, '').trim();
}

/**
 * Extracts likely ingredient lines from a pasted block of recipe text.
 * Prefers an explicit "Ingredients" heading (stopping at the next
 * "Instructions"/"Method" heading, or end of text); falls back to a
 * per-line heuristic scan when no headings are present at all.
 */
export function parseIngredientsFromText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const ingredientsIdx = lines.findIndex((l) => INGREDIENTS_HEADING.test(l));

  let candidates;
  if (ingredientsIdx !== -1) {
    const rest = lines.slice(ingredientsIdx + 1);
    const stopIdx = rest.findIndex((l) => INSTRUCTIONS_HEADING.test(l));
    candidates = stopIdx === -1 ? rest : rest.slice(0, stopIdx);
  } else {
    candidates = lines.filter((line, idx) => {
      if (QTY_START.test(line)) return true;
      // The very first line of an unstructured paste is almost always the
      // recipe's title, not an ingredient — unless it clearly starts with
      // a quantity (caught above already).
      if (idx === 0) return false;
      if (line.length > 100) return false;
      if (INSTRUCTION_VERB_START.test(line)) return false;
      if (/^(ingredients?|instructions?|method|directions?|steps?|notes?)\s*:?\s*$/i.test(line)) return false;
      // A line ending in a period with more than ~8 words reads as prose
      // (a method step or a description), not an ingredient.
      if (/\.$/.test(line) && line.split(/\s+/).length > 8) return false;
      return true;
    });
  }

  return candidates
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 40);
}
