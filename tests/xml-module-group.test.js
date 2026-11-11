/* SPDX-License-Identifier: GPL-2.0-or-later. OWN synthetic proof only. */
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildXmlModuleGroup, prepareXmlModuleGroup, parseXmlModuleGroupArgs, validateXmlGroupPlan, xmlGroupDescriptorMetadata, xmlGroupHash, XML_GROUP_LICENSE_PATH, XML_GROUP_LIMITS, loadXmlGroupParserPorts } from '../scripts/prepare-xml-module-group.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';
import { mergeExtensionsConfigs, normalizeExtensionsConfig } from '../src/libraries/minijoomla/application/joomla-host-config.js';
import { assertJoomlaPackageAssets } from '../src/libraries/minijoomla/application/joomla-package-assets.js';
import { assertAdoptionNoLinks, validateAdoptionSchema } from '../scripts/prepare-module-adoption.js';
import { createExtensionLoader } from '../src/libraries/minijoomla/modules/dynamic-modules.js';
import { createModuleRegistry } from '../src/libraries/minijoomla/modules/registry.js';
import { collectAdaptationDependencies } from '../scripts/prepare-editorial-adaptation.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = value => Buffer.from(typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
const CONTROL = ['MANIFEST-SHA256.json', 'host-config.json'];
const base = '/sites/example/input';

/** Authored OWN fixtures. No package code is executed by the grouping engine.
 * Explicit parser-result doubles below are test ports, not regex parsers. */
export function createXmlGroupProofPackages({ version = '0.1.0' } = {}) {
  const packages = new Map(), refs = [], importResults = new Map(), cssTexts = new Set();
  for (const suffix of ['alpha', 'beta']) {
    const module = `mod_capacity_${suffix}`, key = `capacity.${module}`;
    const libraryPrefix = `libraries/capacity/extensions/capacity/${module}/`;
    const shared = 'libraries/capacity/extensions/capacity/_shared/render.js';
    const entry = `modules/${module}/${module}.js`, xml = `modules/${module}/${module}.xml`;
    const styles = [`media/${module}/css/base.css`, `media/${module}/css/override.css`];
    const wrapper = `export { default } from '../../${libraryPrefix}module.js';\nexport * from '../../${libraryPrefix}module.js';\n`;
    const runtime = `/* GPT original OWN capacity proof, GPL-2.0-or-later. */\nimport { escapeHtml } from './helper.js';\nexport const defaults = { title: '', limit: 3, enabled: false };\nexport const settingsSchema = { version: 1, fields: { title: { type: 'string' }, limit: { type: 'number', min: 1, max: 5 }, enabled: { type: 'boolean' } } };\nexport default { name: '${key}', settings: defaults, settingsSchema, render({ settings = defaults } = {}) { return '<section class="capacity-${suffix}"><h2>' + escapeHtml(settings.title) + '</h2></section>'; } };\n`;
    const helper = "export { escapeHtml } from '../_shared/render.js';\n";
    const sharedCode = `/* GPT original OWN shared helper, GPL-2.0-or-later. */\nexport function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }\n`;
    const xmlText = `<?xml version="1.0" encoding="utf-8"?>\n<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="${key}">\n<name>OWN capacity ${suffix}</name><version>${version}</version><files><filename module="${module}">${module}.js</filename></files>\n<media destination="${module}" folder="media"><filename>css/base.css</filename><filename>css/override.css</filename></media>\n<config><fields name="params"><fieldset name="basic"><field name="title" type="text" default="" /><field name="limit" type="number" min="1" max="5" default="3" /><field name="enabled" type="radio" default="0"><option value="1">Yes</option><option value="0">No</option></field></fieldset></fields></config></extension>\n`;
    const css = [`.capacity-${suffix} { color: black; }\n`, `.capacity-${suffix} > h2 { font-weight: bold; }\n`];
    const files = new Map([[xml, data(xmlText)], [entry, data(wrapper)], [`${libraryPrefix}module.js`, data(runtime)], [`${libraryPrefix}helper.js`, data(helper)], [shared, data(sharedCode)], ...styles.map((name, i) => [name, data(css[i])]),
      ['LICENSE', data(`GPT original OWN ${suffix} proof code: GPL-2.0-or-later. Full text supplied by the grouping workflow; this label is not a third-party grant.\r\n`)],
      ['docs/ADOPTION-NOTICE.md', data(`OWN synthetic ${suffix}, not installed, no data or external services.\r\n`)],
      ['docs/EXTRA-NOTICE.txt', data(`Registered OWN additional notice ${suffix}.\n`)],
      ['adoption-plan.json', data({ format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module, key, version, base, rightsApproved: true, privacyReviewed: true, ownProof: 'GPT original OWN synthetic proof; input claims do not grant group approval', untouchedUnknown: { keep: ['exact', 1] } })],
      ['ADAPTATION.json', data({ format: 'minijoomla-own-proof-adaptation-v1', module, version, scope: 'OWN proof only', rightsApproved: true, untouchedUnknown: 'retain bytes' })]]);
    importResults.set(wrapper, [{ n: `../../${libraryPrefix}module.js`, d: -1 }, { n: `../../${libraryPrefix}module.js`, d: -1 }]);
    importResults.set(runtime, [{ n: './helper.js', d: -1 }]); importResults.set(helper, [{ n: '../_shared/render.js', d: -1 }]); importResults.set(sharedCode, []);
    css.forEach(value => cssTexts.add(value));
    const inventory = { format: 'minijoomla-joomla-package-v1', version, files: [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: xmlGroupHash(bytes) })), moduleKeys: { [module]: key }, moduleStyles: { [key]: styles } };
    const inventoryBytes = data(inventory), inventoryHash = xmlGroupHash(inventoryBytes);
    const descriptor = parseJoomlaManifest(files.get(xml), { baseUrl: base, manifestPath: xml });
    files.set(CONTROL[0], inventoryBytes); files.set(CONTROL[1], data({ joomlaDiscoveryRoots: [{ id: `capacity-${suffix}-${version}`, baseUrl: base, inventoryHash, immutable: true, discover: true }], moduleStyles: { [key]: descriptor.styles }, moduleStyleRevisions: { [key]: { [descriptor.entryPointUrl]: descriptor.styles } } }));
    const path = `tmp/xml-group-agent-fixture-${version}/${suffix}`;
    refs.push({ path, inventoryHash, module, key, version, libraryPrefix, sharedPaths: [shared] }); packages.set(path, { files, descriptor: xmlGroupDescriptorMetadata(descriptor) });
  }
  function explicitImportRecordDouble(source) { assert.ok(importResults.has(source), 'Explicit known parser-result fixture only'); return importResults.get(source); }
  function explicitCssAcceptanceDouble(source) { assert.ok(cssTexts.has(source), 'Explicit known CSS parser acceptance fixture only'); }
  return { packages, plan: { format: 'minijoomla-xml-module-group-plan-v1', base: `/sites/example/group/${version}`, groupId: `capacity-group-${version}`, version, packages: refs }, parseImports: explicitImportRecordDouble, validateCss: explicitCssAcceptanceDouble };
}
function cloneFixture(f) {
  return { ...f, plan: structuredClone(f.plan), packages: new Map([...f.packages].map(([name, member]) => [name, { files: new Map([...member.files].map(([path, bytes]) => [path, Buffer.from(bytes)])), descriptor: structuredClone(member.descriptor) }])) };
}
function repin(f, index = 0, editInventory = () => {}) {
  const ref = f.plan.packages[index], member = f.packages.get(ref.path);
  const inventory = JSON.parse(member.files.get(CONTROL[0]));
  inventory.files = [...member.files].filter(([name]) => !CONTROL.includes(name)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: xmlGroupHash(bytes) }));
  editInventory(inventory); const bytes = data(inventory); ref.inventoryHash = xmlGroupHash(bytes); member.files.set(CONTROL[0], bytes);
  const host = JSON.parse(member.files.get(CONTROL[1])); host.joomlaDiscoveryRoots[0].inventoryHash = ref.inventoryHash; member.files.set(CONTROL[1], data(host));
}
function port(files) {
  return { listFolders: async ({ folderPath }) => ({ value: folderPath === 'modules' ? [...new Set([...files.keys()].filter(name => name.startsWith('modules/')).map(name => name.split('/')[1]))].map(Name => ({ Name })) : [] }), downloadFile: async ({ folderPath, fileName }) => {
    const bytes = files.get(folderPath ? `${folderPath}/${fileName}` : fileName); if (!bytes) throw new Error('Fixture file absent'); return bytes;
  } };
}
async function writeMaps(root, files) {
  await assertAdoptionNoLinks(root, { allowMissing: true });
  await mkdir(root); // all fixture writes exclusive too
  for (const [name, bytes] of files) { const path = join(root, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: 'wx' }); }
}
async function diskMap(root, prefix = '') {
  const files = new Map();
  for (const child of await readdir(join(root, prefix), { withFileTypes: true })) {
    const name = `${prefix}${child.name}`;
    if (child.isDirectory()) for (const item of await diskMap(root, `${name}/`)) files.set(...item);
    else files.set(name, await readFile(join(root, name)));
  }
  return files;
}
function sameMaps(a, b) { assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort()); for (const [name, bytes] of a) assert.ok(bytes.equals(b.get(name)), name); }

export async function runXmlModuleGroupTests() {
  const licenseBytes = await readFile(join(PROJECT, XML_GROUP_LICENSE_PATH));
  const fixture = createXmlGroupProofPackages(), original = cloneFixture(fixture);
  const build = f => buildXmlModuleGroup({ ...f, licenseBytes });
  const result = build(fixture);
  assert.equal(result.descriptors.length, 2); assert.equal(result.hostConfig.joomlaDiscoveryRoots.length, 1);
  assert.equal(result.files.size, 27); assert.equal(result.inventory.files.length, 25);
  assert.equal(result.files.has('adoption-plan.json'), false); assert.equal(result.files.has('ADAPTATION.json'), false);
  assert.equal(result.files.has(XML_GROUP_LICENSE_PATH), true);
  for (const ref of fixture.plan.packages) {
    const member = fixture.packages.get(ref.path);
    for (const [name, bytes] of member.files) if (!CONTROL.includes(name)) {
      const mapping = result.provenance.members.find(item => item.module === ref.module).mapping.find(item => item.original === name);
      assert.ok(mapping); assert.ok(result.files.get(mapping.grouped).equals(bytes));
    }
    sameMaps(member.files, original.packages.get(ref.path).files);
    assert.deepEqual(result.descriptors.find(d => d.key === ref.key).params.map(param => param.default), ['', 3, false]);
  }
  assert.equal(result.provenance.rightsApproved, false); assert.equal(result.provenance.privacyReviewed, false);
  const unknown = cloneFixture(fixture);
  const unknownMember = unknown.packages.get(unknown.plan.packages[0].path);
  for (const name of ['adoption-plan.json', 'ADAPTATION.json']) {
    const source = JSON.parse(unknownMember.files.get(name));
    Object.defineProperty(source, '__proto__', { value: { constructor: { prototype: 'OWN opaque unknown preserved' } }, enumerable: true });
    source.constructor = { untouchedUnknown: true }; unknownMember.files.set(name, data(source));
  }
  repin(unknown); const unknownResult = build(unknown);
  for (const name of ['adoption-plan.json', 'ADAPTATION.json']) assert.ok(unknownResult.files.get(`docs/group-members/mod_capacity_alpha/${name}`).equals(unknownMember.files.get(name)));
  assert.equal(Object.prototype.untouchedUnknown, undefined);
  assert.ok(!JSON.stringify(result.provenance).includes(base), 'Caller base belongs in host config, not provenance');
  for (const file of result.inventory.files) { const bytes = result.files.get(file.path); assert.equal(xmlGroupHash(bytes), file.sha256); assert.equal(bytes.length, file.bytes); }
  assertJoomlaPackageAssets(result.hostConfig, result.descriptors);
  assert.equal(xmlGroupHash(result.files.get(CONTROL[0])), result.hostConfig.joomlaDiscoveryRoots[0].inventoryHash);
  const discovery = createJoomlaDiscoveryService({ roots: [{ ...result.hostConfig.joomlaDiscoveryRoots[0], files: port(result.files) }] });
  const scan = await discovery.scanReport(); assert.equal(scan.complete, true); assert.equal(scan.entries.length, 2);
  const verified = []; for (const candidate of scan.entries) { assert.equal(candidate.status, 'ready'); verified.push(await discovery.verify(candidate)); }
  const r2 = build(createXmlGroupProofPackages({ version: '0.1.1' }));
  const snapshots = [JSON.stringify(result.hostConfig), JSON.stringify(r2.hostConfig)];
  const merged = mergeExtensionsConfigs([result.hostConfig, r2.hostConfig], { webUrl: '/sites/example' });
  assert.deepEqual(merged.joomlaDiscoveryRoots.map(root => root.discover), [false, true]);
  assert.deepEqual([JSON.stringify(result.hostConfig), JSON.stringify(r2.hostConfig)], snapshots);
  const retained = createJoomlaDiscoveryService({ roots: merged.joomlaDiscoveryRoots.map((root, i) => ({ ...root, files: port(i ? r2.files : result.files) })) });
  assert.equal((await retained.scan()).length, 2);
  for (const d of verified) assert.equal((await retained.verifyRevision(JSON.parse(d.manifestJson).miniJoomla)).version, '0.1.0');
  const duplicates = createJoomlaDiscoveryService({ roots: [result, r2].map(group => ({ ...group.hostConfig.joomlaDiscoveryRoots[0], files: port(group.files) })) });
  assert.ok((await duplicates.scan()).every(candidate => candidate.status === 'conflict'));
  assert.throws(() => createJoomlaDiscoveryService({ roots: [1, 2].map(() => ({ ...result.hostConfig.joomlaDiscoveryRoots[0], files: port(result.files) })) }), /duplicadas/);
  const tampered = new Map(result.files); tampered.set('libraries/capacity/extensions/capacity/mod_capacity_beta/helper.js', data('tampered beta'));
  const blocked = createJoomlaDiscoveryService({ roots: [{ ...result.hostConfig.joomlaDiscoveryRoots[0], files: port(tampered) }] });
  const blockedScan = await blocked.scan(); await assert.rejects(blocked.verify(blockedScan.find(d => d.element.endsWith('alpha'))), /Integridade/);
  const eight = { joomlaDiscoveryRoots: Array.from({ length: 8 }, (_, i) => ({ id: `approved-own-${i}`, baseUrl: `/sites/example/approved/${i}`, inventoryHash: 'a'.repeat(64), immutable: true, discover: true })), moduleStyles: {}, moduleStyleRevisions: {} };
  const eightBefore = JSON.stringify(eight);
  // Merge only revisions; append to an explicit own copy, never merge eight into last-only discovery.
  const ten = normalizeExtensionsConfig({ joomlaDiscoveryRoots: [...eight.joomlaDiscoveryRoots.map(root => ({ ...root })), ...merged.joomlaDiscoveryRoots], moduleStyles: { ...merged.moduleStyles }, moduleStyleRevisions: structuredClone(merged.moduleStyleRevisions) }, { webUrl: '/sites/example' });
  assert.equal(ten.joomlaDiscoveryRoots.length, 10); assert.ok(ten.joomlaDiscoveryRoots.slice(0, 8).every(root => root.discover)); assert.equal(JSON.stringify(eight), eightBefore);
  assert.throws(() => normalizeExtensionsConfig({ ...ten, joomlaDiscoveryRoots: [...ten.joomlaDiscoveryRoots, { ...eight.joomlaDiscoveryRoots[0], id: 'eleventh' }] }, { webUrl: '/sites/example' }), /Numero de raizes/);
  let rejections = 0;
  const reject = (change, pattern) => { const f = cloneFixture(fixture); change(f); assert.throws(() => build(f), pattern); rejections++; };
  reject(f => { f.parseImports = undefined; }, /parser ports/);
  reject(f => { f.packages.get(f.plan.packages[0].path).files.set('extra.txt', data('x')); }, /Extra/);
  reject(f => { f.plan.packages[0].inventoryHash = 'b'.repeat(64); }, /pin/);
  reject(f => { f.packages.get(f.plan.packages[1].path).files.delete('libraries/capacity/extensions/capacity/_shared/render.js'); }, /integrity/);
  reject(f => { const m = f.packages.get(f.plan.packages[1].path); m.files.set('libraries/capacity/extensions/capacity/_shared/render.js', data('different own helper')); repin(f, 1); f.parseImports = (source, name) => name.endsWith('_shared/render.js') ? [] : fixture.parseImports(source, name); }, /Divergent/);
  reject(f => { f.packages.get(f.plan.packages[0].path).files.set('modules/mod_unselected/mod_unselected.xml', data('<extension/>')); repin(f); }, /Unhandled/);
  reject(f => { const ref = f.plan.packages[0], member = f.packages.get(ref.path), path = `modules/${ref.module}/${ref.module}.xml`; member.files.set(path, data(member.files.get(path).toString().replace('</files>', '<filename>manifest.json</filename></files>'))); member.files.set(`modules/${ref.module}/manifest.json`, data({ unknownManifest: true })); repin(f); member.descriptor = xmlGroupDescriptorMetadata(parseJoomlaManifest(member.files.get(path), { baseUrl: base, manifestPath: path })); }, /Unknown runtime\/manifest/);
  reject(f => { f.packages.get(f.plan.packages[0].path).files.set(`${f.plan.packages[0].libraryPrefix}unused.js`, data('export default 0')); repin(f); }, /Unhandled/);
  reject(f => { const m = f.packages.get(f.plan.packages[0].path); m.files.set('docs/notice.txt', data('x')); m.files.set('DOCS/other.txt', data('x')); }, /Case-colliding/);
  reject(f => { f.packages.get(f.plan.packages[0].path).files.set('LICENSE.', data('x')); }, /Windows/);
  reject(f => { f.packages.get(f.plan.packages[0].path).files.set('docs/%2e%2e/payload.txt', data('x')); });
  reject(f => { repin(f, 0, inventory => { inventory.format = 'unknown'; }); }, /format/);
  reject(f => { repin(f, 0, inventory => { inventory.moduleKeys.extra = 'extra'; }); }, /maps/);
  reject(f => { repin(f, 0, inventory => { inventory.moduleStyles[f.plan.packages[0].key].reverse(); }); }, /CSS order/);
  reject(f => { const m = f.packages.get(f.plan.packages[0].path), host = JSON.parse(m.files.get(CONTROL[1])); host.moduleStyleRevisions[f.plan.packages[0].key][m.descriptor.entryPointUrl].reverse(); m.files.set(CONTROL[1], data(host)); }, /CSS order/);
  reject(f => { const m = f.packages.get(f.plan.packages[0].path); m.descriptor.params[1].default = 4; }, /Trusted descriptor/);
  reject(f => { const ref = f.plan.packages[0], m = f.packages.get(ref.path), name = `modules/${ref.module}/${ref.module}.xml`; m.files.set(name, data(m.files.get(name).toString().replace('<version>0.1.0', '<version>0.2.0'))); repin(f); }, /identity\/version/);
  reject(f => { const ref = f.plan.packages[0], m = f.packages.get(ref.path), name = `modules/${ref.module}/${ref.module}.xml`; m.files.set(name, data('<!DOCTYPE extension SYSTEM "bad">' + m.files.get(name))); repin(f); }, /DTD|XML invalido/);
  reject(f => { f.plan.packages[0].sharedPaths = ['libraries/capacity/extensions/capacity/_shared/*.js']; });
  reject(f => { f.plan.packages[0].path = '../input'; });
  reject(f => { f.plan.packages[1].path = f.plan.packages[0].path.toUpperCase(); });
  reject(f => { f.plan.packages[1].module = f.plan.packages[0].module; }, /Duplicate/);
  reject(f => { f.plan.packages[1].key = f.plan.packages[0].key.toUpperCase(); }, /Duplicate/);
  reject(f => { f.plan.packages = f.plan.packages.slice(0, 1); }, /2\.\.7/);
  reject(f => { f.plan.packages = Array(8).fill(f.plan.packages[0]); }, /2\.\.7/);
  reject(f => { f.plan.version = '01.0.0'; }, /Version/);
  reject(f => { f.plan.groupId = 'bad root'; }, /ASCII/);
  reject(f => { f.plan.base = '/bad/../path'; });
  reject(f => { f.plan.unknown = true; }, /fields/);
  reject(f => { Object.defineProperty(f.plan, 'base', { get() { throw new Error('getter executed'); }, enumerable: true }); }, /accessor/);
  reject(f => { f.plan.packages[0] = Object.assign(Object.create({ ignored: 1 }), f.plan.packages[0]); }, /Plain JSON/);
  reject(f => { Object.defineProperty(f.plan, '__proto__', { value: {}, enumerable: true }); }, /Unsafe JSON/);
  reject(f => { const m = f.packages.get(f.plan.packages[0].path); for (let i = 0; i < 501; i++) m.files.set(`docs/extra-${i}.txt`, data('')); }, /500/);
  reject(f => { f.packages.get(f.plan.packages[0].path).files.set('docs/large.txt', Buffer.alloc(10 * 1024 * 1024)); }, /10 MiB/);
  reject(f => { const m = f.packages.get(f.plan.packages[0].path); m.files.set(CONTROL[0], Buffer.alloc(64 * 1024 + 1)); f.plan.packages[0].inventoryHash = xmlGroupHash(m.files.get(CONTROL[0])); }, /oversized/);
  reject(f => { for (let index = 0; index < 2; index++) { const member = f.packages.get(f.plan.packages[index].path); for (let i = 0; i < 245; i++) member.files.set(`docs/own-${i}.txt`, data('OWN')); repin(f, index); } }, /500/);
  reject(f => { for (let index = 0; index < 2; index++) { const member = f.packages.get(f.plan.packages[index].path); for (let i = 0; i < 120; i++) member.files.set(`docs/${'long-own-notice-'.repeat(9)}${i}.txt`, data('OWN')); repin(f, index); } }, /64 KiB/);
  reject(f => { f.validateCss = function explicitCssRejectionDouble() { throw new Error('CSS parser refused'); }; }, /CSS parser/);
  for (const specifier of ['bare', '.helper.js', '/absolute.js', './%2e%2e/x.js', './helper.js?x=1', '../../../../../../escape.js', './missing.js', '../mod_capacity_beta/helper.js']) reject(f => { f.parseImports = function explicitUnsafeImportRecordDouble(source, name) { return name.endsWith('mod_capacity_alpha/module.js') ? [{ n: specifier, d: -1 }] : fixture.parseImports(source, name); }; });
  reject(f => { f.parseImports = function explicitComputedImportRecordDouble() { return [{ n: undefined, d: 1 }]; }; }, /Non-literal/);
  const args = ['--plan', 'tmp/xml-group-agent-plan.json', '--output', 'tmp/xml-group-agent-cli', '--deps', 'tmp/step2/camap-source'];
  assert.equal(parseXmlModuleGroupArgs(args).deps, 'tmp/step2/camap-source'); assert.equal(parseXmlModuleGroupArgs(['--help']).help, true);
  for (const invalid of [[], [...args, '--publish', 'true'], [...args, '--plan', 'tmp/other.json'], args.map(v => v === 'tmp/xml-group-agent-cli' ? 'tmp/other' : v), args.map(v => v === 'tmp/step2/camap-source' ? '../deps' : v)]) assert.throws(() => parseXmlModuleGroupArgs(invalid));
  const tmp = await mkdtemp(join(PROJECT, 'tmp/xml-group-agent-tests-')), relativeTmp = `tmp/${tmp.split(/[\\/]/).at(-1)}`;
  const diskFixture = cloneFixture(fixture);
  for (let i = 0; i < 2; i++) { const ref = diskFixture.plan.packages[i], member = diskFixture.packages.get(ref.path); ref.path = `${relativeTmp}/input-${i}`; await writeMaps(resolve(PROJECT, ref.path), member.files); }
  const planPath = `${relativeTmp}/plan.json`; await writeFile(resolve(PROJECT, planPath), data(diskFixture.plan), { flag: 'wx' });
  await assert.rejects(prepareXmlModuleGroup({ plan: planPath, output: `${relativeTmp}/blocked` }), /--deps/);
  await assert.rejects(lstat(join(tmp, 'blocked')), { code: 'ENOENT' });
  for (const ref of diskFixture.plan.packages) await writeFile(resolve(PROJECT, ref.path, 'uninventoried.txt'), 'x', { flag: 'wx' });
  // Input extras are tested with real CLI only in the explicit offline proof below.
  const target = join(tmp, 'target'); await mkdir(target);
  try { await symlink(target, join(tmp, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); await assert.rejects(prepareXmlModuleGroup({ plan: planPath, output: `${relativeTmp}/linked/group`, deps: 'tmp/step2/camap-source' }), /Symlink\/junction/); }
  catch (error) { if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; }
  assert.equal(XML_GROUP_LIMITS.maxMembers, 7); assert.equal(validateXmlGroupPlan(fixture.plan).packages.length, 2);
  console.log(`ok - XML group: 2 OWN modules, 2 retained revisions, ${rejections} engine rejection cases, real discovery full-union integrity, root budget 8+2=10, no input rewrites/overwrite/implicit parsers`);
  return { rejectionCases: rejections, files: result.files.size, inventoriedFiles: result.inventory.files.length, directory: relativeTmp };
}

/** Coordinator-ready immutable input fixtures; emits plans with actual pins.
 * Writes only new tmp/xml-group-agent-* proof files, never real source data. */
export async function writeXmlGroupProofInputs() {
  const output = 'tmp/xml-group-agent-proof-inputs', root = resolve(PROJECT, output);
  await assertAdoptionNoLinks(root, { allowMissing: true });
  await mkdir(root); const plans = [];
  for (const [revision, version] of [['r1', '0.1.0'], ['r2', '0.1.1']]) {
    const fixture = createXmlGroupProofPackages({ version }); await mkdir(join(root, revision));
    for (const ref of fixture.plan.packages) {
      const member = fixture.packages.get(ref.path), suffix = ref.module.split('_').at(-1);
      ref.path = `${output}/${revision}/${suffix}`; await writeMaps(resolve(PROJECT, ref.path), member.files);
    }
    fixture.plan.base = `/sites/example/xml-group-proof/${revision}`;
    const path = `${output}/${revision}-plan.json`; await writeFile(resolve(PROJECT, path), data(fixture.plan), { flag: 'wx' }); plans.push(path);
  }
  return plans;
}

/** Optional offline integration: actual approved parsers, byte-stable CLI inputs. */
export async function runXmlGroupRealParserProof({ deps = 'tmp/step2/camap-source' } = {}) {
  const ports = await loadXmlGroupParserPorts(deps), licenseBytes = await readFile(join(PROJECT, XML_GROUP_LICENSE_PATH));
  await runXmlGroupParserBoundaryTests({ deps, ports, licenseBytes });
  const fixture = createXmlGroupProofPackages(); const grouped = buildXmlModuleGroup({ ...fixture, ...ports, licenseBytes });
  assert.equal(grouped.descriptors.length, 2);
  for (const source of ['.proof { background: url("/unsafe"); }', '@import "unsafe.css";', '.proof { color: red; invalid }']) assert.throws(() => ports.validateCss(source, 'bad.css'));
  const root = await mkdtemp(join(PROJECT, 'tmp/xml-group-agent-real-')), relativeRoot = `tmp/${root.split(/[\\/]/).at(-1)}`;
  const before = [];
  for (let i = 0; i < fixture.plan.packages.length; i++) {
    const ref = fixture.plan.packages[i], member = fixture.packages.get(ref.path); ref.path = `${relativeRoot}/input-${i}`;
    await writeMaps(resolve(PROJECT, ref.path), member.files); before.push(await diskMap(resolve(PROJECT, ref.path)));
  }
  const plan = `${relativeRoot}/plan.json`; const planBytes = data(fixture.plan); await writeFile(resolve(PROJECT, plan), planBytes, { flag: 'wx' });
  const output = `${relativeRoot}/group`; const result = await prepareXmlModuleGroup({ plan, output, deps });
  sameMaps(result.files, await diskMap(resolve(PROJECT, output)));
  // Explicit OWN-only runtime proof, outside the grouping engine. No DOM/network
  // or application records: actual loader + registry render in local memory.
  const registry = createModuleRegistry();
  const loader = createExtensionLoader({ importModule: async url => {
    const prefix = `${fixture.plan.base}/`; assert.ok(url.startsWith(prefix));
    const name = url.slice(prefix.length); assert.ok(result.files.has(name));
    const module = await import(pathToFileURL(resolve(PROJECT, output, name)).href);
    validateAdoptionSchema(result.descriptors.find(d => d.entryPointUrl === url), module);
    return module;
  } });
  const runtimeRecords = result.descriptors.map(d => ({ key: d.key, type: 'Module', entryPointUrl: d.entryPointUrl, enabled: true }));
  for (const d of result.descriptors) {
    assert.equal(await loader.ensureModuleRegistered(registry, d.key, runtimeRecords), true);
    const html = registry.render(d.key, { settings: { title: '<OWN & proof>', limit: 3, enabled: false } });
    assert.ok(html.includes('&lt;OWN &amp; proof&gt;'), 'Actual render({settings}) escapes OWN caller text');
    assert.ok(!html.includes('<OWN'));
  }
  for (let i = 0; i < 2; i++) sameMaps(before[i], await diskMap(resolve(PROJECT, fixture.plan.packages[i].path)));
  assert.ok((await readFile(resolve(PROJECT, plan))).equals(planBytes));
  await assert.rejects(prepareXmlModuleGroup({ plan, output, deps }), /existing output/);
  await writeFile(resolve(PROJECT, fixture.plan.packages[1].path, 'extra.txt'), 'x', { flag: 'wx' });
  await assert.rejects(prepareXmlModuleGroup({ plan, output: `${relativeRoot}/extra-blocked`, deps }), /Extra/);
  await assert.rejects(lstat(join(root, 'extra-blocked')), { code: 'ENOENT' });
  console.log(`ok - XML group real parser proof: ${result.files.size} files, real offline parsers and exclusive CLI writer; OWN loader/registry render({settings}) verified; inputs/plan stable, extra payload and overwrite blocked`);
  return { output, inventoryHash: result.hostConfig.joomlaDiscoveryRoots[0].inventoryHash };
}

/** Regression boundaries use real parsers and private test copies only.
 * Never modify the coordinator's immutable OWN fixtures or proof roots. */
export async function runXmlGroupParserBoundaryTests({ deps = 'tmp/step2/camap-source', ports, licenseBytes } = {}) {
  ports ??= await loadXmlGroupParserPorts(deps);
  licenseBytes ??= await readFile(join(PROJECT, XML_GROUP_LICENSE_PATH));
  for (const mode of ['static', 'dynamic', 'reexport']) {
    const fixture = cloneFixture(createXmlGroupProofPackages()), ref = fixture.plan.packages[0], member = fixture.packages.get(ref.path);
    const runtimePath = `${ref.libraryPrefix}module.js`, original = member.files.get(runtimePath).toString();
    const source = mode === 'static' ? original.replace("'./helper.js'", "'.helper.js'") : original + (mode === 'dynamic' ? "await import('.helper.js');\n" : "export * from '.helper.js';\n");
    member.files.set(runtimePath, data(source));
    member.files.set(`${ref.libraryPrefix}.helper.js`, Buffer.from(member.files.get(`${ref.libraryPrefix}helper.js`)));
    if (mode === 'static') member.files.delete(`${ref.libraryPrefix}helper.js`); // no unrelated unused-file failure can mask the bare-import bug
    repin(fixture);
    assert.ok(ports.parseImports(source, runtimePath).some(item => item.n === '.helper.js'), 'Actual lexer recognizes dot-bare import');
    assert.throws(() => buildXmlModuleGroup({ ...fixture, ...ports, licenseBytes }), /Bare\/absolute\/escaped import/);
  }
  const dependencyInput = await collectAdaptationDependencies(resolve(PROJECT, deps));
  const expected = new Map([...dependencyInput.files.values()].map(({ name, bytes }) => [name, Buffer.from(bytes)]));
  assert.equal(expected.size, 175);
  const root = await mkdtemp(join(PROJECT, 'tmp/xml-group-agent-parser-tests-'));
  const relativeRoot = `tmp/${root.split(/[\\/]/).at(-1)}`, alternate = `${relativeRoot}/dependencies`;
  await writeMaps(resolve(PROJECT, alternate), expected);
  // Node require('./base64') normally loads this extensionless sibling first.
  // Test bytes only throw if incorrectly executed; no malicious side effects.
  const shadow = 'node_modules/source-map-js/lib/base64';
  await writeFile(resolve(PROJECT, alternate, shadow), 'throw new Error("UNAPPROVED_EXTENSIONLESS_SHADOW_EXECUTED");\n', { flag: 'wx' });
  await writeFile(resolve(PROJECT, alternate, 'node_modules/source-map-js/lib/base64.node'), 'OWN unapproved addon fixture, never executable', { flag: 'wx' });
  const before = await diskMap(resolve(PROJECT, alternate));
  const isolated = await loadXmlGroupParserPorts(alternate);
  assert.equal(isolated.dependencyFiles, expected.size);
  assert.notEqual(isolated.parserStage, resolve(PROJECT, alternate));
  const staged = await diskMap(isolated.parserStage);
  sameMaps(new Map([...expected, ['package.json', data({ private: true, type: 'commonjs' })]]), staged);
  assert.equal(staged.has(shadow), false); assert.equal(staged.has(`${shadow}.node`), false);
  assert.deepEqual(isolated.parseImports("import './own.js';", 'own.js').map(item => item.n), ['./own.js']);
  isolated.validateCss('.own { color: black; }', 'own.css'); await isolated.check();
  const plain = buildXmlModuleGroup({ ...createXmlGroupProofPackages(), ...ports, licenseBytes });
  sameMaps(plain.files, buildXmlModuleGroup({ ...createXmlGroupProofPackages(), ...isolated, licenseBytes }).files);
  sameMaps(before, await diskMap(resolve(PROJECT, alternate)));
  // Directory/file changes in the private execution copy fail the final gate.
  await writeFile(join(isolated.parserStage, 'unexpected.txt'), 'OWN extra', { flag: 'wx' });
  await assert.rejects(isolated.check(), /Isolated parser closure/);
  const changedPackage = JSON.parse(expected.get('node_modules/source-map-js/package.json'));
  changedPackage.main = 'lib/base64';
  await writeFile(resolve(PROJECT, alternate, 'node_modules/source-map-js/package.json'), data(changedPackage));
  await assert.rejects(loadXmlGroupParserPorts(alternate), /bytes differ/);
  await dependencyInput.check();
  console.log('ok - XML group parser boundaries: 3 real dot-bare import rejections; extensionless/addon shadows excluded from exact 175-file execution copy, unapproved package metadata and stage tamper blocked; fixture bytes unchanged');
  return { realImportRejections: 3, dependencyFiles: expected.size, parserStage: isolated.parserStage };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runXmlModuleGroupTests().catch(error => { console.error(error); process.exitCode = 1; });
}
