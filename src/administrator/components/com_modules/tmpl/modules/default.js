import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { moduleState } from '../../../../../libraries/minijoomla/application/module-assignment.js';
import { assignmentSummary, selectAllCell, selectionCell, stateIcon } from '../../../com_minijoomla/extension-pages.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const STATE_LABELS = { published: 'Publicado', unpublished: 'Despublicado', trashed: 'Na lixeira' };

export function renderModulesTable(rows, { link, types, positions }) {
  if (!rows.length) return '<p class="admin-empty">Nenhum módulo encontrado.</p>';
  const tableRows = rows.map((row) => {
    const state = moduleState(row);
    const type = types.get(row.extensionKey);
    const toggle = state === 'trashed'
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="restore" data-ext-id="${esc(row.id)}" aria-label="Restaurar ${esc(row.title)}">Restaurar</button>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="${state === 'published' ? 'unpublish' : 'publish'}" data-ext-id="${esc(row.id)}" aria-label="${state === 'published' ? 'Despublicar' : 'Publicar'} ${esc(row.title)}">${stateIcon(state, STATE_LABELS[state])}</button>`;
    return `<tr>${selectionCell(row.id, row.title)}<td>${toggle}</td><td><a href="${esc(link(`/moduleInstances/${row.id}`))}">${esc(row.title)}</a>${row.note ? `<div class="admin-list-note">Nota: ${esc(row.note)}</div>` : ''}</td><td>${esc(type?.title ?? row.extensionKey)}</td><td><span class="admin-badge${positions.positions.includes(row.position) ? '' : ' is-muted'}">${esc(row.position)}</span></td><td>${esc(assignmentSummary(row))}</td><td>${esc(row.ordering ?? 0)}</td><td class="admin-col-action"><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="duplicate" data-ext-id="${esc(row.id)}" aria-label="Duplicar ${esc(row.title)}">Duplicar</button></td></tr>`;
  }).join('');
  return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Módulos do site</caption><thead><tr>${selectAllCell}<th scope="col">Estado</th><th scope="col">Título</th><th scope="col">Tipo de módulo</th><th scope="col">Posição</th><th scope="col">Páginas</th><th scope="col">Ordem</th><th scope="col">Ação</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
}
