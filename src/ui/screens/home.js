import { state } from '../../state/state.js';
import { html, escapeHtml } from '../html.js';
import { calcRoleDistribution, canEnableRole, isRoleEffective } from '../../core/distribution.js';
import { formatSavedAgo, savedGameDescription } from '../../state/persistence.js';

export function renderHome({ render, loadGame, clearSavedGame, restoreGame }) {
  const distInput = { playerCount: state.playerCount, optionalRoles: state.optionalRoles };
  const dist = calcRoleDistribution(distInput);
  const app = document.getElementById('app');
  const saved = loadGame();

  const resumeBlock = saved ? `
    <div class="resume-card">
      <div class="resume-head">
        <span class="resume-kicker">⟳ Сохранённая партия</span>
        <span class="resume-time">${escapeHtml(formatSavedAgo(saved.ts))}</span>
      </div>
      <div class="resume-desc">${escapeHtml(savedGameDescription(saved))}</div>
      <div class="resume-btns">
        <button class="btn-primary" id="resumeBtn">Продолжить →</button>
        <button class="btn-ghost" id="discardSavedBtn">Удалить</button>
      </div>
    </div>
  ` : '';

  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>C O S A · N O S T R A</span></div>
        <div class="hero-wrap">
          <div class="year">Est. 1986</div>
          <h1 class="hero">Мафия<em>in famiglia</em></h1>
        </div>
        <div class="tag">
          <p class="subtitle">Город засыпает —<br>просыпается мафия</p>
        </div>
      </div>

      ${resumeBlock}

      <div class="section">
        <div class="section-head">
          <span class="num">01 /</span>
          <span class="label">Игроков за столом</span>
          <span class="line"></span>
        </div>
        <div class="counter">
          <button class="counter-btn" id="minusBtn" ${state.playerCount <= 4 ? 'disabled' : ''}>−</button>
          <div>
            <div class="counter-num">${state.playerCount}</div>
            <div class="counter-label">человек</div>
          </div>
          <button class="counter-btn" id="plusBtn" ${state.playerCount >= 20 ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <span class="num">02 /</span>
          <span class="label">Расклад ролей</span>
          <span class="line"></span>
        </div>
        <div class="role-dist">
          <div class="cell">
            <div class="dot mafia"></div>
            <div class="txt"><div class="role-name">Мафия</div></div>
            <div class="role-count">×${dist.mafia}</div>
          </div>
          ${dist.don ? `
          <div class="cell">
            <div class="dot don"></div>
            <div class="txt"><div class="role-name">Дон</div></div>
            <div class="role-count">×${dist.don}</div>
          </div>` : ''}
          <div class="cell">
            <div class="dot sheriff"></div>
            <div class="txt"><div class="role-name">Шериф</div></div>
            <div class="role-count">×${dist.sheriff}</div>
          </div>
          ${dist.doctor ? `
          <div class="cell">
            <div class="dot doctor"></div>
            <div class="txt"><div class="role-name">Доктор</div></div>
            <div class="role-count">×${dist.doctor}</div>
          </div>` : ''}
          ${dist.maniac ? `
          <div class="cell">
            <div class="dot maniac"></div>
            <div class="txt"><div class="role-name">Маньяк</div></div>
            <div class="role-count">×${dist.maniac}</div>
          </div>` : ''}
          ${dist.whore ? `
          <div class="cell">
            <div class="dot whore"></div>
            <div class="txt"><div class="role-name">Путана</div></div>
            <div class="role-count">×${dist.whore}</div>
          </div>` : ''}
          <div class="cell">
            <div class="dot civilian"></div>
            <div class="txt"><div class="role-name">Мирные</div></div>
            <div class="role-count">×${dist.civilian}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <span class="num">03 /</span>
          <span class="label">Дополнительные роли</span>
          <span class="line"></span>
        </div>
        ${renderRoleToggle('don',    '♛ Дон Мафии', 'Проверяет Шерифа ночью. Минимум 6 игроков.')}
        ${renderRoleToggle('doctor', '✚ Доктор',    'Лечит одного игрока за ночь.')}
        ${renderRoleToggle('maniac', '☠ Маньяк',    'Одиночка. Убивает сам за себя. Минимум 8 игроков.')}
        ${renderRoleToggle('whore',  '❀ Путана',    'Блокирует ночные способности. Минимум 8 игроков.')}
      </div>

      <button class="btn-primary" id="startBtn">Раздать роли →</button>
      <div style="height: 12px;"></div>
      <button class="btn-secondary" id="rulesBtn">Правила игры</button>
    </div>
  `;

  document.getElementById('minusBtn').onclick = () => {
    if (state.playerCount > 4) { state.playerCount--; validateRoles(); render(); }
  };
  document.getElementById('plusBtn').onclick = () => {
    if (state.playerCount < 20) { state.playerCount++; validateRoles(); render(); }
  };
  document.getElementById('startBtn').onclick = () => { state.screen = 'names'; render(); };
  document.getElementById('rulesBtn').onclick = () => { state.screen = 'rules'; render(); };

  const resumeBtn = document.getElementById('resumeBtn');
  if (resumeBtn) {
    resumeBtn.onclick = () => {
      const data = loadGame();
      if (!data) return;
      restoreGame(data);
      render();
    };
  }
  const discardBtn = document.getElementById('discardSavedBtn');
  if (discardBtn) {
    discardBtn.onclick = () => {
      if (confirm('Удалить сохранённую партию?')) {
        clearSavedGame();
        render();
      }
    };
  }

  ['don','doctor','maniac','whore'].forEach(id => {
    const el = document.getElementById(`toggle-${id}`);
    if (!el) return;
    const head = el.querySelector('.role-toggle-head');
    if (head) {
      head.onclick = () => {
        if (!canEnableRole(id, state.playerCount)) return;
        state.optionalRoles[id] = !state.optionalRoles[id];
        render();
      };
    }
  });

  document.querySelectorAll('[data-opt-sheriff]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      state.gameOptions.sheriffSeesManiac = btn.dataset.optSheriff;
      render();
    };
  });
  document.querySelectorAll('[data-opt-whore]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      state.gameOptions.whoreDiesAtMafia = btn.dataset.optWhore === 'dies';
      render();
    };
  });
}

function renderRoleToggle(id, name, desc) {
  const distInput = { playerCount: state.playerCount, optionalRoles: state.optionalRoles };
  const active = state.optionalRoles[id];
  const allowed = canEnableRole(id, state.playerCount);
  const squeezed = active && allowed && !isRoleEffective(id, distInput);

  let subOptions = '';
  if (active && allowed) {
    if (id === 'maniac') {
      const mode = state.gameOptions.sheriffSeesManiac || 'afterMafia';
      subOptions = `
        <div class="role-suboptions" data-role-opt="maniac">
          <div class="suboption-label">Шериф видит Маньяка как мафию</div>
          <div class="suboption-segmented">
            <button class="seg-btn ${mode === 'never' ? 'active' : ''}" data-opt-sheriff="never">Никогда</button>
            <button class="seg-btn ${mode === 'afterMafia' ? 'active' : ''}" data-opt-sheriff="afterMafia">После смерти мафии</button>
            <button class="seg-btn ${mode === 'always' ? 'active' : ''}" data-opt-sheriff="always">Всегда</button>
          </div>
        </div>
      `;
    } else if (id === 'whore') {
      const dies = !!state.gameOptions.whoreDiesAtMafia;
      subOptions = `
        <div class="role-suboptions" data-role-opt="whore">
          <div class="suboption-label">Путана у мафии</div>
          <div class="suboption-segmented">
            <button class="seg-btn ${!dies ? 'active' : ''}" data-opt-whore="alive">Остаётся жива</button>
            <button class="seg-btn ${dies ? 'active' : ''}" data-opt-whore="dies">Погибает</button>
          </div>
        </div>
      `;
    }
  }

  return `
    <div class="role-toggle ${active ? 'active' : ''} ${!allowed ? 'disabled' : ''}" id="toggle-${id}">
      <div class="role-toggle-head">
        <div class="check"></div>
        <div class="info">
          <div class="name">${name}</div>
          <div class="desc">${desc}</div>
          ${!allowed ? `<div class="warn">Нужно минимум ${id === 'don' ? 6 : 8} игроков</div>` : ''}
          ${squeezed ? `<div class="warn">⚠ Не поместится при текущем раскладе — другая роль важнее</div>` : ''}
        </div>
      </div>
      ${subOptions}
    </div>
  `;
}

export function validateRoles() {
  if (!canEnableRole('don', state.playerCount)) state.optionalRoles.don = false;
  if (!canEnableRole('maniac', state.playerCount)) state.optionalRoles.maniac = false;
  if (!canEnableRole('whore', state.playerCount)) state.optionalRoles.whore = false;
}
