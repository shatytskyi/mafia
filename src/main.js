import { state } from './state/state.js';
import {
  createPersistence, buildSnapshot, applySnapshotToState
} from './state/persistence.js';
import { createRender, registerScreen } from './ui/render.js';
import { applyTheme, bindThemeToggle, onThemeChange } from './ui/theme.js';
import { bindLocaleToggle, onLocaleToggle } from './ui/locale.js';
import { bindFullscreenToggle } from './ui/fullscreen.js';
import { initPwa } from './ui/pwa.js';
import { setLocale, detectLocale } from './i18n/index.js';
import { initVersionFooter } from './ui/version.js';
import { renderHome } from './ui/screens/home.js';
import { renderNames } from './ui/screens/names.js';
import { renderDeal } from './ui/screens/deal.js';
import { renderHost } from './ui/screens/host.js';
import { renderGameOver } from './ui/screens/gameover.js';
import { renderRules } from './ui/screens/rules.js';

const persistence = createPersistence();

function saveTheme() { persistence.saveTheme(state.theme); }
function loadTheme() {
  const t = persistence.loadTheme();
  if (t) state.theme = t;
}

function loadLocale() {
  const saved = persistence.loadLocale();
  setLocale(saved || detectLocale());
}
function saveLocale(locale) { persistence.saveLocale(locale); }

let _saveTimer = null;
function saveGame() {
  if (state.screen !== 'host') return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => persistence.saveSnapshot(buildSnapshot(state)), 300);
}
function loadGame() { return persistence.loadSnapshot(); }
function clearSavedGame() { persistence.clearSnapshot(); }
function restoreGame(data) { applySnapshotToState(state, data); }

const render = createRender({
  beforeRender: saveGame
});

registerScreen('home',     () => renderHome({ render, loadGame, clearSavedGame, restoreGame }));
registerScreen('names',    () => renderNames({ render }));
registerScreen('deal',     () => renderDeal({ render }));
registerScreen('host',     () => renderHost({ render, clearSavedGame }));
registerScreen('gameover', () => renderGameOver({ render, clearSavedGame }));
registerScreen('rules',    () => renderRules({ render }));

loadTheme();
loadLocale();
applyTheme();
onThemeChange(render);
onLocaleToggle(render);
bindThemeToggle({ saveTheme });
bindLocaleToggle({ saveLocale });
bindFullscreenToggle();
initVersionFooter();
initPwa();
render();
