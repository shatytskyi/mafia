/**
 * Escape a value for safe insertion into HTML.
 * Handles null/undefined by returning an empty string.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function escapeHtml(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tagged template that auto-escapes all interpolations:
 *
 *   html`<div>${name}</div>`
 *
 * Use for any user-controlled string. Wrap trusted raw HTML in `rawHtml`.
 *
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {string}
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out += (v && typeof v === 'object' && v.__raw) ? v.__raw : escapeHtml(v);
    out += strings[i + 1];
  }
  return out;
}

/**
 * Marks a string as pre-sanitised HTML so `html` does not re-escape.
 * @param {string} s
 * @returns {{__raw: string}}
 */
export function rawHtml(s) {
  return { __raw: s == null ? '' : String(s) };
}
