import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { plusIcon } from '../../../com_minijoomla/icons.js';

const domainLabel = 'Extensões registradas';
const typeLabels = { Module: 'Módulo', Plugin: 'Plugin' };
const actionLabels = { upgrade: 'Atualizar', rollback: 'Reverter versão' };
const esc = escapeHtml;

export function renderDiscoveryPage(entries, link, shell, report) {
  const items = Array.isArray(entries) ? entries : [];
  const empty = report?.complete === false
    ? '<p class="admin-empty" role="status">Busca interrompida; verifique as origens.</p>'
    : '<p class="admin-empty" role="status">Nenhuma extensão nova encontrada na pasta de extensões.</p>';
  const body = '<p role="status" aria-live="polite" class="admin-management-status"></p><p>Registrar adiciona a extensão desabilitada ao catálogo. Confirme a origem do manifesto; depois habilite-a em Extensões registradas. Não há upload ou execução de código nesta etapa.</p>' + (!items.length
    ? empty
    : `<ul class="admin-discovery-list">${items.map((entry) => entry.error
        ? `<li class="admin-discovery-error"><strong>${esc(entry.key)}</strong>: ${esc(entry.error)}</li>`
        : `<li><strong>${esc(entry.title)}</strong> (${esc(Object.hasOwn(typeLabels, entry.type) ? typeLabels[entry.type] : entry.type)}) — <button type="button" class="admin-btn admin-btn-success" data-admin-register="${esc(entry.key)}" data-admin-register-type="${esc(entry.type)}" data-admin-register-entry="${esc(entry.entryPointUrl)}" data-admin-register-title="${esc(entry.title)}" data-admin-register-from="${esc(entry.discoveredFrom)}">${plusIcon()}${esc(actionLabels[entry.action] ?? 'Registrar')}</button>${entry.candidateId ? `<small> ${esc(entry.installedVersion ? `${entry.installedVersion} → ` : '')}${esc(entry.targetVersion ?? entry.version)} · ${esc(entry.displaySource ?? entry.discoveredFrom)}</small>` : ''}</li>`
      ).join('')}</ul>`);
  const issues = report?.issues?.length ? `<div role="alert">Busca incompleta<ul>${report.issues.map((issue) => `<li>${esc(issue.rootId)}: ${esc(issue.error)}</li>`).join('')}</ul></div>` : '';
  return shell({ activeKey: 'extensions', pageTitle: 'Descobrir extensões', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: domainLabel, href: link('/extensions') }, { label: 'Descobrir' }], bodyHtml: issues + body, link });
}
