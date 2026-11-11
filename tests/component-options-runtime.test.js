import assert from 'node:assert/strict';
import { renderArticle, renderArticleList } from '../src/components/com_content/tmpl/article/default.js';
import { renderSearch } from '../src/components/com_finder/tmpl/search/default.js';
import { renderArchive } from '../src/components/com_content/tmpl/archive/default.js';
import { createApplication } from '../src/index.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { toSiteConfigOverrides } from '../src/libraries/minijoomla/application/site-config-overrides.js';
import { mergeComponentParams } from '../src/libraries/minijoomla/application/component-options.js';
import { extensionFixture } from './admin-extensions-service.test.js';

export async function runComponentOptionsRuntimeTests() {
  {
    const repos = extensionFixture();
    const stored = { tags: { showTagTitle: false, tagListLimit: 7, advanced: { keep: true } }, content: { listLimit: 11, showAuthor: false, advanced: { nested: ['keep'] } }, custom: { untouched: true } };
    const exactJson = `  ${JSON.stringify(stored, null, 2)}\n`;
    repos.siteConfig.rows.get(1).componentParamsJson = exactJson;
    const admin = createAdminService(repos);
    const before = structuredClone(repos.siteConfig.rows.get(1));
    const tags = await admin.componentOptions.get('tags');
    assert.equal(tags.available, false);
    assert.equal(tags.values.tagListLimit, 7);
    assert.equal(admin.componentOptions.list().find((component) => component.key === 'tags').available, false);
    assert.throws(() => mergeComponentParams(exactJson, 'tags', { tagListLimit: 12 }), /tags indisponíveis/);
    await assert.rejects(() => admin.componentOptions.save('tags', { tagListLimit: 12 }, { etag: tags.etag }), /tags indisponíveis/);
    assert.deepEqual(repos.siteConfig.rows.get(1), before, 'blocked tags save preserves exact JSON and ETag');
    assert.equal(repos.siteConfig.lastPatch, null);
    await admin.componentOptions.save('content', { listLimit: 13 }, { etag: tags.etag });
    const after = JSON.parse(repos.siteConfig.rows.get(1).componentParamsJson);
    assert.deepEqual(after.tags, stored.tags);
    assert.deepEqual(after.custom, stored.custom);
    assert.deepEqual(after.content.advanced, stored.content.advanced);
    assert.equal(after.content.showAuthor, false, 'partial save must not reset other declared values to defaults');
    assert.equal(after.content.listLimit, 13);
  }
  const baseArticle = {
    alias: 'a',
    title: 'Título',
    category: 'noticias',
    author: 'Autor',
    publishUp: '2026-01-01T00:00:00Z',
    introtext: '<p>Intro</p>',
    fulltext: '<p>Full</p>',
    tags: ['guia']
  };

  const noTitle = renderArticle(baseArticle, { componentParams: { showTitle: false } });
  assert.ok(!noTitle.includes('<h1>'));

  const noCategory = renderArticle(baseArticle, { componentParams: { showCategory: false } });
  assert.ok(!noCategory.includes('class="category-name"'));

  const noAuthor = renderArticle(baseArticle, { componentParams: { showAuthor: false } });
  assert.ok(!noAuthor.includes('Por Autor'));

  const list = renderArticleList({ items: [baseArticle], page: 1, pages: 1 }, { componentParams: { linkTitles: false } });
  assert.match(list, /<h2>Título<\/h2>/);
  assert.ok(!list.includes('<h2><a '));

  const withReadmore = renderArticleList({ items: [baseArticle], page: 1, pages: 1 }, { articleLink: (alias) => `#/article/${alias}`, componentParams: { showReadmore: true } });
  assert.match(withReadmore, /Leia mais/);

  const withoutReadmore = renderArticleList({ items: [baseArticle], page: 1, pages: 1 }, { componentParams: { showReadmore: false } });
  assert.ok(!withoutReadmore.includes('Leia mais'));

  const withoutIntro = renderArticleList({ items: [baseArticle], page: 1, pages: 1 }, { componentParams: { showIntro: false } });
  assert.ok(!withoutIntro.includes('<p>Intro</p>'));

  // Recovery is presentation-only: use the supplied links, never rewrite the
  // requested page or mutate the adapter's result/options.
  const unavailablePage = { items: [], total: 3, page: 999, pages: 3, pageSize: 1 };
  const unavailableSnapshot = structuredClone(unavailablePage);
  const recoveryOptions = { componentParams: { showTitle: false }, highlightQuery: 'ação & "<' };
  const recoveryOptionsSnapshot = structuredClone(recoveryOptions);
  const linkedPages = [];
  const recovery = renderArticleList(unavailablePage, {
    ...recoveryOptions,
    link: (page) => {
      linkedPages.push(page);
      return `#/portal/search?q=ação&label="<teste>"&page=${page}`;
    }
  });
  assert.match(recovery, /<p class="empty-state" role="status">Esta página de resultados está indisponível\.<\/p>/);
  assert.match(recovery, /<nav class="pagination" aria-label="Paginação">/);
  assert.deepEqual(linkedPages, [1, 3], 'recovery must link only the first and last available pages');
  for (const page of linkedPages) {
    assert.ok(recovery.includes(`href="#/portal/search?q=ação&amp;label=&quot;&lt;teste&gt;&quot;&amp;page=${page}"`), 'callback href must escape ampersands, quotes and HTML-looking text');
  }
  assert.doesNotMatch(recovery, /label="<teste>"/);
  assert.deepEqual(unavailablePage, unavailableSnapshot, 'recovery must preserve the complete input result');
  assert.deepEqual(recoveryOptions, recoveryOptionsSnapshot, 'recovery must preserve the input options');

  const singlePageLinks = [];
  const singlePageRecovery = renderArticleList({ items: [], total: 1, page: 999, pages: 1 }, {
    link: (page) => { singlePageLinks.push(page); return `#/portal/?page=${page}`; }
  });
  assert.deepEqual(singlePageLinks, [1], 'one available page must not produce a duplicate last-page link');
  assert.equal([...singlePageRecovery.matchAll(/<a href=/g)].length, 1);
  assert.match(singlePageRecovery, /Voltar à primeira página/);
  assert.doesNotMatch(singlePageRecovery, /Ir à última página/);

  const noRecoveryLink = () => assert.fail('ordinary empty results must not call the pagination callback');
  const emptyResults = [
    { items: [], total: 0, page: 999, pages: 0 },
    { items: [], total: 0, page: 999, pages: 3 },
    { items: [], total: 3, page: 1, pages: 3 },
    { items: [], total: 3, page: 3, pages: 3 }
  ];
  for (const result of emptyResults) {
    const snapshot = structuredClone(result);
    const empty = renderArticleList(result, { link: noRecoveryLink });
    assert.equal(empty, '<p class="empty-state" role="status">Nenhum artigo encontrado.</p>');
    assert.deepEqual(result, snapshot);
  }

  // highlightTerms (component `search`): wraps a literal, case-insensitive match
  // of the query in <mark> inside the raw title text, before any HTML is
  // produced — never a regex replacement over generated HTML.
  const highlighted = renderArticleList({ items: [baseArticle], page: 1, pages: 1 }, { highlightQuery: 'TÍTU' });
  assert.match(highlighted, /<mark>Títu<\/mark>lo/);

  const notHighlighted = renderArticleList({ items: [baseArticle], page: 1, pages: 1 }, {});
  assert.ok(!notHighlighted.includes('<mark>'));

  // An attacker-controlled title (HTML-looking text, never real HTML since titles
  // are plain text) and an attacker-controlled query both stay fully escaped;
  // the only unescaped markup is the fixed <mark>/</mark> wrapper.
  const unsafeArticle = { ...baseArticle, title: 'Energia <script>alert(1)</script> solar' };
  const unsafeHighlighted = renderArticleList({ items: [unsafeArticle], page: 1, pages: 1 }, { highlightQuery: 'energia' });
  assert.match(unsafeHighlighted, /<mark>Energia<\/mark>/);
  assert.ok(!unsafeHighlighted.includes('<script>alert(1)</script>'));
  const injectionAttempt = renderArticleList({ items: [baseArticle], page: 1, pages: 1 }, { highlightQuery: '"><img src=x onerror=alert(1)>' });
  assert.ok(!injectionAttempt.includes('onerror=alert(1)>'));

  // renderSearch respects the `search` component's highlightTerms option
  // (default true): disabling it must never add <mark>, even with a matching query.
  const searchResult = { items: [baseArticle], total: 1, page: 1, pages: 1 };
  const searchWithHighlight = renderSearch('TÍTU', searchResult, {});
  assert.match(searchWithHighlight, /<mark>Títu<\/mark>lo/);
  const searchWithoutHighlight = renderSearch('TÍTU', searchResult, { componentParams: { search: { highlightTerms: false } } });
  assert.ok(!searchWithoutHighlight.includes('<mark>'));

  // Achado real: das quatro superfícies que listam artigos (home, category, search,
  // archive), apenas renderArchive deixava de repassar componentParams para
  // renderArticleList — showTitle/linkTitles/showReadmore/etc. nunca se aplicavam à
  // página de arquivo, mesmo já aplicados nas outras três. src/index.js agora passa
  // componentParams: componentParams?.content à chamada de renderArchive, igual às
  // demais rotas.
  const archiveNoReadmore = renderArchive({ items: [baseArticle], page: 1, pages: 1 }, { year: 2026, month: 1, componentParams: { showReadmore: false } });
  assert.ok(!archiveNoReadmore.includes('Leia mais'));
  const archiveNoLinkTitles = renderArchive({ items: [baseArticle], page: 1, pages: 1 }, { year: 2026, month: 1, componentParams: { linkTitles: false } });
  assert.ok(!archiveNoLinkTitles.includes('<h2><a '));
  const archiveDefault = renderArchive({ items: [baseArticle], page: 1, pages: 1 }, { year: 2026, month: 1 });
  assert.match(archiveDefault, /<h2><a /, 'sem componentParams, o comportamento padrão (linkTitles true) é preservado');

  // The component-only checks above cannot detect a mismatched options shape
  // at the route boundary. Save through admin, then reload the same repositories.
  const storage = new Map();
  const repositories = createDemoRepositories({ storage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  } });
  const admin = createAdminService(repositories);
  await repositories.articles.create({
    title: 'Search fixture needle', alias: 'search-fixture', state: 'Published', categoryId: 1,
    introtext: '<p>Search fixture intro</p>', fulltext: '<p>Search fixture body</p>',
    publishUp: '2026-01-01T00:00:00Z'
  });
  async function searchHtml() {
    const freshRepositories = createDemoRepositories({ storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    } });
    const saved = await createAdminService(freshRepositories).siteConfig.get();
    const documentRef = { body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } };
    const app = createApplication({
      autoStart: false, documentRef,
      config: { ...toSiteConfigOverrides(saved), basePath: '/portal' },
      adapter: createSPMiddleAdapter({
        articleRepository: freshRepositories.articles, categoryRepository: freshRepositories.categories,
        tagRepository: freshRepositories.tags, menuRepository: freshRepositories.menu
      }),
      getModuleInstances: async () => []
    });
    try {
      await app.start();
      await app.router.navigate('#/portal/search?q=needle');
      return documentRef.body.innerHTML.match(/<section class="search-page">[\s\S]*?<\/section>/)[0];
    } finally { app.stop(); }
  }
  const defaultSearch = await searchHtml();
  assert.match(defaultSearch, /<mark>needle<\/mark>/);
  assert.match(defaultSearch, /href="#\/portal\/article\/search-fixture"/);
  // Query normalization is owned by the service; the route must render that
  // same value rather than the original whitespace-heavy input.
  {
    const documentRef = { body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } };
    const app = createApplication({
      autoStart: false, documentRef,
      config: { ...toSiteConfigOverrides(await admin.siteConfig.get()), basePath: '/portal' },
      adapter: createSPMiddleAdapter({ articleRepository: repositories.articles, categoryRepository: repositories.categories, tagRepository: repositories.tags, menuRepository: repositories.menu }),
      getModuleInstances: async () => []
    });
    try {
      await app.start();
      await app.router.navigate('#/portal/search?q=%20%20needle%09%20');
      assert.match(documentRef.body.innerHTML, /value="needle"/);
      assert.match(documentRef.body.innerHTML, /<mark>needle<\/mark>/);
      assert.doesNotMatch(documentRef.body.innerHTML, /value="  needle/);
    } finally { app.stop(); }
  }
  const searchOptions = await admin.componentOptions.get('search');
  await admin.componentOptions.save('search', { ...searchOptions.values, highlightTerms: false }, { etag: searchOptions.etag });
  assert.doesNotMatch(await searchHtml(), /<mark>/, 'persisted highlightTerms=false must reach the search route');
  const contentOptions = await admin.componentOptions.get('content');
  await admin.componentOptions.save('content', { ...contentOptions.values, linkTitles: false, showIntro: false, showReadmore: false }, { etag: contentOptions.etag });
  const configuredSearch = await searchHtml();
  assert.match(configuredSearch, /<h2>Search fixture needle<\/h2>/);
  assert.doesNotMatch(configuredSearch, /<h2><a/, 'persisted linkTitles=false must remove title links');
  assert.doesNotMatch(configuredSearch, /Search fixture intro/, 'persisted showIntro=false must remove the intro');
  assert.doesNotMatch(configuredSearch, /class="readmore"/, 'persisted showReadmore=false must remove readmore links');
  assert.doesNotMatch(configuredSearch, /<mark>/);

  // Exercise recovery through the actual router, services and SPMIDDLE adapter,
  // with separate demo storage so the persisted component options above cannot
  // hide fixture titles or links.
  const recoveryRepositories = createDemoRepositories({ storage: null });
  const recoveryQuery = 'ação & "energia" <solar>';
  for (const [alias, day] of [['recovery-first', '02'], ['recovery-last', '01']]) {
    await recoveryRepositories.articles.create({
      title: `${recoveryQuery} ${alias}`, alias, state: 'Published', categoryId: 1,
      introtext: '<p>Recovery fixture intro</p>', fulltext: '<p>Recovery fixture body</p>',
      publishUp: `2026-03-${day}T00:00:00Z`
    });
  }
  const recoveryRepositorySnapshot = await recoveryRepositories.articles.findMany();
  const recoveryDocument = { body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } };
  const recoveryApp = createApplication({
    autoStart: false, documentRef: recoveryDocument,
    config: { basePath: '/portal', pageSize: 1 },
    adapter: createSPMiddleAdapter({
      articleRepository: recoveryRepositories.articles, categoryRepository: recoveryRepositories.categories,
      tagRepository: recoveryRepositories.tags, menuRepository: recoveryRepositories.menu,
      now: '2026-11-03T00:00:00Z'
    }),
    getModuleInstances: async () => []
  });
  const recoveryNavigations = [];
  recoveryApp.events.on('onBeforeRender', (location) => recoveryNavigations.push(structuredClone(location)));
  function recoveryHrefs() {
    const navigation = recoveryDocument.body.innerHTML.match(/<nav class="pagination" aria-label="Paginação">([\s\S]*?)<\/nav>/);
    assert.ok(navigation, 'out-of-range routes must expose a recovery navigation');
    return [...navigation[1].matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  }
  try {
    await recoveryApp.start();
    for (const [path, filters] of [
      ['/search', { q: recoveryQuery }],
      ['/archive', { year: '2026', month: '3' }]
    ]) {
      const requestedHref = recoveryApp.router.link(path, { ...filters, page: 999 });
      const navigationCount = recoveryNavigations.length;
      await recoveryApp.router.navigate(requestedHref);
      assert.equal(recoveryNavigations.length, navigationCount + 1, 'recovery must not automatically redirect');
      assert.deepEqual(recoveryNavigations.at(-1).params, { ...filters, page: '999' });
      assert.match(recoveryDocument.body.innerHTML, /Esta página de resultados está indisponível\./);
      assert.doesNotMatch(recoveryDocument.body.innerHTML, /Nenhum artigo encontrado\./);
      const hrefs = recoveryHrefs();
      assert.deepEqual(hrefs, [1, 2].map((page) => recoveryApp.router.link(path, { ...filters, page }).replaceAll('&', '&amp;')),
        'first/last recovery links must preserve the basePath and every route filter');
      for (const [index, escapedHref] of hrefs.entries()) {
        // Decode HTML attribute entities, as following an actual rendered anchor
        // would, rather than synthesizing a replacement route for the test.
        const href = escapedHref.replaceAll('&amp;', '&');
        assert.ok(href.startsWith(`#/portal${path}?`));
        assert.deepEqual(recoveryApp.router.parse(href).params, { ...filters, page: String(index + 1) });
        await recoveryApp.router.navigate(href);
        assert.match(recoveryDocument.body.innerHTML, /class="article-card"/);
        assert.ok(recoveryDocument.body.innerHTML.includes(`href="#/portal/article/recovery-${index === 0 ? 'first' : 'last'}"`),
          'following the rendered recovery href must load the matching real repository item');
        assert.doesNotMatch(recoveryDocument.body.innerHTML, /Esta página de resultados está indisponível\./);
        assert.doesNotMatch(recoveryDocument.body.innerHTML, /<solar>/, 'HTML-looking query/title text must remain escaped');
      }
    }
    assert.deepEqual(await recoveryRepositories.articles.findMany(), recoveryRepositorySnapshot,
      'rendering and following recovery links must not modify repository records');
  } finally { recoveryApp.stop(); }

  console.log('ok - persisted search/content options reach the real search route after admin save/reload, with basePath-aware article links');
  console.log('ok - empty-page recovery boundaries, escaped callbacks and real search/archive navigation preserve filters and input');
  console.log('component options runtime: testes aprovados');
}
