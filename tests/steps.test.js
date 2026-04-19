import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNightSteps, getDaySteps, getVoteSteps, getCurrentSteps } from '../src/core/steps.js';

function stateWith(overrides = {}) {
  return {
    day: 2,
    phase: 'night',
    stepIndex: 0,
    playerCount: 8,
    optionalRoles: { don: true, doctor: true, maniac: false, whore: false },
    gameOptions: { sheriffSeesManiac: 'afterMafia', whoreDiesAtMafia: false },
    players: [
      { name: 'A', role: 'mafia',    alive: true },
      { name: 'B', role: 'don',      alive: true },
      { name: 'C', role: 'sheriff',  alive: true },
      { name: 'D', role: 'doctor',   alive: true },
      { name: 'E', role: 'civilian', alive: true },
      { name: 'F', role: 'civilian', alive: true },
    ],
    night: {
      mafiaTarget: null, donCheck: null, whoreTarget: null,
      doctorTarget: null, sheriffCheck: null, maniacTarget: null,
      resolved: null, applied: false,
    },
    doctorHistory: [],
    doctorSelfUsed: false,
    whoreHistory: [],
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
      mafiaTarget: null, donCheck: null,
      whoreTarget: 0, // visits the only living mafia → mafia blocked (soft)
      doctorTarget: null, sheriffCheck: null, maniacTarget: null,
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
  assert.equal(steps.filter(st => st.action?.field === 'sheriffCheck').length, 0);
});

test('dawn resolveNight step is always last', () => {
  const s = stateWith();
  const steps = getNightSteps(s);
  const last = steps[steps.length - 1];
  assert.equal(last.action?.type, 'resolveNight');
});

test('peaceful day has no last-word timer; first-day morning uses a special title', () => {
  const s = stateWith({
    day: 1,
    night: {
      ...stateWith().night,
      resolved: { killed: [], savedByDoctor: null, blocked: {}, sheriffResult: null, donResult: null, whoreDied: false },
    },
  });
  const steps = getDaySteps(s);
  assert.equal(steps[0].timerSeconds, null);
  assert.ok(steps[0].summary.length > 0);
});

test('day with a kill carries a last-word timer and a deaths summary', () => {
  const s = stateWith({
    night: {
      ...stateWith().night,
      resolved: { killed: [4], savedByDoctor: null, blocked: {}, sheriffResult: null, donResult: null, whoreDied: false },
    },
  });
  const steps = getDaySteps(s);
  assert.equal(steps[0].timerSeconds, 30);
  assert.match(steps[0].summary, /E/);
});

test('vote step is a single pickKilled with revote + skip affordances', () => {
  const steps = getVoteSteps();
  assert.equal(steps.length, 1);
  assert.equal(steps[0].action.type, 'pickKilled');
  assert.equal(steps[0].action.allowSkip, true);
  assert.equal(steps[0].action.allowRevote, true);
  assert.ok(steps[0].action.revoteLabel);
});

test('getCurrentSteps dispatches by phase', () => {
  assert.equal(getCurrentSteps(stateWith({ phase: 'night' })).at(-1).action.type, 'resolveNight');
  const dayState = stateWith({
    phase: 'day',
    night: { ...stateWith().night, resolved: { killed: [], savedByDoctor: null, blocked: {}, sheriffResult: null, donResult: null, whoreDied: false } },
  });
  assert.ok(getCurrentSteps(dayState).length >= 1);
  assert.equal(getCurrentSteps(stateWith({ phase: 'vote' }))[0].action.type, 'pickKilled');
});
