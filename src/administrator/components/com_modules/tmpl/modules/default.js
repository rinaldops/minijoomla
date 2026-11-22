import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { moduleState } from '../../../../../libraries/minijoomla/application/module-assignment.js';
import { assignmentSummary, selectAllCell, selectionCell, stateIcon } from '../../../com_minijoomla/extension-pages.js';
import { renderColumnFilter, wrapColumnFilters } from '../../../com_minijoomla/render-list.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const STATE_LABELS = { published: 'Publicado', unpublished: 'Despublicado', trashed: 'Na lixeira' };

export function renderModulesTable(rows, { link, types, positions, columnFilters = [], columnFormId = 'admin-list' }) {
  /*
   * O cabeçalho é montado à parte porque os mesmos menus de filtro por
   * coluna precisam aparecer também quando a lista está vazia — sem
   * isso, filtrar por um valor sem resultado deixaria o usuário preso,
   * sem como voltar para "Todos" pela coluna.
   */
  const filterFor = (column) => columnFilters.find((filter) => filter.column === column);
  const header = ['state', 'title', 'type', 'position', 'pages', 'ordering'].map((column, index) => {
    const filter = filterFor(column);
    const labels = { state: 'Estado', title: 'Título', type: 'Tipo de módulo', position: 'Posição', pages: 'Páginas', ordering: 'Ordem' };
    return `<th scope="col">${labels[column]}${filter ? renderColumnFilter(filter, index) : ''}</th>`;
  }).join('');
  const head = `${selectAllCell}${header}<th scope="col">Ação</th>`;
  const wrap = (inner) => (columnFilters.length ? wrapColumnFilters(head, columnFormId, inner) : inner);
  if (!rows.length) return wrap('<p class="admin-empty">Nenhum módulo encontrado.</p>');
  const tableRows = rows.map((row) => {
    const state = moduleState(row);
    const type = types.get(row.extensionKey);
    const toggle = state === 'trashed'
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="restore" data-ext-id="${esc(row.id)}" aria-label="Restaurar ${esc(row.title)}">Restaurar</button>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="${state === 'published' ? 'unpublish' : 'publish'}" data-ext-id="${esc(row.id)}" aria-label="${state === 'published' ? 'Despublicar' : 'Publicar'} ${esc(row.title)}">${stateIcon(state, STATE_LABELS[state])}</button>`;
    return `<tr>${selectionCell(row.id, row.title)}<td>${toggle}</td><td><a href="${esc(link(`/moduleInstances/${row.id}`))}">${esc(row.title)}</a>${row.note ? `<div class="admin-list-note">Nota: ${esc(row.note)}</div>` : ''}</td><td>${esc(type?.title ?? row.extensionKey)}</td><td><span class="admin-badge${positions.positions.includes(row.position) ? '' : ' is-muted'}">${esc(row.position)}</span></td><td>${esc(assignmentSummary(row))}</td><td>${esc(row.ordering ?? 0)}</td><td class="admin-col-action"><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="duplicate" data-ext-id="${esc(row.id)}" aria-label="Duplicar ${esc(row.title)}">Duplicar</button></td></tr>`;
  }).join('');
  return wrap(`<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Módulos do site</caption><thead><tr>${head}</tr></thead><tbody>${tableRows}</tbody></table></div>`);
}
