import assert from 'node:assert/strict';
import { createApplication } from '../src/index.js';
import { createTemplateRuntime } from '../src/libraries/minijoomla/application/template-runtime.js';
import { createMiniJoomlaSiteApplication } from '../src/libraries/minijoomla/composition/createMiniJoomlaSiteApplication.js';
import { TEMPLATE_MODULE_POSITIONS } from '../src/libraries/minijoomla/modules/dynamic-modules.js';
import { articlesLatestModule } from '../src/modules/mod_articles_latest/mod_articles_latest.js';
import { articlesCategoryModule } from '../src/modules/mod_articles_category/mod_articles_category.js';
import { articlesNewsModule } from '../src/modules/mod_articles_news/mod_articles_news.js';
import { articlesArchiveModule } from '../src/modules/mod_articles_archive/mod_articles_archive.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { searchModule } from '../src/modules/mod_search/mod_search.js';
import { createConfig } from '../src/libraries/minijoomla/core/config.js';
import { createContentService } from '../src/libraries/minijoomla/application/content-service.js';
import { mountMiniJoomlaSite } from '../src/libraries/minijoomla/composition/mountMiniJoomlaSite.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { toSiteConfigOverrides } from '../src/libraries/minijoomla/application/site-config-overrides.js';
import { BUILTIN_TEMPLATES } from '../src/libraries/minijoomla/application/template-styles.js';

function documentDouble() {
  const links = [];
  return {
    body: { innerHTML: '' }, documentElement: {}, baseURI: 'https://site.invalid/examples/index.html',
    head: { appendChild: (link) => links.push(link) },
    createElement: () => ({ setAttribute(name, value) { this[name] = value; }, remove() { links.splice(links.indexOf(this), 1); } }),
    links
  };
}

function mount(options = {}) {
  const documentRef = options.documentRef ?? documentDouble();
  const app = createApplication({ documentRef, autoStart: false, ...options });
  app.router.routes = [
    { name: 'home', pattern: /^\/$/, keys: [] },
    { name: 'search', pattern: /^\/search$/, keys: [] },
    { name: 'category', pattern: /^\/category\/([^/]+)$/, keys: ['alias'] }
  ];
  return { app, documentRef };
}

export async function runSiteRuntimeTests() {
  const homeQueries = [];
  const homeAdapter = {
    getCategory: async (alias) => ({ alias, title: alias }),
    listArticles: async (query) => {
      homeQueries.push(query);
      return { items: [{ alias: 'featured-item', title: 'Featured item' }], total: 4, page: query.page, pageSize: query.pageSize };
    }
  };
  const categoryHome = createContentService(homeAdapter, createConfig({ homeCategory: 'novidades', pageSize: 2 }));
  assert.equal((await categoryHome.home({ page: 2 })).category.alias, 'novidades');
  assert.deepEqual(homeQueries.pop(), { category: 'novidades', pageSize: 2, page: 2 });
  const featuredHome = createContentService(homeAdapter, createConfig({ homeView: 'featured', pageSize: 2 }));
  assert.equal((await featuredHome.home({ page: 2 })).pages, 2);
  assert.deepEqual(homeQueries.pop(), { pageSize: 2, page: 2, featured: true });
  assert.equal(createConfig().homeCategory, 'noticias');
  assert.throws(() => createConfig({ homeView: 'missing' }), TypeError);
  assert.throws(() => createConfig({ homeCategory: '' }), TypeError);
  const home = mount({
    config: { homeView: 'featured' }, getModuleInstances: async () => [],
    adapter: { ...homeAdapter, listMenus: async () => [], listTags: async () => [] }
  });
  await home.app.router.navigate('#/');
  assert.match(home.documentRef.body.innerHTML, /Featured item/);
  assert.doesNotMatch(home.documentRef.body.innerHTML, /Não foi possível carregar/);
  console.log('ok - configurable home preserves category defaults and renders featured articles with pagination');

  const runtime = createTemplateRuntime();
  assert.equal((await runtime.resolve('cassiopeia')).key, 'cassiopeia');
  await assert.rejects(() => runtime.resolve('missing'), /não está registrado/);
  await assert.rejects(() => runtime.resolve('cassiopeia', [{ key: 'cassiopeia', enabled: false }]), /desabilitado/);
  assert.equal((await runtime.resolve('default', { key: 'cassiopeia', enabled: true })).key, 'cassiopeia');

  let templateImports = 0;
  const documentRef = documentDouble();
  const customRuntime = createTemplateRuntime({
    documentRef,
    importModule: async () => { templateImports += 1; return { renderShell: () => '<main>Template externo</main>' }; }
  });
  const record = { key: 'custom', enabled: true, entryPointUrl: '/templates/custom.js', styles: '["/templates/custom.css"]' };
  const custom = await customRuntime.resolve('custom', [record]);
  assert.match(custom.render(), /externo/);
  await customRuntime.resolve('custom', [record]);
  assert.equal(templateImports, 1);
  customRuntime.applyStyles(custom);
  customRuntime.applyStyles(custom);
  assert.equal(documentRef.links.length, 1);
  assert.equal(documentRef.links[0].href, 'https://site.invalid/templates/custom.css');
  const multiStyleRecord = { key: 'custom-multi', enabled: true, entryPointUrl: '/templates/custom.js', styles: '["/templates/custom.css","/templates/custom-2.css","/templates/custom-3.css","/templates/custom-4.css"]' };
  customRuntime.applyStyles(await customRuntime.resolve('custom-multi', [multiStyleRecord]));
  assert.equal(documentRef.links.length, 4);
  assert.ok(documentRef.links.every((link) => link['data-mj-template-style'] === 'custom-multi'));
  await assert.rejects(() => customRuntime.resolve('custom', [{ ...record, entryPointUrl: 'javascript:alert(1)' }]), /inválida/);
  await assert.rejects(() => customRuntime.resolve('custom', [{ ...record, styles: '{"invalid":true}' }]), /lista JSON|metadata/);
  await assert.rejects(() => customRuntime.resolve('custom', [{ ...record, styles: '["data:text/css,body{}"]' }]), /inválida|segura/);
  console.log('ok - template runtime validates registry, exports, assets and owned stylesheet replacement');

  for (const templateKey of BUILTIN_TEMPLATES) {
    const instances = TEMPLATE_MODULE_POSITIONS.map((position) => ({
      extensionKey: 'custom-html', position, enabled: true, settingsJson: JSON.stringify({ html: `<p>slot:${position}</p>` })
    }));
    instances.push({ extensionKey: 'custom-html', position: 'content', enabled: true, settingsJson: '{"html":"<p>legacy-content</p>"}' });
    const mounted = mount({ config: { templateKey }, getModuleInstances: async () => instances });
    await mounted.app.router.navigate('#/');
    for (const position of TEMPLATE_MODULE_POSITIONS) assert.ok(mounted.documentRef.body.innerHTML.includes(`slot:${position}`), `${templateKey}: ${position}`);
    assert.match(mounted.documentRef.body.innerHTML, /legacy-content/);
    assert.equal(mounted.documentRef.links.length, 1);
  }
  console.log('ok - every managed module position renders in every builtin template, including legacy content');

  const managed = mount({ getModuleInstances: async () => [] });
  await managed.app.router.navigate('#/');
  assert.doesNotMatch(managed.documentRef.body.innerHTML, /module-articles-latest/);
  assert.equal((managed.documentRef.body.innerHTML.match(/<h1\b/g) ?? []).length, 1);
  const disabled = mount({
    getModuleInstances: async () => [{ extensionKey: 'articles-latest', position: 'sidebar', enabled: true }],
    getExtensions: async () => [{ key: 'articles-latest', type: 'Module', enabled: false }]
  });
  await disabled.app.router.navigate('#/');
  assert.doesNotMatch(disabled.documentRef.body.innerHTML, /module-articles-latest/);
  console.log('ok - persisted module configuration is authoritative and disabled native extensions do not render');

  const managedMenu = mount({
    getModuleInstances: async () => [{ extensionKey: 'menu', position: 'sidebar', enabled: true }],
    adapter: {
      listMenus: async () => [
        { id: 1, title: 'Menu parent', path: '/' },
        { id: 2, parentId: 1, title: 'Nested child', path: '/search' }
      ],
      listTags: async () => [], listArticles: async () => ({ items: [] })
    }
  });
  await managedMenu.app.router.navigate('#/');
  assert.equal((managedMenu.documentRef.body.innerHTML.match(/Nested child/g) ?? []).length, 2);
  const submenuIds = [...managedMenu.documentRef.body.innerHTML.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(submenuIds).size, submenuIds.length);
  managedMenu.app.stop();
  console.log('ok - managed menu instances receive menu data and nested menus have distinct controls');

  // Menu-item assignment (`assignment:'only'`/`assignmentJson:'menu:<id>'`) is resolved end-to-end
  // from the real navigated path, through resolveActiveMenuItemId -> resolveModuleEntries, never
  // from a path the admin typed by hand. Two menu items point to different routes ('/' and
  // '/search'); the module is assigned to menu item 2 only and must render on '/search', not '/'.
  const menuAssignedModule = mount({
    getModuleInstances: async () => [{
      extensionKey: 'custom-html', position: 'sidebar', enabled: true, assignment: 'only',
      assignmentJson: JSON.stringify(['menu:2']), settingsJson: JSON.stringify({ html: '<p>menu-item-2-content</p>' })
    }],
    adapter: {
      listMenus: async () => [{ id: 1, title: 'Início', path: '/' }, { id: 2, title: 'Busca', path: '/search' }],
      listTags: async () => [], listArticles: async () => ({ items: [] })
    }
  });
  await menuAssignedModule.app.router.navigate('#/');
  assert.doesNotMatch(menuAssignedModule.documentRef.body.innerHTML, /menu-item-2-content/);
  await menuAssignedModule.app.router.navigate('#/search?q=x');
  assert.match(menuAssignedModule.documentRef.body.innerHTML, /menu-item-2-content/);
  menuAssignedModule.app.stop();
  console.log('ok - module instance assigned to a specific menu item renders only on that item\'s route, resolved from the live navigated path');

  let pluginImports = 0;
  let enabled = true;
  const queries = [];
  const pluginApp = mount({
    getExtensions: async () => [{ key: 'query-plugin', type: 'Plugin', enabled, entryPointUrl: '/plugins/query.js' }],
    importModule: async () => { pluginImports += 1; return { default: { events: { onSearchPrepare: (value) => `${value}-filtered` } } }; },
    adapter: {
      listMenus: async () => [], listTags: async () => [],
      listArticles: async ({ search } = {}) => { if (search) queries.push(search); return { items: [] }; }
    }
  });
  await pluginApp.app.router.navigate('#/search?q=first');
  enabled = false;
  await pluginApp.app.router.navigate('#/search?q=second');
  enabled = true;
  await pluginApp.app.router.navigate('#/search?q=third');
  assert.deepEqual(queries, ['first-filtered', 'second', 'third-filtered']);
  assert.equal(pluginImports, 1);
  console.log('ok - discovered plugin runs before first content filter and respects disable/re-enable without reimport');

  const lifecycleCalls = [];
  const lifecycle = mount({
    getExtensions: async () => [{ key: 'lifecycle', type: 'Plugin', enabled: true, entryPointUrl: '/plugins/lifecycle.js' }],
    importModule: async () => ({ default: { events: {
      onAppInit: () => lifecycleCalls.push('init'),
      onAppFinalize: () => lifecycleCalls.push('finalize')
    } } })
  });
  await lifecycle.app.start();
  await lifecycle.app.start();
  lifecycle.app.stop();
  lifecycle.app.stop();
  assert.deepEqual(lifecycleCalls, ['init', 'finalize']);
  const failedTemplate = mount({ getTemplate: async () => { throw new Error('private transport detail'); } });
  await failedTemplate.app.router.navigate('#/');
  assert.match(failedTemplate.documentRef.body.innerHTML, /Não foi possível carregar/);
  assert.doesNotMatch(failedTemplate.documentRef.body.innerHTML, /private transport detail/);
  console.log('ok - discovered plugin lifecycle is idempotent and registry failures surface a safe error state');

  const items = Array.from({ length: 10 }, (_, index) => ({ title: `Entry ${index}`, alias: `entry-${index}`, year: 2026, month: 1, count: 1 }));
  for (const [module, key] of [[articlesLatestModule, 'articles'], [articlesCategoryModule, 'items'], [articlesNewsModule, 'featuredArticles']]) {
    const html = module.render({ [key]: items, settings: { limit: 2 } });
    assert.match(html, /Entry 1/);
    assert.doesNotMatch(html, /Entry 2/);
  }
  assert.equal((articlesArchiveModule.render({ months: items, settings: { limit: 2 } }).match(/<li>/g) ?? []).length, 2);
  console.log('ok - native modules honor independent persisted item limits');
  const searchHtml = searchModule.render({ settings: { label: '<Busca>', buttonText: '<Ir>' }, link: () => '#/search' });
  assert.match(searchHtml, /role="search"/);
  assert.match(searchHtml, /<label>&lt;Busca&gt;<input type="search" name="q"/);
  assert.match(searchHtml, /&lt;Ir&gt;/);
  assert.doesNotMatch(searchHtml, /<Busca>|<Ir>/);
  console.log('ok - configurable native search module is accessible and escapes labels');

  const tables = {
    Articles: [], Categories: [], Extensions: [], Modules: [], Templates: [],
    Config: [{ Id: 1, Title: 'SiteConfig', SiteName: 'Site persistido', TemplateKey: 'cassiopeia', CustomHtmlBody: '<p>Config</p>' }]
  };
  const compositionOptions = {
    webUrl: '/sites/local', autoStart: false, documentRef: documentDouble(),
    lists: {
      articles: { listPath: "lists/getbytitle('Articles')" }, categories: { listPath: "lists/getbytitle('Categories')" },
      siteConfig: { listPath: "lists/getbytitle('Config')" }, moduleInstances: { listPath: "lists/getbytitle('Modules')" },
      extensions: { listPath: "lists/getbytitle('Extensions')" }, templates: { listPath: "lists/getbytitle('Templates')" }
    },
    transportFactory: () => ({
      webUrl: '/sites/local',
      async request(path) {
        const title = /getbytitle\('([^']+)'\)/.exec(path)?.[1];
        if (!Object.hasOwn(tables, title)) throw new Error('Unexpected request');
        return { status: 200, data: { value: tables[title] } };
      }
    })
  };
  const composition = await createMiniJoomlaSiteApplication(compositionOptions);
  assert.equal(composition.config.siteName, 'Site persistido');
  assert.equal(composition.config.templateKey, 'cassiopeia');
  assert.equal(composition.config.customHtml.html, '<p>Config</p>');
  // Verify that templateParams and templateStyleId are correctly propagated
  assert.ok(composition.config.templateParams, 'templateParams should be propagated to config');
  assert.ok(composition.config.templateStyleId, 'templateStyleId should be propagated to config');
  await composition.application.start();
  composition.application.stop();
  console.log('ok - public SPMIDDLE composition loads saved site configuration, propagates template parameters and connects runtime registries');

  const hostDocument = documentDouble();
  hostDocument.body.innerHTML = '<header>Host navigation</header>';
  hostDocument.documentElement.lang = 'en';
  hostDocument.title = 'Host title';
  const root = { innerHTML: '' };
  const mountedHost = await mountMiniJoomlaSite({ ...compositionOptions, root, documentRef: hostDocument });
  assert.match(root.innerHTML, /Site persistido/);
  assert.equal(root.lang, 'pt-BR');
  assert.equal(hostDocument.body.innerHTML, '<header>Host navigation</header>');
  assert.equal(hostDocument.documentElement.lang, 'en');
  assert.equal(hostDocument.title, 'Host title');
  assert.ok(hostDocument.links.length > 0);
  mountedHost.application.stop();
  await assert.rejects(() => mountMiniJoomlaSite({ ...compositionOptions, root: hostDocument.body, documentRef: hostDocument }), /página do host/);
  await assert.rejects(() => mountMiniJoomlaSite({ ...compositionOptions, root: hostDocument.documentElement, documentRef: hostDocument }), TypeError);
  const failedRoot = { innerHTML: '', setAttribute(name, value) { this[name] = value; } };
  await assert.rejects(() => mountMiniJoomlaSite({ root: failedRoot, documentRef: hostDocument, webUrl: '/sites/local' }), TypeError);
  assert.equal(failedRoot.role, 'alert');
  assert.match(failedRoot.textContent, /Não foi possível iniciar o site/);
  assert.doesNotMatch(failedRoot.textContent, /lists\.articles/);
  console.log('ok - SharePoint host mounts only its dedicated container and preserves host navigation, title and language');

  const savedDemo = new Map();
  const storage = { getItem: (key) => savedDemo.get(key) ?? null, setItem: (key, value) => savedDemo.set(key, value) };
  const demo = createDemoRepositories({ storage });
  const admin = createAdminService(demo);
  const moduleRow = await admin.moduleInstances.get(1);
  const updated = await admin.moduleInstances.update(1, { enabled: false }, { etag: moduleRow.etag });
  const again = await admin.moduleInstances.update(1, { enabled: true }, { etag: updated.etag });
  assert.notEqual(updated.etag, again.etag);
  await assert.rejects(() => admin.moduleInstances.update(1, { enabled: false }, { etag: updated.etag }), { code: 'concurrency-conflict' });
  const reopened = createDemoRepositories({ storage });
  assert.equal((await reopened.moduleInstances.findById(1)).enabled, true);
  const configRow = await admin.siteConfig.get();
  await admin.siteConfig.save({ templateKey: 'cassiopeia' }, { etag: configRow.etag });
  assert.equal((await reopened.siteConfig.findById(1)).templateKey, 'cassiopeia');
  console.log('ok - local admin demo shares persistent repositories with the site and enforces fresh ETags');

  // End-to-end proof (Node, no browser) of plan item 1.3.4: edit a parameter in the
  // ADMIN service with the captured ETag -> persisted via the SAME repositories the
  // public site reads from -> a fresh navigation re-reads it and the resulting HTML
  // changes accordingly. Covers both a module instance field (title) and a template
  // style parameter (Cassiopeia siteTitle), proving the admin write is not merely
  // "saved" but actually consumed end-to-end by the public rendering path.
  const e2eStorage = new Map();
  const e2eRepos = createDemoRepositories({ storage: { getItem: (key) => e2eStorage.get(key) ?? null, setItem: (key, value) => e2eStorage.set(key, value) } });
  const e2eAdmin = createAdminService(e2eRepos);
  const e2eAdapter = createSPMiddleAdapter({
    articleRepository: e2eRepos.articles, categoryRepository: e2eRepos.categories,
    tagRepository: e2eRepos.tags, menuRepository: e2eRepos.menu
  });
  async function renderE2EHome() {
    const configRecord = await e2eAdmin.siteConfig.get();
    const documentRef = documentDouble();
    const app = createApplication({
      adapter: e2eAdapter, documentRef, autoStart: false,
      config: toSiteConfigOverrides(configRecord),
      getModuleInstances: async () => (await e2eRepos.moduleInstances.findMany()).items,
      getExtensions: async () => (await e2eRepos.extensions.findMany()).items,
      getTemplate: async () => (await e2eRepos.templates.findMany()).items
    });
    app.router.routes = [{ name: 'home', pattern: /^\/$/, keys: [] }];
    await app.router.navigate('#/');
    return documentRef.body.innerHTML;
  }

  // 1. Edit a module instance's title with its real ETag; the public home re-render must show the new title.
  const beforeModuleEdit = await renderE2EHome();
  assert.match(beforeModuleEdit, /Artigos recentes/);
  assert.doesNotMatch(beforeModuleEdit, /Artigos recentes — editado/);
  const moduleToEdit = await e2eAdmin.moduleInstances.get(1);
  await e2eAdmin.moduleInstances.update(1, { settings: { ...JSON.parse(moduleToEdit.settingsJson ?? '{}'), headerTag: 'h3' } }, { etag: moduleToEdit.etag });
  const afterModuleEdit = await renderE2EHome();
  assert.match(afterModuleEdit, /<h3[^>]*>Artigos recentes<\/h3>/, 'headerTag persisted via admin ETag must be visible on the public re-render, not just stored');
  // A stale ETag (captured before the edit above) must now be rejected, never silently overwrite.
  await assert.rejects(() => e2eAdmin.moduleInstances.update(1, { title: 'Conflito' }, { etag: moduleToEdit.etag }), { code: 'concurrency-conflict' });

  // 2. Edit the Cassiopeia template style's siteTitle; the public home re-render must show it in the brand.
  const beforeStyleEdit = await renderE2EHome();
  assert.doesNotMatch(beforeStyleEdit, /Portal Editado/);
  const cassiopeiaStyle = await e2eAdmin.templateStyles.get('cassiopeia-default');
  await e2eAdmin.templateStyles.save('cassiopeia-default', { params: { ...cassiopeiaStyle.params, brand: 'title', siteTitle: 'Portal Editado' } }, { etag: cassiopeiaStyle.etag });
  const afterStyleEdit = await renderE2EHome();
  assert.match(afterStyleEdit, /Portal Editado/, 'template style param saved with ETag must be visible on the public re-render HTML');

  console.log('ok - admin edit with real ETag (module headerTag, template style siteTitle) is visible end-to-end on a fresh public render, and a stale ETag on the same record is rejected');

   // Create a NEW module instance via the real admin service, confirm it
  // renders on the public home, then delete it through the real two-step
  // flow (trash first, delete only allowed afterwards — moduleState must be
  // 'trashed', enforced by admin-extensions-service.js) and confirm a fresh
  // navigation no longer renders it, with every other module untouched.
  const extraModule = await e2eAdmin.moduleInstances.create({ title: 'Nota removível', extensionKey: 'custom-html', position: 'sidebar-right', settings: { html: '<p>nota-removivel-conteudo</p>' } });
  const beforeRemoval = await renderE2EHome();
  assert.match(beforeRemoval, /nota-removivel-conteudo/);
  assert.match(beforeRemoval, /Artigos recentes/, 'the pre-existing module must still render alongside the new one');
  const prematureDeleteReport = await e2eAdmin.moduleInstances.batch([{ id: extraModule.id, etag: extraModule.etag }], 'delete');
  assert.equal(prematureDeleteReport.succeeded.length, 0, 'delete before trash must be rejected, never silently deleted');
  assert.equal(prematureDeleteReport.failed[0]?.id, extraModule.id);
  const trashReport = await e2eAdmin.moduleInstances.batch([{ id: extraModule.id, etag: extraModule.etag }], 'trash');
  assert.deepEqual(trashReport.succeeded, [extraModule.id]);
  const trashedModule = await e2eAdmin.moduleInstances.get(extraModule.id);
  const deleteReport = await e2eAdmin.moduleInstances.batch([{ id: extraModule.id, etag: trashedModule.etag }], 'delete');
  assert.deepEqual(deleteReport.succeeded, [extraModule.id]);
  const afterRemoval = await renderE2EHome();
  assert.doesNotMatch(afterRemoval, /nota-removivel-conteudo/);
  assert.match(afterRemoval, /Artigos recentes/, 'removing one module must not affect the others');
  assert.equal(await e2eAdmin.moduleInstances.get(extraModule.id), null, 'the deleted row must truly be gone, not merely hidden');
   console.log('ok - deleting an additional module instance through the real two-step (trash, then delete) admin flow removes it from a fresh public render, without affecting the other persisted modules');

   // A configured repository remains authoritative after deleting ALL rows,
   // including the last one. Reopen storage and compose a fresh public app to
   // distinguish a persisted empty collection from an absent repository.
   const removalStorageData = new Map();
   const removalStorage = {
     getItem: (key) => removalStorageData.get(key) ?? null,
     setItem: (key, value) => removalStorageData.set(key, value)
   };
   const removalRepos = createDemoRepositories({ storage: removalStorage });
   const removalAdmin = createAdminService(removalRepos);
   async function renderRemovalHome({ managed = true } = {}) {
     const repos = createDemoRepositories({ storage: removalStorage });
     const configRecord = await createAdminService(repos).siteConfig.get();
     const doc = documentDouble();
     const moduleReads = [];
     const app = createApplication({
       documentRef: doc, autoStart: false, config: toSiteConfigOverrides(configRecord),
       adapter: createSPMiddleAdapter({
         articleRepository: repos.articles, categoryRepository: repos.categories,
         tagRepository: repos.tags, menuRepository: repos.menu
       }),
       ...(managed ? { getModuleInstances: async () => {
         const rows = (await repos.moduleInstances.findMany()).items;
         moduleReads.push(rows);
         return rows;
       } } : {}),
       getExtensions: async () => (await repos.extensions.findMany()).items,
       getTemplate: async () => (await repos.templates.findMany()).items
     });
     app.router.routes = [{ name: 'home', pattern: /^\/$/, keys: [] }];
     try {
       await app.router.navigate('#/');
       return { html: doc.body.innerHTML, moduleReads };
     } finally { app.stop(); }
   }
   const persistedModules = (await removalRepos.moduleInstances.findMany()).items;
   assert.equal(persistedModules.length, 7, 'the test must start with every demo module row');
   const beforeAllRemoval = await renderRemovalHome();
   for (const row of persistedModules) assert.ok(beforeAllRemoval.html.includes(`module-${row.extensionKey}`), `persisted ${row.extensionKey} must render before removal`);
   const allTrashReport = await removalAdmin.moduleInstances.batch(persistedModules.map(({ id, etag }) => ({ id, etag })), 'trash');
   assert.deepEqual(allTrashReport.failed, []);
   assert.deepEqual(allTrashReport.succeeded, persistedModules.map(({ id }) => id));
   const allTrashedRows = (await removalRepos.moduleInstances.findMany()).items;
   assert.equal(allTrashedRows.length, persistedModules.length, 'trash must retain every row until permanent deletion');
   for (const row of allTrashedRows) {
     assert.equal(row.trashed, true);
     assert.equal(row.enabled, false);
     assert.notEqual(row.etag, persistedModules.find(({ id }) => id === row.id).etag, 'delete must use the fresh ETag captured after trash');
   }
   const allDeleteReport = await removalAdmin.moduleInstances.batch(allTrashedRows.map(({ id, etag }) => ({ id, etag })), 'delete');
   assert.deepEqual(allDeleteReport.failed, []);
   assert.deepEqual(allDeleteReport.succeeded, persistedModules.map(({ id }) => id));
   assert.deepEqual((await removalRepos.moduleInstances.findMany()).items, []);
   assert.deepEqual((await createDemoRepositories({ storage: removalStorage }).moduleInstances.findMany()).items, [], 'reopening storage must not reseed the deleted last row');
   const afterAllRemoval = await renderRemovalHome();
   assert.deepEqual(afterAllRemoval.moduleReads, [[]], 'the fresh public app must actually read the configured repository and receive []');
   assert.doesNotMatch(afterAllRemoval.html, /class="module\b|module-empty|module-error/, 'no persisted or default module may reappear when the configured repository is empty');
   assert.doesNotMatch(afterAllRemoval.html, /data-mj-position="(?:sidebar-left|sidebar-right|search)"/);
   assert.match(afterAllRemoval.html, /data-template="cassiopeia"/);
   for (const title of ['Bem-vindo ao MINIJOOMLA', 'Organize o seu portal']) {
     assert.match(afterAllRemoval.html, new RegExp(`<main\\b[\\s\\S]*${title}[\\s\\S]*<\\/main>`), 'legitimate component content must remain');
   }
   assert.match(afterAllRemoval.html, /data-mj-position="menu"[\s\S]*href="#\/category\/noticias"/, 'template navigation is not a removed module instance');
   assert.match(afterAllRemoval.html, /<nav aria-label="Breadcrumb">/);
   assert.doesNotMatch(afterAllRemoval.html, /Não foi possível carregar/);
   const absentRepository = await renderRemovalHome({ managed: false });
   assert.deepEqual(absentRepository.moduleReads, [], 'the legacy fallback scenario must omit getModuleInstances entirely');
   for (const name of ['articles-latest', 'articles-news', 'tags-popular', 'articles-archive']) {
     assert.ok(absentRepository.html.includes(`module-${name}`), `absent repository must still render default ${name}`);
   }
   console.log('ok - trash/delete of ALL demo module rows persists zero rows and suppresses defaults on a recomposed public app, while component/template navigation and absent-repository fallback remain intact');

  // Breadcrumb root/ancestor link policy end-to-end (docs/JOOMLA-EQUIVALENCE.md
  // §3.1): on a category route, "Início" and every ancestor category must be
  // real navigable links; only the current (last) item stays plain text with
  // aria-current. Hierarchical category: "root" -> "child".
  const breadcrumbSite = mount({
    adapter: {
      listMenus: async () => [],
      listTags: async () => [],
      listArticles: async () => ({ items: [] }),
      getCategory: async (alias) => ({ alias, title: alias === 'root' ? 'Raiz' : 'Filha' }),
      getCategoryPath: async () => [{ alias: 'root', title: 'Raiz' }, { alias: 'child', title: 'Filha' }]
    }
  });
  await breadcrumbSite.app.router.navigate('#/category/child');
  const breadcrumbHtml = breadcrumbSite.documentRef.body.innerHTML;
  assert.match(breadcrumbHtml, /<li><a href="#\/">Início<\/a><\/li>/);
  assert.match(breadcrumbHtml, /<li><a href="#\/category\/root">Raiz<\/a><\/li>/);
  assert.match(breadcrumbHtml, /<li aria-current="page">Filha<\/li>/);
  assert.ok(!breadcrumbHtml.includes('<a href="#/category/child">Filha</a>'), 'the current page item must never become a link');
  console.log('ok - breadcrumb renders "Início" and every ancestor category as a real navigable link end-to-end, keeping only the current page as plain aria-current text');

  // §3 item 3 of the continuity plan ("categoria inexistente", "estados
  // vazio/erro"): navigating to an unknown category alias through the real
  // application must render the accessible 404 state (never leak adapter
  // detail, never throw) AND the breadcrumb trail must still end in a plain
  // "404" label (no href, matching src/index.js's categoryPath.length
  // fallback), while "Início" stays a real link.
  const unknownCategorySite = mount({
    adapter: {
      listMenus: async () => [], listTags: async () => [], listArticles: async () => ({ items: [] }),
      getCategory: async () => null, getCategoryPath: async () => []
    }
  });
  await unknownCategorySite.app.router.navigate('#/category/inexistente');
  const unknownCategoryHtml = unknownCategorySite.documentRef.body.innerHTML;
  assert.match(unknownCategoryHtml, /error-state[^>]*role="alert"/);
  assert.match(unknownCategoryHtml, /Categoria não encontrada/);
  assert.match(unknownCategoryHtml, /<li><a href="#\/">Início<\/a><\/li>/);
  assert.match(unknownCategoryHtml, /<li aria-current="page">404<\/li>/);
  console.log('ok - navigating to an unknown category alias renders the accessible 404 state and a breadcrumb trail ending in a plain "404" label, while "Início" remains a real link');

  // Browser back/forward (popstate) through the real application, not just
  // the isolated Router unit test: two real navigations, then a simulated
  // back button AND forward button (popstate, hash already updated by the
  // browser) must re-render the correct page content without re-pushing history.
  const historyListeners = new Map();
  const previousAddEventListener = globalThis.addEventListener;
  const previousRemoveEventListener = globalThis.removeEventListener;
  const previousLocation = globalThis.location;
  const previousHistory = globalThis.history;
  globalThis.addEventListener = (name, listener) => historyListeners.set(name, listener);
  globalThis.removeEventListener = (name, listener) => { if (historyListeners.get(name) === listener) historyListeners.delete(name); };
  globalThis.location = { hash: '#/' };
  globalThis.history = { pushState: (_state, _title, hash) => { globalThis.location.hash = hash; } };
  try {
    const backForwardDocumentRef = documentDouble();
    const backForwardApp = createApplication({
      documentRef: backForwardDocumentRef, autoStart: false,
      adapter: { listMenus: async () => [], listTags: async () => [], listArticles: async () => ({ items: [] }), getCategory: async (alias) => ({ alias, title: alias === 'primeira' ? 'Primeira' : 'Segunda' }) }
    });
    backForwardApp.router.routes = [{ name: 'category', pattern: /^\/category\/([^/]+)$/, keys: ['alias'] }];
    await backForwardApp.router.start(backForwardApp.router.routes);
    await backForwardApp.router.navigate('#/category/primeira');
    assert.match(backForwardDocumentRef.body.innerHTML, /Primeira/);
    await backForwardApp.router.navigate('#/category/segunda');
    assert.match(backForwardDocumentRef.body.innerHTML, /Segunda/);

    // BACK: the browser has already reverted location.hash before firing popstate.
    globalThis.location.hash = '#/category/primeira';
    await historyListeners.get('popstate')();
    assert.match(backForwardDocumentRef.body.innerHTML, /Primeira/);
    assert.doesNotMatch(backForwardDocumentRef.body.innerHTML, /Segunda/);

    // FORWARD: browser has already advanced location.hash before firing popstate.
    globalThis.location.hash = '#/category/segunda';
    await historyListeners.get('popstate')();
    assert.match(backForwardDocumentRef.body.innerHTML, /Segunda/);
    assert.doesNotMatch(backForwardDocumentRef.body.innerHTML, /Primeira/);
    backForwardApp.stop();
  } finally {
    globalThis.addEventListener = previousAddEventListener;
    globalThis.removeEventListener = previousRemoveEventListener;
    globalThis.location = previousLocation;
    globalThis.history = previousHistory;
  }
  console.log('ok - browser back+forward navigation (popstate) through the real application re-renders the previous/next category page content');

  // §3.3 (plano de continuidade): paginação fora do intervalo deve ser
  // exercitada através do runtime real (createApplication) com adapter local
  // real (createSPMiddleAdapter) e dados representativos, provando o
  // comportamento vigente: page < 1 é normalizado para 1, mas page > pages
  // NÃO é clampado automaticamente (o adapter mantém o pageNumber solicitado).
  // O teste compara HTML do <main> para evitar ruído do shell e posições.
  const pagingStorage = new Map();
  const pagingRepos = createDemoRepositories({
    storage: {
      getItem: (key) => pagingStorage.get(key) ?? null,
      setItem: (key, value) => pagingStorage.set(key, value)
    }
  });

  // Create representative deterministic content: 5 published articles in the
  // only demo category ("noticias"), with distinct aliases and publishUp.
  for (let index = 0; index < 5; index += 1) {
    const alias = `paging-${index + 1}`;
    await pagingRepos.articles.create({
      title: `Paging Entry ${index + 1}`,
      alias,
      state: 'Published',
      featured: false,
      categoryId: 1,
      introtext: `Intro ${index + 1}`,
      fulltext: `<p>Body ${index + 1}</p>`,
      publishUp: `2026-03-0${index + 1}`,
      tags: 'notícias'
    });
  }

  const pagingAdapter = createSPMiddleAdapter({
    articleRepository: pagingRepos.articles,
    categoryRepository: pagingRepos.categories,
    tagRepository: pagingRepos.tags,
    menuRepository: pagingRepos.menu
  });

  function mainHtmlOf(html) {
    const match = /<main\b[\s\S]*?<\/main>/.exec(html);
    assert.ok(match, 'expected a <main>...</main> region in the rendered html');
    return match[0];
  }

  async function renderCategoryMain(href) {
    const doc = documentDouble();
    const app = createApplication({
      documentRef: doc,
      autoStart: false,
      adapter: pagingAdapter,
      config: { pageSize: 2 },
      getModuleInstances: async () => [],
      getExtensions: async () => (await pagingRepos.extensions.findMany()).items,
      getTemplate: async () => (await pagingRepos.templates.findMany()).items
    });
    app.router.routes = [{ name: 'category', pattern: /^\/category\/([^/]+)$/, keys: ['alias'] }];
    try {
      await app.router.navigate(href);
      return mainHtmlOf(doc.body.innerHTML);
    } finally { app.stop(); }
  }

  // Page 1 (valid) must render the newest items (sorted by publishUp desc).
  const page1 = await renderCategoryMain('#/category/noticias?page=1');
  assert.match(page1, /<nav class="pagination"/);
  assert.match(page1, /<span>Página 1 de 4<\/span>/);
  assert.match(page1, /<a href="#\/category\/noticias\?page=1" aria-current="page">1<\/a>/);
  assert.match(page1, /<a href="#\/category\/noticias\?page=2">2<\/a>/);
  assert.match(page1, /<a href="#\/category\/noticias\?page=3">3<\/a>/);
  assert.match(page1, /<a href="#\/category\/noticias\?page=4">4<\/a>/);
  assert.match(page1, /Paging Entry 5/);
  assert.match(page1, /Paging Entry 4/);
  assert.doesNotMatch(page1, /Paging Entry 1/);

  // Page 4 (valid last page) must render only the oldest remaining item.
  const page4 = await renderCategoryMain('#/category/noticias?page=4');
  assert.match(page4, /<span>Página 4 de 4<\/span>/);
  assert.match(page4, /<a href="#\/category\/noticias\?page=4" aria-current="page">4<\/a>/);
  // Initial demo data already has 2 published items; with 5 created above and
  // pageSize=2, the last page contains exactly one item: the oldest demo entry.
  assert.match(page4, /Bem-vindo ao MINIJOOMLA/);
  assert.doesNotMatch(page4, /Paging Entry 5/);
  assert.doesNotMatch(page4, /Paging Entry 4/);

  // An out-of-range page is not an empty category: offer recovery without
  // changing the requested page or issuing another adapter query implicitly.
  const page999 = await renderCategoryMain('#/category/noticias?page=999');
  assert.match(page999, /role="status">Esta página de resultados está indisponível\./);
  assert.match(page999, /<nav class="pagination" aria-label="Paginação">/);
  assert.doesNotMatch(page999, /Nenhum artigo encontrado|aria-current|article-card/);
  const recovery = [...page999.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(recovery.map((match) => match[1]), ['#/category/noticias?page=1', '#/category/noticias?page=4']);
  assert.match(await renderCategoryMain(recovery[0][1]), /Paging Entry 5/);
  assert.match(await renderCategoryMain(recovery[1][1]), /Bem-vindo ao MINIJOOMLA/);
  assert.doesNotMatch(page999, /Paging Entry 5/);

  // Page=0 / negative are normalized to 1 (Math.max(1, ...)) by the adapter.
  const page0 = await renderCategoryMain('#/category/noticias?page=0');
  assert.match(page0, /<span>Página 1 de 4<\/span>/);
  assert.match(page0, /Paging Entry 5/);
  const pageNeg = await renderCategoryMain('#/category/noticias?page=-10');
  assert.match(pageNeg, /<span>Página 1 de 4<\/span>/);
  assert.match(pageNeg, /Paging Entry 5/);

  // Empty category: when the category exists but has no published items, the
  // page is still 1 and the empty state is rendered.
  await pagingRepos.categories.create({ title: 'Vazia', alias: 'vazia', description: 'Sem artigos', parentId: null });
  const emptyCategory = await renderCategoryMain('#/category/vazia?page=2');
  assert.match(emptyCategory, /<h1>Vazia<\/h1>/);
  assert.match(emptyCategory, /Nenhum artigo encontrado\./);
  assert.doesNotMatch(emptyCategory, /<nav class="pagination"/);
  console.log('ok - pagination behavior is exercised end-to-end via createApplication + local SPMIDDLE adapter with deterministic data (page<1 normalized, out-of-range page preserved)');
}
