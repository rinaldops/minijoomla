import { createConfig } from './core/config.js';
import { Router } from './core/router.js';
import { EventBus } from './core/events.js';
import { createFakeAdapter } from './infrastructure/fake-adapter.js';
import { createContentService } from './application/content-service.js';
import { createModuleRegistry, menuModule, breadcrumbsModule } from './modules/registry.js';
import { renderArticle } from './components/content.js';
import { renderCategory } from './components/category.js';
import { renderShell } from './templates/default.js';
import { escapeHtml } from './security/sanitize.js';

export function createApplication({ adapter = createFakeAdapter(), config = {}, documentRef = globalThis.document } = {}) {
  const siteConfig = createConfig(config); const events = new EventBus(); const content = createContentService(adapter, siteConfig); const modules = createModuleRegistry().register('menu', menuModule).register('breadcrumbs', breadcrumbsModule);
  const router = new Router({ onNavigate: async (location) => { await events.emit('onBeforeRender', location); const menus = await adapter.listMenus(); let body = '<h1>Carregando…</h1>'; let crumbs = ['Início'];
    if (location.route?.name === 'article') { const article = await content.article(location.params.alias); body = article ? renderArticle(article) : '<h1>404</h1><p>Artigo não encontrado.</p>'; crumbs.push(article?.title ?? '404'); }
    else if (location.route?.name === 'category') { const vm = await content.category(location.params.alias); body = vm ? renderCategory(vm) : '<h1>404</h1><p>Categoria não encontrada.</p>'; crumbs.push(vm?.category.title ?? '404'); }
    else if (location.route?.name === 'home') { const result = await content.category('noticias'); body = `<section><p class="eyebrow">Início</p><h1>${escapeHtml(siteConfig.siteName)}</h1><p>${escapeHtml(siteConfig.siteDescription)}</p>${renderCategory(result)}</section>`; }
    else { body = '<section class="error-state"><h1>404</h1><p>Página não encontrada.</p></section>'; crumbs.push('404'); }
    if (documentRef) documentRef.body.innerHTML = renderShell({ config: siteConfig, menus: modules.render('menu', { menus, link: (path) => router.link(path) }), breadcrumbs: modules.render('breadcrumbs', { items: crumbs }), content: body }); await events.emit('onAfterRender', { location, body });
  }});
  return { config: siteConfig, events, router, modules, start: () => router.start([{ name: 'article', pattern: /^\/article\/([^/]+)$/, keys: ['alias'] }, { name: 'category', pattern: /^\/category\/([^/]+)$/, keys: ['alias'] }, { name: 'home', pattern: /^\/$/ }]) };
}

if (typeof document !== 'undefined') createApplication().start();
