import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredientsFromText } from './parseRecipeText.js';

test('extracts lines under an Ingredients heading, stopping before the next heading', () => {
  const text = 'Chocolate Cake\n\nIngredients:\n200g flour\n2 eggs\n100g sugar\n\nInstructions:\n1. Preheat oven\n2. Mix everything';
  assert.deepEqual(parseIngredientsFromText(text), ['200g flour', '2 eggs', '100g sugar']);
});

test('strips bullet prefixes from heading-based lines', () => {
  const text = 'Ingredients\n- 2 onions\n* 1 garlic clove\n– 500g mince';
  assert.deepEqual(parseIngredientsFromText(text), ['2 onions', '1 garlic clove', '500g mince']);
});

test('stops an Ingredients section at a Method/Instructions heading', () => {
  const text = 'Ingredients:\n2 cups milk\n1 cup flour\nMethod:\n1. Mix ingredients\n2. Bake for 30 minutes.';
  assert.deepEqual(parseIngredientsFromText(text), ['2 cups milk', '1 cup flour']);
});

test('falls back to per-line heuristics when there is no heading at all', () => {
  const text = [
    'Spaghetti Bolognese',
    '500g minced beef',
    '1 onion, chopped',
    'Salt and pepper to taste',
    'Heat the oil in a large pan and cook until browned thoroughly for best results today.',
    'Add the mince and cook until browned.',
  ].join('\n');
  // The title (first line, no leading quantity) and the two method-step
  // sentences (leading instruction verbs) are dropped; everything else the
  // heuristic can't rule out is kept for the user to review.
  assert.deepEqual(parseIngredientsFromText(text), [
    '500g minced beef',
    '1 onion, chopped',
    'Salt and pepper to taste',
  ]);
});

test('returns nothing for empty input', () => {
  assert.deepEqual(parseIngredientsFromText(''), []);
  assert.deepEqual(parseIngredientsFromText(undefined), []);
});
