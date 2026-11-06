import assert from 'node:assert/strict';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { runContentAdapterContract } from './adapter-contract.test.js';

function repository(items, calls = []) {
  return { findMany: async (query, options) => { calls.push({ query, options }); return { items }; } };
}

function makeAdapter(overrides = {}) {
  const calls = [];
  const adapter = createSPMiddleAdapter({
    articleRepository: repository([
      { id: 1, title: 'Artigo', alias: 'artigo', introtext: 'Resumo', fulltext: 'Texto', categoryId: 10, state: 'Published', featured: true, publishUp: '2026-01-01', tags: [{ name: 'guia' }, { name: 'local' }], transport: 'discard-me' },
      { id: 2, title: 'Segundo', alias: 'segundo', introtext: '', fulltext: '', categoryId: 10, state: 1, featured: false, publishUp: '2026-02-01', tags: 'guia, arquitetura' },
      { id: 3, title: 'Expirado', alias: 'expirado', categoryId: 10, state: 'Published', publishUp: '2025-01-01', publishDown: '2026-01-01', tags: ['guia'] },
      { id: 4, title: 'Rascunho', alias: 'rascunho', categoryId: 10, state: 'Draft', tags: ['guia'] }
    ], calls),
    categoryRepository: repository([{ id: 10, title: 'Notícias', alias: 'noticias', parentId: null }, { id: 11, title: 'Filha', alias: 'filha', parentId: { id: 10 } }], calls),
    tagRepository: repository([{ id: 20, name: 'guia' }, { id: 21, name: 'local' }], calls),
    menuRepository: repository([
      { id: 30, title: 'Início', path: '/', published: 'Published', ordering: 2 },
      { id: 31, title: 'Oculto', path: '/hidden', published: 'Draft', ordering: 1 },
      { id: 32, title: 'Primeiro', path: '/first', parentId: 30, published: 1, ordering: 1 }
    ], calls),
    now: new Date('2026-10-31T00:00:00Z'),
    ...overrides
  });
  return { adapter, calls };
}

export async function runSPMiddleAdapterTests() {
  const { adapter, calls } = makeAdapter();
  assert.equal((await adapter.getArticle('artigo')).title, 'Artigo');
  assert.equal((await adapter.getArticle('expirado')), null);
  assert.equal((await adapter.getArticle('rascunho')), null);
  assert.deepEqual((await adapter.listArticles({ category: 'noticias', page: 2, pageSize: 1 })).items.map((item) => item.alias), ['artigo']);
  assert.equal((await adapter.listArticles({ pageSize: 100 })).pageSize, 5, 'out-of-range limits fall back instead of coercing');
  assert.equal((await adapter.getCategoryPath('filha')).length, 2);
  assert.equal((await adapter.listArticlesByTag('guia')).total, 2);
  assert.deepEqual(await adapter.listSimilarArticles('artigo'), [(await adapter.getArticle('segundo'))]);
  assert.deepEqual(await adapter.listSimilarArticles('artigo', { now: '2025-01-01T00:00:00Z' }), []);
  assert.equal((await adapter.listTags({ popular: true }))[0].count, 2);
  assert.deepEqual((await adapter.listMenus()).map((item) => item.path), ['/', '/first']);
  assert.deepEqual((await adapter.listMenus()).map(({ id, parentId }) => ({ id, parentId })), [
    { id: 30, parentId: null }, { id: 32, parentId: 30 }
  ]);
  const hierarchy = makeAdapter({ menuRepository: repository([
    { id: 1, path: '/hidden', published: false },
    { id: 2, parentId: 1, path: '/hidden/child', published: true },
    { id: 3, parentId: 2, path: '/hidden/grandchild', published: true },
    { id: 4, parentId: 99, path: '/orphan', published: true },
    { id: 5, parentId: 6, path: '/cycle-a', published: true },
    { id: 6, parentId: 5, path: '/cycle-b', published: true }
  ]) }).adapter;
  assert.deepEqual((await hierarchy.listMenus()).map((item) => item.id), [4, 5, 6]);
  assert.equal((await adapter.listCategories()).some((item) => item.transport), false);
  assert.equal(calls.every((call) => call.options?.maxPages === 100 && call.options?.maxItems === 10000), true);

  const emptyCategory = await adapter.listArticles({ category: 'inexistente' });
  assert.equal(emptyCategory.total, 0);
  assert.equal(emptyCategory.items.length, 0);

  // mod_articles_archive: agrupamento por ano/mês (publishUp de "artigo" e "segundo"), ordenado do mais recente ao mais antigo
  assert.deepEqual(await adapter.listArchive(), [{ year: 2026, month: 2, count: 1 }, { year: 2026, month: 1, count: 1 }]);
  assert.deepEqual((await adapter.listArticles({ year: 2026, month: 1 })).items.map((item) => item.alias), ['artigo']);
  assert.equal((await adapter.listArchive({ limit: 1 })).length, 1);

  const custom = createSPMiddleAdapter({
    articleRepository: repository([{ key: 7, heading: 'Mapper', slug: 'mapper', status: 'published', labels: [{ title: 'schema-tag' }], starts: '2026-01-01' }]),
    categoryRepository: repository([]), fields: { article: { id: 'key', title: 'heading', alias: 'slug', state: 'status', tags: 'labels', publishUp: 'starts' } }, now: '2026-10-31'
  });
  assert.deepEqual(await custom.getArticle('mapper'), {
    id: 7, title: 'Mapper', alias: 'mapper', introtext: '', fulltext: '', categoryId: undefined, published: true,
    featured: false, publishUp: '2026-01-01', publishDown: null, author: '', tags: ['schema-tag']
  });
  const metadata = createSPMiddleAdapter({
    articleRepository: repository([{ id: 1, alias: 'meta', title: 'Metadata', keywords: 'energia, solar', description: 'Editorial', transport: 'discard-me' }]),
    categoryRepository: repository([]), fields: { article: { metaKeywords: 'keywords', metaDescription: 'description' } }
  });
  for (const article of [await metadata.getArticle('meta'), (await metadata.listArticles()).items[0]]) {
    assert.equal(article.metaKeywords, 'energia, solar');
    assert.equal(article.metaDescription, 'Editorial');
    assert.equal(article.transport, undefined);
  }

  // regressão: quando não há override determinístico, o adapter avalia o relógio por chamada
  const withoutOverride = createSPMiddleAdapter({
    articleRepository: repository([{ id: 9, title: 'Relógio', alias: 'relogio', state: 'Published', publishUp: null }]),
    categoryRepository: repository([])
  });
  const previousDate = globalThis.Date;
  try {
    let callsNow = 0;
    globalThis.Date = class extends previousDate {
      constructor(...args) {
        if (args.length) return new previousDate(...args);
        callsNow += 1;
        return new previousDate('2026-10-31T00:00:00Z');
      }
      static now() { return previousDate.now(); }
      static parse(value) { return previousDate.parse(value); }
      static UTC(...args) { return previousDate.UTC(...args); }
    };
    await withoutOverride.getArticle('relogio');
    await withoutOverride.listArticles();
    assert.ok(callsNow >= 2);
    let clockReads = 0;
    globalThis.Date = class extends previousDate {
      constructor(...args) { if (args.length) return new previousDate(...args); clockReads += 1; return new previousDate('2026-10-31T00:00:00Z'); }
      static now() { return previousDate.now(); }
      static parse(value) { return previousDate.parse(value); }
      static UTC(...args) { return previousDate.UTC(...args); }
    };
    await withoutOverride.listArticles();
    assert.equal(clockReads, 1);
    assert.equal((await withoutOverride.getArticle('relogio'))?.alias, 'relogio');
  } finally {
    globalThis.Date = previousDate;
  }

  const failure = new Error('transport detail must remain outside the domain result');
  const failing = createSPMiddleAdapter({ articleRepository: { findMany: async () => { throw failure; } }, categoryRepository: repository([]) });
  await assert.rejects(() => failing.getArticle('artigo'), (error) => error === failure);

  const count = await runContentAdapterContract({ adapter, fixture: { knownAlias: 'artigo', unknownAlias: 'ausente', knownTag: 'guia', knownCategoryAlias: 'noticias', unknownCategoryAlias: 'inexistente' } });
  console.log(`spmiddle adapter: ${count + 18} testes aprovados`);
}
