import { state, resetNightSelections } from '../../state/state.js';
import { ROLES, getMafiaNames, getRoleDesc, getRoleName, getRoleSide } from '../../core/roles.js';
import { escapeHtml } from '../html.js';
import { t } from '../../i18n/index.js';

export function renderDeal({ render }) {
  const app = document.getElementById('app');
  const player = state.players[state.dealIndex];
  const num = String(state.dealIndex + 1).padStart(2, '0');
  const total = String(state.playerCount).padStart(2, '0');

  if (state.dealPhase === 'handoff') {
    app.innerHTML = `
      <div class="deal-screen screen">
        <div class="player-num">${t('deal.handoffKicker')}</div>
        <div class="player-name-big">${t('deal.handoffTitle')}</div>
        <div class="passing-hint">${t('deal.handoffHint')}</div>

        <button class="btn-primary" id="hostReadyBtn" style="max-width: 380px;">
          ${t('deal.handoffBtn')}
        </button>
      </div>
    `;
    document.getElementById('hostReadyBtn').onclick = () => {
      state.screen = 'host';
      state.day = 1;
      state.phase = 'night';
      state.stepIndex = 0;
      state.doctorHistory = [];
      state.doctorSelfUsed = false;
      state.whoreHistory = [];
      state.veteranHealUsed = false;
      state.veteranKillUsed = false;
      resetNightSelections();
      render();
    };
    return;
  }

  // Both await + shown render the same flip-card layout so the flip animation
  // can play in place without a re-render. Phase decides whether the flipper
  // starts face-down (await) or already face-up (shown — e.g. after refresh).
  const role = ROLES[player.role];
  const isMafiaTeam = player.role === 'mafia' || player.role === 'don';
  const mafiaTeamHtml = isMafiaTeam && getMafiaNames(state.players).length > 1
    ? `
      <div class="team-list">
        <div class="t-label">${t('deal.teamLabel')}</div>
        <div class="team-names">${getMafiaNames(state.players).filter(n => n !== player.name).map(escapeHtml).join(' · ')}</div>
      </div>
    ` : '';

  const alreadyFlipped = state.dealPhase === 'shown';

  app.innerHTML = `
    <div class="deal-screen screen${alreadyFlipped ? ' revealed' : ''}">
      <div class="player-num">${t('deal.playerKicker', { num, total })}</div>
      <div class="player-name-big">${escapeHtml(player.name)}</div>
      <div class="passing-hint">${t('deal.passHint')}</div>

      <div class="role-card-stage">
        <div class="role-card-flipper${alreadyFlipped ? ' flipped' : ''}" id="cardFlipper"
             role="button" tabindex="0" aria-label="${t('deal.backHint')}">
          <div class="role-card role-card-front">
            <div class="kicker">${escapeHtml(player.name)}</div>
            <div class="role-emblem">${role.emblem}</div>
            <div class="role-title">${getRoleName(player.role)}</div>
            <div class="role-side">${getRoleSide(player.role)}</div>
            <div class="divider"></div>
            <div class="role-desc">${getRoleDesc(player.role, state.gameOptions)}</div>
            ${mafiaTeamHtml}
          </div>
          <div class="role-card-back" aria-hidden="true">
            <div class="card-back-kicker">${t('deal.backKicker')}</div>
            <div class="card-back-divider"></div>
            <div class="card-back-hint">${t('deal.backHint')}</div>
          </div>
        </div>
      </div>

      <p class="instruction">${t('deal.instruction')}</p>

      <button class="btn-primary" id="doneBtn" style="max-width: 380px;">
        ${state.dealIndex < state.playerCount - 1 ? t('deal.nextBtn') : t('deal.lastBtn')}
      </button>
    </div>
  `;

  const screen = document.querySelector('.deal-screen');
  const flipper = document.getElementById('cardFlipper');

  if (!alreadyFlipped) {
    const flip = () => {
      if (flipper.classList.contains('flipped')) return;
      state.dealPhase = 'shown';
      flipper.classList.add('flipped');
      screen.classList.add('revealed');
    };
    flipper.addEventListener('click', flip);
    flipper.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
  }

  document.getElementById('doneBtn').onclick = () => {
    if (state.dealIndex < state.playerCount - 1) {
      state.dealIndex++;
      state.dealPhase = 'await';
      render();
    } else {
      state.dealPhase = 'handoff';
      render();
    }
  };
}
