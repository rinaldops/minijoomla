import { escapeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';

function renderNodes(nodes, categoryLink) {
  return `<ul>${nodes.map(({ category, count, children = [] }) => `<li><a href="${escapeHtml(categoryLink(category.alias))}">${escapeHtml(category.title)}</a> <span class="badge" title="Artigos">${Number(count) || 0}</span>${children.length ? renderNodes(children, categoryLink) : ''}</li>`).join('')}</ul>`;
}

// tmpl/categories: nested list with article counts.
export function renderCategories(tree = [], { categoryLink = (alias) => `#/category/${encodeURIComponent(alias)}` } = {}) {
  return `<section class="categories-page"><p class="eyebrow">Categorias</p><h1>Todas as categorias</h1>${tree.length ? `<div class="categories-list">${renderNodes(tree, categoryLink)}</div>` : '<p class="empty-state" role="status">Nenhuma categoria encontrada.</p>'}</section>`;
}
