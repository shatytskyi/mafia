import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickDawnVariant } from '../src/core/steps.js';

test('pickDawnVariant is deterministic by day', () => {
  const variants = ['A', 'B', 'C'];
  assert.equal(pickDawnVariant(variants, 1), 'A');
  assert.equal(pickDawnVariant(variants, 1), 'A');
  assert.equal(pickDawnVariant(variants, 2), 'B');
  assert.equal(pickDawnVariant(variants, 3), 'C');
});

test('pickDawnVariant wraps around after the last variant', () => {
  const variants = ['A', 'B', 'C'];
  assert.equal(pickDawnVariant(variants, 4), 'A');
  assert.equal(pickDawnVariant(variants, 5), 'B');
  assert.equal(pickDawnVariant(variants, 6), 'C');
});

test('pickDawnVariant clamps non-positive days to day 1', () => {
  const variants = ['A', 'B', 'C'];
  assert.equal(pickDawnVariant(variants, 0), 'A');
  assert.equal(pickDawnVariant(variants, -1), 'A');
  assert.equal(pickDawnVariant(variants, null), 'A');
});

test('pickDawnVariant returns empty string for empty or missing input', () => {
  assert.equal(pickDawnVariant([], 1), '');
  assert.equal(pickDawnVariant(null, 1), '');
  assert.equal(pickDawnVariant(undefined, 1), '');
});

test('pickDawnVariant covers every variant across a 3-day cycle', () => {
  const variants = ['A', 'B', 'C'];
  const seen = new Set();
  for (let d = 1; d <= 3; d++) seen.add(pickDawnVariant(variants, d));
  assert.deepEqual([...seen].sort(), ['A', 'B', 'C']);
});
