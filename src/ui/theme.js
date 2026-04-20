import { state } from '../state/state.js';

let onChange = null;

/**
 * @param {() => void} cb - invoked after state.theme changes (e.g. render)
 */
export function onThemeChange(cb) { onChange = cb; }

// Keep system UI (status bar in standalone PWA, Android Chrome tab bar)
// in sync with the active theme. Light value is slightly darker than --bg
// (#f2ead5) because the page sits under a grain + vignette overlay that
// visibly tints the rendered top edge; matching --bg exactly would make
// the status bar look lighter than the actual page background.
const THEME_COLORS = { light: '#f4efe7', dark: '#0e0b0a' };

function syncThemeColorMeta() {
  const meta = document.getElementById('themeColorMeta');
  if (meta) meta.setAttribute('content', THEME_COLORS[state.theme] || THEME_COLORS.dark);
}

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme === 'dark' ? 'dark' : 'light');
  syncThemeColorMeta();
}

/**
 * @param {{saveTheme: () => void}} persistence
 */
export function bindThemeToggle(persistence) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.onclick = () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    persistence.saveTheme();
    if (onChange) onChange();
  };
}

export function updateThemeIcon() {
  const icon = document.getElementById('themeIcon');
  // ◐/◑ are half-moons used as neutral theme toggle — show the *opposite*
  // of the current theme to communicate what tapping will do. Keeping them
  // off the ☾/☀ phase-badge set avoids ambiguity with host night/day screens.
  if (icon) icon.textContent = state.theme === 'light' ? '◐' : '◑';
}
