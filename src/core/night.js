import { isMafiaRole, getRole } from './roles.js';
import { t } from '../i18n/index.js';

/**
 * @typedef {object} NightSelections
 * @property {number|null} mafiaTarget
 * @property {number|null} donCheck
 * @property {number|null} whoreTarget
 * @property {number|null} doctorTarget
 * @property {number|null} sheriffCheck
 * @property {number|null} maniacTarget
 * @property {any} [resolved]
 * @property {boolean} [applied]
 */

/**
 * @typedef {object} GameOptions
 * @property {'never'|'afterMafia'|'always'} sheriffSeesManiac
 * @property {boolean} whoreDiesAtMafia
 */

/**
 * @typedef {object} NightResult
 * @property {number[]} killed
 * @property {number|null} savedByDoctor
 * @property {{mafia?: boolean, maniac?: boolean, doctor?: boolean, sheriff?: boolean}} blocked
 * @property {'mafia'|'notMafia'|null} sheriffResult
 * @property {'sheriff'|'notSheriff'|null} donResult
 * @property {boolean} whoreDied
 * @property {boolean} [whoreAtMafia]
 * @property {boolean} [whoreSavedByDoctor]
 */

/**
 * @param {{role: string}[]} players
 * @param {number|null} targetIdx
 * @param {number[]} doctorHistory
 * @param {boolean} doctorSelfUsed
 * @returns {{ok: boolean, reason: string}}
 */
export function canDoctorHeal(players, targetIdx, doctorHistory, doctorSelfUsed) {
  if (targetIdx == null || targetIdx < 0) return { ok: true, reason: '' };
  const target = players[targetIdx];
  if (!target) return { ok: false, reason: t('validation.playerMissing') };

  const lastTarget = doctorHistory[doctorHistory.length - 1];
  if (lastTarget === targetIdx) {
    return { ok: false, reason: t('validation.doctorSameTarget') };
  }
  const doctorIdx = players.findIndex(p => p.role === 'doctor');
  if (targetIdx === doctorIdx && doctorSelfUsed) {
    return { ok: false, reason: t('validation.doctorSelfLimit') };
  }
  return { ok: true, reason: '' };
}

/**
 * @param {{role: string}[]} players
 * @param {number|null} targetIdx
 * @param {number[]} whoreHistory
 * @returns {{ok: boolean, reason: string}}
 */
export function canWhoreGo(players, targetIdx, whoreHistory) {
  if (targetIdx == null || targetIdx < 0) return { ok: true, reason: '' };
  const whoreIdx = players.findIndex(p => p.role === 'whore');
  if (targetIdx === whoreIdx) {
    return { ok: false, reason: t('validation.whoreSelf') };
  }
  const lastTarget = whoreHistory[whoreHistory.length - 1];
  if (lastTarget === targetIdx) {
    return { ok: false, reason: t('validation.whoreSameTarget') };
  }
  return { ok: true, reason: '' };
}

/**
 * @param {{role: string, alive: boolean}[]} players
 * @param {NightSelections} night
 * @param {GameOptions} gameOptions
 * @returns {{mafia: boolean, donCheck: boolean, maniac: boolean, doctor: boolean, sheriff: boolean, veteran: boolean}}
 */
export function getWhoreBlocks(players, night, gameOptions) {
  const res = { mafia: false, donCheck: false, maniac: false, doctor: false, sheriff: false, veteran: false };
  const target = night.whoreTarget;
  if (target == null || target < 0) return res;
  const role = getRole(players, target);

  if (isMafiaRole(role)) {
    if (gameOptions.whoreDiesAtMafia) {
      res.mafia = true;
      if (role === 'don') res.donCheck = true;
    } else {
      const mafiaAliveCount = players.filter(p => p.alive && isMafiaRole(p.role)).length;
      if (mafiaAliveCount <= 1) res.mafia = true;
      if (role === 'don') res.donCheck = true;
    }
  } else if (role === 'maniac') {
    res.maniac = true;
  } else if (role === 'doctor') {
    res.doctor = true;
  } else if (role === 'sheriff') {
    res.sheriff = true;
  } else if (role === 'veteran') {
    res.veteran = true;
  }
  return res;
}

/**
 * Validator for the Veteran's chosen night action. Called by the host UI
 * (via `isNextDisabled`) and the integration tests.
 *
 * @param {{role: string, alive: boolean}[]} players
 * @param {'save'|'kill'|null} action
 * @param {number|null} targetIdx
 * @param {boolean} healUsed
 * @param {boolean} killUsed
 * @returns {{ok: boolean, reason: string}}
 */
export function canVeteranAct(players, action, targetIdx, healUsed, killUsed) {
  if (action === 'save' && healUsed) {
    return { ok: false, reason: t('validation.veteranHealUsed') };
  }
  if (action === 'kill' && killUsed) {
    return { ok: false, reason: t('validation.veteranKillUsed') };
  }
  if (targetIdx == null || targetIdx < 0) return { ok: true, reason: '' };
  const target = players[targetIdx];
  if (!target) return { ok: false, reason: t('validation.playerMissing') };
  if (action === 'kill') {
    const veteranIdx = players.findIndex(p => p.role === 'veteran');
    if (targetIdx === veteranIdx) {
      return { ok: false, reason: t('validation.veteranSelfKill') };
    }
  }
  return { ok: true, reason: '' };
}

/**
 * @param {import('../types.js').AppState} state
 * @returns {import('../types.js').NightResult}
 */
export function resolveNight(state) {
  const n = state.night;
  const isFirstNight = state.day === 1;
  const players = state.players;
  const gameOptions = state.gameOptions;

  const result = {
    killed: [],
    savedByDoctor: null,
    blocked: {},
    sheriffResult: null,
    donResult: null,
    whoreDied: false,
    veteranSaved: null,
    veteranKill: null
  };

  const wb = getWhoreBlocks(players, n, gameOptions);
  const mafiaBlocked = wb.mafia;
  let maniacBlocked = wb.maniac;
  const doctorBlocked = wb.doctor;
  const sheriffBlocked = wb.sheriff;
  const donBlocked = wb.donCheck;
  const veteranBlocked = wb.veteran;

  if (wb.mafia) result.blocked.mafia = true;
  if (wb.maniac) result.blocked.maniac = true;
  if (wb.doctor) result.blocked.doctor = true;
  if (wb.sheriff) result.blocked.sheriff = true;
  if (wb.veteran) result.blocked.veteran = true;

  if (n.whoreTarget != null && n.whoreTarget >= 0) {
    const blockedRole = getRole(players, n.whoreTarget);
    if (isMafiaRole(blockedRole)) {
      if (gameOptions.whoreDiesAtMafia) {
        result.whoreDied = true;
      } else {
        result.whoreAtMafia = true;
      }
    }
  }

  if (n.sheriffCheck != null && n.sheriffCheck >= 0 && !sheriffBlocked) {
    const checkedRole = getRole(players, n.sheriffCheck);
    let looksLikeMafia = isMafiaRole(checkedRole);
    if (!looksLikeMafia && checkedRole === 'maniac') {
      const mode = gameOptions.sheriffSeesManiac || 'afterMafia';
      if (mode === 'always') {
        looksLikeMafia = true;
      } else if (mode === 'afterMafia') {
        const mafiaAlive = players.some(p => p.alive && isMafiaRole(p.role));
        if (!mafiaAlive) looksLikeMafia = true;
      }
    }
    result.sheriffResult = looksLikeMafia ? 'mafia' : 'notMafia';
  }

  if (n.donCheck != null && n.donCheck >= 0 && !donBlocked) {
    const checkedRole = getRole(players, n.donCheck);
    result.donResult = checkedRole === 'sheriff' ? 'sheriff' : 'notSheriff';
  }

  let mafiaVictim = null;
  if (!isFirstNight && !mafiaBlocked && n.mafiaTarget != null && n.mafiaTarget >= 0) {
    mafiaVictim = n.mafiaTarget;
  }

  // Veteran action + Maniac pre-empt.
  // The Veteran acts between Sheriff and Maniac in the night order, so a
  // successful kill on an alive Maniac nullifies the Maniac's action this
  // night (blocked.maniac). The pre-empt latches even if the Doctor later
  // heals the Maniac — the attack still interrupted them.
  let veteranSaveTarget = null;
  let veteranKillTarget = null;
  if (!veteranBlocked) {
    if (n.veteranAction === 'save' && n.veteranTarget != null && n.veteranTarget >= 0) {
      veteranSaveTarget = n.veteranTarget;
    } else if (n.veteranAction === 'kill' && n.veteranTarget != null && n.veteranTarget >= 0) {
      veteranKillTarget = n.veteranTarget;
      const target = players[veteranKillTarget];
      if (target && target.alive && target.role === 'maniac') {
        maniacBlocked = true;
        result.blocked.maniac = true;
      }
    }
  }
  result.veteranSaved = veteranSaveTarget;
  result.veteranKill = veteranKillTarget;

  let maniacVictim = null;
  if (!maniacBlocked && n.maniacTarget != null && n.maniacTarget >= 0) {
    maniacVictim = n.maniacTarget;
  }

  let healed = null;
  if (!doctorBlocked && n.doctorTarget != null && n.doctorTarget >= 0) {
    healed = n.doctorTarget;
  }

  const savedByAnyone = (idx) => healed === idx || veteranSaveTarget === idx;

  const killedSet = new Set();
  if (mafiaVictim != null) {
    if (savedByAnyone(mafiaVictim)) {
      if (healed === mafiaVictim) result.savedByDoctor = mafiaVictim;
    } else {
      killedSet.add(mafiaVictim);
    }
  }
  if (maniacVictim != null) {
    if (savedByAnyone(maniacVictim)) {
      if (healed === maniacVictim && result.savedByDoctor == null) {
        result.savedByDoctor = maniacVictim;
      }
    } else {
      killedSet.add(maniacVictim);
    }
  }
  if (veteranKillTarget != null) {
    if (savedByAnyone(veteranKillTarget)) {
      if (healed === veteranKillTarget && result.savedByDoctor == null) {
        result.savedByDoctor = veteranKillTarget;
      }
    } else {
      killedSet.add(veteranKillTarget);
    }
  }
  if (result.whoreDied && !isFirstNight) {
    const whoreIdx = players.findIndex(p => p.role === 'whore' && p.alive);
    if (whoreIdx !== -1) {
      if (savedByAnyone(whoreIdx)) {
        if (healed === whoreIdx && result.savedByDoctor == null) {
          result.savedByDoctor = whoreIdx;
        }
        result.whoreSavedByDoctor = true;
      } else {
        killedSet.add(whoreIdx);
      }
    }
  } else {
    result.whoreDied = false;
  }

  result.killed = Array.from(killedSet);
  return result;
}

/**
 * Mutates `state.players` (kills) and updates doctor/whore histories.
 * Idempotent via `state.night.applied`.
 *
 * @param {import('../types.js').AppState} state
 */
export function applyNightResolution(state) {
  const r = state.night.resolved;
  if (!r) return;
  if (state.night.applied) return;
  state.night.applied = true;

  for (const idx of r.killed) {
    state.players[idx].alive = false;
  }
  if (state.night.doctorTarget != null && state.night.doctorTarget >= 0) {
    state.doctorHistory.push(state.night.doctorTarget);
    const doctorIdx = state.players.findIndex(p => p.role === 'doctor');
    if (state.night.doctorTarget === doctorIdx) state.doctorSelfUsed = true;
  } else {
    state.doctorHistory.push(null);
  }
  if (state.night.whoreTarget != null && state.night.whoreTarget >= 0) {
    state.whoreHistory.push(state.night.whoreTarget);
  } else {
    state.whoreHistory.push(null);
  }

  // Veteran latches burn on any real attempt (save or kill) — even when the
  // Whore blocked it. Skipping does not burn.
  if (
    state.night.veteranAction === 'save'
    && state.night.veteranTarget != null
    && state.night.veteranTarget >= 0
  ) {
    state.veteranHealUsed = true;
  }
  if (
    state.night.veteranAction === 'kill'
    && state.night.veteranTarget != null
    && state.night.veteranTarget >= 0
  ) {
    state.veteranKillUsed = true;
  }

  appendNightLog(state);
}

/**
 * Append a structured entry to state.nightLog summarising the night that was
 * just applied. Safe on pre-existing saves with no nightLog field (guarded).
 *
 * @param {import('../types.js').AppState} state
 */
function appendNightLog(state) {
  if (!Array.isArray(state.nightLog)) state.nightLog = [];
  const n = state.night;
  const r = n.resolved;
  if (!r) return;

  const sheriff = r.sheriffResult && n.sheriffCheck != null && n.sheriffCheck >= 0
    ? { target: n.sheriffCheck, result: r.sheriffResult }
    : null;
  const don = r.donResult && n.donCheck != null && n.donCheck >= 0
    ? { target: n.donCheck, result: r.donResult }
    : null;
  const mafia = (n.mafiaTarget != null && n.mafiaTarget >= 0 && !r.blocked.mafia && state.day > 1)
    ? { target: n.mafiaTarget }
    : null;
  const maniac = (n.maniacTarget != null && n.maniacTarget >= 0 && !r.blocked.maniac)
    ? { target: n.maniacTarget }
    : null;
  const whore = (n.whoreTarget != null && n.whoreTarget >= 0)
    ? {
        target: n.whoreTarget,
        died: !!r.whoreDied && !r.whoreSavedByDoctor,
        savedByDoctor: !!r.whoreSavedByDoctor,
        atMafia: !!r.whoreAtMafia || !!r.whoreDied,
      }
    : null;

  let veteran = null;
  if (n.veteranAction === 'save' || n.veteranAction === 'kill') {
    const maniacPreempt = n.veteranAction === 'kill'
      && r.veteranKill != null
      && state.players[r.veteranKill]?.role === 'maniac';
    veteran = {
      action: n.veteranAction,
      target: n.veteranTarget != null ? n.veteranTarget : null,
      blocked: !!r.blocked.veteran,
      preemptedManiac: maniacPreempt,
    };
  }

  state.nightLog.push({
    day: state.day,
    killed: [...r.killed],
    savedByDoctor: r.savedByDoctor != null ? r.savedByDoctor : null,
    sheriff,
    don,
    mafia,
    maniac,
    whore,
    veteran,
    blocked: { ...r.blocked },
  });
}
