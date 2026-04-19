import { state } from '../../state/state.js';
import { t, tRaw } from '../../i18n/index.js';

export function renderRules({ render }) {
  const app = document.getElementById('app');
  const sections = tRaw('rules.sections') || {};
  const sectionHtml = Object.keys(sections)
    .map(key => `<h3>${sections[key].h}</h3>${sections[key].body}`)
    .join('\n');

  app.innerHTML = `
    <div class="screen">
      <div class="home-header">
        <div class="ornament"><span>${t('rules.ornament')}</span></div>
        <div class="hero-wrap">
          <h1 class="hero" style="font-size: 48px;">${t('rules.title')}<em>${t('rules.titleEm')}</em></h1>
        </div>
      </div>

      <div class="rules-content">
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
