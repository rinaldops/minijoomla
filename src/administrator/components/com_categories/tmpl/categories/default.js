/*
 * Listagem de categorias (com_categories do Joomla real: grid com estado,
 * árvore indentada, alias, contagens de artigos por estado e ID). View pura:
 * recebe as linhas já carregadas e devolve HTML; filtros, binds e ETag
 * continuam no coordenador (com_minijoomla/content-pages.js).
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { selectionCell, selectAllCell, stateIcon } from '../../../com_minijoomla/extension-pages.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const COUNT_STATES = ['Published', 'Draft', 'Archived', 'Trashed'];
const STATE_LABELS = { Published: 'Publicado', Draft: 'Despublicado', Unpublished: 'Despublicado', Archived: 'Arquivado', Trashed: 'Na lixeira' };

export function renderCategoriesTable(rows, { link } = {}) {
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) return '<p class="admin-empty" role="status">Nenhum registro em "Categorias" encontrado.</p>';
  const tableRows = items.map((row) => {
    const title = String(row.title ?? '').trim() || `Categoria ${row.id}`;
    const state = row.state || 'Published';
    const toggle = state === 'Trashed'
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="restore" data-ext-id="${esc(row.id)}" aria-label="Restaurar ${esc(title)}">Restaurar</button>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-state" data-ext-id="${esc(row.id)}" aria-label="${state === 'Published' ? 'Despublicar' : 'Publicar'} ${esc(title)}">${stateIcon(state === 'Published' ? 'published' : 'unpublished', STATE_LABELS[state] ?? state)}</button>`;
    const indent = row.depth ? `<span aria-hidden="true">${'— '.repeat(row.depth)}</span><span class="visually-hidden">Nível ${row.depth + 1}: </span>` : '';
    const counts = COUNT_STATES.map((key) => `<a class="admin-badge${row.counts[key] ? '' : ' is-muted'}" href="${esc(link('/articles', { categoryId: row.id, state: key }))}" title="${esc(STATE_LABELS[key])}" aria-label="${esc(`${row.counts[key]} artigo(s): ${STATE_LABELS[key]}`)}">${esc(row.counts[key])}</a>`).join(' ');
    return `<tr>${selectionCell(row.id, title)}<td>${toggle}</td><th scope="row" class="admin-col-title">${indent}<a href="${esc(link(`/categories/${row.id}`))}" aria-label="${esc(`Editar: ${title}`)}">${esc(title)}</a>${row.description ? `<div class="admin-list-note">${esc(row.description)}</div>` : ''}</th><td class="admin-col-nowrap">${esc(row.alias)}</td><td>${counts}</td><td class="admin-col-nowrap">${esc(row.id)}</td></tr>`;
  }).join('');
  return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Categorias</caption><thead><tr>${selectAllCell}<th scope="col">Estado</th><th scope="col">Título</th><th scope="col">Alias</th><th scope="col">Artigos (publicados, despublicados, arquivados, lixeira)</th><th scope="col">ID</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
}
