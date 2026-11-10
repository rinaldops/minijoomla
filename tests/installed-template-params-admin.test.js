import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createTemplateDiscoveryService } from '../src/libraries/minijoomla/application/extension-discovery-service.js';
import { parseExtensionManifest } from '../src/libraries/minijoomla/application/extension-manifest.js';
import { readTemplateMetadata, packTemplateMetadata } from '../src/libraries/minijoomla/application/template-metadata.js';
import { templateParamDefinitions } from '../src/libraries/minijoomla/application/template-styles.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { createExtensionPages } from '../src/administrator/components/com_minijoomla/extension-pages.js';
import { loadTemplateDiscoveryPage } from '../src/administrator/components/com_templates/src/Controller/discover.js';

// Core-only persistence: list omits ETags and successful MERGE returns null.
function memoryRepository(seed = []) {
  const rows = new Map(seed.map((row) => [row.id, { etag: '"seed"', ...row }]));
  let version = 1;
  const repository = {
    rows, attempts: [], reads: [], lastPatch: null,
    async findMany(query, options) {
      repository.reads.push({ query, options });
      return { items: [...rows.values()].map(({ etag: _etag, ...row }) => ({ ...row })), hasNextPage: false };
    },
    async findById(id) { const row = rows.get(Number(id)); return row ? { ...row } : null; },
    async create(input) {
      repository.attempts.push({ operation: 'create', input: { ...input } });
      const row = { ...input, id: Math.max(0, ...rows.keys()) + 1, etag: `"v${version++}"` };
      rows.set(row.id, row);
      return { ...row };
    },
    async update(id, input, { etag } = {}) {
      repository.attempts.push({ operation: 'update', id, input: { ...input }, etag });
      const row = rows.get(Number(id));
      if (!row || row.etag !== etag) throw Object.assign(new Error('ETag mismatch'), { code: 'concurrency-conflict' });
      repository.lastPatch = { ...input };
      rows.set(row.id, { ...row, ...input, etag: `"v${version++}"` });
      return null;
    }
  };
  return repository;
}

const definitions = [
  { name: 'caption', type: 'text', label: 'Caption', default: 'Initial caption' },
  { name: 'count', type: 'number', label: 'Count', min: 1, max: 10, default: 2 },
  { name: 'enabledPanel', type: 'checkbox', label: 'Panel', default: true },
  { name: 'mode', type: 'select', label: 'Mode', options: ['wide', 'compact'], default: 'wide' },
  { name: 'palette', type: 'color', label: 'Palette', default: '#abcdef' },
  { name: 'items', type: 'json', valueType: 'array', label: 'Items', default: [] }
];
const manifest = (overrides = {}) => ({
  type: 'Template', key: 'declared-template', title: 'Declared template', version: '1.0.0',
  entryPointUrl: '/templates/never-import-this/index.js', styles: ['./declared.css', '/media/declared.css'],
  positions: ['footer', 'declared-hero', 'component'], paramDefinitions: definitions, ...overrides
});
const fixture = (initialSiteConfig) => {
  const repositories = Object.fromEntries(['templates', 'extensions', 'moduleInstances', 'siteConfig'].map((domain) => [domain, memoryRepository()]));
  return { repositories, admin: createAdminService(repositories, { initialSiteConfig }) };
};
const snapshot = (repositories) => structuredClone(Object.fromEntries(Object.entries(repositories).map(([domain, repository]) => [domain, [...repository.rows.entries()]])));
const attempts = (repositories) => Object.values(repositories).reduce((total, repository) => total + repository.attempts.length, 0);
const invalidData = (error) => error instanceof ValidationError || error instanceof TypeError;

async function rejectsWithoutWrites(repositories, operation, message, predicate = invalidData) {
  const before = snapshot(repositories);
  const beforeAttempts = attempts(repositories);
  await assert.rejects(operation, predicate, message);
  assert.deepEqual(snapshot(repositories), before, message);
  assert.equal(attempts(repositories), beforeAttempts, `${message}: no write invoked`);
}

async function installerAndEnvelopeTests() {
  const { repositories, admin } = fixture({ templateKey: 'cassiopeia', siteName: 'Initial site' });
  const defaults = structuredClone(admin.siteConfig.defaults);
  const preview = admin.installer.preview(JSON.stringify(manifest()));
  assert.deepEqual(preview.paramDefinitions.map((definition) => definition.name), definitions.map((definition) => definition.name));
  const installed = await admin.installer.install(JSON.stringify(manifest()));
  assert.equal(installed.enabled, false, 'manual installer never activates or selects a template');
  assert.equal(Object.hasOwn(installed, 'paramDefinitions'), false);
  assert.equal(Object.hasOwn(installed, 'paramDefinitionsJson'), false, 'no physical parameter definitions column');
  const metadata = readTemplateMetadata(installed);
  assert.equal(metadata.metadataPresent, true);
  assert.deepEqual(metadata.styles, manifest().styles);
  assert.deepEqual(metadata.definitions, preview.paramDefinitions);
  assert.equal(JSON.parse(installed.styles).format, 'minijoomla-template-metadata-v1');
  assert.deepEqual(JSON.parse(installed.positionsJson), manifest().positions);
  assert.equal(await admin.siteConfig.get(), null);
  const before = snapshot(repositories);
  const listed = await admin.templateStyles.list();
  assert.equal(listed.templateKey, 'cassiopeia');
  assert.deepEqual(listed.catalog.find((entry) => entry.key === installed.key).definitions, metadata.definitions);
  assert.equal(listed.styles.some((entry) => entry.template === installed.key), false, 'disabled templates do not acquire virtual styles');
  assert.deepEqual(snapshot(repositories), before);
  assert.deepEqual(admin.siteConfig.defaults, defaults);

  const row = repositories.templates.rows.get(installed.id);
  const capsule = { ...JSON.parse(row.styles), futureMetadata: { revision: 7, data: [false, null, 'kept'] } };
  row.styles = `  ${JSON.stringify(capsule, null, 2)}\n`;
  const originalBytes = row.styles;
  await admin.templates.update(installed.id, { title: 'Renamed' }, { etag: row.etag });
  assert.deepEqual(repositories.templates.lastPatch, { title: 'Renamed' });
  assert.equal(repositories.templates.rows.get(installed.id).styles, originalBytes, 'unrelated template edits retain exact metadata bytes');

  let current = await admin.templates.get(installed.id);
  const nextDefinitions = [...definitions, { name: 'subtitle', type: 'text', default: 'New default' }];
  await admin.templates.update(current.id, { paramDefinitionsJson: JSON.stringify(nextDefinitions) }, { etag: current.etag });
  assert.deepEqual(Object.keys(repositories.templates.lastPatch), ['styles']);
  current = await admin.templates.get(installed.id);
  assert.deepEqual(readTemplateMetadata(current).styles, manifest().styles, 'declaration-only patch retains saved CSS');
  assert.deepEqual(JSON.parse(current.styles).futureMetadata, capsule.futureMetadata);
  assert.equal(readTemplateMetadata(current).definitions.at(-1).name, 'subtitle');
  assert.equal(Object.hasOwn(current, 'paramDefinitionsJson'), false);

  await admin.templates.update(current.id, { styles: './replacement.css' }, { etag: current.etag });
  current = await admin.templates.get(installed.id);
  assert.deepEqual(readTemplateMetadata(current).styles, ['./replacement.css']);
  assert.equal(readTemplateMetadata(current).definitions.at(-1).name, 'subtitle');
  assert.deepEqual(JSON.parse(current.styles).futureMetadata, capsule.futureMetadata);
  await admin.templates.update(current.id, { paramDefinitions: [], styles: ['/empty-declarations.css'] }, { etag: current.etag });
  current = await admin.templates.get(installed.id);
  assert.deepEqual(readTemplateMetadata(current).definitions, []);
  assert.deepEqual(JSON.parse(current.styles).futureMetadata, capsule.futureMetadata);

  const packed = ` ${packTemplateMetadata('./already-packed.css', definitions)}\n`;
  const prepacked = await admin.templates.create(manifest({ key: 'prepacked-template', styles: packed, paramDefinitions: undefined }));
  assert.equal(prepacked.styles, packed, 'double normalization validates an existing envelope without nesting or rewriting it');
  assert.deepEqual(readTemplateMetadata(prepacked).styles, ['./already-packed.css']);
  for (const repository of Object.values(repositories)) for (const read of repository.reads) assert.deepEqual(read.options, { maxPages: 100, maxItems: 10000 });
}

async function discoveryTests() {
  const { repositories, admin } = fixture();
  const downloaded = [];
  const payloads = {
    'discovered-template.manifest.json': manifest({ key: undefined, styles: './discovered.css' }),
    'broken-template.manifest.json': manifest({ paramDefinitions: [{ name: 'bad', type: 'callback' }] })
  };
  const discovery = createTemplateDiscoveryService({
    async listFiles(input) { assert.deepEqual(input, { folderPath: 'templates' }); return { value: Object.keys(payloads).map((Name) => ({ Name })) }; },
    async downloadFile(input) { downloaded.push(input.fileName); return { data: JSON.stringify(payloads[input.fileName]) }; }
  });
  const found = await discovery.scan();
  assert.deepEqual(downloaded, Object.keys(payloads), 'scan reads manifests only, never entrypoints or CSS');
  assert.deepEqual(found[0].paramDefinitions, parseExtensionManifest(manifest()).paramDefinitions);
  assert.equal(found[0].styles, './discovered.css', 'single CSS path stays compatible at discovery boundary');
  assert.equal(found[1].type, null);
  assert.match(found[1].error, /tipo não suportado/);
  assert.equal(attempts(repositories), 0);

  let click;
  const button = { dataset: { adminTemplateRegister: 'discovered-template' }, disabled: false, addEventListener(event, handler) { if (event === 'click') click = handler; } };
  const oldConfirm = Object.getOwnPropertyDescriptor(globalThis, 'confirm');
  Object.defineProperty(globalThis, 'confirm', { configurable: true, value: () => true });
  try {
    const page = await loadTemplateDiscoveryPage({
      adminService: admin, discoveryService: { templates: { scan: async () => found } },
      documentRef: { body: { querySelector: () => ({ textContent: '' }), querySelectorAll: () => [button] } },
      router: { link: (path) => path, navigate: async () => {} }, shell: ({ bodyHtml }) => bodyHtml, isCurrent: () => true
    });
    page.bind();
    await click();
    const registered = (await admin.templates.list())[0];
    assert.equal(registered.enabled, true, 'existing registrar explicit confirmation continues enabling only');
    assert.deepEqual(readTemplateMetadata(registered).definitions, found[0].paramDefinitions);
    assert.deepEqual(readTemplateMetadata(registered).styles, ['./discovered.css']);
    assert.equal(await admin.siteConfig.get(), null, 'registration never selects a template');
  } finally {
    if (oldConfirm) Object.defineProperty(globalThis, 'confirm', oldConfirm); else delete globalThis.confirm;
  }
}

async function stylesAndFormTests() {
  const { repositories, admin } = fixture({ templateKey: 'declared-template' });
  const installed = await admin.templates.create(manifest({ enabled: true }));
  const before = snapshot(repositories);
  const virtual = await admin.templateStyles.get('declared-template-default');
  assert.equal(virtual.virtual, true);
  assert.deepEqual(virtual.params, { caption: 'Initial caption', count: 2, enabledPanel: true, mode: 'wide', palette: '#abcdef', items: [] });
  assert.deepEqual(virtual.definitions, readTemplateMetadata(installed).definitions);
  assert.deepEqual(snapshot(repositories), before, 'default parameters never seed SiteConfig during reads');
  assert.equal(await admin.siteConfig.get(), null);

  const savedParams = { caption: 'Saved', count: 7, enabledPanel: false, mode: 'compact', palette: '#123456', items: [{ id: 1 }], futureParam: { enabled: true, nested: [null, 4] } };
  const storedStyles = [
    { id: virtual.id, template: installed.key, title: 'Saved title', home: true, params: savedParams },
    { id: 'orphan-default', template: 'future-template', title: 'Unknown template', home: true, params: { future: [false, 9] } }
  ];
  repositories.siteConfig.rows.set(23, { id: 23, title: 'MiniJoomlaSiteConfig', etag: '"config-seed"', templateKey: installed.key, templateStylesJson: JSON.stringify(storedStyles) });
  for (const params of [{ count: 'bad' }, { count: 11 }, { enabledPanel: 'not-boolean' }, { mode: 'missing-option' }, { palette: 'red' }, { items: '{broken' }, { items: {} }, '{broken', []]) {
    await rejectsWithoutWrites(repositories, () => admin.templateStyles.save(virtual.id, { params }, { etag: '"config-seed"' }), 'invalid submitted style params are rejected before persistence');
  }
  await rejectsWithoutWrites(repositories, () => admin.siteConfig.save({ templateStylesJson: [{ ...storedStyles[0], params: { count: 'bad' } }] }, { etag: '"config-seed"' }), 'direct SiteConfig saves validate installed declarations too');
  await admin.templateStyles.save(virtual.id, { title: 'Title only' }, { etag: '"config-seed"' });
  let config = await admin.siteConfig.get();
  let saved = JSON.parse(config.templateStylesJson).find((style) => style.id === virtual.id);
  assert.deepEqual(saved.params, savedParams, 'title-only style saves preserve typed known and future parameters');
  assert.deepEqual(JSON.parse(config.templateStylesJson).find((style) => style.template === 'future-template'), storedStyles[1], 'unknown template styles are never dropped');
  await admin.templates.create(manifest({key:'other-declared',paramDefinitions:[{name:'amount',type:'number',default:1},{name:'added',type:'text',default:'Do not persist'}],enabled:true}));
  const rawRows=JSON.parse(config.templateStylesJson);
  const unrelated={id:'other-home',template:'other-declared',title:'Other',home:true,futureStyle:{keep:[false,null]},params:{amount:'2.5',future:{keep:true}}};
  rawRows.push(unrelated);repositories.siteConfig.rows.get(config.id).templateStylesJson=JSON.stringify(rawRows);
  await admin.templateStyles.save(virtual.id,{title:'Only target title'},{etag:config.etag});
  config=await admin.siteConfig.get();assert.deepEqual(JSON.parse(config.templateStylesJson).find(s=>s.id==='other-home'),unrelated,'Other style metadata/types/missing defaults must remain exact');
  await admin.templateStyles.save(virtual.id, { params: { count: '5', palette: '#ABCDEF', undeclaredInput: 'ignored' } }, { etag: config.etag });
  config = await admin.siteConfig.get();
  saved = JSON.parse(config.templateStylesJson).find((style) => style.id === virtual.id);
  assert.deepEqual(saved.params, { ...savedParams, count: 5, palette: '#abcdef' }, 'PATCH normalizes submitted fields only, without resetting other known values');

  let submit;
  const status = { textContent: '' };
  const fields = { title: { value: 'Form title' }, 'param:count': { value: '6' }, 'param:enabledPanel': { checked: true }, 'param:items': { value: '[{"id":2}]' } };
  const form = { querySelector: (selector) => fields[selector.match(/name="([^"]+)"/)?.[1]] ?? null, addEventListener(event, handler) { if (event === 'submit') submit = handler; } };
  const page = await createExtensionPages({
    adminService: admin, documentRef: { body: { querySelector: (selector) => selector.includes('data-ext-form') ? form : status, querySelectorAll: () => [] } },
    router: { link: (path) => path, navigate: async () => {} }, shell: ({ bodyHtml }) => bodyHtml, isCurrent: () => true
  }).render({ path: `/templates/styles/${virtual.id}`, params: {} });
  for (const definition of definitions) assert.ok(page.html.includes(`name="param:${definition.name}"`), `form contains declared ${definition.type} field`);
  assert.match(page.html, /value="compact" selected/);
  assert.match(page.html, /data-ext-param="json"/);
  page.bind();
  await submit({ preventDefault() {} });
  assert.equal(status.textContent, '');
  config = await admin.siteConfig.get();
  saved = JSON.parse(config.templateStylesJson).find((style) => style.id === virtual.id);
  assert.equal(saved.title, 'Form title');
  assert.deepEqual(saved.params, { ...savedParams, count: 6, palette: '#abcdef', enabledPanel: true, items: [{ id: 2 }] });

  const metadataBytes = (await admin.templates.get(installed.id)).styles;
  await admin.siteConfig.save({ siteName: 'Unrelated config save' }, { etag: config.etag });
  assert.equal((await admin.templates.get(installed.id)).styles, metadataBytes);
  config = await admin.siteConfig.get();
  await admin.templates.setDefault(installed.id, { etag: installed.etag, configEtag: config.etag });
  assert.deepEqual(repositories.siteConfig.lastPatch, { templateKey: installed.key });
  assert.equal((await admin.templates.get(installed.id)).styles, metadataBytes);
  const stale = config.etag;
  await rejectsWithoutWrites(repositories, () => admin.templateStyles.save(virtual.id, { params: { count: 8 } }, { etag: stale }), 'stale style form cannot overwrite fresh configuration', (error) => error.code === 'concurrency-conflict');
}

async function malformedAndLegacyTests() {
  const { repositories, admin } = fixture();
  const installed = await admin.templates.create(manifest());
  for (const declarations of ['{broken', '{}', 'null', '', null, 42, {}, [{ name: 'count', type: 'number', default: 'bad' }], [{ name: 'duplicate' }, { name: 'duplicate' }], [{ name: 'execute', type: 'callback' }]]) {
    await rejectsWithoutWrites(repositories, () => admin.templates.create(manifest({ key: 'invalid-template', paramDefinitions: declarations })), 'malformed declaration create');
    await rejectsWithoutWrites(repositories, () => admin.templates.update(installed.id, { paramDefinitionsJson: declarations }, { etag: installed.etag }), 'malformed declaration update');
    await rejectsWithoutWrites(repositories, () => admin.installer.install(manifest({ key: 'invalid-template', paramDefinitions: declarations })), 'malformed installer declaration');
  }
  let callbacks = 0;
  for (const field of ['paramDefinitions', 'paramDefinitionsJson']) {
    const input = manifest({ paramDefinitions: undefined });
    Object.defineProperty(input, field, { enumerable: true, get() { callbacks++; return definitions; } });
    await rejectsWithoutWrites(repositories, () => admin.templates.create(input), 'declaration getters never execute');
    await rejectsWithoutWrites(repositories, () => admin.templates.update(installed.id, input, { etag: installed.etag }), 'update declaration getters never execute');
    if (field === 'paramDefinitions') assert.throws(() => parseExtensionManifest(input), invalidData);
  }
  const definition = { name: 'caption', type: 'text' };
  Object.defineProperty(definition, 'default', { enumerable: true, get() { callbacks++; return 'unsafe'; } });
  const hook = [{ name: 'caption', default: { toJSON() { callbacks++; return 'unsafe'; } } }];
  for (const paramDefinitions of [[definition], hook]) await rejectsWithoutWrites(repositories, () => admin.templates.create(manifest({ key: 'invalid-template', paramDefinitions })), 'declarations are inert data');
  assert.equal(callbacks, 0);

  assert.deepEqual(parseExtensionManifest(manifest({ paramDefinitions: definitions, params: [{ name: 'ignoredAlias', type: 'callback' }] })).paramDefinitions, readTemplateMetadata(installed).definitions, 'explicit paramDefinitions takes precedence over params alias');
  assert.deepEqual(parseExtensionManifest(manifest({ paramDefinitions: undefined, params: definitions })).paramDefinitions, [], 'present paramDefinitions suppresses alias even when undefined');
  const alias = manifest(); delete alias.paramDefinitions; alias.params = definitions;
  assert.deepEqual(parseExtensionManifest(alias).paramDefinitions, readTemplateMetadata(installed).definitions);
  alias.params = { unrelatedTemplateValue: true };
  assert.deepEqual(parseExtensionManifest(alias).paramDefinitions, [], 'legacy template params value objects are not mistaken for declarations');
  const plugin = parseExtensionManifest({ type: 'Plugin', key: 'params-plugin', title: 'Plugin', version: '1', entryPointUrl: './plugin.js', params: [{ name: 'pluginValue' }] });
  assert.equal(Object.hasOwn(plugin, 'paramDefinitions'), false, 'new template declarations do not change plugin manifest fields');
  assert.equal(plugin.params[0].name, 'pluginValue');

  const legacy = await admin.templates.create(manifest({ key: 'legacy-template', paramDefinitions: undefined, styles: './legacy.css', enabled: true }));
  assert.equal(legacy.styles, '["./legacy.css"]');
  assert.equal(readTemplateMetadata(legacy).metadataPresent, false);
  assert.deepEqual(readTemplateMetadata(legacy).definitions, []);
  const builtinDefinitions = structuredClone(templateParamDefinitions('cassiopeia'));
  const legacyStyle = await admin.templateStyles.get('legacy-template-default');
  assert.deepEqual(legacyStyle.definitions, []);
  assert.deepEqual(legacyStyle.params, {});
  assert.deepEqual((await admin.templateStyles.get('cassiopeia-default')).definitions, builtinDefinitions);
  assert.equal(await admin.siteConfig.get(), null);

  const goodBytes = repositories.templates.rows.get(installed.id).styles;
  for (const styles of ['{broken', '{"format":"future-format","styles":[],"paramDefinitions":[]}', JSON.stringify({ format: 'minijoomla-template-metadata-v1', styles: [], paramDefinitions: {} }), JSON.stringify({ format: 'minijoomla-template-metadata-v1', styles: [], paramDefinitions: [{ name: 'bad', type: 'callback' }] })]) {
    repositories.templates.rows.get(installed.id).styles = styles;
    await rejectsWithoutWrites(repositories, () => admin.templateStyles.list(), 'invalid stored metadata never falls back to empty definitions');
    await rejectsWithoutWrites(repositories, () => admin.templateStyles.get('legacy-template-default'), 'another valid template cannot hide catalog corruption');
  }
  repositories.templates.rows.get(installed.id).styles = goodBytes;
  repositories.siteConfig.rows.set(1, { id: 1, title: 'MiniJoomlaSiteConfig', etag: '"bad-config"', templateKey: legacy.key, templateStylesJson: '{broken' });
  await rejectsWithoutWrites(repositories, () => admin.templateStyles.save('legacy-template-default', { title: 'Never overwrite' }, { etag: '"bad-config"' }), 'invalid saved style JSON cannot become an empty list');
  repositories.siteConfig.rows.get(1).templateStylesJson = JSON.stringify([{ id: 'declared-template-default', template: installed.key, title: 'Invalid typed params', home: true, params: { count: 'not-a-number' } }]);
  await rejectsWithoutWrites(repositories, () => admin.templateStyles.list(), 'invalid stored typed parameter blocks views');
  await rejectsWithoutWrites(repositories, () => admin.templateStyles.save('declared-template-default', { params: { count: 3 } }, { etag: '"bad-config"' }), 'valid submitted value cannot silently replace corrupted persisted params');

  for (const path of ['../src/libraries/minijoomla/application/admin-service.js', '../src/libraries/minijoomla/application/admin-extensions-service.js', '../src/libraries/minijoomla/application/extension-manifest.js', '../src/libraries/minijoomla/application/extension-discovery-service.js']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bimport\s*\(/, 'metadata administration never dynamically imports entrypoints');
  }
}

export async function runInstalledTemplateParamsAdminTests() {
  await installerAndEnvelopeTests();
  await discoveryTests();
  await stylesAndFormTests();
  await malformedAndLegacyTests();
  console.log('ok - installed template params admin: inert metadata without new columns, CSS retention, generic typed forms, partial merges, corruption guards and ETags');
}
