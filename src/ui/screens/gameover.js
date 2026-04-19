import { state, resetNightSelections } from '../../state/state.js';
import { ROLES, getRoleName } from '../../core/roles.js';
import { escapeHtml } from '../html.js';
import { t } from '../../i18n/index.js';

export function renderGameOver({ render, clearSavedGame }) {
  const app = document.getElementById('app');

  const verdict = {
    city:   { text: t('gameover.verdict.cityText'),   sub: t('gameover.verdict.citySub'),   cls: 'city-wins' },
    mafia:  { text: t('gameover.verdict.mafiaText'),  sub: t('gameover.verdict.mafiaSub'),  cls: 'mafia-wins' },
    maniac: { text: t('gameover.verdict.maniacText'), sub: t('gameover.verdict.maniacSub'), cls: 'mafia-wins' },
    draw:   { text: t('gameover.verdict.drawText'),   sub: t('gameover.verdict.drawSub'),   cls: '' }
  }[state.winner];

  app.innerHTML = `
    <div class="game-over screen">
      <div class="label mb-16">${t('gameover.finalKicker')}</div>
      <div class="verdict ${verdict.cls}">${verdict.text}</div>
      <p class="verdict-sub">${verdict.sub}</p>

      <div class="section">
        <div class="section-head">
          <span class="num">✦</span>
          <span class="label">${t('gameover.allParticipants')}</span>
          <span class="line"></span>
        </div>
        <div class="final-list">
          ${state.players.map(p => `
            <div class="final-item ${!p.alive ? 'dead' : ''}">
              <div class="name-col">${escapeHtml(p.name)}</div>
              <div class="role-col">${ROLES[p.role].emblem} ${getRoleName(p.role)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <button class="btn-primary" id="newGame">${t('gameover.newGame')}</button>
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
