import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const within = (root, path) => path === root || (!relative(root, path).startsWith(`..${sep}`) && relative(root, path) !== '..' && !isAbsolute(relative(root, path)));
const FIXED_NOW = Date.parse('2026-11-04T12:00:00Z');

// This is a Node contract harness, not a DOM emulator or a browser smoke test.
// Only rendering strings, stylesheet declarations, storage and router events
// are observed. No selectors are fabricated to pretend an editor was mounted.
function documentContract(baseURI, root) {
  const body = {
    innerHTML: '', textContent: '', attributes: {},
    querySelector: () => null, querySelectorAll: () => [],
    setAttribute(name, value) { this.attributes[name] = value; }
  };
  const styles = [];
  return {
    body, styles, baseURI, title: '', documentElement: {},
    querySelector: (selector) => selector === '[data-admin-root]' ? root ?? body : null,
    createElement(tag) {
      assert.equal(tag, 'link', 'Node contracts must not load script/TinyMCE resources');
      return { setAttribute() {}, remove() { const index = styles.indexOf(this); if (index >= 0) styles.splice(index, 1); } };
    },
    head: { appendChild(link) { styles.push(link); } }
  };
}

async function loadExample(root, page, storage, search = '') {
  assert.equal(typeof vm.SourceTextModule, 'function', 'Child requires --experimental-vm-modules');
  const pageUrl = pathToFileURL(join(root, 'examples', page));
  const html = readFileSync(pageUrl, 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, `${page}: expected exactly one local inline module`);
  assert.match(scripts[0][1], /\btype\s*=\s*["']module["']/i);
  assert.doesNotMatch(scripts[0][1], /\bsrc\s*=/i);
  for (const match of html.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const style = new URL(match[1], pageUrl);
    assert.equal(style.protocol, 'file:');
    assert.ok(within(join(root, 'src'), fileURLToPath(style)), 'Example stylesheet must be owned source');
    assert.ok(lstatSync(style).isFile());
  }
  const document = documentContract(pageUrl.href);
  const listeners = new Map();
  const diagnostics = [];
  const networkAttempts = [];
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [FIXED_NOW])); }
    static now() { return FIXED_NOW; }
  }
  const context = vm.createContext({
    URL, URLSearchParams, structuredClone, Date: FixedDate, document,
    location: { hash: '#/', search }, localStorage: storage,
    console: Object.fromEntries(['warn', 'error', 'log'].map((level) => [level, (...args) => diagnostics.push([level, ...args])])),
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
    fetch(...args) { networkAttempts.push(args); throw new Error('Standalone example contracts forbid network'); }
  });
  const loaded = new Map();
  function localUrl(specifier, parent) {
    const url = new URL(specifier, parent);
    assert.equal(url.protocol, 'file:', `External import forbidden: ${specifier}`);
    const path = fileURLToPath(url);
    assert.ok(['src', 'examples'].some((directory) => within(join(root, directory), path)), `Import outside standalone source: ${specifier}`);
    assert.ok(!relative(root, path).split(sep).includes('vendor'), 'Minified vendor/editor is outside this contract');
    let current = root;
    for (const part of relative(root, path).split(sep)) {
      current = join(current, part);
      assert.equal(lstatSync(current).isSymbolicLink(), false, 'Linked modules cannot escape the snapshot');
    }
    assert.ok(lstatSync(path).isFile(), `Missing local module: ${specifier}`);
    return url;
  }
  function moduleFor(url, source) {
    if (!loaded.has(url.href)) {
      const module = new vm.SourceTextModule(source ?? readFileSync(url, 'utf8'), {
        context, identifier: url.href,
        initializeImportMeta(meta) { meta.url = url.href; },
        async importModuleDynamically(specifier, parent) {
          const dependency = moduleFor(localUrl(specifier, parent.identifier));
          if (dependency.status === 'unlinked') await dependency.link(linker);
          if (dependency.status === 'linked') await dependency.evaluate({ timeout: 5000 });
          return dependency;
        }
      });
      loaded.set(url.href, module);
    }
    return loaded.get(url.href);
  }
  const linker = (specifier, parent) => moduleFor(localUrl(specifier, parent.identifier));
  const bootstrap = moduleFor(pageUrl, scripts[0][2]);
  await bootstrap.link(linker);
  await bootstrap.evaluate({ timeout: 5000 });
  const ready = () => {
    assert.deepEqual(diagnostics, [], `${page}: no swallowed bootstrap/navigation/import errors or warnings`);
    assert.deepEqual(networkAttempts, []);
    assert.ok(document.body.innerHTML, `${page}: bootstrap rendered actual HTML`);
    assert.notEqual(document.body.attributes.role, 'alert', `${page}: bootstrap must not fall back to an alert`);
    assert.ok(listeners.has('hashchange') && listeners.has('popstate'), `${page}: actual router started`);
  };
  ready();
  return {
    document, loaded, diagnostics,
    async navigate(hash) { context.location.hash = hash; await listeners.get('hashchange')(); ready(); return document.body.innerHTML; },
    async repositories() {
      const module = moduleFor(pathToFileURL(join(root, 'examples', 'demo-repositories.js')));
      return module.namespace.createDemoRepositories({ storage });
    },
    async adminService() {
      const module = moduleFor(pathToFileURL(join(root, 'src', 'libraries', 'minijoomla', 'application', 'admin-service.js')));
      return module.namespace.createAdminService(await this.repositories());
    }
  };
}

// Exported for the isolated child only; permit its own source checkout or tmp.
export async function verifyStandaloneSnapshot(root) {
  root = resolve(root);
  assert.ok(root === PROJECT || (within(join(PROJECT, 'tmp'), root) && root !== join(PROJECT, 'tmp')));
  assert.ok(!existsSync(join(dirname(root), 'SPMIDDLE')));
  assert.ok(!existsSync(join(root, 'src', 'administrator', 'components', 'com_minijoomla', 'vendor')));
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  const site = await loadExample(root, 'index.html', storage);
  assert.match(site.document.body.innerHTML, /data-template="cassiopeia"/);
  assert.match(site.document.body.innerHTML, /Bem-vindo ao MINIJOOMLA/);
  assert.match(site.document.body.innerHTML, /Artigos recentes/);
  assert.equal(site.document.documentElement.lang, 'pt-BR');
  assert.ok(site.document.styles.some((style) => style.href.endsWith('/src/media/templates/site/cassiopeia/css/template.css')));
  for (const [route, expected] of [
    ['#/article/boas-vindas', /Edite este conteúdo no painel local/],
    ['#/category/noticias', /Organize o seu portal/],
    ['#/search?q=portal', /Organize o seu portal/],
    ['#/archive?year=2026&month=2', /Organize o seu portal/]
  ]) assert.match(await site.navigate(route), expected, route);
  console.log('ok - standalone examples: unchanged public bootstrap, four content routes, actual local adapter/repositories/modules and stylesheet declarations');

  const admin = await loadExample(root, 'admin.html', storage);
  assert.match(admin.document.body.innerHTML, /Painel de controle/);
  assert.match(admin.document.body.innerHTML, /class="admin-overview-count">2<\/span><span class="admin-overview-label">Artigos/);
  for (const [route, expected] of [
    ['#/articles', /Bem-vindo ao MINIJOOMLA/],
    ['#/articles/1', /name="articletext"/],
    ['#/config', /Configuração do site/],
    ['#/moduleInstances', /Artigos recentes/],
    ['#/extensions', /demo-content/],
    ['#/templates', /Cassiopeia/]
  ]) assert.match(await admin.navigate(route), expected, route);
  console.log('ok - standalone examples: unchanged admin bootstrap, six routes and real admin service; string rendering only, no TinyMCE/DOM acceptance');

  const service = await admin.adminService();
  const article = await service.articles.get(1);
  const changed = await service.articles.update(1, { title: 'Contrato standalone salvo', fulltext: '<p>Texto salvo na demo.</p>' }, { etag: article.etag });
  assert.notEqual(changed.etag, article.etag);
  await assert.rejects(service.articles.update(1, { title: 'Stale write' }, { etag: article.etag }), (error) => error.status === 412 && error.code === 'concurrency-conflict');
  assert.match(await site.navigate('#/article/boas-vindas'), /Contrato standalone salvo/);
  const reloaded = await loadExample(root, 'index.html', storage);
  assert.match(await reloaded.navigate('#/article/boas-vindas'), /Texto salvo na demo/);
  assert.equal((await (await reloaded.repositories()).articles.findById(1)).title, 'Contrato standalone salvo');
  console.log('ok - standalone examples: real service update, shared storage reload, ETag conflict and public consumption (no synthetic form submission claim)');

  const plugin = (await service.extensions.list()).find((row) => row.key === 'demo-content');
  await service.extensions.update(plugin.id, { enabled: true }, { etag: plugin.etag });
  assert.match(await site.navigate('#/article/boas-vindas'), /Nota acrescentada pelo plugin demonstrativo/);
  assert.ok([...site.loaded.keys()].some((url) => url.endsWith('/examples/demo-plugin.js')), 'Actual dynamic plugin module evaluated');
  const enabledPlugin = await service.extensions.get(plugin.id);
  await service.extensions.update(plugin.id, { enabled: false }, { etag: enabledPlugin.etag });
  assert.doesNotMatch(await site.navigate('#/article/boas-vindas'), /Nota acrescentada pelo plugin demonstrativo/);
  console.log('ok - standalone examples: actual local dynamic plugin import, enable/disable reconciliation');

  for (const template of ['default', 'cassiopeia', 'camap']) {
    const preview = await loadExample(root, 'index.html', storage, `?template=${template}`);
    assert.deepEqual(preview.diagnostics, [], `${template}: clean preview defaults`);
    assert.match(preview.document.body.innerHTML, new RegExp(`data-template="${template === 'default' ? 'cassiopeia' : template}"`));
    for (const style of preview.document.styles) assert.ok(lstatSync(new URL(style.href)).isFile(), 'Declared template CSS exists in standalone checkout');
    assert.match(await preview.navigate('#/article/boas-vindas'), /Contrato standalone salvo/);
  }

  const config = await service.siteConfig.get();
  await service.siteConfig.save({
    siteName: 'Portal standalone salvo', siteDescription: 'Descrição global salva',
    language: 'en-GB', timezone: 'UTC', pageSize: 1, homeView: 'featured', homeCategory: 'noticias',
    customHtmlTitle: 'Título HTML salvo', customHtmlBody: '<p>HTML salvo.</p>',
    componentParamsJson: JSON.stringify({ content: { showIntro: false }, tags: { tagListLimit: 7 } }),
    templateStylesJson: JSON.stringify([
      { id: 'cassiopeia-other', template: 'cassiopeia', title: 'Outro estilo', home: false, params: { siteTitle: 'Não selecionar Cassiopeia' } },
      { id: 'cassiopeia-home', template: 'cassiopeia', title: 'Estilo Cassiopeia salvo', home: true, params: { brand: 'title', siteTitle: 'Marca Cassiopeia salva', colorName: 'alternative', stickyHeader: true, backTop: false } },
      { id: 'camap-other', template: 'camap', title: 'Outro estilo', home: false, params: { siteTitle: 'Não selecionar CAMAP' } },
      { id: 'camap-home', template: 'camap', title: 'Estilo CAMAP salvo', home: true, params: { brand: false, siteTitle: 'Marca CAMAP salva', heroTitle: 'Destaque CAMAP salvo', accentColor: 'blue', fluidContainer: true, backTop: true } }
    ])
  }, { etag: config.etag });
  for (const savedTemplate of ['cassiopeia', 'camap']) {
    const current = await service.siteConfig.get();
    await service.siteConfig.save({ templateKey: savedTemplate }, { etag: current.etag });
    const savedStorage = new Map(values);
    for (const template of [null, 'default', 'cassiopeia', 'camap']) {
      const preview = await loadExample(root, 'index.html', storage, template ? `?template=${template}` : '');
      const selected = template ?? savedTemplate;
      const html = preview.document.body.innerHTML;
      assert.deepEqual(preview.diagnostics, [], `${savedTemplate}/${selected}: clean saved-style preview`);
      assert.equal(preview.document.title, 'Portal standalone salvo');
      assert.equal(preview.document.documentElement.lang, 'en-GB');
      assert.match(html, /<h1>Portal standalone salvo<\/h1><p>Descrição global salva<\/p>/);
      assert.match(html, new RegExp(`data-template="${selected === 'default' ? 'cassiopeia' : selected}"`));
      assert.doesNotMatch(html, /Não selecionar/);
      if (selected === 'camap') {
        assert.match(html, /Marca CAMAP salva/);
        assert.match(html, /Destaque CAMAP salvo/);
        assert.match(html, /camap-template__header-main--no-brand/);
        assert.match(html, /camap-template--fluid/);
        assert.match(html, /--camap-accent:#006298/);
        assert.doesNotMatch(html, /Marca Cassiopeia salva/);
      } else if (selected === 'cassiopeia') {
        assert.match(html, /Marca Cassiopeia salva/);
        assert.match(html, /data-color-name="alternative"/);
        assert.match(html, /position-sticky sticky-top/);
        assert.doesNotMatch(html, /id="back-top"|Marca CAMAP salva|Destaque CAMAP salvo/);
      } else {
        assert.match(html, /data-color-name="standard"/);
        assert.doesNotMatch(html, /Marca Cassiopeia salva|Marca CAMAP salva|Destaque CAMAP salvo/);
      }
      const articleHtml = await preview.navigate('#/article/boas-vindas');
      assert.match(articleHtml, /Contrato standalone salvo/);
      assert.doesNotMatch(articleHtml, /Conteúdo modular com administração independente/);
      assert.deepEqual(values, savedStorage, 'Preview/reload/navigation preserve all saved demo data and ETags byte-for-byte');
    }
    const resumed = await loadExample(root, 'index.html', storage);
    assert.match(resumed.document.body.innerHTML, new RegExp(`data-template="${savedTemplate}"`));
    assert.deepEqual(values, savedStorage, 'No-query reload still uses the saved template without persisting preview selection');
  }
  console.log('ok - standalone examples: all three previews use owned source/CSS without diagnostics, select their own saved styles/defaults and preserve persisted configuration');

  for (const page of ['index.html', 'admin.html']) {
    await assert.rejects(loadExample(root, page, { getItem: () => '{broken', setItem() {} }), /swallowed bootstrap/);
    await assert.rejects(loadExample(root, page, { getItem() { throw new Error('Storage unavailable'); }, setItem() {} }), /swallowed bootstrap/);
  }
  console.log('ok - standalone examples: corrupt/unavailable storage is detected, never reported as a passing bootstrap');

  // Negative controls mutate only this invocation's snapshot, never app sources.
  const page = join(root, 'examples', 'index.html');
  const original = readFileSync(page, 'utf8');
  try {
    writeFileSync(page, original.replace("'../src/index.js'", "'../../SPMIDDLE/missing.js'"));
    await assert.rejects(loadExample(root, 'index.html', storage), /outside standalone source/);
    writeFileSync(page, original.replace("'../src/index.js'", "'https://example.invalid/index.js'"));
    await assert.rejects(loadExample(root, 'index.html', storage), /External import forbidden/);
    writeFileSync(page, original.replace("'../src/index.js'", "'../src/missing-entry.js'"));
    await assert.rejects(loadExample(root, 'index.html', storage), /ENOENT/);
    writeFileSync(page, original.replace('const repositories =', "console.warn('Synthetic standalone diagnostic'); const repositories ="));
    await assert.rejects(loadExample(root, 'index.html', storage, '?template=camap'), /swallowed bootstrap/);
  } finally { writeFileSync(page, original); }
  console.log('ok - standalone examples: sibling/external/missing-entry and warning negative controls fail, never accepted as successful rendering');
  console.log('Standalone examples: 7 contract groups passed; browser, rich editor, integration, distribution/legal acceptance not exercised');
}

export function runStandaloneExamples() {
  const tmp = join(PROJECT, 'tmp');
  mkdirSync(tmp, { recursive: true });
  const base = mkdtempSync(join(tmp, 'standalone-examples-'));
  const root = join(base, 'checkout', 'MINIJOOMLA');
  try {
    mkdirSync(root, { recursive: true });
    // A source-only contributor fixture, not a minified/full distribution.
    cpSync(join(PROJECT, 'src'), join(root, 'src'), { recursive: true, dereference: false,
      filter: (path) => !relative(join(PROJECT, 'src'), path).split(sep).includes('vendor') });
    cpSync(join(PROJECT, 'examples'), join(root, 'examples'), { recursive: true, dereference: false });
    for (const file of ['scripts/serve-local.js', 'scripts/test-standalone-examples.js', 'tests/standalone-examples.test.js', 'docs/LOCAL-DEMO.md', 'LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md']) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      cpSync(join(PROJECT, file), join(root, file));
    }
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'minijoomla-source-contract-fixture', type: 'module', private: true, license: 'GPL-2.0-or-later' }));
    for (const file of ['LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md']) assert.deepEqual(readFileSync(join(root, file)), readFileSync(join(PROJECT, file)), 'Preserve original notices byte-for-byte');
    assert.ok(!existsSync(join(base, 'checkout', 'SPMIDDLE')));
    const child = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', `
      import { verifyStandaloneSnapshot } from ${JSON.stringify(pathToFileURL(join(root, 'scripts', 'test-standalone-examples.js')).href)};
      await verifyStandaloneSnapshot(${JSON.stringify(root)});
    `], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.ok(child.stdout.includes('Standalone examples: 7 contract groups passed;'));
    process.stdout.write(child.stdout);
    return { groups: 7, browserTested: false, richEditorTested: false, siblingRequired: false };
  } finally {
    // Remove only this invocation's unique source fixture under project tmp.
    rmSync(base, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 2) { console.error('Usage: node scripts/test-standalone-examples.js'); process.exitCode = 1; }
  else {
    try { runStandaloneExamples(); }
    catch (error) { console.error(error); process.exitCode = 1; }
  }
}
