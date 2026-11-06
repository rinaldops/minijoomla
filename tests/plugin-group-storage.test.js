/* optionalSPMiddle: true — registry/list client/mapper/repository SPMIDDLE
 * reais, só transporte em memória. Nunca cria listas/colunas nem usa rede.
 * O transporte rejeita Folder escalar mesmo com FolderText disponível.
 */
import assert from 'node:assert/strict';
import { createMiniJoomlaDataSources } from '../src/libraries/minijoomla/infrastructure/spmiddle-data-sources.js';
import { createMiniJoomlaSPMiddleRepositories, MINIJOOMLA_FIELD_MAPPINGS } from '../src/libraries/minijoomla/infrastructure/spmiddle-repositories.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { NATIVE_PLUGIN_KEYS } from '../src/libraries/minijoomla/application/extension-input.js';
import { createSchemaMemoryTransport } from './schema-migration.test.js';
import { MINIJOOMLA_SCHEMAS } from '../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';

export const optionalSPMiddle = true;
const WEB_URL = '/sites/minijoomla-plugin-storage-local';
const TITLE = 'MiniJoomlaExtensions';
const GROUP = 'custom_group-1';
const DEFINITIONS = [{ name: 'constructor', type: 'number', default: 3 }, { name: 'toString', type: 'checkbox', default: true }];
const UNKNOWN = JSON.parse('{"__proto__":{"polluted":true,"nested":{"constructor":{"prototype":{"keep":[1,false]}}}},"futureKeys":{"nested":[false,{"keep":true}]}}');
const EXACT_MANIFEST = `  ${JSON.stringify({ params: DEFINITIONS, group: GROUP, version: '1.2.3', ...UNKNOWN }, null, 2)}\n`;
const EXACT_PARAMS = `  ${JSON.stringify({ constructor: '4', toString: false, ...UNKNOWN }, null, 2)}\n`;
const copy = (value) => structuredClone(value);
const nativeRow = (key, id) => ({ Id: id, Title: key, Key: key, Type: 'Plugin', EntryPointUrl: `native:${key}`, Enabled: true, Ordering: id, ManifestJson: EXACT_MANIFEST.replace(GROUP, 'content'), ParamsJson: EXACT_PARAMS, '@odata.etag': `W/"native-${id}"` });

export function pluginGroupStorageFixture(seed = []) {
  const fields = MINIJOOMLA_SCHEMAS.extensions.fields.map((field) => ({ InternalName: field.internalName, TypeAsString: field.type }));
  fields.push({ InternalName: 'FolderText', TypeAsString: 'Text' });
  const memory = createSchemaMemoryTransport({ webUrl: WEB_URL, title: TITLE, fields });
  for (const row of seed) memory.state.items.set(row.Id, copy(row));
  memory.state.nextId = Math.max(0, ...memory.state.items.keys()) + 1;
  const transport = {
    webUrl: WEB_URL,
    async request(path, options = {}) {
      const method = options.method ?? 'GET';
      assert.ok(path.includes('/items'), 'esta suíte nunca consulta/muta inventário de listas/campos');
      if (method !== 'GET' && Object.hasOwn(options.body ?? {}, 'Folder')) throw Object.assign(new Error('Folder is a navigation property; a scalar value was found'), { status: 400 });
      return memory.request(path, options);
    }
  };
  const dataSources = createMiniJoomlaDataSources({ webUrl: WEB_URL, transportFactory: () => transport, lists: { extensions: { listPath: `lists/getbytitle('${TITLE}')` } } });
  const repositories = createMiniJoomlaSPMiddleRepositories(dataSources);
  return { repositories, repository: repositories.extensions, service: createAdminService(repositories), state: memory.state, transport };
}

function rawPlugin(id = 1, patch = {}) {
  return { Id: id, Title: 'Custom plugin', Key: `custom-${id}`, Type: 'Plugin', EntryPointUrl: './extensions/custom.js', Enabled: false, Ordering: 7, ManifestJson: EXACT_MANIFEST, ParamsJson: EXACT_PARAMS, '@odata.etag': 'W/"exact-1"', ...patch };
}

async function runCreates() {
  const { service, repository, state, transport } = pluginGroupStorageFixture();
  const initialFields = copy(state.fields);
  assert.equal(state.requests.length, 0, 'composição não faz I/O');
  await assert.rejects(() => transport.request(`${WEB_URL}/_api/web/lists/getbytitle('${TITLE}')/items`, { method: 'POST', body: { Folder: 'content' } }), (error) => error.status === 400);
  for (const folder of ['content', GROUP]) {
    const key = `created-${folder}`;
    const manifestJson = EXACT_MANIFEST.replace(GROUP, folder);
    const created = await service.extensions.create({ title: 'Created plugin', key, type: 'Plugin', entryPointUrl: './extensions/created.js', folder, manifestJson, paramsJson: EXACT_PARAMS, ordering: 9, enabled: false });
    const raw = state.items.get(created.id);
    assert.equal(Object.hasOwn(raw, 'Folder'), false);
    assert.equal(Object.hasOwn(raw, 'FolderText'), false, 'coluna com colisão não vira novo mapping');
    assert.equal(raw.ManifestJson, JSON.stringify(JSON.parse(manifestJson)), 'new registrations retain historical canonical serialization');
    assert.equal(raw.ParamsJson, JSON.stringify(JSON.parse(EXACT_PARAMS)));
    for (const row of [created, await repository.findById(created.id), (await repository.findMany()).items.find((row) => row.id === created.id), await service.plugins.get(created.id)]) {
      assert.equal(row.folder, folder);
      assert.equal(row.etag, raw['@odata.etag']);
      assert.equal(row.enabled, false);
      assert.equal(row.ordering, 9);
      assert.equal(row.manifestJson, JSON.stringify(JSON.parse(manifestJson)));
      assert.equal(row.paramsJson, JSON.stringify(JSON.parse(EXACT_PARAMS)));
    }
    assert.equal(Object.getOwnPropertyDescriptor(created, 'etag').enumerable, false);
    assert.equal((await service.plugins.get(created.id)).params.constructor, 4);
    assert.ok(Object.hasOwn((await service.plugins.get(created.id)).params, '__proto__'));
  }
  const installed = await service.installer.install({ type: 'Plugin', key: 'installed-content', title: 'Installed content', version: '1.0.0', entryPointUrl: './extensions/installed.js', group: 'content', params: DEFINITIONS });
  const opaqueModule = await service.extensions.create({ title: 'Opaque module', key: 'opaque-module', type: 'Module', entryPointUrl: './extensions/module.js', manifestJson: '{"group":{"moduleMetadata":true},"params":[]}', enabled: false });
  await service.extensions.update(opaqueModule.id, { enabled: true }, { etag: opaqueModule.etag });
  const opaqueRead = await service.extensions.get(opaqueModule.id);
  assert.equal(opaqueRead.enabled, true);
  assert.deepEqual(JSON.parse(opaqueRead.manifestJson).group, { moduleMetadata: true });
  const emptyGroupValues = { title: 'Empty override', type: 'Plugin', entryPointUrl: './extensions/empty.js', folder: '', manifestJson: '{"group":"system","version":"1","future":{"keep":true}}' };
  const directEmpty = await repository.create({ ...emptyGroupValues, key: 'empty-direct' });
  const serviceEmpty = await service.extensions.create({ ...emptyGroupValues, key: 'empty-service' });
  assert.equal((await service.plugins.get(directEmpty.id)).group, 'system');
  assert.equal((await service.plugins.get(serviceEmpty.id)).group, 'system');
  await service.extensions.update(serviceEmpty.id, { folder: '', title: 'Kept group' }, { etag: serviceEmpty.etag });
  assert.equal((await service.plugins.get(serviceEmpty.id)).group, 'system', 'empty override never discards a manifest group');
  assert.equal((await service.plugins.get(installed.id)).group, 'content');
  assert.equal((await service.plugins.get(installed.id)).enabled, false);
  assert.equal(Object.hasOwn(state.items.get(installed.id), 'Folder'), false);
  const synthesized = await service.extensions.create({ title: 'Synthesized', key: 'synthesized', type: 'Plugin', entryPointUrl: './extensions/synth.js', folder: GROUP, manifestJson: EXACT_MANIFEST.replace(`"group": "${GROUP}"`, '"group": "content"') });
  assert.equal((await service.plugins.get(synthesized.id)).group, GROUP);
  const unknown = JSON.parse(state.items.get(synthesized.id).ManifestJson);
  for (const key of Object.keys(UNKNOWN)) assert.deepEqual(unknown[key], UNKNOWN[key]);
  assert.ok(Object.hasOwn(unknown, '__proto__'));
  const folderOnly = await service.extensions.create({ title: 'Folder only', key: 'folder-only', type: 'Plugin', entryPointUrl: './extensions/folder-only.js', folder: GROUP });
  assert.equal(folderOnly.folder, GROUP, 'criação sem manifesto precisa persistir folder como metadata, não descartá-lo');
  assert.deepEqual(JSON.parse(state.items.get(folderOnly.id).ManifestJson), { group: GROUP });
  const rawObject = await repository.create({ title: 'Raw own data', key: 'raw-own', type: 'Plugin', entryPointUrl: './extensions/raw.js', folder: GROUP, manifestJson: { params: DEFINITIONS, group: GROUP, ...UNKNOWN }, paramsJson: { constructor: '5', ...UNKNOWN } });
  assert.ok(Object.hasOwn(JSON.parse(rawObject.manifestJson), '__proto__'));
  assert.ok(Object.hasOwn(JSON.parse(rawObject.paramsJson), '__proto__'));
  const objectFields = rawPlugin(90, { ManifestJson: { params: DEFINITIONS, group: GROUP, ...UNKNOWN }, ParamsJson: { constructor: '5', ...UNKNOWN } });
  state.items.set(90, objectFields);
  const objectBefore = copy(state.items);
  const objectRead = await service.plugins.get(90);
  assert.equal(objectRead.group, GROUP);
  assert.equal(objectRead.params.constructor, 5);
  assert.ok(Object.hasOwn(JSON.parse(objectRead.manifestJson), '__proto__'));
  assert.ok(Object.hasOwn(objectRead.params, '__proto__'));
  assert.deepEqual(state.items, objectBefore, 'mapper não deixa clone SPMIDDLE executar setter em JSON objetos crus');
  assert.deepEqual(state.fields, initialFields);
  assert.equal(MINIJOOMLA_FIELD_MAPPINGS.extensions.folder, 'Folder', 'contrato legado do mapping não foi renomeado');
  console.log('ok - plugin group storage: criação/instalador com mapper e repository reais omitem Folder REST e recuperam grupos/ETag/JSON próprios');
}

async function runReadAndPartialUpdates() {
  for (const Folder of [undefined, null, '', { __deferred: { uri: 'local/navigation/Folder' } }, { Name: 'Folder navigation' }, ' system ']) {
    const seed = rawPlugin();
    if (Folder !== undefined) seed.Folder = Folder;
    const { service, repository, state } = pluginGroupStorageFixture([seed, rawPlugin(2)]);
    const before = copy(state.items);
    const expected = typeof Folder === 'string' && Folder.trim() ? Folder.trim() : GROUP;
    for (const row of [await service.plugins.get(1), (await service.plugins.list()).find((row) => row.id === 1), (await service.plugins.catalog()).find((row) => row.id === 1)]) assert.equal(row.group, expected);
    assert.equal((await repository.findById(1)).etag, seed['@odata.etag']);
    assert.deepEqual(state.items, before, 'leituras não migraram JSON/folder/ETag');
    for (const [input, expectedWire] of [[{ enabled: true, ordering: 8 }, { Enabled: true, Ordering: 8 }], [{ enabled: false }, { Enabled: false }]]) {
      const row = await service.plugins.get(1);
      await service.plugins.update(1, input, { etag: row.etag });
      assert.deepEqual(state.requests.at(-1).body, expectedWire);
      assert.equal(state.requests.at(-1).etag, row.etag);
      assert.equal(state.items.get(1).ManifestJson, EXACT_MANIFEST);
      assert.equal(state.items.get(1).ParamsJson, EXACT_PARAMS);
      assert.deepEqual(state.items.get(1).Folder, Folder);
    }
    for (const action of ['enable', 'disable']) {
      const row = await service.plugins.get(1);
      assert.deepEqual(await service.plugins.batch([{ id: 1, etag: row.etag }], action), { succeeded: [1], failed: [] });
      assert.deepEqual(state.requests.at(-1).body, { Enabled: action === 'enable' });
    }
    const same = await service.extensions.get(1);
    await service.extensions.update(1, { folder: same.folder, enabled: true }, { etag: same.etag });
    assert.deepEqual(state.requests.at(-1).body, { Enabled: true }, 'grupo inalterado não faz backfill nem resserializa manifesto');
    const row = await service.plugins.get(1);
    await service.plugins.update(1, { params: { constructor: '6', toString: true, futureKeys: { replace: true } } }, { etag: row.etag });
    const params = JSON.parse(state.items.get(1).ParamsJson);
    assert.deepEqual(params, { constructor: 6, toString: true, ...UNKNOWN });
    assert.equal(state.items.get(1).ManifestJson, EXACT_MANIFEST);
    assert.deepEqual(state.items.get(2), before.get(2));
    const snapshot = copy(state.items);
    await assert.rejects(() => service.plugins.update(1, { enabled: false }, { etag: row.etag }), (error) => error.status === 412);
    assert.deepEqual(state.items, snapshot);
  }
  console.log('ok - plugin group storage: Folder ausente/navegação vs string legada, ETag exato, estado/ordem/lote sem migração e parâmetros próprios preservados');
}

async function runGroupChangesAndValidation() {
  const { service, repository, state } = pluginGroupStorageFixture([rawPlugin(1, { Folder: { __deferred: { uri: 'local/Folder' } } })]);
  const read = () => service.plugins.get(1);
  let row = await read();
  await assert.rejects(() => repository.update(1, { folder: 'search' }, { etag: row.etag }), ValidationError, 'repository nunca descarta silenciosamente folder nem fabrica manifesto novo em patch');
  await service.extensions.update(1, { folder: 'search' }, { etag: row.etag });
  assert.equal(state.requests.at(-1).etag, row.etag);
  assert.deepEqual(Object.keys(state.requests.at(-1).body), ['ManifestJson']);
  assert.equal((await read()).group, 'search');
  const changed = JSON.parse(state.items.get(1).ManifestJson);
  assert.deepEqual(changed, { params: DEFINITIONS, group: 'search', version: '1.2.3', ...UNKNOWN });
  assert.ok(Object.hasOwn(changed, '__proto__'));
  assert.equal(Object.getPrototypeOf(changed), Object.prototype);
  assert.equal(state.items.get(1).ParamsJson, EXACT_PARAMS);
  assert.equal(state.items.get(1).Enabled, false);
  const snapshot = copy(state.items);
  await assert.rejects(() => service.extensions.update(1, { folder: 'system' }, { etag: row.etag }), (error) => error.status === 412);
  assert.deepEqual(state.items, snapshot);
  row = await read();
  await service.extensions.update(1, { folder: '' }, { etag: row.etag });
  assert.equal((await read()).group, 'search', 'folder vazio não sobrescreve grupo explícito do manifesto');
  row = await read();
  await service.extensions.update(1, { manifestJson: JSON.stringify({ ...JSON.parse(row.manifestJson), group: '' }) }, { etag: row.etag });
  assert.equal((await read()).group, 'content', 'limpar manifest.group explicitamente volta ao default lógico');
  assert.equal(JSON.parse(state.items.get(1).ManifestJson).group, '');

  const legacy = pluginGroupStorageFixture([rawPlugin(1, { Folder: 'system' })]);
  const old = copy(legacy.state.items);
  await assert.rejects(() => legacy.service.extensions.update(1, { folder: 'search' }, { etag: 'W/"exact-1"' }), /legado tem precedência/);
  assert.deepEqual(legacy.state.items, old, 'não simula sucesso de mudança que Folder legado ocultaria');
  assert.equal(legacy.state.requests.some(({ method }) => method !== 'GET'), false);

  for (const patch of [{ Folder: 'bad group' }, { Folder: 'system', ManifestJson: '{"group":42}' }, { ManifestJson: '{broken' }, { ManifestJson: '{"group":"__proto__"}' }]) {
    const fixture = pluginGroupStorageFixture([rawPlugin(1, patch)]);
    const before = copy(fixture.state.items);
    for (const operation of [() => fixture.service.plugins.get(1), () => fixture.service.plugins.list(), () => fixture.service.extensions.update(1, { enabled: true }, { etag: 'W/"exact-1"' })]) await assert.rejects(operation, ValidationError);
    assert.deepEqual(fixture.state.items, before);
    assert.equal(fixture.state.requests.some(({ method }) => method !== 'GET'), false);
  }
  const clean = pluginGroupStorageFixture();
  const input = { title: 'Invalid', key: 'invalid', type: 'Plugin', entryPointUrl: './extensions/invalid.js' };
  for (const patch of [{ folder: ['content'] }, { folder: '__proto__' }, { folder: 'content', manifestJson: '{"group":false}' }]) {
    await assert.rejects(() => clean.service.extensions.create({ ...input, ...patch }), ValidationError);
    assert.equal(clean.state.items.size, 0);
    assert.equal(clean.state.requests.length, 0);
  }
  const prototype = Object.create(null);
  Object.defineProperty(prototype, 'group', { get() { throw new Error('Inherited group must not run'); } });
  await assert.rejects(() => clean.repository.create({ ...input, manifestJson: Object.create(prototype) }), ValidationError);
  for (const manifestJson of [Object.defineProperty({}, 'group', { enumerable: true, get() { throw new Error('Own getter must not run'); } }), { toJSON() { throw new Error('toJSON must not run'); } }]) await assert.rejects(() => clean.repository.create({ ...input, manifestJson }), ValidationError);
  await assert.rejects(() => clean.repository.create(null), TypeError);
  await assert.rejects(() => clean.repository.update(1, null, { etag: '"1"' }), TypeError);
  assert.equal(clean.state.requests.length, 0);
  assert.equal({}.polluted, undefined);
  console.log('ok - plugin group storage: patch de grupo mescla metadata atual com ETag recebido, bloqueia falso sucesso legado e corrupção antes da escrita');
}

async function runNativePreservation() {
  const { service, state } = pluginGroupStorageFixture(NATIVE_PLUGIN_KEYS.map((key, index) => nativeRow(key, index + 1)));
  const before = copy(state.items);
  for (const key of NATIVE_PLUGIN_KEYS) {
    let row = (await service.plugins.catalog()).find((row) => row.key === key);
    for (const enabled of [false, true]) {
      const oldEtag = row.etag;
      await service.plugins.setNative(key, enabled, { etag: oldEtag });
      assert.deepEqual(state.requests.at(-1).body, { Enabled: enabled });
      assert.equal(state.requests.at(-1).etag, oldEtag);
      row = await service.plugins.get(row.id);
      assert.equal(row.enabled, enabled);
      assert.notEqual(row.etag, oldEtag);
      assert.equal(row.group, 'content');
      assert.equal(row.manifestJson, before.get(row.id).ManifestJson);
      assert.equal(row.paramsJson, EXACT_PARAMS);
      assert.equal(row.ordering, before.get(row.id).Ordering);
      assert.equal(Object.hasOwn(state.items.get(row.id), 'Folder'), false);
    }
    const snapshot = copy(state.items);
    await assert.rejects(() => service.plugins.setNative(key, false), ValidationError, 'registro existente exige ETag do chamador');
    await assert.rejects(() => service.plugins.setNative(key, false, { etag: before.get(row.id)['@odata.etag'] }), (error) => error.status === 412);
    assert.deepEqual(state.items, snapshot);
  }
  assert.equal(state.items.size, 4, 'habilitar nativos não duplica nem recria registros');
  const fakeKey = pluginGroupStorageFixture([rawPlugin(1, { Key: 'constructor', EntryPointUrl: 'native:emailcloak' })]);
  const entry = (await fakeKey.service.plugins.catalog()).find((row) => row.id === 1);
  assert.equal(entry.native, undefined, 'chave herdada não é metadata de plugin nativo');
  const empty = pluginGroupStorageFixture();
  await empty.service.plugins.setNative('emailcloak', true);
  const created = (await empty.service.plugins.list())[0];
  assert.equal(created.group, 'content');
  assert.equal(created.enabled, true);
  assert.equal(created.version, '1.0.0');
  assert.equal(Object.hasOwn(empty.state.items.get(created.id), 'Folder'), false);
  assert.equal({}.polluted, undefined);
  console.log('ok - plugin group storage: quatro nativos sem Folder preservam manifests/params/ordem exatos ao habilitar/desabilitar; own keys e ETags obrigatórios');
}

export async function runPluginGroupStorageTests() {
  const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
  await runCreates();
  await runReadAndPartialUpdates();
  await runGroupChangesAndValidation();
  await runNativePreservation();
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototypeBefore);
}
