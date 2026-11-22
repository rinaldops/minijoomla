/*
 * Listagem de plugins: recebe snapshots já carregados e devolve somente HTML.
 * Filtros, binds e carregamento permanecem no coordenador (com_minijoomla).
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { selectionCell, selectAllCell, stateIcon } from '../../../com_minijoomla/extension-pages.js';
import { renderColumnFilter } from '../../../com_minijoomla/render-list.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const COLUMN_LABELS = { state: 'Estado', title: 'Nome do plugin', group: 'Grupo', ordering: 'Ordem', key: 'Elemento', version: 'Versão' };

export function renderPluginsTable(rows, { link, columnFilters = [], columnFormId = 'admin-list' }) {
  const items = Array.isArray(rows) ? rows : [];
  // O cabeçalho com os botões de filtro sobrevive ao estado vazio, senão o
  // usuário não teria como desfazer um filtro por coluna sem resultado.
  const filterFor = (column) => columnFilters.find((filter) => filter.column === column);
  const header = Object.keys(COLUMN_LABELS).map((column, index) => {
    const filter = filterFor(column);
    return `<th scope="col" class="admin-th${filter ? ' admin-th-filterable' : ''}"><span class="admin-th-label">${esc(COLUMN_LABELS[column])}</span>${filter ? renderColumnFilter(filter, index) : ''}</th>`;
  }).join('');
  const head = `${selectAllCell}${header}`;
  if (!items.length) return `<div class="admin-table-wrap"><table class="admin-list" data-colfilter-form="${esc(columnFormId)}"><caption class="visually-hidden">Plugins</caption><thead><tr>${head}</tr></thead></table></div><p class="admin-empty">Nenhum plugin encontrado.</p>`;
  const tableRows = items.map((row) => `<tr>${selectionCell(row.id, row.title)}<td><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle" data-ext-id="${esc(row.id)}" aria-label="${row.enabled ? 'Desabilitar' : 'Habilitar'} ${esc(row.title)}">${stateIcon(row.enabled ? 'published' : 'unpublished', row.enabled ? 'Habilitado' : 'Desabilitado')}</button></td><td>${row.virtual ? esc(row.title) : `<a href="${esc(link(`/plugins/${row.id}`))}">${esc(row.title)}</a>`}${row.description ? `<div class="admin-list-note">${esc(row.description)}</div>` : ''}</td><td><span class="admin-badge">${esc(row.group)}</span></td><td>${esc(row.ordering)}</td><td><code>${esc(row.key)}</code></td><td>${esc(row.version)}</td></tr>`).join('');
  return `<div class="admin-table-wrap"><table class="admin-list" data-colfilter-form="${esc(columnFormId)}"><caption class="visually-hidden">Plugins</caption><thead><tr>${head}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
}
