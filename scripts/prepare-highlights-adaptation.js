/* SPDX-License-Identifier: GPL-2.0-or-later
 * Offline closed highlights profile. GPL covers authored changes only.
 * The original generator/API are relocated byte-identically into a new tree.
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
const MODULE = 'mod_camap_highlights';
const KEY = `camap.${MODULE}`;
export const HIGHLIGHTS_SOURCE_PATH = `extensions/camap/${MODULE}/module.js`;
export const HIGHLIGHTS_CSS_PATH = `extensions/camap/${MODULE}/highlights.css`;
export const HIGHLIGHTS_CSS_ANCHORS = Object.freeze(['50bb64f94cc5b9ffdf19aba6f84a230aac19eb1723c6ee55e0e9457f82e32e27', 'e9f8bc83be5b485a545c72a93f8417f1c0d58eca3acfbae099ad30923cdb8ab7']);
export const HIGHLIGHTS_ANCHORS = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze(['fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e', '33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387']),
  [HIGHLIGHTS_SOURCE_PATH]: Object.freeze(['b33ce70f8e3a12c422dec6a0540429dd4657d2421ffd3bf0f35a053733a52872', '64b687c2bb0781652f217992a4df063af65bb549695859d767a27bb5b7ff3af2']),
  [HIGHLIGHTS_CSS_PATH]: HIGHLIGHTS_CSS_ANCHORS
});
const GENERATED_HASHES = Object.freeze({
  [SHARED_SOURCE_PATH]: 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76',
  [HIGHLIGHTS_SOURCE_PATH]: '92f992b6a9dfbc0c53d638ba48f5474538aed92325a6df9507156ff2cdb4970f',
  [HIGHLIGHTS_CSS_PATH]: '47ac128e928debc2460600c9e4aa3fdff5bb9201d1a9fb0d8d0e4661bb5198e8'
});
const MODIFIED_RAW_HASHES = Object.freeze({
  [SHARED_SOURCE_PATH]: 'ab6e32d2105d45cff15b9aa55777675d42b418494f09b114317ae19d945f6002',
  [HIGHLIGHTS_SOURCE_PATH]: 'd0ce67a265190b20e9b67775dfbc74772d255911939e417a6f69d9d77d91433d',
  [HIGHLIGHTS_CSS_PATH]: '3bb32c33912aff5537763482d8e4296ba9a3963cb690b7ea2e102db96a5363ae'
});
const SCOPE = Object.freeze([HIGHLIGHTS_SOURCE_PATH, SHARED_SOURCE_PATH, HIGHLIGHTS_CSS_PATH]);
const LIB = `libraries/camap/${HIGHLIGHTS_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${MODULE}/css/highlights.css`;
const ENTRY = `modules/${MODULE}/${MODULE}.js`;
const XML = `modules/${MODULE}/${MODULE}.xml`;
const RUNTIME = Object.freeze([ENTRY, XML, CSS, LIB, SHARED]);
const FLAGS = Object.freeze(['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified']);
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(adaptationText(bytes, 'source').replace(/\r\n?/g, '\n'));
const within = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };

export const VALID_HIGHLIGHTS_ITEM_SOURCE = String.raw`export function _validHighlightsItem(item) {
  if (!item || typeof item !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(item);
  if (Reflect.ownKeys(descriptors).some(key => !Object.hasOwn(descriptors[key], 'value'))) return false;
  const title = Object.hasOwn(descriptors, 'title') ? descriptors.title.value : undefined;
  const url = Object.hasOwn(descriptors, 'url') ? descriptors.url : undefined;
  const description = Object.hasOwn(descriptors, 'description') ? descriptors.description : undefined;
  return typeof title === 'string' && !!title.trim() && (!url || typeof url.value === 'string') && (!description || description.value === null || typeof description.value === 'string');
}`;

/** Three full-byte anchors only; no caller-supplied code, hashes or profiles. */
export function applyHighlightsOverlay(originals) {
  if (!(originals instanceof Map) || originals.size !== 3 || Object.keys(HIGHLIGHTS_ANCHORS).some(path => !originals.has(path))) throw new Error('Overlay requires exactly the three approved sources.');
  const files = new Map();
  const changes = [];
  for (const [path, hashes] of Object.entries(HIGHLIGHTS_ANCHORS)) {
    const bytes = originals.get(path);
    const source = adaptationText(bytes, path);
    const originalSha256 = sha256(bytes);
    if (!hashes.includes(originalSha256)) throw new Error(`Unapproved original SHA-256: ${path}`);
    const crlf = source.includes('\r\n');
    const mixed = crlf && /(?<!\r)\n/.test(source);
    const eol = crlf && !mixed ? '\r\n' : '\n';
    const patched = path === SHARED_SOURCE_PATH
      ? replaceAdaptationAnchor(source, "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }", SAFE_URL_SOURCE.replace(/\n/g, eol))
      : path === HIGHLIGHTS_CSS_PATH ? source.replaceAll('.camap-dt1', '.camap-highlights') + `.camap-highlights--horizontal>h2{grid-column:1/-1}${eol}`
      : replaceAdaptationAnchor(replaceAdaptationAnchor(source, 'export default {', `${VALID_HIGHLIGHTS_ITEM_SOURCE.replace(/\n/g, eol)}${eol}export default {`), '(Array.isArray(c.items) ? c.items : []).map', '(Array.isArray(c.items) ? c.items : []).filter(_validHighlightsItem).map');
    const modified = Buffer.from(patched);
    files.set(path, modified);
    changes.push({ path, originalSha256, modifiedSha256: sha256(modified), generatedSha256: sha256(lf(modified)), originalBytes: bytes.length, modifiedBytes: modified.length, encoding: 'UTF-8', bom: source.startsWith('\uFEFF'), lineEndings: mixed ? 'mixed LF/CRLF preserved' : crlf ? 'CRLF' : 'LF', change: path === SHARED_SOURCE_PATH ? 'strict-url-policy-v1' : path === HIGHLIGHTS_CSS_PATH ? 'highlights-css-selector-and-heading-v1' : 'runtime-highlights-item-filter-v1' });
  }
  return { files, changes };
}

function planOptions(input = {}) {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error('Plain options required.');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(descriptors).some(key => !['module', 'version', 'base', 'output', 'sourceRoot', 'dependenciesRoot', 'inheritedLicense'].includes(key) || !Object.hasOwn(descriptors[key], 'value') || typeof descriptors[key].value !== 'string')) throw new Error('Unknown, accessor or non-string adaptation option refused.');
  const args = { ...input, module: input.module ?? MODULE, version: input.version ?? '0.3.0', dependenciesRoot: input.dependenciesRoot ?? 'tmp/step2/camap-source' };
  parseModuleAdoptionArgs(Object.entries(args).filter(([key]) => key !== 'inheritedLicense').flatMap(([key, value]) => [{ sourceRoot: '--source', dependenciesRoot: '--dependencies-root' }[key] ?? `--${key}`, value]));
  if (args.module !== MODULE) throw new Error('Only mod_camap_highlights is authorized.');
  if (!['0.3.0', '0.3.1'].includes(args.version)) throw new Error('Only highlights revisions 0.3.0 and 0.3.1 are authorized.');
  if (!/^tmp\/highlights-adapt-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(args.output)) throw new Error('--output must name a new tmp/highlights-adapt-* directory.');
  const source = resolve(PROJECT, args.sourceRoot ?? CAMAP);
  const dependencies = resolve(PROJECT, args.dependenciesRoot);
  const destination = resolve(PROJECT, args.output);
  const inheritedLicense = resolve(PROJECT, args.inheritedLicense ?? join(dirname(CAMAP), 'LICENSE'));
  if (inheritedLicense !== join(dirname(CAMAP), 'LICENSE') && (!within(TMP, inheritedLicense) || inheritedLicense === TMP)) throw new Error('Inherited license must be the approved aggregator LICENSE or an explicit tmp file.');
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
  const generator = await collected.add(source, 'tools/prepare-joomla-modules.js');
  if (!ADAPTATION_GENERATOR_HASHES.includes(sha256(generator))) throw new Error('Original generator hash changed; review required.');
  if (JSON.parse(adaptationText(await collected.add(source, 'package.json'), 'package.json')).type !== 'module') throw new Error('Original package must declare ESM.');
  const licenses = [];
  for (const name of ADAPTATION_LICENSE_NAMES) {
    try { await collected.add(source, name); licenses.push(name); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // Overrides are fixtures/copies, not a route to execute arbitrary foreign
  // module code while the original generator inventories its complete catalogue.
  if (source !== CAMAP) {
    const approved = await collectSources(CAMAP);
    if (collected.files.size !== approved.collected.files.size) throw new Error('Source override differs from original bounded CAMAP snapshot.');
    for (const [key, { bytes }] of collected.files) {
      const original = approved.collected.files.get(key)?.bytes;
      if (!original || !lf(bytes).equals(lf(original))) throw new Error(`Source override is not an original CAMAP copy: ${key}`);
    }
    await approved.collected.check();
  }
  const overlay = applyHighlightsOverlay(new Map(Object.keys(HIGHLIGHTS_ANCHORS).map(path => [path, collected.files.get(path)?.bytes])));
  const css = collected.files.get(HIGHLIGHTS_CSS_PATH)?.bytes;
  if (!css || !HIGHLIGHTS_CSS_ANCHORS.includes(sha256(css)) || sha256(lf(css)) !== HIGHLIGHTS_CSS_ANCHORS[1]) throw new Error('Highlights CSS differs from historical MIT scope.');
  return { collected, overlay, licenses };
}

function metadata(bytes, name) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 64 * 1024) throw new Error(`Missing/oversized ${name}.`);
  return JSON.parse(adaptationText(bytes, name));
}

/** Strict selected package: correctly inventoried foreign payloads still fail. */
export function finalizeHighlightsPackage(stagedFiles, provenance) {
  if (!(stagedFiles instanceof Map) || !provenance || !Array.isArray(provenance.licenses) || new Set(provenance.licenses).size !== provenance.licenses.length || provenance.licenses.some(name => !ADAPTATION_LICENSE_NAMES.includes(name))) throw new Error('Unapproved staged package/license paths.');
  const files = new Map(stagedFiles);
  const controls = ['MANIFEST-SHA256.json', 'host-config.json', 'adoption-plan.json', 'docs/ADOPTION-NOTICE.md', ...provenance.licenses];
  for (const name of files.keys()) {
    packagePath(name);
    if (![...controls, ...RUNTIME].includes(name)) throw new Error(`Staged path outside highlights allowlist: ${name}`);
  }
  if ([...RUNTIME, ...controls].some(name => !files.has(name))) throw new Error('Missing mandatory highlights runtime/control payload.');
  const wrapper = Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`);
  if (!Buffer.isBuffer(files.get(ENTRY)) || !files.get(ENTRY).equals(wrapper)) throw new Error('Highlights wrapper differs from original generator.');
  const inventoryBytes = files.get('MANIFEST-SHA256.json');
  const inventory = metadata(inventoryBytes, 'inventory');
  const hostConfig = metadata(files.get('host-config.json'), 'host config');
  const adoptionPlan = metadata(files.get('adoption-plan.json'), 'adoption plan');
  if (inventory.format !== 'minijoomla-joomla-package-v1' || !['0.3.0', '0.3.1'].includes(inventory.version) || !Array.isArray(inventory.files) || inventory.files.length > 500) throw new Error('Unexpected staged inventory.');
  const expected = new Set(['MANIFEST-SHA256.json', 'host-config.json']);
  for (const entry of inventory.files) {
    packagePath(entry.path);
    const bytes = files.get(entry.path);
    if (expected.has(entry.path) || !Buffer.isBuffer(bytes) || entry.bytes !== bytes.length || entry.sha256 !== sha256(bytes)) throw new Error('Staged inventory integrity failure.');
    expected.add(entry.path);
  }
  if (expected.size !== files.size || [...files.keys()].some(name => !expected.has(name))) throw new Error('Uninventoried staged file.');
  const root = hostConfig.joomlaDiscoveryRoots?.[0];
  if (hostConfig.joomlaDiscoveryRoots?.length !== 1 || root?.inventoryHash !== sha256(inventoryBytes) || root.immutable !== true || root.discover !== true) throw new Error('Staged control hash/immutable discovery differs.');
  if (adoptionPlan.module !== MODULE || adoptionPlan.key !== KEY || adoptionPlan.version !== inventory.version || adoptionPlan.base !== root.baseUrl) throw new Error('Staged identity differs.');
  planOptions({ version: inventory.version, base: root.baseUrl, output: 'tmp/highlights-adapt-validation' });
  const descriptor = parseJoomlaManifest(files.get(XML), { baseUrl: root.baseUrl, manifestPath: XML });
  validateAdoptionSchema(descriptor, { defaults: { title: '', layout: 'auto', items: [] }, settingsSchema: { version: 1, fields: { title: { type: 'string' }, layout: { type: 'enum', values: ['horizontal', 'vertical', 'auto'] }, items: { type: 'array' } } }, default: { name: KEY, settings: { title: '', layout: 'auto', items: [] }, render() {} } });
  if (descriptor.version !== inventory.version || descriptor.requiredFolders.length || descriptor.entryPointUrl !== `${root.baseUrl}/${ENTRY}` || JSON.stringify(descriptor.styles) !== JSON.stringify([`${root.baseUrl}/${CSS}`]) || JSON.stringify(descriptor.requiredFiles) !== JSON.stringify([ENTRY, CSS])) throw new Error('Staged manifest identity/closure differs.');
  if (JSON.stringify(inventory.moduleKeys) !== JSON.stringify({ [MODULE]: KEY }) || JSON.stringify(inventory.moduleStyles) !== JSON.stringify({ [KEY]: [CSS] }) || JSON.stringify(hostConfig.moduleStyles) !== JSON.stringify({ [KEY]: descriptor.styles }) || JSON.stringify(hostConfig.moduleStyleRevisions) !== JSON.stringify({ [KEY]: { [descriptor.entryPointUrl]: descriptor.styles } })) throw new Error('Staged selected module/style keys differ.');
  if (provenance.changes?.length !== 3 || new Set(provenance.changes.map(change => change.path)).size !== 3 || provenance.changes.some(change => !HIGHLIGHTS_ANCHORS[change.path]?.includes(change.originalSha256))) throw new Error('Unapproved adaptation provenance.');
  if (!ADAPTATION_GENERATOR_HASHES.includes(provenance.generatorSha256) || !/^[a-f0-9]{64}$/.test(provenance.adoptionApiSha256 ?? '')) throw new Error('Unapproved generator/API provenance.');
  for (const change of provenance.changes) {
    const bytes = files.get(change.path === HIGHLIGHTS_CSS_PATH ? CSS : `libraries/camap/${change.path}`);
    const raw = change.originalSha256 === HIGHLIGHTS_ANCHORS[change.path][0];
    if (change.modifiedSha256 !== (raw ? MODIFIED_RAW_HASHES[change.path] : GENERATED_HASHES[change.path]) || change.generatedSha256 !== GENERATED_HASHES[change.path] || !bytes || sha256(bytes) !== GENERATED_HASHES[change.path]) throw new Error('Packaged overlay differs from approved patch.');
  }
  if (sha256(files.get(CSS)) !== GENERATED_HASHES[HIGHLIGHTS_CSS_PATH]) throw new Error('Packaged CSS differs from approved selector-only patch.');
  if (!Array.isArray(provenance.snapshot) || provenance.snapshot.length > 500 || new Set(provenance.snapshot.map(entry => entry.path.toLowerCase())).size !== provenance.snapshot.length) throw new Error('Missing/invalid bounded snapshot provenance.');
  let snapshotBytes = 0;
  for (const entry of provenance.snapshot) {
    packagePath(entry.path);
    const allowed = entry.path === SHARED_SOURCE_PATH || ['tools/prepare-joomla-modules.js', 'package.json', ...ADAPTATION_LICENSE_NAMES].includes(entry.path) || ADOPTION_MODULES.some(({ folder }) => new RegExp(`^extensions/camap/${folder}/[^/]+\\.(js|css)$`).test(entry.path));
    if (!allowed || !/^[a-f0-9]{64}$/.test(entry.originalSha256) || !/^[a-f0-9]{64}$/.test(entry.snapshotSha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || (snapshotBytes += entry.bytes) > 10 * 1024 * 1024) throw new Error('Invalid bounded snapshot entry.');
  }
  const changed = provenance.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256);
  if (changed.length !== 3 || provenance.changes.some(change => !changed.some(entry => entry.path === change.path && entry.originalSha256 === change.originalSha256 && entry.snapshotSha256 === change.modifiedSha256))) throw new Error('Snapshot must record exactly the three approved patches.');
  const inherited = provenance.inheritedLicense;
  const mit = provenance.inheritedLicenseBytes;
  const changesLicenseSource = provenance.changesLicenseSource;
  const gpl = provenance.changesLicenseBytes;
  if (!inherited || !Buffer.isBuffer(mit) || !ADAPTATION_MIT_HASHES.includes(sha256(mit)) || inherited.sha256 !== sha256(mit) || inherited.license !== 'MIT' || inherited.originCommit !== ADAPTATION_ORIGIN_COMMIT || inherited.packagePath !== INHERITED_LICENSE_PATH || inherited.historicalLfSha256 !== ADAPTATION_MIT_HASHES[1] || inherited.globalVendorRightsApproved !== false || JSON.stringify(inherited.scope) !== JSON.stringify(SCOPE)) throw new Error('Missing/invalid scoped inherited MIT evidence.');
  if (!changesLicenseSource || !Buffer.isBuffer(gpl) || sha256(gpl) !== CHANGES_LICENSE_SHA256 || changesLicenseSource.sha256 !== CHANGES_LICENSE_SHA256 || changesLicenseSource.path !== CHANGES_LICENSE_PATH || changesLicenseSource.license !== 'GPL-2.0-or-later' || changesLicenseSource.scope !== 'authored adaptation changes only') throw new Error('Missing/invalid authored changes GPL evidence.');
  files.set(INHERITED_LICENSE_PATH, mit);
  files.set(CHANGES_LICENSE_PATH, gpl);
  for (const flag of FLAGS) adoptionPlan[flag] = false;
  adoptionPlan.licenses = [...provenance.licenses, INHERITED_LICENSE_PATH];
  adoptionPlan.sourceRootLicensePresent = provenance.licenses.length > 0;
  adoptionPlan.sourceLicensePresent = true;
  adoptionPlan.inheritedLicenseSource = inherited;
  adoptionPlan.changesLicenseSource = changesLicenseSource;
  adoptionPlan.adaptation = { format: 'minijoomla-highlights-adaptation-v1', revision: 1, provenance: 'ADAPTATION.json', changesLicense: 'GPL-2.0-or-later', vendorRightsCleared: false };
  adoptionPlan.nextGate = 'Independent rights review and coordinator lifecycle verification; no installation or publication approval.';
  const adaptation = { format: 'minijoomla-highlights-adaptation-v1', revision: 1, module: MODULE, version: inventory.version,
    originalSource: 'local CAMAP2 read-only bounded snapshot', changes: provenance.changes,
    generator: { path: 'tools/prepare-joomla-modules.js', sha256: provenance.generatorSha256, algorithmModified: false },
    adoptionApi: { path: 'scripts/prepare-module-adoption.js', sha256: provenance.adoptionApiSha256, byteIdenticalRelocation: true },
    snapshot: provenance.snapshot, originalLicenses: provenance.licenses, inheritedLicenseSource: inherited, changesLicense: 'GPL-2.0-or-later', changesLicenseSource,
    vendorLicenseAssigned: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])),
    schemaModified: false, cssModified: true, otherPackagesModified: false,
    policy: 'Existing strict URL policy reused; inert plain rows filtered at render time only. title/layout/items defaults and enum unchanged. auto uses supplied context width; omitted width means vertical. CSS maps .camap-dt1 selectors to .camap-highlights and appends a scoped direct-child h2 full-row rule; original declarations and media query retained.' };
  files.delete('MANIFEST-SHA256.json');
  files.delete('host-config.json');
  files.set('adoption-plan.json', json(adoptionPlan));
  files.set('ADAPTATION.json', json(adaptation));
  files.set('docs/ADAPTATION-NOTICE.md', Buffer.from('Local highlights adaptation, revision 1. Exactly three sources named in ADAPTATION.json are patched in a private snapshot: shared/render.js, highlights/module.js and highlights/highlights.css. Original XML title/layout/items fields and defaults, escapeHtml and stateMessage are unchanged. Invalid items are filtered only at render time; stored settings are never rewritten. auto depends on supplied context width (omitted width means vertical). CSS maps .camap-dt1 selectors to .camap-highlights and appends only .camap-highlights--horizontal>h2{grid-column:1/-1}, keeping the title out of article grid cells. Original declarations, two columns and the 700px media query are unchanged; no global/theme changes. No image/backend support is added. The helper change applies only to this new package, not prior pilot/editorial packages. Complete original MIT and authored-change GPL texts are retained verbatim at docs/licenses/CAMAP-ROOT-MIT.txt and docs/licenses/GPL-2.0.txt; hashes, introduction commit and limited scopes are recorded in ADAPTATION.json. GPL-2.0-or-later covers authored changes only, not all CAMAP. Independent rights and lifecycle review remain required. No browser, tenant, installation, publication or global vendor rights approval is implied.\n'));
  let total = 0;
  const seen = new Set();
  for (const [name, bytes] of files) {
    packagePath(name);
    if (!Buffer.isBuffer(bytes) || seen.has(name.toLowerCase()) || (total += bytes.length) > 10 * 1024 * 1024) throw new Error('Final file/byte contract exceeded.');
    seen.add(name.toLowerCase());
  }
  if (files.size + 2 > 500) throw new Error('Final file count exceeded.');
  inventory.files = [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  const finalInventoryBytes = json(inventory);
  if (finalInventoryBytes.length > 64 * 1024) throw new Error('Final inventory exceeds 64 KiB.');
  root.inventoryHash = sha256(finalInventoryBytes);
  files.set('MANIFEST-SHA256.json', finalInventoryBytes);
  files.set('host-config.json', json(hostConfig));
  return { files, inventory, hostConfig, adaptation, adoptionPlan, descriptor };
}

export async function prepareHighlightsAdaptation(input = {}) {
  const plan = planOptions(input);
  await assertNewAdaptationOutput(plan.destination);
  const [sources, dependencies, evidence] = await Promise.all([collectSources(plan.source), collectAdaptationDependencies(plan.dependencies), (async () => {
    const collected = createAdaptationCollector();
    for (const name of ADAPTATION_API_FILES) await collected.add(PROJECT, name);
    const gpl = await collected.add(PROJECT, CHANGES_LICENSE_PATH);
    if (sha256(gpl) !== CHANGES_LICENSE_SHA256) throw new Error('Authored GPL text differs from approved source hash.');
    const mit = await collected.add(dirname(plan.inheritedLicense), plan.inheritedLicense.slice(dirname(plan.inheritedLicense).length + 1));
    if (!ADAPTATION_MIT_HASHES.includes(sha256(mit)) || sha256(lf(mit)) !== ADAPTATION_MIT_HASHES[1]) throw new Error('Inherited MIT differs from approved provenance.');
    return { collected, mit, gpl };
  })()]);
  const check = () => Promise.all([sources.collected.check(), dependencies.check(), evidence.collected.check()]);
  // An explicit dependency override must be byte-identical to the approved
  // local offline closure, not arbitrary code with forged package versions.
  if (plan.dependencies !== resolve(PROJECT, 'tmp/step2/camap-source')) {
    const approved = await collectAdaptationDependencies(resolve(PROJECT, 'tmp/step2/camap-source'));
    if (dependencies.files.size !== approved.files.size || [...dependencies.files].some(([key, { bytes }]) => !approved.files.get(key)?.bytes.equals(bytes))) throw new Error('Dependency override differs from approved offline closure.');
    await approved.check();
  }
  await check();
  await assertAdoptionNoLinks(TMP, { allowMissing: true });
  await mkdir(TMP, { recursive: true });
  const stage = await mkdtemp(join(TMP, 'highlights-adapt-stage-'));
  await writeAdaptationFiles(stage, new Map([...evidence.collected.files.values()].filter(({ name }) => ADAPTATION_API_FILES.includes(name)).map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(stage, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const snapshot = join(stage, 'tmp', 'source');
  await writeAdaptationFiles(snapshot, new Map([...sources.collected.files.values()].map(({ name, bytes }) => [name, sources.overlay.files.get(name) ?? bytes])));
  const deps = join(stage, 'tmp', 'dependencies');
  await writeAdaptationFiles(deps, new Map([...dependencies.files.values()].map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(deps, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const adoption = await import(pathToFileURL(join(stage, 'scripts', 'prepare-module-adoption.js')).href);
  const prepared = await adoption.prepareModuleAdoption({ module: MODULE, version: plan.args.version, base: plan.args.base, sourceRoot: snapshot, dependenciesRoot: deps, output: 'tmp/prepared' });
  const provenance = { changes: sources.overlay.changes, licenses: sources.licenses,
    inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(evidence.mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: SCOPE, globalVendorRightsApproved: false,
      evidence: 'Exact local hashes compared with targeted Git blobs at originCommit; CRLF/CR to LF only, BOM retained.' },
    inheritedLicenseBytes: evidence.mit, changesLicenseBytes: evidence.gpl,
    changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' },
    generatorSha256: sha256(sources.collected.files.get('tools/prepare-joomla-modules.js').bytes),
    adoptionApiSha256: sha256(evidence.collected.files.get('scripts/prepare-module-adoption.js').bytes),
    snapshot: [...sources.collected.files.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')).map(({ name, bytes }) => ({ path: name, originalSha256: sha256(bytes), snapshotSha256: sha256(sources.overlay.files.get(name) ?? bytes), bytes: bytes.length })) };
  const finalized = finalizeHighlightsPackage(await readAdaptationFiles(prepared.output), provenance);
  await check();
  await assertAdoptionNoLinks(plan.destination, { allowMissing: true });
  await mkdir(dirname(plan.destination), { recursive: true });
  await assertNewAdaptationOutput(plan.destination);
  await mkdir(plan.destination);
  await writeAdaptationFiles(plan.destination, finalized.files);
  return { ...finalized, output: plan.destination, stage, snapshot, originalSourceFiles: sources.collected.files.size, dependencyFiles: dependencies.files.size };
}

export function parseHighlightsAdaptationArgs(argv = process.argv.slice(2)) {
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
    const args = parseHighlightsAdaptationArgs();
    if (args.help) console.log('Usage: node scripts/prepare-highlights-adaptation.js --base /offline/highlights/0.3.0 --output tmp/highlights-adapt-new [--version 0.3.0|0.3.1] [--module mod_camap_highlights] [--source tmp/original-copy] [--dependencies-root tmp/step2/camap-source] [--inherited-license tmp/approved-MIT.txt]. Explicit base required. Offline preparation only.');
    else {
      const result = await prepareHighlightsAdaptation(args);
      console.log(`Prepared highlights ${result.inventory.version}: ${result.inventory.files.length} inventoried payloads, ${result.files.size} total files, ${result.originalSourceFiles} source and ${result.dependencyFiles} dependency snapshot files. Three bounded patches only; rights/publication unapproved. Output: ${result.output}`);
    }
  } catch (error) { console.error(`prepare-highlights-adaptation: ${error.message}`); process.exitCode = 1; }
}
