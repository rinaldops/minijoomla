import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { heading, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';
import { defaultLink, empty } from '../../../libraries/minijoomla/modules/module-helpers.js';

export function renderDefault({ state = 'ready', categories = [], settings = {}, message, link = defaultLink, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const all = (Array.isArray(categories) ? categories : []).filter((c) => c && c.alias);
  const maxLevel = Math.min(10, Math.max(1, Math.trunc(Number(settings?.maxLevel)) || 1));
  const parent = settings?.parent === undefined || settings.parent === '' ? null : String(settings.parent);
  const key = (value) => (value === undefined || value === null || value === '' ? null : String(value));
  const build = (parentKey, level, seen) => {
    const rows = all.filter((c) => key(c.parentId) === parentKey && !seen.has(c));
    if (!rows.length) return '';
    return `<ul>${rows.map((c) => {
      const count = settings?.showCount ? ` (${Number(c.count) || 0})` : '';
      const nested = level < maxLevel && key(c.id) !== null ? build(key(c.id), level + 1, new Set([...seen, c])) : '';
      return `<li><a href="${escapeHtml(link(`/category/${encodeURIComponent(c.alias)}`))}">${escapeHtml(c.title)}</a>${count}${nested}</li>`;
    }).join('')}</ul>`;
  };
  const list = build(parent, 1, new Set());
  return list ? `<section class="module module-articles-categories">${heading('Categorias', chrome)}${list}</section>` : empty('Nenhuma categoria disponível.');
}
