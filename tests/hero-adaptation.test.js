/* SPDX-License-Identifier: GPL-2.0-or-later
 * Portable exact pinned source tests: no CAMAP checkout/browser/network/writes.
 * --local-build opts into two fresh private offline trees, never installation.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  applyHeroOverlay, finalizeHeroPackage, prepareHeroAdaptation, parseHeroAdaptationArgs,
  HERO_ANCHORS, HERO_CSS_ANCHORS, HERO_SOURCE_PATH, HERO_CSS_PATH, HERO_API_SHA256,
  SHARED_SOURCE_PATH, HERO_VALIDATION_SOURCE, HERO_CSS_APPEND, heroAdaptationXml, sha256,
  INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256
} from '../scripts/prepare-hero-adaptation.js';
import { SAFE_URL_SOURCE, readAdaptationFiles, createAdaptationCollector, collectAdaptationDependencies, ADAPTATION_API_FILES, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES, ADAPTATION_ORIGIN_COMMIT } from '../scripts/prepare-editorial-adaptation.js';
import { ADOPTION_MODULES, validateAdoptionSchema } from '../scripts/prepare-module-adoption.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { parseJsonObject, normalizeParamValues } from '../src/libraries/minijoomla/application/declared-params.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELEMENT = 'mod_hero';
const KEY = `camap.${ELEMENT}`;
const LIB = `libraries/camap/${HERO_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${ELEMENT}/css/hero.css`;
const ENTRY = `modules/${ELEMENT}/${ELEMENT}.js`;
const XML = `modules/${ELEMENT}/${ELEMENT}.xml`;
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(bytes.toString().replace(/\r\n?/g, '\n'));
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cases = [];
const registerCase = (name, run) => cases.push({ name, run });

// Actual tiny original 8-line module and 4-line helper; BOM and trailing LF
// bytes are significant. These are pinned source DATA, not approximations.
const MODULE_SOURCE = '\uFEFF' + [
  "import { escapeHtml, safeUrl } from '../_shared/render.js';",
  "export const settingsSchema = Object.freeze({ version: 1, fields: { title: { type: 'string' }, rotatingWords: { type: 'array' }, mission: { type: 'string' }, imageUrl: { type: 'string' }, imageAlt: { type: 'string' }, primaryAction: { type: 'object' }, secondaryAction: { type: 'object' } } });",
  "export const defaults = Object.freeze({ title: 'Profundidade com', rotatingWords: ['propósito'], mission: '', imageUrl: '', imageAlt: '', primaryAction: {}, secondaryAction: {} });",
  'export function renderHero(settings = {}) { const c = { ...defaults, ...settings }; const word = Array.isArray(c.rotatingWords) ? c.rotatingWords[0] ?? \'\' : \'\'; const actions = [c.primaryAction, c.secondaryAction].filter(a => a?.label && safeUrl(a.target) !== \'#\').map(a => `<a class="camap-hero__action" href="${escapeHtml(safeUrl(a.target))}">${escapeHtml(a.label)}</a>`).join(\'\'); const image = c.imageUrl ? `<img class="camap-hero__image" src="${escapeHtml(safeUrl(c.imageUrl, \'\'))}" alt="${escapeHtml(c.imageAlt)}">` : \'\'; return `<section class="camap-hero" aria-labelledby="camap-hero-title"><div class="camap-hero__copy"><h1 id="camap-hero-title">${escapeHtml(c.title)} <span data-camap-hero-word>${escapeHtml(word)}</span></h1><p>${escapeHtml(c.mission)}</p><div class="camap-hero__actions">${actions}</div></div><div class="camap-hero__media">${image}</div></section>`; }',
  "export default { name: 'camap.mod_hero', settings: defaults, settingsSchema, render: ({ settings } = {}) => renderHero(settings) };",
  '', '', '', ''
].join('\n');
const SHARED_SOURCE = '\uFEFF' + [
  "export function escapeHtml(value = '') { return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }",
  "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }",
  "export function stateMessage(state, empty = 'Nenhum conteúdo disponível.') { if (state === 'loading') return '<p role=\"status\" aria-live=\"polite\">Carregando…</p>'; if (state === 'error') return '<p role=\"alert\">Não foi possível carregar este módulo.</p>'; if (state === 'empty') return `<p role=\"status\">${escapeHtml(empty)}</p>`; return ''; }", ''
].join('\n');
const CSS_SOURCE = '\uFEFF.camap-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);width:100%;background:#006298;color:#fff}.camap-hero__copy{padding:clamp(1.5rem,4vw,4rem)}.camap-hero__media{background:#006298}.camap-hero__image{display:block;width:100%;height:100%;object-fit:cover}.camap-hero__actions{display:flex;gap:1rem;flex-wrap:wrap}.camap-hero__action{background:#fdc82f;color:#000;padding:.75rem 1rem;text-decoration:none}@media(max-width:700px){.camap-hero{grid-template-columns:1fr}.camap-hero__media{min-height:14rem}}\n';
const originals = new Map([[SHARED_SOURCE_PATH, Buffer.from(SHARED_SOURCE)], [HERO_SOURCE_PATH, Buffer.from(MODULE_SOURCE)], [HERO_CSS_PATH, Buffer.from(CSS_SOURCE)]]);
for (const [path, bytes] of originals) assert.equal(sha256(bytes), HERO_ANCHORS[path][1]);
const overlay = applyHeroOverlay(originals);
const shared = await import(dataUrl(overlay.files.get(SHARED_SOURCE_PATH)));
function moduleUrl(files) {
  const source = files.get(HERO_SOURCE_PATH).toString();
  const anchor = "from '../_shared/render.js';";
  assert.equal(source.split(anchor).length, 2);
  return dataUrl(source.replace(anchor, () => `from '${dataUrl(files.get(SHARED_SOURCE_PATH))}';`));
}
const loaded = await import(moduleUrl(overlay.files));
const prior = await import(moduleUrl(originals));
const render = loaded.renderHero;
const removeOriginalIds = html => html.replace('aria-labelledby="camap-hero-title"', `aria-label="${shared.escapeHtml('Profundidade com propósito')}"`).replace('<h1 id="camap-hero-title">', '<h1>').replace('class="camap-hero"', 'class="camap-hero camap-hero--without-image"');
const countActions = html => (html.match(/<a class="camap-hero__action"/g) ?? []).length;
const descriptor = parseJoomlaManifest(heroAdaptationXml('0.3.0'), { baseUrl: '/offline/hero/0.3.0', manifestPath: XML });

// Full historical MIT fixture read as inert DATA and pinned, not evaluated.
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
    // Synthetic nonexecuted snapshot metadata. Explicit local audit verifies
    // every entry against the real checkout, never treating placeholders as JS.
    const hash = path.startsWith('tools/') ? ADAPTATION_GENERATOR_HASHES[0] : sha256(Buffer.from(`inert fixture metadata: ${path}`));
    snapshot.push({ path, originalSha256: hash, snapshotSha256: hash, bytes: 0 });
  }
  return { changes: structuredClone(overlay.changes), licenses: [], generatorSha256: ADAPTATION_GENERATOR_HASHES[0], adoptionApiSha256: HERO_API_SHA256, snapshot,
    inheritedLicenseBytes: mit, inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: [HERO_SOURCE_PATH, SHARED_SOURCE_PATH, HERO_CSS_PATH], globalVendorRightsApproved: false, evidence: 'Portable exact historical notice hash; explicit local audit compares original source bytes.' },
    changesLicenseBytes: gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' } };
}
function rebuildInventory(files, version = '0.3.0') {
  const inv = json({ format: 'minijoomla-joomla-package-v1', version, moduleKeys: { [ELEMENT]: KEY }, moduleStyles: { [KEY]: [CSS] }, files: [...files].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) });
  const base = `/offline/hero/${version}`;
  files.set('MANIFEST-SHA256.json', inv);
  files.set('host-config.json', json({ joomlaDiscoveryRoots: [{ id: `camap-${ELEMENT}-${version}`, baseUrl: base, inventoryHash: sha256(inv), immutable: true, discover: true }], moduleStyles: { [KEY]: [`${base}/${CSS}`] }, moduleStyleRevisions: { [KEY]: { [`${base}/${ENTRY}`]: [`${base}/${CSS}`] } } }));
  return files;
}
function stagedFixture(version = '0.3.0') {
  return rebuildInventory(new Map([[LIB, overlay.files.get(HERO_SOURCE_PATH)], [SHARED, overlay.files.get(SHARED_SOURCE_PATH)], [CSS, overlay.files.get(HERO_CSS_PATH)], [ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`)], [XML, heroAdaptationXml(version)], ['docs/ADOPTION-NOTICE.md', Buffer.from('Offline fixture\n')], ['adoption-plan.json', json({ format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module: ELEMENT, key: KEY, version, base: `/offline/hero/${version}`, pilot: false, validation: 'Portable fixture', licenses: [], sourceLicensePresent: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), nextGate: 'Coordinator review', hostNote: 'One root only' })]]), version);
}
function modifyControl(files, path, mutate) { const value = JSON.parse(files.get(path)); mutate(value); files.set(path, json(value)); }

registerCase('three actual original sources pinned; BOM/mixed EOL/source bytes retained except exact authored patches', () => {
  const raw = new Map([...originals].map(([path, bytes]) => [path, Buffer.from(bytes.toString().replace(/\n+$/, ending => ending.replace(/\n/g, '\r\n')))]));
  const rawOverlay = applyHeroOverlay(raw);
  assert.equal(rawOverlay.files.size, 3);
  for (const change of rawOverlay.changes) {
    assert.equal(change.originalSha256, HERO_ANCHORS[change.path][0]);
    assert.equal(change.generatedSha256, sha256(overlay.files.get(change.path)));
    assert.equal(change.bom, true); assert.equal(change.lineEndings, change.path === HERO_CSS_PATH ? 'CRLF' : 'mixed LF/CRLF preserved');
  }
  assert.equal(rawOverlay.files.get(HERO_CSS_PATH).toString().replace(HERO_CSS_APPEND + '\r\n', ''), raw.get(HERO_CSS_PATH).toString());
  assert.equal(rawOverlay.files.get(SHARED_SOURCE_PATH).toString().replace(SAFE_URL_SOURCE, SHARED_SOURCE.split('\n')[1]), raw.get(SHARED_SOURCE_PATH).toString());
  let reverted = rawOverlay.files.get(HERO_SOURCE_PATH).toString();
  for (const [from, to] of [
    [HERO_VALIDATION_SOURCE + '\n', ''],
    ['const c = _heroSettings(settings);', 'const c = { ...defaults, ...settings };'],
    ["_heroWords(c.rotatingWords)[0] ?? ''", "Array.isArray(c.rotatingWords) ? c.rotatingWords[0] ?? '' : ''"],
    ['[c.primaryAction, c.secondaryAction].map(_heroAction).filter(Boolean)', "[c.primaryAction, c.secondaryAction].filter(a => a?.label && safeUrl(a.target) !== '#')"],
    ['const imageUrl = _heroImage(c.imageUrl); const image = imageUrl ?', 'const image = c.imageUrl ?'],
    ['${escapeHtml(imageUrl)}', "${escapeHtml(safeUrl(c.imageUrl, ''))}"],
    ['<section class="camap-hero${imageUrl ? \'\' : \' camap-hero--without-image\'}"', '<section class="camap-hero"'],
    ['aria-label="${escapeHtml(c.title + \' \' + word)}"', 'aria-labelledby="camap-hero-title"'],
    ['<h1>', '<h1 id="camap-hero-title">'],
    ["render: (context = {}) => renderHero(context && typeof context === 'object' ? Object.getOwnPropertyDescriptor(context, 'settings')?.value : undefined)", 'render: ({ settings } = {}) => renderHero(settings)']
  ]) { assert.equal(reverted.split(from).length, 2); reverted = reverted.replace(from, () => to); }
  assert.equal(reverted, raw.get(HERO_SOURCE_PATH).toString(), 'all original renderer bytes unchanged outside declared patches');
  assert.ok(overlay.files.get(HERO_SOURCE_PATH).toString().includes(HERO_VALIDATION_SOURCE));
  assert.equal(overlay.files.get(HERO_SOURCE_PATH).toString().split('\n')[1], MODULE_SOURCE.split('\n')[1]);
  assert.equal(overlay.files.get(HERO_SOURCE_PATH).toString().split('\n')[2], MODULE_SOURCE.split('\n')[2]);
  assert.deepEqual(loaded.defaults, prior.defaults); assert.deepEqual(loaded.settingsSchema, prior.settingsSchema);
  for (const [path, bytes] of originals) assert.equal(sha256(bytes), HERO_ANCHORS[path][1]);
});
registerCase('tampered helper/module/CSS and arbitrary overlay graph refused before execution', () => {
  for (const path of originals.keys()) { const bad = new Map(originals); bad.set(path, Buffer.concat([bad.get(path), Buffer.from('// unknown')])); assert.throws(() => applyHeroOverlay(bad), /Unapproved original SHA-256/); }
  assert.throws(() => applyHeroOverlay(new Map()), /exactly/);
  assert.throws(() => applyHeroOverlay(new Map([...originals, ['foreign.js', Buffer.from('')]])), /exactly/);
});
registerCase('strict shared URLs reject protocol/credentials/encoded bypasses without coercion', () => {
  for (const url of ['#', '#/article/a', '#javascript:x', '/local/a?q="x"&v=1', '/local/caf%C3%A9', 'https://example.invalid/a', 'HTTPS://EXAMPLE.invalid:443/a']) assert.equal(shared.safeUrl(url), url);
  for (const url of [null, undefined, 42, false, {}, [], '', ' ', 'relative', '?query', 'http://example.invalid', 'javascript:alert(1)', 'data:text/html,x', '//unsafe.invalid', '/\\unsafe.invalid', 'https://u:p@example.invalid', 'https://@example.invalid', 'https:///example.invalid', 'https://', 'https://[invalid', '/a b', '/a\t', '/a\0', '/a\u007f', '/a\u0085', '/%2funsafe', '/%5cunsafe', '/%0a', '/%1f', '/%7f', '/%252funsafe', '/%255c', '/%25250a', '/%2525252f', '/bad%', '/bad%zz', '/%20x', '/%C2%A0x', ' /x', '/x ']) {
    assert.equal(shared.safeUrl(url), '#'); assert.equal(shared.safeUrl(url, '/local/fallback'), '/local/fallback');
  }
  let calls = 0; const object = { toString() { calls++; throw Error('not invoked'); } };
  assert.equal(shared.safeUrl(object, object), '#'); assert.equal(calls, 0);
  // Reused helper has no empty fallback: hero must validate before img creation.
  assert.equal(shared.safeUrl('javascript:x', ''), '#');
});
registerCase('seven schema fields and complete XML typed defaults/options unchanged; no invented aliases/constraints', () => {
  validateAdoptionSchema(descriptor, loaded);
  assert.deepEqual(loaded.defaults, { title: 'Profundidade com', rotatingWords: ['propósito'], mission: '', imageUrl: '', imageAlt: '', primaryAction: {}, secondaryAction: {} });
  assert.deepEqual(descriptor.params.map(({ name, type, valueType, label, default: value }) => ({ name, type, valueType, label, value })), Object.entries(loaded.settingsSchema.fields).map(([name, field]) => ({ name, type: ['array', 'object'].includes(field.type) ? 'json' : 'text', valueType: ['array', 'object'].includes(field.type) ? field.type : undefined, label: name, value: loaded.defaults[name] })));
  for (const param of descriptor.params) { assert.equal(param.options?.length ?? 0, 0); for (const key of ['min', 'max', 'maxLength']) assert.equal(Object.hasOwn(param, key), false); }
  assert.equal(loaded.settingsSchema.version, 1); assert.equal(Object.keys(loaded.settingsSchema.fields).length, 7);
});
registerCase('valid output preserves original markup except declared section label/h1 ID removal and no-image modifier', () => {
  assert.equal(render(), removeOriginalIds(prior.renderHero()));
  const settings = { title: 'T "<&', rotatingWords: ['W & <', 'unused'], mission: 'M <&', imageUrl: '/local/image.jpg?q="x"&v=1', imageAlt: 'Alt "<&', primaryAction: { label: 'Go <&', target: '#/local' }, secondaryAction: { label: 'More', target: 'https://example.invalid/a' } };
  const original = prior.renderHero(settings).replace('aria-labelledby="camap-hero-title"', `aria-label="${shared.escapeHtml(settings.title + ' ' + settings.rotatingWords[0])}"`).replace('<h1 id="camap-hero-title">', '<h1>');
  assert.equal(render(settings), original);
  assert.match(render(settings), /<h1>T &quot;&lt;&amp; <span/); assert.match(render(settings), /alt="Alt &quot;&lt;&amp;"/);
  assert.doesNotMatch(render({ aliases: 'ignored', subtitle: 'ignored', description: 'ignored' }), /ignored/);
  assert.equal(loaded.default.render({ settings }), render(settings));
});
registerCase('first valid nonblank word only, static; malformed arrays/objects never coerced or timed', () => {
  for (const rotatingWords of [null, false, 42, {}, 'word', [], [null, {}, 0, '', ' ']]) assert.match(render({ rotatingWords }), /data-camap-hero-word><\/span>/);
  assert.match(render({ rotatingWords: [null, '', ' ', 3, {}, ' First <& ', 'Second'] }), /data-camap-hero-word> First &lt;&amp; <\/span>/);
  assert.doesNotMatch(render({ rotatingWords: ['First', 'Second'] }), /Second/);
  assert.doesNotMatch(overlay.files.get(HERO_SOURCE_PATH).toString(), /setInterval|setTimeout|requestAnimationFrame|Math.random|Date.now|globalThis|document\./);
  let calls = 0; const words = Object.defineProperty([], '0', { get() { calls++; throw Error('word getter'); } });
  assert.match(render({ rotatingWords: words }), /data-camap-hero-word><\/span>/); assert.equal(calls, 0);
});
registerCase('actions need own plain nonblank string label and strict safe string target; no fallback anchors', () => {
  const invalid = [null, false, 1, 'action', [], {}, { label: '' }, { label: '  ', target: '/local' }, { label: 3, target: '/local' }, { label: {}, target: '/local' }, { label: 'Go', target: null }, { label: 'Go', target: {} }, { label: 'Go', target: '' }, { label: 'Go', target: '#' }, { label: 'Go', target: 'javascript:x' }, { label: 'Go', target: '//unsafe.invalid' }, Object.create({ label: 'Inherited', target: '/local' })];
  for (const primaryAction of invalid) assert.equal(countActions(render({ primaryAction })), 0);
  for (const target of ['#/article/x', '/local/a', 'https://example.invalid/a']) assert.equal(countActions(render({ primaryAction: { label: ' Go <& ', target }, secondaryAction: { label: 'Other', target } })), 2);
  assert.equal(countActions(render({ primaryAction: Object.assign(Object.create(null), { label: 'Go', target: '/local', future: { untouched: true } }) })), 1);
});
registerCase('image validation omits every unsafe URL and fragment without empty/# fallback image loads', () => {
  const unsafe = [undefined, null, false, 1, {}, [], '', ' ', '#', '#/local.jpg', '/image.jpg#fragment', 'https://example.invalid/img#fragment', 'http://example.invalid/i', 'data:image/png,x', 'javascript:x', '//unsafe.invalid/i', '/\\unsafe.invalid/i', '/%252funsafe', '/bad%', '/image x.jpg', 'https://u:p@example.invalid/i', 'https:///example.invalid/i'];
  for (const imageUrl of unsafe) { const html = render({ imageUrl }); assert.doesNotMatch(html, /<img|src=/); assert.match(html, /camap-hero__media"><\/div>/); }
  for (const imageUrl of ['/local/image.jpg', '/image.jpg?x=1&y=2', 'https://example.invalid/image.jpg', 'HTTPS://EXAMPLE.invalid/image.jpg']) assert.match(render({ imageUrl, imageAlt: 'Alt <&"' }), /<img class="camap-hero__image" src="[^]*alt="Alt &lt;&amp;&quot;">/);
  assert.match(prior.renderHero({ imageUrl: 'javascript:x' }), /<img[^]*src=""/);
});
registerCase('top-level/nested getters, toJSON/coercion methods and invalid plain settings never executed', () => {
  let calls = 0; const getter = () => { calls++; throw Error('getter'); };
  const evil = { toJSON: getter, toString: getter, valueOf: getter };
  for (const settings of [null, false, 1, 'settings', [], Object.create({ title: 'inherited' }), Object.defineProperty({}, 'title', { get: getter }), Object.defineProperty({ title: 'T' }, 'unknown', { get: getter }), evil]) assert.doesNotThrow(() => render(settings));
  for (const key of ['title', 'mission', 'imageUrl', 'imageAlt']) assert.doesNotThrow(() => render({ [key]: evil }));
  for (const primaryAction of [evil, Object.defineProperty({ label: 'Go' }, 'target', { get: getter }), Object.defineProperty({ target: '/local' }, 'label', { get: getter }), Object.defineProperty({ label: 'Go', target: '/local' }, 'extra', { get: getter }), { label: evil, target: '/local' }, { label: 'Go', target: evil }]) assert.equal(countActions(render({ primaryAction })), 0);
  assert.doesNotThrow(() => render({ rotatingWords: [evil], future: Object.defineProperty({}, 'x', { get: getter }) }));
  assert.doesNotThrow(() => loaded.default.render(Object.defineProperty({}, 'settings', { get: getter })));
  for (const context of [null, false, 1, []]) assert.doesNotThrow(() => loaded.default.render(context));
  assert.equal(calls, 0);
});
registerCase('repeated hero instances have zero duplicate/fixed IDs and safely escaped accessible literal labels', () => {
  const settings = { title: 'T " onmouseover="x <&', rotatingWords: ['W <&'] };
  const html = Array.from({ length: 5 }, () => render(settings)).join('');
  assert.equal((html.match(/<h1>/g) ?? []).length, 5);
  assert.equal((html.match(/aria-label="T &quot; onmouseover=&quot;x &lt;&amp; W &lt;&amp;"/g) ?? []).length, 5);
  assert.doesNotMatch(html, /\sid=|aria-labelledby|camap-hero-title/);
  assert.doesNotMatch(CSS_SOURCE, /camap-hero-title|#camap/);
});
registerCase('CSS append only scoped wrapping/min-width and no-image single column/media hidden; original rules retained', () => {
  assert.equal(overlay.files.get(HERO_CSS_PATH).toString().replace(HERO_CSS_APPEND + '\n', ''), CSS_SOURCE);
  assert.equal(sha256(originals.get(HERO_CSS_PATH)), HERO_CSS_ANCHORS[1]);
  assert.match(CSS_SOURCE, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(CSS_SOURCE, /@media\(max-width:700px\)[^]*min-height:14rem/);
  assert.doesNotMatch(CSS_SOURCE, /@import|url\(|border-radius|:root|body|header/);
  assert.match(render(), /class="camap-hero camap-hero--without-image"/);
  assert.doesNotMatch(render({ imageUrl: '/local/image.jpg' }), /camap-hero--without-image/);
  assert.match(render({ imageUrl: '#/unsafe-image' }), /camap-hero--without-image/);
});
registerCase('renderer and unrelated admin update preserve exact stored JSON, invalid nested values and unknown keys', async () => {
  const settingsJson = '{"title":"T","rotatingWords":[null,"",{},"First"],"mission":"","imageUrl":"javascript:x","imageAlt":"","primaryAction":{"label":" ","target":"//unsafe.invalid"},"secondaryAction":{},"future":{"keep":[true]},"__proto__":{"preserved":true}}';
  let record = { id: 101, title: 'Local', extensionKey: KEY, position: 'main-top', ordering: 2, enabled: true, scopeKind: 'All', assignment: 'all', assignmentJson: '[]', settingsJson, etag: 'local-etag' };
  const writes = [];
  const service = createAdminService({ moduleInstances: { async findMany() { return { items: [structuredClone(record)] }; }, async findById() { return structuredClone(record); }, async update(id, patch) { writes.push(patch); record = { ...record, ...patch }; return structuredClone(record); } }, extensions: { async findMany() { return { items: [{ key: KEY, type: 'Module', enabled: true, manifestJson: descriptor.manifestJson }] }; } } });
  const stored = JSON.parse(settingsJson); const before = JSON.stringify(stored); render(stored); assert.equal(JSON.stringify(stored), before);
  await service.moduleInstances.update(101, { enabled: false }, { etag: 'local-etag' });
  assert.equal(record.settingsJson, settingsJson); assert.equal(writes.length, 1); assert.equal(Object.hasOwn(writes[0], 'settingsJson'), false);
  const normalized = normalizeParamValues(descriptor.params, parseJsonObject(settingsJson, { strict: true }), { keepUndeclared: true });
  assert.deepEqual(normalized.rotatingWords, stored.rotatingWords); assert.deepEqual(normalized.primaryAction, stored.primaryAction); assert.deepEqual(normalized.future, { keep: [true] }); assert.equal(Object.hasOwn(normalized, '__proto__'), true);
  assert.equal(record.position, 'main-top'); assert.equal(record.ordering, 2);
});
registerCase('closed CLI rejects other modules/versions/arbitrary code/path overlap and noninert options', async () => {
  const base = ['--base', '/offline/hero/0.3.0', '--output', 'tmp/hero-adapt-agent-portable'];
  assert.equal(parseHeroAdaptationArgs(base).dependenciesRoot, 'tmp/step2/camap-source');
  for (const module of ['all', 'mod_camap_hero', 'mod_camap_topsections', 'mod_camap_corpmessage']) assert.throws(() => parseHeroAdaptationArgs([...base, '--module', module]));
  for (const version of ['0.2.0', '0.3.2', '01.3.0']) assert.throws(() => parseHeroAdaptationArgs([...base, '--version', version]));
  for (const output of ['public/package', 'tmp/editorial-adapt-old', 'tmp/hero-adapt-agent-x/../y', 'tmp/hero-adapt-agent-x/con', 'tmp/hero-adapt-agent-x/aux.']) assert.throws(() => parseHeroAdaptationArgs(['--base', '/local', '--output', output]));
  for (const extra of [['--source', '../other'], ['--source', 'tmp/step2/camap-source'], ['--source', 'tmp/hero-adapt-agent-portable/source'], ['--dependencies-root', '../other'], ['--inherited-license', '../other-LICENSE'], ['--inherited-license', 'tmp/hero-adapt-agent-portable/LICENSE'], ['--profile', 'arbitrary'], ['--patches', 'evil'], ['--base', '/duplicate']]) assert.throws(() => parseHeroAdaptationArgs([...base, ...extra]));
  assert.throws(() => parseHeroAdaptationArgs(['--output', base[3]])); assert.deepEqual(parseHeroAdaptationArgs(['--help']), { help: true });
  let calls = 0; await assert.rejects(prepareHeroAdaptation(Object.defineProperty({}, 'base', { get() { calls++; throw Error('getter'); } })), /accessor/);
  await assert.rejects(prepareHeroAdaptation({ ...parseHeroAdaptationArgs(base), hashes: {} }), /Unknown/);
  await assert.rejects(prepareHeroAdaptation({ toJSON() { calls++; } }), /plain metadata/); assert.equal(calls, 0);
});
registerCase('positive finalizer: exact 5 runtime/13 total/11 payloads, full notices, false flags and reproducible versions', () => {
  const hashes = [];
  for (const version of ['0.3.0', '0.3.1']) {
    const staged = stagedFixture(version); const originalInventory = Buffer.from(staged.get('MANIFEST-SHA256.json'));
    const final = finalizeHeroPackage(staged, provenance());
    assert.deepEqual(staged.get('MANIFEST-SHA256.json'), originalInventory);
    assert.equal(final.files.size, 13); assert.equal(final.inventory.files.length, 11); assert.equal(final.adaptation.changes.length, 3);
    assert.equal(final.adaptation.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length, 3);
    assert.equal(final.adaptation.cssModified, true); assert.equal(final.adaptation.markupModified, true); assert.equal(final.adaptation.vendorLicenseAssigned, false);
    assert.deepEqual(final.files.get(INHERITED_LICENSE_PATH), mit); assert.deepEqual(final.files.get(CHANGES_LICENSE_PATH), gpl);
    assert.equal(final.adaptation.adoptionApi.sha256, HERO_API_SHA256); assert.equal(final.adaptation.generator.algorithmModified, false);
    for (const flag of FLAGS) { assert.equal(final.adaptation[flag], false); assert.equal(final.adoptionPlan[flag], false); }
    for (const entry of final.inventory.files) { assert.equal(entry.bytes, final.files.get(entry.path).length); assert.equal(entry.sha256, sha256(final.files.get(entry.path))); }
    const invBytes = final.files.get('MANIFEST-SHA256.json'); assert.equal(final.hostConfig.joomlaDiscoveryRoots[0].inventoryHash, sha256(invBytes));
    assert.deepEqual(invBytes, finalizeHeroPackage(stagedFixture(version), provenance()).files.get('MANIFEST-SHA256.json'));
    hashes.push(sha256(invBytes));
  }
  assert.notEqual(hashes[0], hashes[1]);
});
registerCase('finalizer rejects XML forged complete defaults/types/options/unknown attributes even with correct hashes', () => {
  for (const [from, to] of [['name="title"', 'name="title" maxlength="1"'], ['name="title"', 'name="title" unknown="x"'], ['default="Profundidade com"', 'default="Changed"'], ['default="[&quot;propósito&quot;]"', 'default="[]"'], ['mj:valueType="array"', 'mj:valueType="object"'], ['name="primaryAction" label="primaryAction" default="{}"', 'name="primaryAction" label="primaryAction" default="{&quot;target&quot;:&quot;/invented&quot;}"'], ['name="secondaryAction"', 'name="alternateAction"'], ['type="text" />', 'type="text"><option value="invented">Invented</option></field>'], ['method="upgrade"', 'method="upgrade" unknown="x"'], ['<fieldset name="basic">', '<fieldset name="basic" required="true">']]) {
    const staged = stagedFixture(); staged.set(XML, Buffer.from(staged.get(XML).toString().replace(from, to))); rebuildInventory(staged);
    assert.throws(() => finalizeHeroPackage(staged, provenance()), /XML canonical/);
  }
});
registerCase('finalizer forgery guards: inventoried foreigners, mandatory bytes, closed metadata, hashes and licenses', () => {
  for (const path of ['modules/mod_forum/x.js', `modules/${ELEMENT}/extra.js`, `libraries/camap/${HERO_CSS_PATH}`, `libraries/camap/extensions/camap/${ELEMENT}/extra.js`, 'libraries/camap/extensions/camap/_shared/foreign.js', 'foreign.json', 'docs/foreign.md', 'LICENSE', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, 'ADAPTATION.json']) {
    const staged = stagedFixture(); staged.set(path, Buffer.from('inventoried foreign bytes')); rebuildInventory(staged); assert.throws(() => finalizeHeroPackage(staged, provenance()), /allowlist/);
  }
  for (const path of [ENTRY, XML, CSS, LIB, SHARED, 'docs/ADOPTION-NOTICE.md', 'host-config.json']) { const staged = stagedFixture(); staged.delete(path); assert.throws(() => finalizeHeroPackage(staged, provenance()), /mandatory/); }
  const stale = stagedFixture(); stale.set(CSS, Buffer.from('stale')); assert.throws(() => finalizeHeroPackage(stale, provenance()), /integrity/);
  const forged = stagedFixture(); forged.set(LIB, Buffer.from('export default {};\n')); rebuildInventory(forged);
  const forgedP = provenance(); forgedP.changes[1].generatedSha256 = sha256(forged.get(LIB)); assert.throws(() => finalizeHeroPackage(forged, forgedP), /approved patch/);
  for (const patch of [{ changes: [] }, { licenses: ['LICENSE'] }, { generatorSha256: '0'.repeat(64) }, { adoptionApiSha256: '1'.repeat(64) }, { snapshot: [] }, { inheritedLicenseBytes: Buffer.from('MIT') }, { inheritedLicense: { ...provenance().inheritedLicense, scope: ['all vendor'] } }, { inheritedLicense: { ...provenance().inheritedLicense, evidence: {} } }, { changesLicenseBytes: Buffer.from('GPL') }, { changesLicenseSource: { ...provenance().changesLicenseSource, scope: 'all vendor' } }, { arbitrary: true }]) assert.throws(() => finalizeHeroPackage(stagedFixture(), { ...provenance(), ...patch }));
  for (const [path, mutate] of [['host-config.json', config => { config.arbitrary = true; }], ['host-config.json', config => { config.joomlaDiscoveryRoots[0].discover = false; }], ['host-config.json', config => { config.moduleStyles[KEY].push('/foreign.css'); }], ['adoption-plan.json', plan => { plan.hostConfigured = true; }], ['adoption-plan.json', plan => { plan.validation = {}; }], ['adoption-plan.json', plan => { plan.arbitrary = 'code'; }]]) {
    const staged = stagedFixture(); modifyControl(staged, path, mutate); if (path === 'adoption-plan.json') rebuildInventory(staged); assert.throws(() => finalizeHeroPackage(staged, provenance()));
  }
  const staged = stagedFixture(); modifyControl(staged, 'MANIFEST-SHA256.json', inv => { inv.files[0].unexpected = true; }); assert.throws(() => finalizeHeroPackage(staged, provenance()), /Closed/);
  let calls = 0; const accessor = Object.defineProperty(provenance(), 'changes', { get() { calls++; throw Error('getter'); } }); assert.throws(() => finalizeHeroPackage(stagedFixture(), accessor), /accessor/);
  const functionP = provenance(); functionP.snapshot[0].toJSON = () => { calls++; }; assert.throws(() => finalizeHeroPackage(stagedFixture(), functionP), /plain metadata/);
  const oversized = provenance(); oversized.inheritedLicenseBytes = Buffer.alloc(11 * 1024 * 1024); assert.throws(() => finalizeHeroPackage(stagedFixture(), oversized), /budget/);
  const deep = provenance(); deep.arbitrary = Array.from({ length: 501 }, () => null); assert.throws(() => finalizeHeroPackage(stagedFixture(), deep), /bounded/);
  const symbolP = provenance(); symbolP[Symbol('x')] = 1; assert.throws(() => finalizeHeroPackage(stagedFixture(), symbolP), /symbol/);
  assert.equal(calls, 0);
});

registerCase('Buffer evidence/staged bytes refuse own length/valueOf/toJSON/accessors before reads or coercion', () => {
  let calls = 0;
  const getter = () => { calls++; throw Error('Buffer getter must never run'); };
  const hooks = ['length', 'valueOf', 'toJSON', 'buffer', 'byteOffset', 'byteLength', 'foo', Symbol('hook')];
  for (const property of hooks) {
    for (const field of ['inheritedLicenseBytes', 'changesLicenseBytes']) {
      const p = provenance();
      const bytes = Buffer.from(p[field]);
      Object.defineProperty(bytes, property, { get: getter });
      p[field] = bytes;
      assert.throws(() => finalizeHeroPackage(stagedFixture(), p), /Buffer own byte indices only/);
    }
    for (const path of [CSS, LIB, SHARED, ENTRY, XML, 'docs/ADOPTION-NOTICE.md', 'adoption-plan.json', 'host-config.json', 'MANIFEST-SHA256.json']) {
      const staged = stagedFixture();
      const bytes = Buffer.from(staged.get(path));
      Object.defineProperty(bytes, property, { get: getter });
      staged.set(path, bytes);
      assert.throws(() => finalizeHeroPackage(staged, provenance()), /Buffer own byte indices only/);
    }
  }
  for (const property of ['length', 'valueOf', 'toJSON', 'foo', Symbol('data')]) {
    const p = provenance(); Object.defineProperty(p.inheritedLicenseBytes = Buffer.from(mit), property, { value: getter });
    assert.throws(() => finalizeHeroPackage(stagedFixture(), p), /Buffer own byte indices only/);
  }
  for (const bytes of [new Uint8Array([1, 2]), Object.create(Buffer.prototype), Object.setPrototypeOf(Buffer.from('x'), Object.create(Buffer.prototype))]) {
    const staged = stagedFixture(); staged.set(CSS, bytes);
    assert.throws(() => finalizeHeroPackage(staged, provenance()), /trusted exact Buffer/);
  }
  // Exact plain pooled/sliced Buffers are valid and copied by native byte slots.
  const staged = stagedFixture();
  for (const [path, bytes] of staged) {
    const pool = Buffer.allocUnsafe(bytes.length + 8); bytes.copy(pool, 4);
    const slice = pool.subarray(4, 4 + bytes.length);
    assert.equal(Object.getPrototypeOf(slice), Buffer.prototype); staged.set(path, slice);
  }
  const final = finalizeHeroPackage(staged, provenance());
  assert.deepEqual(final.files.get(CSS), overlay.files.get(HERO_CSS_PATH));
  assert.notEqual(final.files.get(CSS), staged.get(CSS));
  assert.equal(calls, 0);
});

/** Explicit local read-only audit; final package JS never imported/executed. */
export async function auditHeroAdaptationPackage(directory, version) {
  const root = resolve(PROJECT, directory);
  const output = relative(PROJECT, root).replaceAll('\\', '/');
  parseHeroAdaptationArgs(['--base', `/offline/hero/${version}`, '--version', version, '--output', output]);
  const files = await readAdaptationFiles(root);
  const invBytes = files.get('MANIFEST-SHA256.json'); const inventory = JSON.parse(invBytes);
  assert.equal(inventory.version, version); assert.equal(inventory.files.length, 11); assert.equal(files.size, 13);
  for (const entry of inventory.files) { assert.equal(files.get(entry.path).length, entry.bytes); assert.equal(sha256(files.get(entry.path)), entry.sha256); }
  assert.deepEqual([...files.keys()].sort(), [...inventory.files.map(entry => entry.path), 'MANIFEST-SHA256.json', 'host-config.json'].sort());
  assert.deepEqual(files.get(LIB), overlay.files.get(HERO_SOURCE_PATH)); assert.deepEqual(files.get(SHARED), overlay.files.get(SHARED_SOURCE_PATH)); assert.deepEqual(files.get(CSS), overlay.files.get(HERO_CSS_PATH)); assert.deepEqual(files.get(XML), heroAdaptationXml(version));
  const a = JSON.parse(files.get('ADAPTATION.json')); const plan = JSON.parse(files.get('adoption-plan.json')); const config = JSON.parse(files.get('host-config.json'));
  assert.equal(a.cssModified, true); assert.equal(a.markupModified, true); assert.equal(a.vendorLicenseAssigned, false); assert.equal(a.generator.algorithmModified, false); assert.equal(a.adoptionApi.byteIdenticalRelocation, true);
  assert.equal(a.generator.path, 'tools/prepare-joomla-modules.js'); assert.equal(a.adoptionApi.path, 'scripts/prepare-module-adoption.js');
  assert.equal(a.adoptionApi.sha256, sha256(await readFile(join(PROJECT, a.adoptionApi.path)))); assert.equal(a.adoptionApi.sha256, HERO_API_SHA256);
  assert.equal(a.generator.sha256, sha256(await readFile(join(PROJECT, '..', 'CAMAP2', a.generator.path))));
  assert.equal(a.inheritedLicenseSource.originCommit, ADAPTATION_ORIGIN_COMMIT); assert.ok(ADAPTATION_MIT_HASHES.includes(sha256(files.get(INHERITED_LICENSE_PATH)))); assert.deepEqual(files.get(CHANGES_LICENSE_PATH), gpl);
  assert.equal(a.changes.length, 3); assert.equal(a.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length, 3);
  for (const flag of FLAGS) { assert.equal(plan[flag], false); assert.equal(a[flag], false); }
  assert.equal(plan.sourceRootLicensePresent, false); assert.equal(plan.sourceLicensePresent, true); assert.deepEqual(plan.licenses, [INHERITED_LICENSE_PATH]);
  const p = { changes: a.changes, licenses: a.originalLicenses, snapshot: a.snapshot, inheritedLicense: a.inheritedLicenseSource, inheritedLicenseBytes: files.get(INHERITED_LICENSE_PATH), changesLicenseSource: a.changesLicenseSource, changesLicenseBytes: files.get(CHANGES_LICENSE_PATH), generatorSha256: a.generator.sha256, adoptionApiSha256: a.adoptionApi.sha256 };
  const staged = new Map(files); for (const path of ['ADAPTATION.json', 'docs/ADAPTATION-NOTICE.md', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) staged.delete(path);
  const oldPlan = { ...plan }; for (const key of ['adaptation', 'inheritedLicenseSource', 'changesLicenseSource', 'sourceRootLicensePresent']) delete oldPlan[key]; oldPlan.licenses = []; oldPlan.sourceLicensePresent = false;
  staged.set('adoption-plan.json', json(oldPlan));
  staged.set('MANIFEST-SHA256.json', json({ ...inventory, files: [...staged].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) }));
  const oldConfig = structuredClone(config); oldConfig.joomlaDiscoveryRoots[0].inventoryHash = sha256(staged.get('MANIFEST-SHA256.json')); staged.set('host-config.json', json(oldConfig));
  const final = finalizeHeroPackage(staged, p);
  // Every final byte, including notices/plan, must match approved reconstruction.
  for (const [path, bytes] of final.files) assert.deepEqual(files.get(path), bytes, `reconstructed final ${path}`);
  // Paths only read from originals after closed finalizer provenance validation.
  for (const entry of a.snapshot) { const bytes = await readFile(join(PROJECT, '..', 'CAMAP2', entry.path)); assert.equal(entry.originalSha256, sha256(bytes), `actual original ${entry.path}`); assert.equal(entry.bytes, bytes.length); }
  const patched = applyHeroOverlay(new Map(await Promise.all(Object.keys(HERO_ANCHORS).map(async path => [path, await readFile(join(PROJECT, '..', 'CAMAP2', path))]))));
  for (const change of a.changes) assert.deepEqual(change, patched.changes.find(item => item.path === change.path));
  const parsed = parseJoomlaManifest(files.get(XML), { baseUrl: plan.base, manifestPath: XML }); validateAdoptionSchema(parsed, loaded);
  const filePort = { async listFolders() { return { value: [{ Name: ELEMENT }] }; }, async downloadFile({ folderPath, fileName }) { const path = [folderPath, fileName].filter(Boolean).join('/'); assert.ok(files.has(path)); return Buffer.from(files.get(path)); } };
  const service = createJoomlaDiscoveryService({ roots: [{ ...config.joomlaDiscoveryRoots[0], files: filePort }] }); const discovered = await service.scan(); assert.equal(discovered.length, 1); await service.verify(discovered[0]);
  assert.equal(config.joomlaDiscoveryRoots[0].inventoryHash, sha256(invBytes)); assert.deepEqual(config.moduleStyleRevisions[KEY][parsed.entryPointUrl], [`${plan.base}/${CSS}`]);
  assert.doesNotMatch(JSON.stringify(a), /C:\\|@|README/);
  return { version, reviewedSources: 3, patches: 3, cssModified: true, markupModified: true, inventoriedFiles: inventory.files.length, totalFiles: files.size, inventoryHash: sha256(invBytes), browserValidated: false, publicationApproved: false, rightsApproved: false };
}

/** Awaited portable custom runner. Importing schedules no native test cases. */
export async function runHeroAdaptationTests() {
  assert.equal(cases.length, 17); for (const { run } of cases) await run();
  console.log('ok - hero adaptation: 17 portable cases; pinned source, URLs/actions/images/plain settings/words/schema/IDs/notices/inert Buffers/integrity and preserved JSON');
  return { suite: 'hero-adaptation', tests: cases.length, passed: cases.length, mode: 'portable-pinned-source', browserValidated: false, publicationApproved: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { test } = await import('node:test');
  for (const { name, run } of cases) test(name, run);
  const cli = process.argv.slice(2);
  if (cli.includes('--local-build')) {
    test('explicit local build: two fresh immutable revisions, real CSS AST/file-port audits/trusted closure, no source edits', async () => {
      assert.deepEqual(cli, ['--local-build']);
      const source = createAdaptationCollector(); const camap = join(PROJECT, '..', 'CAMAP2');
      await source.add(camap, SHARED_SOURCE_PATH); await source.add(camap, 'tools/prepare-joomla-modules.js'); await source.add(camap, 'package.json');
      for (const { folder } of ADOPTION_MODULES) { const directory = `extensions/camap/${folder}`; for (const entry of await source.list(camap, directory)) if (entry.isFile() && /\.(js|css)$/.test(entry.name)) await source.add(camap, `${directory}/${entry.name}`); }
      const dependencies = await collectAdaptationDependencies(join(PROJECT, 'tmp/step2/camap-source'));
      const require = createRequire(join(PROJECT, 'tmp/step2/camap-source/package.json'));
      const css = require('css-tree');
      const oldAst = css.parse(CSS_SOURCE, { positions: false }); const newAst = css.parse(overlay.files.get(HERO_CSS_PATH).toString(), { positions: false });
      oldAst.children.appendList(css.parse(HERO_CSS_APPEND, { positions: false }).children);
      assert.equal(css.generate(oldAst), css.generate(newAst), 'real CSS AST only approved append, original declarations unchanged');
      const api = createAdaptationCollector(); for (const path of ADAPTATION_API_FILES) await api.add(PROJECT, path); await api.add(PROJECT, CHANGES_LICENSE_PATH);
      const originalMit = await readFile(join(PROJECT, '..', 'LICENSE'));
      const container = await mkdtemp(join(PROJECT, 'tmp/hero-adapt-agent-tests-')); const receipts = []; const params = [];
      for (const version of ['0.3.0', '0.3.1']) {
        const output = `${relative(PROJECT, container).replaceAll('\\', '/')}/${version}`; const options = { version, base: `/offline/hero/${version}`, output };
        const built = await prepareHeroAdaptation(options); receipts.push({ ...await auditHeroAdaptationPackage(output, version), sourceFiles: built.originalSourceFiles, dependencyFiles: built.dependencyFiles }); params.push(built.descriptor.params);
        await assert.rejects(prepareHeroAdaptation(options), /existing output/);
        await assert.rejects(prepareHeroAdaptation({ ...options, sourceRoot: built.snapshot, output: `${output}-override-rejected` }), /trusted CAMAP copy/);
      }
      await Promise.all([source.check(), dependencies.check(), api.check()]); assert.deepEqual(await readFile(join(PROJECT, '..', 'LICENSE')), originalMit); assert.deepEqual(params[0], params[1]); assert.notEqual(receipts[0].inventoryHash, receipts[1].inventoryHash);
      console.log(JSON.stringify({ output: container, receipts }, null, 2));
    });
  } else if (cli.length) {
    test('explicit read-only package audits', async () => { assert.equal(cli.length, 3); assert.equal(cli[0], '--packages'); for (let i = 0; i < 2; i++) console.log(JSON.stringify(await auditHeroAdaptationPackage(cli[i + 1], ['0.3.0', '0.3.1'][i]))); });
  }
}
