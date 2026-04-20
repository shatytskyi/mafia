// Fullscreen toggle for the floating header button.
// Works on Android/desktop browsers; iOS Safari does not support
// Element.requestFullscreen on arbitrary elements, so we hide the button there.

const ENTER_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 4V1h3M13 4V1h-3M1 10v3h3M13 10v3h-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="square"/></svg>';
const EXIT_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 1v3H1M9 1v3h4M5 13v-3H1M9 13v-3h4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="square"/></svg>';

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function requestFs() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) return req.call(el);
  return Promise.reject(new Error('Fullscreen API not supported'));
}

function exitFs() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit) return exit.call(document);
  return Promise.reject(new Error('Fullscreen API not supported'));
}

function updateIcon(btn) {
  btn.innerHTML = isFullscreen() ? EXIT_SVG : ENTER_SVG;
  const svg = btn.querySelector('svg');
  if (svg) svg.id = 'fullscreenIcon';
}

export function bindFullscreenToggle() {
  const btn = document.getElementById('fullscreenToggle');
  if (!btn) return;

  // Hide if the API is unavailable (e.g. iOS Safari) — no use showing a dead button.
  const supported = Boolean(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen
  );
  if (!supported) {
    btn.style.display = 'none';
    return;
  }

  btn.onclick = () => {
    if (isFullscreen()) {
      exitFs().catch(() => {});
    } else {
      requestFs().catch(() => {});
    }
  };

  const onChange = () => updateIcon(btn);
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  updateIcon(btn);
}
