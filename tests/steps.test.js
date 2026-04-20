import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNightSteps, getDaySteps, getVoteSteps, getCurrentSteps } from '../src/core/steps.js';

function stateWith(overrides = {}) {
  return {
    day: 2,
    phase: 'night',
    stepIndex: 0,
    playerCount: 8,
    optionalRoles: { don: true, doctor: true, maniac: false, whore: false, veteran: false },
    gameOptions: { whoreDiesAtMafia: false },
    players: [
      { name: 'A', role: 'mafia',    alive: true },
      { name: 'B', role: 'don',      alive: true },
      { name: 'C', role: 'sheriff',  alive: true },
      { name: 'D', role: 'doctor',   alive: true },
      { name: 'E', role: 'civilian', alive: true },
      { name: 'F', role: 'civilian', alive: true },
    ],
    night: {
      mafiaTarget: null, whoreTarget: null,
      doctorTarget: null, maniacTarget: null,
      veteranTarget: null, veteranAction: null,
      resolved: null, applied: false,
    },
    doctorHistory: [],
    doctorSelfUsed: false,
    whoreHistory: [],
    veteranHealUsed: false,
    veteranKillUsed: false,
    nightLog: [],
    dayVoteKilled: null,
    winner: null,
    ...overrides,
  };
}

test('first-night: mafia meet step present, no mafia-kill step', () => {
  const s = stateWith({ day: 1 });
  const steps = getNightSteps(s);
  const titles = steps.map(st => st.title);
  assert.ok(titles.some(t => t.toLowerCase().includes('знаком') || t.toLowerCase().includes('meet')),
    'expected a mafia meet-and-greet step on night 1');
  assert.equal(steps.filter(st => st.action?.field === 'mafiaTarget').length, 0,
    'no mafia-kill step on night 1 (first night is meet-and-greet only)');
});

test('later-night mafia step has a 10-second timer', () => {
  const s = stateWith({ day: 2 });
  const steps = getNightSteps(s);
  const mafiaStep = steps.find(st => st.action?.field === 'mafiaTarget' && st.action.type === 'pickTarget');
  assert.ok(mafiaStep, 'expected a mafia pickTarget step on day 2');
  assert.equal(mafiaStep.timerSeconds, 10);
  assert.ok(mafiaStep.timerLabel);
});

test('blocked mafia step carries no timer', () => {
  const s = stateWith({
    day: 2,
    optionalRoles: { don: true, doctor: true, maniac: false, whore: true },
    players: [
      { name: 'A', role: 'mafia',    alive: true },
      { name: 'B', role: 'don',      alive: false },
      { name: 'C', role: 'sheriff',  alive: true },
      { name: 'D', role: 'doctor',   alive: true },
      { name: 'E', role: 'whore',    alive: true },
      { name: 'F', role: 'civilian', alive: true },
      { name: 'G', role: 'civilian', alive: true },
      { name: 'H', role: 'civilian', alive: true },
    ],
    night: {
      mafiaTarget: null,
      whoreTarget: 0, // visits the only living mafia → mafia blocked (soft)
      doctorTarget: null, maniacTarget: null,
      resolved: null, applied: false,
    },
  });
  const steps = getNightSteps(s);
  const mafiaStep = steps.find(st => st.action?.field === 'mafiaTarget');
  assert.ok(mafiaStep, 'mafia step is still rendered (as blocked)');
  assert.equal(mafiaStep.action.type, 'blockedAction');
  assert.ok(!mafiaStep.timerSeconds, 'blocked mafia step has no timer');
});

test('dead sheriff removes the sheriff step', () => {
  const s = stateWith();
  s.players.find(p => p.role === 'sheriff').alive = false;
  const steps = getNightSteps(s);
  assert.equal(steps.filter(st => st.cls === 'sheriff-action').length, 0);
});

test('sheriff and don steps are informational (no action)', () => {
  const s = stateWith();
  const steps = getNightSteps(s);
  const sheriffStep = steps.find(st => st.cls === 'sheriff-action');
  const donStep = steps.find(st => st.cls === 'mafia-action' && /дон/i.test(st.title));
  assert.ok(sheriffStep, 'sheriff step is present');
  assert.ok(donStep, 'don step is present');
  assert.equal(sheriffStep.action, undefined, 'sheriff step has no action');
  assert.equal(donStep.action, undefined, 'don step has no action');
});

test('dawn resolveNight step is always last', () => {
  const s = stateWith();
  const steps = getNightSteps(s);
  const last = steps[steps.length - 1];
  assert.equal(last.action?.type, 'resolveNight');
});

test('peaceful day skips the last-word step and goes straight to discussion', () => {
  const s = stateWith({
    day: 1,
    night: {
      ...stateWith().night,
      resolved: { killed: [], savedByDoctor: null, blocked: {}, whoreDied: false },
    },
  });
  const steps = getDaySteps(s);
  assert.equal(steps.length, 2, 'peaceful day has only discussion + nomination');
  assert.ok(/обсу/i.test(steps[0].title) || /discuss/i.test(steps[0].title) || /обгов/i.test(steps[0].title),
    'first step on a peaceful day is discussion');
});

test('day with a kill carries a last-word timer and names the deceased in `say`', () => {
  const s = stateWith({
    night: {
      ...stateWith().night,
      resolved: { killed: [4], savedByDoctor: null, blocked: {}, whoreDied: false },
    },
  });
  const steps = getDaySteps(s);
  assert.equal(steps[0].timerSeconds, 30);
  assert.match(steps[0].say, /E/, '`say` references the deceased name');
  assert.equal(steps[0].summary, undefined, 'no private `summary` is emitted — private info lives on the dawn resolve card');
});

test('vote step is a single pickKilled with skip affordance', () => {
  const steps = getVoteSteps();
  assert.equal(steps.length, 1);
  assert.equal(steps[0].action.type, 'pickKilled');
  assert.equal(steps[0].action.allowSkip, true);
});

test('getCurrentSteps dispatches by phase', () => {
  assert.equal(getCurrentSteps(stateWith({ phase: 'night' })).at(-1).action.type, 'resolveNight');
  const dayState = stateWith({
    phase: 'day',
    night: { ...stateWith().night, resolved: { killed: [], savedByDoctor: null, blocked: {}, whoreDied: false } },
  });
  assert.ok(getCurrentSteps(dayState).length >= 1);
  assert.equal(getCurrentSteps(stateWith({ phase: 'vote' }))[0].action.type, 'pickKilled');
});

// ---------------------------------------------------------------------------
// Veteran step (§6–7 of the 2026-04-19 spec)
// ---------------------------------------------------------------------------

function stateWithVeteran(overrides = {}) {
  return stateWith({
    playerCount: 10,
    optionalRoles: { don: true, doctor: true, maniac: true, whore: false, veteran: true },
    players: [
      { name: 'A', role: 'mafia',    alive: true },
      { name: 'B', role: 'don',      alive: true },
      { name: 'C', role: 'sheriff',  alive: true },
      { name: 'D', role: 'doctor',   alive: true },
      { name: 'E', role: 'maniac',   alive: true },
      { name: 'F', role: 'veteran',  alive: true },
      { name: 'G', role: 'civilian', alive: true },
      { name: 'H', role: 'civilian', alive: true },
      { name: 'I', role: 'civilian', alive: true },
      { name: 'J', role: 'civilian', alive: true },
    ],
    ...overrides,
  });
}

test('veteran step sits between sheriff and maniac', () => {
  const s = stateWithVeteran();
  const steps = getNightSteps(s);
  const sheriffIdx = steps.findIndex(st => st.cls === 'sheriff-action');
  const veteranIdx = steps.findIndex(st => st.action?.type === 'pickVeteran');
  const maniacIdx = steps.findIndex(st => st.action?.field === 'maniacTarget');
  assert.ok(sheriffIdx >= 0, 'sheriff step present');
  assert.ok(veteranIdx >= 0, 'veteran step present');
  assert.ok(maniacIdx >= 0, 'maniac step present');
  assert.ok(veteranIdx > sheriffIdx, 'veteran after sheriff');
  assert.ok(veteranIdx < maniacIdx, 'veteran before maniac');
});

test('dead veteran removes the step', () => {
  const s = stateWithVeteran();
  s.players.find(p => p.role === 'veteran').alive = false;
  const steps = getNightSteps(s);
  assert.equal(steps.filter(st => st.action?.type === 'pickVeteran').length, 0);
});

test('veteran toggle off removes the step', () => {
  const s = stateWithVeteran({
    optionalRoles: { don: true, doctor: true, maniac: true, whore: false, veteran: false },
  });
  const steps = getNightSteps(s);
  assert.equal(steps.filter(st => st.action?.type === 'pickVeteran').length, 0);
});

test('whore blocking veteran renders a blockedAction, no timer', () => {
  const s = stateWithVeteran({
    optionalRoles: { don: true, doctor: true, maniac: false, whore: true, veteran: true },
    players: [
      { name: 'A', role: 'mafia',    alive: true },
      { name: 'B', role: 'don',      alive: true },
      { name: 'C', role: 'sheriff',  alive: true },
      { name: 'D', role: 'doctor',   alive: true },
      { name: 'E', role: 'whore',    alive: true },
      { name: 'F', role: 'veteran',  alive: true },
      { name: 'G', role: 'civilian', alive: true },
      { name: 'H', role: 'civilian', alive: true },
      { name: 'I', role: 'civilian', alive: true },
      { name: 'J', role: 'civilian', alive: true },
    ],
    night: {
      mafiaTarget: null,
      whoreTarget: 5,          // whore visits veteran
      doctorTarget: null, maniacTarget: null,
      veteranTarget: null, veteranAction: null,
      resolved: null, applied: false,
    },
  });
  const steps = getNightSteps(s);
  const vet = steps.find(st => st.action?.field === 'veteranTarget');
  assert.ok(vet, 'veteran step present under blockedAction too');
  assert.equal(vet.action.type, 'blockedAction');
  assert.ok(!vet.timerSeconds);
});
