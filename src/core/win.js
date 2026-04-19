/**
 * @param {import('../types.js').AppState} state
 * @returns {'city'|'mafia'|'maniac'|'draw'|null}
 */
export function checkWinCondition(state) {
  const alive = state.players.filter(p => p.alive);
  const mafia = alive.filter(p => p.role === 'mafia' || p.role === 'don');
  const maniac = alive.filter(p => p.role === 'maniac');
  const civilians = alive.filter(p => p.role !== 'mafia' && p.role !== 'don' && p.role !== 'maniac');

  if (alive.length === 0) return 'draw';
  if (mafia.length === 0 && maniac.length === 0) return 'city';
  if (mafia.length === 0 && maniac.length > 0 && civilians.length <= 1) return 'maniac';
  if (maniac.length === 0 && mafia.length > 0 && mafia.length >= civilians.length) return 'mafia';
  if (mafia.length > 0 && maniac.length > 0 && civilians.length === 0) return 'mafia';
  return null;
}
