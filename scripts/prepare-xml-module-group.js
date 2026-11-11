/* SPDX-License-Identifier: GPL-2.0-or-later
 * Authored offline grouping workflow only; no grant over input packages.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { normalizeExtensionsConfig } from '../src/libraries/minijoomla/application/joomla-host-config.js';
import { assertAdoptionNoLinks } from './prepare-module-adoption.js';
import { collectAdaptationDependencies } from './prepare-editorial-adaptation.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPROVED_DEPS = 'tmp/step2/camap-source';
export const XML_GROUP_LIMITS = Object.freeze({ minMembers: 2, maxMembers: 7, files: 500, bytes: 10 * 1024 * 1024, manifestBytes: 64 * 1024 });
export const XML_GROUP_LICENSE_PATH = 'docs/licenses/GPL-2.0.txt';
export const XML_GROUP_LICENSE_HASH = '189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b';
const CONTROL = ['MANIFEST-SHA256.json', 'host-config.json'];
const HEX = /^[a-f0-9]{64}$/;
const FLAGS = Object.freeze(Object.fromEntries(['publicationApproved', 'rightsApproved', 'privacyReviewed', 'globalVendorRightsApproved', 'vendorLicenseAssigned', 'installed', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified', 'inputsModified', 'schemaModified', 'javascriptModified', 'cssModified'].map(key => [key, false])));
export const xmlGroupHash = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const within = (a, b) => { const r = relative(a, b); return !isAbsolute(r) && r !== '..' && !r.startsWith(`..${sep}`); };
const overlap = (a, b) => within(a, b) || within(b, a);

/** Copy data descriptors only: never invoke getters/toJSON or execute inputs. */
function safeData(value, depth = 0, budget = { nodes: 0 }, preserveReserved = false) {
  if (depth > 32 || ++budget.nodes > 10000) throw new Error('JSON data structure exceeds limits.');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('Plain JSON data required.');
  const array = Array.isArray(value);
  if (!array && Object.getPrototypeOf(value) === Array.prototype) throw new Error('Plain JSON object required.');
  const copy = array ? [] : Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue;
    const prop = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !preserveReserved && ['__proto__', 'constructor', 'prototype'].includes(key) || !Object.hasOwn(prop, 'value') || !prop.enumerable || array && !/^(0|[1-9]\d*)$/.test(key)) throw new Error('Unsafe JSON property/accessor refused.');
    Object.defineProperty(copy, key, { value: safeData(prop.value, depth + 1, budget, preserveReserved), enumerable: true, writable: true, configurable: true });
  }
  if (array && (copy.length !== value.length || Object.keys(copy).length !== value.length)) throw new Error('Sparse JSON array refused.');
  return copy;
}
function text(bytes, name) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error(`Invalid UTF-8: ${name}`); }
}
function metadata(bytes, name, preserveUnknown = false) {
  if (!Buffer.isBuffer(bytes) || bytes.length > XML_GROUP_LIMITS.manifestBytes) throw new Error(`Missing/oversized control: ${name}`);
  return safeData(JSON.parse(text(bytes, name)), 0, { nodes: 0 }, preserveUnknown);
}
function exactKeys(object, keys, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(object, key))) throw new Error(`Unexpected/missing ${label} fields.`);
}
function pathName(name) {
  packagePath(name);
  if (name.length > 240 || name.split('/').some(part => part.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe Windows package path.');
  return name;
}
function tmpPath(name) {
  pathName(name);
  if (!name.startsWith('tmp/')) throw new Error('Explicit relative path under this worktree tmp/ required.');
  return resolve(PROJECT, name);
}
function versionToken(value) {
  if (typeof value !== 'string' || value.length > 40 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('Version must be X.Y.Z without leading zeros.');
}
function baseToken(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.endsWith('/')) throw new Error('Explicit canonical server-relative base required.');
  pathName(value.slice(1));
}
export function validateXmlGroupPlan(input) {
  const plan = safeData(input);
  exactKeys(plan, ['format', 'base', 'groupId', 'version', 'packages'], 'group plan');
  if (plan.format !== 'minijoomla-xml-module-group-plan-v1') throw new Error('Unknown group plan format.');
  baseToken(plan.base); versionToken(plan.version);
  if (typeof plan.groupId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(plan.groupId)) throw new Error('groupId must be an ASCII root-id token.');
  if (!Array.isArray(plan.packages) || plan.packages.length < 2 || plan.packages.length > 7) throw new Error('Select explicitly 2..7 prepared packages.');
  const paths = [], names = new Set(), keys = new Set();
  for (const ref of plan.packages) {
    exactKeys(ref, ['path', 'inventoryHash', 'module', 'key', 'version', 'libraryPrefix', 'sharedPaths'], 'package reference');
    const path = tmpPath(ref.path);
    if (paths.some(prior => overlap(prior.toLowerCase(), path.toLowerCase()))) throw new Error('Duplicate/overlapping input directories.');
    paths.push(path);
    if (!HEX.test(ref.inventoryHash)) throw new Error('Approved inventoryHash pin required.');
    versionToken(ref.version);
    if (typeof ref.module !== 'string' || !/^mod_[a-z0-9_]+$/.test(ref.module) || typeof ref.key !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(ref.key) || ['constructor', 'prototype', '__proto__'].includes(ref.key)) throw new Error('Invalid module/key identity.');
    if (names.has(ref.module.toLowerCase()) || keys.has(ref.key.toLowerCase())) throw new Error('Duplicate module/key identity.');
    names.add(ref.module.toLowerCase()); keys.add(ref.key.toLowerCase());
    if (typeof ref.libraryPrefix !== 'string' || !ref.libraryPrefix.endsWith('/')) throw new Error('Explicit module libraryPrefix required.');
    pathName(ref.libraryPrefix.slice(0, -1));
    if (!ref.libraryPrefix.startsWith('libraries/') || !ref.libraryPrefix.endsWith(`/${ref.module}/`) || ref.libraryPrefix.split('/').length < 4) throw new Error('Library prefix must be scoped to the selected module.');
    if (!Array.isArray(ref.sharedPaths) || ref.sharedPaths.length > 20 || new Set(ref.sharedPaths.map(name => typeof name === 'string' ? name.toLowerCase() : name)).size !== ref.sharedPaths.length) throw new Error('Unique exact shared paths required.');
    const sharedPrefix = `${posix.dirname(ref.libraryPrefix.slice(0, -1))}/_shared/`;
    for (const name of ref.sharedPaths) {
      pathName(name);
      if (!name.startsWith(sharedPrefix) || !/\.m?js$/.test(name)) throw new Error('Shared allowlist accepts exact sibling _shared JS files only.');
    }
  }
  return plan;
}
function validateFiles(files) {
  if (!(files instanceof Map) || !files.size || files.size > XML_GROUP_LIMITS.files) throw new Error('Package requires 1..500 total files.');
  const names = new Map(), directories = new Map(); let total = 0;
  for (const [name, bytes] of files) {
    pathName(name);
    if (names.has(name.toLowerCase())) throw new Error(`Case-colliding path: ${name}`);
    names.set(name.toLowerCase(), name);
    for (let parent = posix.dirname(name); parent !== '.'; parent = posix.dirname(parent)) {
      const previous = directories.get(parent.toLowerCase());
      if (previous && previous !== parent) throw new Error(`Case-colliding directory: ${parent}`);
      directories.set(parent.toLowerCase(), parent);
    }
    if (!Buffer.isBuffer(bytes) || (total += bytes.length) > XML_GROUP_LIMITS.bytes) throw new Error('Package exceeds 10 MiB.');
  }
  for (const name of names.keys()) for (let parent = posix.dirname(name); parent !== '.'; parent = posix.dirname(parent)) if (names.has(parent)) throw new Error('File/directory path collision.');
}
export function xmlGroupDescriptorMetadata(descriptor) {
  return safeData({ key: descriptor.key, element: descriptor.element, identity: descriptor.identity, version: descriptor.version, params: descriptor.params, requiredFiles: descriptor.requiredFiles, requiredFolders: descriptor.requiredFolders,
    entryPointUrl: descriptor.entryPointUrl, styles: descriptor.styles });
}
function docPath(name) {
  return (name.startsWith('docs/') && !/\.(?:m?js|css|xml|php|sql)$/i.test(name)) || ['adoption-plan.json', 'ADAPTATION.json'].includes(name) || /^(LICENSE|COPYING|NOTICE)(?:\.(?:md|txt))?$/.test(name);
}
function allowedRuntime(ref, name) {
  return [`modules/${ref.module}/`, `media/${ref.module}/`, ref.libraryPrefix].some(prefix => name.startsWith(prefix)) || ref.sharedPaths.includes(name);
}
function validateMember(ref, member, parseImports, validateCss) {
  if (!member || !(member.files instanceof Map)) throw new Error('Member requires files Map and trusted descriptor metadata.');
  validateFiles(member.files);
  const files = new Map([...member.files].map(([name, bytes]) => [name, Buffer.isBuffer(bytes) ? Buffer.from(bytes) : bytes]));
  validateFiles(files);
  const rawInventory = files.get(CONTROL[0]);
  if (!Buffer.isBuffer(rawInventory) || xmlGroupHash(rawInventory) !== ref.inventoryHash) throw new Error('Input inventory differs from explicitly approved pin.');
  const inventory = metadata(rawInventory, CONTROL[0]);
  if (inventory.format !== 'minijoomla-joomla-package-v1' || inventory.version !== ref.version || !Array.isArray(inventory.files) || !inventory.files.length || inventory.files.length > 500) throw new Error('Unknown/incomplete input inventory format/version.');
  const expected = new Set(CONTROL), folded = new Set(CONTROL.map(name => name.toLowerCase()));
  for (const file of inventory.files) {
    exactKeys(file, ['path', 'bytes', 'sha256'], 'inventory entry'); pathName(file.path);
    const bytes = files.get(file.path);
    if (folded.has(file.path.toLowerCase()) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !HEX.test(file.sha256) || !Buffer.isBuffer(bytes) || bytes.length !== file.bytes || xmlGroupHash(bytes) !== file.sha256) throw new Error(`Input inventory integrity failure: ${file.path}`);
    expected.add(file.path); folded.add(file.path.toLowerCase());
  }
  if (files.size !== expected.size || [...files.keys()].some(name => !expected.has(name))) throw new Error('Extra/uninventoried input file.');
  const host = metadata(files.get(CONTROL[1]), CONTROL[1]);
  exactKeys(host, ['joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions'], 'host config');
  const normalized = normalizeExtensionsConfig(host, { webUrl: '/' });
  const root = host.joomlaDiscoveryRoots?.[0];
  if (normalized.joomlaDiscoveryRoots.length !== 1 || root.inventoryHash !== ref.inventoryHash || root.immutable !== true || root.discover !== true) throw new Error('Input host control pin/immutable/discovery mismatch.');
  const inputBase = root.baseUrl.replace(/\/$/, ''); baseToken(inputBase);
  const manifestPath = `modules/${ref.module}/${ref.module}.xml`;
  if (!files.has(manifestPath)) throw new Error('Missing selected XML.');
  const descriptor = parseJoomlaManifest(files.get(manifestPath), { baseUrl: inputBase, manifestPath });
  if (descriptor.element !== ref.module || descriptor.key !== ref.key || descriptor.version !== ref.version || descriptor.requiredFolders.length) throw new Error('XML identity/version or incomplete folder declaration differs.');
  if (!equal(xmlGroupDescriptorMetadata(descriptor), safeData(member.descriptor))) throw new Error('Trusted descriptor/defaults contract differs from input XML.');
  const styles = descriptor.styles.map(url => url.slice(inputBase.length + 1));
  if (!equal(inventory.moduleKeys, { [ref.module]: ref.key }) || !equal(inventory.moduleStyles, { [ref.key]: styles }) || !equal(host.moduleStyles, { [ref.key]: [...descriptor.styles] }) || !equal(host.moduleStyleRevisions, { [ref.key]: { [descriptor.entryPointUrl]: [...descriptor.styles] } })) throw new Error('Input module maps/CSS order or revision binding differs.');
  const adoption = metadata(files.get('adoption-plan.json'), 'adoption-plan.json', true);
  if (adoption.format !== 'minijoomla-module-adoption-v1' || adoption.profile !== 'joomla-xml-v1' || adoption.module !== ref.module || adoption.key !== ref.key || adoption.version !== ref.version || typeof adoption.base !== 'string' || adoption.base.replace(/\/$/, '') !== inputBase) throw new Error('Input adoption control identity/version/base differs.');
  if (files.has('ADAPTATION.json')) {
    const adaptation = metadata(files.get('ADAPTATION.json'), 'ADAPTATION.json', true);
    if (typeof adaptation.format !== 'string' || !/^minijoomla-[a-z0-9-]+-adaptation-v1$/.test(adaptation.format) || adaptation.module !== ref.module || adaptation.version !== ref.version) throw new Error('Unknown/mismatched adaptation control format/identity.');
  }
  const queue = [manifestPath, ...descriptor.requiredFiles], graph = new Map();
  for (let index = 0; index < queue.length; index++) {
    const name = pathName(queue[index]);
    if (!allowedRuntime(ref, name) || docPath(name) || CONTROL.includes(name)) throw new Error(`Dependency outside selected module allowlist: ${name}`);
    if (name !== manifestPath && !/\.(?:m?js|css)$/.test(name)) throw new Error(`Unknown runtime/manifest format: ${name}`);
    if (graph.has(name)) continue;
    const bytes = files.get(name);
    if (!bytes) throw new Error(`Missing dependency: ${name}`);
    if (/\.xml$/i.test(name) && name !== manifestPath) throw new Error('Unknown additional XML manifest format.');
    graph.set(name, bytes);
    if (/\.m?js$/.test(name)) {
      const imports = parseImports(text(bytes, name), name);
      if (!Array.isArray(imports)) throw new Error('JavaScript parser must return an import record array.');
      for (const item of imports) {
        if (!item || !Number.isInteger(item.d) || item.d >= 0 && typeof item.n !== 'string') throw new Error('Non-literal dynamic import refused.');
        if (item.n == null) continue; // import.meta, not a dependency
        const specifier = item.n;
        if (typeof specifier !== 'string' || !/^(?:\.\/|\.\.\/)/.test(specifier) || /[\\%?#\x00-\x20\x7f]/.test(specifier) || specifier.split('/').some(part => !part)) throw new Error('Bare/absolute/escaped import refused.');
        const target = posix.normalize(posix.join(posix.dirname(name), specifier));
        pathName(target); queue.push(target);
      }
    } else if (name.endsWith('.css')) validateCss(text(bytes, name), name);
  }
  const docs = new Map();
  for (const [name, bytes] of files) {
    if (CONTROL.includes(name) || graph.has(name)) continue;
    if (!docPath(name)) throw new Error(`Unhandled source payload/manifest outside closed graph: ${name}`);
    // Data is inspected safely, but original plan/adaptation bytes are preserved.
    if (['adoption-plan.json', 'ADAPTATION.json'].includes(name)) metadata(bytes, name, true);
    docs.set(name, bytes);
  }
  return { files, graph, docs, descriptor, rootId: root.id };
}

/** Pure engine. The caller supplies trusted parser ports, metadata and GPL bytes.
 * Packaged JavaScript is parsed, never imported, rendered or evaluated. */
export function buildXmlModuleGroup({ plan: input, packages, parseImports, validateCss, licenseBytes } = {}) {
  const plan = validateXmlGroupPlan(input);
  if (typeof parseImports !== 'function' || typeof validateCss !== 'function') throw new Error('Real JavaScript/CSS parser ports are required; no fallback.');
  if (!(packages instanceof Map) || packages.size !== plan.packages.length || [...packages.keys()].some(name => !plan.packages.some(ref => ref.path === name))) throw new Error('Explicit package Maps must exactly match plan selection.');
  if (!Buffer.isBuffer(licenseBytes) || xmlGroupHash(licenseBytes) !== XML_GROUP_LICENSE_HASH) throw new Error('Own workflow requires unchanged full GPL text.');
  const members = plan.packages.map(ref => ({ ref, ...validateMember(ref, packages.get(ref.path), parseImports, validateCss) }));
  // Never allow a shared allowlist to mask another module's namespace.
  for (const a of members) for (const b of members) if (a !== b && [...a.graph.keys()].some(name => allowedRuntime(b.ref, name) && !a.ref.sharedPaths.includes(name))) throw new Error('Module runtime namespaces overlap.');
  const files = new Map(), folded = new Map(), descriptors = [], mappings = [];
  function add(name, bytes, shared = false) {
    pathName(name);
    const prior = folded.get(name.toLowerCase());
    if (prior && prior !== name) throw new Error(`Group case collision: ${name}`);
    if (files.has(name)) {
      if (!shared || !files.get(name).equals(bytes)) throw new Error(`Divergent/overlapping shared path: ${name}; no helper is chosen.`);
    } else { files.set(name, Buffer.from(bytes)); folded.set(name.toLowerCase(), name); }
  }
  const moduleKeys = {}, moduleStyles = {}, hostStyles = {}, revisions = {};
  for (const member of members) {
    const mapping = [];
    for (const [name, bytes] of member.graph) { add(name, bytes, member.ref.sharedPaths.includes(name)); mapping.push({ original: name, grouped: name, sha256: xmlGroupHash(bytes) }); }
    for (const [name, bytes] of member.docs) {
      const target = `docs/group-members/${member.ref.module}/${name}`;
      add(target, bytes); mapping.push({ original: name, grouped: target, sha256: xmlGroupHash(bytes) });
    }
    const manifestPath = `modules/${member.ref.module}/${member.ref.module}.xml`;
    const descriptor = parseJoomlaManifest(files.get(manifestPath), { baseUrl: plan.base, manifestPath });
    if (!equal(descriptor.params, member.descriptor.params) || descriptor.identity !== member.descriptor.identity || descriptor.version !== member.descriptor.version) throw new Error('Rebase changed original XML/defaults contract.');
    descriptors.push(descriptor);
    moduleKeys[descriptor.element] = descriptor.key;
    moduleStyles[descriptor.key] = descriptor.styles.map(url => url.slice(plan.base.length + 1));
    hostStyles[descriptor.key] = [...descriptor.styles];
    revisions[descriptor.key] = { [descriptor.entryPointUrl]: [...descriptor.styles] };
    mappings.push({ package: member.ref.path, inventoryHash: member.ref.inventoryHash, originalRootId: member.rootId, module: member.ref.module, key: member.ref.key, version: member.ref.version,
      controlsReplaced: [...CONTROL], mapping: mapping.sort((a, b) => a.original.localeCompare(b.original, 'en')), rightsEvidence: mapping.filter(item => docPath(item.original)).map(item => item.grouped), ...FLAGS });
  }
  add(XML_GROUP_LICENSE_PATH, licenseBytes);
  const provenance = { format: 'minijoomla-xml-module-group-v1', groupId: plan.groupId, version: plan.version, members: mappings,
    workflowLicense: { path: XML_GROUP_LICENSE_PATH, sha256: XML_GROUP_LICENSE_HASH, license: 'GPL-2.0-or-later', scope: 'authored grouping workflow and OWN proof modules only; no input rights grant' }, ...FLAGS };
  add('GROUP-PROVENANCE.json', jsonBytes(provenance));
  validateFiles(files);
  if (files.size + 2 > 500) throw new Error('Group exceeds 500 total files including controls.');
  const inventory = { format: 'minijoomla-joomla-package-v1', version: plan.version, files: [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: xmlGroupHash(bytes) })), moduleKeys, moduleStyles };
  const inventoryBytes = jsonBytes(inventory);
  if (inventoryBytes.length > XML_GROUP_LIMITS.manifestBytes) throw new Error('Group inventory exceeds 64 KiB.');
  const hostConfig = { joomlaDiscoveryRoots: [{ id: plan.groupId, baseUrl: plan.base, inventoryHash: xmlGroupHash(inventoryBytes), immutable: true, discover: true }], moduleStyles: hostStyles, moduleStyleRevisions: revisions };
  normalizeExtensionsConfig(hostConfig, { webUrl: '/' });
  files.set(CONTROL[0], inventoryBytes); files.set(CONTROL[1], jsonBytes(hostConfig)); validateFiles(files);
  return { files, inventory, hostConfig, provenance, descriptors };
}

/** Execute only a new, exact copy of the approved CJS closure. Extras in the
 * dependency input (e.g. extensionless require shadows) never enter resolution.
 * This loader writes its own temporary stage, not inputs or group artifacts. */
export async function loadXmlGroupParserPorts(deps) {
  if (!deps) throw Object.assign(new Error('Explicit --deps required: approved offline real parsers unavailable; no fallback/install.'), { code: 'XML_GROUP_DEPENDENCY_MISSING' });
  const root = tmpPath(deps), approvedRoot = tmpPath(APPROVED_DEPS);
  const collected = await collectAdaptationDependencies(root);
  const approved = root === approvedRoot ? collected : await collectAdaptationDependencies(approvedRoot);
  if (collected.files.size !== approved.files.size || [...collected.files].some(([key, { bytes }]) => !approved.files.get(key)?.bytes.equals(bytes))) throw new Error('Parser dependency bytes differ from approved offline closure.');
  for (const name of ['es-module-lexer', 'css-tree', 'mdn-data', 'source-map-js']) {
    const nested = join(root, 'node_modules', name, 'node_modules');
    await assertAdoptionNoLinks(nested, { allowMissing: true });
    try { await lstat(nested); throw new Error('Nested dependency node_modules refused.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await collected.check(); await approved.check();
  const stageFiles = new Map([...collected.files.values()].map(({ name, bytes }) => [name, Buffer.from(bytes)]));
  stageFiles.set('package.json', jsonBytes({ private: true, type: 'commonjs' }));
  validateFiles(stageFiles);
  await assertAdoptionNoLinks(join(PROJECT, 'tmp'));
  const parserStage = await mkdtemp(join(PROJECT, 'tmp/xml-group-parser-stage-'));
  for (const [name, bytes] of stageFiles) {
    const path = join(parserStage, ...name.split('/')); await assertAdoptionNoLinks(path, { allowMissing: true });
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: 'wx' });
  }
  const staged = await snapshot(parserStage);
  const checkStage = async () => {
    const current = await snapshot(parserStage);
    if (current.files.size !== stageFiles.size || [...stageFiles].some(([name, bytes]) => !current.files.get(name)?.equals(bytes)) || !equal([...current.directories], [...staged.directories])) throw new Error('Isolated parser closure changed/contains extra files.');
  };
  await checkStage(); await collected.check(); await approved.check();
  // Known fixed entrypoints and their complete approved transitive dependencies
  // are all present in this fresh node_modules. No caller directory is executed.
  const require = createRequire(join(parserStage, 'package.json'));
  const lexer = require(join(parserStage, 'node_modules/es-module-lexer/dist/lexer.cjs'));
  const css = require(join(parserStage, 'node_modules/css-tree/cjs/index.cjs'));
  await lexer.init;
  await checkStage();
  return { parseImports: (source, name) => lexer.parse(source, name)[0], validateCss: (source, name) => {
    const ast = css.parse(source, { filename: name, positions: true, onParseError(error) { throw error; } });
    css.walk(ast, node => { if (node.type === 'Raw' || node.type === 'Url' || node.type === 'Atrule' && node.name.toLowerCase() === 'import') throw new Error(`CSS raw/url()/@import refused: ${name}`); });
  }, parserStage, dependencyFiles: collected.files.size, check: async () => { await collected.check(); await approved.check(); await checkStage(); } };
}
async function snapshot(root) {
  await assertAdoptionNoLinks(root);
  const files = new Map(), directories = new Map(); let total = 0, entries = 0;
  async function walk(directory, prefix = '') {
    await assertAdoptionNoLinks(directory);
    const children = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    if ((entries += children.length) > 1000) throw new Error('Input directory structure exceeds bounds.');
    const folded = new Set(); directories.set(prefix, children.map(child => child.name).sort());
    for (const child of children) {
      const name = `${prefix}${child.name}`; pathName(name);
      if (folded.has(child.name.toLowerCase())) throw new Error('Case-colliding directory entry.'); folded.add(child.name.toLowerCase());
      const path = join(directory, child.name); await assertAdoptionNoLinks(path);
      const stat = await lstat(path);
      if (stat.isDirectory()) { await walk(path, `${name}/`); continue; }
      if (!stat.isFile() || files.size >= 500 || stat.size > XML_GROUP_LIMITS.bytes || (total += stat.size) > XML_GROUP_LIMITS.bytes || CONTROL.includes(name) && stat.size > 64 * 1024) throw new Error('Input file/type/byte limit exceeded.');
      const bytes = await readFile(path);
      if (bytes.length !== stat.size) throw new Error('Input changed during snapshot.'); files.set(name, bytes);
    }
  }
  await walk(root); validateFiles(files);
  return { files, directories };
}
async function newOutput(path) {
  await assertAdoptionNoLinks(path, { allowMissing: true });
  try { await lstat(path); throw new Error('Refusing existing output; no overwrite.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function outputPath(output) {
  const destination = tmpPath(output);
  if (!/^tmp\/xml-group-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(output)) throw new Error('Output must be a new tmp/xml-group-* directory.');
  return destination;
}
export async function prepareXmlModuleGroup({ plan: planPath, output, deps } = {}) {
  const sourcePlan = tmpPath(planPath), destination = outputPath(output);
  if (!planPath.endsWith('.json') || overlap(sourcePlan, destination)) throw new Error('Plan must be isolated tmp/*.json.');
  await newOutput(destination); await assertAdoptionNoLinks(sourcePlan);
  const planStat = await lstat(sourcePlan);
  if (!planStat.isFile() || planStat.size > 64 * 1024) throw new Error('Plan exceeds 64 KiB/is not a regular file.');
  const planBytes = await readFile(sourcePlan), plan = validateXmlGroupPlan(metadata(planBytes, 'plan'));
  const inputs = plan.packages.map(ref => tmpPath(ref.path));
  if (inputs.some(root => overlap(root, destination) || overlap(root, sourcePlan)) || deps && (overlap(tmpPath(deps), destination) || inputs.some(root => overlap(tmpPath(deps), root)))) throw new Error('Input/plan/dependency/output paths overlap.');
  const ports = await loadXmlGroupParserPorts(deps); // absent/unapproved deps fail before writes; approved parsers use a private stage
  const packages = new Map(), snapshots = [];
  for (const ref of plan.packages) {
    const root = tmpPath(ref.path), saved = await snapshot(root);
    const host = metadata(saved.files.get(CONTROL[1]), CONTROL[1]);
    const manifestPath = `modules/${ref.module}/${ref.module}.xml`;
    const descriptor = parseJoomlaManifest(saved.files.get(manifestPath), { baseUrl: host.joomlaDiscoveryRoots?.[0]?.baseUrl, manifestPath });
    packages.set(ref.path, { files: saved.files, descriptor: xmlGroupDescriptorMetadata(descriptor) }); snapshots.push({ root, saved });
  }
  const licensePath = join(PROJECT, XML_GROUP_LICENSE_PATH); await assertAdoptionNoLinks(licensePath);
  const licenseBytes = await readFile(licensePath);
  const result = buildXmlModuleGroup({ plan, packages, ...ports, licenseBytes });
  for (const { root, saved } of snapshots) {
    const current = await snapshot(root);
    if (!equal([...current.directories], [...saved.directories]) || current.files.size !== saved.files.size || [...saved.files].some(([name, bytes]) => !current.files.get(name)?.equals(bytes))) throw new Error('Input changed before grouping; retry after stabilization.');
  }
  await assertAdoptionNoLinks(sourcePlan);
  if (!(await readFile(sourcePlan)).equals(planBytes) || !(await readFile(licensePath)).equals(licenseBytes)) throw new Error('Plan/license changed before grouping.');
  await ports.check(); await newOutput(destination);
  await mkdir(dirname(destination), { recursive: true }); await assertAdoptionNoLinks(destination, { allowMissing: true });
  await mkdir(destination); // exclusive reservation; never recursive/overwrite
  // host-config is last: partial failure is not a successfully prepared root.
  for (const [name, bytes] of result.files) {
    const path = join(destination, ...name.split('/')); await assertAdoptionNoLinks(path, { allowMissing: true });
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: 'wx' });
  }
  return { ...result, output: destination };
}
export function parseXmlModuleGroupArgs(argv = process.argv.slice(2)) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { help: true };
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!['--plan', '--output', '--deps'].includes(flag) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(args, flag.slice(2))) throw new Error('Unknown/duplicate/missing CLI option.');
    args[flag.slice(2)] = argv[i + 1];
  }
  tmpPath(args.plan); outputPath(args.output); if (args.deps) tmpPath(args.deps);
  return args;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseXmlModuleGroupArgs();
    if (args.help) console.log('Usage: node scripts/prepare-xml-module-group.js --plan tmp/explicit-plan.json --output tmp/xml-group-new --deps tmp/step2/camap-source. Plan requires base/groupId/version and 2..7 exact pinned inputs. No install/network/publish.');
    else { const result = await prepareXmlModuleGroup(args); console.log(`Prepared ${result.descriptors.length} XML modules; ${result.files.size} files; inventory ${xmlGroupHash(result.files.get(CONTROL[0]))}; ${result.output}. Not installed or rights/publication/privacy approved.`); }
  } catch (error) { console.error(`prepare-xml-module-group: ${error.message}`); process.exitCode = 1; }
}
