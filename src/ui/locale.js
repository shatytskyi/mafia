import { getLocale, setLocale, LOCALES } from '../i18n/index.js';

let onChange = null;

/**
 * @param {() => void} cb - invoked after the locale changes (e.g. render)
 */
export function onLocaleToggle(cb) { onChange = cb; }

export function updateLocaleToggle() {
  const current = getLocale();
  document.querySelectorAll('.locale-btn[data-locale]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.locale === current);
  });
}

/**
 * @param {{saveLocale: (locale: string) => void}} persistence
 */
export function bindLocaleToggle(persistence) {
  const container = document.getElementById('localeToggle');
  if (!container) return;
  container.querySelectorAll('.locale-btn[data-locale]').forEach(btn => {
    btn.onclick = () => {
      const next = btn.dataset.locale;
      if (!LOCALES[next]) return;
      if (getLocale() === next) return;
      setLocale(next);
      persistence.saveLocale(next);
      updateLocaleToggle();
      if (onChange) onChange();
    };
  });
  updateLocaleToggle();
}
