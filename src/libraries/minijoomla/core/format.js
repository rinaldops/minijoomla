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
