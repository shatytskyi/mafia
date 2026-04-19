// Semantic version shown at the very bottom of the page.
// Bump in lockstep with package.json: PATCH = fix, MINOR = feature, MAJOR = breaking.
export const APP_VERSION = '1.10.7';

export function initVersionFooter() {
  const el = document.createElement('div');
  el.className = 'version-footer';
  el.textContent = `v${APP_VERSION}`;
  document.body.appendChild(el);
}
