/* SPDX-License-Identifier: GPL-2.0-or-later
 * Portable pinned-source tests. No checkout, parser install, browser or writes
 * by default. --local-build explicitly enables two new offline tmp packages.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  applyHighlightsOverlay, finalizeHighlightsPackage, prepareHighlightsAdaptation,
  parseHighlightsAdaptationArgs, HIGHLIGHTS_ANCHORS, HIGHLIGHTS_CSS_ANCHORS,
  HIGHLIGHTS_SOURCE_PATH, HIGHLIGHTS_CSS_PATH, SHARED_SOURCE_PATH,
  VALID_HIGHLIGHTS_ITEM_SOURCE, sha256, INHERITED_LICENSE_PATH,
  CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256
} from '../scripts/prepare-highlights-adaptation.js';
import { SAFE_URL_SOURCE, readAdaptationFiles, ADAPTATION_API_FILES, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES, ADAPTATION_ORIGIN_COMMIT } from '../scripts/prepare-editorial-adaptation.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { validateAdoptionSchema } from '../scripts/prepare-module-adoption.js';
import { normalizeParamValues, parseJsonObject } from '../src/libraries/minijoomla/application/declared-params.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELEMENT = 'mod_camap_highlights';
const KEY = `camap.${ELEMENT}`;
const LIB = `libraries/camap/${HIGHLIGHTS_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${ELEMENT}/css/highlights.css`;
const ENTRY = `modules/${ELEMENT}/${ELEMENT}.js`;
const XML = `modules/${ELEMENT}/${ELEMENT}.xml`;
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const lf = bytes => Buffer.from(bytes.toString().replace(/\r\n?/g, '\n'));
const cases = [];
const registerCase = (name, run) => cases.push({ name, run });

// Actual tiny source graph, verbatim LF bytes including BOM and trailing lines.
// Full-byte anchors are checked BEFORE any data-URI import. Not a fake parser.
const MODULE_SOURCE = [
  "import { escapeHtml, safeUrl, stateMessage } from '../_shared/render.js';",
  "export const settingsSchema = Object.freeze({ version: 1, fields: { title: { type: 'string' }, layout: { type: 'enum', values: ['horizontal','vertical','auto'] }, items: { type: 'array' } } });",
  "export const defaults = Object.freeze({ title: '', layout: 'auto', items: [] });",
  'export default { name: \'camap.mod_camap_highlights\', settings: defaults, settingsSchema, render: ({ settings = {}, width = 0, state = \'ready\' } = {}) => { const c = { ...defaults, ...settings }; const status = stateMessage(state); if (status) return status; const layout = c.layout === \'auto\' ? (Number(width) >= 760 ? \'horizontal\' : \'vertical\') : c.layout; return `<section class="camap-highlights camap-highlights--${escapeHtml(layout)}"><h2>${escapeHtml(c.title)}</h2>${(Array.isArray(c.items) ? c.items : []).map(i => `<article><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.description ?? \'\')}</p>${i.url ? `<a href="${escapeHtml(safeUrl(i.url))}">Saiba mais</a>` : \'\'}</article>`).join(\'\')}</section>`; } };',
  '', '', ''
].join('\n');
const SHARED_SOURCE = '\uFEFF' + [
  "export function escapeHtml(value = '') { return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }",
  "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }",
  "export function stateMessage(state, empty = 'Nenhum conteúdo disponível.') { if (state === 'loading') return '<p role=\"status\" aria-live=\"polite\">Carregando…</p>'; if (state === 'error') return '<p role=\"alert\">Não foi possível carregar este módulo.</p>'; if (state === 'empty') return `<p role=\"status\">${escapeHtml(empty)}</p>`; return ''; }", ''
].join('\n');
const CSS_SOURCE = '\uFEFF.camap-dt1{padding:1rem 0}.camap-dt1 article{border-left:.25rem solid #006298;padding:1rem}.camap-dt1--horizontal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:700px){.camap-dt1--horizontal{grid-template-columns:1fr}}\n';
const originals = new Map([[SHARED_SOURCE_PATH, Buffer.from(SHARED_SOURCE)], [HIGHLIGHTS_SOURCE_PATH, Buffer.from(MODULE_SOURCE)], [HIGHLIGHTS_CSS_PATH, Buffer.from(CSS_SOURCE)]]);
for (const [path, bytes] of originals) assert.equal(sha256(bytes), HIGHLIGHTS_ANCHORS[path][1]);
const overlay = applyHighlightsOverlay(originals);
const shared = await import(dataUrl(overlay.files.get(SHARED_SOURCE_PATH)));
function moduleUrl(files) {
  const source = files.get(HIGHLIGHTS_SOURCE_PATH).toString();
  const anchor = "from '../_shared/render.js';";
  assert.equal(source.split(anchor).length, 2);
  return dataUrl(source.replace(anchor, () => `from '${dataUrl(files.get(SHARED_SOURCE_PATH))}';`));
}
const loaded = await import(moduleUrl(overlay.files));
const prior = await import(moduleUrl(originals));
const render = loaded.default.render;
const rows = [{ title: 'A & <B>', description: 'Texto "local"', url: '#/article/a' }, { title: 'B', description: null, url: '/local/b' }, { title: 'C', url: 'https://example.invalid/c' }, { title: 'D' }];
const count = html => (html.match(/<article\b/g) ?? []).length;

function fixtureXml(version) {
  return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="${KEY}">
  <name>CAMAP Highlights</name>
  <version>${version}</version>
  <description>CAMAP Highlights JavaScript module for MiniJoomla.</description>
  <files>
    <filename module="${ELEMENT}">${ELEMENT}.js</filename>
  </files>
  <media destination="${ELEMENT}" folder="media">
    <filename>css/highlights.css</filename>
  </media>
  <config>
    <fields name="params">
      <fieldset name="basic">
        <field name="title" label="title" default="" type="text" />
        <field name="layout" label="layout" default="auto" type="list">
          <option value="horizontal">horizontal</option>
          <option value="vertical">vertical</option>
          <option value="auto">auto</option>
        </field>
        <field name="items" label="items" default="[]" type="textarea" mj:type="json" mj:valueType="array" />
      </fieldset>
    </fields>
  </config>
</extension>
`);
}
const descriptor = parseJoomlaManifest(fixtureXml('0.3.0'), { baseUrl: '/offline/highlights/0.3.0', manifestPath: XML });
// Complete original notice is test DATA, not an invented replacement grant.
const mit = Buffer.from(`MIT License

Copyright (c) 2026 Rinaldo Paulino de Souza

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`);
assert.equal(sha256(mit), ADAPTATION_MIT_HASHES[1]);
const gpl = await readFile(join(PROJECT, CHANGES_LICENSE_PATH));
assert.equal(sha256(gpl), CHANGES_LICENSE_SHA256);
function provenance() {
  return { changes: structuredClone(overlay.changes), licenses: [], generatorSha256: ADAPTATION_GENERATOR_HASHES[0], adoptionApiSha256: '1'.repeat(64),
    snapshot: [...originals].map(([path, bytes]) => ({ path, originalSha256: sha256(bytes), snapshotSha256: sha256(overlay.files.get(path)), bytes: bytes.length })),
    inheritedLicenseBytes: mit, inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: [HIGHLIGHTS_SOURCE_PATH, SHARED_SOURCE_PATH, HIGHLIGHTS_CSS_PATH], globalVendorRightsApproved: false },
    changesLicenseBytes: gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' } };
}
function rebuildInventory(files, version = '0.3.0') {
  const inv = json({ format: 'minijoomla-joomla-package-v1', version, moduleKeys: { [ELEMENT]: KEY }, moduleStyles: { [KEY]: [CSS] }, files: [...files].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) });
  files.set('MANIFEST-SHA256.json', inv);
  const base = `/offline/highlights/${version}`;
  files.set('host-config.json', json({ joomlaDiscoveryRoots: [{ id: `highlights-${version}`, baseUrl: base, inventoryHash: sha256(inv), immutable: true, discover: true }], moduleStyles: { [KEY]: [`${base}/${CSS}`] }, moduleStyleRevisions: { [KEY]: { [`${base}/${ENTRY}`]: [`${base}/${CSS}`] } } }));
  return files;
}
function stagedFixture(version = '0.3.0') {
  return rebuildInventory(new Map([[LIB, overlay.files.get(HIGHLIGHTS_SOURCE_PATH)], [SHARED, overlay.files.get(SHARED_SOURCE_PATH)], [CSS, overlay.files.get(HIGHLIGHTS_CSS_PATH)], [ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`)], [XML, fixtureXml(version)], ['docs/ADOPTION-NOTICE.md', Buffer.from('Offline fixture\n')], ['adoption-plan.json', json({ module: ELEMENT, key: KEY, version, base: `/offline/highlights/${version}`, licenses: [], sourceLicensePresent: false })]]), version);
}

registerCase('three exact patches preserve BOM/mixed EOL and source bytes; shared URL overlay is reused', () => {
  assert.equal(overlay.files.size, 3);
  const raw = new Map([...originals].map(([path, bytes]) => [path, Buffer.from(bytes.toString().replace(/\n+$/, end => end.replace(/\n/g, '\r\n')))]));
  const rawOverlay = applyHighlightsOverlay(raw);
  for (const change of rawOverlay.changes) {
    assert.equal(change.originalSha256, HIGHLIGHTS_ANCHORS[change.path][0]);
    assert.equal(change.generatedSha256, sha256(overlay.files.get(change.path)));
    assert.equal(change.bom, change.path !== HIGHLIGHTS_SOURCE_PATH);
    assert.equal(change.lineEndings, change.path === HIGHLIGHTS_CSS_PATH ? 'CRLF' : 'mixed LF/CRLF preserved');
  }
  const adapted = overlay.files.get(HIGHLIGHTS_SOURCE_PATH).toString();
  assert.equal(adapted.replace(VALID_HIGHLIGHTS_ITEM_SOURCE + '\n', '').replace('.filter(_validHighlightsItem)', ''), MODULE_SOURCE);
  assert.equal(overlay.files.get(SHARED_SOURCE_PATH).toString().replace(SAFE_URL_SOURCE, SHARED_SOURCE.split('\n')[1]), SHARED_SOURCE);
  assert.equal(overlay.files.get(HIGHLIGHTS_CSS_PATH).toString().replace('.camap-highlights--horizontal>h2{grid-column:1/-1}\n', '').replaceAll('.camap-highlights', '.camap-dt1'), CSS_SOURCE);
  for (const [path, bytes] of originals) assert.equal(sha256(bytes), HIGHLIGHTS_ANCHORS[path][1]);
});

registerCase('tampered/unapproved source and wider patch sets are rejected before execution', () => {
  for (const [path, bytes] of originals) {
    const altered = new Map(originals); altered.set(path, Buffer.concat([bytes, Buffer.from('// altered')]));
    assert.throws(() => applyHighlightsOverlay(altered), /Unapproved original SHA-256/);
  }
  assert.throws(() => applyHighlightsOverlay(new Map()), /exactly the three/);
  assert.throws(() => applyHighlightsOverlay(new Map([...originals, ['extra.js', Buffer.from('')]])), /exactly/);
});

registerCase('strict URL types and encoded bypasses reject without executing coercion', () => {
  for (const url of ['#', '#/article/a', '/local/a?x=1&y=2', 'https://example.invalid/x', 'HTTPS://EXAMPLE.invalid/a', '/caf%C3%A9']) assert.equal(shared.safeUrl(url), url);
  for (const url of [undefined, null, false, 0, [], {}, '', ' ', 'relative', '?q', 'http://example.invalid', 'javascript:alert(1)', 'data:text/html,x', '//example.invalid', '/\\example.invalid', 'https://u:p@example.invalid', 'https://@example.invalid', 'https:///x', 'https://', 'https://[bad', '/a b', '/a\t', '/a\0', '/a\u007f', '/a\u0085', ' /a', '/a ', '/%2funsafe', '/%5cunsafe', '/%0a', '/%252funsafe', '/%255c', '/%25250a', '/%2525252f', '/bad%', '/bad%zz', '/%20x', '/%C2%A0x']) {
    assert.equal(shared.safeUrl(url), '#', String(url));
    assert.equal(shared.safeUrl(url, '/fallback'), '/fallback');
    assert.equal(shared.safeUrl(url, '//unsafe.invalid'), '#');
  }
  assert.equal(shared.safeUrl({ toString() { throw Error('coercion executed'); } }), '#');
  assert.equal(shared.safeUrl(null, { toString() { throw Error('fallback coerced'); } }), '#');
});

registerCase('schema/key/defaults and three typed XML params stay original', () => {
  assert.deepEqual(loaded.defaults, prior.defaults);
  assert.deepEqual(loaded.settingsSchema, prior.settingsSchema);
  assert.equal(loaded.default.name, KEY);
  assert.equal(loaded.default.settings, loaded.defaults);
  assert.equal(loaded.default.settingsSchema, loaded.settingsSchema);
  validateAdoptionSchema(descriptor, loaded);
  assert.deepEqual(descriptor.params.map(p => [p.name, p.type, p.default, p.valueType]), [['title', 'text', '', undefined], ['layout', 'select', 'auto', undefined], ['items', 'json', [], 'array']]);
  assert.deepEqual(descriptor.params[1].options.map(option => option.value), ['horizontal', 'vertical', 'auto']);
});

registerCase('valid old rendering/escaping/states remains identical; no images/backend', () => {
  for (const state of ['ready', 'loading', 'error', 'empty', 'unknown']) for (const items of [rows, [], undefined]) {
    const context = { settings: { title: 'Título <local>', items }, state };
    assert.equal(render(context), prior.default.render(context));
  }
  assert.equal(render(), prior.default.render());
  const html = render({ settings: { items: rows } });
  assert.match(html, /A &amp; &lt;B&gt;[^]*Texto &quot;local&quot;/);
  assert.doesNotMatch(html, /<img|<iframe|<script|<form/);
  assert.equal(count(html), 4);
  assert.match(render({ state: 'loading' }), /role="status" aria-live="polite"/);
  assert.match(render({ state: 'error' }), /role="alert"/);
});

registerCase('runtime filter rejects non-plain/inherited/accessor/type-invalid rows with zero getters', () => {
  let called = 0;
  const getter = () => { called += 1; throw Error('getter executed'); };
  const invalid = [null, false, 1, 'row', [], {}, { title: '' }, { title: '  ' }, { title: 4 }, { title: 'T', url: null }, { title: 'T', url: undefined }, { title: 'T', url: {} }, { title: 'T', description: 1 }, { title: 'T', description: undefined }, Object.create({ title: 'inherited' }), new Date(), Object.defineProperty({}, 'title', { get: getter }), Object.defineProperty({ title: 'T' }, 'url', { get: getter }), Object.defineProperty({ title: 'T' }, 'description', { get: getter }), Object.defineProperty({ title: 'T' }, 'extra', { get: getter }), Object.defineProperty({ title: 'T' }, Symbol('extra'), { get: getter })];
  for (const item of invalid) {
    assert.equal(loaded._validHighlightsItem(item), false);
    assert.equal(count(render({ settings: { items: [item] } })), 0);
  }
  assert.equal(called, 0);
  for (const item of [{ title: 'T' }, { title: ' T ', url: '', description: null }, Object.assign(Object.create(null), { title: 'T', description: '' })]) assert.equal(loaded._validHighlightsItem(item), true);
  const stored = [null, { title: 'T', url: '//unsafe.invalid' }, {}, ...rows];
  const before = JSON.stringify(stored);
  const html = render({ settings: { items: stored } });
  assert.equal(count(html), 5); assert.match(html, /href="#"/);
  assert.equal(JSON.stringify(stored), before);
});

registerCase('unsafe item links become #; absent/empty URLs preserve no-link behavior', () => {
  for (const url of ['//unsafe.invalid', '/\\unsafe.invalid', 'https://u:p@example.invalid', '/%252funsafe', 'javascript:alert(1)']) assert.match(render({ settings: { items: [{ title: 'T', url }] } }), /href="#"/);
  for (const item of [{ title: 'T' }, { title: 'T', url: '' }]) assert.doesNotMatch(render({ settings: { items: [item] } }), /<a\b/);
});

registerCase('layouts 0/759/760 and scoped CSS alignment/heading retain original declarations/media query', () => {
  for (const layout of ['horizontal', 'vertical', 'auto']) for (const width of [0, 759, 760, '760']) {
    const context = { settings: { items: rows, layout }, width };
    const expected = layout === 'auto' ? Number(width) >= 760 ? 'horizontal' : 'vertical' : layout;
    assert.match(render(context), new RegExp(`camap-highlights--${expected}`));
    assert.equal(render(context), prior.default.render(context));
  }
  assert.match(render({ settings: { layout: 'auto' } }), /camap-highlights--vertical/);
  const css = overlay.files.get(HIGHLIGHTS_CSS_PATH).toString();
  assert.doesNotMatch(css, /camap-dt1/);
  assert.equal((css.match(/\.camap-highlights/g) ?? []).length, 5);
  assert.match(css, /\.camap-highlights--horizontal>h2\{grid-column:1\/-1\}/);
  assert.equal(css.replace('.camap-highlights--horizontal>h2{grid-column:1/-1}\n', '').replaceAll('.camap-highlights', '.camap-dt1'), CSS_SOURCE);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.doesNotMatch(css, /border-radius|url\(|@import|body|:root/);
});

registerCase('unrelated admin edit preserves all stored settings/unknown keys byte-exactly', async () => {
  const settingsJson = JSON.stringify({ title: 'T', layout: 'auto', items: [null, ...rows], future: { keep: [true] } });
  let record = { id: 101, title: 'Local', extensionKey: KEY, position: 'main-top', ordering: 2, enabled: true, scopeKind: 'All', assignment: 'all', assignmentJson: '[]', settingsJson, etag: 'local-etag' };
  const writes = [];
  const service = createAdminService({ moduleInstances: { async findMany() { return { items: [structuredClone(record)] }; }, async findById() { return structuredClone(record); }, async update(id, patch) { writes.push(patch); record = { ...record, ...patch }; return structuredClone(record); } }, extensions: { async findMany() { return { items: [{ key: KEY, type: 'Module', enabled: true, manifestJson: descriptor.manifestJson }] }; } } });
  render({ settings: JSON.parse(settingsJson) });
  await service.moduleInstances.update(101, { enabled: false }, { etag: 'local-etag' });
  assert.equal(record.settingsJson, settingsJson);
  assert.equal(writes.length, 1); assert.equal(Object.hasOwn(writes[0], 'settingsJson'), false);
  const normalized = normalizeParamValues(descriptor.params, parseJsonObject(settingsJson, { strict: true }), { keepUndeclared: true });
  assert.equal(normalized.items[0], null); assert.deepEqual(normalized.future, { keep: [true] });
  assert.equal(record.position, 'main-top'); assert.equal(record.ordering, 2);
});

registerCase('CLI is closed to profiles/code/patches/other modules and unsafe/overlapping paths', async () => {
  const base = ['--base', '/offline/highlights/0.3.0', '--output', 'tmp/highlights-adapt-portable'];
  assert.deepEqual(parseHighlightsAdaptationArgs(base), { base: base[1], output: base[3], module: ELEMENT, version: '0.3.0', dependenciesRoot: 'tmp/step2/camap-source' });
  for (const module of ['all', 'mod_camap_editorial', 'mod_camap_corpmessage', 'mod_forum']) assert.throws(() => parseHighlightsAdaptationArgs([...base, '--module', module]));
  for (const version of ['0.2.0', '0.3.2', '01.3.0']) assert.throws(() => parseHighlightsAdaptationArgs([...base, '--version', version]));
  for (const output of ['public/package', 'tmp/editorial-adapt-old', 'tmp/highlights-adapt-x/../y', 'tmp/highlights-adapt-x/con', 'tmp/highlights-adapt-x/aux.']) assert.throws(() => parseHighlightsAdaptationArgs(['--base', '/local', '--output', output]));
  for (const extra of [['--source', '../other'], ['--source', 'tmp/step2/camap-source'], ['--source', 'tmp/highlights-adapt-portable/source'], ['--dependencies-root', '../other'], ['--inherited-license', '../other-LICENSE'], ['--inherited-license', 'tmp/highlights-adapt-portable/LICENSE'], ['--profile', 'arbitrary'], ['--patches', 'evil'], ['--base', '/duplicate']]) assert.throws(() => parseHighlightsAdaptationArgs([...base, ...extra]));
  assert.throws(() => parseHighlightsAdaptationArgs(['--output', base[3]]));
  assert.deepEqual(parseHighlightsAdaptationArgs(['--help']), { help: true });
  let called = 0;
  const options = Object.defineProperty({}, 'base', { get() { called++; throw Error('getter'); } });
  await assert.rejects(prepareHighlightsAdaptation(options), /accessor/);
  await assert.rejects(prepareHighlightsAdaptation({ ...parseHighlightsAdaptationArgs(base), hashes: {} }), /Unknown/);
  assert.equal(called, 0);
  assert.ok(Object.isFrozen(ADAPTATION_API_FILES));
});

registerCase('positive finalizer retains full notices, exact flags/inventory and reproducible two versions', () => {
  for (const version of ['0.3.0', '0.3.1']) {
    const final = finalizeHighlightsPackage(stagedFixture(version), provenance());
    assert.equal(final.inventory.files.length, 11); assert.equal(final.files.size, 13);
    assert.deepEqual(final.files.get(INHERITED_LICENSE_PATH), mit); assert.deepEqual(final.files.get(CHANGES_LICENSE_PATH), gpl);
    assert.equal(final.adaptation.inheritedLicenseSource.originCommit, ADAPTATION_ORIGIN_COMMIT);
    assert.equal(final.adaptation.vendorLicenseAssigned, false);
    assert.equal(final.adaptation.changes.length, 3);
    assert.equal(final.adaptation.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length, 3);
    for (const flag of ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified']) {
      assert.equal(final.adoptionPlan[flag], false); assert.equal(final.adaptation[flag], false);
    }
    assert.equal(final.adoptionPlan.sourceLicensePresent, true); assert.equal(final.adoptionPlan.sourceRootLicensePresent, false);
    assert.equal(final.hostConfig.joomlaDiscoveryRoots[0].inventoryHash, sha256(final.files.get('MANIFEST-SHA256.json')));
    for (const entry of final.inventory.files) { assert.equal(entry.bytes, final.files.get(entry.path).length); assert.equal(entry.sha256, sha256(final.files.get(entry.path))); }
    assert.deepEqual(final.files.get('MANIFEST-SHA256.json'), finalizeHighlightsPackage(stagedFixture(version), provenance()).files.get('MANIFEST-SHA256.json'));
    assert.doesNotMatch(JSON.stringify(final.adaptation), /C:\\|https?:\/\/|@|README/);
  }
});

registerCase('finalizer rejects inventoried foreign payloads, stale hashes, forged patch and notice scope', () => {
  for (const path of ['modules/mod_forum/extra.js', 'media/mod_forum/css/extra.css', 'libraries/camap/extensions/camap/mod_camap_editorial/module.js', 'libraries/camap/extensions/camap/_shared/foreign.js', 'libraries/camap/extensions/camap/mod_camap_highlights/extra.js', 'foreign.json', 'docs/foreign.md', 'LICENSE', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) {
    const staged = stagedFixture(); staged.set(path, Buffer.from('Inventoried but not authorized\n')); rebuildInventory(staged);
    assert.throws(() => finalizeHighlightsPackage(staged, provenance()), /outside highlights allowlist/, path);
  }
  for (const path of [LIB, SHARED, CSS, ENTRY, XML]) { const staged = stagedFixture(); staged.delete(path); assert.throws(() => finalizeHighlightsPackage(staged, provenance()), /mandatory/); }
  const stale = stagedFixture(); stale.set(CSS, Buffer.from('tampered')); assert.throws(() => finalizeHighlightsPackage(stale, provenance()), /integrity/);
  const forged = stagedFixture(); forged.set(LIB, Buffer.from('export default {};\n')); rebuildInventory(forged);
  const forgedProvenance = provenance(); forgedProvenance.changes[1] = { ...forgedProvenance.changes[1], generatedSha256: sha256(forged.get(LIB)) };
  assert.throws(() => finalizeHighlightsPackage(forged, forgedProvenance), /approved patch/);
  for (const patch of [{ changes: [] }, { generatorSha256: '0'.repeat(64) }, { adoptionApiSha256: undefined }, { snapshot: [] }, { inheritedLicenseBytes: undefined }, { inheritedLicenseBytes: Buffer.from('MIT') }, { inheritedLicense: { ...provenance().inheritedLicense, scope: ['all vendor'] } }, { changesLicenseBytes: Buffer.from('GPL') }, { changesLicenseSource: { ...provenance().changesLicenseSource, scope: 'all vendor' } }]) assert.throws(() => finalizeHighlightsPackage(stagedFixture(), { ...provenance(), ...patch }), /provenance|snapshot|MIT|GPL/i);
});

/** Read-only local file-port audit: JS is not executed; XML uses real parser. */
export async function auditHighlightsAdaptationPackage(directory, version) {
  parseHighlightsAdaptationArgs(['--base', `/offline/highlights/${version}`, '--version', version, '--output', directory]);
  const files = await readAdaptationFiles(resolve(PROJECT, directory));
  const invBytes = files.get('MANIFEST-SHA256.json');
  const inventory = JSON.parse(invBytes);
  assert.equal(inventory.version, version); assert.equal(inventory.files.length, 11); assert.equal(files.size, 13);
  for (const entry of inventory.files) { assert.equal(files.get(entry.path).length, entry.bytes); assert.equal(sha256(files.get(entry.path)), entry.sha256); }
  assert.deepEqual([...files.keys()].sort(), [...inventory.files.map(entry => entry.path), 'MANIFEST-SHA256.json', 'host-config.json'].sort());
  for (const [path, sourcePath] of [[LIB, HIGHLIGHTS_SOURCE_PATH], [SHARED, SHARED_SOURCE_PATH], [CSS, HIGHLIGHTS_CSS_PATH]]) assert.deepEqual(files.get(path), overlay.files.get(sourcePath));
  assert.deepEqual(files.get(XML), fixtureXml(version));
  const adaptation = JSON.parse(files.get('ADAPTATION.json'));
  const plan = JSON.parse(files.get('adoption-plan.json'));
  const config = JSON.parse(files.get('host-config.json'));
  assert.equal(adaptation.cssModified, true);
  assert.equal(adaptation.inheritedLicenseSource.originCommit, ADAPTATION_ORIGIN_COMMIT);
  assert.equal(adaptation.inheritedLicenseSource.sha256, sha256(files.get(INHERITED_LICENSE_PATH)));
  assert.deepEqual(adaptation.inheritedLicenseSource.scope, [HIGHLIGHTS_SOURCE_PATH, SHARED_SOURCE_PATH, HIGHLIGHTS_CSS_PATH]);
  assert.equal(config.joomlaDiscoveryRoots.length, 1); assert.equal(config.joomlaDiscoveryRoots[0].inventoryHash, sha256(invBytes));
  assert.equal(adaptation.changes.length, 3); assert.equal(adaptation.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length, 3);
  for (const flag of ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified']) { assert.equal(plan[flag], false); assert.equal(adaptation[flag], false); }
  assert.equal(plan.sourceRootLicensePresent, false); assert.equal(plan.sourceLicensePresent, true);
  assert.deepEqual(plan.licenses, [INHERITED_LICENSE_PATH]);
  assert.ok(ADAPTATION_MIT_HASHES.includes(sha256(files.get(INHERITED_LICENSE_PATH))));
  assert.deepEqual(files.get(CHANGES_LICENSE_PATH), gpl);
  const parsed = parseJoomlaManifest(files.get(XML), { baseUrl: plan.base, manifestPath: XML });
  validateAdoptionSchema(parsed, loaded);
  const filePort = { async listFolders() { return { value: [{ Name: ELEMENT }] }; }, async downloadFile({ folderPath, fileName }) { const path = [folderPath, fileName].filter(Boolean).join('/'); assert.ok(files.has(path)); return Buffer.from(files.get(path)); } };
  const service = createJoomlaDiscoveryService({ roots: [{ ...config.joomlaDiscoveryRoots[0], files: filePort }] });
  const discovered = await service.scan(); assert.equal(discovered.length, 1); await service.verify(discovered[0]);
  assert.equal(config.moduleStyles[KEY][0], `${plan.base}/${CSS}`);
  assert.deepEqual(config.moduleStyleRevisions[KEY][parsed.entryPointUrl], config.moduleStyles[KEY]);
  assert.doesNotMatch(JSON.stringify(adaptation), /C:\\|https?:\/\/|@|README/);
  return { version, inventoriedFiles: inventory.files.length, totalFiles: files.size, patches: 3, inventoryHash: sha256(invBytes), browserValidated: false, publicationApproved: false };
}

/** Sequential custom runner; importing does not schedule node:test cases. */
export async function runHighlightsAdaptationTests() {
  assert.equal(cases.length, 12);
  for (const { run } of cases) await run();
  console.log('ok - highlights adaptation: 12 portable cases; three pinned patches, URLs/items/schema/layout/CSS/notices/integrity');
  return { suite: 'highlights-adaptation', tests: cases.length, passed: cases.length, mode: 'portable-pinned-source', browserValidated: false, publicationApproved: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { test } = await import('node:test');
  for (const { name, run } of cases) test(name, run);
  const cli = process.argv.slice(2);
  if (cli.includes('--local-build')) {
    test('explicit offline real parsers/build: two new revisions, source immutability and overwrite refusal', async () => {
      assert.deepEqual(cli, ['--local-build']);
      const originalPaths = [...Object.keys(HIGHLIGHTS_ANCHORS), 'tools/prepare-joomla-modules.js', 'package.json'];
      const before = new Map();
      for (const path of originalPaths) before.set(path, await readFile(join(PROJECT, '..', 'CAMAP2', path)));
      const require = createRequire(join(PROJECT, 'tmp/step2/camap-source/package.json'));
      const css = require('css-tree');
      const oldAst = css.parse(CSS_SOURCE, { positions: false });
      const newAst = css.parse(overlay.files.get(HIGHLIGHTS_CSS_PATH).toString(), { positions: false });
      css.walk(oldAst, node => { if (node.type === 'ClassSelector') node.name = node.name.replace(/^camap-dt1/, 'camap-highlights'); });
      const headingAst = css.parse('.camap-highlights--horizontal>h2{grid-column:1/-1}', { positions: false });
      oldAst.children.appendList(headingAst.children);
      assert.equal(css.generate(oldAst), css.generate(newAst), 'real CSS AST confirms only selector mapping plus scoped heading rule');
      const container = await mkdtemp(join(PROJECT, 'tmp/highlights-adapt-agent-tests-'));
      const receipts = [];
      for (const version of ['0.3.0', '0.3.1']) {
        const output = `${container.slice(PROJECT.length + 1).replaceAll('\\', '/')}/${version}`;
        const options = { version, base: `/offline/highlights/${version}`, output };
        const built = await prepareHighlightsAdaptation(options);
        receipts.push({ ...await auditHighlightsAdaptationPackage(output, version), sourceFiles: built.originalSourceFiles, dependencyFiles: built.dependencyFiles });
        await assert.rejects(prepareHighlightsAdaptation(options), /existing output/);
        await assert.rejects(prepareHighlightsAdaptation({ ...options, sourceRoot: built.snapshot, output: `${output}-override-rejected` }), /not an original CAMAP copy/);
        const staged = await readAdaptationFiles(join(built.stage, 'tmp/prepared'));
        const evidence = { ...built.adaptation, licenses: built.adaptation.originalLicenses, inheritedLicense: built.adaptation.inheritedLicenseSource, inheritedLicenseBytes: built.files.get(INHERITED_LICENSE_PATH), changesLicenseBytes: gpl, generatorSha256: built.adaptation.generator.sha256, adoptionApiSha256: built.adaptation.adoptionApi.sha256 };
        assert.deepEqual(finalizeHighlightsPackage(staged, evidence).files.get('MANIFEST-SHA256.json'), built.files.get('MANIFEST-SHA256.json'));
      }
      for (const [path, bytes] of before) assert.deepEqual(await readFile(join(PROJECT, '..', 'CAMAP2', path)), bytes);
      assert.notEqual(receipts[0].inventoryHash, receipts[1].inventoryHash);
      console.log(JSON.stringify({ output: container, receipts }, null, 2));
    });
  } else if (cli.length) {
    test('explicit package file-port audits', async () => {
      assert.equal(cli.length, 3); assert.equal(cli[0], '--packages');
      for (let i = 0; i < 2; i++) console.log(JSON.stringify(await auditHighlightsAdaptationPackage(cli[i + 1], ['0.3.0', '0.3.1'][i])));
    });
  }
}
