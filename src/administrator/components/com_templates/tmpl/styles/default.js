import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { starIcon, starOutlineIcon, trashIcon } from '../../../com_minijoomla/icons.js';

const esc = (value) => escapeHtml(String(value ?? ''));

export function renderTemplateStylesTable(styles, { link }) {
  if (!styles.length) return '<p class="admin-empty">Nenhum estilo encontrado.</p>';
  const tableRows = styles.map((style) => {
    const star = style.isDefault
      ? `<span class="admin-default-star" role="img" aria-label="Estilo padrão do site">${starIcon()}</span>`
      : `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="default" data-ext-id="${esc(style.id)}" aria-label="Definir ${esc(style.title)} como padrão">${style.home ? starIcon() : starOutlineIcon()}</button>`;
    const remove = style.home || style.virtual ? '' : `<button type="button" class="admin-btn admin-btn-danger" data-ext-action="remove" data-ext-id="${esc(style.id)}" aria-label="Excluir ${esc(style.title)}">${trashIcon()}Excluir</button>`;
    return `<tr><td>${star}</td><td><a href="${esc(link(`/templates/styles/${encodeURIComponent(style.id)}`))}">${esc(style.title)}</a>${style.home && !style.isDefault ? '<div class="admin-list-note">Padrão deste template</div>' : ''}</td><td>${esc(style.templateTitle)}</td><td class="admin-col-action"><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="duplicate" data-ext-id="${esc(style.id)}" aria-label="Duplicar ${esc(style.title)}">Duplicar</button><a class="admin-btn admin-btn-ghost" href="${esc(link('/templates/positions', { template: style.template }))}">Posições</a>${remove}</td></tr>`;
  }).join('');
  return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Estilos de template</caption><thead><tr><th scope="col">Padrão</th><th scope="col">Estilo</th><th scope="col">Template</th><th scope="col">Ações</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
}
