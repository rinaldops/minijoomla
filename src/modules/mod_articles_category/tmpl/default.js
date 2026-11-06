import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { limited, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';

export function renderDefault({ state = 'ready', items = [], settings, message, link = (path) => `#${path}` } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const entries = limited(items, settings, 5);
  if (!entries.length) return '<p class="module-empty" role="status">Nenhum artigo nesta categoria.</p>';
  return `<section class="module module-articles-category"><ul>${entries.map((article) => `<li><a href="${escapeHtml(link(`/article/${encodeURIComponent(article.alias)}`))}">${escapeHtml(article.title)}</a></li>`).join('')}</ul></section>`;
}
