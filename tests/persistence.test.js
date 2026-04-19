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
  const snap = { ts: Date.now() - (7 * 60 * 60 * 1000), players: [], phase: 'night', day: 1 };
  p.saveSnapshot(snap);
  assert.equal(p.loadSnapshot(), null);
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
