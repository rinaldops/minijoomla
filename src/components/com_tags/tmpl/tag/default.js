import { escapeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';
import { renderBlog } from '../../../com_content/tmpl/category/blog.js';

export function renderTag(viewModel, options = {}) {
  return `<section class="tag-page"><p class="eyebrow">Tag</p><h1>${escapeHtml(viewModel.tag)}</h1>${renderBlog(viewModel, options)}</section>`;
}
