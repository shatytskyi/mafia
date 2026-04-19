import { state } from '../state/state.js';

let onChange = null;

/**
 * @param {() => void} cb - invoked after state.theme changes (e.g. render)
 */
export function onThemeChange(cb) { onChange = cb; }

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme === 'dark' ? 'dark' : 'light');
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
  if (icon) icon.textContent = state.theme === 'light' ? '☾' : '☀';
}
