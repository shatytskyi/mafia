import { state, resetNightSelections } from '../../state/state.js';
import { ROLES, getRoleName } from '../../core/roles.js';
import { checkWinCondition } from '../../core/win.js';
import { getCurrentSteps, getDaySteps } from '../../core/steps.js';
import { resolveNight, applyNightResolution } from '../../core/night.js';
import { renderAction, bindActionHandlers, isNextDisabled } from './actions.js';
import { renderTimer, bindTimerHandlers, stopTimer } from './timer.js';
import { escapeHtml } from '../html.js';
import { t } from '../../i18n/index.js';

// Cached render() function — bound on first mount so `update` can trigger
// re-renders via the same channel without threading it through every hook.
let _render = null;
let _clearSavedGame = null;

// Stable IDs for each re-renderable panel. Keeping them in one place makes
// the split between "full mount" and "partial update" easier to reason about.
const IDS = {
  root: 'hostScreen',
  header: 'hostHeader',
  step: 'hostStepCard',
  alibi: 'hostAlibi',
  nav: 'hostNavRow',
  action: 'hostAction',
  timer: 'hostTimer',
  rosterSection: 'hostRosterSection',
  endGame: 'hostEndGame',
};

// Track previous roster fingerprint so we only rebuild the list when the
// alive set actually changes — the big request from the user ("список
// игроков не анимировать каждый раз, только менять при смерти").
let _lastAliveFingerprint = '';

/** Compute a cheap fingerprint of "who is alive" for roster diffing. */
function aliveFingerprint() {
  return state.players.map(p => p.alive ? '1' : '0').join('');
}

/**
 * Resolve steps + step, applying the dawn-step recompute. Shared by mount
 * and update so both paths see the same step object.
 * @returns {{ steps: import('../../core/steps.js').Step[], step: import('../../core/steps.js').Step }}
 */
function resolveSteps() {
  let steps = getCurrentSteps(state);
  if (state.stepIndex >= steps.length) state.stepIndex = steps.length - 1;
  if (state.stepIndex < 0) state.stepIndex = 0;
  let step = steps[state.stepIndex];

  // Recompute night resolution on every dawn render until it's applied — this
  // ensures the summary reflects the latest picks if the host navigated back
  // and changed anything. After `applied`, the stored result is frozen.
  if (step.action && step.action.type === 'resolveNight' && !state.night.applied) {
    state.night.resolved = resolveNight(state);
    steps = getCurrentSteps(state);
    step = steps[state.stepIndex];
  }

  return { steps, step };
}

/** @returns {boolean} back navigation is disabled at irreversible phase boundaries. */
function isBackDisabledFor() {
  return (
    (state.phase === 'night' && state.stepIndex === 0) ||
    (state.phase === 'day' && state.stepIndex === 0)
  );
}

function headerHtml(step) {
  const phaseLabel = t(`phases.${state.phase}`);
  const glyph = state.phase === 'night' ? '☾' : state.phase === 'day' ? '☀' : '⚖';
  return `
    <div id="${IDS.header}" class="host-header a-fade-up">
      <div class="phase-badge ${state.phase}">
        <span class="glyph" aria-hidden="true">${glyph}</span>
        ${t('host.phaseDay', { day: state.day, phase: phaseLabel })}
      </div>
      <div class="phase-title">${step.title}</div>
    </div>
  `;
}

function stepCardHtml(step, steps) {
  return `
    <div id="${IDS.step}" class="step-card ${step.cls || ''} a-fade-up d1">
      <div class="step-num">${t('host.stepNum', { current: state.stepIndex + 1, total: steps.length })}</div>
      <div class="step-title">${t('host.hostSays')}</div>
      <div class="step-say">${step.say}</div>
      ${step.hint ? `<div class="step-hint">${step.hint}</div>` : ''}
    </div>
  `;
}

function alibiHtml() {
  // Whore alibi: whoever she visited last night gets voting immunity today.
  // `state.night.whoreTarget` stays set from the night-resolve until the
  // next night's `resetNightSelections`, so this reads reliably during day
  // and vote phases.
  const idx = state.night.whoreTarget;
  const show =
    (state.phase === 'day' || state.phase === 'vote') &&
    idx != null && idx >= 0 && state.players[idx]?.alive;
  if (!show) return `<div id="${IDS.alibi}" hidden></div>`;
  return `
    <section id="${IDS.alibi}" class="alibi-banner" data-role="whore-alibi">
      <span class="alibi-glyph" aria-hidden="true">❀</span>
      <div class="alibi-body">
        <div class="alibi-kicker">${t('actions.alibiKicker')}</div>
        <div class="alibi-text">${t('actions.alibiBody', { name: escapeHtml(state.players[idx].name) })}</div>
      </div>
    </section>
  `;
}

function navRowHtml(step, steps) {
  const isLast = state.stepIndex === steps.length - 1;
  const backDisabled = isBackDisabledFor();
  const nextDisabled = isNextDisabled(step);
  return `
    <div id="${IDS.nav}" class="nav-row nav-row-sticky">
      <button class="nav-btn" id="prevStep" ${backDisabled ? 'disabled' : ''}>${t('common.back')}</button>
      <button class="nav-btn primary" id="nextStep" ${nextDisabled ? 'disabled' : ''}>
        ${isLast ? nextPhaseLabel() : t('common.next')}
      </button>
    </div>
  `;
}

function actionHtml(step) {
  const inner = step.action ? renderAction(step.action) : '';
  return `<div id="${IDS.action}">${inner}</div>`;
}

function timerHtml(step) {
  const inner = step.timerSeconds ? renderTimer(step.timerSeconds, step.timerLabel) : '';
  return `<div id="${IDS.timer}">${inner}</div>`;
}

function rosterSectionHtml() {
  const aliveCount = state.players.filter(p => p.alive).length;
  return `
    <div id="${IDS.rosterSection}" class="section mt-24">
      <div class="section-head">
        <span class="num">§</span>
        <span class="label">${t('host.playersHeader', { alive: aliveCount, total: state.playerCount })}</span>
        <span class="line"></span>
      </div>
      <div class="roster">
        ${state.players.map((p, i) => {
          const role = ROLES[p.role];
          return `
            <div class="roster-row ${!p.alive ? 'dead' : ''}">
              <div class="roster-num">${String(i + 1).padStart(2, '0')}</div>
              <div class="roster-name">${escapeHtml(p.name)}</div>
              <div class="roster-role">
                <span class="role-icon ${p.role}" aria-hidden="true">${role.emblem}</span>
                ${getRoleName(p.role)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function endGameHtml() {
  return `
    <button id="${IDS.endGame}" class="btn-ghost" style="width: 100%;">${t('host.endGame')}</button>
  `;
}

function bindStaticHandlers(step) {
  bindActionHandlers(step, _render);
  if (step.timerSeconds) bindTimerHandlers();

  document.getElementById('prevStep').onclick = () => {
    if (isBackDisabledFor()) return;
    if (state.stepIndex > 0) {
      state.stepIndex--;
    } else if (state.phase === 'vote') {
      state.phase = 'day';
      state.stepIndex = getDaySteps(state).length - 1;
    }
    stopTimer();
    _render();
  };

  document.getElementById('nextStep').onclick = () => {
    const { steps, step: liveStep } = resolveSteps();
    if (isNextDisabled(liveStep)) return;

    if (liveStep.action && liveStep.action.type === 'resolveNight') {
      if (!state.night.resolved) state.night.resolved = resolveNight(state);
      applyNightResolution(state);
      const w = checkWinCondition(state);
      if (w) {
        state.winner = w;
        state.screen = 'gameover';
        stopTimer();
        _render();
        return;
      }
    }

    if (state.stepIndex < steps.length - 1) {
      state.stepIndex++;
    } else {
      if (state.phase === 'night') { state.phase = 'day'; state.stepIndex = 0; }
      else if (state.phase === 'day') { state.phase = 'vote'; state.stepIndex = 0; }
      else if (state.phase === 'vote') {
        // Vote phase commits the execution when leaving. Kill happens AFTER
        // the last-word step (if present) so the executed player gets to
        // speak while still "alive" in state. If the town voted "no one
        // leaves" (dayVoteKilled === -1) there is no kill to apply.
        if (state.dayVoteKilled != null && state.dayVoteKilled >= 0) {
          state.players[state.dayVoteKilled].alive = false;
        }
        const w = checkWinCondition(state);
        if (w) {
          state.winner = w;
          state.screen = 'gameover';
        } else {
          state.day++;
          state.phase = 'night';
          state.stepIndex = 0;
          resetNightSelections();
        }
      }
    }
    stopTimer();
    _render();
  };

  document.getElementById(IDS.endGame).onclick = () => {
    if (confirm(t('host.endConfirm'))) {
      stopTimer();
      state.screen = 'home';
      _clearSavedGame();
      _render();
    }
  };
}

/**
 * Full render. Builds the entire host DOM from scratch — used on the very
 * first mount, or any time render.js decides a partial update can't work
 * (screen change, etc.).
 * @param {{ animKeyChanged: boolean }} [ctx]
 */
function mountHost(ctx) {
  const app = document.getElementById('app');

  const winner = checkWinCondition(state);
  if (winner) {
    state.winner = winner;
    state.screen = 'gameover';
    stopTimer();
    _render();
    return;
  }

  const { steps, step } = resolveSteps();
  _lastAliveFingerprint = aliveFingerprint();

  app.innerHTML = `
    <div id="${IDS.root}" class="screen">
      ${headerHtml(step)}
      ${stepCardHtml(step, steps)}
      ${alibiHtml()}
      ${navRowHtml(step, steps)}
      ${actionHtml(step)}
      ${timerHtml(step)}
      ${rosterSectionHtml()}
      <div style="height: 16px;"></div>
      ${endGameHtml()}
    </div>
  `;
  bindStaticHandlers(step);
}

/**
 * Partial update. Called when the screen hasn't changed — patches only the
 * panels whose content depends on the new state, and leaves the roster (the
 * biggest chunk) untouched unless the alive set actually changed. This is
 * what keeps the player list from re-animating on every "Далее" tap.
 * @param {{ animKeyChanged: boolean }} ctx
 */
function updateHost(ctx) {
  const app = document.getElementById('app');
  const root = document.getElementById(IDS.root);
  if (!root) { mountHost(ctx); return; }

  const winner = checkWinCondition(state);
  if (winner) {
    state.winner = winner;
    state.screen = 'gameover';
    stopTimer();
    _render();
    return;
  }

  const { steps, step } = resolveSteps();

  // Swap in-place. `outerHTML =` replaces the element itself, preserving
  // surrounding siblings — so roster + endGame stay put.
  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.outerHTML = html;
  };

  setHtml(IDS.header, headerHtml(step));
  setHtml(IDS.step, stepCardHtml(step, steps));
  setHtml(IDS.alibi, alibiHtml());
  setHtml(IDS.nav, navRowHtml(step, steps));
  setHtml(IDS.action, actionHtml(step));
  setHtml(IDS.timer, timerHtml(step));

  // Roster: rebuild only if the alive set changed. Otherwise leave the DOM
  // alone so the list doesn't re-run its entry animation.
  const fp = aliveFingerprint();
  if (fp !== _lastAliveFingerprint) {
    _lastAliveFingerprint = fp;
    setHtml(IDS.rosterSection, rosterSectionHtml());
  }

  // On a fresh step (animKeyChanged), let the rebuilt panels play their
  // entry animations by re-marking the root. Re-adding the class is a
  // no-op when already present; if the animations already played this
  // session, they won't replay because their keyframe source elements are
  // the same nodes. That's actually what we want — roster stays static.
  if (ctx.animKeyChanged) {
    root.classList.add('screen-enter');
  }

  bindStaticHandlers(step);
}

/**
 * Entry point from main.js. Memoises render/clearSavedGame so mount and
 * update can share them without a re-bind on every tick.
 */
export function createHostScreen({ render, clearSavedGame }) {
  _render = render;
  _clearSavedGame = clearSavedGame;
  return {
    mount: mountHost,
    update: updateHost,
  };
}

// Legacy callable form — kept for tests/compat that import `renderHost`
// directly. Prefer `createHostScreen` in new code.
export function renderHost({ render, clearSavedGame }) {
  _render = render;
  _clearSavedGame = clearSavedGame;
  mountHost({ animKeyChanged: true, screenChanged: true });
}

function nextPhaseLabel() {
  if (state.phase === 'night') return t('host.nextPhaseNight');
  if (state.phase === 'day') return t('host.nextPhaseDay');
  if (state.phase === 'vote') return t('host.nextPhaseVote', { day: state.day + 1 });
  return t('common.next');
}
