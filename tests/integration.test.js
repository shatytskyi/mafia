import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealRoles, calcRoleDistribution } from '../src/core/distribution.js';
import { resolveNight, applyNightResolution } from '../src/core/night.js';
import { checkWinCondition } from '../src/core/win.js';
import { emptyNight } from '../src/state/state.js';

function makeState(playerCount, optionalRoles, gameOptions = {}) {
  const names = Array.from({ length: playerCount }, (_, i) => `P${i + 1}`);
  // Seeded PRNG so role assignments are deterministic.
  let seed = 42;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const players = dealRoles(names.map(n => ({ name: n })), { playerCount, optionalRoles }, rng);
  return {
    playerCount,
    optionalRoles,
    gameOptions: { whoreDiesAtMafia: false, ...gameOptions },
    players,
    day: 1,
    phase: 'night',
    stepIndex: 0,
    night: emptyNight(),
    doctorHistory: [],
    doctorSelfUsed: false,
    whoreHistory: [],
    nightLog: [],
    dayVoteKilled: null,
    winner: null,
  };
}

function indexOfRole(state, role) {
  return state.players.findIndex(p => p.role === role && p.alive);
}

test('full game: mafia wins after killing civilians down to parity', () => {
  // 6 players, no optionals except doctor. Roles: 2 mafia side + 1 sheriff + 1 doctor + 2 civilians.
  const state = makeState(6, { don: false, doctor: true, maniac: false, whore: false });
  const dist = calcRoleDistribution({ playerCount: 6, optionalRoles: state.optionalRoles });
  assert.equal(dist.mafia + dist.don, 2);

  // Night 1 — first night, no kills.
  state.night = emptyNight();
  state.night.resolved = resolveNight(state);
  applyNightResolution(state);
  assert.equal(state.nightLog.length, 1);
  assert.equal(state.nightLog[0].killed.length, 0);

  // Loop: each subsequent night mafia picks the first living civilian; day kills no one.
  for (let day = 2; day <= 10; day++) {
    state.day = day;
    state.night = emptyNight();
    const victim = state.players.findIndex(p => p.alive && p.role === 'civilian');
    if (victim === -1) break;
    state.night.mafiaTarget = victim;
    state.night.resolved = resolveNight(state);
    applyNightResolution(state);
    const winner = checkWinCondition(state);
    if (winner) {
      assert.equal(winner, 'mafia');
      return;
    }
  }
  throw new Error('mafia never won within 10 nights');
});

test('full game: civilians win after executing all mafia by day vote', () => {
  const state = makeState(6, { don: false, doctor: false, maniac: false, whore: false });
  // Skip night 1 (meet-and-greet).
  state.night.resolved = resolveNight(state);
  applyNightResolution(state);

  // Daytime: remove all mafia via dayVoteKilled. Bypass the UI by setting alive=false directly.
  let guard = 10;
  while (checkWinCondition(state) == null && guard-- > 0) {
    const mafiaIdx = state.players.findIndex(p => p.alive && (p.role === 'mafia' || p.role === 'don'));
    if (mafiaIdx === -1) break;
    state.players[mafiaIdx].alive = false;
    const winner = checkWinCondition(state);
    if (winner) {
      assert.equal(winner, 'city');
      return;
    }
    // Next night — mafia may still kill if alive.
    state.day++;
    state.night = emptyNight();
    state.night.resolved = resolveNight(state);
    applyNightResolution(state);
  }
  throw new Error('city never won');
});

test('applyNightResolution is idempotent even across multiple calls', () => {
  const state = makeState(8, { don: true, doctor: true, maniac: false, whore: false });
  state.day = 2;
  state.night = emptyNight();
  const targetCivilian = state.players.findIndex(p => p.alive && p.role === 'civilian');
  state.night.mafiaTarget = targetCivilian;
  state.night.resolved = resolveNight(state);
  applyNightResolution(state);
  applyNightResolution(state);
  applyNightResolution(state);
  assert.equal(state.nightLog.length, 1);
  assert.equal(state.doctorHistory.length, 1);
});

test('nightLog records mafia picks', () => {
  const state = makeState(8, { don: true, doctor: true, maniac: false, whore: false });
  state.day = 2;
  state.night = emptyNight();

  const sheriffTarget = indexOfRole(state, 'civilian');
  const mafiaTarget = state.players.findIndex((p, i) => p.alive && p.role === 'civilian' && i !== sheriffTarget);
  state.night.mafiaTarget = mafiaTarget;
  state.night.resolved = resolveNight(state);
  applyNightResolution(state);

  const entry = state.nightLog[0];
  assert.equal(entry.day, 2);
  assert.deepEqual(entry.mafia, { target: mafiaTarget });
  assert.deepEqual(entry.killed, [mafiaTarget]);
});

test('whore hard mode: whore dies with mafia, night log captures it', () => {
  const state = makeState(8, { don: true, doctor: true, maniac: false, whore: true }, { whoreDiesAtMafia: true });
  state.day = 2;
  state.night = emptyNight();
  const mafiaIdx = indexOfRole(state, 'mafia');
  state.night.whoreTarget = mafiaIdx >= 0 ? mafiaIdx : indexOfRole(state, 'don');
  state.night.resolved = resolveNight(state);
  applyNightResolution(state);
  const entry = state.nightLog[0];
  assert.ok(entry.whore);
  assert.equal(entry.whore.died, true);
  assert.equal(entry.whore.atMafia, true);
});
