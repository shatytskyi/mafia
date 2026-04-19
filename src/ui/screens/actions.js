import { state } from '../../state/state.js';
import { resolveNight } from '../../core/night.js';
import { escapeHtml } from '../html.js';

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
  if (a.type === 'blockedAction') {
    return state.night[a.field] !== -1;
  }
  return false;
}

export function renderAction(action) {
  if (action.type === 'pickTarget') return renderPickTarget(action);
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
      <div class="blocked-note">❀ Действие этой ночью заблокировано Путаной</div>
      <button class="target-skip blocked-confirm ${confirmed ? 'selected' : ''}" data-blocked-confirm data-field="${action.field}">
        ${confirmed ? '✓ Подтверждено' : (action.confirmLabel || 'Подтвердить')}
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
      <div class="target-grid">
        ${state.players.map((p, i) => {
          if (!p.alive) return '';
          if (i === selfIdx) return '';
          const isSelected = selected === i;
          return `
            <div class="target-chip ${isSelected ? 'selected' : ''}" data-target-idx="${i}" data-field="${action.field}">
              ${escapeHtml(p.name)}
            </div>
          `;
        }).join('')}
      </div>
      ${action.allowSkip ? `
        <button class="target-skip ${selected === -1 ? 'selected' : ''}" data-skip data-field="${action.field}">
          ${action.skipLabel || 'Пропустить'}
        </button>
      ` : ''}
      ${resultHtml}
      ${warnHtml}
    </div>
  `;
}

function renderPickKilled(action) {
  const selected = state.dayVoteKilled;
  return `
    <div class="step-card action-card">
      <div class="step-title">${action.label}</div>
      <div class="target-grid">
        ${state.players.map((p, i) => {
          if (!p.alive) return '';
          const isSelected = selected === i;
          return `
            <div class="target-chip ${isSelected ? 'selected' : ''}" data-killed-idx="${i}">
              ${escapeHtml(p.name)}
            </div>
          `;
        }).join('')}
      </div>
      <button class="target-skip ${selected === -1 ? 'selected' : ''}" data-killed-skip>
        ${action.skipLabel || 'Никто не уходит'}
      </button>
    </div>
  `;
}

function renderResolveNight() {
  if (!state.night.applied || !state.night.resolved) {
    state.night.resolved = resolveNight(state);
  }
  const r = state.night.resolved;

  let html = '<div class="step-card action-card resolve-card"><div class="step-title">Автоматический итог</div>';

  if (r.killed.length === 0) {
    html += '<div class="resolve-line resolve-peaceful">☾ Ночь прошла спокойно</div>';
  } else {
    const names = r.killed.map(i => escapeHtml(state.players[i].name)).join(', ');
    html += `<div class="resolve-line resolve-death">✖ Погибли: <strong>${names}</strong></div>`;
  }

  if (r.savedByDoctor != null) {
    const name = escapeHtml(state.players[r.savedByDoctor].name);
    html += `<div class="resolve-line resolve-saved">✚ Доктор спас: <strong>${name}</strong></div>`;
  }

  if (r.whoreDied) {
    if (r.whoreSavedByDoctor) {
      html += `<div class="resolve-line resolve-saved">❀ Путана попала к мафии — но Доктор спас её</div>`;
    } else {
      html += `<div class="resolve-line resolve-note">❀ Путана попала к мафии и погибла</div>`;
    }
  } else if (r.whoreAtMafia) {
    html += `<div class="resolve-line resolve-note">❀ Путана у мафии — её голос сегодня не в счёт</div>`;
  }

  if (r.sheriffResult) {
    const name = escapeHtml(state.players[state.night.sheriffCheck].name);
    html += `<div class="resolve-line resolve-info">✦ Шериф проверил ${name}: ${r.sheriffResult === 'mafia' ? '🔴 мафия' : '🟢 не мафия'}</div>`;
  }
  if (r.donResult) {
    const name = escapeHtml(state.players[state.night.donCheck].name);
    html += `<div class="resolve-line resolve-info">♛ Дон проверил ${name}: ${r.donResult === 'sheriff' ? '✓ Шериф' : '✗ не Шериф'}</div>`;
  }

  const blocked = [];
  if (r.blocked.mafia) blocked.push('Мафия');
  if (r.blocked.maniac) blocked.push('Маньяк');
  if (r.blocked.doctor) blocked.push('Доктор');
  if (r.blocked.sheriff) blocked.push('Шериф');
  if (blocked.length > 0) {
    html += `<div class="resolve-line resolve-note">❀ Путана заблокировала: ${blocked.join(', ')}</div>`;
  }

  html += '<div class="resolve-hint">Нажми «Далее», чтобы применить результат и перейти к объявлению.</div>';
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

  document.querySelectorAll('[data-blocked-confirm]').forEach(el => {
    el.onclick = () => {
      state.night[el.dataset.field] = -1;
      render();
    };
  });
}
