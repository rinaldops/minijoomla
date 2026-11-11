import assert from 'node:assert/strict';
import { createSharePointExtensionRootsPort, validateExtensionRootsConfiguration, EXTENSION_ROOTS_FORMAT } from '../src/libraries/minijoomla/infrastructure/sharepoint-extension-roots.js';
import { sha256 } from '../src/libraries/minijoomla/application/joomla-discovery.js';
import { createExtensionRootsService } from '../src/libraries/minijoomla/application/extension-roots-service.js';

const WEB = '/sites/example', LIBRARY = `${WEB}/SiteAssets/minijoomla`;
const encode = value => new TextEncoder().encode(value);
const clone = value => structuredClone(value);
const empty = (webUrl = WEB, libraryPath = `${webUrl === '/' ? '' : webUrl}/SiteAssets/minijoomla`) => ({
  format: EXTENSION_ROOTS_FORMAT, webUrl, libraryPath, joomlaDiscoveryRoots: [], moduleStyles: {}, moduleStyleRevisions: {}
});
const isMetadata = call => call.url.includes('GetFileByServerRelativePath') && !call.url.endsWith('/$value');
const writes = server => server.calls.filter(call => call.method !== 'GET');

/** Exclusive file creation + exact If-Match on update; no real fetch/tenant. */
export function createExtensionRootsMemoryServer({ webUrl = WEB } = {}) {
  const libraryPath = `${webUrl === '/' ? '' : webUrl}/SiteAssets/minijoomla`, configPath = `${libraryPath}/extensions-host.json`;
  const server = {
    webUrl, libraryPath, configPath, configuration: null, revision: 1, folderExists: true,
    calls: [], hook: null, installation: { installed: true, keep: 'untouched' },
    transport: {
      webUrl: webUrl === '/' ? '' : webUrl,
      async request(url, options) {
        assert.ok(url.startsWith(`${webUrl === '/' ? '' : webUrl}/_api/web/`));
        assert.ok(!url.includes('installation.json') && !url.includes('/lists') && !url.includes('/items'));
        assert.notEqual(options.headers?.['If-Match'], '*');
        assert.notEqual(options.etag, '*');
        assert.ok(!url.includes('overwrite=true'));
        const call = { url, ...options, ...(options.body === undefined ? {} : { body: clone(options.body) }) };
        server.calls.push(call);
        const override = await server.hook?.(call);
        if (override !== undefined) return override;
        const output = (data, status = 200) => ({ status, data, etag: `"roots-${server.revision}"` });
        const failure = status => { throw Object.assign(new Error('RAW private server credentials'), { status }); };
        if (url.includes('GetFileByServerRelativePath')) {
          assert.ok(decodeURIComponent(url).includes(configPath));
          if (server.configuration === null) failure(404);
          if (options.method === 'GET') return output(url.endsWith('/$value') ? encode(JSON.stringify(server.configuration)).buffer : { Exists: true, ServerRelativeUrl: configPath, ETag: `"roots-${server.revision}"` });
          assert.ok(url.endsWith('/$value'));
          assert.equal(options.method, 'POST');
          assert.equal(options.headers['X-HTTP-Method'], 'PUT');
          if (options.headers['If-Match'] !== `"roots-${server.revision}"`) failure(412);
          assert.ok(options.body instanceof Uint8Array);
          assert.equal(options.headers['Content-Type'], 'application/json');
          server.configuration = JSON.parse(new TextDecoder().decode(options.body)); server.revision++;
          return output(null, 204);
        }
        assert.ok(url.includes('GetFolderByServerRelativePath'));
        assert.ok(decodeURIComponent(url).includes(libraryPath));
        if (!server.folderExists) failure(404);
        if (options.method === 'GET') return output({ Exists: true, ServerRelativeUrl: libraryPath });
        assert.equal(options.method, 'POST');
        assert.match(url, /\/Files\/AddUsingPath\(decodedurl='extensions-host\.json',overwrite=false\)$/);
        assert.equal(options.headers['Content-Type'], 'application/json');
        assert.ok(options.body instanceof Uint8Array);
        if (server.configuration !== null) failure(412);
        server.configuration = JSON.parse(new TextDecoder().decode(options.body));
        return output({ ServerRelativeUrl: configPath }, 201);
      }
    }
  };
  return server;
}
const portFor = (server, extra = {}) => createSharePointExtensionRootsPort({
  transport: server.transport, webUrl: server.webUrl, libraryPath: server.libraryPath,
  mutationTransportFactory: guard => ({ async request(url, options) {
    assert.ok(options.signal instanceof AbortSignal);
    await server.beforeDispatch?.(url, options);
    guard();
    return server.transport.request(url, options);
  } }), ...extra
});

async function packageFixture({ discover = false, moduleCount = 2, extraFile = true, twoStyles = false } = {}) {
  const baseUrl = `${WEB}/SiteAssets/packages/v1/`, files = new Map(), moduleKeys = {}, moduleStyles = {}, revisions = {}, styles = {};
  for (const name of ['alpha', 'beta'].slice(0, moduleCount)) {
    const element = `mod_${name}`, key = `example.${element}`, css = `media/${element}/css/style.css`, js = `modules/${element}/${element}.js`;
    const extraCss = `media/${element}/css/override.css`;
    const xml = `<extension type="module" client="site" xmlns:mj="urn:minijoomla:runtime:1" mj:key="${key}"><name>${name}</name><version>1.0.0</version><files><filename module="${element}">${element}.js</filename></files><media destination="${element}"><filename>css/style.css</filename>${twoStyles ? '<filename>css/override.css</filename>' : ''}</media></extension>`;
    files.set(`modules/${element}/${element}.xml`, encode(xml));
    files.set(js, encode('throw new Error("PACKAGE MUST NEVER EXECUTE");'));
    files.set(css, encode(`.${name}{color:red}`));
    if(twoStyles)files.set(extraCss,encode(`.${name}{color:blue}`));
    moduleKeys[element] = key; moduleStyles[key] = twoStyles ? [css,extraCss] : [css];
    styles[key] = moduleStyles[key].map(path=>`${baseUrl}${path}`); revisions[key] = { [`${baseUrl}${js}`]: styles[key] };
  }
  if (extraFile) files.set('future/readme.txt', encode('Future inventory content must also be hashed'));
  const inventory = { format: 'minijoomla-joomla-package-v1', moduleKeys, moduleStyles, files: await Promise.all([...files].map(async ([path, bytes]) => ({ path, bytes: bytes.byteLength, sha256: await sha256(bytes) }))) };
  const inventoryBytes = encode(JSON.stringify(inventory)); files.set('MANIFEST-SHA256.json', inventoryBytes);
  const config = { joomlaDiscoveryRoots: [{ id: 'v1', baseUrl, inventoryHash: await sha256(inventoryBytes), immutable: true, discover }], moduleStyles: styles, moduleStyleRevisions: revisions };
  const reads = [], factories = [], pack = { files, config, reads, factories, inventory, listOverride: null, readHook: null };
  pack.factory = ({ root, webUrl }) => {
    factories.push({ root: clone(root), webUrl });
    assert.equal(webUrl, WEB); assert.equal(root.baseUrl, baseUrl); assert.equal(root.discover, true);
    return {
      async listFolders() { throw new Error('Prefer the complete listFoldersAll method'); },
      async listFoldersAll(options) {
        reads.push({ kind: 'folders', ...options });
        assert.equal(options.folderPath, 'modules'); assert.equal(options.maxItems, 500);
        return pack.listOverride ?? { data: { value: [...Object.keys(moduleKeys).map(Name => ({ Name })), { Name: 'mod_custom' }, { Name: 'other' }] }, complete: true };
      },
      async downloadFile(options) {
        const path = [options.folderPath, options.fileName].filter(Boolean).join('/');
        reads.push({ kind: 'download', path, ...options });
        const override = await pack.readHook?.(path, options);
        if (override !== undefined) return override;
        assert.ok(Number.isSafeInteger(options.maxBytes) && options.maxBytes <= 10 * 1024 * 1024);
        if (!files.has(path)) throw Object.assign(new Error('RAW secret read error'), { status: 404 });
        return { data: files.get(path), status: 200 };
      }
    };
  };
  return pack;
}

export async function runSharePointExtensionRootsTests() {
  let cases = 0;
  const test = async run => { await run(); cases++; };
  await test(async () => {
    for (const webUrl of [WEB, '/sites/another/subweb', '/']) {
      const server = createExtensionRootsMemoryServer({ webUrl }), port = createSharePointExtensionRootsPort({ transport: server.transport, webUrl });
      assert.equal(port.webUrl, webUrl); assert.equal(port.libraryPath, server.libraryPath); assert.equal(server.calls.length, 0);
      assert.deepEqual(await port.read(), { configuration: null, etag: null });
      await assert.rejects(port.write(empty(webUrl), { expectedETag: null }), error => error.code === 'dispatch-guard-required');
      assert.equal(writes(server).length, 0);
    }
    for (const webUrl of ['https://example.invalid/sites/a', '//evil', '/sites/../a', '/sites/%2ea', '/sites/a/', '/sites/a?x', '/sites/a\\b']) assert.throws(() => createSharePointExtensionRootsPort({ transport: { request() {} }, webUrl }));
    for (const libraryPath of ['/sites/example-other/SiteAssets/mj', `${WEB}/SiteAssetsSibling/mj`, `${WEB}/SiteAssets`, `${LIBRARY}/../a`]) assert.throws(() => createSharePointExtensionRootsPort({ transport: { request() {} }, webUrl: WEB, libraryPath }));
    assert.throws(() => createSharePointExtensionRootsPort({ transport: { request() {}, webUrl: '/sites/other' }, webUrl: WEB }));
  });
  await test(async () => {
    for (const status of [403, 503, undefined, '404']) {
      const server = createExtensionRootsMemoryServer();
      server.hook = () => { throw Object.assign(new Error('RAW private text'), { code: 'not-found', status }); };
      await assert.rejects(portFor(server).read(), error => !error.message.includes('private') && (Number.isInteger(status) ? error.status === status : error.status === undefined));
      assert.equal(writes(server).length, 0);
    }
    for (const response of [{ status: 403, data: {} }, { data: { Exists: false } }, { status: 200, data: { Exists: false } }, { status: 200, data: { Exists: true, ServerRelativeUrl: `${LIBRARY}/elsewhere.json`, ETag: '"1"' } }]) {
      const server = createExtensionRootsMemoryServer(); server.hook = () => response;
      await assert.rejects(portFor(server).read());
    }
    const absent = createExtensionRootsMemoryServer(); absent.hook = () => ({ status: 404, data: {} });
    assert.deepEqual(await portFor(absent).read(), { configuration: null, etag: null });
  });
  await test(async () => {
    const server = createExtensionRootsMemoryServer();
    server.configuration = { ...empty(), future: JSON.parse('{"toJSON":"data","__proto__":{"keep":[false,null,42]}}') };
    const before = clone(server.configuration), result = await portFor(server).read();
    assert.deepEqual(result, { configuration: before, etag: '"roots-1"' }); assert.deepEqual(server.configuration, before);
    const body = server.calls.find(call => call.url.endsWith('/$value'));
    assert.equal(body.maxResponseBytes, 256 * 1024); assert.equal(body.responseType, 'binary');
    assert.equal(server.calls.length, 3); assert.equal(writes(server).length, 0); assert.equal({}.keep, undefined);
    const readonly = createSharePointExtensionRootsPort({ transport: server.transport, webUrl: WEB });
    assert.deepEqual(await readonly.read(), result, 'Existing bounded JSON is readable without either factory');
    for (const etag of [null, '*', 'W/"1"', '"bad\n"']) {
      server.hook = call => isMetadata(call) ? { status: 200, data: { Exists: true, ServerRelativeUrl: server.configPath }, etag } : undefined;
      await assert.rejects(portFor(server).read(), error => error.code === 'etag-required');
    }
  });
  await test(async () => {
    for (const changedAt of ['body', 'recheck']) {
      const server = createExtensionRootsMemoryServer(); server.configuration = empty(); let reads = 0;
      server.hook = call => { if (changedAt === 'body' ? call.url.endsWith('/$value') : isMetadata(call) && ++reads === 2) server.revision++; };
      await assert.rejects(portFor(server).read(), error => error.code === 'configuration-changed-during-read');
    }
    for (const data of ['{broken', 'null', '[]', encode([0xff]).buffer, ' '.repeat(256 * 1024 + 1), { future: 'x'.repeat(256 * 1024) }]) {
      const server = createExtensionRootsMemoryServer(); server.configuration = empty();
      server.hook = call => call.url.endsWith('/$value') ? { status: 200, data } : undefined;
      await assert.rejects(portFor(server).read());
    }
  });
  await test(async () => {
    let accessed = false;
    const getter = empty(); Object.defineProperty(getter, 'future', { enumerable: true, get() { accessed = true; return {}; } });
    const toJSON = { ...empty(), future: { toJSON() { accessed = true; return {}; } } };
    const cyclic = empty(); cyclic.future = cyclic;
    const sparse = { ...empty(), future: new Array(2) };
    const symbol = { ...empty(), [Symbol('future')]: 1 };
    const deep = empty(); let cursor = deep; for (let index = 0; index < 22; index++) cursor = cursor.future = {};
    const many = { ...empty(), future: Array.from({ length: 10001 }, () => null) };
    for (const config of [getter, toJSON, cyclic, sparse, symbol, deep, many, { ...empty(), future: Infinity }, { ...empty(), future: new Date() }]) assert.throws(() => validateExtensionRootsConfiguration(config));
    assert.equal(accessed, false);
    for (const mutate of [v => { v.format = 'future'; }, v => { v.webUrl = '/sites/other'; }, v => { delete v.moduleStyles; }, v => { delete v.libraryPath; }, v => { v.libraryPath = null; }]) {
      const value = empty(); mutate(value); assert.throws(() => validateExtensionRootsConfiguration(value, { webUrl: WEB, libraryPath: LIBRARY }));
    }
    const server = createExtensionRootsMemoryServer(); await assert.rejects(portFor(server).write(getter, { expectedETag: null })); assert.equal(server.calls.length, 0);
  });
  await test(async () => {
    const pack = await packageFixture(), config = { ...empty(), ...pack.config, future: { keep: [false, null] } };
    const normalized = validateExtensionRootsConfiguration(config);
    assert.equal(normalized.joomlaDiscoveryRoots[0].discover, false); assert.deepEqual(normalized.future, config.future);
    for (const baseUrl of ['/sites/example-other/SiteAssets/v1/', `${WEB}/packages/v1/`, '/SiteAssets/v1/', `${WEB}/SiteAssets/`]) {
      const bad = clone(config); bad.joomlaDiscoveryRoots[0].baseUrl = baseUrl;
      assert.throws(() => validateExtensionRootsConfiguration(bad));
      const server = createExtensionRootsMemoryServer(); let called = false;
      await assert.rejects(portFor(server, { fileClientFactory() { called = true; } }).verifyPackage(bad)); assert.equal(called, false);
    }
  });
  await test(async () => {
    const server = createExtensionRootsMemoryServer(), port = portFor(server), config = { ...empty(), future: { z: false, a: 'Instalação' } };
    const initialInstallation = clone(server.installation);
    assert.deepEqual(await port.write(config, { expectedETag: null }), { configuration: config, etag: '"roots-1"' });
    const next = { ...config, future: { a: 'Revisão', z: true } };
    assert.deepEqual(await port.write(next, { expectedETag: '"roots-1"' }), { configuration: next, etag: '"roots-2"' });
    assert.equal(writes(server).length, 2); assert.deepEqual(server.installation, initialInstallation);
    const update = writes(server)[1]; assert.equal(update.method, 'POST'); assert.equal(update.headers['X-HTTP-Method'], 'PUT'); assert.equal(update.headers['If-Match'], '"roots-1"');
    assert.ok(update.url.endsWith('/$value')); assert.ok(update.body instanceof Uint8Array);
    const other = createExtensionRootsMemoryServer(), reordered = Object.fromEntries(Object.entries(config).reverse());
    reordered.future = { a: 'Instalação', z: false };
    await portFor(other).write(reordered, { expectedETag: null });
    assert.deepEqual(writes(server)[0].body, writes(other)[0].body, 'Stable JSON sorts keys recursively');
  });
  await test(async () => {
    for (const expectedETag of [undefined, '*', 'W/"roots-1"', 'roots-1', '"roots-99"', null]) {
      const server = createExtensionRootsMemoryServer(); server.configuration = empty();
      await assert.rejects(portFor(server).write(empty(), { expectedETag })); assert.equal(writes(server).length, 0);
    }
    const absent = createExtensionRootsMemoryServer(); await assert.rejects(portFor(absent).write(empty(), { expectedETag: '"roots-1"' })); assert.equal(writes(absent).length, 0);
    const folder = createExtensionRootsMemoryServer(); folder.folderExists = false;
    await assert.rejects(portFor(folder).write(empty(), { expectedETag: null })); assert.equal(writes(folder).length, 0);
    for (const atDispatch of [false, true]) {
      const race = createExtensionRootsMemoryServer(); let count = 0;
      race.hook = call => { if (atDispatch ? call.method === 'POST' : isMetadata(call) && ++count === 2) race.configuration = { preserve: true }; };
      await assert.rejects(portFor(race).write(empty(), { expectedETag: null }), error => error.code === 'concurrency-conflict');
      assert.deepEqual(race.configuration, { preserve: true }); assert.equal(writes(race).length, atDispatch ? 1 : 0);
    }
    const conflict = createExtensionRootsMemoryServer(); conflict.configuration = empty();
    conflict.hook = call => { if (call.method === 'POST') conflict.revision++; };
    await assert.rejects(portFor(conflict).write({ ...empty(), future: true }, { expectedETag: '"roots-1"' }), error => error.status === 412 && !error.message.includes('private'));
    assert.equal(writes(conflict).length, 1); assert.deepEqual(conflict.configuration, empty());
  });
  await test(async () => {
    for (const status of [403, 503, 412]) {
      const server = createExtensionRootsMemoryServer(); server.hook = call => call.method === 'POST' ? { status, data: { raw: 'private' } } : undefined;
      await assert.rejects(portFor(server).write(empty(), { expectedETag: null }), error => error.status === status && !error.message.includes('private'));
      assert.equal(writes(server).length, 1);
    }
    const ignored = createExtensionRootsMemoryServer(); ignored.configuration = empty();
    ignored.hook = call => call.method === 'POST' ? { status: 204, data: null } : undefined;
    await assert.rejects(portFor(ignored).write({ ...empty(), future: 42 }, { expectedETag: '"roots-1"' }), error => error.code === 'configuration-unverified');
    assert.equal(writes(ignored).length, 1);
  });
  await test(async () => {
    for (const existing of [false, true]) {
      const base = createExtensionRootsMemoryServer(); if (existing) base.configuration = empty();
      await portFor(base).write({ ...empty(), future: true }, { expectedETag: existing ? '"roots-1"' : null });
      const beforePost = base.calls.findIndex(call => call.method === 'POST');
      for (let cancelAt = 1; cancelAt <= beforePost; cancelAt++) {
        const server = createExtensionRootsMemoryServer(); if (existing) server.configuration = empty();
        let active = true, reads = 0; server.hook = call => { if (call.method === 'GET' && ++reads === cancelAt) active = false; };
        await assert.rejects(portFor(server).write({ ...empty(), future: true }, { expectedETag: existing ? '"roots-1"' : null, isCurrent: () => active }), error => error.code === 'stale-operation');
        assert.equal(writes(server).length, 0);
      }
      const dispatch = createExtensionRootsMemoryServer(); if (existing) dispatch.configuration = empty();
      let active = true, signal;
      dispatch.beforeDispatch = async (_url, options) => { signal = options.signal; await Promise.resolve(); active = false; };
      await assert.rejects(portFor(dispatch).write(empty(), { expectedETag: existing ? '"roots-1"' : null, isCurrent: () => active }), error => error.code === 'stale-operation');
      assert.equal(writes(dispatch).length, 0); assert.equal(signal.aborted, true);
    }
    const aborted = createExtensionRootsMemoryServer(), controller = new AbortController(); controller.abort();
    await assert.rejects(portFor(aborted).write(empty(), { expectedETag: null, signal: controller.signal })); assert.equal(aborted.calls.length, 0);
    const uncertain = createExtensionRootsMemoryServer(); let active = true;
    uncertain.hook = call => { if (call.method === 'POST') active = false; };
    await assert.rejects(portFor(uncertain).write(empty(), { expectedETag: null, isCurrent: () => active }));
    assert.equal(writes(uncertain).length, 1); assert.equal(uncertain.calls.at(-1).signal.aborted, true); assert.deepEqual(uncertain.configuration, empty());
  });
  await test(async () => {
    const pack = await packageFixture(), server = createExtensionRootsMemoryServer(), port = portFor(server, { fileClientFactory: pack.factory });
    const result = await port.verifyPackage(pack.config);
    assert.deepEqual(result, pack.config); assert.equal(result.joomlaDiscoveryRoots[0].discover, false);
    assert.equal(pack.factories.length, 1); assert.equal(server.calls.length, 0);
    assert.equal(pack.reads.filter(read => read.path === 'MANIFEST-SHA256.json').length, 2, 'Every external module gets its own complete inventory verification');
    assert.equal(pack.reads.filter(read => read.path === 'future/readme.txt').length, 2, 'Unknown inventory entries are hashed too');
    assert.ok(pack.reads.some(read => read.path?.endsWith('.js'))); assert.ok(pack.reads.some(read => read.path?.endsWith('.css')));
    await port.write({ ...empty(), ...result }, { expectedETag: null });
    assert.equal(writes(server).length, 1); assert.ok(server.calls.every(call => !call.url.includes('/items')));
  });
  await test(async () => {
    for (const mutate of [
      (pack, config) => { config.joomlaDiscoveryRoots[0].inventoryHash = 'a'.repeat(64); },
      pack => { pack.files.set('future/readme.txt', encode('tampered')); },
      pack => { pack.files.set('modules/mod_beta/mod_beta.js', encode('tampered')); },
      (_pack, config) => { config.moduleStyles['example.mod_alpha'] = []; },
      (_pack, config) => { config.moduleStyleRevisions['example.mod_alpha'] = {}; },
      (_pack, config) => { const url = Object.keys(config.moduleStyleRevisions['example.mod_alpha'])[0]; config.moduleStyleRevisions['example.mod_alpha'] = { [url.replace('.js', '-invented.js')]: config.moduleStyles['example.mod_alpha'] }; },
      (_pack, config) => { config.moduleStyles['example.mod_alpha'].push(`${config.joomlaDiscoveryRoots[0].baseUrl}media/mod_alpha/css/invented.css`); },
      (_pack, config) => { delete config.moduleStyles['example.mod_beta']; delete config.moduleStyleRevisions['example.mod_beta']; }
    ]) {
      const pack = await packageFixture(), config = clone(pack.config); mutate(pack, config);
      const server = createExtensionRootsMemoryServer(); await assert.rejects(portFor(server, { fileClientFactory: pack.factory }).verifyPackage(config), error => !error.message.includes('RAW'));
      assert.equal(server.calls.length, 0);
    }
  });
  await test(async () => {
    for (const response of [{ status: 403, data: { value: [] } }, { data: { value: [], complete: false } }, { data: { value: [], truncated: true } }, { data: { value: [], 'odata.nextLink': '/more' } }, { data: { value: [], 'odata.count': '2' } }, { data: {} }, { data: { value: [] } }]) {
      const pack = await packageFixture(); pack.listOverride = response;
      await assert.rejects(portFor(createExtensionRootsMemoryServer(), { fileClientFactory: pack.factory }).verifyPackage(pack.config));
    }
    const missing = await packageFixture(); missing.files.delete('modules/mod_beta/mod_beta.xml');
    await assert.rejects(portFor(createExtensionRootsMemoryServer(), { fileClientFactory: missing.factory }).verifyPackage(missing.config));
    const unsafe = await packageFixture(); const xml = 'modules/mod_alpha/mod_alpha.xml'; unsafe.files.set(xml, encode(new TextDecoder().decode(unsafe.files.get(xml)).replace('type="module"', 'type="plugin"')));
    await assert.rejects(portFor(createExtensionRootsMemoryServer(), { fileClientFactory: unsafe.factory }).verifyPackage(unsafe.config));
    const pack = await packageFixture(); let active = true; pack.readHook = async () => { await Promise.resolve(); active = false; };
    await assert.rejects(portFor(createExtensionRootsMemoryServer(), { fileClientFactory: pack.factory }).verifyPackage(pack.config, { isCurrent: () => active }), error => error.code === 'stale-operation');
    assert.equal(pack.reads.filter(read => read.kind === 'download').length, 1);
    const multi = await packageFixture(); multi.config.joomlaDiscoveryRoots.push({ ...multi.config.joomlaDiscoveryRoots[0], id: 'v2' });
    await assert.rejects(portFor(createExtensionRootsMemoryServer(), { fileClientFactory: multi.factory }).verifyPackage(multi.config)); assert.equal(multi.factories.length, 0);
  });
  await test(async () => {
    const server = createExtensionRootsMemoryServer(), pack = await packageFixture();
    const port = portFor(server, { fileClientFactory: pack.factory }), service = createExtensionRootsService({ port });
    const plan = await service.inspect(); assert.equal(plan.status, 'ready'); assert.equal(plan.etag, null);
    assert.equal(plan.configuration.format, EXTENSION_ROOTS_FORMAT);
    const added = await service.add({ confirm: true, expectedETag: null, input: pack.config });
    assert.equal(added.status, 'ready', added.message); assert.equal(added.etag, '"roots-1"');
    assert.equal(added.configuration.joomlaDiscoveryRoots[0].discover, false);
    assert.equal(writes(server).length, 1);
    const toggled = await service.setDiscover({ confirm: true, expectedETag: added.etag, rootId: 'v1', discover: true });
    assert.equal(toggled.status, 'ready', toggled.message); assert.equal(toggled.etag, '"roots-2"');
    assert.equal(toggled.configuration.joomlaDiscoveryRoots[0].discover, true);
    assert.equal(pack.factories.length, 1, 'Changing discover retains approval, does not reinstall or verify/import code');
    assert.equal(writes(server).length, 2); assert.deepEqual(server.installation, { installed: true, keep: 'untouched' });
    const stale = await service.setDiscover({ confirm: true, expectedETag: added.etag, rootId: 'v1', discover: false });
    assert.equal(stale.status, 'blocked'); assert.equal(writes(server).length, 2);
  });
  await test(async()=>{
    const pack=await packageFixture({twoStyles:true});
    const port=portFor(createExtensionRootsMemoryServer(),{fileClientFactory:pack.factory});
    assert.deepEqual(await port.verifyPackage(pack.config),pack.config);
    const wrong=clone(pack.config);for(const urls of Object.values(wrong.moduleStyleRevisions)){for(const values of Object.values(urls))values.reverse();}
    await assert.rejects(port.verifyPackage(wrong),'CSS cascade order is not a set; approval and registration require the same order');
    let active=true;pack.readHook=()=>{active=false;};
    const service=createExtensionRootsService({port});
    const cancelled=await service.add({confirm:true,expectedETag:null,input:pack.config,isCurrent:()=>active});
    assert.equal(cancelled.status,'unavailable');
  });
  console.log(`ok - SharePoint extension roots: ${cases} core/local cases, separate file, strong ETags, guarded writes, paired engine and full two-module inventory verification`);
}

/** Optional integration entry point: caller injects the actual SPMIDDLE client.
 * This test file and its ordinary suite have no sibling dependency imports. */
export async function runSPMiddleExtensionRootsContractTests({ createSharePointRestClient }) {
  const response = result => ({
    ok: result.status >= 200 && result.status < 300, status: result.status,
    headers: { get: name => name.toLowerCase() === 'etag' ? result.etag ?? null : null },
    text: async () => result.status === 204 ? '' : JSON.stringify(result.data),
    arrayBuffer: async () => result.data instanceof ArrayBuffer ? result.data : encode(JSON.stringify(result.data)).buffer
  });
  for (const existing of [false, true]) for (const cancel of [false, true]) {
    const server = createExtensionRootsMemoryServer(); if (existing) server.configuration = empty();
    let active = true, actualSignal, digests = 0;
    const fetchMemory = (url, init) => {
      if (url.endsWith('/_api/contextinfo')) return (async () => {
        digests++; await Promise.resolve(); if (cancel) active = false;
        return response({ status: 200, data: { FormDigestValue: 'memory-only', FormDigestTimeoutSeconds: 1800 } });
      })();
      if (init.method === 'POST') {
        assert.ok(init.body instanceof Uint8Array);
        if (existing) { assert.equal(init.headers['X-HTTP-Method'], 'PUT'); assert.equal(init.headers['If-Match'], '"roots-1"'); }
        else { assert.match(url, /overwrite=false/); assert.equal(init.headers['X-HTTP-Method'], undefined); assert.equal(init.headers['If-Match'], undefined); }
      }
      return server.transport.request(url, init).then(response, error => {
        if (!Number.isInteger(error.status)) throw error;
        return response({ status: error.status, data: {} });
      });
    };
    const port = portFor(server, {
      transport: createSharePointRestClient({ webUrl: WEB, maxRetries: 0, fetchImpl: fetchMemory }),
      mutationTransportFactory: guard => createSharePointRestClient({
      webUrl: WEB, maxRetries: 0,
      fetchImpl: (url, init) => {
        if (!url.endsWith('/_api/contextinfo')) actualSignal = init.signal;
        guard();
        return fetchMemory(url, init);
      }
    }) });
    const write = port.write({ ...empty(), future: true }, { expectedETag: existing ? '"roots-1"' : null, isCurrent: () => active });
    if (cancel) { await assert.rejects(write, error => error.code === 'stale-operation'); assert.equal(writes(server).length, 0); assert.equal(actualSignal.aborted, true); }
    else { assert.equal((await write).etag, existing ? '"roots-2"' : '"roots-1"'); assert.equal(writes(server).length, 1); }
    assert.equal(digests, 1);
  }
  console.log('ok - actual SPMIDDLE extension-roots PUT override, exact If-Match and post-digest dispatch cancellation (memory fetch only)');
}
