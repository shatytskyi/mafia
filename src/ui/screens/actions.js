import { state } from '../../state/state.js';
import { escapeHtml } from '../html.js';
import { t } from '../../i18n/index.js';
import { getRoleName } from '../../core/roles.js';

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

/**
 * CH-04 · target-chip mark glyph map. Every pick-target surface shows a
 * role-specific glyph + label inside the selected chip instead of the old
 * hardcoded "✕ ЦЕЛЬ". Kind drives colour — deadly actions paint red,
 * neutral (saves / blocks) paint ink.
 *
 * @param {string} role  one of mafia | doctor | whore | maniac | veteran | vote
 * @param {{ veteranMode?: 'save'|'kill' }} [opts]
 * @returns {{ glyph: string, labelKey: string, kind: 'deadly'|'neutral' }}
 */
function getTargetMark(role, opts = {}) {
  switch (role) {
    case 'mafia':   return { glyph: '⚜', labelKey: 'actions.mark.mafia',   kind: 'deadly'  };
    case 'maniac':  return { glyph: '☠', labelKey: 'actions.mark.maniac',  kind: 'deadly'  };
    case 'doctor':  return { glyph: '✚', labelKey: 'actions.mark.doctor',  kind: 'neutral' };
    case 'whore':   return { glyph: '❀', labelKey: 'actions.mark.whore',   kind: 'neutral' };
    case 'veteran':
      return opts.veteranMode === 'kill'
        ? { glyph: '⛨', labelKey: 'actions.mark.veteranKill', kind: 'deadly'  }
        : { glyph: '⛨', labelKey: 'actions.mark.veteranSave', kind: 'neutral' };
    default:        return { glyph: '✕', labelKey: 'actions.mark.vote',    kind: 'deadly'  };
  }
}

function markHtml(mark) {
  return `
    <span class="chip-mark" aria-hidden="true">
      <span class="chip-mark-glyph">${mark.glyph}</span>
      <span class="chip-mark-label">${t(mark.labelKey)}</span>
    </span>
  `;
}

function renderPickTarget(action) {
  const selected = state.night[action.field];
  const validation = action.validate ? action.validate(selected) : { ok: true };

  // CH-05 · sheriff / don verdicts now render as a banner ABOVE the target
  // grid so the host sees the verdict on the same screen that made the
  // check — no accordion, no scrolling down past the roster. Kind drives
  // the left border: red when the verdict is dangerous news, ink otherwise.
  let checkResultHtml = '';
  if (action.showResult && selected != null && selected >= 0) {
    const name = escapeHtml(state.players[selected].name);
    const mark = getTargetMark(action.role);
    const kind = action.showResultKind ? action.showResultKind(selected) : 'neutral';
    checkResultHtml = `
      <section class="check-result check-result-${kind}" data-role="check-result">
        <span class="check-glyph" aria-hidden="true">${mark.glyph}</span>
        <div class="check-body">
          <div class="check-kicker">${t('actions.checkResultLabel')}</div>
          <div class="check-verdict"><strong>${name}</strong> — ${action.showResult(selected)}</div>
        </div>
      </section>
    `;
  }

  let warnHtml = '';
  if (!validation.ok && selected != null && selected >= 0) {
    warnHtml = `<div class="action-warn">⚠ ${escapeHtml(validation.reason)}</div>`;
  }

  const selfIdx = action.excludeSelf && action.role
    ? state.players.findIndex(p => p.role === action.role)
    : -1;

  const mark = getTargetMark(action.role);
  const mHtml = markHtml(mark);

  return `
    <div class="step-card action-card" data-mark-kind="${mark.kind}">
      <div class="step-title">${action.label}</div>
      ${checkResultHtml}
      <div class="target-grid target-grid-2col a-stagger" role="group" aria-label="${escapeHtml(action.label)}">
        ${state.players.map((p, i) => {
          if (!p.alive) return '';
          if (i === selfIdx) return '';
          const isSelected = selected === i;
          return `
            <button type="button" class="target-chip ${isSelected ? 'selected' : ''}"
                    data-target-idx="${i}" data-field="${action.field}"
                    aria-pressed="${isSelected ? 'true' : 'false'}">
              <span class="chip-num">${String(i + 1).padStart(2, '0')}</span>
              <span class="chip-name">${escapeHtml(p.name)}</span>
              ${mHtml}
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
      ${showGrid ? (() => {
        const vMark = getTargetMark('veteran', { veteranMode: mode });
        const vMarkHtml = markHtml(vMark);
        return `
        <div class="veteran-grid-label">${gridLabel}</div>
        <div class="target-grid target-grid-2col a-stagger" role="group" aria-label="${escapeHtml(gridLabel)}" data-mark-kind="${vMark.kind}">
          ${state.players.map((p, i) => {
            if (!p.alive) return '';
            // Save may target self; kill may not.
            if (mode === 'kill' && i === veteranIdx) return '';
            const isSelected = selected === i;
            return `
              <button type="button" class="target-chip ${isSelected ? 'selected' : ''}"
                      data-veteran-target="${i}"
                      aria-pressed="${isSelected ? 'true' : 'false'}">
                <span class="chip-num">${String(i + 1).padStart(2, '0')}</span>
                <span class="chip-name">${escapeHtml(p.name)}</span>
                ${vMarkHtml}
              </button>
            `;
          }).join('')}
        </div>
      `;})() : ''}
      ${warnHtml}
    </div>
  `;
}

function renderPickKilled(action) {
  const selected = state.dayVoteKilled;
  const mark = getTargetMark('vote');
  const mHtml = markHtml(mark);
  return `
    <div class="step-card action-card" data-mark-kind="${mark.kind}">
      <div class="step-title">${action.label}</div>
      <div class="target-grid a-stagger" role="group" aria-label="${escapeHtml(action.label)}">
        ${state.players.map((p, i) => {
          if (!p.alive) return '';
          const isSelected = selected === i;
          return `
            <button type="button" class="target-chip ${isSelected ? 'selected' : ''}"
                    data-killed-idx="${i}"
                    aria-pressed="${isSelected ? 'true' : 'false'}">
              <span class="chip-num">${String(i + 1).padStart(2, '0')}</span>
              <span class="chip-name">${escapeHtml(p.name)}</span>
              ${mHtml}
            </button>
          `;
        }).join('')}
      </div>
      <button type="button" class="target-skip ${selected === -1 ? 'selected' : ''}"
              data-killed-skip aria-pressed="${selected === -1 ? 'true' : 'false'}">
        ${action.skipLabel || t('steps.voteSkipLabel')}
      </button>
    </div>
  `;
}

/**
 * Private debrief card rendered below the dawn "host says" block. Host-only
 * summary of the night, laid out in three sections:
 *   1. Итог ночи — who died (with cause) or a peaceful-night line
 *   2. Ночные действия — per-role outcomes, including blocked attempts so the
 *      host has the full picture
 *   3. На день — effects that carry into the day (Whore's alibi)
 * Each section is conditional except the first, which always renders.
 */
function renderResolveNight() {
  const r = state.night.resolved;
  if (!r) return '';
  const isFirstNight = state.day === 1;

  const outcomeLines = buildOutcomeLines(r);
  const actionLines = buildActionLines(r, isFirstNight);
  const effectLines = buildEffectLines(r);

  const sections = [];
  sections.push(renderResolveSection(t('actions.resolveSectionOutcome'), outcomeLines));
  if (actionLines.length > 0) {
    sections.push(renderResolveSection(t('actions.resolveSectionActions'), actionLines));
  }
  if (effectLines.length > 0) {
    sections.push(renderResolveSection(t('actions.resolveSectionEffects'), effectLines));
  }

  return `
    <div class="step-card action-card resolve-card">
      <div class="step-title">${t('actions.resolveTitle')}</div>
      <div class="resolve-subtitle">${t('actions.resolveSubtitle')}</div>
      ${sections.join('')}
    </div>
  `;
}

function renderResolveSection(title, lines) {
  return `
    <div class="resolve-section">
      <div class="resolve-section-head">${title}</div>
      ${lines.join('')}
    </div>
  `;
}

function resolveLine(html, cls = 'resolve-info') {
  return `<div class="resolve-line ${cls}">${html}</div>`;
}

function playerNameRole(idx) {
  const p = state.players[idx];
  return {
    name: escapeHtml(p.name),
    role: getRoleName(p.role),
  };
}

// Who attacked `idx` this night (not blocked, first-night rule respected).
function attackersOn(idx) {
  const n = state.night;
  const r = n.resolved;
  const list = [];
  if (state.day > 1 && n.mafiaTarget === idx && !r.blocked.mafia) list.push('mafia');
  if (n.maniacTarget === idx && !r.blocked.maniac) list.push('maniac');
  if (r.veteranKill === idx) list.push('veteran');
  return list;
}

// Compose an {from: …} / {cause: …} fragment from an attacker set.
function attackersPhrase(attackers, keyPrefix) {
  const has = (a) => attackers.includes(a);
  let suffix;
  if (has('mafia') && has('maniac') && has('veteran')) suffix = 'All';
  else if (has('mafia') && has('maniac')) suffix = 'MafiaManiac';
  else if (has('mafia') && has('veteran')) suffix = 'MafiaVeteran';
  else if (has('maniac') && has('veteran')) suffix = 'ManiacVeteran';
  else if (has('mafia')) suffix = 'Mafia';
  else if (has('maniac')) suffix = 'Maniac';
  else if (has('veteran')) suffix = 'Veteran';
  else return '';
  return t(`actions.${keyPrefix}${suffix}`);
}

function buildOutcomeLines(r) {
  const killed = Array.isArray(r.killed) ? r.killed : [];
  if (killed.length === 0) {
    return [resolveLine(t('actions.resolvePeaceful'), 'resolve-info')];
  }
  return killed.map(idx => {
    const nr = playerNameRole(idx);
    const cause = causeFor(idx, r);
    return resolveLine(t('actions.resolveKilledLine', { ...nr, cause }), 'resolve-death');
  });
}

function causeFor(idx, r) {
  if (state.players[idx]?.role === 'whore' && r.whoreDied) {
    return t('actions.resolveCauseWhoreAtMafia');
  }
  const phrase = attackersPhrase(attackersOn(idx), 'resolveCause');
  return phrase || t('actions.resolveCauseMafia');
}

function buildActionLines(r, isFirstNight) {
  const n = state.night;
  const lines = [];

  // MAFIA (skip on first night — no kill step runs)
  const hasMafia = state.players.some(p => (p.role === 'mafia' || p.role === 'don') && p.alive);
  if (hasMafia && !isFirstNight) {
    if (r.blocked.mafia) {
      lines.push(resolveLine(t('actions.resolveMafiaBlocked'), 'resolve-note'));
    } else if (n.mafiaTarget == null || n.mafiaTarget < 0) {
      lines.push(resolveLine(t('actions.resolveMafiaSkipped'), 'resolve-note'));
    } else {
      const nr = playerNameRole(n.mafiaTarget);
      if (r.killed.includes(n.mafiaTarget)) {
        lines.push(resolveLine(t('actions.resolveMafiaKill', nr), 'resolve-death'));
      } else {
        if (r.savedByDoctor === n.mafiaTarget) {
          lines.push(resolveLine(t('actions.resolveMafiaSavedDoctor', nr), 'resolve-saved'));
        }
        if (r.veteranSaved === n.mafiaTarget) {
          lines.push(resolveLine(t('actions.resolveMafiaSavedVeteran', nr), 'resolve-saved'));
        }
      }
    }
  }

  // MANIAC (acts on every night including first)
  const hasManiac = state.optionalRoles?.maniac && state.players.some(p => p.role === 'maniac' && p.alive);
  if (hasManiac) {
    if (r.blocked.maniac) {
      lines.push(resolveLine(t('actions.resolveManiacBlocked'), 'resolve-note'));
    } else if (n.maniacTarget == null || n.maniacTarget < 0) {
      lines.push(resolveLine(t('actions.resolveManiacSkipped'), 'resolve-note'));
    } else {
      const nr = playerNameRole(n.maniacTarget);
      if (r.killed.includes(n.maniacTarget)) {
        lines.push(resolveLine(t('actions.resolveManiacKill', nr), 'resolve-death'));
      } else {
        if (r.savedByDoctor === n.maniacTarget) {
          lines.push(resolveLine(t('actions.resolveManiacSavedDoctor', nr), 'resolve-saved'));
        }
        if (r.veteranSaved === n.maniacTarget) {
          lines.push(resolveLine(t('actions.resolveManiacSavedVeteran', nr), 'resolve-saved'));
        }
      }
    }
  }

  // VETERAN (blocked → single note; save/kill → detailed line)
  const hasVeteran = state.optionalRoles?.veteran && state.players.some(p => p.role === 'veteran' && p.alive);
  if (hasVeteran) {
    if (r.blocked.veteran) {
      lines.push(resolveLine(t('actions.resolveVeteranBlocked'), 'resolve-note'));
    } else if (n.veteranAction === 'save' && n.veteranTarget != null && n.veteranTarget >= 0) {
      const nr = playerNameRole(n.veteranTarget);
      const from = attackersPhrase(attackersOn(n.veteranTarget), 'resolveFrom');
      if (from) {
        lines.push(resolveLine(t('actions.resolveVeteranSaveHelped', { ...nr, from }), 'resolve-saved'));
      } else {
        lines.push(resolveLine(t('actions.resolveVeteranSaveWasted', nr), 'resolve-note'));
      }
    } else if (n.veteranAction === 'kill' && n.veteranTarget != null && n.veteranTarget >= 0) {
      const nr = playerNameRole(n.veteranTarget);
      lines.push(resolveLine(t('actions.resolveVeteranKill', nr), 'resolve-death'));
      if (state.players[n.veteranTarget]?.role === 'maniac') {
        lines.push(resolveLine(t('actions.resolveManiacPreempted'), 'resolve-note'));
      }
    }
  }

  // DOCTOR
  const hasDoctor = state.optionalRoles?.doctor && state.players.some(p => p.role === 'doctor' && p.alive);
  if (hasDoctor) {
    if (r.blocked.doctor) {
      lines.push(resolveLine(t('actions.resolveDoctorBlocked'), 'resolve-note'));
    } else if (n.doctorTarget != null && n.doctorTarget >= 0) {
      const nr = playerNameRole(n.doctorTarget);
      const from = attackersPhrase(attackersOn(n.doctorTarget), 'resolveFrom');
      if (from && r.savedByDoctor === n.doctorTarget) {
        lines.push(resolveLine(t('actions.resolveDoctorSaved', { ...nr, from }), 'resolve-saved'));
      } else {
        lines.push(resolveLine(t('actions.resolveDoctorNoAttack', nr), 'resolve-note'));
      }
    }
  }

  // WHORE — only her special mafia-visit fate. Regular visits surface via the
  // block lines (per affected role) and the alibi line in block 3.
  if (r.whoreDied && r.whoreSavedByDoctor) {
    lines.push(resolveLine(t('actions.resolveWhoreToMafiaSaved'), 'resolve-saved'));
  } else if (r.whoreDied) {
    lines.push(resolveLine(t('actions.resolveWhoreToMafiaDied'), 'resolve-death'));
  } else if (r.whoreAtMafia) {
    const key = r.blocked.mafia ? 'resolveWhoreToMafiaAliveBlocked' : 'resolveWhoreToMafiaAliveNotBlocked';
    lines.push(resolveLine(t(`actions.${key}`), 'resolve-note'));
  }

  // SHERIFF / DON — only surface when blocked (they act verbally, no target state)
  if (r.blocked.sheriff) {
    lines.push(resolveLine(t('actions.resolveSheriffBlocked'), 'resolve-note'));
  }
  if (r.blocked.don) {
    lines.push(resolveLine(t('actions.resolveDonBlocked'), 'resolve-note'));
  }

  return lines;
}

function buildEffectLines(r) {
  const lines = [];
  const wt = state.night.whoreTarget;
  const justKilled = Array.isArray(r.killed) && r.killed.includes(wt);
  if (wt != null && wt >= 0 && state.players[wt]?.alive && !justKilled) {
    const nr = playerNameRole(wt);
    lines.push(resolveLine(t('actions.resolveAlibi', nr), 'resolve-info'));
  }
  return lines;
}

/**
 * In-place patch for an action card when the user taps a chip / skip / mode
 * button but stays on the same step. Avoids replacing the card's DOM so the
 * target-grid `.a-stagger` and step hint don't replay their entry animations
 * on every selection — a follow-up to the roster partial-update work.
 *
 * Returns true on a successful patch, or false when the structure changed
 * (e.g. veteran mode switch toggles grid visibility / mark-kind) and the
 * caller should fall back to a full action-card rebuild.
 *
 * @param {import('../../core/steps.js').Step} step
 * @returns {boolean}
 */
export function patchActionInPlace(step) {
  if (!step.action) return true;
  const a = step.action;

  if (a.type === 'pickTarget')    { patchPickTarget(a);    return true; }
  if (a.type === 'pickKilled')    { patchPickKilled();     return true; }
  if (a.type === 'blockedAction') { patchBlockedAction(a); return true; }
  if (a.type === 'pickVeteran')   { return patchPickVeteran(a); }
  // resolveNight is effectively static within its step.
  if (a.type === 'resolveNight')  return true;
  return false;
}

function patchPickTarget(action) {
  const card = document.querySelector('.action-card');
  if (!card) return;
  const selected = state.night[action.field];

  card.querySelectorAll(`[data-target-idx][data-field="${action.field}"]`).forEach(el => {
    const isSelected = parseInt(el.dataset.targetIdx) === selected;
    el.classList.toggle('selected', isSelected);
    el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });

  const skipBtn = card.querySelector(`[data-skip][data-field="${action.field}"]`);
  if (skipBtn) {
    const s = selected === -1;
    skipBtn.classList.toggle('selected', s);
    skipBtn.setAttribute('aria-pressed', s ? 'true' : 'false');
  }

  patchCheckResult(card, action, selected);
  patchActionWarn(card, action, selected);
}

function patchCheckResult(card, action, selected) {
  const existing = card.querySelector('[data-role="check-result"]');
  const show = action.showResult && selected != null && selected >= 0;
  if (!show) { if (existing) existing.remove(); return; }

  const name = escapeHtml(state.players[selected].name);
  const mark = getTargetMark(action.role);
  const kind = action.showResultKind ? action.showResultKind(selected) : 'neutral';
  const html = `
    <section class="check-result check-result-${kind}" data-role="check-result">
      <span class="check-glyph" aria-hidden="true">${mark.glyph}</span>
      <div class="check-body">
        <div class="check-kicker">${t('actions.checkResultLabel')}</div>
        <div class="check-verdict"><strong>${name}</strong> — ${action.showResult(selected)}</div>
      </div>
    </section>
  `;
  if (existing) {
    existing.outerHTML = html;
  } else {
    const title = card.querySelector('.step-title');
    if (title) title.insertAdjacentHTML('afterend', html);
  }
}

function patchActionWarn(card, action, selected) {
  const existing = card.querySelector('.action-warn');
  const validation = action.validate ? action.validate(selected) : { ok: true };
  const show = !validation.ok && selected != null && selected >= 0;
  if (!show) { if (existing) existing.remove(); return; }

  const html = `<div class="action-warn">⚠ ${escapeHtml(validation.reason)}</div>`;
  if (existing) existing.outerHTML = html;
  else card.insertAdjacentHTML('beforeend', html);
}

function patchPickKilled() {
  const selected = state.dayVoteKilled;
  document.querySelectorAll('[data-killed-idx]').forEach(el => {
    const isSelected = parseInt(el.dataset.killedIdx) === selected;
    el.classList.toggle('selected', isSelected);
    el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
  const skipBtn = document.querySelector('[data-killed-skip]');
  if (skipBtn) {
    const s = selected === -1;
    skipBtn.classList.toggle('selected', s);
    skipBtn.setAttribute('aria-pressed', s ? 'true' : 'false');
  }
}

function patchBlockedAction(action) {
  const btn = document.querySelector(`[data-blocked-confirm][data-field="${action.field}"]`);
  if (!btn) return;
  const confirmed = state.night[action.field] === -1;
  btn.classList.toggle('selected', confirmed);
  btn.setAttribute('aria-pressed', confirmed ? 'true' : 'false');
  btn.textContent = confirmed
    ? t('actions.blockedConfirmed')
    : (action.confirmLabel || t('actions.blockedConfirm'));
}

function patchPickVeteran(action) {
  const card = document.querySelector('.veteran-action-card');
  if (!card) return false;

  const mode = state.night.veteranAction;        // 'save' | 'kill' | null
  const target = state.night.veteranTarget;      // index | -1 | null
  const showGrid = mode === 'save' || mode === 'kill';

  const existingGrid = card.querySelector('.target-grid');
  const gridVisibilityChanged =
    (showGrid && !existingGrid) || (!showGrid && existingGrid);
  const newKind = mode === 'kill' ? 'deadly' : 'neutral';
  const kindChanged = showGrid && existingGrid && existingGrid.dataset.markKind !== newKind;

  // Structural change (mode toggle or switch) — let caller rebuild the card.
  if (gridVisibilityChanged || kindChanged) return false;

  card.querySelectorAll('[data-veteran-mode]').forEach(el => {
    const active = el.dataset.veteranMode === mode;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const vSkip = card.querySelector('[data-veteran-skip]');
  if (vSkip) {
    const s = (target === -1 && mode == null);
    vSkip.classList.toggle('selected', s);
    vSkip.setAttribute('aria-pressed', s ? 'true' : 'false');
  }

  if (showGrid) {
    card.querySelectorAll('[data-veteran-target]').forEach(el => {
      const isSelected = parseInt(el.dataset.veteranTarget) === target;
      el.classList.toggle('selected', isSelected);
      el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    const existingWarn = card.querySelector('.action-warn');
    const v = (action.validate && target != null && target >= 0)
      ? action.validate(target)
      : { ok: true };
    if (!v.ok) {
      const html = `<div class="action-warn">⚠ ${escapeHtml(v.reason)}</div>`;
      if (existingWarn) existingWarn.outerHTML = html;
      else card.insertAdjacentHTML('beforeend', html);
    } else if (existingWarn) {
      existingWarn.remove();
    }
  }
  return true;
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
