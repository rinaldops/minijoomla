import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createMiniJoomlaAdminApp } from '../src/libraries/minijoomla/composition/createMiniJoomlaAdminApp.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createApplication } from '../src/index.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';

const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };
const documentStub = () => ({ body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }, title: '' });

function formDocument() {
  const inputs = new Map();
  const handlers = [];
  const form = { addEventListener: (event, handler) => { if (event === 'submit') handlers.push(handler); },
    querySelector: (selector) => {
      const name = /\[name="([^"]+)"\]/.exec(selector)?.[1];
      if (!name) return null;
      if (!inputs.has(name)) inputs.set(name, { value: '', checked: false });
      return inputs.get(name);
    } };
  const status = { textContent: '' };
  const doc = documentStub();
  doc.body.querySelector = (selector) => selector === '[data-admin-form]' ? form : selector === '.admin-form-status' ? status : null;
  return { doc, status, input: (name) => form.querySelector(`[name="${name}"]`),
    submit: () => handlers.at(-1)({ preventDefault() {} }) };
}

/* Real SPMIDDLE mapper/repositories/composition, memory-only REST transport.
 * Lists omit ETags; singular reads/write responses expose non-enumerable ETags
 * through createRepository. All raw catalog mutation here models another
 * administrator changing configuration, never a real tenant write.
 */
function fixture(options = {}) {
  const names = ['articles', 'categories', 'tags', 'menu', 'extensions', 'moduleInstances', 'siteConfig'];
  const tables = new Map(names.map((name) => [name, new Map()]));
  let version = 0;
  let broken = false;
  let beforeArticleCreate;
  let merge204 = false;
  let failedArticleRead = false;
  const articleReads = [];
  const writes = [];
  const transport = { webUrl: '/sites/minijoomla-test', async request(path, request = {}) {
    const name = /getbytitle\('([^']+)'\)/.exec(path)?.[1];
    const rows = tables.get(name);
    if (!rows) throw new Error('Unexpected memory request');
    const method = request.method ?? 'GET';
    const id = Number(/\/items\((\d+)\)$/.exec(path)?.[1]);
    if (name === 'extensions' && method === 'GET' && broken) throw new Error('PRIVATE diagnostic must not reach UI');
    if (name === 'articles' && method === 'GET' && id) {
      articleReads.push(id);
      if (failedArticleRead) throw new Error('PRIVATE post-write read failure');
    }
    const response = (data, status = 200, etag = null) => ({ data: structuredClone(data), status, etag });
    if (method === 'GET') return id ? response(rows.get(id), 200, rows.get(id)?.__etag) : response({ value: [...rows.values()] });
    const body = structuredClone(request.body ?? {});
    if (method === 'POST') {
      if (name === 'articles') await beforeArticleCreate?.(body);
      const next = Math.max(0, ...rows.keys()) + 1;
      const row = { Id: next, ...body, __etag: `"${++version}"` };
      rows.set(next, row); writes.push({ name, method }); return response(row, 201, row.__etag);
    }
    const old = rows.get(id);
    if (request.etag !== old?.__etag) throw Object.assign(new Error('stale'), { code: 'concurrency-conflict', status: 412 });
    if (method === 'MERGE') { const row = { ...old, ...body, __etag: `"${++version}"` }; rows.set(id, row); writes.push({ name, method }); return merge204 ? response(null, 204) : response(row, 200, row.__etag); }
    throw new Error('Unexpected memory write');
  } };
  const app = createMiniJoomlaAdminApp({ webUrl: '/sites/minijoomla-test',
    lists: Object.fromEntries(names.map((name) => [name, { listPath: `lists/getbytitle('${name}')` }])),
    transportFactory: () => transport, ...options });
  const plugin = (key, extra = {}) => {
    const rows = tables.get('extensions');
    const id = Math.max(0, ...rows.keys()) + 1;
    rows.set(id, { Id: id, Title: key, Type: 'Plugin', Key: key, EntryPointUrl: `./${key}.js`, Enabled: true, Folder: 'content', Ordering: 0, ParamsJson: '{}', ManifestJson: '{}', __etag: `"${++version}"`, ...extra });
    return rows.get(id);
  };
  return { app, tables, writes, plugin, articleReads,
    breakCatalog: (value) => { broken = value; }, beforeArticleCreate: (callback) => { beforeArticleCreate = callback; },
    useMerge204: () => { merge204 = true; }, breakArticleRead: (value) => { failedArticleRead = value; }
  };
}

export async function runAdminPluginsRuntimeTests() {
  const imports = [];
  const lifecycle = [];
  const saves = [];
  const observations = [];
  const f = fixture({ importModule: async (url) => {
    imports.push(url);
    return { default: { group: 'content', adminLifecycle: true, events: {
      onAppInit: ({ params, client }) => lifecycle.push(['init', params.suffix, client]),
      onAppFinalize: ({ params }) => lifecycle.push(['finalize', params.suffix]),
      onContentPrepare: () => { throw new Error('site-only handler'); },
      onAfterRoute: () => { throw new Error('site-only handler'); },
      onContentBeforeSave(value, context) {
        saves.push([url, context.client, context.context, context.action]);
        assert.equal(Object.isFrozen(context.params), true);
        if (context.params.veto) return false;
        if (context.params.invalid) return { ...value, alias: '' };
        return { ...value, title: `${value.title ?? ''}${context.params.suffix ?? ''}` };
      },
      onContentAfterSave(value) {
        observations.push({ title: value.title, etag: value.etag, enumerable: Object.keys(value).includes('etag') });
        value.title = 'observer mutation';
        if (url === './b.js') return value;
        throw new Error('PRIVATE post-save failure');
      }
    } } };
  } });
  const a = f.plugin('a', { Ordering: 2, ParamsJson: '{"suffix":"A"}' });
  const b = f.plugin('b', { Ordering: 1, ParamsJson: '{"suffix":"B"}' });
  const definition = [{ name: 'suffix', type: 'text' }, { name: 'veto', type: 'checkbox' }, { name: 'invalid', type: 'checkbox' }];
  a.ManifestJson = b.ManifestJson = JSON.stringify({ params: definition });
  const created = await f.app.admin.articles.create({ title: 'X', alias: 'x' });
  assert.equal(created.title, 'XBA', 'first save loads persisted enabled plugins in ordering');
  assert.deepEqual(saves.map((entry) => entry.slice(1)), Array(2).fill(['administrator', 'com_content.article', 'create']));
  assert.equal(created.etag, observations[0].etag);
  assert.equal(observations[1].title, 'XBA', 'post-save observers do not share mutable snapshots');
  assert.equal(observations[0].enumerable, false);
  assert.equal(created.title, 'XBA');
  const originalEtag = created.etag;
  await f.app.admin.articles.update(created.id, { title: 'Y' }, { etag: originalEtag });
  await assert.rejects(() => f.app.admin.articles.update(created.id, { title: 'stale' }, { etag: originalEtag }), (error) => error.code === 'concurrency-conflict');
  assert.equal(imports.length, 2, 'unchanged refreshes reuse imports and lifecycle');
  assert.equal(lifecycle.length, 2);

  const etag = (await f.app.admin.plugins.get(a.Id)).etag;
  await f.app.admin.plugins.update(a.Id, { ordering: 0, params: { suffix: 'C', veto: true } }, { etag });
  const count = f.writes.filter((entry) => entry.name === 'articles').length;
  await assert.rejects(() => f.app.admin.articles.create({ title: 'V', alias: 'v' }), ValidationError);
  assert.equal(f.writes.filter((entry) => entry.name === 'articles').length, count);
  const storedA = f.tables.get('extensions').get(a.Id);
  storedA.ParamsJson = '{"suffix":"C"}';
  assert.equal((await f.app.admin.articles.create({ title: 'Z', alias: 'z' })).title, 'ZCB', 'new params/order applied before save');
  assert.ok(lifecycle.some((entry) => entry[0] === 'finalize' && entry[1] === 'A'));
  storedA.ParamsJson = '{"invalid":true}';
  await assert.rejects(() => f.app.admin.articles.create({ title: 'bad', alias: 'bad' }), ValidationError);
  storedA.ParamsJson = '{"suffix":"C"}';
  storedA.Enabled = false;
  assert.equal((await f.app.admin.articles.create({ title: 'D', alias: 'd' })).title, 'DB');
  storedA.Enabled = true;
  assert.equal((await f.app.admin.articles.create({ title: 'E', alias: 'e' })).title, 'ECB');
  assert.equal(imports.length, 2, 'disable/re-enable reuses approved imported code');
  const finalizedBefore = lifecycle.filter((entry) => entry[0] === 'finalize').length;
  await Promise.all([f.app.adminPlugins.stop(), f.app.adminPlugins.stop()]);
  assert.equal(lifecycle.filter((entry) => entry[0] === 'finalize').length, finalizedBefore + 2);
  assert.deepEqual(f.app.adminPlugins.list(), []);
  await assert.rejects(() => f.app.admin.articles.create({ title: 'stopped', alias: 'stopped' }), ValidationError);
  await f.app.adminPlugins.start();
  const duplicate = await f.app.admin.articles.duplicate(created.id);
  assert.equal(duplicate.state, 'Draft');
  assert.equal(duplicate.title.endsWith('CB'), true);
  const fresh = await f.app.admin.articles.get(created.id);
  assert.equal((await f.app.admin.articles.batch([{ id: fresh.id, etag: fresh.etag }], 'unpublish')).failed.length, 0);

  // Catalog corruption/unavailability never silently falls back to [].
  for (const bad of ['{broken', '[]']) {
    storedA.ParamsJson = bad;
    await assert.rejects(() => f.app.admin.articles.create({ title: 'no', alias: 'no' }), (error) => error.name === 'ValidationError' && !/broken|PRIVATE/.test(error.message));
  }
  storedA.ParamsJson = '{}';
  for (const [field, bad] of [['Ordering', 'bad'], ['Ordering', 1.5], ['Folder', ' '], ['ManifestJson', '{"group":1}']]) {
    const original = storedA[field];
    storedA[field] = bad;
    await assert.rejects(() => f.app.admin.articles.create({ title: 'no', alias: 'no' }), ValidationError);
    storedA[field] = original;
  }
  f.breakCatalog(true);
  await assert.rejects(() => f.app.admin.articles.create({ title: 'no', alias: 'no' }), (error) => !/PRIVATE/.test(error.message));
  f.breakCatalog(false);
  f.plugin('a');
  await assert.rejects(() => f.app.admin.articles.create({ title: 'duplicate catalog', alias: 'dup' }), ValidationError);
  await f.app.adminPlugins.stop();

  // Do not execute unsupported groups, native site display or site lifecycle.
  let siteLifecycle = 0;
  const scopeImports = [];
  const scope = fixture({ importModule: async (url) => { scopeImports.push(url); return { default: { events: {
    onAppInit: () => { siteLifecycle += 1; }, onAppFinalize: () => { siteLifecycle += 1; },
    onContentBeforeSave: (value) => ({ ...value, title: `${value.title}!` })
  } } }; } });
  scope.plugin('content');
  scope.plugin('system', { Folder: 'system' });
  scope.plugin('search', { Folder: 'search' });
  scope.plugin('unsupported', { Folder: 'authentication' });
  for (const key of ['emailcloak', 'pagebreak', 'loadmodule', 'pagenavigation']) scope.plugin(key, { EntryPointUrl: `native:${key}` });
  const publicApp = createApplication({ autoStart: false, documentRef: documentStub() });
  assert.equal((await scope.app.admin.articles.create({ title: 'scope', alias: 'scope' })).title, 'scope!');
  assert.deepEqual(scopeImports, ['./content.js']);
  await scope.app.adminPlugins.stop();
  assert.equal(siteLifecycle, 0);
  assert.deepEqual(publicApp.plugins.list(), [], 'public manager does not share admin registrations');

  const returnedObservers = [];
  const returns = fixture({ importModule: async (url) => ({ default: { events: { onContentAfterSave(value) {
    returnedObservers.push([url, value.title, value.etag]);
    if (url === './return-null.js') return null;
    if (url === './return-object.js') return { title: 'replacement', etag: 'wrong' };
  } } } }) });
  returns.plugin('return-null', { Ordering: 0 });
  returns.plugin('return-object', { Ordering: 1 });
  returns.plugin('return-last', { Ordering: 2 });
  const observedRow = await returns.app.admin.articles.create({ title: 'baseline', alias: 'baseline' });
  assert.deepEqual(returnedObservers, ['./return-null.js', './return-object.js', './return-last.js'].map((url) => [url, 'baseline', observedRow.etag]));
  await returns.app.adminPlugins.stop();

  // Untrusted persisted URL is rejected before even an injected importer runs.
  for (const url of ['https://evil.invalid/p.js', '//evil.invalid/p.js', 'data:text/javascript,x', 'native:unknown']) {
    const unsafe = fixture({ importModule: () => { throw new Error('must not import'); } });
    unsafe.plugin('unsafe', { EntryPointUrl: url });
    await assert.rejects(() => unsafe.app.admin.articles.create({ title: 'unsafe', alias: 'unsafe' }), ValidationError);
    assert.equal(unsafe.writes.length, 0);
    await unsafe.app.adminPlugins.stop();
  }
  const brokenImport = fixture({ importModule: async () => { throw new Error('PRIVATE import'); } });
  brokenImport.plugin('fail');
  await assert.rejects(() => brokenImport.app.admin.articles.create({ title: 'fail', alias: 'fail' }), (error) => !/PRIVATE/.test(error.message));
  assert.equal(brokenImport.writes.length, 0);
  await brokenImport.app.adminPlugins.stop();
  const badContract = fixture({ importModule: async () => ({ default: { group: 'system', events: { onContentBeforeSave: () => false } } }) });
  badContract.plugin('bad-contract');
  await assert.rejects(() => badContract.app.admin.articles.create({ title: 'no', alias: 'no' }), ValidationError);
  assert.equal(badContract.writes.length, 0);
  await badContract.app.adminPlugins.stop();

  // Stop/import and abandoned-navigation races cannot register/init or write late.
  const loading = deferred();
  const entered = deferred();
  let lateInit = 0;
  const race = fixture({ importModule: async () => { entered.resolve(); return loading.promise; } });
  race.plugin('race');
  const saving = race.app.admin.articles.create({ title: 'late', alias: 'late' });
  const rejectedSave = assert.rejects(() => saving, ValidationError);
  await entered.promise;
  await race.app.adminPlugins.stop();
  loading.resolve({ default: { adminLifecycle: true, events: { onAppInit: () => { lateInit += 1; } } } });
  await rejectedSave;
  assert.equal(lateInit, 0);
  assert.equal(race.writes.length, 0);
  assert.deepEqual(race.app.adminPlugins.list(), []);
  const saveHook = deferred();
  const hookEntered = deferred();
  const hookRace = fixture({ importModule: async () => ({ default: { events: {
    onContentBeforeSave: async (value) => { hookEntered.resolve(); await saveHook.promise; return value; }
  } } }) });
  hookRace.plugin('hook-race');
  const delayedSave = hookRace.app.admin.articles.create({ title: 'late hook', alias: 'late-hook' });
  const hookRejected = assert.rejects(() => delayedSave, ValidationError);
  await hookEntered.promise;
  await hookRace.app.adminPlugins.stop();
  saveHook.resolve();
  await hookRejected;
  assert.equal(hookRace.writes.length, 0, 'stop after awaited beforeSave cannot initiate persistence');
  const navLoading = deferred();
  const navEntered = deferred();
  const nav = fixture({ importModule: async () => { navEntered.resolve(); return navLoading.promise; } });
  nav.plugin('nav');
  const doc = documentStub();
  const ui = createAdminApplication({ adminService: nav.app.admin, pluginRuntime: nav.app.adminPlugins, documentRef: doc, autoStart: false });
  const old = ui.start();
  assert.equal(ui.start(), old, 'repeated app start is idempotent');
  await navEntered.promise;
  const latest = ui.router.navigate('#/config');
  nav.tables.get('extensions').get(1).Enabled = false;
  navLoading.resolve({ default: { adminLifecycle: true, events: { onAppInit: () => { lateInit += 1; } } } });
  await Promise.all([old, latest]);
  assert.equal(lateInit, 0);
  assert.deepEqual(nav.app.adminPlugins.list(), []);
  assert.match(doc.body.innerHTML, /Configuração/);
  await ui.stop();
  const stoppedHtml = doc.body.innerHTML;
  await ui.router.navigate('#/articles');
  assert.equal(doc.body.innerHTML, stoppedHtml);
  await tick();

  // Actual UI binding -> actual composition: refresh adds asynchronous work,
  // but must not admit a second submit or replace the captured article ETag.
  let formGate;
  let formEntered;
  const forms = fixture({ importModule: async () => ({ default: { events: {
    onContentBeforeSave: async (value) => {
      if (formGate) { formEntered.resolve(); await formGate.promise; }
      return value;
    }
  } } }) });
  forms.plugin('form-save');
  const article = await forms.app.admin.articles.create({ title: 'Original', alias: 'original' });
  const formDoc = formDocument();
  const formUi = createAdminApplication({ adminService: forms.app.admin, pluginRuntime: forms.app.adminPlugins, documentRef: formDoc.doc, autoStart: false });
  await formUi.router.navigate(`#/articles/${article.id}`);
  formDoc.input('title').value = 'Edited';
  formDoc.input('alias').value = 'original';
  formDoc.input('state').value = 'Draft';
  formGate = deferred(); formEntered = deferred();
  const firstSubmit = formDoc.submit();
  await formEntered.promise;
  await formDoc.submit();
  const beforeSubmitWrites = forms.writes.filter((entry) => entry.name === 'articles').length;
  formGate.resolve();
  await firstSubmit;
  assert.equal(forms.writes.filter((entry) => entry.name === 'articles').length, beforeSubmitWrites + 1, 'one write for two pending submits');
  formGate = null;
  await formUi.router.navigate(`#/articles/${article.id}`);
  const concurrent = await forms.app.admin.articles.get(article.id);
  await forms.app.admin.articles.update(article.id, { title: 'Concurrent' }, { etag: concurrent.etag });
  formDoc.input('title').value = 'Stale screen';
  await formDoc.submit();
  assert.match(formDoc.status.textContent, /outra pessoa/);
  assert.equal((await forms.app.admin.articles.get(article.id)).title, 'Concurrent');
  await formUi.stop();

  // Lifecycle init/stop overlap finalizes exactly once with old parameters;
  // pending restart loses to a newer stop and cannot resurrect the runtime.
  const initGate = deferred();
  const initEntered = deferred();
  let initFinalized = 0;
  const initRace = fixture({ importModule: async () => ({ default: { adminLifecycle: true, events: {
    onAppInit: async () => { initEntered.resolve(); await initGate.promise; },
    onAppFinalize: () => { initFinalized += 1; }
  } } }) });
  initRace.plugin('init-race');
  const initSave = initRace.app.admin.articles.create({ title: 'init', alias: 'init' });
  const initRejected = assert.rejects(() => initSave, ValidationError);
  await initEntered.promise;
  const stopping = initRace.app.adminPlugins.stop();
  const restartRejected = assert.rejects(() => initRace.app.adminPlugins.start(), ValidationError);
  const secondStop = initRace.app.adminPlugins.stop();
  initGate.resolve();
  await Promise.all([stopping, secondStop, initRejected, restartRejected]);
  assert.equal(initFinalized, 1);
  assert.deepEqual(initRace.app.adminPlugins.list(), []);
  assert.equal(initRace.writes.length, 0);

  // Per-operation snapshots: a disabled/reconfigured plugin still observes
  // its already-started write with the old params; concurrent writes complete
  // out of order, and neither refresh nor stop reroutes afterSave to new code.
  const completed = [];
  const pending = new Map();
  const inFlight = fixture({ importModule: async (url) => ({ default: { events: {
    onContentBeforeSave: (value, { params }) => ({ ...value, title: `${value.title}:${params.revision}` }),
    onContentAfterSave: (value, context) => {
      completed.push([url, value.title, context.params.revision, context.action, value.etag, context.client]);
      return null;
    }
  } } }) });
  const persisted = inFlight.plugin('flight', { ParamsJson: '{"revision":"old"}' });
  inFlight.beforeArticleCreate(async (body) => { const item = pending.get(body.Alias); item.entered.resolve(); await item.gate.promise; });
  const beginSave = (alias) => {
    const state = { gate: deferred(), entered: deferred() };
    pending.set(alias, state);
    return { ...state, promise: inFlight.app.admin.articles.create({ title: alias, alias }) };
  };
  const older = beginSave('older');
  await older.entered.promise;
  persisted.Enabled = false;
  await inFlight.app.adminPlugins.refresh();
  persisted.Enabled = true;
  persisted.ParamsJson = '{"revision":"new"}';
  persisted.EntryPointUrl = './flight-v2.js';
  const newer = beginSave('newer');
  await newer.entered.promise;
  newer.gate.resolve();
  const newRow = await newer.promise;
  await inFlight.app.adminPlugins.stop();
  older.gate.resolve();
  const oldRow = await older.promise;
  assert.deepEqual(completed, [
    ['./flight-v2.js', 'newer:new', 'new', 'create', newRow.etag, 'administrator'],
    ['./flight.js', 'older:old', 'old', 'create', oldRow.etag, 'administrator']
  ]);
  assert.equal(inFlight.writes.length, 2, 'already-started writes finish once without late retry or false failure');

  // Real mapper/repository null MERGE204 response: reread current stored fields
  // and ETag for afterSave, but keep null result and completed write semantics.
  const mergeSeen = [];
  const merge = fixture({ importModule: async (url) => ({ default: { events: {
    onContentBeforeSave: (value) => ({ ...value, title: `${value.title}!` }),
    onContentAfterSave(value, context) {
      mergeSeen.push([url, value.id, value.title, value.introtext, value.etag, Object.keys(value).includes('etag'), context.action]);
      value.title = 'observer mutation';
      if (url === './first204.js') throw new Error('PRIVATE observer failure');
      return null;
    }
  } } }) });
  merge.plugin('first204', { Ordering: 0 });
  merge.plugin('second204', { Ordering: 1 });
  const mergeArticle = await merge.app.admin.articles.create({ title: 'Original', alias: 'merge204', introtext: 'retained body' });
  mergeSeen.length = 0;
  merge.useMerge204();
  assert.equal(await merge.app.admin.articles.update(mergeArticle.id, { title: 'Changed' }, { etag: mergeArticle.etag }), null);
  const storedMerge = merge.tables.get('articles').get(mergeArticle.id);
  assert.notEqual(storedMerge.__etag, mergeArticle.etag);
  assert.deepEqual(merge.articleReads, [mergeArticle.id], 'one singular read for successful no-content write');
  assert.deepEqual(mergeSeen, ['./first204.js', './second204.js'].map((url) => [url, mergeArticle.id, 'Changed!!', 'retained body', storedMerge.__etag, false, 'update']));
  assert.equal(storedMerge.Title, 'Changed!!');
  const successfulWrites = merge.writes.length;
  await assert.rejects(() => merge.app.admin.articles.update(mergeArticle.id, { title: 'Stale' }, { etag: mergeArticle.etag }), (error) => error.code === 'concurrency-conflict');
  assert.equal(merge.articleReads.length, 1, 'stale update never rereads or observes');
  merge.breakArticleRead(true);
  assert.equal(await merge.app.admin.articles.update(mergeArticle.id, { title: 'Committed' }, { etag: storedMerge.__etag }), null);
  assert.equal(merge.writes.length, successfulWrites + 1);
  assert.equal(merge.tables.get('articles').get(mergeArticle.id).Title, 'Committed!!');
  assert.equal(mergeSeen.length, 2, 'reread failure preserves completed null result and skips observers');
  await merge.app.adminPlugins.stop();

  // Explicit custom manager precedence: no hidden persisted imports or refresh.
  let customCalls = 0;
  const custom = fixture({ pluginManager: { beforeSave: (value) => { customCalls += 1; return value; }, afterSave: () => {} }, importModule: () => { throw new Error('no persisted imports'); } });
  custom.breakCatalog(true);
  await custom.app.admin.articles.create({ title: 'custom', alias: 'custom' });
  assert.equal(customCalls, 1);
  assert.equal(custom.app.adminPlugins, null);
  const optOut = fixture({ pluginManager: null });
  optOut.breakCatalog(true);
  await optOut.app.admin.articles.create({ title: 'opt-out', alias: 'opt-out' });
  assert.equal(optOut.app.adminPlugins, null);
  const partial = fixture({ lists: { articles: { listPath: "lists/getbytitle('articles')" }, categories: { listPath: "lists/getbytitle('categories')" } } });
  assert.equal(partial.app.adminPlugins, null, 'deliberately absent extensions domain is plugin-free, not an unavailable catalog');
  assert.equal((await partial.app.admin.articles.create({ title: 'partial', alias: 'partial' })).title, 'partial');
  console.log('ok - admin plugins real composition: refresh, scopes, veto/ETag, lifecycle, fail-closed catalog and stop/navigation races');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAdminPluginsRuntimeTests();
