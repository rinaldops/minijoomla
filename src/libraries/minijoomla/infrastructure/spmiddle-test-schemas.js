/*
 * Schemas SPMIDDLE de TESTE do MINIJOOMLA (locais, sem rede) — Parte 2.
 *
 * Variantes com nome de lista claramente marcado como teste
 * (`TesteMiniJoomla*`), usadas apenas para o fluxo de provisionamento
 * `inspect -> apply -> verify` contra o site de teste técnico corporativo
 * autorizado (`/teams/SAPScripting`), nunca contra uma lista de produção.
 *
 * Mesmos campos de `src/libraries/minijoomla/infrastructure/spmiddle-schemas.js` (produção),
 * só o nome lógico/da lista muda. Isso garante que o schema provisionado
 * remotamente seja estruturalmente idêntico ao já testado localmente em
 * `tests/spmiddle-integration.test.js`, sem reaproveitar o nome de lista
 * de produção em um teste.
 *
 * `defineListSchema` é puro: nunca provisiona nada e nunca faz requisição
 * de rede por si só (ver docs/adr/0003-schemas.md do SPMIDDLE).
 */
import { defineListSchema } from '../../../../../SPMIDDLE/packages/sharepoint-schema/src/index.js';

export const TesteMiniJoomlaArtigos = defineListSchema({
  key: 'teste-minijoomla-articles',
  internalName: 'TesteMiniJoomlaArtigos',
  displayName: 'TesteMiniJoomlaArtigos',
  template: 100,
  schemaVersion: 1,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Alias', displayName: 'Alias', type: 'Text', required: true },
    { internalName: 'Introtext', displayName: 'Introtext', type: 'MultilineText' },
    { internalName: 'Fulltext', displayName: 'Fulltext', type: 'MultilineText' },
    { internalName: 'CategoryId', displayName: 'CategoryId', type: 'Number' },
    { internalName: 'State', displayName: 'State', type: 'Choice', choices: ['Published', 'Draft', 'Archived'], defaultValue: 'Published' },
    { internalName: 'Featured', displayName: 'Featured', type: 'Boolean', defaultValue: false },
    { internalName: 'PublishUp', displayName: 'PublishUp', type: 'DateTime' },
    { internalName: 'PublishDown', displayName: 'PublishDown', type: 'DateTime' },
    { internalName: 'Author', displayName: 'Author', type: 'Text' },
    { internalName: 'AuthorAlias', displayName: 'AuthorAlias', type: 'Text' },
    { internalName: 'Language', displayName: 'Language', type: 'Text' },
    { internalName: 'Note', displayName: 'Note', type: 'MultilineText' },
    { internalName: 'VersionNote', displayName: 'VersionNote', type: 'MultilineText' },
    { internalName: 'FeaturedUp', displayName: 'FeaturedUp', type: 'DateTime' },
    { internalName: 'FeaturedDown', displayName: 'FeaturedDown', type: 'DateTime' },
    { internalName: 'MetaDescription', displayName: 'MetaDescription', type: 'MultilineText' },
    { internalName: 'MetaKeywords', displayName: 'MetaKeywords', type: 'MultilineText' },
    { internalName: 'AttribsJson', displayName: 'AttribsJson', type: 'MultilineText' },
    { internalName: 'Tags', displayName: 'Tags', type: 'Text' }
  ],
  indexes: [{ fields: ['Alias'], unique: true }]
});

export const TesteMiniJoomlaCategorias = defineListSchema({
  key: 'teste-minijoomla-categories',
  internalName: 'TesteMiniJoomlaCategorias',
  displayName: 'TesteMiniJoomlaCategorias',
  template: 100,
  schemaVersion: 1,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Alias', displayName: 'Alias', type: 'Text', required: true },
    { internalName: 'ParentId', displayName: 'ParentId', type: 'Number' },
    { internalName: 'Description', displayName: 'Description', type: 'MultilineText' }
  ],
  indexes: [{ fields: ['Alias'], unique: true }]
});

export const TesteMiniJoomlaTags = defineListSchema({
  key: 'teste-minijoomla-tags',
  internalName: 'TesteMiniJoomlaTags',
  displayName: 'TesteMiniJoomlaTags',
  template: 100,
  schemaVersion: 1,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Alias', displayName: 'Alias', type: 'Text' },
    { internalName: 'State', displayName: 'State', type: 'Choice', choices: ['Published', 'Unpublished'], defaultValue: 'Published' }
  ],
  indexes: [{ fields: ['Title'], unique: true }]
});

export const TesteMiniJoomlaMenu = defineListSchema({
  key: 'teste-minijoomla-menu',
  internalName: 'TesteMiniJoomlaMenu',
  displayName: 'TesteMiniJoomlaMenu',
  template: 100,
  schemaVersion: 1,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Path', displayName: 'Path', type: 'Text', required: true },
    { internalName: 'ParentId', displayName: 'ParentId', type: 'Number' },
    { internalName: 'Published', displayName: 'Published', type: 'Choice', choices: ['Published', 'Draft'], defaultValue: 'Published' },
    { internalName: 'Ordering', displayName: 'Ordering', type: 'Number' }
  ]
});

/*
 * Variantes de teste dos 3 schemas novos desta frente (extensões,
 * instâncias de módulo, configuração do site — ver
 * src/libraries/minijoomla/infrastructure/spmiddle-schemas.js para os equivalentes de
 * produção e a justificativa de cada campo).
 */
export const TesteMiniJoomlaExtensions = defineListSchema({
  key: 'teste-minijoomla-extensions',
  internalName: 'TesteMiniJoomlaExtensions',
  displayName: 'TesteMiniJoomlaExtensions',
  template: 100,
  schemaVersion: 2,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Key', displayName: 'Key', type: 'Text', required: true },
    { internalName: 'Type', displayName: 'Type', type: 'Choice', choices: ['Module', 'Plugin'], required: true },
    { internalName: 'EntryPointUrl', displayName: 'EntryPointUrl', type: 'Text', required: true },
    { internalName: 'DiscoveredFrom', displayName: 'DiscoveredFrom', type: 'Text' },
    { internalName: 'Enabled', displayName: 'Enabled', type: 'Boolean', defaultValue: true },
    { internalName: 'Ordering', displayName: 'Ordering', type: 'Number', defaultValue: 0 },
    { internalName: 'Folder', displayName: 'Folder', type: 'Text' },
    { internalName: 'ParamsJson', displayName: 'ParamsJson', type: 'MultilineText' },
    { internalName: 'ManifestJson', displayName: 'ManifestJson', type: 'MultilineText' }
  ],
  indexes: [{ fields: ['Key'], unique: true }]
});

export const TesteMiniJoomlaModuleInstances = defineListSchema({
  key: 'teste-minijoomla-module-instances',
  internalName: 'TesteMiniJoomlaModuleInstances',
  displayName: 'TesteMiniJoomlaModuleInstances',
  template: 100,
  schemaVersion: 2,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'ExtensionKey', displayName: 'ExtensionKey', type: 'Text', required: true },
    { internalName: 'Position', displayName: 'Position', type: 'Text', required: true, defaultValue: 'sidebar' },
    { internalName: 'Ordering', displayName: 'Ordering', type: 'Number', defaultValue: 0 },
    { internalName: 'SettingsJson', displayName: 'SettingsJson', type: 'MultilineText' },
    { internalName: 'Enabled', displayName: 'Enabled', type: 'Boolean', defaultValue: true },
    { internalName: 'ScopeKind', displayName: 'ScopeKind', type: 'Choice', choices: ['All', 'Route'], defaultValue: 'All' },
    { internalName: 'ScopeRoute', displayName: 'ScopeRoute', type: 'Text' },
    { internalName: 'ScopeCategoryAlias', displayName: 'ScopeCategoryAlias', type: 'Text' },
    { internalName: 'ShowTitle', displayName: 'ShowTitle', type: 'Boolean', defaultValue: true },
    { internalName: 'PublishUp', displayName: 'PublishUp', type: 'DateTime' },
    { internalName: 'PublishDown', displayName: 'PublishDown', type: 'DateTime' },
    { internalName: 'Trashed', displayName: 'Trashed', type: 'Boolean', defaultValue: false },
    { internalName: 'Assignment', displayName: 'Assignment', type: 'Choice', choices: ['all', 'none', 'only', 'except'], defaultValue: 'all' },
    { internalName: 'AssignmentJson', displayName: 'AssignmentJson', type: 'MultilineText' },
    { internalName: 'Note', displayName: 'Note', type: 'Text' }
  ]
});

export const TesteMiniJoomlaSiteConfig = defineListSchema({
  key: 'teste-minijoomla-site-config',
  internalName: 'TesteMiniJoomlaSiteConfig',
  displayName: 'TesteMiniJoomlaSiteConfig',
  template: 100,
  schemaVersion: 2,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true, defaultValue: 'TesteMiniJoomlaSiteConfig' },
    { internalName: 'SiteName', displayName: 'SiteName', type: 'Text' },
    { internalName: 'SiteDescription', displayName: 'SiteDescription', type: 'MultilineText' },
    { internalName: 'Language', displayName: 'Language', type: 'Text' },
    { internalName: 'Timezone', displayName: 'Timezone', type: 'Text' },
    { internalName: 'BasePath', displayName: 'BasePath', type: 'Text' },
    { internalName: 'PageSize', displayName: 'PageSize', type: 'Number' },
    { internalName: 'CustomHtmlTitle', displayName: 'CustomHtmlTitle', type: 'Text' },
    { internalName: 'CustomHtmlBody', displayName: 'CustomHtmlBody', type: 'MultilineText' },
    { internalName: 'Offline', displayName: 'Offline', type: 'Boolean', defaultValue: false },
    { internalName: 'OfflineMessage', displayName: 'OfflineMessage', type: 'MultilineText' },
    { internalName: 'MetaDescription', displayName: 'MetaDescription', type: 'MultilineText' },
    { internalName: 'MetaKeywords', displayName: 'MetaKeywords', type: 'MultilineText' },
    { internalName: 'Robots', displayName: 'Robots', type: 'Text' },
    { internalName: 'SitenamePagetitles', displayName: 'SitenamePagetitles', type: 'Choice', choices: ['none', 'before', 'after'], defaultValue: 'none' },
    { internalName: 'HomeView', displayName: 'HomeView', type: 'Choice', choices: ['category', 'featured'], defaultValue: 'category' },
    { internalName: 'HomeCategory', displayName: 'HomeCategory', type: 'Text' },
    { internalName: 'TemplateStylesJson', displayName: 'TemplateStylesJson', type: 'MultilineText' },
    { internalName: 'ComponentParamsJson', displayName: 'ComponentParamsJson', type: 'MultilineText' }
  ]
});

/* Mapa de domínios de teste, usado só pelos scripts de provisionamento da Parte 2. */
export const MINIJOOMLA_TEST_SCHEMAS = Object.freeze({
  articles: TesteMiniJoomlaArtigos,
  categories: TesteMiniJoomlaCategorias,
  tags: TesteMiniJoomlaTags,
  menu: TesteMiniJoomlaMenu,
  extensions: TesteMiniJoomlaExtensions,
  moduleInstances: TesteMiniJoomlaModuleInstances,
  siteConfig: TesteMiniJoomlaSiteConfig
});
