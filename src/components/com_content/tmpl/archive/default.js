import { escapeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';
import { renderArticleList } from '../article/default.js';
import { formatMonthYear } from '../../../../libraries/minijoomla/core/format.js';

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) => [index + 1, new Date(Date.UTC(2000, index, 1)).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })]);

// tmpl/archive: year/month filter; bound to the router through data-mj-route (no reload).
function renderFilter(months = [], year, month) {
  const years = [...new Set(months.map((entry) => entry.year))].sort((a, b) => b - a).map((value) => [value, value]);
  const options = (values, selected) => `<option value="">Todos</option>${values.map(([value, text]) => `<option value="${escapeHtml(value)}"${String(selected ?? '') === String(value) ? ' selected' : ''}>${escapeHtml(text)}</option>`).join('')}`;
  return `<form class="archive-filter" data-mj-route="/archive" aria-label="Filtrar arquivo"><label for="archive-year">Ano</label><select id="archive-year" name="year">${options(years, year)}</select><label for="archive-month">Mês</label><select id="archive-month" name="month">${options(MONTH_NAMES, month)}</select><button type="submit">Filtrar</button></form>`;
}

export function renderArchive(result, { year, month, months, link = (page) => `#/archive?page=${page}`, articleLink = (alias) => `#/article/${encodeURIComponent(alias)}`, timezone = 'America/Sao_Paulo', componentParams } = {}) {
  const label = formatMonthYear(year, month);
  return `<section class="archive-page"><p class="eyebrow">Arquivo</p><h1>${label ? escapeHtml(label) : 'Arquivo'}</h1>${renderFilter(months, year, month)}${renderArticleList(result, { link, articleLink, timezone, componentParams })}</section>`;
}
