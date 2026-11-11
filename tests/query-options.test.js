import assert from 'node:assert/strict';
import { lstat, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApplication } from '../src/index.js';
import { createContentService, resolveQueryParams } from '../src/libraries/minijoomla/application/content-service.js';
import { toSiteConfigOverrides } from '../src/libraries/minijoomla/application/site-config-overrides.js';
import { resolveComponentParams } from '../src/libraries/minijoomla/application/component-options.js';
import { createConfig } from '../src/libraries/minijoomla/core/config.js';
import { normalizeQuery } from '../src/libraries/minijoomla/core/contracts.js';
import { createFakeAdapter } from '../src/libraries/minijoomla/infrastructure/fake-adapter.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';

const NOW = '2026-11-06T00:00:00Z';
const documentDouble = () => ({ body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } });
const aliases = (result) => result.items.map((item) => item.alias);

async function runOwnDataRegressionTests() {
  const calls = [];
  const adapter = {
    getCategory: async (alias) => ({ alias }),
    listArticles: async (options) => { calls.push(options); return { items: [], total: 0, page: 1, pageSize: options.pageSize }; }
  };
  const config = { pageSize: 7, componentParams: { content: { listLimit: 3, orderBy: 'publishUp-asc' }, search: { resultsLimit: 2, searchPhrases: 'any' } } };
  const service = createContentService(adapter, config);
  const baseline = service.queryOptions({}, 'search');
  const inheritedValues = { pageSize: 1, sort: 'title', direction: 'desc', searchMode: 'exact', page: 9, titleContains: 'inherited-filter' };
  const inherited = Object.create(inheritedValues);
  assert.deepEqual(service.queryOptions(inherited, 'search'), baseline, 'inherited query values must not override saved defaults');
  await service.search('solar', inherited);
  assert.deepEqual(calls.at(-1), { ...baseline, search: 'solar' }, 'inherited fields must not reach the port');
  let invoked = 0;
  const getterPrototype = Object.defineProperties({}, Object.fromEntries(Object.entries(inheritedValues).map(([key, value]) => [key, { enumerable: true, get() { invoked += 1; return value; } }])));
  const inheritedGetters = Object.create(getterPrototype);
  assert.deepEqual(service.queryOptions(inheritedGetters, 'search'), baseline);
  for (const run of [() => service.category('queries', inheritedGetters), () => service.search('solar', inheritedGetters), () => service.home(inheritedGetters), () => service.archive(inheritedGetters)]) await run();
  assert.equal(invoked, 0, 'six inherited query getters must never be invoked');
  for (const field of [...Object.keys(inheritedValues), 'unknown']) {
    const accessor = Object.defineProperty({}, field, { enumerable: true, get() { invoked += 1; return inheritedValues[field]; } });
    assert.throws(() => service.queryOptions(accessor, 'search'), TypeError);
    for (const run of [() => service.category('queries', accessor), () => service.search('solar', accessor), () => service.home(accessor), () => service.archive(accessor)]) {
      const before = calls.length;
      await assert.rejects(run, TypeError, `own ${field} getter must be rejected without execution`);
      assert.equal(calls.length, before, 'rejected accessors must not reach listArticles');
    }
  }
  const safeDefaults = resolveQueryParams({});
  for (const field of ['queryParams', 'componentParamsJson', 'componentParams']) {
    const value = field === 'componentParamsJson' ? JSON.stringify(config.componentParams) : config.componentParams;
    assert.deepEqual(resolveQueryParams(Object.create({ [field]: value })), safeDefaults, `inherited ${field} is not query provenance`);
    const inheritedConfig = Object.assign(Object.create({ [field]: value }), { pageSize: 7 });
    const inheritedService = createContentService(adapter, inheritedConfig);
    assert.equal(inheritedService.queryOptions({}, 'search').pageSize, 7, `inherited ${field} must not affect runtime defaults`);
    assert.deepEqual(resolveQueryParams(Object.create(Object.defineProperty({}, field, { get() { invoked += 1; return value; } }))), safeDefaults);
    const accessor = Object.defineProperty({}, field, { enumerable: true, get() { invoked += 1; return value; } });
    assert.throws(() => resolveQueryParams(accessor), TypeError);
    assert.throws(() => createContentService(adapter, accessor), TypeError);
  }
  for (const field of ['content', 'search']) {
    const source = Object.defineProperty({}, field, { get() { invoked += 1; return config.componentParams[field]; } });
    assert.throws(() => resolveQueryParams({ componentParams: source }), TypeError);
  }
  for (const [component, field] of [['content', 'listLimit'], ['content', 'orderBy'], ['search', 'resultsLimit'], ['search', 'searchPhrases']]) {
    const source = { [component]: Object.defineProperty({}, field, { get() { invoked += 1; return 1; } }) };
    assert.throws(() => resolveQueryParams({ queryParams: source }), TypeError);
    const inheritedSource = { [component]: Object.create({ [field]: config.componentParams[component][field] }) };
    assert.deepEqual(resolveQueryParams({ componentParams: inheritedSource }), safeDefaults, `inherited nested ${field} must be ignored`);
  }
  const record = Object.defineProperty({ pageSize: 7 }, 'componentParamsJson', { get() { invoked += 1; return '{}'; } });
  assert.throws(() => toSiteConfigOverrides(record), TypeError);
  assert.equal(invoked, 0, 'own and inherited accessors must remain unexecuted throughout query resolution');
  await service.category('queries', { page: 2, titleContains: 'solar', tag: 'guia', featured: true, now: NOW, unknown: 'drop' });
  assert.deepEqual(calls.at(-1), { page: 2, titleContains: 'solar', tag: 'guia', featured: true, now: NOW, pageSize: 3, sort: 'publishUp', direction: 'asc', category: 'queries' }, 'safe own data filters survive, unknown fields do not');
  await service.archive({ year: 2026, month: 1, page: 2, now: NOW });
  assert.deepEqual(calls.at(-1), { year: 2026, month: 1, page: 2, now: NOW, pageSize: 3, sort: 'publishUp', direction: 'asc' });
}

async function runExplicitSortRegressionTests() {
  const calls = [];
  const seed = { articles: [
    { alias: 'old', title: 'Old', category: 'queries', published: true, publishUp: '2026-01-01' },
    { alias: 'new', title: 'New', category: 'queries', published: true, publishUp: '2026-02-01' }
  ], categories: [{ id: 1, alias: 'queries', title: 'Queries' }] };
  const fake = createFakeAdapter(seed);
  const adapter = { ...fake, async listArticles(options) {
    assert.ok(options.sort === undefined || ['publishUp', 'title', 'alias', 'id', 'author'].includes(options.sort));
    assert.ok(options.direction === undefined || ['asc', 'desc'].includes(options.direction));
    calls.push(options);
    return fake.listArticles({ ...options, now: NOW });
  } };
  const config = { pageSize: 1, componentParams: { content: { orderBy: 'publishUp-asc' } } };
  const service = createContentService(adapter, config);
  assert.equal(service.queryOptions({ sort: 'publishUp' }).direction, 'desc', 'explicit publication sort uses historical desc even when saved order is publication asc');
  assert.equal(service.queryOptions({ sort: 'title' }).direction, 'asc');
  assert.equal(service.queryOptions({ sort: 'publishUp', direction: 'asc' }).direction, 'asc');
  assert.equal(service.queryOptions({}).direction, 'asc');
  assert.equal(service.queryOptions({ sort: 'invalid' }).direction, 'asc');
  const documentRef = documentDouble();
  const app = createApplication({ adapter, config, documentRef, autoStart: false, getModuleInstances: async () => [] });
  try {
    await app.start();
    for (const [suffix, expectedDirection, expectedAlias] of [['&sort=publishUp', 'desc', 'new'], ['', 'asc', 'old'], ['&sort=invalid', 'asc', 'old'], ['&sort=publishUp&dir=asc', 'asc', 'old']]) {
      await app.router.navigate(`#/category/queries?layout=list${suffix}`);
      const query = calls.findLast((options) => options.category === 'queries' && options.pageSize === 1 && Object.hasOwn(options, 'sort'));
      assert.equal(query?.sort, 'publishUp'); assert.equal(query?.direction, expectedDirection, `public route ${suffix || '(omitted sort)'} must reach strict port with the correct direction`);
      assert.ok(documentRef.body.innerHTML.includes(`#/article/${expectedAlias}`));
      assert.doesNotMatch(documentRef.body.innerHTML, /Não foi possível carregar/);
    }
  } finally { app.stop(); }
}

async function runResolutionTests() {
  await runOwnDataRegressionTests();
  await runExplicitSortRegressionTests();
  const calls = [];
  // Deliberately strict port: this is a boundary test, not an integration claim.
  const adapter = {
    getCategory: async (alias) => ({ alias, title: alias }),
    listArticles: async (options) => {
      assert.ok(Number.isInteger(options.pageSize) && options.pageSize >= 1 && options.pageSize <= 50);
      assert.ok(options.sort === undefined || ['publishUp', 'title', 'alias', 'id', 'author'].includes(options.sort));
      assert.ok(options.direction === undefined || ['asc', 'desc'].includes(options.direction));
      assert.ok(options.searchMode === undefined || ['all', 'any', 'exact'].includes(options.searchMode));
      calls.push(options);
      return { items: [], total: 12, page: options.page ?? 1, pageSize: options.pageSize };
    }
  };
  const defaults = resolveComponentParams({});
  for (const config of [
    { pageSize: 7 },
    { pageSize: 7, componentParams: defaults, componentParamsJson: undefined },
    { pageSize: 7, componentParams: defaults, componentParamsJson: '{}' },
    { pageSize: 7, ...toSiteConfigOverrides({ pageSize: 7 }) }
  ]) {
    const service = createContentService(adapter, config);
    assert.equal((await service.category('queries')).pageSize, 7);
    assert.equal((await service.search('solar')).pageSize, 7);
    assert.equal(calls.at(-1).searchMode, 'all', 'service uses declared all even while direct adapters remain exact');
  }
  const explicitTen = createContentService(adapter, { pageSize: 7, ...toSiteConfigOverrides({ pageSize: 7, componentParamsJson: '{"content":{"listLimit":10},"search":{"resultsLimit":10}}' }) });
  assert.equal((await explicitTen.category('queries')).pageSize, 10);
  assert.equal((await explicitTen.search('solar')).pageSize, 10);
  const inline = createContentService(adapter, { pageSize: 7, componentParams: { content: { listLimit: 3, orderBy: 'title-asc' }, search: { resultsLimit: 2, searchPhrases: 'any' } } });
  for (const pageSize of [true, false, [], [1], {}, 1.5, '2.5', '0', '51', Infinity, NaN, '', null, undefined]) {
    const category = await inline.category('queries', { pageSize, sort: ['title'], direction: {} });
    assert.equal(category.pageSize, 3);
    assert.equal(calls.at(-1).sort, 'title');
    assert.equal(calls.at(-1).direction, 'asc');
    assert.equal((await inline.search('solar', { pageSize, searchMode: ['exact'] })).pageSize, 2);
    assert.equal(calls.at(-1).searchMode, 'any');
  }
  for (const pageSize of [1, '4', 50]) assert.equal((await inline.category('queries', { pageSize })).pageSize, Number(pageSize));
  await inline.category('queries', { sort: 'author', direction: 'desc', page: '2' });
  assert.equal(calls.at(-1).sort, 'author'); assert.equal(calls.at(-1).direction, 'desc'); assert.equal(calls.at(-1).page, 2);
  for (const orderBy of ['publishUp-desc', 'publishUp-asc', 'title-asc']) {
    const service = createContentService(adapter, { pageSize: 5, componentParams: { content: { orderBy } } });
    await service.category('queries', { sort: 'unsupported', direction: 'invalid' });
    assert.deepEqual([calls.at(-1).sort, calls.at(-1).direction], [orderBy.slice(0, orderBy.lastIndexOf('-')), orderBy.slice(orderBy.lastIndexOf('-') + 1)]);
  }
  const beforeEmpty = calls.length;
  const empty = await inline.search(' \t\n ', { pageSize: false });
  assert.deepEqual(empty, { items: [], total: 0, page: 1, pageSize: 2, pages: 0, query: '', emptyQuery: true });
  assert.equal(calls.length, beforeEmpty);
  await inline.search('  ac\u0327a\u0303o\t solar  ', { search: 'must-not-replace-query', searchMode: 'exact' });
  assert.equal(calls.at(-1).search, 'ação solar');
  assert.equal(calls.at(-1).searchMode, 'exact');
  assert.equal(normalizeQuery('x'.repeat(121)).length, 120);
  assert.deepEqual(resolveQueryParams({ componentParamsJson: undefined, componentParams: defaults }), { content: { orderBy: 'publishUp-desc' }, search: { searchPhrases: 'all' } });
}

async function runAdapterParityTests() {
  const articles = [
    { id: 1, alias: 'phrase', title: 'Ação solar', introtext: '', fulltext: '', tags: [] },
    { id: 2, alias: 'split', title: 'Solar', introtext: 'energia', fulltext: 'ação', tags: [] },
    { id: 3, alias: 'one', title: 'Ação apenas', introtext: '', fulltext: '', tags: [] },
    { id: 4, alias: 'other', title: 'Outra', introtext: '', fulltext: '', tags: [] },
    { id: 5, alias: 'literal', title: 'Teste [a]+ .*', introtext: '', fulltext: '', tags: [] },
    { id: 6, alias: 'spaces', title: 'Ac\u0327a\u0303o\t \nsolar', introtext: '', fulltext: '', tags: [] },
    { id: 7, alias: 'draft', title: 'Ação solar', introtext: '', fulltext: '', tags: [], published: false, state: 'Draft' },
    { id: 8, alias: 'future', title: 'Ação solar', introtext: '', fulltext: '', tags: [], publishUp: '2099-01-01' }
  ].map((row) => ({ published: true, state: 'Published', category: 'queries', categoryId: 1, publishUp: '2026-01-01', ...row }));
  const categories = [{ id: 1, alias: 'queries', title: 'Queries' }];
  const fake = createFakeAdapter({ articles, categories });
  const sp = createSPMiddleAdapter({ articleRepository: { findMany: async () => ({ items: articles }) }, categoryRepository: { findMany: async () => ({ items: categories }) }, now: NOW });
  for (const [searchMode, expected] of [['exact', ['phrase', 'spaces']], ['all', ['phrase', 'spaces', 'split']], ['any', ['one', 'phrase', 'spaces', 'split']]]) {
    for (const page of [1, 2, 999]) {
      const query = { search: '  AC\u0327A\u0303O\t solar ', searchMode, page, pageSize: 2, now: NOW };
      const left = await fake.listArticles(query); const right = await sp.listArticles(query);
      assert.deepEqual({ ...left, items: aliases(left) }, { ...right, items: aliases(right) });
      assert.deepEqual(aliases(left), expected.slice((page - 1) * 2, page * 2));
      assert.equal(left.total, expected.length); assert.equal(left.pages, Math.ceil(expected.length / 2));
    }
  }
  for (const adapter of [fake, sp]) {
    assert.deepEqual(aliases(await adapter.listArticles({ search: 'ação solar', now: NOW })), ['phrase', 'spaces'], 'direct default preserves historical exact phrase');
    assert.deepEqual(aliases(await adapter.listArticles({ search: '[a]+ .*', searchMode: 'exact', now: NOW })), ['literal'], 'metacharacters are literal');
    assert.deepEqual(aliases(await adapter.listArticles({ search: '[a]+ missing', searchMode: 'any', now: NOW })), ['literal']);
    assert.deepEqual(aliases(await adapter.listArticles({ search: '[a]+ missing', searchMode: 'all', now: NOW })), []);
    assert.equal((await adapter.listArticles({ search: 'ação solar', searchMode: 'invalid', now: NOW })).total, 2);
    assert.equal((await createContentService(adapter, createConfig()).search('solar ação', { now: NOW })).total, 3);
  }
}

async function exerciseAdminReload(harness, label) {
  const admin = createAdminService(harness.repositories);
  // Demo prose such as "administração" also literally contains "ação".
  // Hide demo articles via the real admin path to isolate the intended corpus.
  for (const row of await admin.articles.list()) {
    const current = await admin.articles.get(row.id);
    await admin.articles.update(row.id, { state: 'Draft' }, { etag: current.etag });
  }
  for (const row of await admin.moduleInstances.list()) {
    const current = await admin.moduleInstances.get(row.id);
    await admin.moduleInstances.update(row.id, { enabled: false }, { etag: current.etag });
  }
  const category = await admin.categories.create({ title: 'Queries', alias: 'queries', state: 'Published' });
  const fixture = [
    ['query-a', 'Alpha queryword solar', 'conteúdo ação', '01'],
    ['query-b', 'Beta queryword ação', '', '02'],
    ['query-c', 'Gamma queryword ação solar', '', '03'],
    ['query-d', 'Delta queryword outra', '', '04']
  ];
  for (const [alias, title, fulltext, day] of fixture) await admin.articles.create({ alias, title, categoryId: category.id, state: 'Published', introtext: '', fulltext, publishUp: `2026-01-${day}`, metaKeywords: alias === 'query-a' || alias === 'query-b' ? 'keyword-only' : '', metaDescription: `Description ${alias}`, tags: [] });
  let settings = await admin.siteConfig.get();
  await admin.siteConfig.save({ siteName: 'Query site', pageSize: 3, basePath: '/portal', homeView: 'category', homeCategory: 'queries' }, { etag: settings?.etag });
  const navigate = async (path) => {
    const { application, documentRef, adapter } = await harness.fresh();
    try {
      await application.start();
      await application.router.navigate(`#${path}`);
      assert.doesNotMatch(documentRef.body.innerHTML, /Não foi possível carregar/);
      return { html: documentRef.body.innerHTML, config: application.config, adapter };
    } finally { application.stop(); }
  };
  const list = (html) => html.match(/<table class="category-list"[\s\S]*?<\/table>/)?.[0] ?? html;
  let rendered = await navigate('/portal/category/queries?layout=list');
  assert.equal((list(rendered.html).match(/queryword/g) ?? []).length, 3, `${label}: unsaved list retains historical pageSize`);
  assert.equal((await navigate('/portal/search?q=queryword')).config.queryParams.search.resultsLimit, undefined);
  settings = await admin.componentOptions.get('content');
  await admin.componentOptions.save('content', { listLimit: 2, orderBy: 'title-asc' }, { etag: settings.etag });
  settings = await admin.componentOptions.get('search');
  await admin.componentOptions.save('search', { resultsLimit: 1, searchPhrases: 'all', highlightTerms: true }, { etag: settings.etag });
  rendered = await navigate('/portal/category/queries?layout=list');
  assert.equal((list(rendered.html).match(/queryword/g) ?? []).length, 2);
  assert.ok(list(rendered.html).indexOf('Alpha queryword') < list(rendered.html).indexOf('Beta queryword'));
  assert.doesNotMatch(list(rendered.html), /Gamma queryword|Delta queryword/);
  const ordered = await navigate('/portal/category/queries?layout=list&sort=publishUp&dir=desc&pageSize=1');
  assert.match(list(ordered.html), /Delta queryword/); assert.doesNotMatch(list(ordered.html), /Alpha queryword/);
  const invalid = await navigate('/portal/category/queries?layout=list&sort=invalid&dir=bad&pageSize=2.5');
  assert.equal((list(invalid.html).match(/queryword/g) ?? []).length, 2); assert.match(list(invalid.html), /Alpha queryword/);
  const listPageTwo = await navigate('/portal/category/queries?layout=list&page=2');
  assert.match(list(listPageTwo.html), /Delta queryword/); assert.match(list(listPageTwo.html), /Gamma queryword/);
  assert.doesNotMatch(list(listPageTwo.html), /Alpha queryword|Beta queryword/);
  for (const [orderBy, first, second] of [['publishUp-desc', 'Delta queryword', 'Gamma queryword'], ['publishUp-asc', 'Alpha queryword', 'Beta queryword']]) {
    settings = await admin.componentOptions.get('content');
    await admin.componentOptions.save('content', { orderBy }, { etag: settings.etag });
    const savedOrder = list((await navigate('/portal/category/queries?layout=list')).html);
    assert.ok(savedOrder.includes(first) && savedOrder.includes(second) && savedOrder.indexOf(first) < savedOrder.indexOf(second), `${label}: admin-saved ${orderBy} applies on fresh public list`);
  }
  settings = await admin.componentOptions.get('content');
  await admin.componentOptions.save('content', { orderBy: 'title-asc' }, { etag: settings.etag });
  const blog = await navigate('/portal/category/queries');
  assert.match(blog.html, /class="blog"/); assert.match(blog.html, /items-leading/);
  assert.equal((blog.html.match(/class="article-card"/g) ?? []).length, 3, 'listLimit does not replace blog capacity');
  const home = await navigate('/portal/');
  assert.equal((home.html.match(/class="article-card"/g) ?? []).length, 3);
  const archive = await navigate('/portal/archive?year=2026&month=1');
  assert.equal((archive.html.match(/class="article-card"/g) ?? []).length, 2);
  let search = await navigate('/portal/search?q=solar%20a%C3%A7%C3%A3o');
  assert.match(search.html, /2 resultado/); assert.equal((search.html.match(/class="article-card"/g) ?? []).length, 1);
  search = await navigate('/portal/search?q=solar%20a%C3%A7%C3%A3o&searchMode=exact');
  assert.match(search.html, /Nenhum artigo encontrado/);
  search = await navigate('/portal/search?q=solar%20a%C3%A7%C3%A3o&searchMode=any&pageSize=2');
  assert.match(search.html, /3 resultado/); assert.equal((search.html.match(/class="article-card"/g) ?? []).length, 2);
  assert.match(search.html, /searchMode=any/); assert.match(search.html, /pageSize=2/);
  search = await navigate('/portal/search?q=%20%20queryword%09%20%20');
  assert.match(search.html, /<mark>queryword<\/mark>/, 'highlight receives the normalized service query');
  assert.doesNotMatch(search.html, /value="  queryword/);
  const searchPageTwo = await navigate('/portal/search?q=solar%20a%C3%A7%C3%A3o&page=2');
  assert.match(searchPageTwo.html, /Gamma queryword/); assert.doesNotMatch(searchPageTwo.html, /Alpha queryword/);
  const invalidSearch = await navigate('/portal/search?q=solar%20a%C3%A7%C3%A3o&pageSize=1.5&searchMode=invalid');
  assert.match(invalidSearch.html, /2 resultado/); assert.equal((invalidSearch.html.match(/class="article-card"/g) ?? []).length, 1);
  for (const [mode, total] of [['any', 3], ['exact', 0]]) {
    settings = await admin.componentOptions.get('search');
    await admin.componentOptions.save('search', { searchPhrases: mode }, { etag: settings.etag });
    search = await navigate('/portal/search?q=solar%20a%C3%A7%C3%A3o');
    if (total) assert.match(search.html, new RegExp(`${total} resultado`)); else assert.match(search.html, /Nenhum artigo encontrado/);
  }
  // Module selection is persisted via admin; related items have no shared tags.
  await admin.moduleInstances.create({ title: 'Keyword relations', extensionKey: 'related-items', position: 'sidebar-right', enabled: true, settings: { limit: 5 } });
  const related = await navigate('/portal/article/query-a');
  const relatedHtml = related.html.match(/<section class="module module-related-items">[\s\S]*?<\/section>/)?.[0];
  assert.ok(relatedHtml, `${label}: related-items must render through runtime module context`);
  assert.match(relatedHtml, /Beta queryword/); assert.doesNotMatch(relatedHtml, /Gamma queryword|Delta queryword/);
  const article = await related.adapter.getArticle('query-a');
  assert.equal(article.metaDescription, 'Description query-a'); assert.equal(article.metaKeywords, 'keyword-only'); assert.deepEqual(article.tags, []);
  const reloaded = await createAdminService((await harness.freshRepositories()).repositories).componentOptions.get('search');
  assert.equal(reloaded.values.searchPhrases, 'exact'); assert.equal(reloaded.values.resultsLimit, 1, 'partial admin save retains limit');
}

function localHarness() {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const freshRepositories = async () => ({ repositories: createDemoRepositories({ storage }) });
  return {
    repositories: createDemoRepositories({ storage }), freshRepositories,
    async fresh() {
      const { repositories } = await freshRepositories();
      const saved = (await repositories.siteConfig.findMany()).items[0];
      const adapter = createSPMiddleAdapter({ articleRepository: repositories.articles, categoryRepository: repositories.categories, tagRepository: repositories.tags, menuRepository: repositories.menu, now: NOW });
      const documentRef = documentDouble();
      const application = createApplication({ adapter, config: toSiteConfigOverrides(saved), documentRef, autoStart: false, getModuleInstances: async () => (await repositories.moduleInstances.findMany()).items, getExtensions: async () => (await repositories.extensions.findMany()).items, getTemplate: async () => [] });
      return { application, adapter, documentRef };
    }
  };
}

// Optional real mapper/repository/composition integration. Only the transport is
// synthetic and in-memory; this makes no claim of tenant/network validation.
async function integrationHarness() {
  const { createMiniJoomlaSiteApplication } = await import('../src/libraries/minijoomla/composition/createMiniJoomlaSiteApplication.js');
  const tables = Object.fromEntries(['Articles', 'Categories', 'Tags', 'Menu', 'Modules', 'Extensions', 'Config'].map((title) => [title, []]));
  let revision = 1;
  const transport = {
    webUrl: '/sites/query-local',
    async request(path, options = {}) {
      const title = /getbytitle\('([^']+)'\)/.exec(path)?.[1];
      const records = tables[title]; assert.ok(records, `Unexpected local transport request: ${path}`);
      const id = /\/items\((\d+)\)/.exec(path)?.[1];
      const row = id ? records.find((item) => item.Id === Number(id)) : undefined;
      const method = options.method ?? 'GET';
      if (method === 'GET') return { status: 200, data: structuredClone(id ? row : { value: records }), etag: row?.['odata.etag'] };
      if (method === 'POST' && !id) {
        const created = { ...options.body, Id: Math.max(0, ...records.map((item) => item.Id)) + 1, 'odata.etag': `"${++revision}"` };
        records.push(created); return { status: 201, data: structuredClone(created), etag: created['odata.etag'] };
      }
      if (row && (method === 'PATCH' || method === 'MERGE' || options.headers?.['X-HTTP-Method'] === 'MERGE')) {
        assert.equal(options.etag, row['odata.etag'], 'real repository/list client writes must carry the exact ETag');
        Object.assign(row, options.body, { 'odata.etag': `"${++revision}"` });
        return { status: 204, data: null, etag: row['odata.etag'] };
      }
      throw new Error(`Unexpected local write: ${method} ${path}`);
    }
  };
  const domainTitles = { articles: 'Articles', categories: 'Categories', tags: 'Tags', menu: 'Menu', moduleInstances: 'Modules', extensions: 'Extensions', siteConfig: 'Config' };
  const options = { webUrl: transport.webUrl, transportFactory: () => transport, now: NOW, autoStart: false, lists: Object.fromEntries(Object.entries(domainTitles).map(([domain, title]) => [domain, { listPath: `lists/getbytitle('${title}')` }])) };
  const fresh = async () => {
    const documentRef = documentDouble();
    return { ...await createMiniJoomlaSiteApplication({ ...options, documentRef }), documentRef };
  };
  const initial = await fresh();
  return { repositories: initial.repositories, fresh, freshRepositories: fresh };
}

async function siblingPresent() {
  const sibling = new URL('../../SPMIDDLE', import.meta.url);
  try { await lstat(sibling); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  if (!(await stat(sibling)).isDirectory()) throw new Error('SPMIDDLE exists but is not a directory');
  return true;
}

export async function runQueryOptionsTests({ integration = false, report = console.log } = {}) {
  await runResolutionTests(); report('ok - own-data/getter regressions, explicit-sort public route, query precedence/provenance and strict port validation (local)');
  await runAdapterParityTests(); report('ok - Fake/SP adapters: literal NFC/whitespace all/any/exact matching and total/page parity (local)');
  await exerciseAdminReload(localHarness(), 'local demo repositories'); report('ok - actual admin saves followed by fresh local public runtime, query controls and keyword-only related module');
  const result = { localPassed: 3, integrationPassed: 0, integrationSkipped: 0 };
  if (integration) {
    if (await siblingPresent()) {
      await exerciseAdminReload(await integrationHarness(), 'real SPMIDDLE repositories/composition');
      result.integrationPassed = 1;
      report('ok - real SPMIDDLE mapper/repositories: admin save then fresh public composition (in-memory transport; no tenant)');
    } else {
      result.integrationSkipped = 1;
      report('SKIP - optional SPMIDDLE query integration: sibling is absent; core/local checks passed');
    }
  }
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runQueryOptionsTests({ integration: process.argv.includes('--integration') }).catch((error) => { console.error(error); process.exitCode = 1; });
}
