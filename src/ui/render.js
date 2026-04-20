import { state } from '../state/state.js';
import { updateThemeIcon } from './theme.js';

let _lastScreen = null;
let _lastAnimKey = null;

const screens = {};

/**
 * Register a screen renderer. A screen may be either a plain function
 * (always does a full re-render) or an object `{ mount, update }` where
 * `mount(ctx)` builds the initial DOM and `update(ctx)` is called on
 * subsequent re-renders while the screen is still active — letting the
 * screen patch only the parts that changed instead of rebuilding the
 * entire subtree. `ctx` carries `{ animKeyChanged, screenChanged }`.
 *
 * @param {string} name
 * @param {(() => void) | { mount: (ctx: RenderCtx) => void, update: (ctx: RenderCtx) => void }} def
 */
export function registerScreen(name, def) { screens[name] = def; }

/**
 * @typedef {{ animKeyChanged: boolean, screenChanged: boolean }} RenderCtx
 */

/**
 * Derive a key that marks "structurally new UI" — entry animations (fade-up,
 * stagger, ink-sweep, card-reveal) should play only when this changes. Taps
 * that only flip a selection within the same screen (toggling a role,
 * picking a target) keep the same key so the animations stay quiet.
 * See CH-03 in docs/design-system.md / Mafia Redesign A §07.
 * @param {import('../types.js').AppState} s
 * @returns {string}
 */
function computeAnimKey(s) {
  if (s.screen === 'host') return `host:${s.phase}:${s.stepIndex}:${s.day}`;
  if (s.screen === 'deal') return `deal:${s.dealIndex}:${s.dealPhase}`;
  return s.screen;
}

/**
 * @param {{ beforeRender?: () => void, afterRender?: () => void }} hooks
 */
export function createRender({ beforeRender, afterRender }) {
  function render() {
    const app = document.getElementById('app');
    const screenChanged = _lastScreen !== state.screen;
    const animKey = computeAnimKey(state);
    const animKeyChanged = _lastAnimKey !== animKey;
    const screenDef = screens[state.screen];
    const ctx = { animKeyChanged, screenChanged };

    // Partial re-render path: screen is unchanged and owner provides update().
    // Owner is responsible for patching only the parts that need to change.
    const canPartial =
      !screenChanged &&
      screenDef && typeof screenDef === 'object' &&
      typeof screenDef.update === 'function';

    if (canPartial) {
      screenDef.update(ctx);
    } else {
      app.innerHTML = '';
      const mountFn =
        typeof screenDef === 'function' ? screenDef :
        (screenDef && screenDef.mount);
      if (mountFn) mountFn(ctx);
      // CH-03 · scope entry animations to "fresh" mounts. On full mount,
      // the freshly inserted root gets .screen-enter so animations play.
      if (animKeyChanged) {
        const firstChild = app.firstElementChild;
        if (firstChild) firstChild.classList.add('screen-enter');
      }
    }
    updateThemeIcon();

    if (animKeyChanged) _lastAnimKey = animKey;
    if (screenChanged) {
      _lastScreen = state.screen;
      window.scrollTo(0, 0);
    }

    if (beforeRender) beforeRender();
    if (afterRender) afterRender();
  }
  return render;
}
