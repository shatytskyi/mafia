import { state } from '../../state/state.js';
import { dealRoles } from '../../core/distribution.js';
import { escapeHtml } from '../html.js';

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
    inputsHtml += `
      <div class="name-input-row">
        <div class="idx">${num}</div>
        <input type="text" data-idx="${i}" value="${escapeHtml(state.players[i].name)}"
               placeholder="Игрок ${i+1}" maxlength="20" />
      </div>
    `;
  }

  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>D R A M A T I S · P E R S O N A E</span></div>
        <div class="hero-wrap">
          <h1 class="hero" style="font-size: 48px;">Имена<em>за столом</em></h1>
        </div>
        <p class="subtitle t-center mt-16">Введи имена или оставь стандартные</p>
      </div>

      <div class="name-inputs">
        ${inputsHtml}
      </div>

      <button class="btn-primary" id="confirmNames">Раздать карты →</button>
      <div style="height: 12px;"></div>
      <button class="btn-ghost" id="backHome">← Назад</button>
    </div>
  `;

  document.querySelectorAll('input[data-idx]').forEach(inp => {
    inp.oninput = (e) => {
      const idx = parseInt(e.target.dataset.idx);
      state.players[idx].name = e.target.value;
    };
  });

  document.getElementById('confirmNames').onclick = () => {
    state.players.forEach((p, i) => {
      if (!p.name.trim()) p.name = `Игрок ${i+1}`;
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
