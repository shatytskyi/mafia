import { getWhoreBlocks, canDoctorHeal, canWhoreGo, canVeteranAct } from './night.js';
import { t, tList } from '../i18n/index.js';

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
 * @property {string} [hint]   Host-only cue: what to say off-record / gesture signals.
 * @property {string} [rules]  Short role constraints (1–2 lines).
 * @property {string} [tips]   Situational advice; omit when not useful.
 * @property {string} [cls]
 * @property {StepAction} [action]
 * @property {number|null} [timerSeconds]
 * @property {string} [timerLabel]
 * @property {string} [summary]
 */

/**
 * Deterministic variant pick — same {day} yields the same text, so navigating
 * back to the dawn step shows the same copy.
 * @param {string[]} variants
 * @param {number} day
 * @returns {string}
 */
export function pickDawnVariant(variants, day) {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  const d = Math.max(1, Number(day) || 1);
  return variants[(d - 1) % variants.length];
}

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
  const day = state.day;
  let announcement;
  if (killed.length === 0) {
    announcement = isFirstNight
      ? tList('steps.dawn.peacefulFirst', {}, day)
      : tList('steps.dawn.peacefulLater', { day }, day);
  } else {
    const names = killed.map(idx => state.players[idx].name).join(', ');
    const plural = killed.length > 1;
    if (isFirstNight) {
      announcement = plural
        ? tList('steps.dawn.deathFirstMany', { names }, day)
        : tList('steps.dawn.deathFirstOne', { names }, day);
    } else {
      announcement = plural
        ? tList('steps.dawn.deathLaterMany', { names, day }, day)
        : tList('steps.dawn.deathLaterOne', { names, day }, day);
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
      ? t('steps.whore.tipsDies')
      : t('steps.whore.tipsAlive');
    steps.push({
      title: t('steps.whore.title'),
      cls: 'whore-action',
      say: t('steps.whore.say'),
      hint: t('steps.whore.hint'),
      rules: t('steps.whore.rules'),
      tips: atMafia,
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

  // Mafia kill step (non-first-night only). Blocked variant uses the SAME
  // `say` as the regular flow — the only difference is the host hint — so
  // Mafia can't deduce the Whore visited them.
  if (!isFirstNight && hasMafia) {
    const closing = hasDonActive
      ? t('steps.mafiaKill.closingDon')
      : t('steps.mafiaKill.closingAlone');
    if (blocks.mafia) {
      steps.push({
        title: t('steps.mafiaKill.title'),
        cls: 'mafia-action',
        say: t('steps.mafiaKill.say'),
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

  // Don check. The host sees every role in the roster panel below and signals
  // the verdict verbally. Blocked variant keeps the same `say`; only `hint`
  // flips to the masking script.
  if (hasDonActive) {
    const opening = isFirstNight ? t('steps.don.opening') : '';
    const closing = isFirstNight
      ? t('steps.don.closingFirst')
      : t('steps.don.closingLater');
    const say = t('steps.don.say', { opening });
    if (blocks.donCheck) {
      steps.push({
        title: t('steps.don.title'),
        cls: 'mafia-action',
        say,
        hint: t('steps.don.hintBlocked', { closing }),
      });
    } else {
      steps.push({
        title: t('steps.don.title'),
        cls: 'mafia-action',
        say,
        hint: t('steps.don.hint', { closing }),
      });
    }
  }

  if (state.optionalRoles.doctor && hasAlive('doctor')) {
    if (blocks.doctor) {
      steps.push({
        title: t('steps.doctor.title'),
        cls: 'doctor-action',
        say: t('steps.doctor.say'),
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
        rules: t('steps.doctor.rules'),
        tips: t('steps.doctor.tips'),
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

  // Sheriff check. Host reads the verdict off the roster panel and signals
  // the Sheriff by hand — no picker, no result banner. Blocked variant
  // reuses the same `say`.
  if (hasAlive('sheriff')) {
    if (blocks.sheriff) {
      steps.push({
        title: t('steps.sheriff.title'),
        cls: 'sheriff-action',
        say: t('steps.sheriff.say'),
        hint: t('steps.sheriff.hintBlocked'),
      });
    } else {
      steps.push({
        title: t('steps.sheriff.title'),
        cls: 'sheriff-action',
        say: t('steps.sheriff.say'),
        hint: t('steps.sheriff.hint'),
      });
    }
  }

  // Veteran — sits between Sheriff and Maniac so his kill can pre-empt the
  // Maniac's action this night. Whore-block reuses the same `say`; the
  // attempt burns the underlying latch regardless.
  if (state.optionalRoles.veteran && hasAlive('veteran')) {
    if (blocks.veteran) {
      steps.push({
        title: t('steps.veteran.title'),
        cls: 'veteran-action',
        say: t('steps.veteran.say'),
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
        rules: t('steps.veteran.rules'),
        tips: t('steps.veteran.tips'),
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
        say: t('steps.maniac.say'),
        hint: t('steps.maniac.hintBlocked'),
        action: {
          type: 'blockedAction',
          field: 'maniacTarget',
          label: t('steps.maniac.blockedLabel'),
          confirmLabel: t('steps.maniac.blockedConfirm'),
        }
      });
    } else {
      const tips = isFirstNight
        ? t('steps.maniac.tipsFirst')
        : t('steps.maniac.tips');
      steps.push({
        title: t('steps.maniac.title'),
        cls: 'maniac-action',
        say: t('steps.maniac.say'),
        hint: t('steps.maniac.hint'),
        tips,
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
        ? tList('steps.victimsLastWordMany', { names }, state.day)
        : tList('steps.victimsLastWordOne', { names }, state.day),
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

/**
 * Vote phase: always starts with the pickKilled step; when someone is
 * actually selected for execution, a second "last word" step follows
 * (30 s timer, no action). If the town votes "no one leaves" the second
 * step is omitted and the phase is a single step. External sources
 * (mafiapiter, lifehacker) agree the executed player is entitled to a
 * last word.
 * @param {import('../types.js').AppState} state
 * @returns {Step[]}
 */
export function getVoteSteps(state) {
  const steps = [
    {
      title: t('steps.voteTitle'),
      say: t('steps.voteSay'),
      hint: t('steps.voteHint'),
      action: {
        type: 'pickKilled',
        label: t('steps.voteLabel'),
        allowSkip: true,
        skipLabel: t('steps.voteSkipLabel'),
      }
    }
  ];

  const killedIdx = state?.dayVoteKilled;
  if (killedIdx != null && killedIdx >= 0 && state.players[killedIdx]?.alive) {
    const name = state.players[killedIdx].name;
    steps.push({
      title: t('steps.voteLastWordTitle'),
      say: t('steps.voteLastWordSay', { name }),
      hint: t('steps.voteLastWordHint'),
      timerSeconds: 30,
      timerLabel: t('steps.voteLastWordTimerLabel'),
    });
  }

  return steps;
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
