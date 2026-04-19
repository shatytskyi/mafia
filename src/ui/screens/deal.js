import { state, resetNightSelections } from '../../state/state.js';
import { ROLES, getMafiaNames } from '../../core/roles.js';
import { escapeHtml } from '../html.js';

export function renderDeal({ render }) {
  const app = document.getElementById('app');
  const player = state.players[state.dealIndex];
  const num = String(state.dealIndex + 1).padStart(2, '0');
  const total = String(state.playerCount).padStart(2, '0');

  if (state.dealPhase === 'await') {
    app.innerHTML = `
      <div class="deal-screen screen">
        <div class="player-num">Игрок · ${num} / ${total}</div>
        <div class="player-name-big">${escapeHtml(player.name)}</div>
        <div class="passing-hint">передай телефон этому игроку</div>

        <button class="reveal-btn" id="revealBtn">
          <span>Показать<br>роль</span>
        </button>

        <p class="instruction">
          Убедись, что никто<br>
          не подглядывает за&nbsp;твоим плечом
        </p>
      </div>
    `;
    document.getElementById('revealBtn').onclick = () => {
      state.dealPhase = 'shown';
      render();
    };
  } else {
    const role = ROLES[player.role];
    const isMafiaTeam = player.role === 'mafia' || player.role === 'don';
    const mafiaTeamHtml = isMafiaTeam && getMafiaNames(state.players).length > 1
      ? `
        <div class="team-list">
          <div class="t-label">Твои подельники</div>
          <div class="team-names">${getMafiaNames(state.players).filter(n => n !== player.name).map(escapeHtml).join(' · ')}</div>
        </div>
      ` : '';

    app.innerHTML = `
      <div class="deal-screen screen">
        <div class="role-card">
          <div class="kicker">${escapeHtml(player.name)}</div>
          <div class="role-emblem">${role.emblem}</div>
          <div class="role-title">${role.name}</div>
          <div class="role-side">${role.side}</div>
          <div class="divider"></div>
          <div class="role-desc">${role.desc}</div>
          ${mafiaTeamHtml}
        </div>

        <button class="btn-primary" id="doneBtn" style="max-width: 380px;">
          ${state.dealIndex < state.playerCount - 1 ? 'Запомнил, передаю дальше →' : 'Начать игру →'}
        </button>
      </div>
    `;

    document.getElementById('doneBtn').onclick = () => {
      if (state.dealIndex < state.playerCount - 1) {
        state.dealIndex++;
        state.dealPhase = 'await';
        render();
      } else {
        state.screen = 'host';
        state.day = 1;
        state.phase = 'night';
        state.stepIndex = 0;
        state.doctorHistory = [];
        state.doctorSelfUsed = false;
        state.whoreHistory = [];
        resetNightSelections();
        render();
      }
    };
  }
}
