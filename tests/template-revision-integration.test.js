import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMiniJoomlaAdminApp } from '../src/libraries/minijoomla/composition/createMiniJoomlaAdminApp.js';
import { createSharePointTemplateRevisionFiles } from '../src/libraries/minijoomla/infrastructure/sharepoint-template-revision-files.js';
import { toSharePointFileTransport } from '../src/libraries/minijoomla/infrastructure/sharepoint-media-folder.js';
import { createSharePointFileClient } from '../../SPMIDDLE/packages/sharepoint-files/src/index.js';

// Real composition, list/file clients, mapper and repositories; ONLY the REST
// transport is in memory. This is not tenant/API/LIVE or cross-list atomicity proof.
const WEB = '/teams/revision-integration';
const OLD = `${WEB}/SiteAssets/templates/sample/1.0.0/`;
const BASE = `${WEB}/SiteAssets/templates/sample/1.0.1/`;
const encode = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const slots = ['hero', 'menu-principal', 'main-top', 'footer'];
const defs = [{ name: 'accent', type: 'text', default: 'blue', future: { retain: true } }];
const assertTransport = (record, tag) => {
  assert.ok(Object.isFrozen(record));
  assert.deepEqual(Object.getOwnPropertyDescriptor(record, 'etag'), {
    value: tag, enumerable: false, writable: false, configurable: false
  });
  assert.ok(!Object.keys(record).includes('etag'));
};
const status = (result, expected) => assert.equal(result.status, expected, result.message);

function fixture({ legacy = false, missingFactory = false, factory } = {}) {
  const names = ['articles', 'categories', 'templates', 'siteConfig'];
  const tables = new Map(names.map(name => [name, new Map()]));
  tables.get('templates').set(7, {
    Id: 7, Title: 'Keep title', Key: 'sample-template', Version: '1.0.0',
    EntryPointUrl: `${OLD}index.js`, Enabled: false, DiscoveredFrom: `${OLD}manifest.json`,
    PositionsJson: JSON.stringify(slots), ParamDefinitionsJson: JSON.stringify(defs),
    Styles: legacy ? ` [ "${OLD}theme.css" ]\n` : JSON.stringify({
      format: 'minijoomla-template-metadata-v1', styles: [`${OLD}theme.css`],
      paramDefinitions: defs, future: { opaque: ['retain', 2] }
    }), UnknownWireMetadata: 'untouched by the three-field PATCH', __etag: '"template-1"'
  });
  tables.get('siteConfig').set(1, {
    Id: 1, Title: 'config', TemplateKey: 'sample-template',
    TemplateStylesJson: ' [{"id":"sample-home","template":"sample-template","title":"Home","home":true,"params":{"accent":"blue","future":"retain"}}] ',
    ComponentParamsJson: '{"home":{"showComponent":false}}',
    UnknownWireMetadata: 'config not writable here', __etag: '"config-1"'
  });
  const files = new Map([
    [`${OLD}index.js`, encode('throw new Error("legacy must not execute");')],
    [`${OLD}theme.css`, encode('body { color: black; }')],
    [`${BASE}index.js`, encode('throw new Error("candidate must not execute"); import "./not-in-inventory.js";')],
    [`${BASE}theme.css`, encode('body { color: navy; }')],
    [`${BASE}extra.txt`, encode('explicit inventory asset')],
    [`${WEB}/root.txt`, encode('root web file')],
    ['/root.txt', encode('tenant root file')]
  ]);
  const manifest = { key: 'sample-template', title: 'New title is not a patch', version: '1.0.1',
    positions: slots, paramDefinitions: defs, entryPointUrl: `${BASE}index.js`, styles: [`${BASE}theme.css`] };
  files.set(`${BASE}manifest.json`, encode(manifest));
  const inventory = { version: '1.0.1', algorithm: 'sha256', files: ['manifest.json', 'index.js', 'theme.css', 'extra.txt']
    .map(path => { const bytes = files.get(`${BASE}${path}`); return { path, bytes: bytes.length, sha256: hash(bytes) }; }) };
  files.set(`${BASE}inventory.json`, encode(inventory));
  const candidate = { baseUrl: BASE, manifestPath: 'manifest.json', inventoryPath: 'inventory.json', inventoryHash: hash(files.get(`${BASE}inventory.json`)) };
  const state = { requests: [], writes: [], downloads: [], ack: 'normal', beforeMerge: null, afterMerge: null };
  const response = (data, etag = null, code = 200) => ({ data: structuredClone(data), etag, status: code });
  const transport = { webUrl: WEB, async request(path, request = {}) {
    const method = request.method ?? 'GET';
    state.requests.push({ path, method });
    const asset = /GetFileByServerRelativeUrl\('([^']+)'\)\/\$value$/.exec(path)?.[1];
    if (asset) {
      assert.equal(method, 'GET', 'Revision file port must never write');
      assert.equal(request.responseType, 'binary');
      state.downloads.push({ asset, signal: request.signal, cap: request.maxResponseBytes });
      if (!files.has(asset)) throw new Error('Missing memory asset');
      return response(files.get(asset));
    }
    const name = /getbytitle\('([^']+)'\)/.exec(path)?.[1];
    const table = tables.get(name);
    assert.ok(table, `Unexpected memory list ${name}`);
    const id = Number(/\/items\((\d+)\)(?:\?|$)/.exec(path)?.[1]);
    if (method === 'GET') return id ? response(table.get(id), table.get(id)?.__etag) : response({ value: [...table.values()] });
    assert.equal(method, 'MERGE', 'No create/delete/config operation permitted');
    assert.equal(name, 'templates');
    assert.equal(id, 7);
    assert.deepEqual(Object.keys(request.body).sort(), ['EntryPointUrl', 'Styles', 'Version']);
    state.beforeMerge?.();
    const previous = table.get(id);
    if (request.etag !== previous.__etag) throw Object.assign(new Error('stale ETag'), { status: 412 });
    assert.notEqual(request.etag, '*');
    const row = { ...previous, ...structuredClone(request.body), __etag: `"template-${state.writes.length + 2}"` };
    table.set(id, row);
    state.writes.push({ name, id, patch: structuredClone(request.body), etag: request.etag });
    state.afterMerge?.();
    if (state.ack === 'null') return response(null, null, 204);
    if (state.ack === 'throw') throw new Error('response lost after memory dispatch');
    if (state.ack === 'partial') return response({ Id: id }, row.__etag);
    return response(row, row.__etag);
  } };
  const makePort = webUrl => createSharePointTemplateRevisionFiles({ webUrl,
    fileClient: createSharePointFileClient({ transport: toSharePointFileTransport(transport), libraryPath: webUrl }) });
  const port = makePort(WEB);
  let factoryCalls = 0;
  const app = createMiniJoomlaAdminApp({ webUrl: WEB,
    lists: Object.fromEntries(names.map(name => [name, { listPath: `lists/getbytitle('${name}')` }])),
    transportFactory: () => transport,
    ...(missingFactory ? {} : { templateRevisionFileClientFactory: factory ?? (({ webUrl }) => {
      factoryCalls++; assert.equal(webUrl, WEB); return port;
    }) })
  });
  return { app, port, makePort, tables, files, state, candidate, factoryCalls,
    template: () => tables.get('templates').get(7), config: () => tables.get('siteConfig').get(1) };
}
const prepare = f => f.app.templateRevision.prepare({ templateId: 7, candidate: f.candidate });
const commit = (f, ready) => f.app.templateRevision.commit({ plan: ready.plan, expectedETag: ready.expectedETag, confirm: true });
const rollback = (f, receipt) => f.app.templateRevision.rollback({ rollback: receipt.rollback, expectedETag: receipt.rollback.expectedETag, confirm: true });

export async function runTemplateRevisionIntegrationTests() {
  let checks = 0;
  const check = async (name, run) => { await run(); checks++; console.log(`ok - revision integration: ${name}`); };
  for (const legacy of [false, true]) await check(`real adapters preserve wire and rollback (${legacy ? 'legacy' : 'envelope'})`, async () => {
    const f = fixture({ legacy });
    assert.ok(Object.isFrozen(f.app));
    assert.deepEqual(Object.keys(f.app.templateRevision).sort(), ['commit', 'prepare', 'rollback']);
    assert.equal(f.factoryCalls, 1);
    assert.equal(f.state.requests.length, 0, 'Composition has no automatic I/O');
    const original = structuredClone(f.template()), config = structuredClone(f.config());
    assertTransport(await f.app.admin.templates.get(7), '"template-1"');
    assertTransport(await f.app.admin.siteConfig.get(), '"config-1"');
    const ready = await prepare(f); status(ready, 'ready');
    assert.equal(f.state.writes.length, 0);
    assert.equal(ready.snapshot.template.styles, original.Styles);
    assert.equal(ready.snapshot.siteConfig.templateStylesJson, config.TemplateStylesJson);
    assert.deepEqual(ready.expectedETag, { template: '"template-1"', config: '"config-1"' });
    assert.equal(ready.plan.candidateAssets.length, 4);
    assert.ok(!f.state.downloads.some(({ asset }) => asset.endsWith('/not-in-inventory.js')));
    assert.ok(!ready.plan.candidateAssets.some(({ path }) => path === 'inventory.json'));
    assert.ok(f.state.downloads.every(({ cap }) => cap === 10 * 1024 * 1024));
    // Observe the repository's REAL normal ACK, without replacing its behavior.
    assert.ok(Object.isFrozen(f.app.repositories.templates));
    // The transport ACK is mapped by createRepository; test its normal shape
    // in a separate fixture to avoid introducing another write into this cycle.
    const probe = fixture();
    const ack = await probe.app.repositories.templates.update(7, { version: '1.0.1', entryPointUrl: `${BASE}index.js`, styles: '[]' }, { etag: '"template-1"' });
    assertTransport(ack, '"template-2"');
    const receipt = await commit(f, ready); status(receipt, 'committed');
    assert.equal(f.state.writes.length, 1);
    assert.deepEqual(f.state.writes[0], { name: 'templates', id: 7, etag: '"template-1"',
      patch: { Version: '1.0.1', EntryPointUrl: `${BASE}index.js`, Styles: ready.plan.after.styles } });
    assert.deepEqual(f.template(), { ...original, ...f.state.writes[0].patch, __etag: '"template-2"' });
    assert.deepEqual(f.config(), config);
    assertTransport(await f.app.admin.templates.get(7), '"template-2"');
    status(await rollback(f, receipt), 'rolled-back');
    assert.equal(f.state.writes.length, 2);
    assert.deepEqual(f.state.writes[1].patch, { Version: original.Version, EntryPointUrl: original.EntryPointUrl, Styles: original.Styles });
    assert.deepEqual(f.template(), { ...original, __etag: '"template-3"' });
    assert.deepEqual(f.config(), config);
    const beforeReplay = f.state.requests.length;
    status(await rollback(f, receipt), 'concurrency-conflict');
    assert.equal(f.state.requests.length, beforeReplay);
    // UnknownWireMetadata is not mapped into the domain readback. Its raw
    // preservation here proves the PATCH transport in this fixture, not an API guarantee.
  });
  await check('partial ACK during commit AND rollback relies on authoritative full GET', async () => {
    const f = fixture(), ready = await prepare(f); status(ready, 'ready');
    const original = structuredClone(f.template()), config = structuredClone(f.config());
    f.state.ack = 'partial';
    const receipt = await commit(f, ready); status(receipt, 'committed');
    assert.equal(receipt.rollback.postTemplate.title, 'Keep title');
    assert.equal(f.state.writes.length, 1);
    status(await rollback(f, receipt), 'rolled-back');
    assert.equal(f.state.writes.length, 2);
    assert.deepEqual(f.template(), { ...original, __etag: '"template-3"' });
    assert.deepEqual(f.config(), config);
    assertTransport(await f.app.admin.templates.get(7), '"template-3"');
  });
  for (const ack of ['null', 'throw']) await check(`rollback ${ack} after dispatch is uncertain without replay`, async () => {
    const f = fixture(), ready = await prepare(f); status(ready, 'ready');
    const original = structuredClone(f.template()), config = structuredClone(f.config());
    const receipt = await commit(f, ready); status(receipt, 'committed');
    f.state.ack = ack;
    status(await rollback(f, receipt), 'uncertain');
    assert.equal(f.state.writes.length, 2);
    assert.deepEqual(f.state.writes[1].patch, { Version: original.Version, EntryPointUrl: original.EntryPointUrl, Styles: original.Styles });
    assert.deepEqual(f.template(), { ...original, __etag: '"template-3"' });
    assert.deepEqual(f.config(), config);
    const before = f.state.requests.length;
    status(await rollback(f, receipt), 'concurrency-conflict');
    assert.equal(f.state.requests.length, before);
    assert.equal(f.state.writes.length, 2);
  });
  await check('ETag conflict at dispatch is uncertain and consumes plan without overwriting concurrent row', async () => {
    const f = fixture(), ready = await prepare(f); status(ready, 'ready');
    const original = structuredClone(f.template()), config = structuredClone(f.config());
    f.state.beforeMerge = () => { f.template().__etag = '"template-other"'; };
    status(await commit(f, ready), 'uncertain');
    assert.equal(f.state.writes.length, 0);
    assert.deepEqual(f.template(), { ...original, __etag: '"template-other"' });
    assert.deepEqual(f.config(), config);
    assert.equal(f.state.requests.filter(r => r.method !== 'GET').length, 1);
    const before = f.state.requests.length;
    status(await commit(f, ready), 'concurrency-conflict');
    assert.equal(f.state.requests.length, before);
  });
  for (const ack of ['null', 'throw']) await check(`${ack} after dispatch is uncertain, no replay despite changed row`, async () => {
    const f = fixture(), ready = await prepare(f); status(ready, 'ready');
    const config = structuredClone(f.config()); f.state.ack = ack;
    const result = await commit(f, ready); status(result, 'uncertain');
    assert.equal(result.rollback, undefined);
    assert.equal(f.template().Version, '1.0.1');
    assert.equal(f.state.writes.length, 1);
    assert.deepEqual(f.config(), config);
    const before = f.state.requests.length;
    status(await commit(f, ready), 'concurrency-conflict');
    assert.equal(f.state.requests.length, before);
  });
  for (const target of ['template', 'config', 'asset']) await check(`changed ${target} blocks commit before PATCH`, async () => {
    const f = fixture(), ready = await prepare(f); status(ready, 'ready');
    if (target === 'template') f.template().__etag = '"template-other"';
    if (target === 'config') f.config().__etag = '"config-other"';
    if (target === 'asset') f.files.set(`${BASE}extra.txt`, encode('tampered'));
    status(await commit(f, ready), target === 'asset' ? 'validation-failed' : 'concurrency-conflict');
    assert.equal(f.state.writes.length, 0);
  });
  await check('SiteConfig changes after dispatch yield uncertain without writing config', async () => {
    const f = fixture(), ready = await prepare(f); status(ready, 'ready');
    f.state.afterMerge = () => { f.config().__etag = '"config-other"'; };
    status(await commit(f, ready), 'uncertain');
    assert.equal(f.state.writes.length, 1);
    assert.ok(f.state.requests.filter(r => r.method !== 'GET').every(r => r.path.includes("getbytitle('templates')")));
  });
  await check('missing factory fails closed before I/O; throwing factory is distinct', async () => {
    const f = fixture({ missingFactory: true });
    status(await prepare(f), 'unavailable');
    status(await f.app.templateRevision.commit({ confirm: true }), 'unavailable');
    status(await f.app.templateRevision.rollback({ confirm: true }), 'unavailable');
    assert.equal(f.state.requests.length, 0);
    assert.throws(() => fixture({ factory: () => { throw new TypeError('invalid file client'); } }), /invalid file client/);
  });
  await check('read-only file port rejects sibling/traversal/unsafe name/cap before transport', async () => {
    const f = fixture();
    assert.ok(Object.isFrozen(f.port)); assert.deepEqual(Object.keys(f.port), ['downloadFile']);
    for (const input of [
      { folderPath: `${WEB}x/SiteAssets`, fileName: 'x.js' },
      { folderPath: '/teams/other/SiteAssets', fileName: 'x.js' },
      { folderPath: `${WEB}/SiteAssets/../other`, fileName: 'x.js' },
      { folderPath: `${WEB}/SiteAssets/%2e%2e`, fileName: 'x.js' },
      { folderPath: WEB, fileName: '../x.js' }, { folderPath: WEB, fileName: 'sub/x.js' },
      { folderPath: WEB, fileName: 'root.txt', maxBytes: 0 },
      { folderPath: WEB, fileName: 'root.txt', maxBytes: 10 * 1024 * 1024 + 1 }
    ]) await assert.rejects(f.port.downloadFile(input));
    assert.equal(f.state.requests.length, 0);
    const controller = new AbortController();
    const response = await f.port.downloadFile({ folderPath: WEB, fileName: 'root.txt', maxBytes: 100, signal: controller.signal });
    assert.equal(new TextDecoder().decode(response.data), 'root web file');
    assert.deepEqual(f.state.downloads.at(-1), { asset: `${WEB}/root.txt`, signal: controller.signal, cap: 100 });
    await assert.rejects(f.port.downloadFile({ folderPath: WEB, fileName: 'root.txt', maxBytes: 1 }), /maxBytes/);
    controller.abort();
    const before = f.state.requests.length;
    await assert.rejects(f.port.downloadFile({ folderPath: WEB, fileName: 'root.txt', signal: controller.signal }));
    assert.equal(f.state.requests.length, before);
    const root = await f.makePort('/').downloadFile({ folderPath: '', fileName: 'root.txt' });
    assert.equal(new TextDecoder().decode(root.data), 'tenant root file');
  });
  await check('ordinary admin update guard remains intact', async () => {
    const f = fixture();
    await assert.rejects(f.app.admin.templates.update(7, { entryPointUrl: `${BASE}index.js` }, { etag: '"template-1"' }), /entryPointUrl/);
    assert.equal(f.state.writes.length, 0);
  });
  console.log(`template revision integration: ${checks} checks passed`);
  return checks;
}
