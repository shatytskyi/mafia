import { state } from '../../state/state.js';
import { t, tRaw } from '../../i18n/index.js';

export function renderRules({ render }) {
  const app = document.getElementById('app');
  const sections = tRaw('rules.sections') || {};
  const sectionHtml = Object.keys(sections)
    .map(key => `<h3>${sections[key].h}</h3>${sections[key].body}`)
    .join('\n');

  // Rules use <h3> from i18n for section headers. Map them to .rules-screen h2
  // by keeping the raw HTML and relying on the wrapper-scoped selector below.
  app.innerHTML = `
    <div class="screen rules-screen">
      <div class="home-header a-fade-up">
        <div class="ornament"><span>${t('rules.ornament')}</span></div>
        <div class="hero-wrap">
          <h1 class="hero a-ink-sweep" style="font-size: clamp(48px, 14vw, 64px);">${t('rules.title')}<em>${t('rules.titleEm')}</em></h1>
        </div>
      </div>

      <div class="rules-content rules-body">
        ${sectionHtml}
      </div>

      <div style="height: 32px;"></div>
      <button class="btn-primary" id="backFromRules">${t('common.backToMenu')}</button>
    </div>
  `;

  document.getElementById('backFromRules').onclick = () => {
    state.screen = 'home';
    render();
  };
}
