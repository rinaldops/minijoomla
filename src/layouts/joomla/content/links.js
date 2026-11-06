import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';
import { parseJsonObject } from '../../../libraries/minijoomla/application/declared-params.js';

export function renderLinks(article) {
  const urls = parseJsonObject(article?.attribsJson).urls;
  const items = ['a', 'b', 'c'].map((letter) => {
    const href = safeUrl(String(urls?.[`url${letter}`] ?? ''));
    return href && href !== '#' ? `<li><a href="${href}">${escapeHtml(urls[`url${letter}text`] || urls[`url${letter}`])}</a></li>` : '';
  }).join('');
  return items ? `<ul class="article-links">${items}</ul>` : '';
}
