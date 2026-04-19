import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWinCondition } from '../src/core/win.js';

function ps(spec) {
  return spec.split(',').map(s => {
    const [role, alive] = s.trim().split(':');
    return { role, alive: alive !== 'dead' };
  });
}
const s = (spec) => ({ players: ps(spec) });

test('all dead → draw', () => {
  assert.equal(checkWinCondition(s('mafia:dead,civilian:dead')), 'draw');
});

test('no mafia, no maniac → city', () => {
  assert.equal(checkWinCondition(s('civilian:alive,sheriff:alive')), 'city');
});

test('no mafia, maniac + 1 civilian → maniac', () => {
  assert.equal(checkWinCondition(s('maniac:alive,civilian:alive')), 'maniac');
});

test('no mafia, maniac + 2 civilians → game continues', () => {
  assert.equal(checkWinCondition(s('maniac:alive,civilian:alive,civilian:alive')), null);
});

test('mafia parity (2 vs 2) → mafia', () => {
  assert.equal(checkWinCondition(s('mafia:alive,don:alive,civilian:alive,sheriff:alive')), 'mafia');
});

test('mafia minority → continue', () => {
  assert.equal(checkWinCondition(s('mafia:alive,civilian:alive,civilian:alive,sheriff:alive')), null);
});

test('mafia + maniac + no civilians → mafia', () => {
  assert.equal(checkWinCondition(s('mafia:alive,maniac:alive')), 'mafia');
});

test('fresh game with everyone alive → continue', () => {
  assert.equal(checkWinCondition(s('mafia:alive,don:alive,sheriff:alive,doctor:alive,civilian:alive,civilian:alive')), null);
});
