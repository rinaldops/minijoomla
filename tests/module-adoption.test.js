import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ADOPTION_MODULES, assertAdoptionNoLinks, parseModuleAdoptionArgs, prepareModuleAdoption, selectModuleAdoption, validateAdoptionSchema, writeModuleAdoption } from '../scripts/prepare-module-adoption.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const data = (text) => Buffer.from(text);
const fields = {
  message: { type: 'string', multiline: true }, author: { type: 'string', maxLength: 80 },
  limit: { type: 'number', min: 1, max: 10 }, enabled: { type: 'boolean' },
  align: { type: 'enum', values: ['left', 'right'] }, items: { type: 'array' }, action: { type: 'object' }
};
const defaults = { message: 'Hello & <world>', author: '', limit: 3, enabled: false, align: 'left', items: [], action: {} };

function fixture(module = 'mod_camap_corpmessage', version = '0.2.0') {
  const base = `/SiteAssets/camap/${module}/${version}`;
  const path = `modules/${module}/${module}.xml`;
  const entry = `modules/${module}/${module}.js`;
  const runtime = `libraries/camap/extensions/camap/${module}/module.js`;
  const helper = `libraries/camap/extensions/camap/${module}/helper.js`;
  const shared = 'libraries/camap/extensions/camap/_shared/render.js';
  const css = `media/${module}/css/style.css`;
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="camap.${module}">
<name>Fixture &amp; module</name><version>${version}</version>
<files><filename module="${module}">${module}.js</filename></files>
<media destination="${module}" folder="media"><filename>css/style.css</filename></media>
<config><fields name="params"><fieldset name="basic">
<field name="message" type="textarea" default="Hello &amp; &lt;world&gt;" />
<field name="author" type="text" maxlength="80" default="" />
<field name="limit" type="number" min="1" max="10" default="3" />
<field name="enabled" type="radio" default="0"><option value="1">Yes</option><option value="0">No</option></field>
<field name="align" type="list" default="left"><option value="left">Left</option><option value="right">Right</option></field>
<field name="items" type="textarea" mj:type="json" mj:valueType="array" default="[]" />
<field name="action" type="textarea" mj:type="json" mj:valueType="object" default="{}" />
</fieldset></fields></config></extension>`;
  const wrapperText = `export { default } from '../../libraries/camap/extensions/camap/${module}/module.js';\n`;
  const moduleText = "import './helper.js';\nexport default {};\n";
  const helperText = "export * from '../_shared/render.js';\n";
  const files = new Map([
    [path, data(xml)], [entry, data(wrapperText)], [runtime, data(moduleText)],
    [helper, data(helperText)], [shared, data('export const escapeHtml = String;\n')],
    [css, data('.fixture { color: black; }\n')],
    [`libraries/camap/extensions/camap/${module}/unused.js`, data('throw new Error("must not import unused code");\n')],
    ['modules/mod_forbidden/mod_forbidden.js', data('throw new Error("other module");\n')]
  ]);
  // Explicit parser-result fixtures, not a parser implementation or regex fallback.
  const imports = new Map([[wrapperText, [{ n: `../../libraries/camap/extensions/camap/${module}/module.js`, d: -1 }]],
    [moduleText, [{ n: './helper.js', d: -1 }]], [helperText, [{ n: '../_shared/render.js', d: -1 }]],
    ['export const escapeHtml = String;\n', []]]);
  const settingsSchema = { fields };
  return { module, version, base, path, entry, runtime, helper, shared, css, files,
    moduleExports: { settingsSchema, defaults, default: { name: `camap.${module}`, settings: defaults, settingsSchema, render() { throw new Error('Preparation/discovery must not render modules.'); } } },
    parseImports: (text) => { assert.ok(imports.has(text), 'Only explicit fixture parser results are supported'); return imports.get(text); },
    validateCss: (text) => assert.equal(text, '.fixture { color: black; }\n') };
}

async function diskFiles(root) {
  const result = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      assert.equal(entry.isSymbolicLink(), false);
      if (entry.isDirectory()) await walk(join(directory, entry.name), `${name}/`);
      else result.push(name);
    }
  }
  await walk(root);
  return result.sort();
}

function filesPort(root) {
  return {
    listFolders: async ({ folderPath }) => ({ value: (await readdir(join(root, folderPath), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map(({ name }) => ({ Name: name })) }),
    downloadFile: async ({ folderPath, fileName }) => readFile(join(root, folderPath, fileName))
  };
}

export async function runModuleAdoptionTests() {
  const tmp = join(PROJECT, 'tmp');
  await assertAdoptionNoLinks(tmp, { allowMissing: true });
  await mkdir(tmp, { recursive: true });
  const directory = await mkdtemp(join(tmp, 'adoption-agent-tests-'));
  const output = (name) => `tmp/${directory.split(/[\\/]/).at(-1)}/${name}`;
  assert.equal(ADOPTION_MODULES.length, 11);
  assert.equal(ADOPTION_MODULES.filter(({ pilot }) => pilot).length, 1);

  const baseArgs = ['--module', 'mod_camap_corpmessage', '--version', '0.2.0', '--base', '/SiteAssets/camap/pilot/0.2.0', '--output', output('cli')];
  assert.equal(parseModuleAdoptionArgs(baseArgs).module, 'mod_camap_corpmessage');
  assert.equal(parseModuleAdoptionArgs(['--help']).help, true);
  assert.equal(parseModuleAdoptionArgs([...baseArgs, '--source', 'tmp/approved-source']).sourceRoot, 'tmp/approved-source');
  assert.equal(parseModuleAdoptionArgs([...baseArgs, '--dependencies-root', 'tmp/approved-deps']).dependenciesRoot, 'tmp/approved-deps');
  for (const args of [[], [...baseArgs, '--publish', 'true'], [...baseArgs, '--module', 'mod_hero'], [...baseArgs, '--source', '../unapproved'], [...baseArgs, '--dependencies-root', '../CAMAP2'], baseArgs.map((arg) => arg === 'mod_camap_corpmessage' ? 'all' : arg), baseArgs.map((arg) => arg === '0.2.0' ? '00.2.0' : arg), baseArgs.map((arg) => arg.startsWith('/SiteAssets') ? '/bad/../base' : arg), baseArgs.map((arg) => arg.startsWith('tmp/') ? 'tmp/../escape' : arg), baseArgs.map((arg) => arg.startsWith('tmp/') ? 'tmp/CON/file' : arg)]) assert.throws(() => parseModuleAdoptionArgs(args));

  const f = fixture();
  const selected = selectModuleAdoption(f);
  assert.equal(selected.files.size, 6);
  assert.equal(selected.files.has(f.helper), true, 'transitive helper retained');
  assert.equal([...selected.files.keys()].some((name) => name.includes('unused') || name.includes('forbidden')), false);
  assert.deepEqual(selected.descriptor.params.map(({ type }) => type), ['textarea', 'text', 'number', 'checkbox', 'select', 'json', 'json']);
  assert.deepEqual(selected.descriptor.params.map(({ default: value }) => value), Object.values(defaults));
  const changed = (name, value) => ({ ...f, files: new Map([...f.files].map(([path, bytes]) => [path, path === name ? data(value) : bytes])) });
  assert.throws(() => selectModuleAdoption(changed(f.path, f.files.get(f.path).toString().replace('camap.mod_camap_corpmessage', 'camap.wrong'))), /key\/version/);
  assert.throws(() => selectModuleAdoption(changed(f.path, f.files.get(f.path).toString().replace('<name>', '<name><broken>'))), /XML invalido/);
  assert.throws(() => selectModuleAdoption(changed(f.path, '<!DOCTYPE extension SYSTEM "https://untrusted.invalid/x">' + f.files.get(f.path))), /DTD|XML invalido/);
  assert.throws(() => selectModuleAdoption(changed(f.path, f.files.get(f.path).toString().replace('valueType="array"', 'valueType="object"'))), /objeto|Typed XML/);
  assert.throws(() => selectModuleAdoption({ ...f, version: '0.2.1' }), /key\/version/);
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, defaults: { ...defaults, enabled: 'false' } } }), /wrong type/);
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, defaults: { ...defaults, limit: 12 } } }), /menor ou igual/);
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, settingsSchema: { fields: { ...fields, added: { type: 'string' } } } } }), /field names/);
  const withoutSettings = { ...f.moduleExports.default };
  delete withoutSettings.settings;
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, default: withoutSettings } }), /default\.settings/);
  for (const settings of [undefined, null, [], 'settings', new Date(0)]) {
    assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, default: { ...f.moduleExports.default, settings } } }), /default\.settings/);
  }
  const inheritedSettings = Object.assign(Object.create({ settings: defaults }), withoutSettings);
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, default: inheritedSettings } }), /own plain object/);
  const withoutDefaults = { ...f.moduleExports };
  delete withoutDefaults.defaults;
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: withoutDefaults }), /named defaults/);
  for (const value of [undefined, null, [], 'defaults', new Date(0)]) {
    assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, defaults: value } }), /named defaults/);
  }
  const inheritedDefaults = Object.assign(Object.create({ defaults }), withoutDefaults);
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: inheritedDefaults }), /own plain object/);
  const withoutRuntimeSchema = { ...f.moduleExports.default };
  delete withoutRuntimeSchema.settingsSchema;
  assert.equal(selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, default: withoutRuntimeSchema } }).files.size, 6, 'runtime schema is optional, settings are mandatory');
  assert.equal(selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, default: { ...f.moduleExports.default, settings: { ...defaults }, settingsSchema: { fields } } } }).files.size, 6, 'equal runtime copies need not share identity');
  const explicitSchema = { fields: { ...fields, message: { ...fields.message, default: defaults.message } } };
  const explicit = { ...f, moduleExports: { ...f.moduleExports, settingsSchema: explicitSchema, default: { ...f.moduleExports.default, settingsSchema: explicitSchema } } };
  assert.equal(selectModuleAdoption(explicit).files.size, 6);
  const runtimeDefaults = { ...defaults, message: 'runtime differs from XML' };
  for (const moduleExports of [
    { ...explicit.moduleExports, defaults: runtimeDefaults, default: { ...explicit.moduleExports.default, settings: runtimeDefaults } },
    { ...explicit.moduleExports, default: { ...explicit.moduleExports.default, settings: runtimeDefaults } },
    { ...explicit.moduleExports, defaults: runtimeDefaults }
  ]) assert.throws(() => selectModuleAdoption({ ...explicit, moduleExports }), /Typed XML default differs: message/, 'explicit field defaults must not mask either actual default source');
  const missingMessage = { ...defaults };
  delete missingMessage.message;
  for (const moduleExports of [
    { ...explicit.moduleExports, default: { ...explicit.moduleExports.default, settings: missingMessage } },
    { ...explicit.moduleExports, defaults: missingMessage }
  ]) assert.throws(() => selectModuleAdoption({ ...explicit, moduleExports }), /Typed XML default differs: message/, 'actual defaults must own the XML default value');
  const coercedDefaults = { ...defaults, align: '' };
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, defaults: coercedDefaults, default: { ...f.moduleExports.default, settings: coercedDefaults } } }), /Typed XML default differs: align/, 'coercion must not conceal a different actual default');
  const wrongExplicitSchema = { fields: { ...fields, message: { ...fields.message, default: 'wrong explicit field default' } } };
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, settingsSchema: wrongExplicitSchema, default: { ...f.moduleExports.default, settingsSchema: wrongExplicitSchema } } }), /Typed XML default differs: message/);
  assert.throws(() => selectModuleAdoption({ ...explicit, moduleExports: { ...explicit.moduleExports, defaults: { ...defaults, limit: 12 } } }), /menor ou igual/, 'constraint validation still takes precedence over export consistency');
  assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, default: { ...f.moduleExports.default, settings: { ...defaults, extra: true } } } }), /settings differ/);
  for (const settingsSchema of [
    { fields: { ...fields, message: { ...fields.message, default: 'runtime schema override' } } },
    { fields: { ...fields, message: { type: 'boolean' } } },
    { ...f.moduleExports.settingsSchema, version: 2 }
  ]) assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, default: { ...f.moduleExports.default, settingsSchema } } }), /schema differs/, 'runtime field and schema metadata contradictions must be rejected');
  for (const settingsSchema of [undefined, null, [], 'schema']) {
    assert.throws(() => selectModuleAdoption({ ...f, moduleExports: { ...f.moduleExports, default: { ...f.moduleExports.default, settingsSchema } } }), /default\.settingsSchema/);
  }
  assert.throws(() => selectModuleAdoption({ ...f, parseImports: undefined }), /parser ports/);
  for (const specifier of ['https://untrusted.invalid/a.js', 'bare-package', '/absolute.js', './%2e%2e/a.js', './helper.js?x=1', '../../../../../../modules/mod_forbidden/mod_forbidden.js', '../../mod_forbidden/mod_forbidden.js', './missing.js']) {
    assert.throws(() => selectModuleAdoption({ ...f, parseImports: (text, name) => name === f.runtime ? [{ n: specifier, d: -1 }] : f.parseImports(text, name) }), /import|Dependency outside|Missing packaged/i);
  }
  assert.throws(() => selectModuleAdoption({ ...f, parseImports: (text, name) => name === f.runtime ? [{ n: undefined, d: 5 }] : f.parseImports(text, name) }), /Non-literal/);
  assert.throws(() => selectModuleAdoption({ ...f, files: new Map([...f.files].filter(([name]) => name !== f.shared)) }), /Missing packaged/);
  assert.throws(() => selectModuleAdoption({ ...f, files: new Map([...f.files, [f.shared.toUpperCase(), data('')]]) }), /case-colliding/);
  assert.throws(() => selectModuleAdoption({ ...f, files: new Map([...f.files, ['extra.bin', Buffer.alloc(10 * 1024 * 1024)]]) }), /10 MiB/);
  assert.throws(() => selectModuleAdoption({ ...f, validateCss: () => { throw new Error('Real parser refused CSS url()/@import'); } }), /CSS/);

  const packages = [];
  for (const { folder } of ADOPTION_MODULES) {
    const fixtureData = fixture(folder);
    const result = await writeModuleAdoption({ ...fixtureData, output: output(folder), licenses: new Map([['LICENSE.md', data('Original fixture license\r\nDo not rewrite.\r\n')]]) });
    packages.push(result);
    assert.equal(result.hostConfig.joomlaDiscoveryRoots.length, 1);
    assert.equal(result.hostConfig.joomlaDiscoveryRoots[0].id, `camap-${folder}-0.2.0`);
    assert.deepEqual(result.inventory.moduleKeys, { [folder]: `camap.${folder}` });
    assert.deepEqual(result.inventory.moduleStyles, { [`camap.${folder}`]: [fixtureData.css] });
    assert.equal(result.adoptionPlan.migrated, false);
    assert.equal(result.adoptionPlan.publicationApproved, false);
    assert.equal(result.adoptionPlan.currentRecordsModified, false);
    const inventoryBytes = await readFile(join(result.output, 'MANIFEST-SHA256.json'));
    assert.equal(hash(inventoryBytes), result.hostConfig.joomlaDiscoveryRoots[0].inventoryHash);
    assert.deepEqual(await diskFiles(result.output), [...result.inventory.files.map(({ path }) => path), 'MANIFEST-SHA256.json', 'host-config.json'].sort(), 'complete inventory, apart from its two control files');
    for (const file of result.inventory.files) {
      const bytes = await readFile(join(result.output, file.path));
      assert.equal(hash(bytes), file.sha256);
      assert.equal(bytes.length, file.bytes);
    }
    assert.equal((await readFile(join(result.output, 'LICENSE.md'))).toString(), 'Original fixture license\r\nDo not rewrite.\r\n');
    const service = createJoomlaDiscoveryService({ roots: [{ ...result.hostConfig.joomlaDiscoveryRoots[0], files: filesPort(result.output) }] });
    const scan = await service.scanReport();
    assert.equal(scan.complete, true);
    assert.equal(scan.entries.length, 1);
    assert.equal(scan.entries[0].status, 'ready');
    assert.equal((await service.verify(scan.entries[0])).key, `camap.${folder}`, 'real discovery integrity verification without imports');
  }
  const revision = await writeModuleAdoption({ ...fixture('mod_camap_corpmessage', '0.2.1'), output: output('pilot-0.2.1') });
  const original = packages[0];
  assert.equal(revision.descriptor.key, original.descriptor.key);
  assert.deepEqual(revision.descriptor.params, original.descriptor.params, 'same typed validation contract across pilot revisions');
  assert.notEqual(revision.hostConfig.joomlaDiscoveryRoots[0].id, original.hostConfig.joomlaDiscoveryRoots[0].id);
  assert.notEqual(revision.hostConfig.joomlaDiscoveryRoots[0].inventoryHash, original.hostConfig.joomlaDiscoveryRoots[0].inventoryHash);
  assert.equal(revision.adoptionPlan.sourceLicensePresent, false);
  const revisionService = createJoomlaDiscoveryService({ roots: [
    { ...original.hostConfig.joomlaDiscoveryRoots[0], discover: false, files: filesPort(original.output) },
    { ...revision.hostConfig.joomlaDiscoveryRoots[0], files: filesPort(revision.output) }
  ] });
  assert.equal((await revisionService.scan())[0].version, '0.2.1');
  const originalService = createJoomlaDiscoveryService({ roots: [{ ...original.hostConfig.joomlaDiscoveryRoots[0], files: filesPort(original.output) }] });
  const verifiedOriginal = await originalService.verify((await originalService.scan())[0]);
  assert.equal((await revisionService.verifyRevision(JSON.parse(verifiedOriginal.manifestJson).miniJoomla)).version, '0.2.0', 'retained discover:false revision still verifies for rollback');
  await writeFile(join(revision.output, 'docs', 'ADOPTION-NOTICE.md'), 'tampered');
  await assert.rejects(revisionService.verify((await revisionService.scan())[0]), /Integridade/);
  assert.throws(() => createJoomlaDiscoveryService({ roots: packages.map((result) => ({ ...result.hostConfig.joomlaDiscoveryRoots[0], files: filesPort(result.output) })) }), /dez raizes/);
  await assert.rejects(writeModuleAdoption({ ...f, output: output('mod_camap_corpmessage') }), /overwrite/);
  const missing = join(directory, 'missing-source');
  await mkdir(join(missing, 'tools'), { recursive: true });
  await writeFile(join(missing, 'tools', 'prepare-joomla-modules.js'), 'throw new Error("must not execute without dependencies");');
  await assert.rejects(prepareModuleAdoption({ ...f, output: output('blocked'), sourceRoot: missing, dependenciesRoot: missing }), (error) => error.code === 'ADOPTION_DEPENDENCY_MISSING');
  await assert.rejects(lstat(join(directory, 'blocked')), { code: 'ENOENT' });
  const target = join(directory, 'link-target');
  await mkdir(target);
  try {
    await symlink(target, join(directory, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(writeModuleAdoption({ ...f, output: output('link/package') }), /Symlink\/junction/);
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
    console.log(`SKIP - link creation unavailable: ${error.code}`);
  }
  console.log('ok - module adoption: eleven isolated synthetic packages, two pilot revisions, real XML/typed profiles and discovery integrity, closure, bounds, no overwrite/links, offline dependency failure');
}

// Explicit integration entrypoint only. Default suite never requires CAMAP2,
// SPMIDDLE, npm, browsers, network or installed generator dependencies.
export async function prepareOtherAdoptionModules({ sourceRoot, outputPrefix = 'adoption-agent-other' } = {}) {
  if (!sourceRoot) throw new Error('An explicitly approved local sourceRoot is required.');
  if (!/^adoption-agent-[a-zA-Z0-9_-]+$/.test(outputPrefix)) throw new Error('Output prefix must remain adoption-agent-* under tmp.');
  const results = [];
  for (const { folder, pilot } of ADOPTION_MODULES) {
    if (pilot) continue; // coordinator owns the real two-revision pilot builds
    results.push(await prepareModuleAdoption({ sourceRoot, module: folder, version: '0.2.0', base: `/SiteAssets/camap/${folder}/0.2.0`, output: `tmp/${outputPrefix}-${folder}-0.2.0` }));
  }
  return results;
}

/** Audit already prepared packages against explicitly trusted local source
 * exports, without rebuilding, importing packaged entrypoints or rendering. */
export async function auditLocalAdoptionPackages({ sourceRoot, packages } = {}) {
  const source = resolve(PROJECT, sourceRoot ?? 'tmp/no-implicit-source');
  if (!sourceRoot || !source.startsWith(`${join(PROJECT, 'tmp')}${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error('Explicit source under worktree tmp is required.');
  await assertAdoptionNoLinks(source);
  const lexer = await import(new URL(`../${sourceRoot.replaceAll('\\', '/')}/node_modules/es-module-lexer/dist/lexer.js`, import.meta.url).href);
  const css = await import(new URL(`../${sourceRoot.replaceAll('\\', '/')}/node_modules/css-tree/lib/index.js`, import.meta.url).href);
  await lexer.init;
  const results = [];
  const contracts = new Map();
  for (const { output, module, version } of packages) {
    assert.ok(ADOPTION_MODULES.some(({ folder }) => folder === module), 'allowlisted module source only');
    const root = resolve(PROJECT, output);
    if (!root.startsWith(`${join(PROJECT, 'tmp')}${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error('Packages must remain under worktree tmp.');
    await assertAdoptionNoLinks(root);
    const inventoryBytes = await readFile(join(root, 'MANIFEST-SHA256.json'));
    const inventory = JSON.parse(inventoryBytes);
    const hostConfig = JSON.parse(await readFile(join(root, 'host-config.json')));
    assert.equal(hostConfig.joomlaDiscoveryRoots.length, 1);
    assert.equal(hash(inventoryBytes), hostConfig.joomlaDiscoveryRoots[0].inventoryHash);
    assert.deepEqual(inventory.moduleKeys, { [module]: `camap.${module}` });
    const files = new Map();
    for (const file of inventory.files) {
      const bytes = await readFile(join(root, file.path));
      assert.equal(bytes.length, file.bytes);
      assert.equal(hash(bytes), file.sha256);
      files.set(file.path, bytes);
    }
    assert.deepEqual(await diskFiles(root), [...files.keys(), 'MANIFEST-SHA256.json', 'host-config.json'].sort());
    const descriptor = parseJoomlaManifest(files.get(`modules/${module}/${module}.xml`), { baseUrl: hostConfig.joomlaDiscoveryRoots[0].baseUrl, manifestPath: `modules/${module}/${module}.xml` });
    assert.equal(descriptor.key, `camap.${module}`);
    assert.equal(descriptor.version, version);
    const modulePath = join(source, 'extensions', 'camap', module, 'module.js');
    await assertAdoptionNoLinks(modulePath);
    validateAdoptionSchema(descriptor, await import(pathToFileURL(modulePath).href));
    if (contracts.has(module)) assert.deepEqual(descriptor.params, contracts.get(module), 'real revisions preserve the same typed XML contract');
    contracts.set(module, descriptor.params);
    for (const file of descriptor.requiredFiles) assert.ok(files.has(file));
    for (const [name, bytes] of files) {
      if (name.endsWith('.js')) for (const item of lexer.parse(bytes.toString(), name)[0]) {
        assert.ok(item.d < 0 || typeof item.n === 'string', 'no computed dynamic imports');
        if (item.n == null) continue;
        assert.ok(item.n.startsWith('.'));
        const dependency = resolve(dirname(join(root, name)), item.n);
        assert.ok(files.has(dependency.slice(root.length + 1).replaceAll('\\', '/')), `closed actual dependency ${name} -> ${item.n}`);
      }
      if (name.endsWith('.css')) css.walk(css.parse(bytes.toString()), (node) => {
        assert.notEqual(node.type, 'Url');
        assert.ok(node.type !== 'Atrule' || node.name.toLowerCase() !== 'import');
      });
    }
    const service = createJoomlaDiscoveryService({ roots: [{ ...hostConfig.joomlaDiscoveryRoots[0], files: filesPort(root) }] });
    const scan = await service.scanReport();
    assert.equal(scan.complete, true);
    assert.equal(scan.entries.length, 1);
    assert.equal(scan.entries[0].status, 'ready');
    assert.equal((await service.verify(scan.entries[0])).key, `camap.${module}`);
    results.push({ module, version, files: inventory.files.length, inventoryHash: hash(inventoryBytes), output });
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runModuleAdoptionTests().catch((error) => { console.error(error); process.exitCode = 1; });
}
