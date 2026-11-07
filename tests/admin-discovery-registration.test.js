import assert from 'node:assert/strict';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createExtensionDiscoveryService, EXTENSIONS_FOLDER } from '../src/libraries/minijoomla/application/extension-discovery-service.js';

const decode = (value) => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Only the rendered discovery buttons/status exist. Replacing HTML creates new
// elements, so retained buttons reproduce events from a detached, stale screen.
function discoveryDocument() {
  let html = '';
  let buttons = [];
  let status = null;
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      status = value.includes('class="admin-management-status"') ? { textContent: '' } : null;
      buttons = [...value.matchAll(/<button\b([^>]*)>/g)].filter(([, attrs]) => /\bdata-admin-register="/.test(attrs)).map(([, attrs]) => {
        const handlers = new Map();
        const dataset = Object.fromEntries([...attrs.matchAll(/\bdata-([a-z-]+)="([^"]*)"/g)].map(([, name, text]) => [name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), decode(text)]));
        return { dataset, disabled: false,
          addEventListener: (event, handler) => { handlers.set(event, handler); },
          fire: (event) => handlers.get(event)?.({ preventDefault() {} }) };
      });
    },
    querySelector: (selector) => selector === '.admin-management-status' ? status : null,
    querySelectorAll: (selector) => selector === '[data-admin-register]' ? buttons : []
  };
  return { documentRef: { body }, button: (key) => buttons.find((button) => button.dataset.adminRegister === key), buttons: () => buttons, status: () => status };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Confirmation now yields even with the explicitly mocked native fallback.
const flushConfirmation = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function discovered(key = 'sample-plugin', extra = {}) {
  return { key, title: `Title ${key}`, type: 'Plugin', entryPointUrl: `./extensions/${key}.js`, discoveredFrom: `extensions/${key}.manifest.json`, error: null, ...extra };
}

function fixture({ entries = [discovered()], registered = [], scan, list, create } = {}) {
  const writes = [];
  const records = registered.map((row) => structuredClone(row));
  let scans = 0;
  const adminService = { extensions: {
    list: list ?? (async () => records),
    create: async (input) => {
      writes.push(structuredClone(input));
      const row = create ? await create(input) : { id: records.length + 1, etag: '"1"', ...input };
      records.push(row);
      return row;
    }
  } };
  const doc = discoveryDocument();
  const app = createAdminApplication({ adminService, discoveryService: { scan: async () => { scans++; return scan ? scan() : entries; } }, documentRef: doc.documentRef, autoStart: false });
  return { app, doc, writes, records, adminService, scans: () => scans };
}

async function registrationMetadataTests() {
  for (const [type, manifestJson, folder] of [
    ['Plugin', '{ "group": "system", "params": [{"name":"mode","type":"text","default":"safe"}], "future": {"keep":true} }', 'system'],
    ['Plugin', '{"params":[]}', 'content'],
    ['Plugin', undefined, 'content'],
    ['Module', '{"group":"system","params":[]}', '']
  ]) {
    const entry = discovered('metadata', { type, manifestJson });
    const f = fixture({ entries: [entry] });
    try {
      await f.app.router.navigate('#/extensions/discover');
      assert.match(f.doc.documentRef.body.innerHTML, /Registrar adiciona a extensão desabilitada/);
      assert.match(f.doc.documentRef.body.innerHTML, /depois habilite-a em Extensões registradas/);
      assert.match(f.doc.documentRef.body.innerHTML, /Não há upload ou execução de código nesta etapa/);
      if (type === 'Module') {
        assert.match(f.doc.documentRef.body.innerHTML, /\(Módulo\) — <button/);
        assert.equal(f.doc.button(entry.key).dataset.adminRegisterType, 'Module', 'localized display preserves the registration enum');
      }
      await f.doc.button(entry.key).fire('click');
      assert.deepEqual(f.writes, [{ title: entry.title, key: entry.key, type, entryPointUrl: entry.entryPointUrl,
        discoveredFrom: entry.discoveredFrom, enabled: false, manifestJson: manifestJson || '{}', folder }]);
      assert.equal(f.records[0].enabled, false);
      assert.equal(f.scans(), 2, 'successful registration reloads discovery once');
      assert.equal(f.doc.button(entry.key), undefined, 'registered entries disappear on reload');
    } finally { f.app.stop(); }
  }

  console.log('ok - admin discovery: disabled registration preserves manifest metadata and plugin group, including legacy defaults');
}

function memoryRepository(seed = []) {
  const rows = new Map(seed.map((row) => [row.id, structuredClone(row)]));
  const writes = [];
  let nextId = Math.max(0, ...rows.keys()) + 1;
  let version = 1;
  return { writes,
    async findMany() { return { items: [...rows.values()].map(({ etag, ...row }) => structuredClone(row)) }; },
    async findById(id) { return structuredClone(rows.get(id)); },
    async create(input) {
      writes.push({ operation: 'create', input: structuredClone(input) });
      const row = { id: nextId++, etag: `"created-${version++}"`, ...structuredClone(input) };
      rows.set(row.id, row);
      return structuredClone(row);
    },
    async update(id, input, { etag } = {}) {
      const row = rows.get(id);
      if (etag !== row.etag) throw Object.assign(new Error('ETag mismatch'), { code: 'concurrency-conflict' });
      writes.push({ operation: 'update', id, input: structuredClone(input), etag });
      const updated = { ...row, ...structuredClone(input), etag: `"updated-${version++}"` };
      rows.set(id, updated);
      return structuredClone(updated);
    }
  };
}

async function realDiscoveryRegistrationTests() {
  const legacyRows = [
    { id: 11, etag: '"legacy-11"', key: 'legacy-plugin', title: 'Legacy plugin', type: 'Plugin', entryPointUrl: './legacy.js', enabled: true },
    { id: 12, etag: '"legacy-12"', key: 'existing-plugin', title: 'Existing plugin', type: 'Plugin', entryPointUrl: './existing.js', enabled: false,
      manifestJson: ' \n{ "version": "old", "group": "content", "future": { "untouched": true }, "params": [] }\t', paramsJson: ' { "old-setting": "preserve" } ', futureColumn: { keep: true } }
  ];
  const pluginRaw = ' \r\n{\n "key": "wrong-key", "title": "  Persisted ç Plugin  ", "type": " Plugin ", "entryPointUrl": " ./extensions/persisted-plugin.js ",\n "group": "system", "version": "1.3", "description": "Pure metadata", "future": { "keep": true, "nested": [1, {"x":"  unchanged  "}] },\n "params": [{"name":" label ","type":"text","default":"Safe","future":"preserved"}, {"name":"limit","type":"number","min":1,"max":5,"default":"2"}, {"name":"active","type":"checkbox","default":"true"}]\n}\t';
  const moduleRaw = JSON.stringify({ title: 'Declared module', type: 'Module', entryPointUrl: './extensions/declared-module.js', group: { moduleMetadata: true }, future: 'keep', params: [{ name: 'limit', type: 'number', default: 3 }] });
  const files = {
    'persisted-plugin.manifest.json': pluginRaw,
    'legacy-group.manifest.json': '{"title":"Legacy group","type":"Plugin","entryPointUrl":"./legacy-group.js","params":[]}',
    'empty-group.manifest.json': '{"title":"Empty group","type":"Plugin","entryPointUrl":"./empty-group.js","group":""}',
    'declared-module.manifest.json': moduleRaw,
    'existing-plugin.manifest.json': '{"title":"New metadata must not replace the existing record","type":"Plugin","entryPointUrl":"./replacement.js","group":"system"}',
    'invalid-params.manifest.json': '{"title":"Invalid params","type":"Plugin","entryPointUrl":"./invalid.js","params":[{"name":"x"},{"name":"x"}]}',
    'invalid-group.manifest.json': '{"title":"Invalid group","type":"Plugin","entryPointUrl":"./invalid.js","group":"../system"}',
    'persisted-plugin.js': 'throw new Error("Must not execute during registration");'
  };
  const downloads = [];
  const discoveryService = createExtensionDiscoveryService({
    async listFiles({ folderPath }) {
      assert.equal(folderPath, EXTENSIONS_FOLDER);
      return { data: { value: Object.keys(files).map((Name) => ({ Name })) } };
    },
    async downloadFile({ folderPath, fileName }) {
      assert.equal(folderPath, EXTENSIONS_FOLDER);
      assert.ok(fileName.endsWith('.manifest.json'), 'the whole registration flow never downloads JS');
      downloads.push(fileName);
      return { data: new TextEncoder().encode(files[fileName]).buffer };
    }
  });
  const extensions = memoryRepository(legacyRows);
  const moduleInstances = memoryRepository();
  const service = createAdminService({ extensions, moduleInstances });
  const doc = discoveryDocument();
  const app = createAdminApplication({ adminService: service, discoveryService, documentRef: doc.documentRef, autoStart: false });
  try {
    const scanned = await discoveryService.scan();
    assert.equal(scanned.find((entry) => entry.key === 'persisted-plugin').manifestJson, pluginRaw);
    assert.equal(scanned.find((entry) => entry.key === 'declared-module').manifestJson, moduleRaw);
    const unregistered = await discoveryService.scanUnregistered(await service.extensions.list());
    assert.equal(unregistered.some((entry) => entry.key === 'existing-plugin'), false);
    assert.equal(extensions.writes.length, 0);
    await app.router.navigate('#/extensions/discover');
    assert.deepEqual(doc.buttons().map((button) => button.dataset.adminRegister), ['persisted-plugin', 'legacy-group', 'empty-group', 'declared-module']);
    assert.equal(doc.button('invalid-params'), undefined);
    assert.equal(doc.button('invalid-group'), undefined);
    assert.equal(doc.button('existing-plugin'), undefined);
    assert.equal(extensions.writes.length, 0, 'scan/render must not register or rewrite any records');
    for (const key of ['persisted-plugin', 'legacy-group', 'empty-group', 'declared-module']) {
      await doc.button(key).fire('click');
      assert.equal(doc.button(key), undefined, 'successful registration hides the now-registered filename key');
    }
    const rows = await service.extensions.list();
    const plugin = rows.find((row) => row.key === 'persisted-plugin');
    assert.equal(plugin.title, 'Persisted ç Plugin');
    assert.equal(plugin.type, 'Plugin');
    assert.equal(plugin.entryPointUrl, './extensions/persisted-plugin.js');
    assert.equal(plugin.discoveredFrom, 'extensions/persisted-plugin.manifest.json');
    assert.equal(plugin.folder, 'system');
    assert.equal(plugin.enabled, false);
    // The discovery returns raw JSON; the existing service still serializes it
    // canonically at persistence. Unknown data/definition fields remain intact.
    assert.equal(plugin.manifestJson, JSON.stringify(JSON.parse(pluginRaw)));
    assert.deepEqual(JSON.parse(plugin.manifestJson), JSON.parse(pluginRaw));
    assert.equal(JSON.parse(plugin.manifestJson).params[0].name, ' label ');
    assert.equal(Object.hasOwn(plugin, 'paramsJson'), false, 'definitions do not create instance values during registration');
    assert.equal(rows.find((row) => row.key === 'legacy-group').folder, 'content');
    assert.equal(rows.find((row) => row.key === 'empty-group').folder, 'content');
    const module = rows.find((row) => row.key === 'declared-module');
    assert.equal(module.enabled, false);
    assert.equal(module.folder ?? '', '', 'Module group metadata is never used as a plugin folder');
    assert.equal(module.manifestJson, moduleRaw);
    assert.equal(extensions.writes.length, 4);
    assert.ok(extensions.writes.every((write) => write.operation === 'create' && write.input.enabled === false));

    const view = await service.plugins.get(plugin.id);
    assert.equal(view.group, 'system');
    assert.equal(view.version, '1.3');
    assert.deepEqual(view.definitions.map(({ name, type, default: value }) => ({ name, type, value })), [
      { name: 'label', type: 'text', value: 'Safe' }, { name: 'limit', type: 'number', value: 2 }, { name: 'active', type: 'checkbox', value: true }
    ]);
    assert.deepEqual(view.params, { label: 'Safe', limit: 2, active: true }, 'persisted definitions are consumed by the real plugin service');
    assert.equal(view.etag.startsWith('"created-'), true);
    const listed = (await service.plugins.list()).find((row) => row.id === plugin.id);
    assert.deepEqual(listed.params, view.params);
    assert.equal(listed.etag, undefined, 'list responses do not invent ETags');
    assert.equal(extensions.writes.length, 4, 'reading defaults never materializes params or rewrites manifests');
    const moduleType = (await service.moduleInstances.catalog()).find((entry) => entry.key === module.key);
    assert.equal(moduleType.params[0].default, 3, 'Module definitions are consumed by the module catalog too');
    const remaining = await discoveryService.scanUnregistered(rows);
    assert.deepEqual(remaining.map((entry) => entry.key), ['invalid-params', 'invalid-group']);
    assert.ok(remaining.every((entry) => entry.type === null && entry.entryPointUrl === null && !Object.hasOwn(entry, 'manifestJson')));

    await assert.rejects(() => service.plugins.update(plugin.id, { params: { label: 'Updated' } }), /etag/);
    await assert.rejects(() => service.plugins.update(plugin.id, { params: { limit: 99 } }, { etag: view.etag }), /menor ou igual/);
    await assert.rejects(() => service.plugins.update(plugin.id, { params: { label: 'Updated' } }, { etag: '"stale"' }), (error) => error.code === 'concurrency-conflict');
    assert.equal(extensions.writes.length, 4, 'invalid params or ETags never mutate persistence');
    await service.plugins.update(plugin.id, { params: { label: 'Updated', limit: '4', active: 'false' } }, { etag: view.etag });
    const updated = await service.plugins.get(plugin.id);
    assert.deepEqual(updated.params, { label: 'Updated', limit: 4, active: false });
    assert.notEqual(updated.etag, view.etag);
    assert.equal(updated.enabled, false, 'saving params never enables the discovered plugin');
    assert.equal(updated.manifestJson, plugin.manifestJson, 'editing values does not rewrite definitions or unknown metadata');
    assert.deepEqual(extensions.writes.at(-1), { operation: 'update', id: plugin.id, input: { paramsJson: '{"label":"Updated","limit":4,"active":false}' }, etag: view.etag });
    await assert.rejects(() => service.plugins.update(plugin.id, { enabled: true }, { etag: view.etag }), (error) => error.code === 'concurrency-conflict');
    for (const row of legacyRows) assert.deepEqual(await service.extensions.get(row.id), row, 'old fields, raw JSON and ETags remain untouched throughout discovery/registration');
    assert.equal(moduleInstances.writes.length, 0, 'registering a Module never creates an instance');
    assert.ok(downloads.length > 0);
  } finally { app.stop(); }
  console.log('ok - admin discovery: real scan -> admin app -> in-memory repositories registers disabled metadata/definitions and preserves legacy records/ETags');
}

async function pinnedConsumerCompatibilityTests(confirmMessages) {
  const otherPlugin = { id: 21, etag: '"other-21"', key: 'other-plugin', title: 'Other plugin', type: 'Plugin', entryPointUrl: './other.js', enabled: true,
    folder: 'content', manifestJson: ' {"params":[],"future":{"keep":true}} ', paramsJson: ' {"legacy":"keep"} ' };
  const files = {};
  const invalidKeys = [];
  const addInvalid = (key, metadata) => {
    invalidKeys.push(key);
    files[`${key}.manifest.json`] = JSON.stringify({ title: 'Invalid', type: 'Plugin', entryPointUrl: './invalid.js', ...metadata });
  };
  for (const [index, group] of [[], [null], ['content'], true, false, 0, 1, {}, { value: 'content' }, ' ', '\t\r\n', '\u00a0'].entries()) addInvalid(`invalid-group-${index}`, { group });
  let index = 0;
  for (const type of ['Plugin', 'Module']) {
    for (const name of Object.getOwnPropertyNames(Object.prototype)) {
      const definitions = [{ name: ` \t${name}\r\n`, type: 'checkbox', default: false }];
      for (const params of [definitions, JSON.stringify(definitions)]) addInvalid(`invalid-param-${index++}`, { type, params });
    }
  }
  const valid = [
    { key: 'null-group', type: 'Plugin', group: null, folder: 'content', params: [{ name: ' label ', type: 'text', default: 'Safe', future: true }] },
    { key: 'empty-group', type: 'Plugin', group: '', folder: 'content', params: '[{"name":" active ","type":"checkbox","default":false}]' },
    { key: 'padded-group', type: 'Plugin', group: ' \tsystem\r\n', folder: 'system', params: [{ name: 'limit', type: 'number', default: 2 }] },
    { key: 'valid-module', type: 'Module', group: { uninterpreted: true }, folder: '', params: '[{"name":" mode ","type":"select","options":["safe"],"default":"safe"}]' }
  ];
  for (const entry of valid) {
    entry.raw = ` \r\n${JSON.stringify({ title: entry.key, type: entry.type, entryPointUrl: `./${entry.key}.js`, group: entry.group, params: entry.params, future: { keep: '  raw  ' }, enabled: true })}\t`;
    files[`${entry.key}.manifest.json`] = entry.raw;
  }
  files['never-execute.js'] = 'throw new Error("Discovery must not execute JS");';
  const discovery = createExtensionDiscoveryService({
    async listFiles({ folderPath }) {
      assert.equal(folderPath, EXTENSIONS_FOLDER);
      return { data: { value: Object.keys(files).map((Name) => ({ Name })) } };
    },
    async downloadFile({ folderPath, fileName }) {
      assert.equal(folderPath, EXTENSIONS_FOLDER);
      assert.ok(fileName.endsWith('.manifest.json'), 'compatibility validation downloads manifest data only');
      return { data: new TextEncoder().encode(files[fileName]).buffer };
    }
  });
  const extensions = memoryRepository([otherPlugin]);
  const moduleInstances = memoryRepository();
  const service = createAdminService({ extensions, moduleInstances });
  const doc = discoveryDocument();
  const app = createAdminApplication({ adminService: service, discoveryService: discovery, documentRef: doc.documentRef, autoStart: false });
  try {
    const scanned = await discovery.scan();
    for (const key of invalidKeys) {
      const entry = scanned.find((item) => item.key === key);
      assert.ok(entry.error, `${key} must fail before reaching the pinned consumer`);
      assert.equal(entry.type, null);
      assert.equal(entry.entryPointUrl, null);
      assert.equal(Object.hasOwn(entry, 'manifestJson'), false);
    }
    for (const entry of valid) assert.equal(scanned.find((item) => item.key === entry.key).manifestJson, entry.raw, 'validation preserves raw metadata and untrimmed definition names');
    await app.router.navigate('#/extensions/discover');
    assert.deepEqual(doc.buttons().map((button) => button.dataset.adminRegister), valid.map((entry) => entry.key));
    const button = doc.button(valid[0].key);
    const confirmationsBefore = confirmMessages.length;
    for (const key of invalidKeys) {
      assert.equal(doc.button(key), undefined, 'invalid compatibility entries have no registration button');
      button.dataset.adminRegister = key;
      await button.fire('click');
    }
    assert.equal(confirmMessages.length, confirmationsBefore, 'failed entries cannot prompt even via a tampered valid button');
    assert.equal(extensions.writes.length, 0, 'scan/render/rejected registration performs zero writes');
    assert.deepEqual((await service.plugins.list()).map((row) => row.key), [otherPlugin.key], 'another plugin remains readable with rejected manifests present');
    button.dataset.adminRegister = valid[0].key;
    for (const entry of valid) {
      await doc.button(entry.key).fire('click');
      assert.equal(doc.button(entry.key), undefined);
    }
    const rows = await service.extensions.list();
    for (const entry of valid) {
      const row = rows.find((item) => item.key === entry.key);
      assert.equal(row.enabled, false, 'raw enabled metadata never overrides explicit disabled registration');
      assert.equal(row.folder ?? '', entry.folder);
      assert.equal(row.manifestJson, JSON.stringify(JSON.parse(entry.raw)), 'only the unchanged real service serializes metadata at persistence');
      assert.equal(Object.hasOwn(row, 'paramsJson'), false);
      if (entry.type === 'Plugin') assert.equal((await service.plugins.get(row.id)).group, entry.folder);
    }
    const plugins = await service.plugins.list();
    assert.equal(plugins.length, 4, 'list/sort succeeds with another plugin and all compatible registrations');
    assert.deepEqual(plugins.find((row) => row.key === 'null-group').params, { label: 'Safe' });
    assert.deepEqual(plugins.find((row) => row.key === 'empty-group').params, { active: false });
    assert.deepEqual(plugins.find((row) => row.key === 'padded-group').params, { limit: 2 });
    assert.equal((await service.moduleInstances.catalog()).find((entry) => entry.key === 'valid-module').params[0].default, 'safe');
    assert.deepEqual((await discovery.scanUnregistered(rows)).map((entry) => entry.key), invalidKeys);
    assert.equal(extensions.writes.length, valid.length);
    assert.ok(extensions.writes.every((write) => write.operation === 'create' && write.input.enabled === false));
    assert.equal(moduleInstances.writes.length, 0);
    assert.deepEqual(await service.extensions.get(otherPlugin.id), otherPlugin, 'the existing plugin metadata, values and ETag remain unchanged');
  } finally { app.stop(); }
  console.log('ok - admin discovery: pinned-consumer incompatible groups/names expose no metadata/button or writes; compatible raw manifests register disabled and remain readable beside another plugin');
}

async function trustedEntriesTests(confirmMessages) {
  const entry = discovered('trusted-plugin', { title: 'Trusted <title> & "label"', manifestJson: '{"group":"system"}' });
  const snapshot = structuredClone(entry);
  const broken = discovered('broken', { error: 'Unreadable <script>details</script>' });
  const f = fixture({ entries: [entry, broken, discovered('existing')], registered: [{ key: 'existing' }] });
  try {
    await f.app.router.navigate('#/extensions/discover');
    assert.equal(f.doc.buttons().length, 1);
    assert.match(f.doc.documentRef.body.innerHTML, /Trusted &lt;title&gt; &amp; &quot;label&quot;/);
    assert.match(f.doc.documentRef.body.innerHTML, /Unreadable &lt;script&gt;details&lt;\/script&gt;/);
    assert.doesNotMatch(f.doc.documentRef.body.innerHTML, /<script>/);
    const button = f.doc.button(entry.key);
    const count = confirmMessages.length;
    Object.assign(button.dataset, { adminRegisterTitle: 'Injected', adminRegisterType: 'Module', adminRegisterEntry: 'javascript:injected()', adminRegisterFrom: 'untrusted', adminRegisterManifest: '{"group":"injected"}', adminRegisterEnabled: 'true' });
    for (const key of ['unscanned', 'broken', 'existing']) {
      button.dataset.adminRegister = key;
      await button.fire('click');
      assert.equal(f.writes.length, 0, 'unknown, failed and already registered entries cannot be submitted');
      assert.equal(confirmMessages.length, count, 'invalid entry does not even prompt for confirmation');
    }
    button.dataset.adminRegister = entry.key;
    entry.title = 'Changed after scan';
    entry.entryPointUrl = './replacement.js';
    entry.manifestJson = '{"group":"changed"}';
    await button.fire('click');
    assert.deepEqual(f.writes[0], { title: snapshot.title, key: snapshot.key, type: snapshot.type, entryPointUrl: snapshot.entryPointUrl,
      discoveredFrom: snapshot.discoveredFrom, enabled: false, manifestJson: snapshot.manifestJson, folder: 'system' }, 'the scanned metadata snapshot cannot change after rendering');
    assert.match(confirmMessages.at(-1), /extensão desabilitada/);
    assert.match(confirmMessages.at(-1), /origem do manifesto é confiável/);
    assert.match(confirmMessages.at(-1), /habilitação será uma ação separada/);
  } finally { f.app.stop(); }
  console.log('ok - admin discovery: tampered datasets cannot inject registration metadata or bypass trusted scan entries');
}

async function confirmationAndBusyTests(confirmMessages) {
  const originalConfirm = globalThis.confirm;
  const f = fixture();
  try {
    await f.app.router.navigate('#/extensions/discover');
    const button = f.doc.button('sample-plugin');
    globalThis.confirm = () => false;
    await button.fire('click');
    assert.equal(f.writes.length, 0);
    assert.equal(button.disabled, false);
    globalThis.confirm = undefined;
    await button.fire('click');
    assert.equal(f.writes.length, 0, 'no confirmation implementation fails closed');
    globalThis.confirm = originalConfirm;
    const count = confirmMessages.length;
    button.disabled = true;
    await button.fire('click');
    assert.equal(f.writes.length, 0);
    assert.equal(confirmMessages.length, count);
  } finally { globalThis.confirm = originalConfirm; f.app.stop(); }

  const pending = deferred();
  const busy = fixture({ create: () => pending.promise });
  try {
    await busy.app.router.navigate('#/extensions/discover');
    const button = busy.doc.button('sample-plugin');
    const first = button.fire('click');
    await flushConfirmation();
    assert.equal(button.disabled, true);
    await button.fire('click');
    assert.equal(busy.writes.length, 1, 'a pending create cannot be sent twice');
    pending.resolve({ key: 'sample-plugin', enabled: false });
    await first;
    assert.equal(button.disabled, false);
  } finally { busy.app.stop(); }
  console.log('ok - admin discovery: cancellation, absent confirmation and disabled/pending buttons prevent writes');
}

async function failureTests() {
  for (const failed of ['scan', 'list']) {
    let failing = true;
    const fail = async () => { if (failing) throw new Error('private backend <script>details</script>'); return failed === 'scan' ? [discovered()] : []; };
    const f = fixture({ [failed]: fail });
    try {
      await f.app.router.navigate('#/extensions/discover');
      assert.match(f.doc.documentRef.body.innerHTML, /role="alert">Não foi possível consultar a pasta de extensões ou o catálogo/);
      assert.match(f.doc.documentRef.body.innerHTML, /Verifique o caminho e as permissões/);
      assert.match(f.doc.documentRef.body.innerHTML, /Nenhum registro foi alterado/);
      assert.doesNotMatch(f.doc.documentRef.body.innerHTML, /private backend|<script>|data-admin-register=/);
      assert.equal(f.writes.length, 0);
      failing = false;
      await f.app.router.navigate('#/extensions/discover');
      assert.ok(f.doc.button('sample-plugin'), 'retry after a read failure restores registration');
    } finally { f.app.stop(); }
  }
  for (const options of [
    { entries: [discovered('sample-plugin', { manifestJson: '{broken' })] },
    { create: async () => { throw new Error('private write details'); } }
  ]) {
    const f = fixture(options);
    try {
      await f.app.router.navigate('#/extensions/discover');
      const button = f.doc.button('sample-plugin');
      await button.fire('click');
      assert.equal(f.records.length, 0);
      assert.equal(f.scans(), 1, 'failed registration does not navigate');
      assert.equal(f.doc.status().textContent, 'Não foi possível registrar a extensão.');
      assert.match(f.doc.documentRef.body.innerHTML, /role="status" aria-live="polite" class="admin-management-status"/);
      assert.equal(button.disabled, false);
      if (options.entries) assert.equal(f.writes.length, 0, 'invalid metadata fails before create');
    } finally { f.app.stop(); }
  }
  console.log('ok - admin discovery: scan/catalog and registration failures are accessible, safe and retryable');
}

async function staleNavigationTests(confirmMessages, alerts) {
  for (const invalidate of ['navigate', 'stop']) {
    const f = fixture();
    try {
      await f.app.router.navigate('#/extensions/discover');
      const button = f.doc.button('sample-plugin');
      if (invalidate === 'navigate') await f.app.router.navigate('#/unrelated');
      else f.app.stop();
      const count = confirmMessages.length;
      await button.fire('click');
      assert.equal(f.writes.length, 0, 'stale handlers never initiate a create');
      assert.equal(confirmMessages.length, count, 'stale handlers never prompt');
    } finally { f.app.stop(); }
  }

  for (const outcome of ['resolve', 'reject']) {
    const pending = deferred();
    const f = fixture({ create: () => pending.promise });
    try {
      await f.app.router.navigate('#/extensions/discover');
      const button = f.doc.button('sample-plugin');
      const click = button.fire('click');
      await flushConfirmation();
      assert.equal(f.writes.length, 1, 'already initiated writes cannot be undone by navigation');
      await f.app.router.navigate('#/extensions/discover');
      const currentStatus = f.doc.status();
      const currentHtml = f.doc.documentRef.body.innerHTML;
      if (outcome === 'resolve') pending.resolve({ key: 'sample-plugin', enabled: false });
      else pending.reject(new Error('obsolete registration failure'));
      await click;
      assert.equal(f.scans(), 2, 'completion of an obsolete create must not reload the new screen');
      assert.equal(currentStatus.textContent, '', 'obsolete errors must not report on the new screen');
      assert.equal(f.doc.documentRef.body.innerHTML, currentHtml);
      assert.equal(button.disabled, false);
    } finally { f.app.stop(); }
  }

  for (const outcome of ['resolve', 'reject']) {
    const pending = deferred();
    const started = deferred();
    const f = fixture({ scan: () => { started.resolve(); return pending.promise; } });
    try {
      const oldNavigation = f.app.router.navigate('#/extensions/discover');
      await started.promise;
      await f.app.router.navigate('#/unrelated');
      const currentHtml = f.doc.documentRef.body.innerHTML;
      if (outcome === 'resolve') pending.resolve([discovered()]);
      else pending.reject(new Error('obsolete scan failure'));
      await oldNavigation;
      assert.equal(f.doc.documentRef.body.innerHTML, currentHtml, 'stale scan results/errors never replace a newer route');
      assert.equal(f.writes.length, 0);
      assert.equal(f.doc.buttons().length, 0);
    } finally { f.app.stop(); }
  }
  assert.deepEqual(alerts, [], 'discovery never uses native alerts');
  console.log('ok - admin discovery: stale navigation/stop prevents new writes, prompts, reloads and cross-screen errors');
}

// XML candidates go through the installer (install/upgrade/rollback) with the
// ETag captured while rendering; legacy JSON manifests keep using the catalogue.
async function xmlCandidateTests(confirmMessages) {
  const candidate = (extra) => ({ key: 'corpmessage', title: 'Corp message', type: 'Module', entryPointUrl: './modules/corpmessage.js', discoveredFrom: 'extensions/corpmessage/module.xml', error: null, candidateId: 'cand-1', fingerprint: 'new', version: '0.1.1', ...extra });
  const installedRow = (miniJoomla) => ({ id: 5, key: 'corpmessage', etag: '"installed"', manifestJson: JSON.stringify({ version: '0.1.0', miniJoomla }) });
  const build = ({ entries, registered = [], report, installer }) => {
    const calls = [];
    const rows = registered;
    const adminService = { extensions: {
      list: async () => rows.map(({ id, key }) => ({ id, key })),
      get: async (id) => rows.find((row) => row.id === id),
      create: async (input) => { calls.push({ op: 'create', input }); return { id: 9, etag: '"9"', ...input }; }
    } };
    const discoveryService = { scanReport: async () => report ?? { entries, complete: true, issues: [] } };
    if (installer !== null) discoveryService.installer = {
      install: async (entry) => { calls.push({ op: 'install', entry }); },
      upgrade: async (id, entry, options) => { calls.push({ op: 'upgrade', id, version: entry.targetVersion, options }); },
      rollback: async (id, options) => { calls.push({ op: 'rollback', id, options }); }
    };
    const doc = discoveryDocument();
    const app = createAdminApplication({ adminService, discoveryService, documentRef: doc.documentRef, autoStart: false });
    return { app, doc, calls };
  };

  const fresh = build({ entries: [candidate()] });
  try {
    await fresh.app.router.navigate('#/extensions/discover');
    assert.match(fresh.doc.documentRef.body.innerHTML, /Registrar<\/button><small> 0.1.1 · extensions\/corpmessage\/module.xml<\/small>/);
    await fresh.doc.button('corpmessage').fire('click');
    assert.deepEqual(fresh.calls.map(({ op }) => op), ['install'], 'a new XML candidate installs through the installer, never through extensions.create');
  } finally { fresh.app.stop(); }

  const upgrade = build({ entries: [candidate()], registered: [installedRow({ fingerprint: 'old', inventoryHash: 'hash' })] });
  try {
    await upgrade.app.router.navigate('#/extensions/discover');
    assert.match(upgrade.doc.documentRef.body.innerHTML, /Atualizar<\/button><small> 0.1.0 → 0.1.1 ·/);
    await upgrade.doc.button('corpmessage').fire('click');
    assert.deepEqual(upgrade.calls, [{ op: 'upgrade', id: 5, version: '0.1.1', options: { etag: '"installed"' } }], 'upgrade keeps the ETag captured while rendering');
    assert.ok(confirmMessages.at(-1).startsWith('Atualizar a versao'));
  } finally { upgrade.app.stop(); }

  const rollback = build({ entries: [candidate()], registered: [installedRow({ fingerprint: 'new', inventoryHash: 'hash', previousRevision: { manifest: { version: '0.0.9' }, entryPointUrl: './modules/corpmessage-0.0.9.js' } })] });
  try {
    await rollback.app.router.navigate('#/extensions/discover');
    assert.match(rollback.doc.documentRef.body.innerHTML, /Reverter versão<\/button><small> 0.1.0 → 0.0.9 · .\/modules\/corpmessage-0.0.9.js<\/small>/);
    await rollback.doc.button('corpmessage').fire('click');
    assert.deepEqual(rollback.calls, [{ op: 'rollback', id: 5, options: { etag: '"installed"' } }]);
    assert.ok(confirmMessages.at(-1).startsWith('Reverter a versao'));
  } finally { rollback.app.stop(); }

  const withoutInstaller = build({ entries: [candidate()], installer: null });
  try {
    await withoutInstaller.app.router.navigate('#/extensions/discover');
    await withoutInstaller.doc.button('corpmessage').fire('click');
    assert.deepEqual(withoutInstaller.calls, [], 'without an installer no write happens on any path');
    assert.equal(withoutInstaller.doc.status().textContent, 'Instalador XML nao configurado.');
  } finally { withoutInstaller.app.stop(); }

  const interrupted = build({ entries: [], report: { entries: [], complete: false, issues: [{ rootId: 'raiz<&', error: 'Acesso negado' }] } });
  try {
    await interrupted.app.router.navigate('#/extensions/discover');
    const html = interrupted.doc.documentRef.body.innerHTML;
    assert.match(html, /<div role="alert">Busca incompleta<ul><li>raiz&lt;&amp;: Acesso negado<\/li>/);
    assert.match(html, /Busca interrompida; verifique as origens\./);
    assert.equal(interrupted.doc.buttons().length, 0);
  } finally { interrupted.app.stop(); }

  console.log('ok - admin discovery: XML candidates install/upgrade/rollback with captured ETags; incomplete scans are reported without writes');
}

export async function runAdminDiscoveryRegistrationTests() {
  const originalConfirm = globalThis.confirm;
  const originalAlert = globalThis.alert;
  const confirmMessages = [];
  const alerts = [];
  globalThis.confirm = (message) => { confirmMessages.push(message); return true; };
  globalThis.alert = (message) => { alerts.push(message); };
  try {
    await registrationMetadataTests();
    await realDiscoveryRegistrationTests();
    await pinnedConsumerCompatibilityTests(confirmMessages);
    await trustedEntriesTests(confirmMessages);
    await confirmationAndBusyTests(confirmMessages);
    await failureTests();
    await staleNavigationTests(confirmMessages, alerts);
    await xmlCandidateTests(confirmMessages);
  } finally { globalThis.confirm = originalConfirm; globalThis.alert = originalAlert; }
}
