import { t } from '../i18n/index.js';

// Non-localizable role metadata. Names, sides and descriptions come from i18n
// via the helpers below — always resolve at call time so locale switches
// propagate without reloading the module.
export const ROLES = {
  mafia:    { id: 'mafia',    emblem: '⚜',       color: 'mafia' },
  civilian: { id: 'civilian', emblem: '♟',       color: 'civilian' },
  sheriff:  { id: 'sheriff',  emblem: '✦',       color: 'sheriff' },
  doctor:   { id: 'doctor',   emblem: '✚',       color: 'doctor' },
  don:      { id: 'don',      emblem: '♛',       color: 'don' },
  maniac:   { id: 'maniac',   emblem: '☠\uFE0E', color: 'maniac' },
  whore:    { id: 'whore',    emblem: '❀',       color: 'whore' },
  veteran:  { id: 'veteran',  emblem: '⛨\uFE0E', color: 'veteran' },
};

const SIDE_KEY = {
  mafia: 'sides.dark',
  don: 'sides.dark',
  civilian: 'sides.light',
  sheriff: 'sides.light',
  doctor: 'sides.light',
  whore: 'sides.light',
  veteran: 'sides.light',
  maniac: 'sides.solo',
};

export function getRoleName(roleId) {
  return t(`roles.${roleId}.name`);
}

export function getRoleSide(roleId) {
  return t(SIDE_KEY[roleId] || 'sides.light');
}

/**
 * Role description that depends on game settings. Currently only Whore text
 * changes based on `gameOptions.whoreDiesAtMafia`.
 * @param {string} roleId
 * @param {{whoreDiesAtMafia?: boolean}} [gameOptions]
 * @returns {string}
 */
export function getRoleDesc(roleId, gameOptions) {
  if (roleId === 'whore' && gameOptions && gameOptions.whoreDiesAtMafia) {
    return t('roles.whore.descDies');
  }
  return t(`roles.${roleId}.desc`);
}

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
