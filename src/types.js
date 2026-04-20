/**
 * @typedef {'mafia'|'civilian'|'sheriff'|'doctor'|'don'|'maniac'|'whore'|'veteran'} RoleId
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
 * @property {boolean} [veteran]
 */

/**
 * @typedef {object} GameOptions
 * @property {boolean} whoreDiesAtMafia
 */

/**
 * @typedef {object} NightSelections
 * @property {number|null} mafiaTarget
 * @property {number|null} whoreTarget
 * @property {number|null} doctorTarget
 * @property {number|null} maniacTarget
 * @property {number|null} veteranTarget
 * @property {'save'|'kill'|null} veteranAction
 * @property {NightResult|null} [resolved]
 * @property {boolean} [applied]
 */

/**
 * @typedef {object} NightResult
 * @property {number[]} killed
 * @property {number|null} savedByDoctor
 * @property {{mafia?: boolean, don?: boolean, maniac?: boolean, doctor?: boolean, sheriff?: boolean, veteran?: boolean}} blocked
 * @property {boolean} whoreDied
 * @property {boolean} [whoreAtMafia]
 * @property {boolean} [whoreSavedByDoctor]
 * @property {number|null} [veteranSaved]
 * @property {number|null} [veteranKill]
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
 * @property {boolean} veteranHealUsed
 * @property {boolean} veteranKillUsed
 * @property {number|null} dayVoteKilled
 * @property {'city'|'mafia'|'maniac'|'draw'|null} winner
 */

export {};
