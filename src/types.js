/**
 * @typedef {'mafia'|'civilian'|'sheriff'|'doctor'|'don'|'maniac'|'whore'} RoleId
 */

/**
 * @typedef {object} Player
 * @property {string} name
 * @property {RoleId|null} role
 * @property {boolean} alive
 */

/**
 * @typedef {object} OptionalRoles
 * @property {boolean} [don]
 * @property {boolean} [doctor]
 * @property {boolean} [maniac]
 * @property {boolean} [whore]
 */

/**
 * @typedef {'never'|'afterMafia'|'always'} SheriffSeesManiac
 */

/**
 * @typedef {object} GameOptions
 * @property {SheriffSeesManiac} sheriffSeesManiac
 * @property {boolean} whoreDiesAtMafia
 */

/**
 * @typedef {object} NightSelections
 * @property {number|null} mafiaTarget
 * @property {number|null} donCheck
 * @property {number|null} whoreTarget
 * @property {number|null} doctorTarget
 * @property {number|null} sheriffCheck
 * @property {number|null} maniacTarget
 * @property {NightResult|null} [resolved]
 * @property {boolean} [applied]
 */

/**
 * @typedef {object} NightResult
 * @property {number[]} killed
 * @property {number|null} savedByDoctor
 * @property {{mafia?: boolean, maniac?: boolean, doctor?: boolean, sheriff?: boolean}} blocked
 * @property {'mafia'|'notMafia'|null} sheriffResult
 * @property {'sheriff'|'notSheriff'|null} donResult
 * @property {boolean} whoreDied
 * @property {boolean} [whoreAtMafia]
 * @property {boolean} [whoreSavedByDoctor]
 */

/**
 * @typedef {'home'|'rules'|'names'|'deal'|'host'|'gameover'} Screen
 */

/**
 * @typedef {'night'|'day'|'vote'} Phase
 */

/**
 * @typedef {object} AppState
 * @property {Screen} screen
 * @property {number} playerCount
 * @property {OptionalRoles} optionalRoles
 * @property {GameOptions} gameOptions
 * @property {Player[]} players
 * @property {number} dealIndex
 * @property {'await'|'shown'} dealPhase
 * @property {number} day
 * @property {Phase} phase
 * @property {number} stepIndex
 * @property {{seconds: number, running: boolean, interval: any, preset?: number}} timer
 * @property {'light'|'dark'} theme
 * @property {NightSelections} night
 * @property {(number|null)[]} doctorHistory
 * @property {boolean} doctorSelfUsed
 * @property {(number|null)[]} whoreHistory
 * @property {number|null} dayVoteKilled
 * @property {'city'|'mafia'|'maniac'|'draw'|null} winner
 */

export {};
