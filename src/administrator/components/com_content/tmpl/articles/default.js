import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { selectAllCell, selectionCell } from '../../../com_minijoomla/extension-pages.js';
import { renderArticleIndicator } from '../../../com_minijoomla/render-list.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const dateText = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR') : '';
};

export function renderArticlesTable(result, { link, params = {}, now = new Date() } = {}) {
  if (!result.rows.length) return '<p class="admin-empty" role="status">Nenhum artigo encontrado.</p>';

  const sort = params.sort || 'id';
  const dir = params.dir || (sort === 'id' ? 'desc' : 'asc');
  const sortLink = (key, label) => {
    const active = sort === key;
    const next = active && dir === 'asc' ? 'desc' : 'asc';
    return `<a href="${esc(link('/articles', { ...params, sort: key, dir: next, page: undefined }))}">${esc(label)}${active ? ` <span aria-hidden="true">${dir === 'asc' ? '▲' : '▼'}</span>` : ''}</a>`;
  };
  const header = (key, label, extraKey, extraLabel) => {
    const active = sort === key || sort === extraKey;
    return `<th scope="col"${active ? ` aria-sort="${dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>${sortLink(key, label)}${extraKey ? ` · ${sortLink(extraKey, extraLabel)}` : ''}</th>`;
  };
  const rows = result.rows.map((row) => {
    const title = String(row.title ?? '').trim() || `Artigo ${row.id}`;
    const stateButton = row.state === 'Trashed'
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="restore" data-ext-id="${esc(row.id)}" aria-label="Restaurar ${esc(title)}">Restaurar</button>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-state" data-ext-id="${esc(row.id)}" aria-label="${(row.state ?? 'Published') === 'Published' ? 'Despublicar' : 'Publicar'} ${esc(title)}">${renderArticleIndicator(row, 'state', now)}</button>`;
    const featuredButton = `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-featured" data-ext-id="${esc(row.id)}" aria-label="${row.featured ? 'Remover destaque de' : 'Destacar'} ${esc(title)}">${renderArticleIndicator(row, 'featured', now)}</button>`;
    return `<tr>${selectionCell(row.id, title)}<td>${featuredButton}</td><td>${stateButton}</td><th scope="row" class="admin-col-title"><a href="${esc(link(`/articles/${row.id}`))}" aria-label="${esc(`Editar: ${title}`)}">${esc(title)}</a><div class="admin-list-note">Alias: ${esc(row.alias)}</div>${row.note ? `<div class="admin-list-note">Nota: ${esc(row.note)}</div>` : ''}<div class="admin-list-note">Categoria: ${esc(row.categoryTitle)}</div></th><td class="admin-col-nowrap">${esc(row.author)}${row.authorAlias ? `<div class="admin-list-note">Alias: ${esc(row.authorAlias)}</div>` : ''}</td><td class="admin-col-nowrap">${esc(dateText(row.publishUp))}</td><td class="admin-col-nowrap">${esc(row.id)}</td></tr>`;
  }).join('');
  return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Artigos — ${esc(result.total)} encontrado(s)</caption><thead><tr>${selectAllCell}${header('featured', 'Destaque')}${header('state', 'Estado')}${header('title', 'Título', 'category', 'Categoria')}${header('author', 'Autor')}${header('publishUp', 'Data')}${header('id', 'ID')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
