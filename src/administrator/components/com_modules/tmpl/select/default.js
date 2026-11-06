/*
 * Catálogo de tipos de módulo (equivalente ao "Selecionar um tipo de módulo"
 * do com_modules do Joomla). View pura: recebe o catálogo já carregado.
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';

const esc = (value) => escapeHtml(String(value ?? ''));

export function renderModuleTypeCatalog(catalog, { link } = {}) {
  const types = Array.isArray(catalog) ? catalog : [];
  const cards = types.map((type) => `<li><h2><a href="${esc(link('/moduleInstances/new', { type: type.key }))}">${esc(type.title)}</a></h2><p>${esc(type.description || 'Módulo registrado.')}</p><code>${esc(type.key)}</code>${type.builtin ? ' <span class="admin-badge">nativo</span>' : type.enabled === false ? ' <span class="admin-badge is-muted">desabilitado</span>' : ''}</li>`).join('');
  return `<ul class="admin-component-catalog" aria-label="Tipos de módulo">${cards}</ul>`;
}
