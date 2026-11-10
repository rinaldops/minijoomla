import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createApplication } from '../src/index.js';
import { createConfig } from '../src/libraries/minijoomla/core/config.js';
import { normalizeQuery } from '../src/libraries/minijoomla/core/contracts.js';
import { createContentService, resolveContentQuery } from '../src/libraries/minijoomla/application/content-service.js';
import { resolveComponentParams } from '../src/libraries/minijoomla/application/component-options.js';
import { toSiteConfigOverrides } from '../src/libraries/minijoomla/application/site-config-overrides.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';

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

export async function runQueryOptionsTests() {
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
  for (const pageSize of ['NaN', 'Infinity', '', '0', '-1', '51', '2.9', 2.9, true, [2], {}, ' 2 ']) {
    assert.equal(resolveContentQuery(configured, { pageSize }, { search: true }).pageSize, 2);
  }
  assert.equal(resolveContentQuery(configured, { orderBy: '__proto__', sort: 'constructor', dir: 'wrong', searchPhrases: '.*' }, { search: true }).searchMode, 'any');
  const inherited = createConfig({ componentParams: Object.create({ content: { listLimit: 1, orderBy: 'title-asc' }, search: { resultsLimit: 1, searchPhrases: 'any' } }) });
  assert.deepEqual(resolveContentQuery(inherited, {}, { search: true }), { pageSize: 5, searchMode: 'all' });
  assert.deepEqual(resolveContentQuery(createConfig(), Object.create({ pageSize: 1, sort: 'title' })), { pageSize: 5 });

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
  assert.deepEqual(rawQueries.pop(), { pageSize: 5, searchMode: 'all', search: 'x' }, 'Resolved fields never leak invalid raw options to a strict adapter');

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
  assert.match(mainHtml(listOverride), /pageSize=3&amp;sort=publishUp&amp;dir=desc/);
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
  assert.match(mainHtml(exact), /searchPhrases=exact[^"]*page=3/);
  options = await admin.componentOptions.get('search');
  await admin.componentOptions.save('search', { searchPhrases: 'exact' }, { etag: options.etag });
  assert.deepEqual(aliases(await publicHtml('#/portal/search?q=energia%20a%C3%A7%C3%A3o')), ['query-1', 'query-3', 'query-5']);
  assert.match(mainHtml(await publicHtml('#/portal/search?q=energia%20a%C3%A7%C3%A3o&searchPhrases=invalid')), /6 resultado\(s\)/, 'invalid route mode falls back to the saved exact mode');

  options = await admin.componentOptions.get('content');
  await admin.componentOptions.save('content', { numLeading: 1, numIntro: 1, numLinks: 1, orderBy: 'publishUp-asc' }, { etag: options.etag });
  assert.deepEqual(aliases(await publicHtml('#/portal/category/noticias')), ['boas-vindas', 'organize-seu-portal', 'query-1']);
  assert.equal(aliases(await publicHtml('#/portal/category/noticias?pageSize=2&sort=publishUp&dir=desc')).length, 2, 'explicit route limit wins over saved blog counts');
  assert.equal(aliases(await publicHtml('#/portal/category/noticias?pageSize=invalid')).length, 3, 'invalid route limit must not discard saved blog counts');
  console.log('ok - query options: historical limits, explicit/saved/default precedence and neutral safe port');
  console.log('ok - query options: admin save, fresh persisted public reload, list/blog/archive/search modes and pagination');

  // Keep the new local suite usable in a contributor checkout without SPMIDDLE.
  // When the sibling exists, exercise its actual mapper/repositories/composition.
  if (existsSync(new URL('../../SPMIDDLE', import.meta.url))) await realMetadataRuntime();
  else console.log('query options: real SPMIDDLE mapper integration not run (optional sibling absent)');
}

async function realMetadataRuntime() {
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
  console.log('ok - query options: real SPMIDDLE mapper metadata and keyword-only related-items runtime, no host meta emission');

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
  console.log('ok - query options: real SPMIDDLE repositories admin save/ETag and fresh public composition query limits/modes');
}
