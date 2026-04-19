// Progressive Web App bootstrap: register the service worker and surface
// a dismissable install banner at the top of the page.
//
// Platform notes:
// - Chrome / Edge / Android fire `beforeinstallprompt`; we stash the event
//   and invoke `prompt()` when the user taps our button.
// - iOS Safari never fires it — show a manual "Add to Home Screen" hint instead.
// - If the app is already running standalone (from the home screen), we do
//   nothing.

import { t } from '../i18n/index.js';

const DISMISS_STORAGE_KEY = 'mafia.installDismissedAt';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

let deferredPrompt = null;

export function initPwa() {
  registerServiceWorker();
  if (isStandalone()) return;
  setupInstallBanner();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Resolve relative to the current page so subpath hosting (e.g. /Mafia/)
  // keeps working without hardcoding paths.
  const swUrl = new URL('./sw.js', document.baseURI).toString();
  const scope = new URL('./', document.baseURI).toString();
  // Register after the load event to avoid competing with first paint.
  const go = () => navigator.serviceWorker.register(swUrl, { scope }).catch(() => {});
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  if (mql && mql.matches) return true;
  // iOS Safari legacy flag.
  return window.navigator.standalone === true;
}

function isIosSafari() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isAppleDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isAppleDevice && isSafari;
}

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch { /* storage disabled — banner will reappear, acceptable */ }
}

function setupInstallBanner() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (wasRecentlyDismissed()) return;
    showBanner('prompt');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markDismissed();
    hideBanner();
  });

  if (isIosSafari() && !wasRecentlyDismissed()) {
    // Delay slightly so the banner doesn't flash during the initial render.
    setTimeout(() => {
      if (!isStandalone()) showBanner('ios');
    }, 800);
  }
}

function showBanner(mode) {
  let el = document.getElementById('installBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'installBanner';
    el.className = 'install-banner';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', t('install.title'));
    document.body.appendChild(el);
  }

  const title = t('install.title');
  const body = mode === 'ios' ? t('install.iosHint') : t('install.promptBody');
  const action = mode === 'ios'
    ? ''
    : `<button class="install-btn" id="installBtnAccept" type="button">${t('install.accept')}</button>`;

  el.innerHTML = `
    <div class="install-content">
      <div class="install-text">
        <div class="install-title">${title}</div>
        <div class="install-desc">${body}</div>
      </div>
      <div class="install-actions">
        ${action}
        <button class="install-dismiss" id="installBtnDismiss" type="button" aria-label="${t('install.dismissAria')}">✕</button>
      </div>
    </div>
  `;

  requestAnimationFrame(() => el.classList.add('visible'));

  const accept = document.getElementById('installBtnAccept');
  if (accept) {
    accept.onclick = async () => {
      const prompt = deferredPrompt;
      if (!prompt) { hideBanner(); return; }
      deferredPrompt = null;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome !== 'accepted') markDismissed();
      } catch { /* user dismissed native dialog — ignore */ }
      hideBanner();
    };
  }

  const dismiss = document.getElementById('installBtnDismiss');
  if (dismiss) {
    dismiss.onclick = () => {
      markDismissed();
      hideBanner();
    };
  }
}

function hideBanner() {
  const el = document.getElementById('installBanner');
  if (!el) return;
  el.classList.remove('visible');
  // Wait for the slide-out transition before removing.
  setTimeout(() => el.remove(), 250);
}
