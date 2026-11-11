/* SPDX-License-Identifier: GPL-2.0-or-later
 * Complete pinned source DATA; portable tests never read CAMAP or use network.
 * GPL covers authored tests/changes; embedded originals retain scoped MIT provenance.
 * --local-build opts into new private offline outputs, not installation.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import {
  applyShowcaseOverlay, finalizeShowcasePackage, prepareShowcaseAdaptation, parseShowcaseAdaptationArgs,
  SHOWCASE_ANCHORS, SHOWCASE_SOURCE_PATH, SHOWCASE_CSS_PATH, SHOWCASE_API_SHA256, SHOWCASE_DEFAULTS,
  SHARED_SOURCE_PATH, SHOWCASE_VALIDATION_SOURCE, SHOWCASE_STATIC_SPHERE_SOURCE, SHOWCASE_CSS_APPEND, showcaseAdaptationXml, sha256,
  INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256
} from '../scripts/prepare-showcase-adaptation.js';
import { SAFE_URL_SOURCE, readAdaptationFiles, createAdaptationCollector, collectAdaptationDependencies, ADAPTATION_API_FILES, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES, ADAPTATION_ORIGIN_COMMIT } from '../scripts/prepare-editorial-adaptation.js';
import { ADOPTION_MODULES, validateAdoptionSchema } from '../scripts/prepare-module-adoption.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { parseJsonObject, normalizeParamValues } from '../src/libraries/minijoomla/application/declared-params.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELEMENT = 'mod_showcase'; const KEY = `camap.${ELEMENT}`;
const LIB = `libraries/camap/${SHOWCASE_SOURCE_PATH}`; const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${ELEMENT}/css/showcase.css`; const ENTRY = `modules/${ELEMENT}/${ELEMENT}.js`; const XML = `modules/${ELEMENT}/${ELEMENT}.xml`;
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(bytes.toString().replace(/\r\n?/g, '\n'));
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cases = []; const registerCase = (name, run) => cases.push({ name, run });
// Full original 257-line module and 55-line CSS. BOM/LF are significant.
// Decompression is data storage only; exact SHA-256 gates precede imports.
const MODULE_GZIP = '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';
const CSS_GZIP = 'H4sIAAAAAAAACsVYzW7jNhC+71MQDRawFqZXkmMjpi4FtuihQE/pobcFJY5kNvwRSDq2a+TJeugj9RUKUj/xD+007QJFECcgh8Ph8Pu+GfqvP/6cVVTSFtu13lbUwgHj0wHc0JZkBmRxMWMo4xtLsrzdXU6W2jAwxDQlnaRT/zPL8iRi15C7uq4vJ+qG3GVZdjkhNw7YieNlzDGtKlCO3KXpMl89XM4Lrp7G2UoLbcgzNZNIHMnLh7Msff26BsrAHCQ1DVe41M5pGdIUsXXcCehNSYpSNJsvfEJrrRy2/Hcg2ezeDwiuAK+BN2tHslkeccWVM3p0dSvskKXk5cOlj8ZwNr0YldRqZfYHxm0r6J54q8LffdR7Q9uk8CbYgWwFdYArLTZSWWKgBeom0WW9zXSeTCVXku4m6TSrTZK8fPheAuMUTSTd4S1nbk1WD2m7Sw7vjP9mUPn5trF9l/ffbt+sNi+xO+AO5KGk1VNj9EaxeJLLJil6GmXtDlktOENxy2A1WA/EjJp2c0mhn8HUQm/JmjMGqpBc9edPI7jzZDmDxsl5jd5aQjdOo6w2wdcA4zT92MOUqzUY7goHO4cZVNpQx7UiSiu4siVZ+zBRNH24o9W5t41iYDyRIi7DVR+n/a7O63m9iBFN0gbGE5dCV09Fl55wouF0HqKFLn+DyuGaO1L5eCPuSs32h5YyxlVDZisDEl0RCwmOjvvWAnaF/8BbQ1viPwInZ0E/TsXnQlRmD2HgH2jErfzelq10EdGtWD4Z2Op9uvX5E/q54xZBVAi99dDntBSAbEuVRc+cokpQa9Gnz5E8HvPSIxMHtDNQForXwQBcX8FiV9G5iMOvc2z0lvhoUB5T65sOMLbnTrLl+51I9g0iEc2Zk3lMBK47CWQZALBMfTb9/X2hRm8sCIK+PD4iWxktBLKKtmiiNPrpETFoQTFQ1T6JXmLVOzicqVWsyBpaxSTq9eo7TT4aHUS6rwnxitVHgEOiRpGc5qE4hSryRpUcQse7IJBFrwIjbfNAoS452CcHu30LZIckVYw6bfYF3kL5xB0eXXXWXkuc3lTra+kgZFjZLSipGW8pjUL+2jLs1htZHkvncf+Vn1ee1WoVcY/HbF6h1HESqOCNItZR4zowPbZrMECQ5bIVgIx21HHVIOM/PJ7mPySzKIpsWHno5Dt6UZ1FELXpIvc3W7z2A0HwqW29xociQ7LPWezA7yzWrbY8lCwDgjr+DJc1edBeD5zIbQ1hO08/wa3D1u0FhIo6Lh4A5/8bdqSl1WLjoODKgiNpcVLoru8UbunSi4DakUX6sXC67f4aqmytjSThmiDOLaoaAUmCgrVvI36N2/UtS4J6ZxUV1QRn6FM8v73b5DUKrA33ufAPgmh57o930uVwFcpaV/rH0h1KIJotPWf/OwTO+ZQvFtPhd/aw7AyY0S2uuXBgSCk2ZjL3+LxRQv0xkmibVWzX3Hm408qjJPQTRw3DKt6SHGWna8huNV1DP90aqMFYbIBtKmBY6j4K3M2AqiDSZJ9Amiouuw3OERGAgPJ7i/yu1CCuaq64A9/RP8G+NlSCRdFlh9poebiAaMqgSV6cvpyZL7u5Tod+4RL8plGpcf3ku9g48D/6dOz8EVJCrQ0cKq2cf9Z+912EzYGH2X27C0RMi77EpH3n6t/pVxQ8W8TawGH3M96PenXjQTDU1vyh3aGTR1cxfqEwpgKl17rhMQJJzROYXsPDNw5DIctH1p0x8Y3XVff9QDJ00T5jfcfcj4RsPsTL5BBWRQ37f99xQxLfSiDzyI9q2/tfDNGXx63Nu6fEv5KsN92+LUmetT/qauOfDJaXXHC3j7AXUVJ7KxysBBz0xgXuzcdL6ymzephmi3w6my+SojfCuq59KZ17vPwNL8tKhlcTAAA=';
const SHARED_GZIP = 'H4sIAAAAAAAACnWSsY7UMBCGe55i5EU7sbQkBRWbTbagoeEaRHV76EwyyVk4trEnK9DeSrwLEh0VHRQU+ya8AK9wcvbugNXR/SOPP39j+/ePn/TBu8DQjbZh7SxQbJSnFzyYbKvMSFABooQdBOIxWHjFQdv+uCbzQN6ohrLifL6qBV4U/QIaqGrIdjjHJc7V4Etc4CplwynWKfZTFCm+H10qBIolzmdPn5W4P28upCxh/+hULqqOXodbswV0ypi3qnmXHGeTZONsZIhQ/eMJ63UaIuegh0yWd6MUb7LZ9aa4vmL2cbkpNoUsdM4UOYsS1hBheX/EgzasmF5SjKqnbCoWQIPnj8nnjOzVOCQhpsP31kGro3f28HVLJp9cdQfHXVBVFaBxqtW2R3mnhysPwRmqROoaowAVtHpi9JYq4Z3RTKJ+rkKgXtnW/fr0ZVX4GstTMIXgwkNYZSiwqM8Onx10ToN3MU5+0BypASgywXD41o7G5f/Bp4n/4C9PrevHu7/+1NQt9wl1ef8QiOl6bwCSArXRjQIAAA==';
const originals = new Map([[SHOWCASE_SOURCE_PATH, MODULE_GZIP], [SHOWCASE_CSS_PATH, CSS_GZIP], [SHARED_SOURCE_PATH, SHARED_GZIP]].map(([path, gzip]) => [path, gunzipSync(Buffer.from(gzip, 'base64'))]));
for (const [path, bytes] of originals) assert.equal(sha256(bytes), SHOWCASE_ANCHORS[path][1], path);
const overlay = applyShowcaseOverlay(originals);
function moduleUrl(files) {
  const source = files.get(SHOWCASE_SOURCE_PATH).toString(); const anchor = "from '../_shared/render.js';";
  assert.equal(source.split(anchor).length, 2);
  return dataUrl(source.replace(anchor, () => `from '${dataUrl(files.get(SHARED_SOURCE_PATH))}';`));
}
const loaded = await import(moduleUrl(overlay.files)); const prior = await import(moduleUrl(originals));
const shared = await import(dataUrl(overlay.files.get(SHARED_SOURCE_PATH)));
const render = loaded.renderShowcase;
const declaredStaticSphereHtml = html => html.replaceAll(/ style="--camap-showcase-angle:[^"]+"/g, '').replace('aria-label="Nuvem de links"', 'aria-label="Lista de links"');
const declaredFocusableTrackHtml = html => html.includes('<a class="camap-showcase__link"') ? html : html.replace('<div class="camap-showcase__track" style=', '<div class="camap-showcase__track" tabindex="0" style=');
const MODES = ['list', 'carousel', 'masonry', 'sphere', 'timeline'];
const valid = (title = 'Local <&', extra = {}) => ({ title, url: '/local/resource', category: 'Category <&', ...extra });
const count = (html, pattern) => (html.match(pattern) ?? []).length;
const descriptor = parseJoomlaManifest(showcaseAdaptationXml('0.5.0'), { baseUrl: '/offline/showcase/0.5.0', manifestPath: XML });
const mitFixture = await readFile(join(PROJECT, 'tests/recursos-adaptation.test.js'), 'utf8');
const mit = Buffer.from(mitFixture.split('const mit = Buffer.from(`')[1].split('`);')[0]);
assert.equal(sha256(mit), ADAPTATION_MIT_HASHES[1]);
const gpl = await readFile(join(PROJECT, CHANGES_LICENSE_PATH)); assert.equal(sha256(gpl), CHANGES_LICENSE_SHA256);
function provenance() {
  const snapshot = [...originals].map(([path, bytes]) => ({ path, originalSha256: sha256(bytes), snapshotSha256: sha256(overlay.files.get(path)), bytes: bytes.length }));
  for (const path of ['tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.filter(({ folder }) => folder !== ELEMENT).map(({ folder }) => `extensions/camap/${folder}/module.js`)]) {
    // Metadata fixtures only; explicit local audit checks the real snapshot.
    const hash = path.startsWith('tools/') ? ADAPTATION_GENERATOR_HASHES[0] : sha256(Buffer.from(`inert fixture metadata: ${path}`));
    snapshot.push({ path, originalSha256: hash, snapshotSha256: hash, bytes: 0 });
  }
  return { changes: structuredClone(overlay.changes), licenses: [], generatorSha256: ADAPTATION_GENERATOR_HASHES[0], adoptionApiSha256: SHOWCASE_API_SHA256, snapshot,
    inheritedLicenseBytes: mit, inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: [SHOWCASE_SOURCE_PATH, SHARED_SOURCE_PATH, SHOWCASE_CSS_PATH], globalVendorRightsApproved: false, evidence: 'Portable exact historical notice; explicit audit checks local originals.' },
    changesLicenseBytes: gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' } };
}
function rebuildInventory(files, version = '0.5.0') {
  const base = `/offline/showcase/${version}`;
  const inv = json({ format: 'minijoomla-joomla-package-v1', version, moduleKeys: { [ELEMENT]: KEY }, moduleStyles: { [KEY]: [CSS] }, files: [...files].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) });
  files.set('MANIFEST-SHA256.json', inv);
  files.set('host-config.json', json({ joomlaDiscoveryRoots: [{ id: `camap-${ELEMENT}-${version}`, baseUrl: base, inventoryHash: sha256(inv), immutable: true, discover: true }], moduleStyles: { [KEY]: [`${base}/${CSS}`] }, moduleStyleRevisions: { [KEY]: { [`${base}/${ENTRY}`]: [`${base}/${CSS}`] } } }));
  return files;
}
function stagedFixture(version = '0.5.0') {
  return rebuildInventory(new Map([[LIB, overlay.files.get(SHOWCASE_SOURCE_PATH)], [SHARED, overlay.files.get(SHARED_SOURCE_PATH)], [CSS, overlay.files.get(SHOWCASE_CSS_PATH)], [ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`)], [XML, showcaseAdaptationXml(version)], ['docs/ADOPTION-NOTICE.md', Buffer.from('Offline fixture\n')], ['adoption-plan.json', json({ format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module: ELEMENT, key: KEY, version, base: `/offline/showcase/${version}`, pilot: false, validation: 'Portable fixture', licenses: [], sourceLicensePresent: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), nextGate: 'Coordinator review', hostNote: 'One root only' })]]), version);
}

registerCase('complete original source pins and schema/defaults unchanged', () => {
  assert.equal(originals.get(SHOWCASE_SOURCE_PATH).toString().split('\n').length - 1, 257);
  assert.equal(originals.get(SHOWCASE_CSS_PATH).toString().split('\n').length, 56);
  assert.deepEqual(loaded.defaults, prior.defaults); assert.deepEqual(loaded.defaults, SHOWCASE_DEFAULTS); assert.deepEqual(loaded.settingsSchema, prior.settingsSchema);
  assert.equal(loaded.default.name, KEY); assert.equal(loaded.default.settings, loaded.defaults); assert.equal(loaded.default.settingsSchema, loaded.settingsSchema);
  assert.equal(overlay.files.size, 3); assert.equal(overlay.changes.length, 3);
  assert.equal(overlay.files.get(SHARED_SOURCE_PATH).toString().replace(SAFE_URL_SOURCE, originals.get(SHARED_SOURCE_PATH).toString().split('\n')[1]), originals.get(SHARED_SOURCE_PATH).toString());
  assert.equal(overlay.files.get(SHOWCASE_CSS_PATH).toString().replace(SHOWCASE_CSS_APPEND + '\n', ''), originals.get(SHOWCASE_CSS_PATH).toString());
  assert.ok(overlay.files.get(SHOWCASE_SOURCE_PATH).toString().includes(SHOWCASE_VALIDATION_SOURCE));
  const originalSource = originals.get(SHOWCASE_SOURCE_PATH).toString();
  const normalizers = originalSource.slice(originalSource.indexOf('function normalizeMode(value) {'), originalSource.indexOf('function renderHeader({ title, introText }) {'));
  const config = originalSource.slice(originalSource.indexOf('  const c = {', originalSource.indexOf('export function renderShowcase')), originalSource.indexOf('  const items = normalizeItems(c.items);'));
  const sphere = originalSource.slice(originalSource.indexOf('function renderSphere(items, { sphereSize }) {'), originalSource.indexOf('function renderTimeline(items, { label }) {'));
  let reverted = overlay.files.get(SHOWCASE_SOURCE_PATH).toString();
  for (const [from, to] of [
    [SHOWCASE_VALIDATION_SOURCE + '\n\n', normalizers],
    [SHOWCASE_STATIC_SPHERE_SOURCE + '\n\n', sphere.replaceAll('const href = safeUrl(item.url);', 'const href = item.url;').replaceAll("href !== '#'", '!!href')],
    ['  const c = _showcaseSettings(settings);\n\n', config],
    ['const t = title.trim();', "const t = String(title ?? '').trim();"],
    ['const intro = introText.trim();', "const intro = String(introText ?? '').trim();"],
    ['const src = item.imageUrl;', "const src = safeUrl(item.imageUrl, '');"],
    ["const label = title.trim() ? escapeHtml(title.trim()) : 'Showcase';", "const label = title ? escapeHtml(title) : 'Showcase';"],
    ['  const focusAttr = items.some(item => !!item.url) ? \'\' : \' tabindex="0"\';\n', ''],
    ['<div class="camap-showcase__track"${focusAttr} style=', '<div class="camap-showcase__track" style='],
    ['render: (context = {}) => _showcaseContext(context)', 'render: ({ settings, state } = {}) => renderShowcase(settings, state)']
  ]) { assert.equal(reverted.split(from).length, 2); reverted = reverted.replace(from, () => to); }
  assert.equal(count(reverted, /const href = item\.url;/g), 3); assert.equal(count(reverted, /!!href/g), 3);
  reverted = reverted.replaceAll('const href = item.url;', 'const href = safeUrl(item.url);').replaceAll('!!href', "href !== '#'");
  assert.equal(reverted, originalSource, 'complete original runtime bytes retained outside declared patches');
  const raw = new Map([...originals].map(([path, bytes]) => [path, Buffer.from(bytes.toString().replace(/\n$/, '\r\n'))]));
  const rawOverlay = applyShowcaseOverlay(raw);
  for (const change of rawOverlay.changes) {
    assert.equal(change.originalSha256, SHOWCASE_ANCHORS[change.path][0]); assert.equal(change.bom, true); assert.equal(change.lineEndings, 'mixed LF/CRLF preserved');
    assert.equal(change.generatedSha256, sha256(overlay.files.get(change.path))); assert.deepEqual(lf(rawOverlay.files.get(change.path)), overlay.files.get(change.path));
  }
});
registerCase('exact eight ordered XML fields, full constraints and five modes', () => {
  validateAdoptionSchema(descriptor, loaded);
  assert.deepEqual(descriptor.params.map(p => p.name), ['title', 'introText', 'mode', 'items', 'columns', 'carouselItemMinWidth', 'sphereSize', 'timelineLabel']);
  assert.deepEqual(descriptor.params[2].options.map(p => p.value), MODES);
  assert.deepEqual(descriptor.params.map(p => p.default), Object.values(SHOWCASE_DEFAULTS));
  assert.equal(descriptor.params[0].maxLength, 120); assert.equal(descriptor.params[1].maxLength, 800); assert.equal(descriptor.params[7].maxLength, 120);
  for (const [index, min, max] of [[4, 1, 6], [5, 180, 560], [6, 240, 900]]) { assert.equal(descriptor.params[index].min, min); assert.equal(descriptor.params[index].max, max); }
  assert.deepEqual(parseJoomlaManifest(showcaseAdaptationXml('0.5.1'), { baseUrl: '/local', manifestPath: XML }).params, descriptor.params);
});
registerCase('all five modes match original except declared static sphere and track tabindex, with/without seed image', () => {
  for (const mode of MODES) for (const image of [false, true]) {
    const settings = { mode, title: 'Header <&', introText: 'Intro <&', items: [valid('One <&', { description: 'Desc <&', imageUrl: image ? '/local/seed.jpg' : '', imageAlt: 'Alt "<&', date: 'arbitrary "<&', extraInfo: 'Extra <&', size: 'sm' }), valid('Two', { url: '#/article/a', size: 'lg' })] };
    const expected = prior.renderShowcase(settings);
    assert.equal(render(settings), mode === 'sphere' ? declaredStaticSphereHtml(expected) : mode === 'carousel' ? declaredFocusableTrackHtml(expected) : expected, `${mode}/${image}`);
    assert.match(render(settings), new RegExp(`camap-showcase--${mode}`));
    assert.equal(count(render(settings), /<img /g), mode === 'sphere' || !image ? 0 : 1);
  }
});
registerCase('defaults and loading/error/empty/unknown state dispatch remain original', () => {
  for (const state of ['ready', 'loading', 'error', 'empty', 'unknown', '', null, false, 7, {}, Symbol('state')]) assert.equal(render({}, state), prior.renderShowcase({}, state));
  for (const mode of MODES) { assert.match(render({ mode }), /Nenhum conteúdo para exibir/); assert.match(render({ mode }, 'loading'), /camap-showcase--list/); }
  assert.match(render({}, 'loading'), /role="status" aria-live="polite"/); assert.match(render({}, 'error'), /role="alert"/);
});
registerCase('strict strings and mode checks without coercion', () => {
  for (const value of [null, undefined, false, 42, {}, [], Symbol('x')]) {
    const html = render({ title: value, introText: value, timelineLabel: value, mode: value, items: [valid()] });
    assert.match(html, /camap-showcase--list/); assert.doesNotMatch(html, /__title"|__intro"|\[object/);
  }
  assert.match(render({ mode: ' timeline ', timelineLabel: '', items: [valid()] }), /aria-label="Linha do tempo"/);
  assert.match(render({ mode: 'carousel', title: '   ', items: [valid()] }), /aria-roledescription="carousel" aria-label="Showcase"/);
});
registerCase('finite strict decimal numbers clamp and columns floor only at render', () => {
  const numberSettings = { items: [valid()], columns: '5.9', carouselItemMinWidth: '200.5', sphereSize: '500.5' };
  assert.match(render(numberSettings), /columns:5;/);
  assert.match(render({ ...numberSettings, mode: 'carousel' }), /min-width:201px;/);
  assert.match(render({ ...numberSettings, mode: 'sphere' }), /sphere-size:501px;/);
  for (const value of [null, false, true, '', ' ', ' 4 ', '0x10', '1e2', 'Infinity', 'NaN', undefined, NaN, Infinity, -Infinity, {}, [], 3n]) {
    assert.match(render({ items: [valid()], columns: value }), /columns:3;/);
    assert.match(render({ items: [valid()], mode: 'carousel', carouselItemMinWidth: value }), /min-width:280px;/);
    assert.match(render({ items: [valid()], mode: 'sphere', sphereSize: value }), /sphere-size:520px;/);
  }
  for (const [value, cols, width, size] of [[-1, 1, 180, 240], [9999, 6, 560, 900]]) {
    assert.match(render({ items: [valid()], columns: value }), new RegExp(`columns:${cols};`));
    assert.match(render({ items: [valid()], mode: 'carousel', carouselItemMinWidth: value }), new RegExp(`min-width:${width}px;`));
    assert.match(render({ items: [valid()], mode: 'sphere', sphereSize: value }), new RegExp(`sphere-size:${size}px;`));
  }
  assert.equal(numberSettings.columns, '5.9');
});
registerCase('safe URL bytes escaped once and dangerous link retains nonlink content in every mode', () => {
  for (const mode of MODES) for (const url of [undefined, null, false, 1, {}, [], '', '#', 'javascript:x', 'data:text/html,x', 'blob:x', '//evil.invalid', '/%252funsafe', 'http://example.invalid', 'https://u:p@example.invalid', ' /local']) {
    const html = render({ mode, items: [valid('Keep card', { url })] }); assert.match(html, /Keep card/); assert.doesNotMatch(html, /<a |href=|javascript:|data:|blob:/);
  }
  for (const mode of MODES) for (const url of ['#/article/x', '/local/a?x="y"&z=1', 'https://example.invalid/a', 'HTTPS://EXAMPLE.invalid/a']) {
    const html = render({ mode, items: [valid('Safe', { url })] }); assert.match(html, /<a /); assert.ok(html.includes(`href="${shared.escapeHtml(url)}"`));
  }
});
registerCase('unsafe/fragment image omits only media, keeps card without empty fallback source', () => {
  for (const mode of MODES) for (const imageUrl of [null, false, 1, {}, [], '', '#', '#/image.jpg', '/image.jpg#frag', 'https://example.invalid/i#frag', 'javascript:x', 'data:image/png,x', 'blob:x', '//evil.invalid/i', '/%255cunsafe', '/bad%', 'http://example.invalid/i']) {
    const html = render({ mode, items: [valid('Image card', { imageUrl })] }); assert.match(html, /Image card/); assert.doesNotMatch(html, /<img|src=/);
  }
  for (const imageUrl of ['/local/seed.jpg', 'https://example.invalid/image.jpg']) {
    assert.match(render({ items: [valid('Decorative', { imageUrl, imageAlt: '' })] }), /alt=""/);
    assert.match(render({ items: [valid('Alt', { imageUrl, imageAlt: '"<&' })] }), /alt="&quot;&lt;&amp;"/);
  }
});
registerCase('metadata plain strings escaped; arbitrary datetime text preserved; optional invalid fields omitted', () => {
  const item = valid(' T <& ', { description: ' D <& ', category: ' C <& ', date: ' not-a-date "<& ', extraInfo: ' E <& ', size: 'lg' });
  const html = render({ mode: 'timeline', items: [item] });
  assert.match(html, /datetime="not-a-date &quot;&lt;&amp;"/); assert.equal(count(html, /<time /g), 1); assert.match(html, />C &lt;&amp;</); assert.match(html, />E &lt;&amp;</);
  for (const field of ['description', 'imageAlt', 'category', 'date', 'extraInfo', 'size']) assert.match(render({ items: [valid('Retain', { [field]: {} })] }), /Retain/);
  for (const item of [null, false, 1, 'item', [], {}, { title: '' }, { title: '   ' }, { title: 5 }, Object.create({ title: 'Inherited' })]) assert.match(render({ items: [item] }), /Nenhum conteúdo/);
  assert.match(render({ items: [Object.assign(Object.create(null), { title: 'Own plain', future: true })] }), /Own plain/);
});
registerCase('array own length <=500 before descriptors, dense exact array with no extras/getters/symbols', () => {
  const items = Array.from({ length: 500 }, (_, i) => valid(`Item ${i}`));
  assert.equal(count(render({ items }), /<article /g), 500); assert.match(render({ items }), /Item 499/);
  for (const items of [Array(3), Array(501), new Array(2 ** 32 - 1), Object.assign([valid()], { extra: 1 }), Object.assign([valid()], { [Symbol('x')]: 1 })]) assert.match(render({ items }), /Nenhum conteúdo/);
  let calls = 0; const itemsGetter = Object.defineProperty([valid()], '0', { get() { calls++; throw Error('getter'); } });
  assert.match(render({ items: itemsGetter }), /Nenhum conteúdo/); assert.equal(calls, 0);
  const code = SHOWCASE_VALIDATION_SOURCE;
  assert.ok(code.indexOf('length > 500') < code.indexOf('Object.getOwnPropertyDescriptors(value)', code.indexOf('function normalizeItems')));
});
registerCase('getters, functions, toJSON/valueOf/toString never executed in settings/items/context', () => {
  let calls = 0; const bad = () => { calls++; throw Error('not invoked'); }; const evil = { toJSON: bad, valueOf: bad, toString: bad };
  for (const settings of [null, false, 1, [], evil, Object.create({ items: [valid()] }), Object.defineProperty({}, 'items', { get: bad }), Object.defineProperty({ items: [valid()] }, 'future', { get: bad })]) assert.doesNotThrow(() => render(settings));
  for (const name of ['title', 'introText', 'mode', 'columns', 'carouselItemMinWidth', 'sphereSize', 'timelineLabel', 'items']) assert.doesNotThrow(() => render({ [name]: evil }));
  for (const name of ['title', 'url', 'imageUrl', 'imageAlt', 'description', 'category', 'date', 'extraInfo', 'size', 'future']) assert.doesNotThrow(() => render({ items: [Object.defineProperty(valid(), name, { get: bad })] }));
  for (const context of [null, false, 1, [], evil, Object.defineProperty({}, 'settings', { get: bad }), Object.defineProperty({ settings: { items: [valid()] } }, 'state', { get: bad })]) assert.doesNotThrow(() => loaded.default.render(context));
  assert.doesNotThrow(() => render({ items: [valid()], future: Object.defineProperty({}, 'nested', { get: bad }) }, evil)); assert.equal(calls, 0);
});
registerCase('computed style is bounded numeric-only; static sphere emits no item geometry or arbitrary CSS', () => {
  const items = Array.from({ length: 500 }, (_, i) => valid(`Item ${i}`, { size: 'sm;background:red', angle: 'url(evil)', radius: Infinity }));
  const html = render({ mode: 'sphere', sphereSize: '900', items });
  assert.equal(count(html, /__sphere-item"/g), 500); assert.doesNotMatch(html, /NaN|Infinity|undefined|background:red|url\(evil\)/);
  assert.equal(count(html, /style=/g), 1); assert.doesNotMatch(html, /--camap-showcase-angle|--camap-showcase-radius|<li[^>]*style=/);
  for (const style of html.matchAll(/style="([^"]+)"/g)) assert.match(style[1], /^--camap-showcase-sphere-size:900px;$/);
});
registerCase('explicit static sphere preserves ordered title links/nonlinks and sphereSize width schema', () => {
  const settings = { mode: 'sphere', sphereSize: 240, items: [valid('First <&', { imageUrl: '/local/seed.jpg', description: 'Not a card here' }), valid('Second', { url: 'javascript:x' }), valid('Third', { url: '#/article/x' })], future: { keep: true } };
  const before = JSON.stringify(settings); const html = render(settings);
  assert.match(html, /role="region" aria-label="Lista de links"/); assert.match(html, /sphere-size:240px/);
  assert.equal(count(html, /<ul class="camap-showcase__sphere-stage">/g), 1); assert.equal(count(html, /<li class="camap-showcase__sphere-item">/g), 3);
  assert.equal(count(html, /<a class="camap-showcase__sphere-link"/g), 2); assert.match(html, /<span class="camap-showcase__sphere-link">Second<\/span>/);
  assert.ok(html.indexOf('First &lt;&amp;') < html.indexOf('Second') && html.indexOf('Second') < html.indexOf('Third'));
  assert.doesNotMatch(html, /<img|Not a card here|--camap-showcase-angle|--camap-showcase-radius|\sid=|<button|<script/);
  assert.equal(JSON.stringify(settings), before); assert.deepEqual(loaded.settingsSchema.fields.sphereSize, prior.settingsSchema.fields.sphereSize);
  assert.ok(overlay.files.get(SHOWCASE_SOURCE_PATH).toString().includes(SHOWCASE_STATIC_SPHERE_SOURCE));
  assert.doesNotMatch(SHOWCASE_STATIC_SPHERE_SOURCE, /toFixed|radius|angle|transform|setInterval|requestAnimationFrame|document\./);
});
registerCase('static sphere CSS disables motion unconditionally and uses wrapping normal-flow single-column list', () => {
  assert.match(SHOWCASE_CSS_APPEND, /__sphere\{aspect-ratio:auto;overflow:visible;border-radius:0;box-sizing:border-box\}/);
  assert.match(SHOWCASE_CSS_APPEND, /__sphere-stage\{position:static;display:grid;grid-template-columns:minmax\(0,1fr\);gap:\.5rem;padding:\.5rem;animation:none\}/);
  assert.match(SHOWCASE_CSS_APPEND, /__sphere-item\{position:static;transform:none;min-width:0\}/);
  assert.match(SHOWCASE_CSS_APPEND, /__sphere-link\{white-space:normal;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere\}/);
  const sphereAppend = SHOWCASE_CSS_APPEND.slice(SHOWCASE_CSS_APPEND.indexOf('.camap-showcase__sphere{'));
  assert.doesNotMatch(sphereAppend, /@media|@container|@keyframes|rotate\(|translate|3d|perspective|animation-play-state/);
  const html = render({ mode: 'sphere', sphereSize: 900, items: Array.from({ length: 500 }, (_, i) => valid(`Item ${i} ` + 'LongLabel'.repeat(20))) });
  assert.equal(count(html, /<li /g), 500); assert.match(html, /Item 499/); assert.equal(count(html, /style=/g), 1);
});
registerCase('repeated module instances introduce no global IDs; escaping does not create attributes', () => {
  const html = MODES.map(mode => render({ mode, title: '" onmouseover="x <&', timelineLabel: '" onclick="x <&', items: [valid('" onclick="x <&')] })).join('');
  assert.doesNotMatch(html, /\sid=|aria-labelledby|" onclick="|" onmouseover="/); assert.match(html, /&quot; onclick=&quot;x &lt;&amp;/);
  assert.equal(count(html, /<section /g), 5);
});
registerCase('declared scoped CSS keeps original, fixes masonry rows/native track/focus/narrow root', () => {
  assert.equal(overlay.files.get(SHOWCASE_CSS_PATH).toString(), originals.get(SHOWCASE_CSS_PATH).toString() + SHOWCASE_CSS_APPEND + '\n');
  assert.match(SHOWCASE_CSS_APPEND, /grid-auto-flow:row;grid-auto-rows:auto/); assert.match(SHOWCASE_CSS_APPEND, /__item\{grid-row:auto\}/);
  assert.match(SHOWCASE_CSS_APPEND, /minmax\(min\(var\(--camap-showcase-carousel-item-min-width,280px\),100%\),1fr\)/);
  assert.match(SHOWCASE_CSS_APPEND, /outline:3px solid #006298;outline-offset:-3px/); assert.match(SHOWCASE_CSS_APPEND, /@container\(max-width:400px\)/);
  assert.doesNotMatch(SHOWCASE_CSS_APPEND, /@import|url\(|:root|body\{|overflow:hidden/);
  assert.equal(count(SHOWCASE_CSS_APPEND, /border-radius:/g), 1); assert.match(SHOWCASE_CSS_APPEND, /__sphere\{[^}]*border-radius:0/);
  assert.match(originals.get(SHOWCASE_CSS_PATH).toString(), /scroll-snap-type:x mandatory/);
  // Original bytes remain, but the later equally specific unconditional override
  // disables their animation for either motion preference.
  assert.match(originals.get(SHOWCASE_CSS_PATH).toString(), /animation:camap-showcase-rotate 24s linear infinite/);
  assert.match(SHOWCASE_CSS_APPEND, /sphere-stage\{[^}]*animation:none/);
});
registerCase('carousel focus-within adds one final scoped four-declaration rule; schema and HTML except track tabindex unchanged', () => {
  const rule = '.camap-showcase__track:focus-within{grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:minmax(0,1fr);scroll-snap-type:none}';
  assert.equal(count(SHOWCASE_CSS_APPEND, /:focus-within/g), 1); assert.ok(SHOWCASE_CSS_APPEND.endsWith('\n' + rule));
  const selector = rule.slice(0, rule.indexOf('{')); const declarations = rule.slice(rule.indexOf('{') + 1, -1).split(';');
  assert.equal(selector, '.camap-showcase__track:focus-within');
  assert.deepEqual(declarations, ['grid-auto-flow:row', 'grid-auto-columns:auto', 'grid-template-columns:minmax(0,1fr)', 'scroll-snap-type:none']);
  assert.doesNotMatch(rule, /(?:^|;)width:|font|min-height|!important|@|animation|overflow|padding/);
  assert.match(originals.get(SHOWCASE_CSS_PATH).toString(), /__track\{display:grid;grid-auto-flow:column;[^}]*scroll-snap-type:x mandatory/);
  const settings = { mode: 'carousel', carouselItemMinWidth: 560, items: Array.from({ length: 4 }, (_, i) => valid(`Card ${i}`)) }; const before = JSON.stringify(settings);
  assert.equal(render(settings), declaredFocusableTrackHtml(prior.renderShowcase(settings))); assert.equal(JSON.stringify(settings), before);
  assert.match(render(settings), /--camap-showcase-carousel-item-min-width:560px;/); assert.equal(count(render(settings), /<article /g), 4);
  assert.doesNotMatch(overlay.files.get(SHOWCASE_SOURCE_PATH).toString(), /addEventListener|scrollIntoView|requestAnimationFrame|document\.|setTimeout/);
  assert.deepEqual(loaded.settingsSchema.fields.carouselItemMinWidth, prior.settingsSchema.fields.carouselItemMinWidth);
});
registerCase('conditional track tabindex permits wholly nonlink carousel focus without new settings, controls, IDs or listeners', () => {
  for (const length of [2, 4]) {
    const settings = { mode: 'carousel', title: 'Nonlink collection <&', items: Array.from({ length }, (_, i) => valid(`Full card ${i}`, { url: i % 2 ? 'javascript:x' : '', description: `Full description ${i}` })) }; const before = JSON.stringify(settings);
    const html = render(settings);
    assert.equal(count(html, /tabindex="0"/g), 1); assert.match(html, /<div class="camap-showcase__track" tabindex="0" style=/);
    assert.match(html, /role="region" aria-roledescription="carousel" aria-label="Nonlink collection &lt;&amp;"/);
    assert.equal(count(html, /<article /g), length); assert.doesNotMatch(html, /<a |href=|<button|\sid=|tabindex="[1-9]|<script/);
    for (let index = 0; index < length; index++) { assert.ok(html.includes(`Full card ${index}`)); assert.ok(html.includes(`Full description ${index}`)); }
    assert.equal(JSON.stringify(settings), before);
  }
  for (const mode of MODES.filter(mode => mode !== 'carousel')) assert.doesNotMatch(render({ mode, items: [valid()] }), /tabindex=/);
  assert.equal(count(overlay.files.get(SHOWCASE_SOURCE_PATH).toString(), /tabindex="0"/g), 1);
});
registerCase('link-containing and mixed carousel omit track tabindex; only normalized nonlinks receive the tab stop', () => {
  for (const urls of [['/local/0', '/local/1', '/local/2', '/local/3'], ['', 'javascript:x', '#/article/a', ''], ['data:x', 'https://example.invalid/a', '#', null]]) {
    const settings = { mode: 'carousel', items: urls.map((url, index) => valid(`Card ${index}`, { url, description: `Body ${index}` })) }; const before = JSON.stringify(settings); const html = render(settings);
    assert.doesNotMatch(html, /tabindex=/); assert.equal(count(html, /<article /g), 4);
    const expectedLinks = urls.filter(url => typeof url === 'string' && url !== '#' && shared.safeUrl(url) === url).length;
    assert.equal(count(html, /<a class="camap-showcase__link"/g), expectedLinks);
    for (let index = 0; index < 4; index++) { assert.ok(html.includes(`Card ${index}`)); assert.ok(html.includes(`Body ${index}`)); }
    assert.equal(JSON.stringify(settings), before);
  }
  for (const urls of [['', '#', 'javascript:x', 'data:x'], [null, {}, undefined, '//unsafe.invalid']]) {
    const html = render({ mode: 'carousel', items: urls.map((url, index) => valid(`Nonlink ${index}`, { url })) });
    assert.equal(count(html, /tabindex="0"/g), 1); assert.doesNotMatch(html, /<a |tabindex="-1"|tabindex="[1-9]/);
  }
  const source = overlay.files.get(SHOWCASE_SOURCE_PATH).toString();
  assert.ok(source.includes('const focusAttr = items.some(item => !!item.url) ? \'\' : \' tabindex="0"\';'));
  assert.ok(source.includes('<div class="camap-showcase__track"${focusAttr} style='));
  assert.doesNotMatch(source, /<div class="camap-showcase__track" tabindex="0" style=/);
  assert.equal(sha256(overlay.files.get(SHOWCASE_CSS_PATH)), '89ca9c910fe1f13ad94c7a1d766899d5ec5b54b240f76ad8f7f967bd0d960292', 'CSS unchanged from 0.4.x');
});
registerCase('stored malformed JSON and undeclared keys survive renderer and unrelated admin update', async () => {
  const settingsJson = '{"mode":"masonry","columns":2.7,"items":[{"title":"Keep","url":"javascript:x","imageUrl":"data:x","future":true}],"future":{"keep":[true]},"__proto__":{"preserved":true}}';
  let record = { id: 101, title: 'Local', extensionKey: KEY, position: 'main-top', ordering: 2, enabled: true, scopeKind: 'All', assignment: 'all', assignmentJson: '[]', settingsJson, etag: 'local-etag' };
  const writes = []; const service = createAdminService({ moduleInstances: { async findMany() { return { items: [structuredClone(record)] }; }, async findById() { return structuredClone(record); }, async update(id, patch) { writes.push(patch); record = { ...record, ...patch }; return structuredClone(record); } }, extensions: { async findMany() { return { items: [{ key: KEY, type: 'Module', enabled: true, manifestJson: descriptor.manifestJson }] }; } } });
  const stored = JSON.parse(settingsJson); const before = JSON.stringify(stored); render(stored); assert.equal(JSON.stringify(stored), before);
  await service.moduleInstances.update(101, { enabled: false }, { etag: 'local-etag' }); assert.equal(record.settingsJson, settingsJson); assert.equal(Object.hasOwn(writes[0], 'settingsJson'), false);
  const normalized = normalizeParamValues(descriptor.params, parseJsonObject(settingsJson, { strict: true }), { keepUndeclared: true });
  assert.deepEqual(normalized.items, stored.items); assert.equal(normalized.columns, 2.7); assert.deepEqual(normalized.future, { keep: [true] }); assert.equal(Object.hasOwn(normalized, '__proto__'), true);
});
registerCase('closed CLI only Showcase 0.5.0/0.5.1; immutable 0.3.x/0.4.x refused and invalid options inert', async () => {
  const base = ['--base', '/offline/showcase/0.5.0', '--output', 'tmp/showcase-adapt-agent-portable'];
  assert.equal(parseShowcaseAdaptationArgs(base).version, '0.5.0'); assert.deepEqual(parseShowcaseAdaptationArgs(['--help']), { help: true });
  for (const module of ['all', 'mod_hero', 'mod_camap_showcase', 'mod_camap_corpmessage']) assert.throws(() => parseShowcaseAdaptationArgs([...base, '--module', module]));
  for (const version of ['0.2.0', '0.3.0', '0.3.1', '0.3.2', '0.4.0', '0.4.1', '0.4.2', '0.5.2', '01.5.0']) { assert.throws(() => parseShowcaseAdaptationArgs([...base, '--version', version])); assert.throws(() => showcaseAdaptationXml(version)); }
  for (const output of ['public/package', 'tmp/foreign', 'tmp/showcase-adapt-agent-x/../y', 'tmp/showcase-adapt-agent-x/con', 'tmp/showcase-adapt-agent-x/aux.']) assert.throws(() => parseShowcaseAdaptationArgs(['--base', '/local', '--output', output]));
  for (const extra of [['--source', '../other'], ['--source', 'tmp/step2/camap-source'], ['--source', base[3] + '/source'], ['--dependencies-root', '../other'], ['--inherited-license', '../other'], ['--inherited-license', base[3] + '/LICENSE'], ['--profile', 'arbitrary'], ['--patches', 'evil'], ['--base', '/duplicate']]) assert.throws(() => parseShowcaseAdaptationArgs([...base, ...extra]));
  let calls = 0; await assert.rejects(prepareShowcaseAdaptation(Object.defineProperty({}, 'base', { get() { calls++; } })), /accessor/);
  await assert.rejects(prepareShowcaseAdaptation({ ...parseShowcaseAdaptationArgs(base), hashes: {} }), /Unknown/); await assert.rejects(prepareShowcaseAdaptation({ toJSON() { calls++; } }), /plain metadata/); assert.equal(calls, 0);
});
registerCase('overlay refuses byte changes, native Map hooks and Buffer hooks without callbacks', () => {
  for (const path of originals.keys()) { const bad = new Map(originals); bad.set(path, Buffer.concat([bad.get(path), Buffer.from('//foreign')])); assert.throws(() => applyShowcaseOverlay(bad), /Unapproved original/); }
  for (const map of [new Map(), new Map([...originals, ['foreign', Buffer.alloc(0)]]), Object.create(Map.prototype)]) assert.throws(() => applyShowcaseOverlay(map));
  let calls = 0; const hook = () => { calls++; throw Error('not invoked'); };
  for (const name of ['size', 'get', 'has', 'entries', Symbol.iterator]) { const bad = new Map(originals); Object.defineProperty(bad, name, { get: hook }); assert.throws(() => applyShowcaseOverlay(bad), /native Map/); }
  for (const name of ['length', 'toString', 'toJSON', Symbol.iterator]) { const bad = new Map(originals); const bytes = Buffer.from(originals.get(SHOWCASE_SOURCE_PATH)); Object.defineProperty(bytes, name, { get: hook }); bad.set(SHOWCASE_SOURCE_PATH, bytes); assert.throws(() => applyShowcaseOverlay(bad), /Buffer/); }
  assert.equal(calls, 0);
});
registerCase('positive exact finalizer: 5 runtime/11 payload/13 total, notices, false flags and reproducibility', () => {
  const hashes = [];
  for (const version of ['0.5.0', '0.5.1']) {
    const staged = stagedFixture(version); const before = Buffer.from(staged.get('MANIFEST-SHA256.json'));
    const final = finalizeShowcasePackage(staged, provenance()); assert.deepEqual(staged.get('MANIFEST-SHA256.json'), before);
    assert.equal(final.files.size, 13); assert.equal(final.inventory.files.length, 11); assert.equal(final.adaptation.snapshot.filter(e => e.originalSha256 !== e.snapshotSha256).length, 3);
    assert.deepEqual(final.files.get(INHERITED_LICENSE_PATH), mit); assert.deepEqual(final.files.get(CHANGES_LICENSE_PATH), gpl); assert.equal(final.adaptation.vendorLicenseAssigned, false); assert.equal(final.adaptation.generator.algorithmModified, false);
    assert.match(final.adaptation.policy, /Explicit user choice Lista estática segura/); assert.match(final.adaptation.policy, /sphereSize sets only rounded width/);
    assert.match(final.adaptation.policy, /stacks items in original order while the track or any descendant has focus/); assert.match(final.adaptation.policy, /ONLY when every normalized item is nonlink/); assert.equal(final.adaptation.revision, 3);
    for (const flag of FLAGS) { assert.equal(final.adaptation[flag], false); assert.equal(final.adoptionPlan[flag], false); }
    for (const entry of final.inventory.files) { assert.equal(entry.bytes, final.files.get(entry.path).length); assert.equal(entry.sha256, sha256(final.files.get(entry.path))); }
    const bytes = final.files.get('MANIFEST-SHA256.json'); assert.equal(final.hostConfig.joomlaDiscoveryRoots[0].inventoryHash, sha256(bytes)); assert.deepEqual(bytes, finalizeShowcasePackage(stagedFixture(version), provenance()).files.get('MANIFEST-SHA256.json')); hashes.push(sha256(bytes));
  }
  assert.notEqual(hashes[0], hashes[1]);
});
registerCase('canonical XML rejects any full default/options/bound/unknown attribute forgery even rehashed', () => {
  for (const [from, to] of [['maxlength="120"', 'maxlength="121"'], ['min="1"', 'min="0"'], ['max="900"', 'max="901"'], ['default="280"', 'default="281"'], ['default="[]"', 'default="[{}]"'], ['value="sphere"', 'value="ring"'], ['name="title"', 'name="title" unknown="x"'], ['method="upgrade"', 'method="upgrade" unknown="x"'], ['name="basic"', 'name="basic" required="true"']]) {
    const files = stagedFixture(); files.set(XML, Buffer.from(files.get(XML).toString().replace(from, to))); rebuildInventory(files); assert.throws(() => finalizeShowcasePackage(files, provenance()), /canonical/);
  }
});
registerCase('finalizer rejects forged source hashes/lengths/licenses/snapshot/flags and extra payload', () => {
  for (const mutate of [p => p.changes[1].modifiedBytes++, p => p.changes[1].generatedSha256 = '0'.repeat(64), p => p.changes[1].modifiedSha256 = '0'.repeat(64), p => p.changes[1].bom = false, p => p.snapshot.pop(), p => p.snapshot.push({ ...p.snapshot[0] }), p => p.inheritedLicense.scope = ['all'], p => p.inheritedLicense.globalVendorRightsApproved = true, p => p.inheritedLicenseBytes = Buffer.from('MIT'), p => p.changesLicenseBytes = Buffer.from('GPL'), p => p.adoptionApiSha256 = '0'.repeat(64)]) {
    const p = provenance(); mutate(p); assert.throws(() => finalizeShowcasePackage(stagedFixture(), p));
  }
  const extra = stagedFixture(); extra.set('foreign.js', Buffer.from('')); rebuildInventory(extra); assert.throws(() => finalizeShowcasePackage(extra, provenance()), /allowlist/);
  const altered = stagedFixture(); altered.set(LIB, Buffer.concat([altered.get(LIB), Buffer.from('//unknown')])); rebuildInventory(altered); assert.throws(() => finalizeShowcasePackage(altered, provenance()), /approved patch/);
  const oldFocus = stagedFixture(); const source = oldFocus.get(LIB).toString();
  oldFocus.set(LIB, Buffer.from(source.replace('  const focusAttr = items.some(item => !!item.url) ? \'\' : \' tabindex="0"\';\n', '').replace('<div class="camap-showcase__track"${focusAttr} style=', '<div class="camap-showcase__track" tabindex="0" style=')));
  assert.equal(sha256(oldFocus.get(LIB)), '5ef9f15eaa88cf9f435ac85d016cc2129a449b06f6dd6b640dbf7e9ad36e13b8', 'exact former always-tabindex 0.4.x renderer');
  rebuildInventory(oldFocus); assert.throws(() => finalizeShowcasePackage(oldFocus, provenance()), /approved patch/, 'former always-0 runtime rejected even with rehashed inventory');
  const flag = stagedFixture(); const plan = JSON.parse(flag.get('adoption-plan.json')); plan.publicationApproved = true; flag.set('adoption-plan.json', json(plan)); rebuildInventory(flag); assert.throws(() => finalizeShowcasePackage(flag, provenance()), /flags/);
});
registerCase('finalizer rejects native Map/Buffer/evidence callbacks and clones bytes', () => {
  let calls = 0; const hook = () => { calls++; throw Error('not invoked'); };
  const hooked = stagedFixture(); Object.defineProperty(hooked, Symbol.iterator, { get: hook }); assert.throws(() => finalizeShowcasePackage(hooked, provenance()), /native Map/);
  const bytesHook = stagedFixture(); bytesHook.set(LIB, Buffer.from(bytesHook.get(LIB))); Object.defineProperty(bytesHook.get(LIB), 'toJSON', { get: hook }); assert.throws(() => finalizeShowcasePackage(bytesHook, provenance()), /Buffer/);
  const p = provenance(); Object.defineProperty(p, 'changes', { get: hook }); assert.throws(() => finalizeShowcasePackage(stagedFixture(), p), /accessor/); assert.equal(calls, 0);
  const staged = stagedFixture(); const final = finalizeShowcasePackage(staged, provenance()); assert.notEqual(final.files.get(LIB), staged.get(LIB)); assert.deepEqual(final.files.get(LIB), staged.get(LIB));
});

export async function runShowcaseAdaptationTests(test = async (name, run) => { await run(); console.log(`ok - ${name}`); }) {
  for (const { name, run } of cases) await test(`showcase adaptation: ${name}`, run);
  return { suite: 'showcase-adaptation', tests: cases.length, passed: cases.length, mode: 'portable-pinned-source', browserValidated: false, publicationApproved: false };
}

/** Read-only audit: exact files, controls, runtime pins, XML and license text. */
export async function auditShowcaseAdaptationPackage(directory, version) {
  parseShowcaseAdaptationArgs(['--base', `/offline/showcase/${version}`, '--version', version, '--output', relative(PROJECT, resolve(PROJECT, directory)).replaceAll('\\', '/')]);
  const files = await readAdaptationFiles(resolve(PROJECT, directory));
  const inventory = JSON.parse(files.get('MANIFEST-SHA256.json')); const host = JSON.parse(files.get('host-config.json'));
  const adaptation = JSON.parse(files.get('ADAPTATION.json')); const plan = JSON.parse(files.get('adoption-plan.json'));
  assert.equal(files.size, 13); assert.equal(inventory.files.length, 11); assert.equal(inventory.version, version);
  assert.deepEqual([...files.keys()].sort(), [ENTRY, XML, LIB, SHARED, CSS, 'MANIFEST-SHA256.json', 'host-config.json', 'adoption-plan.json', 'ADAPTATION.json', 'docs/ADOPTION-NOTICE.md', 'docs/ADAPTATION-NOTICE.md', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH].sort());
  for (const entry of inventory.files) { assert.equal(entry.bytes, files.get(entry.path).length); assert.equal(entry.sha256, sha256(files.get(entry.path))); }
  assert.equal(host.joomlaDiscoveryRoots.length, 1); assert.equal(host.joomlaDiscoveryRoots[0].inventoryHash, sha256(files.get('MANIFEST-SHA256.json'))); assert.equal(host.joomlaDiscoveryRoots[0].immutable, true);
  assert.deepEqual(files.get(XML), showcaseAdaptationXml(version)); assert.deepEqual(files.get(ENTRY), Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`));
  for (const [path, target] of [[SHOWCASE_SOURCE_PATH, LIB], [SHARED_SOURCE_PATH, SHARED], [SHOWCASE_CSS_PATH, CSS]]) assert.deepEqual(files.get(target), overlay.files.get(path));
  assert.equal(sha256(lf(files.get(INHERITED_LICENSE_PATH))), sha256(mit)); assert.deepEqual(files.get(CHANGES_LICENSE_PATH), gpl);
  assert.equal(adaptation.adoptionApi.sha256, SHOWCASE_API_SHA256); assert.equal(adaptation.snapshot.length, 56); assert.equal(adaptation.snapshot.filter(e => e.originalSha256 !== e.snapshotSha256).length, 3);
  for (const flag of FLAGS) { assert.equal(adaptation[flag], false); assert.equal(plan[flag], false); }
  const parsed = parseJoomlaManifest(files.get(XML), { baseUrl: host.joomlaDiscoveryRoots[0].baseUrl, manifestPath: XML }); validateAdoptionSchema(parsed, loaded);
  const p = { changes: adaptation.changes, licenses: adaptation.originalLicenses, snapshot: adaptation.snapshot, inheritedLicense: adaptation.inheritedLicenseSource, inheritedLicenseBytes: files.get(INHERITED_LICENSE_PATH), changesLicenseSource: adaptation.changesLicenseSource, changesLicenseBytes: files.get(CHANGES_LICENSE_PATH), generatorSha256: adaptation.generator.sha256, adoptionApiSha256: adaptation.adoptionApi.sha256 };
  const staged = new Map(files); for (const path of ['ADAPTATION.json', 'docs/ADAPTATION-NOTICE.md', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) staged.delete(path);
  const oldPlan = { ...plan }; for (const key of ['adaptation', 'inheritedLicenseSource', 'changesLicenseSource', 'sourceRootLicensePresent']) delete oldPlan[key]; oldPlan.licenses = []; oldPlan.sourceLicensePresent = false; staged.set('adoption-plan.json', json(oldPlan));
  staged.set('MANIFEST-SHA256.json', json({ ...inventory, files: [...staged].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) }));
  const oldHost = structuredClone(host); oldHost.joomlaDiscoveryRoots[0].inventoryHash = sha256(staged.get('MANIFEST-SHA256.json')); staged.set('host-config.json', json(oldHost));
  for (const [path, bytes] of finalizeShowcasePackage(staged, p).files) assert.deepEqual(files.get(path), bytes, `reconstructed final ${path}`);
  for (const entry of adaptation.snapshot) { const bytes = await readFile(join(PROJECT, '..', 'CAMAP2', entry.path)); assert.equal(entry.originalSha256, sha256(bytes)); assert.equal(entry.bytes, bytes.length); }
  assert.equal(adaptation.adoptionApi.sha256, sha256(await readFile(join(PROJECT, 'scripts/prepare-module-adoption.js'))));
  const localOverlay = applyShowcaseOverlay(new Map(await Promise.all(Object.keys(SHOWCASE_ANCHORS).map(async path => [path, await readFile(join(PROJECT, '..', 'CAMAP2', path))]))));
  for (const change of adaptation.changes) assert.deepEqual(change, localOverlay.changes.find(item => item.path === change.path));
  const port = { async listFolders() { return { value: [{ Name: ELEMENT }] }; }, async downloadFile({ folderPath, fileName }) { const path = [folderPath, fileName].filter(Boolean).join('/'); assert.ok(files.has(path)); return Buffer.from(files.get(path)); } };
  const discovery = createJoomlaDiscoveryService({ roots: [{ ...host.joomlaDiscoveryRoots[0], files: port }] });
  const candidates = await discovery.scan(); assert.equal(candidates.length, 1); await discovery.verify(candidates[0]);
  return { output: directory, version, runtimeFiles: 5, inventoriedPayloads: 11, totalFiles: 13, inventoryHash: sha256(files.get('MANIFEST-SHA256.json')), snapshotFiles: adaptation.snapshot.length, browserValidated: false, publicationApproved: false, rightsApproved: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { test } = await import('node:test'); await runShowcaseAdaptationTests(test);
  const cli = process.argv.slice(2);
  if (cli[0] === '--local-build') {
    test('explicit offline builds and exact original snapshot/dependency/tool receipts', async () => {
      const container = await mkdtemp(join(PROJECT, 'tmp', 'showcase-adapt-agent-tests-'));
      const source = createAdaptationCollector(); const deps = await collectAdaptationDependencies(join(PROJECT, 'tmp/step2/camap-source')); const api = createAdaptationCollector();
      const camap = join(PROJECT, '..', 'CAMAP2');
      for (const path of [SHARED_SOURCE_PATH, 'tools/prepare-joomla-modules.js', 'package.json']) await source.add(camap, path);
      for (const { folder } of ADOPTION_MODULES) { const directory = `extensions/camap/${folder}`; for (const entry of await source.list(camap, directory)) if (entry.isFile() && /\.(js|css)$/.test(entry.name)) await source.add(camap, `${directory}/${entry.name}`); }
      for (const path of ADAPTATION_API_FILES) await api.add(PROJECT, path);
      const originalMit = await readFile(join(PROJECT, '..', 'LICENSE'));
      const receipts = []; const params = [];
      for (const version of ['0.5.0', '0.5.1']) {
        const output = `${relative(PROJECT, container).replaceAll('\\', '/')}/${version}`; const options = { version, base: `/offline/showcase/${version}`, output };
        const built = await prepareShowcaseAdaptation(options); assert.equal(built.originalSourceFiles, 56); assert.equal(built.dependencyFiles, 175);
        for (const entry of built.adaptation.snapshot) {
          const bytes = source.files.get(entry.path).bytes; const saved = await readFile(join(built.snapshot, entry.path));
          assert.equal(sha256(bytes), entry.originalSha256); assert.equal(sha256(saved), entry.snapshotSha256); assert.equal(bytes.length, entry.bytes);
        }
        const require = createRequire(join(built.stage, 'tmp/dependencies/package.json')); const csstree = require('css-tree');
        const ast = csstree.parse((await readFile(join(built.output, CSS))).toString(), { positions: true, onParseError(error) { throw error; } });
        const rule = ast.children.toArray().at(-1); assert.equal(rule.type, 'Rule'); assert.equal(csstree.generate(rule.prelude), '.camap-showcase__track:focus-within');
        assert.deepEqual(rule.block.children.toArray().map(node => [node.property, csstree.generate(node.value)]), [['grid-auto-flow', 'row'], ['grid-auto-columns', 'auto'], ['grid-template-columns', 'minmax(0,1fr)'], ['scroll-snap-type', 'none']]);
        const originalAst = csstree.parse(originals.get(SHOWCASE_CSS_PATH).toString()); originalAst.children.appendList(csstree.parse(SHOWCASE_CSS_APPEND).children);
        assert.equal(csstree.generate(ast), csstree.generate(originalAst), 'complete final CSS is exactly original plus declared append');
        receipts.push({ ...await auditShowcaseAdaptationPackage(output, version), sourceFiles: built.originalSourceFiles, dependencyFiles: built.dependencyFiles }); params.push(built.descriptor.params);
        await assert.rejects(prepareShowcaseAdaptation(options), /existing output/); await assert.rejects(prepareShowcaseAdaptation({ ...options, sourceRoot: built.snapshot, output: `${output}-override-rejected` }), /trusted CAMAP copy/);
      }
      await Promise.all([source.check(), deps.check(), api.check()]); assert.deepEqual(await readFile(join(PROJECT, '..', 'LICENSE')), originalMit); assert.deepEqual(params[0], params[1]); assert.notEqual(receipts[0].inventoryHash, receipts[1].inventoryHash);
      console.log(JSON.stringify({ output: container, receipts }, null, 2));
    });
  } else if (cli.length) {
    test('explicit read-only package audits', async () => { assert.equal(cli.length, 3); assert.equal(cli[0], '--packages'); for (let i = 0; i < 2; i++) console.log(JSON.stringify(await auditShowcaseAdaptationPackage(cli[i + 1], ['0.5.0', '0.5.1'][i]))); });
  }
}
