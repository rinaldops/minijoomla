import { escapeHtml, safeUrl } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { formatDate } from '../../../../../libraries/minijoomla/core/format.js';
import { trashIcon } from '../../../com_minijoomla/icons.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const dateText = (value) => formatDate(value);

export function formatMediaSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export function renderMediaFiles(files, { canDelete = false } = {}) {
  if (!files.length) return '<p class="admin-empty" role="status">Nenhum arquivo na pasta de uploads.</p>';
  const rows = files.map((file, index) => {
    const url = safeUrl(file.url);
    const preview = file.isImage && url !== '#' ? `<img src="${url}" alt="" loading="lazy" width="64" height="64">` : '';
    const remove = canDelete ? `<button type="button" class="admin-btn admin-btn-danger" data-ext-action="delete" data-ext-id="${index}" aria-label="Excluir ${esc(file.name)}">${trashIcon()}Excluir</button>` : '';
    return `<tr><td>${preview}</td><th scope="row"><a href="${url}" target="_blank" rel="noopener">${esc(file.name)}</a></th><td>${esc(formatMediaSize(file.size))}</td><td class="admin-col-nowrap">${esc(dateText(file.modified))}</td><td class="admin-col-action"><button type="button" class="admin-btn admin-btn-ghost" data-ext-action="copy" data-ext-id="${index}" aria-label="Copiar URL de ${esc(file.name)}">Copiar URL</button>${remove}</td></tr>`;
  }).join('');
      return `<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Arquivos da pasta de uploads</caption><thead><tr><th scope="col" class="admin-col-preview">Prévia</th><th scope="col" class="admin-col-title">Arquivo</th><th scope="col" class="admin-col-size">Tamanho</th><th scope="col" class="admin-col-publishUp">Modificado</th><th scope="col" class="admin-col-action">Ação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
