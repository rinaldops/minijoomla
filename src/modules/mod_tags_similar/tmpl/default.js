import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { heading, limited, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';

export function renderDefault({ state = 'ready', similarArticles = [], settings, message, link = (path) => `#${path}`, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const items = limited(similarArticles, settings, 5);
  if (!items.length) return '<p class="module-empty" role="status">Nenhum artigo relacionado.</p>';
  return `<section class="module module-tags-similar">${heading('Artigos relacionados', chrome)}<ul>${items.map((article) => `<li><a href="${escapeHtml(link(`/article/${encodeURIComponent(article.alias)}`))}">${escapeHtml(article.title)}</a></li>`).join('')}</ul></section>`;
}
