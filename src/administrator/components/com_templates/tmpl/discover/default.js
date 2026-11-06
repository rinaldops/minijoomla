import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { plusIcon } from '../../../com_minijoomla/icons.js';

const esc = escapeHtml;

export function renderTemplateDiscoveryPage(entries, link, shell) {
  const items = Array.isArray(entries) ? entries : [];
  const body = '<p role="status" aria-live="polite" class="admin-management-status"></p><p>Somente manifestos de templates já publicados e de origem confiável. O registro habilita seu carregamento; não instala arquivos.</p>' + (!items.length
    ? '<p class="admin-empty" role="status">Nenhum template novo encontrado na pasta de templates.</p>'
    : `<ul class="admin-discovery-list">${items.map((entry) => entry.error ? `<li class="admin-discovery-error"><strong>${esc(entry.key)}</strong>: ${esc(entry.error)}</li>` : `<li><strong>${esc(entry.title)}</strong> (${esc(entry.version)}) — <button type="button" class="admin-btn admin-btn-success" data-admin-template-register="${esc(entry.key)}" data-admin-template-title="${esc(entry.title)}" data-admin-template-version="${esc(entry.version)}" data-admin-template-entry="${esc(entry.entryPointUrl)}" data-admin-template-styles="${esc(entry.styles)}" data-admin-template-positions="${esc(JSON.stringify(entry.positions))}" data-admin-template-from="${esc(entry.discoveredFrom)}">${plusIcon()}Registrar</button></li>`).join('')}</ul>`);
  return shell({ activeKey: 'templates', pageTitle: 'Descobrir templates', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Templates', href: link('/templates') }, { label: 'Descobrir' }], bodyHtml: body, link });
}
