import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { articlesFeaturedModule } from '../src/modules/mod_articles_featured/mod_articles_featured.js';
import { renderDefault } from '../src/modules/mod_articles_featured/tmpl/default.js';
import { articlesNewsModule } from '../src/modules/mod_articles_news/mod_articles_news.js';
import { renderArticleCard } from '../src/components/com_content/tmpl/article/default.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';

const article = {
  id: 1, alias: 'destaque/ação', title: 'Título <seguro>', published: true, featured: true,
  introtext: '<p>Resumo <strong>editorial</strong><script>alert(1)</script><img src="data:image/png;base64,x" onerror="alert(2)"></p>',
  fulltext: '<p>Corpo não exibido</p>', publishUp: '2026-11-03T01:00:00Z',
  attribsJson: JSON.stringify({ images: { image_intro: '/images/intro.png', image_intro_alt: 'Imagem "<segura>"', image_intro_caption: 'Legenda <segura>', image_fulltext: '/images/full.png' }, unknown: { script: '<script>metadata</script>' } })
};
const cards = (html) => (html.match(/class="article-card"/g) ?? []).length;
const repository = (items) => ({ findMany: async () => ({ items }) });

export async function runArticlesFeaturedTests() {
  assert.equal(articlesFeaturedModule.name, 'articles-featured');
  assert.deepEqual(articlesFeaturedModule.settingsSchema, { limit: 'number' });
  assert.deepEqual(articlesFeaturedModule.settings, { position: 'sidebar', limit: 3, state: 'ready' });
  assert.equal(articlesFeaturedModule.render, renderDefault);
  const manifest = readFileSync(new URL('../src/modules/mod_articles_featured/mod_articles_featured.xml', import.meta.url), 'utf8');
  assert.match(manifest, /<extension type="module" client="site" method="upgrade">/);
  assert.match(manifest, /<filename module="mod_articles_featured">mod_articles_featured\.js<\/filename><folder>tmpl<\/folder>/);
  assert.doesNotMatch(manifest, /<script|<style|<media|camap/i);

  const before = structuredClone(article);
  const calls = [];
  const articleLink = (alias) => { calls.push(alias); return `/portal/#/article/${encodeURIComponent(alias)}?source=module&view=card`; };
  const html = renderDefault({ featuredArticles: [article], articleLink, timezone: 'UTC' });
  assert.equal(html, `<section class="module module-articles-featured"><h2>Destaques</h2><div class="article-list">${renderArticleCard(article, { articleLink, timezone: 'UTC' })}</div></section>`);
  assert.ok(calls.every((alias) => alias === article.alias));
  assert.match(html, /href="\/portal\/#\/article\/destaque%2Fa%C3%A7%C3%A3o\?source=module&amp;view=card"/);
  assert.match(html, /Título &lt;seguro&gt;/);
  assert.match(html, /<p>Resumo <strong>editorial<\/strong>/);
  assert.match(html, /<figure class="image-intro"><img src="\/images\/intro\.png" alt="Imagem &quot;&lt;segura&gt;&quot;" loading="lazy">/);
  assert.match(html, /<figcaption>Legenda &lt;segura&gt;<\/figcaption>/);
  assert.match(html, /<time datetime="2026-11-03T01:00:00\.000Z">03\/11\/2026<\/time>/);
  assert.match(renderDefault({ featuredArticles: [article] }), />02\/11\/2026<\/time>/);
  assert.match(html, /Leia mais<span class="visually-hidden">: Título &lt;seguro&gt;/);
  assert.doesNotMatch(html, /<script|onerror=|data:|blob:|Corpo não exibido|images\/full\.png|metadata/i);
  assert.deepEqual(article, before, 'unknown JSON and stored article content remain unchanged');

  for (const src of ['javascript:alert(1)', 'data:image/png;base64,x', 'blob:https://example.invalid/image', 'mailto:example@example.invalid', '#anchor', 42, true]) {
    const unsafe = { ...article, introtext: '', attribsJson: JSON.stringify({ images: { image_intro: src } }) };
    assert.doesNotMatch(renderDefault({ featuredArticles: [unsafe] }), /<img|image-intro|javascript:|data:|blob:/);
  }
  for (const attribsJson of ['broken', 'null', '[]', '{"image_intro":"/ignored.png"}', '{"images":{"image_fulltext":"/ignored.png"}}']) {
    assert.doesNotMatch(renderDefault({ featuredArticles: [{ ...article, introtext: '', attribsJson }] }), /<figure|ignored\.png/);
  }
  const decorative = { ...article, introtext: '', attribsJson: '{"images":{"image_intro":"/decorative.png","unknown":"ignored"}}' };
  assert.match(renderDefault({ featuredArticles: [decorative] }), /alt="" loading="lazy"/);
  assert.doesNotMatch(renderDefault({ featuredArticles: [decorative] }), /<figcaption|ignored/);
  const hidden = { ...article, attribsJson: '{"show_title":"0","show_intro":0,"show_publish_date":false}' };
  assert.doesNotMatch(renderDefault({ featuredArticles: [hidden], componentParams: { showReadmore: false } }), /Título|Resumo|<time|readmore/);

  assert.doesNotMatch(renderDefault({ featuredArticles: [article], showTitle: false }), />Destaques</);
  assert.match(renderDefault({ featuredArticles: [article], headerTag: 'h3', headerClass: 'heading "<x>' }), /<h3 class="heading &quot;&lt;x&gt;">Destaques<\/h3>/);
  assert.match(renderDefault({ featuredArticles: [article], headerTag: 'script' }), /<h2>Destaques<\/h2>/);
  assert.match(renderDefault({ state: 'loading', featuredArticles: [null] }), /module-loading.*role="status".*aria-live="polite"/);
  assert.match(renderDefault({ state: 'error', message: '<script>erro</script>' }), /role="alert">&lt;script&gt;erro&lt;\/script&gt;/);
  for (const featuredArticles of [undefined, null, {}, [], [null, 1, {}, { alias: '' }, { alias: ' ' }, { alias: 7 }]]) {
    assert.match(renderDefault({ featuredArticles }), /module-empty.*role="status"/);
  }
  const excluded = [null, { ...article, published: false }, { ...article, featured: false }, { ...article, state: 'Draft' }, { ...article, state: 0 }, { ...article, alias: {} }];
  assert.equal(cards(renderDefault({ featuredArticles: [...excluded, article], settings: { limit: 1 } })), 1);
  assert.equal(cards(renderDefault({ featuredArticles: excluded })), 0);
  assert.equal(cards(renderDefault({ featuredArticles: [{ alias: 'prefiltered', title: 'Pré-filtrado' }, { ...article, state: 'Published' }] })), 2);
  const many = Array.from({ length: 60 }, (_, id) => ({ alias: `card-${id}`, title: `Card ${id}` }));
  for (const [limit, expected] of [[undefined, 3], [0, 1], [-1, 1], [2.9, 2], ['2', 2], [100, 50], [Infinity, 3], ['invalid', 3]]) {
    assert.equal(cards(renderDefault({ featuredArticles: many, settings: { limit } })), expected, String(limit));
  }
  assert.equal(articlesNewsModule.render({ featuredArticles: [article] }), '<section class="module module-articles-news"><h2>Destaques</h2><ul><li><a href="#/article/destaque%2Fa%C3%A7%C3%A3o">Título &lt;seguro&gt;</a></li></ul></section>');

  const start = '2026-11-03T10:30:59.123Z';
  const end = '2026-11-03T11:30:59.123Z';
  const row = { Id: 1, Title: 'Programado', Alias: 'scheduled', State: 'Published', Featured: true, PublishStart: '2026-11-01', PublishEnd: '2026-12-01', FeaturedStart: start, FeaturedEnd: end, Intro: '<p>Resumo programado</p>', Attributes: decorative.attribsJson };
  const rows = [row, { ...row, Id: 2, Alias: 'draft', State: 'Draft' }, { ...row, Id: 3, Alias: 'not-featured', Featured: false }, { ...row, Id: 4, Alias: 'future', PublishStart: '2099-01-01' }, { ...row, Id: 5, Alias: 'expired', PublishEnd: start }];
  const stored = structuredClone(rows);
  const adapter = createSPMiddleAdapter({
    articleRepository: repository(rows), categoryRepository: repository([]),
    fields: { article: { id: 'Id', title: 'Title', alias: 'Alias', state: 'State', featured: 'Featured', publishUp: 'PublishStart', publishDown: 'PublishEnd', featuredUp: 'FeaturedStart', featuredDown: 'FeaturedEnd', introtext: 'Intro', attribsJson: 'Attributes' } }
  });
  for (const [now, expected] of [[new Date(Date.parse(start) - 1), 0], [start, 1], [new Date(Date.parse(end) - 1), 1], [end, 0]]) {
    const result = await adapter.listArticles({ featured: true, now });
    assert.equal(result.total, expected);
    const rendered = renderDefault({ featuredArticles: result.items });
    assert.equal(cards(rendered), expected);
    if (expected) {
      assert.equal(result.items[0].published, true); assert.equal(result.items[0].featured, true);
      assert.match(rendered, /Resumo programado/); assert.match(rendered, /src="\/decorative\.png"/);
    }
  }
  assert.deepEqual(rows, stored, 'adapter mapping and renderer do not mutate raw schedules or attributes');
  console.log('ok - articles-featured: shared safe cards, chrome, limits, unchanged news and mapped adapter schedule boundaries');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await runArticlesFeaturedTests();
