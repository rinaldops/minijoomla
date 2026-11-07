import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { coerceParam } from '../src/libraries/minijoomla/application/declared-params.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(PROJECT, 'tmp');
const CAMAP = resolve(PROJECT, '..', 'CAMAP2');
const MAX_FILES = 500;
const MAX_BYTES = 10 * 1024 * 1024;
const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'COPYING.md', 'COPYING.txt'];
export const ADOPTION_MODULES = Object.freeze([
  'mod_camap_corpmessage', 'mod_camap_editorial', 'mod_camap_highlights',
  'mod_camap_topsections', 'mod_documentation', 'mod_forum', 'mod_hero',
  'mod_home', 'mod_recursos', 'mod_showcase', 'mod_videoteca'
].map((folder) => Object.freeze({ folder, key: `camap.${folder}`, pilot: folder === 'mod_camap_corpmessage' })));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const within = (root, path) => {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
};

export async function assertAdoptionNoLinks(path, { allowMissing = false } = {}) {
  const chain = [];
  for (let current = resolve(path); ; current = dirname(current)) {
    chain.unshift(current);
    if (dirname(current) === current) break;
  }
  for (const item of chain) {
    try {
      if ((await lstat(item)).isSymbolicLink()) throw new Error(`Symlink/junction refused: ${item}`);
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') break;
      throw error;
    }
  }
}

function options({ module, version, base, output, sourceRoot, dependenciesRoot } = {}) {
  const definition = ADOPTION_MODULES.find(({ folder }) => folder === module);
  if (!definition) throw new Error('--module must name exactly one of the eleven allowlisted CAMAP modules; all is refused.');
  if (typeof version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version) || version.length > 40) throw new Error('--version must be X.Y.Z without leading zeros.');
  if (typeof base !== 'string' || !/^\/[A-Za-z0-9_./-]+$/.test(base) || base.split('/').slice(1).some((part) => !part || part === '.' || part === '..')) throw new Error('--base must be a server-relative ASCII path without empty/dot segments.');
  if (typeof output !== 'string' || !output.startsWith('tmp/') || output.includes('\\')) throw new Error('--output must be a new relative directory under tmp/.');
  packagePath(output);
  if (output.split('/').some((part) => part.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe Windows output path.');
  const destination = resolve(PROJECT, output);
  if (!within(TMP, destination) || destination === TMP) throw new Error('--output escapes tmp.');
  const source = resolve(PROJECT, sourceRoot ?? CAMAP);
  if (source !== CAMAP && (!within(TMP, source) || source === TMP)) throw new Error('sourceRoot overrides are only allowed for fixtures under this worktree tmp.');
  if (within(source, destination) || within(destination, source)) throw new Error('Sources and output must not overlap.');
  const dependencies = dependenciesRoot === undefined ? null : resolve(PROJECT, dependenciesRoot);
  if (dependencies && (!within(TMP, dependencies) || dependencies === TMP || within(dependencies, destination) || within(destination, dependencies))) throw new Error('dependenciesRoot must be an isolated, non-overlapping directory under this worktree tmp.');
  return { definition, module, version, base, output, destination, source, dependencies };
}

async function newDestination(path) {
  await assertAdoptionNoLinks(path, { allowMissing: true });
  try { await lstat(path); throw new Error(`Refusing to overwrite existing output: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function validFiles(files) {
  if (!(files instanceof Map) || !files.size || files.size > MAX_FILES) throw new Error('Package must contain 1..500 files.');
  const names = new Set();
  let total = 0;
  for (const [name, bytes] of files) {
    packagePath(name);
    if (names.has(name.toLowerCase())) throw new Error(`Duplicate/case-colliding package path: ${name}`);
    names.add(name.toLowerCase());
    if (!Buffer.isBuffer(bytes) || (total += bytes.length) > MAX_BYTES) throw new Error('Package bytes exceed the 10 MiB contract.');
  }
}

function utf8(bytes, name) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error(`Invalid UTF-8: ${name}`); }
}

function ownPlainObject(owner, name, label) {
  const property = Object.getOwnPropertyDescriptor(owner, name);
  const value = property?.value;
  if (!property || !Object.hasOwn(property, 'value') || !value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`Missing/invalid ${label}: own plain object required.`);
  return value;
}

/** Check the actual runtime XML profile, not regex-extracted XML metadata. */
export function validateAdoptionSchema(descriptor, moduleExports) {
  const fields = moduleExports?.settingsSchema?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('Missing settingsSchema.fields.');
  if (moduleExports.default?.name !== descriptor.key || typeof moduleExports.default?.render !== 'function') throw new Error('Runtime module identity/render contract differs from XML.');
  const settings = ownPlainObject(moduleExports.default, 'settings', 'default.settings');
  const defaults = ownPlainObject(moduleExports, 'defaults', 'named defaults');
  if (JSON.stringify(Object.keys(fields)) !== JSON.stringify(descriptor.params.map(({ name }) => name))) throw new Error('XML schema field names/order differ from runtime.');
  const checkDefault = (param, field, value) => {
    if (value !== undefined && ((['string', 'number', 'boolean'].includes(field.type) && typeof value !== field.type) || (field.type === 'number' && !Number.isFinite(value)) || (field.type === 'array' && !Array.isArray(value)) || (field.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))))) throw new Error(`Runtime default has wrong type: ${param.name}`);
    if (value === undefined ? Object.hasOwn(param, 'default') : JSON.stringify(coerceParam(param, value)) !== JSON.stringify(param.default)) throw new Error(`Typed XML default differs: ${param.name}`);
  };
  for (const param of descriptor.params) {
    const field = fields[param.name];
    const type = { string: field.multiline === true || field.maxLength > 200 ? 'textarea' : 'text', number: 'number', boolean: 'checkbox', enum: 'select', array: 'json', object: 'json' }[field.type];
    if (!type || param.type !== type || (type === 'json' && param.valueType !== field.type)) throw new Error(`Typed XML field differs from runtime: ${param.name}`);
    if (field.maxLength !== undefined && param.maxLength !== field.maxLength) throw new Error(`XML maxLength differs: ${param.name}`);
    for (const bound of ['min', 'max']) if (field[bound] !== undefined && param[bound] !== Number(field[bound])) throw new Error(`XML ${bound} differs: ${param.name}`);
    if (field.type === 'enum' && JSON.stringify(param.options.map(({ value }) => value)) !== JSON.stringify(field.values)) throw new Error(`XML enum differs: ${param.name}`);
    const value = Object.hasOwn(field, 'default') ? field.default : Object.hasOwn(defaults, param.name) ? defaults[param.name] : undefined;
    checkDefault(param, field, value);
  }
  // Validate field constraints first, so consistency errors do not hide an
  // invalid type/bound. An explicit schema default must not override the
  // defaults actually registered or used by the module's render function.
  for (const param of descriptor.params) for (const values of [settings, defaults]) {
    const value = Object.hasOwn(values, param.name) ? values[param.name] : undefined;
    checkDefault(param, fields[param.name], value);
    if (JSON.stringify(value) !== JSON.stringify(param.default)) throw new Error(`Typed XML default differs: ${param.name}`);
  }
  if (JSON.stringify(settings) !== JSON.stringify(defaults)) throw new Error('Default export settings differ from named defaults.');
  if ('settingsSchema' in moduleExports.default) {
    const schema = ownPlainObject(moduleExports.default, 'settingsSchema', 'default.settingsSchema');
    if (schema !== moduleExports.settingsSchema && JSON.stringify(schema) !== JSON.stringify(moduleExports.settingsSchema)) throw new Error('Default export schema differs from named schema.');
  }
}

/** Pure closure selection. Parser ports operate only on in-memory bytes. */
export function selectModuleAdoption({ files, module, version, base, moduleExports, parseImports, validateCss } = {}) {
  const definition = ADOPTION_MODULES.find(({ folder }) => folder === module);
  if (!definition) throw new Error('Unknown adoption module.');
  if (typeof parseImports !== 'function' || typeof validateCss !== 'function') throw new Error('Real JavaScript/CSS parser ports are required.');
  validFiles(files);
  const manifestPath = `modules/${module}/${module}.xml`;
  if (!files.has(manifestPath)) throw new Error(`Missing XML: ${manifestPath}`);
  const descriptor = parseJoomlaManifest(files.get(manifestPath), { baseUrl: base, manifestPath });
  if (descriptor.key !== definition.key || descriptor.version !== version) throw new Error('XML key/version differs from requested adoption.');
  validateAdoptionSchema(descriptor, moduleExports);
  if (descriptor.requiredFolders.length) throw new Error('Adoption requires explicit files, not open-ended XML folders.');
  const permitted = (name) => name === 'libraries/camap/extensions/camap/_shared/render.js' || [
    `modules/${module}/`, `media/${module}/`, `libraries/camap/extensions/camap/${module}/`
  ].some((prefix) => name.startsWith(prefix));
  const selected = new Map();
  const queue = [manifestPath, ...descriptor.requiredFiles];
  for (let index = 0; index < queue.length; index += 1) {
    const name = queue[index];
    packagePath(name);
    if (!permitted(name)) throw new Error(`Dependency outside individual module allowlist: ${name}`);
    if (selected.has(name)) continue;
    const bytes = files.get(name);
    if (!bytes) throw new Error(`Missing packaged dependency: ${name}`);
    selected.set(name, bytes);
    if (name.endsWith('.js')) {
      for (const item of parseImports(utf8(bytes, name), name)) {
        if (item.d >= 0 && typeof item.n !== 'string') throw new Error(`Non-literal dynamic import refused: ${name}`);
        if (item.n === undefined || item.n === null) continue; // import.meta
        const specifier = item.n;
        if (!specifier.startsWith('.') || /[\\%?#\x00-\x20]/.test(specifier)) throw new Error(`Absolute/bare/unsafe import refused: ${name} -> ${specifier}`);
        let depth = posix.dirname(name).split('/').length;
        for (const part of specifier.split('/')) {
          if (part === '..' && --depth < 0) throw new Error(`Import escapes package root: ${name}`);
          if (part !== '..' && part !== '.' && part !== '') depth += 1;
        }
        const target = posix.resolve('/', posix.dirname(name), specifier).slice(1);
        queue.push(target);
      }
    } else if (name.endsWith('.css')) validateCss(utf8(bytes, name), name);
  }
  validFiles(selected);
  return { files: selected, descriptor };
}

const NOTICE = `# Local CAMAP module adoption\n\nGenerated from local CAMAP2 sources using its original Joomla generator.\nNo CAMAP source is added to the generic MINIJOOMLA core. Root license files,\nwhen present in the source, are preserved verbatim and inventoried. Absence of\na source license is recorded, never replaced by an invented grant. References\nto Joomla/Phoca/other projects in module source are not rights clearances.\n\nThis package is an offline preparation, not a migrated extension, a tenant\nrelease, a rights audit or approval for public distribution. Runtime settings\nand their links/images/data still need independent review.\n`;

/** Materialize an individually validated package, never an aggregate host. */
export async function writeModuleAdoption(input = {}) {
  const plan = options(input);
  await newDestination(plan.destination);
  const selected = selectModuleAdoption(input);
  const files = new Map(selected.files);
  const licenses = input.licenses ?? new Map();
  if (!(licenses instanceof Map)) throw new Error('licenses must be a Map.');
  for (const [name, bytes] of licenses) {
    if (!LICENSE_NAMES.includes(name)) throw new Error(`Unapproved license path: ${name}`);
    files.set(name, bytes);
  }
  files.set('docs/ADOPTION-NOTICE.md', Buffer.from(NOTICE));
  const moduleStyles = { [plan.definition.key]: selected.descriptor.styles.map((url) => url.slice(`${plan.base}/`.length)) };
  const moduleKeys = { [plan.module]: plan.definition.key };
  const adoptionPlan = {
    format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module: plan.module,
    key: plan.definition.key, version: plan.version, base: plan.base, pilot: plan.definition.pilot,
    validation: 'XML runtime profile, typed schema, JavaScript import closure, CSS no-import/no-url, SHA256 inventory',
    licenses: [...licenses.keys()].sort(), sourceLicensePresent: licenses.size > 0,
    publicationApproved: false, rightsApproved: false, migrated: false, tenantModified: false,
    hostConfigured: false, currentRecordsModified: false,
    nextGate: plan.definition.pilot ? 'Pilot lifecycle verification by the coordinator; preserve the current 40 sample records.' : 'Prepare only; adoption waits for the pilot lifecycle gate.',
    hostNote: 'One root proposal only. Never merge all eleven plans automatically; XML discovery permits at most ten roots. Retained older revisions must use discover:false.'
  };
  files.set('adoption-plan.json', json(adoptionPlan));
  validFiles(files);
  const inventory = { format: 'minijoomla-joomla-package-v1', version: plan.version,
    files: [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: digest(bytes) })),
    moduleStyles, moduleKeys };
  const inventoryBytes = json(inventory);
  if (inventoryBytes.length > 64 * 1024) throw new Error('Inventory exceeds the runtime 64 KiB limit.');
  const entryPointUrl = selected.descriptor.entryPointUrl;
  const styleUrls = selected.descriptor.styles;
  const hostConfig = {
    joomlaDiscoveryRoots: [{ id: `camap-${plan.module}-${plan.version}`, baseUrl: plan.base, inventoryHash: digest(inventoryBytes), immutable: true, discover: true }],
    moduleStyles: { [plan.definition.key]: styleUrls },
    moduleStyleRevisions: { [plan.definition.key]: { [entryPointUrl]: styleUrls } }
  };
  // Neither host-config nor the inventory inventories itself. They are control
  // files; the host pins the inventory bytes through inventoryHash.
  files.set('MANIFEST-SHA256.json', inventoryBytes);
  files.set('host-config.json', json(hostConfig));
  await mkdir(dirname(plan.destination), { recursive: true });
  await newDestination(plan.destination);
  await mkdir(plan.destination); // exclusive reservation, not recursive
  for (const [name, bytes] of files) {
    const path = join(plan.destination, ...name.split('/'));
    await assertAdoptionNoLinks(path, { allowMissing: true });
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: 'wx' });
  }
  return { output: plan.destination, inventory, hostConfig, adoptionPlan, descriptor: selected.descriptor };
}

async function toolchain(source, dependencies) {
  const generatorPath = join(source, 'tools', 'prepare-joomla-modules.js');
  await assertAdoptionNoLinks(generatorPath);
  if (dependencies) await assertAdoptionNoLinks(dependencies);
  const require = createRequire(dependencies ? join(dependencies, 'package.json') : generatorPath);
  let lexerPath, cssPath;
  try {
    lexerPath = require.resolve('es-module-lexer');
    cssPath = require.resolve('css-tree');
    if (dependencies && (!within(join(dependencies, 'node_modules', 'es-module-lexer'), lexerPath) || !within(join(dependencies, 'node_modules', 'css-tree'), cssPath))) throw new Error('Required dependencies are absent from the explicitly isolated root.');
  } catch (cause) {
    throw Object.assign(new Error('Offline adoption blocked: original CAMAP generator requires locally installed es-module-lexer and css-tree. No install/network or regex fallback is permitted.', { cause }), { code: 'ADOPTION_DEPENDENCY_MISSING' });
  }
  await assertAdoptionNoLinks(lexerPath);
  await assertAdoptionNoLinks(cssPath);
  if (dependencies) {
    for (const [name, expected] of [['es-module-lexer', '1.7.0'], ['css-tree', '3.1.0']]) {
      const path = join(dependencies, 'node_modules', name, 'package.json');
      await assertAdoptionNoLinks(path);
      if (!within(join(dependencies, 'node_modules', name), name === 'css-tree' ? cssPath : lexerPath) || JSON.parse(await readFile(path, 'utf8')).version !== expected) throw new Error(`Isolated dependency must match CAMAP lock: ${name}@${expected}`);
    }
  }
  // With explicitly isolated dependencies only import routing changes in memory.
  // No generator algorithm/selection is patched, written, or distributed.
  let generatorUrl = pathToFileURL(generatorPath).href;
  if (dependencies) {
    let text = await readFile(generatorPath, 'utf8');
    for (const [statement, replacement] of [
      ["from 'es-module-lexer';", `from ${JSON.stringify(pathToFileURL(lexerPath).href)};`],
      ["from 'css-tree';", `from ${JSON.stringify(pathToFileURL(cssPath).href)};`]
    ]) {
      if (text.split(statement).length !== 2) throw new Error('Generator import routing changed; review required.');
      text = text.replace(statement, replacement);
    }
    text = text.replaceAll('import.meta.url', JSON.stringify(generatorUrl));
    generatorUrl = `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  }
  const [generator, lexer, css] = await Promise.all([
    import(generatorUrl), import(pathToFileURL(lexerPath).href), import(pathToFileURL(cssPath).href)
  ]);
  await lexer.init;
  if (typeof generator.prepareJoomlaModules !== 'function' || typeof generator.createXml !== 'function' || JSON.stringify(generator.JOOMLA_MODULES.map(({ folder, key }) => ({ folder, key }))) !== JSON.stringify(ADOPTION_MODULES.map(({ folder, key }) => ({ folder, key })))) throw new Error('Original generator API/module catalogue changed; review before adoption.');
  return { generator, parseImports: (text, name) => lexer.parse(text, name)[0], validateCss: (text, name) => {
    const ast = css.parse(text, { filename: name, positions: true });
    css.walk(ast, (node) => {
      if (node.type === 'Url' || node.type === 'Atrule' && node.name.toLowerCase() === 'import') throw new Error(`CSS url()/@import refused: ${name}`);
    });
  } };
}

/** Source-only bounded snapshot: no dist, PHP, tests, data, or generator fork. */
async function snapshotSources(source, snapshot) {
  const originals = new Map();
  const directories = new Map();
  let total = 0;
  async function copy(name) {
    const path = join(source, ...name.split('/'));
    await assertAdoptionNoLinks(path);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size > MAX_BYTES || originals.size >= MAX_FILES || (total += stat.size) > MAX_BYTES) throw new Error('CAMAP source exceeds the bounded file/byte contract.');
    const bytes = await readFile(path);
    if (bytes.length !== stat.size) throw new Error('Source changed during snapshot.');
    utf8(bytes, name);
    originals.set(path, bytes);
    const target = join(snapshot, ...name.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
  }
  await copy('extensions/camap/_shared/render.js');
  for (const { folder } of ADOPTION_MODULES) {
    const directory = join(source, 'extensions', 'camap', folder);
    await assertAdoptionNoLinks(directory);
    const entries = await readdir(directory, { withFileTypes: true });
    directories.set(directory, entries.map(({ name }) => name).sort());
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error(`Symlink/junction refused: ${entry.name}`);
      if (entry.isDirectory() && entry.name !== 'tests') throw new Error(`Unexpected nested module directory: ${entry.name}`);
      if (entry.isFile() && /\.(js|css)$/.test(entry.name)) {
        packagePath(entry.name);
        await copy(`extensions/camap/${folder}/${entry.name}`);
      }
    }
  }
  const licenses = new Map();
  for (const name of LICENSE_NAMES) {
    const path = join(source, name);
    await assertAdoptionNoLinks(path, { allowMissing: true });
    try { await lstat(path); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await copy(name);
    licenses.set(name, originals.get(path));
  }
  await writeFile(join(snapshot, 'package.json'), json({ private: true, type: 'module' }), { flag: 'wx' });
  return { licenses, check: async () => {
    for (const [path, bytes] of originals) {
      await assertAdoptionNoLinks(path);
      if (!(await readFile(path)).equals(bytes)) throw new Error('Source changed during adoption; retry after stabilization.');
    }
    for (const [path, entries] of directories) if (JSON.stringify((await readdir(path)).sort()) !== JSON.stringify(entries)) throw new Error('Source directory changed during adoption.');
  } };
}

async function generatedFiles(outDir) {
  const inventoryBytes = await readFile(join(outDir, 'MANIFEST-SHA256.json'));
  if (inventoryBytes.length > 64 * 1024) throw new Error('Generated inventory exceeds 64 KiB.');
  const inventory = JSON.parse(utf8(inventoryBytes, 'MANIFEST-SHA256.json'));
  if (inventory.format !== 'minijoomla-joomla-package-v1' || !Array.isArray(inventory.files) || inventory.files.length > MAX_FILES) throw new Error('Unexpected generator inventory.');
  const files = new Map();
  let total = 0;
  for (const file of inventory.files) {
    packagePath(file.path);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || (total += file.bytes) > MAX_BYTES || !/^[a-f0-9]{64}$/.test(file.sha256) || files.has(file.path)) throw new Error('Invalid generated inventory entry.');
    const path = join(outDir, ...file.path.split('/'));
    await assertAdoptionNoLinks(path);
    if ((await lstat(path)).size !== file.bytes) throw new Error(`Generated file size differs: ${file.path}`);
    const bytes = await readFile(path);
    if (digest(bytes) !== file.sha256) throw new Error(`Generated file hash differs: ${file.path}`);
    files.set(file.path, bytes);
  }
  validFiles(files);
  return files;
}

export async function prepareModuleAdoption(input = {}) {
  const plan = options(input);
  await newDestination(plan.destination);
  await assertAdoptionNoLinks(plan.source);
  const tools = await toolchain(plan.source, plan.dependencies); // fail before writes if unavailable
  await assertAdoptionNoLinks(TMP, { allowMissing: true });
  await mkdir(TMP, { recursive: true });
  const snapshot = await mkdtemp(join(TMP, 'adoption-agent-snapshot-'));
  const sources = await snapshotSources(plan.source, snapshot);
  // ALL is internal only because the original API has no other selection.
  // projectRoot confines every generator write to this private tmp snapshot.
  const generated = await tools.generator.prepareJoomlaModules({ module: 'all', version: plan.version, base: plan.base, projectRoot: snapshot, out: 'tmp/generated' });
  const files = await generatedFiles(generated.outDir);
  const moduleExports = await import(pathToFileURL(join(snapshot, 'extensions', 'camap', plan.module, 'module.js')).href);
  const definition = tools.generator.JOOMLA_MODULES.find(({ folder }) => folder === plan.module);
  const cssFiles = generated.moduleStyles[definition.key].map((path) => path.slice(`media/${definition.folder}/`.length));
  const xmlPath = `modules/${definition.folder}/${definition.folder}.xml`;
  if (utf8(files.get(xmlPath), xmlPath) !== tools.generator.createXml({ ...definition, cssFiles }, plan.version, moduleExports)) throw new Error('XML differs from the original generator createXml contract.');
  await sources.check();
  const result = await writeModuleAdoption({ ...input, files, moduleExports, licenses: sources.licenses, parseImports: tools.parseImports, validateCss: tools.validateCss });
  return { ...result, snapshot };
}

export function parseModuleAdoptionArgs(argv = process.argv.slice(2)) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { help: true };
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const name = { '--dependencies-root': 'dependenciesRoot', '--source': 'sourceRoot' }[key] ?? key.slice(2);
    if (!['--module', '--version', '--base', '--output', '--dependencies-root', '--source'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(args, name)) throw new Error('Invalid, duplicate or missing CLI argument.');
    args[name] = argv[i + 1];
  }
  options(args);
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseModuleAdoptionArgs();
    if (args.help) console.log('Usage: node scripts/prepare-module-adoption.js --module mod_camap_corpmessage --version 0.2.0 --base /SiteAssets/camap/mod_camap_corpmessage/0.2.0 --output tmp/new-individual-package [--source tmp/approved-source] [--dependencies-root tmp/approved-isolated-deps]');
    else {
      const result = await prepareModuleAdoption(args);
      console.log(`Prepared ${result.adoptionPlan.key} ${result.inventory.version}: ${result.inventory.files.length} inventoried files at ${result.output}. Not migrated or publication-approved.`);
    }
  } catch (error) { console.error(`prepare-module-adoption: ${error.message}`); process.exitCode = 1; }
}
