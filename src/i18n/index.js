// Lightweight i18n engine. Lookups dot-path keys in the active locale's dict
// with fallback to the default locale and {placeholder} interpolation.

import { ru } from './ru.js';
import { uk } from './uk.js';
import { en } from './en.js';

export const LOCALES = { ru: 'Русский', uk: 'Українська', en: 'English' };
export const DEFAULT_LOCALE = 'ru';

const DICTS = { ru, uk, en };

let currentLocale = DEFAULT_LOCALE;
const listeners = [];

function resolve(dict, path) {
  const parts = path.split('.');
  let node = dict;
  for (const p of parts) {
    if (node == null) return undefined;
    node = node[p];
  }
  return node;
}

function interpolate(template, params) {
  if (typeof template !== 'string') return template;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

/**
 * Translate a dot-path key. Returns the string from the active locale, falling
 * back to the default locale, and finally the key itself (makes missing keys
 * visible during development). Supports {placeholder} params.
 *
 * @param {string} key
 * @param {Record<string, any>} [params]
 * @returns {string}
 */
export function t(key, params) {
  let val = resolve(DICTS[currentLocale], key);
  if (val == null) val = resolve(DICTS[DEFAULT_LOCALE], key);
  if (val == null) return key;
  if (typeof val === 'function') val = val(params || {});
  return interpolate(val, params);
}

/**
 * Get raw (non-interpolated) node — useful when the value is an object, array,
 * or needs custom handling.
 *
 * @param {string} key
 */
export function tRaw(key) {
  const val = resolve(DICTS[currentLocale], key);
  if (val != null) return val;
  return resolve(DICTS[DEFAULT_LOCALE], key);
}

export function getLocale() { return currentLocale; }

export function setLocale(locale) {
  if (!DICTS[locale]) return;
  if (currentLocale === locale) return;
  currentLocale = locale;
  for (const cb of listeners) cb(locale);
}

export function onLocaleChange(cb) { listeners.push(cb); }

/**
 * Detect the user's preferred locale from the browser. Maps Ukrainian and
 * Russian to their dicts; everything else falls back to English.
 *
 * @returns {'ru'|'uk'|'en'}
 */
export function detectLocale() {
  const candidates = [];
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
    if (navigator.language) candidates.push(navigator.language);
  }
  for (const raw of candidates) {
    if (!raw) continue;
    const code = String(raw).toLowerCase().split('-')[0];
    if (code === 'uk') return 'uk';
    if (code === 'ru') return 'ru';
    if (code === 'en') return 'en';
  }
  return 'en';
}
