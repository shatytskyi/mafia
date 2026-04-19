import { state } from '../../state/state.js';
import { html, escapeHtml } from '../html.js';
import { ROLES } from '../../core/roles.js';
import { calcRoleDistribution, canEnableRole, isRoleEffective } from '../../core/distribution.js';
import { formatSavedAgo, savedGameDescription } from '../../state/persistence.js';
import { t } from '../../i18n/index.js';

export function renderHome({ render, loadGame, clearSavedGame, restoreGame }) {
  const distInput = { playerCount: state.playerCount, optionalRoles: state.optionalRoles };
  const dist = calcRoleDistribution(distInput);
  const app = document.getElementById('app');
  const saved = loadGame();

  const resumeBlock = saved ? `
    <div class="resume-card">
      <div class="resume-head">
        <span class="resume-kicker">${t('home.resumeKicker')}</span>
        <span class="resume-time">${escapeHtml(formatSavedAgo(saved.ts))}</span>
      </div>
      <div class="resume-desc">${escapeHtml(savedGameDescription(saved))}</div>
      <div class="resume-btns">
        <button class="btn-primary" id="resumeBtn">${t('home.resumeContinue')}</button>
        <button class="btn-ghost" id="discardSavedBtn">${t('home.resumeDelete')}</button>
      </div>
    </div>
  ` : '';

  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>${t('home.ornament')}</span></div>
        <div class="hero-wrap">
          <div class="year">${t('home.year')}</div>
          <h1 class="hero">${t('home.title')}<em>${t('home.titleEm')}</em></h1>
        </div>
        <div class="tag">
          <p class="subtitle">${t('home.subtitle')}</p>
        </div>
      </div>

      ${resumeBlock}

      <div class="section">
        <div class="section-head">
          <span class="num">01 /</span>
          <span class="label">${t('home.sectionPlayers')}</span>
          <span class="line"></span>
        </div>
        <div class="counter">
          <button class="counter-btn" id="minusBtn" ${state.playerCount <= 4 ? 'disabled' : ''}>−</button>
          <div>
            <div class="counter-num">${state.playerCount}</div>
            <div class="counter-label">${t('home.playersUnit')}</div>
          </div>
          <button class="counter-btn" id="plusBtn" ${state.playerCount >= 20 ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <span class="num">02 /</span>
          <span class="label">${t('home.sectionRoles')}</span>
          <span class="line"></span>
        </div>
        <div class="role-dist">
          ${distCell('mafia', t('roles.mafia.name'), dist.mafia)}
          ${state.playerCount >= 6 ? distCell('don', t('roles.don.nameShort'), dist.don) : ''}
          ${distCell('sheriff', t('roles.sheriff.name'), dist.sheriff)}
          ${distCell('doctor', t('roles.doctor.name'), dist.doctor)}
          ${state.playerCount >= 8 ? distCell('maniac', t('roles.maniac.name'), dist.maniac) : ''}
          ${state.playerCount >= 8 ? distCell('whore', t('roles.whore.name'), dist.whore) : ''}
          ${distCell('civilian', t('roles.civilian.nameLabel'), dist.civilian)}
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <span class="num">03 /</span>
          <span class="label">${t('home.sectionExtra')}</span>
          <span class="line"></span>
        </div>
        ${renderRoleToggle('don',    t('roles.don.name'),    t('home.roleDesc.don'))}
        ${renderRoleToggle('doctor', t('roles.doctor.name'), t('home.roleDesc.doctor'))}
        ${renderRoleToggle('maniac', t('roles.maniac.name'), t('home.roleDesc.maniac'))}
        ${renderRoleToggle('whore',  t('roles.whore.name'),  t('home.roleDesc.whore'))}
      </div>

      <button class="btn-primary" id="startBtn">${t('home.startBtn')}</button>
      <div style="height: 12px;"></div>
      <button class="btn-secondary" id="rulesBtn">${t('home.rulesBtn')}</button>
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
      if (confirm(t('home.resumeConfirmDelete'))) {
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

function distCell(roleId, label, count) {
  const role = ROLES[roleId];
  const muted = !count;
  return `
    <div class="cell ${muted ? 'muted' : ''}">
      <span class="role-icon ${roleId}" aria-hidden="true">${role.emblem}</span>
      <div class="txt"><div class="role-name">${label}</div></div>
      <div class="role-count">${count ? `×${count}` : '—'}</div>
    </div>
  `;
}

function renderRoleToggle(id, name, desc) {
  const distInput = { playerCount: state.playerCount, optionalRoles: state.optionalRoles };
  const active = state.optionalRoles[id];
  const allowed = canEnableRole(id, state.playerCount);
  const squeezed = active && allowed && !isRoleEffective(id, distInput);
  const role = ROLES[id];
  const label = `<span class="role-icon ${id}" aria-hidden="true">${role.emblem}</span> ${name}`;

  let subOptions = '';
  if (active && allowed) {
    if (id === 'maniac') {
      const mode = state.gameOptions.sheriffSeesManiac || 'afterMafia';
      subOptions = `
        <div class="role-suboptions" data-role-opt="maniac">
          <div class="suboption-label">${t('home.suboption.sheriffSeesManiac')}</div>
          <div class="suboption-segmented">
            <button class="seg-btn ${mode === 'never' ? 'active' : ''}" data-opt-sheriff="never">${t('home.suboption.never')}</button>
            <button class="seg-btn ${mode === 'afterMafia' ? 'active' : ''}" data-opt-sheriff="afterMafia">${t('home.suboption.afterMafia')}</button>
            <button class="seg-btn ${mode === 'always' ? 'active' : ''}" data-opt-sheriff="always">${t('home.suboption.always')}</button>
          </div>
        </div>
      `;
    } else if (id === 'whore') {
      const dies = !!state.gameOptions.whoreDiesAtMafia;
      subOptions = `
        <div class="role-suboptions" data-role-opt="whore">
          <div class="suboption-label">${t('home.suboption.whoreAtMafia')}</div>
          <div class="suboption-segmented">
            <button class="seg-btn ${!dies ? 'active' : ''}" data-opt-whore="alive">${t('home.suboption.whoreStaysAlive')}</button>
            <button class="seg-btn ${dies ? 'active' : ''}" data-opt-whore="dies">${t('home.suboption.whoreDies')}</button>
          </div>
        </div>
      `;
    }
  }

  const minPlayers = id === 'don' ? 6 : 8;

  return `
    <div class="role-toggle ${active ? 'active' : ''} ${!allowed ? 'disabled' : ''}" id="toggle-${id}">
      <div class="role-toggle-head">
        <div class="check"></div>
        <div class="info">
          <div class="name">${label}</div>
          <div class="desc">${desc}</div>
          ${!allowed ? `<div class="warn">${t('home.warnMinPlayers', { n: minPlayers })}</div>` : ''}
          ${squeezed ? `<div class="warn">${t('home.warnSqueezed')}</div>` : ''}
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
