/**
 * Factory for the blank night-selections object. Reused by initial state,
 * resetNightSelections, and persistence fallback to keep the shape in sync.
 */
export function emptyNight() {
  return {
    mafiaTarget: null,
    donCheck: null,
    whoreTarget: null,
    doctorTarget: null,
    sheriffCheck: null,
    maniacTarget: null,
    resolved: null,
    applied: false
  };
}

/** @type {import('../types.js').AppState} */
export const state = {
  screen: 'home',
  playerCount: 8,
  optionalRoles: { don: true, doctor: true, maniac: false, whore: false },
  gameOptions: {
    sheriffSeesManiac: 'afterMafia',
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
  nightLog: [],
  dayVoteKilled: null,
  winner: null
};

export function resetNightSelections() {
  state.night = emptyNight();
  state.dayVoteKilled = null;
}
