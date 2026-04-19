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
import { renderHost } from './ui/screens/host.js';

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
registerScreen('host', () => renderHost({ render, clearSavedGame }));
registerScreen('gameover', renderGameOver);
registerScreen('rules', renderRules);

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
