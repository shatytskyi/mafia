/**
 * Factory for the blank night-selections object. Reused by initial state,
 * resetNightSelections, and persistence fallback to keep the shape in sync.
 */
export function emptyNight() {
  return {
    mafiaTarget: null,
    whoreTarget: null,
    doctorTarget: null,
    maniacTarget: null,
    veteranTarget: null,
    veteranAction: null,
    resolved: null,
    applied: false
  };
}

/** @type {import('../types.js').AppState} */
export const state = {
  screen: 'home',
  playerCount: 8,
  optionalRoles: { don: true, doctor: true, maniac: false, whore: false, veteran: false },
  gameOptions: {
    whoreDiesAtMafia: false
  },
  players: [],
  dealIndex: 0,
  dealPhase: 'await',
  day: 1,
  phase: 'night',
  stepIndex: 0,
  timer: { seconds: 60, running: false, interval: null },
  theme: 'light',
  night: emptyNight(),
  doctorHistory: [],
  doctorSelfUsed: false,
  whoreHistory: [],
  veteranHealUsed: false,
  veteranKillUsed: false,
  nightLog: [],
  dayVoteKilled: null,
  winner: null
};

export function resetNightSelections() {
  state.night = emptyNight();
  state.dayVoteKilled = null;
}
