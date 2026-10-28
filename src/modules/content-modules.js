import { escapeHtml } from '../security/sanitize.js';

function stateMessage(state, message) {
  if (state === 'loading') return '<p class="module-loading" aria-live="polite">Carregando…</p>';
  if (state === 'error') return `<p class="module-error" role="alert">${escapeHtml(message || 'Não foi possível carregar o módulo.')}</p>`;
  return '';
}

export const articlesLatestModule = {
  settings: { position: 'sidebar', limit: 5, state: 'ready' },
  render({ state = 'ready', articles = [], message } = {}) {
    const status = stateMessage(state, message); if (status) return status;
    if (!articles.length) return '<p class="module-empty">Nenhum artigo recente.</p>';
    return `<section class="module module-articles-latest"><h2>Artigos recentes</h2><ul>${articles.map((article) => `<li><a href="#/article/${encodeURIComponent(article.alias)}">${escapeHtml(article.title)}</a></li>`).join('')}</ul></section>`;
  }
};

export const articlesCategoryModule = {
  settings: { position: 'content', limit: 5, state: 'ready' },
  render({ state = 'ready', items = [], message } = {}) {
    const status = stateMessage(state, message); if (status) return status;
    if (!items.length) return '<p class="module-empty">Nenhum artigo nesta categoria.</p>';
    return `<section class="module module-articles-category"><ul>${items.map((article) => `<li><a href="#/article/${encodeURIComponent(article.alias)}">${escapeHtml(article.title)}</a></li>`).join('')}</ul></section>`;
  }
};

export const tagsPopularModule = {
  settings: { position: 'sidebar', state: 'ready' },
  render({ state = 'ready', tags = [], message } = {}) {
    const status = stateMessage(state, message); if (status) return status;
    if (!tags.length) return '<p class="module-empty">Nenhuma tag disponível.</p>';
    return `<section class="module module-tags-popular"><h2>Tags</h2><ul>${tags.map((tag) => `<li><a href="#/search?q=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a></li>`).join('')}</ul></section>`;
  }
};
