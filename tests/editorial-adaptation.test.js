/* SPDX-License-Identifier: GPL-2.0-or-later
 * Default is portable: only the existing SHA-pinned test fixture is read.
 * No eval, CAMAP checkout, dependency packages, browser, network or writes.
 */
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEditorialOverlay, EDITORIAL_ANCHORS, SHARED_SOURCE_PATH, EDITORIAL_SOURCE_PATH, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256, SAFE_URL_SOURCE, VALID_ITEM_SOURCE, sha256, parseEditorialAdaptationArgs, finalizeEditorialPackage, prepareEditorialAdaptation } from '../scripts/prepare-editorial-adaptation.js';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { validateAdoptionSchema, assertAdoptionNoLinks } from '../scripts/prepare-module-adoption.js';
import { normalizeParamValues, parseJsonObject } from '../src/libraries/minijoomla/application/declared-params.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELEMENT = 'mod_camap_editorial';
const KEY = `camap.${ELEMENT}`;
const LIB = `libraries/camap/${EDITORIAL_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${ELEMENT}/css/db.css`;
const ENTRY = `modules/${ELEMENT}/${ELEMENT}.js`;
const XML = `modules/${ELEMENT}/${ELEMENT}.xml`;
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const dataUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const portableCases = [];
const registerCase = (name, run) => portableCases.push({ name, run });

// Decode string literals as DATA, never import/execute the characterization
// suite. Full-byte source hashes gate every extracted original before imports.
function literal(token) {
  assert.ok(token.length >= 2 && token[0] === token.at(-1));
  let value = '';
  for (let i = 1; i < token.length - 1; i += 1) {
    if (token[i] !== '\\') { value += token[i]; continue; }
    const escaped = token[++i];
    if (escaped === 'u') {
      const code = token.slice(i + 1, i + 5);
      assert.match(code, /^[a-f0-9]{4}$/i);
      value += String.fromCharCode(parseInt(code, 16)); i += 4;
    } else {
      const escapes = { n: '\n', r: '\r', t: '\t', "'": "'", '"': '"', '\\': '\\' };
      assert.ok(Object.hasOwn(escapes, escaped), 'only recognized literal escapes');
      value += escapes[escaped];
    }
  }
  return value;
}

const fixtureText = await readFile(join(PROJECT, 'tests', 'camap-editorial-adoption.test.js'), 'utf8');
assert.ok(Buffer.byteLength(fixtureText) < 64 * 1024);
function originalSource(name) {
  const start = `const ${name} = '\\uFEFF' + [`;
  assert.equal(fixtureText.split(start).length, 2);
  const body = fixtureText.split(start)[1].split("].join('\\n');")[0];
  const tokens = body.match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g);
  assert.ok(tokens);
  assert.match(body.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, ''), /^[,\s]*$/);
  return Buffer.from('\uFEFF' + tokens.map(literal).join('\n'));
}
const originals = new Map([[SHARED_SOURCE_PATH, originalSource('SHARED_SOURCE')], [EDITORIAL_SOURCE_PATH, originalSource('MODULE_SOURCE')]]);
for (const [path, bytes] of originals) assert.equal(sha256(bytes), EDITORIAL_ANCHORS[path][1]);
const overlay = applyEditorialOverlay(originals);
const shared = await import(dataUrl(overlay.files.get(SHARED_SOURCE_PATH)));
function moduleUrl(files) {
  const source = files.get(EDITORIAL_SOURCE_PATH).toString();
  const anchor = "from '../_shared/render.js';";
  assert.equal(source.split(anchor).length, 2);
  // Only the known, fully byte-pinned three-file graph is executed here.
  return dataUrl(source.replace(anchor, () => `from '${dataUrl(files.get(SHARED_SOURCE_PATH))}';`));
}
const loaded = await import(moduleUrl(overlay.files));
const prior = await import(moduleUrl(originals));
const render = loaded.default.render;
const rows = [{ title: 'A & <B>', url: '#/article/a', summary: 'Resumo "local"' }, { title: 'B', url: '/local/b' }, { title: 'C', url: 'https://example.invalid/c' }, { title: 'D' }];
const count = html => (html.match(/<article\b/g) ?? []).length;

function fixtureXml(version) {
  const start = '[XML, bytes(`';
  assert.equal(fixtureText.split(start).length, 2);
  const source = fixtureText.split(start)[1].split('`)]')[0];
  const values = { KEY, ELEMENT, version };
  return Buffer.from(source.replace(/\$\{(KEY|ELEMENT|version)\}/g, (_, key) => values[key]));
}
const cssToken = fixtureText.match(/const CSS_SOURCE = ('(?:\\.|[^'\\])*');/)[1];
const cssBytes = Buffer.from(literal(cssToken));
assert.equal(sha256(cssBytes), '137767308e415745d591665bea090a1e58267646155998e71a6310874fd74fda');
const descriptor = parseJoomlaManifest(fixtureXml('0.3.0'), { baseUrl: '/offline/editorial/0.3.0', manifestPath: XML });
const changesLicenseBytes = await readFile(join(PROJECT, CHANGES_LICENSE_PATH));
assert.equal(sha256(changesLicenseBytes), CHANGES_LICENSE_SHA256, 'exact full GPL text available in portable distribution');
const changesLicenseSource = { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' };

registerCase('exact two-byte overlay, CRLF/BOM preserved, all other exports/metadata unchanged', () => {
  assert.equal(overlay.files.size, 2);
  for (const [path, bytes] of originals) assert.equal(sha256(bytes), EDITORIAL_ANCHORS[path][1], 'input bytes not mutated');
  const raw = new Map([...originals].map(([path, bytes]) => [path, Buffer.from(bytes.toString().replace(/\n+$/, endings => endings.replace(/\n/g, '\r\n')))]));
  const rawOverlay = applyEditorialOverlay(raw);
  for (const change of rawOverlay.changes) {
    assert.equal(change.originalSha256, EDITORIAL_ANCHORS[change.path][0]);
    assert.equal(change.bom, true);
    assert.equal(change.lineEndings, 'mixed LF/CRLF preserved');
    assert.equal(change.generatedSha256, sha256(overlay.files.get(change.path)));
    const patched = rawOverlay.files.get(change.path).toString();
    const reverted = change.path === SHARED_SOURCE_PATH
      ? patched.replace(SAFE_URL_SOURCE, originals.get(change.path).toString().split('\n')[1])
      : patched.replace(VALID_ITEM_SOURCE + '\n', '').replace('.filter(_validEditorialItem)', '');
    assert.equal(reverted, raw.get(change.path).toString(), 'unpatched bytes including original mixed endings preserved');
  }
  for (const path of [SHARED_SOURCE_PATH, EDITORIAL_SOURCE_PATH]) {
    const original = originals.get(path).toString();
    const adapted = overlay.files.get(path).toString();
    assert.equal(adapted[0], '\uFEFF');
    if (path === SHARED_SOURCE_PATH) {
      const lines = original.split('\n');
      assert.ok(adapted.startsWith(lines[0] + '\n'));
      assert.ok(adapted.endsWith('\n' + lines.slice(2).join('\n')));
      assert.ok(adapted.includes(SAFE_URL_SOURCE));
    } else {
      assert.ok(adapted.includes(VALID_ITEM_SOURCE));
      assert.equal(adapted.replace(VALID_ITEM_SOURCE + '\n', '').replace('.filter(_validEditorialItem)', ''), original);
    }
  }
  assert.deepEqual(loaded.defaults, prior.defaults);
  assert.deepEqual(loaded.settingsSchema, prior.settingsSchema);
  validateAdoptionSchema(descriptor, loaded);
  assert.deepEqual(descriptor.params.map(({ name }) => name), ['title', 'limit', 'items', 'catalogTarget']);
  assert.equal(loaded.defaults.catalogTarget, '');
  assert.equal(loaded.defaults.title, 'Destaques');
  assert.equal(loaded.settingsSchema.version, 1);
});

registerCase('unknown/tampered source and wider patch sets fail closed before source execution', () => {
  for (const path of originals.keys()) {
    const tampered = new Map(originals);
    tampered.set(path, Buffer.concat([tampered.get(path), Buffer.from('// unapproved')]));
    assert.throws(() => applyEditorialOverlay(tampered), /Unapproved original SHA-256/);
  }
  assert.throws(() => applyEditorialOverlay(new Map()), /exactly/);
  assert.throws(() => applyEditorialOverlay(new Map([...originals, ['other.js', Buffer.from('')] ])), /exactly/);
});

registerCase('strict URLs retain original safe strings and reject malformed/encoded bypasses with safe fallback', () => {
  for (const url of ['#', '#/article/a', '#javascript:alert(1)', '/local/x?y=1&z=2', 'https://example.invalid/x', 'HTTPS://EXAMPLE.invalid:443/a', 'https://example.invalid/?q="x"&v=1', '/local/caf%C3%A9']) assert.equal(shared.safeUrl(url), url);
  const unsafe = [undefined, null, 42, false, {}, [], '', ' ', 'relative/path', '?query', 'http://example.invalid', 'javascript:alert(1)', 'data:text/html,x', '//untrusted.invalid', '/\\untrusted.invalid', 'https://user:pass@example.invalid', 'https://@example.invalid', 'https:///example.invalid', 'https://', 'https://[invalid', '/x y', '/x\t', '/x\0', '/x\u007f', '/x\u0085', ' /x', '/x ', '/%2funtrusted', '/%5cuntrusted', '/%0a', '/%1f', '/%7f', '/%252funtrusted', '/%255c', '/%25250a', '/%2525252f', '/bad%', '/bad%zz', '/%20x', '/%C2%A0x', 'https://example.invalid/a\\b'];
  for (const url of unsafe) {
    assert.equal(shared.safeUrl(url), '#', String(url));
    assert.equal(shared.safeUrl(url, '/local/fallback'), '/local/fallback');
    assert.equal(shared.safeUrl(url, '//unsafe.invalid'), '#');
    assert.equal(shared.safeUrl(url, { toString() { throw new Error('not called'); } }), '#');
  }
  assert.equal(shared.safeUrl({ toString() { throw new Error('not called'); } }), '#');
});

registerCase('valid render output, escaping, states, markup and historical limit semantics are unchanged', () => {
  for (const limit of [undefined, 0, -1, 1.9, 1, 3, 1000]) {
    const input = { settings: { items: rows, limit, catalogTarget: '#/category/local', title: 'Local <title>' } };
    assert.equal(render(input), prior.default.render(input));
  }
  assert.equal(count(render({ settings: { items: rows, limit: 0 } })), 3);
  assert.equal(count(render({ settings: { items: rows, limit: -1 } })), 0);
  assert.equal(count(render({ settings: { items: rows, limit: 1.9 } })), 1);
  assert.equal(count(render({ settings: { items: Array.from({ length: 105 }, () => rows[0]), limit: 1000 } })), 100);
  for (const state of ['loading', 'error', 'empty', 'unknown']) assert.equal(render({ state, settings: { items: rows } }), prior.default.render({ state, settings: { items: rows } }));
  assert.match(render({ settings: { items: rows } }), /A &amp; &lt;B&gt;[^]*Resumo &quot;local&quot;/);
  assert.equal(render(), prior.default.render());
  assert.match(render({ settings: { items: rows }, showTitle: false, headerTag: 'h4' }), /<h2>Destaques<\/h2>/);
});

registerCase('runtime item filtering rejects invalid/getter rows, never executes getters or edits stored arrays', () => {
  let called = 0;
  const getter = () => { called += 1; throw new Error('getter executed'); };
  const invalid = [null, false, 4, 'row', [], {}, { title: '' }, { title: '  ' }, { title: 4 }, { title: 'T', url: null }, { title: 'T', url: {} }, { title: 'T', summary: 1 }, Object.defineProperty({}, 'title', { get: getter }), Object.defineProperty({ title: 'T' }, 'summary', { get: getter }), Object.defineProperty({ title: 'T' }, 'extra', { get: getter }), Object.create({ get title() { return getter(); } })];
  for (const item of invalid) {
    assert.equal(loaded._validEditorialItem(item), false);
    assert.equal(count(render({ settings: { items: [item] } })), 0);
  }
  assert.equal(called, 0);
  for (const item of [{ title: 'T' }, { title: 'T', url: '', summary: null }, Object.assign(Object.create(null), { title: 'T' })]) assert.equal(loaded._validEditorialItem(item), true);
  const stored = [null, { title: 'T', url: '//unsafe.invalid' }, {}, ...rows];
  const before = JSON.stringify(stored);
  const html = render({ settings: { items: stored, limit: 2 } });
  assert.equal(count(html), 2, 'filter precedes original slice');
  assert.match(html, /href="#"/);
  assert.equal(JSON.stringify(stored), before);
  assert.match(render({ settings: { items: [null] } }), /Nenhum conteúdo disponível/);
});

registerCase('unsafe CTA omitted and item links fall back, while safe links/CTA remain unchanged', () => {
  for (const url of ['//untrusted.invalid', '/\\untrusted.invalid', 'https://user:pass@example.invalid', '/%252funsafe', 'javascript:alert(1)']) {
    const html = render({ settings: { items: [{ title: 'T', url }], catalogTarget: url } });
    assert.match(html, /href="#"/);
    assert.doesNotMatch(html, /Ver todas as publicações/);
  }
  assert.doesNotMatch(render({ settings: { catalogTarget: '#' } }), /Ver todas/);
  assert.match(render({ settings: { catalogTarget: '/local/catalog' } }), /href="\/local\/catalog"[^]*Ver todas/);
});

registerCase('pure admin repository preserves unknown settings and invalid stored rows across unrelated edits', async () => {
  const settingsJson = JSON.stringify({ title: 'T', limit: 3, items: [null, ...rows], catalogTarget: '', future: { keep: [true, { nested: 'unaltered' }] } });
  let record = { id: 101, title: 'Local', extensionKey: KEY, position: 'main-top', ordering: 2, enabled: true, scopeKind: 'All', scopeRoute: '', scopeCategoryAlias: '', assignment: 'all', assignmentJson: '[]', settingsJson, etag: 'local-etag' };
  const writes = [];
  const service = createAdminService({
    moduleInstances: { async findMany() { return { items: [structuredClone(record)] }; }, async findById() { return structuredClone(record); }, async update(id, patch, options) { writes.push({ id, patch, options }); record = { ...record, ...patch }; return structuredClone(record); } },
    extensions: { async findMany() { return { items: [{ key: KEY, type: 'Module', enabled: true, manifestJson: descriptor.manifestJson }] }; } }
  });
  render({ settings: JSON.parse(record.settingsJson) });
  await service.moduleInstances.update(101, { enabled: false }, { etag: 'local-etag' });
  assert.equal(record.settingsJson, settingsJson, 'unrelated admin update is byte-exact');
  assert.equal(writes.length, 1);
  assert.equal(Object.hasOwn(writes[0].patch, 'settingsJson'), false);
  const normalized = normalizeParamValues(descriptor.params, parseJsonObject(settingsJson, { strict: true }), { keepUndeclared: true });
  assert.deepEqual(normalized.future, JSON.parse(settingsJson).future);
  assert.equal(normalized.items[0], null, 'filter is not a persisted-data migration');
  assert.equal(record.position, 'main-top');
  assert.equal(record.ordering, 2);
});

registerCase('CLI refuses all/other modules, stale output namespace, escapes and overlapping inputs', () => {
  const base = ['--base', '/offline/editorial/0.3.0', '--output', 'tmp/editorial-adapt-local'];
  const args = parseEditorialAdaptationArgs(base);
  assert.equal(args.version, '0.3.0');
  assert.equal(args.module, ELEMENT);
  assert.equal(args.dependenciesRoot, 'tmp/step2/camap-source');
  for (const module of ['all', 'mod_camap_corpmessage', 'mod_forum']) assert.throws(() => parseEditorialAdaptationArgs([...base, '--module', module]));
  for (const output of ['public/package', 'tmp/adoption-original', 'tmp/editorial-adapt-x/../x', 'tmp/editorial-adapt-x/con', 'tmp/editorial-adapt-x/aux.']) assert.throws(() => parseEditorialAdaptationArgs(['--base', '/local', '--output', output]));
  assert.throws(() => parseEditorialAdaptationArgs([...base, '--source', '../other']));
  assert.throws(() => parseEditorialAdaptationArgs([...base, '--source', 'tmp/step2/camap-source']), /overlap/);
  assert.throws(() => parseEditorialAdaptationArgs([...base, '--source', 'tmp/editorial-adapt-local/source']), /overlap/);
  assert.throws(() => parseEditorialAdaptationArgs([...base, '--inherited-license', '../unapproved-LICENSE']), /approved aggregator/);
  assert.throws(() => parseEditorialAdaptationArgs([...base, '--version', '01.3.0']));
  assert.throws(() => parseEditorialAdaptationArgs([...base, '--base', '/duplicate']));
  assert.deepEqual(parseEditorialAdaptationArgs(['--help']), { help: true });
});

// A synthetic staged package tests integrity failures without using or
// inventing a vendor license. Missing inherited evidence MUST be rejected.
function stagedFixture() {
  const files = new Map([[LIB, overlay.files.get(EDITORIAL_SOURCE_PATH)], [SHARED, overlay.files.get(SHARED_SOURCE_PATH)], [CSS, cssBytes], [ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`)], [XML, fixtureXml('0.3.0')], ['docs/ADOPTION-NOTICE.md', Buffer.from('Offline fixture\n')], ['adoption-plan.json', json({ module: ELEMENT, version: '0.3.0', base: '/offline/editorial/0.3.0', sourceLicensePresent: false, licenses: [] })]]);
  const inv = json({ format: 'minijoomla-joomla-package-v1', version: '0.3.0', files: [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })), moduleKeys: { [ELEMENT]: KEY }, moduleStyles: { [KEY]: [CSS] } });
  files.set('MANIFEST-SHA256.json', inv);
  files.set('host-config.json', json({ joomlaDiscoveryRoots: [{ baseUrl: '/offline/editorial/0.3.0', inventoryHash: sha256(inv) }] }));
  return files;
}
registerCase('finalizer rejects foreign inventoried payloads, stale hashes, missing runtime and invalid MIT/GPL evidence', () => {
  const provenance = { changes: overlay.changes, licenses: [], changesLicenseBytes, changesLicenseSource, generatorSha256: '79893d6ebdf48beda8fa7632845d9f95f56616a7af33ba9fbdaebeeb1eb15538' };
  assert.throws(() => finalizeEditorialPackage(stagedFixture(), provenance), /inherited MIT/);
  for (const mutate of [files => files.set(CSS, Buffer.from('tampered')), files => files.set('extra.js', Buffer.from('extra')), files => files.set('host-config.json', json({ joomlaDiscoveryRoots: [] }))]) {
    const files = stagedFixture(); mutate(files);
    assert.throws(() => finalizeEditorialPackage(files, provenance), /integrity|Uninventoried|control|allowlist/);
  }
  assert.throws(() => finalizeEditorialPackage(stagedFixture(), { changes: [], licenses: [] }), /provenance/);
  assert.throws(() => finalizeEditorialPackage(stagedFixture(), { ...provenance, changes: [overlay.changes[0], overlay.changes[0]] }), /provenance/);
  assert.throws(() => finalizeEditorialPackage(stagedFixture(), { ...provenance, generatorSha256: '0'.repeat(64) }), /generator provenance/);
  for (const path of ['modules/mod_forum/extra.js', 'media/mod_forum/css/extra.css', 'libraries/camap/extensions/camap/mod_forum/module.js', 'libraries/camap/extensions/camap/_shared/foreign.js', 'foreign.json', 'docs/foreign.md', 'LICENSE', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) {
    const files = stagedFixture();
    const bytes = Buffer.from('correctly inventoried but not authorized\n');
    files.set(path, bytes);
    const inventory = JSON.parse(files.get('MANIFEST-SHA256.json'));
    inventory.files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
    const inventoryBytes = json(inventory);
    files.set('MANIFEST-SHA256.json', inventoryBytes);
    const config = JSON.parse(files.get('host-config.json'));
    config.joomlaDiscoveryRoots[0].inventoryHash = sha256(inventoryBytes);
    files.set('host-config.json', json(config));
    assert.throws(() => finalizeEditorialPackage(files, provenance), /outside editorial allowlist/, path);
  }
  for (const path of [LIB, SHARED, CSS, ENTRY, XML]) {
    const files = stagedFixture(); files.delete(path);
    assert.throws(() => finalizeEditorialPackage(files, provenance), /mandatory editorial runtime/);
  }
  const badWrapper = stagedFixture(); badWrapper.set(ENTRY, Buffer.from('export default {};\n'));
  assert.throws(() => finalizeEditorialPackage(badWrapper, provenance), /wrapper differs/);
  for (const patch of [{ changesLicenseBytes: undefined }, { changesLicenseBytes: Buffer.from('short GPL substitute') }, { changesLicenseSource: { ...changesLicenseSource, scope: 'all CAMAP vendor' } }]) assert.throws(() => finalizeEditorialPackage(stagedFixture(), { ...provenance, ...patch }), /authored changes GPL/);
});

async function exactDiskFiles(root, prefix = '', budget = { entries: 0, bytes: 0 }) {
  const files = new Map();
  await assertAdoptionNoLinks(join(root, prefix));
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    assert.ok(++budget.entries <= 500);
    assert.equal(entry.isSymbolicLink(), false);
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    packagePath(path);
    if (entry.isDirectory()) for (const [name, bytes] of await exactDiskFiles(root, path, budget)) files.set(name, bytes);
    else { assert.equal(entry.isFile(), true); const bytes = await readFile(join(root, path)); assert.ok((budget.bytes += bytes.length) <= 10 * 1024 * 1024); files.set(path, bytes); }
  }
  return files;
}

/** Explicit local file-port audit: never executes package JS or starts browsers. */
export async function auditEditorialAdaptationPackage(directory, version) {
  const root = resolve(PROJECT, directory);
  assert.ok(root.startsWith(join(PROJECT, 'tmp', 'editorial-adapt-')));
  const files = await exactDiskFiles(root);
  const inventoryBytes = files.get('MANIFEST-SHA256.json');
  assert.ok(inventoryBytes.length <= 64 * 1024);
  const inventory = JSON.parse(inventoryBytes);
  assert.equal(inventory.version, version);
  assert.equal(inventory.format, 'minijoomla-joomla-package-v1');
  assert.equal(inventory.files.length, 11);
  assert.equal(files.size, 13);
  for (const entry of inventory.files) { assert.equal(files.get(entry.path).length, entry.bytes); assert.equal(sha256(files.get(entry.path)), entry.sha256); }
  assert.deepEqual([...files.keys()].sort(), [...inventory.files.map(file => file.path), 'MANIFEST-SHA256.json', 'host-config.json'].sort());
  assert.deepEqual(files.get(LIB), overlay.files.get(EDITORIAL_SOURCE_PATH));
  assert.deepEqual(files.get(SHARED), overlay.files.get(SHARED_SOURCE_PATH));
  assert.deepEqual(files.get(CSS), cssBytes);
  assert.deepEqual(files.get(XML), fixtureXml(version));
  const plan = JSON.parse(files.get('adoption-plan.json'));
  const adaptation = JSON.parse(files.get('ADAPTATION.json'));
  const config = JSON.parse(files.get('host-config.json'));
  assert.equal(plan.sourceLicensePresent, true);
  assert.equal(plan.sourceRootLicensePresent, false);
  assert.deepEqual(plan.licenses, [INHERITED_LICENSE_PATH]);
  const notice = files.get(INHERITED_LICENSE_PATH);
  assert.ok(['9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9', '7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c'].includes(sha256(notice)));
  assert.equal(adaptation.inheritedLicenseSource.sha256, sha256(notice));
  assert.equal(adaptation.inheritedLicenseSource.originCommit, '124ac3ea1d002fe7dc517a7d03513d1238396dac');
  assert.equal(adaptation.vendorLicenseAssigned, false);
  assert.equal(adaptation.changesLicense, 'GPL-2.0-or-later');
  assert.deepEqual(files.get(CHANGES_LICENSE_PATH), changesLicenseBytes);
  assert.deepEqual(adaptation.changesLicenseSource, changesLicenseSource);
  assert.deepEqual(plan.changesLicenseSource, changesLicenseSource);
  assert.equal(adaptation.changes.length, 2);
  assert.equal(new Set(adaptation.changes.map(change => change.path)).size, 2);
  assert.equal(adaptation.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length, 2);
  for (const flag of ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified']) assert.equal(plan[flag], false);
  for (const field of ['algorithmModified']) assert.equal(adaptation.generator[field], false);
  assert.equal(config.joomlaDiscoveryRoots.length, 1);
  assert.equal(config.joomlaDiscoveryRoots[0].inventoryHash, sha256(inventoryBytes));
  for (const name of inventory.files.map(entry => entry.path)) assert.ok(!name.includes('mod_camap_corpmessage') && !name.includes('mod_forum') && !name.includes('mod_showcase'), 'no other module payload is distributed');
  assert.ok(!files.has('LICENSE') && !files.has('LICENSE.md'));
  const localDescriptor = parseJoomlaManifest(files.get(XML), { baseUrl: config.joomlaDiscoveryRoots[0].baseUrl, manifestPath: XML });
  validateAdoptionSchema(localDescriptor, loaded);
  const filePort = { async listFolders() { return { value: [{ Name: ELEMENT }] }; }, async downloadFile({ folderPath, fileName }) { const path = [folderPath, fileName].filter(Boolean).join('/'); assert.ok(files.has(path)); return Buffer.from(files.get(path)); } };
  const service = createJoomlaDiscoveryService({ roots: [{ ...config.joomlaDiscoveryRoots[0], files: filePort }] });
  const discovered = await service.scan();
  assert.equal(discovered.length, 1);
  await service.verify(discovered[0]);
  assert.equal(config.moduleStyles[KEY][0], `${plan.base}/${CSS}`);
  assert.deepEqual(config.moduleStyleRevisions[KEY][localDescriptor.entryPointUrl], config.moduleStyles[KEY]);
  assert.ok(!JSON.stringify(adaptation).includes(PROJECT) && !JSON.stringify(adaptation).includes('C:\\'), 'no raw private absolute paths');
  const provenance = { ...adaptation, licenses: adaptation.originalLicenses, inheritedLicense: adaptation.inheritedLicenseSource, inheritedLicenseBytes: notice, changesLicenseBytes: files.get(CHANGES_LICENSE_PATH), generatorSha256: adaptation.generator.sha256, adoptionApiSha256: adaptation.adoptionApi.sha256 };
  // Repeat finalization from unchanged staging in memory: stable inventory.
  const staged = new Map(files);
  for (const path of ['ADAPTATION.json', 'docs/ADAPTATION-NOTICE.md', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) staged.delete(path);
  const oldPlan = { ...plan }; delete oldPlan.adaptation; delete oldPlan.inheritedLicenseSource; delete oldPlan.changesLicenseSource;
  oldPlan.licenses = []; oldPlan.sourceLicensePresent = false;
  staged.set('adoption-plan.json', json(oldPlan));
  const oldInv = { ...inventory, files: [...staged].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) };
  staged.set('MANIFEST-SHA256.json', json(oldInv));
  const oldConfig = structuredClone(config); oldConfig.joomlaDiscoveryRoots[0].inventoryHash = sha256(json(oldInv)); staged.set('host-config.json', json(oldConfig));
  const first = finalizeEditorialPackage(staged, provenance);
  const second = finalizeEditorialPackage(staged, provenance);
  assert.deepEqual(first.files.get('MANIFEST-SHA256.json'), second.files.get('MANIFEST-SHA256.json'));
  assert.deepEqual(first.files.get('MANIFEST-SHA256.json'), inventoryBytes, 'inventory/config pin is reproducible from original staged payloads');
  assert.deepEqual(first.files.get('host-config.json'), files.get('host-config.json'));
  return { version, inventoriedFiles: inventory.files.length, totalFiles: files.size, inventoryHash: sha256(inventoryBytes), rightsApproved: false, publicationApproved: false, browserValidated: false };
}

/** Custom-runner entry: nine sequential awaited cases, one success line.
 * Importing this module does not load node:test, schedule tests or inspect CLI.
 */
export async function runEditorialAdaptationTests() {
  assert.equal(portableCases.length, 9);
  for (const { run } of portableCases) await run();
  console.log('ok - editorial adaptation: 9 portable cases, pinned overlay/URLs/items/schema/integrity and preserved settings');
  return { suite: 'editorial-adaptation', tests: portableCases.length, passed: portableCases.length, mode: 'portable-pinned-source', browserValidated: false, publicationApproved: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { test } = await import('node:test');
  for (const { name, run } of portableCases) test(name, run);
  const cli = process.argv.slice(2);
  if (cli.includes('--local-build')) {
    test('explicit offline real builder: two new revisions, exact closure/notice/inventory and overwrite refusal', async () => {
      assert.deepEqual(cli, ['--local-build']);
      const container = await mkdtemp(join(PROJECT, 'tmp', 'editorial-adapt-tests-'));
      const receipts = [];
      const params = [];
      for (const version of ['0.3.0', '0.3.1']) {
        const output = `${container.slice(PROJECT.length + 1).replaceAll('\\', '/')}/${version}`;
        const options = { version, base: `/offline/editorial/${version}`, output };
        const built = await prepareEditorialAdaptation(options);
        receipts.push(await auditEditorialAdaptationPackage(output, version));
        params.push(built.descriptor?.params ?? parseJoomlaManifest(built.files.get(XML), { baseUrl: options.base, manifestPath: XML }).params);
        await assert.rejects(prepareEditorialAdaptation(options), /existing output/);
      }
      assert.deepEqual(params[0], params[1]);
      assert.notEqual(receipts[0].inventoryHash, receipts[1].inventoryHash);
      console.log(JSON.stringify({ output: container, receipts }, null, 2));
    });
  } else if (cli.length) {
    test('explicit corrected package audits', async () => {
      assert.equal(cli.length, 3); assert.equal(cli[0], '--packages');
      for (let i = 0; i < 2; i += 1) console.log(JSON.stringify(await auditEditorialAdaptationPackage(cli[i + 1], ['0.3.0', '0.3.1'][i])));
    });
  }
}
