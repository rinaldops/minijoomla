/*
 * Serviço de aplicação administrativo do MINIJOOMLA — CRUD de conteúdo,
 * configuração do site, extensões (módulos/plugins descobertos) e
 * instâncias de módulo, consumido por src/administrator/components/com_minijoomla/ (painel de administração).
 *
 * Opera diretamente sobre `app.repositories.*` (o mesmo objeto retornado
 * por createMiniJoomlaSharePointApp, src/libraries/minijoomla/composition/), nunca sobre o
 * `adapter` de leitura (que é somente leitura e aplica política de
 * visibilidade — ver docs/CONTRACTS-MINIJOOMLA.md regra 2). Cada operação
 * de escrita usa o mesmo padrão já validado no Marco D
 * (docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md §8.1): create/update(id, input,
 * {etag})/delete(id, {etag}), nunca um atalho REST manual.
 *
 * Nenhuma função aqui decide ACL, autenticação ou sessão — isso permanece
 * fora de escopo do MINIJOOMLA (PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md,
 * "Proibições explícitas"). A única fronteira de segurança própria desta
 * camada é: toda entrada textual passa por validação de forma (tipo,
 * presença, enumeração), nunca por sanitização de exibição (isso é
 * responsabilidade de src/libraries/minijoomla/security/sanitize.js no momento de renderizar,
 * não de persistir).
 */
import { ValidationError, ownDataValue } from '../core/contracts.js';
import { createConfig } from '../core/config.js';
import { BUILTIN_MODULE_KEYS, NATIVE_PLUGIN_URLS, extensionKey, sameSiteModuleUrl, enabledValue, jsonObject, templatePositions, templateStyles, isWellFormedPositionName } from './extension-input.js';
import { normalizeAssignment, normalizeAssignmentTokens, normalizeDateTime } from './module-assignment.js';
import { validateTemplateStyles, BUILTIN_TEMPLATES } from './template-styles.js';
import { toSiteConfigOverrides } from './site-config-overrides.js';
import { MODULE_CLASS_PATTERN, moduleTypeCatalog, MODULE_ADVANCED_PARAMS } from './module-catalog.js';
import { normalizeParamDefinitions, normalizeParamValues, parseJsonObject } from './declared-params.js';
import { createExtensionAdministration, runBatch, optionalPluginGroup, MODULE_POSITIONS } from './admin-extensions-service.js';
import { readTemplateMetadata, packTemplateMetadata } from './template-metadata.js';

function requireRepository(repositories, domain) {
  const repository = repositories?.[domain];
  if (!repository || typeof repository.findMany !== 'function') {
    throw new ValidationError(`Repositório "${domain}" não está disponível nesta composição.`);
  }
  return repository;
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(`${field} é obrigatório.`);
  return value.trim();
}

function optionalText(value) {
  return value === undefined || value === null ? '' : String(value);
}

function requireEtag(etag, label = 'etag') {
  if (typeof etag !== 'string' || !etag.trim() || etag.trim() === '*') throw new ValidationError(`${label} específico é obrigatório para alterar um registro existente.`);
}

async function listAll(repository) {
  const result = await repository.findMany({}, { maxPages: 100, maxItems: 10000 });
  if (result?.hasNextPage === true) throw new ValidationError('Leitura administrativa incompleta. Nenhum dado foi alterado.');
  if (!Array.isArray(result?.items)) throw new Error('Resposta inválida ao carregar registros administrativos.');
  return result.items;
}

/*
 * CRUD genérico por domínio, parametrizado só pela validação de forma
 * específica (`normalizeInput`) — evita repetir create/update/delete/list
 * sete vezes com o mesmo esqueleto. `normalizeInput(input, { partial })`
 * deve lançar ValidationError para entrada inválida e devolver o objeto já
 * normalizado para o mapper do domínio (nomes de campo de domínio, não
 * internalName do SharePoint — isso é responsabilidade do mapper/schema).
 */
function createDomainCrud(repositories, domain, normalizeInput) {
  const repository = () => requireRepository(repositories, domain);
  return {
    available: Boolean(repositories?.[domain]),
    list: async () => listAll(repository()),
    get: async (id) => repository().findById(id),
    create: async (input) => repository().create(normalizeInput(input, { partial: false })),
    update: async (id, input, { etag } = {}) => {
      requireEtag(etag);
      return repository().update(id, normalizeInput(input, { partial: true }), { etag });
    },
    remove: async (id, { etag } = {}) => {
      requireEtag(etag);
      return repository().delete(id, { etag });
    }
  };
}

const ARTICLE_STATES = ['Published', 'Draft', 'Archived', 'Trashed'];

function normalizeArticleInput(input = {}, { partial }) {
  const result = {};
  if (!partial || input.title !== undefined) result.title = requireText(input.title, 'title');
  if (!partial || input.alias !== undefined) result.alias = requireText(input.alias, 'alias');
  if (input.introtext !== undefined) result.introtext = optionalText(input.introtext);
  if (input.fulltext !== undefined) result.fulltext = optionalText(input.fulltext);
  if (input.categoryId !== undefined) result.categoryId = input.categoryId === null ? null : Number(input.categoryId);
  if (input.state !== undefined) result.state = oneOf(input.state, ARTICLE_STATES, 'state');
  if (input.featured !== undefined) result.featured = Boolean(input.featured);
  if (input.publishUp !== undefined) result.publishUp = input.publishUp || null;
  if (input.publishDown !== undefined) result.publishDown = input.publishDown || null;
  if (input.author !== undefined) result.author = optionalText(input.author);
  if (input.authorAlias !== undefined) result.authorAlias = optionalText(input.authorAlias);
  if (input.language !== undefined) result.language = optionalText(input.language);
  if (input.note !== undefined) result.note = optionalText(input.note);
  if (input.versionNote !== undefined) result.versionNote = optionalText(input.versionNote);
  if (input.featuredUp !== undefined) result.featuredUp = input.featuredUp || null;
  if (input.featuredDown !== undefined) result.featuredDown = input.featuredDown || null;
  if (input.metaDescription !== undefined) result.metaDescription = optionalText(input.metaDescription);
  if (input.metaKeywords !== undefined) result.metaKeywords = optionalText(input.metaKeywords);
  if (input.attribsJson !== undefined) {
    if (input.attribsJson === null || input.attribsJson === '') {
      result.attribsJson = '';
    } else if (typeof input.attribsJson === 'object') {
      result.attribsJson = JSON.stringify(input.attribsJson);
    } else {
      const raw = String(input.attribsJson).trim();
      if (!raw) result.attribsJson = '';
      else {
        let parsed;
        try { parsed = JSON.parse(raw); } catch (error) { throw new ValidationError('attribsJson deve ser um JSON válido.'); }
        if (parsed === null || typeof parsed !== 'object') throw new ValidationError('attribsJson deve ser um objeto JSON.');
        result.attribsJson = JSON.stringify(parsed);
      }
    }
  }

  if (input.tags !== undefined) result.tags = Array.isArray(input.tags) ? input.tags.join(', ') : optionalText(input.tags);
  return result;
}

const TAXONOMY_STATES = ['Published', 'Unpublished', 'Trashed'];

function oneOf(value, allowed, field) {
  const text = requireText(value, field);
  if (!allowed.includes(text)) throw new ValidationError(`${field} deve ser um de: ${allowed.join(', ')}.`);
  return text;
}

function normalizeCategoryInput(input = {}, { partial }) {
  const result = {};
  if (!partial || input.title !== undefined) result.title = requireText(input.title, 'title');
  if (!partial || input.alias !== undefined) result.alias = requireText(input.alias, 'alias');
  if (input.parentId !== undefined) result.parentId = input.parentId === null || input.parentId === '' ? null : Number(input.parentId);
  if (input.description !== undefined) result.description = optionalText(input.description);
  if (input.state !== undefined) result.state = oneOf(input.state, TAXONOMY_STATES, 'state');
  return result;
}

function normalizeTagInput(input = {}, { partial }) {
  const result = {};
  if (!partial || input.name !== undefined) result.name = requireText(input.name, 'name');
  if (input.alias !== undefined) result.alias = optionalText(input.alias);
  if (input.state !== undefined) result.state = oneOf(input.state, TAXONOMY_STATES, 'state');
  if (input.description !== undefined) result.description = optionalText(input.description);
  if (input.parentId !== undefined) result.parentId = input.parentId === null || input.parentId === '' ? null : Number(input.parentId);
  return result;
}

function normalizeMenuInput(input = {}, { partial }) {
  const result = {};
  if (!partial || input.title !== undefined) result.title = requireText(input.title, 'title');
  if (!partial || input.path !== undefined) result.path = requireText(input.path, 'path');
  if (input.parentId !== undefined) result.parentId = input.parentId === null || input.parentId === '' ? null : Number(input.parentId);
  if (input.published !== undefined) result.published = requireText(input.published, 'published');
  if (input.ordering !== undefined) result.ordering = input.ordering === null || input.ordering === '' ? null : Number(input.ordering);
  return result;
}

const EXTENSION_TYPES = new Set(['Module', 'Plugin']);

function normalizeExtensionInput(input = {}, { partial, type: effectiveType }) {
  const result = {};
  if (!partial || input.title !== undefined) result.title = requireText(input.title, 'title');
  if (!partial || input.key !== undefined) result.key = extensionKey(input.key);
  if (!partial || input.type !== undefined) {
    const type = requireText(input.type, 'type');
    if (!EXTENSION_TYPES.has(type)) throw new ValidationError('type deve ser "Module" ou "Plugin".');
    result.type = type;
  }
  if (!partial || input.entryPointUrl !== undefined) result.entryPointUrl = sameSiteModuleUrl(input.entryPointUrl);
  if (input.discoveredFrom !== undefined) result.discoveredFrom = optionalText(input.discoveredFrom);
  if (input.enabled !== undefined) result.enabled = enabledValue(input.enabled);
  if (input.ordering !== undefined) result.ordering = integerValue(input.ordering, 'ordering');
  if (input.folder !== undefined) {
    result.folder = optionalPluginGroup(input.folder, 'folder');
  }
  if (input.params !== undefined) result.paramsJson = input.params === null ? '' : jsonObject(input.params, 'params');
  if (input.paramsJson !== undefined && input.params === undefined) {
    const params = parseJsonObject(input.paramsJson, { strict: true, field: 'paramsJson' });
    result.paramsJson = input.paramsJson === '' ? '' : partial && typeof input.paramsJson === 'string' ? input.paramsJson : JSON.stringify(params);
  }
  if (input.manifestJson !== undefined) {
    const manifest = parseJsonObject(input.manifestJson, { strict: true, field: 'manifestJson' });
    if ((result.type ?? effectiveType) === 'Plugin') optionalPluginGroup(manifest.group, 'manifest.group');
    result.manifestJson = input.manifestJson === '' ? '' : partial && typeof input.manifestJson === 'string' ? input.manifestJson : JSON.stringify(manifest);
  }
  return result;
}

function updateManifestPatch(normalized, record) {
  if (record.type !== 'Plugin') return normalized;
  const manifest = parseJsonObject(record.manifestJson, { strict: true, field: 'manifestJson' });
  const folder = optionalPluginGroup(record.folder, 'folder');
  const manifestGroup = optionalPluginGroup(manifest.group, 'manifest.group');
  if (!Object.hasOwn(normalized, 'folder')) return normalized;
  if (normalized.folder === '') { const { folder: _folder, ...patch } = normalized; return patch; }
  if (normalized.folder === (folder || manifestGroup) && !Object.hasOwn(normalized, 'manifestJson')) {
    const { folder: _folder, ...patch } = normalized;
    return patch;
  }
  const next = Object.hasOwn(normalized, 'manifestJson')
    ? parseJsonObject(normalized.manifestJson, { strict: true, field: 'manifestJson' }) : manifest;
  const group = normalized.folder;
  // Estado/ordem/parâmetros nunca passam aqui. Mesmo folder reenviado não
  // deve reserializar o manifesto se a metadata já expressa o mesmo grupo.
  return { ...normalized, manifestJson: optionalPluginGroup(next.group, 'manifest.group') === group
    ? normalized.manifestJson ?? record.manifestJson
    : JSON.stringify({ ...next, group }) };
}

function integerValue(value, field) {
  const number = Number(value);
  if (value === '' || value === null || !Number.isSafeInteger(number)) throw new ValidationError(`${field} deve ser um inteiro finito.`);
  return number;
}

/*
 * Colunas adicionadas no schemaVersion 2 (ver spmiddle-schemas.js) só são
 * enviadas quando diferem do padrão ou quando o registro já as possui —
 * listas SharePoint ainda não reprovisionadas continuam aceitando as
 * gravações das telas existentes.
 */
function dropUnprovisionedDefaults(normalized, record, defaults) {
  const result = { ...normalized };
  for (const [field, fallback] of Object.entries(defaults)) {
    if (!(field in result) || (record && record[field] !== undefined && record[field] !== null)) continue;
    const value = result[field];
    if (value === fallback || value === '' || value === null || (fallback === false && value === false)) delete result[field];
  }
  return result;
}

const EXTENSION_V2_DEFAULTS = Object.freeze({ ordering: 0, folder: '', paramsJson: '', manifestJson: '' });
const MODULE_V2_DEFAULTS = Object.freeze({ showTitle: true, publishUp: null, publishDown: null, trashed: false, assignment: 'all', assignmentJson: '[]', note: '' });
const SITE_CONFIG_V2_DEFAULTS = Object.freeze({ offline: false, offlineMessage: '', metaDescription: '', metaKeywords: '', robots: '', sitenamePagetitles: 'none', homeView: 'category', homeCategory: 'noticias', templateStylesJson: '', componentParamsJson: '' });

function positionData(input, field) {
  const descriptor = input && Object.getOwnPropertyDescriptor(input, field);
  if (descriptor && !Object.hasOwn(descriptor, 'value')) throw new ValidationError(`${field} deve ser uma propriedade de dados.`);
  return descriptor?.value;
}

function normalizeTemplateInput(input = {}, { partial, existingStyles }) {
  const result = {};
  if (!partial || input.title !== undefined) result.title = requireText(input.title, 'title');
  if (!partial || input.key !== undefined) result.key = extensionKey(input.key);
  if (!partial || input.version !== undefined) result.version = requireText(input.version, 'version');
  if (!partial || input.entryPointUrl !== undefined) result.entryPointUrl = sameSiteModuleUrl(input.entryPointUrl);
  const styles = ownDataValue(input, 'styles');
  const paramDefinitions = ownDataValue(input, 'paramDefinitions');
  const paramDefinitionsJson = ownDataValue(input, 'paramDefinitionsJson');
  const declarations = paramDefinitions !== undefined ? paramDefinitions : paramDefinitionsJson;
  if (paramDefinitions !== undefined || paramDefinitionsJson !== undefined) {
    const list = typeof declarations === 'string' ? parseStrictJson(declarations, 'paramDefinitions') : declarations;
    if (!Array.isArray(list)) throw new ValidationError('paramDefinitions deve ser uma lista JSON.');
    result.styles = packTemplateMetadata(styles, normalizeParamDefinitions(list), existingStyles ?? styles);
  } else if (styles !== undefined) {
    const supplied = readTemplateMetadata({ styles });
    const existing = existingStyles === undefined ? supplied : readTemplateMetadata({ styles: existingStyles });
    if (supplied.metadataPresent && existingStyles === undefined && typeof styles === 'string') result.styles = styles;
    else result.styles = supplied.metadataPresent || existing.metadataPresent
      ? packTemplateMetadata(styles, supplied.metadataPresent ? supplied.definitions : existing.definitions, existingStyles ?? styles)
      : templateStyles(styles);
  }
  const positions = positionData(input, 'positions');
  const positionsJson = positionData(input, 'positionsJson');
  if (positions !== undefined) {
    result.positionsJson = templatePositions(positions);
  }
  if (positionsJson !== undefined && positions === undefined) result.positionsJson = templatePositions(positionsJson);
  if (!partial && result.positionsJson === undefined) throw new ValidationError('positions é obrigatório.');
  if (input.discoveredFrom !== undefined) result.discoveredFrom = optionalText(input.discoveredFrom);
  if (input.enabled !== undefined) result.enabled = enabledValue(input.enabled);
  return result;
}

const SCOPE_KINDS = new Set(['All', 'Route']);
const SCOPE_ROUTES = new Set(['home', 'category', 'article', 'search', 'archive']);

/*
 * `settings` chega como objeto (vindo do formulário admin) e é serializado
 * para `settingsJson` (texto) aqui, na fronteira de persistência — o
 * mapper/schema SharePoint não tem um tipo de campo "objeto arbitrário".
 * Desserialização equivalente acontece em src/index.js ao montar
 * `sidebarModules` a partir das instâncias cadastradas.
 */
function normalizeModuleInstanceInput(input = {}, { partial }) {
  const result = {};
  if (!partial || input.title !== undefined) result.title = requireText(input.title, 'title');
  if (!partial || input.extensionKey !== undefined) result.extensionKey = requireText(input.extensionKey, 'extensionKey');
  const position = positionData(input, 'position');
  if (!partial || position !== undefined) {
    result.position = requireText(position, 'position');
    // Forma síncrona; declarações do catálogo são verificadas antes da escrita.
    if (result.position === 'component' || (!MODULE_POSITIONS.includes(result.position) && !isWellFormedPositionName(result.position))) throw new ValidationError('position deve ser uma posição de módulo suportada.');
  }
  if (input.ordering !== undefined) {
    const ordering = Number(input.ordering);
    if (!Number.isSafeInteger(ordering)) throw new ValidationError('ordering deve ser um inteiro finito.');
    result.ordering = ordering;
  }
  if (input.settings !== undefined) {
    if (input.settings !== null && (typeof input.settings !== 'object' || Array.isArray(input.settings))) throw new ValidationError('settings deve ser um objeto JSON.');
    result.settingsJson = input.settings === null ? '' : jsonObject(input.settings);
  }
  if (input.settingsJson !== undefined && input.settings === undefined) result.settingsJson = input.settingsJson === '' || input.settingsJson === null ? '' : jsonObject(input.settingsJson, 'settingsJson');
  if (input.enabled !== undefined) result.enabled = enabledValue(input.enabled);
  if (input.scopeKind !== undefined) {
    const scopeKind = requireText(input.scopeKind, 'scopeKind');
    if (!SCOPE_KINDS.has(scopeKind)) throw new ValidationError('scopeKind deve ser "All" ou "Route".');
    result.scopeKind = scopeKind;
  }
  if (input.scopeRoute !== undefined) {
    const scopeRoute = optionalText(input.scopeRoute);
    if (scopeRoute && !SCOPE_ROUTES.has(scopeRoute)) throw new ValidationError(`scopeRoute desconhecida: ${scopeRoute}.`);
    result.scopeRoute = scopeRoute;
  }
  if (input.scopeCategoryAlias !== undefined) result.scopeCategoryAlias = optionalText(input.scopeCategoryAlias);
  // Boolean opcional nunca gravado chega do SharePoint como null: equivale a ausente.
  if (input.showTitle !== undefined && input.showTitle !== null) result.showTitle = enabledValue(input.showTitle, 'showTitle');
  if (input.trashed !== undefined && input.trashed !== null) result.trashed = enabledValue(input.trashed, 'trashed');
  const publishUp = normalizeDateTime(input.publishUp, 'publishUp');
  const publishDown = normalizeDateTime(input.publishDown, 'publishDown');
  if (publishUp !== undefined) result.publishUp = publishUp;
  if (publishDown !== undefined) result.publishDown = publishDown;
  if (publishUp && publishDown && publishDown <= publishUp) throw new ValidationError('publishDown deve ser posterior a publishUp.');
  if (input.assignment !== undefined) result.assignment = normalizeAssignment(input.assignment);
  if (input.assignmentTokens !== undefined) result.assignmentJson = JSON.stringify(normalizeAssignmentTokens(input.assignmentTokens));
  else if (input.assignmentJson !== undefined) result.assignmentJson = JSON.stringify(normalizeAssignmentTokens(input.assignmentJson));
  if (input.note !== undefined) result.note = optionalText(input.note).slice(0, 255);
  return result;
}

const SITE_CONFIG_TITLE = 'MiniJoomlaSiteConfig';
const INITIAL_SITE_FIELDS = Object.freeze(['siteName', 'siteDescription', 'timezone', 'language', 'pageSize', 'templateKey', 'homeView', 'homeCategory', 'offline', 'offlineMessage']);
const initialSiteFields = (input) => Object.fromEntries(INITIAL_SITE_FIELDS.map((field) => [field, ownDataValue(input, field)]).filter(([, value]) => value !== undefined));

function normalizeSiteConfigInput(input = {}, { homeView, definitionsByKey } = {}) {
  const result = { title: SITE_CONFIG_TITLE };
  if (input.siteName !== undefined) result.siteName = optionalText(input.siteName);
  if (input.templateKey !== undefined) result.templateKey = optionalText(input.templateKey);
  if (input.siteDescription !== undefined) result.siteDescription = optionalText(input.siteDescription);
  if (input.language !== undefined) result.language = optionalText(input.language);
  if (input.timezone !== undefined) result.timezone = optionalText(input.timezone);
  if (input.basePath !== undefined) result.basePath = optionalText(input.basePath);
  if (input.pageSize !== undefined) { const pageSize = Number(input.pageSize); if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 50) throw new ValidationError('pageSize deve ser um número entre 1 e 50.'); result.pageSize = pageSize; }
  if (input.customHtmlTitle !== undefined) result.customHtmlTitle = optionalText(input.customHtmlTitle);
  if (input.customHtmlBody !== undefined) result.customHtmlBody = optionalText(input.customHtmlBody);
  if (input.offline !== undefined) result.offline = enabledValue(input.offline);
  if (input.offlineMessage !== undefined) result.offlineMessage = optionalText(input.offlineMessage);
  if (input.metaDescription !== undefined) result.metaDescription = optionalText(input.metaDescription).slice(0, 500);
  if (input.metaKeywords !== undefined) result.metaKeywords = optionalText(input.metaKeywords).slice(0, 500);
  if (input.robots !== undefined) {
    result.robots = optionalText(input.robots);
    if (!ROBOTS.includes(result.robots)) throw new ValidationError('robots inválido.');
  }
  if (input.sitenamePagetitles !== undefined) {
    result.sitenamePagetitles = optionalText(input.sitenamePagetitles) || 'none';
    if (!['none', 'before', 'after'].includes(result.sitenamePagetitles)) throw new ValidationError('sitenamePagetitles deve ser none, before ou after.');
  }
  if (input.homeView !== undefined) {
    result.homeView = optionalText(input.homeView) || 'category';
    if (!['category', 'featured'].includes(result.homeView)) throw new ValidationError('homeView deve ser category ou featured.');
  }
  if (input.homeCategory !== undefined) {
    result.homeCategory = optionalText(input.homeCategory).trim();
    if (!result.homeCategory && (result.homeView ?? homeView) !== 'featured') result.homeCategory = 'noticias';
    if (result.homeCategory && !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(result.homeCategory)) throw new ValidationError('homeCategory deve ser um alias de categoria.');
  }
  if (input.templateStylesJson !== undefined) {
    if(input.templateStylesJson==='')result.templateStylesJson='';
    else {
      const text=typeof input.templateStylesJson==='string';
      const validated=validateTemplateStyles(text?parseStrictJson(input.templateStylesJson,'templateStylesJson'):input.templateStylesJson,definitionsByKey,{preserveValues:text});
      result.templateStylesJson=text?input.templateStylesJson:validated;
    }
  }
  if (input.componentParamsJson !== undefined) result.componentParamsJson = input.componentParamsJson === '' ? '' : jsonObject(input.componentParamsJson, 'componentParamsJson');
  return result;
}

const ROBOTS = Object.freeze(['', 'index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow']);

function parseStrictJson(value, field) {
  try { return JSON.parse(value); } catch { throw new ValidationError(`${field} deve ser JSON válido.`); }
}


/* ---------- Conteúdo estilo Joomla: filtros, árvore, lote, duplicar ---------- */

const lower = (value) => String(value ?? '').toLocaleLowerCase();
const tagNames = (value) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
const stateOf = (row) => row?.state || 'Published';
const PAGE_LIMITS = [10, 20, 50, 100];
const ARTICLE_SORTS = ['title', 'category', 'author', 'publishUp', 'featured', 'state', 'id'];
const ARTICLE_BATCH_PATCHES = Object.freeze({
  publish: { state: 'Published' }, unpublish: { state: 'Draft' }, archive: { state: 'Archived' }, trash: { state: 'Trashed' },
  // Joomla restaura da lixeira como "não publicado".
  restore: { state: 'Draft' }, feature: { featured: true }, unfeature: { featured: false }
});
const TAXONOMY_BATCH_PATCHES = Object.freeze({ publish: { state: 'Published' }, unpublish: { state: 'Unpublished' }, trash: { state: 'Trashed' }, restore: { state: 'Unpublished' } });
// Colunas novas: omitidas enquanto a lista SharePoint não foi reprovisionada (valor padrão + registro legado).
const TAXONOMY_V2_DEFAULTS = Object.freeze({ categories: { state: 'Published' }, tags: { description: '', parentId: null } });

/** Ids de todos os descendentes de `id`, imune a ciclos persistidos. */
export function descendantIds(rows, id) {
  const found = new Set();
  const stack = [Number(id)];
  while (stack.length) {
    const current = stack.pop();
    for (const row of rows) {
      if (row.parentId !== null && row.parentId !== undefined && Number(row.parentId) === current && !found.has(row.id)) { found.add(row.id); stack.push(row.id); }
    }
  }
  return found;
}

/** Ordena em árvore (pai antes dos filhos, irmãos por título) devolvendo { row, depth }. */
export function treeOrder(rows, labelField = 'title') {
  const ids = new Set(rows.map((row) => row.id));
  const children = new Map();
  for (const row of rows) {
    const parent = row.parentId !== null && row.parentId !== undefined && ids.has(Number(row.parentId)) && Number(row.parentId) !== row.id ? Number(row.parentId) : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(row);
  }
  const seen = new Set();
  const ordered = [];
  const walk = (parent, depth) => {
    for (const row of (children.get(parent) ?? []).sort((a, b) => String(a[labelField] ?? '').localeCompare(String(b[labelField] ?? '')))) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      ordered.push({ row, depth });
      walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  // Ciclos persistidos nunca escondem registros: aparecem como raízes.
  for (const row of rows) if (!seen.has(row.id)) { seen.add(row.id); ordered.push({ row, depth: 0 }); walk(row.id, 1); }
  return ordered;
}

/** Próximo título "X (2)" e alias "x-2" ainda livres (Joomla: generateNewTitle). */
export function nextCopyNames(rows, record, titleField, aliasField) {
  const bump = (value, pattern, make) => { const match = String(value).match(pattern); return match ? make(value.slice(0, match.index), Number(match[1]) + 1) : make(value, 2); };
  const titles = new Set(rows.map((row) => lower(row[titleField])));
  const aliases = new Set(rows.map((row) => lower(row[aliasField])).filter(Boolean));
  let title = String(record[titleField] ?? '');
  let alias = String(record[aliasField] ?? '');
  do {
    title = bump(title, /\s\((\d+)\)$/, (base, n) => `${base} (${n})`);
    if (alias) alias = bump(alias, /-(\d+)$/, (base, n) => `${base}-${n}`);
  } while (titles.has(lower(title)) || (alias && aliases.has(lower(alias))));
  return { title, alias };
}

function matchesSearch(row, term, fields) {
  if (!term) return true;
  if (/^id:\d+$/i.test(term)) return row.id === Number(term.slice(3));
  return fields.some((field) => lower(row[field]).includes(lower(term)));
}

function copyFields(record) {
  const { id: _id, etag: _etag, created: _created, modified: _modified, ...copy } = record;
  for (const field of Object.keys(copy)) if (copy[field] === undefined || copy[field] === null) delete copy[field];
  return copy;
}

// Exclusão definitiva (unitária ou em lote): só da lixeira e depois das guardas do domínio.
function trashedRemove(crud, canDelete) {
  return async (id, options = {}) => {
    requireEtag(options.etag);
    const record = await crud.get(id);
    if (stateOf(record) !== 'Trashed') throw new ValidationError('Envie para a lixeira antes de excluir definitivamente.');
    await canDelete?.(record);
    return crud.remove(id, options);
  };
}

function createBatch(crud, { patches, extra = {} }) {
  return async (items, action, options = {}) => {
    if (action !== 'delete' && !Object.hasOwn(patches, action) && !Object.hasOwn(extra, action)) throw new ValidationError(`Ação em lote desconhecida: ${String(action)}.`);
    const prepared = await extra[action]?.prepare?.(options);
    return runBatch(items, async ({ id, etag }) => {
      if (action === 'delete') return crud.remove(id, { etag });
      return crud.update(id, extra[action] ? extra[action].patch(prepared) : patches[action], { etag });
    });
  };
}

async function snapshots(crud, rows) {
  // findMany omite ETag; ações da tela precisam do ETag do momento da renderização.
  // Sem ele toda ação falharia depois, então a falha aparece agora (sem detalhe interno). Concorrência limitada a 6.
  const failure = () => new Error('Não foi possível carregar os registros com a versão atual. Recarregue a página.');
  const result = new Array(rows.length);
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const index = next++;
      try { result[index] = await crud.get(rows[index].id); } catch { throw failure(); }
      if (!result[index]) throw failure();
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, worker));
  return result;
}

export function createAdminService(repositories, { pluginManager, initialSiteConfig } = {}) {
  if (pluginManager && (typeof pluginManager.beforeSave !== 'function' || typeof pluginManager.afterSave !== 'function')) {
    throw new TypeError('pluginManager deve expor beforeSave e afterSave.');
  }
  // Pure host metadata: never a row, never an ETag, never a write on mount.
  const initialDefaults = initialSiteConfig === undefined ? undefined : Object.freeze(initialSiteFields(normalizeSiteConfigInput(
    initialSiteFields(createConfig({ offline: false, offlineMessage: '', ...initialSiteFields(initialSiteConfig) }))
  )));
  const articleRows = async () => (repositories.articles ? listAll(requireRepository(repositories, 'articles')) : []);
  const categoryRows = async () => (repositories.categories ? listAll(requireRepository(repositories, 'categories')) : []);

  /*
   * Lista de artigos filtrada/ordenada/paginada no CLIENTE sobre o conjunto
   * completo (listAll).
   * ponytail: teto de 10000 itens/100 páginas do listAll e uma releitura
   * findById por linha da página (ETag); acima disso, mover filtro/ordem
   * para $filter/$orderby do SharePoint.
   */
  async function queryArticles(params = {}) {
    const [rows, categoryList] = await Promise.all([articleRows(), categoryRows()]);
    const titles = new Map(categoryList.map((row) => [row.id, row.title]));
    const categoryScope = params.categoryId ? new Set([Number(params.categoryId), ...descendantIds(categoryList, params.categoryId)]) : null;
    const term = String(params.q ?? '').trim();
    const filtered = rows.filter((row) => {
      const state = stateOf(row);
      if (params.state === '*' ? false : params.state ? state !== params.state : state === 'Trashed') return false;
      if (categoryScope && !categoryScope.has(Number(row.categoryId))) return false;
      if (['1', '0'].includes(String(params.featured ?? '')) && Boolean(row.featured) !== (String(params.featured) === '1')) return false;
      if (params.author && row.author !== params.author) return false;
      if (params.language && row.language !== params.language) return false;
      if (params.tag && !tagNames(row.tags).some((name) => lower(name) === lower(params.tag))) return false;
      return matchesSearch(row, term, ['title', 'alias', 'note']);
    });
    const sort = ARTICLE_SORTS.includes(params.sort) ? params.sort : 'id';
    const direction = (params.dir ?? (sort === 'id' ? 'desc' : 'asc')) === 'desc' ? -1 : 1;
    const key = (row) => sort === 'category' ? lower(titles.get(row.categoryId)) : sort === 'state' ? stateOf(row) : sort === 'featured' ? (row.featured ? 1 : 0) : sort === 'publishUp' ? (row.publishUp ? new Date(row.publishUp).getTime() || 0 : 0) : sort === 'id' ? row.id : lower(row[sort]);
    filtered.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * direction || a.id - b.id);
    const limit = PAGE_LIMITS.includes(Number(params.limit)) ? Number(params.limit) : 20;
    const pageCount = Math.max(1, Math.ceil(filtered.length / limit));
    const page = Math.min(pageCount, Math.max(1, Number.parseInt(params.page, 10) || 1));
    const pageRows = await snapshots(articleCrud, filtered.slice((page - 1) * limit, page * limit));
    return {
      rows: pageRows.map((row) => ({ ...row, etag: row.etag, categoryTitle: titles.get(row.categoryId) ?? '' })), total: filtered.length, page, pageCount, limit,
      facets: { authors: [...new Set(rows.map((row) => row.author).filter(Boolean))].sort(), languages: [...new Set(rows.map((row) => row.language).filter(Boolean))].sort() }
    };
  }

  async function categoryExists(id) {
    if (!(await categoryRows()).some((row) => row.id === Number(id))) throw new ValidationError('A categoria escolhida não existe.');
  }

  const articleRepository = () => requireRepository(repositories, 'articles');
  async function saveArticle(input, { partial, id, etag, action }) {
    const normalized = normalizeArticleInput(input, { partial });
    if (!pluginManager) return partial ? articleRepository().update(id, normalized, { etag }) : articleRepository().create(normalized);
    // Optional per-write handle pins handlers/params across async persistence,
    // refresh and out-of-order completions. Legacy injected managers retain
    // their beforeSave/afterSave contract without implicit wrapping or imports.
    const savePlugins = typeof pluginManager.captureSaveOperation === 'function'
      ? await pluginManager.captureSaveOperation() : pluginManager;
    if (!savePlugins || typeof savePlugins.beforeSave !== 'function' || typeof savePlugins.afterSave !== 'function') throw new TypeError('Handle de plugins de gravação inválido.');
    const writeGuard = Object.getOwnPropertyDescriptor(savePlugins, 'assertBeforeWrite');
    if (writeGuard && (!Object.hasOwn(writeGuard, 'value') || typeof writeGuard.value !== 'function')) throw new TypeError('Guard de gravação deve ser uma função síncrona de dados.');
    const value = await savePlugins.beforeSave({ ...normalized }, { id, action });
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('onContentBeforeSave deve retornar um objeto de artigo.');
    const transformed = normalizeArticleInput(value, { partial });
    const repository = articleRepository();
    // No await between this optional synchronous operation guard and invoking
    // persistence. Legacy injected managers without a guard remain supported.
    if (writeGuard) {
      const result = writeGuard.value.call(savePlugins);
      if (result !== undefined) {
        // Invalid async guards still block the write immediately. Observe a
        // genuine Promise rejection without awaiting it or invoking thenables.
        try { Reflect.apply(Promise.prototype.then, result, [undefined, () => {}]); }
        catch { /* A non-Promise return is rejected by the same contract below. */ }
        throw new TypeError('Guard de gravação deve ser síncrono e não retornar valor.');
      }
    }
    const saved = partial
      ? await repository.update(id, transformed, { etag })
      : await repository.create(transformed);
    try {
      // SPMIDDLE update may return null after a successful MERGE 204. Read the
      // persisted record (including its current ETag) ONLY for observation;
      // never fabricate a full article from a partial patch or reuse old ETag.
      // This is not an atomic write snapshot: another editor may update the
      // record before this read. Failure here must not retry/mask the write.
      const persisted = partial && (saved === null || saved === undefined)
        ? await articleRepository().findById(id) : saved;
      if (persisted && typeof persisted === 'object' && !Array.isArray(persisted)) {
        const observed = structuredClone(persisted);
        if (persisted.etag !== undefined) Object.defineProperty(observed, 'etag', { value: persisted.etag, enumerable: false, configurable: true });
        await savePlugins.afterSave(observed, { id: persisted.id, action });
      }
    } catch { /* observacional: nunca mascara a gravação concluída */ }
    return saved;
  }
  const articleCrud = {
    ...createDomainCrud(repositories, 'articles', normalizeArticleInput),
    create: (input) => saveArticle(input, { partial: false, action: 'create' }),
    update: async (id, input, { etag } = {}) => {
      requireEtag(etag);
      return saveArticle(input, { partial: true, id, etag, action: 'update' });
    }
  };
  const articleRemove = trashedRemove(articleCrud);
  const articleBatch = createBatch({ ...articleCrud, remove: articleRemove }, {
    patches: ARTICLE_BATCH_PATCHES,
    extra: {
      move: { prepare: async ({ categoryId } = {}) => { if (!categoryId || !Number.isSafeInteger(Number(categoryId))) throw new ValidationError('Escolha a categoria de destino.'); await categoryExists(categoryId); return Number(categoryId); }, patch: (categoryId) => ({ categoryId }) }
    }
  });
  const articles = {
    ...articleCrud,
    remove: articleRemove,
    query: queryArticles,
    // "duplicate" em lote não usa o ETag da origem (a origem não é alterada).
    batch: (items, action, options) => action === 'duplicate'
      ? runBatch((Array.isArray(items) ? items : []).map((item) => ({ ...item, etag: item.etag || '"-"' })), ({ id }) => articles.duplicate(id))
      : articleBatch(items, action, options),
    async duplicate(id) {
      const record = await articleCrud.get(id);
      if (!record) throw new ValidationError('Artigo não encontrado.');
      const names = nextCopyNames(await articleRows(), record, 'title', 'alias');
      // attribsJson e demais chaves seguem intactos; a cópia nasce não publicada e sem destaque.
      return articleCrud.create({ ...copyFields(record), title: names.title, alias: names.alias, state: 'Draft', featured: false });
    }
  };

  function createTaxonomy(domain, base, normalize, { titleField, aliasField, deletionGuard, countsFor }) {
    const rowsOf = async () => (repositories[domain] ? listAll(requireRepository(repositories, domain)) : []);
    async function guardParent(id, parentId) {
      if (parentId === null || parentId === undefined) return;
      const rows = await rowsOf();
      if (!rows.some((row) => row.id === parentId)) throw new ValidationError('O item pai escolhido não existe.');
      if (id !== undefined && (parentId === Number(id) || descendantIds(rows, id).has(parentId))) throw new ValidationError('O item pai não pode ser o próprio item nem um de seus descendentes.');
    }
    const taxonomy = {
      ...base,
      async create(input) {
        const normalized = normalize(input, { partial: false });
        await guardParent(undefined, normalized.parentId);
        return requireRepository(repositories, domain).create(dropUnprovisionedDefaults(normalized, null, TAXONOMY_V2_DEFAULTS[domain]));
      },
      async update(id, input, { etag } = {}) {
        requireEtag(etag);
        const normalized = normalize(input, { partial: true });
        await guardParent(id, normalized.parentId);
        const record = await base.get(id);
        return requireRepository(repositories, domain).update(id, dropUnprovisionedDefaults(normalized, record, TAXONOMY_V2_DEFAULTS[domain]), { etag });
      },
      /** Linhas em ordem de árvore com profundidade e contagens; lixeira oculta por padrão. */
      async query(params = {}) {
        const [rows, articleList] = await Promise.all([rowsOf(), articleRows()]);
        const term = String(params.q ?? '').trim();
        const visible = treeOrder(rows, titleField).filter(({ row }) => (params.state === '*' ? true : params.state ? stateOf(row) === params.state : stateOf(row) !== 'Trashed') && matchesSearch(row, term, [titleField, aliasField]));
        const fresh = await snapshots(base, visible.map(({ row }) => row));
        return visible.map(({ depth }, index) => ({ ...fresh[index], etag: fresh[index].etag, depth, counts: countsFor(fresh[index], articleList) }));
      },
      /** Opções de pai indentadas, sem o item e seus descendentes (impede ciclos) nem itens na lixeira. */
      async treeOptions({ excludeId, current } = {}) {
        const rows = await rowsOf();
        const blocked = excludeId === undefined ? new Set() : new Set([Number(excludeId), ...descendantIds(rows, excludeId)]);
        return treeOrder(rows, titleField)
          .filter(({ row }) => !blocked.has(row.id) && (stateOf(row) !== 'Trashed' || row.id === Number(current)))
          .map(({ row, depth }) => ({ value: row.id, label: `${'— '.repeat(depth)}${row[titleField]}` }));
      },
      async duplicate(id) {
        const record = await base.get(id);
        if (!record) throw new ValidationError('Registro não encontrado.');
        const names = nextCopyNames(await rowsOf(), record, titleField, aliasField);
        return taxonomy.create({ ...copyFields(record), [titleField]: names.title, [aliasField]: names.alias, state: 'Unpublished' });
      }
    };
    taxonomy.remove = trashedRemove(base, async (record) => {
      if ((await rowsOf()).some((row) => row.parentId === record.id)) throw new ValidationError('Remova ou mova os itens filhos antes de excluir.');
      await deletionGuard(record, await articleRows());
    });
    const runTaxonomyBatch = createBatch(taxonomy, { patches: TAXONOMY_BATCH_PATCHES });
    // "duplicate" em lote não usa o ETag da origem (a origem não é alterada).
    taxonomy.batch = (items, action, options) => action === 'duplicate'
      ? runBatch((Array.isArray(items) ? items : []).map((item) => ({ ...item, etag: item.etag || '"-"' })), ({ id }) => taxonomy.duplicate(id))
      : runTaxonomyBatch(items, action, options);
    return taxonomy;
  }

  const countStates = (row, articleList) => articleList.filter((article) => article.categoryId === row.id).reduce((total, article) => ({ ...total, [stateOf(article)]: (total[stateOf(article)] ?? 0) + 1 }), { Published: 0, Draft: 0, Archived: 0, Trashed: 0 });
  const categories = createTaxonomy('categories', createDomainCrud(repositories, 'categories', normalizeCategoryInput), normalizeCategoryInput, {
    titleField: 'title', aliasField: 'alias', countsFor: countStates,
    deletionGuard: (record, articleList) => { if (articleList.some((article) => article.categoryId === record.id)) throw new ValidationError('A categoria ainda possui artigos; mova-os ou exclua-os antes.'); }
  });
  const tags = createTaxonomy('tags', createDomainCrud(repositories, 'tags', normalizeTagInput), normalizeTagInput, {
    titleField: 'name', aliasField: 'alias', deletionGuard: () => {},
    countsFor: (row, articleList) => ({ count: articleList.filter((article) => stateOf(article) !== 'Trashed' && tagNames(article.tags).some((name) => lower(name) === lower(row.name))).length })
  });
  const menu = createDomainCrud(repositories, 'menu', normalizeMenuInput);
  const extensionCrud = createDomainCrud(repositories, 'extensions', normalizeExtensionInput);
  const templateCrud = createDomainCrud(repositories, 'templates', normalizeTemplateInput);
  const moduleCrud = createDomainCrud(repositories, 'moduleInstances', normalizeModuleInstanceInput);

  async function currentConfig() {
    if (!repositories.siteConfig) return null;
    const repository = requireRepository(repositories, 'siteConfig');
    const rows = await listAll(repository);
    if (rows.length > 1) throw new ValidationError('Há configurações de site duplicadas. Nenhum registro foi escolhido ou alterado.');
    return rows.length ? repository.findById(rows[0].id) : null;
  }

  async function requireUniqueKey(domain, key, id) {
    const rows = await listAll(requireRepository(repositories, domain));
    if (rows.some((row) => row.key === key && row.id !== id)) throw new ValidationError('Já existe um registro com esta chave.');
  }

  async function validatePosition(position) {
    if (MODULE_POSITIONS.includes(position)) return;
    const rows = repositories.templates ? await listAll(requireRepository(repositories, 'templates')) : [];
    // Valide todo o catálogo antes de aceitar uma declaração, mesmo quando
    // outro template já contém a posição. Ausência legada não é corrupção.
    const declared = rows.filter((row) => !BUILTIN_TEMPLATES.includes(row.key)).map((row) => {
      const value = positionData(row, 'positionsJson');
      return value === undefined || value === null || value === '' ? [] : JSON.parse(templatePositions(value));
    });
    if (!declared.some((positions) => positions.includes(position))) throw new ValidationError('position deve ser declarada por um template registrado.');
  }

  async function requireModuleConfiguration(input) {
    const normalized = normalizeModuleInstanceInput(input, { partial: false });
    const kind = input.scopeKind || 'All';
    const route = input.scopeRoute || '';
    if (kind === 'Route' && !route) throw new ValidationError('scopeRoute é obrigatório quando scopeKind é Route.');
    if (kind !== 'Route' && (route || input.scopeCategoryAlias)) throw new ValidationError('Rota e categoria exigem escopo Route.');
    if (input.scopeCategoryAlias && route !== 'category') throw new ValidationError('scopeCategoryAlias só se aplica à rota category.');
    if (['only', 'except'].includes(normalized.assignment) && !normalizeAssignmentTokens(normalized.assignmentJson).length) throw new ValidationError('Selecione ao menos uma página para a atribuição escolhida.');
    const settings = normalized.settingsJson ? JSON.parse(normalized.settingsJson) : {};
    for (const field of ['moduleClass', 'headerClass']) {
      if (settings[field] !== undefined && (typeof settings[field] !== 'string' || !MODULE_CLASS_PATTERN.test(settings[field]))) throw new ValidationError(`${field} aceita apenas letras, números, espaço, hífen e underscore.`);
    }
    if (settings.headerTag !== undefined && !['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p'].includes(settings.headerTag)) throw new ValidationError('headerTag inválida.');
    let rows = [];
    if (!BUILTIN_MODULE_KEYS.includes(normalized.extensionKey) || normalized.extensionKey==='articles-featured') {
      rows = repositories.extensions ? await listAll(requireRepository(repositories, 'extensions')) : [];
      if (!BUILTIN_MODULE_KEYS.includes(normalized.extensionKey) && !rows.some((row) => row.key === normalized.extensionKey && row.type === 'Module')) throw new ValidationError('extensionKey deve identificar um módulo nativo ou Module registrado.');
    }
    const type = moduleTypeCatalog(rows).find((entry) => entry.key === normalized.extensionKey);
    normalizeParamValues([...(type?.params ?? []), ...MODULE_ADVANCED_PARAMS], settings);
  }

  const extensions = {
    ...extensionCrud,
    async create(input) {
      const normalized = normalizeExtensionInput(input, { partial: false });
      await requireUniqueKey('extensions', normalized.key);
      return requireRepository(repositories, 'extensions').create(dropUnprovisionedDefaults({ enabled: true, ...normalized }, null, EXTENSION_V2_DEFAULTS));
    },
    async update(id, input, options = {}) {
      requireEtag(options.etag);
      const record = await extensionCrud.get(id);
      if (!record) throw new ValidationError('Extensão não encontrada.');
      for (const field of ['key', 'type', 'entryPointUrl']) {
        if (input[field] !== undefined && input[field] !== record[field]) throw new ValidationError(`${field} pertence ao manifesto registrado e não pode ser alterado.`);
      }
      const normalized = updateManifestPatch(normalizeExtensionInput(input, { partial: true, type: record.type }), record);
      return requireRepository(repositories, 'extensions').update(id, dropUnprovisionedDefaults(normalized, record, EXTENSION_V2_DEFAULTS), { etag: options.etag });
    },
    async remove(id, options) {
      const record = await extensionCrud.get(id);
      if (record.type === 'Plugin' && NATIVE_PLUGIN_URLS.includes(record.entryPointUrl)) throw new ValidationError('Plugins nativos não podem ser excluídos; desabilite-os.');
      if (record.type === 'Module' && repositories.moduleInstances) {
        const instances = await listAll(requireRepository(repositories, 'moduleInstances'));
        if (instances.some((row) => row.extensionKey === record.key)) throw new ValidationError('Remova ou reatribua as instâncias antes de excluir o registro do módulo.');
      }
      return extensionCrud.remove(id, options);
    }
  };
  const templates = {
    ...templateCrud,
    available: Boolean(repositories.templates),
    async create(input) {
      const normalized = normalizeTemplateInput(input, { partial: false });
      await requireUniqueKey('templates', normalized.key);
      return templateCrud.create({ enabled: true, ...normalized });
    },
    async update(id, input, options = {}) {
      requireEtag(options.etag);
      const record = await templateCrud.get(id);
      if (!record) throw new ValidationError('Template não encontrado.');
      for (const field of ['key', 'entryPointUrl']) {
        if (input[field] !== undefined && input[field] !== record[field]) throw new ValidationError(`${field} pertence ao manifesto registrado e não pode ser alterado.`);
      }
      const config = await currentConfig();
      if (record.key === (config?.templateKey || 'default') && input.enabled === false) throw new ValidationError('Escolha outro template padrão antes de desativar este template.');
      const normalized = normalizeTemplateInput(input, { partial: true, existingStyles: ownDataValue(record, 'styles') });
      return requireRepository(repositories, 'templates').update(id, normalized, { etag: options.etag });
    },
    async remove(id, options) {
      const record = await templateCrud.get(id);
      const config = await currentConfig();
      if (record.key === (config?.templateKey || 'default')) throw new ValidationError('Escolha outro template padrão antes de excluir este registro.');
      return templateCrud.remove(id, options);
    },
    async setDefault(id, { etag, configEtag } = {}) {
      requireEtag(etag, 'etag do template');
      const record = await templateCrud.get(id);
      if (record.etag !== etag) throw Object.assign(new Error('Template alterado por outra pessoa.'), { code: 'concurrency-conflict' });
      if (!record.enabled) throw new ValidationError('Habilite o template antes de torná-lo padrão.');
      const repository = requireRepository(repositories, 'siteConfig');
      const config = await currentConfig();
      if (!config) return siteConfig.save({ templateKey: record.key });
      requireEtag(configEtag, 'etag da configuração');
      return repository.update(config.id, { templateKey: record.key }, { etag: configEtag });
    }
  };
  const moduleInstances = {
    ...moduleCrud,
    async create(input) {
      await requireModuleConfiguration(input);
      const normalized = normalizeModuleInstanceInput({ enabled: true, ordering: 0, scopeKind: 'All', ...input }, { partial: false });
      await validatePosition(normalized.position);
      return requireRepository(repositories, 'moduleInstances').create(dropUnprovisionedDefaults(normalized, null, MODULE_V2_DEFAULTS));
    },
    async update(id, input, options = {}) {
      requireEtag(options.etag);
      const patch = normalizeModuleInstanceInput(input, { partial: true });
      const record = await moduleCrud.get(id);
      if (!record) throw new ValidationError('Módulo não encontrado.');
      // Não permita que um formulário substitua configurações corrompidas
      // por defaults, mesmo quando o patch já contém settings válidos.
      parseJsonObject(record.settingsJson, { strict: true, field: 'settingsJson' });
      normalizeAssignmentTokens(record.assignmentJson);
      await requireModuleConfiguration({ ...record, ...input });
      // Patches sem mudança de posição preservam módulos cujo template foi
      // removido/desativado. Criar/duplicar ou mover exige uma declaração atual.
      if (patch.position !== undefined && patch.position !== record.position) await validatePosition(patch.position);
      const normalized = dropUnprovisionedDefaults(patch, record, MODULE_V2_DEFAULTS);
      return requireRepository(repositories, 'moduleInstances').update(id, normalized, { etag: options.etag });
    }
  };

  const siteConfig = {
      defaults: initialDefaults,
      /*
       * Achado real (validado contra o tenant real): o
       * `createRepository.findMany()` do SPMIDDLE (data-core) nunca anexa
       * `etag` aos itens — só `findById`/`create`/`update` fazem isso
       * (ver result() em packages/data-core/src/repository.js). Por isso
       * esta função localiza a linha única via findMany() (que só serve
       * para achar o id, já que a lista nunca tem mais de uma linha por
       * convenção), mas relê o etag confiável via findById() antes de
       * devolver — nunca confia no etag (inexistente) do item de
       * findMany(). Sem essa releitura, qualquer update() subsequente
       * falharia com "etag é obrigatório" ou, peor, um etag indefinido
       * seria silenciosamente aceito como string vazia.
       */
      async get() {
        const repository = requireRepository(repositories, 'siteConfig');
        const rows = await listAll(repository);
        if (rows.length > 1) throw new ValidationError('Há configurações de site duplicadas. Nenhum registro foi escolhido ou alterado.');
        if (!rows.length) return null;
        return repository.findById(rows[0].id);
      },
      /* Upsert por linha única: cria se a lista estiver vazia, senão exige etag e atualiza a linha existente (mesma exigência de concorrência otimista do resto do painel). */
      async save(input, { etag } = {}) {
        const repository = requireRepository(repositories, 'siteConfig');
        const operationalInput = { ...input };
        for (const field of ['metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles']) delete operationalInput[field];
        const rows = await listAll(repository);
        if (rows.length > 1) throw new ValidationError('Há configurações de site duplicadas. Nenhum registro foi escolhido ou alterado.');
        if (rows.length) requireEtag(etag, 'etag da configuração');
        const record = rows.length ? await repository.findById(rows[0].id) : null;
        const definitionsByKey = input.templateStylesJson === undefined ? undefined : Object.fromEntries((repositories.templates
          ? await listAll(requireRepository(repositories, 'templates')) : []).filter((row) => !BUILTIN_TEMPLATES.includes(row.key))
          .map((row) => [row.key, readTemplateMetadata(row).definitions]));
        const normalized = { ...(!record ? initialDefaults : undefined), ...normalizeSiteConfigInput(operationalInput, { homeView: record?.homeView ?? initialDefaults?.homeView, definitionsByKey }) };
        if (input.homeView !== undefined || input.homeCategory !== undefined) createConfig({
          homeView: normalized.homeView ?? record?.homeView ?? initialDefaults?.homeView,
          homeCategory: normalized.homeCategory ?? record?.homeCategory ?? initialDefaults?.homeCategory
        });
        if (normalized.templateKey && !BUILTIN_TEMPLATES.includes(normalized.templateKey)) {
          const templates = repositories.templates ? await listAll(requireRepository(repositories, 'templates')) : [];
          if (!templates.some((row) => row.key === normalized.templateKey && row.enabled)) throw new ValidationError('templateKey deve identificar um template integrado ou habilitado.');
        }
        for (const field of ['metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles']) {
          const existing = field === 'sitenamePagetitles' ? record?.[field] || 'none' : record?.[field] ?? '';
          if (input[field] !== undefined && optionalText(input[field]) !== existing) throw new ValidationError('Metadados e SEO indisponíveis: não há contrato para alterar os metadados globais do host. Os valores existentes foram preservados.');
        }
        if (!rows.length) return repository.create({ ...dropUnprovisionedDefaults(normalized, null, SITE_CONFIG_V2_DEFAULTS), ...(initialDefaults ? initialSiteFields(normalized) : undefined) });
        return repository.update(rows[0].id, dropUnprovisionedDefaults(normalized, record, SITE_CONFIG_V2_DEFAULTS), { etag });
      },
      toConfigOverrides: toSiteConfigOverrides
    };
  const administration = createExtensionAdministration({ repositories, extensions, moduleInstances, templates, siteConfig, listAll, requireRepository });
  Object.assign(moduleInstances, administration.modules);

  return Object.freeze({
    articles, categories, tags, menu, extensions, templates, moduleInstances, siteConfig,
    plugins: administration.plugins, templateStyles: administration.templateStyles, componentOptions: administration.componentOptions, installer: administration.installer,
    async overview() {
      const [articleRows, categoryRows, tagRows, menuRows, extensionRows, templateRows, instanceRows] = await Promise.all([
        listAll(requireRepository(repositories, 'articles')),
        listAll(requireRepository(repositories, 'categories')),
        listAll(requireRepository(repositories, 'tags')),
        listAll(requireRepository(repositories, 'menu')),
        listAll(requireRepository(repositories, 'extensions')),
        repositories.templates ? listAll(requireRepository(repositories, 'templates')) : Promise.resolve([]),
        listAll(requireRepository(repositories, 'moduleInstances'))
      ]);
      return {
        articles: articleRows.length, categories: categoryRows.length, tags: tagRows.length,
        menu: menuRows.length, extensions: extensionRows.length, templates: templateRows.length, moduleInstances: instanceRows.length,
        ...(await administration.overviewExtras())
      };
    }
  });
}
