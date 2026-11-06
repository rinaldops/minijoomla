import assert from 'node:assert/strict';
import { createFakeAdapter } from '../src/libraries/minijoomla/infrastructure/fake-adapter.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';

export async function runFeaturedScheduleTests() {
  const start = '2026-11-03T10:30:59.123Z';
  const end = '2026-11-03T11:30:59.123Z';
  const rows = [{ id: 1, title: 'Programado', alias: 'scheduled', published: true, state: 'Published', featured: true, featuredUp: start, featuredDown: end, tags: ['shared'] },
    { id: 2, title: 'Relacionado', alias: 'related', published: true, state: 'Published', featured: false, tags: ['shared'] }];
  const repo = (items) => ({ findMany: async () => ({ items }) });
  const fake = createFakeAdapter({ articles: rows, categories: [], menus: [] });
  const remote = createSPMiddleAdapter({ articleRepository: repo(rows), categoryRepository: repo([]), tagRepository: repo([]), menuRepository: repo([]) });
  for (const [now, featured] of [[new Date(Date.parse(start) - 1), false], [start, true], [new Date(Date.parse(end) - 1), true], [end, false], ['invalid', false]]) {
    for (const adapter of [fake, remote]) {
      assert.equal((await adapter.listArticles({ featured: true, now })).total, Number(featured));
      if (now !== 'invalid') {
        assert.equal((await adapter.getArticle('scheduled', { now })).featured, featured);
        assert.equal((await adapter.listSimilarArticles('related', { now }))[0].featured, featured);
      }
    }
  }
  assert.equal(rows[0].featured, true, 'mapping must not mutate stored featured');
  for (const featuredUp of ['broken', '2099-01-01']) {
    const adapter = createFakeAdapter({ articles: [{ ...rows[0], featuredUp }] });
    assert.equal((await adapter.listArticles({ featured: true, now: start })).total, 0);
  }
  console.log('ok - FakeAdapter and SPMIDDLE agree on featured schedule, exact boundaries, detail/similar snapshots and invalid windows');
}
