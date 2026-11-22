/*
 * Listagem de tags (com_tags do Joomla real: grid com estado, nome, alias,
 * contagem de artigos com a tag e ID). View pura, mesmo contrato da listagem
 * de categorias; filtros, binds e ETag ficam no coordenador
 * (com_minijoomla/content-pages.js).
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { selectionCell, selectAllCell, stateIcon } from '../../../com_minijoomla/extension-pages.js';
import { renderColumnFilter } from '../../../com_minijoomla/render-list.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const STATE_LABELS = { Published: 'Publicado', Draft: 'Despublicado', Unpublished: 'Despublicado', Archived: 'Arquivado', Trashed: 'Na lixeira' };

/*
 * Mesmo contrato opcional da listagem de categorias: sem `columnFilters`,
 * a tabela renderiza como antes.
 */
export function renderTagsTable(rows, { link, columnFilters = [], returnParams = {} } = {}) {
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) return '<p class="admin-empty" role="status">Nenhum registro em "Tags" encontrado.</p>';
  const filterFor = (column) => columnFilters.find((filter) => filter.column === column);
  const tableRows = items.map((row) => {
    const title = String(row.name ?? '').trim() || `Tag ${row.id}`;
    const state = row.state || 'Published';
    const toggle = state === 'Trashed'
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="restore" data-ext-id="${esc(row.id)}" aria-label="Restaurar ${esc(title)}">Restaurar</button>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle-state" data-ext-id="${esc(row.id)}" aria-label="${state === 'Published' ? 'Despublicar' : 'Publicar'} ${esc(title)}">${stateIcon(state === 'Published' ? 'published' : 'unpublished', STATE_LABELS[state] ?? state)}</button>`;
    const indent = row.depth ? `<span aria-hidden="true">${'— '.repeat(row.depth)}</span><span class="visually-hidden">Nível ${row.depth + 1}: </span>` : '';
    const total = Number(row.counts?.count ?? 0);
    const counts = `<a class="admin-badge${total ? '' : ' is-muted'}" href="${esc(link('/articles', { tag: row.name }))}" aria-label="${esc(`${total} artigo(s) com a tag ${row.name}`)}">${esc(total)}</a>`;
    return `<tr>${selectionCell(row.id, title)}<td>${toggle}</td><th scope="row" class="admin-col-title">${indent}<a href="${esc(link(`/tags/${row.id}`, returnParams))}" aria-label="${esc(`Editar: ${title}`)}">${esc(title)}</a>${row.description ? `<div class="admin-list-note">${esc(row.description)}</div>` : ''}</th><td class="admin-col-alias">${esc(row.alias)}</td><td class="admin-col-count">${counts}</td><td class="admin-col-nowrap">${esc(row.id)}</td></tr>`;
  }).join('');
      /*
             * Mesma assinatura do cabeçalho de Categorias — `(column, label,
             * fullLabel, extraClass)` — para que as duas listagens de taxonomia
             * não divergissem: a ordem anterior era `(column, label, extraClass,
             * fullLabel)` e a chamada passava `'admin-col-count'` no lugar do
             * rótulo acessível, de modo que o `th` ficava sem classe de coluna e
             * a coluna de contagem continuava estrangulada. O rótulo completo
             * ("Artigos com a tag") permanece acessível por leitor de tela; o
             * visível é curto para não quebrar letra a letra.
             */
            const header = (column, label, fullLabel = '', extraClass = '') => `<th scope="col" class="${esc(`admin-col-${column}${extraClass ? ` ${extraClass}` : ''}`)}">${fullLabel ? `<span class="visually-hidden">${esc(fullLabel)}</span><span aria-hidden="true">${esc(label)}</span>` : esc(label)}${filterFor(column) ? renderColumnFilter(filterFor(column), column) : ''}</th>`;
            return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Tags</caption><thead><tr>${selectAllCell}${header('state', 'Estado')}${header('name', 'Nome')}${header('alias', 'Alias')}${header('counts', 'Artigos', 'Artigos com a tag', 'admin-col-count')}${header('id', 'ID')}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
}
