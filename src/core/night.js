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
 * @returns {{mafia: boolean, donCheck: boolean, maniac: boolean, doctor: boolean, sheriff: boolean}}
 */
export function getWhoreBlocks(players, night, gameOptions) {
  const res = { mafia: false, donCheck: false, maniac: false, doctor: false, sheriff: false };
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
  }
  return res;
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
    whoreDied: false
  };

  const wb = getWhoreBlocks(players, n, gameOptions);
  const mafiaBlocked = wb.mafia;
  const maniacBlocked = wb.maniac;
  const doctorBlocked = wb.doctor;
  const sheriffBlocked = wb.sheriff;
  const donBlocked = wb.donCheck;

  if (wb.mafia) result.blocked.mafia = true;
  if (wb.maniac) result.blocked.maniac = true;
  if (wb.doctor) result.blocked.doctor = true;
  if (wb.sheriff) result.blocked.sheriff = true;

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

  let maniacVictim = null;
  if (!maniacBlocked && n.maniacTarget != null && n.maniacTarget >= 0) {
    maniacVictim = n.maniacTarget;
  }

  let healed = null;
  if (!doctorBlocked && n.doctorTarget != null && n.doctorTarget >= 0) {
    healed = n.doctorTarget;
  }

  const killedSet = new Set();
  if (mafiaVictim != null) {
    if (healed === mafiaVictim) {
      result.savedByDoctor = mafiaVictim;
    } else {
      killedSet.add(mafiaVictim);
    }
  }
  if (maniacVictim != null) {
    if (healed === maniacVictim) {
      if (result.savedByDoctor == null) result.savedByDoctor = maniacVictim;
    } else {
      killedSet.add(maniacVictim);
    }
  }
  if (result.whoreDied && !isFirstNight) {
    const whoreIdx = players.findIndex(p => p.role === 'whore' && p.alive);
    if (whoreIdx !== -1) {
      if (healed === whoreIdx) {
        if (result.savedByDoctor == null) result.savedByDoctor = whoreIdx;
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
}
