import { state } from '../state/state.js';
import { updateThemeIcon } from './theme.js';

let _lastScreen = null;
let _lastDealKey = null;

const screens = {};

/**
 * @param {string} name
 * @param {() => void} fn
 */
export function registerScreen(name, fn) { screens[name] = fn; }

/**
 * @param {{ beforeRender?: () => void, afterRender?: () => void }} hooks
 */
export function createRender({ beforeRender, afterRender }) {
  function render() {
    const app = document.getElementById('app');
    const screenChanged = _lastScreen !== state.screen;
    const dealKey = state.screen === 'deal' ? `${state.dealIndex}:${state.dealPhase}` : null;
    const dealChanged = dealKey !== null && _lastDealKey !== dealKey;

    app.innerHTML = '';
    const fn = screens[state.screen];
    if (fn) fn();
    updateThemeIcon();

    if (screenChanged || dealChanged) {
      _lastScreen = state.screen;
      _lastDealKey = dealKey;
      const firstChild = app.firstElementChild;
      if (firstChild) firstChild.classList.add('screen-enter');
      if (screenChanged) window.scrollTo(0, 0);
    }

    if (beforeRender) beforeRender();
    if (afterRender) afterRender();
  }
  return render;
}
