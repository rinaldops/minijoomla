import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { starIcon, starOutlineIcon, trashIcon } from '../../../com_minijoomla/icons.js';
import { renderColumnFilter, wrapColumnFilters } from '../../../com_minijoomla/render-list.js';

const esc = (value) => escapeHtml(String(value ?? ''));

/*
 * Colunas com filtro próprio. "Padrão" e "Ações" ficam de fora porque não
 * são valores do registro (são controles), e "Padrão" já é coberto pela
 * barra de filtros quando faz sentido.
 */
const COLUMN_LABELS = { style: 'Estilo', template: 'Template' };

/*
 * Listagem de estilos de template com filtro por coluna.
 *
 * Cada coluna filtrável recebe o MESMO menu de cabeçalho usado pelas demais
 * listagens administrativas (renderColumnFilter), em vez da barra única que
 * existia: a barra só oferecia "Template", deixando "Estilo" sem filtro
 * próprio. Ver comentário equivalente em com_modules/com_plugins sobre o
 * cabeçalho sobreviver ao estado vazio — senão um filtro por coluna sem
 * resultado deixaria o usuário sem como voltar a "Todos".
 */
export function renderTemplateStylesTable(styles, { link, columnFilters = [], columnFormId = 'admin-styles' }) {
  const items = Array.isArray(styles) ? styles : [];
  const filterFor = (column) => columnFilters.find((filter) => filter.column === column);
  const header = Object.entries(COLUMN_LABELS).map(([column, label], index) => {
    const filter = filterFor(column);
    return `<th scope="col" class="${esc(`admin-col-${column}`)}">${esc(label)}${filter ? renderColumnFilter(filter, index) : ''}</th>`;
  }).join('');
  const head = `<th scope="col" class="admin-col-default">Padrão</th>${header}<th scope="col" class="admin-col-action">Ações</th>`;
  const wrap = (inner) => (columnFilters.length ? wrapColumnFilters(head, columnFormId, inner) : inner);
  if (!items.length) return wrap('<p class="admin-empty" role="status">Nenhum estilo encontrado.</p>');
  const tableRows = items.map((style) => {
    const star = style.isDefault
      ? `<span class="admin-default-star" role="img" aria-label="Estilo padrão do site">${starIcon()}</span>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="default" data-ext-id="${esc(style.id)}" aria-label="Definir ${esc(style.title)} como padrão">${style.home ? starIcon() : starOutlineIcon()}</button>`;
    const remove = style.home || style.virtual ? '' : `<button type="button" class="admin-btn admin-btn-danger" data-ext-action="remove" data-ext-id="${esc(style.id)}" aria-label="Excluir ${esc(style.title)}">${trashIcon()}Excluir</button>`;
    return `<tr><td class="admin-col-default">${star}</td><td class="admin-col-style"><a href="${esc(link(`/templates/styles/${encodeURIComponent(style.id)}`))}">${esc(style.title)}</a>${style.home && !style.isDefault ? '<div class="admin-list-note">Padrão deste template</div>' : ''}</td><td class="admin-col-template">${esc(style.templateTitle)}</td><td class="admin-col-action"><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="duplicate" data-ext-id="${esc(style.id)}" aria-label="Duplicar ${esc(style.title)}">Duplicar</button><a class="admin-btn admin-btn-ghost" href="${esc(link('/templates/positions', { template: style.template }))}">Posições</a>${remove}</td></tr>`;
  }).join('');
  return wrap(`<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Estilos de template</caption><thead><tr>${head}</tr></thead><tbody>${tableRows}</tbody></table></div>`);
}
