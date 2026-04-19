import { state, resetNightSelections } from '../../state/state.js';
import { ROLES } from '../../core/roles.js';
import { escapeHtml } from '../html.js';

export function renderGameOver({ render, clearSavedGame }) {
  const app = document.getElementById('app');

  const verdict = {
    city:   { text: 'Город<br>победил',  sub: 'Мафия вычищена из города. Справедливость восторжествовала.', cls: 'city-wins' },
    mafia:  { text: 'Мафия<br>победила', sub: 'Город в руках семьи. Теперь здесь правят другие законы.',    cls: 'mafia-wins' },
    maniac: { text: 'Маньяк<br>победил', sub: 'Последний, кто остался в живых. Все остальные — на кладбище.', cls: 'mafia-wins' },
    draw:   { text: 'Ничья',             sub: 'Никто не выжил, чтобы сказать об этом. Город опустел.',       cls: '' }
  }[state.winner];

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
              <div class="name-col">${escapeHtml(p.name)}</div>
              <div class="role-col">${ROLES[p.role].emblem} ${ROLES[p.role].name}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <button class="btn-primary" id="newGame">Новая партия</button>
    </div>
  `;

  document.getElementById('newGame').onclick = () => {
    if (clearSavedGame) clearSavedGame();
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
