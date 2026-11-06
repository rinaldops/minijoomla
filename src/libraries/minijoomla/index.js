import { createConfig } from './core/config.js';
import { Router } from './core/router.js';
import { EventBus } from './core/events.js';
import { createFakeAdapter } from './infrastructure/fake-adapter.js';
import { createContentService } from './application/content-service.js';
import { createTemplateRuntime } from './application/template-runtime.js';
import { createModuleStyles } from './application/module-styles.js';
import { createModuleRegistry, menuModule } from './modules/registry.js';
import { breadcrumbsModule } from '../../modules/mod_breadcrumbs/mod_breadcrumbs.js';
import { searchModule } from '../../modules/mod_search/mod_search.js';
import { bindMenuTree } from '../../modules/mod_menu/tmpl/default.js';
import { articlesLatestModule } from '../../modules/mod_articles_latest/mod_articles_latest.js';
import { articlesCategoryModule } from '../../modules/mod_articles_category/mod_articles_category.js';
import { articlesNewsModule } from '../../modules/mod_articles_news/mod_articles_news.js';
import { tagsSimilarModule } from '../../modules/mod_tags_similar/mod_tags_similar.js';
import { tagsPopularModule } from '../../modules/mod_tags_popular/mod_tags_popular.js';
import { articlesArchiveModule } from '../../modules/mod_articles_archive/mod_articles_archive.js';
import { customHtmlModule } from '../../modules/mod_custom/mod_custom.js';
import { loginModule } from '../../modules/mod_login/mod_login.js';
import { articlesCategoriesModule } from '../../modules/mod_articles_categories/mod_articles_categories.js';
import { relatedItemsModule } from '../../modules/mod_related_items/mod_related_items.js';
import { footerModule } from '../../modules/mod_footer/mod_footer.js';
import { articlesModule } from '../../modules/mod_articles/mod_articles.js';
import { DEFAULT_IMPORT, createExtensionLoader, resolveModuleEntries } from './modules/dynamic-modules.js';
import { resolveActiveMenuItemId } from './application/module-assignment.js';
import { createPluginManager } from './plugins/manager.js';
import { emailcloakPlugin } from '../../plugins/content/emailcloak/emailcloak.js';
import { pagebreakPlugin } from '../../plugins/content/pagebreak/pagebreak.js';
import { loadmodulePlugin } from '../../plugins/content/loadmodule/loadmodule.js';
import { pagenavigationPlugin } from '../../plugins/content/pagenavigation/pagenavigation.js';
import { renderArticle, renderArticleList } from '../../components/com_content/tmpl/article/default.js';
import { renderCategory } from '../../components/com_content/tmpl/category/default.js';
import { renderCategories } from '../../components/com_content/tmpl/categories/default.js';
import { renderTag } from '../../components/com_tags/tmpl/tag/default.js';
import { renderTagList } from '../../components/com_tags/tmpl/tags/default.js';
import { renderFeatured } from '../../components/com_content/tmpl/featured/default.js';
import { blogSettings } from '../../components/com_content/tmpl/category/blog.js';
import { renderSearch } from '../../components/com_finder/tmpl/search/default.js';
import { renderArchive } from '../../components/com_content/tmpl/archive/default.js';
import { renderShell } from '../../templates/cassiopeia/index.js';
import { renderCamapShell } from '../../templates/camap/index.js';
import { escapeHtml } from './security/sanitize.js';
import { normalizePageSize, queryInteger } from './core/contracts.js';

const ROUTES = [
  { name: 'article', pattern: /^\/article\/([^/]+)$/, keys: ['alias'] },
  { name: 'category', pattern: /^\/category\/([^/]+)$/, keys: ['alias'] },
  { name: 'categories', pattern: /^\/categories$/, keys: [] },
  { name: 'tag', pattern: /^\/tag\/([^/]+)$/, keys: ['alias'] },
  { name: 'tags', pattern: /^\/tags$/, keys: [] },
  { name: 'search', pattern: /^\/search$/, keys: [] },
  { name: 'archive', pattern: /^\/archive$/, keys: [] },
  { name: 'home', pattern: /^\/$/, keys: [] }
];
// Plugins nativos são opt-in: só rodam com uma linha Plugin habilitada apontando para `native:<chave>`.
const NATIVE_PLUGINS = Object.freeze(Object.fromEntries([emailcloakPlugin, pagebreakPlugin, loadmodulePlugin, pagenavigationPlugin].map((plugin) => [`native:${plugin.name}`, plugin])));
const LOAD_ERROR = '<section class="error-state" role="alert"><h1>Não foi possível carregar</h1><p>Tente novamente mais tarde.</p></section>';

export function createApplication({
  adapter = createFakeAdapter(), config = {}, documentRef = globalThis.document,
  autoStart = true, template, plugins: pluginDefinitions = [],
  getModuleInstances, getExtensions = async () => [], getTemplate = async () => null, importModule, moduleStyles, moduleStyleRevisions
} = {}) {
  const siteConfig = createConfig(config);
  const events = new EventBus();
  const content = createContentService(adapter, siteConfig);
  const modules = createModuleRegistry()
    .register('menu', menuModule).register('breadcrumbs', breadcrumbsModule).register('search', searchModule)
    .register('articles-latest', articlesLatestModule).register('articles-category', articlesCategoryModule)
    .register('articles-news', articlesNewsModule).register('tags-similar', tagsSimilarModule)
    .register('tags-popular', tagsPopularModule).register('articles-archive', articlesArchiveModule)
    .register('custom-html', customHtmlModule).register('login', loginModule)
    .register('articles-categories', articlesCategoriesModule).register('related-items', relatedItemsModule)
    .register('footer', footerModule).register('articles', articlesModule);
  const extensionLoader = createExtensionLoader({ importModule: (url) => NATIVE_PLUGINS[url] ?? (importModule ?? DEFAULT_IMPORT)(url) });
  const templateRuntime = createTemplateRuntime({ importModule, documentRef });
  const externalStyles = createModuleStyles({ moduleStyles, moduleStyleRevisions, documentRef });
  const templateKey = template ?? siteConfig.templateKey;
  let activeRenderer = templateKey === 'camap' ? renderCamapShell : renderShell;
  let cleanupShell = () => {};
  function renderPage(args) {
    try { return activeRenderer(args); }
    catch {
      console.warn('MINIJOOMLA: falha no template selecionado.');
      return renderShell({ ...args, content: LOAD_ERROR });
    }
  }
  const plugins = createPluginManager();
  for (const plugin of Array.isArray(pluginDefinitions) ? pluginDefinitions : []) plugins.register(plugin);
  let latestNavigation = 0;
  let started = false;
  const customHtmlEntry = siteConfig.customHtml ? [{ name: 'custom-html', order: 40, settings: siteConfig.customHtml }] : [];

  function flattenCategories(nodes, parentId = null) {
    return nodes.flatMap(({ category, count, children = [] }) => [{ ...category, parentId, count }, ...flattenCategories(children, category.id)]);
  }

  const pluginContext = (article, field, moduleContext, renderedModules) => ({
    article, field,
    renderModule: (name) => (modules.has(name) ? modules.render(name, moduleContext) : ''),
    renderPosition: (position) => renderedModules[position] ?? ''
  });
  const PLACEHOLDER = /\{(?:loadmodule|loadposition)\b[^}]*\}/g;

  // Cards das listagens: plugins de conteúdo só sobre a introdução (módulos só rodam se citados no texto).
  async function prepareCards(result, moduleContext, renderedModules) {
    if (!Array.isArray(result?.items)) return result;
    const items = await Promise.all(result.items.map(async (item) => {
      const text = await plugins.prepareContent(item.introtext, { ...pluginContext(item, 'introtext', moduleContext, renderedModules), card: true });
      return { ...item, introtext: String(text ?? '').replace(PLACEHOLDER, '') };
    }));
    return { ...result, items };
  }

  // O adapter SharePoint entrega só categoryId; o módulo articles filtra por alias.
  async function withCategoryAlias(items) {
    if (!items.some((item) => !item.categoryAlias && item.categoryId != null)) return items;
    const aliases = new Map((await adapter.listCategories()).map((row) => [String(row.id), row.alias]));
    return items.map((item) => (item.categoryAlias || item.categoryId == null ? item : { ...item, categoryAlias: aliases.get(String(item.categoryId)) }));
  }

  // ponytail: varre no máximo 20 páginas de 50 (1000 artigos) da categoria; acima disso o artigo mais antigo perde anterior/próximo.
  async function categorySiblings(categoryAlias) {
    const items = [];
    for (let page = 1; page <= 20; page += 1) {
      const result = await adapter.listArticles({ category: categoryAlias, pageSize: 50, page });
      items.push(...(result?.items ?? []));
      if (page >= (Number(result?.pages) || 0)) break;
    }
    return items;
  }

  async function renderArticleBody(article, location, moduleContext, renderedModules) {
    const link = (path, params) => router.link(path, params);
    const prepare = (field) => plugins.prepareContent(article[field], {
      ...pluginContext(article, field, moduleContext, renderedModules),
      page: location.params.page, pageLink: (page) => router.link(location.path, { page })
    });
    const filtered = { ...article, introtext: await prepare('introtext'), fulltext: await prepare('fulltext') };
    const siblings = plugins.has('pagenavigation') && article.categoryAlias
      ? await categorySiblings(article.categoryAlias) : [];
    const display = { article, siblings, link };
    const html = renderArticle(filtered, {
      link, categoryLink: (alias) => link(`/category/${encodeURIComponent(alias)}`), timezone: siteConfig.timezone,
      componentParams: siteConfig.componentParams?.content, afterTitle: await plugins.contentAfterTitle(display)
    });
    return `${await plugins.contentBeforeDisplay(display)}${html}${await plugins.contentAfterDisplay(display)}`;
  }

  let lastPath;
  const router = new Router({ base: siteConfig.basePath, onNavigate: async (location) => {
    const navigationId = ++latestNavigation;
    let menus = [];
    let body = '<section class="loading-state" role="status" aria-live="polite" aria-atomic="true"><h1>Carregando…</h1></section>';
    const crumbs = [{ label: 'Início', href: router.link('/') }];
    const renderedModules = {};
    const activeModuleKeys = new Set();
    let activeExtensions = [];
    let selectedTemplate;
    let similarArticles = [];
    let pendingArticle = null;
    let renderDeferred = null;
    let menuActivePath = location.path;
    const componentParams = siteConfig.componentParams;
    cleanupShell();
    cleanupShell = () => {};
    if (documentRef) documentRef.body.innerHTML = renderPage({ config: siteConfig, menus: '', breadcrumbs: '', content: body, busy: true });
    try {
      await events.emit('onBeforeRender', location);
      const [menuRows, moduleInstances, extensions, templates] = await Promise.all([
        adapter.listMenus(), getModuleInstances ? getModuleInstances() : [],
        getExtensions(), getTemplate()
      ]);
      if (navigationId !== latestNavigation) return;
      menus = menuRows;
      selectedTemplate = await templateRuntime.resolve(templateKey, templates);
      await extensionLoader.ensurePluginsRegistered(plugins, extensions, {
        onRegister: (name) => started ? plugins.init({ config: siteConfig }, name) : undefined,
        onRemove: (name) => started ? plugins.finalize({ config: siteConfig }, name) : undefined
      });
      if (navigationId !== latestNavigation) return;
      const link = (path, params) => router.link(path, params);

      // Maintenance gate: keeps the shell (menus/modules/template) but replaces
      // the main content for any route.
      if (siteConfig.offline === true) {
        body = `<section class="maintenance-state" role="alert"><h1>Site em manutenção</h1><p>${escapeHtml(siteConfig.offlineMessage || 'Voltaremos em breve.')}</p></section>`;
      } else if (location.route?.name === 'article') {
        const article = await content.article(location.params.alias);
        if (article) {
          pendingArticle = article;
          similarArticles = await content.similarArticles(location.params.alias, { limit: 5 });
        } else body = '<section class="error-state" role="alert"><h1>404</h1><p>Artigo não encontrado.</p></section>';
        crumbs.push({ label: article?.title ?? '404' });
      } else if (location.route?.name === 'category') {
        const { layout: layoutParam, sort: sortParam, dir, filter = '' } = location.params;
        const layout = layoutParam === 'list' ? 'list' : 'blog';
        const { sort, direction } = content.queryOptions({ sort: ['title', 'publishUp', 'author'].includes(sortParam) ? sortParam : undefined, direction: dir });
        const blog = blogSettings(componentParams?.content, siteConfig.pageSize);
        const pageSize = queryInteger(location.params.pageSize);
        const vm = await content.category(location.params.alias, layout === 'list'
          ? { page: location.params.page, pageSize, sort, direction, titleContains: filter }
          : { page: location.params.page, pageSize: normalizePageSize(pageSize, blog.pageSize), sort, direction });
        const categoryPath = await content.categoryPath(location.params.alias);
        const listParams = { layout: layout === 'list' ? 'list' : undefined, sort, dir: direction, filter, pageSize };
        const blogParams = { ...(sortParam !== undefined || dir !== undefined ? { sort, dir: direction } : {}), filter, pageSize };
        body = '<section class="error-state" role="alert"><h1>404</h1><p>Categoria não encontrada.</p></section>';
        if (vm) {
          const children = await content.subcategories(vm.category);
          renderDeferred = async (prepare) => renderCategory(await prepare(vm), {
            layout, settings: blog, route: location.path, sort, direction, filter,
            children, categoryLink: (alias) => link(`/category/${encodeURIComponent(alias)}`),
            link: (page) => router.link(location.path, { ...(layout === 'list' ? listParams : blogParams), page }),
            listLink: (changes) => router.link(location.path, { ...listParams, ...changes }),
            articleLink: (alias) => link(`/article/${encodeURIComponent(alias)}`), timezone: siteConfig.timezone,
            componentParams: componentParams?.content
          });
        }
        crumbs.push(...(categoryPath.length
          ? categoryPath.map((category) => ({ label: category.title, href: link(`/category/${encodeURIComponent(category.alias)}`) }))
          : [{ label: '404' }]));
      } else if (location.route?.name === 'categories') {
        body = renderCategories(await content.categoriesTree(), { categoryLink: (alias) => link(`/category/${encodeURIComponent(alias)}`) });
        crumbs.push({ label: 'Categorias' });
      } else if (location.route?.name === 'tags') {
        body = renderTagList(await content.tags(), { tagLink: (name) => link(`/tag/${encodeURIComponent(name)}`) });
        crumbs.push({ label: 'Tags' });
      } else if (location.route?.name === 'tag') {
        const blog = blogSettings(componentParams?.content, siteConfig.pageSize);
        const pageSize = queryInteger(location.params.pageSize);
        const vm = await content.tag(location.params.alias, { page: location.params.page, pageSize: normalizePageSize(pageSize, blog.pageSize) });
        body = '<section class="error-state" role="alert"><h1>404</h1><p>Tag não encontrada.</p></section>';
        if (vm) {
          renderDeferred = async (prepare) => renderTag(await prepare(vm), {
            settings: blog, link: (page) => router.link(location.path, { page, pageSize }),
            articleLink: (alias) => link(`/article/${encodeURIComponent(alias)}`), timezone: siteConfig.timezone,
            componentParams: componentParams?.content
          });
        }
        crumbs.push({ label: 'Tags', href: link('/tags') }, { label: vm ? vm.tag : '404' });
      } else if (location.route?.name === 'search') {
        const query = await plugins.prepareSearchQuery(location.params.q ?? '', {});
        const searchOptions = content.queryOptions({ pageSize: location.params.pageSize, searchMode: location.params.searchMode ?? location.params.searchphrase }, 'search');
        const found = await content.search(query, { page: location.params.page, ...searchOptions });
        renderDeferred = async (prepare) => renderSearch(found.query, await prepare(found), {
          link: (page) => link(location.path, { q: found.query, page, ...(queryInteger(location.params.pageSize) ? { pageSize: searchOptions.pageSize } : {}), ...(location.params.searchMode !== undefined || location.params.searchphrase !== undefined ? { searchMode: searchOptions.searchMode } : {}) }),
          articleLink: (alias) => link(`/article/${encodeURIComponent(alias)}`), timezone: siteConfig.timezone,
          componentParams
        });
        crumbs.push({ label: 'Busca' });
      } else if (location.route?.name === 'archive') {
        const { year, month, page } = location.params;
        const pageSize = queryInteger(location.params.pageSize);
        const archived = await content.archive({ year, month, page, pageSize });
        const months = await content.archiveMonths({ limit: 50 });
        renderDeferred = async (prepare) => renderArchive(await prepare(archived), {
          year, month, months, link: (nextPage) => link(location.path, { year, month, page: nextPage, pageSize }),
          articleLink: (alias) => link(`/article/${encodeURIComponent(alias)}`), timezone: siteConfig.timezone,
          componentParams: componentParams?.content
        });
        crumbs.push({ label: 'Arquivo' });
      } else if (location.route?.name === 'home') {
        const blog = blogSettings(componentParams?.content, siteConfig.pageSize);
        const pageSize = queryInteger(location.params.pageSize);
        const result = await content.home({ page: location.params.page, pageSize: normalizePageSize(pageSize, blog.pageSize) });
        renderDeferred = async (prepare) => renderFeatured(await prepare(result), {
          siteName: siteConfig.siteName, siteDescription: siteConfig.siteDescription, settings: blog,
          link: (page) => link('/', { page, pageSize }),
          articleLink: (alias) => link(`/article/${encodeURIComponent(alias)}`), timezone: siteConfig.timezone,
          componentParams: componentParams?.content
        });
      } else {
        body = '<section class="error-state" role="alert"><h1>404</h1><p>Página não encontrada.</p></section>';
        crumbs.push({ label: '404' });
      }

      // Blog e lista da mesma categoria são itens de menu distintos (layout=list vem na query, não no path).
      if (location.route?.name === 'category' && location.params.layout === 'list') menuActivePath = `${location.path}?layout=list`;
      const entries = resolveModuleEntries(moduleInstances, {
        route: location.route?.name,
        categoryAlias: location.route?.name === 'category' ? location.params.alias : undefined,
        menuItemId: resolveActiveMenuItemId(menus, menuActivePath)
      });
      await plugins.afterRoute(location);
      // A supplied repository is authoritative: removing its last row must remove the module too.
      if (!getModuleInstances) entries.sidebar.push(
        { name: 'articles-latest', order: 10 }, { name: 'articles-news', order: 12 },
        ...(location.route?.name === 'article' ? [{ name: 'tags-similar', order: 15 }] : []),
        { name: 'tags-popular', order: 20 }, { name: 'articles-archive', order: 30 }, ...customHtmlEntry
      );
      const availability = new Map(await Promise.all(
        [...new Set(Object.values(entries).flat().map((entry) => entry.name))]
          .map(async (name) => [name, await extensionLoader.ensureModuleRegistered(modules, name, extensions)])
      ));
      activeExtensions = extensions;
      const moduleContext = {
        menus, activePath: menuActivePath,
        articles: await withCategoryAlias((await adapter.listArticles({ pageSize: 50 })).items),
        featuredArticles: (await adapter.listArticles({ featured: true, pageSize: 50 })).items,
        similarArticles, tags: await adapter.listTags({ popular: true }), months: await content.archiveMonths(), link,
        siteName: siteConfig.siteName, session: siteConfig.session, article: pendingArticle,
        categories: Object.values(entries).flat().some((entry) => entry.name === 'articles-categories') ? flattenCategories(await content.categoriesTree()) : []
      };
      for (const [position, positionEntries] of Object.entries(entries)) {
        const ordered = positionEntries.filter((entry) => availability.get(entry.name)).sort((left, right) => left.order - right.order);
        const fragments = [];
        for (const entry of ordered) {
          activeModuleKeys.add(entry.name);
          let context = moduleContext;
          if (entry.name === 'articles-category' && entry.settings?.category) {
            const category = await content.category(entry.settings.category, { pageSize: entry.settings.limit });
            context = { ...moduleContext, items: category?.items ?? [] };
          }
          fragments.push(modules.renderPosition(position, [entry], context));
        }
        renderedModules[position] = fragments.join('');
      }
      // Depois dos módulos: {loadposition} reutiliza as posições já renderizadas.
      if (pendingArticle) body = await renderArticleBody(pendingArticle, location, moduleContext, renderedModules);
      if (renderDeferred) body = await renderDeferred((result) => prepareCards(result, moduleContext, renderedModules));
    } catch (error) {
      activeModuleKeys.clear();
      body = LOAD_ERROR;
      console.warn('MINIJOOMLA: falha na navegação.', error instanceof TypeError ? 'invalid-contract' : 'load-failed');
    }
    if (navigationId !== latestNavigation) return;
    externalStyles.apply([...activeModuleKeys], activeExtensions);
    if (selectedTemplate) {
      activeRenderer = selectedTemplate.render;
      templateRuntime.applyStyles(selectedTemplate);
    }
    if (documentRef) {
      if (documentRef.documentElement) documentRef.documentElement.lang = siteConfig.language;
      const title = crumbs[crumbs.length - 1].label;
      documentRef.title = title === 'Início' ? siteConfig.siteName : `${title} | ${siteConfig.siteName}`;
      documentRef.body.innerHTML = renderPage({
        config: siteConfig,
        menus: modules.render('menu', { menus, link: (path) => router.link(path), activePath: menuActivePath }),
        breadcrumbs: modules.render('breadcrumbs', { items: crumbs }),
        content: body, modules: renderedModules, busy: false
      });
      const cleanupTemplate = selectedTemplate?.bind?.(documentRef.body) ?? (() => {});
      const cleanupMenu = bindMenuTree(documentRef.body);
      cleanupShell = () => { cleanupMenu(); cleanupTemplate(); };
      const searchForms = documentRef.body.querySelectorAll?.('form[role="search"]')
        ?? [documentRef.body.querySelector?.('form[role="search"]')].filter(Boolean);
      for (const form of searchForms) {
        form.addEventListener?.('submit', async (event) => {
          event?.preventDefault?.();
          const query = form.querySelector?.('[name="q"]')?.value ?? form.querySelector?.('#search-term')?.value ?? '';
          await router.navigate(router.link('/search', { q: query }));
        }, true);
      }
      // Generic router-bound forms (archive, category list filter) and the print action.
      for (const form of documentRef.body.querySelectorAll?.('form[data-mj-route]') ?? []) {
        form.addEventListener?.('submit', async (event) => {
          event?.preventDefault?.();
          const params = {};
          for (const field of form.querySelectorAll?.('[name]') ?? []) params[field.name] = field.value;
          await router.navigate(router.link(form.getAttribute('data-mj-route'), params));
        }, true);
      }
      for (const button of documentRef.body.querySelectorAll?.('[data-mj-print]') ?? []) {
        button.addEventListener?.('click', () => (documentRef.defaultView ?? globalThis).print?.());
      }
      documentRef.body.querySelector?.('#main-content')?.focus?.({ preventScroll: true });
      if (lastPath !== undefined && lastPath !== location.path) documentRef.body.querySelector?.('#site-top')?.scrollIntoView?.({ block: 'start' });
      lastPath = location.path;
    }
    try { await events.emit('onAfterRender', { location, body }); }
    catch { console.warn('MINIJOOMLA: falha em observador de renderização.'); }
  } });
  const application = {
    config: siteConfig, events, router, modules, plugins,
    start: () => {
      if (started) return router.handle();
      started = true;
      plugins.init({ config: siteConfig });
      return router.start(ROUTES);
    },
    stop: () => {
      latestNavigation += 1;
      extensionLoader.cancelPendingPlugins();
      externalStyles.clear();
      router.stop();
      cleanupShell();
      cleanupShell = () => {};
      if (started) { started = false; plugins.finalize({ config: siteConfig }); }
    }
  };
  if (autoStart) application.start();
  return application;
}
