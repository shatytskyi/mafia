import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPersistence, buildSnapshot, applySnapshotToState, formatSavedAgo } from '../src/state/persistence.js';

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; }
  };
}

test('save/load round-trip preserves snapshot', () => {
  const p = createPersistence(memStorage());
  const snap = { ts: Date.now(), players: [{ name: 'A', role: 'mafia', alive: true }], phase: 'night', day: 1 };
  p.saveSnapshot(snap);
  assert.deepEqual(p.loadSnapshot(), snap);
});

test('snapshot expires past TTL', () => {
  const p = createPersistence(memStorage());
  const snap = { ts: Date.now() - (25 * 60 * 60 * 1000), players: [], phase: 'night', day: 1 };
  p.saveSnapshot(snap);
  assert.equal(p.loadSnapshot(), null);
});

test('snapshot within 24h is still valid', () => {
  const p = createPersistence(memStorage());
  const snap = { ts: Date.now() - (20 * 60 * 60 * 1000), players: [], phase: 'night', day: 1 };
  p.saveSnapshot(snap);
  assert.deepEqual(p.loadSnapshot(), snap);
});

test('malformed JSON returns null and clears', () => {
  const st = memStorage();
  st.setItem('mafia.game.v1', '{bad json');
  const p = createPersistence(st);
  assert.equal(p.loadSnapshot(), null);
  assert.equal(st.getItem('mafia.game.v1'), null);
});

test('theme round-trip', () => {
  const p = createPersistence(memStorage());
  assert.equal(p.loadTheme(), null);
  p.saveTheme('dark');
  assert.equal(p.loadTheme(), 'dark');
});

test('applySnapshotToState merges missing gameOptions', () => {
  const state = {
    playerCount: 0, optionalRoles: {}, gameOptions: { sheriffSeesManiac: 'afterMafia', whoreDiesAtMafia: false },
    players: [], day: 1, phase: 'night', stepIndex: 0, night: {},
    doctorHistory: [], doctorSelfUsed: false, whoreHistory: [], dayVoteKilled: null, winner: null, screen: 'home'
  };
  const data = {
    ts: Date.now(), playerCount: 6, optionalRoles: { don: true },
    players: [], day: 2, phase: 'day', stepIndex: 1,
    night: null, doctorHistory: null, whoreHistory: null, dayVoteKilled: null, winner: null
  };
  applySnapshotToState(state, data);
  assert.equal(state.screen, 'host');
  assert.deepEqual(state.gameOptions, { sheriffSeesManiac: 'afterMafia', whoreDiesAtMafia: false });
  assert.equal(state.day, 2);
  assert.deepEqual(state.doctorHistory, []);
});

test('buildSnapshot copies required fields', () => {
  const state = {
    playerCount: 6, optionalRoles: { don: true }, gameOptions: { sheriffSeesManiac: 'always', whoreDiesAtMafia: true },
    players: [{ name: 'A', role: 'mafia', alive: true }],
    day: 3, phase: 'vote', stepIndex: 0,
    night: { mafiaTarget: 1 }, doctorHistory: [2], doctorSelfUsed: true, whoreHistory: [3],
    dayVoteKilled: 4, winner: null
  };
  const snap = buildSnapshot(state);
  assert.equal(snap.playerCount, 6);
  assert.equal(snap.day, 3);
  assert.equal(snap.dayVoteKilled, 4);
  assert.ok(snap.ts > 0);
});

test('formatSavedAgo human-readable', () => {
  const now = Date.now();
  assert.equal(formatSavedAgo(now), 'только что');
  assert.equal(formatSavedAgo(now - 30 * 60 * 1000), '30 мин назад');
  assert.equal(formatSavedAgo(now - (2 * 60 + 15) * 60 * 1000), '2 ч 15 мин назад');
});

test('roster round-trip preserves playerCount and names', () => {
  const p = createPersistence(memStorage());
  assert.equal(p.loadRoster(), null);
  p.saveRoster({ playerCount: 4, names: ['Alice', 'Bob', 'Carol', 'Dan'] });
  assert.deepEqual(p.loadRoster(), { playerCount: 4, names: ['Alice', 'Bob', 'Carol', 'Dan'] });
});

test('roster ignores payload with mismatched length', () => {
  const p = createPersistence(memStorage());
  p.saveRoster({ playerCount: 4, names: ['Alice', 'Bob'] });
  assert.equal(p.loadRoster(), null);
});

test('roster rejects out-of-range playerCount', () => {
  const p = createPersistence(memStorage());
  p.saveRoster({ playerCount: 3, names: ['A', 'B', 'C'] });
  assert.equal(p.loadRoster(), null);
  p.saveRoster({ playerCount: 21, names: new Array(21).fill('X') });
  assert.equal(p.loadRoster(), null);
});

test('roster clearRoster removes stored value', () => {
  const p = createPersistence(memStorage());
  p.saveRoster({ playerCount: 4, names: ['A', 'B', 'C', 'D'] });
  assert.ok(p.loadRoster());
  p.clearRoster();
  assert.equal(p.loadRoster(), null);
});

test('roster has no TTL', () => {
  const st = memStorage();
  const p = createPersistence(st);
  p.saveRoster({ playerCount: 4, names: ['A', 'B', 'C', 'D'] });
  const raw = st.getItem('mafia.roster.v1');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.ts, undefined);
  assert.deepEqual(p.loadRoster(), { playerCount: 4, names: ['A', 'B', 'C', 'D'] });
});

test('roster rejects malformed JSON and clears key', () => {
  const st = memStorage();
  st.setItem('mafia.roster.v1', '{bad');
  const p = createPersistence(st);
  assert.equal(p.loadRoster(), null);
  assert.equal(st.getItem('mafia.roster.v1'), null);
});
