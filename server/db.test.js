import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// db.js opens its database at import time, so DB_DIR has to be set before
// that import happens — a fresh temp directory per test run keeps this
// independent of whatever's on disk for a real deploy.
process.env.DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'posh-list-db-test-'));

const {
  createRoom,
  addItem,
  addItems,
  incrementOrAddItem,
  getRegulars,
  getKnownItems,
} = await import('./db.js');

test('a shopping room learns a "usual" once an item crosses the add threshold', () => {
  const room = createRoom('Shopping', null, 'shopping');
  for (let i = 0; i < 4; i++) {
    addItem(room.slug, { name: 'Milk', aisleKey: 'chilled' });
  }
  const regulars = getRegulars(room.slug);
  assert.ok(regulars.some((r) => r.nameKey === 'milk'), 'Milk should be a regular');
});

test('an "other" room never learns anything, however many times an item is added', () => {
  const room = createRoom('Packing', null, 'other');
  for (let i = 0; i < 4; i++) {
    addItem(room.slug, { name: 'Passport', aisleKey: 'cupboard' });
  }
  assert.deepEqual(getRegulars(room.slug), []);
  assert.deepEqual(getKnownItems(room.slug), []);
});

test('the increment path on an "other" room also learns nothing (the branch a naive gate would miss)', () => {
  const room = createRoom('Packing 2', null, 'other');
  incrementOrAddItem(room.slug, { name: 'Sunglasses', aisleKey: 'cupboard' });
  incrementOrAddItem(room.slug, { name: 'Sunglasses', aisleKey: 'cupboard' });
  assert.deepEqual(getRegulars(room.slug), []);
  assert.deepEqual(getKnownItems(room.slug), []);
});

test('bulk addItems on an "other" room learns nothing', () => {
  const room = createRoom('Packing 3', null, 'other');
  addItems(room.slug, [
    { name: 'Tent', aisleKey: 'cupboard' },
    { name: 'Sleeping bag', aisleKey: 'cupboard' },
  ]);
  assert.deepEqual(getRegulars(room.slug), []);
  assert.deepEqual(getKnownItems(room.slug), []);
});

test('createRoom normalises an unrecognised kind to "shopping" rather than throwing', () => {
  const room = createRoom('Junk kind', null, 'banana');
  assert.equal(room.kind, 'shopping');
});
