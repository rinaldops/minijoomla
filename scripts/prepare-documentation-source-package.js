/* SPDX-License-Identifier: GPL-2.0-or-later
 * Historical Documentation 0.5.x builder facade. The exact approved build
 * sources are frozen separately; active CMS edits cannot rewrite its trust root.
 */
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDocumentationSourcePackage, finalizeDocumentationSourcePackage,
  readDocumentationSourcePackage, parseDocumentationSourceArgs,
  DOCUMENTATION_BUILD_PINS, DOCUMENTATION_UPSTREAM_PINS
} from './documentation-frozen-build/scripts/prepare-documentation-source-package.js';
import { DOCUMENTATION_ANCHORS } from './documentation-frozen-build/scripts/prepare-documentation-adaptation.js';

export * from './documentation-frozen-build/scripts/prepare-documentation-source-package.js';
export const DOCUMENTATION_FROZEN_ROOT = fileURLToPath(new URL('./documentation-frozen-build/', import.meta.url));
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = 'source/minijoomla/';
async function noLinks(path, allowMissing = false) {
  for (let p = resolve(path); ; p = dirname(p)) {
    try { const stat = await lstat(p); if (stat.isSymbolicLink() || stat.isFile() && stat.nlink !== 1) throw Error('Links refused.'); }
    catch (error) { if (!(allowMissing && error.code === 'ENOENT')) throw error; }
    if (p === dirname(p)) break;
  }
}
export async function prepareDocumentationSourcePackage(input) {
  // Reuse the frozen primitive-option/CLI gate, not untrusted caller hashes.
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw Error('Closed own plain options required');
  const keys = Reflect.ownKeys(input ?? {});
  if (keys.length > 4 || keys.some(key => typeof key !== 'string' || !['version','base','output','module'].includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(input, key), 'value') || typeof Object.getOwnPropertyDescriptor(input,key).value !== 'string')) throw Error('Closed primitive options refuse accessors');
  const args = parseDocumentationSourceArgs(keys.flatMap(key => ['--' + key, input[key]]));
  const inputs = new Map(), reads = new Map();
  async function add(name, path) {
    await noLinks(path); const stat = await lstat(path);
    if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw Error('Regular bounded source required.');
    const bytes = await readFile(path); inputs.set(name, bytes); reads.set(path, bytes);
  }
  const camap = resolve(PROJECT, '..', 'CAMAP2');
  for (const path of Object.keys(DOCUMENTATION_ANCHORS)) await add('source/originals/' + path, resolve(camap, path));
  for (const path of Object.keys(DOCUMENTATION_UPSTREAM_PINS)) await add('source/upstream/PhocaDocumentation/TemplateOverride/' + path, resolve(camap, 'PHP/phoca', path));
  for (const path of [...Object.keys(DOCUMENTATION_BUILD_PINS), 'scripts/prepare-documentation-source-package.js', 'LICENSE.md', 'src/libraries/vendor/parse-xml/LICENSE', 'src/libraries/vendor/parse-xml/notices.txt']) await add(PREFIX + path, resolve(DOCUMENTATION_FROZEN_ROOT, path));
  await add('docs/licenses/CAMAP-ROOT-MIT.txt', resolve(PROJECT, '..', 'LICENSE'));
  await add('docs/licenses/GPL-2.0.txt', resolve(DOCUMENTATION_FROZEN_ROOT, 'docs/licenses/GPL-2.0.txt'));
  inputs.set('source/upstream/PhocaDocumentation/LICENSE', Buffer.from('GNU General Public License version 2 or later; http://www.gnu.org/copyleft/gpl.html'));
  const final = finalizeDocumentationSourcePackage(buildDocumentationSourcePackage(inputs, args).files, args);
  for (const [path, bytes] of reads) { await noLinks(path); if (!(await readFile(path)).equals(bytes)) throw Error('Source changed before generation.'); }
  const destination = resolve(PROJECT, args.output);
  await noLinks(destination, true);
  try { await lstat(destination); throw Error('Existing output refused.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(dirname(destination), { recursive: true }); await noLinks(dirname(destination)); await mkdir(destination);
  for (const [path, bytes] of final.files) { const target = resolve(destination, path); await mkdir(dirname(target), { recursive: true }); await noLinks(dirname(target)); await writeFile(target, bytes, { flag: 'wx' }); }
  finalizeDocumentationSourcePackage(await readDocumentationSourcePackage(destination), args);
  return { ...final, output: destination };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = parseDocumentationSourceArgs(); if (args.help) console.log('Historical offline Documentation 0.5.0/0.5.1; frozen build support, new tmp output only.'); else { const result = await prepareDocumentationSourcePackage(args); console.log(`Prepared historical Documentation ${result.version}: ${result.files.size} files; no global publication or installation approval.`); } }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
