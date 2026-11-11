/* SPDX-License-Identifier: GPL-2.0-or-later
 * Offline closed topsections profile; GPL covers authored changes only.
 * Original CAMAP bytes and scoped MIT notice are never rewritten in place.
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
const MODULE = 'mod_camap_topsections';
const KEY = `camap.${MODULE}`;
export const TOPSECTIONS_SOURCE_PATH = `extensions/camap/${MODULE}/module.js`;
export const TOPSECTIONS_CSS_PATH = `extensions/camap/${MODULE}/sd.css`;
export const TOPSECTIONS_CSS_ANCHORS = Object.freeze(['6468e2bdc3677d9fe9a25c9ed49ce0fae0c313fbc4899a69765301fd7953686a', '87a556eec4d8624185fcfc2f570d036b5054b443f12c1bf442493c5add0e103f']);
export const TOPSECTIONS_ANCHORS = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze(['fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e', '33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387']),
  [TOPSECTIONS_SOURCE_PATH]: Object.freeze(['035fbbe0e43a92883ecace67ecbf4e1047cb1b7f5a32c2ddcf7276c133b9119b', '9b6daa23e372a84f0109a0e66a5f04518a904527dba6e2a6ee1c309d3be417db']),
  [TOPSECTIONS_CSS_PATH]: TOPSECTIONS_CSS_ANCHORS
});
export const TOPSECTIONS_API_SHA256 = 'ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4';
const GENERATED = Object.freeze({ [SHARED_SOURCE_PATH]: 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76', [TOPSECTIONS_SOURCE_PATH]: '4b73366bdce1bc3c5197ee7e1851fb5f539b33c28569658c0136a8ddba26ba65', [TOPSECTIONS_CSS_PATH]: '6502b81074c12d728a22eb000f5267bb71a88c7726143b70e3224e6ebfae1f1b' });
const MODIFIED_RAW = Object.freeze({ [SHARED_SOURCE_PATH]: 'ab6e32d2105d45cff15b9aa55777675d42b418494f09b114317ae19d945f6002', [TOPSECTIONS_SOURCE_PATH]: '94a17e53e003ede8314223ea3088131bb90746c78f1df913348eca038f451acd', [TOPSECTIONS_CSS_PATH]: '1c2d68f12d1a1983e9bf0d94c48f157b624959a0f0759d7645e2e61b02c33cab' });
const BYTE_LENGTHS = Object.freeze({ [SHARED_SOURCE_PATH]: [654, 653, 1746, 1745], [TOPSECTIONS_SOURCE_PATH]: [942, 939, 1576, 1573], [TOPSECTIONS_CSS_PATH]: [249, 248, 319, 317] });
const LIB = `libraries/camap/${TOPSECTIONS_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${MODULE}/css/sd.css`;
const ENTRY = `modules/${MODULE}/${MODULE}.js`;
const XML = `modules/${MODULE}/${MODULE}.xml`;
const RUNTIME = [ENTRY, XML, CSS, LIB, SHARED];
const SCOPE = [TOPSECTIONS_SOURCE_PATH, SHARED_SOURCE_PATH, TOPSECTIONS_CSS_PATH];
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const FORMAT = 'minijoomla-topsections-adaptation-v1';
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(adaptationText(bytes, 'source').replace(/\r\n?/g, '\n'));
const within = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const VALID_TOPSECTIONS_ITEM_SOURCE = String.raw`export function _validTopsectionsItem(item) {
  if (!item || typeof item !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(item);
  if (Reflect.ownKeys(descriptors).some(key => !Object.hasOwn(descriptors[key], 'value'))) return false;
  const title = Object.hasOwn(descriptors, 'title') ? descriptors.title.value : undefined;
  const url = Object.hasOwn(descriptors, 'url') ? descriptors.url : undefined;
  return typeof title === 'string' && !!title.trim() && (!url || typeof url.value === 'string');
}`;

/** Exactly three full-byte patches; callers cannot supply code or hashes. */
export function applyTopsectionsOverlay(originals) {
  if (!(originals instanceof Map) || originals.size !== 3 || Object.keys(TOPSECTIONS_ANCHORS).some(path => !originals.has(path))) throw new Error('Overlay requires exactly the three approved sources.');
  const files = new Map();
  const changes = [];
  for (const [path, hashes] of Object.entries(TOPSECTIONS_ANCHORS)) {
    const bytes = originals.get(path);
    const source = adaptationText(bytes, path);
    const originalSha256 = sha256(bytes);
    if (!hashes.includes(originalSha256)) throw new Error(`Unapproved original SHA-256: ${path}`);
    const crlf = source.includes('\r\n');
    const mixed = crlf && /(?<!\r)\n/.test(source);
    const eol = crlf && !mixed ? '\r\n' : '\n';
    const patched = path === SHARED_SOURCE_PATH
      ? replaceAdaptationAnchor(source, "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }", SAFE_URL_SOURCE.replace(/\n/g, eol))
      : path === TOPSECTIONS_CSS_PATH ? replaceAdaptationAnchor(source, 'minmax(14rem,1fr)', 'minmax(min(14rem,100%),1fr)') + `.camap-sd{overflow-wrap:anywhere}.camap-sd li{min-width:0}${eol}`
      : replaceAdaptationAnchor(replaceAdaptationAnchor(source, 'export default {', `${VALID_TOPSECTIONS_ITEM_SOURCE.replace(/\n/g, eol)}${eol}export default {`), '(Array.isArray(c.items) ? c.items : []).slice', '(Array.isArray(c.items) ? c.items : []).filter(_validTopsectionsItem).slice');
    const modified = Buffer.from(patched);
    files.set(path, modified);
    changes.push({ path, originalSha256, modifiedSha256: sha256(modified), generatedSha256: sha256(lf(modified)), originalBytes: bytes.length, modifiedBytes: modified.length, encoding: 'UTF-8', bom: source.startsWith('\uFEFF'), lineEndings: mixed ? 'mixed LF/CRLF preserved' : crlf ? 'CRLF' : 'LF', change: path === SHARED_SOURCE_PATH ? 'strict-url-policy-v1' : path === TOPSECTIONS_CSS_PATH ? 'topsections-css-narrow-grid-v1' : 'runtime-topsections-item-filter-v1' });
  }
  return { files, changes };
}

// Reject getters/functions/symbol keys without invoking them. JSON boundaries
// have bounded depth/nodes/bytes; Buffers are accepted only as byte evidence.
function inert(value, depth = 0, budget = { nodes: 0, bytes: 0 }) {
  if (++budget.nodes > 10000 || depth > 20) throw new Error('Metadata depth/node budget exceeded.');
  if (Buffer.isBuffer(value)) { if ((budget.bytes += value.length) > 10 * 1024 * 1024) throw new Error('Metadata byte budget exceeded.'); return Buffer.from(value); }
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') { if ((budget.bytes += Buffer.byteLength(value)) > 1024 * 1024) throw new Error('Metadata string budget exceeded.'); return value; }
  if (!value || typeof value !== 'object' || !(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)))) throw new Error('Inert plain metadata required.');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
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
  if (args.module !== MODULE || !['0.3.0', '0.3.1'].includes(args.version)) throw new Error('Only mod_camap_topsections versions 0.3.0 and 0.3.1 are authorized.');
  if (!/^tmp\/topsections-adapt-agent-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(args.output)) throw new Error('--output must name a new tmp/topsections-adapt-agent-* directory.');
  const source = resolve(PROJECT, args.sourceRoot ?? CAMAP);
  const dependencies = resolve(PROJECT, args.dependenciesRoot);
  const destination = resolve(PROJECT, args.output);
  const inheritedLicense = resolve(PROJECT, args.inheritedLicense ?? join(dirname(CAMAP), 'LICENSE'));
  if (inheritedLicense !== join(dirname(CAMAP), 'LICENSE') && (!within(TMP, inheritedLicense) || inheritedLicense === TMP)) throw new Error('Inherited license must be approved aggregator LICENSE or an explicit tmp file.');
  if (within(destination, inheritedLicense) || within(source, dependencies) || within(dependencies, source)) throw new Error('Input/license/output paths must not overlap.');
  return { args, source, dependencies, destination, inheritedLicense };
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
  let trusted;
  if (source !== CAMAP) {
    trusted = await collectSources(CAMAP);
    if (collected.files.size !== trusted.collected.files.size || [...collected.files].some(([key, { bytes }]) => !trusted.collected.files.get(key) || !lf(bytes).equals(lf(trusted.collected.files.get(key).bytes)))) throw new Error('Source override is not an original trusted CAMAP copy.');
  }
  const overlay = applyTopsectionsOverlay(new Map(Object.keys(TOPSECTIONS_ANCHORS).map(path => [path, collected.files.get(path)?.bytes])));
  const css = collected.files.get(TOPSECTIONS_CSS_PATH)?.bytes;
  if (!css || !TOPSECTIONS_CSS_ANCHORS.includes(sha256(css)) || sha256(lf(css)) !== TOPSECTIONS_CSS_ANCHORS[1]) throw new Error('Topsections CSS differs from historical MIT scope.');
  return { collected, overlay, licenses, async check() { await collected.check(); if (trusted) await trusted.check(); } };
}

/** Exact five runtime paths plus closed controls and retained original notices. */
export function finalizeTopsectionsPackage(stagedFiles, evidence) {
  const p = shape(inert(evidence), ['changes', 'licenses', 'inheritedLicense', 'inheritedLicenseBytes', 'changesLicenseBytes', 'changesLicenseSource', 'generatorSha256', 'adoptionApiSha256', 'snapshot'], 'provenance');
  if (!(stagedFiles instanceof Map) || !Array.isArray(p.licenses) || new Set(p.licenses).size !== p.licenses.length || p.licenses.some(name => !ADAPTATION_LICENSE_NAMES.includes(name))) throw new Error('Unapproved staged package/license paths.');
  const files = new Map(stagedFiles);
  const controls = ['MANIFEST-SHA256.json', 'host-config.json', 'adoption-plan.json', 'docs/ADOPTION-NOTICE.md', ...p.licenses];
  let total = 0;
  for (const [name, bytes] of files) {
    packagePath(name);
    if (![...RUNTIME, ...controls].includes(name)) throw new Error(`Staged path outside topsections allowlist: ${name}`);
    if (!Buffer.isBuffer(bytes) || (total += bytes.length) > 10 * 1024 * 1024) throw new Error('Package byte/type budget exceeded.');
  }
  if ([...RUNTIME, ...controls].some(name => !files.has(name))) throw new Error('Missing mandatory topsections runtime/control payload.');
  if (!files.get(ENTRY).equals(Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`))) throw new Error('Topsections wrapper differs from original generator.');
  const inventoryBytes = files.get('MANIFEST-SHA256.json');
  const inventory = shape(metadata(inventoryBytes, 'inventory'), ['format', 'version', 'files', 'moduleStyles', 'moduleKeys'], 'inventory');
  const hostConfig = shape(metadata(files.get('host-config.json'), 'host config'), ['joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions'], 'host config');
  const adoptionPlan = shape(metadata(files.get('adoption-plan.json'), 'adoption plan'), ['format', 'profile', 'module', 'key', 'version', 'base', 'pilot', 'validation', 'licenses', 'sourceLicensePresent', ...FLAGS, 'nextGate', 'hostNote'], 'adoption plan');
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
  planOptions({ version: inventory.version, base: root.baseUrl, output: 'tmp/topsections-adapt-agent-validation' });
  if (root.inventoryHash !== sha256(inventoryBytes) || root.immutable !== true || root.discover !== true || root.id !== `camap-${MODULE}-${inventory.version}`) throw new Error('Staged control hash/identity differs.');
  if (adoptionPlan.format !== 'minijoomla-module-adoption-v1' || adoptionPlan.profile !== 'joomla-xml-v1' || adoptionPlan.module !== MODULE || adoptionPlan.key !== KEY || adoptionPlan.version !== inventory.version || adoptionPlan.base !== root.baseUrl || adoptionPlan.pilot !== false || adoptionPlan.sourceLicensePresent !== (p.licenses.length > 0) || !same(adoptionPlan.licenses, [...p.licenses].sort()) || FLAGS.some(flag => adoptionPlan[flag] !== false)) throw new Error('Staged adoption identity/flags differ.');
  const descriptor = parseJoomlaManifest(files.get(XML), { baseUrl: root.baseUrl, manifestPath: XML });
  const defaults = { title: '', items: [], itemLimit: 6 };
  validateAdoptionSchema(descriptor, { defaults, settingsSchema: { version: 1, fields: { title: { type: 'string' }, items: { type: 'array' }, itemLimit: { type: 'number' } } }, default: { name: KEY, settings: defaults, render() {} } });
  if (descriptor.version !== inventory.version || descriptor.requiredFolders.length || descriptor.entryPointUrl !== `${root.baseUrl}/${ENTRY}` || !same(descriptor.styles, [`${root.baseUrl}/${CSS}`]) || !same(descriptor.requiredFiles, [ENTRY, CSS]) || !same(descriptor.params.map(param => param.label), ['title', 'items', 'itemLimit']) || descriptor.params.some(param => Object.hasOwn(param, 'min') || Object.hasOwn(param, 'max') || Object.hasOwn(param, 'maxLength'))) throw new Error('Staged XML identity/closure/labels differ.');
  if (!same(inventory.moduleKeys, { [MODULE]: KEY }) || !same(inventory.moduleStyles, { [KEY]: [CSS] }) || !same(hostConfig.moduleStyles, { [KEY]: descriptor.styles }) || !same(hostConfig.moduleStyleRevisions, { [KEY]: { [descriptor.entryPointUrl]: descriptor.styles } })) throw new Error('Staged module/style controls differ.');
  if (!Array.isArray(p.changes) || p.changes.length !== 3 || new Set(p.changes.map(change => change.path)).size !== 3 || !ADAPTATION_GENERATOR_HASHES.includes(p.generatorSha256) || p.adoptionApiSha256 !== TOPSECTIONS_API_SHA256) throw new Error('Unapproved adaptation generator/API provenance.');
  for (const change of p.changes) {
    shape(change, ['path', 'originalSha256', 'modifiedSha256', 'generatedSha256', 'originalBytes', 'modifiedBytes', 'encoding', 'bom', 'lineEndings', 'change'], 'change');
    const raw = change.originalSha256 === TOPSECTIONS_ANCHORS[change.path]?.[0];
    const lengths = BYTE_LENGTHS[change.path];
    if (!lengths || change.originalBytes !== lengths[raw ? 0 : 1] || change.modifiedBytes !== lengths[raw ? 2 : 3]) throw new Error('Approved patch byte lengths differ.');
    if (!TOPSECTIONS_ANCHORS[change.path]?.includes(change.originalSha256) || change.modifiedSha256 !== (raw ? MODIFIED_RAW[change.path] : GENERATED[change.path]) || change.generatedSha256 !== GENERATED[change.path] || sha256(files.get(change.path === TOPSECTIONS_CSS_PATH ? CSS : `libraries/camap/${change.path}`)) !== GENERATED[change.path] || change.encoding !== 'UTF-8' || change.bom !== true || change.lineEndings !== (raw ? change.path === TOPSECTIONS_CSS_PATH ? 'CRLF' : 'mixed LF/CRLF preserved' : 'LF') || !Number.isSafeInteger(change.originalBytes) || !Number.isSafeInteger(change.modifiedBytes) || change.change !== (change.path === SHARED_SOURCE_PATH ? 'strict-url-policy-v1' : change.path === TOPSECTIONS_CSS_PATH ? 'topsections-css-narrow-grid-v1' : 'runtime-topsections-item-filter-v1')) throw new Error('Packaged overlay differs from approved patch.');
  }
  if (sha256(files.get(CSS)) !== GENERATED[TOPSECTIONS_CSS_PATH]) throw new Error('Packaged CSS differs from approved grid-sizing patch.');
  if (!Array.isArray(p.snapshot) || p.snapshot.length < 15 || new Set(p.snapshot.map(entry => entry.path.toLowerCase())).size !== p.snapshot.length) throw new Error('Missing/invalid bounded snapshot provenance.');
  let snapshotBytes = 0;
  for (const entry of p.snapshot) {
    shape(entry, ['path', 'originalSha256', 'snapshotSha256', 'bytes'], 'snapshot entry'); packagePath(entry.path);
    const allowed = [SHARED_SOURCE_PATH, 'tools/prepare-joomla-modules.js', 'package.json', ...p.licenses].includes(entry.path) || ADOPTION_MODULES.some(({ folder }) => new RegExp(`^extensions/camap/${folder}/[^/]+\\.(js|css)$`).test(entry.path));
    if (!allowed || !hash(entry.originalSha256) || !hash(entry.snapshotSha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || (snapshotBytes += entry.bytes) > 10 * 1024 * 1024) throw new Error('Invalid bounded snapshot entry.');
  }
  const changed = p.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256);
  const mandatorySnapshot = [SHARED_SOURCE_PATH, TOPSECTIONS_CSS_PATH, 'tools/prepare-joomla-modules.js', 'package.json', ...p.licenses, ...ADOPTION_MODULES.map(({ folder }) => `extensions/camap/${folder}/module.js`)];
  if (mandatorySnapshot.some(path => !p.snapshot.some(entry => entry.path === path)) || changed.length !== 3 || p.changes.some(change => !changed.some(entry => entry.path === change.path && entry.originalSha256 === change.originalSha256 && entry.snapshotSha256 === change.modifiedSha256 && entry.bytes === change.originalBytes)) || p.snapshot.find(entry => entry.path === 'tools/prepare-joomla-modules.js').originalSha256 !== p.generatorSha256) throw new Error('Snapshot must record all eleven original modules and exactly three approved patches.');
  const inherited = shape(p.inheritedLicense, ['license', 'origin', 'originCommit', 'sha256', 'historicalLfSha256', 'packagePath', 'scope', 'globalVendorRightsApproved', 'evidence'], 'MIT evidence');
  if (!Buffer.isBuffer(p.inheritedLicenseBytes) || !ADAPTATION_MIT_HASHES.includes(sha256(p.inheritedLicenseBytes)) || inherited.sha256 !== sha256(p.inheritedLicenseBytes) || inherited.license !== 'MIT' || inherited.origin !== 'aggregator root LICENSE' || inherited.originCommit !== ADAPTATION_ORIGIN_COMMIT || inherited.packagePath !== INHERITED_LICENSE_PATH || inherited.historicalLfSha256 !== ADAPTATION_MIT_HASHES[1] || inherited.globalVendorRightsApproved !== false || !same(inherited.scope, SCOPE)) throw new Error('Missing/invalid scoped inherited MIT evidence.');
  const changesLicenseSource = shape(p.changesLicenseSource, ['path', 'sha256', 'license', 'scope'], 'GPL evidence');
  if (!Buffer.isBuffer(p.changesLicenseBytes) || sha256(p.changesLicenseBytes) !== CHANGES_LICENSE_SHA256 || !same(changesLicenseSource, { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' })) throw new Error('Missing/invalid authored changes GPL evidence.');
  files.set(INHERITED_LICENSE_PATH, p.inheritedLicenseBytes); files.set(CHANGES_LICENSE_PATH, p.changesLicenseBytes);
  Object.assign(adoptionPlan, Object.fromEntries(FLAGS.map(flag => [flag, false])), { licenses: [...p.licenses, INHERITED_LICENSE_PATH], sourceRootLicensePresent: p.licenses.length > 0, sourceLicensePresent: true, inheritedLicenseSource: inherited, changesLicenseSource, adaptation: { format: FORMAT, revision: 1, provenance: 'ADAPTATION.json', changesLicense: 'GPL-2.0-or-later', vendorRightsCleared: false }, nextGate: 'Independent rights review and coordinator lifecycle verification; no installation or publication approval.' });
  const adaptation = { format: FORMAT, revision: 1, module: MODULE, version: inventory.version, originalSource: 'local CAMAP2 read-only bounded snapshot', changes: p.changes, generator: { path: 'tools/prepare-joomla-modules.js', sha256: p.generatorSha256, algorithmModified: false }, adoptionApi: { path: 'scripts/prepare-module-adoption.js', sha256: p.adoptionApiSha256, byteIdenticalRelocation: true }, snapshot: p.snapshot, originalLicenses: p.licenses, inheritedLicenseSource: inherited, changesLicense: 'GPL-2.0-or-later', changesLicenseSource, vendorLicenseAssigned: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), schemaModified: false, cssModified: true, otherPackagesModified: false, policy: 'Existing strict URL policy reused. Inert own plain title/nonblank rows with absent or string url filtered before the original slice at render time only. Stored settings, title/items/itemLimit schema, labels/defaults and limit semantics remain unchanged. Read-only site probes found 224px grid content in a 180px root and 3395px overflow with a 300-character unbroken item title after fixing the grid minimum. CSS changes minmax(14rem,1fr) to minmax(min(14rem,100%),1fr) and appends only .camap-sd{overflow-wrap:anywhere}.camap-sd li{min-width:0}; original selectors, other declarations and wide layout are retained.' };
  files.delete('MANIFEST-SHA256.json'); files.delete('host-config.json');
  files.set('adoption-plan.json', json(adoptionPlan)); files.set('ADAPTATION.json', json(adaptation));
  files.set('docs/ADAPTATION-NOTICE.md', Buffer.from('Local topsections adaptation, revision 1. Exactly three pinned sources are patched in a private snapshot: shared/render.js, topsections/module.js and topsections/sd.css. escapeHtml, stateMessage, XML title/items/itemLimit fields and labels/defaults remain unchanged. Invalid rows are filtered before the original slice only at render time; stored settings and unknown keys are not rewritten. Zero uses six, negatives render no rows, fractions truncate through slice and no new maximum is introduced. Read-only site probes measured 224px grid content within a 180px root, then 3395px overflow with a 300-character unbroken item title after the grid-only fix. CSS changes minmax(14rem,1fr) to minmax(min(14rem,100%),1fr) and appends .camap-sd{overflow-wrap:anywhere}.camap-sd li{min-width:0}; auto-fit, gap, list style, borders, colors and original declarations stay unchanged. Wrapping is scoped to camap-sd, including headings; there is no global/theme or other-module CSS change. No canonical backend, images or aliases are added. The helper affects only this new package, not prior packages. Full original MIT and authored-change GPL texts are retained verbatim in docs/licenses/CAMAP-ROOT-MIT.txt and docs/licenses/GPL-2.0.txt; source hashes, historical introduction commit and limited scope are in ADAPTATION.json. GPL-2.0-or-later covers authored changes only and does not relicense CAMAP as a whole. Corrected site, rights and lifecycle receipts are separate coordinator gates. No tenant, host, installation or publication approval is implied.\n'));
  inventory.files = [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  const finalInventory = json(inventory);
  if (finalInventory.length > 64 * 1024 || [...files.values()].reduce((sum, bytes) => sum + bytes.length, finalInventory.length) > 10 * 1024 * 1024) throw new Error('Final package/inventory budget exceeded.');
  root.inventoryHash = sha256(finalInventory); files.set('MANIFEST-SHA256.json', finalInventory); files.set('host-config.json', json(hostConfig));
  return { files, inventory, hostConfig, adaptation, adoptionPlan, descriptor };
}

export async function prepareTopsectionsAdaptation(input = {}) {
  const plan = planOptions(input);
  await assertNewAdaptationOutput(plan.destination);
  const [sources, dependencies, evidence] = await Promise.all([collectSources(plan.source), collectAdaptationDependencies(plan.dependencies), (async () => {
    const collected = createAdaptationCollector();
    for (const name of ADAPTATION_API_FILES) await collected.add(PROJECT, name);
    if (sha256(collected.files.get('scripts/prepare-module-adoption.js').bytes) !== TOPSECTIONS_API_SHA256) throw new Error('Original adoption API hash changed; review required.');
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
  const stage = await mkdtemp(join(TMP, 'topsections-adapt-agent-stage-'));
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
  const finalized = finalizeTopsectionsPackage(await readAdaptationFiles(prepared.output), provenance);
  await check(); await assertAdoptionNoLinks(plan.destination, { allowMissing: true }); await mkdir(dirname(plan.destination), { recursive: true }); await assertNewAdaptationOutput(plan.destination);
  await mkdir(plan.destination); await writeAdaptationFiles(plan.destination, finalized.files);
  return { ...finalized, output: plan.destination, stage, snapshot, originalSourceFiles: sources.collected.files.size, dependencyFiles: dependencies.files.size };
}

export function parseTopsectionsAdaptationArgs(argv = process.argv.slice(2)) {
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
    const args = parseTopsectionsAdaptationArgs();
    if (args.help) console.log('Usage: node scripts/prepare-topsections-adaptation.js --base /offline/topsections/0.3.0 --output tmp/topsections-adapt-agent-new [--version 0.3.0|0.3.1] [--module mod_camap_topsections] [--source tmp/original-copy] [--dependencies-root tmp/step2/camap-source] [--inherited-license tmp/approved-MIT.txt]. Explicit base required; offline preparation only.');
    else { const result = await prepareTopsectionsAdaptation(args); console.log(`Prepared topsections ${result.inventory.version}: ${result.inventory.files.length} inventoried payloads, ${result.files.size} total files; three pinned patches, narrow-root grid fix, no publication approval. Output: ${result.output}`); }
  } catch (error) { console.error(`prepare-topsections-adaptation: ${error.message}`); process.exitCode = 1; }
}
