import { shuffle } from './shuffle.js';

export const MIN_CIVILIANS = 2;

/**
 * @typedef {object} DistributionInput
 * @property {number} playerCount
 * @property {{don?: boolean, doctor?: boolean, maniac?: boolean, whore?: boolean}} optionalRoles
 */

/**
 * @typedef {object} Distribution
 * @property {number} mafia
 * @property {number} don
 * @property {number} sheriff
 * @property {number} doctor
 * @property {number} maniac
 * @property {number} whore
 * @property {number} civilian
 * @property {number} totalMafiaSide
 */

/**
 * @param {DistributionInput} input
 * @returns {Distribution}
 */
export function calcRoleDistribution({ playerCount: n, optionalRoles }) {
  let totalMafiaSide = Math.max(1, Math.floor(n / 3));
  if (n <= 5) totalMafiaSide = 1;

  let donCount = (optionalRoles.don && totalMafiaSide >= 2) ? 1 : 0;
  let mafiaCount = totalMafiaSide - donCount;

  const sheriffCount = 1;
  let doctorCount = optionalRoles.doctor ? 1 : 0;
  let maniacCount = (optionalRoles.maniac && n >= 8) ? 1 : 0;
  let whoreCount = (optionalRoles.whore && n >= 8) ? 1 : 0;

  const checkCivilians = () =>
    n - (mafiaCount + donCount + sheriffCount + doctorCount + maniacCount + whoreCount);

  while (checkCivilians() < MIN_CIVILIANS) {
    if (whoreCount > 0) { whoreCount = 0; continue; }
    if (maniacCount > 0) { maniacCount = 0; continue; }
    if (doctorCount > 0) { doctorCount = 0; continue; }
    if (donCount > 0) { donCount = 0; mafiaCount = totalMafiaSide; continue; }
    if (mafiaCount > 1) { mafiaCount--; continue; }
    break;
  }

  const civilianCount = Math.max(0, checkCivilians());

  return {
    mafia: mafiaCount,
    don: donCount,
    sheriff: sheriffCount,
    doctor: doctorCount,
    maniac: maniacCount,
    whore: whoreCount,
    civilian: civilianCount,
    totalMafiaSide: mafiaCount + donCount
  };
}

/**
 * @param {string} roleId
 * @param {number} playerCount
 * @returns {boolean}
 */
export function canEnableRole(roleId, playerCount) {
  if (roleId === 'don') return playerCount >= 6;
  if (roleId === 'maniac') return playerCount >= 8;
  if (roleId === 'whore') return playerCount >= 8;
  return true;
}

/**
 * Force-disable optional roles that are not allowed at the current player
 * count. Mutates the passed optionalRoles object in place. Returns the same
 * object for chaining.
 *
 * @param {{don?: boolean, doctor?: boolean, maniac?: boolean, whore?: boolean}} optionalRoles
 * @param {number} playerCount
 * @returns {{don?: boolean, doctor?: boolean, maniac?: boolean, whore?: boolean}}
 */
export function validateOptionalRoles(optionalRoles, playerCount) {
  for (const id of ['don', 'maniac', 'whore']) {
    if (!canEnableRole(id, playerCount)) optionalRoles[id] = false;
  }
  return optionalRoles;
}

/**
 * @param {string} roleId
 * @param {DistributionInput} input
 * @returns {boolean}
 */
export function isRoleEffective(roleId, input) {
  const dist = calcRoleDistribution(input);
  return dist[roleId] > 0;
}

/**
 * Assigns roles to players in-place (well, returns a new players array).
 *
 * @param {Array<{name: string}>} players
 * @param {DistributionInput} input
 * @param {() => number} [rng]
 * @returns {Array<{name: string, role: string, alive: boolean}>}
 */
export function dealRoles(players, input, rng) {
  const dist = calcRoleDistribution(input);
  const pool = [];
  for (let i = 0; i < dist.mafia; i++) pool.push('mafia');
  for (let i = 0; i < dist.don; i++) pool.push('don');
  for (let i = 0; i < dist.sheriff; i++) pool.push('sheriff');
  for (let i = 0; i < dist.doctor; i++) pool.push('doctor');
  for (let i = 0; i < dist.maniac; i++) pool.push('maniac');
  for (let i = 0; i < dist.whore; i++) pool.push('whore');
  for (let i = 0; i < dist.civilian; i++) pool.push('civilian');

  const shuffled = shuffle(pool, rng);
  return players.map((p, i) => ({
    ...p,
    role: shuffled[i],
    alive: true
  }));
}
