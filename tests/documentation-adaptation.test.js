/* SPDX-License-Identifier: GPL-2.0-or-later
 * Portable pinned compressed source DATA; --local-build is explicit and offline.
 * Embedded Documentation port DATA derives from selected Phoca/Joomla sources:
 * Copyright (C) 2006, 2009, 2010 Open Source Matters. All rights reserved.
 * Copyright (C) Jan Pavelka, www.phoca.cz.
 * GPL-2.0-or-later applies to that derived port, not just authored tests/patches.
 * Source/license mapping: docs/PROVENIENCIA-DOCUMENTATION.md; full GPL v2 text:
 * docs/licenses/GPL-2.0.txt. Historical aggregator MIT is helper-only evidence,
 * not an upstream license or global publication/legal approval.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';
import { createRequire } from 'node:module';
import {
  applyDocumentationOverlay, finalizeDocumentationPackage, prepareDocumentationAdaptation, parseDocumentationAdaptationArgs,
  DOCUMENTATION_ANCHORS, DOCUMENTATION_SOURCE_PATH, DOCUMENTATION_CSS_PATH, DOCUMENTATION_API_SHA256,
  DOCUMENTATION_DEFAULTS, DOCUMENTATION_VALIDATION_SOURCE, DOCUMENTATION_CSS_APPEND, documentationAdaptationXml,
  SHARED_SOURCE_PATH, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256
} from '../scripts/prepare-documentation-adaptation.js';
import { SAFE_URL_SOURCE, readAdaptationFiles, createAdaptationCollector, collectAdaptationDependencies, ADAPTATION_API_FILES, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES, ADAPTATION_ORIGIN_COMMIT } from '../scripts/prepare-editorial-adaptation.js';
import { ADOPTION_MODULES, validateAdoptionSchema } from '../scripts/prepare-module-adoption.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { parseJsonObject, normalizeParamValues } from '../src/libraries/minijoomla/application/declared-params.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELEMENT = 'mod_documentation'; const KEY = `camap.${ELEMENT}`;
const LIB = `libraries/camap/${DOCUMENTATION_SOURCE_PATH}`; const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${ELEMENT}/css/documentation.css`; const ENTRY = `modules/${ELEMENT}/${ELEMENT}.js`; const XML = `modules/${ELEMENT}/${ELEMENT}.xml`;
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cases = []; const registerCase = (name, run) => cases.push({ name, run });
// Full original 429-line module and 277-line CSS, as bounded DATA. Every hash is
// checked BEFORE any import. No checkout/dependencies needed in portable mode.
const MODULE_DATA = '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';
const CSS_DATA = 'GxQWAKwGbGMY+tjtxato/PDupBSjHl7Dipra1dpS3Yiu3qEeLaSXvfZGYuiV1DBratwE7QT58lEK/NLZowDmUU5KctPk/p0jFyAlTOQEKKGgff4EUeirJii/fr/XiSMXqWKjRIzPnHPfBm7enwkQKGhl5+3u3QKxUIC2DmWdb3ylj46R1j3vERVC9NrfX6cBjnv7wCv+tfacud1mkybBNVdZv0s60Zk5MUgGYJ7MR2M5MVavjWehsyv0hjyE4+1O7RCzO4fSqi+q/Otei2Vl4QHeMgw18weDfoVLEEOryWg6tR7ThZTvt2Ke1iCoTEi81rlFmR3DbucNBUH7ANpAri+l5+ebZn34cZZ0ZHAK5crCYBv3A3LTEo1+DjV/p7SbtRfF0ccezh5yG18ebi0UMYnM5w96HXDRsqwPngdJ4EZ/954NQ7BWA0MMLXsbFSaKUnsTVaGyW/itcN9z5e0Z+2XGfI1Jdgk8oggnrzCXmnB//HoQOWDwmB/CaXx7FquMcAwnTxSeAR2mPGqoVmOWXUYkjRGZO+VZjiwyDXBr2vcRN791SeUQDfDDR+LUArmodtB9BWNrVLNDcOVdotNkKAq98QUfJ1C0EOQdeFDD7jqjxecs+E2YwRJeSPpVVISngZOvyEVk4Rf/FupHY57FoB9foYK16NtE5zOgtdpUEMSXI0pRz/67yvCJJRufajDftbjaEOFeu1yHejDSJSAi/NROLmqnZMkIw6U5LhThCEvcbhEC1hSNR+7+4ZpR4j+gcxg3qELJ/FWLeR/dQNLbORFT3JrbVa8BF8kcfTscsFWSzjlGdS45SvVZDo2VioVkGgFd5It26uKggWFKy8tUtvXd+4Ftp/cXmZ+Jp35lNq5LdErMTpmnZlxGhI8nVY0LueKvqIHQHJLHGMqTFUhZNPVXHw4CODYGgbpnxqkCRCXBL+7nyjiHSiaU6Jpa9296tYpTJULW852ncTqb5upMTWdZBGMQxx3nEhJfsQE1/U2fwuZAFFP28zENUos95x6eOLWbpVLPvntJWDT0vRrLTbd3w2xp5B6FzjKcxkIUefIG4gKxL4pEaFzphf7KznEn1MFNwQGy/ibPOGCCuJhUJ1GizLvsSu6eRd9Br/qMiv85Kr1tyKdRgACUBp6gL6E94MMabw98v89jd1gNoPY8Y1jrxLzSxSOg2on1S1EFlLlNCtRrnVHiNlEjNxaIm4Ud7xqVX51q7GI6MCPObDSij3GU/LeLgvsxXCygT0yJVon7CfcYpiIvhQY1qLaWpPkFr0mdzP1KIWDqms+2CNDQTyLtk6agjx8/A7EyLDh+lKq98gvWH8OYsdSq8ddUAD2kuYn+w8vtBlgephPDKzUHkaNNIcsqagMBTnYvlzCrPw4858FiuqK0qeJ2E1fzyF3iYaSHqbEl+7qwrFNM3nRq8XNcJLtuKEv3GCX/dAA3KlYomzTL2kWgVNMRScaPqmXAeZJP91M/LNod+JP14H97Dp4zQhEtIwsPnhIZxMdTtkXSWZfiRfKc8bJVsVCLaaUvnDC2xK4MdGAPTNXt1IgH6MG6qWl6qKIEK7fJ4P4Fdcyqo1g0y3evnq2pg09ohPJXVflWBOITnm/zGMceO481jRLUtRalD12zeDLsVvQLUwrgukV555v6aoDMYXF1cwZlcl159Hydz2OeBKXipJui827UysU1BWufzrUfJyjW0gm0akZhfe8A56i8oTFqMbWQoLdVHRyYHcUYYO6/AQ==';
const sharedSource = '\uFEFF' + [
  "export function escapeHtml(value = '') { return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }",
  "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }",
  "export function stateMessage(state, empty = 'Nenhum conteúdo disponível.') { if (state === 'loading') return '<p role=\"status\" aria-live=\"polite\">Carregando…</p>'; if (state === 'error') return '<p role=\"alert\">Não foi possível carregar este módulo.</p>'; if (state === 'empty') return `<p role=\"status\">${escapeHtml(empty)}</p>`; return ''; }", ''
].join('\n');
const originals = new Map([[SHARED_SOURCE_PATH, Buffer.from(sharedSource)], [DOCUMENTATION_SOURCE_PATH, brotliDecompressSync(Buffer.from(MODULE_DATA, 'base64'), { maxOutputLength: 64 * 1024 })], [DOCUMENTATION_CSS_PATH, brotliDecompressSync(Buffer.from(CSS_DATA, 'base64'), { maxOutputLength: 64 * 1024 })]]);
for (const [path, bytes] of originals) assert.equal(sha256(bytes), DOCUMENTATION_ANCHORS[path][1], path);
const overlay = applyDocumentationOverlay(originals);
const shared = await import(dataUrl(overlay.files.get(SHARED_SOURCE_PATH)));
function moduleUrl(files) { const source = files.get(DOCUMENTATION_SOURCE_PATH).toString(); const anchor = "from '../_shared/render.js';"; assert.equal(source.split(anchor).length, 2); return dataUrl(source.replace(anchor, () => `from '${dataUrl(files.get(SHARED_SOURCE_PATH))}';`)); }
const loaded = await import(moduleUrl(overlay.files)); const prior = await import(moduleUrl(originals)); const render = loaded.renderDocumentation;
const descriptor = parseJoomlaManifest(documentationAdaptationXml('0.3.0'), { baseUrl: '/offline/documentation/0.3.0', manifestPath: XML });
const cssSource = originals.get(DOCUMENTATION_CSS_PATH).toString();
// Existing exact historical notice is decoded as inert DATA, never suite import.
const homeFixture = await readFile(join(PROJECT, 'tests/home-adaptation.test.js'), 'utf8');
const mitStart = 'const mit = Buffer.from(`'; assert.equal(homeFixture.split(mitStart).length, 2);
const mit = Buffer.from(homeFixture.split(mitStart)[1].split('`);')[0]); assert.equal(sha256(mit), ADAPTATION_MIT_HASHES[1]);
const gpl = await readFile(join(PROJECT, CHANGES_LICENSE_PATH)); assert.equal(sha256(gpl), CHANGES_LICENSE_SHA256);
const rows = [
  { id: 1, title: 'Root <&', href: '#/category/blog?layout=list', description: 'Root desc <&', image: '/local/image.png', imageAlt: 'Alt <&', tags: ['Tag <&', 'Other'], articles: [{ id: 1, title: 'Article <&', href: '#/article/local' }, { title: 'Draft', published: false }], numItems: 7 },
  { id: 'child', parentId: 1, title: 'Child', href: '/local/child', description: 'Child desc', articles: [{ title: 'Child article' }] },
  { id: 'grand', parentId: 'child', title: 'Grand', numItems: '2.9' },
  { id: 'empty', title: 'Empty' }, { id: 'orphan', parentId: 'missing', title: 'Orphan', numItems: 1 }
];
const cards = html => (html.match(/<article class="camap-documentation__card"/g) ?? []).length;
const articleRows = html => (html.match(/camap-documentation__icon--article/g) ?? []).length;
const active = (extra = {}) => ({ view: 'category', activeCategoryId: '1', categories: rows, ...extra });
function provenance() {
  const snapshot = [...originals].map(([path, bytes]) => ({ path, originalSha256: sha256(bytes), snapshotSha256: sha256(overlay.files.get(path)), bytes: bytes.length }));
  for (const path of ['tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.filter(({ folder }) => folder !== ELEMENT).map(({ folder }) => `extensions/camap/${folder}/module.js`)]) { const hash = path.startsWith('tools/') ? ADAPTATION_GENERATOR_HASHES[0] : sha256(Buffer.from(`inert synthetic metadata only: ${path}`)); snapshot.push({ path, originalSha256: hash, snapshotSha256: hash, bytes: 0 }); }
  return { changes: structuredClone(overlay.changes), licenses: [], generatorSha256: ADAPTATION_GENERATOR_HASHES[0], adoptionApiSha256: DOCUMENTATION_API_SHA256, snapshot,
    inheritedLicenseBytes: mit, inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: [DOCUMENTATION_SOURCE_PATH, SHARED_SOURCE_PATH, DOCUMENTATION_CSS_PATH], globalVendorRightsApproved: false, evidence: 'Portable pinned historical aggregator notice only, not Phoca upstream clearance.' },
    changesLicenseBytes: gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' } };
}
function rebuildInventory(files, version = '0.3.0') {
  const base = `/offline/documentation/${version}`;
  const inv = json({ format: 'minijoomla-joomla-package-v1', version, moduleKeys: { [ELEMENT]: KEY }, moduleStyles: { [KEY]: [CSS] }, files: [...files].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) });
  files.set('MANIFEST-SHA256.json', inv); files.set('host-config.json', json({ joomlaDiscoveryRoots: [{ id: `camap-${ELEMENT}-${version}`, baseUrl: base, inventoryHash: sha256(inv), immutable: true, discover: true }], moduleStyles: { [KEY]: [`${base}/${CSS}`] }, moduleStyleRevisions: { [KEY]: { [`${base}/${ENTRY}`]: [`${base}/${CSS}`] } } })); return files;
}
function stagedFixture(version = '0.3.0') { return rebuildInventory(new Map([[LIB, overlay.files.get(DOCUMENTATION_SOURCE_PATH)], [SHARED, overlay.files.get(SHARED_SOURCE_PATH)], [CSS, overlay.files.get(DOCUMENTATION_CSS_PATH)], [ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`)], [XML, documentationAdaptationXml(version)], ['docs/ADOPTION-NOTICE.md', Buffer.from('Offline fixture\n')], ['adoption-plan.json', json({ format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module: ELEMENT, key: KEY, version, base: `/offline/documentation/${version}`, pilot: false, validation: 'Portable fixture', licenses: [], sourceLicensePresent: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), nextGate: 'Coordinator review', hostNote: 'One root only' })]]), version); }

registerCase('three full-byte pinned sources; defaults/schema/export identity unchanged', () => {
  assert.equal(overlay.files.size, 3); assert.equal(overlay.changes.length, 3);
  assert.deepEqual(loaded.defaults, prior.defaults); assert.deepEqual(loaded.defaults, DOCUMENTATION_DEFAULTS); assert.deepEqual(loaded.settingsSchema, prior.settingsSchema);
  assert.equal(loaded.default.name, KEY); assert.equal(loaded.default.settings, loaded.defaults); assert.equal(loaded.default.settingsSchema, loaded.settingsSchema);
  assert.equal(originals.get(DOCUMENTATION_SOURCE_PATH).toString().split('\n').length, 429); assert.equal(cssSource.split('\n').length, 277);
  assert.equal(overlay.files.get(SHARED_SOURCE_PATH).toString().replace(SAFE_URL_SOURCE, sharedSource.split('\n')[1]), sharedSource);
  assert.equal(overlay.files.get(DOCUMENTATION_CSS_PATH).toString(), cssSource + '\n' + DOCUMENTATION_CSS_APPEND + '\n');
  assert.ok(overlay.files.get(DOCUMENTATION_SOURCE_PATH).toString().includes(DOCUMENTATION_VALIDATION_SOURCE));
});
registerCase('24 ordered original fields and complete original constraints/options/defaults', () => {
  validateAdoptionSchema(descriptor, loaded); assert.equal(descriptor.params.length, 24);
  assert.deepEqual(descriptor.params.map(p => p.name), Object.keys(prior.settingsSchema.fields)); assert.deepEqual(descriptor.params.map(p => p.default), Object.values(prior.defaults));
  assert.deepEqual(descriptor.params[0].options.map(p => p.value), ['categories', 'category']);
  for (const p of descriptor.params) { const field = prior.settingsSchema.fields[p.name]; assert.equal(p.maxLength, field.maxLength); assert.equal(p.min, field.min); assert.equal(p.max, field.max); }
  assert.equal(descriptor.params.find(p => p.name === 'categories').valueType, 'array'); assert.equal(descriptor.params.find(p => p.name === 'pagination').valueType, 'object');
});
registerCase('safe valid categories/category HTML remains original byte-for-byte', () => {
  for (const settings of [{}, { categories: rows }, { categories: rows, showEmptyCategoriesCat: true, showPageHeading: true, baseDescription: '<base>' }, active(), active({ activeCategoryId: 'child' }), active({ showPageHeading: true }), active({ showCatTags: false, showDescriptionImage: false }), active({ pagination: { page: '2', totalPages: 3, prevHref: '/local/prev', nextHref: '#/local/next' } })]) assert.equal(render(settings), prior.renderDocumentation(settings));
  assert.equal(loaded.default.render({ settings: active() }), render(active())); assert.match(render(active()), /Article &lt;&amp;/); assert.doesNotMatch(render(active()), />Draft</);
});
registerCase('original level 0/1/2/-1/fraction and hard depth semantics preserved', () => {
  for (const level of [-1, 0, 1, 1.5, 2, 2.5, 10]) { assert.equal(render({ categories: rows, maxLevelCategories: level }), prior.renderDocumentation({ categories: rows, maxLevelCategories: level })); assert.equal(render(active({ maxLevel: level })), prior.renderDocumentation(active({ maxLevel: level }))); }
  const deep = Array.from({ length: 30 }, (_, i) => ({ id: String(i), parentId: i ? String(i - 1) : null, title: `DEPTH${i}`, numItems: 1 }));
  assert.equal(cards(render({ categories: deep })), 20); assert.ok(render({ categories: deep }).includes('DEPTH19')); assert.ok(!render({ categories: deep }).includes('DEPTH20'));
  assert.equal(render({ categories: deep }), prior.renderDocumentation({ categories: deep }));
  const multiRoot = Array.from({ length: 3 }, (_, root) => Array.from({ length: 20 }, (_, depth) => ({ id: `${root}-${depth}`, parentId: depth ? `${root}-${depth - 1}` : null, title: `ROOT${root}DEPTH${depth}`, description: 'D'.repeat(300), numItems: 1 }))).flat();
  const html = render({ categories: multiRoot }); assert.equal(cards(html), 60); for (let root = 0; root < 3; root++) assert.ok(html.includes(`ROOT${root}DEPTH19`)); assert.equal(html, prior.renderDocumentation({ categories: multiRoot }), 'all three legitimate deep roots and complete text remain, CSS must never elide content');
});
registerCase('both view visibility flags, titles, descriptions, tags, counts, no-articles remain independent', () => {
  assert.equal(cards(render({ categories: rows })), 4); assert.equal(cards(render({ categories: rows, showEmptyCategoriesCat: true })), 5);
  assert.doesNotMatch(render({ categories: rows, showSubcatDescCat: false, showCatNumArticlesCat: false }), /Root desc|card-footer/);
  for (const flag of ['showCategoryTitle', 'showDescription', 'showDescriptionImage', 'showCatTags', 'showCatNumArticles', 'showSubcatDesc', 'showNoArticles', 'showEmptyCategories']) for (const value of [true, false]) assert.equal(render(active({ [flag]: value })), prior.renderDocumentation(active({ [flag]: value })));
  assert.match(render(active({ showPageHeading: true })), /page-header"><h1>Documentação<\/h1>[^]*<h2 class="camap-documentation__title">/);
  assert.match(render(active({ activeCategoryId: 'empty' })), /Nenhum documento publicado/); assert.doesNotMatch(render(active({ activeCategoryId: 'empty', showNoArticles: false })), /Nenhum documento publicado/);
});
registerCase('strict URL helper rejects unsafe protocols/credentials/encoding without coercion', () => {
  for (const href of ['#', '#/local', '/local/a?q="x"&v=1', '/local/caf%C3%A9', 'https://example.invalid/a', 'HTTPS://EXAMPLE.invalid/a']) assert.equal(shared.safeUrl(href), href);
  for (const href of [null, undefined, false, 2, {}, [], '', ' ', 'relative', '?query', 'http://example.invalid', 'javascript:x', 'data:text/html,x', '//unsafe.invalid', '/\\unsafe.invalid', 'https://u:p@example.invalid', 'https://@example.invalid', 'https:///example.invalid', 'https://[invalid', '/a b', '/a\t', '/a\0', '/a\u007f', '/%2funsafe', '/%5cunsafe', '/%0a', '/%252funsafe', '/%25250a', '/%2525252f', '/bad%', '/bad%zz', '/%20x', '/%C2%A0x', ' /x', '/x ']) { assert.equal(shared.safeUrl(href), '#'); assert.equal(shared.safeUrl(href, '/local/fallback'), '/local/fallback'); }
  let calls = 0; const evil = { toString() { calls++; throw Error('not called'); } }; assert.equal(shared.safeUrl(evil, evil), '#'); assert.equal(calls, 0);
});
registerCase('unsafe category/article links retain content as nonlinks, unsafe back keeps span label', () => {
  for (const href of ['javascript:x', '//unsafe.invalid', '/%252funsafe', 'https://u:p@example.invalid', {}, null]) {
    const categories = [{ id: 'x', title: 'Keep category', href, articles: [{ title: 'Keep article', href }] }];
    const html = render({ view: 'category', activeCategoryId: 'x', rootLabel: 'Keep back', rootHref: href, categories });
    assert.match(html, /<span class="camap-documentation__back">[^]*Keep back<\/span>/); assert.match(html, /Keep category/); assert.match(html, /Keep article/); assert.doesNotMatch(html, /<a\b|href="#"/);
    assert.match(render({ categories }), /Keep category/); assert.doesNotMatch(render({ categories }), /<a\b/);
  }
});
registerCase('images strict HTTPS/server-relative only, invalid media omitted without losing category', () => {
  for (const image of ['#', '#fragment', '/local/image#frag', 'https://example.invalid/a#x', 'data:image/png,x', 'blob:x', '//unsafe.invalid/x', 'https://u:p@example.invalid/x', {}, null, '']) for (const view of ['categories', 'category']) { const html = render({ view, activeCategoryId: 'x', categories: [{ id: 'x', title: 'Keep', image, numItems: 1 }] }); assert.match(html, /Keep/); assert.doesNotMatch(html, /<img|src=""/); }
  for (const image of ['/local/image.png', 'https://example.invalid/image.png']) assert.match(render({ categories: [{ id: 'x', image, imageAlt: 'Alt <&', numItems: 1 }] }), /<img[^]*alt="Alt &lt;&amp;"/);
});
registerCase('article title/publication strictly inert; valid numeric IDs accepted and false draft omitted', () => {
  const articles = [null, {}, { title: 1 }, { title: ' ' }, { title: 'Null flag', published: null }, { title: 'String flag', published: 'false' }, { title: 'Draft', published: false }, { id: 2, title: 'Valid', published: true }, { title: 'Absent' }, { title: 'Undefined', published: undefined }];
  const html = render({ view: 'category', activeCategoryId: 'x', categories: [{ id: 'x', articles }] }); assert.equal(articleRows(html), 3); assert.doesNotMatch(html, /Null flag|String flag|Draft/);
  assert.match(render({ categories: [{ id: 1, title: null, numItems: 1 }, { id: '2', parentId: ' 1 ', numItems: 1 }] }), />1<\/h3>/);
});
registerCase('precomputed counts/fallback use normalized articles, never live published count', () => {
  for (const [numItems, expected] of [[7, 7], ['2.9', 2], [0, 0], [-1, 2], [null, 2], [{}, 2], ['0x10', 2], [Infinity, 2], ['', 2]]) { const html = render({ showEmptyCategoriesCat: true, categories: [{ id: 'x', numItems, articles: [{ title: 'A' }, { title: 'Draft', published: false }] }] }); assert.match(html, new RegExp(`<small>${expected} itens</small>`)); }
  assert.match(render({ categories: [{ id: 'x', articles: [{ title: 'A' }, { title: 'Draft', published: false }] }] }), /<small>2 itens<\/small>/);
});
registerCase('pagination finite primitives/strict decimals only, unsafe controls omitted without fallback', () => {
  assert.match(render(active({ pagination: { page: '2.9', totalPages: '3.1', prevHref: 'javascript:x', nextHref: '//unsafe.invalid' } })), /Página 2 de 3/);
  assert.doesNotMatch(render(active({ pagination: { page: 2, totalPages: 3, prevHref: 'javascript:x', nextHref: '#' } })), /<a class="camap-documentation__pagination-link/);
  for (const value of [null, {}, [], '0x10', Infinity, 'Infinity', '1e4', 1e308, Number.MAX_SAFE_INTEGER + 1, '999999999999999999999']) assert.doesNotMatch(render(active({ pagination: { totalPages: value } })), /<nav/);
  assert.match(render(active({ pagination: { page: -2, totalPages: 3, prevHref: '/local/prev', nextHref: '#/local/next' } })), /Página 1 de 3/);
});
registerCase('duplicates after string/numeric normalization reject whole tree in both views', () => {
  for (const pair of [[1, '1'], ['x', ' x ']]) { const categories = [{ id: pair[0], title: 'FIRST', numItems: 1 }, { id: pair[1], title: 'LAST', numItems: 1 }, { id: 'good', title: 'GOOD', numItems: 1 }]; assert.equal(cards(render({ categories })), 0); assert.match(render({ view: 'category', activeCategoryId: 'good', categories }), /Categoria não encontrada/); assert.doesNotMatch(render({ categories }), /FIRST|LAST|GOOD/); }
});
registerCase('self/transitive cycles and every descendant unavailable via active lookup; valid roots stable', () => {
  const categories = [{ id: 'good', title: 'GOOD', numItems: 1 }, { id: 'a', parentId: 'b', title: 'CYCLEA', numItems: 1 }, { id: 'b', parentId: 'a', title: 'CYCLEB', numItems: 1 }, { id: 'desc', parentId: 'a', title: 'DESC', numItems: 1 }, { id: 'self', parentId: 'self', title: 'SELF', numItems: 1 }, { id: 'other', title: 'OTHER', numItems: 1 }];
  assert.equal(cards(render({ categories })), 2); assert.ok(render({ categories }).indexOf('GOOD') < render({ categories }).indexOf('OTHER')); assert.doesNotMatch(render({ categories }), /CYCLE|DESC|SELF/);
  for (const activeCategoryId of ['a', 'b', 'desc', 'self']) assert.match(render({ view: 'category', activeCategoryId, categories }), /Categoria não encontrada/);
  assert.match(prior.renderDocumentation({ view: 'category', activeCategoryId: 'a', categories }), /CYCLEA[^]*CYCLEA/, 'characterized original active cycle bug');
});
registerCase('dangling parents promoted, root/children input order and trimmed numeric/string IDs retained', () => {
  const categories = [{ id: 'orphan', parentId: 'missing', title: 'ORPHAN', numItems: 1 }, { id: 1, parentId: ' ', title: 'ROOT', href: '/local/root', numItems: 1 }, { id: 'b', parentId: 1, title: 'CHILDB', numItems: 1 }, { id: 'a', parentId: '1', title: 'CHILDA', numItems: 1 }];
  assert.equal(render({ categories }), prior.renderDocumentation({ categories })); assert.equal(render({ view: 'category', activeCategoryId: ' b ', categories }), prior.renderDocumentation({ view: 'category', activeCategoryId: ' b ', categories }));
  assert.equal(cards(render({ categories: [{ id: {} }, { id: Infinity }, { id: '' }, { id: 'bad', parentId: {} }] })), 0);
});
registerCase('own plain data rejects getters/functions/prototypes at context/settings/categories/articles/tags/pager', () => {
  let calls = 0; const getter = () => { calls++; throw Error('not executed'); }; const evil = { toJSON: getter, toString: getter, valueOf: getter };
  for (const settings of [null, false, 1, 'settings', [], Object.create({ categories: rows }), Object.defineProperty({}, 'categories', { get: getter }), Object.defineProperty({ categories: rows }, 'unknown', { get: getter }), evil]) assert.doesNotThrow(() => render(settings));
  for (const context of [null, [], Object.create({ settings: active() }), Object.defineProperty({}, 'settings', { get: getter }), Object.defineProperty({ settings: active() }, 'state', { get: getter }), evil]) assert.doesNotThrow(() => loaded.default.render(context));
  for (const category of [evil, Object.create({ id: 'x', numItems: 1 }), Object.defineProperty({ id: 'x', numItems: 1 }, 'href', { get: getter }), Object.defineProperty({ id: 'x' }, 'unknown', { get: getter })]) assert.equal(cards(render({ categories: [category] })), 0);
  for (const article of [evil, Object.defineProperty({ title: 'A' }, 'published', { get: getter }), Object.defineProperty({ title: 'A' }, 'unknown', { get: getter })]) assert.equal(articleRows(render({ view: 'category', activeCategoryId: 'x', categories: [{ id: 'x', articles: [article] }] })), 0);
  assert.doesNotMatch(render(active({ pagination: Object.defineProperty({}, 'totalPages', { get: getter }) })), /<nav/); assert.equal(calls, 0);
});
registerCase('native dense arrays length-first gates reject sparse/accessor/hooks/subclass/501 length', () => {
  let calls = 0; const getter = () => { calls++; throw Error('not executed'); };
  const invalid = [Array(2), Array(501), Object.defineProperty([], '0', { get: getter }), Object.defineProperty([...rows], 'extra', { get: getter }), Object.defineProperty([...rows], Symbol.iterator, { value: getter }), new (class extends Array {})(...rows)];
  for (const categories of invalid) assert.equal(cards(render({ categories })), 0);
  for (const articles of invalid) assert.equal(articleRows(render({ view: 'category', activeCategoryId: 'x', categories: [{ id: 'x', articles }] })), 0);
  for (const tags of invalid) assert.doesNotMatch(render({ view: 'category', activeCategoryId: 'x', categories: [{ id: 'x', tags }] }), /class="camap-documentation__tags"/);
  assert.equal(calls, 0); assert.ok(DOCUMENTATION_VALIDATION_SOURCE.indexOf('length > 500') < DOCUMENTATION_VALIDATION_SOURCE.indexOf('const keys = Reflect.ownKeys(value);', DOCUMENTATION_VALIDATION_SOURCE.indexOf('function _docArray')));
});
registerCase('aggregate articles/descriptors/strings bounded without truncating or storing new schema constraints', () => {
  const categories = Array.from({ length: 500 }, (_, i) => ({ id: String(i), numItems: 1 })); assert.equal(cards(render({ categories })), 500);
  const articles = Array.from({ length: 500 }, () => ({ title: 'A' })); assert.equal(articleRows(render({ view: 'category', activeCategoryId: 'x', categories: [{ id: 'x', articles }] })), 500);
  assert.equal(cards(render({ categories: [{ id: 'x', articles }, { id: 'y', articles: [{ title: 'B' }] }] })), 0);
  assert.equal(cards(render({ categories: [{ id: 'x', title: 'A'.repeat(1000001), numItems: 1 }] })), 0);
  const wide = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`k${i}`, i])); assert.equal(cards(render({ categories: [{ ...wide, id: 'x', numItems: 1 }] })), 0);
  assert.equal(Object.hasOwn(loaded.settingsSchema.fields.categories, 'maxItems'), false);
});
registerCase('UI strings invalid empty, booleans strict true, tags only strings; no arbitrary coercion', () => {
  let calls = 0; const evil = { toString() { calls++; throw Error('not called'); } };
  for (const key of ['title', 'pageHeading', 'baseDescription', 'activeCategoryId', 'rootLabel', 'rootHref']) for (const value of [null, false, 3, [], evil]) assert.doesNotThrow(() => render(active({ [key]: value })));
  assert.match(render({ title: evil }), /aria-label=""/); assert.doesNotMatch(render(active({ showCatTags: 'true', showDescription: 1, showCategoryTitle: null })), /class="camap-documentation__tags"|desc-text|class="camap-documentation__title"/);
  assert.match(render({ view: 'category', activeCategoryId: 'x', categories: [{ id: 'x', tags: [' A ', 2, null, evil, '', 'B <&'] }] }), /<li>A<\/li><li>B &lt;&amp;<\/li>/); assert.equal(calls, 0);
});
registerCase('states escaped safely and repeated instances preserve original heading choices without IDs', () => {
  for (const state of ['ready', 'loading', 'error', 'empty', 'unknown']) assert.equal(render({}, state), prior.renderDocumentation({}, state));
  for (const state of [null, false, 1, {}]) assert.doesNotThrow(() => render({}, state));
  const html = render(active({ title: 'Title <&' })) + render(active({ showPageHeading: true })); assert.doesNotMatch(html, /\sid=|aria-labelledby/); assert.match(html, /<h1 class="camap-documentation__title">/); assert.match(html, /<h2 class="camap-documentation__title">/);
});
registerCase('scoped CSS retains original palette/declarations plus wrapping/deep-tree reflow/focus only', () => {
  assert.equal(overlay.files.get(DOCUMENTATION_CSS_PATH).toString(), cssSource + '\n' + DOCUMENTATION_CSS_APPEND + '\n');
  assert.match(DOCUMENTATION_CSS_APPEND, /minmax\(min\(16rem,100%\),1fr\)/); assert.match(DOCUMENTATION_CSS_APPEND, /@container\(max-width:400px\)/); assert.match(DOCUMENTATION_CSS_APPEND, /padding:0;border-width:0;border-left-width:1px/); assert.match(DOCUMENTATION_CSS_APPEND, /margin-left:0/); assert.match(DOCUMENTATION_CSS_APPEND, /focus-visible/);
  assert.doesNotMatch(DOCUMENTATION_CSS_APPEND, /overflow:hidden|display:none|body|header|@import|url\(|font-size|animation/);
  assert.doesNotMatch(overlay.files.get(DOCUMENTATION_SOURCE_PATH).toString(), /setInterval|setTimeout|requestAnimationFrame|document\./);
  assert.ok(DOCUMENTATION_CSS_APPEND.includes('}\n.camap-documentation__children .camap-documentation__children{margin-left:0}\n.camap-documentation__children .camap-documentation__children .camap-documentation__children-item{padding:.5rem 0;border-left:1px solid #e3e9ed}\n'), 'all-width deep-list relief follows container query, preserves vertical rhythm and ancestry cue');
  assert.ok(DOCUMENTATION_CSS_APPEND.endsWith('.camap-documentation__card>.camap-documentation__cards .camap-documentation__card{padding:0;border-width:0;border-left-width:1px}\n'), 'all-width nested-card relief also covers narrow columns in wide multi-root grids');
});
registerCase('render and separate unrelated admin update preserve exact JSON/unknown saved keys', async () => {
  const settingsJson = '{"title":"T","categories":[null,{"id":"x","articles":[{"title":"A","published":null}]}],"pagination":{"nextHref":"javascript:x"},"future":{"keep":[true]},"__proto__":{"preserved":true}}';
  let record = { id: 101, title: 'Local', extensionKey: KEY, position: 'main-top', ordering: 2, enabled: true, scopeKind: 'All', assignment: 'all', assignmentJson: '[]', settingsJson, etag: 'local-etag' }; const writes = [];
  const service = createAdminService({ moduleInstances: { async findMany() { return { items: [structuredClone(record)] }; }, async findById() { return structuredClone(record); }, async update(id, patch) { writes.push(patch); record = { ...record, ...patch }; return structuredClone(record); } }, extensions: { async findMany() { return { items: [{ key: KEY, type: 'Module', enabled: true, manifestJson: descriptor.manifestJson }] }; } } });
  const stored = JSON.parse(settingsJson); const before = JSON.stringify(stored); render(stored); assert.equal(JSON.stringify(stored), before); await service.moduleInstances.update(101, { enabled: false }, { etag: 'local-etag' }); assert.equal(record.settingsJson, settingsJson); assert.equal(writes.length, 1); assert.equal(Object.hasOwn(writes[0], 'settingsJson'), false);
  const params = normalizeParamValues(descriptor.params, parseJsonObject(settingsJson, { strict: true }), { keepUndeclared: true }); assert.deepEqual(params.categories, stored.categories); assert.deepEqual(params.future, stored.future); assert.equal(Object.hasOwn(params, '__proto__'), true);
});
registerCase('closed CLI/output/version/options and input overlap checks fail closed', async () => {
  const base = ['--base', '/offline/documentation/0.3.0', '--output', 'tmp/documentation-adapt-agent-portable']; assert.equal(parseDocumentationAdaptationArgs(base).version, '0.3.0'); assert.deepEqual(parseDocumentationAdaptationArgs(['--help']), { help: true });
  for (const module of ['all', 'mod_hero', 'mod_home']) assert.throws(() => parseDocumentationAdaptationArgs([...base, '--module', module]));
  for (const version of ['0.2.0', '0.3.2', '01.3.0']) { assert.throws(() => parseDocumentationAdaptationArgs([...base, '--version', version])); assert.throws(() => documentationAdaptationXml(version)); }
  for (const output of ['public/x', 'tmp/hero-adapt-agent-x', 'tmp/documentation-adapt-agent-x/../y', 'tmp/documentation-adapt-agent-x/con', 'tmp/documentation-adapt-agent-x/aux.']) assert.throws(() => parseDocumentationAdaptationArgs(['--base', '/local', '--output', output]));
  for (const extra of [['--source', '../other'], ['--source', 'tmp/step2/camap-source'], ['--source', 'tmp/documentation-adapt-agent-portable/source'], ['--dependencies-root', '../other'], ['--inherited-license', '../other-LICENSE'], ['--inherited-license', 'tmp/documentation-adapt-agent-portable/LICENSE'], ['--patches', 'code'], ['--base', '/duplicate']]) assert.throws(() => parseDocumentationAdaptationArgs([...base, ...extra]));
  let calls = 0; await assert.rejects(prepareDocumentationAdaptation(Object.defineProperty({}, 'base', { get() { calls++; throw Error('not executed'); } })), /accessor/); await assert.rejects(prepareDocumentationAdaptation({ ...parseDocumentationAdaptationArgs(base), hashes: {} }), /Unknown/); assert.equal(calls, 0);
});
registerCase('closed 5 runtime/11 inventoried/13 total files, reproducible revisions and mandatory upstream gate', () => {
  const hashes = [];
  for (const version of ['0.3.0', '0.3.1']) { const staged = stagedFixture(version); const originalInventory = Buffer.from(staged.get('MANIFEST-SHA256.json')); const final = finalizeDocumentationPackage(staged, provenance()); assert.deepEqual(staged.get('MANIFEST-SHA256.json'), originalInventory); assert.equal(final.files.size, 13); assert.equal(final.inventory.files.length, 11); assert.equal(final.adaptation.changes.length, 3); assert.equal(final.adaptation.snapshot.filter(e => e.originalSha256 !== e.snapshotSha256).length, 3); assert.equal(final.adaptation.upstreamRightsReviewRequired, true); assert.equal(final.adaptation.schemaModified, false); assert.equal(final.adaptation.vendorLicenseAssigned, false); assert.deepEqual(final.files.get(INHERITED_LICENSE_PATH), mit); assert.deepEqual(final.files.get(CHANGES_LICENSE_PATH), gpl); for (const flag of FLAGS) { assert.equal(final.adaptation[flag], false); assert.equal(final.adoptionPlan[flag], false); } for (const entry of final.inventory.files) assert.equal(entry.sha256, sha256(final.files.get(entry.path))); const inv = final.files.get('MANIFEST-SHA256.json'); assert.equal(final.hostConfig.joomlaDiscoveryRoots[0].inventoryHash, sha256(inv)); assert.deepEqual(inv, finalizeDocumentationPackage(stagedFixture(version), provenance()).files.get('MANIFEST-SHA256.json')); hashes.push(sha256(inv)); }
  assert.notEqual(hashes[0], hashes[1]);
});
registerCase('full XML rejects every added/default/type/option/constraint/unknown attribute even rehashed', () => {
  for (const [from, to] of [['maxlength="160"', 'maxlength="1"'], ['name="title"', 'name="title" unknown="x"'], ['default="Documentação"', 'default="Changed"'], ['#documentacao', '/invented'], ['mj:valueType="array"', 'mj:valueType="object"'], ['min="-1"', 'min="0"'], ['max="10"', 'max="20"'], ['value="categories"', 'value="invented"'], ['type="radio"', 'type="list"'], ['method="upgrade"', 'method="upgrade" unknown="x"'], ['<fieldset name="basic">', '<fieldset name="basic" required="true">']]) { const staged = stagedFixture(); assert.ok(staged.get(XML).toString().includes(from)); staged.set(XML, Buffer.from(staged.get(XML).toString().replace(from, to))); rebuildInventory(staged); assert.throws(() => finalizeDocumentationPackage(staged, provenance()), /XML canonical/); }
});
registerCase('source tamper/foreign paths/stale controls/forged patch hashes and licenses refused', () => {
  for (const path of originals.keys()) { const bad = new Map(originals); bad.set(path, Buffer.concat([bad.get(path), Buffer.from('//unreviewed')])); assert.throws(() => applyDocumentationOverlay(bad), /Unapproved original SHA-256/); }
  assert.throws(() => applyDocumentationOverlay(new Map()), /exactly/);
  for (const path of ['foreign.json', `modules/${ELEMENT}/extra.js`, `libraries/camap/${DOCUMENTATION_CSS_PATH}`, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, 'ADAPTATION.json']) { const staged = stagedFixture(); staged.set(path, Buffer.from('foreign')); rebuildInventory(staged); assert.throws(() => finalizeDocumentationPackage(staged, provenance()), /allowlist/); }
  for (const path of [ENTRY, XML, CSS, LIB, SHARED, 'docs/ADOPTION-NOTICE.md', 'host-config.json']) { const staged = stagedFixture(); staged.delete(path); assert.throws(() => finalizeDocumentationPackage(staged, provenance()), /mandatory/); }
  const forged = stagedFixture(); forged.set(LIB, Buffer.from('export default {};')); rebuildInventory(forged); const fp = provenance(); fp.changes[1].generatedSha256 = sha256(forged.get(LIB)); assert.throws(() => finalizeDocumentationPackage(forged, fp), /approved patch/);
  for (const patch of [{ changes: [] }, { licenses: ['LICENSE'] }, { generatorSha256: '0'.repeat(64) }, { adoptionApiSha256: '1'.repeat(64) }, { snapshot: [] }, { inheritedLicenseBytes: Buffer.from('MIT') }, { inheritedLicense: { ...provenance().inheritedLicense, scope: ['all vendor'] } }, { changesLicenseBytes: Buffer.from('GPL') }, { arbitrary: true }]) assert.throws(() => finalizeDocumentationPackage(stagedFixture(), { ...provenance(), ...patch }));
  const stale = stagedFixture(); stale.set(CSS, Buffer.from('stale')); assert.throws(() => finalizeDocumentationPackage(stale, provenance()), /integrity/);
});
registerCase('53 native Map negatives plus Buffer/provenance hooks rejected before getters, clean inputs preserved', () => {
  let calls = 0; const getter = () => { calls++; throw Error('not executed'); };
  let negatives = 0;
  const gates = [{ input: () => new Map(originals), run: value => applyDocumentationOverlay(value) }, { input: () => stagedFixture(), run: value => finalizeDocumentationPackage(value, provenance()) }];
  for (const { input, run } of gates) {
    for (const key of ['size', 'get', 'has', 'entries', 'set', 'extra', Symbol.iterator]) for (const descriptor of [{ get: getter }, { value: getter }]) { assert.throws(() => run(Object.defineProperty(input(), key, descriptor)), /exact native Map/); negatives++; }
    class CallbackMap extends Map { get size() { return getter(); } has() { return getter(); } get() { return getter(); } entries() { return getter(); } [Symbol.iterator]() { return getter(); } }
    class GetterMap extends Map { get size() { return getter(); } get has() { return getter(); } get get() { return getter(); } get entries() { return getter(); } get [Symbol.iterator]() { return getter(); } }
    for (const value of [new CallbackMap(input()), new GetterMap(input()), new (class extends Map {})(input()), Object.setPrototypeOf(input(), Object.create(Map.prototype))]) { assert.throws(() => run(value), /exact native Map/); negatives++; }
    assert.throws(() => run(Object.create(Map.prototype)), /branded native Map/); negatives++;
    for (const value of [null, undefined, false, 1, {}, []]) { assert.throws(() => run(value), /exact native Map/); negatives++; }
    assert.throws(() => run(new Map(Array.from({ length: 501 }, (_, index) => [String(index), Buffer.alloc(0)]))), /entry budget/); negatives++;
  }
  assert.throws(() => finalizeDocumentationPackage(Object.defineProperty(stagedFixture(), Symbol.iterator, { get: getter }), Object.defineProperty(provenance(), 'changes', { get: getter })), /exact native Map/); negatives++;
  assert.equal(negatives, 53);
  for (const property of ['length', 'valueOf', 'toJSON', 'buffer', 'byteOffset', 'byteLength', 'foo', Symbol('hook')]) { const bad = new Map(originals); bad.set(DOCUMENTATION_SOURCE_PATH, Object.defineProperty(Buffer.from(originals.get(DOCUMENTATION_SOURCE_PATH)), property, { get: getter })); assert.throws(() => applyDocumentationOverlay(bad), /Buffer own byte indices/); const p = provenance(); p.inheritedLicenseBytes = Object.defineProperty(Buffer.from(mit), property, { get: getter }); assert.throws(() => finalizeDocumentationPackage(stagedFixture(), p), /Buffer own byte indices/); }
  for (const bytes of [new Uint8Array([1]), Object.create(Buffer.prototype), Object.setPrototypeOf(Buffer.from('x'), Object.create(Buffer.prototype))]) { const staged = stagedFixture(); staged.set(CSS, bytes); assert.throws(() => finalizeDocumentationPackage(staged, provenance()), /trusted exact Buffer/); }
  const oversized = provenance(); oversized.inheritedLicenseBytes = Buffer.alloc(11 * 1024 * 1024); assert.throws(() => finalizeDocumentationPackage(stagedFixture(), oversized), /budget/);
  assert.throws(() => finalizeDocumentationPackage(stagedFixture(), Object.defineProperty(provenance(), 'changes', { get: getter })), /accessor/);
  const staged = stagedFixture(); const before = Buffer.from(staged.get(XML)); const final = finalizeDocumentationPackage(staged, provenance()); assert.deepEqual(staged.get(XML), before); assert.notEqual(staged.get(XML), final.files.get(XML)); assert.equal(calls, 0);
});

/** Read-only local package/file-port proof; package JS never executed. */
export async function auditDocumentationAdaptationPackage(directory, version) {
  const root = resolve(PROJECT, directory); const output = relative(PROJECT, root).replaceAll('\\', '/'); parseDocumentationAdaptationArgs(['--base', `/offline/documentation/${version}`, '--version', version, '--output', output]);
  const files = await readAdaptationFiles(root); const invBytes = files.get('MANIFEST-SHA256.json'); const inventory = JSON.parse(invBytes); assert.equal(inventory.version, version); assert.equal(inventory.files.length, 11); assert.equal(files.size, 13);
  for (const entry of inventory.files) { assert.equal(files.get(entry.path).length, entry.bytes); assert.equal(sha256(files.get(entry.path)), entry.sha256); }
  assert.deepEqual([...files.keys()].sort(), [...inventory.files.map(e => e.path), 'MANIFEST-SHA256.json', 'host-config.json'].sort());
  for (const [source, target] of [[DOCUMENTATION_SOURCE_PATH, LIB], [SHARED_SOURCE_PATH, SHARED], [DOCUMENTATION_CSS_PATH, CSS]]) assert.deepEqual(files.get(target), overlay.files.get(source)); assert.deepEqual(files.get(XML), documentationAdaptationXml(version));
  const a = JSON.parse(files.get('ADAPTATION.json')); const plan = JSON.parse(files.get('adoption-plan.json')); const config = JSON.parse(files.get('host-config.json'));
  assert.equal(a.upstreamRightsReviewRequired, true); assert.equal(a.schemaModified, false); assert.equal(a.vendorLicenseAssigned, false); assert.equal(a.generator.algorithmModified, false); assert.equal(a.adoptionApi.byteIdenticalRelocation, true); for (const flag of FLAGS) { assert.equal(plan[flag], false); assert.equal(a[flag], false); }
  assert.equal(a.adoptionApi.sha256, DOCUMENTATION_API_SHA256); assert.equal(a.adoptionApi.sha256, sha256(await readFile(join(PROJECT, a.adoptionApi.path)))); assert.equal(a.generator.sha256, sha256(await readFile(join(PROJECT, '..', 'CAMAP2', a.generator.path))));
  assert.ok(ADAPTATION_MIT_HASHES.includes(sha256(files.get(INHERITED_LICENSE_PATH)))); assert.deepEqual(files.get(CHANGES_LICENSE_PATH), gpl);
  const p = { changes: a.changes, licenses: a.originalLicenses, snapshot: a.snapshot, inheritedLicense: a.inheritedLicenseSource, inheritedLicenseBytes: files.get(INHERITED_LICENSE_PATH), changesLicenseSource: a.changesLicenseSource, changesLicenseBytes: files.get(CHANGES_LICENSE_PATH), generatorSha256: a.generator.sha256, adoptionApiSha256: a.adoptionApi.sha256 };
  const staged = new Map(files); for (const path of ['ADAPTATION.json', 'docs/ADAPTATION-NOTICE.md', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) staged.delete(path);
  const oldPlan = { ...plan }; for (const key of ['adaptation', 'inheritedLicenseSource', 'changesLicenseSource', 'sourceRootLicensePresent']) delete oldPlan[key]; oldPlan.licenses = []; oldPlan.sourceLicensePresent = false; staged.set('adoption-plan.json', json(oldPlan));
  staged.set('MANIFEST-SHA256.json', json({ ...inventory, files: [...staged].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) })); const oldConfig = structuredClone(config); oldConfig.joomlaDiscoveryRoots[0].inventoryHash = sha256(staged.get('MANIFEST-SHA256.json')); staged.set('host-config.json', json(oldConfig));
  const final = finalizeDocumentationPackage(staged, p); for (const [path, bytes] of final.files) assert.deepEqual(files.get(path), bytes, `reconstructed final ${path}`);
  for (const entry of a.snapshot) { const bytes = await readFile(join(PROJECT, '..', 'CAMAP2', entry.path)); assert.equal(entry.originalSha256, sha256(bytes)); assert.equal(entry.bytes, bytes.length); }
  const patched = applyDocumentationOverlay(new Map(await Promise.all(Object.keys(DOCUMENTATION_ANCHORS).map(async path => [path, await readFile(join(PROJECT, '..', 'CAMAP2', path))])))); for (const change of a.changes) assert.deepEqual(change, patched.changes.find(item => item.path === change.path));
  const parsed = parseJoomlaManifest(files.get(XML), { baseUrl: plan.base, manifestPath: XML }); validateAdoptionSchema(parsed, loaded); assert.equal(parsed.params.length, 24);
  const port = { async listFolders() { return { value: [{ Name: ELEMENT }] }; }, async downloadFile({ folderPath, fileName }) { const path = [folderPath, fileName].filter(Boolean).join('/'); assert.ok(files.has(path)); return Buffer.from(files.get(path)); } }; const service = createJoomlaDiscoveryService({ roots: [{ ...config.joomlaDiscoveryRoots[0], files: port }] }); const discovered = await service.scan(); assert.equal(discovered.length, 1); await service.verify(discovered[0]); assert.equal(config.joomlaDiscoveryRoots[0].inventoryHash, sha256(invBytes));
  return { version, patches: 3, schemaFields: 24, inventoriedFiles: 11, totalFiles: 13, inventoryHash: sha256(invBytes), browserValidated: false, publicationApproved: false, rightsApproved: false, upstreamRightsReviewRequired: true };
}
export async function runDocumentationAdaptationTests() { for (const { run } of cases) await run(); console.log(`ok - Documentation adaptation: ${cases.length} portable cases; pinned sources, 24 fields, inert data, cycles/duplicates, URLs, CSS, integrity, preserved JSON`); return { suite: 'documentation-adaptation', tests: cases.length, passed: cases.length, mode: 'portable-pinned-source', browserValidated: false, publicationApproved: false }; }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { test } = await import('node:test'); for (const { name, run } of cases) test(name, run);
  const cli = process.argv.slice(2);
  if (cli.includes('--local-build')) test('explicit local build: both revisions, original creator canonical XML, CSS AST, file-port/unchanged inputs', async () => {
    assert.deepEqual(cli, ['--local-build']); const source = createAdaptationCollector(); const camap = join(PROJECT, '..', 'CAMAP2'); await source.add(camap, SHARED_SOURCE_PATH); await source.add(camap, 'tools/prepare-joomla-modules.js'); await source.add(camap, 'package.json'); for (const { folder } of ADOPTION_MODULES) { const directory = `extensions/camap/${folder}`; for (const entry of await source.list(camap, directory)) if (entry.isFile() && /\.(js|css)$/.test(entry.name)) await source.add(camap, `${directory}/${entry.name}`); }
    const deps = await collectAdaptationDependencies(join(PROJECT, 'tmp/step2/camap-source')); const require = createRequire(join(PROJECT, 'tmp/step2/camap-source/package.json')); const css = require('css-tree'); const expected = css.parse(cssSource, { positions: false }); expected.children.appendList(css.parse(DOCUMENTATION_CSS_APPEND, { positions: false }).children); assert.equal(css.generate(expected), css.generate(css.parse(overlay.files.get(DOCUMENTATION_CSS_PATH).toString(), { positions: false })));
    // Optional coordinator receipt lives outside our write scope; read only.
    try { assert.equal(DOCUMENTATION_CSS_APPEND, await readFile(join(PROJECT, 'tmp/documentation-cycle/corrected-final.css'), 'utf8'), 'append byte-identical to approved final site counterprobe CSS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const api = createAdaptationCollector(); for (const path of ADAPTATION_API_FILES) await api.add(PROJECT, path); await api.add(PROJECT, CHANGES_LICENSE_PATH); const originalMit = await readFile(join(PROJECT, '..', 'LICENSE')); const container = await mkdtemp(join(PROJECT, 'tmp/documentation-adapt-agent-tests-')); const receipts = []; const params = [];
    for (const version of ['0.3.0', '0.3.1']) { const output = `${relative(PROJECT, container).replaceAll('\\', '/')}/${version}`; const options = { version, base: `/offline/documentation/${version}`, output }; const built = await prepareDocumentationAdaptation(options); receipts.push({ ...await auditDocumentationAdaptationPackage(output, version), sourceFiles: built.originalSourceFiles, dependencyFiles: built.dependencyFiles }); params.push(built.descriptor.params); await assert.rejects(prepareDocumentationAdaptation(options), /existing output/); await assert.rejects(prepareDocumentationAdaptation({ ...options, sourceRoot: built.snapshot, output: `${output}-override-rejected` }), /trusted CAMAP copy/); }
    await Promise.all([source.check(), deps.check(), api.check()]); assert.deepEqual(await readFile(join(PROJECT, '..', 'LICENSE')), originalMit); assert.deepEqual(params[0], params[1]); assert.notEqual(receipts[0].inventoryHash, receipts[1].inventoryHash); console.log(JSON.stringify({ output: container, receipts }, null, 2));
  });
  else if (cli.length) test('explicit read-only package audits', async () => { assert.equal(cli.length, 3); assert.equal(cli[0], '--packages'); for (let i = 0; i < 2; i++) console.log(JSON.stringify(await auditDocumentationAdaptationPackage(cli[i + 1], ['0.3.0', '0.3.1'][i]))); });
}
