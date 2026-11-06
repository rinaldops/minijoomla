import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { heading, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';

export function renderDefault({ state = 'ready', tags = [], message, link = (path, params) => `#${path}?q=${encodeURIComponent(params?.q ?? '')}`, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const entries = Array.isArray(tags) ? tags : [];
  if (!entries.length) return '<p class="module-empty" role="status">Nenhuma tag disponível.</p>';
  return `<section class="module module-tags-popular">${heading('Tags', chrome)}<ul>${entries.map((tag) => { const name = typeof tag === 'string' ? tag : tag.name; const count = typeof tag === 'string' ? '' : ` (${tag.count})`; return `<li><a href="${escapeHtml(link('/search', { q: name }))}">${escapeHtml(name)}${count}</a></li>`; }).join('')}</ul></section>`;
}
