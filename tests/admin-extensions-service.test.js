import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { normalizeParamDefinitions, normalizeParamValues } from '../src/libraries/minijoomla/application/declared-params.js';
import { moduleAssignmentMatches, isModulePublished, moduleState } from '../src/libraries/minijoomla/application/module-assignment.js';
import { resolveTemplateParams, templateParamDefinitions } from '../src/libraries/minijoomla/application/template-styles.js';
import { parseExtensionManifest } from '../src/libraries/minijoomla/application/extension-manifest.js';
import { MINIJOOMLA_FIELD_MAPPINGS } from '../src/libraries/minijoomla/infrastructure/spmiddle-repositories.js';
import { PUBLISHED_PARAMETER_DEFINITIONS, PUBLISHED_PARAMETER_VALUES, invalidPublishedParameterValues, runPublishedParameterCompatTests } from './published-parameter-compat.test.js';

export function memoryRepository(seed = []) {
  const rows = new Map(seed.map((row) => [row.id, { etag: '"1"', ...row }]));
  let version = 2;
  const conflict = () => Object.assign(new Error('conflict'), { code: 'concurrency-conflict' });
  const api = {
    lastPatch: null, rows,
    async findMany() { return { items: [...rows.values()].map(({ etag, ...row }) => ({ ...row })) }; },
    async findById(id) { const row = rows.get(Number(id)); return row ? { ...row } : null; },
    async create(input) { const row = { ...input, id: Math.max(0, ...rows.keys()) + 1, etag: `"${version++}"` }; rows.set(row.id, row); return { ...row }; },
    async update(id, input, { etag } = {}) {
      const row = rows.get(Number(id));
      if (!row || row.etag !== etag) throw conflict();
      api.lastPatch = { ...input };
      rows.set(row.id, { ...row, ...input, etag: `"${version++}"` });
      return null;
    },
    async delete(id, { etag } = {}) { if (rows.get(Number(id))?.etag !== etag) throw conflict(); rows.delete(Number(id)); }
  };
  return api;
}

const PLUGIN_MANIFEST = JSON.stringify({ params: [{ name: 'maxLinks', type: 'number', label: 'Links', default: 3, min: 1, max: 9 }, { name: 'mode', type: 'select', options: ['a', 'b'], default: 'a' }], version: '1.2.0' });

export function extensionFixture() {
  return {
    extensions: memoryRepository([
      { id: 1, title: 'Module X', key: 'module-x', type: 'Module', entryPointUrl: '/extensions/x.js', enabled: true, manifestJson: JSON.stringify({ params: [{ name: 'color', type: 'color', default: '#112233' }] }) },
      { id: 2, title: 'Links', key: 'links', type: 'Plugin', entryPointUrl: '/extensions/links.js', enabled: true, folder: 'content', ordering: 2, manifestJson: PLUGIN_MANIFEST },
      { id: 3, title: 'Audit', key: 'audit', type: 'Plugin', entryPointUrl: '/extensions/audit.js', enabled: false, folder: 'system', ordering: 1 }
    ]),
    templates: memoryRepository(),
    moduleInstances: memoryRepository(),
    menu: memoryRepository([{ id: 5, title: 'Notícias', path: '/category/noticias', published: 'Published' }]),
    categories: memoryRepository([{ id: 7, title: 'Notícias', alias: 'noticias' }]),
    articles: memoryRepository(),
    tags: memoryRepository(),
    siteConfig: memoryRepository([{ id: 1, title: 'cfg', siteName: 'Site', templateKey: 'cassiopeia' }])
  };
}

export function publishedParameterFixture(kind) {
  const repositories = extensionFixture();
  const manifestJson = `  ${JSON.stringify({ params: PUBLISHED_PARAMETER_DEFINITIONS, version: '1.0.0', futureManifest: { keep: true } }, null, 2)}\n`;
  const stored = { ...PUBLISHED_PARAMETER_VALUES, ...JSON.parse('{"__proto__":{"polluted":true,"nested":{"constructor":{"prototype":{"keep":[1,false]}}}},"futureKeys":{"nested":[{"keep":true}]}}') };
  const exactJson = `  ${JSON.stringify(stored, null, 2)}\n`;
  let domain, id, jsonField, route;
  if (kind === 'module') {
    domain = 'moduleInstances'; id = 1; jsonField = 'settingsJson'; route = '#/moduleInstances/1';
    repositories.extensions.rows.get(1).manifestJson = manifestJson;
    repositories.moduleInstances.rows.set(id, { id, etag: '"published-module"', title: 'Published menu', extensionKey: 'module-x', position: 'footer', enabled: true, showTitle: true, ordering: 0, assignment: 'all', settingsJson: exactJson });
  } else if (kind === 'plugin') {
    domain = 'extensions'; id = 2; jsonField = 'paramsJson'; route = '#/plugins/2';
    Object.assign(repositories.extensions.rows.get(id), { manifestJson, paramsJson: exactJson });
  } else throw new Error('Unsupported published parameter fixture');
  return { repositories, domain, id, jsonField, route, stored, manifestJson };
}

async function runPublishedParameterServiceTests() {
  for (const kind of ['module', 'plugin']) {
    const { repositories, domain, id, jsonField, stored, manifestJson } = publishedParameterFixture(kind);
    const service = createAdminService(repositories);
    const read = () => kind === 'module' ? service.moduleInstances.get(id) : service.plugins.get(id);
    const save = (params, etag) => kind === 'module' ? service.moduleInstances.update(id, { settings: params }, { etag }) : service.plugins.update(id, { params }, { etag });
    const parsed = () => JSON.parse(repositories[domain].rows.get(id)[jsonField]);
    const before = repositorySnapshot(repositories);
    const record = await read();
    const effective = kind === 'module' ? JSON.parse(record.settingsJson) : record.params;
    assert.deepEqual(effective.items, stored.items, `${kind}: published items remain arrays`);
    assert.deepEqual(effective.bandTones, stored.bandTones, `${kind}: published bandTones remain objects`);
    if (kind !== 'module') {
      effective.items[0].children[0].title = 'Read mutation';
      effective.futureKeys.nested[0].keep = false;
      effective.__proto__.nested.constructor.prototype.keep.push('Read mutation');
      assert.deepEqual((await read()).params.items, stored.items, `${kind}: read values are isolated from stored and later values`);
    }
    assert.deepEqual(repositorySnapshot(repositories), before, `${kind}: reading JSON preserves all rows, bytes, ETags and patches`);
    for (const invalid of invalidPublishedParameterValues()) {
      await assert.rejects(() => save(invalid, record.etag), ValidationError, `${kind}: invalid published parameter fails before write`);
      assert.deepEqual(repositorySnapshot(repositories), before, `${kind}: invalid JSON/type/unsafe keys/length/URL/range preserves every repository and ETag`);
    }
    const submitted = { ...PUBLISHED_PARAMETER_VALUES, items: JSON.stringify([{ title: 'Edited', href: '#/edited' }], null, 2), bandTones: JSON.stringify({ main: '#556677' }), target: '#/edited', newUnknown: true, futureKeys: { replace: true } };
    const inputBefore = structuredClone(submitted);
    // Module service validates settings but preserves the caller's wire data;
    // its actual form normalizes declared fields and merges stored settings.
    const wire = kind === 'module' ? { ...stored, ...normalizeParamValues(normalizeParamDefinitions(PUBLISHED_PARAMETER_DEFINITIONS), submitted) } : submitted;
    await save(wire, record.etag);
    assert.deepEqual(parsed(), { ...stored, items: [{ title: 'Edited', href: '#/edited' }], bandTones: { main: '#556677' }, target: '#/edited' }, `${kind}: structured form values persist as JSON data and preserve existing unknown data`);
    assert.deepEqual(submitted, inputBefore);
    assert.notEqual(repositories[domain].rows.get(id).etag, record.etag);
    const after = repositorySnapshot(repositories);
    await assert.rejects(() => save({ items: '[]' }, record.etag), (error) => error.code === 'concurrency-conflict');
    assert.deepEqual(repositorySnapshot(repositories), after, `${kind}: stale ETags preserve JSON and prior patch`);
    assert.equal(repositories.extensions.rows.get(kind === 'module' ? 1 : 2).manifestJson, manifestJson);
    assert.equal(Object.getPrototypeOf(parsed()), Object.prototype);
    assert.ok(Object.hasOwn(parsed(), '__proto__'));
    assert.equal({}.polluted, undefined);
  }
  console.log('ok - admin extensions: published JSON module/plugin manifests round-trip typed form data, reject invalid edits before writes and retain ETags/unknown own data');
}

function repositorySnapshot(repositories) {
  return structuredClone(Object.fromEntries(Object.entries(repositories).map(([domain, repository]) => [domain, {
    rows: [...repository.rows.entries()], lastPatch: repository.lastPatch
  }])));
}

function runOwnParamValuesRegressionTests() {
  const definitions = normalizeParamDefinitions([
    { name: 'constructor', type: 'number', default: 3 },
    { name: 'toString', type: 'text', default: 'texto' },
    { name: 'valueOf', type: 'checkbox', default: true },
    { name: 'hasOwnProperty', type: 'checkbox' },
    { name: 'isPrototypeOf', type: 'checkbox', default: false },
    { name: 'propertyIsEnumerable', type: 'text' },
    { name: 'toLocaleString', type: 'text', default: '' }
  ]);
  const defaults = { constructor: 3, toString: 'texto', valueOf: true, isPrototypeOf: false, toLocaleString: '' };
  assert.deepEqual(normalizeParamValues(definitions, {}), defaults, 'nomes válidos não leem funções herdadas de Object.prototype');
  const inherited = Object.create(null);
  for (const { name } of definitions) Object.defineProperty(inherited, name, { get() { throw new Error('Não leia valores herdados.'); } });
  const input = Object.create(inherited);
  assert.deepEqual(normalizeParamValues(definitions, input, { keepUndeclared: true }), defaults, 'getters herdados não são consultados');
  // Os getters herdados não oferecem setter; defina as entradas próprias explicitamente.
  Object.defineProperty(input, 'constructor', { value: undefined, enumerable: true });
  Object.defineProperty(input, 'valueOf', { value: undefined, enumerable: true });
  Object.defineProperty(input, 'hasOwnProperty', { value: undefined, enumerable: true });
  assert.deepEqual(normalizeParamValues(definitions, input), defaults, 'undefined próprio mantém o comportamento de defaults');
  const explicit = { constructor: '4', toString: '', valueOf: false, hasOwnProperty: 'true', isPrototypeOf: null, propertyIsEnumerable: null, toLocaleString: null };
  assert.deepEqual(normalizeParamValues(definitions, explicit), { constructor: 4, toString: '', valueOf: false, hasOwnProperty: true, isPrototypeOf: false, propertyIsEnumerable: '', toLocaleString: '' }, 'valores próprios explícitos, null, false e vazio são normalizados, não substituídos');
  for (const name of ['__proto__', 'bad name', '9invalid']) assert.throws(() => normalizeParamDefinitions([{ name }]), ValidationError, 'gramática dos nomes não foi ampliada');

  const stored = JSON.parse('{"__proto__":{"polluted":true,"nested":{"keep":[1,false]}},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},"toString":"próprio","futureKeys":{"keep":true}}');
  const before = Object.getOwnPropertyDescriptors(stored);
  const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
  const preserved = normalizeParamValues([], stored, { keepUndeclared: true });
  assert.deepEqual(preserved, stored);
  assert.equal(Object.getPrototypeOf(preserved), Object.prototype, 'saída mantém o protótipo comum');
  assert.ok(Object.hasOwn(preserved, '__proto__'), '__proto__ desconhecido é propriedade própria de dados');
  assert.deepEqual(Object.getOwnPropertyDescriptor(preserved, '__proto__'), { value: stored.__proto__, enumerable: true, writable: true, configurable: true });
  assert.equal(preserved.polluted, undefined);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototypeBefore);
  assert.deepEqual(Object.getOwnPropertyDescriptors(stored), before, 'normalização não modifica entradas próprias');
  assert.deepEqual(normalizeParamValues([], stored), {}, 'campos desconhecidos recebidos continuam descartados');
  console.log('ok - admin extensions: parâmetros próprios, defaults e __proto__ sem alteração de protótipo');
}

async function runPersistedPluginRegressionTests() {
  const invalidObjects = ['{not-json', '[]', '"text"', 'null', '42', [], 42];
  const invalidGroups = [[], ['content'], {}, { group: 'content' }, 0, 42, false, true, ' ', '\t\n', 'Content', 'bad group', '1content', 'x'.repeat(41), '__proto__'];
  const corruptFields = [
    ['manifestJson', [
      ...invalidObjects,
      ...[
        {}, [{ name: 'maxLinks', type: 'script' }], [{ name: 'bad name', type: 'number' }], [{ name: '__proto__' }],
        [{ name: 42 }], [null], [{ name: 'maxLinks', type: 'number', default: 'NaN' }],
        [{ name: 'maxLinks', type: 'number', min: 1, max: 9, default: 50 }],
        [{ name: 'mode', type: 'select', options: ['a', 'b'], default: 'invalid' }]
      ].map((params) => JSON.stringify({ params })),
      ...invalidGroups.flatMap((group) => {
        const manifest = { ...JSON.parse(PLUGIN_MANIFEST), group };
        return [manifest, JSON.stringify(manifest)];
      })
    ]],
    ['paramsJson', [
      ...invalidObjects,
      ...[{ maxLinks: 'NaN' }, { maxLinks: 0 }, { maxLinks: 50 }, { mode: 'invalid' }].map((params) => JSON.stringify(params))
    ]],
    ['folder', invalidGroups],
    ['manifestJson', invalidGroups.flatMap((group) => {
      const manifest = { ...JSON.parse(PLUGIN_MANIFEST), group };
      return [manifest, JSON.stringify(manifest)];
    }), true]
  ];
  const operations = [
    ['plugins.list', (service) => service.plugins.list()],
    ['plugins.get', (service) => service.plugins.get(2)],
    ['plugins.update params', (service, etag) => service.plugins.update(2, { params: { maxLinks: 5, mode: 'b' } }, { etag })],
    ['plugins.update enabled', (service, etag) => service.plugins.update(2, { enabled: false }, { etag })],
    ['plugins.update ordering', (service, etag) => service.plugins.update(2, { ordering: 8 }, { etag })],
    ['plugins.batch enable', (service, etag) => service.plugins.batch([{ id: 2, etag }], 'enable'), 'batch'],
    ['plugins.batch disable', (service, etag) => service.plugins.batch([{ id: 2, etag }], 'disable'), 'batch']
  ];
  for (const [field, values, omitFolder] of corruptFields) {
    for (const value of values) {
      for (const [name, operation, kind] of operations) {
        const repositories = extensionFixture();
        const row = repositories.extensions.rows.get(2);
        row[field] = value;
        if (field === 'folder') row.manifestJson = JSON.stringify({ ...JSON.parse(PLUGIN_MANIFEST), group: 'content' });
        if (omitFolder) delete row.folder;
        for (const [domain, repository] of Object.entries(repositories)) repository.lastPatch = { title: `Patch anterior ${domain}`, nested: { untouched: true } };
        const before = repositorySnapshot(repositories);
        const service = createAdminService(repositories);
        const label = `${name} rejeita ${field}=${JSON.stringify(value)}`;
        if (kind === 'batch') {
          let validation;
          await assert.rejects(() => service.plugins.get(2), (error) => {
            assert.ok(error instanceof ValidationError, label);
            validation = error;
            return true;
          });
          assert.deepEqual(await operation(service, row.etag), {
            succeeded: [], failed: [{ id: 2, code: validation.code, message: validation.message }]
          }, `${label}: falha de validação por item, sem sucesso`);
        } else {
          await assert.rejects(() => operation(service, row.etag), ValidationError, label);
        }
        assert.deepEqual(repositorySnapshot(repositories), before, `${label}: todas as linhas, ETags e lastPatch preservados`);
      }
    }
  }
  console.log('ok - admin extensions: plugins corrompidos rejeitam leitura, parâmetros, estado e lote sem escritas');

  for (const folder of [undefined, null, '', ' system ', 'custom_group-1', 'a'.repeat(40)]) {
    for (const group of [undefined, null, '', ' content ', 'custom_group-2', 'b'.repeat(40)]) {
      const repositories = extensionFixture();
      const row = repositories.extensions.rows.get(2);
      delete row.folder;
      if (folder !== undefined) row.folder = folder;
      const manifestJson = `  ${JSON.stringify({ ...JSON.parse(PLUGIN_MANIFEST), group, futureKeys: { nested: [false, { keep: true }] } }, null, 2)}\n`;
      row.manifestJson = manifestJson;
      const paramsJson = '  {"maxLinks":"4","mode":"b","futureKeys":{"keep":[1,false]}}\n';
      row.paramsJson = paramsJson;
      const before = repositorySnapshot(repositories);
      const service = createAdminService(repositories);
      const expected = folder?.trim() || group?.trim() || 'content';
      const plugin = await service.plugins.get(2);
      assert.equal(plugin.group, expected, 'folder válido tem precedência; ausência legada usa manifesto/content');
      assert.equal(plugin.folder, folder, 'trim é apenas da visão efetiva');
      const listed = await service.plugins.list();
      assert.equal(listed.find((item) => item.id === 2).group, expected);
      assert.deepEqual(service.plugins.groups(listed), [...new Set([expected, 'system'])].sort());
      assert.deepEqual(repositorySnapshot(repositories), before, 'leitura não regrava grupos ou JSON');
      await service.plugins.update(2, { enabled: false, ordering: 8 }, { etag: row.etag });
      assert.deepEqual(repositories.extensions.lastPatch, { enabled: false, ordering: 8 }, 'estado/ordem não fazem backfill');
      for (const action of ['enable', 'disable']) {
        assert.deepEqual(await service.plugins.batch([{ id: 2, etag: repositories.extensions.rows.get(2).etag }], action), { succeeded: [2], failed: [] });
        assert.deepEqual(repositories.extensions.lastPatch, { enabled: action === 'enable' });
      }
      const current = repositories.extensions.rows.get(2);
      assert.equal(current.manifestJson, manifestJson);
      assert.equal(current.paramsJson, paramsJson);
      assert.equal(current.folder, folder);
      assert.equal(Object.hasOwn(current, 'folder'), Object.hasOwn(row, 'folder'), 'ausência de folder permanece ausente');
      assert.equal(current.ordering, 8);
      assert.notEqual(current.etag, row.etag, 'somente escritas autorizadas avançam ETag');
    }
  }
  console.log('ok - admin extensions: grupos legados/customizados, precedência e trim sem backfill/reescrita de JSON');

  {
    const repositories = extensionFixture();
    const row = repositories.extensions.rows.get(2);
    row.folder = null;
    row.manifestJson = { group: ' custom_group-1 ', futureKeys: { nested: [false, { keep: true }] } };
    const before = repositorySnapshot(repositories);
    const service = createAdminService(repositories);
    assert.equal((await service.plugins.get(2)).group, 'custom_group-1');
    assert.equal((await service.plugins.list()).find((item) => item.id === 2).group, 'custom_group-1');
    assert.deepEqual(repositorySnapshot(repositories), before, 'manifesto bruto válido não é modificado pela normalização');
    await service.plugins.update(2, { enabled: false, ordering: 9 }, { etag: row.etag });
    assert.deepEqual(repositories.extensions.rows.get(2).manifestJson, row.manifestJson);
    assert.deepEqual(repositories.extensions.lastPatch, { enabled: false, ordering: 9 });
  }

  {
    const repositories = extensionFixture();
    const row = repositories.extensions.rows.get(2);
    const manifest = {
      params: [{ name: 'constructor', type: 'number', default: 3 }, { name: 'toString', type: 'checkbox', default: true }, { name: 'valueOf', type: 'text' }, { name: 'hasOwnProperty', type: 'checkbox', default: false }],
      group: 'content', futureKeys: { nested: [false, { keep: true }] }
    };
    row.manifestJson = `  ${JSON.stringify(manifest, null, 2)}\n`;
    const service = createAdminService(repositories);
    const before = repositorySnapshot(repositories);
    assert.deepEqual((await service.plugins.get(2)).params, { constructor: 3, toString: true, hasOwnProperty: false }, 'consumer aceita definições válidas homônimas de Object.prototype com defaults booleanos');
    assert.deepEqual((await service.plugins.list()).find((item) => item.id === 2).params, { constructor: 3, toString: true, hasOwnProperty: false });
    assert.deepEqual(repositorySnapshot(repositories), before);
    const stored = JSON.parse('{"constructor":"4","toString":false,"valueOf":"próprio","hasOwnProperty":true,"__proto__":{"polluted":true,"nested":{"keep":[1,false]}},"prototype":{"polluted":true},"futureKeys":{"nested":[true,{"keep":7}]}}');
    const exactJson = `  ${JSON.stringify(stored, null, 2)}\n`;
    row.paramsJson = exactJson;
    const withParams = repositorySnapshot(repositories);
    for (const plugin of [await service.plugins.get(2), (await service.plugins.list()).find((item) => item.id === 2)]) {
      assert.deepEqual(plugin.params, { ...stored, constructor: 4 });
      assert.equal(Object.getPrototypeOf(plugin.params), Object.prototype);
      assert.ok(Object.hasOwn(plugin.params, '__proto__'));
      assert.equal(plugin.params.polluted, undefined);
    }
    assert.deepEqual(repositorySnapshot(repositories), withParams, 'consumer não modifica registros próprios, JSON ou ETags');
    const etag = () => repositories.extensions.rows.get(2).etag;
    await service.plugins.update(2, { enabled: false, ordering: 9 }, { etag: etag() });
    assert.equal(repositories.extensions.rows.get(2).paramsJson, exactJson);
    assert.deepEqual(repositories.extensions.lastPatch, { enabled: false, ordering: 9 });
    for (const action of ['enable', 'disable']) {
      assert.deepEqual(await service.plugins.batch([{ id: 2, etag: etag() }], action), { succeeded: [2], failed: [] });
      assert.equal(repositories.extensions.rows.get(2).paramsJson, exactJson);
    }
    const params = JSON.parse('{"constructor":"6","toString":"true","valueOf":"editado","hasOwnProperty":false,"__proto__":{"replace":true},"prototype":{"replace":true},"futureKeys":{"replace":true},"newUnknown":true}');
    const received = structuredClone(params);
    await service.plugins.update(2, { params }, { etag: etag() });
    const persisted = JSON.parse(repositories.extensions.rows.get(2).paramsJson);
    assert.deepEqual(persisted, { ...stored, constructor: 6, toString: true, valueOf: 'editado', hasOwnProperty: false }, 'gravação preserva __proto__/prototype/futureKeys existentes e filtra desconhecidos novos');
    assert.deepEqual(params, received, 'entrada própria não sofre mutação');
    assert.equal(Object.getPrototypeOf(persisted), Object.prototype);
    assert.ok(Object.hasOwn(persisted, '__proto__'));
    assert.equal(persisted.polluted, undefined);
    assert.equal({}.polluted, undefined);
    assert.equal(repositories.extensions.rows.get(2).manifestJson, row.manifestJson, 'campos desconhecidos do manifesto permanecem byte a byte');
    const unchanged = repositorySnapshot(repositories);
    await assert.rejects(() => service.plugins.update(2, { params: { constructor: 7, toString: false } }, { etag: row.etag }), (error) => error.code === 'concurrency-conflict');
    await assert.rejects(() => service.plugins.update(2, { params: { constructor: 'NaN' } }, { etag: etag() }), ValidationError);
    await assert.rejects(() => service.plugins.update(2, { params: { toString: 'invalid boolean' } }, { etag: etag() }), ValidationError);
    assert.deepEqual(repositorySnapshot(repositories), unchanged, 'validação/ETag preservam registros e patch anterior');
  }
  console.log('ok - admin extensions: consumer mantém nomes próprios, __proto__, campos futuros e ETags sem poluição');

  for (const manifestJson of [undefined, null, '']) {
    for (const paramsJson of [undefined, null, '']) {
      const repositories = extensionFixture();
      const row = repositories.extensions.rows.get(2);
      delete row.manifestJson;
      if (manifestJson !== undefined) row.manifestJson = manifestJson;
      if (paramsJson !== undefined) row.paramsJson = paramsJson;
      const service = createAdminService(repositories);
      const before = repositorySnapshot(repositories);
      const plugin = await service.plugins.get(2);
      assert.deepEqual(plugin.definitions, []);
      assert.deepEqual(plugin.params, {});
      assert.deepEqual((await service.plugins.list()).find((item) => item.id === 2).params, {});
      assert.deepEqual(repositorySnapshot(repositories), before, 'campos legados não escrevem durante leitura');
      await service.plugins.update(2, { enabled: false }, { etag: row.etag });
      assert.equal(repositories.extensions.rows.get(2).paramsJson, paramsJson);
      assert.equal('paramsJson' in repositories.extensions.lastPatch, false, 'alterar estado não provisiona paramsJson');
      await service.plugins.update(2, { params: { newUnknown: { ignore: true } } }, { etag: repositories.extensions.rows.get(2).etag });
      assert.deepEqual(JSON.parse(repositories.extensions.rows.get(2).paramsJson), {});
      const result = await service.plugins.batch([{ id: 2, etag: repositories.extensions.rows.get(2).etag }], 'enable');
      assert.deepEqual(result, { succeeded: [2], failed: [] });
      assert.equal((await service.plugins.get(2)).enabled, true);
      assert.equal(repositories.extensions.rows.get(2).manifestJson, manifestJson, 'manifesto legado preservado');
    }
  }
  for (const paramsJson of [undefined, null, '']) {
    const repositories = extensionFixture();
    if (paramsJson !== undefined) repositories.extensions.rows.get(2).paramsJson = paramsJson;
    const service = createAdminService(repositories);
    const before = repositorySnapshot(repositories);
    assert.deepEqual((await service.plugins.get(2)).params, { maxLinks: 3, mode: 'a' });
    assert.deepEqual((await service.plugins.list()).find((item) => item.id === 2).params, { maxLinks: 3, mode: 'a' });
    assert.deepEqual(repositorySnapshot(repositories), before);
    await service.plugins.update(2, { params: { maxLinks: '5', mode: 'b' } }, { etag: repositories.extensions.rows.get(2).etag });
    assert.deepEqual(JSON.parse(repositories.extensions.rows.get(2).paramsJson), { maxLinks: 5, mode: 'b' });
  }
  console.log('ok - admin extensions: plugins legados aceitam campos ausentes, null JS e vazios com defaults');

  {
    const repositories = extensionFixture();
    const stored = { maxLinks: '4', mode: 'b', advanced: { nested: { tokens: ['x', { enabled: false }] }, count: 7 }, oldFlag: false };
    const exactJson = `  ${JSON.stringify(stored, null, 2)}\n`;
    repositories.extensions.rows.get(2).paramsJson = exactJson;
    const service = createAdminService(repositories);
    const etag = () => repositories.extensions.rows.get(2).etag;
    const before = repositorySnapshot(repositories);
    assert.deepEqual((await service.plugins.get(2)).params, { ...stored, maxLinks: 4 });
    assert.deepEqual((await service.plugins.list()).find((item) => item.id === 2).params, { ...stored, maxLinks: 4 });
    assert.deepEqual(repositorySnapshot(repositories), before, 'normalização de leitura não reserializa JSON persistido');
    await service.plugins.update(2, { enabled: false, ordering: 8 }, { etag: etag() });
    assert.equal(repositories.extensions.rows.get(2).paramsJson, exactJson, 'update sem params preserva JSON byte a byte');
    assert.equal('paramsJson' in repositories.extensions.lastPatch, false);
    for (const action of ['enable', 'disable']) {
      assert.deepEqual(await service.plugins.batch([{ id: 2, etag: etag() }], action), { succeeded: [2], failed: [] });
      assert.equal(repositories.extensions.rows.get(2).paramsJson, exactJson, 'lote sem params preserva JSON byte a byte');
      assert.equal('paramsJson' in repositories.extensions.lastPatch, false);
    }
    const otherRows = repositorySnapshot(repositories);
    await service.plugins.update(2, { params: { maxLinks: '6', mode: 'b', advanced: { replace: true }, oldFlag: true, newUnknown: { ignore: true } } }, { etag: etag() });
    assert.deepEqual(JSON.parse(repositories.extensions.rows.get(2).paramsJson), { ...stored, maxLinks: 6 }, 'preserva desconhecidos existentes, inclusive aninhados, e ignora desconhecidos recebidos');
    const after = repositorySnapshot(repositories);
    after.extensions = otherRows.extensions;
    assert.deepEqual(after, otherRows, 'salvar plugin não altera outros repositórios');
    assert.deepEqual(repositories.extensions.rows.get(1), otherRows.extensions.rows.find(([id]) => id === 1)[1]);
    assert.deepEqual(repositories.extensions.rows.get(3), otherRows.extensions.rows.find(([id]) => id === 3)[1]);
    for (const params of [...invalidObjects, { maxLinks: 50 }, { mode: 'invalid' }]) {
      const unchanged = repositorySnapshot(repositories);
      await assert.rejects(() => service.plugins.update(2, { params }, { etag: etag() }), ValidationError);
      assert.deepEqual(repositorySnapshot(repositories), unchanged, 'entrada inválida não altera linhas, ETags ou patch anterior');
    }
    const stale = '"1"';
    for (const input of [{ params: { maxLinks: 5, mode: 'a' } }, { enabled: true }]) {
      const unchanged = repositorySnapshot(repositories);
      await assert.rejects(() => service.plugins.update(2, input, { etag: stale }), (error) => error.code === 'concurrency-conflict');
      assert.deepEqual(repositorySnapshot(repositories), unchanged);
    }
    for (const action of ['enable', 'disable']) {
      const unchanged = repositorySnapshot(repositories);
      const result = await service.plugins.batch([{ id: 2, etag: stale }], action);
      assert.deepEqual(result.succeeded, []);
      assert.equal(result.failed.length, 1);
      assert.equal(result.failed[0].id, 2);
      assert.equal(result.failed[0].code, 'concurrency-conflict');
      assert.deepEqual(repositorySnapshot(repositories), unchanged);
    }
  }
  console.log('ok - admin extensions: plugins preservam desconhecidos e JSON exato, filtram novos campos e respeitam ETag');

  for (const action of ['enable', 'disable']) {
    const repositories = extensionFixture();
    repositories.extensions.lastPatch = { enabled: true, nested: { untouched: true } };
    const service = createAdminService(repositories);
    const before = repositorySnapshot(repositories);
    assert.equal(await service.plugins.get(1), null);
    await assert.rejects(() => service.plugins.update(1, { enabled: false, params: {} }, { etag: repositories.extensions.rows.get(1).etag }), ValidationError);
    assert.deepEqual(await service.plugins.batch([{ id: 1, etag: repositories.extensions.rows.get(1).etag }], action), {
      succeeded: [], failed: [{ id: 1, code: undefined, message: 'Plugin não encontrado.' }]
    });
    assert.deepEqual(repositorySnapshot(repositories), before, 'namespace plugins nunca altera módulos, nem em lote');
  }
  console.log('ok - admin extensions: operações de plugins bloqueiam módulos sem alterar repositórios');
}

async function runPersistedOptionsRegressionTests() {
  const validStyles = [
    { id: 'cassiopeia-default', template: 'cassiopeia', title: 'Padrão', home: true, params: { colorName: 'alternative' } },
    { id: 'cassiopeia-extra', template: 'cassiopeia', title: 'Alternativo', home: false, params: { siteTitle: 'Preservar' } }
  ];
  const corruptFields = [
    ['componentParamsJson', ['{not-json', '[]', 'null', '{"content":[]}', '{"search":{"resultsLimit":999}}'], [
      ['componentOptions.get', (service) => service.componentOptions.get('content')],
      ['componentOptions.save', (service, etag) => service.componentOptions.save('content', { listLimit: 17 }, { etag })]
    ]],
    ['templateStylesJson', ['{not-json', '{}', 'null',
      JSON.stringify(validStyles.map((style, index) => ({ ...style, home: index === 1 ? 'true' : false }))),
      ...[null, { template: 'cassiopeia', title: 'Sem id' }, { id: 'bad id', template: 'cassiopeia', title: 'Id inválido' }, { id: 'invalid', title: 'Sem template' }].map((invalid) => JSON.stringify([...validStyles, invalid]))], [
      ['templateStyles.list', (service) => service.templateStyles.list()],
      ['templateStyles.get', (service) => service.templateStyles.get('cassiopeia-default')],
      ['templateStyles.save', (service, etag) => service.templateStyles.save('cassiopeia-default', { title: 'Alterado', params: { colorName: 'standard' } }, { etag })],
      ['templateStyles.duplicate', (service, etag) => service.templateStyles.duplicate('cassiopeia-default', { etag })],
      ['templateStyles.setDefault', (service, etag) => service.templateStyles.setDefault('cassiopeia-default', { etag })],
      ['templateStyles.remove', (service, etag) => service.templateStyles.remove('cassiopeia-extra', { etag })]
    ]]
  ];
  for (const [field, values, operations] of corruptFields) {
    for (const value of values) {
      for (const [name, operation] of operations) {
        const repositories = extensionFixture();
        const config = repositories.siteConfig.rows.get(1);
        config[field] = value;
        // Um patch anterior também deve sobreviver intacto à operação rejeitada.
        repositories.siteConfig.lastPatch = { siteName: 'Patch anterior', nested: { untouched: true } };
        const before = repositorySnapshot(repositories);
        const label = `${name} rejeita ${field}=${value}`;
        await assert.rejects(() => operation(createAdminService(repositories), config.etag), ValidationError, label);
        assert.deepEqual(repositorySnapshot(repositories), before, `${label}: snapshot completo, ETag e lastPatch preservados`);
      }
    }
  }
  console.log('ok - admin extensions: JSON persistido corrompido rejeitado em leituras e escritas sem alterar repositórios');

  for (const value of [undefined, null, '']) {
    const repositories = extensionFixture();
    const row = repositories.siteConfig.rows.get(1);
    if (value !== undefined) Object.assign(row, { componentParamsJson: value, templateStylesJson: value });
    const service = createAdminService(repositories);
    const before = repositorySnapshot(repositories);
    const content = await service.componentOptions.get('content');
    assert.equal(content.values.listLimit, 10);
    assert.equal((await service.componentOptions.get('search')).values.resultsLimit, 10);
    assert.ok((await service.templateStyles.list()).styles.some((style) => style.id === 'cassiopeia-default' && style.isDefault));
    assert.equal((await service.templateStyles.get('cassiopeia-default')).params.colorName, 'standard');
    assert.deepEqual(repositorySnapshot(repositories), before, 'defaults legados não escrevem durante a leitura');
    await service.componentOptions.save('content', { listLimit: 17 }, { etag: row.etag });
    assert.equal((await service.componentOptions.get('content')).values.listLimit, 17);
    await service.templateStyles.save('cassiopeia-default', { params: { colorName: 'alternative' } }, { etag: repositories.siteConfig.rows.get(1).etag });
    const copyId = await service.templateStyles.duplicate('cassiopeia-default', { etag: repositories.siteConfig.rows.get(1).etag });
    assert.equal((await service.templateStyles.get(copyId)).params.colorName, 'alternative');
    await service.templateStyles.setDefault(copyId, { etag: repositories.siteConfig.rows.get(1).etag });
    await service.templateStyles.remove('cassiopeia-default', { etag: repositories.siteConfig.rows.get(1).etag });
    assert.equal(await service.templateStyles.get('cassiopeia-default'), null);
    assert.equal((await service.templateStyles.get(copyId)).isDefault, true);
    assert.equal(JSON.parse(repositories.siteConfig.rows.get(1).componentParamsJson).content.listLimit, 17, 'escritas de estilos preservam opções de componente');
  }
  console.log('ok - admin extensions: campos ausentes, null JS e vazios mantêm defaults e aceitam escritas');

  const repositories = extensionFixture();
  const service = createAdminService(repositories);
  const searchParams = { searchPhrases: 'exact', resultsLimit: 23, highlightTerms: false };
  repositories.siteConfig.rows.get(1).componentParamsJson = JSON.stringify({ content: { listLimit: 11 }, search: searchParams });
  const etag = () => repositories.siteConfig.rows.get(1).etag;
  await service.componentOptions.save('content', { listLimit: 19, showAuthor: false }, { etag: etag() });
  assert.deepEqual(JSON.parse(repositories.siteConfig.rows.get(1).componentParamsJson).search, searchParams, 'salvar content preserva opções personalizadas de search');
  await service.templateStyles.save('cassiopeia-default', { title: 'Não alterar', params: { colorName: 'alternative', siteTitle: 'Site preservado' } }, { etag: etag() });
  const storedStyle = () => JSON.parse(repositories.siteConfig.rows.get(1).templateStylesJson).find((style) => style.id === 'cassiopeia-default');
  const preserved = structuredClone(storedStyle());
  await service.templateStyles.save('camap-default', { title: 'Outro estilo' }, { etag: etag() });
  assert.deepEqual(storedStyle(), preserved, 'save preserva outro estilo e seus parâmetros');
  const copyId = await service.templateStyles.duplicate('camap-default', { etag: etag() });
  assert.deepEqual(storedStyle(), preserved, 'duplicate preserva outro estilo e seus parâmetros');
  await service.templateStyles.setDefault(copyId, { etag: etag() });
  assert.deepEqual(storedStyle(), preserved, 'setDefault preserva estilo de outro template e seus parâmetros');
  await service.templateStyles.remove('camap-default', { etag: etag() });
  assert.deepEqual(storedStyle(), preserved, 'remove preserva outro estilo e seus parâmetros');
  assert.deepEqual(JSON.parse(repositories.siteConfig.rows.get(1).componentParamsJson).search, searchParams);
  console.log('ok - admin extensions: gravações bem-sucedidas preservam opções de outros componentes e estilos');
}

export async function runAdminExtensionsServiceTests() {
  runPublishedParameterCompatTests();
  await runPublishedParameterServiceTests();
  // A missing configuration is legitimate; a configured repository failure
  // must not invent the default template/positions or conceal the outage.
  {
    const repositories = extensionFixture();
    repositories.siteConfig.rows.clear();
    assert.equal((await createAdminService(repositories).moduleInstances.positions()).template, 'default');
    const failure = new Error('private transport details');
    repositories.siteConfig.findMany = async () => { throw failure; };
    const before = repositorySnapshot(repositories);
    const service = createAdminService(repositories);
    await assert.rejects(() => service.moduleInstances.positions(), (error) => error === failure);
    assert.equal((await service.moduleInstances.positions('camap')).template, 'camap', 'explicit template does not require reading site configuration');
    assert.deepEqual(repositorySnapshot(repositories), before);
  }
  // Parâmetros declarativos
  const definitions = normalizeParamDefinitions([{ name: 'n', type: 'number', min: 1, max: 5, default: 2 }, { name: 'c', type: 'checkbox' }, { name: 's', type: 'select', options: ['x', 'y'], default: 'x' }]);
  assert.deepEqual(normalizeParamValues(definitions, { n: '3', c: 'true', s: 'y', extra: 1 }, { keepUndeclared: false }), { n: 3, c: true, s: 'y' });
  assert.throws(() => normalizeParamValues(definitions, { n: 9 }), ValidationError);
  assert.throws(() => normalizeParamValues(definitions, { s: 'z' }), ValidationError);
  assert.throws(() => normalizeParamDefinitions([{ name: 'bad name' }]), ValidationError);
  assert.throws(() => normalizeParamDefinitions([{ name: 'x', type: 'script' }]), ValidationError);
  console.log('ok - admin extensions: parâmetros declarativos validam tipo, faixa e opções');
  runOwnParamValuesRegressionTests();

  // Atribuição e janela de publicação (helpers puros para o runtime)
  assert.equal(moduleAssignmentMatches({}, { route: 'home' }), undefined, 'sem atribuição → escopo legado');
  assert.equal(moduleAssignmentMatches({ assignment: 'none' }, { route: 'home' }), false);
  assert.equal(moduleAssignmentMatches({ assignment: 'only', assignmentJson: '["route:home"]' }, { route: 'home' }), true);
  assert.equal(moduleAssignmentMatches({ assignment: 'only', assignmentJson: '["category:noticias"]' }, { route: 'category', categoryAlias: 'eventos' }), false);
  assert.equal(moduleAssignmentMatches({ assignment: 'except', assignmentJson: '["menu:5"]' }, { route: 'category', menuItemId: 5 }), false);
  const now = new Date('2026-03-01T12:00:00Z');
  assert.equal(isModulePublished({ enabled: true, publishUp: '2026-04-01T00:00:00Z' }, now), false);
  assert.equal(isModulePublished({ enabled: true, publishDown: '2026-02-01T00:00:00Z' }, now), false);
  assert.equal(isModulePublished({ enabled: true, trashed: true }, now), false);
  assert.equal(isModulePublished({ enabled: true, publishUp: '2026-02-01T00:00:00Z', publishDown: '2026-04-01T00:00:00Z' }, now), true);
  assert.equal(moduleState({ enabled: false, trashed: true }), 'trashed');
  console.log('ok - admin extensions: atribuição de menu e janela de publicação');

  const repositories = extensionFixture();
  const service = createAdminService(repositories);

  // Módulos
  const catalog = await service.moduleInstances.catalog();
  assert.ok(catalog.some((type) => type.key === 'articles-latest' && type.params.some((param) => param.name === 'limit')));
  assert.ok(catalog.some((type) => type.key === 'module-x' && type.params[0].name === 'color'));
  assert.equal((await service.moduleInstances.positions()).template, 'cassiopeia');
  const created = await service.moduleInstances.create({
    title: 'Últimos', extensionKey: 'articles-latest', position: 'sidebar-right', showTitle: false, assignment: 'only', assignmentTokens: ['route:home', 'category:noticias', 'menu:5'],
    publishUp: '2026-01-01T10:00', publishDown: '2026-12-31T10:00', note: 'nota', settings: { limit: 4, moduleClass: 'destaque', headerTag: 'h3' }
  });
  assert.equal(created.showTitle, false);
  assert.equal(created.assignment, 'only');
  assert.deepEqual(JSON.parse(created.assignmentJson), ['route:home', 'category:noticias', 'menu:5']);
  assert.match(created.publishUp, /^2026-01-01T\d\d:00:00\.000Z$/);
  await assert.rejects(() => service.moduleInstances.create({ title: 'x', extensionKey: 'search', position: 'search', publishUp: '2026-05-01', publishDown: '2026-04-01' }), ValidationError);
  await assert.rejects(() => service.moduleInstances.create({ title: 'x', extensionKey: 'search', position: 'search', assignment: 'only', assignmentTokens: ['evil:1'] }), ValidationError);
  await assert.rejects(() => service.moduleInstances.create({ title: 'x', extensionKey: 'search', position: 'search', settings: { moduleClass: '"><script>' } }), ValidationError);
  await assert.rejects(() => service.moduleInstances.create({ title: 'x', extensionKey: 'search', position: 'search', settings: { headerTag: 'script' } }), ValidationError);
  const copy = await service.moduleInstances.duplicate(created.id);
  assert.equal(copy.title, 'Últimos (cópia)');
  assert.equal(copy.enabled, false);
  assert.equal(copy.assignment, 'only');
  const snapshot = async (id) => ({ id, etag: (await service.moduleInstances.get(id)).etag });
  let result = await service.moduleInstances.batch([await snapshot(created.id), await snapshot(copy.id)], 'move', { position: 'footer' });
  assert.deepEqual(result.succeeded, [created.id, copy.id]);
  assert.equal((await service.moduleInstances.get(copy.id)).position, 'footer');
  const copySnapshot = await snapshot(copy.id);
  await assert.rejects(() => service.moduleInstances.batch([copySnapshot], 'move', { position: 'nowhere' }), ValidationError);
  await assert.rejects(() => service.moduleInstances.batch([copySnapshot], 'explode'), ValidationError);
  await assert.rejects(() => service.moduleInstances.batch([{ id: copy.id }], 'publish'), ValidationError);
  result = await service.moduleInstances.batch([await snapshot(copy.id)], 'delete');
  assert.equal(result.failed.length, 1, 'só exclui o que está na lixeira');
  const stale = await snapshot(copy.id);
  await service.moduleInstances.batch([await snapshot(copy.id)], 'trash');
  assert.equal(moduleState(await service.moduleInstances.get(copy.id)), 'trashed');
  result = await service.moduleInstances.batch([stale], 'publish');
  assert.equal(result.failed[0].code, 'concurrency-conflict');
  await service.moduleInstances.batch([await snapshot(copy.id)], 'delete');
  assert.equal(await service.moduleInstances.get(copy.id), null);
  const legacy = await service.moduleInstances.create({ title: 'Legado', extensionKey: 'search', position: 'search' });
  for (const field of ['showTitle', 'trashed', 'publishUp', 'publishDown', 'assignment', 'assignmentJson', 'note']) assert.ok(!(field in repositories.moduleInstances.rows.get(legacy.id)), `campo v2 ${field} omitido quando igual ao padrão`);
  console.log('ok - admin extensions: módulos (catálogo, atribuição, publicação, duplicar, lote, lixeira, ETag)');

  // Plugins
  const plugins = await service.plugins.list();
  assert.deepEqual(plugins.map((plugin) => [plugin.key, plugin.group]), [['links', 'content'], ['audit', 'system']]);
  assert.deepEqual(plugins[0].params, { maxLinks: 3, mode: 'a' });
  const links = await service.plugins.get(2);
  await service.plugins.update(2, { params: { maxLinks: '5', mode: 'b' }, ordering: 4 }, { etag: links.etag });
  assert.deepEqual(JSON.parse(repositories.extensions.rows.get(2).paramsJson), { maxLinks: 5, mode: 'b' });
  assert.equal(repositories.extensions.rows.get(2).ordering, 4);
  await assert.rejects(async () => service.plugins.update(2, { params: { maxLinks: 50 } }, { etag: (await service.plugins.get(2)).etag }), ValidationError);
  await assert.rejects(() => service.plugins.update(2, { enabled: false }, { etag: links.etag }), (error) => error.code === 'concurrency-conflict');
  assert.equal(await service.plugins.get(1), null, 'módulo não é plugin');
  const auditSnapshot = await service.plugins.get(3);
  result = await service.plugins.batch([{ id: 3, etag: auditSnapshot.etag }], 'enable');
  assert.equal((await service.plugins.get(3)).enabled, true);
  console.log('ok - admin extensions: plugins (grupos, ordem, parâmetros, lote, ETag)');

  // Estilos de template
  let styles = await service.templateStyles.list();
  assert.ok(styles.styles.some((style) => style.id === 'cassiopeia-default' && style.isDefault));
  const cassiopeia = await service.templateStyles.get('cassiopeia-default');
  assert.ok(cassiopeia.definitions.some((definition) => definition.name === 'colorName'));
  await service.templateStyles.save('cassiopeia-default', { title: 'Cassiopeia — Padrão', params: { brand: 'logo', logoFile: '/img.png', siteTitle: 'Meu site', colorName: 'alternative', stickyHeader: true } }, { etag: cassiopeia.etag });
  let config = await service.siteConfig.get();
  assert.equal(resolveTemplateParams(config).colorName, 'alternative');
  assert.equal(service.siteConfig.toConfigOverrides(config).templateParams.siteTitle, 'Meu site');
  await assert.rejects(() => service.templateStyles.save('cassiopeia-default', { params: { colorName: 'neon' } }, { etag: config.etag }), ValidationError);
  await assert.rejects(() => service.templateStyles.save('cassiopeia-default', { title: 'x' }, { etag: cassiopeia.etag }), (error) => error.code === 'concurrency-conflict');
  const duplicateId = await service.templateStyles.duplicate('cassiopeia-default', { etag: config.etag });
  assert.equal(duplicateId, 'cassiopeia-2');
  config = await service.siteConfig.get();
  await assert.rejects(() => service.templateStyles.remove('cassiopeia-default', { etag: config.etag }), ValidationError);
  await service.templateStyles.setDefault('camap-default', { etag: config.etag });
  config = await service.siteConfig.get();
  assert.equal(config.templateKey, 'camap');
  assert.deepEqual(Object.keys(resolveTemplateParams(config)).sort(), templateParamDefinitions('camap').map((definition) => definition.name).sort());
  await service.templateStyles.setDefault('cassiopeia-2', { etag: config.etag });
  config = await service.siteConfig.get();
  assert.equal(service.siteConfig.toConfigOverrides(config).templateStyleId, 'cassiopeia-2');
  assert.equal(resolveTemplateParams(config).colorName, 'alternative', 'cópia herda parâmetros');
  await service.templateStyles.remove('cassiopeia-default', { etag: config.etag });
  styles = await service.templateStyles.list();
  assert.ok(!styles.styles.some((style) => style.id === 'cassiopeia-default'));
  console.log('ok - admin extensions: estilos de template (padrão, duplicar, parâmetros, excluir, ETag)');

  // Opções de componente
  const content = await service.componentOptions.get('content');
  assert.equal(content.values.listLimit, 10);
  await service.componentOptions.save('content', { ...content.values, listLimit: 15, showAuthor: false }, { etag: content.etag });
  config = await service.siteConfig.get();
  assert.equal(service.siteConfig.toConfigOverrides(config).componentParams.content.listLimit, 15);
  assert.equal(service.siteConfig.toConfigOverrides(config).componentParams.search.resultsLimit, 10);
  await assert.rejects(() => service.componentOptions.save('content', { listLimit: 15 }, { etag: content.etag }), (error) => error.code === 'concurrency-conflict');
  await assert.rejects(() => service.componentOptions.get('unknown'), ValidationError);
  console.log('ok - admin extensions: opções de componente com ETag');

  // Configuração global
  Object.assign(repositories.siteConfig.rows.get(1), { metaDescription: 'Desc', robots: 'noindex, follow', sitenamePagetitles: 'after' });
  await service.siteConfig.save({ offline: true, offlineMessage: 'Manutenção', metaDescription: 'Desc', robots: 'noindex, follow', sitenamePagetitles: 'after', homeView: 'featured', homeCategory: 'eventos' }, { etag: config.etag });
  const overrides = service.siteConfig.toConfigOverrides(await service.siteConfig.get());
  assert.equal(overrides.offline, true);
  assert.equal(overrides.homeView, 'featured');
  assert.equal(overrides.homeCategory, 'eventos');
  assert.equal(overrides.robots, 'noindex, follow');
  await assert.rejects(async () => service.siteConfig.save({ homeView: 'blog' }, { etag: (await service.siteConfig.get()).etag }), ValidationError);
  await assert.rejects(async () => service.siteConfig.save({ robots: 'evil' }, { etag: (await service.siteConfig.get()).etag }), ValidationError);
  console.log('ok - admin extensions: configuração global operacional preserva metadados/SEO existentes e bloqueia alterações');

  // Instalador
  const manifest = { type: 'Plugin', key: 'share', title: 'Compartilhar', version: '1.0.0', entryPointUrl: './extensions/share.js', group: 'content', params: [{ name: 'network', type: 'select', options: ['x', 'y'] }] };
  assert.equal(parseExtensionManifest(JSON.stringify(manifest)).group, 'content');
  for (const bad of [{ ...manifest, entryPointUrl: 'javascript:alert(1)' }, { ...manifest, entryPointUrl: 'https://evil.example/x.js' }, { ...manifest, type: 'Component' }, { ...manifest, key: 'search', type: 'Module' }, { ...manifest, params: [{ name: 'x', type: 'eval' }] }]) {
    assert.throws(() => service.installer.preview(bad), ValidationError, JSON.stringify(bad));
  }
  assert.throws(() => service.installer.preview('{not json'), ValidationError);
  const installed = await service.installer.install(JSON.stringify(manifest));
  assert.equal(installed.enabled, false, 'instala desabilitado');
  assert.equal(installed.folder, 'content');
  await assert.rejects(() => service.installer.install(manifest), ValidationError, 'chave duplicada');
  const unified = await service.installer.list();
  assert.ok(unified.some((row) => row.kind === 'Component' && row.core));
  assert.ok(unified.some((row) => row.uid === `extension:${installed.id}` && row.version === '1.0.0'));
  assert.equal((await service.plugins.list()).find((plugin) => plugin.key === 'share').definitions[0].name, 'network');
  const overview = await service.overview();
  assert.equal(overview.plugins, 3);
  console.log('ok - admin extensions: instalador por manifesto declarativo e lista unificada');

  // Mapeamentos SPMIDDLE v2
  for (const [domain, fields] of Object.entries({ extensions: ['ordering', 'folder', 'paramsJson', 'manifestJson'], moduleInstances: ['showTitle', 'publishUp', 'publishDown', 'trashed', 'assignment', 'assignmentJson', 'note'], siteConfig: ['offline', 'offlineMessage', 'metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles', 'homeView', 'homeCategory', 'templateStylesJson', 'componentParamsJson'] })) {
    const mapping = MINIJOOMLA_FIELD_MAPPINGS[domain];
    const map = mapping?.fields ?? mapping;
    for (const field of fields) assert.ok(JSON.stringify(map).includes(`"${field}"`), `${domain}.${field} mapeado`);
  }
  console.log('ok - admin extensions: mapeamentos SPMIDDLE v2');
  await runPersistedOptionsRegressionTests();
  await runPersistedPluginRegressionTests();
}
