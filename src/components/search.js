import { escapeHtml } from '../security/sanitize.js';
import { renderArticleList } from './content.js';

export function renderSearch(query, result, { link = (page) => `#/search?q=${encodeURIComponent(query)}&page=${page}` } = {}) {
  const term = escapeHtml(query || '');
  const heading = result?.emptyQuery ? 'Digite um termo para iniciar a busca.' : `${result?.total ?? 0} resultado(s) para “${term}”`;
  return `<section class="search-page"><p class="eyebrow">Busca</p><h1>Buscar conteúdo</h1><form method="get" action="#/search" role="search"><label for="search-term">Termo</label><input id="search-term" name="q" value="${term}" maxlength="120" autocomplete="off"><button type="submit">Buscar</button></form><h2 aria-live="polite">${heading}</h2>${result?.emptyQuery ? '<p class="empty-state">Informe uma palavra ou expressão.</p>' : renderArticleList(result, { link })}</section>`;
}
