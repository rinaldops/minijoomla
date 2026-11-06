import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { formActions, paramFields, tabs } from '../../../com_minijoomla/extension-pages.js';

const esc = (value) => escapeHtml(String(value ?? ''));

export function renderTemplateStyleForm(style, { link }) {
  const details = `<div class="admin-field"><label for="admin-style-title">Título do estilo *</label><input type="text" id="admin-style-title" name="title" required maxlength="120" value="${esc(style.title)}"></div><p class="admin-help">Template: <strong>${esc(style.templateTitle)}</strong>${style.isDefault ? ' — estilo padrão do site' : ''}.</p>`;
  return `<form class="admin-form" data-ext-form="style">${tabs('style', [['details', 'Detalhes', details], ['advanced', 'Avançado', paramFields('style', style.definitions, style.params)]])}${formActions(link('/templates/styles'))}</form>`;
}
