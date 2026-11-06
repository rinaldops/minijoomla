import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { formatMonthYear } from '../../../libraries/minijoomla/core/format.js';
import { heading, limited, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';

export function renderDefault({ state = 'ready', months = [], settings, message, link = (path, params) => `#${path}?year=${params?.year ?? ''}&month=${params?.month ?? ''}`, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const entries = limited(months, settings, 12);
  if (!entries.length) return '<p class="module-empty" role="status">Nenhum arquivo disponível.</p>';
  return `<section class="module module-articles-archive">${heading('Arquivo', chrome)}<ul>${entries.map((entry) => `<li><a href="${escapeHtml(link('/archive', { year: entry.year, month: entry.month }))}">${escapeHtml(formatMonthYear(entry.year, entry.month))} (${Number(entry.count) || 0})</a></li>`).join('')}</ul></section>`;
}
