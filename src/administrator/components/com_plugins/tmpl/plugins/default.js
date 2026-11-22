/*
 * Listagem de plugins: recebe snapshots já carregados e devolve somente HTML.
 * Filtros, binds e carregamento permanecem no coordenador (com_minijoomla).
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { selectionCell, selectAllCell, stateIcon } from '../../../com_minijoomla/extension-pages.js';
import { renderColumnFilter, wrapColumnFilters } from '../../../com_minijoomla/render-list.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const COLUMN_LABELS = { state: 'Estado', title: 'Nome do plugin', group: 'Grupo', ordering: 'Ordem', key: 'Elemento', version: 'Versão' };

export function renderPluginsTable(rows, { link, columnFilters = [], columnFormId = 'admin-list' }) {
  const items = Array.isArray(rows) ? rows : [];
  // Ver comentário equivalente em com_modules: o cabeçalho com os menus de
  // filtro sobrevive ao estado vazio, senão o usuário não teria como
  // desfazer um filtro por coluna sem resultado.
  const filterFor = (column) => columnFilters.find((filter) => filter.column === column);
  const header = Object.keys(COLUMN_LABELS).map((column, index) => {
    const filter = filterFor(column);
    return `<th scope="col">${COLUMN_LABELS[column]}${filter ? renderColumnFilter(filter, index) : ''}</th>`;
  }).join('');
  const head = `${selectAllCell}${header}`;
  const wrap = (inner) => (columnFilters.length ? wrapColumnFilters(head, columnFormId, inner) : inner);
  if (!items.length) return wrap('<p class="admin-empty">Nenhum plugin encontrado.</p>');
  const tableRows = items.map((row) => `<tr>${selectionCell(row.id, row.title)}<td><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle" data-ext-id="${esc(row.id)}" aria-label="${row.enabled ? 'Desabilitar' : 'Habilitar'} ${esc(row.title)}">${stateIcon(row.enabled ? 'published' : 'unpublished', row.enabled ? 'Habilitado' : 'Desabilitado')}</button></td><td>${row.virtual ? esc(row.title) : `<a href="${esc(link(`/plugins/${row.id}`))}">${esc(row.title)}</a>`}${row.description ? `<div class="admin-list-note">${esc(row.description)}</div>` : ''}</td><td><span class="admin-badge">${esc(row.group)}</span></td><td>${esc(row.ordering)}</td><td><code>${esc(row.key)}</code></td><td>${esc(row.version)}</td></tr>`).join('');
  return wrap(`<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Plugins</caption><thead><tr>${head}</tr></thead><tbody>${tableRows}</tbody></table></div>`);
}
