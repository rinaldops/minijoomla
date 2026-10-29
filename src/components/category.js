import { escapeHtml } from '../security/sanitize.js';
import { renderArticleList } from './content.js';
export function renderCategory(viewModel = {}, options = {}) { const category = viewModel.category ?? {}; return `<section class="category-page"><p class="eyebrow">Categoria</p><h1>${escapeHtml(category.title)}</h1><p>${escapeHtml(category.description)}</p>${renderArticleList(viewModel, options)}</section>`; }
