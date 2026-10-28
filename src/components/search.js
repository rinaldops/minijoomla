import { escapeHtml } from '../security/sanitize.js';
import { renderArticleList } from './content.js';

export function renderSearch(query, result, { link = (page) => `#/search?q=${encodeURIComponent(query)}&page=${page}` } = {}) {
  const term = escapeHtml(query || '');
  return `<section class="search-page"><p class="eyebrow">Busca</p><h1>Buscar conteúdo</h1><form method="get" action="#/search" role="search"><label for="search-term">Termo</label><input id="search-term" name="q" value="${term}" maxlength="120" autocomplete="off"><button type="submit">Buscar</button></form><h2 aria-live="polite">Resultados para “${term}”</h2>${renderArticleList(result, { link })}</section>`;
}
