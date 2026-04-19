import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle } from '../src/core/shuffle.js';

test('shuffle does not mutate input', () => {
  const input = [1, 2, 3, 4, 5];
  const copy = [...input];
  shuffle(input);
  assert.deepEqual(input, copy);
});

test('shuffle preserves elements', () => {
  const input = [1, 2, 3, 4, 5];
  const result = shuffle(input, () => 0.5);
  assert.deepEqual([...result].sort(), input);
});

test('shuffle with deterministic RNG returns deterministic output', () => {
  const rng = (() => {
    let i = 0;
    const seq = [0.1, 0.4, 0.7, 0.2];
    return () => seq[i++ % seq.length];
  })();
  const input = [1, 2, 3, 4, 5];
  const a = shuffle(input, rng);
  const rng2 = (() => {
    let i = 0;
    const seq = [0.1, 0.4, 0.7, 0.2];
    return () => seq[i++ % seq.length];
  })();
  const b = shuffle(input, rng2);
  assert.deepEqual(a, b);
});
