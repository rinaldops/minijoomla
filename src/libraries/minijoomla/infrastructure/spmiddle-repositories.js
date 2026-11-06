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
    const mapper = createMapper({ mapping: MAPPINGS[domain] });
    repositories[domain] = createRepository({ source: domain, schema: MINIJOOMLA_SCHEMAS[domain], mapper, client });
  }
  return Object.freeze(repositories);
}

export const MINIJOOMLA_FIELD_MAPPINGS = MAPPINGS;
