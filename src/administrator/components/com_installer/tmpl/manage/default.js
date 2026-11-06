/*
 * Views puras do gerenciador de extensões instaladas e do formulário de instalação.
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { stateIcon } from '../../../com_minijoomla/extension-pages.js';
import { plusIcon } from '../../../com_minijoomla/icons.js';

const esc = (value) => escapeHtml(String(value ?? ''));

export const KIND_LABELS = { Component: 'Componente', Module: 'Módulo', Plugin: 'Plugin', Template: 'Template' };

export function renderInstalledExtensionsTable(rows, { snapshots }) {
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) return '<p class="admin-empty">Nenhuma extensão encontrada.</p>';
  const tableRows = items.map((row) => {
    const snapshot = snapshots.get(row.uid);
    const action = row.core ? '<span class="admin-badge">Nativo</span>' : snapshot
      ? `<button type="button" class="admin-btn admin-btn-ghost" data-ext-action="toggle" data-ext-id="${esc(row.uid)}" aria-label="${snapshot.enabled !== false ? 'Desabilitar' : 'Habilitar'} ${esc(row.title)}">${stateIcon(snapshot.enabled !== false ? 'published' : 'unpublished', snapshot.enabled !== false ? 'Habilitado' : 'Desabilitado')}</button>` : '';
    return `<tr><td>${action}</td><td>${esc(row.title)}</td><td>${esc(KIND_LABELS[row.kind] ?? row.kind)}</td><td><code>${esc(row.key)}</code></td><td>${esc(row.version ?? '')}</td><td>${row.core ? 'Núcleo' : esc(row.source || 'Registro')}</td></tr>`;
  }).join('');
  return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Extensões instaladas</caption><thead><tr><th scope="col">Estado</th><th scope="col">Nome</th><th scope="col">Tipo</th><th scope="col">Elemento</th><th scope="col">Versão</th><th scope="col">Origem</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
}

export function renderInstallForm(link) {
  return `<section class="admin-install" aria-labelledby="admin-install-title"><h2 id="admin-install-title">Instalar por manifesto declarativo</h2><p class="admin-help">Cole um manifesto JSON (type Module, Plugin ou Template; key; title; version; entryPointUrl de um módulo ES já publicado no mesmo site). Nenhum código é executado na instalação; a extensão é registrada desabilitada para revisão.</p><form class="admin-form" data-ext-form="install"><div class="admin-field"><label for="admin-install-manifest">Manifesto (JSON)</label><textarea id="admin-install-manifest" name="manifest" rows="8" spellcheck="false"></textarea></div><div class="admin-form-actions"><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="preview">Validar</button><button type="submit" class="admin-btn admin-btn-success">${plusIcon()}Instalar</button></div><div class="admin-install-preview" data-ext-preview aria-live="polite"></div></form><p><a href="${esc(link('/extensions/discover'))}">Descobrir extensões publicadas</a> · <a href="${esc(link('/templates/discover'))}">Descobrir templates</a></p></section>`;
}
