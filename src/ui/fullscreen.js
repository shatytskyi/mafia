// Fullscreen toggle for the floating header button.
// Works on Android/desktop browsers; iOS Safari does not support
// Element.requestFullscreen on arbitrary elements, so we hide the button there.

const ENTER_ICON = '⛶';
const EXIT_ICON = '✕';

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
  const icon = btn.querySelector('#fullscreenIcon');
  if (icon) icon.textContent = isFullscreen() ? EXIT_ICON : ENTER_ICON;
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
