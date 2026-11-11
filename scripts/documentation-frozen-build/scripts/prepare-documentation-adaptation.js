/* SPDX-License-Identifier: GPL-2.0-or-later
 * Private offline Documentation overlay; authored changes, not vendor clearance.
 */
import { mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { ADOPTION_MODULES, assertAdoptionNoLinks, parseModuleAdoptionArgs, validateAdoptionSchema } from './prepare-module-adoption.js';
import { parseJoomlaManifest, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { copyNativeMap } from './prepare-home-adaptation.js';
import { copyInertBuffer, inertAdaptationMetadata as inert, closedAdaptationShape as shape, parseAdaptationMetadata as metadata } from './prepare-hero-adaptation.js';
import {
  SAFE_URL_SOURCE, SHARED_SOURCE_PATH, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256,
  createAdaptationCollector, collectAdaptationDependencies, writeAdaptationFiles, readAdaptationFiles,
  assertNewAdaptationOutput, adaptationText, replaceAdaptationAnchor as replace,
  ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES, ADAPTATION_ORIGIN_COMMIT, ADAPTATION_API_FILES, ADAPTATION_LICENSE_NAMES
} from './prepare-editorial-adaptation.js';
export { SHARED_SOURCE_PATH, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256 };
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(PROJECT, 'tmp');
const CAMAP = resolve(PROJECT, '..', 'CAMAP2');
const DEPS = join(TMP, 'step2', 'camap-source');
const MODULE = 'mod_documentation'; const KEY = `camap.${MODULE}`;
export const DOCUMENTATION_SOURCE_PATH = `extensions/camap/${MODULE}/module.js`;
export const DOCUMENTATION_CSS_PATH = `extensions/camap/${MODULE}/documentation.css`;
export const DOCUMENTATION_API_SHA256 = 'ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4';
export const DOCUMENTATION_ANCHORS = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze(['fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e', '33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387']),
  [DOCUMENTATION_SOURCE_PATH]: Object.freeze(['ec455c39e09cb66875333891ab4674645c3be179cd55c1b63e463a2a14349fdd', 'ec455c39e09cb66875333891ab4674645c3be179cd55c1b63e463a2a14349fdd']),
  [DOCUMENTATION_CSS_PATH]: Object.freeze(['31251a6331f9a9ad56a6fc9ca74f5da4cf910de52a757fc5a71cffaacdb089b5', '31251a6331f9a9ad56a6fc9ca74f5da4cf910de52a757fc5a71cffaacdb089b5'])
});
// Final-byte table is an independent closed trust gate, never caller metadata.
const PINNED = Object.freeze({
  [SHARED_SOURCE_PATH]: Object.freeze({ raw: 'ab6e32d2105d45cff15b9aa55777675d42b418494f09b114317ae19d945f6002', lf: 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76', lengths: [654, 653, 1746, 1745] }),
  [DOCUMENTATION_SOURCE_PATH]: Object.freeze({ raw: 'a79ee923b8152e1a3563e7baaee98d70356e8d76611c38877e62b7e48cbdf7b9', lf: 'a79ee923b8152e1a3563e7baaee98d70356e8d76611c38877e62b7e48cbdf7b9', lengths: [18708, 18708, 22948, 22948] }),
  [DOCUMENTATION_CSS_PATH]: Object.freeze({ raw: '062b19ac80d014ba2bc2d95313333d227a1af8f21f07d5c60afa5ec39cbff22e', lf: '062b19ac80d014ba2bc2d95313333d227a1af8f21f07d5c60afa5ec39cbff22e', lengths: [5653, 5653, 7298, 7298] })
});
const LIB = `libraries/camap/${DOCUMENTATION_SOURCE_PATH}`; const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${MODULE}/css/documentation.css`; const ENTRY = `modules/${MODULE}/${MODULE}.js`; const XML = `modules/${MODULE}/${MODULE}.xml`;
const RUNTIME = [ENTRY, XML, CSS, LIB, SHARED]; const SCOPE = [DOCUMENTATION_SOURCE_PATH, SHARED_SOURCE_PATH, DOCUMENTATION_CSS_PATH];
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const FORMAT = 'minijoomla-documentation-adaptation-v1';
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(adaptationText(bytes, 'source').replace(/\r\n?/g, '\n'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const within = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const changeName = path => path === SHARED_SOURCE_PATH ? 'strict-url-policy-v1' : path === DOCUMENTATION_CSS_PATH ? 'documentation-scoped-reflow-focus-v1' : 'documentation-inert-tree-cycle-duplicate-url-v1';
export const DOCUMENTATION_DEFAULTS = Object.freeze({
  view: 'categories', title: 'Documentação', showPageHeading: false, pageHeading: 'Documentação', showBaseDescription: true,
  baseDescription: '', categories: Object.freeze([]), maxLevelCategories: -1, showEmptyCategoriesCat: false, showSubcatDescCat: true,
  showCatNumArticlesCat: true, activeCategoryId: '', showCategoryTitle: true, showDescription: true, showDescriptionImage: true,
  showCatTags: true, maxLevel: -1, showEmptyCategories: false, showSubcatDesc: false, showCatNumArticles: true, showNoArticles: true,
  rootLabel: 'Categorias', rootHref: '#documentacao', pagination: Object.freeze({})
});
const FIELDS = Object.freeze(Object.fromEntries(Object.entries(DOCUMENTATION_DEFAULTS).map(([name, value]) => [name, {
  type: name === 'view' ? 'enum' : name === 'categories' ? 'array' : name === 'pagination' ? 'object' : typeof value,
  ...(name === 'view' ? { values: ['categories', 'category'] } : {}),
  ...(['title', 'pageHeading', 'baseDescription', 'activeCategoryId', 'rootLabel', 'rootHref'].includes(name) ? { maxLength: { title: 160, pageHeading: 160, baseDescription: 2000, activeCategoryId: 120, rootLabel: 120, rootHref: 300 }[name] } : {}),
  ...(['maxLevel', 'maxLevelCategories'].includes(name) ? { min: -1, max: 10 } : {}), default: value
}])));

// Complete XML DATA captured from createXml in the SHA-pinned original creator,
// not reconstructed field attributes. Only the version element is substituted.
const XML_DATA = 'eJzNWM2O0zAQvu9TWOZM0y4SQlWS1VKQAO2ukNgLQghNk2nWxT+R7ZRWiKfhwIPsiyGnjjdp0opFIOVmz+eZ+WYyHtuJL7aCkw1qw5RM6GwypQRlpnImi4RWdvX0Bb1Iz2LcWpRuDbG7EhMqVF5xpCTjDKVNqGEWKRFo71Se0KosNORIyVZwaeZindBKy7lgkq2VEhzmupKWCZzPKBHr+VfcJTQDAeVEqPxLrrJKoLRgmZI0PSMkliAwXVxeX74nr9poHNWIW+KDSKeTZ5NpHDVTB+VoMs1KpzBkhLyDDXyoV5B9YGSlNLlmkr2r6U7iqG3CmVwxjsaN/NjR8Mp1dg6D6IkmaxNHjWZtMgo2Y4E5A5KjsUzWq4dskpXiOeqE1qvpAZk0MybqesxMz2WtWg8zJVesCEaQ54a4dQktQYMw3n4A0Xp4CYZlAW1wD24YfqOEwxJ5M8lxBRW37oNbLJRmaKivKs6MbVkiJFZ1xskGeIUdjfRhHEcqfJfTirugtusrudQgz48EYpl19e4j8bMQSiin+1/3PxUlArYcZWHvEjp7Pm3Cs7i1lERHPJg79e09FPgGwe2+4KsnD16DYQ05U6cSN6Ppxz9K1JSmN+qxuSkHWJeDjP9Vnl6CwVcPO7KTqx4WvM9Gkq/lEfY9eWDeydT5dNpJFWiE4+lq7zLvpy0KLj597tsU6/letDaOjljP67BvaxloDbvjfgVsr3CDfNH3PwQFHk/dkcCkH8A2obMQrazEEvXp0ngtSrt7sLwA26mOIXh0G8oR/VAtM7CuHA5DOEBGV96O4wLsTSUutWUZ73+EAXR0UUBm2QZ9peze5iGAPjC8TWfnj2hojbnbzjEzgIwuT47jsVY87jZ8wPCtgAKP0ffgKGNYgL2FwhxWzV42OsZN8++dBv/vDDh1AIy++x9p/SPl3e3sJ5r+CCvTkbxRg9zb4tHx1krZK8c1UG5JAtum5MH83SnlbL7RuOo42QuCjyfhvZlB93b/7DFX1hIK/+xtPyeCKLj7/uORV1a1XGPWjtEn1qD1D18/3z+OmydxHIXfH+nZbzwnXvU=';
export function documentationAdaptationXml(version) {
  if (!['0.3.0', '0.3.1'].includes(version)) throw new Error('Unauthorized Documentation XML version.');
  const bytes = inflateSync(Buffer.from(XML_DATA, 'base64'), { maxOutputLength: 64 * 1024 });
  if (sha256(bytes) !== '12cf6905116f5e6c9f8b9524364dc0378a3ce03e78b649a39f8cb7fa7887350d') throw new Error('Canonical original XML DATA changed.');
  return Buffer.from(replace(bytes.toString(), '<version>0.3.0</version>', `<version>${version}</version>`));
}

// Runtime data is JSON-like, but invalid in-memory accessors/functions are never
// invoked. Native prototypes/intrinsics are trusted; this is not a Proxy sandbox.
export const DOCUMENTATION_VALIDATION_SOURCE = String.raw`function _docPlain(value, budget) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length > 500 || (budget.keys += keys.length) > 10000) { budget.invalid = true; return null; }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || typeof descriptors[key].value === 'function')) return null;
  return descriptors;
}
function _docOwn(descriptors, key) { return descriptors && Object.hasOwn(descriptors, key) ? descriptors[key].value : undefined; }
function _docArray(value, budget) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return [];
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  const length = lengthDescriptor && Object.hasOwn(lengthDescriptor, 'value') ? lengthDescriptor.value : -1;
  // Length gate precedes enumeration and aggregate descriptor work.
  if (!Number.isSafeInteger(length) || length < 0 || length > 500) { budget.invalid = true; return []; }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== length + 1 || (budget.keys += keys.length) > 10000) { budget.invalid = true; return []; }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) return [];
  const rows = [];
  for (let index = 0; index < length; index += 1) rows.push(descriptors[index].value);
  return rows;
}
function _docString(value, budget) {
  if (typeof value !== 'string') return '';
  if ((budget.characters += value.length) > 1000000) { budget.invalid = true; return ''; }
  return value;
}
function _docId(value, budget) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return _docString(value, budget).trim();
}
function _docHref(value, budget) {
  const href = _docString(value, budget);
  return href && safeUrl(href) === href ? href : '';
}
function _docNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.length > 100 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isFinite(number) ? number : null;
}
function _docPage(value) {
  const number = Math.max(1, Math.floor(_docNumber(value) ?? 1));
  return Number.isSafeInteger(number) ? number : 1;
}
function normalizeArticle(raw, budget) {
  if (++budget.articles > 500) { budget.invalid = true; return null; }
  const d = _docPlain(raw, budget);
  const title = _docString(_docOwn(d, 'title'), budget).trim();
  const published = _docOwn(d, 'published');
  if (!d || !title || published !== undefined && typeof published !== 'boolean') return null;
  return { id: _docId(_docOwn(d, 'id'), budget), title, href: _docHref(_docOwn(d, 'href'), budget), published: published === undefined ? true : published };
}
function normalizeCategory(raw, budget) {
  const d = _docPlain(raw, budget);
  const id = _docId(_docOwn(d, 'id'), budget);
  if (!d || !id) return null;
  const parentValue = _docOwn(d, 'parentId');
  if (parentValue !== null && parentValue !== undefined && typeof parentValue !== 'string' && !(typeof parentValue === 'number' && Number.isFinite(parentValue))) return null;
  const parentId = parentValue === null || parentValue === undefined ? null : _docId(parentValue, budget) || null;
  const articles = _docArray(_docOwn(d, 'articles'), budget).map(row => normalizeArticle(row, budget)).filter(Boolean);
  const tags = _docArray(_docOwn(d, 'tags'), budget).map(tag => _docString(tag, budget).trim()).filter(Boolean);
  const number = _docNumber(_docOwn(d, 'numItems'));
  const numItems = number !== null && number >= 0 ? Math.floor(number) : articles.length;
  const image = _docHref(_docOwn(d, 'image'), budget);
  return { id, parentId, title: _docString(_docOwn(d, 'title'), budget).trim() || id,
    href: _docHref(_docOwn(d, 'href'), budget), description: _docString(_docOwn(d, 'description'), budget).trim(),
    image: image && !image.includes('#') && (image.startsWith('/') || /^https:\/\//i.test(image)) ? image : '',
    imageAlt: _docString(_docOwn(d, 'imageAlt'), budget).trim(), tags, articles, numItems };
}
function buildTree(rawCategories, budget) {
  const normalized = _docArray(rawCategories, budget).map(row => normalizeCategory(row, budget)).filter(Boolean);
  const byId = new Map();
  for (const node of normalized) {
    // Never choose an arbitrary last writer for an ambiguous normalized ID.
    if (byId.has(node.id)) return { byId: new Map(), roots: [] };
    byId.set(node.id, { ...node, children: [] });
  }
  if (budget.invalid) return { byId: new Map(), roots: [] };
  const invalid = new Set(); const settled = new Set();
  for (const start of byId.values()) {
    const path = []; const seen = new Set(); let cursor = start;
    while (cursor && !settled.has(cursor.id) && !seen.has(cursor.id)) {
      path.push(cursor.id); seen.add(cursor.id); cursor = byId.get(cursor.parentId);
    }
    if (cursor && (seen.has(cursor.id) || invalid.has(cursor.id))) for (const id of path) invalid.add(id);
    for (const id of path) settled.add(id);
  }
  // Ancestors in cycles and ALL their descendants are unavailable even by ID.
  for (const id of invalid) byId.delete(id);
  const roots = [];
  for (const node of byId.values()) {
    const parent = byId.get(node.parentId);
    if (parent) parent.children.push(node); else roots.push(node);
  }
  return { byId, roots };
}
function normalizeConfig(settings) {
  const budget = { keys: 0, characters: 0, articles: 0, invalid: false };
  const d = _docPlain(settings, budget); const c = { ...defaults };
  for (const [name, fallback] of Object.entries(defaults)) {
    if (!d || !Object.hasOwn(d, name)) continue;
    const value = d[name].value;
    if (typeof fallback === 'boolean') c[name] = value === true;
    else if (typeof fallback === 'string') c[name] = _docString(value, budget);
    else if (typeof fallback === 'number') c[name] = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }
  c.view = c.view === 'category' ? 'category' : 'categories';
  c.tree = buildTree(_docOwn(d, 'categories'), budget);
  const p = _docPlain(_docOwn(d, 'pagination'), budget);
  c.pagination = { page: _docPage(_docOwn(p, 'page')),
    totalPages: _docPage(_docOwn(p, 'totalPages')),
    prevHref: _docHref(_docOwn(p, 'prevHref'), budget), nextHref: _docHref(_docOwn(p, 'nextHref'), budget) };
  c.rootHref = _docHref(c.rootHref, budget);
  if (budget.invalid) { c.tree = { byId: new Map(), roots: [] }; c.pagination = {}; }
  return c;
}
function _docContext(context) {
  const budget = { keys: 0, characters: 0, articles: 0, invalid: false };
  const d = _docPlain(context, budget);
  return renderDocumentation(_docOwn(d, 'settings'), _docOwn(d, 'state'));
}`;

const DOCUMENTATION_CSS_APPROVED_DEEP = '.camap-documentation{overflow-wrap:anywhere;container-type:inline-size}\n.camap-documentation__cards{grid-template-columns:repeat(auto-fit,minmax(min(16rem,100%),1fr))}\n.camap-documentation__card,.camap-documentation__card-title,.camap-documentation__card-title a,.camap-documentation__article-list a,.camap-documentation__children-item a,.camap-documentation__children,.camap-documentation__desc,.camap-documentation__tags li{min-width:0;max-width:100%;box-sizing:border-box}\n.camap-documentation__card-title,.camap-documentation__article-list li{flex-wrap:wrap}\n.camap-documentation__back,.camap-documentation__pagination-link{flex-wrap:wrap;max-width:100%;box-sizing:border-box}\n.camap-documentation__pagination-links{flex-wrap:wrap;min-width:0;max-width:100%}\n.camap-documentation__children-item>.camap-documentation__children{flex-basis:100%}\n.camap-documentation a:focus-visible{outline:3px solid #006298;outline-offset:-3px}\n.camap-documentation__back:focus-visible{outline-color:#fff}\n@container(max-width:400px){.camap-documentation__card>.camap-documentation__cards .camap-documentation__card{padding:0;border-width:0;border-left-width:1px}.camap-documentation__children .camap-documentation__children{margin-left:0}.camap-documentation__cards{grid-template-columns:minmax(0,1fr)}}\n.camap-documentation__children .camap-documentation__children{margin-left:0}\n.camap-documentation__children .camap-documentation__children .camap-documentation__children-item{padding:.5rem 0;border-left:1px solid #e3e9ed}\n';
// Preserve coordinator-approved deep CSS verbatim, then relieve nested cards
// even inside a narrow column of a wide multi-root module. No root-card reset.
export const DOCUMENTATION_CSS_APPEND = DOCUMENTATION_CSS_APPROVED_DEEP + '.camap-documentation__card>.camap-documentation__cards .camap-documentation__card{padding:0;border-width:0;border-left-width:1px}\n';

/** Exactly three approved full-byte sources; no caller patch/hash policy. */
export function applyDocumentationOverlay(originals) {
  const sources = copyNativeMap(originals, 'Overlay sources');
  if (sources.size !== 3 || Object.keys(DOCUMENTATION_ANCHORS).some(path => !sources.has(path))) throw new Error('Overlay requires exactly the three approved sources.');
  const files = new Map(); const changes = []; const budget = { bytes: 0 };
  for (const [path, hashes] of Object.entries(DOCUMENTATION_ANCHORS)) {
    const bytes = copyInertBuffer(sources.get(path), budget, 'Source'); const source = adaptationText(bytes, path);
    const originalSha256 = sha256(bytes);
    if (!hashes.includes(originalSha256)) throw new Error(`Unapproved original SHA-256: ${path}`);
    const crlf = source.includes('\r\n'); const mixed = crlf && /(?<!\r)\n/.test(source); const eol = crlf && !mixed ? '\r\n' : '\n';
    let patched = source;
    if (path === SHARED_SOURCE_PATH) patched = replace(source, "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }", SAFE_URL_SOURCE.replace(/\n/g, eol));
    if (path === DOCUMENTATION_CSS_PATH) patched += `${eol}${DOCUMENTATION_CSS_APPEND}${eol}`;
    if (path === DOCUMENTATION_SOURCE_PATH) {
      const start = source.indexOf('function normalizeArticle(raw) {');
      const end = source.indexOf('// ---------------------------------------------------------------------------\n// View "categories"');
      if (start < 0 || end <= start) throw new Error('Normalization exact anchors changed.');
      patched = replace(patched, source.slice(start, end), `${DOCUMENTATION_VALIDATION_SOURCE}${eol}${eol}`);
      patched = replace(patched, 'const { roots } = buildTree(c.categories);', 'const { roots } = c.tree;');
      patched = replace(patched, 'const { byId } = buildTree(c.categories);', 'const { byId } = c.tree;');
      patched = replace(patched, 'byId.get(String(c.activeCategoryId).trim())', 'byId.get(c.activeCategoryId.trim())');
      patched = replace(patched, "const backHref = parent ? safeUrl(parent.href) : safeUrl(c.rootHref, '#');", 'const backHref = parent ? parent.href : c.rootHref;');
      patched = replace(patched, 'const backLabel = parent ? parent.title : c.rootLabel || defaults.rootLabel;', 'const backLabel = parent ? parent.title : c.rootLabel;');
      patched = replace(patched, 'const back = `<a class="camap-documentation__back" href="${escapeHtml(backHref)}">${ICON_PREV}${escapeHtml(backLabel)}</a>`;', 'const back = backHref && backHref !== \'#\' ? `<a class="camap-documentation__back" href="${escapeHtml(backHref)}">${ICON_PREV}${escapeHtml(backLabel)}</a>` : `<span class="camap-documentation__back">${ICON_PREV}${escapeHtml(backLabel)}</span>`;');
      const pageStart = source.indexOf('  const page = Number.isFinite(Number(pagination.page))');
      const pageEnd = source.indexOf('  if (totalPages <= 1)', pageStart);
      patched = replace(patched, source.slice(pageStart, pageEnd), '  const page = pagination.page ?? 1;\n  const totalPages = pagination.totalPages ?? 1;\n');
      patched = replace(patched, 'const prev = pagination.prevHref', "const prev = pagination.prevHref && pagination.prevHref !== '#'");
      patched = replace(patched, 'const next = pagination.nextHref', "const next = pagination.nextHref && pagination.nextHref !== '#'");
      patched = replace(patched, "  const status = stateMessage(state, 'Nenhum conteúdo de documentação disponível.');", "  state = typeof state === 'string' ? state : '';\n  const status = stateMessage(state, 'Nenhum conteúdo de documentação disponível.');");
      patched = replace(patched, 'render: ({ settings, state } = {}) => renderDocumentation(settings, state)', 'render: (context = {}) => _docContext(context)');
    }
    const modified = Buffer.from(patched); files.set(path, modified);
    changes.push({ path, originalSha256, modifiedSha256: sha256(modified), generatedSha256: sha256(lf(modified)), originalBytes: bytes.length, modifiedBytes: modified.length,
      encoding: 'UTF-8', bom: source.startsWith('\uFEFF'), lineEndings: mixed ? 'mixed LF/CRLF preserved' : crlf ? 'CRLF' : 'LF', change: changeName(path) });
  }
  return { files, changes };
}

function planOptions(input = {}) {
  const clean = inert(input);
  if (!clean || typeof clean !== 'object' || Array.isArray(clean) || Buffer.isBuffer(clean) || Object.keys(clean).some(key => !['module', 'version', 'base', 'output', 'sourceRoot', 'dependenciesRoot', 'inheritedLicense'].includes(key) || typeof clean[key] !== 'string')) throw new Error('Unknown or non-string adaptation option refused.');
  const args = { ...clean, module: clean.module ?? MODULE, version: clean.version ?? '0.3.0', dependenciesRoot: clean.dependenciesRoot ?? 'tmp/step2/camap-source' };
  parseModuleAdoptionArgs(Object.entries(args).filter(([key]) => key !== 'inheritedLicense').flatMap(([key, value]) => [{ sourceRoot: '--source', dependenciesRoot: '--dependencies-root' }[key] ?? `--${key}`, value]));
  if (args.module !== MODULE || !['0.3.0', '0.3.1'].includes(args.version)) throw new Error('Only mod_documentation versions 0.3.0 and 0.3.1 are authorized.');
  if (!/^tmp\/documentation-adapt-agent-[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(args.output)) throw new Error('--output must name a new tmp/documentation-adapt-agent-* directory.');
  const source = resolve(PROJECT, args.sourceRoot ?? CAMAP); const dependencies = resolve(PROJECT, args.dependenciesRoot); const destination = resolve(PROJECT, args.output);
  const inheritedLicense = resolve(PROJECT, args.inheritedLicense ?? join(dirname(CAMAP), 'LICENSE'));
  if (inheritedLicense !== join(dirname(CAMAP), 'LICENSE') && (!within(TMP, inheritedLicense) || inheritedLicense === TMP)) throw new Error('Inherited license must be approved aggregator LICENSE or an explicit tmp file.');
  if (within(destination, inheritedLicense) || within(source, dependencies) || within(dependencies, source) || [source, dependencies].some(path => within(destination, path) || within(path, destination))) throw new Error('Input/license/output paths must not overlap.');
  return { args, source, dependencies, destination, inheritedLicense };
}

async function collectSources(source) {
  const collected = createAdaptationCollector(); await collected.add(source, SHARED_SOURCE_PATH);
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
  for (const name of ADAPTATION_LICENSE_NAMES) {
    try { await collected.add(source, name); throw new Error('Pinned Documentation profile has no CAMAP-root notices; new notice requires review.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let trusted;
  if (source !== CAMAP) {
    trusted = await collectSources(CAMAP);
    if (collected.files.size !== trusted.collected.files.size || [...collected.files].some(([key, { bytes }]) => !trusted.collected.files.get(key) || !lf(bytes).equals(lf(trusted.collected.files.get(key).bytes)))) throw new Error('Source override is not an original trusted CAMAP copy.');
  }
  const overlay = applyDocumentationOverlay(new Map(Object.keys(DOCUMENTATION_ANCHORS).map(path => [path, collected.files.get(path)?.bytes])));
  return { collected, overlay, async check() { await collected.check(); if (trusted) await trusted.check(); } };
}

const POLICY = 'Own plain inert render data only, no getters/functions/arbitrary coercion or writes. All 24 ordered fields, complete defaults, enum options and original constraints remain unchanged. Native dense arrays are length-gated at 500 before descriptors; aggregate articles capped at 500, own descriptor keys at 10000 and rendered source strings at 1000000 UTF-16 units per call. These are fixed runtime resource guards, not persisted schema constraints. IDs accept nonblank strings or finite primitive numbers; parent null/undefined/blank means root. Invalid articles need a nonblank string title; explicit published is boolean only, absent/undefined means true, false is excluded; invalid flags omit the row rather than Boolean conversion. Counts retain valid precomputed finite nonnegative numeric/strict decimal values, floor them, otherwise use normalized article length, not live published counts. Strings invalid as UI content render empty; present booleans are true only for true. Finite fractional maxLevel semantics are retained without truncation. Duplicate normalized IDs reject the entire ambiguous tree in both views. Cycles, self-parents and all cyclic ancestry descendants are removed from byId before active lookup; valid dangling-parent roots and input order remain. Original hard depth 20 remains, no repeated nodes or new recursive backend. Unsafe hrefs become nonlinks, unsafe back retains a span label, unsafe prev/next controls omit anchors. Images require strict credential-free HTTPS/server-relative URLs without fragments; invalid media is omitted, never empty src. Pagination uses finite primitives/strict decimal strings floored to at least 1, links/counters are host-precomputed, not Joomla navigation or automatic data sources. Tags are own string arrays only. Heading h1/h2 and historical labels are retained; no global IDs were added or claimed fixed. CSS retains original bytes and appends only scoped wrapping, bounded card grid, flex/min-width/media sizing, focus and narrow-root container reflow. At <=400px nested card padding/border-left and child-list indentation are reduced, never content hidden. MIT aggregator evidence covers only the three selected hashes, not Phoca/Joomla upstream clearance. PHP/phoca reference headers identify Joomla GPL-2.0-or-later material; upstream attribution/licensing review is a mandatory separate gate before distribution/publication. No PHP, Phoca assets, backend, tenant, browser, root configuration or other packages are changed.';

/** Closed five-file runtime, complete canonical XML and byte-pinned provenance. */
export function finalizeDocumentationPackage(stagedFiles, evidence) {
  const staged = copyNativeMap(stagedFiles, 'Staged files');
  const p = shape(inert(evidence), ['changes', 'licenses', 'inheritedLicense', 'inheritedLicenseBytes', 'changesLicenseBytes', 'changesLicenseSource', 'generatorSha256', 'adoptionApiSha256', 'snapshot'], 'provenance');
  if (!Array.isArray(p.licenses) || p.licenses.length) throw new Error('Unapproved staged package/license paths.');
  const controls = ['MANIFEST-SHA256.json', 'host-config.json', 'adoption-plan.json', 'docs/ADOPTION-NOTICE.md'];
  const files = new Map(); const budget = { bytes: 0 };
  for (const [name, bytes] of staged) { packagePath(name); if (![...RUNTIME, ...controls].includes(name)) throw new Error(`Staged path outside Documentation allowlist: ${name}`); files.set(name, copyInertBuffer(bytes, budget, 'Package')); }
  if ([...RUNTIME, ...controls].some(name => !files.has(name))) throw new Error('Missing mandatory Documentation runtime/control payload.');
  if (!files.get(ENTRY).equals(Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`))) throw new Error('Documentation wrapper differs from original generator.');
  const inventoryBytes = files.get('MANIFEST-SHA256.json');
  const inventory = shape(metadata(inventoryBytes, 'inventory'), ['format', 'version', 'files', 'moduleStyles', 'moduleKeys'], 'inventory');
  const hostConfig = shape(metadata(files.get('host-config.json'), 'host config'), ['joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions'], 'host config');
  const adoptionPlan = shape(metadata(files.get('adoption-plan.json'), 'adoption plan'), ['format', 'profile', 'module', 'key', 'version', 'base', 'pilot', 'validation', 'licenses', 'sourceLicensePresent', ...FLAGS, 'nextGate', 'hostNote'], 'adoption plan');
  if (['validation', 'nextGate', 'hostNote'].some(key => typeof adoptionPlan[key] !== 'string') || inventory.format !== 'minijoomla-joomla-package-v1' || !Array.isArray(inventory.files)) throw new Error('Unexpected staged controls.');
  const expected = new Set(['MANIFEST-SHA256.json', 'host-config.json']);
  for (const entry of inventory.files) { shape(entry, ['path', 'bytes', 'sha256'], 'inventory entry'); packagePath(entry.path); const bytes = files.get(entry.path); if (expected.has(entry.path) || !bytes || entry.bytes !== bytes.length || entry.sha256 !== sha256(bytes)) throw new Error('Staged inventory integrity failure.'); expected.add(entry.path); }
  if (expected.size !== files.size) throw new Error('Uninventoried staged file.');
  if (!Array.isArray(hostConfig.joomlaDiscoveryRoots) || hostConfig.joomlaDiscoveryRoots.length !== 1) throw new Error('One immutable discovery root required.');
  const root = shape(hostConfig.joomlaDiscoveryRoots[0], ['id', 'baseUrl', 'inventoryHash', 'immutable', 'discover'], 'discovery root');
  planOptions({ version: inventory.version, base: root.baseUrl, output: 'tmp/documentation-adapt-agent-validation' });
  if (root.inventoryHash !== sha256(inventoryBytes) || root.immutable !== true || root.discover !== true || root.id !== `camap-${MODULE}-${inventory.version}`) throw new Error('Staged control hash/identity differs.');
  if (adoptionPlan.format !== 'minijoomla-module-adoption-v1' || adoptionPlan.profile !== 'joomla-xml-v1' || adoptionPlan.module !== MODULE || adoptionPlan.key !== KEY || adoptionPlan.version !== inventory.version || adoptionPlan.base !== root.baseUrl || adoptionPlan.pilot !== false || adoptionPlan.sourceLicensePresent !== false || !same(adoptionPlan.licenses, []) || FLAGS.some(flag => adoptionPlan[flag] !== false)) throw new Error('Staged adoption identity/flags differ.');
  if (!files.get(XML).equals(documentationAdaptationXml(inventory.version))) throw new Error('Staged XML canonical complete defaults/attributes differ.');
  const descriptor = parseJoomlaManifest(files.get(XML), { baseUrl: root.baseUrl, manifestPath: XML });
  validateAdoptionSchema(descriptor, { defaults: DOCUMENTATION_DEFAULTS, settingsSchema: { version: 1, fields: FIELDS }, default: { name: KEY, settings: DOCUMENTATION_DEFAULTS, render() {} } });
  if (descriptor.version !== inventory.version || descriptor.requiredFolders.length || descriptor.entryPointUrl !== `${root.baseUrl}/${ENTRY}` || !same(descriptor.styles, [`${root.baseUrl}/${CSS}`]) || !same(descriptor.requiredFiles, [ENTRY, CSS]) || !same(descriptor.params.map(param => param.label), Object.keys(FIELDS))) throw new Error('Staged XML identity/closure/labels differ.');
  if (!same(inventory.moduleKeys, { [MODULE]: KEY }) || !same(inventory.moduleStyles, { [KEY]: [CSS] }) || !same(hostConfig.moduleStyles, { [KEY]: descriptor.styles }) || !same(hostConfig.moduleStyleRevisions, { [KEY]: { [descriptor.entryPointUrl]: descriptor.styles } })) throw new Error('Staged module/style controls differ.');
  if (!Array.isArray(p.changes) || p.changes.length !== 3 || new Set(p.changes.map(change => change.path)).size !== 3 || !ADAPTATION_GENERATOR_HASHES.includes(p.generatorSha256) || p.adoptionApiSha256 !== DOCUMENTATION_API_SHA256) throw new Error('Unapproved adaptation generator/API provenance.');
  for (const change of p.changes) {
    shape(change, ['path', 'originalSha256', 'modifiedSha256', 'generatedSha256', 'originalBytes', 'modifiedBytes', 'encoding', 'bom', 'lineEndings', 'change'], 'change');
    const pin = PINNED[change.path]; const raw = change.originalSha256 === DOCUMENTATION_ANCHORS[change.path]?.[0];
    if (!pin || !DOCUMENTATION_ANCHORS[change.path].includes(change.originalSha256) || change.originalBytes !== pin.lengths[raw ? 0 : 1] || change.modifiedBytes !== pin.lengths[raw ? 2 : 3] || change.modifiedSha256 !== pin[raw ? 'raw' : 'lf'] || change.generatedSha256 !== pin.lf || sha256(files.get(change.path === DOCUMENTATION_CSS_PATH ? CSS : `libraries/camap/${change.path}`)) !== pin.lf || change.encoding !== 'UTF-8' || change.bom !== (change.path === SHARED_SOURCE_PATH) || change.lineEndings !== (raw && change.path === SHARED_SOURCE_PATH ? 'mixed LF/CRLF preserved' : 'LF') || change.change !== changeName(change.path)) throw new Error('Packaged overlay differs from approved patch.');
  }
  if (!Array.isArray(p.snapshot) || p.snapshot.length < 15 || new Set(p.snapshot.map(entry => entry.path.toLowerCase())).size !== p.snapshot.length) throw new Error('Missing/invalid bounded snapshot provenance.');
  let snapshotBytes = 0;
  for (const entry of p.snapshot) {
    shape(entry, ['path', 'originalSha256', 'snapshotSha256', 'bytes'], 'snapshot entry'); packagePath(entry.path);
    const allowed = [SHARED_SOURCE_PATH, 'tools/prepare-joomla-modules.js', 'package.json'].includes(entry.path) || ADOPTION_MODULES.some(({ folder }) => new RegExp(`^extensions/camap/${folder}/[^/]+\\.(js|css)$`).test(entry.path));
    if (!allowed || ![entry.originalSha256, entry.snapshotSha256].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || (snapshotBytes += entry.bytes) > 10 * 1024 * 1024) throw new Error('Invalid bounded snapshot entry.');
  }
  const mandatory = [SHARED_SOURCE_PATH, DOCUMENTATION_CSS_PATH, 'tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.map(({ folder }) => `extensions/camap/${folder}/module.js`)];
  if (mandatory.some(path => !p.snapshot.some(entry => entry.path === path)) || p.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length !== 3 || p.changes.some(change => !p.snapshot.some(entry => entry.path === change.path && entry.originalSha256 === change.originalSha256 && entry.snapshotSha256 === change.modifiedSha256 && entry.bytes === change.originalBytes)) || p.snapshot.find(entry => entry.path === 'tools/prepare-joomla-modules.js').originalSha256 !== p.generatorSha256) throw new Error('Snapshot must record eleven original modules and exactly three approved patches.');
  const inherited = shape(p.inheritedLicense, ['license', 'origin', 'originCommit', 'sha256', 'historicalLfSha256', 'packagePath', 'scope', 'globalVendorRightsApproved', 'evidence'], 'MIT evidence');
  if (!Buffer.isBuffer(p.inheritedLicenseBytes) || !ADAPTATION_MIT_HASHES.includes(sha256(p.inheritedLicenseBytes)) || inherited.sha256 !== sha256(p.inheritedLicenseBytes) || inherited.license !== 'MIT' || inherited.origin !== 'aggregator root LICENSE' || inherited.originCommit !== ADAPTATION_ORIGIN_COMMIT || inherited.packagePath !== INHERITED_LICENSE_PATH || inherited.historicalLfSha256 !== ADAPTATION_MIT_HASHES[1] || inherited.globalVendorRightsApproved !== false || typeof inherited.evidence !== 'string' || !same(inherited.scope, SCOPE)) throw new Error('Missing/invalid scoped inherited MIT evidence.');
  const changesLicenseSource = shape(p.changesLicenseSource, ['path', 'sha256', 'license', 'scope'], 'GPL evidence');
  if (!Buffer.isBuffer(p.changesLicenseBytes) || sha256(p.changesLicenseBytes) !== CHANGES_LICENSE_SHA256 || !same(changesLicenseSource, { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' })) throw new Error('Missing/invalid authored changes GPL evidence.');
  files.set(INHERITED_LICENSE_PATH, p.inheritedLicenseBytes); files.set(CHANGES_LICENSE_PATH, p.changesLicenseBytes);
  Object.assign(adoptionPlan, { licenses: [INHERITED_LICENSE_PATH], sourceRootLicensePresent: false, sourceLicensePresent: true, inheritedLicenseSource: inherited, changesLicenseSource, adaptation: { format: FORMAT, revision: 1, provenance: 'ADAPTATION.json', changesLicense: 'GPL-2.0-or-later', vendorRightsCleared: false }, nextGate: 'Mandatory Phoca/Joomla upstream attribution/license review plus coordinator site/lifecycle verification; no distribution, installation or publication approval.' });
  const adaptation = { format: FORMAT, revision: 1, module: MODULE, version: inventory.version, originalSource: 'local CAMAP2 read-only bounded snapshot', changes: p.changes, generator: { path: 'tools/prepare-joomla-modules.js', sha256: p.generatorSha256, algorithmModified: false }, adoptionApi: { path: 'scripts/prepare-module-adoption.js', sha256: p.adoptionApiSha256, byteIdenticalRelocation: true }, snapshot: p.snapshot, originalLicenses: [], inheritedLicenseSource: inherited, changesLicense: 'GPL-2.0-or-later', changesLicenseSource, vendorLicenseAssigned: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), schemaModified: false, cssModified: true, markupModified: true, otherPackagesModified: false, upstreamRightsReviewRequired: true, policy: POLICY };
  files.delete('MANIFEST-SHA256.json'); files.delete('host-config.json'); files.set('adoption-plan.json', json(adoptionPlan)); files.set('ADAPTATION.json', json(adaptation));
  files.set('docs/ADAPTATION-NOTICE.md', Buffer.from(`Local Documentation adaptation, revision 1. Exactly three pinned source patches. ${POLICY} Full aggregator MIT and authored-change GPL texts retained verbatim in docs/licenses/CAMAP-ROOT-MIT.txt and docs/licenses/GPL-2.0.txt. The original Phoca-derived layout claim is preserved as provenance, not MIT ownership or legal clearance. Required Phoca/Joomla upstream review must establish appropriate attribution/notices before any distribution/publication. No blanket vendor relicensing or completed site review is implied.\n`));
  inventory.files = [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  if (files.size !== 11 || inventory.files.length !== 11) throw new Error('Documentation final closure must contain exactly eleven inventoried payloads.');
  const finalInventory = json(inventory); root.inventoryHash = sha256(finalInventory); const finalConfig = json(hostConfig);
  if (finalInventory.length > 64 * 1024 || [...files.values()].reduce((sum, bytes) => sum + bytes.length, finalInventory.length + finalConfig.length) > 10 * 1024 * 1024) throw new Error('Final package/inventory budget exceeded.');
  files.set('MANIFEST-SHA256.json', finalInventory); files.set('host-config.json', finalConfig);
  return { files, inventory, hostConfig, adaptation, adoptionPlan, descriptor };
}

export async function prepareDocumentationAdaptation(input = {}) {
  const plan = planOptions(input); await assertNewAdaptationOutput(plan.destination);
  const [sources, dependencies, evidence] = await Promise.all([collectSources(plan.source), collectAdaptationDependencies(plan.dependencies), (async () => {
    const collected = createAdaptationCollector(); for (const name of ADAPTATION_API_FILES) await collected.add(PROJECT, name);
    if (sha256(collected.files.get('scripts/prepare-module-adoption.js').bytes) !== DOCUMENTATION_API_SHA256) throw new Error('Original adoption API hash changed; review required.');
    const gpl = await collected.add(PROJECT, CHANGES_LICENSE_PATH);
    const mit = await collected.add(dirname(plan.inheritedLicense), plan.inheritedLicense.slice(dirname(plan.inheritedLicense).length + 1));
    if (sha256(gpl) !== CHANGES_LICENSE_SHA256 || !ADAPTATION_MIT_HASHES.includes(sha256(mit))) throw new Error('Original full MIT/GPL license evidence differs.');
    return { collected, mit, gpl };
  })()]);
  let trustedDeps;
  if (plan.dependencies !== DEPS) { trustedDeps = await collectAdaptationDependencies(DEPS); if (dependencies.files.size !== trustedDeps.files.size || [...dependencies.files].some(([key, { bytes }]) => !trustedDeps.files.get(key)?.bytes.equals(bytes))) throw new Error('Dependency override differs from trusted local offline closure.'); }
  const check = () => Promise.all([sources.check(), dependencies.check(), evidence.collected.check(), trustedDeps?.check()]);
  await check(); await assertAdoptionNoLinks(TMP, { allowMissing: true }); await mkdir(TMP, { recursive: true });
  const stage = await mkdtemp(join(TMP, 'documentation-adapt-agent-stage-'));
  await writeAdaptationFiles(stage, new Map([...evidence.collected.files.values()].filter(({ name }) => ADAPTATION_API_FILES.includes(name)).map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(stage, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const snapshot = join(stage, 'tmp', 'source'); await writeAdaptationFiles(snapshot, new Map([...sources.collected.files.values()].map(({ name, bytes }) => [name, sources.overlay.files.get(name) ?? bytes])));
  const deps = join(stage, 'tmp', 'dependencies'); await writeAdaptationFiles(deps, new Map([...dependencies.files.values()].map(({ name, bytes }) => [name, bytes])));
  await writeAdaptationFiles(deps, new Map([['package.json', json({ private: true, type: 'module' })]]));
  const adoption = await import(pathToFileURL(join(stage, 'scripts', 'prepare-module-adoption.js')).href);
  const prepared = await adoption.prepareModuleAdoption({ module: MODULE, version: plan.args.version, base: plan.args.base, sourceRoot: snapshot, dependenciesRoot: deps, output: 'tmp/prepared' });
  const provenance = { changes: sources.overlay.changes, licenses: [], inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(evidence.mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: SCOPE, globalVendorRightsApproved: false, evidence: 'Exact local three-file hashes compared with targeted Git blobs at originCommit; LF only normalization. Aggregator notice does not establish Phoca/Joomla upstream rights.' }, inheritedLicenseBytes: evidence.mit, changesLicenseBytes: evidence.gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' }, generatorSha256: sha256(sources.collected.files.get('tools/prepare-joomla-modules.js').bytes), adoptionApiSha256: sha256(evidence.collected.files.get('scripts/prepare-module-adoption.js').bytes), snapshot: [...sources.collected.files.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')).map(({ name, bytes }) => ({ path: name, originalSha256: sha256(bytes), snapshotSha256: sha256(sources.overlay.files.get(name) ?? bytes), bytes: bytes.length })) };
  const finalized = finalizeDocumentationPackage(await readAdaptationFiles(prepared.output), provenance);
  await check(); await assertAdoptionNoLinks(plan.destination, { allowMissing: true }); await mkdir(dirname(plan.destination), { recursive: true }); await assertNewAdaptationOutput(plan.destination);
  await mkdir(plan.destination); await writeAdaptationFiles(plan.destination, finalized.files);
  return { ...finalized, output: plan.destination, stage, snapshot, originalSourceFiles: sources.collected.files.size, dependencyFiles: dependencies.files.size };
}
export function parseDocumentationAdaptationArgs(argv = process.argv.slice(2)) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { help: true };
  const args = {};
  for (let i = 0; i < argv.length; i += 2) { const key = argv[i]; const name = { '--source': 'sourceRoot', '--dependencies-root': 'dependenciesRoot', '--inherited-license': 'inheritedLicense' }[key] ?? key.slice(2); if (!['--module', '--version', '--base', '--output', '--source', '--dependencies-root', '--inherited-license'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(args, name)) throw new Error('Invalid, duplicate or missing CLI argument.'); args[name] = argv[i + 1]; }
  return planOptions(args).args;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = parseDocumentationAdaptationArgs(); if (args.help) console.log('Usage: node scripts/prepare-documentation-adaptation.js --base /offline/documentation/0.3.0 --output tmp/documentation-adapt-agent-new [--version 0.3.0|0.3.1] [--module mod_documentation] [--source tmp/original-copy] [--dependencies-root tmp/step2/camap-source] [--inherited-license tmp/approved-MIT.txt]. Private offline preparation; mandatory upstream rights review; no installation/publication.'); else { const result = await prepareDocumentationAdaptation(args); console.log(`Prepared Documentation ${result.inventory.version}: ${result.inventory.files.length} inventoried payloads, ${result.files.size} total files, ${result.originalSourceFiles} original sources, ${result.dependencyFiles} dependencies; 24 fields, three patches. Rights/site/publication gates remain closed. Output: ${result.output}`); } }
  catch (error) { console.error(`prepare-documentation-adaptation: ${error.message}`); process.exitCode = 1; }
}
