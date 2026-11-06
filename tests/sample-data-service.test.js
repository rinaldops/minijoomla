import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createSampleDataService } from '../src/libraries/minijoomla/application/sample-data-service.js';

const DOMAINS = ['categories', 'tags', 'articles', 'menu', 'extensions', 'templates', 'moduleInstances', 'siteConfig'];
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
  return {
    schemaVersion: 1, id: 'joomla-blog', version: 1, title: 'Blog Joomla',
    source: { name: 'Joomla sample data', revision: 'local-fixture', license: 'GPL-2.0-or-later' },
    domains: {
      // Child first in source deliberately exercises dependency sorting.
      categories: [
        { key: 'child', parentRef: 'root', values: { title: 'Notícias', alias: 'noticias', description: '', state: 'Published' } },
        { key: 'root', parentRef: null, values: { title: 'Blog', alias: 'blog', description: '', state: 'Published' } }
      ],
      tags: [{ key: 'joomla', values: { name: 'Joomla', alias: 'joomla', state: 'Published' } }],
      articles: [
        { key: 'welcome', categoryRef: 'child', tagRefs: ['joomla'], values: { title: 'Bem-vindo', alias: 'bem-vindo', introtext: '<p>Conteúdo do pacote</p>', fulltext: '', state: 'Published', featured: true, publishUp: '2026-01-01T00:00:00Z', publishDown: null, attribsJson: { show_title: true } } },
        { key: 'about', categoryRef: 'root', tagRefs: [], values: { title: 'Sobre', alias: 'sobre', introtext: '', state: 'Published', featured: false } }
      ],
      menu: [
        { key: 'news', parentRef: 'home', values: { title: 'Notícias', path: '/category/noticias', published: 'Published', ordering: 2 } },
        { key: 'home', parentRef: null, values: { title: 'Início', path: '/', published: 'Published', ordering: 1 } }
      ],
      extensions: [{ key: 'cloak', values: { title: 'Email cloak', key: 'emailcloak', type: 'Plugin', entryPointUrl: 'native:emailcloak', enabled: true, paramsJson: { enabled: true }, manifestJson: { description: 'Local data', version: '1', params: [] } } }],
      templates: [{ key: 'cassiopeia', values: { title: 'Cassiopeia', key: 'cassiopeia', version: '1.0.0', entryPointUrl: '/sites/demo/templates/cassiopeia/index.js', styles: ['/sites/demo/templates/cassiopeia/template.css'], positions: ['sidebar-right', 'footer'], enabled: true } }],
      moduleInstances: [{ key: 'latest', values: { title: 'Recentes', extensionKey: 'articles-latest', position: 'sidebar-right', settingsJson: { limit: 3 }, enabled: true, showTitle: true, assignment: 'all', assignmentJson: '[]' } }],
      siteConfig: [{ key: 'site', values: { siteName: 'Blog Joomla', templateKey: 'cassiopeia', pageSize: 10, homeCategory: 'noticias', homeView: 'category', offline: false, componentParamsJson: { content: { showTitle: true } } } }]
    }
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

function repository(domain, events, seed = []) {
  const rows = new Map(seed.map((row) => [row.id, clone(row)]));
  let next = Math.max(100, ...seed.map((row) => row.id)) + 1;
  let version = 1;
  const output = (row) => {
    const { etag, ...data } = row;
    // Real SPMIDDLE uses non-enumerable ETags, and lists omit them.
    return Object.defineProperty(clone(data), 'etag', { value: etag, enumerable: false });
  };
  return {
    rows,
    async findMany() {
      events.push({ kind: 'list', domain });
      return { items: [...rows.values()].map(({ etag, ...data }) => clone(data)) };
    },
    async findById(id) {
      events.push({ kind: 'get', domain, id });
      const row = rows.get(Number(id));
      if (!row) throw Object.assign(new Error('not found'), { status: 404, code: 'not-found' });
      return output(row);
    },
    async create(input) {
      events.push({ kind: 'create', domain, input: clone(input) });
      const id = next++;
      const row = { id, ...clone(input), etag: `"${domain}-${version++}"` };
      rows.set(id, row);
      return output(row);
    },
    async update() { assert.fail('Sample data must never update'); },
    async delete() { assert.fail('Sample data must never delete or rollback'); }
  };
}

function harness({ data = fixture(), seeds = {}, storeMode = 'async' } = {}) {
  const events = [];
  const repositories = Object.fromEntries(DOMAINS.map((domain) => [domain, repository(domain, events, seeds[domain])]));
  const adminService = createAdminService(repositories);
  let saved = null;
  const store = {
    read() { events.push({ kind: 'journal-read' }); return storeMode === 'sync' ? clone(saved) : Promise.resolve(clone(saved)); },
    write(value) {
      events.push({ kind: 'journal-write', value: clone(value) });
      saved = clone(value);
      return storeMode === 'sync' ? undefined : Promise.resolve();
    }
  };
  const loadPackage = async () => { events.push({ kind: 'load' }); return data; };
  const makeService = (options = {}) => createSampleDataService({ adminService, loadPackage, journalStore: store, ...options });
  return { data, events, repositories, adminService, store, makeService, get journal() { return clone(saved); }, set journal(value) { saved = clone(value); } };
}

const creates = (h) => h.events.filter((event) => event.kind === 'create');
const writes = (h) => h.events.filter((event) => event.kind === 'journal-write');
const totalRows = (h) => DOMAINS.reduce((total, domain) => total + h.repositories[domain].rows.size, 0);
function deferred() {
  let resolvePromise;
  const promise = new Promise((resolve) => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

export async function runSampleDataServiceTests() {
  let passed = 0;
  async function test(name, run) {
    await run(); passed += 1; console.log(`ok - sample data: ${name}`);
  }

  await test('read-only inspect and explicit confirmation/cancellation', async () => {
    const h = harness(); const service = h.makeService();
    const checked = await service.inspect();
    assert.equal(checked.status, 'ready');
    assert.equal(checked.summary.total, 11);
    assert.deepEqual(checked.summary.counts, { categories: 2, tags: 1, articles: 2, menu: 2, extensions: 1, templates: 1, moduleInstances: 1, siteConfig: 1 });
    assert.equal(writes(h).length, 0); assert.equal(creates(h).length, 0);
    for (const confirm of [undefined, false, 'true', 1]) {
      const before = h.events.length;
      assert.equal((await service.install({ confirm })).reason, 'confirmation-required');
      assert.equal(h.events.length, before);
    }
  });

  await test('eleven real admin creates, parent-first real IDs, tags by name, exact URLs and immutable source', async () => {
    const data = deepFreeze(fixture()); const original = JSON.stringify(data);
    const h = harness({ data }); const progress = [];
    const result = await h.makeService().install({ confirm: true, onProgress: (event) => progress.push(event) });
    assert.equal(result.status, 'installed', result.message);
    assert.equal(result.summary.completed, 11);
    assert.equal(result.automaticRollback, false);
    assert.equal(totalRows(h), 11);
    assert.equal(creates(h).length, 11);
    const categories = [...h.repositories.categories.rows.values()];
    const root = categories.find((row) => row.alias === 'blog');
    const child = categories.find((row) => row.alias === 'noticias');
    assert.equal(child.parentId, root.id); assert.ok(root.id > 100);
    assert.equal(h.journal.receipts[0].key, 'root');
    const welcome = [...h.repositories.articles.rows.values()].find((row) => row.alias === 'bem-vindo');
    assert.equal(welcome.categoryId, child.id); assert.equal(welcome.tags, 'Joomla');
    assert.equal([...h.repositories.menu.rows.values()].find((row) => row.path !== '/').parentId, [...h.repositories.menu.rows.values()].find((row) => row.path === '/').id);
    assert.equal([...h.repositories.templates.rows.values()][0].entryPointUrl, data.domains.templates[0].values.entryPointUrl);
    assert.equal([...h.repositories.templates.rows.values()][0].styles, JSON.stringify(data.domains.templates[0].values.styles));
    assert.equal(JSON.stringify(data), original);
    for (const event of creates(h)) for (const field of ['parentRef', 'categoryRef', 'tagRefs']) assert.equal(Object.hasOwn(event.input, field), false);
    assert.equal(Object.hasOwn(creates(h).find((event) => event.domain === 'categories').input, 'key'), false);
    assert.equal(progress.at(-1).phase, 'complete');
    assert.equal(h.journal.pending, null);
    assert.ok(h.journal.receipts.every((receipt) => typeof receipt.etag === 'string' && receipt.id > 100));
    assert.equal(h.journal.signature.startsWith('sha256:') || h.journal.signature.startsWith('canonical:'), true);
    // Every create has already durably stored that row's pending intent.
    for (let index = 0; index < h.events.length; index += 1) {
      const event = h.events[index];
      if (event.kind !== 'create') continue;
      const before = h.events.slice(0, index).filter((entry) => entry.kind === 'journal-write').at(-1).value;
      assert.equal(before.pending.domain, event.domain);
      assert.equal(before.receipts.length, h.events.slice(0, index).filter((entry) => entry.kind === 'create').length);
    }
    assert.equal((await h.makeService().inspect()).status, 'installed');
    const before = creates(h).length;
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    assert.equal(creates(h).length, before);
  });

  await test('synchronous injected JSON journal also works', async () => {
    const h = harness({ storeMode: 'sync' });
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    assert.equal(h.journal.receipts.length, 11);
  });

  await test('no-journal complete exact seed is installed, preserves unknown fields/defaults/JSON/date instants', async () => {
    const h = harness();
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    h.journal = null;
    for (const domain of DOMAINS) for (const row of h.repositories[domain].rows.values()) row.unknownLegacy = 'preserve';
    const article = [...h.repositories.articles.rows.values()].find((row) => row.alias === 'bem-vindo');
    article.publishUp = '2025-12-31T21:00:00-03:00'; article.publishDown = ''; article.fulltext = null;
    article.attribsJson = ' { "show_title" : true } ';
    const module = [...h.repositories.moduleInstances.rows.values()][0];
    module.settingsJson = JSON.stringify({ headerClass: '', headerTag: 'h2', moduleClass: '', limit: '3', legacy: { keep: true } });
    const config = [...h.repositories.siteConfig.rows.values()][0];
    config.componentParamsJson = '{ "content" : { "showTitle" : true } }';
    const before = { creates: creates(h).length, writes: writes(h).length };
    assert.equal((await h.makeService().inspect()).status, 'installed');
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    assert.deepEqual({ creates: creates(h).length, writes: writes(h).length }, before);
    assert.equal(article.unknownLegacy, 'preserve'); assert.equal(h.journal, null);
    module.settingsJson = '{malformed';
    assert.equal((await h.makeService().inspect()).status, 'blocked');
  });

  await test('partial seed without journal and forty existing records are never changed', async () => {
    for (const count of [1, 40, 81]) {
      const seeds = { articles: Array.from({ length: count }, (_, index) => ({ id: index + 1, title: `Existing ${index}`, alias: `existing-${index}`, etag: '"original"' })) };
      const h = harness({ seeds });
      const before = JSON.stringify([...h.repositories.articles.rows.values()]);
      assert.equal((await h.makeService().inspect()).status, 'blocked');
      assert.equal((await h.makeService().install({ confirm: true })).status, 'blocked');
      assert.equal(creates(h).length, 0); assert.equal(writes(h).length, 0);
      assert.equal(JSON.stringify([...h.repositories.articles.rows.values()]), before);
    }
  });

  await test('no-journal conflicting known fields, duplicate rows, settings mismatch cannot be adopted', async () => {
    for (const change of [
      (h) => { [...h.repositories.articles.rows.values()][0].introtext = 'My editorial content'; },
      (h) => { const rows = [...h.repositories.categories.rows.values()]; rows[1].alias = rows[0].alias; },
      (h) => { [...h.repositories.moduleInstances.rows.values()][0].settingsJson = '{"limit":4}'; },
      (h) => { [...h.repositories.articles.rows.values()][0].attribsJson = '{"show_title":true,"extra":1}'; }
    ]) {
      const h = harness(); await h.makeService().install({ confirm: true }); h.journal = null; change(h);
      const before = creates(h).length;
      assert.equal((await h.makeService().install({ confirm: true })).status, 'blocked');
      assert.equal(creates(h).length, before);
    }
  });

  await test('unavailable dependencies/disabled sources are not interpreted as empty', async () => {
    for (const options of [{}, { loadPackage: async () => fixture() }, { journalStore: { read() {}, write() {} } }]) {
      const service = createSampleDataService(options);
      assert.equal(service.available, false);
      assert.equal((await service.inspect()).status, 'unavailable');
      assert.equal((await service.install({ confirm: true })).status, 'unavailable');
    }
    const h = harness();
    const admin = { ...h.adminService, templates: { ...h.adminService.templates, available: false } };
    assert.equal((await h.makeService({ adminService: admin }).inspect()).status, 'unavailable');
    assert.equal(creates(h).length, 0); assert.equal(writes(h).length, 0);
    assert.equal((await h.makeService({ loadPackage: async () => { throw new Error('missing'); } }).inspect()).reason, 'package-unavailable');
    assert.equal((await h.makeService({ journalStore: { read() { throw new Error('storage'); }, write() {} } }).inspect()).reason, 'journal-unavailable');
  });

  await test('strict plain JSON guard rejects getters/functions/toJSON/cycles without evaluating code', async () => {
    let executed = 0;
    const bad = [];
    const accessor = fixture(); Object.defineProperty(accessor, 'title', { enumerable: true, get() { executed += 1; return 'unsafe'; } }); bad.push(accessor);
    const nested = fixture(); Object.defineProperty(nested.domains.articles[0].values.attribsJson, 'x', { enumerable: true, get() { executed += 1; return 1; } }); bad.push(nested);
    const jsonHook = fixture(); jsonHook.toJSON = () => { executed += 1; return fixture(); }; bad.push(jsonHook);
    const cycle = fixture(); cycle.source.self = cycle; bad.push(cycle);
    const functionValue = fixture(); functionValue.source.fn = () => { executed += 1; }; bad.push(functionValue);
    const date = fixture(); date.source.date = new Date(); bad.push(date);
    const sparse = fixture(); sparse.domains.categories = new Array(1); bad.push(sparse);
    for (const data of bad) {
      const h = harness({ data });
      assert.equal((await h.makeService().install({ confirm: true })).reason, 'invalid-package');
      assert.equal(creates(h).length, 0); assert.equal(writes(h).length, 0);
    }
    assert.equal(executed, 0);
  });

  await test('caps, unknown/unsupported fields and broken references fail before journal writes', async () => {
    const mutations = [
      (data) => { data.schemaVersion = 2; },
      (data) => { data.domains.categories.push(clone(data.domains.categories[0])); },
      (data) => { data.domains.articles[0].categoryRef = 'missing'; },
      (data) => { data.domains.articles[0].tagRefs = ['missing']; },
      (data) => { data.domains.categories[1].parentRef = 'child'; },
      (data) => { data.domains.articles[0].values.categoryId = 42; },
      (data) => { data.domains.siteConfig[0].values.metaDescription = 'unsupported host SEO'; },
      (data) => { data.domains.articles[0].values.history = []; },
      (data) => { data.domains.extensions[0].values.entryPointUrl = 'https://untrusted.invalid/code.js'; },
      (data) => { data.domains.articles[0].values.attribsJson = '[1]'; },
      (data) => { data.domains.moduleInstances[0].values.settingsJson = '{broken'; },
      (data) => { data.domains.moduleInstances[0].values.settingsJson = { limit: 1000 }; },
      (data) => { data.domains.moduleInstances[0].values.position = 'unsupported'; },
      (data) => { data.domains.moduleInstances[0].values.extensionKey = 'missing'; },
      (data) => { data.domains.moduleInstances[0].values.settingsJson = { moduleClass: 'bad<script>' }; },
      (data) => { data.domains.moduleInstances[0].values.scopeKind = 'Route'; },
      (data) => { data.domains.moduleInstances[0].values.assignment = 'only'; },
      (data) => { data.domains.moduleInstances[0].values.assignmentJson = '["menu:40"]'; },
      (data) => { data.domains.articles[0].values.state = 'Other'; },
      (data) => { data.domains.articles[0].values.introtext = { no: 'implicit coercion' }; },
      (data) => { data.domains.articles[0].values.publishUp = 'not a date'; },
      (data) => { data.domains.siteConfig[0].values.pageSize = 100; },
      (data) => { data.domains.siteConfig[0].values.templateKey = 'missing'; },
      (data) => { data.domains.categories[0].parentRef = ''; },
      (data) => { data.domains.articles[0].values.introtext = 'a'.repeat(20001); },
      (data) => { data.source.text = 'a'.repeat(1000001); },
      (data) => { delete data.domains.templates; },
      (data) => { data.domains.siteConfig.push(clone(data.domains.siteConfig[0])); },
      (data) => { data.domains.articles = Array.from({ length: 81 }, (_, index) => ({ key: `a${index}`, values: { title: `A${index}`, alias: `a${index}` } })); },
      (data) => { data.domains.articles = Array.from({ length: 80 }, (_, index) => ({ key: `a${index}`, values: { title: `A${index}`, alias: `a${index}` } })); }
    ];
    for (const mutate of mutations) {
      const data = fixture(); mutate(data); const h = harness({ data });
      assert.equal((await h.makeService().install({ confirm: true })).reason, 'invalid-package');
      assert.equal(creates(h).length, 0); assert.equal(writes(h).length, 0);
    }
  });

  await test('single busy installation rejects duplicate submission before loading twice', async () => {
    const h = harness(); const waiting = deferred(); let loads = 0;
    const service = h.makeService({ loadPackage: async () => { loads += 1; await waiting.promise; return h.data; } });
    const first = service.install({ confirm: true });
    const second = await service.install({ confirm: true });
    assert.equal(second.reason, 'busy'); assert.equal(loads, 1);
    assert.equal((await service.inspect()).reason, 'busy');
    waiting.resolve(); assert.equal((await first).status, 'installed'); assert.equal(creates(h).length, 11);
  });

  await test('load failure and navigation while awaiting load never write/callback', async () => {
    const h = harness(); const waiting = deferred(); let current = true; let progress = 0;
    const service = h.makeService({ loadPackage: async () => { await waiting.promise; return h.data; } });
    const installation = service.install({ confirm: true, isCurrent: () => current, onProgress: () => { progress += 1; } });
    current = false; waiting.resolve();
    assert.equal((await installation).reason, 'abandoned');
    assert.equal(h.events.length, 0); assert.equal(progress, 0);
    current = false;
    assert.equal((await service.install({ confirm: true, isCurrent: () => current })).reason, 'abandoned');
    assert.equal(h.events.length, 0);
  });

  await test('navigation after read, pending journal write and remote create stops all later operations', async () => {
    for (const phase of ['read', 'pending', 'create']) {
      const h = harness(); let current = true; let progress = 0; let eventsAtExit;
      if (phase === 'read') {
        const original = h.adminService.categories.list;
        h.adminService.categories.list = async () => { const value = await original(); current = false; eventsAtExit = h.events.length; return value; };
      } else if (phase === 'pending') {
        const original = h.store.write;
        h.store.write = async (value) => { await original(value); if (value.pending) { current = false; eventsAtExit = h.events.length; } };
      } else {
        const original = h.repositories.categories.create;
        h.repositories.categories.create = async (input) => { const value = await original(input); current = false; eventsAtExit = h.events.length; return value; };
      }
      const result = await h.makeService().install({ confirm: true, isCurrent: () => current, onProgress: () => { progress += 1; } });
      assert.equal(result.reason, 'abandoned'); assert.equal(h.events.length, eventsAtExit);
      assert.equal(progress, phase === 'read' ? 0 : 1);
      assert.equal(creates(h).length, phase === 'create' ? 1 : 0);
      if (phase !== 'read') {
        assert.equal(h.journal.pending.key, 'root');
        assert.equal((await h.makeService().inspect()).reason, 'pending-uncertain');
      }
    }
  });

  await test('durable completed receipt plus navigation resumes only the uncreated suffix', async () => {
    const h = harness(); let current = true;
    const service = h.makeService();
    const first = await service.install({ confirm: true, isCurrent: () => current, onProgress: (event) => { if (event.phase === 'created' && event.completed === 3) current = false; } });
    assert.equal(first.reason, 'abandoned'); assert.equal(h.journal.receipts.length, 3); assert.equal(h.journal.pending, null);
    const snapshot = [...h.repositories.categories.rows.values()].map(clone);
    const check = await h.makeService().inspect();
    assert.equal(check.status, 'partial'); assert.equal(check.canResume, true); assert.equal(check.summary.completed, 3);
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    assert.equal(creates(h).length, 11);
    assert.deepEqual([...h.repositories.categories.rows.values()].map(clone), snapshot);
  });

  await test('receipt ETag change, missing row and unmanaged data block safe resume', async () => {
    for (const mutation of [
      (h) => { [...h.repositories.categories.rows.values()][0].etag = '"changed"'; },
      (h) => { [...h.repositories.categories.rows.values()][0].description = 'changed without ETag'; },
      (h) => { h.repositories.categories.rows.delete(h.journal.receipts[0].id); },
      (h) => { h.repositories.articles.rows.set(1, { id: 1, title: 'Other', alias: 'other', etag: '"foreign"' }); }
    ]) {
      const h = harness(); let current = true;
      await h.makeService().install({ confirm: true, isCurrent: () => current, onProgress: (event) => { if (event.phase === 'created' && event.completed === 2) current = false; } });
      mutation(h); const before = creates(h).length;
      assert.equal((await h.makeService().inspect()).status, 'blocked');
      assert.equal((await h.makeService().install({ confirm: true })).status, 'blocked');
      assert.equal(creates(h).length, before);
    }
  });

  await test('stable package signature accepts key ordering, rejects changed source/content', async () => {
    const h = harness(); let current = true;
    await h.makeService().install({ confirm: true, isCurrent: () => current, onProgress: (event) => { if (event.phase === 'created' && event.completed === 1) current = false; } });
    const reorder = (value) => Array.isArray(value) ? value.map(reorder) : value !== null && typeof value === 'object' ? Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reorder(value[key])])) : value;
    assert.equal((await h.makeService({ loadPackage: () => reorder(h.data) }).inspect()).status, 'partial');
    const changed = clone(h.data); changed.domains.articles[0].values.introtext = 'new seed';
    assert.equal((await h.makeService({ loadPackage: () => changed }).install({ confirm: true })).reason, 'package-changed');
    assert.equal(creates(h).length, 1);
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
  });

  await test('remote create exception retains intent; absent or uniquely matching row is never retried/adopted', async () => {
    for (const didCreate of [false, true]) {
      const h = harness(); const original = h.repositories.categories.create;
      h.repositories.categories.create = async (input) => { if (didCreate) await original(input); throw new Error('response lost'); };
      const result = await h.makeService().install({ confirm: true });
      assert.equal(result.status, 'partial'); assert.equal(result.uncertain, true);
      assert.equal(h.journal.pending.key, 'root'); assert.equal(h.journal.receipts.length, 0);
      const before = h.events.length;
      const inspected = await h.makeService().inspect();
      assert.equal(inspected.reason, 'pending-uncertain');
      assert.equal(h.events.slice(before).some((event) => event.kind === 'journal-write' || event.kind === 'create'), false);
      assert.equal((await h.makeService().install({ confirm: true })).reason, 'pending-uncertain');
      assert.equal(totalRows(h), didCreate ? 1 : 0);
    }
  });

  await test('receipt journal failure after successful create returns uncertain partial and never retries', async () => {
    for (const saveThenThrow of [false, true]) {
      const h = harness(); const original = h.store.write;
      h.store.write = async (value) => {
        if (value.receipts.length === 1) { if (saveThenThrow) await original(value); throw new Error('disk full or acknowledgement lost'); }
        await original(value);
      };
      const first = await h.makeService().install({ confirm: true });
      assert.equal(first.reason, 'receipt-write-failed'); assert.equal(first.status, 'partial'); assert.equal(first.uncertain, true);
      assert.equal(totalRows(h), 1);
      h.store.write = original;
      if (saveThenThrow) {
        assert.equal((await h.makeService().inspect()).status, 'partial');
        assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
        assert.equal(creates(h).length, 11);
      } else {
        assert.equal(h.journal.pending.key, 'root');
        assert.equal((await h.makeService().install({ confirm: true })).reason, 'pending-uncertain');
        assert.equal(creates(h).length, 1);
      }
    }
  });

  await test('initial and pending journal failures cannot start remote create', async () => {
    for (const phase of ['initial', 'pending']) {
      const h = harness(); const original = h.store.write;
      h.store.write = async (value) => { if (phase === 'initial' || value.pending) throw new Error('storage'); await original(value); };
      assert.equal((await h.makeService().install({ confirm: true })).status, 'partial');
      assert.equal(creates(h).length, 0);
      h.store.write = original;
      assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    }
  });

  await test('invalid persisted JSON and non-data journal blocked without evaluating getters', async () => {
    const h = harness(); let executed = 0;
    h.store.read = () => Object.defineProperty({}, 'packageId', { enumerable: true, get() { executed += 1; return 'joomla-blog'; } });
    assert.equal((await h.makeService().install({ confirm: true })).reason, 'invalid-journal');
    assert.equal(executed, 0); assert.equal(creates(h).length, 0); assert.equal(writes(h).length, 0);
  });

  await test('missing/non-enumerable create ETag is explicitly recovered by get for the receipt', async () => {
    const h = harness(); const original = h.repositories.articles.create;
    h.repositories.articles.create = async (input) => ({ ...await original(input) });
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    for (const receipt of h.journal.receipts.filter((entry) => entry.domain === 'articles')) assert.ok(receipt.etag);
    const configCreate = h.events.findIndex((event) => event.kind === 'create' && event.domain === 'siteConfig');
    const configGet = h.events.findIndex((event, index) => index > configCreate && event.kind === 'get' && event.domain === 'siteConfig');
    const configReceipt = h.events.findIndex((event, index) => index > configCreate && event.kind === 'journal-write' && event.value.pending === null);
    assert.ok(configGet > configCreate && configGet < configReceipt);
  });

  await test('domain insertion during target recheck blocks before any remote or journal write', async () => {
    const h = harness(); let calls = 0; const original = h.adminService.categories.list;
    h.adminService.categories.list = async () => {
      calls += 1;
      if (calls === 2) h.repositories.categories.rows.set(1, { id: 1, title: 'Racing content', alias: 'other', etag: '"other"' });
      return original();
    };
    const first = await h.makeService().install({ confirm: true });
    assert.equal(first.reason, 'content-changed'); assert.equal(creates(h).length, 0);
    assert.equal(writes(h).length, 1); assert.equal(h.journal.pending, null);
    assert.equal((await h.makeService().inspect()).reason, 'unmanaged-data');
  });

  await test('observer exceptions never mask completed writes', async () => {
    const h = harness();
    assert.equal((await h.makeService().install({ confirm: true, onProgress() { throw new Error('UI observer'); } })).status, 'installed');
    assert.equal(creates(h).length, 11);
  });

  await test('navigation while journal/read is waiting cannot start subsequent calls', async () => {
    for (const phase of ['journal-read', 'journal-write', 'admin-read']) {
      const h = harness(); const waiting = deferred(); const entered = deferred(); let current = true;
      if (phase === 'journal-read') h.store.read = async () => { entered.resolve(); await waiting.promise; return null; };
      if (phase === 'journal-write') {
        const original = h.store.write;
        h.store.write = async (value) => { await original(value); entered.resolve(); await waiting.promise; };
      }
      if (phase === 'admin-read') {
        const original = h.adminService.categories.list;
        h.adminService.categories.list = async () => { const value = await original(); entered.resolve(); await waiting.promise; return value; };
      }
      let progress = 0;
      const running = h.makeService().install({ confirm: true, isCurrent: () => current, onProgress: () => { progress += 1; } });
      await entered.promise;
      current = false; const before = h.events.length; waiting.resolve();
      assert.equal((await running).reason, 'abandoned'); assert.equal(h.events.length, before);
      assert.equal(creates(h).length, 0); assert.equal(progress, 0);
    }
  });

  await test('latest-screen guard is rechecked between every operation and before observer calls', async () => {
    const h = harness(); let last = h.events.length; let allowed = 0;
    const result = await h.makeService().install({ confirm: true, isCurrent: () => {
      if (h.events.length !== last) { allowed += 1; last = h.events.length; }
      return allowed < 5;
    } });
    assert.equal(result.reason, 'abandoned'); assert.equal(h.events.length, 5);
    assert.equal(creates(h).length, 0); assert.equal(writes(h).length, 0);
  });

  await test('read errors or malformed list response cannot be treated as empty domains', async () => {
    for (const response of [null, {}, '[]']) {
      const h = harness(); h.adminService.templates.list = async () => response;
      assert.equal((await h.makeService().install({ confirm: true })).status, 'unavailable');
      assert.equal(creates(h).length, 0); assert.equal(writes(h).length, 0);
    }
    const h = harness(); h.adminService.extensions.list = async () => { throw new Error('disabled source'); };
    assert.equal((await h.makeService().install({ confirm: true })).reason, 'read-failed');
    assert.equal(writes(h).length, 0);
  });

  await test('eighty-row packet boundary is accepted without IDs or reference metadata leaking', async () => {
    const data = fixture(); data.domains.articles = Array.from({ length: 71 }, (_, index) => ({ key: `article${index}`, categoryRef: 'child', tagRefs: ['joomla'], values: { title: `Artigo ${index}`, alias: `artigo-${index}`, state: 'Published' } }));
    const h = harness({ data });
    const result = await h.makeService().install({ confirm: true });
    assert.equal(result.status, 'installed', result.message); assert.equal(result.summary.total, 80); assert.equal(totalRows(h), 80);
    assert.equal(h.journal.receipts.length, 80);
  });

  await test('data schema alias, structured input aliases and template styles match admin normalization', async () => {
    const data = fixture(); data.schema = 1; delete data.schemaVersion;
    const module = data.domains.moduleInstances[0].values;
    module.settings = { limit: 3 }; delete module.settingsJson;
    module.assignmentTokens = ['route:home']; delete module.assignmentJson; module.assignment = 'only';
    const extension = data.domains.extensions[0].values; extension.params = extension.paramsJson; delete extension.paramsJson;
    const styles = [{ id: 'cassiopeia-blog', title: 'Blog', template: 'cassiopeia', home: true, params: {} }];
    data.domains.siteConfig[0].values.templateStylesJson = styles;
    const h = harness({ data });
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    h.journal = null;
    assert.equal((await h.makeService().inspect()).status, 'installed');
  });

  await test('malformed receipt order, wildcard ETag and package mismatch journal are never replayed', async () => {
    const h = harness(); await h.makeService().install({ confirm: true }); const valid = h.journal;
    const mutations = [
      (journal) => { journal.receipts.reverse(); },
      (journal) => { journal.receipts[0].etag = '*'; },
      (journal) => { journal.receipts[0].id = 0; },
      (journal) => { journal.packageId = 'other'; },
      (journal) => { journal.signature = 'wrong'; },
      (journal) => { delete journal.pending; }
    ];
    const before = { creates: creates(h).length, writes: writes(h).length };
    for (const mutate of mutations) {
      const journal = clone(valid); mutate(journal); h.journal = journal;
      assert.equal((await h.makeService().inspect()).status, 'blocked');
      assert.equal((await h.makeService().install({ confirm: true })).status, 'blocked');
    }
    assert.deepEqual({ creates: creates(h).length, writes: writes(h).length }, before);
  });

  await test('create without definitive ID/ETag or changed save-get config leaves uncertain intent', async () => {
    for (const phase of ['id', 'etag', 'config']) {
      const h = harness();
      if (phase === 'id') {
        const original = h.repositories.categories.create;
        h.repositories.categories.create = async (input) => { await original(input); return null; };
      } else if (phase === 'etag') {
        const original = h.repositories.categories.findById;
        const create = h.repositories.categories.create;
        h.repositories.categories.create = async (input) => ({ ...await create(input) });
        h.repositories.categories.findById = async (id) => ({ ...await original(id) });
      } else {
        const original = h.adminService.siteConfig.get;
        h.adminService.siteConfig.get = async () => {
          const value = await original();
          if (value) return Object.defineProperty({ ...value }, 'etag', { value: '"concurrent-config"', enumerable: false });
          return value;
        };
      }
      const result = await h.makeService().install({ confirm: true });
      assert.equal(result.reason, 'create-unverified'); assert.equal(result.uncertain, true);
      assert.notEqual(h.journal.pending, null);
      const before = creates(h).length;
      assert.equal((await h.makeService().install({ confirm: true })).reason, 'pending-uncertain');
      assert.equal(creates(h).length, before);
    }
  });

  await test('two service instances share the journal lock, with injected lock or WeakMap fallback', async () => {
    for (const injected of [false, true]) {
      const h = harness(); const entered = deferred(); const waiting = deferred();
      let lockCalls = 0; let active = false; let queue = Promise.resolve();
      if (injected) h.store.withLock = (operation) => {
        lockCalls += 1;
        const next = queue.then(async () => {
          assert.equal(active, false); active = true;
          try { return await operation(); } finally { active = false; }
        });
        queue = next.catch(() => {}); return next;
      };
      const create = h.repositories.categories.create;
      h.repositories.categories.create = async (input) => {
        if (creates(h).length === 0) { entered.resolve(); await waiting.promise; }
        return create(input);
      };
      const first = h.makeService(); const second = h.makeService();
      const firstInstall = first.install({ confirm: true });
      await entered.promise;
      const before = h.events.length;
      const secondInstall = second.install({ confirm: true });
      assert.equal((await second.install({ confirm: true })).reason, 'busy');
      assert.equal((await second.inspect()).reason, 'busy');
      assert.equal(h.events.length, before);
      waiting.resolve();
      const results = await Promise.all([firstInstall, secondInstall]);
      assert.ok(results.every((result) => result.status === 'installed'));
      assert.equal(creates(h).length, 11); assert.equal(totalRows(h), 11);
      assert.equal(writes(h).length, 23); assert.equal(h.journal.receipts.length, 11);
      assert.equal(lockCalls, injected ? 2 : 0);
    }
    const h = harness(); const entered = deferred(); const waiting = deferred();
    h.store.withLock = async (operation) => { entered.resolve(); await waiting.promise; return operation(); };
    let current = true; let progress = 0;
    const running = h.makeService().install({ confirm: true, isCurrent: () => current, onProgress: () => { progress += 1; } });
    await entered.promise; current = false; waiting.resolve();
    assert.equal((await running).reason, 'abandoned');
    assert.equal(h.events.length, 0); assert.equal(progress, 0);
  });

  await test('plugin groups and declarative params reject invalid packages before all writes; Module group stays opaque', async () => {
    for (const change of [
      (values) => { values.manifestJson.group = 'Bad Group'; },
      (values) => { values.folder = 'content'; values.manifestJson.group = 'Bad Group'; },
      (values) => { values.folder = 'Bad Group'; values.manifestJson.group = 'content'; },
      (values) => { values.manifestJson.group = null; },
      (values) => { values.manifestJson.group = 42; },
      (values) => { values.folder = null; },
      (values) => { values.manifestJson.params = [{ name: 'bad', type: 'not-a-type' }]; },
      (values) => { values.manifestJson.params = [{ name: 'limit', type: 'number', max: 50 }]; values.paramsJson = { limit: 1000 }; }
    ]) {
      const data = fixture(); change(data.domains.extensions[0].values); deepFreeze(data);
      const original = JSON.stringify(data); const h = harness({ data });
      assert.equal((await h.makeService().inspect()).reason, 'invalid-package');
      assert.equal((await h.makeService().install({ confirm: true })).status, 'unavailable');
      assert.equal(writes(h).length, 0); assert.equal(creates(h).length, 0);
      assert.equal(JSON.stringify(data), original); assert.equal(h.journal, null);
    }
    const data = fixture(); const values = data.domains.extensions[0].values;
    values.type = 'Module'; values.key = 'custom-module'; values.entryPointUrl = '/modules/custom-module.js';
    values.manifestJson.group = { opaque: 'Module metadata is not a plugin group' };
    const h = harness({ data: deepFreeze(data) });
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
  });

  await test('category/article aliases are unique after trimming, even with distinct envelope keys', async () => {
    for (const domain of ['categories', 'articles']) {
      const data = fixture(); data.domains[domain][1].values.alias = ` ${data.domains[domain][0].values.alias} `;
      deepFreeze(data); const original = JSON.stringify(data); const h = harness({ data });
      assert.equal((await h.makeService().inspect()).reason, 'invalid-package');
      assert.equal((await h.makeService().install({ confirm: true })).status, 'unavailable');
      assert.equal(writes(h).length, 0); assert.equal(creates(h).length, 0); assert.equal(h.journal, null);
      assert.equal(JSON.stringify(data), original);
    }
  });

  await test('component options/core config validate before writes and preserve undeclared existing options', async () => {
    for (const values of [
      { componentParamsJson: null },
      { componentParamsJson: 'null' },
      { componentParamsJson: { search: { resultsLimit: 1000 } } },
      { componentParamsJson: { content: { numColumns: 5 } } },
      { componentParamsJson: { tags: { showTagTitle: true } } },
      { componentParamsJson: { unknown: null } },
      { componentParamsJson: { content: [] } },
      { templateStylesJson: null },
      { pageSize: null },
      { pageSize: 'not a number' },
      { homeView: 'unknown' },
      { homeCategory: 'Bad Category' },
      { basePath: {} }
    ]) {
      const data = fixture(); Object.assign(data.domains.siteConfig[0].values, values); deepFreeze(data);
      const original = JSON.stringify(data); const h = harness({ data });
      assert.equal((await h.makeService().inspect()).reason, 'invalid-package');
      assert.equal((await h.makeService().install({ confirm: true })).status, 'unavailable');
      assert.equal(writes(h).length, 0); assert.equal(creates(h).length, 0); assert.equal(h.journal, null);
      assert.equal(JSON.stringify(data), original);
    }
    const h = harness(); assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    const config = [...h.repositories.siteConfig.rows.values()][0];
    config.componentParamsJson = JSON.stringify({
      content: { showTitle: 1, unknownLegacy: 'keep' }, search: { resultsLimit: 20 },
      tags: { showTagTitle: false }, unknownComponent: { custom: { keep: true } }
    });
    const original = config.componentParamsJson; const before = { writes: writes(h).length, creates: creates(h).length };
    assert.equal((await h.makeService().inspect()).status, 'installed');
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    h.journal = null;
    assert.equal((await h.makeService().inspect()).status, 'installed');
    assert.equal((await h.makeService().install({ confirm: true })).status, 'installed');
    assert.equal(config.componentParamsJson, original);
    assert.deepEqual({ writes: writes(h).length, creates: creates(h).length }, before);
    config.componentParamsJson = '{"content":{"showTitle":true},"search":{"resultsLimit":1000}}';
    assert.equal((await h.makeService().inspect()).status, 'blocked');
  });

  await test('zero-count domains are not partial and disabled initial catalogs are never empty data', async () => {
    const data = fixture();
    data.domains.tags = []; data.domains.articles.forEach((row) => { row.tagRefs = []; });
    data.domains.extensions = []; data.domains.templates = []; data.domains.moduleInstances = []; data.domains.siteConfig = [];
    const h = harness({ data: deepFreeze(data) });
    assert.equal((await h.makeService().inspect()).status, 'ready');
    const installed = await h.makeService().install({ confirm: true });
    assert.equal(installed.status, 'installed'); assert.equal(installed.summary.total, 6);
    assert.equal(installed.summary.counts.siteConfig, 0); assert.equal(installed.summary.counts.tags, 0);
    h.journal = null; assert.equal((await h.makeService().inspect()).status, 'installed');
    for (const domain of ['tags', 'templates', 'siteConfig']) {
      const admin = { ...h.adminService, [domain]: { ...h.adminService[domain], available: false } };
      const before = h.events.length; const service = h.makeService({ adminService: admin });
      assert.equal(service.available, false); assert.equal((await service.inspect()).status, 'unavailable');
      assert.equal((await service.install({ confirm: true })).status, 'unavailable'); assert.equal(h.events.length, before);
    }
  });

  console.log(`sample data service: ${passed} tests passed (local memory repositories, no SPMIDDLE)`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runSampleDataServiceTests().catch((error) => { console.error(error); process.exitCode = 1; });
}
