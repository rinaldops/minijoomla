import assert from 'node:assert/strict';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { createApplication } from '../src/index.js';
import { renderArticle, renderArticleList } from '../src/components/com_content/tmpl/article/default.js';
import { renderArticleAdminForm } from '../src/administrator/components/com_minijoomla/render-article-form.js';
import { ARTICLE_FIELDS, ARTICLE_EDITOR_LAYOUT, ARTICLE_OPTION_FIELDS } from '../src/administrator/components/com_minijoomla/field-schemas.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function element(extra = {}) {
  const handlers = new Map();
  const attrs = {};
  return { value: '', textContent: '', disabled: false, ...extra,
    setAttribute: (name, value) => { attrs[name] = value; }, getAttribute: (name) => attrs[name],
    addEventListener(name, callback) { handlers.set(name, callback); },
    dispatch(name, event = {}) { return handlers.get(name)?.({ preventDefault() {}, ...event }); }
  };
}
// Only rendered fields exist, like a real form. The app still uses the real
// renderer/service/repositories; these doubles replace DOM event dispatch only.
function documentDouble() {
  let html = '';
  const inputs = new Map();
  const form = element({ querySelector: (selector) => selector === '[data-admin-article-accessibility]' ? analyze : selector === '[data-admin-article-accessibility-report]' ? report : inputs.get(selector.match(/^\[name="(.+)"\]$/)?.[1]) ?? null });
  const analyze = element();
  const report = element();
  const status = element();
  const tabs = ARTICLE_EDITOR_LAYOUT.tabs.map((tab, index) => {
    const button = element({ focused: false, focus() { this.focused = true; } });
    button.setAttribute('aria-controls', `admin-article-tab-articles-${tab.key}-panel`);
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    return button;
  });
  const panels = new Map(tabs.map((tab, index) => [tab.getAttribute('aria-controls'), { id: tab.getAttribute('aria-controls'), hidden: index !== 0 }]));
  const classes = new Set();
  const sidebar = element({ classList: { contains: (key) => classes.has(key), toggle(key, force = !classes.has(key)) { if (force) classes.add(key); else classes.delete(key); } } });
  const toggle = element({ focused: false, focus() { this.focused = true; } });
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      inputs.clear();
      for (const match of value.matchAll(/<(input|textarea|select)\b([^>]*\bname="([^"]+)"[^>]*)>([\s\S]*?)(?:<\/\1>|(?=<))/g)) {
        inputs.set(match[3], element({ disabled: /\bdisabled\b/.test(match[2]), value: /\bvalue="([^"]*)"/.exec(match[2])?.[1] ?? '', checked: /\bchecked\b/.test(match[2]), selectedOptions: [] }));
      }
    },
    querySelector: (selector) => selector === '[data-admin-form]' ? form : selector === '.admin-form-status' ? status : selector === '[data-admin-sidebar-toggle]' ? toggle : selector === '.admin-sidebar' ? sidebar : panels.get(selector.slice(1)) ?? null,
    querySelectorAll: (selector) => selector === '[data-admin-tab-button]' ? tabs : []
  };
  return { documentRef: { body }, form, analyze, report, status, tabs, panels, inputs, sidebar, toggle };
}
function mount(service, doc, richTextEditorFactory) {
  return createAdminApplication({ adminService: service, documentRef: doc.documentRef, autoStart: false, richTextEditorFactory });
}

export async function runEditorFinalTests() {
  const storageValues = new Map();
  const repositories = createDemoRepositories({ storage: { getItem: (key) => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value) } });
  const service = createAdminService(repositories);
  const attribsJson = '{ "show_title": 1, "show_author": "1", "future_option": {"keep":true} }';
  const record = await service.articles.create({ title: 'Editor final', alias: 'editor-final', introtext: '<p>Texto completo</p>', fulltext: '', state: 'Published', categoryId: 1, author: 'Autor base', authorAlias: 'Autor público', language: 'pt-BR', note: 'Nota privada', versionNote: 'Nota sem histórico', featured: true, featuredUp: '2026-01-01T00:00:00Z', featuredDown: '2027-01-01T00:00:00Z', metaDescription: 'Preservar descrição', metaKeywords: 'Preservar palavras', attribsJson });
  const doc = documentDouble();
  const app = mount(service, doc);
  await app.router.navigate(`#/articles/${record.id}`);
  assert.match(doc.documentRef.body.innerHTML, /name="featuredUp" value="202\d-\d{2}-\d{2}T\d{2}:\d{2}"/);
  // Simulates a partial host form: absent inputs must never erase the row.
  doc.inputs.clear();
  doc.inputs.set('title', element({ value: 'Título alterado' }));
  doc.inputs.set('metaDescription', element({ value: 'Tentativa maliciosa', disabled: true }));
  await doc.form.dispatch('submit');
  const partial = await service.articles.get(record.id);
  assert.equal(partial.title, 'Título alterado');
  for (const name of ['introtext', 'fulltext', 'alias', 'note', 'versionNote', 'language', 'authorAlias', 'featuredUp', 'featuredDown', 'metaDescription', 'metaKeywords', 'attribsJson']) assert.equal(partial[name], record[name], `missing/readonly ${name} must survive`);
  await app.router.navigate(`#/articles/${record.id}`);
  doc.inputs.clear();
  doc.inputs.set('title', element({ value: partial.title }));
  doc.inputs.set('featuredUp', element({ value: /name="featuredUp" value="([^"]+)"/.exec(doc.documentRef.body.innerHTML)[1] }));
  await doc.form.dispatch('submit');
  assert.equal((await service.articles.get(record.id)).featuredUp, record.featuredUp, 'unchanged datetime keeps exact persisted ISO value');

  await app.router.navigate(`#/articles/${record.id}`);
  doc.inputs.clear();
  doc.inputs.set('attrib:show_title', element({ value: '0' }));
  doc.inputs.set('attrib:show_author', element({ value: '1' }));
  await doc.form.dispatch('submit');
  const optionsEdited = await service.articles.get(record.id);
  const options = JSON.parse(optionsEdited.attribsJson);
  assert.equal(options.show_title, '0');
  assert.equal(options.show_author, '1');
  assert.deepEqual(options.future_option, { keep: true });
  await app.router.navigate(`#/articles/${record.id}`);
  doc.inputs.clear();
  doc.inputs.set('attrib:show_title', element({ value: '0' }));
  const exactJson = optionsEdited.attribsJson;
  await doc.form.dispatch('submit');
  assert.equal((await service.articles.get(record.id)).attribsJson, exactJson, 'unchanged options retain original JSON bytes');

  const adapter = createSPMiddleAdapter({ articleRepository: repositories.articles, categoryRepository: repositories.categories, now: '2026-06-01' });
  const publicArticle = await adapter.getArticle(record.alias);
  assert.equal(publicArticle.authorAlias, 'Autor público');
  assert.equal((await adapter.listArticles({ featured: true })).items.some((item) => item.id === record.id), true);
  for (const now of ['2025-12-31', '2027-01-01']) {
    assert.equal((await adapter.listArticles({ featured: true, now })).items.some((item) => item.id === record.id), false);
    assert.notEqual(await adapter.getArticle(record.alias, { now }), null, 'featured expiry is not publication expiry');
  }
  const rendered = renderArticle(publicArticle, { componentParams: { showTitle: true } });
  assert.doesNotMatch(rendered, /<h1>/);
  assert.match(rendered, /Por Autor público/);
  assert.match(rendered, /lang="pt-BR"/);
  assert.match(rendered, /Texto completo/);
  assert.doesNotMatch(rendered, /Nota privada|Nota sem histórico|Preservar descrição/);
  assert.doesNotMatch(renderArticleList({ items: [publicArticle] }), /<h2>/);
  assert.match(renderArticle({ ...publicArticle, attribsJson: '{"show_intro":0}' }), /Texto completo/, 'no readmore means intro contains the entire article');
  assert.match(renderArticle({ ...publicArticle, attribsJson: 'bad-json' }), /<h1>/);
  const complete = { title: 'Título opções', alias: 'titulo-opcoes', introtext: '<p>Intro opções</p>', fulltext: '<p>Corpo opções</p>', category: 'Categoria opções', author: 'Autor opções', publishUp: '2026-01-01', tags: ['tag-opções'] };
  for (const [key, pattern] of [['show_title', /<h1>/], ['show_intro', /Intro opções/], ['show_category', /Categoria opções/], ['show_author', /Por Autor opções/], ['show_publish_date', /Publicado em/], ['show_tags', /article-tags/]]) {
    assert.doesNotMatch(renderArticle({ ...complete, attribsJson: JSON.stringify({ [key]: '0' }) }), pattern, `${key} has a real article consumer`);
    assert.match(renderArticle({ ...complete, attribsJson: JSON.stringify({ [key]: '1' }) }, { componentParams: { showTitle: false, showIntro: false, showCategory: false, showAuthor: false, showPublishDate: false, showTags: false } }), pattern, `${key} can override the component default`);
  }
  assert.doesNotMatch(renderArticleList({ items: [{ ...complete, attribsJson: '{"link_titles":0}' }] }), /<h2><a/);
  assert.match(renderArticle({ ...publicArticle, authorAlias: '<script>notExecutable()</script>', language: 'pt" onclick="bad' }), /Por &lt;script&gt;notExecutable\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(renderArticle({ ...publicArticle, language: 'pt" onclick="bad' }), /onclick| lang=/);
  const siteDocument = { body: { innerHTML: '' } };
  const site = createApplication({ adapter, autoStart: false, documentRef: siteDocument, getModuleInstances: async () => [] });
  await site.start();
  await site.router.navigate(`#/article/${record.alias}`);
  assert.match(siteDocument.body.innerHTML, /Por Autor público/);
  assert.match(siteDocument.body.innerHTML, /class="category-name">Categoria: .*Notícias/, 'categoryId is resolved to its real category title');
  assert.match(siteDocument.body.innerHTML, /Texto completo/);
  site.stop();

  await app.router.navigate(`#/articles/${record.id}`);
  doc.inputs.set('articletext', element({ value: '<img src="x"><h2>A</h2><h4>B</h4><table><tr><td>X</td></tr></table><script>neverRun()</script>' }));
  const beforeAnalysis = JSON.stringify([...storageValues]);
  const textBefore = doc.inputs.get('articletext').value;
  doc.analyze.dispatch('click');
  assert.match(doc.report.innerHTML, /1 erro\(s\), 1 aviso\(s\), 1 informação/);
  assert.match(doc.report.innerHTML, /Erro:|Aviso:|Informação:/);
  assert.match(doc.report.innerHTML, /&lt;h2&gt; direto para &lt;h4&gt;/);
  assert.doesNotMatch(doc.report.innerHTML, /<script|<h2>|<h4>|<img/);
  assert.equal(doc.inputs.get('articletext').value, textBefore);
  assert.equal(JSON.stringify([...storageValues]), beforeAnalysis);
  const lastTab = doc.tabs.length - 1;
  for (const [key, index] of [['End', lastTab], ['ArrowRight', 0], ['ArrowLeft', lastTab], ['Home', 0]]) {
    const current = doc.tabs.find((button) => button.getAttribute('aria-selected') === 'true');
    let prevented = false;
    current.dispatch('keydown', { key, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(doc.tabs[index].getAttribute('aria-selected'), 'true');
    assert.equal(doc.tabs[index].getAttribute('tabindex'), '0');
    assert.equal(doc.panels.get(doc.tabs[index].getAttribute('aria-controls')).hidden, false);
  }
  doc.toggle.dispatch('click');
  doc.sidebar.dispatch('keydown', { key: 'Escape' });
  assert.equal(doc.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(doc.toggle.focused, true);
  app.stop();

  const corruptHtml = renderArticleAdminForm({ formId: 'articles', fields: ARTICLE_FIELDS, layout: ARTICLE_EDITOR_LAYOUT, values: { attribsJson: '[1]' } });
  assert.match(corruptHtml, /Opções persistidas inválidas/);
  for (const field of ARTICLE_OPTION_FIELDS) assert.ok(!corruptHtml.includes(`name="${field.name}"`));
  assert.match(corruptHtml, /name="attribsJson" readonly disabled/);
  const invalidDateHtml = renderArticleAdminForm({ formId: 'articles', fields: ARTICLE_FIELDS, layout: ARTICLE_EDITOR_LAYOUT, values: { featuredUp: 'invalid-date' } });
  assert.match(invalidDateHtml, /name="featuredUp" readonly disabled/);
  assert.match(invalidDateHtml, /data persistida inválida; valor preservado/);
  const corrupt = await service.articles.create({ title: 'Opções corrompidas', alias: 'opcoes-corrompidas' });
  await repositories.articles.update(corrupt.id, { attribsJson: '[1]' }, { etag: corrupt.etag });
  const corruptDoc = documentDouble();
  const corruptApp = mount(service, corruptDoc);
  await corruptApp.router.navigate(`#/articles/${corrupt.id}`);
  corruptDoc.inputs.clear();
  corruptDoc.inputs.set('title', element({ value: 'Nota editada sem opções' }));
  await corruptDoc.form.dispatch('submit');
  assert.equal((await service.articles.get(corrupt.id)).attribsJson, '[1]', 'unavailable option controls never overwrite corrupt stored JSON');
  corruptApp.stop();
  console.log('ok - final editor: useful Joomla tabs, partial patches, exact JSON/unknown options, readonly metadata, public attribs/author/language/featured consumers and local analysis');

  let resolveEditor;
  let destroyed = 0;
  let factoryCalls = 0;
  const raceDoc = documentDouble();
  raceDoc.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-richtext]' ? [{ id: 'admin-field-articles-articletext' }] : [];
  const race = mount(service, raceDoc, () => { factoryCalls += 1; return new Promise((resolve) => { resolveEditor = resolve; }); });
  const first = race.router.navigate(`#/articles/${record.id}`);
  await tick();
  const second = race.router.navigate('#/articles');
  await tick();
  assert.equal(factoryCalls, 1, 'new route waits for obsolete initialization before replacing DOM');
  raceDoc.documentRef.body.querySelectorAll = () => [];
  resolveEditor({ destroy: () => { destroyed += 1; } });
  await Promise.all([first, second]);
  assert.equal(destroyed, 1, 'late editor is destroyed once, never assigned to the new route');
  race.stop();
  assert.equal(destroyed, 1);

  let resolveStopped;
  let lateStopDestroyed = 0;
  const lateStopDoc = documentDouble();
  lateStopDoc.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-richtext]' ? [{ id: 'late-stop' }] : [];
  const lateStop = mount(service, lateStopDoc, () => new Promise((resolve) => { resolveStopped = resolve; }));
  const lateNavigation = lateStop.router.navigate(`#/articles/${record.id}`);
  await tick();
  lateStop.stop();
  resolveStopped({ destroy: () => { lateStopDestroyed += 1; } });
  await lateNavigation;
  assert.equal(lateStopDestroyed, 1, 'stop invalidates and destroys editors that finish later');

  let releaseSync;
  const syncRaceDoc = documentDouble();
  syncRaceDoc.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-richtext]' ? [{ id: 'sync-race' }] : [];
  const syncRace = mount(service, syncRaceDoc, async () => ({ destroy() {}, sync: () => new Promise((resolve) => { releaseSync = resolve; }) }));
  await syncRace.router.navigate(`#/articles/${record.id}`);
  syncRaceDoc.inputs.clear();
  syncRaceDoc.inputs.set('title', element({ value: 'Must not persist after leaving' }));
  const beforeSyncRace = JSON.stringify([...storageValues]);
  const submission = syncRaceDoc.form.dispatch('submit');
  await tick();
  syncRaceDoc.documentRef.body.querySelectorAll = () => [];
  await syncRace.router.navigate('#/articles');
  releaseSync();
  await submission;
  assert.equal(JSON.stringify([...storageValues]), beforeSyncRace, 'leaving the form during sync must cancel its write');
  syncRace.stop();

  const stopDoc = documentDouble();
  stopDoc.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-richtext]' ? [{ id: 'editor-stop' }] : [];
  let syncCalls = 0;
  let stopDestroyed = 0;
  const stopApp = mount(service, stopDoc, async () => ({ destroy: () => { stopDestroyed += 1; }, sync: () => { syncCalls += 1; } }));
  await stopApp.router.navigate(`#/articles/${record.id}`);
  stopDoc.inputs.set('articletext', element({ value: '<img src="x">' }));
  stopDoc.analyze.dispatch('click');
  assert.equal(syncCalls, 0, 'analysis must not invoke sync/upload side effects');
  stopApp.stop();
  stopApp.stop();
  assert.equal(stopDestroyed, 1);

  const rejectedDoc = documentDouble();
  rejectedDoc.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-richtext]' ? [{ id: 'failed-init' }] : [];
  const rejectedApp = mount(service, rejectedDoc, () => { throw new Error('private-vendor-detail'); });
  await rejectedApp.router.navigate(`#/articles/${record.id}`);
  assert.match(rejectedDoc.status.textContent, /Editor rico indisponível/);
  assert.doesNotMatch(rejectedDoc.status.textContent, /private-vendor-detail/);
  rejectedApp.stop();

  const orphan = await service.articles.create({ title: 'Legado relacional', alias: 'legado-relacional', categoryId: 999, tags: 'tag-fora-do-catalogo' });
  const orphanDoc = documentDouble();
  const orphanApp = mount(service, orphanDoc);
  await orphanApp.router.navigate(`#/articles/${orphan.id}`);
  assert.match(orphanDoc.documentRef.body.innerHTML, /<option value="999" selected>999 \(atual — indisponível\)<\/option>/);
  assert.match(orphanDoc.documentRef.body.innerHTML, /<option value="tag-fora-do-catalogo" selected>/);
  orphanApp.stop();
  console.log('ok - final editor: keyboard tabs/sidebar focus, navigation initializer race, readonly analysis without uploads and idempotent editor cleanup on stop');
}
