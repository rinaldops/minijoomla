/* Sample data is a host-supplied JSON package, never executable/imported code.
 * Creation only: no update, delete, automatic adoption or rollback. A durable
 * pending entry deliberately survives an uncertain write (including navigation).
 */
import { parseJsonObject, coerceParam, normalizeParamDefinitions, normalizeParamValues } from './declared-params.js';
import { moduleTypeCatalog, MODULE_ADVANCED_PARAMS, MODULE_CLASS_PATTERN } from './module-catalog.js';
import { normalizeAssignment, normalizeAssignmentTokens, ASSIGNMENT_ROUTES } from './module-assignment.js';
import { sameSiteModuleUrl, templatePositions, templateStyles, extensionKey, TEMPLATE_POSITIONS } from './extension-input.js';
import { validateTemplateStyles, BUILTIN_TEMPLATES } from './template-styles.js';
import { COMPONENT_OPTIONS, resolveComponentParams } from './component-options.js';
import { createConfig } from '../core/config.js';

const DOMAINS = Object.freeze(['categories', 'tags', 'articles', 'menu', 'extensions', 'templates', 'moduleInstances', 'siteConfig']);
const MAX_ROWS = 80;
const MAX_PACKAGE_LENGTH = 1000000;
const FIELDS = {
  categories: 'title alias parentId description state',
  tags: 'name alias state description parentId',
  articles: 'title alias introtext fulltext categoryId state featured publishUp publishDown author authorAlias language note versionNote featuredUp featuredDown metaDescription metaKeywords attribsJson tags',
  menu: 'title path parentId published ordering',
  extensions: 'title key type entryPointUrl discoveredFrom enabled ordering folder params paramsJson manifestJson',
  templates: 'title key version entryPointUrl styles positions positionsJson discoveredFrom enabled',
  moduleInstances: 'title extensionKey position ordering settings settingsJson enabled scopeKind scopeRoute scopeCategoryAlias showTitle trashed publishUp publishDown assignment assignmentTokens assignmentJson note',
  siteConfig: 'siteName templateKey siteDescription language timezone basePath pageSize customHtmlTitle customHtmlBody offline offlineMessage homeView homeCategory templateStylesJson componentParamsJson'
};
const REQUIRED = {
  categories: ['title', 'alias'], tags: ['name'], articles: ['title', 'alias'], menu: ['title', 'path'],
  extensions: ['title', 'key', 'type', 'entryPointUrl'], templates: ['title', 'key', 'version', 'entryPointUrl'],
  moduleInstances: ['title', 'extensionKey', 'position'], siteConfig: []
};
// These defaults are actually omitted by admin-service on legacy schemas.
const DEFAULTS = {
  categories: { state: 'Published' }, tags: { description: '', parentId: null },
  extensions: { ordering: 0, folder: '', paramsJson: '', manifestJson: '' },
  moduleInstances: { showTitle: true, publishUp: null, publishDown: null, trashed: false, assignment: 'all', assignmentJson: '[]', note: '' },
  siteConfig: { offline: false, offlineMessage: '', homeView: 'category', homeCategory: 'noticias', templateStylesJson: '', componentParamsJson: '' }
};
const DATES = new Set(['publishUp', 'publishDown', 'featuredUp', 'featuredDown']);
const NUMBERS = new Set(['parentId', 'categoryId', 'ordering', 'pageSize']);
const BOOLEANS = new Set(['enabled', 'featured', 'showTitle', 'trashed', 'offline']);
const OBJECT_JSON = new Set(['settingsJson', 'paramsJson', 'manifestJson', 'attribsJson', 'componentParamsJson']);
const ARRAY_JSON = new Set(['positionsJson', 'assignmentJson', 'styles', 'templateStylesJson']);
// Fallback serializes only callers sharing this exact store object in this JS
// realm. Cross-tab/process exclusion must be supplied by journalStore.withLock.
const STORE_LOCKS = new WeakMap();

function withJournalLock(store, operation) {
  if (typeof store?.withLock === 'function') return store.withLock(operation);
  if (!store || !['object', 'function'].includes(typeof store)) return operation();
  const previous = STORE_LOCKS.get(store);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  STORE_LOCKS.set(store, gate);
  return (async () => {
    try {
      if (previous) await previous;
      return await operation();
    } finally {
      release();
      if (STORE_LOCKS.get(store) === gate) STORE_LOCKS.delete(store);
    }
  })();
}

class SampleDataError extends Error {
  constructor(status, reason, message, details = {}) {
    super(message); this.status = status; this.reason = reason; this.details = details;
  }
}
const fail = (status, reason, message, details) => { throw new SampleDataError(status, reason, message, details); };
const own = (object, key) => Object.hasOwn(object, key);
const empty = (value) => value === null || value === undefined || value === '';
const validId = (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0;
const validEtag = (etag) => typeof etag === 'string' && Boolean(etag.trim()) && etag.trim() !== '*';
const rowToken = (domain, key) => `${domain}:${key}`;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function jsonData(value, field) {
  // parseJsonObject walks own data descriptors, rejecting getters/toJSON/cycles.
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} deve ser um objeto de dados JSON.`);
  return parseJsonObject(value, { strict: true, field });
}

function jsonArray(value, field) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error(`${field} deve ser uma lista JSON.`);
  return parseJsonObject({ value: parsed }, { strict: true, field }).value;
}

function orderedRows(domain, rows) {
  const result = [];
  const visiting = new Set();
  const visited = new Set();
  const keyed = new Map(rows.map((row) => [row.key, row]));
  function visit(row) {
    if (visited.has(row.key)) return;
    if (visiting.has(row.key)) throw new Error(`Referências circulares em ${domain}.`);
    visiting.add(row.key);
    if (row.parentRef) {
      const parent = keyed.get(row.parentRef);
      if (!parent) throw new Error(`Referência de pai desconhecida em ${domain}.`);
      visit(parent);
    }
    visiting.delete(row.key); visited.add(row.key); result.push({ domain, ...row });
  }
  rows.forEach(visit);
  return result;
}

function normalizeValues(domain, values) {
  const result = { ...values };
  for (const field of REQUIRED[domain]) {
    if (typeof result[field] !== 'string' || !result[field].trim()) throw new Error(`${domain}.${field} é obrigatório.`);
    result[field] = result[field].trim();
  }
  for (const [field, value] of Object.entries(result)) {
    if (!FIELDS[domain].split(' ').includes(field)) throw new Error(`Campo não suportado: ${domain}.${field}.`);
    if (canonical(value).length > 20002) throw new Error(`Campo muito grande: ${domain}.${field}.`);
    if (NUMBERS.has(field) && !empty(value) && (!['number', 'string'].includes(typeof value) || !Number.isSafeInteger(Number(value)))) throw new Error(`Número inválido: ${field}.`);
    if (BOOLEANS.has(field) && typeof value !== 'boolean') throw new Error(`Booleano inválido: ${field}.`);
    if (DATES.has(field) && !empty(value) && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw new Error(`Data inválida: ${field}.`);
    if (OBJECT_JSON.has(field) && !empty(value)) parseJsonObject(value, { strict: true, field });
    if (!NUMBERS.has(field) && !BOOLEANS.has(field) && !DATES.has(field) && !OBJECT_JSON.has(field) && !ARRAY_JSON.has(field) && !['settings', 'params', 'positions', 'assignmentTokens', 'tags'].includes(field) && value !== null && typeof value !== 'string') throw new Error(`Texto inválido: ${field}.`);
  }
  for (const field of ['parentId', 'categoryId']) if (own(result, field) && !empty(result[field])) throw new Error(`${field} deve usar uma referência do pacote, não um ID persistido.`);
  if (own(result, 'settings') && own(result, 'settingsJson') || own(result, 'params') && own(result, 'paramsJson') || own(result, 'positions') && own(result, 'positionsJson') || own(result, 'assignmentTokens') && own(result, 'assignmentJson')) throw new Error('Campos JSON alternativos não podem ser combinados.');
  for (const field of ['settings', 'params']) if (own(result, field) && result[field] !== null) result[field] = parseJsonObject(result[field], { strict: true, field });
  if (['extensions', 'templates'].includes(domain)) {
    result.entryPointUrl = sameSiteModuleUrl(result.entryPointUrl);
    result.key = extensionKey(result.key);
  }
  if (domain === 'articles') {
    if (own(result, 'state') && !['Published', 'Draft', 'Archived', 'Trashed'].includes(result.state)) throw new Error('Estado de artigo inválido.');
    if (own(result, 'tags') && result.tags !== null && typeof result.tags !== 'string' && (!Array.isArray(result.tags) || result.tags.some((tag) => typeof tag !== 'string'))) throw new Error('Nomes de tags inválidos.');
  }
  if (['categories', 'tags'].includes(domain) && own(result, 'state') && !['Published', 'Unpublished', 'Trashed'].includes(result.state)) throw new Error('Estado de taxonomia inválido.');
  if (domain === 'menu' && own(result, 'published') && (typeof result.published !== 'string' || !result.published.trim())) throw new Error('published inválido.');
  if (domain === 'menu' && own(result, 'published')) result.published = result.published.trim();
  if (domain === 'extensions' && !['Module', 'Plugin'].includes(result.type)) throw new Error('Tipo de extensão não suportado.');
  if (domain === 'extensions') {
    const manifest = parseJsonObject(result.manifestJson, { strict: true, field: 'manifestJson' });
    const definitions = normalizeParamDefinitions(manifest.params);
    normalizeParamValues(definitions, parseJsonObject(result.params ?? result.paramsJson, { strict: true, field: 'paramsJson' }), { keepUndeclared: true });
    if (result.type === 'Plugin') {
      for (const [object, field] of [[result, 'folder'], [manifest, 'group']]) {
        if (own(object, field) && (typeof object[field] !== 'string' || object[field] !== '' && !/^[a-z][a-z0-9_-]{0,39}$/.test(object[field].trim()))) throw new Error('Grupo de plugin inválido.');
      }
      if (result.folder && result.folder.trim() !== (manifest.group ?? '').trim()) throw new Error('Grupo do pacote diverge do manifesto; corrija antes de instalar.');
      if (own(result, 'folder') && result.folder === '') delete result.folder;
    }
  }
  if (['extensions', 'moduleInstances'].includes(domain) && own(result, 'ordering') && empty(result.ordering)) throw new Error('ordering deve ser um inteiro.');
  if (domain === 'templates') {
    if (!own(result, 'positions') && !own(result, 'positionsJson')) throw new Error('Posições do template são obrigatórias.');
    templatePositions(result.positions ?? result.positionsJson);
    if (own(result, 'styles')) templateStyles(result.styles);
  }
  if (domain === 'moduleInstances') {
    if (![...TEMPLATE_POSITIONS.filter((position) => position !== 'component'), 'sidebar', 'content'].includes(result.position)) throw new Error('Posição de módulo inválida.');
    const kind = result.scopeKind ?? 'All';
    const route = result.scopeRoute ?? '';
    if (!['All', 'Route'].includes(kind) || route && !ASSIGNMENT_ROUTES.includes(route) || kind === 'Route' && !route || kind !== 'Route' && (route || result.scopeCategoryAlias) || result.scopeCategoryAlias && route !== 'category') throw new Error('Escopo de módulo inválido.');
    const assignment = normalizeAssignment(result.assignment);
    const tokens = normalizeAssignmentTokens(result.assignmentTokens ?? result.assignmentJson);
    if (tokens.some((token) => token.startsWith('menu:'))) throw new Error('IDs de menu persistidos não são referências portáveis do pacote.');
    if (['only', 'except'].includes(assignment) && !tokens.length) throw new Error('Atribuição de módulo exige páginas.');
    if (own(result, 'assignment')) result.assignment = assignment;
    if (result.publishUp && result.publishDown && Date.parse(result.publishDown) <= Date.parse(result.publishUp)) throw new Error('Janela de publicação inválida.');
    if (result.note?.length > 255) throw new Error('Nota de módulo excede 255 caracteres.');
  }
  if (domain === 'siteConfig') {
    if (own(result, 'pageSize') && (Number(result.pageSize) < 1 || Number(result.pageSize) > 50)) throw new Error('pageSize inválido.');
    if (own(result, 'homeView') && !['category', 'featured'].includes(result.homeView)) throw new Error('homeView inválido.');
    if (own(result, 'homeCategory') && (typeof result.homeCategory !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(result.homeCategory))) throw new Error('homeCategory inválido.');
    if (own(result, 'templateStylesJson') && result.templateStylesJson !== '') validateTemplateStyles(jsonArray(result.templateStylesJson, 'templateStylesJson'));
    if (own(result, 'componentParamsJson')) {
      if (result.componentParamsJson === null) throw new Error('componentParamsJson não pode ser null.');
      const stored = parseJsonObject(result.componentParamsJson, { strict: true, field: 'componentParamsJson' });
      resolveComponentParams({ componentParamsJson: stored }, { strict: true });
      if (COMPONENT_OPTIONS.some((component) => component.available === false && own(stored, component.key))) throw new Error('Opções de componente indisponíveis não podem ser instaladas.');
    }
    createConfig({ ...result, customHtml: { title: result.customHtmlTitle, html: result.customHtmlBody } });
  }
  return result;
}

function validatePackage(raw) {
  const data = jsonData(raw, 'Pacote de dados de exemplo');
  if ((data.schemaVersion ?? data.schema) !== 1 || own(data, 'schema') && data.schema !== 1 || own(data, 'schemaVersion') && data.schemaVersion !== 1) throw new Error('Schema de pacote não suportado.');
  if (data.id !== 'joomla-blog' || data.version !== 1 || typeof data.title !== 'string' || !data.title.trim()) throw new Error('Identificação de pacote inválida.');
  if (canonical(data).length > MAX_PACKAGE_LENGTH) throw new Error('Pacote excede o limite de tamanho.');
  const domains = jsonData(data.domains, 'Domínios');
  if (Object.keys(domains).length !== DOMAINS.length || Object.keys(domains).some((domain) => !DOMAINS.includes(domain))) throw new Error('O pacote deve declarar os oito domínios.');
  let total = 0;
  for (const domain of DOMAINS) {
    if (!Array.isArray(domains[domain]) || domains[domain].length > (domain === 'siteConfig' ? 1 : MAX_ROWS)) throw new Error(`Quantidade inválida em ${domain}.`);
    total += domains[domain].length;
    const keys = new Set();
    for (const row of domains[domain]) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some((key) => !['key', 'values', 'parentRef', 'categoryRef', 'tagRefs'].includes(key))) throw new Error(`Envelope inválido em ${domain}.`);
      if (typeof row.key !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(row.key) || keys.has(row.key)) throw new Error(`Chave inválida ou duplicada em ${domain}.`);
      keys.add(row.key);
      row.values = normalizeValues(domain, jsonData(row.values, `${domain}.${row.key}`));
      if (own(row, 'parentRef') && (!['categories', 'tags', 'menu'].includes(domain) || row.parentRef !== null && (typeof row.parentRef !== 'string' || !row.parentRef) || own(row.values, 'parentId'))) throw new Error('parentRef inválida ou ambígua.');
      if (own(row, 'categoryRef') && (domain !== 'articles' || row.categoryRef !== null && (typeof row.categoryRef !== 'string' || !row.categoryRef) || own(row.values, 'categoryId'))) throw new Error('categoryRef inválida ou ambígua.');
      if (own(row, 'tagRefs') && (domain !== 'articles' || !Array.isArray(row.tagRefs) || row.tagRefs.some((key) => typeof key !== 'string') || new Set(row.tagRefs).size !== row.tagRefs.length || own(row.values, 'tags'))) throw new Error('tagRefs inválidas ou ambíguas.');
    }
  }
  if (!total || total > MAX_ROWS) throw new Error(`O pacote aceita entre 1 e ${MAX_ROWS} registros.`);
  for (const domain of ['extensions', 'templates', 'tags', 'categories', 'articles']) {
    const field = domain === 'tags' ? 'name' : ['categories', 'articles'].includes(domain) ? 'alias' : 'key';
    if (new Set(domains[domain].map((row) => row.values[field])).size !== domains[domain].length) throw new Error(`Identidade duplicada em ${domain}.`);
  }
  for (const row of domains.articles) {
    if (row.categoryRef && !domains.categories.some((category) => category.key === row.categoryRef)) throw new Error('Categoria referenciada não existe.');
    if (row.tagRefs?.some((key) => !domains.tags.some((tag) => tag.key === key))) throw new Error('Tag referenciada não existe.');
  }
  const plan = DOMAINS.flatMap((domain) => orderedRows(domain, domains[domain]));
  // Validate module JSON against the same declared field types, without importing modules.
  const catalog = moduleTypeCatalog(domains.extensions.map((row) => row.values));
  for (const row of domains.moduleInstances) {
    const settings = parseJsonObject(row.values.settings ?? row.values.settingsJson, { strict: true, field: 'settingsJson' });
    const definitions = [...(catalog.find((type) => type.key === row.values.extensionKey)?.params ?? []), ...MODULE_ADVANCED_PARAMS];
    if (!catalog.some((type) => type.key === row.values.extensionKey)) throw new Error('Tipo de módulo não registrado no pacote.');
    for (const [key, value] of Object.entries(settings)) {
      if (['moduleClass', 'headerClass'].includes(key) && (typeof value !== 'string' || !MODULE_CLASS_PATTERN.test(value))) throw new Error('Classe de módulo inválida.');
      const definition = definitions.find((entry) => entry.name === key);
      if (definition) coerceParam(definition, value);
    }
  }
  for (const row of domains.siteConfig) if (row.values.templateKey && !BUILTIN_TEMPLATES.includes(row.values.templateKey) && !domains.templates.some((template) => template.values.key === row.values.templateKey && template.values.enabled !== false)) throw new Error('Template do site não registrado no pacote.');
  return { data: { ...data, domains }, plan, total };
}

function expectedValues(row, resolved) {
  const values = { ...row.values };
  const reference = (domain, key) => {
    const record = resolved.get(rowToken(domain, key));
    if (!record) throw new Error('Referência ainda não resolvida.');
    return record;
  };
  if (own(row, 'parentRef')) values.parentId = row.parentRef === null ? null : Number(reference(row.domain, row.parentRef).id);
  if (own(row, 'categoryRef')) values.categoryId = row.categoryRef === null ? null : Number(reference('categories', row.categoryRef).id);
  if (own(row, 'tagRefs')) values.tags = row.tagRefs.map((key) => reference('tags', key).name).join(', ');
  return values;
}

function comparable(field, value) {
  if (empty(value)) return null;
  if (DATES.has(field)) {
    const instant = Date.parse(value);
    if (!Number.isFinite(instant)) throw new Error('Data persistida inválida.');
    return instant;
  }
  if (NUMBERS.has(field)) return Number(value);
  if (OBJECT_JSON.has(field)) return parseJsonObject(value, { strict: true, field });
  if (ARRAY_JSON.has(field)) {
    if (field === 'assignmentJson') return normalizeAssignmentTokens(value);
    if (field === 'positionsJson') return JSON.parse(templatePositions(value));
    if (field === 'styles') return JSON.parse(templateStyles(value));
    if (field === 'templateStylesJson') return JSON.parse(validateTemplateStyles(jsonArray(value, field)));
  }
  if (field === 'tags') return (Array.isArray(value) ? value : String(value).split(',')).map((tag) => tag.trim()).filter(Boolean).sort();
  return value;
}

function matches(domain, actual, expected, extensions) {
  try {
    for (let [field, value] of Object.entries(expected)) {
      if (field === 'settings') field = 'settingsJson';
      if (field === 'params') field = 'paramsJson';
      if (field === 'positions') field = 'positionsJson';
      if (field === 'assignmentTokens') field = 'assignmentJson';
      let existing = actual[field];
      if (empty(existing) && own(DEFAULTS[domain] ?? {}, field)) existing = DEFAULTS[domain][field];
      if (field === 'settingsJson') {
        const source = parseJsonObject(value, { strict: true, field });
        const persisted = parseJsonObject(existing, { strict: true, field });
        const type = moduleTypeCatalog(extensions).find((entry) => entry.key === actual.extensionKey);
        const definitions = [...(type?.params ?? []), ...MODULE_ADVANCED_PARAMS];
        // Generated defaults/unknown settings are not seed fields. Compare only supplied keys.
        for (const [key, input] of Object.entries(source)) {
          const definition = definitions.find((entry) => entry.name === key);
          const normalized = definition ? coerceParam(definition, input) : input;
          const stored = definition ? coerceParam(definition, persisted[key]) : persisted[key];
          if (!own(persisted, key) || canonical(normalized) !== canonical(stored)) return false;
        }
      } else if (field === 'componentParamsJson') {
        const source = parseJsonObject(value, { strict: true, field });
        const persisted = parseJsonObject(existing, { strict: true, field });
        resolveComponentParams({ componentParamsJson: persisted }, { strict: true });
        for (const [key, inputs] of Object.entries(source)) {
          if (!own(persisted, key)) return false;
          const component = COMPONENT_OPTIONS.find((entry) => entry.key === key);
          if (!component) {
            if (canonical(inputs) !== canonical(persisted[key])) return false;
            continue;
          }
          for (const [name, input] of Object.entries(inputs)) {
            if (!own(persisted[key], name)) return false;
            const definition = component.params.find((entry) => entry.name === name);
            const normalized = definition ? coerceParam(definition, input) : input;
            const stored = definition ? coerceParam(definition, persisted[key][name]) : persisted[key][name];
            if (canonical(normalized) !== canonical(stored)) return false;
          }
        }
      } else if (canonical(comparable(field, existing)) !== canonical(comparable(field, value))) return false;
    }
    return true;
  } catch { return false; }
}

function sameIdentity(row, actual, expected) {
  const field = row.domain === 'tags' ? 'name' : row.domain === 'menu' ? 'path' : ['extensions', 'templates'].includes(row.domain) ? 'key' : row.domain === 'moduleInstances' ? 'title' : 'alias';
  if (row.domain === 'siteConfig') return true;
  if (actual[field] !== expected[field]) return false;
  return row.domain !== 'moduleInstances' || actual.extensionKey === expected.extensionKey && actual.position === expected.position;
}

function validateJournal(raw, pack, signature) {
  const journal = jsonData(raw, 'Journal');
  if (journal.packageId !== pack.data.id || journal.signature !== signature) fail('blocked', 'package-changed', 'O pacote difere daquele registrado no journal. Revisão manual necessária.');
  if (journal.schemaVersion !== 1 || !Array.isArray(journal.receipts) || journal.receipts.length > pack.total || !own(journal, 'pending')) throw new Error('Journal inválido.');
  const keys = new Set();
  const ids = new Set();
  for (let index = 0; index < journal.receipts.length; index += 1) {
    const receipt = journal.receipts[index];
    const planned = pack.plan[index];
    if (!receipt || receipt.domain !== planned.domain || receipt.key !== planned.key || !validId(receipt.id) || !validEtag(receipt.etag)) throw new Error('Recibo inválido ou fora de ordem.');
    const token = rowToken(receipt.domain, receipt.key);
    const idToken = rowToken(receipt.domain, receipt.id);
    if (keys.has(token) || ids.has(idToken)) throw new Error('Recibo duplicado.');
    keys.add(token); ids.add(idToken);
  }
  if (journal.pending !== null) {
    const next = pack.plan[journal.receipts.length];
    if (!next || !journal.pending || journal.pending.domain !== next.domain || journal.pending.key !== next.key || !journal.pending.expected || typeof journal.pending.expected !== 'object') throw new Error('Entrada pendente inválida.');
  }
  return journal;
}

export function createSampleDataService({ adminService, loadPackage, journalStore } = {}) {
  let busy = false;
  const available = typeof loadPackage === 'function' && typeof journalStore?.read === 'function' && typeof journalStore?.write === 'function' && DOMAINS.every((domain) => {
    const service = adminService?.[domain];
    return service && service.available !== false && typeof service.get === 'function' && (domain === 'siteConfig' ? typeof service.save === 'function' : typeof service.list === 'function' && typeof service.create === 'function');
  });

  function context(isCurrent, onProgress) {
    const guard = () => {
      if (isCurrent && isCurrent() !== true) fail('partial', 'abandoned', 'A tela mudou. Nenhuma nova operação será iniciada.', { abandoned: true });
    };
    return {
      guard,
      async call(operation) {
        guard();
        try { const result = await operation(); guard(); return result; }
        catch (error) { guard(); throw error; }
      },
      progress(event) {
        guard();
        if (typeof onProgress === 'function') { try { onProgress({ ...event }); } catch { /* observational only */ } }
        guard();
      }
    };
  }

  const summary = (pack, completed = 0) => pack ? {
    packageId: pack.data.id, title: pack.data.title, total: pack.total, completed,
    counts: Object.fromEntries(DOMAINS.map((domain) => [domain, pack.data.domains[domain].length]))
  } : { total: 0, completed: 0, counts: {} };
  const result = (status, pack, reason, message, details = {}) => ({ status, summary: summary(pack, details.completed ?? 0), reason, message, automaticRollback: false, ...details });

  async function packageAndSignature(ctx) {
    if (!available) fail('unavailable', 'dependencies-unavailable', 'Dados de exemplo indisponíveis: forneça pacote, journal durável e os oito serviços administrativos.');
    let raw;
    try { raw = await ctx.call(() => loadPackage()); }
    catch (error) { if (error instanceof SampleDataError) throw error; fail('unavailable', 'package-unavailable', 'Não foi possível carregar o pacote de dados de exemplo.'); }
    let pack;
    try { pack = validatePackage(raw); }
    catch { fail('unavailable', 'invalid-package', 'O pacote de dados de exemplo é inválido ou excede os limites permitidos.'); }
    ctx.pack = pack;
    const text = canonical(pack.data);
    // Secure contexts use SHA-256; the full canonical string is collision-free
    // and portable where Web Crypto is unavailable (no weaker hash fallback).
    let signature = `canonical:${text}`;
    if (globalThis.crypto?.subtle) {
      const digest = await ctx.call(() => globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
      signature = `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    }
    ctx.guard();
    return { pack, signature };
  }

  async function readDomain(domain, ctx) {
    const service = adminService[domain];
    if (service.available === false) fail('unavailable', 'domain-unavailable', `O domínio ${domain} não está disponível.`);
    if (domain === 'siteConfig') {
      const current = await ctx.call(() => service.get());
      return current === null ? [] : [current];
    }
    const rows = await ctx.call(() => service.list());
    if (!Array.isArray(rows)) fail('unavailable', 'invalid-response', `Resposta inválida do domínio ${domain}.`);
    if (rows.length > MAX_ROWS) fail('blocked', 'existing-content', 'O site contém dados além do limite do pacote. Nenhum registro será alterado.');
    return rows;
  }

  async function snapshot(ctx) {
    const state = {};
    let total = 0;
    for (const domain of DOMAINS) {
      state[domain] = await readDomain(domain, ctx);
      total += state[domain].length;
    }
    if (total > MAX_ROWS) fail('blocked', 'existing-content', 'O site já contém dados. Nenhum registro será alterado.');
    // Lists omit ETags; get() may return them as non-enumerable properties.
    for (const domain of DOMAINS) {
      if (domain === 'siteConfig') continue;
      const refreshed = [];
      const ids = new Set();
      for (const row of state[domain]) {
        if (!validId(row?.id) || ids.has(Number(row.id))) fail('unavailable', 'invalid-response', 'IDs administrativos inválidos.');
        ids.add(Number(row.id));
        const current = await ctx.call(() => adminService[domain].get(row.id));
        if (!current || Number(current.id) !== Number(row.id)) fail('blocked', 'content-changed', 'O conteúdo mudou durante a leitura. Recarregue a tela.');
        refreshed.push(current);
      }
      state[domain] = refreshed;
    }
    return state;
  }

  async function preflight(ctx) {
    const { pack, signature } = await packageAndSignature(ctx);
    let raw;
    try { raw = await ctx.call(() => journalStore.read()); }
    catch (error) { if (error instanceof SampleDataError) throw error; fail('unavailable', 'journal-unavailable', 'Não foi possível ler o journal durável.'); }
    let journal = null;
    if (raw !== null && raw !== undefined) {
      try { journal = validateJournal(raw, pack, signature); }
      catch (error) { if (error instanceof SampleDataError) throw error; fail('blocked', 'invalid-journal', 'Journal inválido. Revisão manual necessária; nenhuma criação será repetida.'); }
    }
    let state;
    try { state = await snapshot(ctx); }
    catch (error) { if (error instanceof SampleDataError) throw error; fail('unavailable', 'read-failed', 'Não foi possível verificar todos os domínios administrativos.'); }
    const resolved = new Map();
    if (journal) {
      for (let index = 0; index < journal.receipts.length; index += 1) {
        const receipt = journal.receipts[index];
        const row = pack.plan[index];
        const actual = state[receipt.domain].find((record) => Number(record.id) === Number(receipt.id));
        const expected = expectedValues(row, resolved);
        if (!actual || actual.etag !== receipt.etag || !matches(row.domain, actual, expected, state.extensions)) fail('blocked', 'receipt-conflict', 'Um registro do journal foi removido ou alterado. Nenhum registro será sobrescrito.', { completed: index });
        resolved.set(rowToken(row.domain, row.key), actual);
      }
      if (journal.pending !== null) fail('blocked', 'pending-uncertain', 'Há uma criação com resultado incerto. Verifique manualmente; não há adoção ou repetição automática.', { uncertain: true, completed: journal.receipts.length });
      for (const domain of DOMAINS) {
        const receipts = journal.receipts.filter((receipt) => receipt.domain === domain);
        if (state[domain].length !== receipts.length) fail('blocked', 'unmanaged-data', 'Existem registros sem recibo neste site. Revisão manual necessária.', { completed: journal.receipts.length });
      }
      return { pack, signature, journal, state, resolved, status: journal.receipts.length === pack.total ? 'installed' : 'partial' };
    }
    if (DOMAINS.every((domain) => state[domain].length === 0)) return { pack, signature, journal, state, resolved, status: 'ready' };
    if (DOMAINS.some((domain) => state[domain].length !== pack.data.domains[domain].length)) fail('blocked', 'existing-content', 'O site contém dados que não correspondem ao pacote completo. Nenhum registro será alterado.');
    const used = new Set();
    for (const row of pack.plan) {
      const expected = expectedValues(row, resolved);
      const candidates = state[row.domain].filter((record) => sameIdentity(row, record, expected) && matches(row.domain, record, expected, state.extensions) && !used.has(rowToken(row.domain, record.id)));
      if (candidates.length !== 1) fail('blocked', 'existing-content', 'O site contém dados diferentes ou ambíguos. Nenhum registro será alterado.');
      resolved.set(rowToken(row.domain, row.key), candidates[0]);
      used.add(rowToken(row.domain, candidates[0].id));
    }
    return { pack, signature, journal, state, resolved, status: 'installed' };
  }

  async function inspect({ isCurrent } = {}) {
    if (busy) return result('partial', null, 'busy', 'Uma instalação já está em andamento.', { busy: true });
    const ctx = context(isCurrent);
    try {
      const checked = await preflight(ctx);
      return result(checked.status, checked.pack, checked.status === 'partial' ? 'resumable' : checked.status, checked.status === 'ready' ? 'Os oito domínios estão vazios. Confirme para instalar.' : checked.status === 'installed' ? 'O pacote completo já está instalado.' : 'Instalação parcial verificada; retomada segura disponível.', { completed: checked.journal?.receipts.length ?? (checked.status === 'installed' ? checked.pack.total : 0), canResume: checked.status === 'partial' });
    } catch (error) {
      return error instanceof SampleDataError ? result(error.status, ctx.pack, error.reason, error.message, error.details) : result('unavailable', ctx.pack, 'read-failed', 'Não foi possível verificar a instalação. Nenhum dado foi alterado.');
    }
  }

  async function install({ confirm, isCurrent, onProgress } = {}) {
    if (busy) return result('partial', null, 'busy', 'Uma instalação já está em andamento.', { busy: true });
    if (confirm !== true) return result('ready', null, 'confirmation-required', 'Confirmação explícita obrigatória. Nenhum dado foi alterado.', { cancelled: true });
    busy = true;
    const ctx = context(isCurrent, onProgress);
    let pack;
    let journal;
    let remoteStarted = false;
    async function executeInstallation() {
      // Waiting for another screen/tab must not resurrect an abandoned caller.
      ctx.guard();
      const checked = await preflight(ctx);
      ({ pack, journal } = checked);
      if (checked.status === 'installed') return result('installed', pack, 'installed', 'O pacote completo já está instalado.', { completed: pack.total });
      async function persist(next, reason) {
        try { await ctx.call(() => journalStore.write(jsonData(next, 'Journal'))); }
        catch (error) {
          if (error instanceof SampleDataError) throw error;
          fail('partial', reason, 'Não foi possível confirmar a gravação do journal. Nenhuma criação será repetida automaticamente.', { uncertain: true, completed: journal?.receipts.length ?? 0 });
        }
        journal = next;
      }
      if (!journal) await persist({ schemaVersion: 1, packageId: pack.data.id, signature: checked.signature, receipts: [], pending: null }, 'journal-write-failed');
      const resolved = checked.resolved;
      for (let index = journal.receipts.length; index < pack.plan.length; index += 1) {
        const row = pack.plan[index];
        const expected = expectedValues(row, resolved);
        ctx.progress({ phase: 'creating', domain: row.domain, key: row.key, completed: index, total: pack.total, message: `Criando ${row.domain}: ${row.key}` });
        // Recheck the target domain immediately before any journal/create write.
        const current = await readDomain(row.domain, ctx);
        const receipts = journal.receipts.filter((receipt) => receipt.domain === row.domain);
        if (current.length !== receipts.length || current.some((record) => !receipts.some((receipt) => Number(receipt.id) === Number(record.id)))) fail('blocked', 'content-changed', 'O domínio mudou durante a instalação. Nenhum registro será sobrescrito.', { completed: index });
        await persist({ ...journal, pending: { domain: row.domain, key: row.key, expected } }, 'pending-write-failed');
        let created;
        try {
          created = await ctx.call(() => {
            remoteStarted = true;
            return row.domain === 'siteConfig' ? adminService.siteConfig.save(jsonData(expected, 'Valores')) : adminService[row.domain].create(jsonData(expected, 'Valores'));
          });
          if (row.domain === 'siteConfig') {
            const saved = created;
            created = await ctx.call(() => adminService.siteConfig.get());
            if (!validId(saved?.id) || Number(saved.id) !== Number(created?.id) || validEtag(saved.etag) && saved.etag !== created?.etag) fail('partial', 'create-unverified', 'A configuração mudou após a criação; o journal pendente foi preservado.', { uncertain: true, completed: index });
          }
          else if (validId(created?.id) && !validEtag(created.etag)) created = await ctx.call(() => adminService[row.domain].get(created.id));
        } catch (error) {
          if (error instanceof SampleDataError) throw error;
          fail('partial', 'pending-uncertain', 'A criação não pôde ser confirmada. O journal pendente foi preservado para revisão manual.', { uncertain: true, completed: index });
        }
        if (!created || !validId(created.id) || !validEtag(created.etag) || !matches(row.domain, created, expected, checked.state.extensions)) fail('partial', 'create-unverified', 'O registro criado não possui recibo verificável. Revisão manual necessária.', { uncertain: true, completed: index });
        const receipt = { domain: row.domain, key: row.key, id: Number(created.id), etag: created.etag };
        await persist({ ...journal, receipts: [...journal.receipts, receipt], pending: null }, 'receipt-write-failed');
        remoteStarted = false;
        resolved.set(rowToken(row.domain, row.key), created);
        if (row.domain === 'extensions') checked.state.extensions.push(created);
        ctx.progress({ phase: 'created', domain: row.domain, key: row.key, completed: index + 1, total: pack.total, message: `Criado ${row.domain}: ${row.key}` });
      }
      // Verify all receipts again before advertising a complete installation.
      const verified = await preflight(ctx);
      if (verified.status !== 'installed') fail('partial', 'verification-failed', 'A verificação final não confirmou a instalação completa.');
      ctx.progress({ phase: 'complete', completed: pack.total, total: pack.total, message: 'Dados de exemplo instalados e verificados.' });
      return result('installed', pack, 'installed', 'Dados de exemplo instalados e verificados.', { completed: pack.total });
    }
    try {
      ctx.guard();
      return await withJournalLock(journalStore, executeInstallation);
    } catch (error) {
      const details = { completed: journal?.receipts.length ?? 0, ...(remoteStarted ? { uncertain: true } : {}), ...(error.details ?? {}) };
      return error instanceof SampleDataError ? result(error.status, pack ?? ctx.pack, error.reason, error.message, details) : result('partial', pack ?? ctx.pack, 'installation-failed', 'Instalação interrompida. Não há rollback automático; verifique o journal antes de continuar.', details);
    } finally { busy = false; }
  }

  return Object.freeze({ available: Boolean(available), inspect, install });
}
