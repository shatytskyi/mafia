import { state, resetNightSelections } from '../../state/state.js';
import { ROLES, getRoleName } from '../../core/roles.js';
import { checkWinCondition } from '../../core/win.js';
import { getCurrentSteps, getNightSteps, getDaySteps } from '../../core/steps.js';
import { resolveNight, applyNightResolution } from '../../core/night.js';
import { renderAction, bindActionHandlers, isNextDisabled } from './actions.js';
import { renderTimer, bindTimerHandlers, stopTimer } from './timer.js';
import { escapeHtml } from '../html.js';
import { t } from '../../i18n/index.js';

export function renderHost({ render, clearSavedGame }) {
  const app = document.getElementById('app');

  const winner = checkWinCondition(state);
  if (winner) {
    state.winner = winner;
    state.screen = 'gameover';
    stopTimer();
    render();
    return;
  }

  const steps = getCurrentSteps(state);
  if (state.stepIndex >= steps.length) state.stepIndex = steps.length - 1;
  if (state.stepIndex < 0) state.stepIndex = 0;
  const step = steps[state.stepIndex];
  const isLast = state.stepIndex === steps.length - 1;

  const phaseLabel = t(`phases.${state.phase}`);
  const phaseCls = state.phase;
  const aliveCount = state.players.filter(p => p.alive).length;

  let actionHtml = '';
  let summaryHtml = '';

  if (step.summary) {
    summaryHtml = `
      <div class="step-card" style="border-left-color: var(--blood);">
        <div class="step-title">${t('host.resultTitle')}</div>
        <div class="summary-text">${escapeHtml(step.summary).replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }
  // Recompute night resolution on every dawn render until it's applied — this
  // ensures the summary reflects the latest picks if the host navigated back
  // and changed anything. After `applied`, the stored result is frozen.
  if (step.action && step.action.type === 'resolveNight' && !state.night.applied) {
    state.night.resolved = resolveNight(state);
  }
  if (step.action) actionHtml = renderAction(step.action);

  // Back is disabled at any phase-start whose prior phase committed irreversible
  // state: night step 0 (vote already killed a player, night selections reset;
  // or day 1 where there is no prior phase) and day step 0 (night resolution
  // already applied players' deaths). Vote step 0 stays reversible — returning
  // to nominations commits nothing.
  const isBackDisabled =
    (state.phase === 'night' && state.stepIndex === 0) ||
    (state.phase === 'day' && state.stepIndex === 0);

  app.innerHTML = `
    <div class="screen">
      <div class="host-header">
        <div class="phase-badge ${phaseCls}">
          <span aria-hidden="true">${state.phase === 'night' ? '🌙' : state.phase === 'day' ? '☀' : '⚖'}</span>
          ${t('host.phaseDay', { day: state.day, phase: phaseLabel })}
        </div>
        <div class="phase-title">${step.title}</div>
      </div>

      <div class="step-card ${step.cls || ''}">
        <div class="step-num">${t('host.stepNum', { current: state.stepIndex + 1, total: steps.length })}</div>
        <div class="step-title">${t('host.hostSays')}</div>
        <div class="step-say">${step.say}</div>
        ${step.hint ? `<div class="step-hint">💡 ${step.hint}</div>` : ''}
      </div>

      <div class="nav-row nav-row-sticky">
        <button class="nav-btn" id="prevStep" ${isBackDisabled ? 'disabled' : ''}>${t('common.back')}</button>
        <button class="nav-btn primary" id="nextStep" ${isNextDisabled(step) ? 'disabled' : ''}>
          ${isLast ? nextPhaseLabel() : t('common.next')}
        </button>
      </div>

      ${summaryHtml}
      ${actionHtml}
      ${step.timerSeconds ? renderTimer(step.timerSeconds, step.timerLabel) : ''}

      <div class="section mt-24">
        <div class="section-head">
          <span class="num">✦</span>
          <span class="label">${t('host.playersHeader', { alive: aliveCount, total: state.playerCount })}</span>
          <span class="line"></span>
        </div>
        <div class="roster">
          ${state.players.map((p, i) => {
            const role = ROLES[p.role];
            return `
              <div class="roster-row ${!p.alive ? 'dead' : ''}">
                <div class="roster-num">${String(i+1).padStart(2,'0')}</div>
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

      <div style="height: 16px;"></div>
      <button class="btn-ghost" id="endGame" style="width: 100%;">${t('host.endGame')}</button>
    </div>
  `;

  bindActionHandlers(step, render);
  if (step.timerSeconds) bindTimerHandlers();

  document.getElementById('prevStep').onclick = () => {
    if (isBackDisabled) return;
    if (state.stepIndex > 0) {
      state.stepIndex--;
    } else if (state.phase === 'vote') {
      state.phase = 'day';
      state.stepIndex = getDaySteps(state).length - 1;
    }
    stopTimer();
    render();
  };

  document.getElementById('nextStep').onclick = () => {
    if (isNextDisabled(step)) return;

    if (step.action && step.action.type === 'resolveNight') {
      if (!state.night.resolved) state.night.resolved = resolveNight(state);
      applyNightResolution(state);
      const w = checkWinCondition(state);
      if (w) {
        state.winner = w;
        state.screen = 'gameover';
        stopTimer();
        render();
        return;
      }
    }

    if (step.action && step.action.type === 'pickKilled' && state.dayVoteKilled != null && state.dayVoteKilled >= 0) {
      state.players[state.dayVoteKilled].alive = false;
      const w = checkWinCondition(state);
      if (w) {
        state.winner = w;
        state.screen = 'gameover';
        stopTimer();
        render();
        return;
      }
    }

    if (state.stepIndex < steps.length - 1) {
      state.stepIndex++;
    } else {
      if (state.phase === 'night') { state.phase = 'day'; state.stepIndex = 0; }
      else if (state.phase === 'day') { state.phase = 'vote'; state.stepIndex = 0; }
      else if (state.phase === 'vote') {
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
    render();
  };

  document.getElementById('endGame').onclick = () => {
    if (confirm(t('host.endConfirm'))) {
      stopTimer();
      state.screen = 'home';
      clearSavedGame();
      render();
    }
  };
}

function nextPhaseLabel() {
  if (state.phase === 'night') return t('host.nextPhaseNight');
  if (state.phase === 'day') return t('host.nextPhaseDay');
  if (state.phase === 'vote') return t('host.nextPhaseVote', { day: state.day + 1 });
  return t('common.next');
}
