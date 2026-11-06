/*
 * Repositories SPMIDDLE reais do MINIJOOMLA (sem rede neste módulo).
 *
 * Cada repositório é construído com `createMapper` + `createRepository` do
 * pacote `data-core` do SPMIDDLE, satisfazendo o mesmo formato de
 * `findMany(query, options)` que `createSPMiddleAdapter` já exige
 * (src/libraries/minijoomla/infrastructure/spmiddle-adapter.js). Este módulo não decide
 * transporte, URL ou credencial — recebe um `listClient` já resolvido pelo
 * registro de data sources (src/libraries/minijoomla/infrastructure/spmiddle-data-sources.js) e
 * só traduz nomes de campo. Nenhuma função aqui faz requisição por si só;
 * toda chamada de rede acontece dentro do `listClient` injetado.
 *
 * O mapeamento de campos usa os mesmos nomes de domínio de
 * DEFAULT_FIELDS em spmiddle-adapter.js (id, title, alias, introtext,
 * fulltext, categoryId, state, featured, publishUp, publishDown, author,
 * tags para artigo; equivalentes para categoria/tag/menu), para que o
 * adapter continue funcionando sem qualquer alteração.
 */
import { createMapper, createRepository } from '../../../../../SPMIDDLE/packages/data-core/src/index.js';
import { MINIJOOMLA_SCHEMAS } from './spmiddle-schemas.js';
import { ValidationError } from '../core/contracts.js';
import { parseJsonObject } from '../application/declared-params.js';

/*
 * Toda lista SharePoint já tem `Author` (Created By, tipo User), que não
 * aceita o texto editorial. Listas existentes usam `Author0` (Text,
 * rótulo Author), nome antes obtido por colisão na criação. O schema agora
 * declara Author0 explicitamente: listas novas usam o mesmo contrato sem
 * depender de renomeação automática, e listas existentes não precisam de
 * migração de dados. `Title`, ao contrário, reutiliza o campo Text nativo;
 * eventuais Title0 legados não são lidos nem gravados por este mapper.
 */
const ARTICLE_MAPPING = {
  id: { internalName: 'Id', readOnly: true },
  title: { internalName: 'Title', required: true },
  alias: { internalName: 'Alias', required: true },
  introtext: 'Introtext',
  fulltext: 'Fulltext',
  categoryId: 'CategoryId',
  state: 'State',
  featured: 'Featured',
  publishUp: 'PublishUp',
  publishDown: 'PublishDown',
  author: 'Author0',
  authorAlias: 'AuthorAlias',
  language: 'Language',
  note: 'Note',
  versionNote: 'VersionNote',
  featuredUp: 'FeaturedUp',
  featuredDown: 'FeaturedDown',
  metaDescription: 'MetaDescription',
  metaKeywords: 'MetaKeywords',
  attribsJson: 'AttribsJson',
  tags: 'Tags',
  // Colunas de sistema do SharePoint: somente leitura (exibidas no formulário).
  created: { internalName: 'Created', readOnly: true },
  modified: { internalName: 'Modified', readOnly: true }
};

const CATEGORY_MAPPING = {
  id: { internalName: 'Id', readOnly: true },
  title: { internalName: 'Title', required: true },
  alias: { internalName: 'Alias', required: true },
  parentId: 'ParentId',
  description: 'Description',
  state: 'State'
};

const TAG_MAPPING = {
  id: { internalName: 'Id', readOnly: true },
  name: { internalName: 'Title', required: true },
  alias: 'Alias',
  state: 'State',
  description: 'Description',
  parentId: 'ParentId'
};

const MENU_MAPPING = {
  id: { internalName: 'Id', readOnly: true },
  title: { internalName: 'Title', required: true },
  path: { internalName: 'Path', required: true },
  parentId: 'ParentId',
  published: 'Published',
  ordering: 'Ordering'
};

const EXTENSION_MAPPING = {
  id: { internalName: 'Id', readOnly: true },
  title: { internalName: 'Title', required: true },
  key: { internalName: 'Key', required: true },
  type: { internalName: 'Type', required: true },
  entryPointUrl: { internalName: 'EntryPointUrl', required: true },
  discoveredFrom: 'DiscoveredFrom',
  enabled: 'Enabled',
  ordering: 'Ordering',
  folder: 'Folder',
  paramsJson: 'ParamsJson',
  manifestJson: 'ManifestJson'
};

const TEMPLATE_MAPPING = {
  id: { internalName: 'Id', readOnly: true }, title: { internalName: 'Title', required: true },
  key: { internalName: 'Key', required: true }, version: { internalName: 'Version', required: true },
  entryPointUrl: { internalName: 'EntryPointUrl', required: true }, styles: 'Styles',
  positionsJson: 'PositionsJson', discoveredFrom: 'DiscoveredFrom', enabled: 'Enabled'
};

const MODULE_INSTANCE_MAPPING = {
  id: { internalName: 'Id', readOnly: true },
  title: { internalName: 'Title', required: true },
  extensionKey: { internalName: 'ExtensionKey', required: true },
  position: { internalName: 'Position', required: true },
  ordering: 'Ordering',
  settingsJson: 'SettingsJson',
  enabled: 'Enabled',
  scopeKind: 'ScopeKind',
  scopeRoute: 'ScopeRoute',
  scopeCategoryAlias: 'ScopeCategoryAlias',
  showTitle: 'ShowTitle',
  publishUp: 'PublishUp',
  publishDown: 'PublishDown',
  trashed: 'Trashed',
  assignment: 'Assignment',
  assignmentJson: 'AssignmentJson',
  note: 'Note'
};

const SITE_CONFIG_MAPPING = {
  id: { internalName: 'Id', readOnly: true },
  title: { internalName: 'Title', required: true },
  siteName: 'SiteName', templateKey: 'TemplateKey',
  siteDescription: 'SiteDescription',
  language: 'Language',
  timezone: 'Timezone',
  basePath: 'BasePath',
  pageSize: 'PageSize',
  customHtmlTitle: 'CustomHtmlTitle',
  customHtmlBody: 'CustomHtmlBody',
  offline: 'Offline',
  offlineMessage: 'OfflineMessage',
  metaDescription: 'MetaDescription',
  metaKeywords: 'MetaKeywords',
  robots: 'Robots',
  sitenamePagetitles: 'SitenamePagetitles',
  homeView: 'HomeView',
  homeCategory: 'HomeCategory',
  templateStylesJson: 'TemplateStylesJson',
  componentParamsJson: 'ComponentParamsJson'
};

const MAPPINGS = Object.freeze({
  articles: ARTICLE_MAPPING,
  categories: CATEGORY_MAPPING,
  tags: TAG_MAPPING,
  menu: MENU_MAPPING,
  extensions: EXTENSION_MAPPING,
  templates: TEMPLATE_MAPPING,
  moduleInstances: MODULE_INSTANCE_MAPPING,
  siteConfig: SITE_CONFIG_MAPPING
});

function storedGroup(value, field) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(value.trim())) throw new ValidationError(`${field} (grupo de plugin) inválido. Nenhum dado foi alterado.`);
  return value.trim();
}

const LEGACY_FOLDER = Symbol('legacyFolder');

/* Folder é uma navegação SP.Folder no REST, mesmo quando a lista possui
 * FolderText. Mantenha o mapping legado para leitura; nunca envie Folder.
 * O grupo lógico usa ManifestJson, sem nova coluna nem migração implícita.
 * Um patch de folder exige manifesto explícito: só o serviço tem a linha
 * atual + ETag para mesclá-lo sem substituir metadados por um objeto novo.
 */
function extensionStorageMapper(mapper) {
  function mapWrite(input, partial) {
    // Preserve as validações reais de campos desconhecidos/readOnly/required.
    // JSON objeto cru não passa pelo clone do mapper (setter __proto__).
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('input deve ser um objeto.');
    const safe = { ...input };
    if (safe.folder !== undefined) storedGroup(safe.folder, 'folder');
    if (safe.paramsJson && typeof safe.paramsJson === 'object') safe.paramsJson = JSON.stringify(parseJsonObject(safe.paramsJson, { strict: true, field: 'paramsJson' }));
    if (safe.manifestJson !== undefined && safe.manifestJson !== null && safe.manifestJson !== '') {
      const manifest = parseJsonObject(safe.manifestJson, { strict: true, field: 'manifestJson' });
      if (safe.type === 'Plugin') storedGroup(manifest.group, 'manifest.group');
      if (typeof safe.manifestJson !== 'string') safe.manifestJson = JSON.stringify(manifest);
    }
    const wire = partial ? mapper.mapUpdate(safe) : mapper.mapCreate(safe);
    if (Object.hasOwn(wire, 'Folder')) {
      const folder = storedGroup(wire.Folder, 'folder');
      if (partial && !Object.hasOwn(wire, 'ManifestJson')) throw new ValidationError('Alterar folder exige o manifesto atual mesclado e ETag; use extensions.update do serviço administrativo.');
      const manifest = parseJsonObject(wire.ManifestJson, { strict: true, field: 'manifestJson' });
      // Empty folder means no override: use the declared manifest group.
      // Clearing an installed group requires an explicit manifest.group change.
      if (safe.type !== 'Module' && folder && storedGroup(manifest.group, 'manifest.group') !== folder) wire.ManifestJson = JSON.stringify({ ...manifest, group: folder });
      delete wire.Folder;
    }
    return wire;
  }

  return Object.freeze({
    ...mapper,
    mapCreate: (input) => mapWrite(input, false),
    mapUpdate: (input) => mapWrite(input, true),
    mapInput: (input, options = {}) => mapWrite(input, options.partial === true),
    mapItem(raw) {
      const item = raw?.d?.results ?? raw?.d ?? raw;
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('item deve ser um objeto.');
      const safe = { ...item };
      const manifest = parseJsonObject(safe.ManifestJson, { strict: true, field: 'manifestJson' });
      const group = safe.Type === 'Plugin' ? storedGroup(manifest.group, 'manifest.group') : '';
      // Navegação não é grupo. Um Folder string legado, inclusive inválido,
      // continua visível para validação e tem precedência sobre o manifesto.
      if (safe.Folder && typeof safe.Folder === 'object' && !Array.isArray(safe.Folder)) delete safe.Folder;
      storedGroup(safe.Folder, 'folder');
      if (safe.ManifestJson && typeof safe.ManifestJson === 'object') safe.ManifestJson = JSON.stringify(manifest);
      if (safe.ParamsJson && typeof safe.ParamsJson === 'object') safe.ParamsJson = JSON.stringify(parseJsonObject(safe.ParamsJson, { strict: true, field: 'paramsJson' }));
      const row = mapper.mapItem(safe);
      if (typeof safe.Folder === 'string' && safe.Folder.trim()) Object.defineProperty(row, LEGACY_FOLDER, { value: safe.Folder.trim() });
      if ((row.folder === undefined || row.folder === null || row.folder === '') && group) row.folder = group;
      return row;
    }
  });
}

/*
 * `dataSources` é o objeto retornado por `createMiniJoomlaDataSources`
 * (spmiddle-data-sources.js). Apenas domínios presentes em
 * `dataSources.domains` recebem um repositório; os demais ficam de fora do
 * resultado (o chamador decide se isso é aceitável — por exemplo, o adapter
 * trata `tagRepository`/`menuRepository` ausentes como opcionais).
 */
export function createMiniJoomlaSPMiddleRepositories(dataSources) {
  if (!dataSources || typeof dataSources.getListClient !== 'function') {
    throw new TypeError('dataSources deve ser o resultado de createMiniJoomlaDataSources.');
  }
  const repositories = {};
  for (const domain of dataSources.domains) {
    const client = dataSources.getListClient(domain);
    if (!client) continue;
    const baseMapper = createMapper({ mapping: MAPPINGS[domain] });
    const mapper = domain === 'extensions' ? extensionStorageMapper(baseMapper) : baseMapper;
    const repository = createRepository({ source: domain, schema: MINIJOOMLA_SCHEMAS[domain], mapper, client });
    repositories[domain] = domain !== 'extensions' ? repository : Object.freeze({
      ...repository,
      async update(id, input, options = {}) {
        if (Object.hasOwn(input, 'folder') && input.folder !== undefined) {
          // Valide o patch antes de qualquer I/O. A releitura só verifica a
          // precedência legada; o ETag original nunca é trocado pelo atual.
          if (typeof options.etag !== 'string' || !options.etag.trim() || options.etag.trim() === '*') throw new ValidationError('etag específico é obrigatório.');
          mapper.mapUpdate(input);
          const current = await repository.findById(id);
          if (current[LEGACY_FOLDER] && current[LEGACY_FOLDER] !== storedGroup(input.folder, 'folder')) throw new ValidationError('folder textual legado tem precedência e não pode ser alterado pela propriedade REST reservada Folder. Nenhum dado foi alterado.');
        }
        return repository.update(id, input, options);
      }
    });
  }
  return Object.freeze(repositories);
}

export const MINIJOOMLA_FIELD_MAPPINGS = MAPPINGS;
