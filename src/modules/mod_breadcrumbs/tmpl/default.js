import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';

export function renderDefault({ items = [], settings = {} } = {}) {
  let entries = Array.isArray(items) ? items : [];
  if (settings?.showHome === false) entries = entries.slice(1);
  if (settings?.showLast === false) entries = entries.slice(0, -1);
  const separator = settings?.separator ? `<span class="divider" aria-hidden="true">${escapeHtml(settings.separator)}</span>` : '';
  return `<nav aria-label="Breadcrumb"><ol>${entries.map((item, index) => { const isLast = index === entries.length - 1; const isLinkable = item && typeof item === 'object'; const label = escapeHtml(isLinkable ? item.label : item); const sep = separator && !isLast ? separator : ''; return isLinkable && item.href && !isLast ? `<li><a href="${safeUrl(item.href)}">${label}</a>${sep}</li>` : `<li${isLast ? ' aria-current="page"' : ''}>${label}${sep}</li>`; }).join('')}</ol></nav>`;
}
