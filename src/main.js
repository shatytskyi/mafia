import { shuffle } from './core/shuffle.js';
import { ROLES, isMafiaRole, getRole, getMafiaNames } from './core/roles.js';
import { calcRoleDistribution, canEnableRole, isRoleEffective, dealRoles } from './core/distribution.js';
import { resolveNight, applyNightResolution, canDoctorHeal, canWhoreGo, getWhoreBlocks } from './core/night.js';
import { checkWinCondition } from './core/win.js';
import { getNightSteps, getDaySteps, getVoteSteps, getCurrentSteps } from './core/steps.js';
import { state, resetNightSelections } from './state/state.js';
import {
  createPersistence, buildSnapshot, applySnapshotToState, formatSavedAgo, savedGameDescription
} from './state/persistence.js';
import { applyTheme, bindThemeToggle, onThemeChange, updateThemeIcon } from './ui/theme.js';
import { createRender, registerScreen } from './ui/render.js';
import { renderHome } from './ui/screens/home.js';
import { renderNames } from './ui/screens/names.js';
import { renderDeal } from './ui/screens/deal.js';
import { renderTimer, startTimer, stopTimer, bindTimerHandlers } from './ui/screens/timer.js';
import { renderAction, bindActionHandlers, isNextDisabled } from './ui/screens/actions.js';

const persistence = createPersistence();

// ============================================================
// STATE
// ============================================================
// State and resetNightSelections are imported from './state/state.js'

// ============================================================
// PERSISTENCE (localStorage)
// ============================================================

let _saveTimer = null;
function saveGame() {
  if (state.screen !== 'host') return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => persistence.saveSnapshot(buildSnapshot(state)), 300);
}

function loadGame() { return persistence.loadSnapshot(); }
function clearSavedGame() { persistence.clearSnapshot(); }

function restoreGame(data) { applySnapshotToState(state, data); }

function saveTheme() { persistence.saveTheme(state.theme); }
function loadTheme() {
  const t = persistence.loadTheme();
  if (t) state.theme = t;
}

// ============================================================
// HELPERS
// ============================================================


const render = createRender({
  beforeRender: () => saveGame(),
  afterRender: () => { if (state.screen === 'home') clearSavedGame(); }
});

registerScreen('home', () => renderHome({ render, loadGame, clearSavedGame, restoreGame }));
registerScreen('names', () => renderNames({ render }));
registerScreen('deal', () => renderDeal({ render }));
registerScreen('host', renderHost);
registerScreen('gameover', renderGameOver);
registerScreen('rules', renderRules);

// ============================================================
// HOST SCREEN
// ============================================================
// Step generators are imported from ./core/steps.js

// Проверка условий победы.
// Логика:
// — «Мафия» (mafia + don) — одна команда.

function renderHost() {
  const app = document.getElementById('app');

  // Проверяем победу перед рендером.
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

  // --- Собираем разметку action/summary ---
  let actionHtml = '';
  let summaryHtml = '';

  if (step.summary) {
    summaryHtml = `
      <div class="step-card" style="border-left-color: var(--blood);">
        <div class="step-title">Результат</div>
        <div class="summary-text">${step.summary.replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }

  if (step.action) {
    actionHtml = renderAction(step.action);
  }

  // Первый шаг игры — первая ночь, день 1
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
                <div class="roster-name">${p.name}</div>
                <div class="roster-role">
                  <span class="roster-dot ${p.role}"></span>
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

  // Bind timer handlers after HTML is in the DOM (temporary bridge; Task 20 will call directly)
  if (step.timerSeconds) setTimeout(() => bindTimerHandlers(), 0);

  // Обработчики action (выбор цели / пропуск)
  bindActionHandlers(step, render);

  // Nav: Назад
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

  // Nav: Далее
  document.getElementById('nextStep').onclick = () => {
    if (isNextDisabled(step)) return;

    // Если на этом шаге авторезолв ночи — применяем его.
    // Важно: state.night.resolved уже вычислен в renderResolveNight при рендере этого шага.
    if (step.action && step.action.type === 'resolveNight') {
      // На всякий случай пересчитываем, если resolved не проставлен
      if (!state.night.resolved) {
        state.night.resolved = resolveNight(state);
      }
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

    // Применяем казнь при переходе с шага казни
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

    // Переход на следующий шаг или следующую фазу
    if (state.stepIndex < steps.length - 1) {
      state.stepIndex++;
    } else {
      if (state.phase === 'night') {
        state.phase = 'day';
        state.stepIndex = 0;
      } else if (state.phase === 'day') {
        state.phase = 'vote';
        state.stepIndex = 0;
      } else if (state.phase === 'vote') {
        const w = checkWinCondition(state);
        if (w) {
          state.winner = w;
          state.screen = 'gameover';
        } else {
          // vote → новая ночь: очищаем ночные выборы (включая resolved).
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

// ============================================================
// GAME OVER
// ============================================================
function renderGameOver() {
  const app = document.getElementById('app');
  const winner = state.winner;

  const verdict = {
    city: { text: 'Город<br>победил', sub: 'Мафия вычищена из города. Справедливость восторжествовала.', cls: 'city-wins' },
    mafia: { text: 'Мафия<br>победила', sub: 'Город в руках семьи. Теперь здесь правят другие законы.', cls: 'mafia-wins' },
    maniac: { text: 'Маньяк<br>победил', sub: 'Последний, кто остался в живых. Все остальные — на кладбище.', cls: 'mafia-wins' },
    draw: { text: 'Ничья', sub: 'Никто не выжил, чтобы сказать об этом. Город опустел.', cls: '' }
  }[winner];

  app.innerHTML = `
    <div class="game-over screen">
      <div class="label mb-16">Финал</div>
      <div class="verdict ${verdict.cls}">${verdict.text}</div>
      <p class="verdict-sub">${verdict.sub}</p>

      <div class="section">
        <div class="section-head">
          <span class="num">✦</span>
          <span class="label">Все участники</span>
          <span class="line"></span>
        </div>
        <div class="final-list">
          ${state.players.map(p => `
            <div class="final-item ${!p.alive ? 'dead' : ''}">
              <div class="name-col">${p.name}</div>
              <div class="role-col">${ROLES[p.role].emblem} ${ROLES[p.role].name}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <button class="btn-primary" id="newGame">Новая партия</button>
    </div>
  `;

  document.getElementById('newGame').onclick = () => {
    state.screen = 'home';
    state.day = 1;
    state.phase = 'night';
    state.stepIndex = 0;
    state.winner = null;
    state.doctorHistory = [];
    state.doctorSelfUsed = false;
    state.whoreHistory = [];
    resetNightSelections();
    render();
  };
}

// ============================================================
// RULES
// ============================================================
function renderRules() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>R E G U L A · L U D I</span></div>
        <div class="hero-wrap">
          <h1 class="hero" style="font-size: 48px;">Правила<em>игры</em></h1>
        </div>
      </div>

      <div class="rules-content">
        <h3>Суть игры</h3>
        <p>Часть игроков — мафия, знают друг друга и ночью «убивают». Остальные — мирные, не знают никого и днём пытаются вычислить мафию голосованием.</p>

        <h3>Цикл игры</h3>
        <ul>
          <li><strong>Ночь:</strong> активные роли действуют по очереди (мафия выбирает жертву, шериф проверяет и т.д.)</li>
          <li><strong>День:</strong> объявление жертв, обсуждение, выдвижение кандидатов</li>
          <li><strong>Голосование:</strong> город голосованием выбирает, кого казнить</li>
        </ul>

        <h3>Условия победы</h3>
        <ul>
          <li><strong>Мирные:</strong> выгнать всех членов мафии (и маньяка, если он есть)</li>
          <li><strong>Мафия:</strong> когда их число сравняется с числом мирных или превысит</li>
          <li><strong>Маньяк:</strong> остался живым, мафии нет, мирных ≤ 1</li>
        </ul>

        <h3>Эдж-кейсы ночью</h3>
        <ul>
          <li><strong>Мафия не договорилась:</strong> ночь без убийства</li>
          <li><strong>Доктор лечит жертву мафии:</strong> жертва выживает</li>
          <li><strong>Путана блокирует мафию:</strong> жертвы мафии нет, Путана тоже умирает</li>
          <li><strong>Путана блокирует Доктора/Шерифа/Дона:</strong> их действие не сработало этой ночью</li>
          <li><strong>Маньяк + мафия на одну цель:</strong> если Доктор её лечит — спасается, иначе умирает (всё равно один раз)</li>
          <li><strong>Маньяк и Доктор:</strong> Доктор лечит и от маньяка (классика; обсудите до игры)</li>
          <li><strong>Шериф проверяет Дона:</strong> показывается как мафия</li>
          <li><strong>Шериф проверяет Маньяка:</strong> показывается как НЕ мафия</li>
        </ul>

        <h3>Эдж-кейсы голосования</h3>
        <ul>
          <li><strong>Никто не выдвинут:</strong> переходим сразу к ночи</li>
          <li><strong>Один кандидат:</strong> либо голосуем «за/против», либо казнь без голоса (договоритесь)</li>
          <li><strong>Равенство голосов:</strong> переголосование между лидерами; если снова равенство — никто не уходит ИЛИ все лидеры уходят (решите до игры)</li>
          <li><strong>Голосовать нельзя:</strong> за себя, мёртвым</li>
        </ul>

        <h3>Общие правила</h3>
        <ul>
          <li>Мёртвые игроки не подсказывают живым ни словом, ни жестом, ни мимикой</li>
          <li>Нельзя показывать свою карту/роль другим в течение игры</li>
          <li>Мафия знакомится в первую ночь (без убийства)</li>
          <li>Нельзя намекать на проверку/лечение жестом или интонацией</li>
          <li>Ведущий — высшая власть, его решения окончательны</li>
        </ul>

        <h3>Советы ведущему</h3>
        <ul>
          <li>Драматизируй рассказ — это создаёт атмосферу</li>
          <li>Следи за глазами: кто-то может подглядывать</li>
          <li>Используй таймер — обсуждения склонны затягиваться</li>
          <li>Если игрок случайно выдал роль — решай по ситуации (обычно игра продолжается)</li>
        </ul>
      </div>

      <div style="height: 32px;"></div>
      <button class="btn-primary" id="backFromRules">← Вернуться в меню</button>
    </div>
  `;

  document.getElementById('backFromRules').onclick = () => {
    state.screen = 'home';
    render();
  };
}

// ============================================================
// INIT
// ============================================================

// Load theme before first render to avoid flash.
loadTheme();
applyTheme();
onThemeChange(render);
bindThemeToggle({ saveTheme });

render();
