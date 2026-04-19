// Tiny footer showing the currently deployed commit SHA + date.
// Repo coords are derived from `location` so the committed code has no hardcoded username.

export function initVersionFooter() {
  const el = document.createElement('div');
  el.className = 'version-footer';
  el.textContent = '';
  document.body.appendChild(el);

  const host = location.hostname;
  const firstPathSegment = location.pathname.split('/').filter(Boolean)[0];
  const pagesMatch = /^([^.]+)\.github\.io$/.exec(host);
  if (!pagesMatch || !firstPathSegment) {
    el.textContent = 'dev';
    return;
  }

  const owner = pagesMatch[1];
  const repo = firstPathSegment;
  const api = `https://api.github.com/repos/${owner}/${repo}/commits/main`;

  fetch(api, { headers: { 'Accept': 'application/vnd.github+json' } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(data => {
      const sha = (data.sha || '').slice(0, 7);
      const iso = data.commit?.author?.date;
      const d = iso ? new Date(iso) : null;
      const dd = d
        ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
        : '';
      el.textContent = sha && dd ? `${sha} · ${dd}` : (sha || '—');
    })
    .catch(() => { el.textContent = '—'; });
}
