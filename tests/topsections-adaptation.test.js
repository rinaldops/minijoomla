/* SPDX-License-Identifier: GPL-2.0-or-later
 * Portable known-byte graph only; no CAMAP/dependencies/browser/network/writes.
 * --local-build explicitly enables two fresh private offline package trees.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  applyTopsectionsOverlay, finalizeTopsectionsPackage, prepareTopsectionsAdaptation,
  parseTopsectionsAdaptationArgs, TOPSECTIONS_ANCHORS, TOPSECTIONS_CSS_ANCHORS,
  TOPSECTIONS_SOURCE_PATH, TOPSECTIONS_CSS_PATH, TOPSECTIONS_API_SHA256,
  SHARED_SOURCE_PATH, VALID_TOPSECTIONS_ITEM_SOURCE, sha256, INHERITED_LICENSE_PATH,
  CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256
} from '../scripts/prepare-topsections-adaptation.js';
import { SAFE_URL_SOURCE, readAdaptationFiles, createAdaptationCollector, collectAdaptationDependencies, ADAPTATION_API_FILES, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES, ADAPTATION_ORIGIN_COMMIT } from '../scripts/prepare-editorial-adaptation.js';
import { ADOPTION_MODULES, validateAdoptionSchema } from '../scripts/prepare-module-adoption.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { parseJsonObject, normalizeParamValues } from '../src/libraries/minijoomla/application/declared-params.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELEMENT = 'mod_camap_topsections';
const KEY = `camap.${ELEMENT}`;
const LIB = `libraries/camap/${TOPSECTIONS_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${ELEMENT}/css/sd.css`;
const ENTRY = `modules/${ELEMENT}/${ELEMENT}.js`;
const XML = `modules/${ELEMENT}/${ELEMENT}.xml`;
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(bytes.toString().replace(/\r\n?/g, '\n'));
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cases = [];
const registerCase = (name, run) => cases.push({ name, run });

// Tiny actual original module, including BOM and all three trailing LF bytes.
const MODULE_SOURCE = '\uFEFF' + [
  "import { escapeHtml, safeUrl, stateMessage } from '../_shared/render.js';",
  "export const settingsSchema = Object.freeze({ version: 1, fields: { title: { type: 'string' }, items: { type: 'array' }, itemLimit: { type: 'number' } } });",
  "export const defaults = Object.freeze({ title: '', items: [], itemLimit: 6 });",
  'export default { name: \'camap.mod_camap_topsections\', settings: defaults, settingsSchema, render: ({ settings = {}, state = \'ready\' } = {}) => { const c = { ...defaults, ...settings }; const status = stateMessage(state, \'Nenhum destaque disponível.\'); if (status) return status; const items = (Array.isArray(c.items) ? c.items : []).slice(0, Math.max(0, Number(c.itemLimit) || 6)); return `<section class="camap-sd"><h2>${escapeHtml(c.title)}</h2>${items.length ? `<ul>${items.map(i => `<li><a href="${escapeHtml(safeUrl(i.url))}">${escapeHtml(i.title)}</a></li>`).join(\'\')}</ul>` : stateMessage(\'empty\')}</section>`; } };',
  '', '', ''
].join('\n');
const CSS_SOURCE = '\uFEFF.camap-sd{padding:1rem 0}.camap-sd ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1rem;list-style:none;padding:0}.camap-sd li{border-left:.25rem solid #008542;padding:1rem}.camap-sd a{color:#006298;font-weight:700}\n';

// Reuse existing helper literal as DATA, without importing its test suite.
function literal(token) {
  assert.equal(token[0], token.at(-1));
  let result = '';
  for (let i = 1; i < token.length - 1; i++) {
    if (token[i] !== '\\') { result += token[i]; continue; }
    const key = token[++i];
    const escapes = { n: '\n', r: '\r', t: '\t', "'": "'", '"': '"', '\\': '\\' };
    if (key === 'u') { const code = token.slice(i + 1, i + 5); assert.match(code, /^[a-f0-9]{4}$/i); result += String.fromCharCode(parseInt(code, 16)); i += 4; }
    else { assert.ok(Object.hasOwn(escapes, key)); result += escapes[key]; }
  }
  return result;
}
const fixture = await readFile(join(PROJECT, 'tests/camap-editorial-adoption.test.js'), 'utf8');
assert.ok(Buffer.byteLength(fixture) < 64 * 1024);
const helperStart = "const SHARED_SOURCE = '\\uFEFF' + [";
assert.equal(fixture.split(helperStart).length, 2);
const helperBody = fixture.split(helperStart)[1].split("].join('\\n');")[0];
const literalPattern = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g;
assert.match(helperBody.replace(literalPattern, ''), /^[,\s]*$/);
const helperBytes = Buffer.from('\uFEFF' + helperBody.match(literalPattern).map(literal).join('\n'));
const originals = new Map([[SHARED_SOURCE_PATH, helperBytes], [TOPSECTIONS_SOURCE_PATH, Buffer.from(MODULE_SOURCE)], [TOPSECTIONS_CSS_PATH, Buffer.from(CSS_SOURCE)]]);
for (const [path, bytes] of originals) assert.equal(sha256(bytes), TOPSECTIONS_ANCHORS[path][1]);
assert.equal(sha256(Buffer.from(CSS_SOURCE)), TOPSECTIONS_CSS_ANCHORS[1]);
const overlay = applyTopsectionsOverlay(originals);
const shared = await import(dataUrl(overlay.files.get(SHARED_SOURCE_PATH)));
function moduleUrl(files) {
  const source = files.get(TOPSECTIONS_SOURCE_PATH).toString();
  const anchor = "from '../_shared/render.js';";
  assert.equal(source.split(anchor).length, 2);
  return dataUrl(source.replace(anchor, () => `from '${dataUrl(files.get(SHARED_SOURCE_PATH))}';`));
}
const loaded = await import(moduleUrl(overlay.files));
const prior = await import(moduleUrl(originals));
const render = loaded.default.render;
const rows = [{ title: 'A & <B>', url: '#/article/a' }, { title: 'B', url: '/local/b' }, { title: 'C', url: 'https://example.invalid/c' }, { title: 'D' }];
const count = html => (html.match(/<li>/g) ?? []).length;

function fixtureXml(version) {
  return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="${KEY}">
  <name>CAMAP Top Sections</name>
  <version>${version}</version>
  <description>CAMAP Top Sections JavaScript module for MiniJoomla.</description>
  <files>
    <filename module="${ELEMENT}">${ELEMENT}.js</filename>
  </files>
  <media destination="${ELEMENT}" folder="media">
    <filename>css/sd.css</filename>
  </media>
  <config>
    <fields name="params">
      <fieldset name="basic">
        <field name="title" label="title" default="" type="text" />
        <field name="items" label="items" default="[]" type="textarea" mj:type="json" mj:valueType="array" />
        <field name="itemLimit" label="itemLimit" default="6" type="number" />
      </fieldset>
    </fields>
  </config>
</extension>
`);
}
const descriptor = parseJoomlaManifest(fixtureXml('0.3.0'), { baseUrl: '/offline/topsections/0.3.0', manifestPath: XML });
// Full MIT text is already preserved in the portable highlights fixture. Read
// it as inert DATA and hash-check it, rather than duplicating copyright text.
const licenseFixture = await readFile(join(PROJECT, 'tests/highlights-adaptation.test.js'), 'utf8');
assert.ok(Buffer.byteLength(licenseFixture) < 64 * 1024);
const mitStart = 'const mit = Buffer.from(`';
assert.equal(licenseFixture.split(mitStart).length, 2);
const mit = Buffer.from(licenseFixture.split(mitStart)[1].split('`);')[0]);
assert.equal(sha256(mit), ADAPTATION_MIT_HASHES[1]);
const gpl = await readFile(join(PROJECT, CHANGES_LICENSE_PATH));
assert.equal(sha256(gpl), CHANGES_LICENSE_SHA256);
function provenance() {
  const snapshot = [...originals].map(([path, bytes]) => ({ path, originalSha256: sha256(bytes), snapshotSha256: sha256(overlay.files.get(path)), bytes: bytes.length }));
  for (const path of ['tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.filter(({ folder }) => folder !== ELEMENT).map(({ folder }) => `extensions/camap/${folder}/module.js`)]) {
    // Synthetic snapshot metadata, NOT vendor code. Real audit compares each
    // original hash to the local checkout; no placeholder is ever executed.
    const hash = path === TOPSECTIONS_CSS_PATH ? TOPSECTIONS_CSS_ANCHORS[1] : path.startsWith('tools/') ? ADAPTATION_GENERATOR_HASHES[0] : sha256(Buffer.from(`inert fixture metadata: ${path}`));
    snapshot.push({ path, originalSha256: hash, snapshotSha256: hash, bytes: path === TOPSECTIONS_CSS_PATH ? Buffer.byteLength(CSS_SOURCE) : 0 });
  }
  return { changes: structuredClone(overlay.changes), licenses: [], generatorSha256: ADAPTATION_GENERATOR_HASHES[0], adoptionApiSha256: TOPSECTIONS_API_SHA256, snapshot,
    inheritedLicenseBytes: mit, inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: [TOPSECTIONS_SOURCE_PATH, SHARED_SOURCE_PATH, TOPSECTIONS_CSS_PATH], globalVendorRightsApproved: false, evidence: 'Portable exact historical notice hash; local audit compares original source bytes.' },
    changesLicenseBytes: gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' } };
}
function rebuildInventory(files, version = '0.3.0') {
  const inv = json({ format: 'minijoomla-joomla-package-v1', version, moduleKeys: { [ELEMENT]: KEY }, moduleStyles: { [KEY]: [CSS] }, files: [...files].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) });
  const base = `/offline/topsections/${version}`;
  files.set('MANIFEST-SHA256.json', inv);
  files.set('host-config.json', json({ joomlaDiscoveryRoots: [{ id: `camap-${ELEMENT}-${version}`, baseUrl: base, inventoryHash: sha256(inv), immutable: true, discover: true }], moduleStyles: { [KEY]: [`${base}/${CSS}`] }, moduleStyleRevisions: { [KEY]: { [`${base}/${ENTRY}`]: [`${base}/${CSS}`] } } }));
  return files;
}
function stagedFixture(version = '0.3.0') {
  return rebuildInventory(new Map([[LIB, overlay.files.get(TOPSECTIONS_SOURCE_PATH)], [SHARED, overlay.files.get(SHARED_SOURCE_PATH)], [CSS, overlay.files.get(TOPSECTIONS_CSS_PATH)], [ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`)], [XML, fixtureXml(version)], ['docs/ADOPTION-NOTICE.md', Buffer.from('Offline fixture\n')], ['adoption-plan.json', json({ format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module: ELEMENT, key: KEY, version, base: `/offline/topsections/${version}`, pilot: false, validation: 'Portable fixture', licenses: [], sourceLicensePresent: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), nextGate: 'Coordinator review', hostNote: 'One root only' })]]), version);
}
function modifyControl(files, path, mutate) { const value = JSON.parse(files.get(path)); mutate(value); files.set(path, json(value)); }

registerCase('exact three patches preserve original BOM, mixed EOL and all unpatched source bytes', () => {
  assert.equal(overlay.files.size, 3);
  const raw = new Map([...originals].map(([path, bytes]) => [path, Buffer.from(bytes.toString().replace(/\n+$/, ending => ending.replace(/\n/g, '\r\n')))]));
  const rawOverlay = applyTopsectionsOverlay(raw);
  for (const change of rawOverlay.changes) {
    assert.equal(change.originalSha256, TOPSECTIONS_ANCHORS[change.path][0]);
    assert.equal(change.generatedSha256, sha256(overlay.files.get(change.path)));
    assert.equal(change.bom, true); assert.equal(change.lineEndings, change.path === TOPSECTIONS_CSS_PATH ? 'CRLF' : 'mixed LF/CRLF preserved');
    const patched = rawOverlay.files.get(change.path).toString();
    const reverted = change.path === SHARED_SOURCE_PATH ? patched.replace(SAFE_URL_SOURCE, helperBytes.toString().split('\n')[1]) : change.path === TOPSECTIONS_CSS_PATH ? patched.replace('minmax(min(14rem,100%),1fr)', 'minmax(14rem,1fr)').replace('.camap-sd{overflow-wrap:anywhere}.camap-sd li{min-width:0}\r\n', '') : patched.replace(VALID_TOPSECTIONS_ITEM_SOURCE + '\n', '').replace('.filter(_validTopsectionsItem)', '');
    assert.equal(reverted, raw.get(change.path).toString());
  }
  assert.deepEqual(loaded.defaults, prior.defaults); assert.deepEqual(loaded.settingsSchema, prior.settingsSchema);
  for (const [path, bytes] of originals) assert.equal(sha256(bytes), TOPSECTIONS_ANCHORS[path][1]);
});
registerCase('tampered helper/module/CSS or wider overlay fail before source execution', () => {
  for (const path of originals.keys()) { const bad = new Map(originals); bad.set(path, Buffer.concat([bad.get(path), Buffer.from('// unknown')])); assert.throws(() => applyTopsectionsOverlay(bad), /Unapproved original SHA-256/); }
  assert.throws(() => applyTopsectionsOverlay(new Map()), /exactly/);
  assert.throws(() => applyTopsectionsOverlay(new Map([...originals, ['foreign.js', Buffer.from('')] ])), /exactly/);
});
registerCase('reused strict URL policy keeps safe bytes and rejects encoded/protocol/credential bypasses', () => {
  for (const url of ['#', '#/article/a', '#javascript:x', '/local/a?q="x"&v=1', '/local/caf%C3%A9', 'https://example.invalid/a', 'HTTPS://EXAMPLE.invalid:443/a']) assert.equal(shared.safeUrl(url), url);
  for (const url of [null, undefined, 42, false, {}, [], '', ' ', 'relative', '?query', 'http://example.invalid', 'javascript:alert(1)', 'data:text/html,x', '//unsafe.invalid', '/\\unsafe.invalid', 'https://u:p@example.invalid', 'https://@example.invalid', 'https:///example.invalid', 'https://', 'https://[invalid', '/a b', '/a\t', '/a\0', '/a\u007f', '/a\u0085', '/%2funsafe', '/%5cunsafe', '/%0a', '/%1f', '/%7f', '/%252funsafe', '/%255c', '/%25250a', '/%2525252f', '/bad%', '/bad%zz', '/%20x', '/%C2%A0x', ' /x', '/x ']) {
    assert.equal(shared.safeUrl(url), '#'); assert.equal(shared.safeUrl(url, '/local/fallback'), '/local/fallback'); assert.equal(shared.safeUrl(url, '//unsafe.invalid'), '#');
  }
  let calls = 0; const object = { toString() { calls++; throw Error('not invoked'); } };
  assert.equal(shared.safeUrl(object, object), '#'); assert.equal(calls, 0);
});
registerCase('title/items/itemLimit schema labels/defaults and XML JSON-array type stay unchanged', () => {
  validateAdoptionSchema(descriptor, loaded);
  assert.deepEqual(loaded.defaults, { title: '', items: [], itemLimit: 6 });
  assert.deepEqual(descriptor.params.map(({ name, type, label, default: value }) => ({ name, type, label, value })), [{ name: 'title', type: 'text', label: 'title', value: '' }, { name: 'items', type: 'json', label: 'items', value: [] }, { name: 'itemLimit', type: 'number', label: 'itemLimit', value: 6 }]);
  assert.equal(descriptor.params[1].valueType, 'array'); assert.equal(loaded.settingsSchema.version, 1);
  for (const param of descriptor.params) { assert.equal(Object.hasOwn(param, 'min'), false); assert.equal(Object.hasOwn(param, 'max'), false); }
});
registerCase('original limit semantics: zero -> six, negatives empty, fractions truncate, no new maximum', () => {
  const many = Array.from({ length: 150 }, (_, n) => ({ title: `T${n}`, url: '#/local' }));
  for (const itemLimit of [undefined, 0, -1, -0.5, 0.9, 1.9, 6, 120, 1000, '2', 'invalid', NaN, Infinity]) assert.equal(render({ settings: { items: many, itemLimit } }), prior.default.render({ settings: { items: many, itemLimit } }));
  for (const [limit, expected] of [[0, 6], [-1, 0], [0.9, 0], [1.9, 1], [120, 120]]) assert.equal(count(render({ settings: { items: many, itemLimit: limit } })), expected);
});
registerCase('valid rendering preserves markup/escaping, blank heading, states and no invented images/backend', () => {
  assert.equal(render(), prior.default.render()); assert.match(render(), /camap-sd"><h2><\/h2>/);
  for (const state of ['loading', 'error', 'empty', 'ready', 'unknown']) assert.equal(render({ state, settings: { title: 'T <&>', items: rows } }), prior.default.render({ state, settings: { title: 'T <&>', items: rows } }));
  assert.match(render({ state: 'empty' }), /Nenhum destaque disponível/);
  assert.match(render({ settings: { items: [] } }), /Nenhum conteúdo disponível/);
  assert.match(render({ settings: { title: 'T <&>', items: rows } }), /T &lt;&amp;&gt;[^]*A &amp; &lt;B&gt;/);
  assert.doesNotMatch(render({ settings: { items: [{ title: 'T', image: '/ignored.jpg', alias: 'ignored', description: 'ignored' }] } }), /img|ignored/);
});
registerCase('own plain rows only, absent/string URLs; unknown data retained but getter rows never executed', () => {
  let calls = 0; const getter = () => { calls++; throw Error('getter'); };
  const symbol = Symbol('extra');
  const invalid = [null, false, 4, 'row', [], {}, { title: '' }, { title: '  ' }, { title: 4 }, { title: 'T', url: null }, { title: 'T', url: {} }, Object.defineProperty({}, 'title', { get: getter }), Object.defineProperty({ title: 'T' }, 'url', { get: getter }), Object.defineProperty({ title: 'T' }, 'extra', { get: getter }), Object.defineProperty({ title: 'T' }, symbol, { get: getter }), Object.create({ title: 'inherited' })];
  for (const item of invalid) { assert.equal(loaded._validTopsectionsItem(item), false); assert.equal(count(render({ settings: { items: [item] } })), 0); }
  for (const item of [{ title: 'T' }, { title: ' T ', url: '', unknown: null }, { title: 'T', summary: 42 }, Object.assign(Object.create(null), { title: 'T' }), { title: 'T', [symbol]: 'inert' }]) assert.equal(loaded._validTopsectionsItem(item), true);
  assert.equal(calls, 0);
  assert.throws(() => normalizeParamValues(descriptor.params, { items: [{ title: 'T', [symbol]: 'inert' }] }), /JSON/);
});
registerCase('filter precedes original slice and unsafe/missing links become # without stored row edits', () => {
  const stored = [null, {}, { title: 'Unsafe', url: '//unsafe.invalid' }, ...rows]; const before = JSON.stringify(stored);
  const html = render({ settings: { items: stored, itemLimit: 2 } });
  assert.equal(count(html), 2); assert.match(html, /href="#">Unsafe/); assert.match(html, /A &amp;/); assert.equal(JSON.stringify(stored), before);
  for (const item of [{ title: 'T' }, { title: 'T', url: '' }, { title: 'T', url: '/%252funsafe' }, { title: 'T', url: 'javascript:x' }]) assert.match(render({ settings: { items: [item] } }), /href="#"/);
});
registerCase('scoped CSS changes only grid minimum, root wrapping and li min-width; original declarations retained', () => {
  assert.equal(sha256(Buffer.from(CSS_SOURCE)), TOPSECTIONS_CSS_ANCHORS[1]);
  assert.match(CSS_SOURCE, /\.camap-sd ul\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(14rem,1fr\)\)/);
  const patched = overlay.files.get(TOPSECTIONS_CSS_PATH).toString();
  assert.match(patched, /repeat\(auto-fit,minmax\(min\(14rem,100%\),1fr\)\)/);
  assert.match(patched, /\.camap-sd\{overflow-wrap:anywhere\}\.camap-sd li\{min-width:0\}\n$/);
  assert.equal(patched.replace('minmax(min(14rem,100%),1fr)', 'minmax(14rem,1fr)').replace('.camap-sd{overflow-wrap:anywhere}.camap-sd li{min-width:0}\n', ''), CSS_SOURCE);
  assert.doesNotMatch(patched, /@import|url\(|border-radius|:root|body/);
  assert.equal((patched.match(/\.camap-sd/g) ?? []).length, 6);
});
registerCase('unrelated admin edit preserves stored invalid rows and own unknown settings byte-exactly', async () => {
  const settingsJson = '{"title":"T","items":[null,{"title":""},{"title":"T","url":"//unsafe.invalid"}],"itemLimit":0,"future":{"keep":[true]},"__proto__":{"preserved":true}}';
  let record = { id: 101, title: 'Local', extensionKey: KEY, position: 'main-top', ordering: 2, enabled: true, scopeKind: 'All', assignment: 'all', assignmentJson: '[]', settingsJson, etag: 'local-etag' };
  const writes = [];
  const service = createAdminService({ moduleInstances: { async findMany() { return { items: [structuredClone(record)] }; }, async findById() { return structuredClone(record); }, async update(id, patch) { writes.push(patch); record = { ...record, ...patch }; return structuredClone(record); } }, extensions: { async findMany() { return { items: [{ key: KEY, type: 'Module', enabled: true, manifestJson: descriptor.manifestJson }] }; } } });
  render({ settings: JSON.parse(settingsJson) }); await service.moduleInstances.update(101, { enabled: false }, { etag: 'local-etag' });
  assert.equal(record.settingsJson, settingsJson); assert.equal(writes.length, 1); assert.equal(Object.hasOwn(writes[0], 'settingsJson'), false);
  const normalized = normalizeParamValues(descriptor.params, parseJsonObject(settingsJson, { strict: true }), { keepUndeclared: true });
  assert.deepEqual(normalized.items, JSON.parse(settingsJson).items); assert.deepEqual(normalized.future, { keep: [true] }); assert.equal(Object.hasOwn(normalized, '__proto__'), true);
  assert.equal(record.position, 'main-top'); assert.equal(record.ordering, 2);
});
registerCase('closed CLI/options refuse arbitrary profiles/code, versions/modules and unsafe overlapping paths', async () => {
  const base = ['--base', '/offline/topsections/0.3.0', '--output', 'tmp/topsections-adapt-agent-portable'];
  assert.equal(parseTopsectionsAdaptationArgs(base).dependenciesRoot, 'tmp/step2/camap-source');
  for (const module of ['all', 'mod_camap_editorial', 'mod_camap_corpmessage']) assert.throws(() => parseTopsectionsAdaptationArgs([...base, '--module', module]));
  for (const version of ['0.2.0', '0.3.2', '01.3.0']) assert.throws(() => parseTopsectionsAdaptationArgs([...base, '--version', version]));
  for (const output of ['public/package', 'tmp/editorial-adapt-old', 'tmp/topsections-adapt-agent-x/../y', 'tmp/topsections-adapt-agent-x/con', 'tmp/topsections-adapt-agent-x/aux.']) assert.throws(() => parseTopsectionsAdaptationArgs(['--base', '/local', '--output', output]));
  for (const extra of [['--source', '../other'], ['--source', 'tmp/step2/camap-source'], ['--source', 'tmp/topsections-adapt-agent-portable/source'], ['--dependencies-root', '../other'], ['--inherited-license', '../other-LICENSE'], ['--inherited-license', 'tmp/topsections-adapt-agent-portable/LICENSE'], ['--profile', 'arbitrary'], ['--patches', 'evil'], ['--base', '/duplicate']]) assert.throws(() => parseTopsectionsAdaptationArgs([...base, ...extra]));
  assert.throws(() => parseTopsectionsAdaptationArgs(['--output', base[3]])); assert.deepEqual(parseTopsectionsAdaptationArgs(['--help']), { help: true });
  let calls = 0; await assert.rejects(prepareTopsectionsAdaptation(Object.defineProperty({}, 'base', { get() { calls++; throw Error('getter'); } })), /accessor/);
  await assert.rejects(prepareTopsectionsAdaptation({ ...parseTopsectionsAdaptationArgs(base), hashes: {} }), /Unknown/); assert.equal(calls, 0);
});
registerCase('positive finalizer: exact 5 runtime/13 total/11 payloads, full notices, false flags, reproducible versions', () => {
  const hashes = [];
  for (const version of ['0.3.0', '0.3.1']) {
    const final = finalizeTopsectionsPackage(stagedFixture(version), provenance());
    assert.equal(final.files.size, 13); assert.equal(final.inventory.files.length, 11); assert.equal(final.adaptation.changes.length, 3);
    assert.equal(final.adaptation.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length, 3);
    assert.equal(final.adaptation.cssModified, true); assert.equal(final.adaptation.vendorLicenseAssigned, false);
    assert.deepEqual(final.files.get(INHERITED_LICENSE_PATH), mit); assert.deepEqual(final.files.get(CHANGES_LICENSE_PATH), gpl);
    assert.equal(final.adaptation.adoptionApi.sha256, TOPSECTIONS_API_SHA256); assert.equal(final.adaptation.generator.algorithmModified, false);
    for (const flag of FLAGS) { assert.equal(final.adaptation[flag], false); assert.equal(final.adoptionPlan[flag], false); }
    for (const entry of final.inventory.files) { assert.equal(entry.bytes, final.files.get(entry.path).length); assert.equal(entry.sha256, sha256(final.files.get(entry.path))); }
    const invBytes = final.files.get('MANIFEST-SHA256.json'); assert.equal(final.hostConfig.joomlaDiscoveryRoots[0].inventoryHash, sha256(invBytes));
    assert.deepEqual(invBytes, finalizeTopsectionsPackage(stagedFixture(version), provenance()).files.get('MANIFEST-SHA256.json'));
    hashes.push(sha256(invBytes));
  }
  assert.notEqual(hashes[0], hashes[1]);
});
registerCase('finalizer fail closed: inventoried extras, forged hashes, accessors/functions and closed metadata', () => {
  const changedXml = stagedFixture();
  changedXml.set(XML, Buffer.from(changedXml.get(XML).toString().replace('name="title"', 'name="title" maxlength="1"')));
  rebuildInventory(changedXml);
  assert.throws(() => finalizeTopsectionsPackage(changedXml, provenance()), /identity\/closure\/labels/, 'correct inventory cannot authorize new XML constraints');
  for (const path of ['modules/mod_forum/x.js', `modules/${ELEMENT}/extra.js`, `libraries/camap/${TOPSECTIONS_CSS_PATH}`, `libraries/camap/extensions/camap/${ELEMENT}/extra.js`, 'libraries/camap/extensions/camap/_shared/foreign.js', 'foreign.json', 'docs/foreign.md', 'LICENSE', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) {
    const staged = stagedFixture(); staged.set(path, Buffer.from('inventoried foreign bytes')); rebuildInventory(staged); assert.throws(() => finalizeTopsectionsPackage(staged, provenance()), /allowlist/);
  }
  for (const path of [ENTRY, XML, CSS, LIB, SHARED, 'docs/ADOPTION-NOTICE.md', 'host-config.json']) { const staged = stagedFixture(); staged.delete(path); assert.throws(() => finalizeTopsectionsPackage(staged, provenance()), /mandatory/); }
  const stale = stagedFixture(); stale.set(CSS, Buffer.from('stale')); assert.throws(() => finalizeTopsectionsPackage(stale, provenance()), /integrity/);
  const forged = stagedFixture(); forged.set(LIB, Buffer.from('export default {};\n')); rebuildInventory(forged);
  const forgedP = provenance(); forgedP.changes[1].generatedSha256 = sha256(forged.get(LIB)); assert.throws(() => finalizeTopsectionsPackage(forged, forgedP), /approved patch/);
  for (const patch of [{ changes: [] }, { generatorSha256: '0'.repeat(64) }, { adoptionApiSha256: '1'.repeat(64) }, { snapshot: [] }, { inheritedLicenseBytes: Buffer.from('MIT') }, { inheritedLicense: { ...provenance().inheritedLicense, scope: ['all vendor'] } }, { changesLicenseBytes: Buffer.from('GPL') }, { changesLicenseSource: { ...provenance().changesLicenseSource, scope: 'all vendor' } }, { arbitrary: true }]) assert.throws(() => finalizeTopsectionsPackage(stagedFixture(), { ...provenance(), ...patch }));
  for (const [path, mutate] of [['host-config.json', config => { config.arbitrary = true; }], ['host-config.json', config => { config.joomlaDiscoveryRoots[0].discover = false; }], ['host-config.json', config => { config.moduleStyles[KEY].push('/foreign.css'); }], ['adoption-plan.json', plan => { plan.hostConfigured = true; }], ['adoption-plan.json', plan => { plan.arbitrary = 'code'; }]]) {
    const staged = stagedFixture(); modifyControl(staged, path, mutate); if (path === 'adoption-plan.json') rebuildInventory(staged); assert.throws(() => finalizeTopsectionsPackage(staged, provenance()));
  }
  const staged = stagedFixture(); modifyControl(staged, 'MANIFEST-SHA256.json', inv => { inv.files[0].unexpected = true; }); assert.throws(() => finalizeTopsectionsPackage(staged, provenance()), /Closed/);
  let calls = 0; const accessor = Object.defineProperty(provenance(), 'changes', { get() { calls++; throw Error('getter'); } }); assert.throws(() => finalizeTopsectionsPackage(stagedFixture(), accessor), /accessor/);
  const functionP = provenance(); functionP.snapshot[0].toJSON = () => { calls++; }; assert.throws(() => finalizeTopsectionsPackage(stagedFixture(), functionP), /plain metadata/); assert.equal(calls, 0);
});

/** Explicit read-only package audit: file ports/XML parser, never package JS. */
export async function auditTopsectionsAdaptationPackage(directory, version) {
  const root = resolve(PROJECT, directory);
  const output = relative(PROJECT, root).replaceAll('\\', '/');
  parseTopsectionsAdaptationArgs(['--base', `/offline/topsections/${version}`, '--version', version, '--output', output]);
  const files = await readAdaptationFiles(root);
  const invBytes = files.get('MANIFEST-SHA256.json'); const inventory = JSON.parse(invBytes);
  assert.equal(inventory.version, version); assert.equal(inventory.files.length, 11); assert.equal(files.size, 13);
  for (const entry of inventory.files) { assert.equal(files.get(entry.path).length, entry.bytes); assert.equal(sha256(files.get(entry.path)), entry.sha256); }
  assert.deepEqual([...files.keys()].sort(), [...inventory.files.map(entry => entry.path), 'MANIFEST-SHA256.json', 'host-config.json'].sort());
  assert.deepEqual(files.get(LIB), overlay.files.get(TOPSECTIONS_SOURCE_PATH)); assert.deepEqual(files.get(SHARED), overlay.files.get(SHARED_SOURCE_PATH)); assert.deepEqual(files.get(CSS), overlay.files.get(TOPSECTIONS_CSS_PATH)); assert.deepEqual(files.get(XML), fixtureXml(version));
  const a = JSON.parse(files.get('ADAPTATION.json')); const plan = JSON.parse(files.get('adoption-plan.json')); const config = JSON.parse(files.get('host-config.json'));
  assert.equal(a.cssModified, true); assert.equal(a.vendorLicenseAssigned, false); assert.equal(a.generator.algorithmModified, false); assert.equal(a.adoptionApi.byteIdenticalRelocation, true);
  assert.equal(a.generator.path, 'tools/prepare-joomla-modules.js'); assert.equal(a.adoptionApi.path, 'scripts/prepare-module-adoption.js');
  assert.equal(a.adoptionApi.sha256, sha256(await readFile(join(PROJECT, a.adoptionApi.path)))); assert.equal(a.adoptionApi.sha256, TOPSECTIONS_API_SHA256);
  assert.equal(a.generator.sha256, sha256(await readFile(join(PROJECT, '..', 'CAMAP2', a.generator.path))));
  assert.equal(a.inheritedLicenseSource.originCommit, ADAPTATION_ORIGIN_COMMIT); assert.ok(ADAPTATION_MIT_HASHES.includes(sha256(files.get(INHERITED_LICENSE_PATH)))); assert.deepEqual(files.get(CHANGES_LICENSE_PATH), gpl);
  assert.equal(a.changes.length, 3); assert.equal(a.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length, 3);
  for (const flag of FLAGS) { assert.equal(plan[flag], false); assert.equal(a[flag], false); }
  assert.equal(plan.sourceRootLicensePresent, false); assert.equal(plan.sourceLicensePresent, true); assert.deepEqual(plan.licenses, [INHERITED_LICENSE_PATH]);
  const p = { changes: a.changes, licenses: a.originalLicenses, snapshot: a.snapshot, inheritedLicense: a.inheritedLicenseSource, inheritedLicenseBytes: files.get(INHERITED_LICENSE_PATH), changesLicenseSource: a.changesLicenseSource, changesLicenseBytes: files.get(CHANGES_LICENSE_PATH), generatorSha256: a.generator.sha256, adoptionApiSha256: a.adoptionApi.sha256 };
  const staged = new Map(files); for (const path of ['ADAPTATION.json', 'docs/ADAPTATION-NOTICE.md', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) staged.delete(path);
  const oldPlan = { ...plan }; for (const key of ['adaptation', 'inheritedLicenseSource', 'changesLicenseSource', 'sourceRootLicensePresent']) delete oldPlan[key]; oldPlan.licenses = []; oldPlan.sourceLicensePresent = false;
  staged.set('adoption-plan.json', json(oldPlan));
  // Preserve original generator control-key order as well as caller's base.
  staged.set('MANIFEST-SHA256.json', json({ ...inventory, files: [...staged].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) }));
  const oldConfig = structuredClone(config); oldConfig.joomlaDiscoveryRoots[0].inventoryHash = sha256(staged.get('MANIFEST-SHA256.json')); staged.set('host-config.json', json(oldConfig));
  const final = finalizeTopsectionsPackage(staged, p); assert.deepEqual(final.files.get('MANIFEST-SHA256.json'), invBytes); assert.deepEqual(final.files.get('host-config.json'), files.get('host-config.json'));
  // Only closed, validated provenance paths may access the original checkout.
  for (const entry of a.snapshot) { const bytes = await readFile(join(PROJECT, '..', 'CAMAP2', entry.path)); assert.equal(entry.originalSha256, sha256(bytes), `actual original ${entry.path}`); assert.equal(entry.bytes, bytes.length); }
  const patched = applyTopsectionsOverlay(new Map(await Promise.all(Object.keys(TOPSECTIONS_ANCHORS).map(async path => [path, await readFile(join(PROJECT, '..', 'CAMAP2', path))]))));
  for (const change of a.changes) assert.deepEqual(change, patched.changes.find(item => item.path === change.path));
  const parsed = parseJoomlaManifest(files.get(XML), { baseUrl: plan.base, manifestPath: XML }); validateAdoptionSchema(parsed, loaded);
  const filePort = { async listFolders() { return { value: [{ Name: ELEMENT }] }; }, async downloadFile({ folderPath, fileName }) { const path = [folderPath, fileName].filter(Boolean).join('/'); assert.ok(files.has(path)); return Buffer.from(files.get(path)); } };
  const service = createJoomlaDiscoveryService({ roots: [{ ...config.joomlaDiscoveryRoots[0], files: filePort }] }); const discovered = await service.scan(); assert.equal(discovered.length, 1); await service.verify(discovered[0]);
  assert.equal(config.joomlaDiscoveryRoots[0].inventoryHash, sha256(invBytes)); assert.deepEqual(config.moduleStyleRevisions[KEY][parsed.entryPointUrl], [`${plan.base}/${CSS}`]);
  assert.doesNotMatch(JSON.stringify(a), /C:\\|@|README/);
  return { version, patches: 3, cssModified: true, inventoriedFiles: inventory.files.length, totalFiles: files.size, inventoryHash: sha256(invBytes), browserValidated: false, publicationApproved: false, rightsApproved: false };
}

/** Custom runner: thirteen sequential awaited cases; import schedules nothing. */
export async function runTopsectionsAdaptationTests() {
  assert.equal(cases.length, 13); for (const { run } of cases) await run();
  console.log('ok - topsections adaptation: 13 portable cases; three pinned patches, URL/row/schema/limits/CSS/notices/integrity and preserved settings');
  return { suite: 'topsections-adaptation', tests: cases.length, passed: cases.length, mode: 'portable-pinned-source', browserValidated: false, publicationApproved: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { test } = await import('node:test');
  for (const { name, run } of cases) test(name, run);
  const cli = process.argv.slice(2);
  if (cli.includes('--local-build')) {
    test('explicit local build: two fresh revisions, file-port audits, trusted closure and unchanged inputs', async () => {
      assert.deepEqual(cli, ['--local-build']);
      const source = createAdaptationCollector(); const camap = join(PROJECT, '..', 'CAMAP2');
      await source.add(camap, SHARED_SOURCE_PATH); await source.add(camap, 'tools/prepare-joomla-modules.js'); await source.add(camap, 'package.json');
      for (const { folder } of ADOPTION_MODULES) { const directory = `extensions/camap/${folder}`; for (const entry of await source.list(camap, directory)) if (entry.isFile() && /\.(js|css)$/.test(entry.name)) await source.add(camap, `${directory}/${entry.name}`); }
      const dependencies = await collectAdaptationDependencies(join(PROJECT, 'tmp/step2/camap-source'));
      const require = createRequire(join(PROJECT, 'tmp/step2/camap-source/package.json'));
      const css = require('css-tree');
      const oldAst = css.parse(CSS_SOURCE, { positions: false });
      const newAst = css.parse(overlay.files.get(TOPSECTIONS_CSS_PATH).toString(), { positions: false });
      let gridRules = 0;
      css.walk(oldAst, node => { if (node.type === 'Declaration' && node.property === 'grid-template-columns') { gridRules++; node.value = css.parse('repeat(auto-fit,minmax(min(14rem,100%),1fr))', { context: 'value' }); } });
      const sizingAst = css.parse('.camap-sd{overflow-wrap:anywhere}.camap-sd li{min-width:0}', { positions: false });
      oldAst.children.appendList(sizingAst.children);
      assert.equal(gridRules, 1); assert.equal(css.generate(oldAst), css.generate(newAst), 'real CSS AST: only grid sizing plus approved root wrapping/li min-width');
      const api = createAdaptationCollector(); for (const path of ADAPTATION_API_FILES) await api.add(PROJECT, path); await api.add(PROJECT, CHANGES_LICENSE_PATH);
      const originalMit = await readFile(join(PROJECT, '..', 'LICENSE'));
      const container = await mkdtemp(join(PROJECT, 'tmp/topsections-adapt-agent-tests-')); const receipts = []; const params = [];
      for (const version of ['0.3.0', '0.3.1']) {
        const output = `${relative(PROJECT, container).replaceAll('\\', '/')}/${version}`; const options = { version, base: `/offline/topsections/${version}`, output };
        const built = await prepareTopsectionsAdaptation(options); receipts.push({ ...await auditTopsectionsAdaptationPackage(output, version), sourceFiles: built.originalSourceFiles, dependencyFiles: built.dependencyFiles }); params.push(built.descriptor.params);
        await assert.rejects(prepareTopsectionsAdaptation(options), /existing output/);
        await assert.rejects(prepareTopsectionsAdaptation({ ...options, sourceRoot: built.snapshot, output: `${output}-override-rejected` }), /trusted CAMAP copy/);
      }
      await Promise.all([source.check(), dependencies.check(), api.check()]); assert.deepEqual(await readFile(join(PROJECT, '..', 'LICENSE')), originalMit); assert.deepEqual(params[0], params[1]); assert.notEqual(receipts[0].inventoryHash, receipts[1].inventoryHash);
      console.log(JSON.stringify({ output: container, receipts }, null, 2));
    });
  } else if (cli.length) {
    test('explicit read-only package audits', async () => { assert.equal(cli.length, 3); assert.equal(cli[0], '--packages'); for (let i = 0; i < 2; i++) console.log(JSON.stringify(await auditTopsectionsAdaptationPackage(cli[i + 1], ['0.3.0', '0.3.1'][i]))); });
  }
}
