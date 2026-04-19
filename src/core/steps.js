import { isMafiaRole, getRole } from './roles.js';
import { getWhoreBlocks, canDoctorHeal, canWhoreGo, canVeteranAct } from './night.js';
import { t } from '../i18n/index.js';

/**
 * @typedef {object} StepAction
 * @property {'pickTarget'|'pickKilled'|'resolveNight'|'blockedAction'} type
 * @property {string} [field]
 * @property {string} [role]
 * @property {string} [label]
 * @property {boolean} [allowSkip]
 * @property {string} [skipLabel]
 * @property {string} [confirmLabel]
 * @property {(idx: number) => {ok: boolean, reason: string}} [validate]
 * @property {(idx: number) => string} [showResult]
 */

/**
 * @typedef {object} Step
 * @property {string} title
 * @property {string} say
 * @property {string} [hint]
 * @property {string} [cls]
 * @property {StepAction} [action]
 * @property {number|null} [timerSeconds]
 * @property {string} [timerLabel]
 * @property {string} [summary]
 */

/**
 * Build the public "host says" script for the dawn step. Combines the wake-up
 * cue with the announceable result (who died / peaceful night), mirroring the
 * day-victims script. Private details (sheriff/don verdicts, doctor save,
 * veteran action, whore fate, blocks) stay in `renderResolveNight`.
 *
 * @param {import('../types.js').AppState} state
 * @param {boolean} isFirstNight
 * @returns {string} HTML-safe say text (uses <br> for line breaks)
 */
function buildDawnSay(state, isFirstNight) {
  const wakeUp = t('steps.dawn.say');
  const resolved = state.night.resolved;
  if (!resolved) return wakeUp;

  const killed = resolved.killed || [];
  let announcement;
  if (killed.length === 0) {
    announcement = isFirstNight
      ? t('steps.victimsPeacefulFirst')
      : t('steps.victimsPeacefulLater', { day: state.day });
  } else {
    const names = killed.map(idx => state.players[idx].name).join(', ');
    const plural = killed.length > 1;
    if (isFirstNight) {
      announcement = plural
        ? t('steps.victimsDeathFirstMany', { names })
        : t('steps.victimsDeathFirstOne', { names });
    } else {
      announcement = plural
        ? t('steps.victimsDeathLaterMany', { names, day: state.day })
        : t('steps.victimsDeathLaterOne', { names, day: state.day });
    }
  }
  return `${wakeUp}<br><br>${announcement}`;
}

/**
 * @param {import('../types.js').AppState} state
 * @returns {Step[]}
 */
export function getNightSteps(state) {
  const steps = [];
  const hasAlive = (role) => state.players.some(p => p.role === role && p.alive);
  const hasMafia = hasAlive('mafia') || hasAlive('don');
  const hasDonActive = state.optionalRoles.don && hasAlive('don');
  const isFirstNight = state.day === 1;
  const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);

  steps.push({
    title: t('steps.cityFallsAsleep.title'),
    say: t('steps.cityFallsAsleep.say'),
    hint: t('steps.cityFallsAsleep.hint'),
  });

  // First-night mafia meet-and-greet. No kill. All mafia (incl. Don) go back to
  // sleep at the end so Don can wake alone for his check.
  if (isFirstNight && hasMafia) {
    steps.push({
      title: t('steps.mafiaMeet.title'),
      cls: 'mafia-action',
      say: t('steps.mafiaMeet.say'),
      hint: t('steps.mafiaMeet.hint'),
    });
  }

  // Whore goes first among active roles so blocks resolve before others act.
  if (state.optionalRoles.whore && hasAlive('whore')) {
    const atMafia = state.gameOptions.whoreDiesAtMafia
      ? t('steps.whore.hintDies')
      : t('steps.whore.hintAlive');
    steps.push({
      title: t('steps.whore.title'),
      cls: 'whore-action',
      say: t('steps.whore.say'),
      hint: t('steps.whore.hint', { atMafia }),
      action: {
        type: 'pickTarget',
        field: 'whoreTarget',
        role: 'whore',
        excludeSelf: true,
        label: t('steps.whore.label'),
        allowSkip: false,
        validate: (idx) => canWhoreGo(state.players, idx, state.whoreHistory)
      }
    });
  }

  // Mafia kill step (non-first-night only). Closing script lives here when Don
  // is NOT active; otherwise Don's step will close all mafia.
  if (!isFirstNight && hasMafia) {
    const closing = hasDonActive
      ? t('steps.mafiaKill.closingDon')
      : t('steps.mafiaKill.closingAlone');
    if (blocks.mafia) {
      steps.push({
        title: t('steps.mafiaKill.title'),
        cls: 'mafia-action',
        say: t('steps.mafiaKill.sayBlocked'),
        hint: t('steps.mafiaKill.hintBlocked', { closing }),
        action: {
          type: 'blockedAction',
          field: 'mafiaTarget',
          label: t('steps.mafiaKill.blockedLabel'),
          confirmLabel: t('steps.mafiaKill.blockedConfirm'),
        }
      });
    } else {
      steps.push({
        title: t('steps.mafiaKill.title'),
        cls: 'mafia-action',
        say: t('steps.mafiaKill.say'),
        hint: t('steps.mafiaKill.hint', { closing }),
        timerSeconds: 10,
        timerLabel: t('steps.mafiaKill.timerLabel'),
        action: {
          type: 'pickTarget',
          field: 'mafiaTarget',
          role: 'mafia',
          label: t('steps.mafiaKill.label'),
          allowSkip: true,
          skipLabel: t('steps.mafiaKill.skipLabel'),
        }
      });
    }
  }

  // Don check. Closing varies: first night puts Don back to sleep alone; later
  // nights close the entire mafia (including Don).
  if (hasDonActive) {
    const opening = isFirstNight ? t('steps.don.opening') : '';
    const closing = isFirstNight
      ? t('steps.don.closingFirst')
      : t('steps.don.closingLater');
    if (blocks.donCheck) {
      steps.push({
        title: t('steps.don.title'),
        cls: 'mafia-action',
        say: t('steps.don.sayBlocked', { opening }),
        hint: t('steps.don.hintBlocked', { closing }),
        action: {
          type: 'blockedAction',
          field: 'donCheck',
          label: t('steps.don.blockedLabel'),
          confirmLabel: t('steps.don.blockedConfirm'),
        }
      });
    } else {
      steps.push({
        title: t('steps.don.title'),
        cls: 'mafia-action',
        say: t('steps.don.say', { opening }),
        hint: t('steps.don.hint', { closing }),
        action: {
          type: 'pickTarget',
          field: 'donCheck',
          role: 'don',
          excludeSelf: true,
          label: t('steps.don.label'),
          allowSkip: true,
          skipLabel: t('steps.don.skipLabel'),
          showResult: (idx) => {
            const role = getRole(state.players, idx);
            return role === 'sheriff' ? t('steps.don.resultSheriff') : t('steps.don.resultNotSheriff');
          }
        }
      });
    }
  }

  if (state.optionalRoles.doctor && hasAlive('doctor')) {
    if (blocks.doctor) {
      steps.push({
        title: t('steps.doctor.title'),
        cls: 'doctor-action',
        say: t('steps.doctor.sayBlocked'),
        hint: t('steps.doctor.hintBlocked'),
        action: {
          type: 'blockedAction',
          field: 'doctorTarget',
          label: t('steps.doctor.blockedLabel'),
          confirmLabel: t('steps.doctor.blockedConfirm'),
        }
      });
    } else {
      steps.push({
        title: t('steps.doctor.title'),
        cls: 'doctor-action',
        say: t('steps.doctor.say'),
        hint: t('steps.doctor.hint'),
        action: {
          type: 'pickTarget',
          field: 'doctorTarget',
          role: 'doctor',
          label: t('steps.doctor.label'),
          allowSkip: true,
          skipLabel: t('steps.doctor.skipLabel'),
          validate: (idx) => canDoctorHeal(state.players, idx, state.doctorHistory, state.doctorSelfUsed)
        }
      });
    }
  }

  if (hasAlive('sheriff')) {
    if (blocks.sheriff) {
      steps.push({
        title: t('steps.sheriff.title'),
        cls: 'sheriff-action',
        say: t('steps.sheriff.sayBlocked'),
        hint: t('steps.sheriff.hintBlocked'),
        action: {
          type: 'blockedAction',
          field: 'sheriffCheck',
          label: t('steps.sheriff.blockedLabel'),
          confirmLabel: t('steps.sheriff.blockedConfirm'),
        }
      });
    } else {
      steps.push({
        title: t('steps.sheriff.title'),
        cls: 'sheriff-action',
        say: t('steps.sheriff.say'),
        hint: t('steps.sheriff.hint'),
        action: {
          type: 'pickTarget',
          field: 'sheriffCheck',
          role: 'sheriff',
          excludeSelf: true,
          label: t('steps.sheriff.label'),
          allowSkip: true,
          skipLabel: t('steps.sheriff.skipLabel'),
          showResult: (idx) => {
            const role = getRole(state.players, idx);
            let looksLikeMafia = isMafiaRole(role);
            if (!looksLikeMafia && role === 'maniac') {
              const mode = state.gameOptions.sheriffSeesManiac || 'afterMafia';
              if (mode === 'always') {
                looksLikeMafia = true;
              } else if (mode === 'afterMafia') {
                const mafiaAlive = state.players.some(p => p.alive && isMafiaRole(p.role));
                if (!mafiaAlive) looksLikeMafia = true;
              }
            }
            return looksLikeMafia ? t('steps.sheriff.resultMafia') : t('steps.sheriff.resultNotMafia');
          }
        }
      });
    }
  }

  // Veteran — sits between Sheriff and Maniac so his kill can pre-empt the
  // Maniac's action this night. Whore-block is rendered as a blockedAction;
  // the attempt burns the underlying latch regardless.
  if (state.optionalRoles.veteran && hasAlive('veteran')) {
    if (blocks.veteran) {
      steps.push({
        title: t('steps.veteran.title'),
        cls: 'veteran-action',
        say: t('steps.veteran.sayBlocked'),
        hint: t('steps.veteran.hintBlocked'),
        action: {
          type: 'blockedAction',
          field: 'veteranTarget',
          label: t('steps.veteran.blockedLabel'),
          confirmLabel: t('steps.veteran.blockedConfirm'),
        }
      });
    } else {
      steps.push({
        title: t('steps.veteran.title'),
        cls: 'veteran-action',
        say: t('steps.veteran.say'),
        hint: t('steps.veteran.hint'),
        action: {
          type: 'pickVeteran',
          field: 'veteranTarget',
          role: 'veteran',
          label: t('steps.veteran.modeLabel'),
          saveUsed: !!state.veteranHealUsed,
          killUsed: !!state.veteranKillUsed,
          validate: (idx) => canVeteranAct(
            state.players,
            state.night.veteranAction,
            idx,
            !!state.veteranHealUsed,
            !!state.veteranKillUsed
          ),
        }
      });
    }
  }

  // Maniac acts on every night including the first (per all sources in
  // docs/external-rules/ — see README "Does the Maniac act on the first night").
  if (state.optionalRoles.maniac && hasAlive('maniac')) {
    if (blocks.maniac) {
      steps.push({
        title: t('steps.maniac.title'),
        cls: 'maniac-action',
        say: t('steps.maniac.sayBlocked'),
        hint: t('steps.maniac.hintBlocked'),
        action: {
          type: 'blockedAction',
          field: 'maniacTarget',
          label: t('steps.maniac.blockedLabel'),
          confirmLabel: t('steps.maniac.blockedConfirm'),
        }
      });
    } else {
      steps.push({
        title: t('steps.maniac.title'),
        cls: 'maniac-action',
        say: t('steps.maniac.say'),
        hint: t('steps.maniac.hint'),
        action: {
          type: 'pickTarget',
          field: 'maniacTarget',
          role: 'maniac',
          excludeSelf: true,
          label: t('steps.maniac.label'),
          allowSkip: true,
          skipLabel: t('steps.maniac.skipLabel'),
        }
      });
    }
  }

  // Merged: resolve summary + "city wakes up" announcement. The top `say` card
  // carries the publicly-announceable script (built from the latest resolved
  // night). The private summary is rendered by renderAction below. Apply of the
  // resolution happens on Next click.
  steps.push({
    title: t('steps.dawn.title'),
    say: buildDawnSay(state, isFirstNight),
    hint: t('steps.dawn.hint'),
    action: { type: 'resolveNight' }
  });

  return steps;
}

/**
 * @param {import('../types.js').AppState} state
 * @returns {Step[]}
 */
export function getDaySteps(state) {
  const isFirstDay = state.day === 1;
  const steps = [];
  const resolved = state.night.resolved;
  const killed = resolved ? resolved.killed : [];
  const peaceful = killed.length === 0;

  // "Last word" step: only relevant when someone died. The public announcement
  // already happened on the dawn step, so this step focuses exclusively on the
  // last-word beat — no announcement repeat, no private info (the Doctor save
  // and blocks live in the dawn resolve card).
  if (!peaceful) {
    const names = killed.map(idx => state.players[idx].name).join(', ');
    const plural = killed.length > 1;
    steps.push({
      title: t('steps.victimsTitle'),
      say: plural
        ? t('steps.victimsLastWordMany', { names })
        : t('steps.victimsLastWordOne', { names }),
      hint: t('steps.victimsHint'),
      timerSeconds: 30,
      timerLabel: t('steps.victimsTimerLabel'),
    });
  }

  steps.push({
    title: t('steps.discussionTitle'),
    say: t('steps.discussionSay'),
    hint: isFirstDay ? t('steps.discussionHintFirst') : t('steps.discussionHint'),
    timerSeconds: 60,
    timerLabel: t('steps.discussionTimerLabel'),
  });

  steps.push({
    title: t('steps.nominationTitle'),
    say: t('steps.nominationSay'),
    hint: t('steps.nominationHint'),
    timerSeconds: 30,
    timerLabel: t('steps.nominationTimerLabel'),
  });

  return steps;
}

/** @returns {Step[]} */
export function getVoteSteps() {
  return [
    {
      title: t('steps.voteTitle'),
      say: t('steps.voteSay'),
      hint: t('steps.voteHint'),
      timerSeconds: 30,
      timerLabel: t('steps.voteTimerLabel'),
      action: {
        type: 'pickKilled',
        label: t('steps.voteLabel'),
        allowSkip: true,
        skipLabel: t('steps.voteSkipLabel'),
        allowRevote: true,
        revoteLabel: t('steps.voteRevoteLabel'),
      }
    }
  ];
}

/**
 * @param {import('../types.js').AppState} state
 * @returns {Step[]}
 */
export function getCurrentSteps(state) {
  if (state.phase === 'night') return getNightSteps(state);
  if (state.phase === 'day') return getDaySteps(state);
  if (state.phase === 'vote') return getVoteSteps(state);
  return [];
}
