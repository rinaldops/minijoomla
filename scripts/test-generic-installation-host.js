import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { stageGenericInstallation } from './stage-generic-installation.js';
import { createInstallationMemoryServer } from '../tests/sharepoint-installation.test.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = '/sites/example', LIBRARY = `${WEB}/SiteAssets/minijoomla`;
const RELEASE = `https://tenant.example${LIBRARY}/releases/0.1.0/`;
const within = (root, path) => path === root || (!isAbsolute(relative(root, path)) && relative(root, path) !== '..' && !relative(root, path).startsWith(`..${sep}`));
const plain = value => JSON.parse(JSON.stringify(value));
const writes = server => server.calls.filter(call => call.method !== 'GET');
const decode = value => value.replace(/&(quot|amp|lt|gt|#39);/g, (_, name) => ({ quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'" })[name]);
const valueOf = attributes => decode(attributes.match(/\bvalue="([^"]*)"/)?.[1] ?? '');

// Rendering-string/form-handle contract only: no browser, DOM emulator, editor,
// layout, HTML constraint validation or tenant acceptance is claimed.
function documentContract(kind, release) {
  const styles = [], listeners = new Map();
  const root = {
    textContent: '', attributes: {}, isConnected: true, html: '', forms: new Map(),
    matches: selector => selector === `[data-minijoomla-${kind === 'admin' ? 'admin-root' : 'site'}]`,
    setAttribute(name, value) { this.attributes[name] = value; },
    get innerHTML() { return this.html; },
    set innerHTML(html) {
      this.html = html; this.forms.clear();
      for (const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)) {
        const key = /\bdata-install-form\b/.test(match[1]) ? '[data-install-form]' : /\bdata-admin-form\b/.test(match[1]) ? '[data-admin-form]' : null;
        if (!key) continue;
        const controls = new Map(), handlers = new Map();
        for (const input of match[2].matchAll(/<(input|textarea|select)\b([^>]*\bname="([^"]+)"[^>]*)(?:>([\s\S]*?)<\/\1>|>)/g)) {
          const [, tag, attrs, name, body = ''] = input;
          const options = [...body.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)];
          const selected = options.find(option => /\bselected\b/.test(option[1])) ?? options[0];
          controls.set(name, { value: tag === 'textarea' ? decode(body) : tag === 'select' ? selected ? valueOf(selected[1]) : '' : valueOf(attrs), checked: /\bchecked\b/.test(attrs), disabled: /\bdisabled\b/.test(attrs) });
        }
        const button = { disabled: /<button\b[^>]*type="submit"[^>]*\bdisabled\b/.test(match[2]) };
        const form = {
          controls, handlers, button, elements: { namedItem: name => controls.get(name) ?? null },
          querySelector(selector) { return selector === 'button[type="submit"]' ? button : controls.get(selector.match(/^\[name="([^"]+)"\]$/)?.[1]) ?? null; },
          querySelectorAll: () => [], addEventListener: (name, handler) => handlers.set(name, handler),
          async submit() { assert.equal(button.disabled, false); assert.ok(handlers.has('submit'), 'Actual UI bound submit'); let prevented = false; await handlers.get('submit')({ preventDefault() { prevented = true; } }); assert.ok(prevented); }
        };
        this.forms.set(key, form);
      }
    },
    querySelector(selector) {
      if (this.forms.has(selector)) return this.forms.get(selector);
      if (selector === '[data-install-recheck]' && this.html.includes('data-install-recheck')) return { addEventListener: (name, handler) => listeners.set(name, handler) };
      if (selector === '[data-install-status]' && this.html.includes('data-install-status')) return this.status ??= { textContent: '' };
      return null;
    },
    querySelectorAll: () => []
  };
  const document = {
    root, styles, baseURI: `${release}host/${kind}.html`, title: '', documentElement: {}, body: { innerHTML: 'Host page preserved' },
    querySelector(selector) { assert.equal(selector, '[data-minijoomla-site],[data-minijoomla-admin-root]'); return root; },
    createElement(tag) {
      assert.equal(tag, 'link', 'Never load TinyMCE/script resources in this contract');
      return { setAttribute() {}, remove() { const index = styles.indexOf(this); if (index >= 0) styles.splice(index, 1); } };
    },
    head: { append(link) { styles.push(link); }, appendChild(link) { styles.push(link); } }
  };
  return document;
}

async function loadHost(rootPath, inventory, server, storage, kind) {
  const web = server.webUrl === '/' ? '' : server.webUrl;
  const release = `https://tenant.example${server.libraryPath}/releases/0.1.0/`;
  const document = documentContract(kind, release), diagnostics = [], requests = [], violations = [], events = new Map();
  const context = vm.createContext({ URL, URLSearchParams, TextEncoder, TextDecoder, crypto: webcrypto, AbortController, AbortSignal,
    document, localStorage: storage, location: { origin: 'https://tenant.example', href: document.baseURI, pathname: new URL(document.baseURI).pathname, hash: '#/', search: '' },
    _spPageContextInfo: { webServerRelativeUrl: server.webUrl },
    addEventListener: (name, handler) => events.set(name, handler), removeEventListener(name, handler) { if (events.get(name) === handler) events.delete(name); },
    console: Object.fromEntries(['warn', 'error', 'log'].map(level => [level, (...args) => diagnostics.push([level, ...args])]))
  });
  const parse = vm.runInContext('(text) => JSON.parse(text)', context);
  const response = result => {
    const text = result.status === 204 ? '' : JSON.stringify(result.data);
    return { ok: result.status >= 200 && result.status < 300, status: result.status,
      headers: { get: name => name.toLowerCase() === 'etag' ? result.etag ?? null : null },
      text: async () => text, json: async () => parse(text) };
  };
  context.fetch = async (url, init = {}) => {
    try {
      assert.equal(typeof url, 'string');
      assert.ok(url.startsWith(`${web}/_api/`) && !url.includes('//'), 'Fetch confined to simulated current web, no double slash');
      requests.push({ url, method: init.headers?.['X-HTTP-Method'] ?? init.method ?? 'GET' });
      if (url === `${web}/_api/contextinfo`) {
        assert.equal(init.method, 'POST');
        return response({ status: 200, data: { FormDigestValue: 'offline-fixture-only', FormDigestTimeoutSeconds: 1800 } });
      }
      if (url === `${web}/_api/web/currentuser?$select=Title`) return response({ status: 200, data: {} });
      const method = init.headers?.['X-HTTP-Method'] ?? init.method ?? 'GET';
      if (method !== 'GET') {
        assert.equal(init.headers['X-RequestDigest'], 'offline-fixture-only');
        if (!url.includes('/items')) { assert.ok(init.signal instanceof AbortSignal); assert.equal(init.signal.aborted, false); }
      }
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      return response(await server.transport.request(url, { method, body, headers: init.headers, etag: init.headers?.['If-Match'], signal: init.signal }));
    } catch (error) {
      if (Number.isInteger(error.status)) return response({ status: error.status, data: {} });
      violations.push(error.message); throw error;
    }
  };
  const loaded = new Map(), evaluations = new Map(); let links = Promise.resolve();
  function moduleUrl(specifier, parent = release) {
    assert.ok(specifier.startsWith('.'), `Nonlocal import forbidden: ${specifier}`);
    const url = new URL(specifier, parent);
    assert.equal(url.origin, new URL(release).origin, 'External import forbidden');
    assert.ok(url.href.startsWith(release) && !url.search && !url.hash, `Import outside staged release: ${specifier}`);
    const name = url.pathname.slice(new URL(release).pathname.length);
    assert.equal(name, decodeURIComponent(name), 'Encoded import forbidden');
    assert.ok(inventory.has(name), `Import not inventoried: ${name}`);
    const path = resolve(rootPath, name); assert.ok(within(rootPath, path));
    let current = rootPath;
    for (const part of relative(rootPath, path).split(sep)) { current = join(current, part); assert.equal(lstatSync(current).isSymbolicLink(), false); }
    assert.ok(lstatSync(path).isFile());
    return url;
  }
  function moduleFor(url) {
    if (!loaded.has(url.href)) {
      const name = url.pathname.slice(new URL(release).pathname.length);
      const module = new vm.SourceTextModule(readFileSync(join(rootPath, name), 'utf8'), { context, identifier: url.href,
        initializeImportMeta(meta) { meta.url = url.href; },
        async importModuleDynamically(specifier, parent) { return evaluate(moduleFor(moduleUrl(specifier, parent.identifier))); }
      });
      loaded.set(url.href, module);
    }
    return loaded.get(url.href);
  }
  const linker = (specifier, parent) => moduleFor(moduleUrl(specifier, parent.identifier));
  async function evaluate(module) {
    // Serialize root linking, not evaluation: concurrently imported roots share
    // static dependencies without racing .link() while another graph links them.
    const linked = links.then(async () => { if (module.status === 'unlinked') await module.link(linker); });
    links = linked.catch(() => {}); await linked;
    if (!evaluations.has(module)) evaluations.set(module, module.evaluate({ timeout: 10000 }));
    await evaluations.get(module); return module;
  }
  await evaluate(moduleFor(moduleUrl('./host/host.js')));
  const clean = () => {
    assert.deepEqual(violations, [], 'No forbidden requests or fixture contract failures swallowed by application');
    assert.deepEqual(diagnostics, [], 'No swallowed host/navigation/import diagnostics');
    assert.notEqual(document.root.attributes.role, 'alert');
    assert.doesNotMatch(document.root.innerHTML, /Instalação preservada|Não foi possível carregar/);
    assert.equal(document.body.innerHTML, 'Host page preserved');
    for (const style of document.styles) { const url = new URL(style.href); assert.ok(url.href.startsWith(release)); assert.ok(inventory.has(url.pathname.slice(new URL(release).pathname.length)), 'Styles belong to exact package'); }
  };
  clean();
  return { document, loaded, requests, clean, moduleUrl, async navigate(hash) { context.location.hash = hash; assert.ok(events.has('hashchange')); await events.get('hashchange')(); clean(); } };
}

function serverFixture(webUrl = WEB) {
  const server = createInstallationMemoryServer({ webUrl });
  server.hook = call => {
    if (call.url.includes('/GetFolderByServerRelativePath(') && decodeURIComponent(call.url).includes(`${server.libraryPath}/uploads`)) {
      assert.equal(call.method, 'GET', 'Media navigation never creates the uploads folder');
      return { status: 404, data: {} };
    }
    const match = call.url.match(/\/lists\(guid'([^']+)'\)\/items(?:\((\d+)\))?(?:\?|$)/);
    if (!match) return;
    const list = [...server.lists.values()].find(list => list.Id === match[1]); assert.ok(list, 'Repository reads configured GUID');
    if (call.method === 'POST') {
      assert.equal(server.explicitConfigurationSave, true, 'No automatic editorial/configuration rows');
      assert.equal(list, server.lists.get('siteConfig')); assert.equal(list.rows.length, 0);
      for (const key of Object.keys(call.body)) assert.ok(list.fields.some(field => field.InternalName === key), `Provisioned configuration field: ${key}`);
      assert.equal(call.body.Title, 'MiniJoomlaSiteConfig'); assert.equal(call.body.PageSize, 10);
      assert.equal(call.body.TemplateKey, 'cassiopeia'); assert.equal(call.body.HomeView, 'featured'); assert.equal(call.body.HomeCategory, '');
      list.rows.push({ ...call.body, Id: 1, 'odata.etag': '"item-1"' }); list.ItemCount = 1;
      return { status: 201, data: list.rows[0], etag: '"item-1"' };
    }
    assert.equal(call.method, 'GET', 'Focused fixture never allows unrequested item mutations');
    const select = new URLSearchParams(call.url.split('?')[1]).get('$select');
    assert.ok(select === null || select.split(',').includes('Id'), 'All-fields or explicit identity selection');
    if (match[2]) { const row = list.rows.find(row => row.Id === Number(match[2])); assert.ok(row); return { status: 200, data: row, etag: row['odata.etag'] }; }
    return { status: 200, data: { value: list.rows }, etag: null };
  };
  return server;
}

export async function verifyGenericInstallationHost(rootPath) {
  assert.equal(typeof vm.SourceTextModule, 'function', 'Child requires --experimental-vm-modules');
  rootPath = resolve(rootPath); assert.ok(within(join(PROJECT, 'tmp'), rootPath) && rootPath !== join(PROJECT, 'tmp'));
  const manifest = JSON.parse(readFileSync(join(rootPath, 'manifest.json'), 'utf8'));
  assert.equal(manifest.target, 'all');
  const inventory = new Set(manifest.files.map(file => file.path));
  function unchanged() { for (const file of manifest.files) { const bytes = readFileSync(join(rootPath, file.path)); assert.equal(bytes.length, file.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path); } }
  unchanged();
  assert.match(readFileSync(join(rootPath, 'host/host.js'), 'utf8'), /const PRECONFIGURED = \/\* MINIJOOMLA_CONFIG \*\/ null;/);
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  const server = serverFixture();
  const admin = await loadHost(rootPath, inventory, server, storage, 'admin');
  const form = admin.document.root.querySelector('[data-install-form]'); assert.ok(form);
  assert.match(admin.document.root.innerHTML, /Confirmação explícita necessária/);
  assert.equal(writes(server).length, 0); assert.equal(values.size, 0);
  const publicMissing = await loadHost(rootPath, inventory, server, storage, 'site');
  assert.match(publicMissing.document.root.innerHTML, /administrador deve concluir/);
  assert.equal(publicMissing.document.root.querySelector('[data-install-form]'), null);
  assert.equal(writes(server).length, 0); assert.equal(values.size, 0);
  console.log('ok - generic host: administrator/public missing bootstrap is readonly; public has no install action');
  await form.submit(); assert.equal(writes(server).length, 0, 'Unchecked confirmation cannot install');
  form.controls.get('siteName').value = 'Portal genérico instalado'; form.controls.get('siteDescription').value = 'Instalação vazia'; form.controls.get('confirmed').checked = true;
  await form.submit(); admin.clean();
  assert.match(admin.document.root.innerHTML, /Painel de controle/);
  assert.equal(server.lists.size, 8);
  assert.deepEqual(server.config.initialSite, { siteName: 'Portal genérico instalado', siteDescription: 'Instalação vazia', timezone: 'UTC', language: 'pt-BR', pageSize: 10, templateKey: 'cassiopeia', homeView: 'featured', homeCategory: '', offline: false, offlineMessage: '' });
  assert.deepEqual(server.config.joomlaDiscoveryRoots, []); assert.deepEqual(server.config.moduleStyles, {}); assert.deepEqual(server.config.moduleStyleRevisions, {});
  for (const [domain, list] of server.lists) { assert.equal(list.ItemCount, 0); assert.deepEqual(list.rows, []); assert.equal(server.config.lists[domain].listId, list.Id); }
  const journal = JSON.parse(values.get(`minijoomla:installation:${WEB}`));
  assert.equal(journal.receipts.length, 8); assert.equal(journal.pending, null); assert.equal(journal.configurationReceipt.etag, '"config-1"'); assert.deepEqual(journal.configurationReceipt.configuration, server.config);
  const mutations = writes(server); assert.equal(mutations.filter(call => call.url.endsWith('/lists')).length, 8);
  assert.equal(mutations.filter(call => call.url.includes('/Files/AddUsingPath')).length, 1);
  assert.ok(mutations.every(call => !/\/items|recycle|DELETE/.test(call.url)));
  assert.ok(mutations.filter(call => call.method === 'MERGE').every(call => /^"field-\d+"$/.test(call.etag) && call.headers['If-Match'] === call.etag));
  console.log('ok - generic host: actual installation form requires confirmation, creates eight empty lists/configuration and durable strong-ETag receipts');
  const saved = plain([...server.lists]), stored = new Map(values), count = mutations.length;
  const reloaded = await loadHost(rootPath, inventory, server, storage, 'admin');
  assert.match(reloaded.document.root.innerHTML, /Painel de controle/); assert.equal(writes(server).length, count);
  await reloaded.navigate('#/media');
  assert.match(reloaded.document.root.innerHTML, /data-ext-upload/); assert.match(reloaded.document.root.innerHTML, /Nenhum arquivo/);
  assert.ok(server.calls.some(call => decodeURIComponent(call.url).includes(`${LIBRARY}/uploads`) && call.method === 'GET'));
  assert.equal(writes(server).length, count, 'Reading missing media folder never provisions it');
  const site = await loadHost(rootPath, inventory, server, storage, 'site');
  assert.match(site.document.root.innerHTML, /data-template="cassiopeia"/);
  assert.match(site.document.root.innerHTML, /Portal genérico instalado|Nenhum artigo/);
  assert.doesNotMatch(site.document.root.innerHTML, /Bem-vindo ao MINIJOOMLA|Artigos recentes|camap-hero|Destaque CAMAP|Organize o seu portal/);
  assert.equal(site.document.root.lang, 'pt-BR');
  for (const suffix of ['infrastructure/spmiddle-schemas.js', 'application/installation-service.js', 'infrastructure/sharepoint-installation.js', 'composition/createMiniJoomlaAdminApp.js', 'application/admin-service.js', 'composition/mountMiniJoomlaSite.js', 'vendor/spmiddle/sharepoint-rest-browser/src/index.js', 'vendor/spmiddle/data-core/src/index.js']) assert.ok([...admin.loaded.keys(), ...site.loaded.keys()].some(url => url.endsWith(suffix)), `Actual staged module evaluated: ${suffix}`);
  assert.deepEqual(plain([...server.lists]), saved); assert.deepEqual(values, stored); assert.equal(writes(server).length, count);
  console.log('ok - generic host: readonly admin reload/media and public empty Cassiopeia use actual staged repositories, no sample data/hero');
  for (const mode of ['missing', 'corrupt']) {
    const blocked = serverFixture(); blocked.seedAll(); if (mode === 'corrupt') blocked.config = { broken: true };
    for (const kind of ['admin', 'site']) { const host = await loadHost(rootPath, inventory, blocked, { getItem: () => null, setItem() { assert.fail('Blocked installation never journals'); } }, kind); assert.equal(host.document.root.querySelector('[data-install-form]'), null); assert.match(host.document.root.innerHTML, /Instalação do MINIJOOMLA/); }
    assert.equal(writes(blocked).length, 0);
  }
  for (const specifier of ['https://outside.invalid/module.js', '../../../../SPMIDDLE/module.js', './missing.js']) assert.throws(() => site.moduleUrl(specifier, `${RELEASE}host/host.js`), /forbidden|outside staged|not inventoried/i);
  console.log('ok - generic host: existing missing/corrupt configuration blocks without writes; external/outside/missing module controls rejected');
  await reloaded.navigate('#/config');
  const configForm = reloaded.document.root.querySelector('[data-admin-form]'); assert.ok(configForm);
  for (const [name, expected] of Object.entries(server.config.initialSite)) {
    const control = configForm.controls.get(name); assert.ok(control, `Rendered configuration ${name}`);
    assert.equal(name === 'offline' ? control.checked : control.value, typeof expected === 'boolean' ? expected : String(expected), `Installed settings reach actual admin form: ${name}`);
  }
  assert.equal(writes(server).length, count); assert.deepEqual(values, stored);
  server.explicitConfigurationSave = true;
  await configForm.submit(); reloaded.clean();
  assert.equal(writes(server).length, count + 1, 'Only an explicit configuration submit creates its first row');
  assert.equal(server.lists.get('siteConfig').ItemCount, 1);
  for (const [field, expected] of [['SiteName', 'Portal genérico instalado'], ['SiteDescription', 'Instalação vazia'], ['Timezone', 'UTC'], ['Language', 'pt-BR'], ['Offline', false], ['OfflineMessage', '']]) assert.equal(server.lists.get('siteConfig').rows[0][field], expected, `Saved full default: ${field}`);
  const savedSite = await loadHost(rootPath, inventory, server, storage, 'site');
  assert.match(savedSite.document.root.innerHTML, /data-template="cassiopeia"/); assert.doesNotMatch(savedSite.document.root.innerHTML, /Artigos recentes|camap-hero/);
  assert.deepEqual(values, stored); assert.equal(writes(server).length, count + 1);
  console.log('ok - generic host: real configuration form retains full installed defaults, explicit save only, public reload consumes first configuration row');
  const rootServer = serverFixture('/'), rootValues = new Map();
  const rootStorage = { getItem: key => rootValues.get(key) ?? null, setItem: (key, value) => rootValues.set(key, String(value)) };
  const rootAdmin = await loadHost(rootPath, inventory, rootServer, rootStorage, 'admin');
  const rootForm = rootAdmin.document.root.querySelector('[data-install-form]'); assert.ok(rootForm); assert.equal(writes(rootServer).length, 0);
  rootForm.controls.get('siteName').value = 'Portal raiz'; rootForm.controls.get('confirmed').checked = true;
  await rootForm.submit(); rootAdmin.clean(); assert.match(rootAdmin.document.root.innerHTML, /Painel de controle/);
  assert.equal(rootServer.lists.size, 8); assert.equal(rootServer.config.webUrl, '/'); assert.equal(rootServer.config.libraryPath, '/SiteAssets/minijoomla');
  const rootCount = writes(rootServer).length, rootSaved = new Map(rootValues);
  const rootReload = await loadHost(rootPath, inventory, rootServer, rootStorage, 'admin');
  await rootReload.navigate('#/media'); assert.match(rootReload.document.root.innerHTML, /data-ext-upload/); assert.match(rootReload.document.root.innerHTML, /Nenhum arquivo/);
  const rootSite = await loadHost(rootPath, inventory, rootServer, rootStorage, 'site');
  assert.match(rootSite.document.root.innerHTML, /data-template="cassiopeia"/); assert.match(rootSite.document.root.innerHTML, /Portal raiz/);
  assert.ok(rootServer.calls.every(call => call.url.startsWith('/_api/') && !call.url.includes('//')));
  assert.equal(writes(rootServer).length, rootCount); assert.deepEqual(rootValues, rootSaved);
  assert.ok([...rootServer.lists.values()].every(list => list.ItemCount === 0 && list.rows.length === 0));
  unchanged();
  console.log('Generic installation host: 8 offline contract groups passed; exact staged all payload, real VM modules/REST client/UI submit/reload, root web/media, no browser/editor/tenant acceptance');
}

export async function runGenericInstallationHost() {
  mkdirSync(join(PROJECT, 'tmp'), { recursive: true });
  const base = mkdtempSync(join(PROJECT, 'tmp', 'generic-installation-host-'));
  try {
    const staged = await stageGenericInstallation({ version: '0.1.0', output: `${relative(PROJECT, base).split(sep).join('/')}/release` });
    const child = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', `import { verifyGenericInstallationHost } from ${JSON.stringify(import.meta.url)}; await verifyGenericInstallationHost(${JSON.stringify(staged.output)});`], { cwd: staged.output, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.ok(child.stdout.includes('Generic installation host: 8 offline contract groups passed;')); process.stdout.write(child.stdout);
    return { groups: 8, browserTested: false, richEditorTested: false, tenantTested: false, stagedTarget: 'all', realSPMiddle: true };
  } finally { rmSync(base, { recursive: true, force: true }); } // Only this invocation's unique fixture.
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { assert.equal(process.argv.length, 2, 'Usage: node scripts/test-generic-installation-host.js'); await runGenericInstallationHost(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
