import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShoppingRoom } from './identity.js';

test('no rooms at all resolves to nothing', () => {
  assert.equal(resolveShoppingRoom([]), undefined);
});

test('every visited room being "other" resolves to nothing', () => {
  const rooms = [
    { slug: 'a', kind: 'other' },
    { slug: 'b', kind: 'other' },
  ];
  assert.equal(resolveShoppingRoom(rooms), undefined);
});

test('legacy entries with no kind at all count as shopping', () => {
  const rooms = [{ slug: 'legacy' }];
  assert.equal(resolveShoppingRoom(rooms), 'legacy');
});

test('picks the most recently visited shopping room even when it is not first', () => {
  const rooms = [
    { slug: 'other-list', kind: 'other' },
    { slug: 'shopping-list', kind: 'shopping' },
  ];
  assert.equal(resolveShoppingRoom(rooms), 'shopping-list');
});

test('prefers a shopping room known to hold a loyalty card over a more recent one that has none', () => {
  const rooms = [
    { slug: 'recent-empty', kind: 'shopping', cardCount: 0 },
    { slug: 'older-with-cards', kind: 'shopping', cardCount: 2 },
  ];
  assert.equal(resolveShoppingRoom(rooms), 'older-with-cards');
});

test('falls back to the most recent shopping room while card counts have not loaded yet', () => {
  const rooms = [
    { slug: 'recent', kind: 'shopping' },
    { slug: 'older', kind: 'shopping' },
  ];
  assert.equal(resolveShoppingRoom(rooms), 'recent');
});
