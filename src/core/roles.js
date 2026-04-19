export const ROLES = {
  mafia: {
    id: 'mafia', name: 'Мафия', side: 'Тёмная сторона', emblem: '🔪',
    desc: 'Каждую ночь вы вместе с подельниками выбираете жертву. Днём притворяйтесь мирным жителем и сбивайте с толку.',
    color: 'mafia'
  },
  civilian: {
    id: 'civilian', name: 'Мирный', side: 'Светлая сторона', emblem: '☗',
    desc: 'У вас нет особых способностей. Ваше оружие — логика, интуиция и красноречие. Найдите мафию, пока не поздно.',
    color: 'civilian'
  },
  sheriff: {
    id: 'sheriff', name: 'Шериф', side: 'Светлая сторона', emblem: '✦',
    desc: 'Каждую ночь вы проверяете одного игрока — ведущий покажет, мафия он или нет. Но если мафия узнает вас — вы труп.',
    color: 'sheriff'
  },
  doctor: {
    id: 'doctor', name: 'Доктор', side: 'Светлая сторона', emblem: '✚',
    desc: 'Каждую ночь вы лечите одного игрока. Если мафия выберет его — он выживет. Себя можно лечить только один раз за игру.',
    color: 'doctor'
  },
  don: {
    id: 'don', name: 'Дон Мафии', side: 'Тёмная сторона', emblem: '♛',
    desc: 'Вы — глава мафии. Кроме участия в убийствах, каждую ночь можете проверить, является ли игрок Шерифом.',
    color: 'don'
  },
  maniac: {
    id: 'maniac', name: 'Маньяк', side: 'Одиночка', emblem: '☠',
    desc: 'Вы играете сами за себя. Каждую ночь убиваете одного игрока. Побеждаете, если останетесь с одним мирным один на один.',
    color: 'maniac'
  },
  whore: {
    id: 'whore', name: 'Путана', side: 'Светлая сторона', emblem: '❀',
    desc: 'Каждую ночь вы выбираете игрока — он «спит» у вас и не может применить свою ночную способность. Осторожно: если заблокируете мафию, можете сами погибнуть.',
    color: 'whore'
  }
};

/**
 * @param {string | null} role
 * @returns {boolean}
 */
export function isMafiaRole(role) {
  return role === 'mafia' || role === 'don';
}

/**
 * @param {Array<{role: string, alive: boolean, name: string}>} players
 * @param {number|null} idx
 * @returns {string|null}
 */
export function getRole(players, idx) {
  if (idx == null || idx < 0) return null;
  const p = players[idx];
  return p ? p.role : null;
}

/**
 * @param {Array<{role: string, name: string}>} players
 * @returns {string[]}
 */
export function getMafiaNames(players) {
  return players
    .filter(p => p.role === 'mafia' || p.role === 'don')
    .map(p => p.name);
}
