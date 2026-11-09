/* SPDX-License-Identifier: GPL-2.0-or-later
 * Complete compressed pinned original source DATA; never foreign code imports.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import {
  applyRecursosOverlay, finalizeRecursosPackage, prepareRecursosAdaptation, parseRecursosAdaptationArgs,
  RECURSOS_ANCHORS, RECURSOS_SOURCE_PATH, RECURSOS_CSS_PATH, RECURSOS_API_SHA256, RECURSOS_DEFAULTS,
  SHARED_SOURCE_PATH, RECURSOS_VALIDATION_SOURCE, RECURSOS_CSS_OLD_ROOT, RECURSOS_CSS_NEW_ROOT, RECURSOS_CSS_APPEND, RECURSOS_PREVIEW_NOTE,
  recursosAdaptationXml, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256
} from '../scripts/prepare-recursos-adaptation.js';
import { SAFE_URL_SOURCE, readAdaptationFiles, createAdaptationCollector, collectAdaptationDependencies, ADAPTATION_API_FILES, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES, ADAPTATION_ORIGIN_COMMIT } from '../scripts/prepare-editorial-adaptation.js';
import { ADOPTION_MODULES, validateAdoptionSchema } from '../scripts/prepare-module-adoption.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { parseJsonObject, normalizeParamValues } from '../src/libraries/minijoomla/application/declared-params.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELEMENT = 'mod_recursos'; const KEY = `camap.${ELEMENT}`;
const LIB = `libraries/camap/${RECURSOS_SOURCE_PATH}`; const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${ELEMENT}/css/recursos.css`; const ENTRY = `modules/${ELEMENT}/${ELEMENT}.js`; const XML = `modules/${ELEMENT}/${ELEMENT}.xml`;
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(bytes.toString().replace(/\r\n?/g, '\n'));
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cases = []; const registerCase = (name, run) => cases.push({ name, run });
// Complete 424-line module and 760-line stylesheet, LF/BOM preserved. Gzip
// compression is data storage only. SHA-256 trust gate precedes every import.
const MODULE_GZIP = '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';
const CSS_GZIP = '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';
const MODULE_SOURCE = gunzipSync(Buffer.from(MODULE_GZIP, 'base64')).toString();
const CSS_SOURCE = gunzipSync(Buffer.from(CSS_GZIP, 'base64')).toString();
const SHARED_SOURCE = '\uFEFF' + [
  "export function escapeHtml(value = '') { return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }",
  "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }",
  "export function stateMessage(state, empty = 'Nenhum conteúdo disponível.') { if (state === 'loading') return '<p role=\"status\" aria-live=\"polite\">Carregando…</p>'; if (state === 'error') return '<p role=\"alert\">Não foi possível carregar este módulo.</p>'; if (state === 'empty') return `<p role=\"status\">${escapeHtml(empty)}</p>`; return ''; }", ''
].join('\n');
const originals = new Map([[SHARED_SOURCE_PATH, Buffer.from(SHARED_SOURCE)], [RECURSOS_SOURCE_PATH, Buffer.from(MODULE_SOURCE)], [RECURSOS_CSS_PATH, Buffer.from(CSS_SOURCE)]]);
for (const [path, bytes] of originals) assert.equal(sha256(bytes), RECURSOS_ANCHORS[path][1], path);
const overlay = applyRecursosOverlay(originals);
const shared = await import(dataUrl(overlay.files.get(SHARED_SOURCE_PATH)));
function moduleUrl(files) {
  const source = files.get(RECURSOS_SOURCE_PATH).toString(); const anchor = "from '../_shared/render.js';";
  assert.equal(source.split(anchor).length, 2);
  return dataUrl(source.replace(anchor, () => `from '${dataUrl(files.get(SHARED_SOURCE_PATH))}';`));
}
const loaded = await import(moduleUrl(overlay.files)); const prior = await import(moduleUrl(originals));
const render = (settings = {}, state = 'ready') => loaded.default.render({ settings, state });
const valid = (title = 'Local', extra = {}) => ({ title, url: '/local/resource', category: 'Local', ...extra });
const count = (html, cls) => (html.match(new RegExp(`<a class="mse-recursos__${cls}"`, 'g')) ?? []).length;
const controlsOnly = html => html.replaceAll('aria-disabled="true"', 'disabled aria-disabled="true"').replace('            maxlength="100"', '            readonly aria-readonly="true"\n            maxlength="100"').replace('      </div>\n    </header>', `      </div>\n      <p class="mse-recursos__preview-note" role="note">${RECURSOS_PREVIEW_NOTE}</p>\n    </header>`);
const descriptor = parseJoomlaManifest(recursosAdaptationXml('0.4.0'), { baseUrl: '/offline/recursos/0.4.0', manifestPath: XML });
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
const gpl = await readFile(join(PROJECT, CHANGES_LICENSE_PATH)); assert.equal(sha256(gpl), CHANGES_LICENSE_SHA256);
function provenance() {
  const snapshot = [...originals].map(([path, bytes]) => ({ path, originalSha256: sha256(bytes), snapshotSha256: sha256(overlay.files.get(path)), bytes: bytes.length }));
  for (const path of ['tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.filter(({ folder }) => folder !== ELEMENT).map(({ folder }) => `extensions/camap/${folder}/module.js`)]) {
    // Synthetic metadata ONLY, never source code; local audit checks all real bytes.
    const hash = path.startsWith('tools/') ? ADAPTATION_GENERATOR_HASHES[0] : sha256(Buffer.from(`inert fixture metadata: ${path}`));
    snapshot.push({ path, originalSha256: hash, snapshotSha256: hash, bytes: 0 });
  }
  return { changes: structuredClone(overlay.changes), licenses: [], generatorSha256: ADAPTATION_GENERATOR_HASHES[0], adoptionApiSha256: RECURSOS_API_SHA256, snapshot,
    inheritedLicenseBytes: mit, inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: [RECURSOS_SOURCE_PATH, SHARED_SOURCE_PATH, RECURSOS_CSS_PATH], globalVendorRightsApproved: false, evidence: 'Portable exact historical notice; actual local sources checked in explicit audit.' },
    changesLicenseBytes: gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' } };
}
function rebuildInventory(files, version = '0.4.0') {
  const base = `/offline/recursos/${version}`;
  const inv = json({ format: 'minijoomla-joomla-package-v1', version, moduleKeys: { [ELEMENT]: KEY }, moduleStyles: { [KEY]: [CSS] }, files: [...files].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) });
  files.set('MANIFEST-SHA256.json', inv);
  files.set('host-config.json', json({ joomlaDiscoveryRoots: [{ id: `camap-${ELEMENT}-${version}`, baseUrl: base, inventoryHash: sha256(inv), immutable: true, discover: true }], moduleStyles: { [KEY]: [`${base}/${CSS}`] }, moduleStyleRevisions: { [KEY]: { [`${base}/${ENTRY}`]: [`${base}/${CSS}`] } } }));
  return files;
}
function stagedFixture(version = '0.4.0') {
  return rebuildInventory(new Map([[LIB, overlay.files.get(RECURSOS_SOURCE_PATH)], [SHARED, overlay.files.get(SHARED_SOURCE_PATH)], [CSS, overlay.files.get(RECURSOS_CSS_PATH)], [ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`)], [XML, recursosAdaptationXml(version)], ['docs/ADOPTION-NOTICE.md', Buffer.from('Offline fixture\n')], ['adoption-plan.json', json({ format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module: ELEMENT, key: KEY, version, base: `/offline/recursos/${version}`, pilot: false, validation: 'Portable fixture', licenses: [], sourceLicensePresent: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), nextGate: 'Coordinator review', hostNote: 'One root only' })]]), version);
}

registerCase('three complete pinned sources, exact schema/defaults and reversible scoped CSS/shared patch', () => {
  assert.equal(overlay.files.size, 3); assert.equal(overlay.changes.length, 3);
  assert.deepEqual(loaded.defaults, prior.defaults); assert.deepEqual(loaded.defaults, RECURSOS_DEFAULTS); assert.deepEqual(loaded.settingsSchema, prior.settingsSchema);
  assert.equal(loaded.default.name, KEY); assert.equal(loaded.default.settings, loaded.defaults); assert.equal(loaded.default.settingsSchema, loaded.settingsSchema);
  assert.equal(overlay.files.get(SHARED_SOURCE_PATH).toString().replace(SAFE_URL_SOURCE, SHARED_SOURCE.split('\n')[1]), SHARED_SOURCE);
  assert.equal(overlay.files.get(RECURSOS_CSS_PATH).toString().replace(RECURSOS_CSS_APPEND + '\n', '').replace(RECURSOS_CSS_NEW_ROOT + ' {', RECURSOS_CSS_OLD_ROOT + ' {'), CSS_SOURCE);
  assert.ok(overlay.files.get(RECURSOS_SOURCE_PATH).toString().includes(RECURSOS_VALIDATION_SOURCE));
});
registerCase('source changes, foreign overlay paths, forged/hooked bytes refused before execution', () => {
  for (const path of originals.keys()) { const bad = new Map(originals); bad.set(path, Buffer.concat([bad.get(path), Buffer.from('// unreviewed')])); assert.throws(() => applyRecursosOverlay(bad), /Unapproved original SHA-256/); }
  assert.throws(() => applyRecursosOverlay(new Map()), /exactly/); assert.throws(() => applyRecursosOverlay(new Map([...originals, ['foreign.js', Buffer.alloc(0)]])), /exactly/);
  let calls = 0; const bad = new Map(originals); bad.set(RECURSOS_SOURCE_PATH, Object.defineProperty(Buffer.from(MODULE_SOURCE), 'length', { get() { calls++; throw Error('not executed'); } }));
  assert.throws(() => applyRecursosOverlay(bad), /Buffer own byte indices/); assert.equal(calls, 0);
});
registerCase('shared strict URLs reject credentials, protocol/percent evasions and nonstring coercion', () => {
  for (const href of ['#', '#/local', '/local/a?q="x"&v=1', '/local/caf%C3%A9', 'https://example.invalid/a', 'HTTPS://EXAMPLE.invalid/a']) assert.equal(shared.safeUrl(href), href);
  for (const href of [null, undefined, false, 2, {}, [], '', ' ', 'relative', '?query', 'http://example.invalid', 'javascript:x', 'data:text/html,x', '//unsafe.invalid', '/\\unsafe.invalid', 'https://u:p@example.invalid', 'https://@example.invalid', 'https:///example.invalid', 'https://[invalid', '/a b', '/a\t', '/a\0', '/a\u007f', '/%2funsafe', '/%5cunsafe', '/%0a', '/%252funsafe', '/%25250a', '/%2525252f', '/bad%', '/bad%zz', '/%20x', '/%C2%A0x', ' /x', '/x ']) assert.equal(shared.safeUrl(href), '#');
  let calls = 0; const evil = { toString() { calls++; throw Error('not called'); } }; assert.equal(shared.safeUrl(evil, evil), '#'); assert.equal(calls, 0);
});
registerCase('all eleven ordered typed XML fields/options/defaults without invented search constraints', () => {
  validateAdoptionSchema(descriptor, loaded); assert.equal(descriptor.params.length, 11);
  assert.deepEqual(descriptor.params.map(p => p.default), Object.values(loaded.defaults));
  assert.deepEqual(descriptor.params.map(p => [p.name, p.type, p.valueType]), [['title', 'text', undefined], ['homeLabel', 'text', undefined], ['homeHref', 'text', undefined], ['search', 'text', undefined], ['category', 'text', undefined], ['sort', 'select', undefined], ['view', 'select', undefined], ['showActions', 'checkbox', undefined], ['showShortcuts', 'checkbox', undefined], ['categories', 'json', 'array'], ['links', 'json', 'array']]);
  assert.deepEqual(descriptor.params[5].options.map(p => p.value), ['curada', 'alfabetica']); assert.deepEqual(descriptor.params[6].options.map(p => p.value), ['cartoes', 'compacta']);
  for (const p of descriptor.params) for (const field of ['min', 'max', 'maxLength']) assert.equal(Object.hasOwn(p, field), false);
  assert.match(render({ links: [valid()] }), /maxlength="100"/); assert.doesNotMatch(recursosAdaptationXml('0.4.0').toString(), /maxlength/);
});
registerCase('valid rendering preserves original markup/grouping/curated-alpha ordering except honest controls/note', () => {
  const links = [valid('Zeta', { order: '2', description: 'Z <&', iconKey: 'pp' }), valid('Alfa', { order: '-1', category: 'Other', openInNewWindow: false }), valid('Beta', { order: '1' })];
  for (const view of ['cartoes', 'compacta']) for (const sort of ['curada', 'alfabetica']) for (const category of ['todas', 'Local', 'absent']) {
    const settings = { title: 'Explore <&', homeLabel: 'Home <&', homeHref: '/local/a?q="x"&v=1', links, view, sort, category, categories: [' Other ', 'Local'], search: '' };
    assert.equal(render(settings), controlsOnly(prior.default.render({ settings })));
  }
  assert.doesNotMatch(render({ links: [valid()], future: 'UNKNOWN', imageUrl: 'UNKNOWN' }), /UNKNOWN|<img/);
});
registerCase('legacy aliases preserve own nullish precedence, exact strings and configured category whitespace', () => {
  const legacy = { Title: 'Historical <&', URL: '/local/old', Categoria: ' Local ', Descricao: 'Description <&', IconeChave: 'sap', Ordem: '2', AbrirNovaJanela: false, Ativo: true };
  const canonical = { title: legacy.Title, url: legacy.URL, category: legacy.Categoria, description: legacy.Descricao, iconKey: legacy.IconeChave, order: legacy.Ordem, openInNewWindow: false, active: true };
  assert.equal(render({ links: [legacy] }), render({ links: [canonical] }));
  assert.equal(render({ links: [{ ...legacy, title: null, url: undefined, active: null }] }), render({ links: [canonical] }));
  assert.match(render({ links: [{ ...legacy, title: 'Own', Title: 'Ignored' }] }), />Own<\/span>/); assert.doesNotMatch(render({ links: [{ ...legacy, title: '' }] }), /Historical/);
  const html = render({ links: [valid('A', { category: ' Local ' })], categories: [' Local ', '', ' ', 4] });
  assert.match(html, /<span> Local <\/span>/); assert.match(html, /<span>Local<\/span>/);
});
registerCase('strict text and URLs omit unsafe links across cards/shortcuts/compact, never href fallback #', () => {
  for (const row of [null, false, 4, [], {}, { title: 'Only' }, valid('', {}), valid(' '), valid('X', { title: 1 }), valid('X', { description: {} }), valid('X', { iconKey: [] }), valid('X', { category: 2 }), Object.create(valid())]) for (const view of ['cartoes', 'compacta']) assert.match(render({ links: [row], view }), /Nenhum link publicado ainda/);
  for (const url of ['#', '', ' ', 'javascript:x', 'http://bad.invalid', '//bad.invalid', '/%252fhost', '/a b', ' /local', {}, false]) for (const view of ['cartoes', 'compacta']) { const html = render({ links: [valid('BAD', { url }), valid('GOOD')], homeHref: '#', view }); assert.doesNotMatch(html, /BAD|href="#"/); assert.equal(count(html, view === 'cartoes' ? 'card' : 'row'), 1); }
  const url = 'https://example.invalid/path?q="x"&v=1'; const html = render({ links: [valid('Safe <&', { url })] }); assert.match(html, /href="https:\/\/example.invalid\/path\?q=&quot;x&quot;&amp;v=1"/); assert.doesNotMatch(html, /&amp;amp;/);
});
registerCase('strict finite order/boolean flags are conservative render-only; no saved lexical false conversion', () => {
  for (const order of [0, -2, 1.5, '+2', '-.5', '1.', '.2', '001']) assert.equal(count(render({ links: [valid('A', { order })] }), 'card'), 1);
  for (const order of [NaN, Infinity, {}, [], '', ' ', ' 2', '2 ', '1e2', '0x10', 'Infinity', '1_000', '9'.repeat(400)]) assert.match(render({ links: [valid('A', { order })] }), /Nenhum link publicado ainda/);
  for (const key of ['active', 'openInNewWindow']) for (const value of ['false', 'true', 0, 1, {}, []]) assert.match(render({ links: [valid('A', { [key]: value })] }), /Nenhum link publicado ainda/);
  assert.match(render({ links: [valid('A', { active: false })] }), /Nenhum link publicado ainda/);
  assert.equal(count(render({ links: [valid('A', { active: null, openInNewWindow: null, order: null })] }), 'card'), 1);
  assert.match(render({ links: [valid()] }), /target="_blank" rel="noopener noreferrer"/); assert.doesNotMatch(render({ links: [valid('A', { openInNewWindow: false })] }), /target="_blank"/);
  assert.match(render({ links: [valid('A', { openInNewWindow: false })], view: 'compacta' }), /row-external" aria-hidden="true">↗/);
});
registerCase('own plain settings/context/rows and dense arrays reject getters/functions/symbols without calls', () => {
  let calls = 0; const getter = () => { calls++; throw Error('not called'); }; const evil = { toJSON: getter, toString: getter, valueOf: getter };
  for (const settings of [null, false, 1, 'settings', [], Object.create({ links: [valid()] }), Object.defineProperty({ links: [valid()] }, 'unknown', { get: getter }), evil]) assert.doesNotThrow(() => render(settings));
  for (const context of [null, false, 3, [], evil, Object.create({ settings: { links: [valid()] } }), Object.defineProperty({}, 'settings', { get: getter }), Object.defineProperty({ settings: {} }, 'state', { get: getter })]) assert.doesNotThrow(() => loaded.default.render(context));
  for (const links of [Array(3), Array.from({ length: 501 }, () => valid()), Object.defineProperty([valid()], 'extra', { get: getter }), Object.defineProperty([], '0', { get: getter }), [Object.defineProperty(valid(), 'title', { get: getter })], [Object.defineProperty(valid(), 'unknown', { get: getter })], [evil], [Object.defineProperty(valid(), Symbol('x'), { value: 1 })]]) assert.match(render({ links }), /Nenhum link publicado ainda/);
  const huge = Object.defineProperty(Array(1000000), '0', { get: getter });
  assert.match(render({ links: huge }), /Nenhum link publicado ainda/);
  const arraySource = RECURSOS_VALIDATION_SOURCE.slice(RECURSOS_VALIDATION_SOURCE.indexOf('function _recursosArray'), RECURSOS_VALIDATION_SOURCE.indexOf('function _recursosOwn'));
  assert.ok(arraySource.indexOf("Object.getOwnPropertyDescriptor(value, 'length')") < arraySource.indexOf('length > 500'));
  assert.ok(arraySource.indexOf('length > 500') < arraySource.indexOf('Object.getOwnPropertyDescriptors(value)'));
  for (const key of ['title', 'homeLabel', 'homeHref', 'search', 'category', 'sort', 'view', 'showActions', 'showShortcuts']) assert.doesNotThrow(() => render({ links: [valid()], [key]: evil }));
  assert.equal(calls, 0);
});
registerCase('full search term filters; input preview truncates only, static controls are truly readonly/disabled', () => {
  const term = 'q'.repeat(120); const html = render({ links: [valid('A', { description: term })], search: term });
  assert.equal(count(html, 'card'), 1); assert.match(html, new RegExp(`value="${term.slice(0, 100)}"`)); assert.ok(html.includes(`&quot;${term}&quot;`));
  assert.equal(count(render({ links: [valid('A', { description: term.slice(0, 100) })], search: term }), 'card'), 0);
  for (const input of [html, render({ links: [valid()], category: 'none' })]) {
    for (const tag of input.match(/<(?:button|select)\b[^>]*>/g) ?? []) { assert.match(tag, /\bdisabled\s/); assert.match(tag, /aria-disabled="true"/); }
    assert.match(input, /readonly aria-readonly="true"/); assert.ok(input.includes(RECURSOS_PREVIEW_NOTE)); assert.match(input, /role="note"/);
  }
  assert.doesNotMatch(overlay.files.get(RECURSOS_SOURCE_PATH).toString(), /addEventListener|setInterval|setTimeout|document\./);
});
registerCase('breadcrumb invalid href renders nonlink escaped label; no IDs or fabricated title landmark changes', () => {
  for (const homeHref of ['#', 'javascript:x', '//bad.invalid', '', null, {}]) {
    const html = render({ links: [valid()], homeLabel: 'Home " <&', homeHref }); assert.match(html, /<span class="mse-recursos__breadcrumb-link">Home &quot; &lt;&amp;<\/span>/); assert.doesNotMatch(html, /<a class="mse-recursos__breadcrumb-link"|href="#"/);
  }
  assert.doesNotMatch(render({ links: [valid()] }) + render({ links: [valid()] }), /\sid=|aria-labelledby/);
  assert.match(render({ links: [valid()] }), /<h1 class="mse-recursos__pagebar-title">Explore Mais<\/h1>/);
});
registerCase('loading/error/no-published/filter-empty and unknown/empty state semantics retained', () => {
  for (const state of ['loading', 'error']) assert.equal(render({ links: [valid()] }, state), prior.default.render({ settings: { links: [valid()] }, state }));
  for (const state of ['ready', 'empty', 'unknown', null, false, 1, { toString() { throw Error('not called'); } }]) assert.equal(render({ links: [valid()] }, state), controlsOnly(prior.default.render({ settings: { links: [valid()] }, state: 'ready' })));
  assert.match(render(), /role="status">Nenhum link publicado ainda/); assert.match(render({ links: [valid()], search: 'absent' }), /Nenhum link encontrado/);
  assert.match(render({ links: [valid()], sort: 'invalid', view: {} }), /mse-recursos__card/);
  assert.doesNotMatch(render({ links: [valid()], showActions: 'true', showShortcuts: 'true' }), /pagebar-actions|Atalhos mais usados/);
});
registerCase('shortcut first-curated-per-category selection, static count labels, grouping unchanged', () => {
  const links = [valid('Later', { order: 5 }), valid('First', { order: 1 }), valid('Other', { category: 'Other' }), valid('Inactive', { active: false })];
  const html = render({ links }); assert.equal(count(html, 'shortcut'), 2); assert.equal(count(html, 'card'), 3); assert.match(html, /Atalhos mais usados/); assert.match(html, /2 LINKS/); assert.match(html, /1 LINK/); assert.doesNotMatch(html, /Inactive/);
  assert.ok(html.indexOf('shortcut-name">First') < html.indexOf('card-title">First'));
  assert.equal(count(render({ links, search: 'First' }), 'shortcut'), 0); assert.equal(count(render({ links, view: 'compacta' }), 'shortcut'), 0);
});
registerCase('scoped CSS exact approved reflow, original declarations and entire trailing summary retained', () => {
  const css = overlay.files.get(RECURSOS_CSS_PATH).toString(); assert.equal(css, CSS_SOURCE.replace(RECURSOS_CSS_OLD_ROOT, RECURSOS_CSS_NEW_ROOT) + RECURSOS_CSS_APPEND + '\n');
  assert.equal(RECURSOS_CSS_APPEND.split('\n').length, 16); assert.match(RECURSOS_CSS_APPEND, /@container\(max-width:400px\)/); assert.match(RECURSOS_CSS_APPEND, /minmax\(min\(18rem,100%\),1fr\)/); assert.match(RECURSOS_CSS_APPEND, /chip-count\{flex:0 0 auto\}/);
  assert.doesNotMatch(RECURSOS_CSS_APPEND, /body|header\{|color:|font:|padding:|overflow:hidden|@import|url\(/);
  const summary = CSS_SOURCE.slice(CSS_SOURCE.indexOf('/* Home-page teaser')); assert.ok(css.includes(summary)); assert.match(css, /overflow: hidden/);
  assert.equal(sha256(overlay.files.get(RECURSOS_SOURCE_PATH)), '4d34ff0852942fab9c24b680fb6bfb395af3e015d36bc6ce02bfc6a71503116d');
  assert.equal(sha256(overlay.files.get(RECURSOS_CSS_PATH)), 'b25243f0672426e8260446dc194db96ccd5a4ffb08d29ea4959b371192737dad');
});
registerCase('compact category fit-content cap leaves title track and preserves narrow stacking/long JSON fields', () => {
  const suffix = '.mse-recursos__row{grid-template-columns:minmax(0,1fr) fit-content(40%)}@container(max-width:400px){.mse-recursos__row{grid-template-columns:minmax(0,1fr)}}';
  assert.ok(RECURSOS_CSS_APPEND.endsWith(suffix));
  assert.ok(RECURSOS_CSS_APPEND.lastIndexOf('fit-content(40%)') < RECURSOS_CSS_APPEND.lastIndexOf('@container(max-width:400px)'));
  assert.equal((RECURSOS_CSS_APPEND.match(/@container\(max-width:400px\)/g) ?? []).length, 2);
  assert.doesNotMatch(suffix, /overflow|font|padding|display|width:0/);
  const category = 'K'.repeat(180); const title = 'T'.repeat(100) + ' <&'; const description = 'D'.repeat(300) + ' <&';
  const settings = { links: [valid(title, { description, category, openInNewWindow: false })], categories: [category], view: 'compacta' };
  const before = JSON.stringify(settings); const html = render(settings);
  assert.equal(JSON.stringify(settings), before); assert.equal(count(html, 'row'), 1);
  assert.ok(html.includes(`<span class="mse-recursos__row-title">${shared.escapeHtml(title)}</span>`));
  assert.ok(html.includes(`<span class="mse-recursos__row-description">${shared.escapeHtml(description)}</span>`));
  assert.ok(html.includes(`<span class="mse-recursos__row-category">${category}</span>`));
  assert.equal(html, controlsOnly(prior.default.render({ settings })));
});
registerCase('render/admin read-edit-param preview roundtrip preserves full JSON including invalid/future keys', async () => {
  const settingsJson = '{"title":"T","links":[null,{}, {"Title":"Legacy","URL":"/local","Ativo":"false"},{"title":"Valid","url":"/local"}],"categories":[" Local ",3],"future":{"keep":[true]},"__proto__":{"preserved":true}}';
  let record = { id: 101, title: 'Local', extensionKey: KEY, position: 'main-top', ordering: 2, enabled: true, scopeKind: 'All', assignment: 'all', assignmentJson: '[]', settingsJson, etag: 'local-etag' }; const writes = [];
  const service = createAdminService({ moduleInstances: { async findMany() { return { items: [structuredClone(record)] }; }, async findById() { return structuredClone(record); }, async update(id, patch) { writes.push(patch); record = { ...record, ...patch }; return structuredClone(record); } }, extensions: { async findMany() { return { items: [{ key: KEY, type: 'Module', enabled: true, manifestJson: descriptor.manifestJson }] }; } } });
  const stored = JSON.parse(settingsJson); const before = JSON.stringify(stored); render(stored); assert.equal(JSON.stringify(stored), before);
  assert.equal((await service.moduleInstances.get(101)).settingsJson, settingsJson);
  await service.moduleInstances.update(101, { enabled: false }, { etag: 'local-etag' }); assert.equal(record.settingsJson, settingsJson); assert.equal(Object.hasOwn(writes[0], 'settingsJson'), false);
  const params = normalizeParamValues(descriptor.params, parseJsonObject(settingsJson, { strict: true }), { keepUndeclared: true }); assert.deepEqual(params.links, stored.links); assert.deepEqual(params.categories, stored.categories); assert.deepEqual(params.future, stored.future); assert.equal(Object.hasOwn(params, '__proto__'), true);
  await service.moduleInstances.update(101, { settingsJson: JSON.stringify(params) }, { etag: 'local-etag' }); assert.deepEqual(JSON.parse(record.settingsJson).links, stored.links); assert.deepEqual(JSON.parse(record.settingsJson).future, stored.future);
  const authorParams = { ...params, search: 'x'.repeat(120), categories: ['Local', 'Other'], links: [valid('Authored', { description: 'x'.repeat(120) }), { Title: 'Legacy', URL: '/local/legacy', Ordem: '1', Ativo: true }] };
  await service.moduleInstances.update(101, { settingsJson: JSON.stringify(authorParams) }, { etag: 'local-etag' });
  const edited = normalizeParamValues(descriptor.params, parseJsonObject((await service.moduleInstances.get(101)).settingsJson, { strict: true }), { keepUndeclared: true });
  assert.deepEqual(edited.links, authorParams.links); assert.deepEqual(edited.categories, authorParams.categories); assert.equal(edited.search.length, 120);
  assert.equal(count(loaded.default.render({ settings: edited }), 'card'), 1); assert.match(loaded.default.render({ settings: edited }), /card-title">Authored/);
});
registerCase('closed CLI/options reject foreign modules/versions/paths/code and noninert metadata', async () => {
  const base = ['--base', '/offline/recursos/0.4.0', '--output', 'tmp/recursos-adapt-agent-portable'];
  assert.equal(parseRecursosAdaptationArgs(base).dependenciesRoot, 'tmp/step2/camap-source'); assert.equal(parseRecursosAdaptationArgs(base).version, '0.4.0'); assert.deepEqual(parseRecursosAdaptationArgs(['--help']), { help: true });
  for (const module of ['all', 'mod_home', 'mod_camap_recursos']) assert.throws(() => parseRecursosAdaptationArgs([...base, '--module', module]));
  for (const version of ['0.2.0', '0.3.0', '0.3.1', '0.3.2', '0.4.2', '00.4.0']) { assert.throws(() => parseRecursosAdaptationArgs([...base, '--version', version])); assert.throws(() => recursosAdaptationXml(version), /Unauthorized/); }
  for (const output of ['public/x', 'tmp/home-adapt-agent-x', 'tmp/recursos-adapt-agent-x/../y', 'tmp/recursos-adapt-agent-x/con', 'tmp/recursos-adapt-agent-x/aux.']) assert.throws(() => parseRecursosAdaptationArgs(['--base', '/local', '--output', output]));
  for (const extra of [['--source', '../other'], ['--source', 'tmp/step2/camap-source'], ['--source', 'tmp/recursos-adapt-agent-portable/source'], ['--dependencies-root', '../other'], ['--inherited-license', '../other-LICENSE'], ['--inherited-license', 'tmp/recursos-adapt-agent-portable/LICENSE'], ['--profile', 'open'], ['--patches', 'code'], ['--base', '/duplicate']]) assert.throws(() => parseRecursosAdaptationArgs([...base, ...extra]));
  let calls = 0; await assert.rejects(prepareRecursosAdaptation(Object.defineProperty({}, 'base', { get() { calls++; throw Error('not called'); } })), /accessor/); await assert.rejects(prepareRecursosAdaptation({ ...parseRecursosAdaptationArgs(base), hashes: {} }), /Unknown/); await assert.rejects(prepareRecursosAdaptation({ toJSON() { calls++; } }), /plain metadata/); assert.equal(calls, 0);
});
registerCase('closed finalizer produces 5 runtime/11 payload/13 total complete licenses, false gates, both revisions', () => {
  const hashes = [];
  for (const version of ['0.4.0', '0.4.1']) {
    const staged = stagedFixture(version); const before = Buffer.from(staged.get('MANIFEST-SHA256.json')); const final = finalizeRecursosPackage(staged, provenance());
    assert.deepEqual(staged.get('MANIFEST-SHA256.json'), before); assert.equal(final.files.size, 13); assert.equal(final.inventory.files.length, 11); assert.equal(final.adaptation.changes.length, 3);
    assert.equal(final.adaptation.schemaModified, false); assert.equal(final.adaptation.cssModified, true); assert.equal(final.adaptation.markupModified, true); assert.equal(final.adaptation.vendorLicenseAssigned, false);
    assert.deepEqual(final.files.get(INHERITED_LICENSE_PATH), mit); assert.deepEqual(final.files.get(CHANGES_LICENSE_PATH), gpl);
    for (const flag of FLAGS) { assert.equal(final.adaptation[flag], false); assert.equal(final.adoptionPlan[flag], false); }
    for (const entry of final.inventory.files) { assert.equal(entry.bytes, final.files.get(entry.path).length); assert.equal(entry.sha256, sha256(final.files.get(entry.path))); }
    const inv = final.files.get('MANIFEST-SHA256.json'); assert.equal(final.hostConfig.joomlaDiscoveryRoots[0].inventoryHash, sha256(inv)); assert.deepEqual(inv, finalizeRecursosPackage(stagedFixture(version), provenance()).files.get('MANIFEST-SHA256.json')); hashes.push(sha256(inv));
  }
  assert.notEqual(hashes[0], hashes[1]);
});
registerCase('canonical XML rejects changed complete defaults/options/unknown attributes and invented constraints rehashed', () => {
  for (const [from, to] of [['name="search"', 'name="search" maxlength="100"'], ['default="Explore Mais"', 'default="Changed"'], ['#inicio', '/invented'], ['value="alfabetica"', 'value="invented"'], ['default="1"', 'default="0"'], ['mj:valueType="array"', 'mj:valueType="object"'], ['name="links"', 'name="items"'], ['method="upgrade"', 'method="upgrade" unknown="x"'], ['<fieldset name="basic">', '<fieldset name="basic" required="true">']]) {
    const staged = stagedFixture(); assert.ok(staged.get(XML).toString().includes(from)); staged.set(XML, Buffer.from(staged.get(XML).toString().replace(from, to))); rebuildInventory(staged); assert.throws(() => finalizeRecursosPackage(staged, provenance()), /XML canonical/);
  }
});
registerCase('finalizer refuses foreign/mandatory/control/provenance forgeries and callback evidence', () => {
  for (const path of ['foreign.json', `modules/${ELEMENT}/extra.js`, `libraries/camap/${RECURSOS_CSS_PATH}`, 'libraries/camap/extensions/camap/_shared/extra.js', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, 'ADAPTATION.json']) { const staged = stagedFixture(); staged.set(path, Buffer.from('foreign')); rebuildInventory(staged); assert.throws(() => finalizeRecursosPackage(staged, provenance()), /allowlist/); }
  for (const path of [ENTRY, XML, CSS, LIB, SHARED, 'docs/ADOPTION-NOTICE.md', 'host-config.json']) { const staged = stagedFixture(); staged.delete(path); assert.throws(() => finalizeRecursosPackage(staged, provenance()), /mandatory/); }
  const stale = stagedFixture(); stale.set(CSS, Buffer.from('stale')); assert.throws(() => finalizeRecursosPackage(stale, provenance()), /integrity/);
  const forged = stagedFixture(); forged.set(LIB, Buffer.from('export default {};\n')); rebuildInventory(forged); const fp = provenance(); fp.changes[1].generatedSha256 = sha256(forged.get(LIB)); assert.throws(() => finalizeRecursosPackage(forged, fp), /approved patch/);
  for (const patch of [{ changes: [] }, { licenses: ['LICENSE'] }, { generatorSha256: '0'.repeat(64) }, { adoptionApiSha256: '1'.repeat(64) }, { snapshot: [] }, { inheritedLicenseBytes: Buffer.from('MIT') }, { inheritedLicense: { ...provenance().inheritedLicense, scope: ['all vendor'] } }, { changesLicenseBytes: Buffer.from('GPL') }, { arbitrary: true }]) assert.throws(() => finalizeRecursosPackage(stagedFixture(), { ...provenance(), ...patch }));
  for (const [path, mutate] of [['host-config.json', value => { value.arbitrary = true; }], ['host-config.json', value => { value.joomlaDiscoveryRoots[0].discover = false; }], ['host-config.json', value => { value.moduleStyles[KEY].push('/foreign.css'); }], ['adoption-plan.json', value => { value.hostConfigured = true; }]]) { const staged = stagedFixture(); const value = JSON.parse(staged.get(path)); mutate(value); staged.set(path, json(value)); if (path === 'adoption-plan.json') rebuildInventory(staged); assert.throws(() => finalizeRecursosPackage(staged, provenance())); }
  let calls = 0; const p = Object.defineProperty(provenance(), 'changes', { get() { calls++; throw Error('not called'); } }); assert.throws(() => finalizeRecursosPackage(stagedFixture(), p), /accessor/); const functions = provenance(); functions.snapshot[0].toJSON = () => { calls++; }; assert.throws(() => finalizeRecursosPackage(stagedFixture(), functions), /plain metadata/); assert.equal(calls, 0);
});
registerCase('native Maps and inert Buffers reject hooks/subclasses/brand forges with zero callback execution', () => {
  let calls = 0; const callback = () => { calls++; throw Error('not called'); };
  for (const gate of [{ input: () => new Map(originals), run: value => applyRecursosOverlay(value) }, { input: () => stagedFixture(), run: value => finalizeRecursosPackage(value, provenance()) }]) {
    for (const property of ['size', 'has', 'get', 'entries', 'set', 'extra', Symbol.iterator]) for (const descriptor of [{ get: callback }, { value: callback }]) assert.throws(() => gate.run(Object.defineProperty(gate.input(), property, descriptor)), /exact native Map/);
    class HookedMap extends Map { get size() { return callback(); } get() { return callback(); } [Symbol.iterator]() { return callback(); } }
    for (const value of [new HookedMap(gate.input()), new (class extends Map {})(gate.input()), Object.setPrototypeOf(gate.input(), Object.create(Map.prototype))]) assert.throws(() => gate.run(value), /exact native Map/);
    assert.throws(() => gate.run(Object.create(Map.prototype)), /branded native Map/);
  }
  for (const property of ['length', 'valueOf', 'toJSON', 'buffer', 'byteOffset', 'byteLength', 'foo', Symbol('hook')]) {
    for (const field of ['inheritedLicenseBytes', 'changesLicenseBytes']) { const p = provenance(); p[field] = Object.defineProperty(Buffer.from(p[field]), property, { get: callback }); assert.throws(() => finalizeRecursosPackage(stagedFixture(), p), /Buffer own byte indices/); }
    const staged = stagedFixture(); staged.set(CSS, Object.defineProperty(Buffer.from(staged.get(CSS)), property, { get: callback })); assert.throws(() => finalizeRecursosPackage(staged, provenance()), /Buffer own byte indices/);
  }
  for (const bytes of [new Uint8Array([1]), Object.create(Buffer.prototype), Object.setPrototypeOf(Buffer.from('x'), Object.create(Buffer.prototype))]) { const staged = stagedFixture(); staged.set(CSS, bytes); assert.throws(() => finalizeRecursosPackage(staged, provenance()), /trusted exact Buffer/); }
  const oversized = provenance(); oversized.inheritedLicenseBytes = Buffer.alloc(11 * 1024 * 1024); assert.throws(() => finalizeRecursosPackage(stagedFixture(), oversized), /budget/);
  const staged = stagedFixture(); for (const [path, bytes] of staged) { const pool = Buffer.allocUnsafe(bytes.length + 8); bytes.copy(pool, 4); staged.set(path, pool.subarray(4, 4 + bytes.length)); }
  const final = finalizeRecursosPackage(staged, provenance()); assert.deepEqual(final.files.get(CSS), overlay.files.get(RECURSOS_CSS_PATH)); assert.notEqual(final.files.get(CSS), staged.get(CSS)); assert.equal(calls, 0);
});

/** Explicit local read-only audit: only pinned fixture JS imported above. */
export async function auditRecursosAdaptationPackage(directory, version) {
  const root = resolve(PROJECT, directory); const output = relative(PROJECT, root).replaceAll('\\', '/');
  parseRecursosAdaptationArgs(['--base', `/offline/recursos/${version}`, '--version', version, '--output', output]);
  const files = await readAdaptationFiles(root); const invBytes = files.get('MANIFEST-SHA256.json'); const inventory = JSON.parse(invBytes);
  assert.equal(inventory.version, version); assert.equal(inventory.files.length, 11); assert.equal(files.size, 13);
  for (const entry of inventory.files) { assert.equal(files.get(entry.path).length, entry.bytes); assert.equal(sha256(files.get(entry.path)), entry.sha256); }
  assert.deepEqual([...files.keys()].sort(), [...inventory.files.map(entry => entry.path), 'MANIFEST-SHA256.json', 'host-config.json'].sort());
  assert.deepEqual(files.get(LIB), overlay.files.get(RECURSOS_SOURCE_PATH)); assert.deepEqual(files.get(SHARED), overlay.files.get(SHARED_SOURCE_PATH)); assert.deepEqual(files.get(CSS), overlay.files.get(RECURSOS_CSS_PATH)); assert.deepEqual(files.get(XML), recursosAdaptationXml(version));
  const a = JSON.parse(files.get('ADAPTATION.json')); const plan = JSON.parse(files.get('adoption-plan.json')); const config = JSON.parse(files.get('host-config.json'));
  assert.equal(a.cssModified, true); assert.equal(a.markupModified, true); assert.equal(a.schemaModified, false); assert.equal(a.vendorLicenseAssigned, false); assert.equal(a.generator.algorithmModified, false); assert.equal(a.adoptionApi.byteIdenticalRelocation, true);
  assert.equal(a.adoptionApi.sha256, RECURSOS_API_SHA256); assert.equal(a.adoptionApi.sha256, sha256(await readFile(join(PROJECT, a.adoptionApi.path)))); assert.equal(a.generator.sha256, sha256(await readFile(join(PROJECT, '..', 'CAMAP2', a.generator.path))));
  assert.equal(a.inheritedLicenseSource.originCommit, ADAPTATION_ORIGIN_COMMIT); assert.ok(ADAPTATION_MIT_HASHES.includes(sha256(files.get(INHERITED_LICENSE_PATH)))); assert.deepEqual(files.get(CHANGES_LICENSE_PATH), gpl);
  for (const flag of FLAGS) { assert.equal(plan[flag], false); assert.equal(a[flag], false); }
  const p = { changes: a.changes, licenses: a.originalLicenses, snapshot: a.snapshot, inheritedLicense: a.inheritedLicenseSource, inheritedLicenseBytes: files.get(INHERITED_LICENSE_PATH), changesLicenseSource: a.changesLicenseSource, changesLicenseBytes: files.get(CHANGES_LICENSE_PATH), generatorSha256: a.generator.sha256, adoptionApiSha256: a.adoptionApi.sha256 };
  const staged = new Map(files); for (const path of ['ADAPTATION.json', 'docs/ADAPTATION-NOTICE.md', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) staged.delete(path);
  const oldPlan = { ...plan }; for (const key of ['adaptation', 'inheritedLicenseSource', 'changesLicenseSource', 'sourceRootLicensePresent']) delete oldPlan[key]; oldPlan.licenses = []; oldPlan.sourceLicensePresent = false; staged.set('adoption-plan.json', json(oldPlan));
  staged.set('MANIFEST-SHA256.json', json({ ...inventory, files: [...staged].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) }));
  const oldConfig = structuredClone(config); oldConfig.joomlaDiscoveryRoots[0].inventoryHash = sha256(staged.get('MANIFEST-SHA256.json')); staged.set('host-config.json', json(oldConfig));
  const final = finalizeRecursosPackage(staged, p); for (const [path, bytes] of final.files) assert.deepEqual(files.get(path), bytes, `reconstructed final ${path}`);
  assert.equal(a.snapshot.length, 56);
  for (const entry of a.snapshot) { const bytes = await readFile(join(PROJECT, '..', 'CAMAP2', entry.path)); assert.equal(entry.originalSha256, sha256(bytes), `actual original ${entry.path}`); assert.equal(entry.bytes, bytes.length); }
  const patched = applyRecursosOverlay(new Map(await Promise.all(Object.keys(RECURSOS_ANCHORS).map(async path => [path, await readFile(join(PROJECT, '..', 'CAMAP2', path))]))));
  for (const change of a.changes) assert.deepEqual(change, patched.changes.find(item => item.path === change.path));
  const parsed = parseJoomlaManifest(files.get(XML), { baseUrl: plan.base, manifestPath: XML }); validateAdoptionSchema(parsed, loaded); assert.deepEqual(parsed.params.map(p => p.default), Object.values(prior.defaults));
  const port = { async listFolders() { return { value: [{ Name: ELEMENT }] }; }, async downloadFile({ folderPath, fileName }) { const path = [folderPath, fileName].filter(Boolean).join('/'); assert.ok(files.has(path)); return Buffer.from(files.get(path)); } };
  const service = createJoomlaDiscoveryService({ roots: [{ ...config.joomlaDiscoveryRoots[0], files: port }] }); const discovered = await service.scan(); assert.equal(discovered.length, 1); await service.verify(discovered[0]);
  assert.equal(config.joomlaDiscoveryRoots[0].inventoryHash, sha256(invBytes));
  return { version, reviewedSources: 3, patches: 3, cssModified: true, markupModified: true, schemaFields: 11, inventoriedFiles: inventory.files.length, totalFiles: files.size, inventoryHash: sha256(invBytes), browserValidated: false, publicationApproved: false, rightsApproved: false };
}
export async function runRecursosAdaptationTests() {
  assert.equal(cases.length, 21); for (const { run } of cases) await run();
  console.log('ok - Recursos adaptation: 21 portable cases; pinned sources/schema/URLs/legacy rows/flags/context/static controls/CSS/compact track/JSON/notices/Map/Buffer/integrity');
  return { suite: 'recursos-adaptation', tests: cases.length, passed: cases.length, mode: 'portable-pinned-source', browserValidated: false, publicationApproved: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { test } = await import('node:test'); for (const { name, run } of cases) test(name, run);
  const cli = process.argv.slice(2);
  if (cli.includes('--local-build')) {
    test('explicit offline two-version build, real CSS AST/file-port audit, unchanged originals/dependencies/API', async () => {
      assert.deepEqual(cli, ['--local-build']);
      const source = createAdaptationCollector(); const camap = join(PROJECT, '..', 'CAMAP2');
      await source.add(camap, SHARED_SOURCE_PATH); await source.add(camap, 'tools/prepare-joomla-modules.js'); await source.add(camap, 'package.json');
      for (const { folder } of ADOPTION_MODULES) { const directory = `extensions/camap/${folder}`; for (const entry of await source.list(camap, directory)) if (entry.isFile() && /\.(js|css)$/.test(entry.name)) await source.add(camap, `${directory}/${entry.name}`); }
      const deps = await collectAdaptationDependencies(join(PROJECT, 'tmp/step2/camap-source')); const require = createRequire(join(PROJECT, 'tmp/step2/camap-source/package.json')); const css = require('css-tree');
      const expected = css.parse(CSS_SOURCE, { positions: false }); expected.children.first.prelude = css.parse(RECURSOS_CSS_NEW_ROOT, { context: 'selectorList' }); expected.children.appendList(css.parse(RECURSOS_CSS_APPEND, { positions: false }).children);
      assert.equal(css.generate(expected), css.generate(css.parse(overlay.files.get(RECURSOS_CSS_PATH).toString(), { positions: false })));
      const appendNodes = css.parse(RECURSOS_CSS_APPEND, { positions: false }).children.toArray();
      assert.deepEqual(appendNodes.slice(-2).map(node => css.generate(node)), [
        '.mse-recursos__row{grid-template-columns:minmax(0,1fr) fit-content(40%)}',
        '@container (max-width:400px){.mse-recursos__row{grid-template-columns:minmax(0,1fr)}}'
      ]);
      const api = createAdaptationCollector(); for (const path of ADAPTATION_API_FILES) await api.add(PROJECT, path); await api.add(PROJECT, CHANGES_LICENSE_PATH);
      const originalMit = await readFile(join(PROJECT, '..', 'LICENSE')); const container = await mkdtemp(join(PROJECT, 'tmp/recursos-adapt-agent-tests-')); const receipts = []; const params = [];
      for (const version of ['0.4.0', '0.4.1']) {
        const output = `${relative(PROJECT, container).replaceAll('\\', '/')}/${version}`; const options = { version, base: `/offline/recursos/${version}`, output };
        const built = await prepareRecursosAdaptation(options); receipts.push({ ...await auditRecursosAdaptationPackage(output, version), sourceFiles: built.originalSourceFiles, dependencyFiles: built.dependencyFiles }); params.push(built.descriptor.params);
        await assert.rejects(prepareRecursosAdaptation(options), /existing output/); await assert.rejects(prepareRecursosAdaptation({ ...options, sourceRoot: built.snapshot, output: `${output}-override-rejected` }), /trusted CAMAP copy/);
      }
      await Promise.all([source.check(), deps.check(), api.check()]); assert.deepEqual(await readFile(join(PROJECT, '..', 'LICENSE')), originalMit); assert.deepEqual(params[0], params[1]); assert.notEqual(receipts[0].inventoryHash, receipts[1].inventoryHash);
      console.log(JSON.stringify({ output: container, receipts }, null, 2));
    });
  } else if (cli.length) {
    test('explicit read-only package audits', async () => { assert.equal(cli.length, 3); assert.equal(cli[0], '--packages'); for (let i = 0; i < 2; i++) console.log(JSON.stringify(await auditRecursosAdaptationPackage(cli[i + 1], ['0.4.0', '0.4.1'][i]))); });
  }
}
