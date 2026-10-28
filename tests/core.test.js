import assert from 'node:assert/strict';
import { Router } from '../src/core/router.js';
import { createFakeAdapter } from '../src/infrastructure/fake-adapter.js';
import { escapeHtml, safeUrl, sanitizeHtml } from '../src/security/sanitize.js';
import { createModuleRegistry, menuModule, breadcrumbsModule } from '../src/modules/registry.js';
import { articlesLatestModule, tagsPopularModule } from '../src/modules/content-modules.js';
import { renderSearch } from '../src/components/search.js';
import { normalizeQuery } from '../src/core/contracts.js';

export async function runTests() {
  const tests = [
    ['router parses paths, query and named parameters', () => { const router = new Router(); const result = router.match('#/article/abc?q=x', [{ name: 'article', pattern: /^\/article\/([^/]+)$/, keys: ['alias'] }]); assert.equal(result.route.name, 'article'); assert.equal(result.params.alias, 'abc'); assert.equal(result.params.q, 'x'); }],
    ['fake adapter filters and paginates visible content without network', async () => { const adapter = createFakeAdapter({ articles: [{ title: 'A', alias: 'a', introtext: 'energia', published: true, publishUp: '2020-01-01', tags: ['energia'] }, { title: 'B', alias: 'b', introtext: '', published: false, publishUp: '2020-01-01', tags: [] }] }); const result = await adapter.listArticles({ search: 'energia', now: '2026-01-01' }); assert.equal(result.total, 1); assert.equal(result.items[0].alias, 'a'); assert.deepEqual(await adapter.listTags(), ['energia']); }],
    ['fake adapter respects expiry, tag filters and page limits', async () => { const adapter = createFakeAdapter({ articles: [{ alias: 'old', title: 'Old', introtext: '', published: true, publishUp: '2020-01-01', publishDown: '2025-01-01', tags: ['x'] }, { alias: 'new', title: 'New', introtext: '', published: true, publishUp: '2020-01-01', tags: ['x'] }] }); const result = await adapter.listArticlesByTag('x', { now: '2026-01-01', pageSize: 0 }); assert.equal(result.total, 1); assert.equal(result.pageSize, 5); assert.equal(result.items[0].alias, 'new'); }],
    ['sanitization escapes and blocks executable content', () => { assert.equal(escapeHtml('<x>'), '&lt;x&gt;'); assert.equal(safeUrl('javascript:alert(1)'), '#'); assert.equal(safeUrl('https://user:pass@example.com'), '#'); assert.equal(sanitizeHtml('<p onclick="x()">ok</p><script>alert(1)</script>'), '<p>ok</p>alert(1)'); }],
    ['navigation modules escape external data', () => { const menu = menuModule.render({ menus: [{ title: '<img>', path: '/x' }] }); const crumbs = breadcrumbsModule.render({ items: ['<script>'] }); assert.ok(menu.includes('&lt;img&gt;')); assert.ok(!menu.includes('<img>')); assert.ok(crumbs.includes('&lt;script&gt;')); }]
    ,['content modules expose loading, empty and ready states', () => { assert.match(articlesLatestModule.render({ state: 'loading' }), /Carregando/); assert.match(articlesLatestModule.render({ articles: [] }), /Nenhum artigo/); assert.match(articlesLatestModule.render({ articles: [{ alias: 'x', title: '<X>' }] }), /&lt;X&gt;/); assert.match(tagsPopularModule.render({ tags: ['energia'] }), /energia/); }]
    ,['search component escapes query and renders a form', () => { const html = renderSearch('<script>', { items: [], total: 0 }); assert.match(html, /&lt;script&gt;/); assert.match(html, /name="q"/); }]
    ,['module registry orders positions and skips disabled modules', () => { const registry = createModuleRegistry(); registry.register('a', { settings: {}, render: () => 'A' }).register('b', { settings: {}, render: () => 'B' }); assert.equal(registry.renderPosition('sidebar', [{ name: 'b', order: 2 }, { name: 'a', order: 1, enabled: false }]), 'B'); }]
    ,['search contract limits query and searches full text', async () => { assert.equal(normalizeQuery('  abc  '), 'abc'); const adapter = createFakeAdapter({ articles: [{ title: 'A', alias: 'a', introtext: '', fulltext: 'energia', published: true, publishUp: '2020-01-01', tags: [] }] }); const result = await adapter.listArticles({ search: 'energia', now: '2026-01-01' }); assert.equal(result.total, 1); }]
    ,['module contract rejects missing settings and accepts schemas', () => { const registry = createModuleRegistry(); assert.throws(() => registry.register('invalid', { render: () => '' }), TypeError); registry.register('valid', { settings: {}, settingsSchema: {}, render: () => 'ok' }); assert.equal(registry.has('valid'), true); }]
  ];
  for (const [name, test] of tests) { await test(); console.log(`ok - ${name}`); }
}
