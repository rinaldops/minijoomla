import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';

export function renderPagination(result, link) {
  if (!(result?.pages > 1)) return '';
  const { page, pages } = result;
  const anchor = (target, label, extra = '') => `<a href="${escapeHtml(link(target))}"${extra}>${label}</a>`;
  const first = Math.max(1, Math.min(page - 4, pages - 9));
  const numbers = Array.from({ length: Math.min(10, pages - first + 1) }, (_, index) => first + index)
    .map((number) => anchor(number, number, number === page ? ' aria-current="page"' : ''));
  return `<nav class="pagination" aria-label="Paginação"><span>Página ${page} de ${pages}</span>${page > 1 ? anchor(1, 'Início') + anchor(page - 1, 'Anterior') : ''}${numbers.join('')}${page < pages ? anchor(page + 1, 'Próxima') + anchor(pages, 'Fim') : ''}</nav>`;
}
