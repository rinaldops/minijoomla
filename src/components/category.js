import { escapeHtml } from '../security/sanitize.js';
import { renderArticleList } from './content.js';
export function renderCategory(viewModel) { return `<section class="category-page"><p class="eyebrow">Categoria</p><h1>${escapeHtml(viewModel.category.title)}</h1><p>${escapeHtml(viewModel.category.description)}</p>${renderArticleList(viewModel)}</section>`; }
