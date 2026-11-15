import assert from 'node:assert/strict';
import { createApplication } from '../src/index.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { readHomeShowComponent, mergeHomeShowComponent } from '../src/libraries/minijoomla/application/home-settings.js';
import { toSiteConfigOverrides } from '../src/libraries/minijoomla/application/site-config-overrides.js';
import { createConfig } from '../src/libraries/minijoomla/core/config.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';

// Match admin-service.test.js: list reads omit ETags and MERGE returns null.
// Record write attempts as well as snapshots so validation cannot be masked
// by a repository refusing an invalid patch after the service has sent it.
function createMemoryRepository(seed = []) {
  const items = new Map(seed.map((row) => [row.id, { ...row }]));
  const writes = [];
  let nextId = Math.max(0, ...seed.map((row) => row.id)) + 1;
  let version = 2;
  return {
    writes,
    async findMany() {
      return { items: [...items.values()].map(({ etag, ...row }) => ({ ...row })) };
    },
    async findById(id) { return items.has(id) ? { ...items.get(id) } : null; },
    async create(input) {
      writes.push({ operation: 'create', input: { ...input } });
      const row = { ...input, id: nextId++, etag: `"${version++}"` };
      items.set(row.id, row);
      return { ...row };
    },
    async update(id, input, { etag } = {}) {
      writes.push({ operation: 'update', id, input: { ...input }, etag });
      const row = items.get(id);
      if (!row || row.etag !== etag) {
        throw Object.assign(new Error('etag mismatch'), { code: 'concurrency-conflict', status: 412 });
      }
      items.set(id, { ...row, ...input, etag: `"${version++}"` });
      return null;
    }
  };
}

const EXACT_PARAMS = '  {"content":{"showTitle":false,"listLimit":"7"},"search":{"resultsLimit":3},"tags":{"showTagTitle":false},"unknown":{"values":[null,false,42,"",{"constructor":{"prototype":{"keep":true}}}]},"__proto__":{"keep":[1,false]},"toJSON":"data","home":{"showComponent":true,"unknown":{"items":[1,null,false]},"__proto__":{"showComponent":false}}}\n';

function configSeed(componentParamsJson = EXACT_PARAMS) {
  return {
    id: 1, etag: '"1"', title: 'MiniJoomlaSiteConfig', siteName: 'Preserved site',
    templateKey: 'cassiopeia', siteDescription: 'Preserved description',
    language: 'pt-BR', timezone: 'America/Sao_Paulo', pageSize: 7, basePath: '/portal',
    homeView: 'category', homeCategory: 'noticias', offline: false,
    offlineMessage: 'Preserved offline message', customHtmlTitle: 'Preserved title',
    customHtmlBody: '<p>Preserved HTML</p>', metaDescription: 'Preserved SEO',
    metaKeywords: 'one, two', robots: 'noindex, follow', sitenamePagetitles: 'after',
    templateStylesJson: ' {"cassiopeia-default":{"templateKey":"cassiopeia","params":{"siteTitle":"Preserved brand"}}} ',
    unknownColumn: 'untouched', componentParamsJson
  };
}

function assertOnlyHomeChanged(beforeJson, afterJson, expected) {
  const before = JSON.parse(beforeJson);
  const after = JSON.parse(afterJson);
  before.home.showComponent = expected;
  assert.deepEqual(after, before, 'only home.showComponent may change in the JSON envelope');
  assert.ok(Object.hasOwn(after, '__proto__'), 'reserved unknown names remain own data');
  assert.ok(Object.hasOwn(after.home, '__proto__'), 'reserved names in the home subtree remain own data');
  assert.equal(Object.getPrototypeOf(after), Object.prototype);
  assert.equal(Object.getPrototypeOf(after.home), Object.prototype);
  assert.equal({}.keep, undefined, 'merging must not pollute Object.prototype');
  assert.equal({}.showComponent, undefined);
}

function runHelperTests() {
  assert.equal(createConfig().homeShowComponent, true);
  for (const value of [undefined, null]) assert.equal(createConfig({ homeShowComponent: value }).homeShowComponent, true);
  for (const value of [false, true]) assert.equal(createConfig({ homeShowComponent: value }).homeShowComponent, value);
  for (const value of ['false', 'true', '', 0, 1, [], {}, new Boolean(false)]) {
    assert.throws(() => createConfig({ homeShowComponent: value }), TypeError, 'inline configuration accepts booleans, never truthiness coercion');
  }

  for (const value of [undefined, null, '', '{}', ' {"content":{"showTitle":false}}\n', '{"home":{}}']) {
    assert.equal(readHomeShowComponent(value), true);
    const shown = mergeHomeShowComponent(value, true);
    if (value === '{"home":{}}') assert.equal(shown, value, 'a declared default home already overrides inline config');
    else assert.deepEqual(JSON.parse(shown), { ...(value ? JSON.parse(value) : {}), home: { showComponent: true } }, 'saving Sim explicitly overrides inline Não even for a legacy envelope');
    const changed = mergeHomeShowComponent(value, false);
    const expected = value ? JSON.parse(value) : {};
    expected.home = { ...(expected.home ?? {}), showComponent: false };
    assert.deepEqual(JSON.parse(changed), expected);
    assert.equal(readHomeShowComponent(changed), false);
  }
  for (const value of [false, true]) {
    const exact = ` \n{"home":{"showComponent":${value},"unknown":[null,false]}}\t`;
    assert.equal(readHomeShowComponent(exact), value);
    assert.equal(mergeHomeShowComponent(exact, value), exact, 'unchanged explicit settings preserve whitespace and unknown data exactly');
  }
  assert.equal(readHomeShowComponent({ home: { showComponent: false } }), false);
  assert.equal(readHomeShowComponent(Object.assign(Object.create(null), { home: { showComponent: true } })), true);
  assert.equal(readHomeShowComponent('{"__proto__":{"home":{"showComponent":false}}}'), true, 'only an own home namespace configures the setting');
  assert.equal(readHomeShowComponent('{"home":{"__proto__":{"showComponent":false}}}'), true, 'only an own showComponent configures the setting');
  assert.equal(mergeHomeShowComponent(EXACT_PARAMS, true), EXACT_PARAMS);
  const hidden = mergeHomeShowComponent(EXACT_PARAMS, false);
  assertOnlyHomeChanged(EXACT_PARAMS, hidden, false);
  const shown = mergeHomeShowComponent(hidden, true);
  assertOnlyHomeChanged(hidden, shown, true);

  const invalidJson = [
    '{broken', ' ', '[]', 'null', '42', 'true', '"text"', false, 1, [],
    '{"home":null}', '{"home":[]}', '{"home":false}', '{"home":"data"}',
    '{"home":{"showComponent":null}}', '{"home":{"showComponent":"false"}}',
    '{"home":{"showComponent":"true"}}', '{"home":{"showComponent":0}}',
    '{"home":{"showComponent":1}}', '{"home":{"showComponent":[]}}',
    '{"home":{"showComponent":{}}}', '{"unknown":1e400}',
    { home: { showComponent: undefined } }, { home: undefined }
  ];
  for (const value of invalidJson) {
    assert.throws(() => readHomeShowComponent(value), ValidationError);
    for (const next of [false, true]) assert.throws(() => mergeHomeShowComponent(value, next), ValidationError, 'even a nominal no-op must validate persisted JSON first');
  }
  for (const next of [undefined, null, 'false', 'true', '', 0, 1, {}, [], new Boolean(false)]) {
    assert.throws(() => mergeHomeShowComponent('{}', next), ValidationError, 'the merge patch must be a literal boolean');
  }

  let executions = 0;
  const getter = Object.defineProperty({}, 'showComponent', { enumerable: true, get() { executions += 1; return false; } });
  const namespaceGetter = Object.defineProperty({}, 'home', { enumerable: true, get() { executions += 1; return {}; } });
  const hookGetter = Object.defineProperty({}, 'toJSON', { enumerable: true, get() { executions += 1; return () => ({}); } });
  const hook = { toJSON() { executions += 1; return {}; } };
  const cycle = {}; cycle.self = cycle;
  for (const value of [namespaceGetter, { home: getter }, hookGetter, hook, { unknown: hook }, { unknown: getter }, cycle, { unknown: new Date(0) }, Object.create({ home: { showComponent: false } })]) {
    assert.throws(() => readHomeShowComponent(value), ValidationError);
    assert.throws(() => mergeHomeShowComponent(value, true), ValidationError);
    assert.throws(() => mergeHomeShowComponent(value, false), ValidationError);
    assert.equal(executions, 0, 'the shared strict parser must reject accessors/hooks without executing them');
  }
  console.log('ok - home settings: strict boolean defaults, exact no-op JSON, unknown own data and execution-free parsing');
}

function runOverrideTests() {
  assert.deepEqual(toSiteConfigOverrides(null), {});
  for (const record of [{}, { componentParamsJson: undefined }, { componentParamsJson: null }, { componentParamsJson: '' }, { componentParamsJson: '{}' }, { componentParamsJson: '{"content":{"showTitle":false}}' }, { componentParamsJson: '{"__proto__":{"home":{"showComponent":true}}}' }]) {
    const overrides = toSiteConfigOverrides(record);
    assert.equal(Object.hasOwn(overrides, 'homeShowComponent'), false, 'an absent namespace must not erase inline homeShowComponent');
    assert.equal(createConfig({ homeShowComponent: false, ...overrides }).homeShowComponent, false);
  }
  for (const [componentParamsJson, expected] of [['{"home":{}}', true], ['{"home":{"showComponent":true}}', true], ['{"home":{"showComponent":false}}', false]]) {
    const record = { componentParamsJson };
    assert.equal(toSiteConfigOverrides(record).homeShowComponent, expected);
    assert.equal(createConfig({ homeShowComponent: !expected, ...toSiteConfigOverrides(record) }).homeShowComponent, expected);
    assert.equal(createAdminService({}).siteConfig.toConfigOverrides(record).homeShowComponent, expected);
  }
  assert.equal(Object.hasOwn(toSiteConfigOverrides({ componentParamsJson: '{broken' }), 'homeShowComponent'), false, 'unreadable legacy JSON retains safe runtime defaults');
  for (const componentParamsJson of ['{"home":null}', '{"home":[]}', '{"home":{"showComponent":"false"}}', '{"home":{"showComponent":null}}']) {
    assert.throws(() => toSiteConfigOverrides({ componentParamsJson }), ValidationError);
  }
  console.log('ok - home settings: persisted namespace overrides inline config only when declared');
}

async function runAdminTests() {
  const repository = createMemoryRepository([configSeed()]);
  const admin = createAdminService({ siteConfig: repository });
  const initial = await admin.siteConfig.get();
  assert.equal(initial.etag, '"1"', 'get must fetch the ETag missing from list results');
  await admin.siteConfig.save({ homeShowComponent: false }, { etag: initial.etag });
  const hidden = await admin.siteConfig.get();
  assert.notEqual(hidden.etag, initial.etag);
  assert.equal(readHomeShowComponent(hidden.componentParamsJson), false);
  assertOnlyHomeChanged(initial.componentParamsJson, hidden.componentParamsJson, false);
  assert.deepEqual(hidden, { ...initial, componentParamsJson: hidden.componentParamsJson, etag: hidden.etag }, 'unrelated columns, HTML, SEO and template metadata are preserved');
  const patch = repository.writes.at(-1);
  assert.deepEqual(Object.keys(patch.input).filter((key) => key !== 'title'), ['componentParamsJson'], 'the virtual setting writes only ComponentParamsJson, never a schema column');
  assert.equal(patch.etag, initial.etag);
  assert.equal(Object.hasOwn(hidden, 'homeShowComponent'), false);

  await assert.rejects(() => admin.siteConfig.save({ homeShowComponent: true }, { etag: initial.etag }), { code: 'concurrency-conflict' });
  assert.deepEqual(await admin.siteConfig.get(), hidden, 'a stale ETag cannot overwrite the setting or advance its ETag');
  for (const etag of [undefined, null, '', ' ', '*', ' * ']) {
    const writeCount = repository.writes.length;
    await assert.rejects(() => admin.siteConfig.save({ homeShowComponent: true }, { etag }), ValidationError);
    assert.equal(repository.writes.length, writeCount, 'updates require an exact, non-wildcard ETag before writing');
    assert.deepEqual(await admin.siteConfig.get(), hidden);
  }
  await admin.siteConfig.save({ homeShowComponent: true }, { etag: hidden.etag });
  const shown = await admin.siteConfig.get();
  assert.notEqual(shown.etag, hidden.etag);
  assertOnlyHomeChanged(hidden.componentParamsJson, shown.componentParamsJson, true);
  assert.deepEqual(shown, { ...initial, componentParamsJson: shown.componentParamsJson, etag: shown.etag });
  await assert.rejects(() => admin.siteConfig.save({ homeShowComponent: false }, { etag: hidden.etag }), { code: 'concurrency-conflict' });
  assert.deepEqual(await admin.siteConfig.get(), shown);

  // Seed noncanonical JSON directly, avoiding historical explicit-JSON save
  // canonicalization. An unrelated edit or unchanged virtual value must retain it.
  const exactRepository = createMemoryRepository([configSeed()]);
  const exactAdmin = createAdminService({ siteConfig: exactRepository });
  await exactAdmin.siteConfig.save({ siteName: 'Edited site' }, { etag: '"1"' });
  const edited = await exactAdmin.siteConfig.get();
  assert.equal(edited.componentParamsJson, EXACT_PARAMS);
  assert.equal(Object.hasOwn(exactRepository.writes.at(-1).input, 'componentParamsJson'), false, 'unrelated edits do not resend or reserialize the JSON field');
  await exactAdmin.siteConfig.save({ homeShowComponent: true }, { etag: edited.etag });
  assert.equal((await exactAdmin.siteConfig.get()).componentParamsJson, EXACT_PARAMS);

  const emptyRepository = createMemoryRepository();
  const emptyAdmin = createAdminService({ siteConfig: emptyRepository });
  await emptyAdmin.siteConfig.save({ siteName: 'New site', homeShowComponent: false });
  const created = await emptyAdmin.siteConfig.get();
  assert.deepEqual(JSON.parse(created.componentParamsJson), { home: { showComponent: false } });
  assert.equal(Object.hasOwn(created, 'homeShowComponent'), false);
  await emptyAdmin.siteConfig.save({ homeShowComponent: true }, { etag: created.etag });
  assert.equal(readHomeShowComponent((await emptyAdmin.siteConfig.get()).componentParamsJson), true);
  console.log('ok - home settings: admin false/true roundtrip patches JSON only, preserves SEO/unknown data and requires fresh ETags');
}

async function runInvalidAdminTests() {
  const repository = createMemoryRepository([configSeed()]);
  const admin = createAdminService({ siteConfig: repository });
  const before = await admin.siteConfig.get();
  for (const homeShowComponent of [null, 'false', 'true', '', 0, 1, [], {}, new Boolean(false)]) {
    await assert.rejects(() => admin.siteConfig.save({ homeShowComponent }, { etag: before.etag }), ValidationError);
    assert.deepEqual(await admin.siteConfig.get(), before);
    assert.equal(repository.writes.length, 0);
    const emptyRepository = createMemoryRepository();
    await assert.rejects(() => createAdminService({ siteConfig: emptyRepository }).siteConfig.save({ homeShowComponent }), ValidationError);
    assert.equal(emptyRepository.writes.length, 0, 'invalid initial values cannot create a row');
    assert.deepEqual((await emptyRepository.findMany()).items, []);
  }
  let executions = 0;
  const getter = Object.defineProperty({}, 'showComponent', { enumerable: true, get() { executions += 1; return false; } });
  const hook = { toJSON() { executions += 1; return {}; } };
  for (const componentParamsJson of ['{broken', '[]', 'null', '{"home":null}', '{"home":[]}', '{"home":{"showComponent":"false"}}', '{"home":{"showComponent":null}}', { home: getter }, { unknown: hook }]) {
    await assert.rejects(() => admin.siteConfig.save({ componentParamsJson }, { etag: before.etag }), ValidationError);
    assert.equal(repository.writes.length, 0, 'new invalid JSON/home settings are rejected before mutation');
    assert.deepEqual(await admin.siteConfig.get(), before);
    assert.equal(executions, 0);
  }
  for (const componentParamsJson of ['{broken', '[]', 'null', '{"home":null}', '{"home":[]}', '{"home":{"showComponent":"false"}}', '{"home":{"showComponent":null}}']) {
    const corruptRepository = createMemoryRepository([configSeed(componentParamsJson)]);
    const corruptAdmin = createAdminService({ siteConfig: corruptRepository });
    const corruptBefore = await corruptAdmin.siteConfig.get();
    for (const input of [{ homeShowComponent: false }, { homeShowComponent: true }, { siteName: 'Unrelated edit' }]) {
      await assert.rejects(() => corruptAdmin.siteConfig.save(input, { etag: corruptBefore.etag }), ValidationError);
      assert.equal(corruptRepository.writes.length, 0, 'corrupt persisted settings cannot be silently replaced or bypassed by unrelated edits');
      assert.deepEqual(await corruptAdmin.siteConfig.get(), corruptBefore);
    }
  }
  console.log('ok - home settings: invalid persisted/new values fail before repository mutations');
}

async function runIntegrationTests() {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const repositories = createDemoRepositories({ storage });
  const admin = createAdminService(repositories);
  // Same shared-repository composition as site-runtime.test.js, without
  // navigation/render assertions (owned by the separate runtime tests).
  async function publicConfig(inline = {}) {
    const reopened = createDemoRepositories({ storage });
    const record = await createAdminService(reopened).siteConfig.get();
    const app = createApplication({
      autoStart: false, config: { ...inline, ...toSiteConfigOverrides(record) },
      adapter: createSPMiddleAdapter({ articleRepository: reopened.articles, categoryRepository: reopened.categories, tagRepository: reopened.tags, menuRepository: reopened.menu }),
      getModuleInstances: async () => (await reopened.moduleInstances.findMany()).items,
      getExtensions: async () => (await reopened.extensions.findMany()).items,
      getTemplate: async () => (await reopened.templates.findMany()).items
    });
    try { return app.config; } finally { app.stop(); }
  }
  assert.equal((await publicConfig()).homeShowComponent, true);
  assert.equal((await publicConfig({ homeShowComponent: false })).homeShowComponent, false, 'legacy rows without home preserve inline settings');
  const legacy = await admin.siteConfig.get();
  await admin.siteConfig.save({ homeShowComponent: true }, { etag: legacy.etag });
  assert.equal((await publicConfig({ homeShowComponent: false })).homeShowComponent, true, 'saving explicit Sim overrides inline Não from a previously unconfigured row');
  const initial = await admin.siteConfig.get();
  await admin.siteConfig.save({ homeShowComponent: false }, { etag: initial.etag });
  assert.equal((await publicConfig({ homeShowComponent: true })).homeShowComponent, false, 'a fresh public composition consumes the admin write from reopened storage');
  const hidden = await admin.siteConfig.get();
  await assert.rejects(() => admin.siteConfig.save({ homeShowComponent: true }, { etag: initial.etag }), { code: 'concurrency-conflict' });
  assert.equal((await publicConfig()).homeShowComponent, false);
  await admin.siteConfig.save({ homeShowComponent: true }, { etag: hidden.etag });
  assert.equal((await publicConfig({ homeShowComponent: false })).homeShowComponent, true);
  assert.equal(Object.hasOwn(await admin.siteConfig.get(), 'homeShowComponent'), false);
  console.log('ok - home settings: shared demo repositories propagate admin writes into fresh public config without a new column');
}

export async function runHomeComponentSettingsTests() {
  runHelperTests();
  runOverrideTests();
  await runAdminTests();
  await runInvalidAdminTests();
  await runIntegrationTests();
}
