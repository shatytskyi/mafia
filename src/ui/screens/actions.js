import { state } from '../../state/state.js';
import { escapeHtml } from '../html.js';
import { t } from '../../i18n/index.js';
import { stopTimer } from './timer.js';

export function isNextDisabled(step) {
  if (!step.action) return false;
  const a = step.action;
  if (a.type === 'pickTarget') {
    const val = state.night[a.field];
    if (val === null) return true;
    if (a.validate) {
      const v = a.validate(val);
      if (!v.ok) return true;
    }
    return false;
  }
  if (a.type === 'pickVeteran') {
    // Veteran must resolve to one of: skip, save-with-target, kill-with-target.
    const mode = state.night.veteranAction;
    const target = state.night.veteranTarget;
    if (mode == null && target === -1) return false;    // skip confirmed
    if (mode == null) return true;                      // mode unchosen
    if (target == null || target < 0) return true;      // target unchosen
    if (a.validate) {
      const v = a.validate(target);
      if (!v.ok) return true;
    }
    return false;
  }
  if (a.type === 'blockedAction') {
    return state.night[a.field] !== -1;
  }
  if (a.type === 'pickKilled') {
    // Force host to explicitly pick a victim or confirm "no one killed" before
    // advancing to night — prevents accidental skips and ambiguous vote state.
    return state.dayVoteKilled == null;
  }
  return false;
}

export function renderAction(action) {
  if (action.type === 'pickTarget') return renderPickTarget(action);
  if (action.type === 'pickVeteran') return renderPickVeteran(action);
  if (action.type === 'pickKilled') return renderPickKilled(action);
  if (action.type === 'resolveNight') return renderResolveNight();
  if (action.type === 'blockedAction') return renderBlockedAction(action);
  return '';
}

function renderBlockedAction(action) {
  const selected = state.night[action.field];
  const confirmed = selected === -1;
  return `
    <div class="step-card action-card blocked-card">
      <div class="step-title">${action.label}</div>
      <div class="blocked-note">${t('actions.blockedNote')}</div>
      <button type="button" class="target-skip blocked-confirm ${confirmed ? 'selected' : ''}"
              data-blocked-confirm data-field="${action.field}"
              aria-pressed="${confirmed ? 'true' : 'false'}">
        ${confirmed ? t('actions.blockedConfirmed') : (action.confirmLabel || t('actions.blockedConfirm'))}
      </button>
    </div>
  `;
}

function renderPickTarget(action) {
  const selected = state.night[action.field];
  const validation = action.validate ? action.validate(selected) : { ok: true };

  let resultHtml = '';
  if (action.showResult && selected != null && selected >= 0) {
    resultHtml = `<div class="action-result">${action.showResult(selected)}</div>`;
  }

  let warnHtml = '';
  if (!validation.ok && selected != null && selected >= 0) {
    warnHtml = `<div class="action-warn">⚠ ${escapeHtml(validation.reason)}</div>`;
  }

  const selfIdx = action.excludeSelf && action.role
    ? state.players.findIndex(p => p.role === action.role)
    : -1;

  return `
    <div class="step-card action-card">
      <div class="step-title">${action.label}</div>
      <div class="target-grid" role="group" aria-label="${escapeHtml(action.label)}">
        ${state.players.map((p, i) => {
          if (!p.alive) return '';
          if (i === selfIdx) return '';
          const isSelected = selected === i;
          return `
            <button type="button" class="target-chip ${isSelected ? 'selected' : ''}"
                    data-target-idx="${i}" data-field="${action.field}"
                    aria-pressed="${isSelected ? 'true' : 'false'}">
              ${escapeHtml(p.name)}
            </button>
          `;
        }).join('')}
      </div>
      ${action.allowSkip ? `
        <button type="button" class="target-skip ${selected === -1 ? 'selected' : ''}"
                data-skip data-field="${action.field}"
                aria-pressed="${selected === -1 ? 'true' : 'false'}">
          ${action.skipLabel || t('actions.skipDefault')}
        </button>
      ` : ''}
      ${resultHtml}
      ${warnHtml}
    </div>
  `;
}

function renderPickVeteran(action) {
  const mode = state.night.veteranAction;          // 'save' | 'kill' | null
  const selected = state.night.veteranTarget;      // index | -1 | null
  const saveUsed = !!action.saveUsed;
  const killUsed = !!action.killUsed;
  const showGrid = mode === 'save' || mode === 'kill';
  const veteranIdx = state.players.findIndex(p => p.role === 'veteran');

  const gridLabel = mode === 'kill'
    ? t('steps.veteran.labelKill')
    : t('steps.veteran.labelSave');

  let warnHtml = '';
  if (showGrid && action.validate && selected != null && selected >= 0) {
    const v = action.validate(selected);
    if (!v.ok) warnHtml = `<div class="action-warn">⚠ ${escapeHtml(v.reason)}</div>`;
  }

  const modeBtn = (key, label, used) => {
    const active = mode === key;
    const disabled = used ? 'disabled' : '';
    return `
      <button type="button"
              class="veteran-mode-btn ${active ? 'active' : ''}"
              data-veteran-mode="${key}"
              ${disabled}
              aria-pressed="${active ? 'true' : 'false'}">
        <div class="veteran-mode-label">${label}</div>
        ${used ? `<div class="veteran-mode-used">${key === 'save' ? t('steps.veteran.usedSave') : t('steps.veteran.usedKill')}</div>` : ''}
      </button>
    `;
  };

  return `
    <div class="step-card action-card veteran-action-card">
      <div class="step-title">${action.label}</div>
      <div class="veteran-mode-row" role="group" aria-label="${escapeHtml(action.label)}">
        ${modeBtn('save', t('steps.veteran.modeSave'), saveUsed)}
        ${modeBtn('kill', t('steps.veteran.modeKill'), killUsed)}
      </div>
      <button type="button"
              class="target-skip veteran-mode-skip ${selected === -1 && mode == null ? 'selected' : ''}"
              data-veteran-skip
              aria-pressed="${selected === -1 && mode == null ? 'true' : 'false'}">
        ${t('steps.veteran.modeSkip')}
      </button>
      ${showGrid ? `
        <div class="veteran-grid-label">${gridLabel}</div>
        <div class="target-grid" role="group" aria-label="${escapeHtml(gridLabel)}">
          ${state.players.map((p, i) => {
            if (!p.alive) return '';
            // Save may target self; kill may not.
            if (mode === 'kill' && i === veteranIdx) return '';
            const isSelected = selected === i;
            return `
              <button type="button" class="target-chip ${isSelected ? 'selected' : ''}"
                      data-veteran-target="${i}"
                      aria-pressed="${isSelected ? 'true' : 'false'}">
                ${escapeHtml(p.name)}
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}
      ${warnHtml}
    </div>
  `;
}

function renderPickKilled(action) {
  const selected = state.dayVoteKilled;
  const revoteBtn = action.allowRevote
    ? `<button class="target-revote" data-revote type="button">${action.revoteLabel || t('steps.voteRevoteLabel')}</button>`
    : '';
  return `
    <div class="step-card action-card">
      <div class="step-title">${action.label}</div>
      <div class="target-grid" role="group" aria-label="${escapeHtml(action.label)}">
        ${state.players.map((p, i) => {
          if (!p.alive) return '';
          const isSelected = selected === i;
          return `
            <button type="button" class="target-chip ${isSelected ? 'selected' : ''}"
                    data-killed-idx="${i}"
                    aria-pressed="${isSelected ? 'true' : 'false'}">
              ${escapeHtml(p.name)}
            </button>
          `;
        }).join('')}
      </div>
      <button type="button" class="target-skip ${selected === -1 ? 'selected' : ''}"
              data-killed-skip aria-pressed="${selected === -1 ? 'true' : 'false'}">
        ${action.skipLabel || t('steps.voteSkipLabel')}
      </button>
      ${revoteBtn}
    </div>
  `;
}

function renderResolveNight() {
  const r = state.night.resolved;
  if (!r) return '';

  let html = `<div class="step-card action-card resolve-card"><div class="step-title">${t('actions.resolveTitle')}</div>`;

  if (r.killed.length === 0) {
    html += `<div class="resolve-line resolve-peaceful">${t('actions.resolvePeaceful')}</div>`;
  } else {
    const names = r.killed.map(i => escapeHtml(state.players[i].name)).join(', ');
    html += `<div class="resolve-line resolve-death">${t('actions.resolveDeaths', { names })}</div>`;
  }

  if (r.savedByDoctor != null) {
    const name = escapeHtml(state.players[r.savedByDoctor].name);
    html += `<div class="resolve-line resolve-saved">${t('actions.resolveSaved', { name })}</div>`;
  }

  if (r.whoreDied) {
    if (r.whoreSavedByDoctor) {
      html += `<div class="resolve-line resolve-saved">${t('actions.resolveWhoreSaved')}</div>`;
    } else {
      html += `<div class="resolve-line resolve-note">${t('actions.resolveWhoreDied')}</div>`;
    }
  } else if (r.whoreAtMafia) {
    html += `<div class="resolve-line resolve-note">${t('actions.resolveWhoreAtMafia')}</div>`;
  }

  if (r.sheriffResult) {
    const name = escapeHtml(state.players[state.night.sheriffCheck].name);
    const verdict = r.sheriffResult === 'mafia' ? t('actions.sheriffSawMafia') : t('actions.sheriffSawNotMafia');
    html += `<div class="resolve-line resolve-info">${t('actions.resolveSheriff', { name, verdict })}</div>`;
  }
  if (r.donResult) {
    const name = escapeHtml(state.players[state.night.donCheck].name);
    const verdict = r.donResult === 'sheriff' ? t('actions.donSawSheriff') : t('actions.donSawNotSheriff');
    html += `<div class="resolve-line resolve-info">${t('actions.resolveDon', { name, verdict })}</div>`;
  }

  if (r.veteranSaved != null) {
    const name = escapeHtml(state.players[r.veteranSaved].name);
    html += `<div class="resolve-line resolve-saved">${t('actions.resolveVeteranSave', { name })}</div>`;
  }
  if (r.veteranKill != null) {
    const name = escapeHtml(state.players[r.veteranKill].name);
    html += `<div class="resolve-line resolve-death">${t('actions.resolveVeteranKill', { name })}</div>`;
    if (state.players[r.veteranKill]?.role === 'maniac') {
      html += `<div class="resolve-line resolve-note">${t('actions.resolveVeteranPreempt')}</div>`;
    }
  }

  const blocked = [];
  if (r.blocked.mafia) blocked.push(t('roles.mafia.name'));
  if (r.blocked.maniac) blocked.push(t('roles.maniac.name'));
  if (r.blocked.doctor) blocked.push(t('roles.doctor.name'));
  if (r.blocked.sheriff) blocked.push(t('roles.sheriff.name'));
  if (r.blocked.veteran) blocked.push(t('roles.veteran.name'));
  if (blocked.length > 0) {
    html += `<div class="resolve-line resolve-note">${t('actions.resolveBlocked', { list: blocked.join(', ') })}</div>`;
  }

  html += `<div class="resolve-hint">${t('actions.resolveHint')}</div>`;
  html += '</div>';
  return html;
}

export function bindActionHandlers(step, render) {
  if (!step.action) return;

  document.querySelectorAll('[data-target-idx]').forEach(el => {
    el.onclick = () => {
      const idx = parseInt(el.dataset.targetIdx);
      const field = el.dataset.field;
      state.night[field] = idx;
      render();
    };
  });
  document.querySelectorAll('[data-skip]').forEach(el => {
    el.onclick = () => {
      state.night[el.dataset.field] = -1;
      render();
    };
  });

  document.querySelectorAll('[data-killed-idx]').forEach(el => {
    el.onclick = () => {
      state.dayVoteKilled = parseInt(el.dataset.killedIdx);
      render();
    };
  });
  const skipKilled = document.querySelector('[data-killed-skip]');
  if (skipKilled) {
    skipKilled.onclick = () => {
      state.dayVoteKilled = -1;
      render();
    };
  }

  const revoteBtn = document.querySelector('[data-revote]');
  if (revoteBtn) {
    revoteBtn.onclick = () => {
      stopTimer();
      state.dayVoteKilled = null;
      if (state.timer.preset) state.timer.seconds = state.timer.preset;
      render();
    };
  }

  document.querySelectorAll('[data-blocked-confirm]').forEach(el => {
    el.onclick = () => {
      state.night[el.dataset.field] = -1;
      render();
    };
  });

  document.querySelectorAll('[data-veteran-mode]').forEach(el => {
    el.onclick = () => {
      if (el.disabled) return;
      const mode = el.dataset.veteranMode;
      if (state.night.veteranAction === mode) {
        // Tapping the active mode again clears the selection.
        state.night.veteranAction = null;
        state.night.veteranTarget = null;
      } else {
        state.night.veteranAction = mode;
        state.night.veteranTarget = null;
      }
      render();
    };
  });
  document.querySelectorAll('[data-veteran-target]').forEach(el => {
    el.onclick = () => {
      state.night.veteranTarget = parseInt(el.dataset.veteranTarget);
      render();
    };
  });
  const veteranSkip = document.querySelector('[data-veteran-skip]');
  if (veteranSkip) {
    veteranSkip.onclick = () => {
      state.night.veteranAction = null;
      state.night.veteranTarget = -1;
      render();
    };
  }
}
