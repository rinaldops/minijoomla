import { escapeHtml, safeUrl, sanitizeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';
import { renderArticleList, renderEmptyResult, renderPagination } from '../article/default.js';
import { renderBlog } from './blog.js';

const COLUMNS = [['title', 'Título'], ['publishUp', 'Data de publicação'], ['author', 'Autor']];

function renderSubcategories(children = [], categoryLink) {
  if (!children.length || !categoryLink) return '';
  return `<div class="cat-children"><h2>Subcategorias</h2><ul>${children.map(({ category, count }) => `<li><a href="${escapeHtml(categoryLink(category.alias))}">${escapeHtml(category.title)}</a>${count === undefined ? '' : ` <span class="badge" title="Artigos">${Number(count)}</span>`}</li>`).join('')}</ul></div>`;
}

// tmpl/category/default.php: table sortable by links, filtered by title.
function renderTable(vm, { listLink, timezone = 'America/Sao_Paulo', articleLink, sort = 'publishUp', direction = 'desc', filter = '', route }) {
  const form = `<form class="filter-form" data-mj-route="${escapeHtml(route)}" aria-label="Filtrar artigos"><input type="hidden" name="layout" value="list"><label for="filter-search">Filtrar por título</label><input id="filter-search" name="filter" value="${escapeHtml(filter)}" maxlength="120" autocomplete="off"><button type="submit">Filtrar</button></form>`;
  if (!vm.items?.length) return `${form}${renderEmptyResult(vm, (page) => listLink({ page }))}`;
  const head = COLUMNS.map(([key, label]) => {
    const active = sort === key;
    const next = active && direction === 'asc' ? 'desc' : 'asc';
    return `<th scope="col"${active ? ` aria-sort="${direction === 'asc' ? 'ascending' : 'descending'}"` : ''}><a href="${escapeHtml(listLink({ sort: key, dir: next }))}">${label}</a></th>`;
  }).join('');
  const date = (value) => { const parsed = new Date(value); if (!value || Number.isNaN(parsed.getTime())) return ''; try { return parsed.toLocaleDateString('pt-BR', { timeZone: timezone }); } catch { return parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); } };
  const rows = vm.items.map((article) => `<tr><td><a href="${escapeHtml(articleLink(article.alias))}">${escapeHtml(article.title)}</a></td><td>${escapeHtml(date(article.publishUp))}</td><td>${escapeHtml(String(article.authorAlias ?? '').trim() || article.author || '')}</td></tr>`).join('');
  return `${form}<table class="category-table"><caption class="visually-hidden">Artigos da categoria</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>${renderPagination(vm, (page) => listLink({ page }))}`;
}

export function renderCategory(viewModel = {}, options = {}) {
  const { layout = 'blog', children, categoryLink, ...rest } = options;
  const category = viewModel.category ?? {};
  const image = category.image ? safeUrl(String(category.image)) : '#';
  const description = category.description ? `<div class="category-desc">${image === '#' ? '' : `<img src="${image}" alt="${escapeHtml(category.imageAlt ?? '')}" loading="lazy">`}${sanitizeHtml(category.description)}</div>` : '';
  const items = layout === 'list' ? renderTable(viewModel, rest)
    : layout === 'blog' ? renderBlog(viewModel, rest) : renderArticleList(viewModel, rest);
  return `<section class="category-page"><p class="eyebrow">Categoria</p><h1>${escapeHtml(category.title)}</h1>${description}${renderSubcategories(children, categoryLink)}${items}</section>`;
}
