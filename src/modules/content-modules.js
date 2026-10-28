import { escapeHtml } from '../security/sanitize.js';

function stateMessage(state, message) {
  if (state === 'loading') return '<p class="module-loading" role="status" aria-live="polite" aria-atomic="true">Carregando…</p>';
  if (state === 'error') return `<p class="module-error" role="alert">${escapeHtml(message || 'Não foi possível carregar o módulo.')}</p>`;
  return '';
}

export const articlesLatestModule = {
  name: 'articles-latest', settingsSchema: { limit: 'number' },
  settings: { position: 'sidebar', limit: 5, state: 'ready' },
  render({ state = 'ready', articles = [], message } = {}) {
    const status = stateMessage(state, message); if (status) return status;
    if (!articles.length) return '<p class="module-empty" role="status">Nenhum artigo recente.</p>';
    return `<section class="module module-articles-latest"><h2>Artigos recentes</h2><ul>${articles.map((article) => `<li><a href="#/article/${encodeURIComponent(article.alias)}">${escapeHtml(article.title)}</a></li>`).join('')}</ul></section>`;
  }
};

export const articlesCategoryModule = {
  name: 'articles-category', settingsSchema: { limit: 'number', category: 'string' },
  settings: { position: 'content', limit: 5, state: 'ready' },
  render({ state = 'ready', items = [], message } = {}) {
    const status = stateMessage(state, message); if (status) return status;
    if (!items.length) return '<p class="module-empty" role="status">Nenhum artigo nesta categoria.</p>';
    return `<section class="module module-articles-category"><ul>${items.map((article) => `<li><a href="#/article/${encodeURIComponent(article.alias)}">${escapeHtml(article.title)}</a></li>`).join('')}</ul></section>`;
  }
};

export const tagsPopularModule = {
  name: 'tags-popular', settingsSchema: {},
  settings: { position: 'sidebar', state: 'ready' },
  render({ state = 'ready', tags = [], message } = {}) {
    const status = stateMessage(state, message); if (status) return status;
    if (!tags.length) return '<p class="module-empty" role="status">Nenhuma tag disponível.</p>';
    return `<section class="module module-tags-popular"><h2>Tags</h2><ul>${tags.map((tag) => { const name = typeof tag === 'string' ? tag : tag.name; const count = typeof tag === 'string' ? '' : ` (${tag.count})`; return `<li><a href="#/search?q=${encodeURIComponent(name)}">${escapeHtml(name)}${count}</a></li>`; }).join('')}</ul></section>`;
  }
};
