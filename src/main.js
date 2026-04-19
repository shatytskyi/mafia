import { shuffle } from './core/shuffle.js';
import { ROLES, isMafiaRole, getRole, getMafiaNames } from './core/roles.js';
import { calcRoleDistribution, canEnableRole, isRoleEffective, dealRoles } from './core/distribution.js';
import { resolveNight, applyNightResolution, canDoctorHeal, canWhoreGo, getWhoreBlocks } from './core/night.js';
import { checkWinCondition } from './core/win.js';
import { getNightSteps, getDaySteps, getVoteSteps, getCurrentSteps } from './core/steps.js';
import { state, resetNightSelections } from './state/state.js';
import {
  createPersistence, buildSnapshot, applySnapshotToState, formatSavedAgo, savedGameDescription
} from './state/persistence.js';
import { applyTheme, bindThemeToggle, onThemeChange, updateThemeIcon } from './ui/theme.js';
import { createRender, registerScreen } from './ui/render.js';
import { renderHome } from './ui/screens/home.js';
import { renderNames } from './ui/screens/names.js';
import { renderDeal } from './ui/screens/deal.js';
import { renderTimer, startTimer, stopTimer, bindTimerHandlers } from './ui/screens/timer.js';
import { renderAction, bindActionHandlers, isNextDisabled } from './ui/screens/actions.js';
import { renderHost } from './ui/screens/host.js';
import { renderGameOver } from './ui/screens/gameover.js';
import { renderRules } from './ui/screens/rules.js';

const persistence = createPersistence();

// ============================================================
// STATE
// ============================================================
// State and resetNightSelections are imported from './state/state.js'

// ============================================================
// PERSISTENCE (localStorage)
// ============================================================

let _saveTimer = null;
function saveGame() {
  if (state.screen !== 'host') return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => persistence.saveSnapshot(buildSnapshot(state)), 300);
}

function loadGame() { return persistence.loadSnapshot(); }
function clearSavedGame() { persistence.clearSnapshot(); }

function restoreGame(data) { applySnapshotToState(state, data); }

function saveTheme() { persistence.saveTheme(state.theme); }
function loadTheme() {
  const t = persistence.loadTheme();
  if (t) state.theme = t;
}

// ============================================================
// HELPERS
// ============================================================


const render = createRender({
  beforeRender: () => saveGame(),
  afterRender: () => { if (state.screen === 'home') clearSavedGame(); }
});

registerScreen('home', () => renderHome({ render, loadGame, clearSavedGame, restoreGame }));
registerScreen('names', () => renderNames({ render }));
registerScreen('deal', () => renderDeal({ render }));
registerScreen('host', () => renderHost({ render, clearSavedGame }));
registerScreen('gameover', () => renderGameOver({ render }));
registerScreen('rules', () => renderRules({ render }));

// ============================================================
// INIT
// ============================================================

// Load theme before first render to avoid flash.
loadTheme();
applyTheme();
onThemeChange(render);
bindThemeToggle({ saveTheme });

render();
