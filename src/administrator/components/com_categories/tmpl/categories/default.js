/*
 * Listagem de categorias (com_categories do Joomla real: grid com estado,
 * árvore indentada, alias, contagens de artigos por estado e ID). View pura:
 * recebe as linhas já carregadas e devolve HTML; filtros, binds e ETag
 * continuam no coordenador (com_minijoomla/content-pages.js).
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { selectionCell, selectAllCell, stateIcon } from '../../../com_minijoomla/extension-pages.js';
import { renderColumnFilter, renderActiveFilterChips, renderCategoryCounts, renderCategoryLegend } from '../../../com_minijoomla/render-list.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const STATE_LABELS = { Published: 'Publicado', Draft: 'Despublicado', Unpublished: 'Despublicado', Archived: 'Arquivado', Trashed: 'Na lixeira' };

/*
 * `columnFilters` é opcional e tem o mesmo shape consumido por
 * renderColumnFilter (render-list.js). Ausente (chamada de teste ou de
 * outra tela), a tabela renderiza exatamente como antes — nenhum
 * contrato existente quebra.
 */
export function renderCategoriesTable(rows, { link, columnFilters = [], returnParams = {}, activeFilters = [], totalLabel = '' } = {}) {
  const items = Array.isArray(rows) ? rows : [];
  const filterFor = (column) => columnFilters.find((filter) => filter.column === column || filter.key === column);
  /*
   * Cabeçalho no padrão único: `th.admin-th` + `<span class="admin-th-label">`.
   * O rótulo COMPLETO continua para o leitor de tela (`visually-hidden`) e
   * como `title`; o visível é curto porque o texto longo original ("Artigos
   * (publicados, despublicados, arquivados, lixeira)") quebrava letra a
   * letra numa coluna estreita — achado real de inspeção visual.
   */
  const header = (column, label, fullLabel, extraClass = '') => {
    const filter = filterFor(column);
    const classes = ['admin-th', `admin-col-${column}`, filter ? 'admin-th-filterable' : '', extraClass].filter(Boolean).join(' ');
    return `<th scope="col" class="${esc(classes)}"${fullLabel ? ` title="${esc(fullLabel)}"` : ''}><span class="admin-th-label">${esc(label)}${fullLabel ? `<span class="visually-hidden"> (${esc(fullLabel)})</span>` : ''}</span>${filter ? renderColumnFilter(filter, column) : ''}</th>`;
  };
  const head = `${selectAllCell}${header('state', 'Estado')}${header('title', 'Título')}${header('alias', 'Alias')}${header('counts', 'Artigos', 'publicados, despublicados, arquivados, lixeira', 'admin-col-count')}${header('id', 'ID')}`;
  /*
   * Estado vazio AINDA renderiza o cabeçalho: sem ele, um filtro que não
   * casa com nada deixava o usuário preso, sem como trocar o valor do
   * menu de coluna sem recarregar a página pelo navegador.
   */
  if (!items.length) return `${renderActiveFilterChips(activeFilters, totalLabel)}<div class="admin-table-wrap"><table class="admin-list" data-colfilter-form><caption class="visually-hidden">Categorias</caption><thead><tr>${head}</tr></thead></table><p class="admin-empty" role="status">Nenhum registro em "Categorias" encontrado.</p></div>`;
  const tableRows = items.map((row) => {
    const title = String(row.title ?? '').trim() || `Categoria ${row.id}`;
    const state = row.state || 'Published';
    const toggle = state === 'Trashed'
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="restore" data-ext-id="${esc(row.id)}" aria-label="Restaurar ${esc(title)}">Restaurar</button>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-state" data-ext-id="${esc(row.id)}" aria-label="${state === 'Published' ? 'Despublicar' : 'Publicar'} ${esc(title)}">${stateIcon(state === 'Published' ? 'published' : 'unpublished', STATE_LABELS[state] ?? state)}</button>`;
    const indent = row.depth ? `<span aria-hidden="true">${'— '.repeat(row.depth)}</span><span class="visually-hidden">Nível ${row.depth + 1}: </span>` : '';
    /*
         * Os quatro indicadores vêm do renderizador CANÔNICO (`renderCategoryCounts`),
         * o mesmo que o caminho de capacidades usa: enquanto esta listagem tinha
         * a própria cópia, ela publicava `admin-badge` sem a cor/marcador por
         * situação, e a classe divergia entre as duas rotas.
         */
        const counts = renderCategoryCounts(row, { link, domain: 'articles', listState: returnParams, label: title });
    return `<tr>${selectionCell(row.id, title)}<td>${toggle}</td><th scope="row" class="admin-col-title">${indent}<a href="${esc(link(`/categories/${row.id}`, returnParams))}" aria-label="${esc(`Editar: ${title}`)}">${esc(title)}</a>${row.description ? `<div class="admin-list-note">${esc(row.description)}</div>` : ''}</th><td class="admin-col-alias">${esc(row.alias)}</td><td class="admin-col-count">${counts}</td><td class="admin-col-nowrap">${esc(row.id)}</td></tr>`;
  }).join('');
    return `${renderActiveFilterChips(activeFilters, totalLabel)}<div class="admin-table-wrap"><table class="admin-list" data-colfilter-form><caption class="visually-hidden">Categorias</caption><thead><tr>${head}</tr></thead><tbody>${tableRows}</tbody></table></div>${renderCategoryLegend()}`;
}
