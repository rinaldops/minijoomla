import assert from 'node:assert/strict';
import { Router } from '../src/core/router.js';
import { createFakeAdapter } from '../src/infrastructure/fake-adapter.js';
import { escapeHtml, safeUrl, sanitizeHtml } from '../src/security/sanitize.js';

export async function runTests() {
  const tests = [
    ['router parses paths, query and named parameters', () => { const router = new Router(); const result = router.match('#/article/abc?q=x', [{ name: 'article', pattern: /^\/article\/([^/]+)$/, keys: ['alias'] }]); assert.equal(result.route.name, 'article'); assert.equal(result.params.alias, 'abc'); assert.equal(result.params.q, 'x'); }],
    ['fake adapter filters and paginates visible content without network', async () => { const adapter = createFakeAdapter({ articles: [{ title: 'A', alias: 'a', introtext: 'energia', published: true, publishUp: '2020-01-01', tags: [] }, { title: 'B', alias: 'b', introtext: '', published: false, publishUp: '2020-01-01', tags: [] }] }); const result = await adapter.listArticles({ search: 'energia' }); assert.equal(result.total, 1); assert.equal(result.items[0].alias, 'a'); }],
    ['sanitization escapes and blocks executable content', () => { assert.equal(escapeHtml('<x>'), '&lt;x&gt;'); assert.equal(safeUrl('javascript:alert(1)'), '#'); assert.equal(sanitizeHtml('<p onclick="x()">ok</p><script>alert(1)</script>'), '<p>ok</p>alert(1)'); }]
  ];
  for (const [name, test] of tests) { await test(); console.log(`ok - ${name}`); }
}
