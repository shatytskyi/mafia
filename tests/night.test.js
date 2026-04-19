import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNight, applyNightResolution, canDoctorHeal, canWhoreGo, canVeteranAct, getWhoreBlocks } from '../src/core/night.js';

function stateWith({ players, day = 2, night = {}, gameOptions = {}, root = {} }) {
  return {
    players,
    day,
    night: {
      mafiaTarget: null, donCheck: null, whoreTarget: null,
      doctorTarget: null, sheriffCheck: null, maniacTarget: null,
      veteranTarget: null, veteranAction: null,
      ...night
    },
    gameOptions: { sheriffSeesManiac: 'afterMafia', whoreDiesAtMafia: false, ...gameOptions },
    doctorHistory: [],
    whoreHistory: [],
    doctorSelfUsed: false,
    veteranHealUsed: false,
    veteranKillUsed: false,
    ...root
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

// ---------------------------------------------------------------------------
// Veteran role (§8 of the 2026-04-19 spec)
// ---------------------------------------------------------------------------

// Index layout:
// 0 mafia · 1 don · 2 sheriff · 3 doctor · 4 maniac · 5 whore
// 6 veteran · 7 civilian · 8 civilian
const playersV = () => [
  { name: 'A', role: 'mafia',    alive: true },
  { name: 'B', role: 'don',      alive: true },
  { name: 'C', role: 'sheriff',  alive: true },
  { name: 'D', role: 'doctor',   alive: true },
  { name: 'E', role: 'maniac',   alive: true },
  { name: 'F', role: 'whore',    alive: true },
  { name: 'G', role: 'veteran',  alive: true },
  { name: 'H', role: 'civilian', alive: true },
  { name: 'I', role: 'civilian', alive: true },
];

test('veteran save cancels mafia kill on the same target', () => {
  const s = stateWith({
    players: playersV(),
    night: { mafiaTarget: 7, veteranAction: 'save', veteranTarget: 7 },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.veteranSaved, 7);
});

test('veteran save cancels maniac kill on the same target', () => {
  const s = stateWith({
    players: playersV(),
    night: { maniacTarget: 7, veteranAction: 'save', veteranTarget: 7 },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.veteranSaved, 7);
});

test('veteran can save himself from the mafia', () => {
  const s = stateWith({
    players: playersV(),
    night: { mafiaTarget: 6, veteranAction: 'save', veteranTarget: 6 },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.veteranSaved, 6);
});

test('veteran kill lands on a plain civilian', () => {
  const s = stateWith({
    players: playersV(),
    night: { veteranAction: 'kill', veteranTarget: 7 },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, [7]);
  assert.equal(r.veteranKill, 7);
});

test('doctor heals veteran kill target', () => {
  const s = stateWith({
    players: playersV(),
    night: { veteranAction: 'kill', veteranTarget: 7, doctorTarget: 7 },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.savedByDoctor, 7);
});

test('veteran kill pre-empts maniac: maniac dies, maniac action nullified', () => {
  const s = stateWith({
    players: playersV(),
    night: { veteranAction: 'kill', veteranTarget: 4, maniacTarget: 7 },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, [4]);
  assert.equal(r.blocked.maniac, true);
  assert.ok(!r.killed.includes(7), 'maniac target must not die');
});

test('veteran pre-empts maniac + doctor heals maniac: maniac lives but still no action', () => {
  const s = stateWith({
    players: playersV(),
    night: { veteranAction: 'kill', veteranTarget: 4, maniacTarget: 7, doctorTarget: 4 },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.blocked.maniac, true);
  assert.equal(r.savedByDoctor, 4);
});

test('whore visiting veteran blocks save and leaves target exposed', () => {
  const s = stateWith({
    players: playersV(),
    night: {
      whoreTarget: 6, veteranAction: 'save', veteranTarget: 7, mafiaTarget: 7,
    },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, [7]);
  assert.equal(r.blocked.veteran, true);
  assert.equal(r.veteranSaved, null);
});

test('whore visiting veteran blocks the kill too', () => {
  const s = stateWith({
    players: playersV(),
    night: { whoreTarget: 6, veteranAction: 'kill', veteranTarget: 7 },
  });
  const r = resolveNight(s);
  assert.deepEqual(r.killed, []);
  assert.equal(r.blocked.veteran, true);
  assert.equal(r.veteranKill, null);
});

test('canVeteranAct: self-kill rejected', () => {
  const p = playersV();
  const res = canVeteranAct(p, 'kill', 6, false, false);
  assert.equal(res.ok, false);
});

test('canVeteranAct: save self is allowed', () => {
  const p = playersV();
  const res = canVeteranAct(p, 'save', 6, false, false);
  assert.equal(res.ok, true);
});

test('canVeteranAct: save already used blocks further save', () => {
  const p = playersV();
  const res = canVeteranAct(p, 'save', 7, true, false);
  assert.equal(res.ok, false);
});

test('canVeteranAct: kill already used blocks further kill', () => {
  const p = playersV();
  const res = canVeteranAct(p, 'kill', 7, false, true);
  assert.equal(res.ok, false);
});

test('applyNightResolution: successful save latches veteranHealUsed', () => {
  const s = stateWith({
    players: playersV(),
    night: { veteranAction: 'save', veteranTarget: 7 },
  });
  s.night.resolved = resolveNight(s);
  applyNightResolution(s);
  assert.equal(s.veteranHealUsed, true);
  assert.equal(s.veteranKillUsed, false);
});

test('applyNightResolution: successful kill latches veteranKillUsed', () => {
  const s = stateWith({
    players: playersV(),
    night: { veteranAction: 'kill', veteranTarget: 7 },
  });
  s.night.resolved = resolveNight(s);
  applyNightResolution(s);
  assert.equal(s.veteranHealUsed, false);
  assert.equal(s.veteranKillUsed, true);
});

test('applyNightResolution: whore-blocked attempt still burns the latch', () => {
  const s = stateWith({
    players: playersV(),
    night: { whoreTarget: 6, veteranAction: 'kill', veteranTarget: 7 },
  });
  s.night.resolved = resolveNight(s);
  applyNightResolution(s);
  assert.equal(s.veteranKillUsed, true);
});

test('applyNightResolution: skip does not burn any latch', () => {
  const s = stateWith({
    players: playersV(),
    night: { veteranAction: null, veteranTarget: -1 },
  });
  s.night.resolved = resolveNight(s);
  applyNightResolution(s);
  assert.equal(s.veteranHealUsed, false);
  assert.equal(s.veteranKillUsed, false);
});

test('getWhoreBlocks flags veteran when whore visits him', () => {
  const s = stateWith({
    players: playersV(),
    night: { whoreTarget: 6 },
  });
  const blocks = getWhoreBlocks(s.players, s.night, s.gameOptions);
  assert.equal(blocks.veteran, true);
});
