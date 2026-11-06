/*
 * Schemas SPMIDDLE próprios do MINIJOOMLA (locais, sem rede).
 *
 * Usa `defineListSchema` do pacote `sharepoint-schema` do SPMIDDLE para
 * declarar o formato das listas que o MINIJOOMLA precisa: artigos,
 * categorias, tags e menu. Os nomes lógicos (`key`/`internalName`/
 * `displayName`) pertencem ao MINIJOOMLA — não reaproveitam `MSEContent`,
 * `MSECategories` ou qualquer outro nome de outro consumidor do SPMIDDLE.
 *
 * `defineListSchema` é puro: definir um schema aqui nunca provisiona nada e
 * nunca faz uma requisição de rede (ver docs/adr/0003-schemas.md do
 * SPMIDDLE). O `categoryId`/`parentId` são modelados como `Number` (chave
 * estrangeira simples, no estilo Joomla), não como `Lookup` do SharePoint,
 * para manter o schema deste consumidor independente da existência de
 * qualquer outra lista.
 */
import { defineListSchema } from '../../../../../SPMIDDLE/packages/sharepoint-schema/src/index.js';

export const MiniJoomlaArticles = defineListSchema({
  key: 'minijoomla-articles',
  internalName: 'MiniJoomlaArticles',
  displayName: 'MiniJoomlaArticles',
  template: 100,
  schemaVersion: 1,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Alias', displayName: 'Alias', type: 'Text', required: true },
    { internalName: 'Introtext', displayName: 'Introtext', type: 'MultilineText' },
    { internalName: 'Fulltext', displayName: 'Fulltext', type: 'MultilineText' },
    { internalName: 'CategoryId', displayName: 'CategoryId', type: 'Number' },
    { internalName: 'State', displayName: 'State', type: 'Choice', choices: ['Published', 'Draft', 'Archived', 'Trashed'], defaultValue: 'Published' },
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

export const MiniJoomlaCategories = defineListSchema({
  key: 'minijoomla-categories',
  internalName: 'MiniJoomlaCategories',
  displayName: 'MiniJoomlaCategories',
  template: 100,
  schemaVersion: 2,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Alias', displayName: 'Alias', type: 'Text', required: true },
    { internalName: 'ParentId', displayName: 'ParentId', type: 'Number' },
    { internalName: 'Description', displayName: 'Description', type: 'MultilineText' },
    // v2: ausente em listas legadas = Published (ver dropUnprovisionedDefaults em admin-service.js).
    { internalName: 'State', displayName: 'State', type: 'Choice', choices: ['Published', 'Unpublished', 'Trashed'], defaultValue: 'Published' }
  ],
  indexes: [{ fields: ['Alias'], unique: true }]
});

export const MiniJoomlaTags = defineListSchema({
  key: 'minijoomla-tags',
  internalName: 'MiniJoomlaTags',
  displayName: 'MiniJoomlaTags',
  template: 100,
  schemaVersion: 2,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Alias', displayName: 'Alias', type: 'Text' },
    { internalName: 'State', displayName: 'State', type: 'Choice', choices: ['Published', 'Unpublished', 'Trashed'], defaultValue: 'Published' },
    { internalName: 'Description', displayName: 'Description', type: 'MultilineText' },
    { internalName: 'ParentId', displayName: 'ParentId', type: 'Number' }
  ],
  indexes: [{ fields: ['Title'], unique: true }]
});

export const MiniJoomlaMenu = defineListSchema({
  key: 'minijoomla-menu',
  internalName: 'MiniJoomlaMenu',
  displayName: 'MiniJoomlaMenu',
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
 * Registro de extensões descobertas (equivalente a `#__extensions` do
 * Joomla, restrito ao que o MINIJOOMLA de fato suporta hoje: módulos e
 * plugins — nunca componentes/rotas novas, nunca upload de código).
 *
 * `EntryPointUrl` é a URL (relativa ao WEB_URL da composição) do módulo ES
 * que exporta o contrato esperado pelo tipo:
 *   - type=Module: exporta `{ name, settingsSchema?, settings, render }`
 *     (mesmo contrato de src/libraries/minijoomla/modules/content-runtime.js).
 *   - type=Plugin: exporta `{ name, events }` (mesmo contrato de
 *     src/libraries/minijoomla/plugins/manager.js, register()).
 *
 * `DiscoveredFrom` registra o caminho relativo (dentro da pasta de
 * extensões, ver EXTENSIONS_FOLDER_SEGMENT) de onde o manifesto foi lido
 * no momento do registro — só para auditoria/exibição no painel
 * "Extensões"; o runtime usa exclusivamente EntryPointUrl.
 */
export const MiniJoomlaExtensions = defineListSchema({
  key: 'minijoomla-extensions',
  internalName: 'MiniJoomlaExtensions',
  displayName: 'MiniJoomlaExtensions',
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

export const MiniJoomlaTemplates = defineListSchema({
  key: 'minijoomla-templates', internalName: 'MiniJoomlaTemplates', displayName: 'MiniJoomlaTemplates', template: 100, schemaVersion: 1,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
    { internalName: 'Key', displayName: 'Key', type: 'Text', required: true },
    { internalName: 'Version', displayName: 'Version', type: 'Text', required: true },
    { internalName: 'EntryPointUrl', displayName: 'EntryPointUrl', type: 'Text', required: true },
    { internalName: 'Styles', displayName: 'Styles', type: 'MultilineText' },
    { internalName: 'PositionsJson', displayName: 'PositionsJson', type: 'MultilineText' },
    { internalName: 'DiscoveredFrom', displayName: 'DiscoveredFrom', type: 'Text' },
    { internalName: 'Enabled', displayName: 'Enabled', type: 'Boolean', defaultValue: true }
  ], indexes: [{ fields: ['Key'], unique: true }]
});

/*
 * Instâncias de módulo (equivalente a `#__modules`), permitindo que o
 * MESMO módulo/extensão (ExtensionKey) tenha várias instâncias
 * independentes, cada uma com seu próprio título, posição, ordem e
 * `SettingsJson` (ex.: duas instâncias de "artigos recentes" com `limit`
 * diferente), e cada uma escopada a onde aparece (equivalente a
 * `#__modules_menu`, achatado em dois campos em vez de uma tabela de
 * associação separada, porque hoje a única granularidade que o MINIJOOMLA
 * precisa é rota + opcionalmente alias de categoria — nunca uma lista
 * arbitrária de páginas como o Joomla real permite).
 *
 * `ScopeKind`:
 *   - 'All': aparece em todas as rotas que renderizam a posição
 *     (comportamento idêntico ao já existente antes desta mudança).
 *   - 'Route': aparece só na rota `ScopeRoute` (`home`/`category`/
 *     `article`/`search`/`archive`); se `ScopeRoute` for `category` e
 *     `ScopeCategoryAlias` estiver preenchido, restringe ainda mais à
 *     categoria daquele alias.
 */
export const MiniJoomlaModuleInstances = defineListSchema({
  key: 'minijoomla-module-instances',
  internalName: 'MiniJoomlaModuleInstances',
  displayName: 'MiniJoomlaModuleInstances',
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

/*
 * Configuração do site (equivalente a `com_config`/`configuration.php` do
 * Joomla), persistida como linha única — convenção: sempre `Id = 1`,
 * criada/atualizada via upsert no serviço de aplicação
 * (src/libraries/minijoomla/application/site-config-service.js), nunca por `create` direto com
 * um id arbitrário. Os nomes de campo espelham exatamente as chaves já
 * aceitas por `createConfig` (src/libraries/minijoomla/core/config.js): siteName,
 * siteDescription, language, timezone, basePath, pageSize, customHtml
 * (achatado em dois campos de texto, já que é um objeto `{title, html}`
 * pequeno e opcional).
 */
export const MiniJoomlaSiteConfig = defineListSchema({
  key: 'minijoomla-site-config',
  internalName: 'MiniJoomlaSiteConfig',
  displayName: 'MiniJoomlaSiteConfig',
  template: 100,
  schemaVersion: 2,
  fields: [
    { internalName: 'Title', displayName: 'Title', type: 'Text', required: true, defaultValue: 'MiniJoomlaSiteConfig' },
    { internalName: 'SiteName', displayName: 'SiteName', type: 'Text' },
    { internalName: 'TemplateKey', displayName: 'TemplateKey', type: 'Text' },
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

/* Mapa de domínios usado por spmiddle-data-sources.js e spmiddle-repositories.js. */
export const MINIJOOMLA_SCHEMAS = Object.freeze({
  articles: MiniJoomlaArticles,
  categories: MiniJoomlaCategories,
  tags: MiniJoomlaTags,
  menu: MiniJoomlaMenu,
  extensions: MiniJoomlaExtensions,
  templates: MiniJoomlaTemplates,
  moduleInstances: MiniJoomlaModuleInstances,
  siteConfig: MiniJoomlaSiteConfig
});
