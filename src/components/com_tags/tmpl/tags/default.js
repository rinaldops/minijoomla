import { escapeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';

export function renderTagList(tags = [], { tagLink = (name) => `#/tag/${encodeURIComponent(name)}` } = {}) {
  const list = tags.length
    ? `<ul class="tags-list">${tags.map(({ name, count }) => `<li><a href="${escapeHtml(tagLink(name))}">${escapeHtml(name)}</a>${count === undefined ? '' : ` <span class="badge" title="Artigos">${Number(count)}</span>`}</li>`).join('')}</ul>`
    : '<p class="empty-state" role="status">Nenhuma tag encontrada.</p>';
  return `<section class="tags-page"><p class="eyebrow">Tags</p><h1>Tags</h1>${list}</section>`;
}
