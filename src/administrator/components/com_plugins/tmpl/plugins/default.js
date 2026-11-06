/*
 * Listagem de plugins: recebe snapshots já carregados e devolve somente HTML.
 * Filtros, binds e carregamento permanecem no coordenador (com_minijoomla).
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { selectionCell, selectAllCell, stateIcon } from '../../../com_minijoomla/extension-pages.js';

const esc = (value) => escapeHtml(String(value ?? ''));

export function renderPluginsTable(rows, { link }) {
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) return '<p class="admin-empty">Nenhum plugin encontrado.</p>';
  const tableRows = items.map((row) => `<tr>${selectionCell(row.id, row.title)}<td><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle" data-ext-id="${esc(row.id)}" aria-label="${row.enabled ? 'Desabilitar' : 'Habilitar'} ${esc(row.title)}">${stateIcon(row.enabled ? 'published' : 'unpublished', row.enabled ? 'Habilitado' : 'Desabilitado')}</button></td><td>${row.virtual ? esc(row.title) : `<a href="${esc(link(`/plugins/${row.id}`))}">${esc(row.title)}</a>`}${row.description ? `<div class="admin-list-note">${esc(row.description)}</div>` : ''}</td><td><span class="admin-badge">${esc(row.group)}</span></td><td>${esc(row.ordering)}</td><td><code>${esc(row.key)}</code></td><td>${esc(row.version)}</td></tr>`).join('');
  return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Plugins</caption><thead><tr>${selectAllCell}<th scope="col">Estado</th><th scope="col">Nome do plugin</th><th scope="col">Grupo</th><th scope="col">Ordem</th><th scope="col">Elemento</th><th scope="col">Versão</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
}
