import assert from 'node:assert/strict';
import { renderArticle } from '../src/components/com_content/tmpl/article/default.js';
import { createFakeAdapter } from '../src/libraries/minijoomla/infrastructure/fake-adapter.js';

/*
 * Reusable conformance suite for any content adapter (fake or future
 * SPMiddleAdapter). Mirrors the contract documented in
 * docs/CONTRACTS-MINIJOOMLA.md: `ref` is always a string alias/tag, single
 * reads resolve `null` instead of throwing for "not found", paginated reads
 * always return the fixed Page shape, and non-paginated list reads always
 * resolve an array. Any adapter that passes this suite can replace the fake
 * without requiring changes to components, modules or templates.
 */
function assertPageShape(result, label) {
  assert.ok(result && typeof result === 'object', `${label} deve retornar um objeto Page.`);
  assert.ok(Array.isArray(result.items), `${label}.items deve ser um array.`);
  assert.equal(typeof result.total, 'number', `${label}.total deve ser number.`);
  assert.equal(typeof result.page, 'number', `${label}.page deve ser number.`);
  assert.equal(typeof result.pageSize, 'number', `${label}.pageSize deve ser number.`);
  assert.equal(typeof result.pages, 'number', `${label}.pages deve ser number.`);
}

export async function runContentAdapterContract({ adapter, fixture, report = () => {} } = {}) {
  assert.ok(adapter && typeof adapter === 'object', 'adapter é obrigatório.');
  assert.ok(fixture && typeof fixture === 'object', 'fixture é obrigatório.');
  const { knownAlias, unknownAlias, knownTag, knownCategoryAlias, unknownCategoryAlias } = fixture;

  const tests = [
    ['getArticle resolves null for an unknown alias instead of throwing', async () => {
      assert.equal(await adapter.getArticle(unknownAlias), null);
    }],
    ['getArticle resolves the entity for a known alias without throwing', async () => {
      const article = await adapter.getArticle(knownAlias);
      assert.ok(article && typeof article === 'object');
      assert.equal(article.alias, knownAlias);
    }],
    ['listArticles resolves a well-formed Page even with no filters', async () => {
      assertPageShape(await adapter.listArticles(), 'listArticles()');
    }],
    ['pagination limits reject coercible and fractional values and retain a valid default', async () => {
      const fallback = (await adapter.listArticles()).pageSize;
      for (const pageSize of [true, false, [], [2], {}, 1.5, '2.5', 0, 51, Infinity, NaN, '', null]) {
        const result = await adapter.listArticles({ pageSize });
        assert.equal(result.pageSize, fallback);
        assert.ok(Number.isInteger(result.pages));
      }
      for (const pageSize of [1, 50, '2']) assert.equal((await adapter.listArticles({ pageSize })).pageSize, Number(pageSize));
    }],
    ['getCategory resolves null for an unknown alias and an entity for a known one', async () => {
      assert.equal(await adapter.getCategory(unknownCategoryAlias), null);
      const category = await adapter.getCategory(knownCategoryAlias);
      assert.ok(category && typeof category === 'object');
      assert.equal(category.alias, knownCategoryAlias);
    }],
    ['listCategories, listMenus and listTags always resolve arrays', async () => {
      assert.ok(Array.isArray(await adapter.listCategories()));
      assert.ok(Array.isArray(await adapter.listMenus()));
      assert.ok(Array.isArray(await adapter.listTags()));
    }],
    ['getCategoryPath resolves an array, never null or undefined', async () => {
      assert.ok(Array.isArray(await adapter.getCategoryPath(knownCategoryAlias)));
      assert.ok(Array.isArray(await adapter.getCategoryPath(unknownCategoryAlias)));
    }],
    ['listArticlesByTag delegates to the same Page shape as listArticles', async () => {
      assertPageShape(await adapter.listArticlesByTag(knownTag), 'listArticlesByTag()');
    }],
    ['listSimilarArticles resolves an empty array for an unknown alias instead of throwing', async () => {
      assert.deepEqual(await adapter.listSimilarArticles(unknownAlias), []);
    }],
    ['dates accepted by the article view produce identical output as ISO string or Date instance', () => {
      const iso = '2026-01-01T12:00:00.000Z';
      const base = { title: 'Data', category: 'noticias', author: 'Autor', introtext: '', fulltext: '', tags: [] };
      assert.equal(renderArticle({ ...base, publishUp: iso }), renderArticle({ ...base, publishUp: new Date(iso) }));
    }]
  ];

  let count = 0;
  for (const [name, test] of tests) {
    await test();
    report(name);
    count += 1;
  }
  return count;
}

/*
 * Runs the conformance suite against the default FakeAdapter fixture
 * (docs/HANDOFF-DESENVOLVIMENTO.md's seed articles/category), proving the
 * reference implementation satisfies the frozen contract end to end.
 */
export async function runAdapterContractTests() {
  const adapter = createFakeAdapter();
  const count = await runContentAdapterContract({
    adapter,
    fixture: {
      knownAlias: 'boas-vindas',
      unknownAlias: 'alias-inexistente',
      knownTag: 'guia',
      knownCategoryAlias: 'noticias',
      unknownCategoryAlias: 'categoria-inexistente'
    },
    report: (name) => console.log(`ok - adapter contract: ${name}`)
  });
  console.log(`adapter contract: ${count} testes aprovados`);
}
