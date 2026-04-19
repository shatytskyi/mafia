import { state } from '../../state/state.js';
import { dealRoles } from '../../core/distribution.js';
import { escapeHtml } from '../html.js';
import { t } from '../../i18n/index.js';

export function renderNames({ render }) {
  const app = document.getElementById('app');

  if (state.players.length !== state.playerCount) {
    state.players = Array.from({length: state.playerCount}, () => ({
      name: '', role: null, alive: true
    }));
  }

  let inputsHtml = '';
  for (let i = 0; i < state.playerCount; i++) {
    const num = String(i+1).padStart(2, '0');
    const placeholder = t('names.placeholder', { n: i + 1 });
    const isLast = i === state.playerCount - 1;
    inputsHtml += `
      <div class="name-input-row">
        <div class="idx">${num}</div>
        <input type="text" data-idx="${i}" value="${escapeHtml(state.players[i].name)}"
               placeholder="${escapeHtml(placeholder)}" maxlength="20"
               name="player-name-${i + 1}" id="player-name-${i + 1}"
               autocomplete="off" autocorrect="off" autocapitalize="words"
               spellcheck="false" inputmode="text"
               enterkeyhint="${isLast ? 'done' : 'next'}" />
      </div>
    `;
  }

  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>${t('names.ornament')}</span></div>
        <div class="hero-wrap">
          <h1 class="hero" style="font-size: 48px;">${t('names.title')}<em>${t('names.titleEm')}</em></h1>
        </div>
        <p class="subtitle t-center mt-16">${t('names.subtitle')}</p>
      </div>

      <div class="name-inputs">
        ${inputsHtml}
      </div>

      <button class="btn-primary" id="confirmNames">${t('names.confirmBtn')}</button>
      <div style="height: 12px;"></div>
      <button class="btn-ghost" id="backHome">${t('common.back')}</button>
    </div>
  `;

  const inputs = document.querySelectorAll('input[data-idx]');
  inputs.forEach(inp => {
    inp.oninput = (e) => {
      const idx = parseInt(e.target.dataset.idx);
      state.players[idx].name = e.target.value;
    };
    inp.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const idx = parseInt(e.target.dataset.idx);
      const next = inputs[idx + 1];
      if (next) {
        next.focus();
      } else {
        e.target.blur();
        document.getElementById('confirmNames').click();
      }
    };
  });

  document.getElementById('confirmNames').onclick = () => {
    state.players.forEach((p, i) => {
      if (!p.name.trim()) p.name = t('names.defaultName', { n: i + 1 });
    });
    state.players = dealRoles(state.players, {
      playerCount: state.playerCount,
      optionalRoles: state.optionalRoles
    });
    state.dealIndex = 0;
    state.dealPhase = 'await';
    state.screen = 'deal';
    render();
  };

  document.getElementById('backHome').onclick = () => {
    state.screen = 'home';
    render();
  };
}
