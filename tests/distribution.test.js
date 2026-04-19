import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcRoleDistribution, canEnableRole, isRoleEffective, dealRoles, MIN_CIVILIANS } from '../src/core/distribution.js';

const allOff = { don: false, doctor: false, maniac: false, whore: false, veteran: false };
const allOn  = { don: true,  doctor: true,  maniac: true,  whore: true,  veteran: false };

test('4 players: 1 mafia, 1 sheriff, 2 civilians', () => {
  const d = calcRoleDistribution({ playerCount: 4, optionalRoles: allOff });
  assert.equal(d.mafia, 1);
  assert.equal(d.don, 0);
  assert.equal(d.sheriff, 1);
  assert.equal(d.civilian, 2);
  assert.equal(d.totalMafiaSide, 1);
});

test('5 players never exceed 1 mafia even with don toggle', () => {
  const d = calcRoleDistribution({ playerCount: 5, optionalRoles: { ...allOff, don: true } });
  assert.equal(d.totalMafiaSide, 1);
  assert.equal(d.don, 0);
});

test('6 players with don enabled: 1 mafia + 1 don', () => {
  const d = calcRoleDistribution({ playerCount: 6, optionalRoles: { ...allOff, don: true } });
  assert.equal(d.mafia, 1);
  assert.equal(d.don, 1);
  assert.equal(d.totalMafiaSide, 2);
});

test('8 players with all optional on: respects balancer', () => {
  const d = calcRoleDistribution({ playerCount: 8, optionalRoles: allOn });
  assert.equal(d.mafia + d.don, 2);
  assert.equal(d.don, 1);
  assert.equal(d.sheriff, 1);
  assert.equal(d.doctor, 1);
  assert.equal(d.maniac, 1);
  assert.equal(d.whore, 1);
  assert.equal(d.civilian, 2);
});

test('balancer trims optional roles to keep MIN_CIVILIANS', () => {
  const d = calcRoleDistribution({ playerCount: 7, optionalRoles: allOn });
  assert.ok(d.civilian >= MIN_CIVILIANS);
  assert.equal(d.maniac, 0);
  assert.equal(d.whore, 0);
});

test('canEnableRole gates correctly', () => {
  assert.equal(canEnableRole('don', 5), false);
  assert.equal(canEnableRole('don', 6), true);
  assert.equal(canEnableRole('maniac', 7), false);
  assert.equal(canEnableRole('maniac', 8), true);
  assert.equal(canEnableRole('whore', 7), false);
  assert.equal(canEnableRole('whore', 8), true);
  assert.equal(canEnableRole('doctor', 4), true);
});

test('isRoleEffective reports squeezed role', () => {
  const input = { playerCount: 4, optionalRoles: { ...allOff, doctor: true } };
  assert.equal(isRoleEffective('doctor', input), false);
});

test('dealRoles: every player gets a role, distribution matches', () => {
  const players = Array.from({ length: 8 }, (_, i) => ({ name: `P${i+1}` }));
  const result = dealRoles(players, { playerCount: 8, optionalRoles: allOn });
  assert.equal(result.length, 8);
  const counts = result.reduce((acc, p) => { acc[p.role] = (acc[p.role]||0)+1; return acc; }, {});
  const expected = calcRoleDistribution({ playerCount: 8, optionalRoles: allOn });
  for (const k of ['mafia','don','sheriff','doctor','maniac','whore','civilian']) {
    assert.equal(counts[k] || 0, expected[k], `role count for ${k}`);
  }
  assert.ok(result.every(p => p.alive === true));
});

// ---------------------------------------------------------------------------
// Veteran role (§4 of the 2026-04-19 spec)
// ---------------------------------------------------------------------------

test('canEnableRole veteran gated at n >= 6', () => {
  assert.equal(canEnableRole('veteran', 5), false);
  assert.equal(canEnableRole('veteran', 6), true);
  assert.equal(canEnableRole('veteran', 10), true);
});

test('10 players with only veteran toggled: dist.veteran === 1', () => {
  const d = calcRoleDistribution({
    playerCount: 10,
    optionalRoles: { ...allOff, veteran: true },
  });
  assert.equal(d.veteran, 1);
  assert.ok(d.civilian >= MIN_CIVILIANS);
});

test('balancer squeezes veteran before doctor at 6 players', () => {
  const d = calcRoleDistribution({
    playerCount: 6,
    optionalRoles: { don: true, doctor: true, maniac: false, whore: false, veteran: true },
  });
  assert.ok(d.civilian >= MIN_CIVILIANS);
  assert.equal(d.veteran, 0);
  assert.equal(d.doctor, 1);
  assert.equal(d.don, 1);
});

test('balancer keeps veteran when doctor is off at 6 players', () => {
  const d = calcRoleDistribution({
    playerCount: 6,
    optionalRoles: { don: true, doctor: false, maniac: false, whore: false, veteran: true },
  });
  assert.equal(d.veteran, 1);
  assert.equal(d.doctor, 0);
  assert.equal(d.don, 1);
  assert.ok(d.civilian >= MIN_CIVILIANS);
});

test('10 players with every optional on (incl. veteran): all fit', () => {
  const d = calcRoleDistribution({
    playerCount: 10,
    optionalRoles: { don: true, doctor: true, maniac: true, whore: true, veteran: true },
  });
  assert.equal(d.don, 1);
  assert.equal(d.doctor, 1);
  assert.equal(d.maniac, 1);
  assert.equal(d.whore, 1);
  assert.equal(d.veteran, 1);
  assert.ok(d.civilian >= MIN_CIVILIANS);
});

test('dealRoles assigns exactly one veteran when enabled', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ name: `P${i+1}` }));
  const result = dealRoles(players, {
    playerCount: 10,
    optionalRoles: { don: true, doctor: true, maniac: true, whore: true, veteran: true },
  });
  const counts = result.reduce((acc, p) => { acc[p.role] = (acc[p.role]||0)+1; return acc; }, {});
  assert.equal(counts.veteran || 0, 1);
});
