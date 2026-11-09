/* SPDX-License-Identifier: GPL-2.0-or-later
 * Closed offline Home profile. Authored changes only, not global vendor rights.
 */
import { mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ADOPTION_MODULES, assertAdoptionNoLinks, parseModuleAdoptionArgs, validateAdoptionSchema } from './prepare-module-adoption.js';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { copyInertBuffer, inertAdaptationMetadata as inert, closedAdaptationShape as shape, parseAdaptationMetadata as metadata } from './prepare-hero-adaptation.js';
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
const MODULE = 'mod_home';
const KEY = `camap.${MODULE}`;
export const HOME_SOURCE_PATH = `extensions/camap/${MODULE}/module.js`;
export const HOME_CSS_PATH = `extensions/camap/${MODULE}/home.css`;
export const HOME_ANCHORS = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze(['fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e', '33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387']),
  [HOME_SOURCE_PATH]: Object.freeze(['d97eccdf12a0f9fe989bf80ad67cbe8f4ba3dd4c1e3119c9e21ee293de0f851e', 'f57b7e0502442e6cca31f6450bb0bf55f5eff15655c278107899047cbf019717']),
  [HOME_CSS_PATH]: Object.freeze(['bea83a74cf1413d9ccc954e8f34271d1b7032061ca1c41ee6ceec67941105d8f', '7be4bc11a012357d8f932aacff12de44b0dd133874b379815db2f71c99fa5f2c'])
});
export const HOME_CSS_ANCHORS = HOME_ANCHORS[HOME_CSS_PATH];
export const HOME_API_SHA256 = 'ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4';
// Closed generated hash/length table filled from the approved exact overlay.
const PINNED = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze({ raw: 'ab6e32d2105d45cff15b9aa55777675d42b418494f09b114317ae19d945f6002', lf: 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76', lengths: [654, 653, 1746, 1745] }),
  [HOME_SOURCE_PATH]: Object.freeze({ raw: '596ba9d33ea02580a47a97a6188d63c91bdb9745da90dbee21a33bf1a23a5520', lf: 'bad4ece1107c2f6e565ab3bb643070d05fe946f915127bbd1f01ff8d33556e10', lengths: [4133, 4132, 6816, 6815] }),
  [HOME_CSS_PATH]: Object.freeze({ raw: 'e96240d0adcbee6770dee06eba570604428ed7a0efdee76678181689e40be60f', lf: '25f53736ad63624cd041d2eb546011a2ba60c4cbbbd26dfa942444562b09d34e', lengths: [7872, 7665, 8399, 8192] })
});
const LIB = `libraries/camap/${HOME_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${MODULE}/css/home.css`;
const ENTRY = `modules/${MODULE}/${MODULE}.js`;
const XML = `modules/${MODULE}/${MODULE}.xml`;
const RUNTIME = [ENTRY, XML, CSS, LIB, SHARED];
const SCOPE = [HOME_SOURCE_PATH, SHARED_SOURCE_PATH, HOME_CSS_PATH];
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const FORMAT = 'minijoomla-home-adaptation-v1';
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(adaptationText(bytes, 'source').replace(/\r\n?/g, '\n'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const within = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const changeName = path => path === SHARED_SOURCE_PATH ? 'strict-url-policy-v1' : path === HOME_CSS_PATH ? 'home-css-rendered-root-wrap-container-reflow-v2' : 'runtime-home-inert-settings-aria-label-v1';
export const HOME_CSS_OLD_ROOT = '[data-mse-module="home"][data-mse-module="home"]';
export const HOME_CSS_NEW_ROOT = '.mse-home';
export const HOME_CSS_APPEND = '.mse-home{overflow-wrap:anywhere}.mse-home__inner,.mse-home__stat{min-width:0}.mse-home__stats{grid-template-columns:repeat(4,minmax(0,1fr));column-gap:min(2.6em,4%)}.mse-home__button{min-width:0;max-width:100%;box-sizing:border-box}.mse-home__lines{overflow:hidden}@media(max-width:760px){.mse-home__stats{grid-template-columns:repeat(2,minmax(0,1fr))}}.mse-home{container-type:inline-size}@container(max-width:320px){.mse-home__stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@container(max-width:180px){.mse-home__stats{grid-template-columns:minmax(0,1fr)}}';
export const HOME_DEFAULTS = Object.freeze({
  eyebrow: 'Digital workspace', title: 'Tecnologia que conecta. Pessoas que transformam.', primaryHighlight: 'conecta', secondaryHighlight: 'transformam',
  description: 'A shared space for useful content, discussions and learning.',
  primaryAction: { label: 'Open discussions', href: '#discussions' }, secondaryAction: { label: 'Browse videos', href: '#videos' },
  stats: [{ value: '17', label: 'ENCONTROS REALIZADOS' }, { value: '1×/mês', label: 'ENCONTRO AO VIVO' }, { value: '—', label: 'APRESENTAÇÕES REALIZADAS' }, { value: '—', label: 'MENSAGENS NO FÓRUM' }]
});
Object.freeze(HOME_DEFAULTS.primaryAction); Object.freeze(HOME_DEFAULTS.secondaryAction);
HOME_DEFAULTS.stats.forEach(Object.freeze); Object.freeze(HOME_DEFAULTS.stats);
const FIELDS = Object.freeze(Object.fromEntries(Object.keys(HOME_DEFAULTS).map(name => [name, {
  type: name === 'stats' ? 'array' : name.endsWith('Action') ? 'object' : 'string',
  ...(['eyebrow', 'title', 'primaryHighlight', 'secondaryHighlight', 'description'].includes(name) ? { maxLength: name === 'title' ? 180 : name === 'description' ? 400 : 80 } : {}), default: HOME_DEFAULTS[name]
}])));

// Capture trusted intrinsics once; caller containers are never iterated/read
// through own methods. This is not a Proxy or modified-global sandbox.
const NativeMap = Map;
const mapPrototype = NativeMap.prototype;
const getPrototypeOf = Object.getPrototypeOf;
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const ownKeys = Reflect.ownKeys;
const applyIntrinsic = Reflect.apply;
const mapSize = getOwnPropertyDescriptor(mapPrototype, 'size').get;
const mapHas = mapPrototype.has;
const mapGet = mapPrototype.get;
const mapSet = mapPrototype.set;
const mapEntries = mapPrototype.entries;
const mapIteratorNext = getOwnPropertyDescriptor(getPrototypeOf(applyIntrinsic(mapEntries, new NativeMap(), [])), 'next').value;
function copyNativeMap(value, label) {
  if (!value || typeof value !== 'object' || getPrototypeOf(value) !== mapPrototype || ownKeys(value).length !== 0) throw new Error(`${label}: exact native Map without own properties required.`);
  let size;
  try { size = applyIntrinsic(mapSize, value, []); }
  catch { throw new Error(`${label}: branded native Map required.`); }
  if (size > 500) throw new Error(`${label}: native Map entry budget exceeded.`);
  const copy = new NativeMap();
  const iterator = applyIntrinsic(mapEntries, value, []);
  for (let index = 0; index < size; index += 1) {
    const step = applyIntrinsic(mapIteratorNext, iterator, []);
    if (step.done) throw new Error(`${label}: native Map size changed.`);
    applyIntrinsic(mapSet, copy, [step.value[0], step.value[1]]);
  }
  if (!applyIntrinsic(mapIteratorNext, iterator, []).done) throw new Error(`${label}: native Map size changed.`);
  return copy;
}

// Actual settings are JSON; descriptors avoid accessors/coercion, not Proxy.
export const HOME_VALIDATION_SOURCE = String.raw`function _homePlain(value) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || typeof descriptors[key].value === 'function')) return null;
  return descriptors;
}
function _homeAction(value, fallback) {
  const descriptors = _homePlain(value);
  if (!descriptors) return null;
  const label = Object.hasOwn(descriptors, 'label') ? descriptors.label.value : fallback.label;
  const href = Object.hasOwn(descriptors, 'href') ? descriptors.href.value : fallback.href;
  return typeof label === 'string' && !!label.trim() && typeof href === 'string' && href !== '#' && safeUrl(href) === href ? { label: label.trim(), href } : null;
}
function _homeStats(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return defaults.stats;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const length = descriptors.length.value;
  if (length > 500 || keys.length !== length + 1 || keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) return [];
  if (!length) return defaults.stats;
  return Array.from({ length: Math.min(length, 8) }, (_, index) => {
    const item = _homePlain(descriptors[index].value);
    const value = item && Object.hasOwn(item, 'value') ? item.value.value : undefined;
    const label = item && Object.hasOwn(item, 'label') ? item.label.value : undefined;
    return typeof value === 'string' && typeof label === 'string' ? { value, label } : null;
  }).filter(Boolean);
}
function _homeSettings(settings) {
  const descriptors = _homePlain(settings);
  const result = { ...defaults };
  for (const name of ['eyebrow', 'title', 'primaryHighlight', 'secondaryHighlight', 'description']) if (descriptors && Object.hasOwn(descriptors, name)) result[name] = typeof descriptors[name].value === 'string' ? descriptors[name].value : '';
  for (const name of ['primaryAction', 'secondaryAction']) result[name] = descriptors ? _homeAction(Object.hasOwn(descriptors, name) ? descriptors[name].value : defaults[name], defaults[name]) : null;
  result.stats = _homeStats(descriptors && Object.hasOwn(descriptors, 'stats') ? descriptors.stats.value : defaults.stats);
  return result;
}
function _homeRenderContext(context) {
  const descriptors = _homePlain(context);
  return renderHome(descriptors ? Object.hasOwn(descriptors, 'settings') ? descriptors.settings.value : undefined : null, descriptors && Object.hasOwn(descriptors, 'state') ? descriptors.state.value : undefined);
}`;

/** Exactly three pinned sources; no caller-provided patch or hash policy. */
export function applyHomeOverlay(originals) {
  const sources = copyNativeMap(originals, 'Overlay sources');
  if (applyIntrinsic(mapSize, sources, []) !== 3 || Object.keys(HOME_ANCHORS).some(path => !applyIntrinsic(mapHas, sources, [path]))) throw new Error('Overlay requires exactly the three approved sources.');
  const files = new Map(); const changes = []; const budget = { bytes: 0 };
  for (const [path, hashes] of Object.entries(HOME_ANCHORS)) {
    const bytes = copyInertBuffer(applyIntrinsic(mapGet, sources, [path]), budget, 'Source'); const source = adaptationText(bytes, path);
    const originalSha256 = sha256(bytes);
    if (!hashes.includes(originalSha256)) throw new Error(`Unapproved original SHA-256: ${path}`);
    const crlf = source.includes('\r\n'); const mixed = crlf && /(?<!\r)\n/.test(source); const eol = crlf && !mixed ? '\r\n' : '\n';
    let patched = source;
    if (path === SHARED_SOURCE_PATH) patched = replace(source, "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }", SAFE_URL_SOURCE.replace(/\n/g, eol));
    if (path === HOME_CSS_PATH) patched = replace(source, HOME_CSS_OLD_ROOT, HOME_CSS_NEW_ROOT) + HOME_CSS_APPEND + eol;
    if (path === HOME_SOURCE_PATH) {
      patched = replace(patched, 'function highlight(text, term, className) {', `${HOME_VALIDATION_SOURCE.replace(/\n/g, eol)}${eol}${eol}function highlight(text, term, className) {`);
      patched = replace(patched, "const source = String(text ?? '');", "const source = typeof text === 'string' ? text : ''; ");
      patched = replace(patched, "const needle = String(term ?? '').trim();", "const needle = typeof term === 'string' ? term.trim() : ''; ");
      patched = replace(patched, "const label = String(action?.label ?? '').trim();", "const label = action ? action.label : ''; ");
      patched = replace(patched, 'const href = safeUrl(action?.href);', "const href = action ? action.href : ''; ");
      patched = replace(patched, 'const values = Array.isArray(items) && items.length ? items.slice(0, 8) : defaults.stats;', 'const values = items;');
      patched = replace(patched, "  if (state !== 'ready')", "  state = typeof state === 'string' ? state : '';\n  if (state !== 'ready')".replace(/\n/g, eol));
      patched = replace(patched, 'const c = { ...defaults, ...settings, primaryAction: { ...defaults.primaryAction, ...settings.primaryAction }, secondaryAction: { ...defaults.secondaryAction, ...settings.secondaryAction } };', 'const c = _homeSettings(settings);');
      patched = replace(patched, 'aria-labelledby="mse-home-title"', 'aria-label="${escapeHtml(c.title)}"');
      patched = replace(patched, '<h1 id="mse-home-title" class=', '<h1 class=');
      patched = replace(patched, 'render: ({ settings, state } = {}) => renderHome(settings, state)', 'render: (context = {}) => _homeRenderContext(context)');
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
  if (args.module !== MODULE || !['0.4.0', '0.4.1'].includes(args.version)) throw new Error('Only mod_home versions 0.4.0 and 0.4.1 are authorized; frozen 0.3.x packages require their historical tooling.');
  if (!/^tmp\/home-adapt-agent-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(args.output)) throw new Error('--output must name a new tmp/home-adapt-agent-* directory.');
  const source = resolve(PROJECT, args.sourceRoot ?? CAMAP); const dependencies = resolve(PROJECT, args.dependenciesRoot); const destination = resolve(PROJECT, args.output);
  const inheritedLicense = resolve(PROJECT, args.inheritedLicense ?? join(dirname(CAMAP), 'LICENSE'));
  if (inheritedLicense !== join(dirname(CAMAP), 'LICENSE') && (!within(TMP, inheritedLicense) || inheritedLicense === TMP)) throw new Error('Inherited license must be approved aggregator LICENSE or an explicit tmp file.');
  if (within(destination, inheritedLicense) || within(source, dependencies) || within(dependencies, source)) throw new Error('Input/license/output paths must not overlap.');
  return { args, source, dependencies, destination, inheritedLicense };
}

/** Exact XML produced by the pinned original createXml; no parser shortcuts. */
export function homeAdaptationXml(version) {
  if (!['0.4.0', '0.4.1'].includes(version)) throw new Error('Unauthorized Home XML version.');
  return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="${KEY}">
  <name>CAMAP Home</name>
  <version>${version}</version>
  <description>CAMAP Home JavaScript module for MiniJoomla.</description>
  <files>
    <filename module="${MODULE}">${MODULE}.js</filename>
  </files>
  <media destination="${MODULE}" folder="media">
    <filename>css/home.css</filename>
  </media>
  <config>
    <fields name="params">
      <fieldset name="basic">
        <field name="eyebrow" label="eyebrow" default="Digital workspace" maxlength="80" type="text" />
        <field name="title" label="title" default="Tecnologia que conecta. Pessoas que transformam." maxlength="180" type="text" />
        <field name="primaryHighlight" label="primaryHighlight" default="conecta" maxlength="80" type="text" />
        <field name="secondaryHighlight" label="secondaryHighlight" default="transformam" maxlength="80" type="text" />
        <field name="description" label="description" default="A shared space for useful content, discussions and learning." maxlength="400" type="textarea" />
        <field name="primaryAction" label="primaryAction" default="{&quot;label&quot;:&quot;Open discussions&quot;,&quot;href&quot;:&quot;#discussions&quot;}" type="textarea" mj:type="json" mj:valueType="object" />
        <field name="secondaryAction" label="secondaryAction" default="{&quot;label&quot;:&quot;Browse videos&quot;,&quot;href&quot;:&quot;#videos&quot;}" type="textarea" mj:type="json" mj:valueType="object" />
        <field name="stats" label="stats" default="[{&quot;value&quot;:&quot;17&quot;,&quot;label&quot;:&quot;ENCONTROS REALIZADOS&quot;},{&quot;value&quot;:&quot;1×/mês&quot;,&quot;label&quot;:&quot;ENCONTRO AO VIVO&quot;},{&quot;value&quot;:&quot;—&quot;,&quot;label&quot;:&quot;APRESENTAÇÕES REALIZADAS&quot;},{&quot;value&quot;:&quot;—&quot;,&quot;label&quot;:&quot;MENSAGENS NO FÓRUM&quot;}]" type="textarea" mj:type="json" mj:valueType="array" />
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
    try { await collected.add(source, name); throw new Error('Pinned Home profile has no CAMAP-root notices; new source license requires review.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let trusted;
  if (source !== CAMAP) {
    trusted = await collectSources(CAMAP);
    if (collected.files.size !== trusted.collected.files.size || [...collected.files].some(([key, { bytes }]) => !trusted.collected.files.get(key) || !lf(bytes).equals(lf(trusted.collected.files.get(key).bytes)))) throw new Error('Source override is not an original trusted CAMAP copy.');
  }
  const overlay = applyHomeOverlay(new Map(Object.keys(HOME_ANCHORS).map(path => [path, collected.files.get(path)?.bytes])));
  return { collected, overlay, async check() { await collected.check(); if (trusted) await trusted.check(); } };
}

const POLICY = 'Render-time own plain data checks only; stored settings and unknown keys are never rewritten. Eight complete original fields/defaults and existing maxLength constraints remain unchanged. Strings invalid as title/eyebrow/description/highlights render empty without coercion. Actions merge missing own label/href from original defaults, including valid {}; explicitly invalid overrides omit the action, never restore defaults or fallback links. Labels are trimmed and strict safe string href is required, excluding #. Default #discussions/#videos are historical static fragments, not a working backend promise. Stats [] and legacy nonarrays retain original default counters; malformed accessor/sparse/oversized arrays render none, nonempty dense arrays inspect only first eight own plain string value/label rows. Counters are static, not live data. Highlight retains first locale pt-BR slice match only; secondaryHighlight remains an original unused field. Section aria-label uses escaped literal title; fixed h1 ID and aria-labelledby removed, h1 and other original classes/decorations unchanged. Empty explicit title gives an empty literal label and needs useful author content. Renderer context settings/state inspected by own plain descriptors; nonstring state becomes unknown empty-state section without coercion. CSS replaces only the first unmatched legacy wrapper selector with .mse-home, matching the emitted root and applying original local variables/text color. Equal specificity preserves the later original gradient over the first transparent background; original mobile background precedes the later root gradient and is not newly made operational. Scoped append adds root overflow-wrap:anywhere, inner/stat min-width:0, four minmax(0,1fr) stat tracks and two at the original 760px viewport breakpoint, column-gap:min(2.6em,4%), button min-width:0/max-width:100%/border-box and overflow:hidden on decorative lines only. A final root container-type:inline-size declaration and ordered max-width:320px/max-width:180px container queries reduce stats to two/one tracks by root content-box width, independently of viewport width, without changing original fonts/padding/action styles/row gap/palette or adding editorial clipping. Coordinator actual public-site probe of frozen 0.3.x at root 180px/viewport 1366px found 54.64px horizontal padding per side, 15.56px four-column tracks and a roughly 19.6px D glyph; stats exceeded client width by 2px although original root clipping concealed it. This is a failed stats-bounded180 gate, not evidence of fitting content. Frozen 0.3.x artifacts remain unchanged and are not adopted; current tooling generates only new 0.4.0/0.4.1 packages. Coordinator must remeasure stats/individual counters and root scrollWidth<=clientWidth at 180px on the actual public site, including repeated instances and all lifecycle widths; Node/AST tests do not establish visual success or relax the gate. Legacy Lite requires explicit metadata attributes absent from this renderer; no host theme integration is promised. Floaters remain original static raw spans, without adding the missing floater animation class. No images, timers, backend, chrome/header, host configuration, installation or publication approval. Descriptor checks are not a Proxy/hostile-globals sandbox.';

/** Closed five-file runtime; full licenses and complete canonical XML. */
export function finalizeHomePackage(stagedFiles, evidence) {
  const staged = copyNativeMap(stagedFiles, 'Staged files');
  const p = shape(inert(evidence), ['changes', 'licenses', 'inheritedLicense', 'inheritedLicenseBytes', 'changesLicenseBytes', 'changesLicenseSource', 'generatorSha256', 'adoptionApiSha256', 'snapshot'], 'provenance');
  if (!Array.isArray(p.licenses) || p.licenses.length) throw new Error('Unapproved staged package/license paths.');
  const controls = ['MANIFEST-SHA256.json', 'host-config.json', 'adoption-plan.json', 'docs/ADOPTION-NOTICE.md'];
  const files = new Map(); const budget = { bytes: 0 };
  for (const [name, bytes] of staged) {
    packagePath(name);
    if (![...RUNTIME, ...controls].includes(name)) throw new Error(`Staged path outside Home allowlist: ${name}`);
    files.set(name, copyInertBuffer(bytes, budget, 'Package'));
  }
  if ([...RUNTIME, ...controls].some(name => !files.has(name))) throw new Error('Missing mandatory Home runtime/control payload.');
  if (!files.get(ENTRY).equals(Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`))) throw new Error('Home wrapper differs from original generator.');
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
  planOptions({ version: inventory.version, base: root.baseUrl, output: 'tmp/home-adapt-agent-validation' });
  if (root.inventoryHash !== sha256(inventoryBytes) || root.immutable !== true || root.discover !== true || root.id !== `camap-${MODULE}-${inventory.version}`) throw new Error('Staged control hash/identity differs.');
  if (adoptionPlan.format !== 'minijoomla-module-adoption-v1' || adoptionPlan.profile !== 'joomla-xml-v1' || adoptionPlan.module !== MODULE || adoptionPlan.key !== KEY || adoptionPlan.version !== inventory.version || adoptionPlan.base !== root.baseUrl || adoptionPlan.pilot !== false || adoptionPlan.sourceLicensePresent !== false || !same(adoptionPlan.licenses, []) || FLAGS.some(flag => adoptionPlan[flag] !== false)) throw new Error('Staged adoption identity/flags differ.');
  if (!files.get(XML).equals(homeAdaptationXml(inventory.version))) throw new Error('Staged XML canonical complete defaults/attributes differ.');
  const descriptor = parseJoomlaManifest(files.get(XML), { baseUrl: root.baseUrl, manifestPath: XML });
  validateAdoptionSchema(descriptor, { defaults: HOME_DEFAULTS, settingsSchema: { version: 1, fields: FIELDS }, default: { name: KEY, settings: HOME_DEFAULTS, render() {} } });
  if (descriptor.version !== inventory.version || descriptor.requiredFolders.length || descriptor.entryPointUrl !== `${root.baseUrl}/${ENTRY}` || !same(descriptor.styles, [`${root.baseUrl}/${CSS}`]) || !same(descriptor.requiredFiles, [ENTRY, CSS]) || !same(descriptor.params.map(param => param.label), Object.keys(FIELDS))) throw new Error('Staged XML identity/closure/labels differ.');
  if (!same(inventory.moduleKeys, { [MODULE]: KEY }) || !same(inventory.moduleStyles, { [KEY]: [CSS] }) || !same(hostConfig.moduleStyles, { [KEY]: descriptor.styles }) || !same(hostConfig.moduleStyleRevisions, { [KEY]: { [descriptor.entryPointUrl]: descriptor.styles } })) throw new Error('Staged module/style controls differ.');
  if (!Array.isArray(p.changes) || p.changes.length !== 3 || new Set(p.changes.map(change => change.path)).size !== 3 || !ADAPTATION_GENERATOR_HASHES.includes(p.generatorSha256) || p.adoptionApiSha256 !== HOME_API_SHA256) throw new Error('Unapproved adaptation generator/API provenance.');
  for (const change of p.changes) {
    shape(change, ['path', 'originalSha256', 'modifiedSha256', 'generatedSha256', 'originalBytes', 'modifiedBytes', 'encoding', 'bom', 'lineEndings', 'change'], 'change');
    const pin = PINNED[change.path]; const raw = change.originalSha256 === HOME_ANCHORS[change.path]?.[0];
    if (!pin || !HOME_ANCHORS[change.path].includes(change.originalSha256) || change.originalBytes !== pin.lengths[raw ? 0 : 1] || change.modifiedBytes !== pin.lengths[raw ? 2 : 3] || change.modifiedSha256 !== pin[raw ? 'raw' : 'lf'] || change.generatedSha256 !== pin.lf || sha256(files.get(change.path === HOME_CSS_PATH ? CSS : `libraries/camap/${change.path}`)) !== pin.lf || change.encoding !== 'UTF-8' || change.bom !== (change.path !== HOME_CSS_PATH) || change.lineEndings !== (raw ? 'mixed LF/CRLF preserved' : 'LF') || change.change !== changeName(change.path)) throw new Error('Packaged overlay differs from approved patch.');
  }
  if (!Array.isArray(p.snapshot) || p.snapshot.length < 15 || new Set(p.snapshot.map(entry => entry.path.toLowerCase())).size !== p.snapshot.length) throw new Error('Missing/invalid bounded snapshot provenance.');
  let snapshotBytes = 0;
  for (const entry of p.snapshot) {
    shape(entry, ['path', 'originalSha256', 'snapshotSha256', 'bytes'], 'snapshot entry'); packagePath(entry.path);
    const allowed = [SHARED_SOURCE_PATH, 'tools/prepare-joomla-modules.js', 'package.json'].includes(entry.path) || ADOPTION_MODULES.some(({ folder }) => new RegExp(`^extensions/camap/${folder}/[^/]+\\.(js|css)$`).test(entry.path));
    if (!allowed || ![entry.originalSha256, entry.snapshotSha256].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || (snapshotBytes += entry.bytes) > 10 * 1024 * 1024) throw new Error('Invalid bounded snapshot entry.');
  }
  const mandatory = [SHARED_SOURCE_PATH, HOME_CSS_PATH, 'tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.map(({ folder }) => `extensions/camap/${folder}/module.js`)];
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
  files.set('docs/ADAPTATION-NOTICE.md', Buffer.from(`Local Home adaptation, revision 1. Exactly three pinned authored source patches: shared/render.js, mod_home/module.js and mod_home/home.css. ${POLICY} Full original MIT and authored-change GPL texts retained verbatim in docs/licenses/CAMAP-ROOT-MIT.txt and docs/licenses/GPL-2.0.txt. Historical source hashes and limited three-source scope recorded in ADAPTATION.json. GPL-2.0-or-later applies only to authored changes, not all CAMAP. Coordinator site/lifecycle and independent rights receipts remain separate gates.\n`));
  inventory.files = [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  if (files.size !== 11 || inventory.files.length !== 11) throw new Error('Home final closure must contain exactly eleven inventoried payloads.');
  const finalInventory = json(inventory); root.inventoryHash = sha256(finalInventory); const finalConfig = json(hostConfig);
  if (finalInventory.length > 64 * 1024 || [...files.values()].reduce((sum, bytes) => sum + bytes.length, finalInventory.length + finalConfig.length) > 10 * 1024 * 1024) throw new Error('Final package/inventory budget exceeded.');
  files.set('MANIFEST-SHA256.json', finalInventory); files.set('host-config.json', finalConfig);
  return { files, inventory, hostConfig, adaptation, adoptionPlan, descriptor };
}

export async function prepareHomeAdaptation(input = {}) {
  const plan = planOptions(input); await assertNewAdaptationOutput(plan.destination);
  const [sources, dependencies, evidence] = await Promise.all([collectSources(plan.source), collectAdaptationDependencies(plan.dependencies), (async () => {
    const collected = createAdaptationCollector(); for (const name of ADAPTATION_API_FILES) await collected.add(PROJECT, name);
    if (sha256(collected.files.get('scripts/prepare-module-adoption.js').bytes) !== HOME_API_SHA256) throw new Error('Original adoption API hash changed; review required.');
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
  const stage = await mkdtemp(join(TMP, 'home-adapt-agent-stage-'));
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
  const finalized = finalizeHomePackage(await readAdaptationFiles(prepared.output), provenance);
  await check(); await assertAdoptionNoLinks(plan.destination, { allowMissing: true }); await mkdir(dirname(plan.destination), { recursive: true }); await assertNewAdaptationOutput(plan.destination);
  await mkdir(plan.destination); await writeAdaptationFiles(plan.destination, finalized.files);
  return { ...finalized, output: plan.destination, stage, snapshot, originalSourceFiles: sources.collected.files.size, dependencyFiles: dependencies.files.size };
}

export function parseHomeAdaptationArgs(argv = process.argv.slice(2)) {
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
    const args = parseHomeAdaptationArgs();
    if (args.help) console.log('Usage: node scripts/prepare-home-adaptation.js --base /offline/home/0.4.0 --output tmp/home-adapt-agent-new [--version 0.4.0|0.4.1] [--module mod_home] [--source tmp/original-copy] [--dependencies-root tmp/step2/camap-source] [--inherited-license tmp/approved-MIT.txt]. Explicit base; offline preparation only; frozen 0.3.x requires historical tooling.');
    else { const result = await prepareHomeAdaptation(args); console.log(`Prepared Home ${result.inventory.version}: ${result.inventory.files.length} inventoried payloads, ${result.files.size} total files; three pinned patches, no site/publication approval. Output: ${result.output}`); }
  } catch (error) { console.error(`prepare-home-adaptation: ${error.message}`); process.exitCode = 1; }
}
