import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';

export function renderDate(value, timezone = 'America/Sao_Paulo') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  let label;
  try { label = date.toLocaleDateString('pt-BR', { timeZone: timezone }); }
  catch { label = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  return `<time datetime="${escapeHtml(date.toISOString())}">${escapeHtml(label)}</time>`;
}

export function renderInfoBlock(article, params, { timezone, categoryLink }) {
  const author = String(article.authorAlias ?? '').trim() || String(article.author ?? '').trim();
  const rows = [
    params.showCategory && article.category && `<dd class="category-name">Categoria: ${categoryLink ? `<a href="${escapeHtml(categoryLink(article.categoryAlias ?? article.category))}">${escapeHtml(article.category)}</a>` : escapeHtml(article.category)}</dd>`,
    params.showAuthor && author && `<dd class="createdby">Por ${escapeHtml(author)}</dd>`,
    params.showPublishDate && article.publishUp && `<dd class="published">Publicado em ${renderDate(article.publishUp, timezone)}</dd>`,
    params.showModifyDate && article.modified && `<dd class="modified">Atualizado em ${renderDate(article.modified, timezone)}</dd>`,
    params.showCreateDate && article.created && `<dd class="create">Criado em ${renderDate(article.created, timezone)}</dd>`
  ].filter(Boolean);
  return rows.length ? `<dl class="article-info"><dt class="visually-hidden">Detalhes</dt>${rows.join('')}</dl>` : '';
}
