/* SPDX-License-Identifier: GPL-2.0-or-later
 * Closed offline Recursos profile; authored changes only, not global vendor rights.
 */
import { mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ADOPTION_MODULES, assertAdoptionNoLinks, parseModuleAdoptionArgs, validateAdoptionSchema } from './prepare-module-adoption.js';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { copyInertBuffer, inertAdaptationMetadata as inert, closedAdaptationShape as shape, parseAdaptationMetadata as metadata } from './prepare-hero-adaptation.js';
import { copyNativeMap } from './prepare-home-adaptation.js';
import {
  SAFE_URL_SOURCE, SHARED_SOURCE_PATH, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH,
  CHANGES_LICENSE_SHA256, createAdaptationCollector, collectAdaptationDependencies,
  writeAdaptationFiles, readAdaptationFiles, assertNewAdaptationOutput, adaptationText,
  replaceAdaptationAnchor as replace, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES,
  ADAPTATION_ORIGIN_COMMIT, ADAPTATION_API_FILES, ADAPTATION_LICENSE_NAMES
} from './prepare-editorial-adaptation.js';
export { SHARED_SOURCE_PATH, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256 };
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(PROJECT, 'tmp');
const CAMAP = resolve(PROJECT, '..', 'CAMAP2');
const DEPS = join(TMP, 'step2', 'camap-source');
const MODULE = 'mod_recursos';
const KEY = `camap.${MODULE}`;
export const RECURSOS_SOURCE_PATH = `extensions/camap/${MODULE}/module.js`;
export const RECURSOS_CSS_PATH = `extensions/camap/${MODULE}/recursos.css`;
export const RECURSOS_ANCHORS = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze(['fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e', '33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387']),
  [RECURSOS_SOURCE_PATH]: Object.freeze(['baf5eba4967add5d3da4ee19427ad382f1248a52c1d94ee4628c1389a865d64f', '5882837be2296b26a2d9f7fcbb12d18a5121b561b22d3f3e5fbdac994c887d26']),
  [RECURSOS_CSS_PATH]: Object.freeze(['5b5d08e0b8456bffaf40962a9d5383b44e895c1b02fe68740939b20720664cf8', '66201e410e91f9992868e54e62c5494c1956261143b23008bd482d3c1d308b77'])
});
export const RECURSOS_API_SHA256 = 'ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4';
// Immutable approved generated hashes, never accepted from caller evidence.
const PINNED = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze({ raw: 'ab6e32d2105d45cff15b9aa55777675d42b418494f09b114317ae19d945f6002', lf: 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76', lengths: [654, 653, 1746, 1745] }),
  [RECURSOS_SOURCE_PATH]: Object.freeze({ raw: 'b91cbbfcf84e5a778cf33402c711a9d635394c56776bd4c4386edee387b0c56d', lf: '4d34ff0852942fab9c24b680fb6bfb395af3e015d36bc6ce02bfc6a71503116d', lengths: [15370, 15369, 18582, 18581] }),
  [RECURSOS_CSS_PATH]: Object.freeze({ raw: '99da58dc1eff2764e9a8d62b0be4fe7224dcb75c70ce11500d3a20538570fdfb', lf: 'b25243f0672426e8260446dc194db96ccd5a4ffb08d29ea4959b371192737dad', lengths: [17190, 16486, 19105, 18401] })
});
const LIB = `libraries/camap/${RECURSOS_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${MODULE}/css/recursos.css`;
const ENTRY = `modules/${MODULE}/${MODULE}.js`;
const XML = `modules/${MODULE}/${MODULE}.xml`;
const RUNTIME = [ENTRY, XML, CSS, LIB, SHARED];
const SCOPE = [RECURSOS_SOURCE_PATH, SHARED_SOURCE_PATH, RECURSOS_CSS_PATH];
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const FORMAT = 'minijoomla-recursos-adaptation-v1';
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(adaptationText(bytes, 'source').replace(/\r\n?/g, '\n'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const within = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const changeName = path => path === SHARED_SOURCE_PATH ? 'strict-url-policy-v1' : path === RECURSOS_CSS_PATH ? 'recursos-css-rendered-root-wrap-compact-track-v2' : 'runtime-recursos-inert-data-static-preview-v1';
export const RECURSOS_CSS_OLD_ROOT = '[data-mse-module="recursos"][data-mse-module="recursos"],\n[data-mse-module="explore-mais"][data-mse-module="explore-mais"]';
export const RECURSOS_CSS_NEW_ROOT = '.mse-recursos';
export const RECURSOS_CSS_APPEND = `.mse-recursos{overflow-wrap:anywhere;container-type:inline-size}
.mse-recursos__page,.mse-recursos__pagebar-inner,.mse-recursos__breadcrumb,.mse-recursos__pagebar-title,.mse-recursos__filterbar,.mse-recursos__groups,.mse-recursos__group,.mse-recursos__shortcuts,.mse-recursos__compact-list,.mse-recursos__card-title,.mse-recursos__row-right{min-width:0;max-width:100%}
.mse-recursos__breadcrumb{flex:1 1 100%;flex-wrap:wrap}
.mse-recursos__search{min-width:0;width:100%;box-sizing:border-box}
.mse-recursos__search-input{width:0}
.mse-recursos__pagebar-actions,.mse-recursos__sort,.mse-recursos__view-toggle,.mse-recursos__group-header,.mse-recursos__group-title,.mse-recursos__card-title-line,.mse-recursos__row-right{flex-wrap:wrap;min-width:0;max-width:100%}
.mse-recursos__pagebar-button,.mse-recursos__chip,.mse-recursos__view-button,.mse-recursos__clear-filters,.mse-recursos__button,.mse-recursos__select{min-width:0;max-width:100%;box-sizing:border-box;white-space:normal}
.mse-recursos__chip>span,.mse-recursos__group-title{min-width:0}
.mse-recursos__select{width:100%}
.mse-recursos__shortcut,.mse-recursos__card,.mse-recursos__row{min-width:0;max-width:100%;box-sizing:border-box}
.mse-recursos__shortcuts-grid{grid-template-columns:repeat(auto-fill,minmax(min(13rem,100%),1fr))}
.mse-recursos__card-grid{grid-template-columns:repeat(auto-fill,minmax(min(18rem,100%),1fr))}
.mse-recursos__row-category{white-space:normal;min-width:0;max-width:100%;box-sizing:border-box}
@container(max-width:400px){.mse-recursos__row{grid-template-columns:minmax(0,1fr)}.mse-recursos__shortcut{flex-direction:column;align-items:flex-start}.mse-recursos__card{grid-template-columns:minmax(0,1fr)}.mse-recursos__view-toggle{flex-direction:column}.mse-recursos__view-button{border-left-width:1px}}
.mse-recursos__chip{flex-wrap:wrap}.mse-recursos__chip-count{flex:0 0 auto}
.mse-recursos__row{grid-template-columns:minmax(0,1fr) fit-content(40%)}@container(max-width:400px){.mse-recursos__row{grid-template-columns:minmax(0,1fr)}}`;
export const RECURSOS_PREVIEW_NOTE = 'Filtros e opções de exibição são definidos nos parâmetros do módulo; os controles abaixo são uma prévia.';
export const RECURSOS_DEFAULTS = Object.freeze({ title: 'Explore Mais', homeLabel: 'Hub TD', homeHref: '#inicio', search: '', category: 'todas', sort: 'curada', view: 'cartoes', showActions: true, showShortcuts: true, categories: Object.freeze([]), links: Object.freeze([]) });
const FIELDS = Object.freeze({ title: { type: 'string' }, homeLabel: { type: 'string' }, homeHref: { type: 'string' }, search: { type: 'string' }, category: { type: 'string' }, sort: { type: 'enum', values: ['curada', 'alfabetica'] }, view: { type: 'enum', values: ['cartoes', 'compacta'] }, showActions: { type: 'boolean' }, showShortcuts: { type: 'boolean' }, categories: { type: 'array' }, links: { type: 'array' } });

// Actual persisted params are JSON. No getter/coercion execution on invalid
// own plain data. This is not a Proxy or modified-global sandbox.
export const RECURSOS_VALIDATION_SOURCE = String.raw`function _recursosPlain(value) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || typeof descriptors[key].value === 'function')) return null;
  return descriptors;
}
function _recursosArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return [];
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  const length = lengthDescriptor && Object.hasOwn(lengthDescriptor, 'value') ? lengthDescriptor.value : -1;
  if (!Number.isSafeInteger(length) || length < 0 || length > 500) return [];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== length + 1 || keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) return [];
  return Array.from({ length }, (_, index) => descriptors[index].value);
}
function _recursosOwn(descriptors, name) {
  return descriptors && Object.hasOwn(descriptors, name) ? descriptors[name].value : undefined;
}
function _recursosLegacy(descriptors, name, legacy, fallback) {
  return _recursosOwn(descriptors, name) ?? _recursosOwn(descriptors, legacy) ?? fallback;
}
function _recursosNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function _recursosSettings(value) {
  const descriptors = _recursosPlain(value);
  const config = { ...defaults };
  for (const name of ['title', 'homeLabel', 'homeHref', 'search', 'category']) if (descriptors && Object.hasOwn(descriptors, name)) config[name] = typeof descriptors[name].value === 'string' ? descriptors[name].value : '';
  for (const name of ['sort', 'view']) if (descriptors && Object.hasOwn(descriptors, name)) config[name] = settingsSchema.fields[name].values.includes(descriptors[name].value) ? descriptors[name].value : defaults[name];
  for (const name of ['showActions', 'showShortcuts']) if (descriptors && Object.hasOwn(descriptors, name)) config[name] = descriptors[name].value === true;
  for (const name of ['categories', 'links']) config[name] = _recursosArray(_recursosOwn(descriptors, name));
  return config;
}
function _recursosContext(value) {
  const descriptors = _recursosPlain(value);
  const state = _recursosOwn(descriptors, 'state');
  return { settings: _recursosOwn(descriptors, 'settings'), state: typeof state === 'string' ? state : 'ready' };
}
function normalizeLink(raw) {
  const descriptors = _recursosPlain(raw);
  if (!descriptors) return null;
  const title = _recursosLegacy(descriptors, 'title', 'Title', '');
  const url = _recursosLegacy(descriptors, 'url', 'URL', '');
  const category = _recursosLegacy(descriptors, 'category', 'Categoria', '');
  const description = _recursosLegacy(descriptors, 'description', 'Descricao', '');
  const iconKey = _recursosLegacy(descriptors, 'iconKey', 'IconeChave', '');
  const order = _recursosNumber(_recursosLegacy(descriptors, 'order', 'Ordem', 0));
  const openInNewWindow = _recursosLegacy(descriptors, 'openInNewWindow', 'AbrirNovaJanela', true);
  const active = _recursosLegacy(descriptors, 'active', 'Ativo', true);
  if (![title, url, category, description, iconKey].every(value => typeof value === 'string') || !title.trim() || url === '#' || safeUrl(url) !== url || order === null || typeof active !== 'boolean' || typeof openInNewWindow !== 'boolean') return null;
  return { title, url, category: (category || 'Outros').trim() || 'Outros', description, iconKey, order, openInNewWindow, active };
}
function normalizeLinks(list) {
  return _recursosArray(list).map(normalizeLink).filter(link => link && link.active);
}`;

/** Exactly three pinned sources; no caller-provided patch or hash policy. */
export function applyRecursosOverlay(originals) {
  const sources = copyNativeMap(originals, 'Overlay sources');
  if (sources.size !== 3 || Object.keys(RECURSOS_ANCHORS).some(path => !sources.has(path))) throw new Error('Overlay requires exactly the three approved sources.');
  const files = new Map(); const changes = []; const budget = { bytes: 0 };
  for (const [path, hashes] of Object.entries(RECURSOS_ANCHORS)) {
    const bytes = copyInertBuffer(sources.get(path), budget, 'Source'); const source = adaptationText(bytes, path);
    const originalSha256 = sha256(bytes);
    if (!hashes.includes(originalSha256)) throw new Error(`Unapproved original SHA-256: ${path}`);
    const crlf = source.includes('\r\n'); const mixed = crlf && /(?<!\r)\n/.test(source); const eol = crlf && !mixed ? '\r\n' : '\n';
    let patched = source;
    if (path === SHARED_SOURCE_PATH) patched = replace(source, "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }", SAFE_URL_SOURCE.replace(/\n/g, eol));
    if (path === RECURSOS_CSS_PATH) patched = replace(source, RECURSOS_CSS_OLD_ROOT.replace(/\n/g, eol), RECURSOS_CSS_NEW_ROOT) + RECURSOS_CSS_APPEND + eol;
    if (path === RECURSOS_SOURCE_PATH) {
      const start = source.indexOf('function normalizeLink(raw) {'); const end = source.indexOf('function getCategories(config, links) {');
      if (start < 0 || end <= start) throw new Error('Exact normalization anchors changed.');
      patched = replace(patched, source.slice(start, end), RECURSOS_VALIDATION_SOURCE.replace(/\n/g, eol) + eol + eol);
      patched = replace(patched, '<a class="mse-recursos__breadcrumb-link" href="${escapeHtml(safeUrl(config.homeHref))}">${escapeHtml(config.homeLabel)}</a>', '${config.homeHref !== \'#\' && safeUrl(config.homeHref) === config.homeHref ? `<a class="mse-recursos__breadcrumb-link" href="${escapeHtml(config.homeHref)}">${escapeHtml(config.homeLabel)}</a>` : `<span class="mse-recursos__breadcrumb-link">${escapeHtml(config.homeLabel)}</span>`}');
      patched = replace(patched, '            maxlength="100"', '            readonly aria-readonly="true"' + eol + '            maxlength="100"');
      patched = replace(patched, '      </div>\n    </header>'.replace(/\n/g, eol), `      </div>${eol}      <p class="mse-recursos__preview-note" role="note">${RECURSOS_PREVIEW_NOTE}</p>${eol}    </header>`);
      // Original buttons/select are all explicitly static. Exactly seven native
      // declarations (one chip/view template expands into several controls).
      if ((patched.match(/aria-disabled="true"/g) ?? []).length !== 7) throw new Error('Static control anchors changed.');
      patched = patched.replaceAll('aria-disabled="true"', 'disabled aria-disabled="true"');
      if ((patched.match(/const url = safeUrl\(link\.url\);/g) ?? []).length !== 3) throw new Error('Validated link rendering anchors changed.');
      patched = patched.replaceAll('const url = safeUrl(link.url);', 'const url = link.url;');
      patched = replace(patched, "render: ({ settings = {}, state = 'ready' } = {}) => {", 'render: (context = {}) => {' + eol + '    const { settings, state } = _recursosContext(context);');
      patched = replace(patched, "const config = { ...defaults, ...(settings && typeof settings === 'object' ? settings : {}) };", 'const config = _recursosSettings(settings);');
    }
    const modified = Buffer.from(patched); files.set(path, modified);
    changes.push({ path, originalSha256, modifiedSha256: sha256(modified), generatedSha256: sha256(lf(modified)), originalBytes: bytes.length, modifiedBytes: modified.length, encoding: 'UTF-8', bom: source.startsWith('\uFEFF'), lineEndings: mixed ? 'mixed LF/CRLF preserved' : crlf ? 'CRLF' : 'LF', change: changeName(path) });
  }
  return { files, changes };
}

function planOptions(input = {}) {
  const clean = inert(input);
  if (!clean || Array.isArray(clean) || Buffer.isBuffer(clean) || typeof clean !== 'object' || Object.keys(clean).some(key => !['module', 'version', 'base', 'output', 'sourceRoot', 'dependenciesRoot', 'inheritedLicense'].includes(key) || typeof clean[key] !== 'string')) throw new Error('Unknown or non-string adaptation option refused.');
  const args = { ...clean, module: clean.module ?? MODULE, version: clean.version ?? '0.4.0', dependenciesRoot: clean.dependenciesRoot ?? 'tmp/step2/camap-source' };
  parseModuleAdoptionArgs(Object.entries(args).filter(([key]) => key !== 'inheritedLicense').flatMap(([key, value]) => [{ sourceRoot: '--source', dependenciesRoot: '--dependencies-root' }[key] ?? `--${key}`, value]));
  if (args.module !== MODULE || !['0.4.0', '0.4.1'].includes(args.version)) throw new Error('Only mod_recursos versions 0.4.0 and 0.4.1 are authorized; immutable 0.3.x packages require historical tooling.');
  if (!/^tmp\/recursos-adapt-agent-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(args.output)) throw new Error('--output must name a new tmp/recursos-adapt-agent-* directory.');
  const source = resolve(PROJECT, args.sourceRoot ?? CAMAP); const dependencies = resolve(PROJECT, args.dependenciesRoot); const destination = resolve(PROJECT, args.output);
  const inheritedLicense = resolve(PROJECT, args.inheritedLicense ?? join(dirname(CAMAP), 'LICENSE'));
  if (inheritedLicense !== join(dirname(CAMAP), 'LICENSE') && (!within(TMP, inheritedLicense) || inheritedLicense === TMP)) throw new Error('Inherited license must be approved aggregator LICENSE or an explicit tmp file.');
  if (within(destination, inheritedLicense) || within(source, dependencies) || within(dependencies, source)) throw new Error('Input/license/output paths must not overlap.');
  return { args, source, dependencies, destination, inheritedLicense };
}

/** Exact XML produced by pinned original createXml in the bounded snapshot. */
export function recursosAdaptationXml(version) {
  if (!['0.4.0', '0.4.1'].includes(version)) throw new Error('Unauthorized Recursos XML version.');
  return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="camap.mod_recursos">
  <name>CAMAP Explore Mais (Recursos)</name>
  <version>${version}</version>
  <description>CAMAP Explore Mais (Recursos) JavaScript module for MiniJoomla.</description>
  <files>
    <filename module="mod_recursos">mod_recursos.js</filename>
  </files>
  <media destination="mod_recursos" folder="media">
    <filename>css/recursos.css</filename>
  </media>
  <config>
    <fields name="params">
      <fieldset name="basic">
        <field name="title" label="title" default="Explore Mais" type="text" />
        <field name="homeLabel" label="homeLabel" default="Hub TD" type="text" />
        <field name="homeHref" label="homeHref" default="#inicio" type="text" />
        <field name="search" label="search" default="" type="text" />
        <field name="category" label="category" default="todas" type="text" />
        <field name="sort" label="sort" default="curada" type="list">
          <option value="curada">curada</option>
          <option value="alfabetica">alfabetica</option>
        </field>
        <field name="view" label="view" default="cartoes" type="list">
          <option value="cartoes">cartoes</option>
          <option value="compacta">compacta</option>
        </field>
        <field name="showActions" label="showActions" default="1" type="radio">
          <option value="1">Yes</option>
          <option value="0">No</option>
        </field>
        <field name="showShortcuts" label="showShortcuts" default="1" type="radio">
          <option value="1">Yes</option>
          <option value="0">No</option>
        </field>
        <field name="categories" label="categories" default="[]" type="textarea" mj:type="json" mj:valueType="array" />
        <field name="links" label="links" default="[]" type="textarea" mj:type="json" mj:valueType="array" />
      </fieldset>
    </fields>
  </config>
</extension>
`);
}

async function collectSources(source) {
  const collected = createAdaptationCollector();
  await collected.add(source, SHARED_SOURCE_PATH);
  for (const { folder } of ADOPTION_MODULES) {
    const directory = `extensions/camap/${folder}`;
    for (const entry of await collected.list(source, directory)) {
      if (entry.isDirectory() && entry.name !== 'tests') throw new Error('Unexpected nested module directory.');
      if (entry.isFile() && /\.(js|css)$/.test(entry.name)) await collected.add(source, `${directory}/${entry.name}`);
    }
    if (!collected.files.has(`${directory}/module.js`)) throw new Error(`Missing module: ${folder}`);
  }
  if (!ADAPTATION_GENERATOR_HASHES.includes(sha256(await collected.add(source, 'tools/prepare-joomla-modules.js')))) throw new Error('Original generator hash changed; review required.');
  if (metadata(await collected.add(source, 'package.json'), 'package.json').type !== 'module') throw new Error('Original package must declare ESM.');
  for (const name of ADAPTATION_LICENSE_NAMES) {
    try { await collected.add(source, name); throw new Error('Pinned Recursos profile has no CAMAP-root notices; new source license requires review.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let trusted;
  if (source !== CAMAP) {
    trusted = await collectSources(CAMAP);
    if (collected.files.size !== trusted.collected.files.size || [...collected.files].some(([key, { bytes }]) => !trusted.collected.files.get(key) || !lf(bytes).equals(lf(trusted.collected.files.get(key).bytes)))) throw new Error('Source override is not an original trusted CAMAP copy.');
  }
  const overlay = applyRecursosOverlay(new Map(Object.keys(RECURSOS_ANCHORS).map(path => [path, collected.files.get(path)?.bytes])));
  return { collected, overlay, async check() { await collected.check(); if (trusted) await trusted.check(); } };
}

const POLICY = 'Render-time own plain data checks only; stored settings and unknown keys are never rewritten. All eleven original fields, ordered enum options, defaults and unconstrained search params remain unchanged. Search input shows first 100 characters only; filtering uses the full term. Links require nonblank string title, strict safe string URL other than #, string category/description/iconKey, finite numeric order or strict signed decimal string, and boolean active/openInNewWindow. Legacy Title/URL/Categoria/Descricao/IconeChave/Ordem/AbrirNovaJanela/Ativo retain own nullish precedence and defaults; malformed rows are omitted conservatively, including lexical false flags, never repaired in storage. Inert dense arrays are limited to 500 rows; settings/context reject accessors/functions/symbols without coercion, not a Proxy sandbox. Configured categories retain original nonblank strings without trimming names; link category retains original trim/Outros behavior. Invalid settings strings derive empty; invalid explicit enums derive original curada/cartoes, explicit nonboolean display flags derive false. Unsafe breadcrumb renders escaped nonlink label; cards/shortcuts/compact rows use the validated raw URL escaped once. Loading/error and no-published/all-filtered branches unchanged; empty/unknown/nonstring states follow ready logic, not invented empty dispatch. Curated/alpha ordering, category grouping and counts are retained. Atalhos mais usados is historical wording for first curated link per category, not analytics. Compact arrow remains decorative even when no new window. All static buttons/select have native disabled; search has readonly/aria-readonly and a note explaining parameter-defined preview; no interactive filter/favorites/suggestions/backend added. Original source has no global IDs; none are added. CSS remaps only the first legacy wrapper selector list to .mse-recursos and appends sixteen lines of coordinator-reviewed scoped reflow: root wrapping/inline-size container, descendant min-width/max-width, wrapping breadcrumb/action/sort/view/group/card-title/row-right flexes, border-box controls/cards, full-width search/select and zero-basis input, grid minima min(13rem,100%)/min(18rem,100%), wrapping category/chips with nonshrinking count, and max-width:400px content-box container single-column cards/rows/shortcuts/view controls with restored view left border. The final two rules cap the compact category track at fit-content(40%) after minmax(0,1fr), then repeat the 400px single-track override to retain narrow stacking. Frozen 0.3.x packages had valid integrity but failed final title/description range fit at 768/900px with long category; never overwrite them. Current tooling accepts only 0.4.0/0.4.1; JavaScript runtime/shared bytes unchanged from last frozen 0.3.x, only CSS runtime/XML version/tooling metadata changed. Trailing summary styles, palette/fonts/padding and original root overflow are retained. Root clipping and zero-width title/description tracks are not proof of content fit. Coordinator browser/layout/lifecycle and independent rights checks remain separate gates. No host capacity, core/release, existing rows/roots/packages, tenant or publication change.';

/** Closed five-file runtime; full licenses and complete canonical XML. */
export function finalizeRecursosPackage(stagedFiles, evidence) {
  const staged = copyNativeMap(stagedFiles, 'Staged files');
  const p = shape(inert(evidence), ['changes', 'licenses', 'inheritedLicense', 'inheritedLicenseBytes', 'changesLicenseBytes', 'changesLicenseSource', 'generatorSha256', 'adoptionApiSha256', 'snapshot'], 'provenance');
  if (!Array.isArray(p.licenses) || p.licenses.length) throw new Error('Unapproved staged package/license paths.');
  const controls = ['MANIFEST-SHA256.json', 'host-config.json', 'adoption-plan.json', 'docs/ADOPTION-NOTICE.md'];
  const files = new Map(); const budget = { bytes: 0 };
  for (const [name, bytes] of staged) {
    packagePath(name);
    if (![...RUNTIME, ...controls].includes(name)) throw new Error(`Staged path outside Recursos allowlist: ${name}`);
    files.set(name, copyInertBuffer(bytes, budget, 'Package'));
  }
  if ([...RUNTIME, ...controls].some(name => !files.has(name))) throw new Error('Missing mandatory Recursos runtime/control payload.');
  if (!files.get(ENTRY).equals(Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`))) throw new Error('Recursos wrapper differs from original generator.');
  const inventoryBytes = files.get('MANIFEST-SHA256.json');
  const inventory = shape(metadata(inventoryBytes, 'inventory'), ['format', 'version', 'files', 'moduleStyles', 'moduleKeys'], 'inventory');
  const hostConfig = shape(metadata(files.get('host-config.json'), 'host config'), ['joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions'], 'host config');
  const adoptionPlan = shape(metadata(files.get('adoption-plan.json'), 'adoption plan'), ['format', 'profile', 'module', 'key', 'version', 'base', 'pilot', 'validation', 'licenses', 'sourceLicensePresent', ...FLAGS, 'nextGate', 'hostNote'], 'adoption plan');
  if (['validation', 'nextGate', 'hostNote'].some(key => typeof adoptionPlan[key] !== 'string') || inventory.format !== 'minijoomla-joomla-package-v1' || !Array.isArray(inventory.files)) throw new Error('Unexpected staged controls.');
  const expected = new Set(['MANIFEST-SHA256.json', 'host-config.json']);
  for (const entry of inventory.files) {
    shape(entry, ['path', 'bytes', 'sha256'], 'inventory entry'); packagePath(entry.path);
    const bytes = files.get(entry.path);
    if (expected.has(entry.path) || !bytes || entry.bytes !== bytes.length || entry.sha256 !== sha256(bytes)) throw new Error('Staged inventory integrity failure.');
    expected.add(entry.path);
  }
  if (expected.size !== files.size) throw new Error('Uninventoried staged file.');
  if (!Array.isArray(hostConfig.joomlaDiscoveryRoots) || hostConfig.joomlaDiscoveryRoots.length !== 1) throw new Error('One immutable discovery root required.');
  const root = shape(hostConfig.joomlaDiscoveryRoots[0], ['id', 'baseUrl', 'inventoryHash', 'immutable', 'discover'], 'discovery root');
  planOptions({ version: inventory.version, base: root.baseUrl, output: 'tmp/recursos-adapt-agent-validation' });
  if (root.inventoryHash !== sha256(inventoryBytes) || root.immutable !== true || root.discover !== true || root.id !== `camap-${MODULE}-${inventory.version}`) throw new Error('Staged control hash/identity differs.');
  if (adoptionPlan.format !== 'minijoomla-module-adoption-v1' || adoptionPlan.profile !== 'joomla-xml-v1' || adoptionPlan.module !== MODULE || adoptionPlan.key !== KEY || adoptionPlan.version !== inventory.version || adoptionPlan.base !== root.baseUrl || adoptionPlan.pilot !== false || adoptionPlan.sourceLicensePresent !== false || !same(adoptionPlan.licenses, []) || FLAGS.some(flag => adoptionPlan[flag] !== false)) throw new Error('Staged adoption identity/flags differ.');
  if (!files.get(XML).equals(recursosAdaptationXml(inventory.version))) throw new Error('Staged XML canonical complete defaults/attributes differ.');
  const descriptor = parseJoomlaManifest(files.get(XML), { baseUrl: root.baseUrl, manifestPath: XML });
  validateAdoptionSchema(descriptor, { defaults: RECURSOS_DEFAULTS, settingsSchema: { version: 1, fields: FIELDS }, default: { name: KEY, settings: RECURSOS_DEFAULTS, render() {} } });
  if (descriptor.version !== inventory.version || descriptor.requiredFolders.length || descriptor.entryPointUrl !== `${root.baseUrl}/${ENTRY}` || !same(descriptor.styles, [`${root.baseUrl}/${CSS}`]) || !same(descriptor.requiredFiles, [ENTRY, CSS]) || !same(descriptor.params.map(param => param.label), Object.keys(FIELDS))) throw new Error('Staged XML identity/closure/labels differ.');
  if (!same(inventory.moduleKeys, { [MODULE]: KEY }) || !same(inventory.moduleStyles, { [KEY]: [CSS] }) || !same(hostConfig.moduleStyles, { [KEY]: descriptor.styles }) || !same(hostConfig.moduleStyleRevisions, { [KEY]: { [descriptor.entryPointUrl]: descriptor.styles } })) throw new Error('Staged module/style controls differ.');
  if (!Array.isArray(p.changes) || p.changes.length !== 3 || new Set(p.changes.map(change => change.path)).size !== 3 || !ADAPTATION_GENERATOR_HASHES.includes(p.generatorSha256) || p.adoptionApiSha256 !== RECURSOS_API_SHA256) throw new Error('Unapproved adaptation generator/API provenance.');
  for (const change of p.changes) {
    shape(change, ['path', 'originalSha256', 'modifiedSha256', 'generatedSha256', 'originalBytes', 'modifiedBytes', 'encoding', 'bom', 'lineEndings', 'change'], 'change');
    const pin = PINNED[change.path]; const raw = change.originalSha256 === RECURSOS_ANCHORS[change.path]?.[0];
    if (!pin || !RECURSOS_ANCHORS[change.path].includes(change.originalSha256) || change.originalBytes !== pin.lengths[raw ? 0 : 1] || change.modifiedBytes !== pin.lengths[raw ? 2 : 3] || change.modifiedSha256 !== pin[raw ? 'raw' : 'lf'] || change.generatedSha256 !== pin.lf || sha256(files.get(change.path === RECURSOS_CSS_PATH ? CSS : `libraries/camap/${change.path}`)) !== pin.lf || change.encoding !== 'UTF-8' || change.bom !== (change.path !== RECURSOS_CSS_PATH) || change.lineEndings !== (raw ? 'mixed LF/CRLF preserved' : 'LF') || change.change !== changeName(change.path)) throw new Error('Packaged overlay differs from approved patch.');
  }
  if (!Array.isArray(p.snapshot) || p.snapshot.length < 15 || new Set(p.snapshot.map(entry => entry.path.toLowerCase())).size !== p.snapshot.length) throw new Error('Missing/invalid bounded snapshot provenance.');
  let snapshotBytes = 0;
  for (const entry of p.snapshot) {
    shape(entry, ['path', 'originalSha256', 'snapshotSha256', 'bytes'], 'snapshot entry'); packagePath(entry.path);
    const allowed = [SHARED_SOURCE_PATH, 'tools/prepare-joomla-modules.js', 'package.json'].includes(entry.path) || ADOPTION_MODULES.some(({ folder }) => new RegExp(`^extensions/camap/${folder}/[^/]+\\.(js|css)$`).test(entry.path));
    if (!allowed || ![entry.originalSha256, entry.snapshotSha256].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || (snapshotBytes += entry.bytes) > 10 * 1024 * 1024) throw new Error('Invalid bounded snapshot entry.');
  }
  const mandatory = [SHARED_SOURCE_PATH, RECURSOS_CSS_PATH, 'tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.map(({ folder }) => `extensions/camap/${folder}/module.js`)];
  if (mandatory.some(path => !p.snapshot.some(entry => entry.path === path)) || p.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length !== 3 || p.changes.some(change => !p.snapshot.some(entry => entry.path === change.path && entry.originalSha256 === change.originalSha256 && entry.snapshotSha256 === change.modifiedSha256 && entry.bytes === change.originalBytes)) || p.snapshot.find(entry => entry.path === 'tools/prepare-joomla-modules.js').originalSha256 !== p.generatorSha256) throw new Error('Snapshot must record eleven original modules and exactly three approved patches.');
  const inherited = shape(p.inheritedLicense, ['license', 'origin', 'originCommit', 'sha256', 'historicalLfSha256', 'packagePath', 'scope', 'globalVendorRightsApproved', 'evidence'], 'MIT evidence');
  if (!Buffer.isBuffer(p.inheritedLicenseBytes) || !ADAPTATION_MIT_HASHES.includes(sha256(p.inheritedLicenseBytes)) || inherited.sha256 !== sha256(p.inheritedLicenseBytes) || inherited.license !== 'MIT' || inherited.origin !== 'aggregator root LICENSE' || inherited.originCommit !== ADAPTATION_ORIGIN_COMMIT || inherited.packagePath !== INHERITED_LICENSE_PATH || inherited.historicalLfSha256 !== ADAPTATION_MIT_HASHES[1] || inherited.globalVendorRightsApproved !== false || typeof inherited.evidence !== 'string' || !same(inherited.scope, SCOPE)) throw new Error('Missing/invalid scoped inherited MIT evidence.');
  const changesLicenseSource = shape(p.changesLicenseSource, ['path', 'sha256', 'license', 'scope'], 'GPL evidence');
  if (!Buffer.isBuffer(p.changesLicenseBytes) || sha256(p.changesLicenseBytes) !== CHANGES_LICENSE_SHA256 || !same(changesLicenseSource, { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' })) throw new Error('Missing/invalid authored changes GPL evidence.');
  files.set(INHERITED_LICENSE_PATH, p.inheritedLicenseBytes); files.set(CHANGES_LICENSE_PATH, p.changesLicenseBytes);
  Object.assign(adoptionPlan, { licenses: [INHERITED_LICENSE_PATH], sourceRootLicensePresent: false, sourceLicensePresent: true, inheritedLicenseSource: inherited, changesLicenseSource, adaptation: { format: FORMAT, revision: 1, provenance: 'ADAPTATION.json', changesLicense: 'GPL-2.0-or-later', vendorRightsCleared: false }, nextGate: 'Independent rights review and coordinator lifecycle/site verification; no installation or publication approval.' });
  const adaptation = { format: FORMAT, revision: 1, module: MODULE, version: inventory.version, originalSource: 'local CAMAP2 read-only bounded snapshot', changes: p.changes, generator: { path: 'tools/prepare-joomla-modules.js', sha256: p.generatorSha256, algorithmModified: false }, adoptionApi: { path: 'scripts/prepare-module-adoption.js', sha256: p.adoptionApiSha256, byteIdenticalRelocation: true }, snapshot: p.snapshot, originalLicenses: [], inheritedLicenseSource: inherited, changesLicense: 'GPL-2.0-or-later', changesLicenseSource, vendorLicenseAssigned: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), schemaModified: false, cssModified: true, markupModified: true, otherPackagesModified: false, policy: POLICY };
  files.delete('MANIFEST-SHA256.json'); files.delete('host-config.json');
  files.set('adoption-plan.json', json(adoptionPlan)); files.set('ADAPTATION.json', json(adaptation));
  files.set('docs/ADAPTATION-NOTICE.md', Buffer.from(`Local Recursos adaptation, revision 1. Exactly three pinned authored source patches: shared/render.js, mod_recursos/module.js and mod_recursos/recursos.css. ${POLICY} Full original MIT and authored-change GPL texts retained verbatim in docs/licenses/CAMAP-ROOT-MIT.txt and docs/licenses/GPL-2.0.txt. Historical source hashes and limited three-source scope recorded in ADAPTATION.json. GPL-2.0-or-later applies only to authored changes, not all CAMAP. Coordinator site/lifecycle and independent rights receipts remain separate gates.\n`));
  inventory.files = [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  if (files.size !== 11 || inventory.files.length !== 11) throw new Error('Recursos final closure must contain exactly eleven inventoried payloads.');
  const finalInventory = json(inventory); root.inventoryHash = sha256(finalInventory); const finalConfig = json(hostConfig);
  if (finalInventory.length > 64 * 1024 || [...files.values()].reduce((sum, bytes) => sum + bytes.length, finalInventory.length + finalConfig.length) > 10 * 1024 * 1024) throw new Error('Final package/inventory budget exceeded.');
  files.set('MANIFEST-SHA256.json', finalInventory); files.set('host-config.json', finalConfig);
  return { files, inventory, hostConfig, adaptation, adoptionPlan, descriptor };
}

export async function prepareRecursosAdaptation(input = {}) {
  const plan = planOptions(input); await assertNewAdaptationOutput(plan.destination);
  const [sources, dependencies, evidence] = await Promise.all([collectSources(plan.source), collectAdaptationDependencies(plan.dependencies), (async () => {
    const collected = createAdaptationCollector(); for (const name of ADAPTATION_API_FILES) await collected.add(PROJECT, name);
    if (sha256(collected.files.get('scripts/prepare-module-adoption.js').bytes) !== RECURSOS_API_SHA256) throw new Error('Original adoption API hash changed; review required.');
    const gpl = await collected.add(PROJECT, CHANGES_LICENSE_PATH);
    const mit = await collected.add(dirname(plan.inheritedLicense), plan.inheritedLicense.slice(dirname(plan.inheritedLicense).length + 1));
    if (sha256(gpl) !== CHANGES_LICENSE_SHA256 || !ADAPTATION_MIT_HASHES.includes(sha256(mit))) throw new Error('Original full MIT/GPL license evidence differs.');
    return { collected, mit, gpl };
  })()]);
  let trustedDeps;
  if (plan.dependencies !== DEPS) {
    trustedDeps = await collectAdaptationDependencies(DEPS);
    if (dependencies.files.size !== trustedDeps.files.size || [...dependencies.files].some(([key, { bytes }]) => !trustedDeps.files.get(key)?.bytes.equals(bytes))) throw new Error('Dependency override differs from trusted local offline closure.');
  }
  const check = () => Promise.all([sources.check(), dependencies.check(), evidence.collected.check(), trustedDeps?.check()]);
  await check(); await assertAdoptionNoLinks(TMP, { allowMissing: true }); await mkdir(TMP, { recursive: true });
  const stage = await mkdtemp(join(TMP, 'recursos-adapt-agent-stage-'));
  await writeAdaptationFiles(stage, new Map([...evidence.collected.files.values()].filter(({ name }) => ADAPTATION_API_FILES.includes(name)).map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(stage, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const snapshot = join(stage, 'tmp', 'source');
  await writeAdaptationFiles(snapshot, new Map([...sources.collected.files.values()].map(({ name, bytes }) => [name, sources.overlay.files.get(name) ?? bytes])));
  const deps = join(stage, 'tmp', 'dependencies');
  await writeAdaptationFiles(deps, new Map([...dependencies.files.values()].map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(deps, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const adoption = await import(pathToFileURL(join(stage, 'scripts', 'prepare-module-adoption.js')).href);
  const prepared = await adoption.prepareModuleAdoption({ module: MODULE, version: plan.args.version, base: plan.args.base, sourceRoot: snapshot, dependenciesRoot: deps, output: 'tmp/prepared' });
  const provenance = { changes: sources.overlay.changes, licenses: [], inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(evidence.mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: SCOPE, globalVendorRightsApproved: false, evidence: 'Exact local hashes compared with targeted Git blobs at originCommit; CRLF/CR to LF only, BOM retained.' }, inheritedLicenseBytes: evidence.mit, changesLicenseBytes: evidence.gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' }, generatorSha256: sha256(sources.collected.files.get('tools/prepare-joomla-modules.js').bytes), adoptionApiSha256: sha256(evidence.collected.files.get('scripts/prepare-module-adoption.js').bytes), snapshot: [...sources.collected.files.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')).map(({ name, bytes }) => ({ path: name, originalSha256: sha256(bytes), snapshotSha256: sha256(sources.overlay.files.get(name) ?? bytes), bytes: bytes.length })) };
  const finalized = finalizeRecursosPackage(await readAdaptationFiles(prepared.output), provenance);
  await check(); await assertAdoptionNoLinks(plan.destination, { allowMissing: true }); await mkdir(dirname(plan.destination), { recursive: true }); await assertNewAdaptationOutput(plan.destination);
  await mkdir(plan.destination); await writeAdaptationFiles(plan.destination, finalized.files);
  return { ...finalized, output: plan.destination, stage, snapshot, originalSourceFiles: sources.collected.files.size, dependencyFiles: dependencies.files.size };
}

export function parseRecursosAdaptationArgs(argv = process.argv.slice(2)) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { help: true };
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]; const name = { '--source': 'sourceRoot', '--dependencies-root': 'dependenciesRoot', '--inherited-license': 'inheritedLicense' }[key] ?? key.slice(2);
    if (!['--module', '--version', '--base', '--output', '--source', '--dependencies-root', '--inherited-license'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(args, name)) throw new Error('Invalid, duplicate or missing CLI argument.');
    args[name] = argv[i + 1];
  }
  return planOptions(args).args;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseRecursosAdaptationArgs();
    if (args.help) console.log('Usage: node scripts/prepare-recursos-adaptation.js --base /offline/recursos/0.4.0 --output tmp/recursos-adapt-agent-new [--version 0.4.0|0.4.1] [--module mod_recursos] [--source tmp/original-copy] [--dependencies-root tmp/step2/camap-source] [--inherited-license tmp/approved-MIT.txt]. Explicit base; offline preparation only; frozen 0.3.x requires historical tooling.');
    else { const result = await prepareRecursosAdaptation(args); console.log(`Prepared Recursos ${result.inventory.version}: ${result.inventory.files.length} inventoried payloads, ${result.files.size} total files; three pinned patches, ${result.originalSourceFiles} source and ${result.dependencyFiles} dependency files, no site/publication approval. Output: ${result.output}`); }
  } catch (error) { console.error(`prepare-recursos-adaptation: ${error.message}`); process.exitCode = 1; }
}
