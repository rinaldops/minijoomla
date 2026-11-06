import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';

export function renderTags(tags = [], link = (path) => `#${path}`) {
  const safeTags = Array.isArray(tags) ? tags : [];
  return safeTags.length ? `<ul class="article-tags" aria-label="Tags">${safeTags.map((tag) => `<li><a href="${escapeHtml(link(`/tag/${encodeURIComponent(tag)}`))}">${escapeHtml(tag)}</a></li>`).join('')}</ul>` : '';
}
