import assert from 'node:assert/strict';
import { dateWindowStatus, inDateWindow } from '../src/libraries/minijoomla/core/date-window.js';
import { renderAdminList } from '../src/administrator/components/com_minijoomla/render-list.js';
import { createFakeAdapter } from '../src/libraries/minijoomla/infrastructure/fake-adapter.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';

const start = '2026-11-03T10:30:59.123Z';
const end = '2026-11-03T11:30:59.123Z';
const repo = (items) => ({ findMany: async () => ({ items }) });
const render = (row, now = start, domain = 'articles') => renderAdminList({
  rows: [row], columns: ['title', 'state', 'featured'], domain, now
});

export async function runArticleScheduleTests() {
  const cases = [
    [null, null, start, 'active'], ['', '', start, 'active'],
    [start, end, new Date(Date.parse(start) - 1), 'scheduled'],
    [start, end, start, 'active'],
    [start, end, new Date(Date.parse(end) - 1), 'active'],
    [start, end, end, 'expired'], [start, end, Date.parse(end) + 1, 'expired'],
    ['2026-11-03T07:30:59.123-03:00', end, start, 'active'],
    [start, null, start, 'active'], [null, end, end, 'expired'],
    ['broken', end, start, 'invalid'], [start, 'broken', start, 'invalid'],
    [start, start, new Date(Date.parse(start) - 1), 'invalid'],
    [end, start, start, 'invalid'], [null, null, 'broken', 'invalid'],
    [new Date(NaN), null, start, 'invalid'], [Infinity, null, start, 'invalid'],
    [{ toString() { throw new Error('invalid date'); } }, null, start, 'invalid']
  ];
  for (const [up, down, now, status] of cases) {
    assert.equal(dateWindowStatus(up, down, now), status);
    assert.equal(inDateWindow(up, down, now), status === 'active');
  }

  const labels = {
    active: ['Publicado', 'Destaque'], scheduled: ['Publicação agendada', 'Destaque agendado'],
    expired: ['Publicação encerrada', 'Destaque encerrado'], invalid: ['Publicação com datas inválidas', 'Destaque com datas inválidas']
  };
  // Temporal semantics agree on both public adapters and the article renderer.
  for (const [up, down, now, status] of cases.slice(0, -1)) {
    const row = Object.freeze({ id: 1, title: 'Fixture', alias: 'fixture', state: 'Published', published: true,
      featured: true, publishUp: up, publishDown: down, tags: Object.freeze([]) });
    const fake = createFakeAdapter({ articles: [row], categories: [], menus: [] });
    const remote = createSPMiddleAdapter({ articleRepository: repo([row]), categoryRepository: repo([]) });
    const html = render(row, now);
    assert.ok(html.includes(`title="${labels[status][0]}"`), status);
    assert.equal(html.includes('admin-state-icon is-active'), status === 'active');
    assert.equal(html.includes('admin-state-icon is-featured'), status === 'active');
    for (const adapter of [fake, remote]) {
      assert.equal((await adapter.listArticles({ now })).total, Number(status === 'active'));
      assert.equal(Boolean(await adapter.getArticle('fixture', { now })), status === 'active');
    }
    const featuredRow = Object.freeze({ ...row, publishUp: null, publishDown: null, featuredUp: up, featuredDown: down });
    const featuredHtml = render(featuredRow, now);
    assert.ok(featuredHtml.includes(labels[status][1]));
    assert.equal(featuredHtml.includes('admin-state-icon is-featured'), status === 'active');
    for (const adapter of [createFakeAdapter({ articles: [featuredRow] }),
      createSPMiddleAdapter({ articleRepository: repo([featuredRow]), categoryRepository: repo([]) })]) {
      assert.equal((await adapter.listArticles({ featured: true, now })).total, Number(status === 'active'));
      const article = await adapter.getArticle('fixture', { now });
      if (article) assert.equal(article.featured, status === 'active');
    }
    assert.equal(row.featured, true);
    assert.equal(featuredRow.featured, true);
  }

  for (const state of ['Draft', 'Archived', 'Unpublished', null, '', 0, false, 'unexpected', 'constructor', '__proto__', 'toString', 'PUBLISHED', ' Published ', 'true', ['Published'], { toString: () => 'Published' }]) {
    const html = render({ id: 1, state, featured: true });
    assert.ok(!html.includes('admin-state-icon is-active'));
    assert.ok(!html.includes('admin-state-icon is-featured'));
    assert.match(html, /Destaque inativo/);
    const adapters = [createFakeAdapter({ articles: [{ id: 1, state, published: true, alias: 'fixture' }] }),
      createSPMiddleAdapter({ articleRepository: repo([{ id: 1, state, published: true, alias: 'fixture' }]), categoryRepository: repo([]) })];
    assert.equal((await adapters[0].listArticles({ now: start })).total, 1, 'Fake still decodes only the boolean published flag');
    assert.equal((await adapters[1].listArticles({ now: start })).total, 0, 'SPMIDDLE still decodes only its exact state aliases');
  }
  for (const state of [undefined, true, 1, '1', 'Published', 'published', 'Publicado', 'publicado']) {
    const html = render({ id: 1, state, featured: 1 });
    assert.match(html, /admin-state-icon is-active/);
    assert.match(html, /admin-state-icon is-featured/);
    const row = { id: 1, state, alias: 'fixture' };
    assert.equal((await createFakeAdapter({ articles: [row] }).listArticles({ now: start })).total, 0);
    assert.equal((await createSPMiddleAdapter({ articleRepository: repo([row]), categoryRepository: repo([]) }).listArticles({ now: start })).total, 1);
  }
  for (const featured of [false, 0, '0', 'false', 'true', null, undefined]) {
    const html = render({ id: 1, state: 'Published', featured });
    assert.match(html, /Sem destaque/);
    assert.ok(!html.includes('admin-state-icon is-featured'));
  }
  assert.match(render({ id: 1, state: 'Published', featured: '1' }), /admin-state-icon is-featured/);
  for (const featured of [true, 1, '1', false, 0, '0', 'false', 'true', null, undefined]) {
    const row = { id: 1, published: true, state: 'Published', featured, alias: 'fixture' };
    assert.equal((await createFakeAdapter({ articles: [row] }).listArticles({ featured: true, now: start })).total, Number(featured === true));
    assert.equal((await createSPMiddleAdapter({ articleRepository: repo([row]), categoryRepository: repo([]) }).listArticles({ featured: true, now: start })).total, Number([true, 1, '1'].includes(featured)));
  }
  const legacy = Object.freeze({ id: 1, title: 'Legado' });
  const legacyBefore = { ...legacy };
  assert.match(render(legacy), /admin-state-icon is-active/);
  assert.match(render(legacy), /Sem destaque/);
  assert.deepEqual(legacy, legacyBefore, 'absent legacy fields remain absent without backfill');
  const generic = render({ id: 1, state: 'Published', featured: true, publishUp: end }, start, 'tags');
  assert.match(generic, /admin-state-icon is-active/);
  assert.match(generic, /admin-state-icon is-featured/);
  assert.ok(!generic.includes('Publicação agendada'));

  const unsafe = render({ id: 1, state: '"><script>bad</script>', featured: true });
  assert.ok(!unsafe.includes('<script>'));
  assert.match(unsafe, /title="Estado desconhecido: &quot;&gt;&lt;script&gt;/);
  assert.match(unsafe, /<span class="visually-hidden">/);
  assert.match(render({ id: 1, state: 'Published', publishUp: end, featured: true }), /Destaque inativo — publicação agendada/);
  assert.match(render({ id: 1, state: 'Draft', featured: true, featuredUp: end }), /Destaque agendado — rascunho/);
  assert.match(render({ id: 1, state: 'Published', featured: true, featuredDown: start }), /Destaque encerrado/);
  console.log('ok - article indicators and public adapters share scheduling boundaries without changing saved flags or other domains');
}
