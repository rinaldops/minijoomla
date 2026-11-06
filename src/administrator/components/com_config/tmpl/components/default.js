import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { tabs, paramFields, formActions } from '../../../com_minijoomla/extension-pages.js';

export function renderComponentOptionsCatalog(components, { link }) {
  const esc = (value) => escapeHtml(String(value ?? ''));
  const items = components.map((component) => `<li><h2><a href="${esc(link(`/options/${component.key}`))}">${esc(component.title)}</a></h2><code>${esc(component.joomla)}</code>${component.available === false ? `<p class="admin-help">${esc(component.unavailableReason)}</p>` : ''}</li>`).join('');
  return `<p>Parâmetros globais por componente, usados quando o item de menu ou o conteúdo não define um valor próprio.</p><ul class="admin-component-catalog">${items}</ul>`;
}

export function renderComponentOptionsForm(options, { link }) {
  const esc = (value) => escapeHtml(String(value ?? ''));
  if (options.available === false) {
    const warning = `<p class="admin-help" role="status" id="admin-options-unavailable">${esc(options.unavailableReason)}</p>`;
    const form = `<form class="admin-form" data-ext-form="options" aria-describedby="admin-options-unavailable"><fieldset disabled><legend>${esc(options.title)} — indisponível</legend>${paramFields('options', options.definitions, options.values)}<button type="submit" class="admin-btn" disabled>Salvar indisponível</button></fieldset><a class="admin-btn admin-btn-ghost" href="${esc(link('/options'))}">Voltar</a></form>`;
    return warning + form;
  }
  return `<form class="admin-form" data-ext-form="options">${tabs('options', [['general', options.title, paramFields('options', options.definitions, options.values)]])}${formActions(link('/options'))}</form>`;
}
