import { createConfig } from './core/config.js';
import { Router } from './core/router.js';
import { EventBus } from './core/events.js';
import { createFakeAdapter } from './infrastructure/fake-adapter.js';
import { createContentService } from './application/content-service.js';
import { createModuleRegistry, menuModule, breadcrumbsModule } from './modules/registry.js';
import { articlesLatestModule, articlesCategoryModule, tagsPopularModule } from './modules/content-modules.js';
import { renderArticle } from './components/content.js';
import { renderCategory } from './components/category.js';
import { renderSearch } from './components/search.js';
import { renderShell } from './templates/default.js';
import { escapeHtml } from './security/sanitize.js';

export function createApplication({ adapter = createFakeAdapter(), config = {}, documentRef = globalThis.document, autoStart = true } = {}) {
  const siteConfig = createConfig(config); const events = new EventBus(); const content = createContentService(adapter, siteConfig); const modules = createModuleRegistry().register('menu', menuModule).register('breadcrumbs', breadcrumbsModule).register('articles-latest', articlesLatestModule).register('articles-category', articlesCategoryModule).register('tags-popular', tagsPopularModule);
  const router = new Router({ onNavigate: async (location) => { await events.emit('onBeforeRender', location); let menus = []; let body = '<h1>Carregando…</h1>'; let crumbs = ['Início']; let sidebar = '';
    try { menus = await adapter.listMenus();
    if (location.route?.name === 'article') { const article = await content.article(location.params.alias); body = article ? renderArticle(article) : '<h1>404</h1><p>Artigo não encontrado.</p>'; crumbs.push(article?.title ?? '404'); }
    else if (location.route?.name === 'category') { const vm = await content.category(location.params.alias, { page: location.params.page }); const categoryPath = adapter.getCategoryPath ? await adapter.getCategoryPath(location.params.alias) : (vm ? [vm.category] : []); body = vm ? renderCategory(vm, { link: (page) => router.link(location.path, { page }) }) : '<h1>404</h1><p>Categoria não encontrada.</p>'; crumbs.push(...(categoryPath.length ? categoryPath.map((category) => category.title) : ['404'])); }
    else if (location.route?.name === 'search') { const query = location.params.q ?? ''; const result = await content.search(query, { page: location.params.page }); body = renderSearch(query, result, { link: (page) => router.link(location.path, { q: query, page }) }); crumbs.push('Busca'); }
    else if (location.route?.name === 'home') { const result = await content.category('noticias'); body = `<section><p class="eyebrow">Início</p><h1>${escapeHtml(siteConfig.siteName)}</h1><p>${escapeHtml(siteConfig.siteDescription)}</p>${renderCategory(result)}</section>`; }
    else { body = '<section class="error-state"><h1>404</h1><p>Página não encontrada.</p></section>'; crumbs.push('404'); }
    sidebar = modules.renderPosition('sidebar', [{ name: 'articles-latest', order: 10 }, { name: 'tags-popular', order: 20 }], { articles: (await adapter.listArticles({ pageSize: 5 })).items, tags: await adapter.listTags() });
    } catch { body = '<section class="error-state" role="alert"><h1>Não foi possível carregar</h1><p>Tente novamente mais tarde.</p></section>'; }
    if (documentRef) { documentRef.documentElement && (documentRef.documentElement.lang = siteConfig.language); const pageTitle = crumbs[crumbs.length - 1] === 'Início' ? siteConfig.siteName : `${crumbs[crumbs.length - 1]} | ${siteConfig.siteName}`; documentRef.title = pageTitle; documentRef.body.innerHTML = renderShell({ config: siteConfig, menus: modules.render('menu', { menus, link: (path) => router.link(path), activePath: location.path }), breadcrumbs: modules.render('breadcrumbs', { items: crumbs }), content: body, modules: { sidebar } }); documentRef.body.querySelector?.('#main-content')?.focus?.(); } await events.emit('onAfterRender', { location, body });
  }});
  return { config: siteConfig, events, router, modules, start: () => router.start([{ name: 'article', pattern: /^\/article\/([^/]+)$/, keys: ['alias'] }, { name: 'category', pattern: /^\/category\/([^/]+)$/, keys: ['alias'] }, { name: 'search', pattern: /^\/search$/, keys: [] }, { name: 'home', pattern: /^\/$/ }]) };
}

  if (typeof document !== 'undefined' && autoStart) createApplication().start();
