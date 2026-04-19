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

      ${renderHistorySection()}

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
    state.veteranHealUsed = false;
    state.veteranKillUsed = false;
    state.nightLog = [];
    resetNightSelections();
    render();
  };
}

function renderHistorySection() {
  const log = Array.isArray(state.nightLog) ? state.nightLog : [];
  if (log.length === 0) return '';

  const nameOf = (idx) => escapeHtml(state.players[idx]?.name || '?');

  const nightsHtml = log.map(entry => {
    const lines = [];

    if (entry.killed.length === 0) {
      lines.push(t('gameover.history.peaceful'));
    } else {
      const names = entry.killed.map(nameOf).join(', ');
      lines.push(t('gameover.history.killed', { names }));
    }
    if (entry.savedByDoctor != null) {
      lines.push(t('gameover.history.savedByDoctor', { name: nameOf(entry.savedByDoctor) }));
    }
    if (entry.mafia) {
      lines.push(t('gameover.history.mafiaPick', { name: nameOf(entry.mafia.target) }));
    }
    if (entry.maniac) {
      lines.push(t('gameover.history.maniacPick', { name: nameOf(entry.maniac.target) }));
    }
    if (entry.sheriff) {
      const verdict = entry.sheriff.result === 'mafia'
        ? t('gameover.history.sheriffSawMafia')
        : t('gameover.history.sheriffSawNotMafia');
      lines.push(t('gameover.history.sheriffCheck', { name: nameOf(entry.sheriff.target), verdict }));
    }
    if (entry.don) {
      const verdict = entry.don.result === 'sheriff'
        ? t('gameover.history.donSawSheriff')
        : t('gameover.history.donSawNotSheriff');
      lines.push(t('gameover.history.donCheck', { name: nameOf(entry.don.target), verdict }));
    }
    if (entry.whore) {
      lines.push(t('gameover.history.whoreVisit', { name: nameOf(entry.whore.target) }));
      if (entry.whore.savedByDoctor) {
        lines.push(t('gameover.history.whoreSaved'));
      } else if (entry.whore.died) {
        lines.push(t('gameover.history.whoreDied'));
      }
    }
    if (entry.veteran) {
      if (entry.veteran.blocked) {
        lines.push(t('gameover.history.veteranBlocked'));
      } else if (entry.veteran.action === 'save' && entry.veteran.target != null) {
        lines.push(t('gameover.history.veteranSave', { name: nameOf(entry.veteran.target) }));
      } else if (entry.veteran.action === 'kill' && entry.veteran.target != null) {
        lines.push(t('gameover.history.veteranKill', { name: nameOf(entry.veteran.target) }));
        if (entry.veteran.preemptedManiac) {
          lines.push(t('gameover.history.veteranPreempt'));
        }
      }
    }
    const blocked = [];
    if (entry.blocked?.mafia) blocked.push(t('roles.mafia.name'));
    if (entry.blocked?.maniac) blocked.push(t('roles.maniac.name'));
    if (entry.blocked?.doctor) blocked.push(t('roles.doctor.name'));
    if (entry.blocked?.sheriff) blocked.push(t('roles.sheriff.name'));
    if (entry.blocked?.veteran) blocked.push(t('roles.veteran.name'));
    if (blocked.length > 0) {
      lines.push(t('gameover.history.blocked', { list: blocked.join(', ') }));
    }

    return `
      <div class="night-entry">
        <div class="night-entry-head">${t('gameover.history.nightHeader', { day: entry.day })}</div>
        <ul class="night-entry-lines">
          ${lines.map(line => `<li>${line}</li>`).join('')}
        </ul>
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <div class="section-head">
        <span class="num">✦</span>
        <span class="label">${t('gameover.history.title')}</span>
        <span class="line"></span>
      </div>
      <div class="night-log">${nightsHtml}</div>
    </div>
  `;
}
