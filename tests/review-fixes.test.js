import assert from 'node:assert/strict';
import { blogSettings } from '../src/components/com_content/tmpl/category/blog.js';
import { resolveComponentParams } from '../src/libraries/minijoomla/application/component-options.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { createContentService } from '../src/libraries/minijoomla/application/content-service.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createApplication } from '../src/index.js';
import { renderArticle } from '../src/components/com_content/tmpl/article/default.js';
import { safeUrl, sanitizeHtml } from '../src/libraries/minijoomla/security/sanitize.js';
import { resolveActiveMenuItemId } from '../src/libraries/minijoomla/application/module-assignment.js';
import { renderMenuTree } from '../src/modules/mod_menu/tmpl/default.js';
import { articlesModule } from '../src/modules/mod_articles/mod_articles.js';
import { cloakEmails, emailcloakPlugin } from '../src/plugins/content/emailcloak/emailcloak.js';
import { paginate, pagebreakPlugin } from '../src/plugins/content/pagebreak/pagebreak.js';
import { loadmodulePlugin } from '../src/plugins/content/loadmodule/loadmodule.js';
import { pagenavigationPlugin } from '../src/plugins/content/pagenavigation/pagenavigation.js';
import { ADMIN_URL_PATTERN } from '../src/administrator/components/com_minijoomla/app.js';

const readonlyRepo = (items) => ({ findMany: async () => ({ items: items.map((item) => ({ ...item })) }) });

// Registro como no data-core real: congelado, etag não enumerável, findMany sem etag.
function tenantRepo(seed, hooks = {}) {
  const rows = new Map(seed.map((item) => [item.id, { ...item }]));
  let version = 1;
  const withEtag = (item) => { const copy = { ...item }; Object.defineProperty(copy, 'etag', { value: `"${version}"`, enumerable: false }); return Object.freeze(copy); };
  let nextId = Math.max(0, ...seed.map((item) => item.id)) + 1;
  return {
    rows,
    async findMany() { return { items: [...rows.values()].map((item) => Object.freeze({ ...item })) }; },
    async findById(id) {
      hooks.onFind?.(id);
      if (hooks.delay) await new Promise((resolve) => setTimeout(resolve, hooks.delay));
      hooks.afterFind?.(id);
      if (hooks.failOn === id) throw new Error('segredo-interno');
      if (!rows.has(id)) throw Object.assign(new Error('not found'), { code: 'not-found' });
      return withEtag(rows.get(id));
    },
    async create(input) { const id = nextId++; rows.set(id, { id, ...input }); return withEtag(rows.get(id)); },
    async update(id, input) { rows.set(id, { ...rows.get(id), ...input }); version += 1; return null; },
    async delete(id) { rows.delete(id); }
  };
}

function documentDouble() {
  return { body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }, documentElement: {}, title: '' };
}

const article = (id, extra = {}) => ({ id, title: `T${id}`, alias: `a${id}`, introtext: '', fulltext: '', categoryId: 1, state: 'Published', publishUp: '2020-01-01T00:00:00Z', tags: '', ...extra });
const category = (id, alias, extra = {}) => ({ id, title: alias, alias, parentId: null, state: 'Published', ...extra });

const ROUTES = [
  { name: 'article', pattern: /^\/article\/([^/]+)$/, keys: ['alias'] }, { name: 'category', pattern: /^\/category\/([^/]+)$/, keys: ['alias'] },
  { name: 'tag', pattern: /^\/tag\/([^/]+)$/, keys: ['alias'] }, { name: 'search', pattern: /^\/search$/, keys: [] },
  { name: 'archive', pattern: /^\/archive$/, keys: [] }, { name: 'home', pattern: /^\/$/, keys: [] }
];

async function renderApp(hash, { articles = [], categories = [category(1, 'noticias')], tags, menus = [], plugins = [], config = {}, getModuleInstances } = {}) {
  const documentRef = documentDouble();
  const adapter = createSPMiddleAdapter({
    articleRepository: readonlyRepo(articles), categoryRepository: readonlyRepo(categories),
    tagRepository: tags ? readonlyRepo(tags) : undefined, menuRepository: readonlyRepo(menus), pageSize: 5
  });
  const app = createApplication({ autoStart: false, documentRef, adapter, plugins, config, getModuleInstances });
  app.router.routes = ROUTES;
  await app.router.navigate(hash);
  return documentRef.body.innerHTML;
}

export async function runReviewFixesTests() {
  // 1. blog: sem numLeading/numIntro/numLinks gravados, vale siteConfig.pageSize.
  {
    const resolved = resolveComponentParams({}).content;
    assert.deepEqual(blogSettings(resolved, 3), { leading: 1, intro: 2, links: 0, columns: 1, pageSize: 3 });
    const nulls = { numLeading: null, numIntro: null, numLinks: null };
    assert.equal(blogSettings(nulls, 7).intro, 6, 'colunas nunca gravadas chegam como null');
    const stored = resolveComponentParams({ componentParamsJson: JSON.stringify({ content: { numLeading: 2 } }) }).content;
    assert.equal(blogSettings(stored, 3).leading, 2);
    assert.equal(blogSettings(stored, 3).pageSize, 2 + 4 + 4);
  }

  // 2. tags não listadas somem de listas, contagens e da página da tag.
  {
    const articles = [article(1, { tags: 'a,b,c,d' })];
    const tags = [{ id: 1, name: 'a', state: 'Published' }, { id: 2, name: 'b', state: 'Trashed' }, { id: 3, name: 'c', state: 'Unpublished' }, { id: 4, name: 'd', state: null }];
    const adapter = createSPMiddleAdapter({ articleRepository: readonlyRepo(articles), categoryRepository: readonlyRepo([category(1, 'n')]), tagRepository: readonlyRepo(tags) });
    assert.deepEqual((await adapter.listTags({ popular: true })).map((tag) => tag.name), ['a', 'd']);
    assert.deepEqual(await adapter.listTags(), ['a', 'd']);
    const content = createContentService(adapter, { pageSize: 5 });
    assert.equal(await content.tag('b'), null);
    assert.equal(await content.tag('c'), null);
    assert.equal((await content.tag('d')).total, 1);
  }

  // 3. ocultação de categoria é herdada, com guarda contra ciclos.
  {
    const categories = [category(1, 'pai', { state: 'Unpublished' }), category(2, 'filho', { parentId: 1 }), category(3, 'neto', { parentId: 2 }), category(4, 'ciclo-a', { parentId: 5 }), category(5, 'ciclo-b', { parentId: 4 }), category(6, 'solta', { state: 'Trashed' }), category(7, 'filha-lixo', { parentId: 6 })];
    const articles = [2, 3, 4, 7, 1].map((categoryId, index) => article(index + 1, { categoryId, alias: `x${categoryId}` }));
    const adapter = createSPMiddleAdapter({ articleRepository: readonlyRepo(articles), categoryRepository: readonlyRepo(categories) });
    assert.deepEqual((await adapter.listCategories()).map((item) => item.alias), ['ciclo-a', 'ciclo-b']);
    assert.deepEqual((await adapter.listArticles({})).items.map((item) => item.alias), ['x4']);
    assert.equal(await adapter.getCategory('neto'), null);
  }

  // 4/5. remoção unitária exige lixeira e guardas; duplicar em lote.
  {
    const repositories = {
      articles: tenantRepo([article(1, { categoryId: 10, state: 'Trashed' }), article(2, { categoryId: 11 }), article(3, { categoryId: 13, state: 'Published' })]),
      categories: tenantRepo([category(10, 'com-artigo', { state: 'Trashed' }), category(11, 'com-filho', { state: 'Trashed' }), category(12, 'filho', { parentId: 11, state: 'Trashed' }), category(13, 'publicada'), category(14, 'livre', { state: 'Trashed' })]),
      tags: tenantRepo([{ id: 1, name: 'x', alias: 'x', state: 'Published' }, { id: 2, name: 'y', alias: 'y', state: 'Trashed' }])
    };
    const admin = createAdminService(repositories);
    const etag = async (domain, id) => (await admin[domain].get(id)).etag;
    await assert.rejects(() => admin.categories.remove(13, { etag: '"1"' }), /lixeira/);
    await assert.rejects(() => admin.categories.remove(10, { etag: '"1"' }), /artigos/);
    await assert.rejects(() => admin.categories.remove(11, { etag: '"1"' }), /filhos/);
    await assert.rejects(() => admin.tags.remove(1, { etag: '"1"' }), /lixeira/);
    await assert.rejects(() => admin.articles.remove(3, { etag: '"1"' }), /lixeira/);
    assert.ok(repositories.categories.rows.has(10) && repositories.categories.rows.has(11) && repositories.articles.rows.has(3));
    await admin.categories.remove(14, { etag: await etag('categories', 14) });
    await admin.tags.remove(2, { etag: await etag('tags', 2) });
    await admin.articles.remove(1, { etag: await etag('articles', 1) });
    assert.ok(!repositories.categories.rows.has(14) && !repositories.tags.rows.has(2) && !repositories.articles.rows.has(1));

    const copied = await admin.categories.batch([{ id: 13, etag: '"-"' }], 'duplicate');
    assert.deepEqual(copied.failed, [], JSON.stringify(copied));
    assert.ok([...repositories.categories.rows.values()].some((row) => row.title === 'publicada (2)'));
    await admin.tags.batch([{ id: 1, etag: '"-"' }], 'duplicate');
    assert.ok([...repositories.tags.rows.values()].some((row) => row.name === 'x (2)'));
  }

  // 6. sem escape duplo de URLs.
  {
    const html = renderArticle({ title: 'T', introtext: '', fulltext: '', attribsJson: JSON.stringify({ urls: { urla: '/x?a=1&b=2', urlatext: 'ir' } }) });
    assert.match(html, /href="\/x\?a=1&amp;b=2"/);
    assert.doesNotMatch(html, /&amp;amp;/);
    assert.equal(sanitizeHtml('<a href="/x?a=1&amp;b=2">l</a>'), '<a href="/x?a=1&amp;b=2">l</a>');
    assert.equal(sanitizeHtml('<img src="/i.png?a=1&amp;b=2">'), '<img src="/i.png?a=1&amp;b=2">');
    assert.equal(sanitizeHtml('<a href="/x?a=1&b=2">l</a>'), '<a href="/x?a=1&amp;b=2">l</a>');
  }

  // 7. plugins também rodam nos cards das listagens.
  {
    const plugins = [emailcloakPlugin, loadmodulePlugin, pagebreakPlugin];
    const intro = '<p>mail x@y.com {loadposition sidebar} {loadmodule footer}</p><hr class="system-pagebreak" title="T"><p>mais</p>';
    const articles = [article(1, { introtext: intro, featured: true, tags: 'guia' })];
    for (const [hash, config] of [['#/category/noticias', {}], ['#/', { homeView: 'featured' }], ['#/tag/guia', {}], ['#/archive', {}], ['#/search?q=mail', {}]]) {
      const html = await renderApp(hash, { articles, plugins, config });
      assert.match(html, /article-card/, hash);
      assert.doesNotMatch(html, /x@y\.com/, `${hash}: emailcloak`);
      assert.doesNotMatch(html, /\{load(?:module|position)/, `${hash}: placeholders`);
      assert.doesNotMatch(html, /Introdução|pagebreak-/, `${hash}: pagebreak não monta sumário no card`);
      assert.equal(html.match(/<article class="article-card"/g).length, 1, hash);
    }
    // Sem o plugin registrado os placeholders também não aparecem.
    assert.doesNotMatch(await renderApp('#/category/noticias', { articles }), /\{load(?:module|position)/);
  }

  // 8. barra invertida nunca passa por safeUrl nem pelo formulário admin.
  {
    for (const url of ['/\\evil.com', '\\\\evil.com', '/ok\\x', 'https://a.com\\@b.com']) assert.equal(safeUrl(url), '#', url);
    assert.equal(safeUrl('/ok?a=1'), '/ok?a=1');
    assert.equal(ADMIN_URL_PATTERN.test('/\\evil.com'), false);
    assert.equal(ADMIN_URL_PATTERN.test('/ok/path'), true);
    assert.equal(ADMIN_URL_PATTERN.test('https://a.com/x'), true);
  }

  // 9. item de menu em lista distingue-se do item em blog.
  {
    const menus = [{ id: 1, title: 'Blog', path: '/category/x', published: true }, { id: 2, title: 'Lista', path: '/category/x?layout=list', published: true }];
    assert.equal(resolveActiveMenuItemId(menus, '/category/x?layout=list'), 2);
    assert.equal(resolveActiveMenuItemId(menus, '/category/x'), 1);
    const tree = renderMenuTree({ menus, activePath: '/category/x?layout=list' });
    assert.match(tree, /aria-current="page">Lista</);
    assert.doesNotMatch(tree, /aria-current="page">Blog</);
    const live = [{ id: 1, title: 'Blog', path: '/category/noticias', published: 'Published' }, { id: 2, title: 'Lista', path: '/category/noticias?layout=list', published: 'Published' }];
    const html = await renderApp('#/category/noticias?layout=list', { articles: [article(1)], menus: live });
    assert.match(html, /aria-current="page">Lista</);
    assert.doesNotMatch(html, /aria-current="page">Blog</);
    assert.match(await renderApp('#/category/noticias', { articles: [article(1)], menus: live }), /aria-current="page">Blog</);
  }

  // 10. módulo articles filtra por categoryAlias, que o adapter SharePoint fornece via contexto.
  {
    const items = [{ alias: 'a', title: 'Alfa', categoryAlias: 'noticias' }, { alias: 'b', title: 'Beta', categoryAlias: 'outra' }];
    const html = articlesModule.render({ articles: items, settings: { category: 'noticias' } });
    assert.match(html, /Alfa/); assert.doesNotMatch(html, /Beta/);
    assert.match(articlesModule.render({ articles: [{ alias: 'f', title: 'Fake', category: 'noticias' }], settings: { category: 'noticias' } }), /Fake/);
    const instance = { extensionKey: 'articles', position: 'sidebar', ordering: 1, enabled: true, settingsJson: JSON.stringify({ category: 'noticias' }) };
    const page = await renderApp('#/', {
      categories: [category(1, 'noticias'), category(2, 'outra')],
      articles: [article(1, { title: 'DentroX' }), article(2, { title: 'ForaX', categoryId: 2 })], getModuleInstances: async () => [instance]
    });
    assert.match(page, /module-articles/);
    assert.match(page, /DentroX/); assert.match(page.slice(page.indexOf('module-articles')), /^(?:(?!ForaX)[\s\S])*$/);
  }

  // 14. snapshots: concorrência limitada e falha visível (sem vazar detalhe interno).
  {
    let active = 0; let peak = 0;
    const seed = Array.from({ length: 30 }, (_, index) => article(index + 1));
    const hooks = { delay: 2, onFind: () => { active += 1; peak = Math.max(peak, active); }, afterFind: () => { active -= 1; } };
    const admin = createAdminService({ articles: tenantRepo(seed, hooks), categories: tenantRepo([category(1, 'n')]) });
    const result = await admin.articles.query({ limit: 50 });
    assert.equal(result.rows.length, 30);
    assert.ok(result.rows.every((row) => row.etag), 'etag preservado');
    assert.ok(peak <= 6, `pico de ${peak} leituras simultâneas`);
    const broken = createAdminService({ articles: tenantRepo(seed, { failOn: 3 }), categories: tenantRepo([category(1, 'n')]) });
    await assert.rejects(() => broken.articles.query({ limit: 50 }), (error) => !/segredo-interno/.test(error.message) && error.message.length > 0);
  }

  // 15b. títulos do pagebreak não são escapados duas vezes.
  {
    const out = paginate('<p>a</p><hr class="system-pagebreak" title="A &amp; B"><p>b</p>');
    assert.match(out, /A &amp; B/); assert.doesNotMatch(out, /&amp;amp;/);
  }

  // 15c. mailto não ASCII em UTF-8 percent-encoded.
  {
    assert.match(cloakEmails('<a href="mailto:josé@ex.com">x</a>'), /href="mailto:%6A%6F%73%C3%A9%40%65%78%2E%63%6F%6D"/);
  }

  // 15d. sanitizeHtml balanceia tags.
  {
    assert.equal(sanitizeHtml('<p>a</p></div></div><p>b</p>'), '<p>a</p><p>b</p>');
    assert.equal(sanitizeHtml('<div><span>x'), '<div><span>x</span></div>');
    assert.equal(sanitizeHtml('<div><span>x</div>y'), '<div><span>x</span></div>y');
    assert.equal(sanitizeHtml('a<br></br><img src="/i.png"><hr>'), 'a<br><img src="/i.png"><hr>');
  }

  // 15e. navegação anterior/próximo vê categorias com mais de 50 artigos.
  {
    const many = Array.from({ length: 120 }, (_, index) => article(index + 1, { publishUp: new Date(Date.UTC(2020, 0, 1 + index)).toISOString() }));
    const html = await renderApp('#/article/a1', { articles: many, plugins: [pagenavigationPlugin] });
    assert.match(html, /Anterior: T2</);
  }
}
