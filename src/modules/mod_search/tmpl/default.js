import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';

export function renderDefault({ settings = {}, link = (path) => `#${path}` } = {}) {
  const label = escapeHtml(settings.label ?? 'Buscar conteúdo');
  return `<section class="module module-search"><form class="search-module-form" method="get" action="${safeUrl(link('/search'))}" role="search" aria-label="${label}"><label>${label}<input type="search" name="q" maxlength="120" autocomplete="off"></label><button type="submit">${escapeHtml(settings.buttonText ?? 'Buscar')}</button></form></section>`;
}
