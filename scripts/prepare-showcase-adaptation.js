/* SPDX-License-Identifier: GPL-2.0-or-later
 * Closed offline Showcase profile; authored changes only, not vendor clearance.
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
const MODULE = 'mod_showcase';
const KEY = `camap.${MODULE}`;
export const SHOWCASE_SOURCE_PATH = `extensions/camap/${MODULE}/module.js`;
export const SHOWCASE_CSS_PATH = `extensions/camap/${MODULE}/showcase.css`;
export const SHOWCASE_ANCHORS = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze(['fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e', '33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387']),
  [SHOWCASE_SOURCE_PATH]: Object.freeze(['2a04379e0a1e558d21a1149e40de89f0d671642934d9a815b42ce3f839683713', '83fde093bc26d80b16450dcf9764577add1a2b8a373c0de29bb91a15d75c1f29']),
  [SHOWCASE_CSS_PATH]: Object.freeze(['0819f852e6ce58c1a0124fb200341a14e1baf7cef8f224178b56825c33bd1863', 'a976d6deb9ebdd30bd062cb1b59affc897f2c8f3e149488c7b073604eb4ebec5'])
});
export const SHOWCASE_API_SHA256 = 'ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4';
// Exact authored output pins are filled only after reviewing the closed overlay.
const PINNED = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze({ raw: 'ab6e32d2105d45cff15b9aa55777675d42b418494f09b114317ae19d945f6002', lf: 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76', lengths: [654, 653, 1746, 1745] }),
  [SHOWCASE_SOURCE_PATH]: Object.freeze({ raw: '37b70c81dd0004fbd9ba47a92a9627262be01a8eb02fc1c82b82f20eb70950fb', lf: 'e295a371ef8952630b5d7cd411e7f0420e37bfeb6c23b056592e6dfb100d0671', lengths: [10127, 10126, 12252, 12251] }),
  [SHOWCASE_CSS_PATH]: Object.freeze({ raw: '69b6d52cd1a5ef35b84015c42acd7f63a93df97227c12627f8c4e728a918e113', lf: '89ca9c910fe1f13ad94c7a1d766899d5ec5b54b240f76ad8f7f967bd0d960292', lengths: [4952, 4951, 6158, 6157] })
});
const LIB = `libraries/camap/${SHOWCASE_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${MODULE}/css/showcase.css`;
const ENTRY = `modules/${MODULE}/${MODULE}.js`;
const XML = `modules/${MODULE}/${MODULE}.xml`;
const RUNTIME = [ENTRY, XML, CSS, LIB, SHARED];
const SCOPE = [SHOWCASE_SOURCE_PATH, SHARED_SOURCE_PATH, SHOWCASE_CSS_PATH];
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const FORMAT = 'minijoomla-showcase-adaptation-v1';
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(adaptationText(bytes, 'source').replace(/\r\n?/g, '\n'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const within = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const changeName = path => path === SHARED_SOURCE_PATH ? 'strict-url-policy-v1' : path === SHOWCASE_CSS_PATH ? 'showcase-css-scoped-reflow-static-sphere-focus-v3' : 'runtime-showcase-inert-data-static-sphere-conditional-focus-track-v4';
export const SHOWCASE_CSS_APPEND = `.camap-showcase{overflow-wrap:anywhere;container-type:inline-size}
.camap-showcase__body,.camap-showcase__meta,.camap-showcase__timeline-card,.camap-showcase__carousel,.camap-showcase__track{min-width:0}
.camap-showcase__masonry{grid-auto-flow:row;grid-auto-rows:auto}
.camap-showcase__masonry .camap-showcase__item{grid-row:auto}
.camap-showcase__track{grid-auto-columns:minmax(min(var(--camap-showcase-carousel-item-min-width,280px),100%),1fr);padding:.25rem}
.camap-showcase a:focus-visible{outline:3px solid #006298;outline-offset:-3px}
@container(max-width:400px){.camap-showcase__grid,.camap-showcase__masonry{grid-template-columns:minmax(0,1fr)}}
.camap-showcase__sphere{aspect-ratio:auto;overflow:visible;border-radius:0;box-sizing:border-box}
.camap-showcase__sphere-stage{position:static;display:grid;grid-template-columns:minmax(0,1fr);gap:.5rem;padding:.5rem;animation:none}
.camap-showcase__sphere-item{position:static;transform:none;min-width:0}
.camap-showcase__sphere-link{white-space:normal;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}
.camap-showcase__track:focus-within{grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:minmax(0,1fr);scroll-snap-type:none}`;
export const SHOWCASE_DEFAULTS = Object.freeze({ title: 'Showcase', introText: '', mode: 'list', items: Object.freeze([]), columns: 3, carouselItemMinWidth: 280, sphereSize: 520, timelineLabel: 'Linha do tempo' });
const FIELDS = Object.freeze({
  title: { type: 'string', maxLength: 120, default: SHOWCASE_DEFAULTS.title },
  introText: { type: 'string', maxLength: 800, default: '' },
  mode: { type: 'enum', values: ['list', 'carousel', 'masonry', 'sphere', 'timeline'], default: 'list' },
  items: { type: 'array', default: [] },
  columns: { type: 'number', default: 3, min: 1, max: 6 },
  carouselItemMinWidth: { type: 'number', default: 280, min: 180, max: 560 },
  sphereSize: { type: 'number', default: 520, min: 240, max: 900 },
  timelineLabel: { type: 'string', maxLength: 120, default: 'Linha do tempo' }
});

// Render-time validation of actual JSON params, not a Proxy/global sandbox.
export const SHOWCASE_VALIDATION_SOURCE = String.raw`function _showcasePlain(value) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || typeof descriptors[key].value === 'function')) return null;
  return descriptors;
}
function _showcaseOwn(descriptors, name) {
  return descriptors && Object.hasOwn(descriptors, name) ? descriptors[name].value : undefined;
}
function _showcaseDecimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function normalizeMode(value) {
  const mode = typeof value === 'string' ? value.trim() : '';
  return MODES.includes(mode) ? mode : defaults.mode;
}
function normalizeColumns(value) {
  const n = _showcaseDecimal(value);
  return n === null ? defaults.columns : Math.max(1, Math.min(6, Math.floor(n)));
}
function normalizeNumber(value, fallback, { min, max }) {
  const n = _showcaseDecimal(value);
  return n === null ? fallback : Math.max(min, Math.min(max, n));
}
function _showcaseImage(value) {
  return typeof value === 'string' && !value.includes('#') && (value.startsWith('/') && !value.startsWith('//') || /^https:\/\//i.test(value)) && safeUrl(value) === value ? value : '';
}
function normalizeItems(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return [];
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  const length = lengthDescriptor && Object.hasOwn(lengthDescriptor, 'value') ? lengthDescriptor.value : -1;
  if (!Number.isSafeInteger(length) || length < 0 || length > 500) return [];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== length + 1 || keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) return [];
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const item = _showcasePlain(descriptors[index].value);
    const title = _showcaseOwn(item, 'title');
    if (typeof title !== 'string' || !title.trim()) continue;
    const row = { title: title.trim() };
    for (const name of ['description', 'imageAlt', 'category', 'date', 'extraInfo', 'size']) {
      const value = _showcaseOwn(item, name);
      row[name] = typeof value === 'string' ? value.trim() : '';
    }
    const url = _showcaseOwn(item, 'url');
    row.url = typeof url === 'string' && url !== '#' && safeUrl(url) === url ? url : '';
    row.imageUrl = _showcaseImage(_showcaseOwn(item, 'imageUrl'));
    result.push(row);
  }
  return result;
}
function _showcaseSettings(value) {
  const descriptors = _showcasePlain(value);
  const config = { ...defaults };
  for (const name of ['title', 'introText', 'timelineLabel']) if (descriptors && Object.hasOwn(descriptors, name)) config[name] = typeof descriptors[name].value === 'string' ? descriptors[name].value : '';
  config.mode = normalizeMode(_showcaseOwn(descriptors, 'mode'));
  config.columns = normalizeColumns(_showcaseOwn(descriptors, 'columns'));
  config.carouselItemMinWidth = normalizeNumber(_showcaseOwn(descriptors, 'carouselItemMinWidth'), defaults.carouselItemMinWidth, { min: 180, max: 560 });
  config.sphereSize = normalizeNumber(_showcaseOwn(descriptors, 'sphereSize'), defaults.sphereSize, { min: 240, max: 900 });
  config.items = _showcaseOwn(descriptors, 'items');
  return config;
}
function _showcaseContext(value) {
  const descriptors = _showcasePlain(value);
  return renderShowcase(_showcaseOwn(descriptors, 'settings'), _showcaseOwn(descriptors, 'state'));
}`;

// Explicit user choice: retain mode/sphereSize schema, replace rotating geometry
// with ordered static title links. sphereSize now controls bounded width only.
export const SHOWCASE_STATIC_SPHERE_SOURCE = `function renderSphere(items, { sphereSize }) {
  // User-selected "Lista estática segura": no rotation, geometry or 3D.
  const size = Math.round(sphereSize);
  const list = items.map((item) => {
    const href = item.url;
    const label = escapeHtml(item.title);
    const node = !!href
      ? \`<a class="camap-showcase__sphere-link" href="\${escapeHtml(href)}">\${label}</a>\`
      : \`<span class="camap-showcase__sphere-link">\${label}</span>\`;
    return \`<li class="camap-showcase__sphere-item">\${node}</li>\`;
  }).join('');
  return \`<div class="camap-showcase__sphere" style="--camap-showcase-sphere-size:\${size}px;" role="region" aria-label="Lista de links">
  <ul class="camap-showcase__sphere-stage">\${list}</ul>
</div>\`;
}`;

/** Exactly three full-byte sources and fixed authored patches. */
export function applyShowcaseOverlay(originals) {
  const sources = copyNativeMap(originals, 'Overlay sources');
  if (sources.size !== 3 || Object.keys(SHOWCASE_ANCHORS).some(path => !sources.has(path))) throw new Error('Overlay requires exactly the three approved sources.');
  const files = new Map(); const changes = []; const budget = { bytes: 0 };
  for (const [path, hashes] of Object.entries(SHOWCASE_ANCHORS)) {
    const bytes = copyInertBuffer(sources.get(path), budget, 'Source'); const source = adaptationText(bytes, path);
    const originalSha256 = sha256(bytes);
    if (!hashes.includes(originalSha256)) throw new Error(`Unapproved original SHA-256: ${path}`);
    const crlf = source.includes('\r\n'); const mixed = crlf && /(?<!\r)\n/.test(source); const eol = crlf && !mixed ? '\r\n' : '\n';
    let patched = source;
    if (path === SHARED_SOURCE_PATH) patched = replace(source, "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }", SAFE_URL_SOURCE.replace(/\n/g, eol));
    if (path === SHOWCASE_CSS_PATH) patched += SHOWCASE_CSS_APPEND.replace(/\n/g, eol) + eol;
    if (path === SHOWCASE_SOURCE_PATH) {
      const start = source.indexOf('function normalizeMode(value) {'); const end = source.indexOf('function renderHeader({ title, introText }) {');
      if (start < 0 || end <= start) throw new Error('Exact normalization anchors changed.');
      patched = replace(patched, source.slice(start, end), SHOWCASE_VALIDATION_SOURCE.replace(/\n/g, eol) + eol + eol);
      const configStart = source.indexOf('  const c = {', source.indexOf('export function renderShowcase'));
      const configEnd = source.indexOf('  const items = normalizeItems(c.items);', configStart);
      if (configStart < 0 || configEnd <= configStart) throw new Error('Exact config anchors changed.');
      patched = replace(patched, source.slice(configStart, configEnd), '  const c = _showcaseSettings(settings);' + eol + eol);
      patched = replace(patched, "const t = String(title ?? '').trim();", "const t = title.trim();");
      patched = replace(patched, "const intro = String(introText ?? '').trim();", 'const intro = introText.trim();');
      patched = replace(patched, "const src = safeUrl(item.imageUrl, '');", 'const src = item.imageUrl;');
      if ((patched.match(/const href = safeUrl\(item\.url\);/g) ?? []).length !== 3 || (patched.match(/href !== '#'/g) ?? []).length !== 3) throw new Error('Exact link anchors changed.');
      patched = patched.replaceAll('const href = safeUrl(item.url);', 'const href = item.url;').replaceAll("href !== '#'", '!!href');
      const sphereStart = patched.indexOf('function renderSphere(items, { sphereSize }) {');
      const sphereEnd = patched.indexOf('function renderTimeline(items, { label }) {', sphereStart);
      if (sphereStart < 0 || sphereEnd <= sphereStart) throw new Error('Exact sphere presentation anchors changed.');
      patched = replace(patched, patched.slice(sphereStart, sphereEnd), SHOWCASE_STATIC_SPHERE_SOURCE.replace(/\n/g, eol) + eol + eol);
      patched = replace(patched, "const label = title ? escapeHtml(title) : 'Showcase';", "const label = title.trim() ? escapeHtml(title.trim()) : 'Showcase';");
      patched = replace(patched, 'function renderCarousel(items, { itemMinWidth, title }) {', 'function renderCarousel(items, { itemMinWidth, title }) {' + eol + '  const focusAttr = items.some(item => !!item.url) ? \'\' : \' tabindex="0"\';');
      patched = replace(patched, '<div class="camap-showcase__track" style=', '<div class="camap-showcase__track"${focusAttr} style=');
      patched = replace(patched, 'render: ({ settings, state } = {}) => renderShowcase(settings, state)', 'render: (context = {}) => _showcaseContext(context)');
    }
    const modified = Buffer.from(patched); files.set(path, modified);
    changes.push({ path, originalSha256, modifiedSha256: sha256(modified), generatedSha256: sha256(lf(modified)), originalBytes: bytes.length, modifiedBytes: modified.length, encoding: 'UTF-8', bom: source.startsWith('\uFEFF'), lineEndings: mixed ? 'mixed LF/CRLF preserved' : crlf ? 'CRLF' : 'LF', change: changeName(path) });
  }
  return { files, changes };
}

function planOptions(input = {}) {
  const clean = inert(input);
  if (!clean || Array.isArray(clean) || Buffer.isBuffer(clean) || typeof clean !== 'object' || Object.keys(clean).some(key => !['module', 'version', 'base', 'output', 'sourceRoot', 'dependenciesRoot', 'inheritedLicense'].includes(key) || typeof clean[key] !== 'string')) throw new Error('Unknown or non-string adaptation option refused.');
  const args = { ...clean, module: clean.module ?? MODULE, version: clean.version ?? '0.5.0', dependenciesRoot: clean.dependenciesRoot ?? 'tmp/step2/camap-source' };
  parseModuleAdoptionArgs(Object.entries(args).filter(([key]) => key !== 'inheritedLicense').flatMap(([key, value]) => [{ sourceRoot: '--source', dependenciesRoot: '--dependencies-root' }[key] ?? `--${key}`, value]));
  if (args.module !== MODULE || !['0.5.0', '0.5.1'].includes(args.version)) throw new Error('Only mod_showcase versions 0.5.0 and 0.5.1 are authorized; immutable 0.3.x/0.4.x requires historical tooling.');
  if (!/^tmp\/showcase-adapt-agent-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(args.output)) throw new Error('--output must name a new tmp/showcase-adapt-agent-* directory.');
  const source = resolve(PROJECT, args.sourceRoot ?? CAMAP); const dependencies = resolve(PROJECT, args.dependenciesRoot); const destination = resolve(PROJECT, args.output);
  const inheritedLicense = resolve(PROJECT, args.inheritedLicense ?? join(dirname(CAMAP), 'LICENSE'));
  if (inheritedLicense !== join(dirname(CAMAP), 'LICENSE') && (!within(TMP, inheritedLicense) || inheritedLicense === TMP)) throw new Error('Inherited license must be approved aggregator LICENSE or an explicit tmp file.');
  if (within(destination, inheritedLicense) || within(source, dependencies) || within(dependencies, source)) throw new Error('Input/license/output paths must not overlap.');
  return { args, source, dependencies, destination, inheritedLicense };
}

/** Full XML from pinned current local createXml, not a historical XML claim. */
export function showcaseAdaptationXml(version) {
  if (!['0.5.0', '0.5.1'].includes(version)) throw new Error('Unauthorized Showcase XML version; immutable 0.3.x/0.4.x requires historical tooling.');
  return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="camap.mod_showcase">
  <name>CAMAP Showcase</name>
  <version>${version}</version>
  <description>CAMAP Showcase JavaScript module for MiniJoomla.</description>
  <files>
    <filename module="mod_showcase">mod_showcase.js</filename>
  </files>
  <media destination="mod_showcase" folder="media">
    <filename>css/showcase.css</filename>
  </media>
  <config>
    <fields name="params">
      <fieldset name="basic">
        <field name="title" label="title" default="Showcase" maxlength="120" type="text" />
        <field name="introText" label="introText" default="" maxlength="800" type="textarea" />
        <field name="mode" label="mode" default="list" type="list">
          <option value="list">list</option>
          <option value="carousel">carousel</option>
          <option value="masonry">masonry</option>
          <option value="sphere">sphere</option>
          <option value="timeline">timeline</option>
        </field>
        <field name="items" label="items" default="[]" type="textarea" mj:type="json" mj:valueType="array" />
        <field name="columns" label="columns" default="3" min="1" max="6" type="number" />
        <field name="carouselItemMinWidth" label="carouselItemMinWidth" default="280" min="180" max="560" type="number" />
        <field name="sphereSize" label="sphereSize" default="520" min="240" max="900" type="number" />
        <field name="timelineLabel" label="timelineLabel" default="Linha do tempo" maxlength="120" type="text" />
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
    try { await collected.add(source, name); throw new Error('Pinned Showcase profile has no CAMAP-root notices; new source license requires review.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let trusted;
  if (source !== CAMAP) {
    trusted = await collectSources(CAMAP);
    if (collected.files.size !== trusted.collected.files.size || [...collected.files].some(([key, { bytes }]) => !trusted.collected.files.get(key) || !lf(bytes).equals(lf(trusted.collected.files.get(key).bytes)))) throw new Error('Source override is not an original trusted CAMAP copy.');
  }
  const overlay = applyShowcaseOverlay(new Map(Object.keys(SHOWCASE_ANCHORS).map(path => [path, collected.files.get(path)?.bytes])));
  return { collected, overlay, async check() { await collected.check(); if (trusted) await trusted.check(); } };
}

const POLICY = 'Own plain descriptor validation at render time only; stored JSON and unknown keys never rewritten. Eight original ordered fields, full defaults/constraints/enums and canonical XML retained. Invalid explicit title/intro/timeline strings render empty; mode accepts only trimmed valid strings, otherwise list. Numbers accept finite numbers or strict signed decimal strings, clamp to original bounds and floor columns only in rendering; null/boolean/empty/exponent/hex/nonfinite fallback to original defaults. Dense exact arrays have own length checked <=500 before descriptor enumeration; no extras/symbols/accessors. Own plain items require trimmed nonblank string title. Invalid optional text becomes empty, unsafe URL retains nonlink item, unsafe image is omitted without fallback src. Images require HTTPS/server-relative strict URLs without any fragment. Valid URL bytes returned raw and escaped once; # never a link. Optional category/date/extraInfo are escaped text; arbitrary date text and datetime remain original schema behavior, not a date validator. Explicit user choice Lista estática segura changes sphere presentation to an ordered static list of original title links/nonlinks, not a rotating ring or 3D visualization. Original mode sphere and sphereSize default/bounds remain; sphereSize sets only rounded width capped by original max-width:100%, not radius/height. No angles/radius/item styles emitted, animation disabled for every motion preference, absolute positioning/transforms removed, auto aspect ratio, visible overflow, square inner frame and wrapped labels. Sphere remains titles only; no images/descriptions promised there. This is a declared capability/presentation change, not pixel-exact original sphere behavior. Runtime context own settings/state never destructured through getters, unknown states follow original stateMessage comparisons without coercion. No fixed global IDs existed or were introduced. CSS appends scoped wrapping/min-width, adaptive masonry grid rows and removes size spans (readable ordered grid, not pixel-exact dense masonry), carousel width capped to track with intentional native horizontal scroll snap, solid inset 3px focus outline, and single-column narrow-container fallback. Original viewport breakpoints still override columns at <=980/640px; not claimed universally corrected. Coordinator browser/site validation remains a separate gate; no new JS controls, backend, interactive carousel controls or integration promise. Preparation imports only byte-pinned trusted local tooling in a bounded private snapshot, not an untrusted JavaScript sandbox. No installation, records, host roots, tenant or publication changed.';

/** Exact five runtime paths, closed evidence and complete scoped notices. */
const FOCUS_POLICY = ' Version 0.5.x retains the exact 0.4.x scoped CSS track:focus-within rule: grid-auto-flow:row; grid-auto-columns:auto; grid-template-columns:minmax(0,1fr); scroll-snap-type:none. Carousel retains horizontal native scroll snap outside focus, but stacks items in original order while the track or any descendant has focus, including mouse focus. The track receives fixed literal tabindex="0" ONLY when every normalized item is nonlink; items.some(item => !!item.url) runs solely over the already validated internal array. If any safe link exists, the track omits tabindex entirely, letting sequential Tab visit links directly, including mixed nonlink/link collections. No tabindex=-1 or positive indices are emitted. This corrects the reported 0.4.x continuous-Tab skip despite successful direct last-link focus; a counterprobe without the track tab stop reached all four links in order. The original parent named carousel region remains, with no duplicate ID or new control. This is an explicit temporary presentation deviation to make focused content visible, not autoplay, new controls or JavaScript. Persisted carouselItemMinWidth remains unchanged and controls the unfocused horizontal view only. No CSS, outer width, font, min-height or URL policy changes accompany the conditional-focus revision. Immutable 0.3.x and 0.4.x tools and each set of 26 package files are archived separately; integrity/layout/direct-focus passes are not continuous keyboard approval. Exact 0.5.x browser continuous Tab/Enter/site revalidation remains pending coordinator receipts.';
export function finalizeShowcasePackage(stagedFiles, evidence) {
  const staged = copyNativeMap(stagedFiles, 'Staged files');
  const p = shape(inert(evidence), ['changes', 'licenses', 'inheritedLicense', 'inheritedLicenseBytes', 'changesLicenseBytes', 'changesLicenseSource', 'generatorSha256', 'adoptionApiSha256', 'snapshot'], 'provenance');
  if (!Array.isArray(p.licenses) || p.licenses.length) throw new Error('Unapproved staged package/license paths.');
  const controls = ['MANIFEST-SHA256.json', 'host-config.json', 'adoption-plan.json', 'docs/ADOPTION-NOTICE.md'];
  const files = new Map(); const budget = { bytes: 0 };
  for (const [name, bytes] of staged) {
    packagePath(name);
    if (![...RUNTIME, ...controls].includes(name)) throw new Error(`Staged path outside Showcase allowlist: ${name}`);
    files.set(name, copyInertBuffer(bytes, budget, 'Package'));
  }
  if ([...RUNTIME, ...controls].some(name => !files.has(name))) throw new Error('Missing mandatory Showcase runtime/control payload.');
  if (!files.get(ENTRY).equals(Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`))) throw new Error('Showcase wrapper differs from original generator.');
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
  planOptions({ version: inventory.version, base: root.baseUrl, output: 'tmp/showcase-adapt-agent-validation' });
  if (root.inventoryHash !== sha256(inventoryBytes) || root.immutable !== true || root.discover !== true || root.id !== `camap-${MODULE}-${inventory.version}`) throw new Error('Staged control hash/identity differs.');
  if (adoptionPlan.format !== 'minijoomla-module-adoption-v1' || adoptionPlan.profile !== 'joomla-xml-v1' || adoptionPlan.module !== MODULE || adoptionPlan.key !== KEY || adoptionPlan.version !== inventory.version || adoptionPlan.base !== root.baseUrl || adoptionPlan.pilot !== false || adoptionPlan.sourceLicensePresent !== false || !same(adoptionPlan.licenses, []) || FLAGS.some(flag => adoptionPlan[flag] !== false)) throw new Error('Staged adoption identity/flags differ.');
  if (!files.get(XML).equals(showcaseAdaptationXml(inventory.version))) throw new Error('Staged XML canonical complete defaults/attributes differ.');
  const descriptor = parseJoomlaManifest(files.get(XML), { baseUrl: root.baseUrl, manifestPath: XML });
  validateAdoptionSchema(descriptor, { defaults: SHOWCASE_DEFAULTS, settingsSchema: { version: 1, fields: FIELDS }, default: { name: KEY, settings: SHOWCASE_DEFAULTS, render() {} } });
  if (descriptor.version !== inventory.version || descriptor.requiredFolders.length || descriptor.entryPointUrl !== `${root.baseUrl}/${ENTRY}` || !same(descriptor.styles, [`${root.baseUrl}/${CSS}`]) || !same(descriptor.requiredFiles, [ENTRY, CSS]) || !same(descriptor.params.map(param => param.label), Object.keys(FIELDS))) throw new Error('Staged XML identity/closure/labels differ.');
  if (!same(inventory.moduleKeys, { [MODULE]: KEY }) || !same(inventory.moduleStyles, { [KEY]: [CSS] }) || !same(hostConfig.moduleStyles, { [KEY]: descriptor.styles }) || !same(hostConfig.moduleStyleRevisions, { [KEY]: { [descriptor.entryPointUrl]: descriptor.styles } })) throw new Error('Staged module/style controls differ.');
  if (!Array.isArray(p.changes) || p.changes.length !== 3 || new Set(p.changes.map(change => change.path)).size !== 3 || !ADAPTATION_GENERATOR_HASHES.includes(p.generatorSha256) || p.adoptionApiSha256 !== SHOWCASE_API_SHA256) throw new Error('Unapproved adaptation generator/API provenance.');
  for (const change of p.changes) {
    shape(change, ['path', 'originalSha256', 'modifiedSha256', 'generatedSha256', 'originalBytes', 'modifiedBytes', 'encoding', 'bom', 'lineEndings', 'change'], 'change');
    const pin = PINNED[change.path]; const raw = change.originalSha256 === SHOWCASE_ANCHORS[change.path]?.[0];
    if (!pin || !SHOWCASE_ANCHORS[change.path].includes(change.originalSha256) || change.originalBytes !== pin.lengths[raw ? 0 : 1] || change.modifiedBytes !== pin.lengths[raw ? 2 : 3] || change.modifiedSha256 !== pin[raw ? 'raw' : 'lf'] || change.generatedSha256 !== pin.lf || sha256(files.get(change.path === SHOWCASE_CSS_PATH ? CSS : `libraries/camap/${change.path}`)) !== pin.lf || change.encoding !== 'UTF-8' || change.bom !== true || change.lineEndings !== (raw ? 'mixed LF/CRLF preserved' : 'LF') || change.change !== changeName(change.path)) throw new Error('Packaged overlay differs from approved patch.');
  }
  if (!Array.isArray(p.snapshot) || p.snapshot.length < 15 || new Set(p.snapshot.map(entry => entry.path.toLowerCase())).size !== p.snapshot.length) throw new Error('Missing/invalid bounded snapshot provenance.');
  let snapshotBytes = 0;
  for (const entry of p.snapshot) {
    shape(entry, ['path', 'originalSha256', 'snapshotSha256', 'bytes'], 'snapshot entry'); packagePath(entry.path);
    const allowed = [SHARED_SOURCE_PATH, 'tools/prepare-joomla-modules.js', 'package.json'].includes(entry.path) || ADOPTION_MODULES.some(({ folder }) => new RegExp(`^extensions/camap/${folder}/[^/]+\\.(js|css)$`).test(entry.path));
    if (!allowed || ![entry.originalSha256, entry.snapshotSha256].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || (snapshotBytes += entry.bytes) > 10 * 1024 * 1024) throw new Error('Invalid bounded snapshot entry.');
  }
  const mandatory = [SHARED_SOURCE_PATH, SHOWCASE_CSS_PATH, 'tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.map(({ folder }) => `extensions/camap/${folder}/module.js`)];
  if (mandatory.some(path => !p.snapshot.some(entry => entry.path === path)) || p.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length !== 3 || p.changes.some(change => !p.snapshot.some(entry => entry.path === change.path && entry.originalSha256 === change.originalSha256 && entry.snapshotSha256 === change.modifiedSha256 && entry.bytes === change.originalBytes)) || p.snapshot.find(entry => entry.path === 'tools/prepare-joomla-modules.js').originalSha256 !== p.generatorSha256) throw new Error('Snapshot must record eleven original modules and exactly three approved patches.');
  const inherited = shape(p.inheritedLicense, ['license', 'origin', 'originCommit', 'sha256', 'historicalLfSha256', 'packagePath', 'scope', 'globalVendorRightsApproved', 'evidence'], 'MIT evidence');
  if (!Buffer.isBuffer(p.inheritedLicenseBytes) || !ADAPTATION_MIT_HASHES.includes(sha256(p.inheritedLicenseBytes)) || inherited.sha256 !== sha256(p.inheritedLicenseBytes) || inherited.license !== 'MIT' || inherited.origin !== 'aggregator root LICENSE' || inherited.originCommit !== ADAPTATION_ORIGIN_COMMIT || inherited.packagePath !== INHERITED_LICENSE_PATH || inherited.historicalLfSha256 !== ADAPTATION_MIT_HASHES[1] || inherited.globalVendorRightsApproved !== false || typeof inherited.evidence !== 'string' || !same(inherited.scope, SCOPE)) throw new Error('Missing/invalid scoped inherited MIT evidence.');
  const changesLicenseSource = shape(p.changesLicenseSource, ['path', 'sha256', 'license', 'scope'], 'GPL evidence');
  if (!Buffer.isBuffer(p.changesLicenseBytes) || sha256(p.changesLicenseBytes) !== CHANGES_LICENSE_SHA256 || !same(changesLicenseSource, { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' })) throw new Error('Missing/invalid authored changes GPL evidence.');
  files.set(INHERITED_LICENSE_PATH, p.inheritedLicenseBytes); files.set(CHANGES_LICENSE_PATH, p.changesLicenseBytes);
  Object.assign(adoptionPlan, { licenses: [INHERITED_LICENSE_PATH], sourceRootLicensePresent: false, sourceLicensePresent: true, inheritedLicenseSource: inherited, changesLicenseSource, adaptation: { format: FORMAT, revision: 3, provenance: 'ADAPTATION.json', changesLicense: 'GPL-2.0-or-later', vendorRightsCleared: false }, nextGate: 'Independent rights review and coordinator lifecycle/site verification; no installation or publication approval.' });
  const adaptation = { format: FORMAT, revision: 3, module: MODULE, version: inventory.version, originalSource: 'local CAMAP2 read-only bounded snapshot', changes: p.changes, generator: { path: 'tools/prepare-joomla-modules.js', sha256: p.generatorSha256, algorithmModified: false }, adoptionApi: { path: 'scripts/prepare-module-adoption.js', sha256: p.adoptionApiSha256, byteIdenticalRelocation: true }, snapshot: p.snapshot, originalLicenses: [], inheritedLicenseSource: inherited, changesLicense: 'GPL-2.0-or-later', changesLicenseSource, vendorLicenseAssigned: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), schemaModified: false, cssModified: true, markupModified: true, otherPackagesModified: false, policy: POLICY + FOCUS_POLICY };
  files.delete('MANIFEST-SHA256.json'); files.delete('host-config.json');
  files.set('adoption-plan.json', json(adoptionPlan)); files.set('ADAPTATION.json', json(adaptation));
  files.set('docs/ADAPTATION-NOTICE.md', Buffer.from(`Local Showcase adaptation, revision 3. Exactly three pinned authored source patches: shared/render.js, mod_showcase/module.js and mod_showcase/showcase.css. ${POLICY}${FOCUS_POLICY} Full original MIT and authored-change GPL texts retained verbatim in docs/licenses/CAMAP-ROOT-MIT.txt and docs/licenses/GPL-2.0.txt. Historical source hashes and limited three-source scope recorded in ADAPTATION.json. GPL-2.0-or-later applies only to authored changes, not all CAMAP. Coordinator site/lifecycle and independent rights receipts remain separate gates.\n`));
  inventory.files = [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  if (files.size !== 11 || inventory.files.length !== 11) throw new Error('Showcase final closure must contain exactly eleven inventoried payloads.');
  const finalInventory = json(inventory); root.inventoryHash = sha256(finalInventory); const finalConfig = json(hostConfig);
  if (finalInventory.length > 64 * 1024 || [...files.values()].reduce((sum, bytes) => sum + bytes.length, finalInventory.length + finalConfig.length) > 10 * 1024 * 1024) throw new Error('Final package/inventory budget exceeded.');
  files.set('MANIFEST-SHA256.json', finalInventory); files.set('host-config.json', finalConfig);
  return { files, inventory, hostConfig, adaptation, adoptionPlan, descriptor };
}

export async function prepareShowcaseAdaptation(input = {}) {
  const plan = planOptions(input); await assertNewAdaptationOutput(plan.destination);
  const [sources, dependencies, evidence] = await Promise.all([collectSources(plan.source), collectAdaptationDependencies(plan.dependencies), (async () => {
    const collected = createAdaptationCollector(); for (const name of ADAPTATION_API_FILES) await collected.add(PROJECT, name);
    if (sha256(collected.files.get('scripts/prepare-module-adoption.js').bytes) !== SHOWCASE_API_SHA256) throw new Error('Original adoption API hash changed; review required.');
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
  const stage = await mkdtemp(join(TMP, 'showcase-adapt-agent-stage-'));
  await writeAdaptationFiles(stage, new Map([...evidence.collected.files.values()].filter(({ name }) => ADAPTATION_API_FILES.includes(name)).map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(stage, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const snapshot = join(stage, 'tmp', 'source');
  await writeAdaptationFiles(snapshot, new Map([...sources.collected.files.values()].map(({ name, bytes }) => [name, sources.overlay.files.get(name) ?? bytes])));
  const deps = join(stage, 'tmp', 'dependencies');
  await writeAdaptationFiles(deps, new Map([...dependencies.files.values()].map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(deps, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const adoption = await import(pathToFileURL(join(stage, 'scripts', 'prepare-module-adoption.js')).href);
  const prepared = await adoption.prepareModuleAdoption({ module: MODULE, version: plan.args.version, base: plan.args.base, sourceRoot: snapshot, dependenciesRoot: deps, output: 'tmp/prepared' });
  const provenance = { changes: sources.overlay.changes, licenses: [], inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(evidence.mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: SCOPE, globalVendorRightsApproved: false, evidence: 'Exact local hashes compared with targeted Git blobs at originCommit; CRLF/CR to LF only, BOM retained. Canonical XML is from pinned current local createXml, not historical XML.' }, inheritedLicenseBytes: evidence.mit, changesLicenseBytes: evidence.gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' }, generatorSha256: sha256(sources.collected.files.get('tools/prepare-joomla-modules.js').bytes), adoptionApiSha256: sha256(evidence.collected.files.get('scripts/prepare-module-adoption.js').bytes), snapshot: [...sources.collected.files.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')).map(({ name, bytes }) => ({ path: name, originalSha256: sha256(bytes), snapshotSha256: sha256(sources.overlay.files.get(name) ?? bytes), bytes: bytes.length })) };
  const finalized = finalizeShowcasePackage(await readAdaptationFiles(prepared.output), provenance);
  await check(); await assertAdoptionNoLinks(plan.destination, { allowMissing: true }); await mkdir(dirname(plan.destination), { recursive: true }); await assertNewAdaptationOutput(plan.destination);
  await mkdir(plan.destination); await writeAdaptationFiles(plan.destination, finalized.files);
  return { ...finalized, output: plan.destination, stage, snapshot, originalSourceFiles: sources.collected.files.size, dependencyFiles: dependencies.files.size };
}

export function parseShowcaseAdaptationArgs(argv = process.argv.slice(2)) {
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
    const args = parseShowcaseAdaptationArgs();
    if (args.help) console.log('Usage: node scripts/prepare-showcase-adaptation.js --base /offline/showcase/0.5.0 --output tmp/showcase-adapt-agent-new [--version 0.5.0|0.5.1] [--module mod_showcase] [--source tmp/original-copy] [--dependencies-root tmp/step2/camap-source] [--inherited-license tmp/approved-MIT.txt]. Offline preparation only; immutable 0.3.x/0.4.x requires historical tooling.');
    else { const result = await prepareShowcaseAdaptation(args); console.log(`Prepared Showcase ${result.inventory.version}: ${result.inventory.files.length} inventoried payloads, ${result.files.size} total files; three pinned patches, ${result.originalSourceFiles} source and ${result.dependencyFiles} dependency files, no site/publication approval. Output: ${result.output}`); }
  } catch (error) { console.error(`prepare-showcase-adaptation: ${error.message}`); process.exitCode = 1; }
}
