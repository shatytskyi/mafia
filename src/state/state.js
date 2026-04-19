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
  night: {
    mafiaTarget: null,
    donCheck: null,
    whoreTarget: null,
    doctorTarget: null,
    sheriffCheck: null,
    maniacTarget: null,
    resolved: null,
    applied: false
  },
  doctorHistory: [],
  doctorSelfUsed: false,
  whoreHistory: [],
  dayVoteKilled: null,
  winner: null
};

export function resetNightSelections() {
  state.night = {
    mafiaTarget: null,
    donCheck: null,
    whoreTarget: null,
    doctorTarget: null,
    sheriffCheck: null,
    maniacTarget: null,
    resolved: null,
    applied: false
  };
  state.dayVoteKilled = null;
}
