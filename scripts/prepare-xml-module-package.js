/* SPDX-License-Identifier: GPL-2.0-or-later
 * Offline preparation of explicit Joomla XML module packages; no publication.
 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { assertAdoptionNoLinks } from './prepare-module-adoption.js';
import { loadXmlGroupParserPorts } from './prepare-xml-module-group.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_FILES = 500;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PLAN_BYTES = 64 * 1024;
const CONTROL = ['MANIFEST-SHA256.json', 'host-config.json'];
const LICENSES = new Set(['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'COPYING.md', 'COPYING.txt', 'NOTICE', 'NOTICE.md', 'NOTICE.txt']);
const HASH = /^[a-f0-9]{64}$/;
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (root, path) => { const rel = relative(root, path); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)); };
const overlap = (a, b) => within(a, b) || within(b, a);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const NOTICE = `# XML module package preparation\n\nPrepared offline from an explicitly selected Joomla XML module source tree. Source license and documentation files are preserved verbatim. Their presence does not establish rights clearance. No JavaScript was executed. This package is not installed, migrated, published, or approved for public distribution.\n`;

function safeName(name) {
  packagePath(name);
  if (name.length > 240 || name.split('/').some(part => part.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error(`Unsafe Windows package path: ${name}`);
  return name;
}
function tmpPath(name) {
  safeName(name);
  if (!name.startsWith('tmp/') || name.includes('\\')) throw new Error('Use an explicit forward-slash path under this worktree tmp/.');
  const path = resolve(PROJECT, name);
  if (!within(join(PROJECT, 'tmp'), path) || path === join(PROJECT, 'tmp')) throw new Error('Path escapes tmp/.');
  return path;
}
function text(bytes, name) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error(`Invalid UTF-8: ${name}`); }
}
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`Unexpected/missing fields in ${label}.`);
}
function validatePlan(input) {
  exactKeys(input, ['format', 'packages'], 'plan');
  if (input.format !== 'minijoomla-xml-module-package-plan-v1' || !Array.isArray(input.packages) || input.packages.length < 1 || input.packages.length > 9) throw new Error('Plan must select 1..9 packages in minijoomla-xml-module-package-plan-v1 format.');
  const modules = new Set(), keys = new Set();
  for (const item of input.packages) {
    exactKeys(item, ['module', 'key', 'version', 'base', 'sourceRef'], 'package');
    if (typeof item.module !== 'string' || !/^mod_[a-z0-9_]+$/.test(item.module) || modules.has(item.module.toLowerCase())) throw new Error('Each module must be a unique mod_* token.');
    if (typeof item.key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(item.key) || ['constructor', 'prototype', '__proto__'].includes(item.key) || keys.has(item.key.toLowerCase())) throw new Error('Each extension key must be a unique explicit key token.');
    if (typeof item.version !== 'string' || item.version.length > 40 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(item.version)) throw new Error('Version must be explicit X.Y.Z without leading zeros.');
    if (typeof item.base !== 'string' || !/^\/[A-Za-z0-9_./-]+$/.test(item.base) || item.base.endsWith('/') || item.base.split('/').slice(1).some(part => !part || part === '.' || part === '..')) throw new Error('base must be an explicit canonical server-relative path without trailing slash.');
    if (typeof item.sourceRef !== 'string' || !item.sourceRef.trim() || item.sourceRef.length > 300 || /[\x00-\x1f]/.test(item.sourceRef)) throw new Error('sourceRef must identify the source/provenance without control characters.');
    modules.add(item.module.toLowerCase()); keys.add(item.key.toLowerCase());
  }
  return input;
}
function validateFiles(files) {
  if (!files.size || files.size > MAX_FILES) throw new Error('Package must contain 1..500 files.');
  let total = 0; const names = new Map(), dirs = new Map();
  for (const [name, bytes] of files) {
    safeName(name);
    if (names.has(name.toLowerCase())) throw new Error(`Case-colliding file: ${name}`);
    names.set(name.toLowerCase(), name);
    for (let parent = posix.dirname(name); parent !== '.'; parent = posix.dirname(parent)) {
      const old = dirs.get(parent.toLowerCase()); if (old && old !== parent) throw new Error(`Case-colliding directory: ${parent}`); dirs.set(parent.toLowerCase(), parent);
    }
    if (!Buffer.isBuffer(bytes) || (total += bytes.length) > MAX_BYTES) throw new Error('Package exceeds 10 MiB.');
  }
  for (const name of names.keys()) for (let parent = posix.dirname(name); parent !== '.'; parent = posix.dirname(parent)) if (names.has(parent)) throw new Error('File/directory collision.');
}
async function snapshot(root) {
  await assertAdoptionNoLinks(root);
  const files = new Map(), directories = new Map(); let entries = 0, total = 0;
  async function walk(dir, prefix = '') {
    await assertAdoptionNoLinks(dir);
    const children = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    if ((entries += children.length) > 1000) throw new Error('Source tree has too many entries.');
    const folded = new Set(); directories.set(prefix, children.map(child => child.name).sort());
    for (const child of children) {
      const name = safeName(`${prefix}${child.name}`);
      if (folded.has(child.name.toLowerCase())) throw new Error(`Case-colliding source entry: ${name}`); folded.add(child.name.toLowerCase());
      const path = join(dir, child.name); await assertAdoptionNoLinks(path); const stat = await lstat(path);
      if (stat.isDirectory()) { await walk(path, `${name}/`); continue; }
      if (!stat.isFile() || files.size >= MAX_FILES || (total += stat.size) > MAX_BYTES) throw new Error('Source file/type/byte limit exceeded.');
      const bytes = await readFile(path); if (bytes.length !== stat.size) throw new Error(`Source changed while reading: ${name}`); files.set(name, bytes);
    }
  }
  await walk(root); validateFiles(files); return { files, directories };
}
async function assertSameSnapshot(root, saved) {
  const current = await snapshot(root);
  if (!equal([...current.directories], [...saved.directories]) || current.files.size !== saved.files.size || [...saved.files].some(([name, bytes]) => !current.files.get(name)?.equals(bytes))) throw new Error('Source changed during preparation; retry from a stable tree.');
}
function docPath(name) { return name.startsWith('docs/') && !/\.(?:m?js|css|xml|php|sql)$/i.test(name) || LICENSES.has(name); }
function packageFor({ module, key, version, base, sourceRef }, source, parseImports, validateCss) {
  const files = new Map(source.files);
  const manifestPath = `modules/${module}/${module}.xml`;
  const manifest = files.get(manifestPath);
  if (!manifest) throw new Error(`Missing XML descriptor: ${manifestPath}`);
  const descriptor = parseJoomlaManifest(manifest, { baseUrl: base, manifestPath });
  if (descriptor.type !== 'Module' || descriptor.element !== module || descriptor.key !== key || descriptor.version !== version) throw new Error(`XML module/key/version differs from explicit plan for ${module}.`);
  if (descriptor.requiredFolders.length) throw new Error(`Open-ended XML <folder> declarations are refused: ${module}.`);

  const queue = [manifestPath, ...descriptor.requiredFiles], runtime = new Map();
  for (let index = 0; index < queue.length; index += 1) {
    const name = safeName(queue[index]);
    if (!(name.startsWith(`modules/${module}/`) || name.startsWith(`media/${module}/`))) throw new Error(`Runtime asset outside this module: ${name}`);
    if (runtime.has(name)) continue;
    const bytes = files.get(name); if (!bytes) throw new Error(`Missing declared/required asset: ${name}`);
    if (name !== manifestPath && !/\.(?:m?js|css)$/i.test(name)) throw new Error(`Unsupported runtime file type: ${name}`);
    runtime.set(name, bytes);
    if (/\.m?js$/i.test(name)) {
      for (const item of parseImports(text(bytes, name), name)) {
        if (!item || !Number.isInteger(item.d) || item.d >= 0 && typeof item.n !== 'string') throw new Error(`Non-literal dynamic import refused: ${name}`);
        if (item.n == null) continue;
        const specifier = item.n;
        if (typeof specifier !== 'string' || !/^(?:\.\/|\.\.\/)/.test(specifier) || /[\\%?#\x00-\x20\x7f]/.test(specifier) || specifier.split('/').some(part => !part)) throw new Error(`Bare/absolute/escaped import refused: ${name} -> ${specifier}`);
        const target = posix.normalize(posix.join(posix.dirname(name), specifier));
        safeName(target);
        if (!(target.startsWith(`modules/${module}/`) || target.startsWith(`media/${module}/`))) throw new Error(`Import escapes module package: ${name} -> ${specifier}`);
        queue.push(target);
      }
    } else if (/\.css$/i.test(name)) validateCss(text(bytes, name), name);
  }
  const output = new Map(runtime);
  for (const [name, bytes] of files) {
    if (runtime.has(name)) continue;
    if (name === 'docs/ADOPTION-NOTICE.md' || CONTROL.includes(name)) throw new Error(`Reserved output path in source: ${name}`);
    if (!docPath(name)) throw new Error(`Unreferenced source payload refused: ${name}`);
    if (name.startsWith('docs/')) text(bytes, name);
    output.set(name, bytes);
  }
  output.set('docs/ADOPTION-NOTICE.md', Buffer.from(NOTICE));
  const adoption = {
    format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module, key, version, base,
    source: { reference: sourceRef, revision: null }, validation: 'XML runtime profile, explicit JavaScript import closure, CSS no-url/no-import, SHA-256 inventory',
    sourceLicensePresent: [...files.keys()].some(name => LICENSES.has(name)), sourceLicensePaths: [...files.keys()].filter(name => LICENSES.has(name)).sort(),
    publicationApproved: false, rightsApproved: false, migrated: false, tenantModified: false, hostConfigured: false, currentRecordsModified: false
  };
  output.set('adoption-plan.json', jsonBytes(adoption));
  const styles = descriptor.styles.map(url => url.slice(`${base}/`.length));
  const inventory = {
    format: 'minijoomla-joomla-package-v1', version,
    files: [...output].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: digest(bytes) })),
    moduleStyles: { [key]: styles }, moduleKeys: { [module]: key }
  };
  const inventoryBytes = jsonBytes(inventory);
  if (inventoryBytes.length > MAX_PLAN_BYTES) throw new Error('Generated inventory exceeds 64 KiB.');
  const hostConfig = {
    joomlaDiscoveryRoots: [{ id: `xml-${module}-${version}`, baseUrl: base, inventoryHash: digest(inventoryBytes), immutable: true, discover: true }],
    moduleStyles: { [key]: descriptor.styles }, moduleStyleRevisions: { [key]: { [descriptor.entryPointUrl]: descriptor.styles } }
  };
  const finalFiles = new Map(output);
  finalFiles.set('MANIFEST-SHA256.json', inventoryBytes);
  finalFiles.set('host-config.json', jsonBytes(hostConfig));
  validateFiles(finalFiles);
  return { files: finalFiles, inventoryHash: digest(inventoryBytes), inventory, descriptor };
}
async function newOutput(path) {
  await assertAdoptionNoLinks(path, { allowMissing: true });
  try { await lstat(path); throw new Error(`Refusing existing output: ${path}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function paths({ plan, sourceRoot, output, deps }) {
  const planPath = tmpPath(plan), destination = tmpPath(output);
  if (!plan.endsWith('.json') || !/^tmp\/xml-module-packages-[A-Za-z0-9_-]+$/.test(output) || overlap(planPath, destination)) throw new Error('Plan must be tmp/*.json and output a separate new tmp/xml-module-packages-* directory.');
  if (!isAbsolute(sourceRoot)) throw new Error('--source-root must be an explicit absolute path.');
  const source = resolve(sourceRoot);
  if (overlap(source, destination) || overlap(source, planPath)) throw new Error('Source, plan and output must be separate.');
  const dependencies = deps ? tmpPath(deps) : null;
  if (dependencies && (overlap(dependencies, destination) || overlap(dependencies, planPath) || overlap(dependencies, source))) throw new Error('Dependency, source, plan and output paths must be separate.');
  return { planPath, source, destination, dependencies };
}
export async function prepareXmlModulePackages({ plan: planArg, sourceRoot, output, deps } = {}) {
  const target = paths({ plan: planArg, sourceRoot, output, deps });
  await newOutput(target.destination); await assertAdoptionNoLinks(target.planPath); await assertAdoptionNoLinks(target.source);
  const stat = await lstat(target.planPath); if (!stat.isFile() || stat.size > MAX_PLAN_BYTES) throw new Error('Plan must be a regular JSON file of at most 64 KiB.');
  const planBytes = await readFile(target.planPath), plan = validatePlan(JSON.parse(text(planBytes, 'plan')));
  const ports = await loadXmlGroupParserPorts(deps);
  const prepared = [];
  for (const item of plan.packages) {
    const root = join(target.source, item.module);
    await assertAdoptionNoLinks(root);
    const saved = await snapshot(root);
    prepared.push({ item, root, saved, result: packageFor(item, saved, ports.parseImports, ports.validateCss) });
  }
  await ports.check();
  if (!(await readFile(target.planPath)).equals(planBytes)) throw new Error('Plan changed during preparation.');
  for (const row of prepared) await assertSameSnapshot(row.root, row.saved);
  await newOutput(target.destination); await assertAdoptionNoLinks(target.destination, { allowMissing: true });
  await mkdir(target.destination); // exclusive reservation; no overwrite
  const results = [];
  for (const { item, result } of prepared) {
    const packageRoot = join(target.destination, item.module);
    await mkdir(packageRoot);
    for (const [name, bytes] of result.files) {
      const path = join(packageRoot, ...name.split('/')); await assertAdoptionNoLinks(path, { allowMissing: true });
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: 'wx' });
    }
    results.push({ module: item.module, key: item.key, version: item.version, inventoryHash: result.inventoryHash, files: result.inventory.files.length });
  }
  return { output: target.destination, packages: results, parserStage: ports.parserStage };
}
export function parseXmlModulePackageArgs(argv = process.argv.slice(2)) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { help: true };
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!['--plan', '--source-root', '--output', '--deps'].includes(flag) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(args, flag.slice(2))) throw new Error('Unknown/duplicate/missing CLI option.');
    args[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[i + 1];
  }
  paths(args); return args;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseXmlModulePackageArgs();
    if (args.help) console.log([
      'Usage: node scripts/prepare-xml-module-package.js --plan tmp/w2/individual-packages.json --source-root C:/source/xml-packages --output tmp/xml-module-packages-camap-v3 --deps tmp/step2/camap-source',
      'Plan format: {"format":"minijoomla-xml-module-package-plan-v1","packages":[{"module":"mod_example","key":"camap-v3-example","version":"0.1.0","base":"/teams/site/SiteAssets/minijoomla/extensions/group/0.1.0","sourceRef":"CAMAP-V3/xml-packages/mod_example"}]}',
      'Each source tree is <source-root>/<module> and output is <output>/<module>. Metadata and source selection are explicit. No install/network/publish.'
    ].join('\n'));
    else {
      const result = await prepareXmlModulePackages(args);
      for (const item of result.packages) console.log(`${item.module} ${item.key}@${item.version}: ${item.files} files; inventory ${item.inventoryHash}`);
      console.log(`Prepared ${result.packages.length} packages in ${result.output}. Not installed, published, rights-cleared or approved for distribution.`);
    }
  } catch (error) { console.error(`prepare-xml-module-package: ${error.message}`); process.exitCode = 1; }
}
