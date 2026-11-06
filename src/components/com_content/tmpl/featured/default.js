import { escapeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';
import { renderBlog } from '../category/blog.js';

// components/com_content/tmpl/featured: same blog layout as a category.
export function renderFeatured(result, { siteName, siteDescription, ...options } = {}) {
  return `<section class="featured-page"><p class="eyebrow">Início</p><h1>${escapeHtml(siteName)}</h1><p>${escapeHtml(siteDescription)}</p>${result ? renderBlog(result, options) : '<p class="empty-state" role="status">Nenhum conteúdo publicado ainda.</p>'}</section>`;
}
