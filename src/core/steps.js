import { isMafiaRole, getRole } from './roles.js';
import { getWhoreBlocks, canDoctorHeal, canWhoreGo } from './night.js';

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
    title: 'Город засыпает',
    say: 'Город засыпает. Все закрывают глаза. Прошу тишины.',
    hint: 'Дождись полной тишины. Ритмичное постукивание по столу скроет шорохи от активных ролей.'
  });

  // First-night mafia meet-and-greet. No kill. All mafia (incl. Don) go back to
  // sleep at the end so Don can wake alone for his check.
  if (isFirstNight && hasMafia) {
    steps.push({
      title: 'Мафия знакомится',
      cls: 'mafia-action',
      say: 'Мафия, просыпайся. Познакомьтесь молча — взглядом и кивком. В эту ночь мафия НЕ убивает.',
      hint: 'Дай 10–15 секунд. Затем скажи: «Мафия, закрой глаза».'
    });
  }

  // Whore goes first among active roles so blocks resolve before others act.
  if (state.optionalRoles.whore && hasAlive('whore')) {
    const whoreAtMafiaHint = state.gameOptions.whoreDiesAtMafia
      ? 'Если пойдёт к мафиози — Путана погибает вместе с ним.'
      : 'Если пойдёт к мафиози — у Путаны алиби; мафия заблокирована, только если это её последний живой боец.';
    steps.push({
      title: 'Путана',
      cls: 'whore-action',
      say: 'Путана, открой глаза. К кому идёшь этой ночью?',
      hint: `Её ночная способность не сработает. ${whoreAtMafiaHint} Нельзя ходить к одному игроку две ночи подряд. После выбора — «Путана, закрой глаза».`,
      action: {
        type: 'pickTarget',
        field: 'whoreTarget',
        role: 'whore',
        excludeSelf: true,
        label: 'К кому идёт Путана',
        allowSkip: false,
        validate: (idx) => canWhoreGo(state.players, idx, state.whoreHistory)
      }
    });
  }

  // Mafia kill step (non-first-night only). Closing script lives here when Don
  // is NOT active; otherwise Don's step will close all mafia.
  if (!isFirstNight && hasMafia) {
    const closing = hasDonActive
      ? 'Далее ходит Дон — мафия остаётся бодрствовать.'
      : 'После выбора — «Мафия, закрой глаза».';
    if (blocks.mafia) {
      steps.push({
        title: 'Мафия просыпается',
        cls: 'mafia-action',
        say: 'Мафия, просыпайся. Ночью мафия никого не убивает.',
        hint: `Путана заблокировала мафию — убийства не будет. Выдержи паузу, покажи любой жест, будто мафия совещается. ${closing}`,
        action: {
          type: 'blockedAction',
          field: 'mafiaTarget',
          label: 'Мафия не убивает этой ночью',
          confirmLabel: 'Мафия никого не убивает'
        }
      });
    } else {
      steps.push({
        title: 'Мафия просыпается',
        cls: 'mafia-action',
        say: 'Мафия, просыпайся. Жестами выберите жертву.',
        hint: `Дождись единогласного решения. Если не договорились — «Мафия не договорилась». ${closing}`,
        action: {
          type: 'pickTarget',
          field: 'mafiaTarget',
          role: 'mafia',
          label: 'Жертва мафии',
          allowSkip: true,
          skipLabel: 'Мафия не договорилась'
        }
      });
    }
  }

  // Don check. Closing varies: first night puts Don back to sleep alone; later
  // nights close the entire mafia (including Don).
  if (hasDonActive) {
    const donOpening = isFirstNight ? 'Дон, просыпайся. ' : '';
    const closing = isFirstNight
      ? 'Затем скажи: «Дон, закрой глаза».'
      : 'Затем скажи: «Мафия, закрой глаза» — все мафиози и Дон закрывают глаза вместе.';
    if (blocks.donCheck) {
      steps.push({
        title: 'Дон ищет Шерифа',
        cls: 'mafia-action',
        say: `${donOpening}Этой ночью ты никого не проверяешь.`,
        hint: `Путана заблокировала Дона — проверка не сработает. Выдержи паузу и покажи любой жест, чтобы Путана не догадалась. ${closing}`,
        action: {
          type: 'blockedAction',
          field: 'donCheck',
          label: 'Дон не проверяет этой ночью',
          confirmLabel: 'Дон никого не проверяет'
        }
      });
    } else {
      steps.push({
        title: 'Дон ищет Шерифа',
        cls: 'mafia-action',
        say: `${donOpening}Укажи, кого проверяешь.`,
        hint: `Приложение покажет, Шериф ли это. Передай Дону жестом: кивок — да, покачивание — нет. ${closing}`,
        action: {
          type: 'pickTarget',
          field: 'donCheck',
          role: 'don',
          excludeSelf: true,
          label: 'Проверка Дона',
          allowSkip: true,
          skipLabel: 'Не проверять',
          showResult: (idx) => {
            const role = getRole(state.players, idx);
            return role === 'sheriff' ? '✓ Это Шериф' : '✗ Не Шериф';
          }
        }
      });
    }
  }

  if (state.optionalRoles.doctor && hasAlive('doctor')) {
    if (blocks.doctor) {
      steps.push({
        title: 'Доктор',
        cls: 'doctor-action',
        say: 'Доктор, просыпайся. Этой ночью ты никого не лечишь.',
        hint: 'Путана заблокировала Доктора. Выдержи паузу, покажи любой жест. Затем — «Доктор, закрой глаза».',
        action: {
          type: 'blockedAction',
          field: 'doctorTarget',
          label: 'Доктор не лечит этой ночью',
          confirmLabel: 'Доктор никого не лечит'
        }
      });
    } else {
      steps.push({
        title: 'Доктор',
        cls: 'doctor-action',
        say: 'Доктор, просыпайся. Кого лечишь этой ночью?',
        hint: 'Нельзя лечить одного игрока две ночи подряд. Себя — один раз за игру. Доктор лечит и от мафии, и от маньяка. После выбора — «Доктор, закрой глаза».',
        action: {
          type: 'pickTarget',
          field: 'doctorTarget',
          role: 'doctor',
          label: 'Кого лечит Доктор',
          allowSkip: true,
          skipLabel: 'Не лечить никого',
          validate: (idx) => canDoctorHeal(state.players, idx, state.doctorHistory, state.doctorSelfUsed)
        }
      });
    }
  }

  if (hasAlive('sheriff')) {
    if (blocks.sheriff) {
      steps.push({
        title: 'Шериф',
        cls: 'sheriff-action',
        say: 'Шериф, просыпайся. Этой ночью ты никого не проверяешь.',
        hint: 'Путана заблокировала Шерифа. Выдержи паузу, покажи любой жест. Затем — «Шериф, закрой глаза».',
        action: {
          type: 'blockedAction',
          field: 'sheriffCheck',
          label: 'Шериф не проверяет этой ночью',
          confirmLabel: 'Шериф никого не проверяет'
        }
      });
    } else {
      steps.push({
        title: 'Шериф',
        cls: 'sheriff-action',
        say: 'Шериф, просыпайся. Кого проверяешь?',
        hint: 'Приложение покажет результат. Передай Шерифу жестом: палец вверх — НЕ мафия, вниз — мафия. После — «Шериф, закрой глаза».',
        action: {
          type: 'pickTarget',
          field: 'sheriffCheck',
          role: 'sheriff',
          excludeSelf: true,
          label: 'Проверка Шерифа',
          allowSkip: true,
          skipLabel: 'Не проверять',
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
            return looksLikeMafia ? '🔴 МАФИЯ' : '🟢 НЕ МАФИЯ';
          }
        }
      });
    }
  }

  // Maniac acts on every night including the first (per all sources in
  // docs/external-rules/ — see README "Does the Maniac act on the first night").
  if (state.optionalRoles.maniac && hasAlive('maniac')) {
    if (blocks.maniac) {
      steps.push({
        title: 'Маньяк',
        cls: 'maniac-action',
        say: 'Маньяк, открой глаза. Этой ночью ты никого не убиваешь.',
        hint: 'Путана заблокировала Маньяка. Выдержи паузу. Затем — «Маньяк, закрой глаза».',
        action: {
          type: 'blockedAction',
          field: 'maniacTarget',
          label: 'Маньяк не убивает этой ночью',
          confirmLabel: 'Маньяк никого не убивает'
        }
      });
    } else {
      steps.push({
        title: 'Маньяк',
        cls: 'maniac-action',
        say: 'Маньяк, открой глаза. Кого убиваешь?',
        hint: 'Маньяк действует и в первую ночь. Доктор может спасти от маньяка. После выбора — «Маньяк, закрой глаза».',
        action: {
          type: 'pickTarget',
          field: 'maniacTarget',
          role: 'maniac',
          excludeSelf: true,
          label: 'Жертва Маньяка',
          allowSkip: true,
          skipLabel: 'Маньяк не убивает'
        }
      });
    }
  }

  // Merged: resolve summary + "city wakes up" announcement. The summary card is
  // rendered by renderAction; applyNightResolution runs on Next click.
  steps.push({
    title: 'Рассвет',
    say: 'Город просыпается. Открывайте глаза.',
    hint: 'Сверься с итогом ночи ниже, затем объявляй драматично: «Этой ночью на углу улиц...». Если никто не умер — «эта ночь прошла спокойно». Нажми «Далее», чтобы применить результаты и перейти ко дню.',
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

  let victimsSay;
  let victimsText;
  if (peaceful) {
    victimsSay = isFirstDay
      ? 'Доброе утро, город. Первый день — все живы. Пора знакомиться.'
      : `День ${state.day}. Этой ночью никто не погиб.`;
    victimsText = 'Эта ночь прошла спокойно. Все живы.';
  } else {
    const names = killed.map(idx => state.players[idx].name).join(', ');
    const plural = killed.length > 1;
    victimsSay = isFirstDay
      ? `Доброе утро, город. Страшная новость: этой ночью погиб${plural ? 'ли' : ''}: ${names}.`
      : `День ${state.day}. Этой ночью погиб${plural ? 'ли' : ''}: ${names}.`;
    victimsText = `Погибшие: ${names}`;
    if (resolved && resolved.savedByDoctor != null) {
      const savedName = state.players[resolved.savedByDoctor].name;
      victimsText += `\n(Доктор спас ${savedName})`;
    }
  }

  // First-day morning with no deaths doesn't need a last-word timer. Any other
  // day (or first day with a maniac kill) does.
  const showLastWordTimer = !peaceful;

  steps.push({
    title: isFirstDay && peaceful ? 'Утро первого дня' : 'Объявление жертв',
    say: victimsSay,
    hint: peaceful
      ? 'Переходи к обсуждению.'
      : 'По классике — погибший может открыть свою роль, но НЕ намекать на убийцу. Дай 30 секунд на последнее слово.',
    timerSeconds: showLastWordTimer ? 30 : null,
    timerLabel: 'Последнее слово погибшего',
    summary: victimsText
  });

  steps.push({
    title: 'Обсуждение',
    say: 'Время обсудить. У каждого минута, чтобы высказаться по кругу.',
    hint: isFirstDay
      ? 'Первый день обычно короткий — игроки почти ничего не знают. Начинайте с любого.'
      : 'Начни с игрока слева от первого умершего. Строго следи за таймингом. Никто не перебивает.',
    timerSeconds: 60,
    timerLabel: 'Минута на игрока'
  });

  steps.push({
    title: 'Выдвижение и оправдания',
    say: 'Кого вы подозреваете? Выдвигайте кандидатов. Каждому — 30 секунд на оправдание.',
    hint: 'Один игрок выдвигает одного. Сам себя — нельзя. Если никто не выдвинут — голосования не будет, сразу к ночи. Таймер запускай на каждого кандидата отдельно.',
    timerSeconds: 30,
    timerLabel: '30 секунд кандидату'
  });

  return steps;
}

/** @returns {Step[]} */
export function getVoteSteps() {
  return [
    {
      title: 'Голосование и казнь',
      say: 'Голосуем. Поднимите руку за того, кого считаете мафией.',
      hint: 'Называй кандидатов по очереди. Каждый голосует один раз, не за себя. Считай голоса вслух. При ничьей реши сам: никто не уходит или все лидеры уходят (договоритесь до игры). Выбери казнённого ниже или «Никто не уходит» — ему 30 секунд на последнее слово.',
      timerSeconds: 30,
      timerLabel: 'Последнее слово казнённого',
      action: {
        type: 'pickKilled',
        label: 'Кого казнил город',
        allowSkip: true,
        skipLabel: 'Никто не уходит'
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
