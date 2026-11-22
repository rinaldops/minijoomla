import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { formatDate } from '../../../../../libraries/minijoomla/core/format.js';
import { selectAllCell, selectionCell } from '../../../com_minijoomla/extension-pages.js';
import { renderArticleIndicator, renderColumnFilter } from '../../../com_minijoomla/render-list.js';

const esc = (value) => escapeHtml(String(value ?? ''));
/*
 * Achado real (item 2 do baseline): a data de `publishUp` vinha de
 * `new Date('2026-01-01')`, que interpreta a string sem hora como UTC e,
 * exibida em UTC-3, mostrava um dia a menos (01/01/2026 -> 31/12/2025).
 * `formatDate` (core/format.js) monta datas puras com componentes locais.
 */
const dateText = (value) => formatDate(value);

export function renderArticlesTable(result, { link, params = {}, now = new Date(), columnFilters = [], returnParams = {} } = {}) {
  /*
   * Estado vazio AINDA renderiza o cabeçalho: sem ele, um filtro que não
   * casa com nada deixava o usuário preso — não havia mais como trocar o
   * valor do menu de coluna sem recarregar a página pelo navegador. O
   * aviso substitui o corpo da tabela, o cabeçalho permanece.
   */
  const emptyNotice = '<p class="admin-empty" role="status">Nenhum artigo encontrado.</p>';

  const sort = params.sort || 'id';
  const dir = params.dir || (sort === 'id' ? 'desc' : 'asc');
  const sortLink = (key, label) => {
    const active = sort === key;
    const next = active && dir === 'asc' ? 'desc' : 'asc';
    return `<a href="${esc(link('/articles', { ...params, sort: key, dir: next, page: undefined }))}">${esc(label)}${active ? ` <span aria-hidden="true">${dir === 'asc' ? '▲' : '▼'}</span>` : ''}</a>`;
  };
  /*
   * Cada coluna tem seu próprio ordenador e, quando `columnFilters` traz
   * uma entrada para ela, também o menu de filtro independente — o
   * mesmo "filtro por coluna" do Joomla real. `filter.column` é o NOME
   * DA COLUNA e pode diferir do parâmetro de URL (`filter.name`): a
   * coluna Categoria filtra por `categoryId` canônico, nunca pelo
   * rótulo, para que categorias homônimas em ramos distintos não se
   * confundam.
   */
  const filterFor = (column) => columnFilters.find((filter) => filter.column === column);
    /*
     * `columnClass` repassa para o `<th>` a MESMA classe de coluna usada na
     * célula (`admin-col-author`, `admin-col-count`, …). Sem isso as regras
     * de largura mínima/`white-space` do CSS atingiam só o `td`: em tabela
     * de layout automático o navegador ignora a largura da célula e espreme
     * o cabeçalho, que era o defeito visual do "Au/tor" e da coluna de
     * contagem estrangulada.
     */
    const header = (key, label, extraKey, extraLabel, columnClass) => {
    const active = sort === key || sort === extraKey;
    const filter = filterFor(key);
      const classes = [`admin-col-${key}`, columnClass].filter(Boolean).join(' ');
      return `<th scope="col"${classes ? ` class="${esc(classes)}"` : ''}${active ? ` aria-sort="${dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>${sortLink(key, label)}${extraKey ? ` · ${sortLink(extraKey, extraLabel)}` : ''}${filter ? renderColumnFilter(filter, key) : ''}</th>`;
  };
  const rows = result.rows.map((row) => {
    const title = String(row.title ?? '').trim() || `Artigo ${row.id}`;
    const stateButton = row.state === 'Trashed'
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="restore" data-ext-id="${esc(row.id)}" aria-label="Restaurar ${esc(title)}">Restaurar</button>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-state" data-ext-id="${esc(row.id)}" aria-label="${(row.state ?? 'Published') === 'Published' ? 'Despublicar' : 'Publicar'} ${esc(title)}">${renderArticleIndicator(row, 'state', now)}</button>`;
    const featuredButton = `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-featured" data-ext-id="${esc(row.id)}" aria-label="${row.featured ? 'Remover destaque de' : 'Destacar'} ${esc(title)}">${renderArticleIndicator(row, 'featured', now)}</button>`;
    const categoryCell = row.categoryTitle
      ? `<a href="${esc(link('/articles', { categoryId: row.categoryId }))}">${esc(row.categoryTitle)}</a>`
      : '<span class="admin-list-note" aria-hidden="true">—</span><span class="visually-hidden">Sem categoria</span>';
    const author = String(row.author ?? '').trim();
    return `<tr>${selectionCell(row.id, title)}<td>${featuredButton}</td><td>${stateButton}</td>`
          + `<th scope="row" class="admin-col-title"><a href="${esc(link(`/articles/${row.id}`, returnParams))}" aria-label="${esc(`Editar: ${title}`)}">${esc(title)}</a>${row.note ? `<div class="admin-list-note">Nota: ${esc(row.note)}</div>` : ''}</th>`
      + `<td class="admin-col-alias">${esc(row.alias)}</td>`
      + `<td class="admin-col-category">${categoryCell}</td>`
      + `<td class="admin-col-author">${author ? esc(author) : '<span class="admin-list-note" aria-hidden="true">—</span><span class="visually-hidden">Sem autor</span>'}${row.authorAlias ? `<div class="admin-list-note">Alias: ${esc(row.authorAlias)}</div>` : ''}</td>`
      + `<td class="admin-col-nowrap">${dateText(row.publishUp) || '—'}</td><td class="admin-col-nowrap">${esc(row.id)}</td></tr>`;
  }).join('');
  const headers = [header('featured', 'Destaque'), header('state', 'Estado'), header('title', 'Título'), header('alias', 'Alias'), header('category', 'Categoria'), header('author', 'Autor'), header('publishUp', 'Data'), header('id', 'ID')].join('');
      return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Artigos — ${esc(result.total)} encontrado(s)</caption><thead><tr>${selectAllCell}${headers}</tr></thead><tbody>${rows}</tbody></table>${result.rows.length ? '' : emptyNotice}</div>`;
}
