import assert from 'node:assert/strict';
import { renderArticlesTable } from '../src/administrator/components/com_content/tmpl/articles/default.js';
import { formatMediaSize, renderMediaFiles } from '../src/administrator/components/com_media/tmpl/media/default.js';

export function runAdminComponentViewsTests() {
  const link = (path, params = {}) => `${path}?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined))}`;
  assert.equal(renderArticlesTable({ rows: [], total: 0 }, { link }), '<p class="admin-empty" role="status">Nenhum artigo encontrado.</p>');
  const hostile = '<img src=x onerror=alert(1)>';
  const article = renderArticlesTable({ total: 1, rows: [{
    id: 7, title: hostile, alias: hostile, note: hostile, categoryTitle: hostile, author: hostile, authorAlias: hostile,
    state: 'Published', featured: true, publishUp: '2030-02-03T00:00:00Z', publishDown: null,
    featuredUp: '2030-02-03T00:00:00Z', featuredDown: null
  }] }, { link, params: { sort: 'title', dir: 'desc', q: 'news' }, now: new Date('2029-01-01T00:00:00Z') });
  assert.match(article, /Publicação agendada/);
  assert.match(article, /Destaque agendado/);
  assert.ok(article.includes(new Date('2030-02-03T00:00:00Z').toLocaleDateString('pt-BR')), 'date follows the local timezone, not the author machine');
  assert.match(article, /aria-sort="descending"/);
  assert.match(article, /sort=title&amp;dir=asc/);
  assert.match(article, /q=news/);
  assert.doesNotMatch(article, /<img src=x/);
  const asc = renderArticlesTable({ total: 0, rows: [{ id: 1, state: 'Draft' }] }, { link, params: { sort: 'author', dir: 'asc' } });
  assert.match(asc, /aria-sort="ascending"/);

  assert.equal(renderMediaFiles([]), '<p class="admin-empty" role="status">Nenhum arquivo na pasta de uploads.</p>');
  const media = renderMediaFiles([{ name: hostile, url: 'javascript:alert(1)', size: 1024, modified: '2024-01-02', isImage: true }], { canDelete: false });
  assert.match(media, /href="#" target="_blank" rel="noopener"/);
  assert.match(media, /Copiar URL/);
  assert.doesNotMatch(media, /data-ext-action="delete"/);
  assert.doesNotMatch(media, /<img src=x/);
  assert.match(renderMediaFiles([{ name: hostile, url: '/uploads/a.jpg', size: 0 }], { canDelete: true }), /data-ext-action="delete" data-ext-id="0"/);
  assert.equal(formatMediaSize(1024), '1.0 KiB');
  console.log('ok - admin component views: article/media tables, escaping, dates, sort and delete gating');
}
