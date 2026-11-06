import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { stageRelease } from '../scripts/stage-release.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(PROJECT, 'scripts', 'stage-release.js');
const TINYMCE_NOTICES = 'media/vendor/tinymce/notices.txt';
const TINYMCE_NOTICES_SHA256 = '998c28e80bb7ffcd8c0b96d6f1bc2be79742929281b8259750613dac7376281e';

// A separate core entry lets the standalone test runner exercise staging
// without suppressing any of the full all/site integration gates below.
export async function runReleaseCoreStageTests() {
  const tmp = join(PROJECT, 'tmp');
  mkdirSync(tmp, { recursive: true });
  const base = mkdtempSync(join(tmp, 'release-core-test-'));
  const sourceRoot = join(base, 'synthetic', 'src');
  const absentPackages = join(base, 'SPMIDDLE', 'packages');
  const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
  const source = (path, text) => put(join(sourceRoot, path), text);
  const build = (name, extra = {}) => stageRelease({ version: '0.2.0', output: join(base, name), target: 'core', sourceRoot, spmiddleRoot: absentPackages, ...extra });
  try {
    source('index.js', `// import './comment-missing.js';
export { value } from './nested/value.js';
export const lazy = () => import('./nested/lazy.js?fixture=1');
export const styles = new URL('./styles/main.css', import.meta.url);
`);
    source('nested/value.js', 'export const value = 42;');
    source('nested/lazy.js', "export { value as default } from './value.js';");
    source('styles/main.css', '@import "./leaf.css";');
    source('styles/leaf.css', 'body { background: url("./mark.svg"); }');
    source('styles/mark.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
    source('administrator/components/com_minijoomla/app.js', "export { value as createAdminApplication } from '../../../nested/value.js';");
    source('libraries/minijoomla/application/joomla-discovery.js', "export { parseJoomlaManifest } from './joomla-manifest.js';");
    source('libraries/minijoomla/application/joomla-extension-installer.js', "export { parseJoomlaManifest } from './joomla-discovery.js';");
    source('libraries/minijoomla/application/joomla-manifest.js', "import { parseXml } from '../../vendor/parse-xml/parse-xml.js'; export { parseXml };");
    cpSync(join(PROJECT, 'src', 'libraries', 'vendor', 'parse-xml'), join(sourceRoot, 'libraries', 'vendor', 'parse-xml'), { recursive: true });
    source('media/templates/administrator/atum/css/template.css', '@import "../../../../../styles/main.css";');
    // These are deliberately broken: none are roots or reachable core imports.
    source('libraries/minijoomla/composition/mountMiniJoomlaSite.js', "import '../../../../../SPMIDDLE/packages/missing/src/index.js';");
    source('libraries/minijoomla/infrastructure/spmiddle-adapter.js', "import '../../../../../SPMIDDLE/packages/missing/src/index.js';");
    source('media/vendor/tinymce/tinymce.min.js', "import './missing.js';");
    source('media/vendor/tinymce/notices.txt', readFileSync(join(PROJECT, 'src', 'media', 'vendor', 'tinymce', 'notices.txt')));
    source('private.json', '{"not":"part of the graph"}');
    assert.ok(!existsSync(absentPackages));
    const first = build('first');
    const second = build('second');
    assert.deepEqual(first.manifest, second.manifest);
    const entries = JSON.parse(readFileSync(join(first.output, 'entrypoints.json'), 'utf8'));
    assert.equal(entries.target, 'core');
    assert.deepEqual(entries.entrypoints, { public: 'index.js', admin: 'administrator/components/com_minijoomla/app.js' });
    assert.deepEqual(entries.styles, { admin: 'media/templates/administrator/atum/css/template.css' });
    assert.equal(entries.editorBase, null);
    assert.match(entries.scope, /not a deployable CMS/);
    assert.match(entries.hostInjection, /dedicated DOM container/);
    assert.match(entries.hostInjection, /richTextEditorFactory/);
    for (const entry of first.manifest.files) {
      const data = readFileSync(join(first.output, entry.path));
      assert.equal(data.length, entry.bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256);
      assert.deepEqual(data, readFileSync(join(second.output, entry.path)));
      assert.ok(!/^(?:libraries\/vendor\/(?!parse-xml\/)|host-adapters\/|libraries\/minijoomla\/composition\/|media\/vendor\/)/.test(entry.path));
    }
    for (const path of ['styles/leaf.css', 'styles/mark.svg', 'nested/lazy.js', 'libraries/minijoomla/application/joomla-discovery.js', 'libraries/minijoomla/application/joomla-extension-installer.js', 'libraries/vendor/parse-xml/parse-xml.js', 'libraries/vendor/parse-xml/LICENSE', 'libraries/vendor/parse-xml/notices.txt', 'LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md']) {
      assert.ok(first.manifest.files.some((entry) => entry.path === path), `Core graph/license must include ${path}`);
    }
    assert.deepEqual(readFileSync(join(first.output, 'LICENSE.md')), readFileSync(join(PROJECT, 'LICENSE.md')));
    assert.deepEqual(readFileSync(join(first.output, 'docs', 'licenses', 'GPL-2.0.txt')), readFileSync(join(PROJECT, 'docs', 'licenses', 'GPL-2.0.txt')));
    assert.deepEqual(readFileSync(join(first.output, 'libraries', 'vendor', 'parse-xml', 'LICENSE')), readFileSync(join(sourceRoot, 'libraries', 'vendor', 'parse-xml', 'LICENSE')));
    assert.deepEqual(readFileSync(join(first.output, 'libraries', 'vendor', 'parse-xml', 'notices.txt')), readFileSync(join(sourceRoot, 'libraries', 'vendor', 'parse-xml', 'notices.txt')));
    assert.ok(entries.licenses.includes('libraries/vendor/parse-xml/LICENSE'));
    assert.ok(entries.licenses.includes('libraries/vendor/parse-xml/notices.txt'));
    assert.ok(!existsSync(join(first.output, 'private.json')));
    assert.ok(!existsSync(join(first.output, TINYMCE_NOTICES)));
    assert.throws(() => build('first'), /sobrescrita proibida/);
    assert.throws(() => build('bad-output', { output: tmp }), /subpasta/);
    assert.throws(() => build('bad-output', { output: join(PROJECT, 'tmp-other', 'core') }), /fora da raiz/);
    assert.throws(() => build('overlap', { output: join(sourceRoot, 'release') }), /sobrepor/);
    assert.throws(() => build('outside-source', { sourceRoot: dirname(PROJECT) }), /fora da raiz/);
    assert.throws(() => build('outside-packages', { spmiddleRoot: dirname(PROJECT) }), /fora da raiz/);
    assert.throws(() => build('missing-source', { sourceRoot: join(base, 'absent-src') }), /Raiz de fontes ausente/);
    assert.throws(() => build('file-source', { sourceRoot: join(sourceRoot, 'index.js') }), /Raiz de fontes ausente/);
    for (const [text, pattern] of [
      ["import './missing.js';", /Dependência ausente/],
      ["export { missing } from './missing.js';", /Dependência ausente/],
      ["export const lazy = () => import('./missing.js');", /Dependência ausente/],
      ["import '../../SPMIDDLE/packages/missing/src/index.js';", /fora da raiz autossuficiente/],
      ["import './libraries/minijoomla/composition/mountMiniJoomlaSite.js';", /core não inclui composições/],
      ["import './libraries/minijoomla/infrastructure/spmiddle-adapter.js';", /core não inclui composições/],
      ["import './media/vendor/tinymce/tinymce.min.js';", /core não inclui composições/],
      ["export const base = new URL('./media/vendor/tinymce/', import.meta.url);", /core não inclui recursos externos/],
      ["import './private.json';", /Arquivo não autorizado/],
      ["import 'https://example.invalid/core.js';", /Import não relativo/],
      ["export const lazy = (name) => import(name);", /dinâmico não verificável/]
    ]) {
      source('index.js', text);
      assert.throws(() => build('invalid-graph'), pattern);
      assert.ok(!existsSync(join(base, 'invalid-graph')), 'A rejected core graph must not leave partial staging.');
    }
    for (const dependency of ['./libraries/vendor/spmiddle/transport.js', './libraries/vendor/parse-xml/extra.js']) {
      source('index.js', `import '${dependency}';`);
      assert.throws(() => build('vendor-not-allowed'), /vendor de terceiros/);
      assert.ok(!existsSync(join(base, 'vendor-not-allowed')));
    }
    source('index.js', "export { value } from './nested/value.js';");
    source('administrator/components/com_minijoomla/app.js', "import './missing-editor.js';");
    assert.throws(() => build('admin-missing'), /Dependência ausente/);
    source('administrator/components/com_minijoomla/app.js', "export { value as createAdminApplication } from '../../../nested/value.js';");
    source('media/templates/administrator/atum/css/template.css', '@import "../../../../../missing.css";');
    assert.throws(() => build('css-missing'), /Dependência ausente/);
    rmSync(join(sourceRoot, 'media', 'templates', 'administrator', 'atum', 'css', 'template.css'));
    assert.throws(() => build('entry-missing'), /Dependência ausente/);
    source('media/templates/administrator/atum/css/template.css', 'body { color: black; }');
    const link = join(base, 'linked-src');
    try { symlinkSync(sourceRoot, link, 'junction'); }
    catch (error) { if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; }
    if (existsSync(link)) {
      assert.throws(() => build('linked-source', { sourceRoot: link }), /Link simbólico/);
      assert.throws(() => build('linked-packages', { spmiddleRoot: link }), /Link simbólico/);
      assert.throws(() => build('linked-output', { output: join(link, 'release') }), /Link simbólico/);
      rmSync(link);
    }

    // Copy the real sources into a clone-like fixture with no sibling packages.
    // No rename/removal of the shared workspace's actual SPMIDDLE is necessary.
    const cloneSource = join(base, 'standalone', 'src');
    cpSync(join(PROJECT, 'src'), cloneSource, { recursive: true, dereference: false });
    assert.ok(!existsSync(join(base, 'standalone', 'SPMIDDLE')));
    const core = build('real-core', { sourceRoot: cloneSource });
    const repeat = build('real-core-repeat', { sourceRoot: cloneSource });
    assert.deepEqual(core.manifest, repeat.manifest);
    const realCore = stageRelease({ version: '0.2.0', output: join(base, 'actual-source-core'), target: 'core', spmiddleRoot: absentPackages });
    assert.deepEqual(core.manifest, realCore.manifest, 'A source override must not change the core artifact or add the host snippet.');
    const names = new Set(core.manifest.files.map(({ path }) => path));
    const generatedMenu = readFileSync(join(core.output, 'modules/mod_menu/mod_menu.xml'), 'utf8');
    assert.match(generatedMenu, /<version>0\.2\.0<\/version>/);
    assert.match(generatedMenu, /name="startLevel" type="number"/);
    assert.match(generatedMenu, /name="moduleClass"/);
    for (const path of ['index.js', 'administrator/components/com_minijoomla/app.js', 'administrator/components/com_minijoomla/editor.js', 'administrator/templates/atum/index.js', 'media/templates/administrator/atum/css/template.css', 'media/templates/site/cassiopeia/css/template.css', 'media/templates/site/camap/css/template.css', 'media/templates/site/camap/css/layout.css', 'media/templates/site/camap/css/responsive.css']) {
      assert.ok(names.has(path), `Required real core dependency: ${path}`);
    }
    assert.ok([...names].every((path) => !/^(?:libraries\/vendor\/(?!parse-xml\/)|host-adapters\/|libraries\/minijoomla\/composition\/|media\/vendor\/)/.test(path)));
    for (const path of ['libraries/minijoomla/application/joomla-discovery.js', 'libraries/minijoomla/application/joomla-extension-installer.js', 'libraries/minijoomla/application/joomla-manifest.js', 'libraries/minijoomla/application/package-path.js', 'libraries/vendor/parse-xml/parse-xml.js', 'libraries/vendor/parse-xml/LICENSE', 'libraries/vendor/parse-xml/notices.txt']) assert.ok(names.has(path), `Required real core dependency: ${path}`);
    assert.ok(!names.has(TINYMCE_NOTICES));
    assert.ok(!existsSync(join(core.output, 'libraries', 'minijoomla', 'infrastructure', 'spmiddle-adapter.js')));
    const smoke = spawnSync(process.execPath, ['--input-type=module', '-e', `
      globalThis.fetch = () => { throw new Error('Core smoke must not use network'); };
      const { loadRelease } = await import(${JSON.stringify(pathToFileURL(join(core.output, 'loader.js')).href)});
      await loadRelease({ start: async ({ modules, releaseBase }) => {
        if (Object.keys(modules).join(',') !== 'public,admin') throw new Error('core entries');
        if (!releaseBase.endsWith('/real-core/')) throw new Error('release base');
        const publicApp = modules.public.createApplication({ autoStart: false, documentRef: null });
        await publicApp.router.navigate('/');
        publicApp.stop();
        let overviewCalls = 0;
        const adminApp = modules.admin.createAdminApplication({ adminService: { overview: async () => { overviewCalls += 1; return {}; } }, autoStart: false, documentRef: null });
        await adminApp.router.navigate('/');
        if (overviewCalls !== 1) throw new Error('injected admin service');
        adminApp.stop();
      } });
    `], { encoding: 'utf8' });
    assert.equal(smoke.status, 0, smoke.stderr);
    const coreCli = spawnSync(process.execPath, [SCRIPT, '--version', '0.2.0', '--output', join('tmp', basename(base), 'core-cli'), '--target', 'core'], { cwd: resolve(PROJECT, '..', '..'), encoding: 'utf8' });
    assert.equal(coreCli.status, 0, coreCli.stderr);
    assert.equal(JSON.parse(readFileSync(join(base, 'core-cli', 'entrypoints.json'), 'utf8')).target, 'core');
    assert.ok(!existsSync(absentPackages), 'Core must never create or require sibling packages.');
    assert.throws(() => build('all-still-gated', { target: 'all' }), /Raiz de fontes ausente/);
    assert.throws(() => build('site-still-gated', { target: 'site' }), /Raiz de fontes ausente/);
    console.log(`ok - core staging: ${core.manifest.files.length} real files without sibling packages, GPL notices, deterministic hashes, offline loader and strict graph/containment/immutable gates`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

async function verifyEditorHelpRuntime() {
  const requests = [];
  const events = new Map();
  const optionsRead = [];
  let install;
  const noop = () => {};
  const resources = {
    'tinymce.PluginManager': { add(name, factory) { assert.equal(name, 'help'); install = factory; } },
    'tinymce.Resource': { load(name, url) {
      requests.push({ name, url });
      return url.endsWith('/pt_BR.js') ? Promise.reject(new Error('Synthetic language failure')) : Promise.resolve('keyboard navigation');
    } },
    'tinymce.util.I18n': { getCode: () => 'pt_BR' },
    'tinymce.Env': {},
    'tinymce.EditorManager': {}
  };
  const plugin = readFileSync(join(PROJECT, 'src', 'media', 'vendor', 'tinymce', 'plugins', 'help', 'plugin.min.js'), 'utf8');
  runInNewContext(plugin, { tinymce: { util: { Tools: { resolve: (name) => {
    assert.ok(resources[name], `Unexpected TinyMCE dependency: ${name}`);
    return resources[name];
  } } } } }, { timeout: 5000 });
  install({
    options: { register: noop, get(name) { optionsRead.push(name); return name === 'help_accessibility' ? false : undefined; } },
    ui: { registry: { addButton: noop, addMenuItem: noop } },
    addCommand: noop, shortcuts: { add: noop }, on: (name, callback) => events.set(name, callback)
  }, '/release/media/vendor/tinymce/plugins/help');
  assert.ok(events.has('init'));
  events.get('init')();
  await new Promise((done) => setImmediate(done));
  assert.deepEqual(requests.map(({ url }) => url), [
    '/release/media/vendor/tinymce/plugins/help/js/i18n/keynav/pt_BR.js',
    '/release/media/vendor/tinymce/plugins/help/js/i18n/keynav/en.js'
  ]);
  assert.ok(!optionsRead.includes('help_accessibility'), 'The help plugin does not use this theme/statusbar option to suppress resource loading.');
  console.log('ok - actual TinyMCE help init loads keynav language and English fallback even with help_accessibility=false');
}

export async function runReleaseStageTests() {
  await runReleaseCoreStageTests();
  await verifyEditorHelpRuntime();
  const tmp = join(PROJECT, 'tmp');
  mkdirSync(tmp, { recursive: true });
  const base = mkdtempSync(join(tmp, 'release-pipeline-test-'));
  const sourceRoot = join(base, 'src');
  const spmiddleRoot = join(base, 'SPMIDDLE', 'packages');
  const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
  const source = (path, text) => put(join(sourceRoot, path), text);
  const build = (name, extra = {}) => stageRelease({ version: '0.2.0', output: join(base, name), sourceRoot, spmiddleRoot, ...extra });
  try {
    source('index.js', `// import './missing-comment.js';
const example = "import './missing-string.js'";
import {
  value
} from '../SPMIDDLE/packages/example/src/index.js';
export { nested } from './nested/first.js';
import './styles/main.css';
export const lazy = () => import('./nested/lazy.js?cache=fixture');
export const css = new URL('./styles/main.css', import.meta.url);
`);
    source('nested/first.js', "export { nested } from './second.js';");
    source('libraries/minijoomla/composition/mountMiniJoomlaSite.js', "export { nested as mountMiniJoomlaSite } from '../../../nested/first.js';");
    source('nested/second.js', "export const nested = 1;");
    source('nested/lazy.js', "import './first.js'; export default true;");
    source('styles/main.css', '@import "./nested.css";\nbody { background: url("../images/mark.svg"); }');
    source('styles/nested.css', '@import url("./leaf.css");');
    source('styles/leaf.css', 'p { color: green; background: url("data:image/svg+xml,test"); }');
    source('images/mark.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
    source('media/vendor/tinymce/license.md', 'Fixture license');
    source('media/vendor/tinymce/tinymce.min.js', 'globalThis.fixtureEditor = true;');
    const originalNotices = readFileSync(join(PROJECT, 'src', 'media', 'vendor', 'tinymce', 'notices.txt'));
    source('media/vendor/tinymce/notices.txt', originalNotices);
    put(join(spmiddleRoot, 'example', 'src', 'index.js'), 'export { value } from "../../shared/src/value.js";');
    put(join(spmiddleRoot, 'shared', 'src', 'value.js'), 'export const value = 42;');
    put(join(base, 'corporate-config.json'), '{"not":"for release"}');
    const middlewareLicense = join(dirname(spmiddleRoot), 'LICENSE');
    const originalMit = readFileSync(join(PROJECT, '..', 'SPMIDDLE', 'LICENSE'));
    assert.throws(() => build('missing-mit-all'), /Licença original SPMIDDLE ausente/);
    assert.throws(() => build('missing-mit-site', { target: 'site' }), /Licença original SPMIDDLE ausente/);
    assert.ok(!existsSync(join(base, 'missing-mit-all')) && !existsSync(join(base, 'missing-mit-site')));
    put(middlewareLicense, 'MIT License — incomplete fixture');
    assert.throws(() => build('incomplete-mit'), /MIT integral não reconhecida/);
    for (const [name, text] of [
      ['missing-copyright', originalMit.toString().replace(/Copyright[^\r\n]+/, '')],
      ['missing-disclaimer', originalMit.toString().split('THE SOFTWARE IS PROVIDED')[0]],
      ['missing-permission', originalMit.toString().replace(/Permission is hereby granted[\s\S]*?following conditions:/, '')]
    ]) {
      put(middlewareLicense, text);
      assert.throws(() => build(name), /MIT integral não reconhecida/);
      assert.ok(!existsSync(join(base, name)));
    }
    put(middlewareLicense, originalMit);
    const first = build('first');
    const second = build('second');
    assert.deepEqual(first.manifest, second.manifest, 'Identical sources produce byte-identical manifests.');
    assert.equal(readFileSync(join(first.output, 'manifest.json'), 'utf8'), readFileSync(join(second.output, 'manifest.json'), 'utf8'));
    assert.match(readFileSync(join(first.output, 'index.js'), 'utf8'), /from '\.\/libraries\/vendor\/spmiddle\/example\/src\/index.js'/);
    assert.equal(readFileSync(join(first.output, 'libraries', 'vendor', 'spmiddle', 'shared', 'src', 'value.js'), 'utf8'), 'export const value = 42;');
    assert.deepEqual(readFileSync(join(first.output, 'libraries', 'vendor', 'spmiddle', 'LICENSE')), originalMit);
    for (const name of ['LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md']) {
      assert.deepEqual(readFileSync(join(first.output, name)), readFileSync(join(PROJECT, name)));
    }
    for (const entry of first.manifest.files) {
      const bytes = readFileSync(join(first.output, entry.path));
      assert.equal(bytes.length, entry.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
      assert.deepEqual(bytes, readFileSync(join(second.output, entry.path)));
    }
    const countFiles = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => sum + (entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1), 0);
    assert.equal(countFiles(first.output), first.manifest.files.length + 1, 'Only manifest itself is excluded from hashes.');
    assert.ok(!existsSync(join(first.output, 'corporate-config.json')));
    assert.ok(!existsSync(join(first.output, 'bootstrap.js')));
     assert.ok(existsSync(join(first.output, 'media', 'vendor', 'tinymce', 'license.md')));
    assert.deepEqual(readFileSync(join(first.output, TINYMCE_NOTICES)), originalNotices);
    assert.deepEqual(first.manifest.files.find(({ path }) => path === TINYMCE_NOTICES), {
      path: TINYMCE_NOTICES, bytes: 471, sha256: TINYMCE_NOTICES_SHA256
    });
    source('admin/incomplete.js', "import './missing-editor-resource.js';");
    const siteFixture = build('site-fixture', { target: 'site' });
    assert.equal(siteFixture.manifest.target, 'site');
    assert.ok(siteFixture.manifest.files.every(({ path }) => !path.startsWith('administrator/')));
    assert.ok(siteFixture.manifest.files.some(({ path }) => path === 'styles/leaf.css'));
    assert.ok(siteFixture.manifest.files.some(({ path }) => path === 'libraries/vendor/spmiddle/shared/src/value.js'));
    assert.deepEqual(readFileSync(join(siteFixture.output, 'libraries', 'vendor', 'spmiddle', 'LICENSE')), originalMit);
    assert.equal(JSON.parse(readFileSync(join(siteFixture.output, 'entrypoints.json'), 'utf8')).publicationApproved, false);
    rmSync(middlewareLicense);
    try { symlinkSync(first.output, middlewareLicense, 'junction'); }
    catch (error) { if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; }
    if (existsSync(middlewareLicense)) {
      assert.throws(() => build('linked-license', { target: 'site' }), /Link simbólico/);
      rmSync(middlewareLicense);
    }
    put(middlewareLicense, originalMit);
    assert.throws(() => build('incomplete-all'), /Dependência ausente/);
    rmSync(join(sourceRoot, 'admin', 'incomplete.js'));
    assert.throws(() => build('invalid-target', { target: 'admin' }), /--target inválido/);
    source('libraries/minijoomla/composition/mountMiniJoomlaSite.js', "import '../../../media/vendor/tinymce/tinymce.min.js';");
    assert.throws(() => build('site-admin', { target: 'site' }), /site não pode depender/);
    source('libraries/minijoomla/composition/mountMiniJoomlaSite.js', "export { nested as mountMiniJoomlaSite } from '../../../nested/first.js';");
    assert.throws(() => build('first'), /sobrescrita proibida/);
    for (const version of ['01.2.3', '1.2', '../1.2.3', '1.2.3-beta', '1.2.3/evil', '', undefined]) assert.throws(() => build('invalid', { version }), /Versão inválida/);
    assert.throws(() => build('outside', { output: join(PROJECT, 'not-tmp') }), /fora da raiz/);
    assert.throws(() => build('outside', { output: join(PROJECT, 'tmp-other', 'release') }), /fora da raiz/);
    assert.throws(() => build('outside', { output: tmp }), /subpasta/);
    assert.throws(() => build('outside', { sourceRoot: dirname(PROJECT) }), /fora da raiz/);
    assert.throws(() => build('outside', { spmiddleRoot: dirname(PROJECT) }), /fora da raiz/);
    source('bad.js', "export { value } from '../../corporate.js';");
    assert.throws(() => build('escape-read'), /fora da raiz/);
    assert.ok(!existsSync(join(base, 'escape-read')), 'Invalid graph leaves no partial output.');
    source('bad.js', "import './missing.js';");
    assert.throws(() => build('missing'), /Dependência ausente/);
    source('bad.js', "export const lazy = () => import('./nested/' + name + '.js');");
    assert.throws(() => build('unbounded'), /dinâmico não verificável/);
    source('bad.js', "export const lazy = `${import('./nested/lazy.js')}`;");
    assert.throws(() => build('hidden-import'), /template literal não verificável/);
    source('bad.js', "import '/releases/0.1.0/bootstrap.js';");
    assert.throws(() => build('mixed-release'), /hardcoded a outra release/);
    source('bad.js', "import 'https://example.invalid/module.js';");
    assert.throws(() => build('remote'), /não relativo/);
    source('bad.js', "import './nested/%2e%2e/first.js';");
    assert.throws(() => build('encoded'), /inválido/);
    source('bad.js', 'export const ok = true;');
    put(join(spmiddleRoot, 'example', 'src', 'private.json'), '{}');
    put(join(spmiddleRoot, 'example', 'src', 'index.js'), 'import "./private.json";');
    assert.throws(() => build('vendor-data'), /Arquivo não autorizado como dependência/);
    put(join(spmiddleRoot, 'example', 'src', 'index.js'), 'export { value } from "../../shared/src/value.js";');
    source('styles/bad.css', '@import "../../private.css";');
    assert.throws(() => build('css-escape'), /fora da raiz/);
    source('styles/bad.css', '@import "./missing.css";');
    assert.throws(() => build('css-missing'), /Dependência ausente/);
    source('styles/bad.css', 'body { color: black; }');
    source('settings.json', '{"token":"fixture-not-a-secret"}');
    assert.throws(() => build('data'), /Arquivo não autorizado/);
    rmSync(join(sourceRoot, 'settings.json'));
    for (const path of ['config.txt', 'data.txt', 'media/vendor/tinymce/config.txt', 'media/vendor/tinymce/notices.txt.bak']) {
      source(path, 'Synthetic data, not a third-party notice.');
      assert.throws(() => build('text-data'), /Arquivo não autorizado/);
      assert.ok(!existsSync(join(base, 'text-data')), 'Rejected text files must not leave partial staging.');
      rmSync(join(sourceRoot, path));
    }
    put(join(spmiddleRoot, 'example', 'src', 'config.txt'), 'Synthetic config.');
    put(join(spmiddleRoot, 'example', 'src', 'index.js'), 'import "./config.txt";');
    assert.throws(() => build('vendor-text-data'), /Arquivo não autorizado como dependência/);
    assert.ok(!existsSync(join(base, 'vendor-text-data')));
    put(join(spmiddleRoot, 'example', 'src', 'index.js'), 'export { value } from "../../shared/src/value.js";');
    const link = join(base, 'linked-output');
    try { symlinkSync(join(base, 'first'), link, 'junction'); }
    catch (error) { if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; }
    if (existsSync(link)) {
      assert.throws(() => build('linked', { output: join(link, 'child') }), /Link simbólico/);
      rmSync(link);
    }
    const noEffects = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../scripts/stage-release.js', import.meta.url).href)})`], { encoding: 'utf8' });
    assert.equal(noEffects.status, 0, noEffects.stderr);
    assert.equal(noEffects.stdout, '');
    const invalidCli = spawnSync(process.execPath, [SCRIPT, '--version', 'bad', '--output', join(base, 'cli')], { encoding: 'utf8' });
    assert.equal(invalidCli.status, 1);
    assert.match(invalidCli.stderr, /Versão inválida/);
    const relativeOutput = join('tmp', basename(base), 'cli-from-vsto');
    const relativeCli = spawnSync(process.execPath, [SCRIPT, '--version', '0.2.0', '--output', relativeOutput], { cwd: resolve(PROJECT, '..', '..'), encoding: 'utf8' });
    assert.equal(relativeCli.status, 0, relativeCli.stderr);
    assert.ok(existsSync(join(base, 'cli-from-vsto', 'manifest.json')), 'Relative tmp output must be rooted at MINIJOOMLA, not the caller cwd.');
    console.log('ok - release stage: recursive ES/CSS graph, vendor, containment, immutable output, deterministic SHA256 and CLI');

    const real = stageRelease({ version: '0.2.0', output: join(base, 'current-source') });
    const realRepeat = stageRelease({ version: '0.2.0', output: join(base, 'current-source-repeat') });
    assert.deepEqual(real.manifest, realRepeat.manifest, 'Current source build is reproducible too.');
    assert.equal(real.manifest.target, 'all');
    const names = new Set(real.manifest.files.map((file) => file.path));
    for (const path of [
      'libraries/minijoomla/application/template-runtime.js',
      'libraries/minijoomla/modules/dynamic-modules.js', 'libraries/minijoomla/modules/content-runtime.js',
      'modules/mod_menu/mod_menu.js', 'modules/mod_menu/mod_menu.xml',
      'modules/mod_menu/tmpl/default.js',
      'modules/mod_articles_latest/mod_articles_latest.js', 'modules/mod_articles_latest/mod_articles_latest.xml',
      'modules/mod_articles_latest/tmpl/default.js',
      'modules/mod_articles_category/mod_articles_category.js', 'modules/mod_articles_category/mod_articles_category.xml',
      'modules/mod_articles_category/tmpl/default.js',
      'modules/mod_articles_news/mod_articles_news.js', 'modules/mod_articles_news/mod_articles_news.xml',
      'modules/mod_articles_news/tmpl/default.js',
      'modules/mod_tags_similar/mod_tags_similar.js', 'modules/mod_tags_similar/mod_tags_similar.xml',
      'modules/mod_tags_similar/tmpl/default.js',
      'modules/mod_tags_popular/mod_tags_popular.js', 'modules/mod_tags_popular/mod_tags_popular.xml',
      'modules/mod_tags_popular/tmpl/default.js',
      'modules/mod_articles_archive/mod_articles_archive.js', 'modules/mod_articles_archive/mod_articles_archive.xml',
      'modules/mod_articles_archive/tmpl/default.js',
      'modules/mod_login/mod_login.js', 'modules/mod_login/mod_login.xml', 'modules/mod_login/tmpl/default.js',
      'modules/mod_articles_categories/mod_articles_categories.js', 'modules/mod_articles_categories/mod_articles_categories.xml',
      'modules/mod_articles_categories/tmpl/default.js',
      'modules/mod_related_items/mod_related_items.js', 'modules/mod_related_items/mod_related_items.xml',
      'modules/mod_related_items/tmpl/default.js',
      'modules/mod_footer/mod_footer.js', 'modules/mod_footer/mod_footer.xml', 'modules/mod_footer/tmpl/default.js',
      'modules/mod_articles/mod_articles.js', 'modules/mod_articles/mod_articles.xml', 'modules/mod_articles/tmpl/default.js',
      'modules/mod_breadcrumbs/mod_breadcrumbs.js', 'modules/mod_breadcrumbs/mod_breadcrumbs.xml',
      'modules/mod_breadcrumbs/tmpl/default.js',
      'modules/mod_search/mod_search.js', 'modules/mod_search/mod_search.xml', 'modules/mod_search/tmpl/default.js',
      'modules/mod_custom/mod_custom.js', 'modules/mod_custom/mod_custom.xml',
      'modules/mod_custom/tmpl/default.js',
      'plugins/content/emailcloak/emailcloak.js', 'plugins/content/emailcloak/emailcloak.xml',
      'plugins/content/pagebreak/pagebreak.js', 'plugins/content/loadmodule/loadmodule.js',
      'plugins/content/pagenavigation/pagenavigation.js',
      'libraries/minijoomla/composition/mountMiniJoomlaSite.js', 'host-adapters/modern-script-editor/site-snippet.html',
      'media/templates/site/cassiopeia/css/template.css', 'media/templates/site/camap/css/template.css', 'media/templates/site/camap/css/layout.css', 'media/templates/site/camap/css/responsive.css',
      'administrator/templates/atum/templateDetails.xml', 'media/templates/administrator/atum/css/template.css',
      'media/vendor/tinymce/tinymce.min.js', 'media/vendor/tinymce/license.md', TINYMCE_NOTICES,
      'media/vendor/tinymce/plugins/help/js/i18n/keynav/en.js',
      'components/com_content/tmpl/article/default.js',
      'components/com_content/tmpl/category/default.js',
      'components/com_content/tmpl/category/blog.js',
      'components/com_content/tmpl/categories/default.js',
      'components/com_content/tmpl/featured/default.js',
      'components/com_content/tmpl/archive/default.js',
      'components/com_tags/tmpl/tag/default.js', 'components/com_tags/tmpl/tags/default.js',
      'components/com_finder/tmpl/search/default.js',
      'layouts/joomla/content/info_block.js', 'layouts/joomla/content/tags.js',
      'layouts/joomla/pagination/links.js',
      'layouts/joomla/content/links.js', 'layouts/joomla/content/intro_image.js',
      'layouts/joomla/content/full_image.js', 'administrator/components/com_content/tmpl/article/edit.js',
      'administrator/components/com_content/src/Model/article.js',
      'administrator/components/com_content/tmpl/articles/default.js',
      'administrator/components/com_media/tmpl/media/default.js',
      'administrator/components/com_menus/src/Model/menu-item.js',
      'administrator/components/com_categories/tmpl/categories/default.js',
      'administrator/components/com_modules/tmpl/modules/default.js',
      'administrator/components/com_modules/tmpl/positions/default.js',
      'administrator/components/com_modules/tmpl/module/edit.js',
      'administrator/components/com_modules/tmpl/select/default.js',
      'administrator/components/com_plugins/tmpl/plugins/default.js',
      'administrator/components/com_plugins/tmpl/plugin/edit.js',
      'administrator/components/com_templates/tmpl/styles/default.js',
      'administrator/components/com_templates/tmpl/style/edit.js',
      'administrator/components/com_tags/tmpl/tags/default.js',
      'administrator/components/com_config/tmpl/application/default.js',
      'administrator/components/com_config/tmpl/components/default.js',
      'administrator/components/com_installer/src/Controller/discover.js',
      'administrator/components/com_installer/tmpl/discover/default.js',
      'administrator/components/com_installer/tmpl/manage/default.js',
      'administrator/components/com_templates/src/Controller/discover.js',
      'administrator/components/com_templates/tmpl/discover/default.js',
      'administrator/components/com_minijoomla/menu-types.js',
      'templates/cassiopeia/index.js', 'templates/cassiopeia/templateDetails.xml',
      'templates/camap/index.js', 'templates/camap/templateDetails.xml',
      'libraries/vendor/spmiddle/sharepoint-files/src/index.js', 'libraries/vendor/spmiddle/data-core/src/index.js',
      'libraries/vendor/spmiddle/sharepoint-schema/src/index.js', 'libraries/vendor/spmiddle/sharepoint-rest-browser/src/index.js',
      'libraries/vendor/spmiddle/LICENSE', 'LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md'
    ]) assert.ok(names.has(path), `Required current runtime asset: ${path}`);
    assert.deepEqual(readFileSync(join(real.output, TINYMCE_NOTICES)), originalNotices);
    assert.deepEqual(real.manifest.files.find(({ path }) => path === TINYMCE_NOTICES), {
      path: TINYMCE_NOTICES, bytes: 471, sha256: TINYMCE_NOTICES_SHA256
    });
    assert.deepEqual(readFileSync(join(real.output, 'libraries', 'vendor', 'spmiddle', 'LICENSE')), originalMit);
    const loader = readFileSync(join(real.output, 'loader.js'), 'utf8');
    assert.ok(!/releases\/0\.1\./.test(loader));
    assert.ok(!/bootstrap/.test(loader.replace(/nenhum bootstrap\/config corporativo/, '')));
    assert.ok(names.has('entrypoints.json'));
    assert.match(readFileSync(join(real.output, 'host-adapters', 'modern-script-editor', 'site-snippet.html'), 'utf8'), /__RELEASE_BASE__/);
    const smoke = spawnSync(process.execPath, ['--input-type=module', '-e', `
      const { loadRelease, version } = await import(${JSON.stringify(pathToFileURL(join(real.output, 'loader.js')).href)});
      if (version !== '0.2.0') throw new Error('version');
      await loadRelease({ start({ modules, releaseBase }) {
        if (typeof modules.public.createApplication !== 'function') throw new Error('public entry');
        if (typeof modules.adminComposition.createMiniJoomlaAdminApp !== 'function') throw new Error('admin entry');
        if (!releaseBase.endsWith('/current-source/')) throw new Error('release base');
      } });
    `], { encoding: 'utf8' });
    assert.equal(smoke.status, 0, smoke.stderr);
    const site = stageRelease({ version: '0.2.0', output: join(base, 'current-site'), target: 'site' });
    const siteRepeat = stageRelease({ version: '0.2.0', output: join(base, 'current-site-repeat'), target: 'site' });
    assert.deepEqual(site.manifest, siteRepeat.manifest);
    assert.ok(site.manifest.files.every(({ path }) => !path.startsWith('administrator/')));
    assert.ok(!existsSync(join(site.output, 'administrator')));
    for (const path of ['index.js', 'libraries/minijoomla/composition/mountMiniJoomlaSite.js', 'media/templates/site/cassiopeia/css/template.css', 'media/templates/site/camap/css/template.css', 'libraries/vendor/spmiddle/data-core/src/index.js']) {
      assert.ok(site.manifest.files.some((entry) => entry.path === path), `Required public dependency: ${path}`);
    }
    const siteEntries = JSON.parse(readFileSync(join(site.output, 'entrypoints.json'), 'utf8'));
    assert.equal(siteEntries.target, 'site');
    assert.equal(siteEntries.editorBase, null);
    assert.ok(!siteEntries.entrypoints.admin);
    assert.ok(!siteEntries.entrypoints.adminComposition);
    assert.ok(siteEntries.licenses.includes('libraries/vendor/spmiddle/LICENSE'));
    assert.equal(siteEntries.publicationApproved, false);
    assert.deepEqual(readFileSync(join(site.output, 'libraries', 'vendor', 'spmiddle', 'LICENSE')), originalMit);
    const siteSmoke = spawnSync(process.execPath, ['--input-type=module', '-e', `
      const { loadRelease } = await import(${JSON.stringify(pathToFileURL(join(site.output, 'loader.js')).href)});
      await loadRelease({ start({ modules }) {
        if (typeof modules.public.createApplication !== 'function') throw new Error('public entry');
        if (typeof modules.mount.mountMiniJoomlaSite !== 'function') throw new Error('mount entry');
        if (modules.admin || modules.adminComposition) throw new Error('admin must not be included');
      } });
    `], { encoding: 'utf8' });
    assert.equal(siteSmoke.status, 0, siteSmoke.stderr);
    console.log(`ok - independent site release closure: ${site.manifest.files.length} files, no admin/TinyMCE, deterministic manifest and loader smoke`);
    console.log(`ok - real current-source release closure: ${real.manifest.files.length} files (local fixture version 0.2.0; no remote reservation)`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReleaseStageTests().catch((error) => { console.error(error); process.exitCode = 1; });
}
