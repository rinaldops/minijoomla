/* SPDX-License-Identifier: GPL-2.0-or-later
 * Closed offline hero profile. GPL covers authored changes, not all CAMAP.
 * Original bytes and complete scoped license notices are never overwritten.
 */
import { mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ADOPTION_MODULES, assertAdoptionNoLinks, parseModuleAdoptionArgs, validateAdoptionSchema } from './prepare-module-adoption.js';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import {
  SAFE_URL_SOURCE, SHARED_SOURCE_PATH, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH,
  CHANGES_LICENSE_SHA256, createAdaptationCollector, collectAdaptationDependencies,
  writeAdaptationFiles, readAdaptationFiles, assertNewAdaptationOutput, adaptationText,
  replaceAdaptationAnchor, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES,
  ADAPTATION_ORIGIN_COMMIT, ADAPTATION_API_FILES, ADAPTATION_LICENSE_NAMES
} from './prepare-editorial-adaptation.js';

export { SHARED_SOURCE_PATH, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256 };
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(PROJECT, 'tmp');
const CAMAP = resolve(PROJECT, '..', 'CAMAP2');
const DEPS = join(TMP, 'step2', 'camap-source');
const MODULE = 'mod_hero';
const KEY = `camap.${MODULE}`;
export const HERO_SOURCE_PATH = `extensions/camap/${MODULE}/module.js`;
export const HERO_CSS_PATH = `extensions/camap/${MODULE}/hero.css`;
export const HERO_CSS_ANCHORS = Object.freeze(['78ad460ae9c9ede682cd1bd9570df321a384a5ac02ad159acf95ff2787a152f6', '0ab33c38cf8a844059ca39c9b166576d89d281868ed5acf8e219f575b9e450ea']);
export const HERO_ANCHORS = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze(['fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e', '33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387']),
  [HERO_SOURCE_PATH]: Object.freeze(['bf53fdca654eddb0e6ada73d311bff49e814f206cbbfe6f602fe058462645884', 'e9fe4ac17fc1ea129a5d11aa379ebb8b6cec32d4728de9ad3ac370514195c738']),
  [HERO_CSS_PATH]: HERO_CSS_ANCHORS
});
export const HERO_API_SHA256 = 'ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4';
const GENERATED = Object.freeze({ [SHARED_SOURCE_PATH]: 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76', [HERO_SOURCE_PATH]: 'e94f3386ceb873a887fff6aee35ae327549d8a638e66b0f3c0e9f9c2b2911ca5', [HERO_CSS_PATH]: '2264d58affec356da17ec03331bc8dfa350682348bfaca46c0d36a0ca6f3be87' });
const MODIFIED_RAW = Object.freeze({ [SHARED_SOURCE_PATH]: 'ab6e32d2105d45cff15b9aa55777675d42b418494f09b114317ae19d945f6002', [HERO_SOURCE_PATH]: 'ecd65148db10bbb0aff0ba78ed6ac8ffe9468b134519523a08f8d62ec29d3416', [HERO_CSS_PATH]: '95202fa32c8817590011c7f1958c86fc19bd7d08a0c846ed04d05c2f1b6a3516' });
const BYTE_LENGTHS = Object.freeze({ [SHARED_SOURCE_PATH]: [654, 653, 1746, 1745], [HERO_SOURCE_PATH]: [1561, 1557, 3800, 3796], [HERO_CSS_PATH]: [529, 528, 727, 725] });
const LIB = `libraries/camap/${HERO_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${MODULE}/css/hero.css`;
const ENTRY = `modules/${MODULE}/${MODULE}.js`;
const XML = `modules/${MODULE}/${MODULE}.xml`;
const RUNTIME = [ENTRY, XML, CSS, LIB, SHARED];
const SCOPE = [HERO_SOURCE_PATH, SHARED_SOURCE_PATH, HERO_CSS_PATH];
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const FORMAT = 'minijoomla-hero-adaptation-v1';
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(adaptationText(bytes, 'source').replace(/\r\n?/g, '\n'));
const within = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const changeName = path => path === SHARED_SOURCE_PATH ? 'strict-url-policy-v1' : path === HERO_CSS_PATH ? 'hero-css-wrap-empty-media-v1' : 'runtime-hero-inert-settings-aria-label-v1';
export const HERO_CSS_APPEND = '.camap-hero{overflow-wrap:anywhere}.camap-hero__copy,.camap-hero__media{min-width:0}.camap-hero--without-image{grid-template-columns:1fr}.camap-hero--without-image .camap-hero__media{display:none}';
const DEFAULTS = Object.freeze({ title: 'Profundidade com', rotatingWords: ['propósito'], mission: '', imageUrl: '', imageAlt: '', primaryAction: {}, secondaryAction: {} });
const FIELDS = Object.freeze({ title: { type: 'string' }, rotatingWords: { type: 'array' }, mission: { type: 'string' }, imageUrl: { type: 'string' }, imageAlt: { type: 'string' }, primaryAction: { type: 'object' }, secondaryAction: { type: 'object' } });

// Actual persisted settings are JSON. Descriptor checks avoid getters/coercion
// on invalid plain inputs; this is not a sandbox for Proxy or hostile globals.
export const HERO_VALIDATION_SOURCE = String.raw`function _heroPlain(value) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || typeof descriptors[key].value === 'function')) return null;
  return descriptors;
}
function _heroWords(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return [];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))) return [];
  return keys.filter(key => key !== 'length').map(key => descriptors[key].value).filter(word => typeof word === 'string' && !!word.trim());
}
function _heroAction(value) {
  const descriptors = _heroPlain(value);
  const label = descriptors && Object.hasOwn(descriptors, 'label') ? descriptors.label.value : undefined;
  const target = descriptors && Object.hasOwn(descriptors, 'target') ? descriptors.target.value : undefined;
  return typeof label === 'string' && !!label.trim() && typeof target === 'string' && safeUrl(target) === target && target !== '#' ? { label, target } : null;
}
function _heroImage(value) {
  return typeof value === 'string' && !value.includes('#') && (value.startsWith('/') && !value.startsWith('//') || /^https:\/\//i.test(value)) && safeUrl(value) === value ? value : '';
}
function _heroSettings(settings) {
  const descriptors = _heroPlain(settings);
  const result = { ...defaults };
  if (!descriptors) return result;
  for (const name of ['title', 'mission', 'imageUrl', 'imageAlt']) if (Object.hasOwn(descriptors, name)) result[name] = typeof descriptors[name].value === 'string' ? descriptors[name].value : '';
  for (const name of ['rotatingWords', 'primaryAction', 'secondaryAction']) if (Object.hasOwn(descriptors, name)) result[name] = descriptors[name].value;
  return result;
}`;

/** Exactly three pinned authored patches; no caller code/hash overrides. */
export function applyHeroOverlay(originals) {
  if (!(originals instanceof Map) || originals.size !== 3 || Object.keys(HERO_ANCHORS).some(path => !originals.has(path))) throw new Error('Overlay requires exactly the three approved sources.');
  const files = new Map();
  const changes = [];
  for (const [path, hashes] of Object.entries(HERO_ANCHORS)) {
    const bytes = originals.get(path);
    const source = adaptationText(bytes, path);
    const originalSha256 = sha256(bytes);
    if (!hashes.includes(originalSha256)) throw new Error(`Unapproved original SHA-256: ${path}`);
    const crlf = source.includes('\r\n');
    const mixed = crlf && /(?<!\r)\n/.test(source);
    const eol = crlf && !mixed ? '\r\n' : '\n';
    let patched = source;
    if (path === HERO_CSS_PATH) patched += `${HERO_CSS_APPEND}${eol}`;
    if (path === SHARED_SOURCE_PATH) patched = replaceAdaptationAnchor(source, "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }", SAFE_URL_SOURCE.replace(/\n/g, eol));
    if (path === HERO_SOURCE_PATH) {
      patched = replaceAdaptationAnchor(patched, 'export function renderHero(settings = {})', `${HERO_VALIDATION_SOURCE.replace(/\n/g, eol)}${eol}export function renderHero(settings = {})`);
      patched = replaceAdaptationAnchor(patched, 'const c = { ...defaults, ...settings };', 'const c = _heroSettings(settings);');
      patched = replaceAdaptationAnchor(patched, "Array.isArray(c.rotatingWords) ? c.rotatingWords[0] ?? '' : ''", "_heroWords(c.rotatingWords)[0] ?? ''");
      patched = replaceAdaptationAnchor(patched, "[c.primaryAction, c.secondaryAction].filter(a => a?.label && safeUrl(a.target) !== '#')", '[c.primaryAction, c.secondaryAction].map(_heroAction).filter(Boolean)');
      patched = replaceAdaptationAnchor(patched, 'const image = c.imageUrl ?', 'const imageUrl = _heroImage(c.imageUrl); const image = imageUrl ?');
      patched = replaceAdaptationAnchor(patched, "safeUrl(c.imageUrl, '')", 'imageUrl');
      patched = replaceAdaptationAnchor(patched, '<section class="camap-hero"', '<section class="camap-hero${imageUrl ? \'\' : \' camap-hero--without-image\'}"');
      patched = replaceAdaptationAnchor(patched, 'aria-labelledby="camap-hero-title"', 'aria-label="${escapeHtml(c.title + \' \' + word)}"');
      patched = replaceAdaptationAnchor(patched, '<h1 id="camap-hero-title">', '<h1>');
      patched = replaceAdaptationAnchor(patched, 'render: ({ settings } = {}) => renderHero(settings)', "render: (context = {}) => renderHero(context && typeof context === 'object' ? Object.getOwnPropertyDescriptor(context, 'settings')?.value : undefined)");
    }
    const modified = Buffer.from(patched);
    files.set(path, modified);
    changes.push({ path, originalSha256, modifiedSha256: sha256(modified), generatedSha256: sha256(lf(modified)), originalBytes: bytes.length, modifiedBytes: modified.length, encoding: 'UTF-8', bom: source.startsWith('\uFEFF'), lineEndings: mixed ? 'mixed LF/CRLF preserved' : crlf ? 'CRLF' : 'LF', change: changeName(path) });
  }
  return { files, changes };
}

// Capture trusted Node intrinsics once. Byte input must be a branded, exact
// Buffer with only own byte-index data properties, never length/coercion hooks.
// Native typed-array byteLength/set read internal slots, not overridden fields.
const bufferPrototype = Buffer.prototype;
const bufferAlloc = Buffer.alloc;
const arrayBufferIsView = ArrayBuffer.isView;
const getPrototypeOf = Object.getPrototypeOf;
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
const ownKeys = Reflect.ownKeys;
const applyIntrinsic = Reflect.apply;
const typedByteLength = getOwnPropertyDescriptor(getPrototypeOf(Uint8Array.prototype), 'byteLength').get;
const typedSet = Uint8Array.prototype.set;
function copyInertBuffer(value, budget, label) {
  if (!arrayBufferIsView(value) || getPrototypeOf(value) !== bufferPrototype) throw new Error(`${label}: trusted exact Buffer required.`);
  const length = applyIntrinsic(typedByteLength, value, []);
  if (!Number.isSafeInteger(length) || length < 0 || budget.bytes + length > 10 * 1024 * 1024) throw new Error(`${label}: byte budget exceeded.`);
  const keys = ownKeys(value);
  if (keys.length !== length || keys.some(key => typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) throw new Error(`${label}: Buffer own byte indices only; hooks/accessors refused.`);
  for (const key of keys) {
    const descriptor = getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true || !Number.isInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > 255) throw new Error(`${label}: Buffer own byte data descriptors required.`);
  }
  budget.bytes += length;
  const copy = bufferAlloc(length);
  applyIntrinsic(typedSet, copy, [value]);
  return copy;
}

// Bounded metadata copying via own data descriptors, never JSON.stringify on
// untrusted inputs. No sandbox for Proxy or previously modified globals.
function inert(value, depth = 0, budget = { nodes: 0, bytes: 0 }) {
  if (++budget.nodes > 10000 || depth > 20) throw new Error('Metadata depth/node budget exceeded.');
  if (arrayBufferIsView(value) || value && typeof value === 'object' && getPrototypeOf(value) === bufferPrototype) return copyInertBuffer(value, budget, 'Metadata');
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') { if ((budget.bytes += Buffer.byteLength(value)) > 1024 * 1024) throw new Error('Metadata string budget exceeded.'); return value; }
  if (!value || typeof value !== 'object' || !(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)))) throw new Error('Inert plain metadata required.');
  const descriptors = getOwnPropertyDescriptors(value);
  const keys = ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value'))) throw new Error('Metadata symbol/accessor refused.');
  const result = Array.isArray(value) ? [] : Object.create(null);
  if (Array.isArray(value) && (value.length > 500 || keys.length !== value.length + 1 || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) throw new Error('Dense bounded metadata array required.');
  for (const key of keys) if (key !== 'length' || !Array.isArray(value)) Object.defineProperty(result, key, { value: inert(descriptors[key].value, depth + 1, budget), enumerable: true, writable: true, configurable: true });
  return result;
}
function shape(value, keys, label) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || !same(Object.keys(value).sort(), [...keys].sort())) throw new Error(`Closed ${label} keys required.`);
  return value;
}
function metadata(bytes, name) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 64 * 1024) throw new Error(`Missing/oversized ${name}.`);
  return inert(JSON.parse(adaptationText(bytes, name)));
}
function planOptions(input = {}) {
  const clean = inert(input);
  if (!clean || Array.isArray(clean) || Buffer.isBuffer(clean) || typeof clean !== 'object' || Object.keys(clean).some(key => !['module', 'version', 'base', 'output', 'sourceRoot', 'dependenciesRoot', 'inheritedLicense'].includes(key) || typeof clean[key] !== 'string')) throw new Error('Unknown or non-string adaptation option refused.');
  const args = { ...clean, module: clean.module ?? MODULE, version: clean.version ?? '0.3.0', dependenciesRoot: clean.dependenciesRoot ?? 'tmp/step2/camap-source' };
  parseModuleAdoptionArgs(Object.entries(args).filter(([key]) => key !== 'inheritedLicense').flatMap(([key, value]) => [{ sourceRoot: '--source', dependenciesRoot: '--dependencies-root' }[key] ?? `--${key}`, value]));
  if (args.module !== MODULE || !['0.3.0', '0.3.1'].includes(args.version)) throw new Error('Only mod_hero versions 0.3.0 and 0.3.1 are authorized.');
  if (!/^tmp\/hero-adapt-agent-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(args.output)) throw new Error('--output must name a new tmp/hero-adapt-agent-* directory.');
  const source = resolve(PROJECT, args.sourceRoot ?? CAMAP);
  const dependencies = resolve(PROJECT, args.dependenciesRoot);
  const destination = resolve(PROJECT, args.output);
  const inheritedLicense = resolve(PROJECT, args.inheritedLicense ?? join(dirname(CAMAP), 'LICENSE'));
  if (inheritedLicense !== join(dirname(CAMAP), 'LICENSE') && (!within(TMP, inheritedLicense) || inheritedLicense === TMP)) throw new Error('Inherited license must be approved aggregator LICENSE or an explicit tmp file.');
  if (within(destination, inheritedLicense) || within(source, dependencies) || within(dependencies, source)) throw new Error('Input/license/output paths must not overlap.');
  return { args, source, dependencies, destination, inheritedLicense };
}

// Exact original generator XML, including all seven complete typed defaults.
// Comparing all bytes additionally refuses unknown attributes, constraints,
// aliases/options and discarded parser attributes anywhere in this profile.
export function heroAdaptationXml(version) {
  if (!['0.3.0', '0.3.1'].includes(version)) throw new Error('Unauthorized hero XML version.');
  return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="${KEY}">
  <name>CAMAP Hero</name>
  <version>${version}</version>
  <description>CAMAP Hero JavaScript module for MiniJoomla.</description>
  <files>
    <filename module="${MODULE}">${MODULE}.js</filename>
  </files>
  <media destination="${MODULE}" folder="media">
    <filename>css/hero.css</filename>
  </media>
  <config>
    <fields name="params">
      <fieldset name="basic">
        <field name="title" label="title" default="Profundidade com" type="text" />
        <field name="rotatingWords" label="rotatingWords" default="[&quot;propósito&quot;]" type="textarea" mj:type="json" mj:valueType="array" />
        <field name="mission" label="mission" default="" type="text" />
        <field name="imageUrl" label="imageUrl" default="" type="text" />
        <field name="imageAlt" label="imageAlt" default="" type="text" />
        <field name="primaryAction" label="primaryAction" default="{}" type="textarea" mj:type="json" mj:valueType="object" />
        <field name="secondaryAction" label="secondaryAction" default="{}" type="textarea" mj:type="json" mj:valueType="object" />
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
  const licenses = [];
  for (const name of ADAPTATION_LICENSE_NAMES) {
    try { await collected.add(source, name); licenses.push(name); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (licenses.length) throw new Error('Pinned hero profile has no CAMAP-root notices; newly added source license requires review.');
  let trusted;
  if (source !== CAMAP) {
    trusted = await collectSources(CAMAP);
    if (collected.files.size !== trusted.collected.files.size || [...collected.files].some(([key, { bytes }]) => !trusted.collected.files.get(key) || !lf(bytes).equals(lf(trusted.collected.files.get(key).bytes)))) throw new Error('Source override is not an original trusted CAMAP copy.');
  }
  const overlay = applyHeroOverlay(new Map(Object.keys(HERO_ANCHORS).map(path => [path, collected.files.get(path)?.bytes])));
  return { collected, overlay, licenses, async check() { await collected.check(); if (trusted) await trusted.check(); } };
}

/** Exact five runtime paths, closed controls and full scoped license notices. */
export function finalizeHeroPackage(stagedFiles, evidence) {
  const p = shape(inert(evidence), ['changes', 'licenses', 'inheritedLicense', 'inheritedLicenseBytes', 'changesLicenseBytes', 'changesLicenseSource', 'generatorSha256', 'adoptionApiSha256', 'snapshot'], 'provenance');
  if (!(stagedFiles instanceof Map) || !Array.isArray(p.licenses) || p.licenses.length !== 0) throw new Error('Unapproved staged package/license paths; pinned hero profile has no CAMAP-root notices.');
  const files = new Map();
  const controls = ['MANIFEST-SHA256.json', 'host-config.json', 'adoption-plan.json', 'docs/ADOPTION-NOTICE.md', ...p.licenses];
  const packageBudget = { bytes: 0 };
  for (const [name, bytes] of stagedFiles) {
    packagePath(name);
    if (![...RUNTIME, ...controls].includes(name)) throw new Error(`Staged path outside hero allowlist: ${name}`);
    files.set(name, copyInertBuffer(bytes, packageBudget, 'Package'));
  }
  if ([...RUNTIME, ...controls].some(name => !files.has(name))) throw new Error('Missing mandatory hero runtime/control payload.');
  if (!files.get(ENTRY).equals(Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`))) throw new Error('Hero wrapper differs from original generator.');
  const inventoryBytes = files.get('MANIFEST-SHA256.json');
  const inventory = shape(metadata(inventoryBytes, 'inventory'), ['format', 'version', 'files', 'moduleStyles', 'moduleKeys'], 'inventory');
  const hostConfig = shape(metadata(files.get('host-config.json'), 'host config'), ['joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions'], 'host config');
  const adoptionPlan = shape(metadata(files.get('adoption-plan.json'), 'adoption plan'), ['format', 'profile', 'module', 'key', 'version', 'base', 'pilot', 'validation', 'licenses', 'sourceLicensePresent', ...FLAGS, 'nextGate', 'hostNote'], 'adoption plan');
  if (['validation', 'nextGate', 'hostNote'].some(key => typeof adoptionPlan[key] !== 'string')) throw new Error('Staged adoption notes must be inert strings.');
  if (inventory.format !== 'minijoomla-joomla-package-v1' || !Array.isArray(inventory.files)) throw new Error('Unexpected staged inventory.');
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
  planOptions({ version: inventory.version, base: root.baseUrl, output: 'tmp/hero-adapt-agent-validation' });
  if (root.inventoryHash !== sha256(inventoryBytes) || root.immutable !== true || root.discover !== true || root.id !== `camap-${MODULE}-${inventory.version}`) throw new Error('Staged control hash/identity differs.');
  if (adoptionPlan.format !== 'minijoomla-module-adoption-v1' || adoptionPlan.profile !== 'joomla-xml-v1' || adoptionPlan.module !== MODULE || adoptionPlan.key !== KEY || adoptionPlan.version !== inventory.version || adoptionPlan.base !== root.baseUrl || adoptionPlan.pilot !== false || adoptionPlan.sourceLicensePresent !== (p.licenses.length > 0) || !same(adoptionPlan.licenses, [...p.licenses].sort()) || FLAGS.some(flag => adoptionPlan[flag] !== false)) throw new Error('Staged adoption identity/flags differ.');
  if (!files.get(XML).equals(heroAdaptationXml(inventory.version))) throw new Error('Staged XML canonical complete defaults/attributes differ.');
  const descriptor = parseJoomlaManifest(files.get(XML), { baseUrl: root.baseUrl, manifestPath: XML });
  validateAdoptionSchema(descriptor, { defaults: DEFAULTS, settingsSchema: { version: 1, fields: FIELDS }, default: { name: KEY, settings: DEFAULTS, render() {} } });
  if (descriptor.version !== inventory.version || descriptor.requiredFolders.length || descriptor.entryPointUrl !== `${root.baseUrl}/${ENTRY}` || !same(descriptor.styles, [`${root.baseUrl}/${CSS}`]) || !same(descriptor.requiredFiles, [ENTRY, CSS]) || !same(descriptor.params.map(param => param.label), Object.keys(FIELDS)) || descriptor.params.some(param => Object.hasOwn(param, 'min') || Object.hasOwn(param, 'max') || Object.hasOwn(param, 'maxLength'))) throw new Error('Staged XML identity/closure/labels differ.');
  if (!same(inventory.moduleKeys, { [MODULE]: KEY }) || !same(inventory.moduleStyles, { [KEY]: [CSS] }) || !same(hostConfig.moduleStyles, { [KEY]: descriptor.styles }) || !same(hostConfig.moduleStyleRevisions, { [KEY]: { [descriptor.entryPointUrl]: descriptor.styles } })) throw new Error('Staged module/style controls differ.');
  if (!Array.isArray(p.changes) || p.changes.length !== 3 || new Set(p.changes.map(change => change.path)).size !== 3 || !ADAPTATION_GENERATOR_HASHES.includes(p.generatorSha256) || p.adoptionApiSha256 !== HERO_API_SHA256) throw new Error('Unapproved adaptation generator/API provenance.');
  for (const change of p.changes) {
    shape(change, ['path', 'originalSha256', 'modifiedSha256', 'generatedSha256', 'originalBytes', 'modifiedBytes', 'encoding', 'bom', 'lineEndings', 'change'], 'change');
    const raw = change.originalSha256 === HERO_ANCHORS[change.path]?.[0];
    const lengths = BYTE_LENGTHS[change.path];
    if (!lengths || change.originalBytes !== lengths[raw ? 0 : 1] || change.modifiedBytes !== lengths[raw ? 2 : 3]) throw new Error('Approved patch byte lengths differ.');
    if (!HERO_ANCHORS[change.path]?.includes(change.originalSha256) || change.modifiedSha256 !== (raw ? MODIFIED_RAW[change.path] : GENERATED[change.path]) || change.generatedSha256 !== GENERATED[change.path] || sha256(files.get(change.path === HERO_CSS_PATH ? CSS : `libraries/camap/${change.path}`)) !== GENERATED[change.path] || change.encoding !== 'UTF-8' || change.bom !== true || change.lineEndings !== (raw ? change.path === HERO_CSS_PATH ? 'CRLF' : 'mixed LF/CRLF preserved' : 'LF') || !Number.isSafeInteger(change.originalBytes) || !Number.isSafeInteger(change.modifiedBytes) || change.change !== changeName(change.path)) throw new Error('Packaged overlay differs from approved patch.');
  }
  if (!Array.isArray(p.snapshot) || p.snapshot.length < 15 || new Set(p.snapshot.map(entry => entry.path.toLowerCase())).size !== p.snapshot.length) throw new Error('Missing/invalid bounded snapshot provenance.');
  let snapshotBytes = 0;
  for (const entry of p.snapshot) {
    shape(entry, ['path', 'originalSha256', 'snapshotSha256', 'bytes'], 'snapshot entry'); packagePath(entry.path);
    const allowed = [SHARED_SOURCE_PATH, 'tools/prepare-joomla-modules.js', 'package.json', ...p.licenses].includes(entry.path) || ADOPTION_MODULES.some(({ folder }) => new RegExp(`^extensions/camap/${folder}/[^/]+\\.(js|css)$`).test(entry.path));
    if (!allowed || !hash(entry.originalSha256) || !hash(entry.snapshotSha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || (snapshotBytes += entry.bytes) > 10 * 1024 * 1024) throw new Error('Invalid bounded snapshot entry.');
  }
  const changed = p.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256);
  const mandatorySnapshot = [SHARED_SOURCE_PATH, HERO_CSS_PATH, 'tools/prepare-joomla-modules.js', 'package.json', ...p.licenses, ...ADOPTION_MODULES.map(({ folder }) => `extensions/camap/${folder}/module.js`)];
  if (mandatorySnapshot.some(path => !p.snapshot.some(entry => entry.path === path)) || changed.length !== 3 || p.changes.some(change => !p.snapshot.some(entry => entry.path === change.path && entry.originalSha256 === change.originalSha256 && entry.snapshotSha256 === change.modifiedSha256 && entry.bytes === change.originalBytes)) || p.snapshot.find(entry => entry.path === 'tools/prepare-joomla-modules.js').originalSha256 !== p.generatorSha256) throw new Error('Snapshot must record all eleven original modules and exactly three approved patches.');
  const inherited = shape(p.inheritedLicense, ['license', 'origin', 'originCommit', 'sha256', 'historicalLfSha256', 'packagePath', 'scope', 'globalVendorRightsApproved', 'evidence'], 'MIT evidence');
  if (!Buffer.isBuffer(p.inheritedLicenseBytes) || !ADAPTATION_MIT_HASHES.includes(sha256(p.inheritedLicenseBytes)) || inherited.sha256 !== sha256(p.inheritedLicenseBytes) || inherited.license !== 'MIT' || inherited.origin !== 'aggregator root LICENSE' || inherited.originCommit !== ADAPTATION_ORIGIN_COMMIT || inherited.packagePath !== INHERITED_LICENSE_PATH || inherited.historicalLfSha256 !== ADAPTATION_MIT_HASHES[1] || inherited.globalVendorRightsApproved !== false || typeof inherited.evidence !== 'string' || !same(inherited.scope, SCOPE)) throw new Error('Missing/invalid scoped inherited MIT evidence.');
  const changesLicenseSource = shape(p.changesLicenseSource, ['path', 'sha256', 'license', 'scope'], 'GPL evidence');
  if (!Buffer.isBuffer(p.changesLicenseBytes) || sha256(p.changesLicenseBytes) !== CHANGES_LICENSE_SHA256 || !same(changesLicenseSource, { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' })) throw new Error('Missing/invalid authored changes GPL evidence.');
  files.set(INHERITED_LICENSE_PATH, p.inheritedLicenseBytes); files.set(CHANGES_LICENSE_PATH, p.changesLicenseBytes);
  Object.assign(adoptionPlan, Object.fromEntries(FLAGS.map(flag => [flag, false])), { licenses: [...p.licenses, INHERITED_LICENSE_PATH], sourceRootLicensePresent: p.licenses.length > 0, sourceLicensePresent: true, inheritedLicenseSource: inherited, changesLicenseSource, adaptation: { format: FORMAT, revision: 1, provenance: 'ADAPTATION.json', changesLicense: 'GPL-2.0-or-later', vendorRightsCleared: false }, nextGate: 'Independent rights review and coordinator lifecycle verification; no installation or publication approval.' });
  const policy = 'Render-time own plain data checks only; stored settings and unknown keys are never rewritten. Seven original fields/defaults/options remain unchanged. Only the first valid nonblank string word is static; no rotation/timers. Actions need own nonblank string label and strict safe string target; unsafe actions omitted. Images need validated HTTPS/server-relative URL without fragment, no fallback image. Title/alt/mission must be strings and are escaped. Section aria-label uses literal title plus first word; fixed h1 ID and aria-labelledby are removed to avoid repeated-instance collisions, h1 tag unchanged. Without validated image the section gets camap-hero--without-image. Read-only original site probe: 320px root at 921px viewport, two 160px columns, 86px heading with 4050px scroll width, 4087px root scroll width for 180 unbroken title characters, two duplicate fixed IDs, empty right media 160px by 429px. CSS appends only scoped overflow-wrap:anywhere, copy/media min-width:0, and without-image single column with media display:none. Original image grid, colors, action styles and mobile declarations remain; empty 14rem media is hidden. Corrected real-width evidence remains coordinator responsibility. No header/chrome/backend/aliases/global styling or host capacity changes.';
  const adaptation = { format: FORMAT, revision: 1, module: MODULE, version: inventory.version, originalSource: 'local CAMAP2 read-only bounded snapshot', changes: p.changes, generator: { path: 'tools/prepare-joomla-modules.js', sha256: p.generatorSha256, algorithmModified: false }, adoptionApi: { path: 'scripts/prepare-module-adoption.js', sha256: p.adoptionApiSha256, byteIdenticalRelocation: true }, snapshot: p.snapshot, originalLicenses: p.licenses, inheritedLicenseSource: inherited, changesLicense: 'GPL-2.0-or-later', changesLicenseSource, vendorLicenseAssigned: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), schemaModified: false, cssModified: true, markupModified: true, otherPackagesModified: false, policy };
  files.delete('MANIFEST-SHA256.json'); files.delete('host-config.json');
  files.set('adoption-plan.json', json(adoptionPlan)); files.set('ADAPTATION.json', json(adaptation));
  files.set('docs/ADAPTATION-NOTICE.md', Buffer.from(`Local hero adaptation, revision 1. Exactly three pinned authored source patches: shared/render.js, mod_hero/module.js and mod_hero/hero.css. CSS original bytes/declarations retained plus the scoped sizing append. ${policy} Full original MIT and authored-change GPL texts are retained verbatim in docs/licenses/CAMAP-ROOT-MIT.txt and docs/licenses/GPL-2.0.txt. Source hashes, historical introduction commit and limited three-source scope are in ADAPTATION.json. GPL-2.0-or-later covers authored changes only; it does not relicense all CAMAP. Descriptor checks are not a Proxy sandbox; actual settings enter through JSON params. Corrected site, rights and lifecycle receipts are separate coordinator gates. No browser, installation, tenant, host or publication approval is implied.\n`));
  inventory.files = [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  const finalInventory = json(inventory);
  if (files.size !== 11 || inventory.files.length !== 11) throw new Error('Hero final closure must contain exactly eleven inventoried payloads.');
  const finalConfig = json({ ...hostConfig, joomlaDiscoveryRoots: [{ ...root, inventoryHash: sha256(finalInventory) }] });
  if (finalInventory.length > 64 * 1024 || [...files.values()].reduce((sum, bytes) => sum + bytes.length, finalInventory.length + finalConfig.length) > 10 * 1024 * 1024) throw new Error('Final package/inventory budget exceeded.');
  root.inventoryHash = sha256(finalInventory); files.set('MANIFEST-SHA256.json', finalInventory); files.set('host-config.json', json(hostConfig));
  return { files, inventory, hostConfig, adaptation, adoptionPlan, descriptor };
}

export async function prepareHeroAdaptation(input = {}) {
  const plan = planOptions(input);
  await assertNewAdaptationOutput(plan.destination);
  const [sources, dependencies, evidence] = await Promise.all([collectSources(plan.source), collectAdaptationDependencies(plan.dependencies), (async () => {
    const collected = createAdaptationCollector();
    for (const name of ADAPTATION_API_FILES) await collected.add(PROJECT, name);
    if (sha256(collected.files.get('scripts/prepare-module-adoption.js').bytes) !== HERO_API_SHA256) throw new Error('Original adoption API hash changed; review required.');
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
  const stage = await mkdtemp(join(TMP, 'hero-adapt-agent-stage-'));
  await writeAdaptationFiles(stage, new Map([...evidence.collected.files.values()].filter(({ name }) => ADAPTATION_API_FILES.includes(name)).map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(stage, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const snapshot = join(stage, 'tmp', 'source');
  await writeAdaptationFiles(snapshot, new Map([...sources.collected.files.values()].map(({ name, bytes }) => [name, sources.overlay.files.get(name) ?? bytes])));
  const deps = join(stage, 'tmp', 'dependencies');
  await writeAdaptationFiles(deps, new Map([...dependencies.files.values()].map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(deps, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const adoption = await import(pathToFileURL(join(stage, 'scripts', 'prepare-module-adoption.js')).href);
  const prepared = await adoption.prepareModuleAdoption({ module: MODULE, version: plan.args.version, base: plan.args.base, sourceRoot: snapshot, dependenciesRoot: deps, output: 'tmp/prepared' });
  const provenance = { changes: sources.overlay.changes, licenses: sources.licenses, inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(evidence.mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: SCOPE, globalVendorRightsApproved: false, evidence: 'Exact local hashes compared with targeted Git blobs at originCommit; CRLF/CR to LF only, BOM retained.' }, inheritedLicenseBytes: evidence.mit, changesLicenseBytes: evidence.gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' }, generatorSha256: sha256(sources.collected.files.get('tools/prepare-joomla-modules.js').bytes), adoptionApiSha256: sha256(evidence.collected.files.get('scripts/prepare-module-adoption.js').bytes), snapshot: [...sources.collected.files.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')).map(({ name, bytes }) => ({ path: name, originalSha256: sha256(bytes), snapshotSha256: sha256(sources.overlay.files.get(name) ?? bytes), bytes: bytes.length })) };
  const finalized = finalizeHeroPackage(await readAdaptationFiles(prepared.output), provenance);
  await check(); await assertAdoptionNoLinks(plan.destination, { allowMissing: true }); await mkdir(dirname(plan.destination), { recursive: true }); await assertNewAdaptationOutput(plan.destination);
  await mkdir(plan.destination); await writeAdaptationFiles(plan.destination, finalized.files);
  return { ...finalized, output: plan.destination, stage, snapshot, originalSourceFiles: sources.collected.files.size, dependencyFiles: dependencies.files.size };
}

export function parseHeroAdaptationArgs(argv = process.argv.slice(2)) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { help: true };
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const name = { '--source': 'sourceRoot', '--dependencies-root': 'dependenciesRoot', '--inherited-license': 'inheritedLicense' }[key] ?? key.slice(2);
    if (!['--module', '--version', '--base', '--output', '--source', '--dependencies-root', '--inherited-license'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(args, name)) throw new Error('Invalid, duplicate or missing CLI argument.');
    args[name] = argv[i + 1];
  }
  return planOptions(args).args;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseHeroAdaptationArgs();
    if (args.help) console.log('Usage: node scripts/prepare-hero-adaptation.js --base /offline/hero/0.3.0 --output tmp/hero-adapt-agent-new [--version 0.3.0|0.3.1] [--module mod_hero] [--source tmp/original-copy] [--dependencies-root tmp/step2/camap-source] [--inherited-license tmp/approved-MIT.txt]. Explicit base; offline preparation only.');
    else { const result = await prepareHeroAdaptation(args); console.log(`Prepared hero ${result.inventory.version}: ${result.inventory.files.length} inventoried payloads, ${result.files.size} total files; three pinned patches, scoped wrapping/empty media fix, no publication approval. Output: ${result.output}`); }
  } catch (error) { console.error(`prepare-hero-adaptation: ${error.message}`); process.exitCode = 1; }
}
