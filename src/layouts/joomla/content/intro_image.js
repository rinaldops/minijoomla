import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';
import { parseJsonObject } from '../../../libraries/minijoomla/application/declared-params.js';

function renderImage(article, kind) {
  const images = parseJsonObject(article?.attribsJson).images;
  const data = images && typeof images === 'object' ? images : {};
  const src = safeUrl(String(data[`image_${kind}`] ?? ''));
  if (!data[`image_${kind}`] || src === '#') return '';
  const caption = String(data[`image_${kind}_caption`] ?? '').trim();
  return `<figure class="image-${kind}"><img src="${src}" alt="${escapeHtml(data[`image_${kind}_alt`] ?? '')}" loading="lazy">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
}

export const renderIntroImage = (article) => renderImage(article, 'intro');
export const renderFullImage = (article) => renderImage(article, 'fulltext');
