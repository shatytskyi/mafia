import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNight, applyNightResolution, canDoctorHeal, canWhoreGo, getWhoreBlocks } from '../src/core/night.js';

function stateWith({ players, day = 2, night = {}, gameOptions = {} }) {
  return {
    players,
    day,
    night: {
      mafiaTarget: null, donCheck: null, whoreTarget: null,
      doctorTarget: null, sheriffCheck: null, maniacTarget: null,
      ...night
    },
    gameOptions: { sheriffSeesManiac: 'afterMafia', whoreDiesAtMafia: false, ...gameOptions },
    doctorHistory: [],
    whoreHistory: [],
    doctorSelfUsed: false
  };
}

const players = () => [
  { name: 'A', role: 'mafia',    alive: true },
  { name: 'B', role: 'don',      alive: true },
  { name: 'C', role: 'sheriff',  alive: true },
  { name: 'D', role: 'doctor',   alive: true },
  { name: 'E', role: 'maniac',   alive: true },
  { name: 'F', role: 'whore',    alive: true },
  { name: 'G', role: 'civilian', alive: true },
  { name: 'H', role: 'civilian', alive: true },
];

test('first-night mafia kill is ignored', () => {
  const s = stateWith({ players: players(), day: 1, night: { mafiaTarget: 6 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
});

test('mafia kills a civilian', () => {
  const s = stateWith({ players: players(), night: { mafiaTarget: 6 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, [6]);
  assert.equal(r.savedByDoctor, null);
});

test('doctor saves mafia target', () => {
  const s = stateWith({ players: players(), night: { mafiaTarget: 6, doctorTarget: 6 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.savedByDoctor, 6);
});

test('whore (soft) blocks sole living mafioso', () => {
  const p = players();
  p[1].alive = false;
  const s = stateWith({ players: p, night: { whoreTarget: 0, mafiaTarget: 6 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.blocked.mafia, true);
  assert.equal(r.whoreAtMafia, true);
  assert.equal(r.whoreDied, false);
});

test('whore (soft) does NOT block when two mafia alive', () => {
  const s = stateWith({ players: players(), night: { whoreTarget: 0, mafiaTarget: 6 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, [6]);
  assert.equal(r.blocked.mafia, undefined);
  assert.equal(r.whoreAtMafia, true);
});

test('whore (hard) visiting mafia: whore dies, mafia blocked', () => {
  const s = stateWith({
    players: players(),
    night: { whoreTarget: 0, mafiaTarget: 6 },
    gameOptions: { whoreDiesAtMafia: true }
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, [5]);
  assert.equal(r.whoreDied, true);
  assert.equal(r.blocked.mafia, true);
});

test('whore (hard) + doctor saves whore', () => {
  const s = stateWith({
    players: players(),
    night: { whoreTarget: 0, mafiaTarget: 6, doctorTarget: 5 },
    gameOptions: { whoreDiesAtMafia: true }
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.whoreDied, true);
  assert.equal(r.whoreSavedByDoctor, true);
});

test('maniac kills on non-first night', () => {
  const s = stateWith({ players: players(), night: { maniacTarget: 6 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, [6]);
});

test('maniac kills on first night too (mafia does not)', () => {
  const s = stateWith({ players: players(), day: 1, night: { maniacTarget: 6, mafiaTarget: 7 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, [6]);
});

test('mafia + maniac on same target + doctor: one save', () => {
  const s = stateWith({ players: players(), night: { mafiaTarget: 6, maniacTarget: 6, doctorTarget: 6 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.savedByDoctor, 6);
});

test('mafia + maniac on different targets: both die', () => {
  const s = stateWith({ players: players(), night: { mafiaTarget: 6, maniacTarget: 7 } });
  const r = resolveNight(s);
  assert.deepEqual(r.killed.sort(), [6, 7]);
});

test('sheriff sees maniac as mafia only after all mafia dead (afterMafia mode)', () => {
  const p = players();
  const s1 = stateWith({ players: p, night: { sheriffCheck: 4 } });
  assert.equal(resolveNight(s1).sheriffResult, 'notMafia');

  const p2 = players();
  p2[0].alive = false;
  p2[1].alive = false;
  const s2 = stateWith({ players: p2, night: { sheriffCheck: 4 } });
  assert.equal(resolveNight(s2).sheriffResult, 'mafia');
});

test('sheriff never sees maniac (never mode)', () => {
  const p = players();
  p[0].alive = false;
  p[1].alive = false;
  const s = stateWith({
    players: p, night: { sheriffCheck: 4 },
    gameOptions: { sheriffSeesManiac: 'never' }
  });
  assert.equal(resolveNight(s).sheriffResult, 'notMafia');
});

test('sheriff always sees maniac (always mode)', () => {
  const s = stateWith({
    players: players(), night: { sheriffCheck: 4 },
    gameOptions: { sheriffSeesManiac: 'always' }
  });
  assert.equal(resolveNight(s).sheriffResult, 'mafia');
});

test('don check: sheriff -> "sheriff"', () => {
  const s = stateWith({ players: players(), night: { donCheck: 2 } });
  assert.equal(resolveNight(s).donResult, 'sheriff');
});

test('don check: non-sheriff -> "notSheriff"', () => {
  const s = stateWith({ players: players(), night: { donCheck: 6 } });
  assert.equal(resolveNight(s).donResult, 'notSheriff');
});

test('whore visits don: don check blocked', () => {
  const s = stateWith({ players: players(), night: { whoreTarget: 1, donCheck: 2 } });
  const r = resolveNight(s);
  assert.equal(r.donResult, null);
});

test('canDoctorHeal: same target two nights in a row blocked', () => {
  const p = players();
  const res = canDoctorHeal(p, 6, [6], false);
  assert.equal(res.ok, false);
});

test('canDoctorHeal: self once then blocked', () => {
  const p = players();
  const doctorIdx = p.findIndex(x => x.role === 'doctor');
  assert.equal(canDoctorHeal(p, doctorIdx, [], false).ok, true);
  assert.equal(canDoctorHeal(p, doctorIdx, [], true).ok, false);
});

test('canWhoreGo: self blocked', () => {
  const p = players();
  const whoreIdx = p.findIndex(x => x.role === 'whore');
  assert.equal(canWhoreGo(p, whoreIdx, []).ok, false);
});

test('applyNightResolution is idempotent', () => {
  const s = stateWith({ players: players(), night: { mafiaTarget: 6 } });
  s.night.resolved = resolveNight(s);
  applyNightResolution(s);
  const before = s.players[6].alive;
  assert.equal(before, false);
  applyNightResolution(s);
  assert.equal(s.doctorHistory.length, 1);
  assert.equal(s.whoreHistory.length, 1);
});
