import { state, resetNightSelections } from '../../state/state.js';
import { ROLES } from '../../core/roles.js';
import { checkWinCondition } from '../../core/win.js';
import { getCurrentSteps, getNightSteps, getDaySteps } from '../../core/steps.js';
import { resolveNight, applyNightResolution } from '../../core/night.js';
import { renderAction, bindActionHandlers, isNextDisabled } from './actions.js';
import { renderTimer, bindTimerHandlers, stopTimer } from './timer.js';
import { escapeHtml } from '../html.js';

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

  const phaseLabel = { night: 'Ночь', day: 'День', vote: 'Голосование' }[state.phase];
  const phaseCls = state.phase;
  const aliveCount = state.players.filter(p => p.alive).length;

  let actionHtml = '';
  let summaryHtml = '';

  if (step.summary) {
    summaryHtml = `
      <div class="step-card" style="border-left-color: var(--blood);">
        <div class="step-title">Результат</div>
        <div class="summary-text">${escapeHtml(step.summary).replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }
  if (step.action) actionHtml = renderAction(step.action);

  const isVeryFirstStep = state.stepIndex === 0 && state.phase === 'night' && state.day === 1;

  app.innerHTML = `
    <div class="screen">
      <div class="host-header">
        <div class="phase-badge ${phaseCls}">
          ${state.phase === 'night' ? '🌙' : state.phase === 'day' ? '☀' : '⚖'}
          День ${state.day} · ${phaseLabel}
        </div>
        <div class="phase-title">${step.title}</div>
      </div>

      <div class="step-card ${step.cls || ''}">
        <div class="step-num">Шаг ${state.stepIndex + 1} / ${steps.length}</div>
        <div class="step-title">Ведущий говорит</div>
        <div class="step-say">${step.say}</div>
        ${step.hint ? `<div class="step-hint">💡 ${step.hint}</div>` : ''}
      </div>

      <div class="nav-row nav-row-sticky">
        <button class="nav-btn" id="prevStep" ${isVeryFirstStep ? 'disabled' : ''}>← Назад</button>
        <button class="nav-btn primary" id="nextStep" ${isNextDisabled(step) ? 'disabled' : ''}>
          ${isLast ? nextPhaseLabel() : 'Далее →'}
        </button>
      </div>

      ${summaryHtml}
      ${actionHtml}
      ${step.timerSeconds ? renderTimer(step.timerSeconds, step.timerLabel) : ''}

      <div class="section mt-24">
        <div class="section-head">
          <span class="num">✦</span>
          <span class="label">Игроки · живых ${aliveCount}/${state.playerCount}</span>
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
                  ${role.name}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div style="height: 16px;"></div>
      <button class="btn-ghost" id="endGame" style="width: 100%;">Завершить игру</button>
    </div>
  `;

  bindActionHandlers(step, render);
  if (step.timerSeconds) bindTimerHandlers();

  document.getElementById('prevStep').onclick = () => {
    if (state.stepIndex > 0) {
      state.stepIndex--;
    } else {
      if (state.phase === 'vote') { state.phase = 'day'; state.stepIndex = getDaySteps(state).length - 1; }
      else if (state.phase === 'day') { state.phase = 'night'; state.stepIndex = getNightSteps(state).length - 1; }
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
    if (confirm('Завершить игру и вернуться в меню?')) {
      stopTimer();
      state.screen = 'home';
      clearSavedGame();
      render();
    }
  };
}

function nextPhaseLabel() {
  if (state.phase === 'night') return 'К дню →';
  if (state.phase === 'day') return 'К голосованию →';
  if (state.phase === 'vote') return `Ночь ${state.day + 1} →`;
  return 'Далее →';
}
