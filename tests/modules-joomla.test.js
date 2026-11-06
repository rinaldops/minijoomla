import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loginModule } from '../src/modules/mod_login/mod_login.js';
import { articlesCategoriesModule } from '../src/modules/mod_articles_categories/mod_articles_categories.js';
import { relatedItemsModule } from '../src/modules/mod_related_items/mod_related_items.js';
import { footerModule } from '../src/modules/mod_footer/mod_footer.js';
import { articlesModule } from '../src/modules/mod_articles/mod_articles.js';
import { menuModule, createModuleRegistry } from '../src/libraries/minijoomla/modules/registry.js';
import { breadcrumbsModule } from '../src/modules/mod_breadcrumbs/mod_breadcrumbs.js';
import { BUILTIN_MODULE_TYPES } from '../src/libraries/minijoomla/application/module-catalog.js';
import { customHtmlModule } from '../src/modules/mod_custom/mod_custom.js';

const customManifest = readFileSync(new URL('../src/modules/mod_custom/mod_custom.xml', import.meta.url), 'utf8');
assert.match(customManifest, /<extension type="module"/);
assert.match(customManifest, /<filename module="mod_custom">mod_custom\.js<\/filename>/);
assert.equal(typeof customHtmlModule.render, 'function');
for (const key of ['mod_articles_latest', 'mod_articles_category', 'mod_articles_news', 'mod_tags_similar', 'mod_tags_popular', 'mod_articles_archive']) {
  const manifest = readFileSync(new URL(`../src/modules/${key}/${key}.xml`, import.meta.url), 'utf8');
  assert.match(manifest, /<extension type="module"/);
  assert.ok(manifest.includes(`${key}.js`), `${key} manifest declares its entry point`);
  assert.match(manifest, /<folder>tmpl<\/folder>/);
}
for (const key of ['mod_login', 'mod_articles_categories', 'mod_related_items', 'mod_footer', 'mod_articles', 'mod_breadcrumbs', 'mod_search']) {
  const manifest = readFileSync(new URL(`../src/modules/${key}/${key}.xml`, import.meta.url), 'utf8');
  assert.match(manifest, /<extension type="module"/);
  assert.ok(manifest.includes(`${key}.js`), `${key} manifest declares its entry point`);
  assert.match(manifest, /<folder>tmpl<\/folder>/);
}

export async function runModulesJoomlaTests() {
  // login: sessão do host, link, nada; nunca campos de senha.
  assert.match(loginModule.render({ settings: { session: { name: '<b>Ana</b>' } } }), /&lt;b&gt;Ana/);
  const link = loginModule.render({ settings: { loginUrl: '/entrar' } });
  assert.match(link, /href="\/entrar"/);
  assert.doesNotMatch(link, /password|<input|<form/i);
  assert.match(loginModule.render({ settings: { loginUrl: 'javascript:alert(1)' } }), /href="#"/);
  assert.match(loginModule.render({}), /module-empty/);
  assert.match(loginModule.render({ state: 'loading' }), /module-loading/);
  assert.match(loginModule.render({ state: 'error', message: '<x>' }), /&lt;x&gt;/);

  // articles-categories
  const categories = [{ id: 1, title: 'A', alias: 'a', parentId: null, count: 2 }, { id: 2, title: 'A1', alias: 'a1', parentId: 1 }, { id: 3, title: 'Loop', alias: 'l', parentId: 3 }];
  const flat = articlesCategoriesModule.render({ categories, settings: { showCount: true } });
  assert.match(flat, /A<\/a> \(2\)/); assert.doesNotMatch(flat, /A1/);
  assert.match(articlesCategoriesModule.render({ categories, settings: { maxLevel: 3 } }), /A1/);
  assert.match(articlesCategoriesModule.render({ categories: [] }), /module-empty/);

  // related-items: tags primeiro, depois metaKeywords; exclui o atual.
  const article = { alias: 'x', tags: ['t1'], metaKeywords: 'foo, Bar' };
  const pool = [{ alias: 'x', title: 'self', tags: ['t1'] }, { alias: 'k', title: 'Kw', metaKeywords: 'bar' }, { alias: 't', title: 'Tag', tags: ['T1'] }, { alias: 'n', title: 'None' }];
  const related = relatedItemsModule.render({ article, articles: pool });
  assert.ok(related.indexOf('Tag') < related.indexOf('Kw')); assert.doesNotMatch(related, /self|None/);
  assert.match(relatedItemsModule.render({ article: { alias: 'z', attribs: { metaKeywords: 'bar' } }, articles: pool }), /Kw/);
  assert.match(relatedItemsModule.render({ articles: pool }), /module-empty/);

  // footer
  assert.match(footerModule.render({ settings: { siteName: 'Site <1>' }, now: new Date('2030-05-05T12:00:00Z') }), /&copy; 2030 Site &lt;1&gt;/);

  // articles
  const list = [{ alias: 'a', title: 'B', category: 'c', publishUp: '2026-01-01' }, { alias: 'b', title: 'A', category: 'c', publishUp: '2026-02-01' }, { alias: 'c', title: 'Out', category: 'd' }];
  const byTitle = articlesModule.render({ articles: list, settings: { category: 'c', ordering: 'title', showDate: true } });
  assert.ok(byTitle.indexOf('>A<') < byTitle.indexOf('>B<')); assert.match(byTitle, /2026-02-01/); assert.doesNotMatch(byTitle, /Out/);
  assert.match(articlesModule.render({ articles: list, settings: { limit: 1 } }), /^(?:(?!<li>).)*<li>(?:(?!<li>).)*$/s);
  assert.match(articlesModule.render({ articles: [] }), /module-empty/);

  // registry integra os novos módulos
  const registry = createModuleRegistry().register('footer', footerModule);
  assert.match(registry.render('footer', { settings: registry.settings('footer'), siteName: 'S' }), /module-footer/);

  // mod_menu startLevel/endLevel/showAllChildren
  const menus = [{ id: 1, title: 'Raiz', path: '/r' }, { id: 2, parentId: 1, title: 'Filho', path: '/f' }, { id: 3, parentId: 2, title: 'Neto', path: '/n' }, { id: 4, title: 'Outro', path: '/o' }, { id: 5, parentId: 4, title: 'OutroFilho', path: '/of' }];
  assert.doesNotMatch(menuModule.render({ menus, settings: { endLevel: 1 } }), /Filho/);
  assert.doesNotMatch(menuModule.render({ menus, settings: { endLevel: 2 } }), /Neto/);
  const sub = menuModule.render({ menus, activePath: '/f', settings: { startLevel: 2 } });
  assert.match(sub, /Filho/); assert.doesNotMatch(sub, /Raiz|Outro/);
  assert.doesNotMatch(menuModule.render({ menus, activePath: '/f', settings: { startLevel: 5 } }), /Raiz|Filho/);
  const collapsed = menuModule.render({ menus, activePath: '/r', settings: { showAllChildren: false } });
  assert.match(collapsed, /Filho/); assert.doesNotMatch(collapsed, /Neto|OutroFilho/);
  assert.match(menuModule.render({ menus }), /OutroFilho/);

  // mod_breadcrumbs showHome/showLast/separator
  const items = [{ label: 'Início', href: '/' }, { label: 'Cat', href: '/c' }, { label: 'Sub', href: '/s' }, 'Atual'];
  const crumbs = breadcrumbsModule.render({ items, settings: { showHome: false, showLast: false, separator: '/' } });
  assert.doesNotMatch(crumbs, /Início|Atual/); assert.match(crumbs, /Cat/); assert.match(crumbs, /divider/);
  assert.match(breadcrumbsModule.render({ items }), /Início[\s\S]*Atual/);

  // catálogo
  for (const key of ['login', 'articles-categories', 'related-items', 'footer', 'articles']) {
    const type = BUILTIN_MODULE_TYPES.find((entry) => entry.key === key);
    assert.ok(type, key); assert.ok(Array.isArray(type.params) && type.params.length, key);
  }
  console.log('ok - modules joomla: login, categories, related, footer, articles, menu/breadcrumb params');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await runModulesJoomlaTests();
