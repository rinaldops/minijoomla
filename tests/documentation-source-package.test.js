/* SPDX-License-Identifier: GPL-2.0-or-later */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, lstat, link, unlink, symlink, rmdir } from 'node:fs/promises';
import { resolve, dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  prepareDocumentationSourcePackage, finalizeDocumentationSourcePackage,
  buildDocumentationSourcePackage, readDocumentationSourcePackage,
  parseDocumentationSourceArgs, DOCUMENTATION_BUILD_PINS,
  DOCUMENTATION_UPSTREAM_PINS, DOCUMENTATION_SOURCE_RUNTIME,
  DOCUMENTATION_DERIVATION_HEADER, DOCUMENTATION_HELPER_HEADER,
  documentationSourceSha256 as sha256, DOCUMENTATION_FROZEN_ROOT
} from '../scripts/prepare-documentation-source-package.js';
import { applyDocumentationOverlay, DOCUMENTATION_ANCHORS, DOCUMENTATION_SOURCE_PATH, DOCUMENTATION_CSS_PATH, documentationAdaptationXml, DOCUMENTATION_DEFAULTS } from '../scripts/documentation-frozen-build/scripts/prepare-documentation-adaptation.js';
import { SHARED_SOURCE_PATH } from '../scripts/documentation-frozen-build/scripts/prepare-editorial-adaptation.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/offline/documentation/0.5.0';
const ARGS = { version: '0.5.0', base: BASE };
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const copy = files => new Map([...files].map(([p, b]) => [p, Buffer.from(b)]));
const sameFiles = (a, b) => { assert.equal(a.size, b.size); for (const [p, bytes] of a) assert.ok(bytes.equals(b.get(p)), `byte-exact ${p}`); };
const run = (file, args, cwd = PROJECT) => spawnSync(process.execPath, [file, ...args], { cwd, encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_OPTIONS: '' } });
function rehash(files) {
  const inventory = JSON.parse(files.get('MANIFEST-SHA256.json'));
  inventory.files = [...files].filter(([p]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(p)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  files.set('MANIFEST-SHA256.json', json(inventory));
  const host = JSON.parse(files.get('host-config.json')); host.joomlaDiscoveryRoots[0].inventoryHash = sha256(files.get('MANIFEST-SHA256.json')); files.set('host-config.json', json(host));
}
async function writeFiles(root, files) { await mkdir(root); for (const [p, b] of files) { const target = resolve(root, p); await mkdir(dirname(target), { recursive: true }); await writeFile(target, b, { flag: 'wx' }); } }
function sourceInputs(files) {
  const build = [...Object.keys(DOCUMENTATION_BUILD_PINS), 'scripts/prepare-documentation-source-package.js', 'LICENSE.md', 'src/libraries/vendor/parse-xml/LICENSE', 'src/libraries/vendor/parse-xml/notices.txt'].map(p => `source/minijoomla/${p}`);
  return new Map([...files].filter(([p]) => p.startsWith('source/originals/') || p.startsWith('source/upstream/') || build.includes(p) || ['docs/licenses/CAMAP-ROOT-MIT.txt', 'docs/licenses/GPL-2.0.txt'].includes(p)));
}

// No test scheduling or filesystem work at import. Contributor runners await
// this function; sibling/source-package integration requires --local-build.
export async function runDocumentationSourcePackageTests({ localBuild = false } = {}) {
  let passed = 0;
  const t = { async test(name, run) { await run(); passed++; } };
  await t.test('portable independently closed source/build pins and scoped headers', async () => {
    assert.equal(Object.keys(DOCUMENTATION_BUILD_PINS).length, 11);
    assert.equal(Object.keys(DOCUMENTATION_UPSTREAM_PINS).length, 11);
    assert.ok(!Object.keys(DOCUMENTATION_BUILD_PINS).some(p => /recursos|fixture|node_modules/i.test(p)));
    for (const [p, h] of Object.entries(DOCUMENTATION_BUILD_PINS)) {
      assert.match(h, /^[a-f0-9]{64}$/);
      assert.equal(sha256(await readFile(resolve(DOCUMENTATION_FROZEN_ROOT, p))), h, p);
    }
    for (const h of Object.values(DOCUMENTATION_UPSTREAM_PINS)) assert.match(h, /^[a-f0-9]{64}$/);
    assert.match(DOCUMENTATION_DERIVATION_HEADER, /Copyright \(C\) 2006, 2009, 2010 Open Source Matters\. All rights reserved\./);
    assert.match(DOCUMENTATION_DERIVATION_HEADER, /Copyright \(C\) Jan Pavelka, www\.phoca\.cz\./);
    assert.match(DOCUMENTATION_DERIVATION_HEADER, /GPL-2\.0-or-later applies to this derived work, not only new patches/);
    assert.match(DOCUMENTATION_DERIVATION_HEADER, /09\/11\/2026/);
    assert.match(DOCUMENTATION_HELPER_HEADER, /MIT/); assert.match(DOCUMENTATION_HELPER_HEADER, /not license the Phoca\/Joomla/);
    assert.equal(DOCUMENTATION_SOURCE_RUNTIME.length, 5);
    const self = (await readFile(resolve(DOCUMENTATION_FROZEN_ROOT, 'scripts/prepare-documentation-source-package.js'))).toString();
    const pin = self.match(/^const SELF_SHA256 = '([a-f0-9]{64})';/m)[1];
    assert.equal(pin, 'f03d66e8331e4a1ddd58c69f927bb1a71413f10925b25f46a031fa9c7370df64', 'reviewed test trust root');
    const normalized = self.replace(/^const SELF_SHA256 = '[a-f0-9]{64}';/m, `const SELF_SHA256 = '${'0'.repeat(64)}';`);
    assert.equal(sha256(Buffer.from(normalized)), pin, 'independent normalized self pin');
  });
  await t.test('portable canonical XML changes only version, preserving 24-field original', () => {
    const xml = documentationAdaptationXml('0.3.0').toString();
    assert.equal((xml.match(/<field /g) ?? []).length, 24);
    assert.equal(Object.keys(DOCUMENTATION_DEFAULTS).length, 24);
    assert.equal(xml.replace('<version>0.3.0</version>', '<version>0.5.0</version>').replace('<version>0.5.0</version>', '<version>0.3.0</version>'), xml);
    assert.equal(sha256(documentationAdaptationXml('0.3.0')), '12cf6905116f5e6c9f8b9524364dc0378a3ce03e78b649a39f8cb7fa7887350d');
  });
  await t.test('portable synthetic OWN-only payloads are not self-certified by arbitrary hashes/inventory', () => {
    const synthetic = new Map([['MANIFEST-SHA256.json', json({ format: 'minijoomla-joomla-package-v1', version: '0.5.0', files: [] })], ['docs/UPSTREAM-NOTICE.md', Buffer.from('Synthetic own fixture, not upstream source or license evidence.\n')]]);
    assert.throws(() => finalizeDocumentationSourcePackage(synthetic, ARGS), /Buffer|closed|inputs/i);
    assert.throws(() => buildDocumentationSourcePackage(new Map(), ARGS), /closed/);
    assert.throws(() => buildDocumentationSourcePackage(new Map(), { ...ARGS, evidenceHash: 'f'.repeat(64) }), /Closed/);
    for (const version of ['0.3.0', '0.3.1', '0.4.0', '0.4.1', '0.5.2']) assert.throws(() => buildDocumentationSourcePackage(new Map(), { ...ARGS, version }), /0.5.0\/0.5.1/);
    const oversizedInventory = new Map([['MANIFEST-SHA256.json', Buffer.alloc(65537)]]);
    assert.throws(() => finalizeDocumentationSourcePackage(oversizedInventory, ARGS), /oversized/);
    assert.throws(() => finalizeDocumentationSourcePackage(new Map(Array.from({ length: 501 }, (_, i) => [`p${i}`, Buffer.alloc(0)])), ARGS), /budget/);
    assert.throws(() => finalizeDocumentationSourcePackage(new Map([['large', Buffer.alloc(10 * 1024 * 1024 + 1)]]), ARGS), /budget/);
    assert.throws(() => finalizeDocumentationSourcePackage(new Map([['../escape', Buffer.alloc(0)]]), ARGS));
  });
  await t.test('portable inert input/args hooks never invoked', () => {
    let hooks = 0;
    const bad = new Map(); Object.defineProperty(bad, Symbol.iterator, { get() { hooks++; return Map.prototype[Symbol.iterator]; } });
    assert.throws(() => finalizeDocumentationSourcePackage(bad, ARGS), /native Map/);
    const fake = Object.create(Map.prototype); assert.throws(() => finalizeDocumentationSourcePackage(fake, ARGS), /branded/);
    const bytes = Buffer.from('OWN'); Object.defineProperty(bytes, 'toString', { get() { hooks++; return () => 'OWN'; } });
    assert.throws(() => finalizeDocumentationSourcePackage(new Map([['own.txt', bytes]]), ARGS), /Buffer/);
    const args = {}; Object.defineProperty(args, 'base', { get() { hooks++; return BASE; } });
    assert.throws(() => buildDocumentationSourcePackage(new Map(), args), /accessor/);
    const argv = ['--base', BASE]; Object.defineProperty(argv, 1, { get() { hooks++; return BASE; } });
    assert.throws(() => parseDocumentationSourceArgs(argv), /inert/);
    assert.throws(() => parseDocumentationSourceArgs(new Array(1000000)), /bounded/);
    assert.throws(() => parseDocumentationSourceArgs(['--base', BASE, '--base', BASE]), /duplicate/);
    assert.throws(() => parseDocumentationSourceArgs(['--base', '//bad', '--output', 'tmp/documentation-adapt-agent-source-own']));
    assert.throws(() => parseDocumentationSourceArgs(['--base', BASE, '--output', 'tmp/documentation-adapt-agent-old']));
    assert.equal(hooks, 0);
  });
  if (!localBuild) return { passed, failed: 0, localBuild: false, externalSourcesRead: false };
  const work = await mkdtemp(join(PROJECT, 'tmp/documentation-adapt-agent-source-tests-'));
  const output = `${work.slice(PROJECT.length + 1).replaceAll('\\', '/')}/original`;
  const prepared = await prepareDocumentationSourcePackage({ ...ARGS, output });
  const files = await readDocumentationSourcePackage(prepared.output);
  const inputs = sourceInputs(files);

  await t.test('all 57 files / 55 inventoried payloads, exact hashes, closed global gates', () => {
    assert.equal(files.size, 57); assert.equal(prepared.inventory.files.length, 55);
    assert.ok(files.get('MANIFEST-SHA256.json').length <= 64 * 1024);
    assert.ok([...files.values()].reduce((n, b) => n + b.length, 0) <= 10 * 1024 * 1024);
    sameFiles(files, finalizeDocumentationSourcePackage(files, ARGS).files);
    sameFiles(files, buildDocumentationSourcePackage(inputs, ARGS).files);
    for (const e of prepared.inventory.files) { assert.equal(e.bytes, files.get(e.path).length); assert.equal(e.sha256, sha256(files.get(e.path))); }
    for (const name of ['ADAPTATION.json', 'adoption-plan.json', 'docs/LICENSE-LINKAGE.json']) { const data = JSON.parse(files.get(name)); for (const k of ['rightsApproved', 'publicationApproved', 'vendorRightsCleared']) assert.equal(data[k], false); }
    const meta = JSON.parse(files.get('ADAPTATION.json')); assert.equal(meta.checks.upstreamLicenseLinkage, 'passed'); assert.equal(meta.checks.selectedSourceMaterialized, 'passed');
  });

  await t.test('independent upstream references / linkage / build closure and excluded swap', () => {
    for (const [p, h] of Object.entries(DOCUMENTATION_UPSTREAM_PINS)) assert.equal(sha256(files.get(`source/upstream/PhocaDocumentation/TemplateOverride/${p}`)), h);
    assert.equal(Object.keys(DOCUMENTATION_UPSTREAM_PINS).length, 11);
    assert.ok(![...files.keys()].some(p => /swp|node_modules|CAMAP2\//i.test(p)));
    assert.equal(files.get('source/upstream/PhocaDocumentation/LICENSE').toString(), 'GNU General Public License version 2 or later; http://www.gnu.org/copyleft/gpl.html');
    assert.equal(sha256(files.get('source/upstream/PhocaDocumentation/LICENSE')), 'b8b2c2a80dbc38eb6b7c27ea374a5c0ead24449524671a65722f4ef4ade5c670');
    const closure = JSON.parse(files.get('source/BUILD-CLOSURE.json'));
    assert.equal(closure.staticSources.length, 19);
    for (const e of closure.staticSources) { assert.equal(e.bytes, files.get(e.path).length); assert.equal(e.sha256, sha256(files.get(e.path))); }
    for (const [p, h] of Object.entries(DOCUMENTATION_BUILD_PINS)) assert.equal(sha256(files.get(`source/minijoomla/${p}`)), h);
    const linkages = JSON.parse(files.get('docs/LICENSE-LINKAGE.json'));
    assert.equal(linkages.derivation.license, 'GPL-2.0-or-later'); assert.match(linkages.derivation.scope, /complete/); assert.equal(linkages.helper.historicalLicense, 'MIT');
    assert.match(linkages.icons.portInlineSvg, /does not prove/);
    assert.equal(linkages.licenseAcquisition.status, 200); assert.equal(linkages.licenseAcquisition.bytes, 83);
    assert.match(linkages.licenseAcquisition.earlierAttempts, /failures/);
  });

  await t.test('materialized map covers all fields/defaults/functions/selectors/runtime/static support with checked ranges and licensing', () => {
    const map = JSON.parse(files.get('docs/DERIVATION-MAP.json'));
    assert.equal(map.format, 'minijoomla-documentation-derivation-map-v1');
    assert.equal(map.upstreamCommit, 'f2386b6b935c82f0fa0d94881c144ef1d91af0f9');
    assert.deepEqual(map.fields.map(f => f.name), Object.keys(DOCUMENTATION_DEFAULTS));
    for (const f of map.fields) { assert.deepEqual(f.default, DOCUMENTATION_DEFAULTS[f.name]); assert.equal(f.defaultOrigin, 'local-original-port-policy'); assert.match(f.differences, /LOCAL.*useglobal/); assert.ok(f.constraints.includes(`defaults.${f.name}`)); }
    assert.deepEqual(map.runtime.map(r => r.path), DOCUMENTATION_SOURCE_RUNTIME);
    for (const r of map.runtime) { assert.equal(r.sha256, sha256(files.get(r.path))); assert.ok(files.get(r.path).equals(files.get(r.preferred))); assert.match(r.license, /GPL-2.0-or-later/); assert.ok(files.has(r.licenseText)); }
    const expectedFunctions = DOCUMENTATION_SOURCE_RUNTIME.filter(p => p.endsWith('.js')).flatMap(path => [...files.get(path).toString().matchAll(/^\uFEFF?(?:export )?function (\w+)\(/gm)].map(m => `${path}:${m[1]}`)).sort();
    assert.deepEqual(map.functions.map(f => `${f.target.path}:${f.name}`).sort(), expectedFunctions);
    const css = files.get('media/mod_documentation/css/documentation.css').toString();
    const expectedSelectors = [...css.matchAll(/(\.camap-documentation[^{}]*?)\{/g)].flatMap(m => m[1].split(',').map(s => s.trim()));
    assert.deepEqual(map.selectors.map(s => s.selector), expectedSelectors);
    assert.equal(map.buildSupport.length, 13);
    assert.deepEqual(map.buildSupport.map(s => s.path).sort(), [...Object.keys(DOCUMENTATION_BUILD_PINS), 'scripts/prepare-documentation-source-package.js'].map(p => `source/minijoomla/${p}`).concat('source/rebuild.mjs').sort());
    for (const s of map.buildSupport) { assert.equal(s.license, s.path.includes('/vendor/') ? 'ISC' : 'GPL-2.0-or-later'); assert.ok(files.has(s.licensePath)); for (const i of s.imports) { assert.equal(posix.normalize(posix.join(posix.dirname(s.path), i.specifier)), i.target); assert.ok(files.has(i.target)); } }
    let references = 0;
    function inspect(value) {
      if (!value || typeof value !== 'object') return;
      if (Object.hasOwn(value, 'startLine')) {
        references++; const bytes = files.get(value.path); assert.ok(bytes, value.path);
        const lines = bytes.toString().replace(/\r\n?/g, '\n').split('\n');
        assert.ok(value.startLine >= 1 && value.endLine >= value.startLine && value.endLine <= lines.length);
        const range = lines.slice(value.startLine - 1, value.endLine).join('\n');
        assert.equal(value.fileSha256, sha256(bytes)); assert.equal(value.rangeSha256, sha256(Buffer.from(range)));
        assert.ok(value.anchors.length); for (const a of value.anchors) assert.ok(range.includes(a), `${value.path}:${value.startLine} ${a}`);
      }
      for (const v of Object.values(value)) inspect(v);
    }
    inspect(map); assert.ok(references > 250);
    const functionByName = name => map.functions.find(f => f.name === name);
    assert.deepEqual([functionByName('renderCategoriesView').target.startLine, functionByName('renderCategoryCards').target.startLine, functionByName('renderChildrenList').target.startLine, functionByName('renderPagination').target.startLine, functionByName('renderCategoryView').target.startLine], [308, 266, 338, 376, 395]);
    assert.match(functionByName('renderCategoryCards').differences, /cards.*lists.*tmpl_hide_categories.*showDescriptionImage/i);
    assert.match(functionByName('renderChildrenList').differences, /show_subcat_desc_cat.*show_subcat_desc/);
    assert.match(functionByName('renderCategoryView').differences, /ACL\/access-view\/show_noauth.*publish_up\/publish_down/);
    assert.match(functionByName('renderPagination').differences, /show_pagination\/show_pagination_results/);
    assert.match(map.fragments.find(f => f.name === 'canonicalXML').differences, /NOT generated from PHP/);
    assert.equal(map.exclusions.plugin.selectedDependency, false);
    assert.equal(map.licensing.preservedOriginalLicense, true);
    assert.deepEqual(map.licensing.relationships, JSON.parse(files.get('docs/LICENSE-LINKAGE.json')));
    for (const r of map.licensing.records) { assert.equal(r.sha256, sha256(files.get(r.path))); assert.equal(r.bytes, files.get(r.path).length); }
  });

  await t.test('preserved project license links and scoped bridge resolve; GPL duplicate exact, no broader third-party inventory', async () => {
    const path = 'source/minijoomla/LICENSE.md';
    assert.ok(files.get(path).equals(await readFile(resolve(PROJECT, 'LICENSE.md'))));
    assert.equal(sha256(files.get(path)), '2a06b5b3c6be983acfbc4553800da058cd67a280d11df9b3d7179b94e65d550c');
    for (const p of [path, 'source/minijoomla/docs/THIRD-PARTY-NOTICES.md']) {
      for (const m of files.get(p).toString().matchAll(/\]\(([^)]+)\)/g)) assert.ok(files.has(posix.normalize(posix.join(posix.dirname(p), m[1]))), `${p} -> ${m[1]}`);
    }
    assert.ok(files.get('source/minijoomla/docs/licenses/GPL-2.0.txt').equals(files.get('docs/licenses/GPL-2.0.txt')));
    const bridge = files.get('source/minijoomla/docs/THIRD-PARTY-NOTICES.md').toString();
    assert.match(bridge, /not the full project's/); assert.match(bridge, /ISC/); assert.match(bridge, /NOT selected/);
    const closure = JSON.parse(files.get('source/BUILD-CLOSURE.json'));
    assert.deepEqual(closure.sourceLicenseMapping, JSON.parse(files.get('docs/LICENSE-LINKAGE.json')).buildSupport);
  });

  await t.test('only notice comments and XML version differ from old overlay; exact preferred source and 24 ordered fields', async () => {
    const originals = new Map(Object.keys(DOCUMENTATION_ANCHORS).map(p => [p, files.get(`source/originals/${p}`)]));
    const overlay = applyDocumentationOverlay(originals);
    for (const [p, runtime, header] of [[SHARED_SOURCE_PATH, `libraries/camap/${SHARED_SOURCE_PATH}`, DOCUMENTATION_HELPER_HEADER], [DOCUMENTATION_SOURCE_PATH, `libraries/camap/${DOCUMENTATION_SOURCE_PATH}`, DOCUMENTATION_DERIVATION_HEADER], [DOCUMENTATION_CSS_PATH, 'media/mod_documentation/css/documentation.css', DOCUMENTATION_DERIVATION_HEADER]]) {
      const expected = Buffer.from(overlay.files.get(p).toString().replace(/\r\n?/g, '\n'));
      assert.ok(files.get(runtime).subarray(Buffer.byteLength(header)).equals(expected));
      assert.ok(files.get(runtime).toString().startsWith(header));
    }
    for (const p of DOCUMENTATION_SOURCE_RUNTIME) assert.ok(files.get(p).equals(files.get(`source/preferred/${p}`)));
    assert.equal(files.get('modules/mod_documentation/mod_documentation.xml').toString(), documentationAdaptationXml('0.3.0').toString().replace('<version>0.3.0</version>', '<version>0.5.0</version>'));
    assert.equal(prepared.descriptor.params.length, 24);
    assert.deepEqual(prepared.descriptor.params.map(p => p.label), Object.keys(DOCUMENTATION_DEFAULTS));
    const port = await import(pathToFileURL(resolve(prepared.output, 'libraries/camap', DOCUMENTATION_SOURCE_PATH)).href);
    const oldPath = resolve(work, 'old-overlay');
    await writeFiles(oldPath, new Map([...overlay.files].filter(([p]) => p.endsWith('.js'))));
    const old = await import(pathToFileURL(resolve(oldPath, DOCUMENTATION_SOURCE_PATH)).href);
    const cases = [{}, { settings: { categories: [{ id: 'one', title: '<Title>', articles: [{ title: 'A', href: 'https://example.invalid/a' }] }] } }, { settings: { view: 'category', activeCategoryId: 'x', categories: [{ id: 'x', title: 'X', parentId: 'x' }] } }, { settings: { categories: [{ id: 'x', title: 'X' }, { id: 'x', title: 'Y' }] } }];
    for (const data of cases) assert.equal(port.default.render(data), old.default.render(data));
  });

  await t.test('version/base are the only explicit differences plus map XML hashes; old profiles denied', () => {
    const another = buildDocumentationSourcePackage(inputs, { version: '0.5.1', base: '/offline/documentation/0.5.1' });
    assert.equal(another.descriptor.version, '0.5.1');
    const changed = [...files].filter(([p, b]) => !b.equals(another.files.get(p))).map(([p]) => p).sort();
    assert.deepEqual(changed, ['ADAPTATION.json', 'MANIFEST-SHA256.json', 'adoption-plan.json', 'host-config.json', 'docs/DERIVATION-MAP.json', 'modules/mod_documentation/mod_documentation.xml', 'source/preferred/modules/mod_documentation/mod_documentation.xml'].sort());
    for (const version of ['0.3.0', '0.3.1', '0.4.0', '0.4.1']) assert.throws(() => buildDocumentationSourcePackage(inputs, { ...ARGS, version }), /0.5.0\/0.5.1/);
  });

  await t.test('changed notices/licenses/originals/build source/linkage/runtime/controls cannot be certified by rehashing', () => {
    for (const target of ['docs/UPSTREAM-NOTICE.md', 'docs/ADAPTATION-NOTICE.md', 'docs/licenses/GPL-2.0.txt', 'docs/licenses/CAMAP-ROOT-MIT.txt', 'source/upstream/PhocaDocumentation/LICENSE', `source/upstream/PhocaDocumentation/TemplateOverride/${Object.keys(DOCUMENTATION_UPSTREAM_PINS)[0]}`, `source/originals/${DOCUMENTATION_SOURCE_PATH}`, 'source/minijoomla/scripts/prepare-documentation-adaptation.js', 'source/minijoomla/scripts/prepare-documentation-source-package.js', 'source/minijoomla/src/libraries/vendor/parse-xml/LICENSE', 'source/rebuild.mjs', 'source/BUILD-CLOSURE.json', 'docs/LICENSE-LINKAGE.json', `libraries/camap/${DOCUMENTATION_SOURCE_PATH}`, 'source/preferred/modules/mod_documentation/mod_documentation.js', 'modules/mod_documentation/mod_documentation.xml', 'ADAPTATION.json', 'adoption-plan.json']) {
      const changed = copy(files); changed.set(target, Buffer.concat([changed.get(target), Buffer.from('\nTAMPER\n')])); rehash(changed);
      assert.throws(() => finalizeDocumentationSourcePackage(changed, ARGS), undefined, target);
    }
    const extra = copy(files); extra.set('source/upstream/arbitrary.php', Buffer.from('<?php exit;')); rehash(extra); assert.throws(() => finalizeDocumentationSourcePackage(extra, ARGS), /Extra\/missing/);
    const missing = copy(files); missing.delete('docs/UPSTREAM-NOTICE.md'); rehash(missing); assert.throws(() => finalizeDocumentationSourcePackage(missing, ARGS));
    const inventory = copy(files); inventory.set('MANIFEST-SHA256.json', Buffer.alloc(65537)); assert.throws(() => finalizeDocumentationSourcePackage(inventory, ARGS), /oversized/);
    const host = copy(files); host.set('host-config.json', json({ approval: true })); assert.throws(() => finalizeDocumentationSourcePackage(host, ARGS), /host-config/);
    const inputsExtra = new Map(inputs); inputsExtra.set('source/originals/other.js', Buffer.from('')); assert.throws(() => buildDocumentationSourcePackage(inputsExtra, ARGS), /closed/);
    for (const target of ['docs/DERIVATION-MAP.json', 'source/minijoomla/LICENSE.md', 'source/minijoomla/docs/licenses/GPL-2.0.txt', 'source/minijoomla/docs/THIRD-PARTY-NOTICES.md']) {
      const changed = copy(files); changed.set(target, Buffer.concat([changed.get(target), Buffer.from('\nTAMPER\n')])); rehash(changed);
      assert.throws(() => finalizeDocumentationSourcePackage(changed, ARGS), undefined, target);
    }
    for (const mutate of [m => m.fields.pop(), m => m.functions.pop(), m => m.selectors.pop(), m => m.fields[0].default = 'category', m => m.functions[0].target.startLine++, m => m.functions[0].target.anchors = ['invented'], m => m.functions[0].target.rangeSha256 = 'f'.repeat(64), m => m.functions[0].differences = 'Equivalent upstream', m => m.licensing.relationships.buildSupport.scope = 'all vendor rights']) {
      const changed = copy(files); const map = JSON.parse(changed.get('docs/DERIVATION-MAP.json')); mutate(map); changed.set('docs/DERIVATION-MAP.json', json(map)); rehash(changed);
      assert.throws(() => finalizeDocumentationSourcePackage(changed, ARGS), /DERIVATION-MAP/);
    }
  });

  await t.test('inert Maps/Buffers/options/argv and file/byte bounds, no user hooks invoked', () => {
    let hooks = 0;
    const badMap = copy(files); Object.defineProperty(badMap, Symbol.iterator, { get() { hooks++; return Map.prototype[Symbol.iterator]; } }); assert.throws(() => finalizeDocumentationSourcePackage(badMap, ARGS), /native Map/);
    const badBuffer = Buffer.from('X'); Object.defineProperty(badBuffer, 'toString', { get() { hooks++; return () => 'X'; } });
    const badFiles = copy(files); badFiles.set('docs/UPSTREAM-NOTICE.md', badBuffer); assert.throws(() => finalizeDocumentationSourcePackage(badFiles, ARGS), /Buffer/);
    class SpecialMap extends Map {} assert.throws(() => finalizeDocumentationSourcePackage(new SpecialMap(files), ARGS));
    const fake = Object.create(Map.prototype); assert.throws(() => finalizeDocumentationSourcePackage(fake, ARGS), /branded/);
    const args = {}; Object.defineProperty(args, 'base', { get() { hooks++; return BASE; } }); assert.throws(() => buildDocumentationSourcePackage(inputs, args), /accessor/);
    const argv = ['--base', BASE]; Object.defineProperty(argv, 1, { get() { hooks++; return BASE; } }); assert.throws(() => parseDocumentationSourceArgs(argv), /inert/);
    assert.throws(() => parseDocumentationSourceArgs(new Array(1000000)), /bounded/);
    assert.throws(() => parseDocumentationSourceArgs(['--base', BASE, '--base', BASE]), /duplicate/);
    assert.throws(() => parseDocumentationSourceArgs(['--version', '0.5.0', '--base', '//bad', '--output', output]));
    assert.throws(() => parseDocumentationSourceArgs(['--version', '0.5.0', '--base', BASE, '--output', 'tmp/documentation-adapt-agent-old']));
    assert.throws(() => buildDocumentationSourcePackage(inputs, { ...ARGS, evidenceHash: 'f'.repeat(64) }), /Closed/);
    assert.throws(() => finalizeDocumentationSourcePackage(new Map(Array.from({ length: 501 }, (_, i) => [`p${i}`, Buffer.alloc(0)])), ARGS), /budget/);
    assert.throws(() => finalizeDocumentationSourcePackage(new Map([['large', Buffer.alloc(10 * 1024 * 1024 + 1)]]), ARGS), /budget/);
    const traversal = new Map([['../escape', Buffer.alloc(0)]]); assert.throws(() => finalizeDocumentationSourcePackage(traversal, ARGS));
    assert.equal(hooks, 0);
  });

  await t.test('isolated offline launcher EXACT all-file rebuild without siblings/npm and rejects existing output', async () => {
    const isolated = resolve(work, 'isolated'); await writeFiles(isolated, files);
    const outName = `documentation-adapt-agent-source-rebuilt-${work.split(/[\\/]/).at(-1)}`;
    const args = ['--version', '0.5.0', '--base', BASE, '--output', `tmp/${outName}`];
    const result = run(resolve(isolated, 'source/rebuild.mjs'), args, isolated); assert.equal(result.status, 0, result.stderr);
    const rebuilt = resolve(work, outName);
    sameFiles(files, await readDocumentationSourcePackage(rebuilt));
    const another = buildDocumentationSourcePackage(inputs, { version: '0.5.1', base: '/offline/documentation/0.5.1' });
    const secondName = `${outName}-051`;
    const result051 = run(resolve(isolated, 'source/rebuild.mjs'), ['--version', '0.5.1', '--base', '/offline/documentation/0.5.1', '--output', `tmp/${secondName}`], isolated);
    assert.equal(result051.status, 0, result051.stderr);
    sameFiles(another.files, await readDocumentationSourcePackage(resolve(work, secondName)));
    const second = run(resolve(isolated, 'source/rebuild.mjs'), args, isolated); assert.notEqual(second.status, 0); assert.match(second.stderr, /Existing output/);
    assert.equal((await lstat(rebuilt)).isDirectory(), true);
    await assert.rejects(prepareDocumentationSourcePackage({ ...ARGS, output }), /Existing output/);
  });

  await t.test('launcher detects changed executable before import, and rehashed license before rebuild/write', async () => {
    const changed = copy(files); changed.set('source/minijoomla/scripts/prepare-documentation-adaptation.js', Buffer.from('throw new Error("UNTRUSTED_EXECUTED");')); rehash(changed);
    const malicious = resolve(work, 'bad-code'); await writeFiles(malicious, changed);
    const result = run(resolve(malicious, 'source/rebuild.mjs'), ['--version', '0.5.0', '--base', BASE, '--output', 'tmp/documentation-adapt-agent-source-never-code'], malicious);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /pin refused/); assert.doesNotMatch(result.stderr, /UNTRUSTED_EXECUTED/);
    const licenseFiles = copy(files); licenseFiles.set('docs/licenses/GPL-2.0.txt', Buffer.from('MIT')); rehash(licenseFiles);
    const badLicense = resolve(work, 'bad-license'); await writeFiles(badLicense, licenseFiles);
    const denied = run(resolve(badLicense, 'source/rebuild.mjs'), ['--version', '0.5.0', '--base', BASE, '--output', 'tmp/documentation-adapt-agent-source-never-license'], badLicense);
    assert.notEqual(denied.status, 0); assert.match(denied.stderr, /pin refused/);
    const mapFiles = copy(files); const map = JSON.parse(mapFiles.get('docs/DERIVATION-MAP.json'));
    map.fields[0].default = 'category'; mapFiles.set('docs/DERIVATION-MAP.json', json(map)); rehash(mapFiles);
    const badMap = resolve(work, 'bad-map'); await writeFiles(badMap, mapFiles);
    const refusedMap = run(resolve(badMap, 'source/rebuild.mjs'), ['--version', '0.5.0', '--base', BASE, '--output', 'tmp/documentation-adapt-agent-source-never-map'], badMap);
    assert.notEqual(refusedMap.status, 0); assert.match(refusedMap.stderr, /DERIVATION-MAP/);
  });

  await t.test('hardlink payloads refused without modifying originals', async () => {
    const linked = resolve(work, 'hardlinked'); await writeFiles(linked, files);
    const target = resolve(linked, 'docs/UPSTREAM-NOTICE.md'); await unlink(target);
    await link(resolve(prepared.output, 'docs/UPSTREAM-NOTICE.md'), target);
    await assert.rejects(readDocumentationSourcePackage(linked), /hardlink/);
    await unlink(target);
    // Only our own link removed, leaving the source and original package intact.
    sameFiles(files, await readDocumentationSourcePackage(prepared.output));
  });

  await t.test('junction/symlink directory rejected on read and new-output ancestry', async () => {
    const target = resolve(work, 'links'); await mkdir(target);
    const linked = resolve(target, 'input'); await symlink(prepared.output, linked, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(readDocumentationSourcePackage(linked), /Symlink|junction|link/i);
    await rmdir(linked);
    const outParent = resolve(work, 'new-output-link'); await symlink(target, outParent, process.platform === 'win32' ? 'junction' : 'dir');
    const rel = outParent.slice(PROJECT.length + 1).replaceAll('\\', '/');
    await assert.rejects(prepareDocumentationSourcePackage({ ...ARGS, output: `${rel}/new` }), /Symlink|junction|link/i);
    await rmdir(outParent);
  });
  return { passed, failed: 0, localBuild: true, externalSourcesRead: true };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--local-build') || process.argv.slice(2).length > 1) throw new Error('Only explicit --local-build is accepted.');
    const result = await runDocumentationSourcePackageTests({ localBuild: process.argv.includes('--local-build') });
    console.log(`Documentation source package: ${result.passed} groups passed; ${result.localBuild ? 'explicit local/offline build integration' : 'portable own-only synthetic checks, no CAMAP2/npm/tmp inputs'}.`);
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
