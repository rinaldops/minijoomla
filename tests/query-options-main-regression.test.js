import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApplication } from '../src/index.js';
import { createConfig } from '../src/libraries/minijoomla/core/config.js';
import { normalizeQuery } from '../src/libraries/minijoomla/core/contracts.js';
import { createContentService, resolveContentQuery } from '../src/libraries/minijoomla/application/content-service.js';
import { resolveComponentParams } from '../src/libraries/minijoomla/application/component-options.js';
import { toSiteConfigOverrides } from '../src/libraries/minijoomla/application/site-config-overrides.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';

// Preserved from the main consolidation snapshot (2026-11-09). Contract
// adaptations below are explicit; the existing step2 suite remains separate.
function queryConfig(stored, pageSize = 5) {
  const record = { componentParamsJson: stored === undefined ? undefined : JSON.stringify(stored), pageSize };
  return createConfig({ ...record, componentParams: resolveComponentParams(record) });
}
function documentDouble() {
  return { body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }, documentElement: {} };
}
function mainHtml(html) {
  const content = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
  assert.ok(content, 'runtime must render main content without a load error');
  assert.doesNotMatch(content[1], /Não foi possível carregar/);
  return content[1];
}
function aliases(html) {
  return [...mainHtml(html).matchAll(/href="#\/portal\/article\/([^"]+)"/g)].map((match) => match[1]).filter((alias, index, list) => list.indexOf(alias) === index);
}
function paginationParams(html, page) {
  const nav = mainHtml(html).match(/<nav class="pagination"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'runtime must expose pagination links');
  for (const match of nav[1].matchAll(/href="([^"]+)"/g)) {
    const params = new URLSearchParams(match[1].replaceAll('&amp;', '&').split('?')[1]);
    if (params.get('page') === String(page)) return Object.fromEntries(params);
  }
  assert.fail(`missing pagination link for page ${page}`);
}

export async function runQueryOptionsMainRegressionTests() {
  assert.equal(normalizeQuery('  AC\u0327A\u0303O\t\n solar\u00a0 '), 'AÇÃO solar');
  assert.equal(normalizeQuery('  abc def  ', 4), 'abc');
  assert.equal(normalizeQuery(null), '');

  // The form defaults remain 10; historical pageSize remains effective until a
  // limit has actually been stored. Saving 10 explicitly must still mean 10.
  for (const stored of [undefined, {}, { content: { showAuthor: false }, custom: { keep: true } }]) {
    const config = queryConfig(stored, 7);
    assert.equal(config.componentParams.content.listLimit, 10);
    assert.equal(config.componentParams.search.resultsLimit, 10);
    assert.equal(resolveContentQuery(config, {}, { list: true }).pageSize, 7);
    assert.equal(resolveContentQuery(config, {}, { search: true }).pageSize, 7);
  }
  const configured = queryConfig({ content: { listLimit: 10, orderBy: 'publishUp-asc' }, search: { resultsLimit: 2, searchPhrases: 'any' } });
  assert.deepEqual(resolveContentQuery(configured, {}, { list: true }), { pageSize: 10, sort: 'publishUp', direction: 'asc' });
  assert.equal(resolveContentQuery(configured, {}, { search: true }).searchMode, 'any');
  assert.equal(resolveContentQuery(configured, { pageSize: '3' }, { list: true }).pageSize, 3);
  assert.deepEqual(resolveContentQuery(configured, { sort: 'title' }), { pageSize: 5, sort: 'title', direction: 'asc' });
  assert.deepEqual(resolveContentQuery(configured, { dir: 'desc' }), { pageSize: 5, sort: 'publishUp', direction: 'desc' });
  assert.equal(resolveContentQuery(configured, { searchPhrases: 'exact' }, { search: true }).searchMode, 'exact');
  assert.equal(resolveContentQuery(createConfig({ componentParams: { content: { listLimit: 10 }, search: { resultsLimit: 10 } } }), {}, { search: true }).pageSize, 10, 'inline component params are explicit without persisted provenance');
  for (const pageSize of ['NaN', 'Infinity', '', '0', '-1', '51', '2.9', 2.9, true, [2], {}]) {
    assert.equal(resolveContentQuery(configured, { pageSize }, { search: true }).pageSize, 2);
  }
  // Latest accepted queryInteger trims numeric strings; main's digits-only
  // rejection of surrounding whitespace is not the canonical query contract.
  assert.equal(resolveContentQuery(configured, { pageSize: ' 2 ' }, { list: true }).pageSize, 2);
  assert.equal(resolveContentQuery(configured, { orderBy: '__proto__', sort: 'constructor', dir: 'wrong', searchPhrases: '.*' }, { search: true }).searchMode, 'any');
  const inherited = createConfig({ componentParams: Object.create({ content: { listLimit: 1, orderBy: 'title-asc' }, search: { resultsLimit: 1, searchPhrases: 'any' } }) });
  assert.deepEqual(resolveContentQuery(inherited, {}, { search: true }), { pageSize: 5, searchMode: 'all' });
  assert.deepEqual(resolveContentQuery(createConfig(), Object.create({ pageSize: 1, sort: 'title' })), { pageSize: 5 });
  assert.deepEqual(resolveContentQuery(configured), { pageSize: 5, sort: 'publishUp', direction: 'asc' }, 'compatibility helper without list/search context does not consume saved listLimit');
  assert.deepEqual(resolveContentQuery(createConfig(), { sort: 'constructor', direction: 'wrong' }, { search: true }), { pageSize: 5, searchMode: 'all' }, 'compatibility helper keeps main omission of unconfigured default sort keys');

  let getterCalls = 0;
  const guardedService = createContentService({ getCategory: async alias => ({ alias }), listArticles: async () => null }, configured);
  const inheritedOptions = Object.create(Object.defineProperties({}, Object.fromEntries(['orderBy', 'dir', 'searchPhrases'].map(key => [key, { get() { getterCalls += 1; return 'title-asc'; } }]))));
  assert.deepEqual(resolveContentQuery(configured, inheritedOptions, { search: true }), resolveContentQuery(configured, {}, { search: true }));
  assert.deepEqual(guardedService.queryOptions(inheritedOptions, 'search'), guardedService.queryOptions({}, 'search'));
  for (const key of ['orderBy', 'dir', 'searchPhrases', 'unknown']) {
    const accessor = Object.defineProperty({}, key, { enumerable: true, get() { getterCalls += 1; return 'title-asc'; } });
    assert.throws(() => resolveContentQuery(configured, accessor, { search: true }), TypeError);
    assert.throws(() => guardedService.queryOptions(accessor, 'search'), TypeError);
    await assert.rejects(() => guardedService.search('solar', accessor), TypeError);
  }
  assert.throws(() => resolveContentQuery(configured, {}, Object.defineProperty({}, 'list', { get() { getterCalls += 1; return true; } })), TypeError);
  for (const key of ['queryParams', 'componentParamsJson', 'componentParams']) {
    const accessor = Object.defineProperty({}, key, { enumerable: true, get() { getterCalls += 1; return {}; } });
    assert.throws(() => resolveContentQuery(accessor, {}, { search: true }), TypeError);
  }
  const notAString = { toString() { assert.fail('invalid ordering must not be coerced'); } };
  assert.deepEqual(guardedService.queryOptions({ orderBy: notAString, sort: notAString, dir: notAString }), guardedService.queryOptions());
  assert.equal(getterCalls, 0, 'main compatibility aliases/context never invoke own or inherited getters');
  // Deliberate current service contract: direct category() consumes content
  // defaults; public blog routes explicitly pass their own blog capacity.
  assert.equal((await guardedService.category('noticias')).pageSize, 10);

  const portQueries = [];
  const service = createContentService({ listArticles: async (query) => { portQueries.push(query); return null; } }, configured);
  const empty = await service.search(' \t ', { pageSize: 3 });
  assert.equal(empty.pageSize, 3);
  assert.equal(empty.emptyQuery, true);
  assert.deepEqual(portQueries, [], 'empty search does not query the port');
  await service.search(' solar\tAÇÃO ', { searchPhrases: 'exact', pageSize: 3, orderBy: 'title-asc', search: 'override-attempt' });
  assert.deepEqual(portQueries.pop(), { pageSize: 3, sort: 'title', direction: 'asc', searchMode: 'exact', search: 'solar AÇÃO' });
  const rawQueries = [];
  const plainService = createContentService({ listArticles: async query => { rawQueries.push(query); return null; } }, createConfig());
  await plainService.search('x', { sort: 'constructor', direction: 'wrong', pageSize: 2.9, searchMode: 'invalid' });
  // Step2 emits canonical sort/dir when those keys were explicitly supplied;
  // main omitted them. Both are valid port data, but preserve the current API.
  assert.deepEqual(rawQueries.pop(), { pageSize: 5, sort: 'publishUp', direction: 'desc', searchMode: 'all', search: 'x' }, 'Resolved fields never leak invalid raw options to a strict adapter');

  const storage = new Map();
  const storageAdapter = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const repositories = createDemoRepositories({ storage: storageAdapter });
  const admin = createAdminService(repositories);
  const unknown = { custom: { keep: ['unchanged'] }, tags: { tagListLimit: 19 }, content: { advanced: { keep: true } } };
  let site = await admin.siteConfig.get();
  await repositories.siteConfig.update(site.id, { basePath: '/portal', componentParamsJson: JSON.stringify(unknown) }, { etag: site.etag });
  for (let index = 1; index <= 12; index += 1) {
    await repositories.articles.create({
      title: `${String(index).padStart(2, '0')} queryfixture energia${index % 2 ? ' ação' : ''}`, alias: `query-${index}`,
      state: 'Published', featured: true, categoryId: 1, tags: 'querytag', introtext: '<p>queryfixture</p>', fulltext: '',
      publishUp: `2026-03-${String(index).padStart(2, '0')}T00:00:00Z`
    });
  }
  await repositories.tags.create({ name: 'querytag', alias: 'querytag', state: 'Published' });

  async function publicHtml(path) {
    // Fresh repository objects read the persisted storage, not the old admin's
    // in-memory values. The runtime consumes the same SPMiddle adapter as the host.
    const fresh = createDemoRepositories({ storage: storageAdapter });
    const freshAdmin = createAdminService(fresh);
    const saved = await freshAdmin.siteConfig.get();
    const documentRef = documentDouble();
    const app = createApplication({
      autoStart: false, documentRef, getModuleInstances: async () => [],
      config: toSiteConfigOverrides(saved),
      adapter: createSPMiddleAdapter({ articleRepository: fresh.articles, categoryRepository: fresh.categories, tagRepository: fresh.tags, menuRepository: fresh.menu, now: '2026-11-06' })
    });
    try { await app.start(); await app.router.navigate(path); return documentRef.body.innerHTML; }
    finally { app.stop(); }
  }
  assert.equal(aliases(await publicHtml('#/portal/category/noticias?layout=list&filter=queryfixture')).length, 5);
  assert.equal(aliases(await publicHtml('#/portal/search?q=queryfixture')).length, 5);

  let options = await admin.componentOptions.get('content');
  await admin.componentOptions.save('content', { listLimit: 2, orderBy: 'title-asc' }, { etag: options.etag });
  options = await admin.componentOptions.get('search');
  await admin.componentOptions.save('search', { resultsLimit: 3, searchPhrases: 'all' }, { etag: options.etag });
  const saved = JSON.parse((await admin.siteConfig.get()).componentParamsJson);
  assert.deepEqual(saved.custom, unknown.custom);
  assert.deepEqual(saved.tags, unknown.tags);
  assert.deepEqual(saved.content.advanced, unknown.content.advanced);
  assert.deepEqual(aliases(await publicHtml('#/portal/category/noticias?layout=list&filter=queryfixture')), ['query-1', 'query-2']);
  const listOverride = await publicHtml('#/portal/category/noticias?layout=list&filter=queryfixture&pageSize=3&sort=publishUp&dir=desc');
  assert.deepEqual(aliases(listOverride), ['query-12', 'query-11', 'query-10']);
  // Parameter insertion order is not a routing contract: verify the complete
  // pagination query instead of main's pageSize-before-sort regex.
  assert.deepEqual(paginationParams(listOverride, 2), { layout: 'list', sort: 'publishUp', dir: 'desc', filter: 'queryfixture', pageSize: '3', page: '2' });
  for (const [route, expectedParams] of [
    ['#/portal/category/noticias?layout=list&filter=queryfixture', { layout: 'list', filter: 'queryfixture' }],
    ['#/portal/category/noticias', {}],
    ['#/portal/', {}],
    ['#/portal/tag/querytag', {}],
    ['#/portal/archive?year=2026&month=3', { year: '2026', month: '3' }],
    ['#/portal/search?q=queryfixture', { q: 'queryfixture' }]
  ]) {
    const html = await publicHtml(`${route}${route.includes('?') ? '&' : '?'}orderBy=publishUp-desc&pageSize=2`);
    assert.deepEqual(aliases(html), ['query-12', 'query-11'], 'main explicit orderBy works on each public content surface');
    assert.deepEqual(paginationParams(html, 2), { ...expectedParams, sort: 'publishUp', dir: 'desc', pageSize: '2', page: '2' }, 'explicit route ordering and filters survive canonical pagination');
  }
  for (const route of ['#/portal/category/noticias', '#/portal/', '#/portal/tag/querytag']) {
    const html = await publicHtml(route);
    assert.equal(aliases(html).length, 5, 'blog page size must not be replaced by listLimit');
    assert.deepEqual(aliases(html).slice(0, 2), ['query-1', 'query-2'], 'blog must use the saved sort');
  }
  assert.deepEqual(aliases(await publicHtml('#/portal/archive?year=2026&month=3')), ['query-1', 'query-2']);
  const search = await publicHtml('#/portal/search?q=energia%20a%C3%A7%C3%A3o');
  assert.deepEqual(aliases(search), ['query-1', 'query-3', 'query-5']);
  assert.match(mainHtml(search), /6 resultado\(s\)/);
  const normalizedSearch = await publicHtml('#/portal/search?q=energia%09ac%CC%A7a%CC%83o&searchPhrases=exact');
  assert.match(mainHtml(normalizedSearch), /<mark>energia ação<\/mark>/i, 'Canonical matching and highlighted query share Unicode/whitespace normalization');
  options = await admin.componentOptions.get('search');
  await admin.componentOptions.save('search', { searchPhrases: 'any' }, { etag: options.etag });
  // Literal token containment also matches "ação" within the two demo bodies.
  assert.match(mainHtml(await publicHtml('#/portal/search?q=energia%20a%C3%A7%C3%A3o')), /14 resultado\(s\)/);
  const exact = await publicHtml('#/portal/search?q=energia%20a%C3%A7%C3%A3o&searchPhrases=exact&pageSize=2&page=2');
  assert.deepEqual(aliases(exact), ['query-5', 'query-7']);
  // Main's searchPhrases alias remains accepted; links use step2's canonical
  // searchMode spelling so the mode must survive actual page navigation.
  assert.deepEqual(paginationParams(exact, 3), { q: 'energia ação', page: '3', pageSize: '2', searchMode: 'exact' });
  options = await admin.componentOptions.get('search');
  await admin.componentOptions.save('search', { searchPhrases: 'exact' }, { etag: options.etag });
  assert.deepEqual(aliases(await publicHtml('#/portal/search?q=energia%20a%C3%A7%C3%A3o')), ['query-1', 'query-3', 'query-5']);
  assert.match(mainHtml(await publicHtml('#/portal/search?q=energia%20a%C3%A7%C3%A3o&searchPhrases=invalid')), /6 resultado\(s\)/, 'invalid route mode falls back to the saved exact mode');

  options = await admin.componentOptions.get('content');
  await admin.componentOptions.save('content', { numLeading: 1, numIntro: 1, numLinks: 1, orderBy: 'publishUp-asc' }, { etag: options.etag });
  assert.deepEqual(aliases(await publicHtml('#/portal/category/noticias')), ['boas-vindas', 'organize-seu-portal', 'query-1']);
  assert.equal(aliases(await publicHtml('#/portal/category/noticias?pageSize=2&sort=publishUp&dir=desc')).length, 2, 'explicit route limit wins over saved blog counts');
  assert.equal(aliases(await publicHtml('#/portal/category/noticias?pageSize=invalid')).length, 3, 'invalid route limit must not discard saved blog counts');
  console.log('ok - main regression: historical limits, explicit/saved/default precedence and neutral safe port');
  console.log('ok - main regression: admin save, fresh persisted public reload, list/blog/archive/search modes and pagination');
}

// Explicit integration entry point: requires the real SPMIDDLE sibling. No
// existsSync auto-detection or silent skip; import/dependency failures propagate.
export async function runQueryOptionsMainSPMiddleRegressionTests() {
  const { createMiniJoomlaSiteApplication } = await import('../src/libraries/minijoomla/composition/createMiniJoomlaSiteApplication.js');
  const tables = {
    Articles: [
      { Id: 1, Title: 'Current energia solar', Alias: 'current', CategoryId: 1, State: 'Published', Tags: '', MetaDescription: 'Preserved <description>', MetaKeywords: 'solar, guia', PrivateTransport: 'discard' },
      { Id: 2, Title: 'Keyword-only related solar', Alias: 'related', Fulltext: 'energia', CategoryId: 1, State: 'Published', Tags: '', MetaKeywords: 'SOLAR' },
      { Id: 3, Title: 'Unrelated solar', Alias: 'unrelated', CategoryId: 1, State: 'Published', Tags: '', MetaKeywords: 'other' },
      { Id: 4, Title: 'Draft match', Alias: 'draft', CategoryId: 1, State: 'Draft', Tags: '', MetaKeywords: 'solar' }
    ],
    Categories: [{ Id: 1, Title: 'Notícias', Alias: 'noticias' }],
    Config: [{ Id: 1, Title: 'Config', SiteName: 'Fixture', BasePath: '/portal', PageSize: 5, TemplateKey: 'default', ComponentParamsJson: '{"custom":{"keep":true},"content":{"advanced":{"keep":true}},"tags":{"tagListLimit":17}}' }],
    Modules: [{ Id: 1, Title: 'Related', ExtensionKey: 'related-items', Position: 'sidebar-right', Enabled: true, SettingsJson: '{"limit":5}', Assignment: 'all' }]
  };
  const before = structuredClone(tables);
  const versions = new Map([['Config', '"1"']]);
  const transport = {
    webUrl: '/sites/query-fixture',
    async request(path, options = {}) {
      const title = /getbytitle\('([^']+)'\)/.exec(path)?.[1];
      assert.ok(Object.hasOwn(tables, title));
      const id = /\/items\((\d+)\)$/.exec(path)?.[1];
      const method = options.method ?? 'GET';
      if (!id) {
        assert.equal(method, 'GET');
        return { status: 200, data: { value: structuredClone(tables[title]) } };
      }
      const item = tables[title].find((row) => row.Id === Number(id));
      assert.ok(item);
      if (method === 'MERGE') {
        assert.equal(title, 'Config', 'only the admin component options test writes configuration');
        assert.equal(options.etag, versions.get(title), 'real repository save requires the current ETag');
        Object.assign(item, structuredClone(options.body));
        versions.set(title, `"${Number(versions.get(title).replaceAll('"', '')) + 1}"`);
      } else assert.equal(method, 'GET');
      return { status: 200, data: structuredClone(item), etag: versions.get(title) };
    }
  };
  const documentRef = documentDouble();
  const options = {
    autoStart: false, webUrl: '/sites/query-fixture', now: '2026-11-06',
    lists: Object.fromEntries([['articles', 'Articles'], ['categories', 'Categories'], ['siteConfig', 'Config'], ['moduleInstances', 'Modules']].map(([key, title]) => [key, { listPath: `lists/getbytitle('${title}')` }])),
    transportFactory: () => transport
  };
  const composition = await createMiniJoomlaSiteApplication({ ...options, documentRef });
  assert.equal(composition.content ? (await composition.content.search('solar')).pageSize : null, 5,
    'real persisted composition without explicit limits must retain historical pageSize');
  const article = await composition.content.article('current');
  assert.equal(article.metaDescription, 'Preserved <description>');
  assert.equal(article.metaKeywords, 'solar, guia');
  assert.equal(Object.hasOwn(article, 'PrivateTransport'), false);
  assert.equal(Object.hasOwn(article, 'etag'), false);
  assert.equal((await composition.adapter.listArticles()).items.find((item) => item.alias === 'related').metaKeywords, 'SOLAR');
  try {
    await composition.application.start();
    await composition.application.router.navigate('#/portal/article/current');
    const related = documentRef.body.innerHTML.match(/<section class="module module-related-items">([\s\S]*?)<\/section>/);
    assert.ok(related, 'keyword fallback must reach the actual related-items module through mapper/adapter/runtime');
    assert.match(related[1], /href="#\/portal\/article\/related"/);
    assert.doesNotMatch(related[1], /unrelated|draft|article\/current/);
    assert.doesNotMatch(documentRef.body.innerHTML, /<meta\b|Preserved|PrivateTransport/);
    assert.deepEqual(tables, before, 'metadata consumption does not rewrite any record');
  } finally { composition.application.stop(); }
  console.log('ok - main regression: real SPMIDDLE mapper metadata and keyword-only related-items runtime, no host meta emission');

  const admin = createAdminService(composition.repositories);
  const contentOptions = await admin.componentOptions.get('content');
  await admin.componentOptions.save('content', { listLimit: 1, orderBy: 'title-asc' }, { etag: contentOptions.etag });
  const searchOptions = await admin.componentOptions.get('search');
  await admin.componentOptions.save('search', { resultsLimit: 1, searchPhrases: 'all' }, { etag: searchOptions.etag });
  const saved = JSON.parse(tables.Config[0].ComponentParamsJson);
  assert.deepEqual(saved.custom, { keep: true });
  assert.deepEqual(saved.content.advanced, { keep: true });
  assert.deepEqual(saved.tags, { tagListLimit: 17 });
  const afterSave = structuredClone(tables);
  const freshDocument = documentDouble();
  const fresh = await createMiniJoomlaSiteApplication({ ...options, documentRef: freshDocument });
  assert.notEqual(fresh.repositories, composition.repositories, 'real composition must construct fresh repositories after saving');
  try {
    await fresh.application.start();
    await fresh.application.router.navigate('#/portal/category/noticias?layout=list');
    assert.deepEqual(aliases(freshDocument.body.innerHTML), ['current']);
    await fresh.application.router.navigate('#/portal/search?q=energia%20solar');
    assert.deepEqual(aliases(freshDocument.body.innerHTML), ['current']);
    assert.match(mainHtml(freshDocument.body.innerHTML), /2 resultado\(s\)/);
    await fresh.application.router.navigate('#/portal/search?q=energia%20solar&searchPhrases=all&page=2');
    assert.deepEqual(aliases(freshDocument.body.innerHTML), ['related']);
    await fresh.application.router.navigate('#/portal/search?q=energia%20solar&searchPhrases=exact');
    assert.match(mainHtml(freshDocument.body.innerHTML), /1 resultado\(s\)/);
    await fresh.application.router.navigate('#/portal/search?q=energia%20solar&searchPhrases=any&pageSize=2');
    assert.match(mainHtml(freshDocument.body.innerHTML), /3 resultado\(s\)/);
    assert.deepEqual(aliases(freshDocument.body.innerHTML), ['current', 'related']);
    assert.deepEqual(tables, afterSave, 'fresh public runtime must not mutate the saved options or records');
  } finally { fresh.application.stop(); }
  assert.deepEqual(tables.Articles, before.Articles);
  assert.deepEqual(tables.Modules, before.Modules);
  console.log('ok - main regression: real SPMIDDLE repositories admin save/ETag and fresh public composition query limits/modes');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  (async () => {
    await runQueryOptionsMainRegressionTests();
    if (process.argv.includes('--integration')) await runQueryOptionsMainSPMiddleRegressionTests();
  })().catch((error) => { console.error(error); process.exitCode = 1; });
}
