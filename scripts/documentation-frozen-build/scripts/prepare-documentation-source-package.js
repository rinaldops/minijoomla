/* SPDX-License-Identifier: GPL-2.0-or-later
 * Documentation-only source package; local/offline, no global rights approval.
 * Port/adaptation packaging changes: 09/11/2026. No new ownership claim.
 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDocumentationOverlay, DOCUMENTATION_SOURCE_PATH, DOCUMENTATION_CSS_PATH, documentationAdaptationXml, DOCUMENTATION_DEFAULTS, DOCUMENTATION_ANCHORS } from './prepare-documentation-adaptation.js';
import { copyNativeMap } from './prepare-home-adaptation.js';
import { copyInertBuffer, inertAdaptationMetadata } from './prepare-hero-adaptation.js';
import { SHARED_SOURCE_PATH } from './prepare-editorial-adaptation.js';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';

const SELF_SHA256 = 'f03d66e8331e4a1ddd58c69f927bb1a71413f10925b25f46a031fa9c7370df64';
const SELF_PATH = 'scripts/prepare-documentation-source-package.js';
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULE = 'mod_documentation';
const KEY = `camap.${MODULE}`;
const MAX_FILES = 500;
const MAX_BYTES = 10 * 1024 * 1024;
const ZERO = '0'.repeat(64);
export const documentationSourceSha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const sorted = map => [...map].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
const records = map => sorted(map).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: documentationSourceSha256(bytes) }));
const owns = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const SOURCE_PREFIX = 'source/minijoomla/';
const UPSTREAM_PREFIX = 'source/upstream/PhocaDocumentation/TemplateOverride/';
const LIB = `libraries/camap/${DOCUMENTATION_SOURCE_PATH}`;
const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${MODULE}/css/documentation.css`;
const ENTRY = `modules/${MODULE}/${MODULE}.js`;
const XML = `modules/${MODULE}/${MODULE}.xml`;
export const DOCUMENTATION_SOURCE_RUNTIME = Object.freeze([ENTRY, XML, CSS, LIB, SHARED]);
const FLAGS = Object.freeze({ rightsApproved: false, publicationApproved: false, vendorRightsCleared: false, migrated: false, tenantModified: false, hostConfigured: false, currentRecordsModified: false });

// Independently reviewed local bytes, not caller-supplied claims or inventories.
export const DOCUMENTATION_BUILD_PINS = Object.freeze({
  'scripts/prepare-documentation-adaptation.js': '251875899722c234713888c4f234a3bf5f80593f7558af422556159bed139047',
  'scripts/prepare-module-adoption.js': 'ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4',
  'scripts/prepare-home-adaptation.js': '43f5ef1b018d9fb07b621beca8b8ba48d32510a0f3bc151232020389d9b38d28',
  'scripts/prepare-hero-adaptation.js': '0085fbb0588383043233c887d2f7d8987f8c99512f712f7536ded281169bf04c',
  'scripts/prepare-editorial-adaptation.js': 'd3c32f45216439d430a4b63cf28a19d38c06e88d906ea8f40fb7f98c43bf3c1a',
  'src/libraries/minijoomla/application/joomla-manifest.js': 'b677f89889c382903580f7211f258806fe84ab9bff02ef75e3c482335381508a',
  'src/libraries/minijoomla/application/declared-params.js': '7cfad4b499b6a7540d2e525815552720abe65b803cefff3010d2f6507c2b0b2b',
  'src/libraries/minijoomla/application/extension-input.js': 'b70205b0149a777bd8f655e8be3efa65300c782ede6c62b6fd9ae4144b046326',
  'src/libraries/minijoomla/application/package-path.js': 'c1dd9406999d4b35bf501a31fb1ec2bc59db8842bd2dcfc46c0c773cd6db43d0',
  'src/libraries/minijoomla/core/contracts.js': '52214b1f427dba179a020cfbc9035272a4ffba31908d41711b0890be9a982b6b',
  'src/libraries/vendor/parse-xml/parse-xml.js': 'e69adeca44e0215c48216cee6187371a24371946cec23acd7980dfd41982e3ba'
});
export const DOCUMENTATION_UPSTREAM_PINS = Object.freeze({
  'copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation.php': '76e7fbbd9e20db250749a361c84c5264b2fff737e24eb11b4d069b2623282825',
  'copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation_items.php': '353d9793c02320cfb66a5ccf93d21163f06ad48a66bb9fb5d87fed2bc2db0a81',
  'copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation_subitems.php': '5725a6f269778fffda87c26e281af4ab8fecde05267fe063e56d9654a360a43f',
  'copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/category/documentation.php': '02660c8e398d673853a098cba39122f6fc41d071bace803538c3e8f1134fae9e',
  'copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/category/documentation_children.php': 'd8d29240434a84e1bd2e803c828a00775cbef128b36ffe20e77162bc0bfb2335',
  'copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/category/documentation_subitems.php': 'ea4a6bd530ac6f7b2651ba07b099ed117321b240a64c5a0b6427458539a17e36',
  'copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation.xml': 'aeec8043f5d96163057ebb4ed03bc13eadfe471ebd7cbf717c0ba83b189e5549',
  'copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/category/documentation.xml': 'f580f58db63cd7f6bf740d096075f24637a6afc0e035b92e7290d471c65905fa',
  'copy_to_MEDIA/com_phocadocumentation/css/main.css': 'b5ad8c407339f1b34cdfb4878dad2be07c0c1d34dfec7686b2f0a0069d77892d',
  'copy_to_MEDIA/com_phocadocumentation/images/svg-definitions.svg': '577c78f358bfdb21c774e8484ea50ab866041449d604a41926585667072b4460',
  'README.txt': 'd38836c5122f592ec551d710f0c00c8443ee1e67d937e6c4c9089bb9590c099a'
});
const PHOCA_LICENSE = 'GNU General Public License version 2 or later; http://www.gnu.org/copyleft/gpl.html';
const PHOCA_LICENSE_PATH = 'source/upstream/PhocaDocumentation/LICENSE';
const LICENSE_PINS = Object.freeze({
  'docs/licenses/CAMAP-ROOT-MIT.txt': '9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9',
  'docs/licenses/GPL-2.0.txt': '189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b',
  [`${SOURCE_PREFIX}LICENSE.md`]: '2a06b5b3c6be983acfbc4553800da058cd67a280d11df9b3d7179b94e65d550c',
  [`${SOURCE_PREFIX}src/libraries/vendor/parse-xml/LICENSE`]: '95c87f8929f115c4c03b0b748827167d6c7f3686dd74f451cce8064bb6a933df',
  [`${SOURCE_PREFIX}src/libraries/vendor/parse-xml/notices.txt`]: '1e5cf8f9cc317d5b09955f8f48c3eb1024795f320d626dc109280241c9328584',
  [PHOCA_LICENSE_PATH]: 'b8b2c2a80dbc38eb6b7c27ea374a5c0ead24449524671a65722f4ef4ade5c670'
});
const OLD_RUNTIME_PINS = Object.freeze({ [SHARED]: 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76', [LIB]: 'a79ee923b8152e1a3563e7baaee98d70356e8d76611c38877e62b7e48cbdf7b9', [CSS]: '062b19ac80d014ba2bc2d95313333d227a1af8f21f07d5c60afa5ec39cbff22e' });
export const DOCUMENTATION_DERIVATION_HEADER = `/*
 * SPDX-License-Identifier: GPL-2.0-or-later
 * Copyright (C) 2006, 2009, 2010 Open Source Matters. All rights reserved.
 * Copyright (C) Jan Pavelka, www.phoca.cz.
 * Phoca Documentation/Joomla selected-source derived port; port/adaptation notices: 09/11/2026.
 * GPL-2.0-or-later applies to this derived work, not only new patches.
 * See docs/UPSTREAM-NOTICE.md, docs/LICENSE-LINKAGE.json and docs/licenses/GPL-2.0.txt.
 * Inline port SVG differs from upstream: this is not independent icon-rights proof.
 * No global vendor-rights, installation or publication approval; no new ownership claim.
 */
`;
export const DOCUMENTATION_HELPER_HEADER = `/*
 * Historical helper notice: MIT, Copyright (c) 2026 Rinaldo Paulino de Souza.
 * Exact historical aggregator notice: docs/licenses/CAMAP-ROOT-MIT.txt.
 * Authored strict URL-policy adaptation: GPL-2.0-or-later, changes recorded 09/11/2026.
 * Separate scopes; aggregator MIT does not license the Phoca/Joomla derived port.
 * See docs/LICENSE-LINKAGE.json. No new ownership claim or global rights approval.
 */
`;
const UPSTREAM_NOTICE = `# Selected Phoca Documentation / Joomla provenance — 09/11/2026

Copyright (C) 2006, 2009, 2010 Open Source Matters. All rights reserved.
Copyright (C) Jan Pavelka, www.phoca.cz.

The six PHP views, two XML definitions and CSS are selected upstream source DATA.
Their original headers/bytes remain intact. README and SVG are comparison-only
provenance; upstream SVG is not a runtime asset and no icons are copied by this build.
Different inline SVG in the port does NOT prove independent ownership/rights.

The Documentation JS/CSS derived port and its adaptation are GPL-2.0-or-later
as a complete derived work, not merely the authored patches. Full GPL v2 text:
docs/licenses/GPL-2.0.txt. Upstream version-2-or-later linkage is preserved in
source/upstream/PhocaDocumentation/LICENSE (exact bytes, no final newline).
This is scoped preservation/linkage, not blanket legal compliance or approval.
Historical aggregator MIT identity is retained separately for the shared helper;
its strict URL-policy changes are GPL-2.0-or-later. MIT is NOT the upstream license.

Review supplied by the coordinating session: official Phoca documentation links
to https://github.com/PhocaCz/PhocaDocumentation/releases/download/6.0.0/phocadocumentation_override_v6.0.0.zip
SHA-256 96aa8d209cd1aefe9d08dae8a233d434e282d75759e6b17f51d597344d20555f;
19075 bytes. All 12 local entries matched that ZIP, including the excluded swap.
Selected 11 references also match TemplateOverride git blobs at commit
f2386b6b935c82f0fa0d94881c144ef1d91af0f9. Do not use tag 6's old source archive.
Pinned LICENSE URL: https://raw.githubusercontent.com/PhocaCz/PhocaDocumentation/f2386b6b935c82f0fa0d94881c144ef1d91af0f9/LICENSE
Additional coordinating-session evidence, 09/11/2026: PowerShell Invoke-WebRequest
GET of that pinned URL returned HTTP 200; exact RawContentStream was 83 bytes,
SHA-256 b8b2c2a80dbc38eb6b7c27ea374a5c0ead24449524671a65722f4ef4ade5c670.
Default Windows trust store, no TLS/certificate bypass. Earlier Node/webfetch
TLS/transport attempts failed; this later successful HTTP evidence is distinct.
No network operation, PHP execution or upstream-download revalidation is done
by this packager/rebuild. Technical source/linkage checks are not legal approval.
rightsApproved/publicationApproved/vendorRightsCleared remain false.
`;
const REBUILD_NOTICE = `# Offline corresponding/preferred source

Node.js >= 24; only included ES modules and Node system libraries; no npm,
network, PHP, Office, browser, sibling CAMAP2 or external MINIJOOMLA checkout.
Run from the package root:

    node source/rebuild.mjs --version 0.5.0 --base /offline/documentation/0.5.0 --output tmp/documentation-adapt-agent-source-rebuilt

Only versions 0.5.0 and 0.5.1 are allowed. Older profiles are immutable archives,
not inputs to this new finalizer. --base must be explicit; --output
must name a new tmp/documentation-adapt-agent-source-* tree. Existing outputs
are never overwritten. All original inputs and statically imported build-support
bytes are independently pinned and rechecked. Final runtime is unminified and
also included under source/preferred/ with the identical scoped notices.
source/minijoomla contains exact local build-support bytes, including incidental
static imports of old adapters (their broad builders are NEVER called), the
standalone ISC XML parser, its complete license/notices and project license.
The parser is build support, not runtime or a claim of complete upstream parser
development sources. The offline rebuild does not recompile the ISC bundle.
LICENSE.md is preserved byte-exact; its relative GPL/third-party links resolve
inside source/minijoomla through a duplicate GPL text and a scoped bridge notice.
docs/DERIVATION-MAP.json relates included upstream/local ranges to every runtime
function, field/default/constraint and CSS selector, including concrete differences.
Ranges and anchors are checked against included bytes; full-file and LF-normalized
range SHA-256 are materialized and regenerated, never accepted as caller evidence.

All files are regenerated byte-for-byte, including inventory/host metadata;
only explicit base/version alter bytes. No timestamps, private paths, host
defaults or caller-supplied trust hashes enter metadata. Inventory excludes
itself and host-config to avoid a hash cycle; host-config pins the inventory,
and the independent finalizer compares both against canonical generated bytes.
BUILD-CLOSURE lists actual SHA-256/byte records including this packager and
the launcher. The packager's embedded normalized source pin removes only its
own pin value to avoid self-hash recursion; this is NOT a digital signature.
An independently trusted original finalizer/launcher or external package digest
is required against substitution of the entire trust root. Rehashing inventory
alone never authorizes changed license, notice, source or extra files.
No global legal, privacy, installation, publication or operational approval.
`;

function normalizedSelf(bytes) {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes) || (text.match(/const SELF_SHA256 = '[a-f0-9]{64}';/g) ?? []).length !== 1) throw new Error('Invalid packager source pin declaration.');
  return Buffer.from(text.replace(/const SELF_SHA256 = '[a-f0-9]{64}';/, `const SELF_SHA256 = '${ZERO}';`));
}
function pin(bytes, expected, path) { if (!bytes || documentationSourceSha256(bytes) !== expected) throw new Error(`Independent SHA-256 pin refused: ${path}`); }
function inputPaths() {
  return [...Object.keys(DOCUMENTATION_ANCHORS).map(p => `source/originals/${p}`), ...Object.keys(DOCUMENTATION_UPSTREAM_PINS).map(p => `${UPSTREAM_PREFIX}${p}`), ...Object.keys(DOCUMENTATION_BUILD_PINS).map(p => `${SOURCE_PREFIX}${p}`), `${SOURCE_PREFIX}${SELF_PATH}`, ...Object.keys(LICENSE_PINS)];
}
function safeMap(input) {
  const map = copyNativeMap(input, 'Documentation package files'); const result = new Map(); const seen = new Set(); const budget = { bytes: 0 };
  for (const [path, bytes] of map) {
    if (typeof path !== 'string' || path.length > 240) throw new Error('Bounded string package path required.');
    packagePath(path);
    if (path.split('/').some(p => p.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)) || seen.has(path.toLowerCase())) throw new Error('Unsafe or case-colliding package path.');
    seen.add(path.toLowerCase()); result.set(path, copyInertBuffer(bytes, budget, path));
  }
  return result;
}
function validateInputs(input) {
  const files = safeMap(input); const paths = inputPaths();
  if (files.size !== paths.length || paths.some(p => !files.has(p))) throw new Error('Exactly the closed Documentation source inputs required.');
  for (const [p, hashes] of Object.entries(DOCUMENTATION_ANCHORS)) if (!hashes.includes(documentationSourceSha256(files.get(`source/originals/${p}`)))) throw new Error(`Original source pin refused: ${p}`);
  for (const [p, h] of Object.entries(DOCUMENTATION_UPSTREAM_PINS)) pin(files.get(`${UPSTREAM_PREFIX}${p}`), h, p);
  for (const [p, h] of Object.entries(DOCUMENTATION_BUILD_PINS)) pin(files.get(`${SOURCE_PREFIX}${p}`), h, p);
  for (const [p, h] of Object.entries(LICENSE_PINS)) pin(files.get(p), h, p);
  const self = files.get(`${SOURCE_PREFIX}${SELF_PATH}`);
  pin(normalizedSelf(self), SELF_SHA256, SELF_PATH);
  if (!self.toString().includes(`const SELF_SHA256 = '${SELF_SHA256}';`)) throw new Error('Packager source trust root changed.');
  // Discover the full static import closure starting at ONLY the code we call.
  // Dynamic imports in unused legacy CLI/build functions are never invoked.
  const seen = new Set();
  function visit(p) {
    if (seen.has(p)) return; seen.add(p);
    const bytes = files.get(`${SOURCE_PREFIX}${p}`); if (!bytes) throw new Error(`Missing static import: ${p}`);
    const staticText = p === SELF_PATH ? bytes.toString().slice(0, bytes.toString().indexOf('const SELF_SHA256')) : bytes.toString();
    for (const match of staticText.matchAll(/^\s*(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[^;]*?\s+from\s+)['"]([^'"]+)['"]/gm)) {
      const specifier = match[1];
      if (specifier.startsWith('node:')) continue;
      if (!specifier.startsWith('.')) throw new Error('Non-Node external static dependency refused.');
      const target = posix.normalize(posix.join(posix.dirname(p), specifier)); packagePath(target); visit(target);
    }
  }
  visit(SELF_PATH);
  if (seen.size !== Object.keys(DOCUMENTATION_BUILD_PINS).length + 1 || Object.keys(DOCUMENTATION_BUILD_PINS).some(p => !seen.has(p))) throw new Error('Build source closure differs from independently reviewed pins.');
  return files;
}

function options(input, requireOutput = false) {
  const clean = inertAdaptationMetadata(input);
  if (!clean || typeof clean !== 'object' || Array.isArray(clean) || Buffer.isBuffer(clean) || Object.keys(clean).some(k => !['version', 'base', 'output', 'module'].includes(k) || typeof clean[k] !== 'string')) throw new Error('Closed primitive string options required.');
   const version = clean.version ?? '0.5.0';
   if (!['0.5.0', '0.5.1'].includes(version) || clean.module !== undefined && clean.module !== MODULE) throw new Error('Only Documentation 0.5.0/0.5.1 authorized.');
  if (typeof clean.base !== 'string' || clean.base.length > 180 || !/^\/[A-Za-z0-9_./-]+$/.test(clean.base) || clean.base.split('/').slice(1).some(p => !p || p === '.' || p === '..')) throw new Error('Explicit neutral server-relative --base required.');
  if (requireOutput || clean.output !== undefined) {
    if (typeof clean.output !== 'string' || !/^tmp\/documentation-adapt-agent-source-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(clean.output) || clean.output.length > 180) throw new Error('New tmp/documentation-adapt-agent-source-* output required.');
    packagePath(clean.output);
    if (clean.output.split('/').some(p => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(p))) throw new Error('Unsafe Windows output.');
  }
  return { version, base: clean.base, ...(clean.output !== undefined ? { output: clean.output } : {}) };
}
export function parseDocumentationSourceArgs(argv = process.argv.slice(2)) {
  // Native dense argv, without getters, symbols, custom properties or hooks.
  if (!Array.isArray(argv) || Object.getPrototypeOf(argv) !== Array.prototype) throw new Error('Native argv array required.');
  const length = Object.getOwnPropertyDescriptor(argv, 'length')?.value;
  if (!Number.isSafeInteger(length) || length > 8) throw new Error('Dense inert bounded argv required.');
  const d = Object.getOwnPropertyDescriptors(argv); const keys = Reflect.ownKeys(d);
  if (keys.length !== length + 1 || keys.some(k => typeof k !== 'string' || !Object.hasOwn(d[k], 'value') || k !== 'length' && !/^(0|[1-9]\d*)$/.test(k))) throw new Error('Dense inert bounded argv required.');
  const values = []; for (let i = 0; i < length; i++) { if (typeof d[i]?.value !== 'string') throw new Error('String argv required.'); values.push(d[i].value); }
  if (values.length === 1 && ['--help', '-h'].includes(values[0])) return { help: true };
  const out = {};
  for (let i = 0; i < values.length; i += 2) { const key = values[i]; if (!['--version', '--base', '--output', '--module'].includes(key) || !values[i + 1] || Object.hasOwn(out, key.slice(2))) throw new Error('Invalid/duplicate/missing CLI argument.'); out[key.slice(2)] = values[i + 1]; }
  return options(out, true);
}

function launcherSource() {
  // Bootstrap checks executable sources before import, including the packager.
  // Only this fixed launcher is emitted; it has no caller hash policy.
  return Buffer.from(`/* SPDX-License-Identifier: GPL-2.0-or-later; offline Documentation bootstrap. */
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = ${JSON.stringify(DOCUMENTATION_BUILD_PINS, null, 2)};
const self = ${JSON.stringify(SELF_PATH)};
async function noLinks(path) { for (let p = resolve(path); ; p = dirname(p)) { const s = await lstat(p); if (s.isSymbolicLink() || s.isFile() && s.nlink !== 1) throw new Error('Links refused before import.'); if (p === dirname(p)) break; } }
try {
  for (const [path, hash] of Object.entries(pins)) { const p = resolve(root, 'source/minijoomla', path); await noLinks(p); if (digest(await readFile(p)) !== hash) throw new Error('Build source pin refused: ' + path); }
  const p = resolve(root, 'source/minijoomla', self); await noLinks(p); const bytes = await readFile(p); const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes) || (text.match(/const SELF_SHA256 = '[a-f0-9]{64}';/g) ?? []).length !== 1 || !text.includes("const SELF_SHA256 = '${SELF_SHA256}';") || digest(Buffer.from(text.replace(/const SELF_SHA256 = '[a-f0-9]{64}';/, "const SELF_SHA256 = '${ZERO}';"))) !== '${SELF_SHA256}') throw new Error('Packager independent pin refused.');
  const api = await import(pathToFileURL(p).href);
  const args = api.parseDocumentationSourceArgs();
   if (args.help) console.log('node source/rebuild.mjs --version 0.5.0|0.5.1 --base /offline/documentation/0.5.0 --output tmp/documentation-adapt-agent-source-new');
  else { const result = await api.rebuildDocumentationSourcePackage(root, args); console.log('Rebuilt ' + result.version + ': ' + result.files.size + ' files. Global rights/publication gates remain closed.'); }
} catch (error) { console.error('documentation-rebuild: ' + error.message); process.exitCode = 1; }
`);
}
function linkage(files) {
  const derivation = [LIB, CSS, `source/preferred/${LIB}`, `source/preferred/${CSS}`, `source/originals/${DOCUMENTATION_SOURCE_PATH}`, `source/originals/${DOCUMENTATION_CSS_PATH}`];
  return {
    format: 'minijoomla-documentation-license-linkage-v1', reviewDate: '2026-11-09',
    upstream: { project: 'PhocaDocumentation / Joomla selected references', commit: 'f2386b6b935c82f0fa0d94881c144ef1d91af0f9', release: { url: 'https://github.com/PhocaCz/PhocaDocumentation/releases/download/6.0.0/phocadocumentation_override_v6.0.0.zip', bytes: 19075, sha256: '96aa8d209cd1aefe9d08dae8a233d434e282d75759e6b17f51d597344d20555f', evidence: 'coordinating-session upstream review; no download performed by offline generator' }, license: 'GPL-2.0-or-later', licenseRecord: records(new Map([[PHOCA_LICENSE_PATH, files.get(PHOCA_LICENSE_PATH)]]))[0], selectedReferences: records(new Map(sorted(files).filter(([p]) => p.startsWith(UPSTREAM_PREFIX)))), swapExcluded: true, tagSourceArchiveUsed: false },
    derivation: { license: 'GPL-2.0-or-later', scope: 'complete selected Documentation derived JS/CSS work, including port and adaptation; not only authored patches', paths: derivation, fullText: 'docs/licenses/GPL-2.0.txt', notices: 'docs/UPSTREAM-NOTICE.md', copyrights: ['Copyright (C) 2006, 2009, 2010 Open Source Matters. All rights reserved.', 'Copyright (C) Jan Pavelka, www.phoca.cz.'] },
    helper: { historicalLicense: 'MIT', notice: 'docs/licenses/CAMAP-ROOT-MIT.txt', originCommit: '124ac3ea1d002fe7dc517a7d03513d1238396dac', identity: 'historical aggregator root LICENSE; not upstream ownership/license', paths: [SHARED, `source/preferred/${SHARED}`, `source/originals/${SHARED_SOURCE_PATH}`], authoredStrictUrlChanges: 'GPL-2.0-or-later' },
    buildSupport: { projectLicense: `${SOURCE_PREFIX}LICENSE.md`, gplText: `${SOURCE_PREFIX}docs/licenses/GPL-2.0.txt`, thirdPartyBridge: `${SOURCE_PREFIX}docs/THIRD-PARTY-NOTICES.md`, scope: 'included MINIJOOMLA-authored static support and packager GPL-2.0-or-later; not original CAMAP modules or blanket vendor rights', iscParser: { path: `${SOURCE_PREFIX}src/libraries/vendor/parse-xml/parse-xml.js`, license: `${SOURCE_PREFIX}src/libraries/vendor/parse-xml/LICENSE`, notice: `${SOURCE_PREFIX}src/libraries/vendor/parse-xml/notices.txt`, runtimeDependency: false } },
    derivationMap: 'docs/DERIVATION-MAP.json',
    licenseAcquisition: { evidence: 'coordinating-session PowerShell Invoke-WebRequest GET; default Windows trust store, no bypass', reviewDate: '2026-11-09', status: 200, bytes: 83, sha256: LICENSE_PINS[PHOCA_LICENSE_PATH], earlierAttempts: 'Node/webfetch TLS/transport failures; distinct from later successful coordinator HTTP read', generatorNetworkUsed: false },
    icons: { upstreamSvg: 'provenance comparison only; not a copied runtime asset', portInlineSvg: 'different geometry does not prove independent rights' }, ...FLAGS
  };
}

const THIRD_PARTY_BRIDGE = `# Included Documentation build-support notices — 09/11/2026

This is a scoped bridge for the preserved LICENSE.md, not the full project's
third-party inventory. Only the source closure in this package is covered.
MINIJOOMLA-authored static support/packager is GPL-2.0-or-later: see
[full GPL v2 text](licenses/GPL-2.0.txt). Incidental Home/Hero/Editorial adapter
imports are local authored support; no original other-module sources are copied
and their broad legacy builders are never called.

The included ISC XML parser is build support only, not runtime:
[LICENSE](../src/libraries/vendor/parse-xml/LICENSE) and
[notices](../src/libraries/vendor/parse-xml/notices.txt) are preserved byte-exact.
The offline build does not recompile that bundle or claim its entire development
source tree. Documentation's selected Phoca/Joomla derived work and the historical
MIT helper have separate scopes: see [linkage](../../../docs/LICENSE-LINKAGE.json),
[upstream notice](../../../docs/UPSTREAM-NOTICE.md) and
[derivation map](../../../docs/DERIVATION-MAP.json).
Plugin mentions in historical source/README are comparison context, NOT selected
plugin sources, dependencies or clearance. No blanket source/vendor rights,
ownership, publication, privacy, installation or host/site approval is granted.
`;

// Line numbers are 1-based/inclusive after the unchanged 0.4 scoped headers.
// Hash original bytes separately from the explicitly LF-normalized range text.
// A reference is constructed ONLY from pinned/generated files and checked anchors.
function derivationMap(files) {
  const adapter = `${SOURCE_PREFIX}scripts/prepare-documentation-adaptation.js`;
  const original = `source/originals/${DOCUMENTATION_SOURCE_PATH}`;
  const originalCss = `source/originals/${DOCUMENTATION_CSS_PATH}`;
  const originalHelper = `source/originals/${SHARED_SOURCE_PATH}`;
  const up = (view, name, extension = 'php') => `${UPSTREAM_PREFIX}copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/${view}/documentation${name ? `_${name}` : ''}.${extension}`;
  const cats = up('categories', ''), items = up('categories', 'items'), subitems = up('categories', 'subitems');
  const cat = up('category', ''), children = up('category', 'children'), subchildren = up('category', 'subitems');
  const catsXml = up('categories', '', 'xml'), catXml = up('category', '', 'xml');
  const mainCss = `${UPSTREAM_PREFIX}copy_to_MEDIA/com_phocadocumentation/css/main.css`;
  const svg = `${UPSTREAM_PREFIX}copy_to_MEDIA/com_phocadocumentation/images/svg-definitions.svg`;
  function lines(path) {
    const bytes = files.get(path);
    if (!bytes || !Buffer.from(bytes.toString('utf8')).equals(bytes)) throw new Error(`Derivation UTF-8 source missing: ${path}`);
    return bytes.toString('utf8').replace(/\r\n?/g, '\n').split('\n');
  }
  function ref(path, startLine, endLine, anchors) {
    const text = lines(path);
    if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine || endLine > text.length || !anchors.length) throw new Error(`Derivation range refused: ${path}`);
    const range = text.slice(startLine - 1, endLine).join('\n');
    if (anchors.some(a => typeof a !== 'string' || !a || !range.includes(a))) throw new Error(`Derivation anchor refused: ${path}:${startLine}-${endLine}`);
    return { path, startLine, endLine, anchors, fileSha256: documentationSourceSha256(files.get(path)), rangeSha256: documentationSourceSha256(Buffer.from(range)), rangeEncoding: 'UTF-8, LF-normalized, inclusive lines joined without added newline' };
  }
  function one(path, anchor) {
    const text = lines(path); const indexes = text.flatMap((line, i) => line.includes(anchor) ? [i + 1] : []);
    if (indexes.length !== 1) throw new Error(`Unique derivation anchor required: ${path}: ${anchor}`);
    return ref(path, indexes[0], indexes[0], [anchor]);
  }
  function fn(path, name) {
    const text = lines(path); const pattern = new RegExp(`^\uFEFF?(?:export )?function ${name}\\(`);
    const start = text.findIndex(line => pattern.test(line));
    if (start < 0) throw new Error(`Derivation function missing: ${name}`);
    const end = text[start].trim().endsWith('}') ? start : text.findIndex((line, i) => i > start && line === '}');
    if (end < start) throw new Error(`Derivation function end missing: ${name}`);
    return ref(path, start + 1, end + 1, [`function ${name}(`]);
  }
  const r = (path, start, end, ...anchors) => ref(path, start, end, anchors);
  const ownGuards = 'Local inert JSON-like guards, not translated PHP: own descriptors, strict primitive strings/booleans/numbers/URLs, bounded arrays/articles/keys/text; duplicate IDs reject the tree, cyclic ancestry and descendants removed. No Joomla data model, ACL or publication-date equivalence.';
  const functions = [];
  const add = (name, sources, differences, path = LIB) => functions.push({ name, target: fn(path, name), sources, relationship: 'selected layout adaptation or local implementation, not behavioral equivalence', differences });
  for (const name of ['_docPlain', '_docOwn', '_docArray', '_docString', '_docId', '_docHref', '_docNumber', '_docPage', 'normalizeArticle', 'normalizeCategory', 'buildTree', 'normalizeConfig', '_docContext']) {
    const target = fn(LIB, name);
    const sources = [r(adapter, target.startLine - 63, target.endLine - 63, `function ${name}(`), r(adapter, 204, 239, 'applyDocumentationOverlay', 'patched')];
    if (['normalizeArticle', 'normalizeCategory', 'buildTree', 'normalizeConfig'].includes(name)) sources.push(fn(original, name));
    add(name, sources, ownGuards);
  }
  add('renderCategoryCards', [fn(original, 'renderCategoryCards'), r(items, 18, 84, '$this->maxLevelcat', 'card-title', 'tmpl_hide_categories'), r(subitems, 16, 48, 'list-group', "loadTemplate('subitems')")], 'Recursive cards replace upstream nested ul/li lists; no tmpl_hide_categories; card images ignore showDescriptionImage unlike upstream show_description_image. Descriptions are escaped plain text, no content.prepare; supplied counts/routes, no CMS translation. -1 recurses locally (hard depth 20), unlike PHP maxLevelcat > 1. Grid is recreated, not a class-only rename.');
  add('renderCategoriesView', [fn(original, 'renderCategoriesView'), r(cats, 52, 77, 'show_page_heading', 'show_base_description', "loadTemplate('items')")], 'Own combined-view config/JSON tree and local defaults; no database fallback, content.prepare, module lookup or tmpl_hide_categories. Escaped plain text, local empty-state message.');
  add('renderChildrenList', [fn(original, 'renderChildrenList'), r(children, 24, 80, '$this->maxLevel', 'show_subcat_desc_cat', "loadTemplate('subitems')"), r(subchildren, 19, 47, 'list-group', '$this->maxLevel > 1')], 'Local recursive ul/li retains counts/descriptions at all depths unlike upstream subitems; showSubcatDesc uses local config, upstream children reads show_subcat_desc_cat (not show_subcat_desc). No child images, tmpl_hide_categories, CMS routes/translation/content.prepare/getNumItems(true). -1 unlimited locally until hard depth 20, PHP uses > 1.');
  add('renderPagination', [fn(original, 'renderPagination'), r(cat, 185, 195, 'show_pagination', 'getPagesCounter', 'getPagesLinks'), r(catXml, 340, 365, 'name="show_pagination"', 'name="show_pagination_results"'), r(adapter, 227, 231, 'pageStart', 'prevHref', 'nextHref')], 'Own precomputed page/totalPages/prevHref/nextHref object, not JPagination. No separate show_pagination/show_pagination_results controls, page links or Joomla auto mode; local labels and strict URL/number guards.');
  add('renderCategoryView', [fn(original, 'renderCategoryView'), r(cat, 60, 133, '$htag', 'show_cat_tags', 'content.prepare'), r(cat, 138, 184, '// Articles', 'access-view', "loadTemplate('children')"), r(adapter, 221, 226, 'c.tree', 'backHref')], 'Own active-ID lookup, root labels/routes, escaped content, tags as string arrays not CMS tag objects/layouts. No plugin events, content.prepare, structured-data Blog attributes, Joomla language/router services or tmpl_hide_categories. Boolean published only: not ACL/access-view/show_noauth nor publish_up/publish_down/state/date logic.');
  add('renderDocumentation', [fn(original, 'renderDocumentation'), r(original, 8, 18, 'plugin', 'render(context)'), r(SHARED, 8, 31, 'escapeHtml', 'safeUrl', 'stateMessage'), r(adapter, 232, 233, 'stateMessage', '_docContext')], 'Own synchronous render contract/status handling and combined two-view dispatch; plugin mention is historical context, NOT a selected dependency/source. No CMS lifecycle or network.');
  add('escapeHtml', [r(originalHelper, 1, 1, 'escapeHtml')], 'Historical helper preserved after LF normalization; runtime consumers supply normalized inert values.', SHARED);
  add('_allowedEditorialUrl', [r(`${SOURCE_PREFIX}scripts/prepare-editorial-adaptation.js`, 47, 67, 'SAFE_URL_SOURCE', '_allowedEditorialUrl'), r(adapter, 214, 214, 'SAFE_URL_SOURCE'), r(originalHelper, 2, 2, 'safeUrl')], 'Local authored strict URL guard replaces permissive historical regex; GPL changes separate from MIT historical notice.', SHARED);
  add('safeUrl', [r(originalHelper, 2, 2, 'safeUrl'), r(`${SOURCE_PREFIX}scripts/prepare-editorial-adaptation.js`, 68, 68, 'safeUrl'), r(adapter, 214, 214, 'SAFE_URL_SOURCE')], 'Local strict URL policy; not Joomla Route/RouteHelper.', SHARED);
  add('stateMessage', [r(originalHelper, 3, 3, 'stateMessage')], 'Own historical loading/error/empty messages, not CMS translation/lifecycle.', SHARED);
  const articles = { name: 'publishedArticles', target: r(LIB, 432, 444, 'a.published', 'showNoArticles'), sources: [r(original, 383, 395, 'a.published'), r(cat, 138, 171, 'publish_up', 'publish_down', 'access-view', 'show_noauth')], differences: 'Supplied boolean published only; no ACL/access-view/show_noauth, publication date window, ContentComponent state or complete Joomla publication equivalence.' };
  const localDefault = 'Default is explicit LOCAL port policy, not inferred upstream useglobal/default equivalence. Primitive types and max lengths are local schema constraints.';
  const fieldSpecs = [
    ['view', [[catsXml, 3, 3, '<layout'], [catXml, 3, 3, '<layout']], [245, 245], 'Own combined enum categories/category replaces two upstream views.'],
    ['title', [[catsXml, 3, 3, '<layout'], [catXml, 3, 3, '<layout']], [330, 330], 'Own module title/aria-label, default Documentação; not an upstream setting.'],
    ['showPageHeading', [[cats, 54, 58, 'show_page_heading'], [cat, 98, 102, 'show_page_heading']], [311, 313], 'Local false; pageHeading fallback to title; h1/h2 selection local.'],
    ['pageHeading', [[cats, 54, 58, 'page_heading'], [cat, 98, 102, 'page_heading']], [408, 414], 'Local Documentação text; no Joomla menu/global heading resolution.'],
    ['showBaseDescription', [[catsXml, 31, 41, 'show_base_description'], [cats, 60, 74, 'show_base_description']], [315, 318], 'Local true replaces useglobal; no database fallback/content.prepare.'],
    ['baseDescription', [[catsXml, 43, 49, 'categories_description'], [cats, 60, 74, 'categories_description']], [315, 318], 'Own string default empty, escaped text; no database/content.prepare.'],
    ['categories', [], [208, 234], 'Own JSON interface default []; flat supplied category rows, not Joomla database/category objects.'],
    ['maxLevelCategories', [[catsXml, 51, 64, 'maxLevelcat']], [266, 273], 'Mapping maxLevelcat: local number [-1,10] versus upstream enum [-1,1..5]/useglobal. -1 recurses locally, unlike PHP >1, depth capped at 20.'],
    ['showEmptyCategoriesCat', [[catsXml, 66, 76, 'show_empty_categories_cat'], [items, 23, 28, 'show_empty_categories_cat']], [269, 269], 'Local false replaces useglobal, no tmpl_hide_categories.'],
    ['showSubcatDescCat', [[catsXml, 78, 88, 'show_subcat_desc_cat'], [items, 42, 47, 'content.prepare']], [287, 290], 'Local true replaces useglobal; plain escaped descriptions also on nested cards, not upstream lists/content.prepare.'],
    ['showCatNumArticlesCat', [[catsXml, 90, 100, 'show_cat_num_articles_cat'], [items, 63, 76, 'numitems']], [297, 299], 'Local true replaces useglobal; supplied count and local item/itens labels.'],
    ['activeCategoryId', [[catXml, 15, 25, 'modal_category']], [395, 401], 'Own string lookup default empty, not Joomla modal_category request/DB selection.'],
    ['showCategoryTitle', [[catXml, 47, 57, 'show_category_title'], [cat, 104, 108, 'show_category_title']], [412, 415], 'Local true replaces useglobal; escaped title and heading level local.'],
    ['showDescription', [[catXml, 59, 69, 'show_description'], [cat, 128, 130, 'content.prepare']], [426, 430], 'Local true replaces useglobal; plain escaped text, no content.prepare/events.'],
    ['showDescriptionImage', [[catXml, 71, 81, 'show_description_image'], [cat, 118, 126, 'joomla.html.image']], [422, 425], 'Local true replaces useglobal; strict supplied URL/alt. Only active category image: does NOT control card images, unlike upstream items. Children images omitted.'],
    ['showCatTags', [[catXml, 160, 170, 'show_cat_tags'], [cat, 111, 114, 'itemTags']], [417, 420], 'Local true replaces useglobal; own string arrays, not CMS tag objects/FileLayout.'],
    ['maxLevel', [[catXml, 83, 98, 'name="maxLevel"']], [338, 345], 'Local number [-1,10] versus upstream enum [-1,0..5]/useglobal; local -1 unlimited to depth 20 differs PHP >1.'],
    ['showEmptyCategories', [[catXml, 100, 111, 'show_empty_categories'], [children, 33, 38, 'show_empty_categories']], [341, 341], 'Local false replaces useglobal; supplied counts/tree, no tmpl_hide_categories.'],
    ['showSubcatDesc', [[catXml, 136, 146, 'show_subcat_desc'], [children, 63, 69, 'show_subcat_desc_cat']], [359, 362], 'Local false replaces useglobal. Deliberate divergence: upstream children reads show_subcat_desc_cat, local uses showSubcatDesc; plain descriptions at recursive depths.'],
    ['showCatNumArticles', [[catXml, 148, 158, 'show_cat_num_articles'], [children, 50, 54, 'getNumItems(true)']], [355, 357], 'Local true replaces useglobal; supplied counts, not getNumItems(true).'],
    ['showNoArticles', [[catXml, 112, 122, 'show_no_articles']], [432, 444], 'Local true replaces useglobal; local empty message after boolean published filter, not Joomla ACL/publication logic.'],
    ['rootLabel', [[cat, 67, 90, 'JCATEGORIES']], [403, 406], 'Own labels default Categorias; no Language/JCATEGORIES translation.'],
    ['rootHref', [[cat, 67, 90, 'Route::_', 'index.php']], [403, 406], 'Own route default #documentacao, supplied parent href; not Joomla/multilanguage routing; unsafe route renders span.'],
    ['pagination', [[cat, 185, 195, 'getPagesCounter', 'getPagesLinks'], [catXml, 340, 365, 'show_pagination_results']], [376, 393], 'Own precomputed {} contract, no JPagination or separate show_pagination/show_pagination_results controls.']
  ];
  const fields = fieldSpecs.map(([name, upstream, usage, difference]) => {
    const definition = one(LIB, `    ${name}: { type:`);
    const fallbackLine = lines(LIB).findIndex(line => line.startsWith(`  ${name}:`)) + 1;
    const fallback = r(LIB, fallbackLine, fallbackLine, `  ${name}:`);
    const xmlLines = lines(XML); const start = xmlLines.findIndex(line => line.includes(`<field name="${name}" `));
    const end = xmlLines[start].includes('/>') ? start : xmlLines.findIndex((line, i) => i > start && line.includes('</field>'));
    const constraints = definition.anchors.length && lines(LIB)[definition.startLine - 1].trim();
    return { name, default: DOCUMENTATION_DEFAULTS[name], defaultOrigin: 'local-original-port-policy', constraints,
      targets: { default: fallback, schema: definition, xml: r(XML, start + 1, end + 1, `name="${name}"`), usage: r(LIB, ...usage, lines(LIB)[usage[0] - 1].trim()) },
      sources: [r(original, fallback.startLine - 10, fallback.endLine - 10, `  ${name}:`), r(original, definition.startLine - 10, definition.endLine - 10, `    ${name}: { type:`), ...upstream.map(([p, a, b, ...anchors]) => r(p, a, b, ...anchors))],
      differences: `${localDefault} ${difference}` };
  });
  const cssGroups = [
    [20, 39, [r(cats, 52, 74, 'base-desc'), r(cat, 98, 133, 'category-desc')], 'Own spacing/heading/description layout and colors, not class-only rename.'],
    [40, 59, [r(mainCss, 11, 26, '.pdoc-si'), r(mainCss, 46, 63, '.pdoc-si'), r(mainCss, 71, 77, '.pdoc-si')], 'Icon selectors adapted; size/colors/margins/geometry differ. No independent icon clearance.'],
    [63, 116, [r(items, 20, 36, 'row-cols-md-3', 'card-title'), r(items, 61, 79, 'card-footer'), r(subitems, 16, 48, 'list-group')], 'Recreated CSS grid/card layout, not a simple main.css rename. Recursive cards replace upstream nested lists.'],
    [120, 134, [r(mainCss, 65, 77, '.btn.btn-primary'), r(cat, 67, 90, 'btn btn-primary')], 'Local back-button layout/colors, supplied routes and span fallback.'],
    [136, 164, [r(cat, 104, 133, 'show_category_title', 'itemTags', 'category-desc')], 'Own heading/tag/image/plain-text style; no CMS layouts/events.'],
    [166, 237, [r(mainCss, 28, 63, 'pdoc-category-article-list'), r(children, 24, 80, 'list-group'), r(subchildren, 19, 47, 'list-group')], 'Lists adapted with new flex/borders/spacing/colors; local counts/descriptions/recursive structure differ.'],
    [241, 287, [r(cat, 185, 195, 'getPagesLinks')], 'Own responsive/pager CSS; not JPagination or upstream CSS-rule equivalence.'],
    [288, 300, [r(adapter, 198, 201, 'DOCUMENTATION_CSS_APPROVED_DEEP', 'DOCUMENTATION_CSS_APPEND')], 'Local authored appended reflow/focus/container guards, not upstream PHP/CSS.']
  ];
  const selectors = [];
  const cssText = lines(CSS).join('\n');
  for (const match of cssText.matchAll(/(\.camap-documentation[^{}]*?)\{/g)) {
    const line = cssText.slice(0, match.index).split('\n').length;
    const group = cssGroups.find(([a, b]) => line >= a && line <= b);
    if (!group) throw new Error(`Unmapped CSS selector at ${line}`);
    for (const selector of match[1].split(',').map(s => s.trim())) {
      const [a, b, sources, differences] = group;
      const local = a < 288 ? [r(originalCss, a - 10, b - 10, selector)] : [];
      selectors.push({ selector, target: r(CSS, line, line + match[1].split('\n').length - 1, selector), sources: [...local, ...sources], differences });
    }
  }
  const buildSupport = [...Object.keys(DOCUMENTATION_BUILD_PINS), SELF_PATH].map(path => {
    const p = `${SOURCE_PREFIX}${path}`; const text = lines(p);
    const imports = [];
    const staticText = path === SELF_PATH ? files.get(p).toString().slice(0, files.get(p).toString().indexOf('const SELF_SHA256')) : files.get(p).toString();
    for (const match of staticText.matchAll(/^\s*(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[^;]*?\s+from\s+)['"]([^'"]+)['"]/gm)) {
      if (!match[1].startsWith('.')) continue;
      const target = `${SOURCE_PREFIX}${posix.normalize(posix.join(posix.dirname(path), match[1]))}`;
      if (!files.has(target)) throw new Error(`Derivation static import missing: ${target}`);
      const start = staticText.slice(0, match.index).replace(/\r\n?/g, '\n').split('\n').length;
      const end = start + match[0].replace(/\r\n?/g, '\n').split('\n').length - 1;
      imports.push({ specifier: match[1], target, source: r(p, start, end, match[1]) });
    }
    return { path: p, source: r(p, 1, text.length, text.find(line => line.trim())?.trim()), imports, license: path.includes('/vendor/parse-xml/') ? 'ISC' : 'GPL-2.0-or-later', licensePath: path.includes('/vendor/parse-xml/') ? `${SOURCE_PREFIX}src/libraries/vendor/parse-xml/LICENSE` : `${SOURCE_PREFIX}LICENSE.md`, differences: 'Included exact static support only; unused legacy broad builders not invoked. No original other-module sources or global vendor/source-rights claim.' };
  });
  buildSupport.push({ path: 'source/rebuild.mjs', source: r('source/rebuild.mjs', 1, lines('source/rebuild.mjs').length, 'SPDX-License-Identifier: GPL-2.0-or-later', 'api.rebuildDocumentationSourcePackage'), imports: [], checkedDynamicEntry: `${SOURCE_PREFIX}${SELF_PATH}`, license: 'GPL-2.0-or-later', licensePath: `${SOURCE_PREFIX}LICENSE.md`, differences: 'Own canonical bootstrap; pins executable support and normalized packager before fixed dynamic import; Node system libraries only.' });
  const runtime = DOCUMENTATION_SOURCE_RUNTIME.map(path => ({ ...records(new Map([[path, files.get(path)]]))[0], preferred: `source/preferred/${path}`, role: path === ENTRY ? 'own re-export wrapper' : path === XML ? 'own canonical captured XML DATA, version substitution only' : path === SHARED ? 'historical MIT helper plus authored GPL strict URL guards' : 'complete selected Phoca/Joomla derived port GPL-2.0-or-later', license: path === SHARED ? 'historical MIT + authored GPL-2.0-or-later changes (separate scopes)' : 'GPL-2.0-or-later', licenseText: 'docs/licenses/GPL-2.0.txt', licenseLinkage: 'docs/LICENSE-LINKAGE.json' }));
  return { format: 'minijoomla-documentation-derivation-map-v1', reviewDate: '2026-11-09', upstreamCommit: 'f2386b6b935c82f0fa0d94881c144ef1d91af0f9',
    policy: 'Technical source correspondence, not PHP generation, behavioral equivalence, independent icon rights or legal/global approval. Anchors/ranges checked against included pinned sources; finalizer reconstructs the entire map.',
    runtime, fields, functions, fragments: [articles, { name: 'HARD_DEPTH_LIMIT', target: one(LIB, 'const HARD_DEPTH_LIMIT = 20;'), sources: [one(original, 'const HARD_DEPTH_LIMIT = 20;')], differences: 'Own local hard depth 20 guard, not PHP; -1 local recursion differs PHP >1.' }, { name: 'inlineSVG', target: r(LIB, 37, 44, 'ICON_PREV', 'ICON_CATEGORY', 'ICON_ARTICLE'), sources: [r(original, 27, 34, 'ICON_PREV', 'ICON_CATEGORY', 'ICON_ARTICLE'), r(svg, 3, 20, 'pdoc-si-category', 'pdoc-si-article', 'pdoc-si-prev')], differences: 'Port inline geometry differs; upstream SVG comparison-only, no independent clearance.' }, { name: 'defaults-and-schema', target: r(LIB, 52, 131, 'defaults', 'settingsSchema'), sources: [r(original, 42, 121, 'defaults', 'settingsSchema'), r(adapter, 48, 60, 'DOCUMENTATION_DEFAULTS', 'FIELDS')], differences: localDefault }, { name: 'canonicalXML', target: r(XML, 15, 80, 'name="view"', 'name="pagination"'), sources: [r(adapter, 62, 69, 'XML_DATA', 'documentationAdaptationXml')], differences: 'Captured old canonical creator XML fixture, SHA-pinned; only version substituted. NOT generated from PHP/upstream XML. Runtime XML ordered fields differ from JS schema ordering near showNoArticles.' }, { name: 'wrapper-and-contract', target: r(ENTRY, 1, 2, 'export { default }', 'export *'), sources: [r(LIB, 463, 479, 'renderDocumentation', 'render:')], differences: 'Own local wrapper/contract, no selected navigation plugin dependency.' }],
    selectors, buildSupport,
    licensing: { linkage: 'docs/LICENSE-LINKAGE.json', relationships: linkage(files), records: records(new Map(sorted(files).filter(([p]) => Object.hasOwn(LICENSE_PINS, p) || p === `${SOURCE_PREFIX}docs/licenses/GPL-2.0.txt` || p === `${SOURCE_PREFIX}docs/THIRD-PARTY-NOTICES.md`))), bridge: r(`${SOURCE_PREFIX}LICENSE.md`, 14, 18, 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md'), preservedOriginalLicense: true },
    exclusions: { plugin: { sources: [r(original, 8, 9, 'plg_phocadocumentationnavigation'), r(`${UPSTREAM_PREFIX}README.txt`, 28, 29, 'Navigation plugin'), r(mainCss, 79, 118, '.plg-phocadocumentationnavigation')], selectedDependency: false, differences: 'Historical mentions/comparison only; no plugin source selected, copied, executed or cleared.' }, otherOriginalModulesCopied: false, phpExecuted: false, upstreamSvgRuntimeAsset: false }, ...FLAGS };
}

export function buildDocumentationSourcePackage(sourceFiles, input) {
  const args = options(input); const files = validateInputs(sourceFiles);
  const originals = new Map(Object.keys(DOCUMENTATION_ANCHORS).map(p => [p, files.get(`source/originals/${p}`)]));
  const overlay = applyDocumentationOverlay(originals);
  for (const [originalPath, runtimePath, header] of [[SHARED_SOURCE_PATH, SHARED, DOCUMENTATION_HELPER_HEADER], [DOCUMENTATION_SOURCE_PATH, LIB, DOCUMENTATION_DERIVATION_HEADER], [DOCUMENTATION_CSS_PATH, CSS, DOCUMENTATION_DERIVATION_HEADER]]) {
    const oldBytes = Buffer.from(overlay.files.get(originalPath).toString('utf8').replace(/\r\n?/g, '\n'));
    pin(oldBytes, OLD_RUNTIME_PINS[runtimePath], runtimePath);
    files.set(runtimePath, Buffer.concat([Buffer.from(header), oldBytes]));
  }
  files.set(ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`));
  const xml = documentationAdaptationXml('0.3.0').toString().replace('<version>0.3.0</version>', `<version>${args.version}</version>`);
  files.set(XML, Buffer.from(xml));
  const descriptor = parseJoomlaManifest(files.get(XML), { baseUrl: args.base, manifestPath: XML });
  if (descriptor.params.length !== 24 || JSON.stringify(descriptor.params.map(p => p.label)) !== JSON.stringify(Object.keys(DOCUMENTATION_DEFAULTS)) || descriptor.version !== args.version) throw new Error('24-field canonical XML invariant failed.');
  for (const p of DOCUMENTATION_SOURCE_RUNTIME) files.set(`source/preferred/${p}`, Buffer.from(files.get(p)));
  files.set(`${SOURCE_PREFIX}package.json`, json({ private: true, type: 'module' }));
  files.set('source/rebuild.mjs', launcherSource());
  files.set('source/README.md', Buffer.from(REBUILD_NOTICE));
  files.set('docs/UPSTREAM-NOTICE.md', Buffer.from(UPSTREAM_NOTICE));
  files.set(`${SOURCE_PREFIX}docs/licenses/GPL-2.0.txt`, Buffer.from(files.get('docs/licenses/GPL-2.0.txt')));
  files.set(`${SOURCE_PREFIX}docs/THIRD-PARTY-NOTICES.md`, Buffer.from(THIRD_PARTY_BRIDGE));
  files.set('docs/LICENSE-LINKAGE.json', json(linkage(files)));
  files.set('docs/DERIVATION-MAP.json', json(derivationMap(files)));
  const buildSources = new Map(sorted(files).filter(([p]) => p.startsWith(SOURCE_PREFIX) || p === 'source/rebuild.mjs'));
  files.set('source/BUILD-CLOSURE.json', json({ format: 'minijoomla-documentation-build-closure-v1', entry: 'source/rebuild.mjs', packager: `${SOURCE_PREFIX}${SELF_PATH}`, normalizedPackagerSha256: SELF_SHA256, externalDependencies: 'Node.js >=24 system libraries only; no npm or network', staticSources: records(buildSources), sourceLicenseMapping: linkage(files).buildSupport, derivationMap: 'docs/DERIVATION-MAP.json', unusedLegacyBuildersExecuted: false }));
  files.set('docs/ADOPTION-NOTICE.md', Buffer.from('Documentation-only local offline package. No installation, publication, tenant/host changes or global rights approval. PHP references are inert data, never executed.\n'));
  files.set('docs/ADAPTATION-NOTICE.md', Buffer.from('Port/adaptation notices 09/11/2026. Same approved 0.3.x runtime overlay bytes after removing ONLY the scoped headers (identical to 0.4.x); XML differs only in the version element. All 24 LOCAL fields/defaults/constraints preserved, not upstream useglobal equivalence. Preferred runtime and offline build closure included. DERIVATION-MAP.json materializes checked source/function/field/selector ranges, hashes and concrete differences including cards versus lists, ACL/publication and precomputed pagination. Preserved project LICENSE.md links resolve through the scoped GPL duplicate/third-party bridge. See UPSTREAM-NOTICE.md and LICENSE-LINKAGE.json; no global rights approval.\n'));
  const adaptation = { format: 'minijoomla-documentation-source-package-v1', module: MODULE, version: args.version, base: args.base, portAdaptationNoticeDate: '2026-11-09', runtimeAlgorithm: 'exact approved 0.3.x overlay plus unchanged 0.4.x scoped comments only', canonicalXml: 'documentationAdaptationXml(0.3.0), version substitution only; not PHP XML generation', orderedFields: Object.keys(DOCUMENTATION_DEFAULTS), originals: records(new Map(sorted(files).filter(([p]) => p.startsWith('source/originals/')))), overlayChanges: overlay.changes, runtime: records(new Map(DOCUMENTATION_SOURCE_RUNTIME.map(p => [p, files.get(p)]))), sourceClosure: 'source/BUILD-CLOSURE.json', licenseLinkage: 'docs/LICENSE-LINKAGE.json', derivationMap: 'docs/DERIVATION-MAP.json', checks: { upstreamLicenseLinkage: 'passed', selectedSourceMaterialized: 'passed', preferredRuntimeIncluded: 'passed', staticBuildClosurePins: 'passed', independentRuntimePins: 'passed', derivationRangesAnchorsHashes: 'passed', preservedLicenseRelativeLinks: 'passed' }, ...FLAGS };
  files.set('ADAPTATION.json', json(adaptation));
  files.set('adoption-plan.json', json({ format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module: MODULE, key: KEY, version: args.version, base: args.base, pilot: false, sourceLicensePresent: true, licenses: ['docs/licenses/GPL-2.0.txt', 'docs/licenses/CAMAP-ROOT-MIT.txt'], sourcePackage: 'source/rebuild.mjs', linkage: 'docs/LICENSE-LINKAGE.json', nextGate: 'Independent scope/rights/privacy and host/site lifecycle review; no operational approval.', ...FLAGS }));
  const inventory = { format: 'minijoomla-joomla-package-v1', version: args.version, files: records(files), moduleStyles: { [KEY]: [CSS] }, moduleKeys: { [MODULE]: KEY } };
  const inventoryBytes = json(inventory);
  if (inventoryBytes.length > 64 * 1024) throw new Error('64 KiB inventory budget exceeded.');
  files.set('MANIFEST-SHA256.json', inventoryBytes);
  const hostConfig = { joomlaDiscoveryRoots: [{ id: `camap-${MODULE}-${args.version}`, baseUrl: args.base, inventoryHash: documentationSourceSha256(inventoryBytes), immutable: true, discover: true }], moduleStyles: { [KEY]: [`${args.base}/${CSS}`] }, moduleStyleRevisions: { [KEY]: { [`${args.base}/${ENTRY}`]: [`${args.base}/${CSS}`] } } };
  files.set('host-config.json', json(hostConfig));
  if (files.size > MAX_FILES || sorted(files).reduce((n, [, b]) => n + b.length, 0) > MAX_BYTES) throw new Error('500 files / 10 MiB package budget exceeded.');
  return { files, inventory, hostConfig, adaptation, descriptor, ...args };
}

/** No caller evidence hashes: reconstruct canonical bytes from independent pins. */
export function finalizeDocumentationSourcePackage(stagedFiles, input) {
  const files = safeMap(stagedFiles); const args = options(input);
  if (!files.get('MANIFEST-SHA256.json') || files.get('MANIFEST-SHA256.json').length > 64 * 1024) throw new Error('Missing/oversized inventory.');
  const expected = buildDocumentationSourcePackage(new Map(inputPaths().map(p => [p, files.get(p)])), args);
  if (files.size !== expected.files.size) throw new Error('Extra/missing package file outside closed profile.');
  for (const [p, bytes] of expected.files) if (!files.get(p)?.equals(bytes)) throw new Error(`Canonical package bytes refused: ${p}`);
  return expected;
}

async function noLinks(path, allowMissing = false) {
  for (let p = resolve(path); ; p = dirname(p)) {
    try { const s = await lstat(p); if (s.isSymbolicLink() || s.isFile() && s.nlink !== 1) throw new Error('Symlink/junction/hardlink refused.'); }
    catch (error) { if (!(allowMissing && error.code === 'ENOENT')) throw error; }
    if (p === dirname(p)) break;
  }
}
async function readChecked(path, budget) {
  await noLinks(path); const before = await lstat(path);
  if (!before.isFile() || before.size > MAX_BYTES || (budget.bytes += before.size) > MAX_BYTES || ++budget.files > MAX_FILES) throw new Error('Regular-file/read budget exceeded.');
  const bytes = await readFile(path); const after = await lstat(path);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== before.size) throw new Error('Input changed during read.');
  await noLinks(path); return bytes;
}
async function recheck(entries) { const budget = { files: 0, bytes: 0 }; for (const [p, b] of entries) if (!(await readChecked(p, budget)).equals(b)) throw new Error('Input changed before output.'); }
export async function readDocumentationSourcePackage(root) {
  const directory = resolve(root); await noLinks(directory);
  const files = new Map(); const budget = { files: 0, bytes: 0 }; let directories = 0;
  async function visit(p, prefix = '') {
    if (++directories > 500) throw new Error('Directory budget exceeded.');
    await noLinks(p);
    for (const e of await readdir(p, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${e.name}` : e.name; packagePath(name); const target = resolve(p, e.name); await noLinks(target);
      if (e.isDirectory()) await visit(target, name);
      else if (e.isFile()) files.set(name, await readChecked(target, budget));
      else throw new Error('Nonregular file refused.');
    }
  }
  await visit(directory); return safeMap(files);
}
async function writeNew(root, output, files, sibling = false) {
  const destination = resolve(root, sibling ? output.slice('tmp/'.length) : output);
  if (!owns(sibling ? root : resolve(root, 'tmp'), destination)) throw new Error('Output escapes its approved new-output parent.');
  await noLinks(destination, true);
  try { await lstat(destination); throw new Error('Existing output refused.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(dirname(destination), { recursive: true }); await noLinks(dirname(destination)); await mkdir(destination);
  for (const [p, b] of sorted(files)) { const target = resolve(destination, p); await noLinks(target, true); await mkdir(dirname(target), { recursive: true }); await noLinks(dirname(target)); await writeFile(target, b, { flag: 'wx' }); }
  return destination;
}
export async function prepareDocumentationSourcePackage(input) {
  const args = options(input, true); const inputs = new Map(); const reads = new Map(); const budget = { files: 0, bytes: 0 };
  const camap = resolve(PROJECT, '..', 'CAMAP2');
  async function add(packageName, path) { const b = await readChecked(path, budget); inputs.set(packageName, b); reads.set(path, b); }
  for (const p of Object.keys(DOCUMENTATION_ANCHORS)) await add(`source/originals/${p}`, resolve(camap, p));
  for (const p of Object.keys(DOCUMENTATION_UPSTREAM_PINS)) await add(`${UPSTREAM_PREFIX}${p}`, resolve(camap, 'PHP/phoca', p));
  for (const p of [...Object.keys(DOCUMENTATION_BUILD_PINS), SELF_PATH, 'LICENSE.md', 'src/libraries/vendor/parse-xml/LICENSE', 'src/libraries/vendor/parse-xml/notices.txt']) await add(`${SOURCE_PREFIX}${p}`, resolve(PROJECT, p));
  await add('docs/licenses/CAMAP-ROOT-MIT.txt', resolve(PROJECT, '..', 'LICENSE'));
  await add('docs/licenses/GPL-2.0.txt', resolve(PROJECT, 'docs/licenses/GPL-2.0.txt'));
  inputs.set(PHOCA_LICENSE_PATH, Buffer.from(PHOCA_LICENSE));
  const built = buildDocumentationSourcePackage(inputs, args); const final = finalizeDocumentationSourcePackage(built.files, args);
  await recheck(reads); const output = await writeNew(PROJECT, args.output, final.files);
  finalizeDocumentationSourcePackage(await readDocumentationSourcePackage(output), args);
  return { ...final, output };
}
export async function rebuildDocumentationSourcePackage(packageRoot, input) {
  const args = options(input, true); const root = resolve(packageRoot);
  const files = await readDocumentationSourcePackage(root);
  const metaBytes = files.get('ADAPTATION.json'); if (!metaBytes || metaBytes.length > 64 * 1024) throw new Error('Missing/oversized package identity.');
  const meta = JSON.parse(metaBytes.toString());
  const original = finalizeDocumentationSourcePackage(files, { version: meta.version, base: meta.base });
  const built = buildDocumentationSourcePackage(new Map(inputPaths().map(p => [p, original.files.get(p)])), args);
  const second = await readDocumentationSourcePackage(root);
  finalizeDocumentationSourcePackage(second, { version: meta.version, base: meta.base });
  // A tmp/* package rebuilds to a new sibling, never inside its source tree.
  const output = await writeNew(dirname(root), args.output, built.files, true);
  finalizeDocumentationSourcePackage(await readDocumentationSourcePackage(output), args);
  return { ...built, output };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
   try { const args = parseDocumentationSourceArgs(); if (args.help) console.log('node scripts/prepare-documentation-source-package.js --version 0.5.0|0.5.1 --base /offline/documentation/0.5.0 --output tmp/documentation-adapt-agent-source-new'); else { const result = await prepareDocumentationSourcePackage(args); console.log(`Prepared Documentation ${result.version}: ${result.files.size} files, ${result.inventory.files.length} inventoried payloads. Global rights/publication gates remain closed. Output: ${result.output}`); } }
  catch (error) { console.error(`prepare-documentation-source-package: ${error.message}`); process.exitCode = 1; }
}
