import assert from 'node:assert/strict';
import { createApplication } from '../src/index.js';
import { createFakeAdapter } from '../src/libraries/minijoomla/infrastructure/fake-adapter.js';
import { renderArticle, renderArticleList, renderPagination } from '../src/components/com_content/tmpl/article/default.js';
import { renderBlog, blogSettings } from '../src/components/com_content/tmpl/category/blog.js';
import { renderTagList } from '../src/components/com_tags/tmpl/tags/default.js';
import { renderPagination as renderLayoutPagination } from '../src/layouts/joomla/pagination/links.js';
import { renderTags } from '../src/layouts/joomla/content/tags.js';
import { renderDate } from '../src/layouts/joomla/content/info_block.js';
import { renderLinks } from '../src/layouts/joomla/content/links.js';
import { renderIntroImage } from '../src/layouts/joomla/content/intro_image.js';
import { renderFullImage } from '../src/layouts/joomla/content/full_image.js';

const images = JSON.stringify({ images: { image_intro: '/img/a.png', image_intro_alt: 'Alt <a>', image_intro_caption: 'Legenda', image_fulltext: 'javascript:alert(1)', image_fulltext_alt: 'x' } });
const make = (n) => ({ id: n, title: `Artigo ${n}`, alias: `a${n}`, introtext: `<p>Intro ${n}</p>`, fulltext: n % 2 ? '<p>Mais</p>' : '', author: n % 2 ? 'Zeca' : 'Ana', category: 'noticias', tags: n < 4 ? ['guia'] : ['outro'], published: true, publishUp: `2026-0${n}-01T12:00:00Z`, publishDown: null, featured: n < 8 });
const seed = () => ({
  articles: [...Array.from({ length: 7 }, (_, i) => make(i + 1)), { ...make(8), fulltext: '<p>Mais</p>', category: 'filha', attribsJson: images, authorAlias: 'Apelido', modified: '2026-08-05T12:00:00Z', created: '2026-07-01T12:00:00Z', tags: [] }],
  categories: [{ id: 1, title: 'Notícias', alias: 'noticias', parentId: null, description: '<p>Desc</p><script>x()</script>' }, { id: 2, title: 'Filha', alias: 'filha', parentId: 1, description: '' }]
});

function documentDouble() {
  const forms = [];
  return { forms, body: { innerHTML: '', querySelector: () => null, querySelectorAll: (selector) => (selector === 'form[data-mj-route]' ? forms : []) }, documentElement: {}, title: '' };
}
async function open(path, { config = {}, doc = documentDouble() } = {}) {
  const app = createApplication({ autoStart: false, documentRef: doc, adapter: createFakeAdapter(seed()), config, getModuleInstances: async () => [] });
  app.router.routes = undefined;
  await app.start();
  await app.router.navigate(path);
  return { app, doc, html: () => doc.body.innerHTML };
}

export async function runSiteViewsCoreTests() {
  assert.equal(renderPagination, renderLayoutPagination, 'legacy export uses the shared pagination layout');
  assert.equal(renderDate('not-a-date'), '');
  assert.equal(renderDate(null), '');
  assert.equal(renderDate('2026-01-01T12:00:00Z', 'invalid-zone'), renderDate('2026-01-01T12:00:00Z'));
  assert.match(renderTags(['<tag>']), /&lt;tag&gt;/);
  assert.equal(renderTags(null), '');
  assert.equal(renderLinks({ attribsJson: '{invalid' }), '');
  const linked = { attribsJson: JSON.stringify({ urls: { urla: 'javascript:alert(1)', urlb: '/safe?a=1&b=2', urlbtext: '<safe>' } }) };
  assert.equal(renderLinks(linked), '<ul class="article-links"><li><a href="/safe?a=1&amp;b=2">&lt;safe&gt;</a></li></ul>');
  assert.equal(renderIntroImage({ attribsJson: images }), '<figure class="image-intro"><img src="/img/a.png" alt="Alt &lt;a&gt;" loading="lazy"><figcaption>Legenda</figcaption></figure>');
  assert.equal(renderFullImage({ attribsJson: images }), '');
  // Info block, images and print
  const article = { ...seed().articles[7], category: 'Filha', categoryAlias: 'filha' };
  const full = renderArticle(article, { categoryLink: (alias) => `#/category/${alias}`, componentParams: { showPrint: true } });
  assert.match(full, /<dl class="article-info">/);
  assert.match(full, /href="#\/category\/filha">Filha<\/a>/);
  assert.match(full, /Por Apelido/);
  assert.match(full, /Atualizado em/);
  assert.match(full, /Criado em/);
  assert.match(full, /data-mj-print/);
  assert.ok(!renderArticle(article, {}).includes('data-mj-print'), 'print only with showPrint');
  assert.ok(!full.includes('<figure'), 'unsafe full image URL is dropped');
  assert.ok(!renderArticle(article, { componentParams: { showAuthor: false, showPublishDate: false, showModifyDate: false, showCreateDate: false, showCategory: false } }).includes('article-info'));
  const card = renderArticleList({ items: [article], page: 1, pages: 1, total: 1 });
  assert.match(card, /<figure class="image-intro"><img src="\/img\/a\.png" alt="Alt &lt;a&gt;" loading="lazy"><figcaption>Legenda<\/figcaption><\/figure>/);
  assert.match(card, /Leia mais<span class="visually-hidden">: Artigo 8<\/span>/);
  assert.match(renderArticle({ ...article, attribsJson: JSON.stringify({ images: { image_fulltext: '/f.png', image_fulltext_caption: 'C' } }) }), /<figure class="image-fulltext"><img src="\/f\.png"/);

  // Pagination
  const pag = renderPagination({ page: 2, pages: 4 }, (p) => `#/x?page=${p}`);
  for (const text of ['Página 2 de 4', '>Início<', '>Anterior<', '>Próxima<', '>Fim<', 'aria-current="page">2<']) assert.ok(pag.includes(text), text);
  assert.ok(!renderPagination({ page: 1, pages: 3 }, (p) => `#${p}`).includes('Anterior'));
  assert.equal(renderPagination({ page: 1, pages: 1 }, () => '#'), '');
  assert.match(renderArticleList({ items: [], total: 3, page: 9, pages: 3 }, { link: (p) => `#p${p}` }), /indisponível/);

  // Blog layout
  assert.deepEqual(blogSettings({ numLeading: 1, numIntro: 2, numColumns: 2, numLinks: 3 }, 5), { leading: 1, intro: 2, links: 3, columns: 2, pageSize: 6 });
  assert.deepEqual(blogSettings(undefined, 5), { leading: 1, intro: 4, links: 0, columns: 1, pageSize: 5 });
  const items = Array.from({ length: 6 }, (_, i) => make(i + 1));
  const blog = renderBlog({ items, total: 6, page: 1, pages: 1 }, { settings: blogSettings({ numLeading: 1, numIntro: 2, numColumns: 2, numLinks: 3 }) });
  assert.equal((blog.match(/class="article-card"/g) ?? []).length, 3);
  assert.match(blog, /items-leading/);
  assert.match(blog, /items-intro columns-2/);
  assert.equal((blog.match(/<li><a /g) ?? []).length, 3);

  // Tags list escaping
  assert.match(renderTagList([{ name: '<b>', count: 2 }]), /&lt;b&gt;/);
  assert.match(renderTagList([]), /Nenhuma tag/);

  // Category blog route: subcategories, description sanitised, tag links
  let view = await open('#/category/noticias');
  assert.match(view.html(), /cat-children/);
  assert.match(view.html(), /href="#\/category\/filha"/);
  assert.match(view.html(), /Desc/);
  assert.ok(!view.html().includes('<script'));
  assert.match(view.html(), /class="blog"/);
  view.app.stop();

  // List layout: table, sorting by links, title filter
  view = await open('#/category/noticias?layout=list&sort=title&dir=asc');
  assert.match(view.html(), /<table class="category-table">/);
  assert.match(view.html(), /aria-sort="ascending"/);
  assert.match(view.html(), /sort=title&amp;dir=desc/);
  assert.ok(view.html().indexOf('Artigo 1') < view.html().indexOf('Artigo 2'));
  view.app.stop();
  view = await open('#/category/noticias?layout=list&filter=Artigo%203');
  assert.match(view.html(), /Artigo 3/);
  assert.ok(!view.html().includes('>Artigo 2<'));
  assert.match(view.html(), /data-mj-route="\/category\/noticias"/);
  view.app.stop();
  view = await open('#/category/noticias?layout=list&filter=zzz');
  assert.match(view.html(), /Nenhum artigo encontrado/);
  view.app.stop();
  view = await open('#/category/inexistente');
  assert.match(view.html(), /Categoria não encontrada/);
  view.app.stop();

  // Featured home uses blog layout; configurable counts
  view = await open('#/', { config: { homeView: 'featured', componentParams: { content: { numLeading: 1, numIntro: 2, numColumns: 2, numLinks: 2 } } } });
  assert.match(view.html(), /featured-page/);
  assert.match(view.html(), /items-intro columns-2/);
  assert.match(view.html(), /blog-links/);
  assert.match(view.html(), /Página 1 de 2/);
  view.app.stop();

  // Categories index
  view = await open('#/categories');
  assert.match(view.html(), /categories-list/);
  assert.match(view.html(), /Notícias<\/a> <span class="badge" title="Artigos">7<\/span><ul><li><a href="#\/category\/filha">Filha<\/a> <span class="badge" title="Artigos">1</);
  view.app.stop();

  // Tags: list, tag route (blog), 404, article tag links
  view = await open('#/tags');
  assert.match(view.html(), /href="#\/tag\/guia"/);
  view.app.stop();
  view = await open('#/tag/guia');
  assert.match(view.html(), /<h1>guia<\/h1>/);
  assert.match(view.html(), /Artigo 1/);
  assert.ok(!view.html().includes('Artigo 5'));
  view.app.stop();
  view = await open('#/tag/nao-existe');
  assert.match(view.html(), /Tag não encontrada/);
  view.app.stop();
  view = await open('#/article/a1');
  assert.match(view.html(), /href="#\/tag\/guia"/);
  assert.match(view.html(), /href="#\/category\/noticias">noticias</);
  view.app.stop();

  // Archive form navigates through the router without reload
  const doc = documentDouble();
  const submitted = [];
  const fields = [{ name: 'year', value: '2026' }, { name: 'month', value: '3' }];
  doc.forms.push({ getAttribute: (name) => (name === 'data-mj-route' ? '/archive' : null), querySelectorAll: () => fields, addEventListener: (type, handler) => submitted.push({ type, handler }) });
  view = await open('#/archive', { doc });
  assert.match(view.html(), /<select id="archive-year" name="year">/);
  assert.match(view.html(), /<option value="2026">2026<\/option>/);
  const handler = submitted.at(-1);
  assert.equal(handler.type, 'submit');
  let prevented = false;
  await handler.handler({ preventDefault: () => { prevented = true; } });
  assert.ok(prevented);
  assert.match(view.html(), /Março de 2026/);
  assert.match(view.html(), /<option value="3" selected>/);
  view.app.stop();

  console.log('ok - site views core: blog, lista, categorias, tags, arquivo, paginação e impressão');
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('site-views-core.test.js')) await runSiteViewsCoreTests();
