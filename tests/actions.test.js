import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNextDisabled } from '../src/ui/screens/actions.js';
import { state, resetNightSelections } from '../src/state/state.js';

function resetState() {
  resetNightSelections();
  state.dayVoteKilled = null;
}

test('pickKilled: Next is disabled when no vote result picked yet', () => {
  resetState();
  const step = { action: { type: 'pickKilled', allowSkip: true, allowRevote: true } };
  assert.equal(isNextDisabled(step), true);
});

test('pickKilled: Next is enabled after picking a victim', () => {
  resetState();
  state.dayVoteKilled = 3;
  const step = { action: { type: 'pickKilled', allowSkip: true, allowRevote: true } };
  assert.equal(isNextDisabled(step), false);
});

test('pickKilled: Next is enabled after explicit "no one killed" (skip = -1)', () => {
  resetState();
  state.dayVoteKilled = -1;
  const step = { action: { type: 'pickKilled', allowSkip: true, allowRevote: true } };
  assert.equal(isNextDisabled(step), false);
});

test('pickKilled: revote (dayVoteKilled back to null) re-disables Next', () => {
  resetState();
  state.dayVoteKilled = 2;
  const step = { action: { type: 'pickKilled', allowSkip: true, allowRevote: true } };
  assert.equal(isNextDisabled(step), false);
  state.dayVoteKilled = null;
  assert.equal(isNextDisabled(step), true);
});

test('pickTarget: Next is disabled when target is null, enabled when picked', () => {
  resetState();
  const step = { action: { type: 'pickTarget', field: 'mafiaTarget' } };
  assert.equal(isNextDisabled(step), true);
  state.night.mafiaTarget = 4;
  assert.equal(isNextDisabled(step), false);
});

test('pickTarget: validator failure keeps Next disabled', () => {
  resetState();
  state.night.doctorTarget = 1;
  const step = {
    action: {
      type: 'pickTarget',
      field: 'doctorTarget',
      validate: () => ({ ok: false, reason: 'nope' })
    }
  };
  assert.equal(isNextDisabled(step), true);
});

test('blockedAction: Next is disabled until host confirms (field === -1)', () => {
  resetState();
  const step = { action: { type: 'blockedAction', field: 'mafiaTarget' } };
  assert.equal(isNextDisabled(step), true);
  state.night.mafiaTarget = -1;
  assert.equal(isNextDisabled(step), false);
});

test('resolveNight and steps without action: Next is always enabled', () => {
  resetState();
  assert.equal(isNextDisabled({ action: { type: 'resolveNight' } }), false);
  assert.equal(isNextDisabled({}), false);
});
