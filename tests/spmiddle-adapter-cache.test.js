import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';

function repository(items) {
  const repo = { calls: 0, findMany: async () => { repo.calls += 1; if (repo.fail) throw new Error('falha'); return { items }; } };
  return repo;
}

export async function runSPMiddleAdapterCacheTests() {
  const articles = repository([{ id: 1, title: 'A', alias: 'a', state: 'Published', categoryId: 1 }]);
  const categories = repository([{ id: 1, title: 'C', alias: 'c' }]);
  let clock = 1000;
  const cached = createSPMiddleAdapter({ articleRepository: articles, categoryRepository: categories, cacheMs: 5000, clockMs: () => clock });
  await Promise.all([cached.listArticles({}), cached.getArticle('a'), cached.getCategory('c')]);
  assert.equal(articles.calls, 1, 'leituras na mesma navegação compartilham a consulta');
  clock += 5001;
  await cached.listArticles({});
  assert.equal(articles.calls, 2, 'cache expira');

  articles.fail = true;
  clock += 5001;
  await assert.rejects(() => cached.listArticles({}));
  articles.fail = false;
  await cached.listArticles({});
  assert.equal(articles.calls, 4, 'falha nunca fica em cache');

  const fresh = repository([{ id: 1, title: 'A', alias: 'a', state: 'Published', categoryId: 1 }]);
  const uncached = createSPMiddleAdapter({ articleRepository: fresh, categoryRepository: categories });
  await uncached.listArticles({});
  await uncached.listArticles({});
  assert.equal(fresh.calls, 2, 'sem cacheMs sempre relê');
  console.log('ok - spmiddle adapter cache: consulta compartilhada, expiração, sem cache de falha, desligado por padrão');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runSPMiddleAdapterCacheTests();
