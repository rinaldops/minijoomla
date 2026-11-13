import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInstallationPreflight, REQUIRED_INSTALLATION_MODULES, REQUIRED_INSTALLATION_ASSETS } from '../host-adapters/modern-script-editor/installation-preflight.js';

const WEB = '/sites/example', LIBRARY = `${WEB}/SiteAssets/minijoomla`;
const RELEASE = `https://tenant.example${LIBRARY}/releases/1.0.0/`;
const ID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'digest-private-not-for-report';

function fixture(webUrl = WEB) {
  const libraryPath = `${webUrl === '/' ? '' : webUrl}/SiteAssets/minijoomla`;
  const releaseUrl = `https://tenant.example${libraryPath}/releases/1.0.0/`;
  const calls = [], loaded = [], values = new Map([['minijoomla:installation:existing', 'preserve-me']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const web = { Id: ID, Url: `https://tenant.example${webUrl === '/' ? '' : webUrl}`, ServerRelativeUrl: webUrl, EffectiveBasePermissions: { Low: '2048', High: '0' } };
  const digest = { FormDigestValue: SECRET, FormDigestTimeoutSeconds: 1800, WebFullUrl: web.Url };
  let hook;
  const response = (body, type, overrides = {}) => new Response(body, { status: overrides.status ?? 200, headers: { 'content-type': type, ...overrides.headers } });
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.signal.aborted, false);
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.redirect, 'error');
    const custom = await hook?.(url, init);
    if (custom !== undefined) return custom;
    if (url === `${webUrl === '/' ? '' : webUrl}/_api/web?$select=Id,Url,ServerRelativeUrl,EffectiveBasePermissions`) return response(JSON.stringify(web), 'application/json');
    if (url === `${webUrl === '/' ? '' : webUrl}/_api/contextinfo`) {
      assert.equal(init.method, 'POST');
      return response(JSON.stringify({ GetContextWebInformation: digest }), 'application/json');
    }
    assert.ok(url.startsWith(releaseUrl), `Fixed same-release fetch only: ${url}`);
    assert.equal(init.method, 'GET');
    return response(url.endsWith('.css') ? 'body { color: inherit; }' : 'export const ready = true;', url.endsWith('.css') ? 'text/css' : 'text/javascript');
  };
  const moduleLoaders = Object.fromEntries(REQUIRED_INSTALLATION_MODULES.map(entry => [entry.name, async () => {
    loaded.push(entry.name);
    const namespace = Object.fromEntries(entry.exports.map(name => [name, () => {}]));
    if (entry.name === 'SPMIDDLE REST') namespace.createSharePointRestClient = ({ webUrl: web, fetchImpl: fetch, maxRetries }) => {
      assert.equal(web, webUrl); assert.equal(maxRetries, 0); assert.equal(typeof fetch, 'function');
      return { webUrl: web === '/' ? '' : web, request() {}, getDigest() {} };
    };
    if (entry.name === 'SPMIDDLE files') namespace.createSharePointFileClient = ({ transport, libraryPath: library }) => {
      assert.equal(transport.webUrl, webUrl); assert.equal(library, libraryPath);
      return Object.fromEntries(['uploadFile', 'listFiles', 'listFoldersAll', 'listFilesAll', 'downloadFile'].map(name => [name, () => {}]));
    };
    return namespace;
  }]));
  const options = { context: { webUrl, libraryPath }, releaseUrl, locationRef: { origin: 'https://tenant.example' }, fetchImpl, storageProvider: () => storage, moduleLoaders, timeoutMs: 1000 };
  return { options, calls, loaded, storage, values, web, digest, response, set hook(value) { hook = value; }, run: overrides => createInstallationPreflight({ ...options, ...overrides })() };
}

const failed = (report, name) => report.checks.find(check => check.name === name && check.ok === false);
const noDigest = f => assert.equal(f.calls.filter(call => call.init.method === 'POST').length, 0);

export async function runInstallationPreflightTests() {
  for (const webUrl of [WEB, '/']) {
    const f = fixture(webUrl), report = await f.run();
    assert.equal(report.ok, true, report.message);
    assert.equal(report.checks.length, REQUIRED_INSTALLATION_MODULES.length + REQUIRED_INSTALLATION_ASSETS.length + 5);
    assert.ok(report.checks.length <= 100, 'Service report limit');
    assert.deepEqual(new Set(f.loaded), new Set(REQUIRED_INSTALLATION_MODULES.map(entry => entry.name)));
    assert.equal(f.calls.length, REQUIRED_INSTALLATION_MODULES.length + REQUIRED_INSTALLATION_ASSETS.length + 2);
    assert.deepEqual([...f.values], [['minijoomla:installation:existing', 'preserve-me']]);
    assert.ok(f.calls.every(call => call.init.method === 'GET' || call.url.endsWith('/_api/contextinfo')));
    assert.ok(!JSON.stringify(report).includes(SECRET));
    assert.ok(!f.calls.some(call => /SiteAssets\/spmiddle|\/_api\/web\/lists|installation\.json|manifest\.json/.test(call.url)));
    assert.ok(report.checks.every(check => typeof check.name === 'string' && typeof check.message === 'string' && typeof check.ok === 'boolean'));
  }
  // Every invocation is fresh, including permission/digest and writable storage.
  {
    const f = fixture(), preflight = createInstallationPreflight(f.options);
    assert.equal((await preflight()).ok, true);
    f.web.EffectiveBasePermissions.Low = '0';
    const report = await preflight();
    assert.equal(report.ok, false); assert.ok(failed(report, 'manage-lists'));
    assert.equal(f.calls.filter(call => call.init.method === 'POST').length, 1);
  }
  // Actual import callbacks must run; an HTTP 200 alone proves nothing.
  for (const problem of ['import', 'export', 'client', 'factory-io']) {
    const f = fixture();
    f.options.moduleLoaders['SPMIDDLE REST'] = async () => {
      if (problem === 'import') throw new Error('Missing transitive module');
      if (problem === 'export') return { createSharePointRestClient() {} };
      return { createSharePointRestClient: ({ fetchImpl }) => problem === 'factory-io' ? fetchImpl('/not-allowed') : { request() {} }, createSharePointListClient() {}, createDataSourceRegistry() {} };
    };
    const report = await f.run();
    assert.equal(report.ok, false); assert.ok(failed(report, 'module:SPMIDDLE REST'));
    assert.match(report.message, /vendorizado no ZIP/); noDigest(f);
  }
  {
    const f = fixture();
    f.options.moduleLoaders['SPMIDDLE files'] = async () => ({ createSharePointFileClient: () => ({ listFiles() {}, uploadFile() {} }) });
    const report = await f.run();
    assert.equal(report.ok, false); assert.ok(failed(report, 'module:SPMIDDLE files')); noDigest(f);
  }
  {
    // A real ES-module namespace is accepted through the trusted loader hook.
    const f = fixture();
    f.options.moduleLoaders['installation journal'] = () => import('data:text/javascript,export function createInstallationJournal() {}');
    assert.equal((await f.run()).ok, true);
  }
  for (const problem of ['missing', 'html', 'mime', 'empty', 'oversize', 'redirect', 'network']) {
    const f = fixture(), path = REQUIRED_INSTALLATION_ASSETS[0];
    f.hook = url => {
      if (!url.endsWith(path)) return;
      if (problem === 'missing') return f.response('', 'text/css', { status: 404 });
      if (problem === 'html') return f.response('<!doctype html><html>login</html>', 'text/css');
      if (problem === 'mime') return f.response('login', 'text/html');
      if (problem === 'empty') return f.response('', 'text/css');
      if (problem === 'oversize') return f.response('x', 'text/css', { headers: { 'content-length': String(3 * 1024 * 1024) } });
      if (problem === 'redirect') return { ok: true, status: 200, redirected: true };
      throw new Error('Offline');
    };
    const report = await f.run();
    assert.equal(report.ok, false); assert.ok(failed(report, `asset:${path}`), problem); noDigest(f);
  }
  {
    const f = fixture();
    f.hook = url => url.includes('sharepoint-rest-browser/src/index.js') ? f.response('', 'text/javascript', { status: 404 }) : undefined;
    const report = await f.run();
    assert.equal(report.ok, false); assert.ok(!f.loaded.includes('SPMIDDLE REST')); noDigest(f);
  }
  for (const problem of ['blocked', 'silent', 'remove', 'throwing-provider']) {
    const f = fixture();
    if (problem === 'blocked') f.storage.setItem = () => { throw new Error('Storage blocked'); };
    if (problem === 'silent') f.storage.setItem = () => {};
    if (problem === 'remove') f.storage.removeItem = () => {};
    if (problem === 'throwing-provider') f.options.storageProvider = () => { throw new Error('Storage unavailable'); };
    const report = await f.run();
    assert.equal(report.ok, false); assert.ok(failed(report, 'storage')); noDigest(f);
    assert.equal(f.values.get('minijoomla:installation:existing'), 'preserve-me');
  }
  for (const problem of ['web-id', 'web-path', 'web-url', 'permission', 'permission-shape', 'permission-overflow', 'denied']) {
    const f = fixture();
    if (problem === 'web-id') f.web.Id = '';
    if (problem === 'web-path') f.web.ServerRelativeUrl = '/sites/other';
    if (problem === 'web-url') f.web.Url = 'https://outside.invalid/sites/example';
    if (problem === 'permission') f.web.EffectiveBasePermissions.Low = '1024';
    if (problem === 'permission-shape') f.web.EffectiveBasePermissions.Low = true;
    if (problem === 'permission-overflow') f.web.EffectiveBasePermissions.Low = '4294969344';
    if (problem === 'denied') f.hook = url => url.includes('/_api/web?') ? f.response('{}', 'application/json', { status: 403 }) : undefined;
    const report = await f.run();
    assert.equal(report.ok, false); assert.ok(failed(report, 'manage-lists')); noDigest(f);
  }
  {
    const f = fixture(); f.web.EffectiveBasePermissions = { Low: '-1', High: '-1' };
    assert.equal((await f.run()).ok, true, 'SharePoint signed full-control masks');
  }
  for (const problem of ['empty', 'expired', 'other-web', 'denied', 'malformed-secret']) {
    const f = fixture();
    if (problem === 'empty') f.digest.FormDigestValue = '';
    if (problem === 'expired') f.digest.FormDigestTimeoutSeconds = 30;
    if (problem === 'other-web') f.digest.WebFullUrl = 'https://tenant.example/sites/other';
    if (problem === 'denied') f.hook = url => url.endsWith('/_api/contextinfo') ? f.response('{}', 'application/json', { status: 403 }) : undefined;
    if (problem === 'malformed-secret') f.hook = url => url.endsWith('/_api/contextinfo') ? f.response(`{ ${SECRET}`, 'application/json') : undefined;
    const report = await f.run();
    assert.equal(report.ok, false); assert.ok(failed(report, 'request-digest'));
    assert.ok(!JSON.stringify(report).includes(SECRET));
  }
  for (const releaseUrl of [RELEASE.replace('tenant.example', 'outside.invalid'), `${RELEASE}?v=2`, RELEASE.replace('/1.0.0/', '/1.0.0/extra/'), RELEASE.replace('/1.0.0/', '/%31.0.0/'), RELEASE.replace('https:', 'http:')]) {
    const f = fixture(), report = await f.run({ releaseUrl });
    assert.equal(report.ok, false); assert.equal(f.calls.length, 0); assert.equal(f.values.size, 1);
  }
  // Bound fetch/body/import waiting even when test implementations ignore abort.
  for (const problem of ['fetch', 'body', 'module']) {
    const f = fixture(); let signal;
    if (problem === 'module') f.options.moduleLoaders['installation journal'] = () => new Promise(() => {});
    else f.hook = (url, init) => {
      if (!url.endsWith(REQUIRED_INSTALLATION_ASSETS[0])) return;
      signal = init.signal;
      return problem === 'fetch' ? new Promise(() => {}) : { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/css' }), text: () => new Promise(() => {}) };
    };
    const started = Date.now(), report = await f.run({ timeoutMs: 20 });
    assert.equal(report.ok, false); assert.ok(Date.now() - started < 2000);
    assert.ok(report.checks.some(check => /Tempo limite/.test(check.message)));
    if (signal) assert.equal(signal.aborted, true); noDigest(f);
  }
  {
    const f = fixture(), controller = new AbortController(); controller.abort();
    const report = await createInstallationPreflight(f.options)({ signal: controller.signal });
    assert.equal(report.ok, false); assert.equal(f.calls.length, 0);
  }
  {
    const f = fixture(); let active = true;
    f.hook = url => { if (url.includes('/_api/web?')) active = false; };
    const report = await createInstallationPreflight(f.options)({ isCurrent: () => active });
    assert.equal(report.ok, false); noDigest(f);
  }
  const source = await readFile(new URL('../host-adapters/modern-script-editor/installation-preflight.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  assert.deepEqual(imports, REQUIRED_INSTALLATION_MODULES.map(entry => `../${entry.path}`));
  assert.doesNotMatch(source, /import\(\s*(?:url|specifier|entry\.path)/);
  const host = await readFile(new URL('../host-adapters/modern-script-editor/host.js', import.meta.url), 'utf8');
  assert.match(host, /createInstallationService\(\{port,journalStore,preflight,locks\}\)/);
  assert.match(host, /mountInstallationPage\(\{root,service,publicView:/);
  assert.doesNotMatch(host, /mountInstallationPage\(\{root,service,preflight,/);
  assert.match(host, /Instalação desabilitada/); assert.match(host, /data-install-recheck/);
  console.log('ok - installation preflight: literal import contracts, bounded same-release assets, storage probe, current web, ManageLists, digest, cancellation and service-only host wiring');
}
