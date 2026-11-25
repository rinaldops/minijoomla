import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { selectAllCell, selectionCell, columnFilterSelect } from '../../../com_minijoomla/extension-pages.js';
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
  const facets = result.facets ?? {};
    /*
     * Cabeçalho com dois níveis: o título ordenável e, abaixo, o dropdown de
     * autofiltro daquela coluna. O dropdown lê `result.facets.*`, que o
     * serviço calcula sobre o conjunto COMPLETO — assim a lista de opções não
     * encolhe conforme a página atual nem conforme os demais filtros.
     */
    const header = (key, label, filter) => {
    const active = sort === key;
      const filterHtml = filter ? columnFilterSelect('admin-articles-col', { ...filter, selected: params[filter.name] }) : '';
      return `<th scope="col"${active ? ` aria-sort="${dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>${sortLink(key, label)}${filterHtml}</th>`;
  };
  const rows = result.rows.map((row) => {
    const title = String(row.title ?? '').trim() || `Artigo ${row.id}`;
    const stateButton = row.state === 'Trashed'
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="restore" data-ext-id="${esc(row.id)}" aria-label="Restaurar ${esc(title)}">Restaurar</button>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-state" data-ext-id="${esc(row.id)}" aria-label="${(row.state ?? 'Published') === 'Published' ? 'Despublicar' : 'Publicar'} ${esc(title)}">${renderArticleIndicator(row, 'state', now)}</button>`;
    const featuredButton = `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-featured" data-ext-id="${esc(row.id)}" aria-label="${row.featured ? 'Remover destaque de' : 'Destacar'} ${esc(title)}">${renderArticleIndicator(row, 'featured', now)}</button>`;
    // Título, Alias e Categoria em colunas PRÓPRIAS: cada uma tem cabeçalho
    // ordenável e filtro por coluna. Antes as três dividiam uma única célula
    // (`admin-col-title` com notas), o que tornava impossível filtrar por uma
    // delas sem afetar as outras.
    return `<tr>${selectionCell(row.id, title)}<td>${featuredButton}</td><td>${stateButton}</td><th scope="row" class="admin-col-title"><a href="${esc(link(`/articles/${row.id}`, params))}" aria-label="${esc(`Editar: ${title}`)}">${esc(title)}</a>${row.note ? `<div class="admin-list-note">Nota: ${esc(row.note)}</div>` : ''}</th><td class="admin-col-alias" data-col="alias">${esc(row.alias)}</td><td class="admin-col-category" data-col="category"${row.categoryId !== undefined && row.categoryId !== null ? ` data-category-id="${esc(row.categoryId)}"` : ''}>${esc(row.categoryTitle)}</td><td class="admin-col-nowrap">${esc(row.author)}${row.authorAlias ? `<div class="admin-list-note">Alias: ${esc(row.authorAlias)}</div>` : ''}</td><td class="admin-col-nowrap">${esc(dateText(row.publishUp))}</td><td class="admin-col-nowrap">${esc(row.id)}</td></tr>`;
  }).join('');
  /*
   * Os dropdowns são ligados pelo app via `change`; o <form> oculto existe
   * apenas para agrupar os controles e suportar Enter/teclado.
   */
  return `<form data-ext-column-filter-form="admin-articles-col" aria-label="Filtros por coluna" hidden></form><div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Artigos — ${esc(result.total)} encontrado(s)</caption><thead><tr>${selectAllCell}${header('featured', 'Destaque')}${header('state', 'Estado')}${header('title', 'Título', { name: 'fTitle', label: 'Título', values: facets.titles ?? [] })}${header('alias', 'Alias', { name: 'fAlias', label: 'Alias', values: facets.aliases ?? [] })}${header('category', 'Categoria', { name: 'fCategory', label: 'Categoria', values: facets.categories ?? [], options: (facets.categoryOptions ?? []).map(({ value, label }) => [value, label]) })}${header('author', 'Autor', { name: 'fAuthor', label: 'Autor', values: facets.authors ?? [] })}${header('publishUp', 'Data')}${header('id', 'ID')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
