/*
 * Equivalente ao plugin pagenavigation do Joomla: links anterior/próximo dentro da categoria.
 * Dados vêm do contexto: context.article (alias) e context.siblings (lista ordenada de
 * { alias, title } da mesma categoria); context.link opcional. Emite HTML em
 * onContentAfterDisplay (o manager o sanitiza).
 */
import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';

export function pageNavigation({ article, siblings, link = (path) => `#${path}` } = {}) {
  const list = (Array.isArray(siblings) ? siblings : []).filter((a) => a && a.alias);
  const index = article ? list.findIndex((a) => a.alias === article.alias) : -1;
  if (index < 0) return '';
  const item = (a, label) => `<li><a href="${escapeHtml(link(`/article/${encodeURIComponent(a.alias)}`))}">${label}: ${escapeHtml(a.title)}</a></li>`;
  const parts = [list[index - 1] && item(list[index - 1], 'Anterior'), list[index + 1] && item(list[index + 1], 'Próximo')].filter(Boolean);
  return parts.length ? `<ul>${parts.join('')}</ul>` : '';
}

export const pagenavigationPlugin = {
  name: 'pagenavigation', group: 'content',
  events: { onContentAfterDisplay: (context) => pageNavigation(context) }
};
