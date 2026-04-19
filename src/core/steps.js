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

/** @returns {Step[]} */
export function getNightSteps(state) {
  const steps = [];
  const hasAlive = (role) => state.players.some(p => p.role === role && p.alive);
  const hasMafia = hasAlive('mafia') || hasAlive('don');
  const isFirstNight = state.day === 1;

  steps.push({
    title: 'Город засыпает',
    say: 'Город засыпает. Все закрывают глаза. Прошу тишины.',
    hint: 'Дождись полной тишины. Попроси игроков закрыть глаза и положить руки на стол — ритмичное постукивание скроет шорохи от активных ролей.'
  });

  if (isFirstNight && hasMafia) {
    steps.push({
      title: 'Мафия знакомится',
      cls: 'mafia-action',
      say: 'Мафия, просыпайся. Познакомьтесь друг с другом молча — взглядом и кивком.',
      hint: 'Дай мафиози 10–15 секунд узнать друг друга. В эту ночь мафия НЕ убивает — первого жителя убивают со второй ночи.'
    });
    steps.push({ title: 'Мафия засыпает', say: 'Мафия, закрой глаза.', hint: '' });
  }

  if (state.optionalRoles.whore && hasAlive('whore')) {
    steps.push({
      title: 'Путана просыпается',
      cls: 'whore-action',
      say: 'Путана, открой глаза. К кому идёшь этой ночью?',
      hint: 'Выбери цель ниже. Её ночная способность не сработает. Если к мафиози — Путана погибает вместе с ними. Нельзя ходить к одному игроку две ночи подряд.',
      action: {
        type: 'pickTarget',
        field: 'whoreTarget',
        role: 'whore',
        label: 'К кому идёт Путана',
        allowSkip: false,
        validate: (idx) => canWhoreGo(state.players, idx, state.whoreHistory)
      }
    });
    steps.push({ title: 'Путана засыпает', say: 'Путана, закрой глаза.', hint: '' });
  }

  if (!isFirstNight && hasMafia) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.mafia) {
      steps.push({
        title: 'Мафия просыпается',
        cls: 'mafia-action',
        say: 'Мафия, просыпайся. Ночью мафия никого не убивает.',
        hint: 'Путана заблокировала мафию — убийства не будет. Просто выдержи паузу, как будто мафия совещается, и нажми «Далее», чтобы никто ничего не заподозрил.',
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
        hint: 'Дождись единогласного решения. Если мафия не договорилась — нажми «Мафия не договорилась».',
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

  if (state.optionalRoles.don && hasAlive('don')) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.donCheck) {
      steps.push({
        title: 'Дон ищет Шерифа',
        cls: 'mafia-action',
        say: 'Дон, открой глаза. Этой ночью ты никого не проверяешь.',
        hint: 'Путана заблокировала Дона — его проверка не сработает. Выдержи паузу (как будто Дон думает), покажи любой жест и усыпи, чтобы Путана не догадалась.',
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
        say: 'Дон, укажи, кого проверяешь.',
        hint: 'Выбери цель. Приложение покажет результат — Шериф или нет. Покажи Дону ответ жестом: кивок (да) / покачивание (нет).',
        action: {
          type: 'pickTarget',
          field: 'donCheck',
          role: 'don',
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

  if (!isFirstNight && hasMafia) {
    steps.push({ title: 'Мафия засыпает', say: 'Мафия, закрой глаза.', hint: '' });
  } else if (isFirstNight && state.optionalRoles.don && hasAlive('don')) {
    steps.push({ title: 'Дон засыпает', say: 'Дон, закрой глаза.', hint: '' });
  }

  if (state.optionalRoles.doctor && hasAlive('doctor')) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.doctor) {
      steps.push({
        title: 'Доктор просыпается',
        cls: 'doctor-action',
        say: 'Доктор, просыпайся. Этой ночью ты никого не лечишь.',
        hint: 'Путана заблокировала Доктора — лечение не сработает. Выдержи паузу как обычно и усыпи, чтобы Путана не догадалась.',
        action: {
          type: 'blockedAction',
          field: 'doctorTarget',
          label: 'Доктор не лечит этой ночью',
          confirmLabel: 'Доктор никого не лечит'
        }
      });
    } else {
      steps.push({
        title: 'Доктор просыпается',
        cls: 'doctor-action',
        say: 'Доктор, просыпайся. Кого лечишь этой ночью?',
        hint: 'Ограничения: нельзя лечить одного игрока две ночи подряд; себя — только один раз за игру. Доктор лечит и от мафии, и от маньяка.',
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
    steps.push({ title: 'Доктор засыпает', say: 'Доктор, закрой глаза.', hint: '' });
  }

  if (hasAlive('sheriff')) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.sheriff) {
      steps.push({
        title: 'Шериф просыпается',
        cls: 'sheriff-action',
        say: 'Шериф, просыпайся. Этой ночью ты никого не проверяешь.',
        hint: 'Путана заблокировала Шерифа — его проверка не сработает. Выдержи паузу, покажи любой жест (или ничего) и усыпи. Играй ровно, чтобы Путана не догадалась.',
        action: {
          type: 'blockedAction',
          field: 'sheriffCheck',
          label: 'Шериф не проверяет этой ночью',
          confirmLabel: 'Шериф никого не проверяет'
        }
      });
    } else {
      steps.push({
        title: 'Шериф просыпается',
        cls: 'sheriff-action',
        say: 'Шериф, просыпайся. Кого проверяешь?',
        hint: 'Выбери цель. Приложение покажет результат. Покажи Шерифу жестом: палец вверх — НЕ мафия, вниз — мафия.',
        action: {
          type: 'pickTarget',
          field: 'sheriffCheck',
          role: 'sheriff',
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
    steps.push({ title: 'Шериф засыпает', say: 'Шериф, закрой глаза.', hint: '' });
  }

  if (state.optionalRoles.maniac && hasAlive('maniac')) {
    const blocks = getWhoreBlocks(state.players, state.night, state.gameOptions);
    if (blocks.maniac) {
      steps.push({
        title: 'Маньяк просыпается',
        cls: 'maniac-action',
        say: 'Маньяк, открой глаза. Этой ночью ты никого не убиваешь.',
        hint: 'Путана заблокировала Маньяка — он не может убивать. Выдержи паузу и усыпи, чтобы Путана не догадалась.',
        action: {
          type: 'blockedAction',
          field: 'maniacTarget',
          label: 'Маньяк не убивает этой ночью',
          confirmLabel: 'Маньяк никого не убивает'
        }
      });
    } else {
      steps.push({
        title: 'Маньяк просыпается',
        cls: 'maniac-action',
        say: 'Маньяк, открой глаза. Кого убиваешь?',
        hint: 'Доктор лечит и от маньяка.',
        action: {
          type: 'pickTarget',
          field: 'maniacTarget',
          role: 'maniac',
          label: 'Жертва Маньяка',
          allowSkip: true,
          skipLabel: 'Маньяк не убивает'
        }
      });
    }
    steps.push({ title: 'Маньяк засыпает', say: 'Маньяк, закрой глаза.', hint: '' });
  }

  steps.push({
    title: 'Итог ночи',
    say: '(про себя) Проверь результат.',
    hint: 'Приложение автоматически подсчитало результат с учётом всех блокировок, лечения и маньяка. Нажми «Далее», чтобы применить смерти и перейти к объявлению.',
    action: { type: 'resolveNight' }
  });

  steps.push({
    title: 'Город просыпается',
    say: 'Город просыпается. Открывайте глаза.',
    hint: 'Объявляй результаты драматично: «Этой ночью на углу улиц...». Если никто не умер — «эта ночь прошла спокойно».'
  });

  return steps;
}

/** @returns {Step[]} */
export function getDaySteps(state) {
  const isFirstDay = state.day === 1;
  const steps = [];
  const resolved = state.night.resolved;

  let victimsText = '';
  let victimsSay = '';
  if (isFirstDay) {
    victimsSay = 'Доброе утро, город. Первый день — все живы. Пора знакомиться.';
    victimsText = 'Первый день — смертей нет. Все живы.';
  } else if (resolved && resolved.killed.length === 0) {
    victimsSay = `День ${state.day}. Этой ночью никто не погиб.`;
    victimsText = 'Эта ночь прошла спокойно. Все живы.';
  } else if (resolved && resolved.killed.length > 0) {
    const names = resolved.killed.map(idx => state.players[idx].name).join(', ');
    victimsSay = `День ${state.day}. Этой ночью погиб${resolved.killed.length > 1 ? 'ли' : ''}: ${names}.`;
    victimsText = `Погибшие: ${names}`;
    if (resolved.savedByDoctor != null) {
      const savedName = state.players[resolved.savedByDoctor].name;
      victimsText += `\n(Доктор спас ${savedName})`;
    }
  } else {
    victimsSay = `Наступает день ${state.day}.`;
    victimsText = 'Результаты ночи ещё не подведены.';
  }

  steps.push({
    title: isFirstDay ? 'Утро первого дня' : 'Объявление жертв',
    say: victimsSay,
    hint: isFirstDay
      ? 'Переходи к обсуждению.'
      : 'По классике — погибший может открыть свою роль, но НЕ намекать на убийцу. Дай 30 секунд на последнее слово.',
    timerSeconds: isFirstDay ? null : 30,
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
    title: 'Выдвижение кандидатов',
    say: 'Кого вы подозреваете? Выдвигайте кандидатов.',
    hint: 'Один игрок выдвигает одного. Сам себя — нельзя. Если никто не выдвинут — голосования не будет, сразу к ночи.'
  });

  steps.push({
    title: 'Последнее слово кандидатов',
    say: 'Каждому кандидату — 30 секунд на оправдание.',
    hint: 'Выступают в порядке выдвижения.',
    timerSeconds: 30,
    timerLabel: '30 секунд на оправдание'
  });

  return steps;
}

/** @returns {Step[]} */
export function getVoteSteps() {
  return [
    {
      title: 'Голосование',
      say: 'Голосуем. Поднимите руку за того, кого считаете мафией.',
      hint: 'Называй кандидатов по очереди. Каждый голосует ровно один раз, не за себя. Считай голоса вслух.'
    },
    {
      title: 'Разрешение ничьи',
      say: '(если голоса равны) Объявляю переголосование.',
      hint: 'Если голоса равны: переголосование между лидерами с последним словом 20 сек. Если снова равенство — никто не уходит ИЛИ все лидеры уходят (решите до игры).',
      timerSeconds: 20,
      timerLabel: '20 секунд на повторное оправдание'
    },
    {
      title: 'Казнь',
      say: 'Город сделал свой выбор.',
      hint: 'Выбери казнённого ниже или нажми «Никто не уходит». Ему — 30 секунд последнего слова. По классике открывает роль.',
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

/** @returns {Step[]} */
export function getCurrentSteps(state) {
  if (state.phase === 'night') return getNightSteps(state);
  if (state.phase === 'day') return getDaySteps(state);
  if (state.phase === 'vote') return getVoteSteps(state);
  return [];
}
