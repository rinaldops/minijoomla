import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateModuleManifests } from './module-manifests.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(PROJECT, 'tmp');
const SOURCE = join(PROJECT, 'src');
const PACKAGES = resolve(PROJECT, '..', 'SPMIDDLE', 'packages');
const SNIPPET = join(PROJECT, 'host-adapters', 'modern-script-editor', 'site-snippet.html');
const CORE_ENTRIES = ['index.js', 'administrator/components/com_minijoomla/app.js', 'media/templates/administrator/atum/css/template.css', 'libraries/minijoomla/application/joomla-discovery.js', 'libraries/minijoomla/application/joomla-extension-installer.js'];
const CORE_VENDOR_FILES = new Set(['libraries/vendor/parse-xml/parse-xml.js', 'libraries/vendor/parse-xml/LICENSE', 'libraries/vendor/parse-xml/notices.txt']);
const slash = (value) => value.split(sep).join('/');
const releasePath = (root, source) => slash(relative(root, source));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const within = (root, path) => path === root || (!relative(root, path).startsWith(`..${sep}`) && relative(root, path) !== '..' && !isAbsolute(relative(root, path)));
const allowedFile = (name) => /\.(?:m?js|css|xml|woff2?|ttf|otf|eot|svg|png|gif|jpe?g|webp|ico)$/i.test(name) || /^(?:(?:license|licence|copying)(?:\.md|\.txt)?|notices\.txt)$/i.test(name);
const MIT_TERMS = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`.replace(/\s+/g, ' ').trim();

function assertWithin(root, path) {
  if (!within(root, path)) throw new Error(`Caminho fora da raiz autorizada: ${path}`);
}

function noLinks(path) {
  let current = resolve(path);
  while (true) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Link simbólico/junction não permitido: ${current}`);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function sourceRoot(value, defaultRoot) {
  const root = resolve(value ?? defaultRoot);
  if (root !== defaultRoot) assertWithin(TMP, root);
  noLinks(root);
  if (!existsSync(root) || !lstatSync(root).isDirectory()) throw new Error(`Raiz de fontes ausente: ${root}`);
  return realpathSync(root);
}

// Keep offsets so only actual module specifiers are rewritten, never comments.
function tokens(text) {
  const result = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) { i += 1; continue; }
    if (text.startsWith('//', i)) { const end = text.indexOf('\n', i); i = end < 0 ? text.length : end; continue; }
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Comentário JavaScript não terminado.');
      i = end + 2; continue;
    }
    const start = i;
    const quote = text[i];
    if (quote === "'" || quote === '"' || quote === '`') {
      i += 1;
      while (i < text.length && text[i] !== quote) { if (text[i] === '\\') i += 1; i += 1; }
      if (i === text.length) throw new Error('String JavaScript não terminada.');
      const value = text.slice(start + 1, i);
      result.push({ type: quote === '`' && value.includes('${') ? 'template' : 'string', value, start: start + 1, end: i });
      i += 1; continue;
    }
    const previous = result.at(-1)?.value;
    if (quote === '/' && (!previous || /^(?:=|\(|:|,|!|\[|return|=>|\||&|\?)$/.test(previous))) {
      i += 1;
      let bracket = false;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '[') bracket = true;
        if (text[i] === ']') bracket = false;
        if (text[i++] === '/' && !bracket) break;
      }
      while (/[a-z]/i.test(text[i] ?? '') && i < text.length) i += 1;
      result.push({ type: 'regex', value: '<regex>', start, end: i });
      continue;
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
    const value = word ? word[0] : text.startsWith('=>', i) ? '=>' : text[i];
    i += value.length;
    result.push({ type: word ? 'word' : 'punct', value, start, end: i });
  }
  return result;
}

function jsReferences(text, name) {
  const list = tokens(text);
  if (list.some((entry) => entry.type === 'template' && /\bimport\s*\(/.test(entry.value))) throw new Error(`Import dentro de template literal não verificável: ${name}`);
  const references = [];
  for (let i = 0; i < list.length; i += 1) {
    const token = list[i];
    if (token.type !== 'word') continue;
    if (token.value === 'import' && list[i - 1]?.value !== '.' && list[i + 1]?.value !== '.') {
      if (list[i + 1]?.value === '(') {
        const argument = list[i + 2];
        if (argument?.type === 'string' && [')', ','].includes(list[i + 3]?.value)) references.push(argument);
        else if (!(list[i + 3]?.value === ')' && argument?.value === 'url' &&
          ['libraries/minijoomla/modules/dynamic-modules.js', 'libraries/minijoomla/application/template-runtime.js'].includes(name))) {
          throw new Error(`Import dinâmico não verificável: ${name}`);
        }
      } else if (list[i + 1]?.type === 'string') references.push(list[i + 1]);
      else {
        for (let j = i + 1; j < list.length && ![';', '}'].includes(list[j].value); j += 1) {
          if (list[j].value === 'from' && list[j + 1]?.type === 'string') { references.push(list[j + 1]); break; }
        }
        // Named imports contain a closing brace before "from".
        const closing = list.findIndex((entry, index) => index > i && ['}', ';'].includes(entry.value));
        if (closing > i && list[closing].value === '}' && list[closing + 1]?.value === 'from') references.push(list[closing + 2]);
      }
    }
    if (token.value === 'export') {
      for (let j = i + 1; j < list.length && ![';', '='].includes(list[j].value); j += 1) {
        if (list[j].value === 'from' && list[j + 1]?.type === 'string') { references.push(list[j + 1]); break; }
        if (list[j].value === 'function' || list[j].value === 'class') break;
      }
    }
    if (token.value === 'URL' && list[i - 1]?.value === 'new' && list[i + 1]?.value === '(' &&
      list[i + 2]?.type === 'string' && list.slice(i + 3, i + 9).map((entry) => entry.value).join('') === ',import.meta.url') {
      references.push({ ...list[i + 2], directory: list[i + 2].value.endsWith('/') });
    }
  }
  return [...new Map(references.map((entry) => [entry.start, entry])).values()];
}

function cssReferences(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const references = [];
  for (const match of clean.matchAll(/@import\s+(?:url\(\s*)?(['"])(.*?)\1|url\(\s*(?:(['"])(.*?)\3|([^)\s]+))\s*\)/g)) {
    const value = match[2] ?? match[4] ?? match[5];
    if (value && !value.startsWith('data:') && !value.startsWith('#')) references.push({ value });
  }
  return references;
}

function localPath(from, specifier) {
  if (specifier.includes('\\') || specifier.includes('%') || /[\u0000-\u0020]/.test(specifier)) throw new Error(`Import/URL inválido: ${specifier}`);
  if (/^(?:[a-z][\w+.-]*:|\/)/i.test(specifier)) throw new Error(`Dependência externa/absoluta não permitida: ${specifier}`);
  const path = specifier.split(/[?#]/)[0];
  if (!path) throw new Error(`Dependência vazia: ${specifier}`);
  return resolve(dirname(from), path);
}

function references(text, name) {
  if (/\.(?:m?js)$/.test(name)) {
    if (/releases\/\d+\.\d+\.\d+\//.test(text)) throw new Error(`Referência hardcoded a outra release: ${name}`);
    return jsReferences(text, name);
  }
  return name.endsWith('.css') ? cssReferences(text) : [];
}

/**
 * Build entirely offline. Source overrides exist only for fixtures under this
 * project's tmp; they cannot grant access to arbitrary filesystem roots.
 */
export function stageRelease({ version, output, target = 'all', sourceRoot: sourceOption, spmiddleRoot: packageOption } = {}) {
  if (typeof version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version)) throw new Error('Versão inválida; esperado X.Y.Z sem zeros à esquerda.');
  if (!['all', 'site', 'core'].includes(target)) throw new Error('--target inválido; esperado all, site ou core.');
  const coreTarget = target === 'core';
  if (typeof output !== 'string' || !output.trim()) throw new Error('--output é obrigatório.');
  const destination = resolve(PROJECT, output);
  assertWithin(TMP, destination);
  if (destination === TMP) throw new Error('O destino deve ser uma subpasta de tmp.');
  noLinks(destination);
  if (existsSync(destination)) throw new Error(`Destino já existe; sobrescrita proibida: ${destination}`);
  const src = sourceRoot(sourceOption, SOURCE);
  // Core never opens the sibling, even if it is absent. An unused fixture
  // override still cannot authorize paths outside tmp or through links.
  if (target === 'core' && packageOption !== undefined) {
    const root = resolve(packageOption);
    if (root !== PACKAGES) assertWithin(TMP, root);
    noLinks(root);
  }
  const packages = target === 'core' ? null : sourceRoot(packageOption, PACKAGES);
  if (within(src, destination) || within(destination, src) || (packages && (within(packages, destination) || within(destination, packages)))) throw new Error('Destino e fontes não podem se sobrepor.');
  const files = new Map();
  const originals = new Map();
  const sourceDirectories = new Map();
  const queue = [];
  const coreThirdPartyLicenses = [];
  function enqueue(source, destinationName) {
    if (target === 'site' && (destinationName.startsWith('administrator/') || destinationName.startsWith('media/vendor/tinymce/') || destinationName === 'libraries/minijoomla/composition/createMiniJoomlaAdminApp.js')) throw new Error('O target site não pode depender do painel/editor administrativo.');
    if (target === 'core' && (/^(?:libraries\/minijoomla\/composition\/|libraries\/minijoomla\/infrastructure\/(?:spmiddle|sharepoint)[^/]*|media\/vendor\/)/i.test(destinationName)
      || (destinationName.startsWith('libraries/vendor/') && !CORE_VENDOR_FILES.has(destinationName)))) {
      throw new Error(`O target core não inclui composições/integrações de host ou vendor de terceiros; não é permitido omitir uma dependência obrigatória: ${destinationName}`);
    }
    const root = within(src, source) || !packages ? src : packages;
    assertWithin(root, source);
    if (!allowedFile(basename(source))) throw new Error(`Arquivo não autorizado como dependência: ${source}`);
    noLinks(source);
    if (!existsSync(source) || !lstatSync(source).isFile()) throw new Error(`Dependência ausente: ${source}`);
    assertWithin(root, realpathSync(source));
    if (!files.has(destinationName)) {
      const data = readFileSync(source);
      files.set(destinationName, data);
      originals.set(source, data);
      queue.push({ source, target: destinationName });
    }
  }
  function walk(dir) {
    noLinks(dir);
    const entries = readdirSync(dir).sort();
    sourceDirectories.set(dir, entries);
    for (const entry of entries) {
      const path = join(dir, entry);
      noLinks(path);
      if (lstatSync(path).isDirectory()) walk(path);
      else {
        if (!allowedFile(entry)) {
          throw new Error(`Arquivo não autorizado na árvore de fontes (config/dados não são empacotados): ${path}`);
        }
        enqueue(path, releasePath(src, path));
      }
    }
  }
  if (target === 'all') walk(src);
  else {
    for (const entry of target === 'core' ? CORE_ENTRIES : ['index.js', 'libraries/minijoomla/composition/mountMiniJoomlaSite.js']) enqueue(join(src, entry), releasePath(src, join(src, entry)));
  }
  if (src === SOURCE && target === 'all') {
    const editorRoot = 'media/vendor/tinymce/';
    const requiredEditor = [
      'tinymce.min.js', 'license.md', 'notices.txt', 'themes/silver/theme.min.js', 'models/dom/model.min.js',
      'icons/default/icons.min.js', 'skins/ui/oxide/skin.min.css', 'skins/ui/oxide/content.min.css',
      'skins/content/default/content.min.css'
    ];
    const editor = files.get('administrator/components/com_minijoomla/editor.js')?.toString('utf8') ?? '';
    const plugins = [...editor.matchAll(/const\s+PLUGINS_\w+\s*=\s*['"]([^'"]+)['"]/g)].flatMap((match) => match[1].split(/\s+/));
    if (!plugins.length) throw new Error('Preset de plugins do editor não reconhecido; validar recursos antes do estágio.');
    for (const plugin of new Set(plugins)) requiredEditor.push(`plugins/${plugin}/plugin.min.js`);
    if (plugins.includes('emoticons')) requiredEditor.push('plugins/emoticons/js/emojis.min.js');
    if (plugins.includes('help')) requiredEditor.push('plugins/help/js/i18n/keynav/en.js');
    for (const path of requiredEditor) {
      if (!files.has(`${editorRoot}${path}`)) throw new Error(`Recurso de runtime do editor ausente: ${editorRoot}${path}`);
    }
  }
  // Host-injected file clients must also be available without the development tree.
  if (src === SOURCE && target === 'all') enqueue(join(packages, 'sharepoint-files', 'src', 'index.js'), 'libraries/vendor/spmiddle/sharepoint-files/src/index.js');
  // Sample Data is an explicit administrative feature. The core includes its
  // injectable service/view, while all includes the approved dataset/assets.
  if (src === SOURCE && target === 'all') enqueue(join(src, 'plugins/sampledata/blog/blog.js'), 'plugins/sampledata/blog/blog.js');
  for (let i = 0; i < queue.length; i += 1) {
    const { source, target } = queue[i];
    const text = files.get(target).toString('utf8');
    let rewritten = text;
    const edits = [];
    for (const ref of references(text, target)) {
      if (/\.(?:m?js)$/.test(target) && !ref.value.startsWith('.')) throw new Error(`Import não relativo: ${target} -> ${ref.value}`);
      const dependency = localPath(source, ref.value);
      let dependencyTarget;
      if (within(src, dependency)) dependencyTarget = releasePath(src, dependency);
      else {
        if (coreTarget) throw new Error(`Dependência fora da raiz autossuficiente do target core: ${source} -> ${ref.value}`);
        assertWithin(packages, dependency);
        if (!/^[^/]+\/src\//.test(slash(relative(packages, dependency)))) throw new Error(`Dependência fora de packages/*/src: ${dependency}`);
        dependencyTarget = `libraries/vendor/spmiddle/${slash(relative(packages, dependency))}`;
      }
      if (coreTarget && ref.directory && (/^(?:libraries\/minijoomla\/composition\/|media\/vendor\/)/i.test(dependencyTarget)
        || (dependencyTarget.startsWith('libraries/vendor/') && ![...CORE_VENDOR_FILES].some((path) => path.startsWith(dependencyTarget))))) {
        throw new Error(`O target core não inclui recursos externos de host/vendor: ${dependencyTarget}`);
      }
      if (!ref.directory) enqueue(dependency, dependencyTarget);
      const stagedPath = localPath(join(destination, target), ref.value);
      if (stagedPath !== resolve(destination, dependencyTarget)) {
        let value = slash(relative(dirname(join(destination, target)), join(destination, dependencyTarget)));
        if (!value.startsWith('.')) value = `./${value}`;
        value += ref.value.slice(ref.value.split(/[?#]/)[0].length);
        if (ref.start === undefined) throw new Error(`CSS externo às fontes não suportado: ${source}`);
        edits.push({ ...ref, replacement: value });
      }
    }
    if (target === 'libraries/minijoomla/application/template-runtime.js') {
      for (const match of text.matchAll(/styles:\s*\[([^\]]*)\]/g)) {
        for (const asset of match[1].matchAll(/['"]([^'"]+\.css)['"]/g)) {
          const path = resolve(dirname(source), asset[1]);
          enqueue(path, releasePath(src, path));
        }
      }
    }
    for (const edit of edits.sort((a, b) => b.start - a.start)) rewritten = rewritten.slice(0, edit.start) + edit.replacement + rewritten.slice(edit.end);
    if (edits.length) files.set(target, Buffer.from(rewritten));
  }
  if (target === 'site' && [...files.keys()].some((path) => path.startsWith('administrator/') || path.startsWith('media/vendor/tinymce/') || path === 'libraries/minijoomla/composition/createMiniJoomlaAdminApp.js')) {
    throw new Error('O target site não pode depender do painel/editor administrativo.');
  }
  // Source XMLs remain local compatibility descriptors; release metadata has a
  // single authority: the same catalogue used by the administrative UI.
  for (const [path, data] of generateModuleManifests(files.keys(), version)) files.set(path, data);
  const entrypoints = {
    public: 'index.js',
    site: 'libraries/minijoomla/composition/createMiniJoomlaSiteApplication.js',
    mount: 'libraries/minijoomla/composition/mountMiniJoomlaSite.js',
    sharepoint: 'libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js',
    admin: 'administrator/components/com_minijoomla/app.js',
    adminComposition: 'libraries/minijoomla/composition/createMiniJoomlaAdminApp.js'
  };
  const available = Object.fromEntries(Object.entries(entrypoints).filter(([, path]) => files.has(path)));
  if (src === SOURCE && target !== 'core') {
    noLinks(SNIPPET);
    const snippet = readFileSync(SNIPPET);
    const text = snippet.toString('utf8');
    if (!text.includes('__RELEASE_BASE__') || !text.includes('__WEB_URL__') || /https?:\/\/|releases\/\d+\.\d+\.\d+\//i.test(text)) throw new Error('Snippet do host deve manter placeholders, sem destino corporativo/versão hardcoded.');
    if (!files.has(entrypoints.mount)) throw new Error('Entrypoint independente do snippet ausente.');
    files.set('host-adapters/modern-script-editor/site-snippet.html', snippet);
    originals.set(SNIPPET, snippet);
  }
  if (target === 'core') {
    for (const name of ['LICENSE.md', 'docs/licenses/GPL-2.0.txt']) {
      const source = join(PROJECT, name);
      noLinks(source);
      if (!existsSync(source) || !lstatSync(source).isFile()) throw new Error(`Licença do núcleo ausente: ${name}`);
      const data = readFileSync(source);
      originals.set(source, data);
      files.set(name, data);
    }
    if (files.has('libraries/vendor/parse-xml/parse-xml.js')) {
      for (const name of ['LICENSE', 'notices.txt']) {
        const relativeName = `libraries/vendor/parse-xml/${name}`;
        enqueue(join(src, ...relativeName.split('/')), relativeName);
        coreThirdPartyLicenses.push(relativeName);
      }
    }
    const parseXmlNotice = coreThirdPartyLicenses.length
      ? '\n\nBundled parser: @rgrove/parse-xml 5.0.0, ISC License. See libraries/vendor/parse-xml/LICENSE and notices.txt.'
      : '';
    files.set('docs/THIRD-PARTY-NOTICES.md', Buffer.from(`# Notices for the core staging target\n\nOriginal MINIJOOMLA code: GPL-2.0-or-later. See ../LICENSE.md and licenses/GPL-2.0.txt.${parseXmlNotice}\n\nThis target contains the local public runtime and injectable administration UI,\nincluding MINIJOOMLA's editor bridge, but no TinyMCE runtime or SPMIDDLE source.\nTheir notices and unresolved distribution obligations are not a claim of\ncompliance for this target and still apply to distributions that include them.\n\nJoomla/Atum/Cassiopeia are references, not an endorsement or a grant of trademark\nrights. This staging operation does not audit rights, data or release readiness.\n`));
  }
  if (target !== 'core') {
    // Preserve the project's original license and bounded notices alongside
    // integration targets too. Inclusion is not a legal/publication approval.
    for (const name of ['LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md']) {
      const source = join(PROJECT, name);
      noLinks(source);
      if (!existsSync(source) || !lstatSync(source).isFile()) throw new Error(`Aviso/licença do projeto ausente: ${name}`);
      const data = readFileSync(source);
      originals.set(source, data);
      files.set(name, data);
    }
  }
  if ([...files.keys()].some((name) => name.startsWith('libraries/vendor/spmiddle/'))) {
    // Only the sibling root license is authorized outside packages/*/src.
    // Fixture package roots remain contained in tmp by sourceRoot above.
    const source = join(dirname(packages), 'LICENSE');
    noLinks(source);
    if (!existsSync(source) || !lstatSync(source).isFile()) throw new Error('Licença original SPMIDDLE ausente; integração não pode ser distribuída sem o aviso MIT.');
    const data = readFileSync(source);
    const text = data.toString('utf8');
    if (!/^MIT License\s+Copyright \(c\) 2026 SPMIDDLE contributors\s+/.test(text)
        || text.replace(/^MIT License\s+Copyright \(c\) 2026 SPMIDDLE contributors\s+/, '').replace(/\s+/g, ' ').trim() !== MIT_TERMS) {
      throw new Error('Licença SPMIDDLE MIT integral não reconhecida; revisar a licença antes do estágio.');
    }
    originals.set(source, data);
    files.set('libraries/vendor/spmiddle/LICENSE', data);
  }
  const loader = `export const version = ${JSON.stringify(version)};
export const releaseBase = new URL('./', import.meta.url).href;
export async function loadRelease({ start } = {}) {
  if (typeof start !== 'function') throw new TypeError('Host deve injetar start; nenhum bootstrap/config corporativo é incluído.');
  const modules = {
${Object.entries(available).map(([key, path]) => `    ${key}: await import('./${path}')`).join(',\n')}
  };
  return start({ version, releaseBase, modules });
}
`;
  files.set('loader.js', Buffer.from(loader));
  files.set('entrypoints.json', Buffer.from(json({
    version, target, entrypoints: available, loader: 'loader.js', editorBase: files.has('media/vendor/tinymce/tinymce.min.js') ? 'media/vendor/tinymce/' : null,
    ...(target !== 'core' ? {
      licenses: ['LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md', ...(files.has('libraries/vendor/spmiddle/LICENSE') ? ['libraries/vendor/spmiddle/LICENSE'] : []), ...(files.has('libraries/vendor/parse-xml/LICENSE') ? ['libraries/vendor/parse-xml/LICENSE', 'libraries/vendor/parse-xml/notices.txt'] : [])],
      publicationApproved: false
    } : {}),
    hostInjection: target === 'core'
      ? 'Call loadRelease({ start }); inject a dedicated DOM container and adminService/discoveryService as needed. Rich-text editing requires an injected richTextEditorFactory and separately licensed/validated assets; otherwise fields remain textareas. No host snippet, backend, ACL, uploads or persistence composition is included. Resolve assets against releaseBase.'
      : 'Call loadRelease({ start }) or fill the bundled host snippet placeholders; inject webUrl, lists, transport/file-client factories and DOM. Resolve every asset against releaseBase; never reuse an old bootstrap.',
    ...(target === 'core' ? {
      styles: { admin: 'media/templates/administrator/atum/css/template.css' },
      licenses: ['LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md', ...coreThirdPartyLicenses],
      scope: 'Offline source staging only, not a deployable CMS, tenant release or approval for public distribution.'
    } : {}),
    externalExtensions: 'Only bundled native modules/templates are closed here. Host-injected extensions/plugins/templates require their own immutable release and validation.'
  })));
  // Validate the transformed graph, including generated imports, before writing.
  for (const [name, data] of files) {
    for (const ref of references(data.toString('utf8'), name)) {
      const target = localPath(join(destination, name), ref.value);
      assertWithin(destination, target);
      const targetName = slash(relative(destination, target));
      const found = ref.directory ? [...files.keys()].some((path) => !targetName || path.startsWith(`${targetName}/`)) : files.has(targetName);
      if (!found) throw new Error(`Import/asset ausente na release: ${name} -> ${ref.value}`);
    }
  }
  for (const [source, data] of originals) {
    noLinks(source);
    if (!readFileSync(source).equals(data)) throw new Error(`Fonte alterada durante o estágio; tente novamente após estabilizar: ${source}`);
  }
  for (const [directory, entries] of sourceDirectories) {
    noLinks(directory);
    if (JSON.stringify(readdirSync(directory).sort()) !== JSON.stringify(entries)) throw new Error(`Árvore de fontes alterada durante o estágio; tente novamente após estabilizar: ${directory}`);
  }
  const manifest = {
    version, target, algorithm: 'sha256',
    files: [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, data]) => ({ path, bytes: data.length, sha256: sha256(data) }))
  };
  // mkdir without recursive is the final exclusive reservation, even in a race.
  mkdirSync(dirname(destination), { recursive: true });
  noLinks(destination);
  mkdirSync(destination);
  for (const [name, data] of [...files, ['manifest.json', Buffer.from(json(manifest))]]) {
    const path = join(destination, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data, { flag: 'wx' });
  }
  return { output: destination, manifest };
}

function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--version', '--output', '--target'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i].slice(2)] !== undefined) throw new Error('Uso: node scripts\\stage-release.js --version X.Y.Z --output tmp\\<destino-novo> [--target all|site|core]');
    options[args[i].slice(2)] = args[i + 1];
  }
  const result = stageRelease(options);
  console.log(`Release ${result.manifest.version} (${result.manifest.target}): ${result.manifest.files.length} arquivos SHA256; fechamento local validado em ${result.output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`stage-release: ${error.message}`); process.exitCode = 1; }
}
