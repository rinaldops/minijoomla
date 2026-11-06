import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { formActions, paramFields, tabs } from '../../../com_minijoomla/extension-pages.js';

const esc = (value) => escapeHtml(String(value ?? ''));

export function renderPluginForm(plugin, { link }) {
  const general = `<div class="admin-field admin-field-checkbox"><input type="checkbox" id="admin-plugin-enabled" name="enabled"${plugin.enabled ? ' checked' : ''}><label for="admin-plugin-enabled">Habilitado</label></div>
<div class="admin-field"><label for="admin-plugin-ordering">Ordem de execução</label><input type="number" id="admin-plugin-ordering" name="ordering" step="1" value="${esc(plugin.ordering)}"></div>
<dl class="admin-meta"><dt>Grupo</dt><dd>${esc(plugin.group)}</dd><dt>Elemento</dt><dd><code>${esc(plugin.key)}</code></dd>${plugin.version ? `<dt>Versão</dt><dd>${esc(plugin.version)}</dd>` : ''}${plugin.description ? `<dt>Descrição</dt><dd>${esc(plugin.description)}</dd>` : ''}</dl>`;
  return `<form class="admin-form" data-ext-form="plugin">${tabs('plugin', [['plugin', 'Plugin', general + paramFields('plugin', plugin.definitions, plugin.params)]])}${formActions(link('/plugins'))}</form>`;
}
