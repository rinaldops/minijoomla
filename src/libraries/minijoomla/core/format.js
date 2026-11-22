/*
 * Formatação de ano/mês independente de view — usada pela página de
 * arquivo (src/components/com_content/tmpl/archive/default.js) e pelo módulo mod_articles_archive
 * (src/libraries/minijoomla/modules/content-runtime.js), por isso vive em core/ (camada
 * compartilhada), não em components/ ou modules/.
 */
export function formatMonthYear(year, month, locale = 'pt-BR') {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return '';
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, 1));
  let label;
  try { label = date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  catch { label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/*
 * `new Date('2026-01-01')` trata a string SEM hora como UTC meia-noite;
 * exibida em UTC-3 (America/Sao_Paulo) ela volta um dia — 01/01/2026
 * aparecia como 31/12/2025 nas listagens administrativas. Aqui a data de
 * calendário é montada com componentes locais, preservando o dia que o
 * usuário digitou; strings com hora (ISO completo) continuam sendo
 * interpretadas como instante real, e valores não parseáveis devolvem ''.
 */
export function parseLocalDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const match = DATE_ONLY.exec(String(value).trim());
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDate(value, locale = 'pt-BR') {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString(locale) : '';
}
