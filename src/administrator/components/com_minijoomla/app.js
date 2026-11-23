/*
 * Aplicação do painel administrativo do MINIJOOMLA (equivalente ao
 * administrator/ do Joomla real — ver decisão registrada na conversa
 * desta frente sobre escopo: cobre com_content/com_categories/
 * com_tags/com_menus/com_config/com_modules; com_installer cobre somente
 * descoberta/registro de metadados, nunca upload de código, com_users/ACL
 * ou extensões de infraestrutura sem
 * equivalente no domínio atual do MINIJOOMLA).
 *
 * Roteamento próprio (não reaproveita src/index.js nem a instância
 * pública de createApplication — este é um app separado, com seu
 * próprio `documentRef`/contêiner, tipicamente montado numa página
 * admin dedicada, nunca na mesma página pública dos visitantes):
 *
 *   #/              -> painel de controle (overview + link p/ cada domínio)
 *   #/<domain>      -> listagem (domain em DOMAIN_KEYS)
 *   #/<domain>/new  -> formulário de criação
 *   #/<domain>/<id> -> formulário de edição
 *   #/config        -> configuração do site (linha única)
 *   #/extensions/discover -> extensões encontradas na pasta, ainda não registradas
 *
 * `adminService`/`discoveryService` são injetados (resultado de
 * createAdminService/createExtensionDiscoveryService) — este módulo não
 * monta a composição SPMIDDLE por si só, assim como src/index.js não
 * monta createMiniJoomlaSharePointApp.
 *
 * Layout: toda rota é desenhada dentro de renderAdminShell (header +
 * sidebar de navegação + toolbar sticky com título/breadcrumb/ações),
 * inspirado na estrutura visual real do administrator/ do Joomla (nunca
 * uma cópia literal de PHP/SCSS) — ver src/administrator/templates/atum/index.js e
 * src/media/templates/administrator/atum/css/template.css.
 */
import { Router } from '../../../libraries/minijoomla/core/router.js';
import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { ADMIN_DOMAINS, SITE_CONFIG_FIELDS, ARTICLE_EDITOR_LAYOUT, ARTICLE_OPTION_FIELDS, ARTICLE_IMAGE_FIELDS, ARTICLE_LINK_FIELDS } from './field-schemas.js';
import { toArticleFormValues, prepareArticleFormValues } from '../com_content/src/Model/article.js';
import { createContentPages } from './content-pages.js';
import { MENU_TYPES, buildMenuPath, toMenuFormValues, menuTypeOptions, prepareMenuFormValues } from '../com_menus/src/Model/menu-item.js';
import { MEDIA_MIME_TYPES, MEDIA_MAX_BYTES } from '../../../libraries/minijoomla/application/media-upload-service.js';
import { analyzeArticleAccessibility } from './article-accessibility.js';
import { renderConfigPage } from '../com_config/tmpl/application/default.js';
import { loadExtensionDiscoveryPage } from '../com_installer/src/Controller/discover.js';
import { loadExtensionRootsPage } from '../com_installer/src/Controller/roots.js';
import { loadTemplateDiscoveryPage } from '../com_templates/src/Controller/discover.js';
import { loadTemplateRevisionPage } from '../com_templates/template-revision-page.js';
import { loadSampleDataPage } from '../../modules/mod_sampledata/mod_sampledata.js';
import { renderAdminForm, readAdminFormValues } from './render-form.js';
import { renderArticleAdminForm } from '../com_content/tmpl/article/edit.js';
import { renderAdminList, renderCategoryCounts, renderCategoryLegend } from './render-list.js';
import { renderAdminShell } from '../../templates/atum/index.js';
import { ADMIN_CAPABILITIES, managementFilters, filterManagementRows, renderCapabilities, renderManagementActions, renderNativeComponents } from './extension-management.js';
import { BUILTIN_MODULE_KEYS } from '../../../libraries/minijoomla/application/extension-input.js';
import { createExtensionPages, EXTENSION_OVERVIEW_ITEMS, MODULE_INSTANCE_COUNT_DESCRIPTION, renderModuleInstanceHelp } from './extension-pages.js';
import { rememberListFilters, recallListFilters } from './list-memory.js';
import { columnsForDomain, parseMulti, canonicalizeParams, bindColumnFilters } from './column-filter.js';
import { dashboardIcon, articleIcon, categoryIcon, tagIcon, menuIcon, moduleIcon, pluginIcon, configIcon, searchIcon, backIcon, plusIcon, trashIcon, desktopIcon, imageIcon } from './icons.js';

const DOMAIN_KEYS = Object.keys(ADMIN_DOMAINS);
const LIST_COLUMNS = {
  articles: ['title', 'alias', 'featured', 'state'],
  categories: ['title', 'alias', 'counts'],
  tags: ['name', 'alias', 'state'],
  menu: ['title', 'path', 'published'],
  extensions: ['title', 'key', 'type', 'enabled'],
  templates: ['title', 'key', 'version', 'enabled'],
  moduleInstances: ['title', 'extensionKey', 'position', 'ordering', 'scopeKind', 'scopeRoute', 'enabled']
};
const COLUMN_LABELS = { version: 'Versão', title: 'Título', alias: 'Alias', featured: 'Destaque', state: 'Estado', name: 'Nome', path: 'Caminho', published: 'Publicado', key: 'Chave', type: 'Tipo', enabled: 'Habilitado', extensionKey: 'Tipo de módulo', position: 'Posição', ordering: 'Ordem', scopeKind: 'Escopo', scopeRoute: 'Rota', counts: 'Artigos' };
// Presentation-only overrides: shared schemas, filters and persisted enums stay unchanged.
const DOMAIN_LABELS = { moduleInstances: 'Módulos do site', extensions: 'Extensões registradas' };
const EXTENSION_TYPE_LABELS = { Module: 'Módulo', Plugin: 'Plugin' };
const extensionTypeLabel = (type) => Object.hasOwn(EXTENSION_TYPE_LABELS, type) ? EXTENSION_TYPE_LABELS[type] : type;
const domainLabel = (domain) => DOMAIN_LABELS[domain] ?? ADMIN_DOMAINS[domain].label;
export { ARTICLE_URL_PATTERN as ADMIN_URL_PATTERN } from '../com_content/src/Model/article.js';

const EXTENSION_COUNT_DESCRIPTION = 'Registros de módulos e plugins, habilitados ou desabilitados; não conta instâncias nem tipos nativos sem registro.';

/*
 * Estrutura REAL da árvore da sidebar — ver
 * web-devs/JOOMLA/administrator/components/com_menus/presets/default.xml
 * (grupos "Conteúdo"/icon file-alt com Article+Category Manager,
 * "Menus"/icon list, "Componentes"/icon puzzle-piece como container) e
 * system.xml (grupo "Sistema"/icon wrench contendo com_config). Achado
 * real de divergência estrutural (confirmado pelo usuário comparando
 * com um Joomla 6.2.0 real): a sidebar NUNCA é uma lista plana de
 * domínios no mesmo nível — é uma árvore de 2 níveis, com cada grupo
 * expansível (exceto "Painel de controle", que é um item solto, sem
 * filhos, igual ao item raiz "index.php" do preset real).
 *
 * `com_tags` não aparece no preset `default.xml` do menu real (só tem
 * `<menu link="option=com_tags">com_tags</menu>` em tags.xml, sem
 * entrada em mod_menu) — por isso "Tags" entra no grupo "Componentes"
 * (container genérico), nunca em "Conteúdo", replicando a divergência
 * real confirmada pelo usuário no site dele.
 */
const SIDEBAR_GROUPS = [
  { key: 'home', label: 'Painel de controle', icon: dashboardIcon() },
  { key: 'content', label: 'Conteúdo', icon: articleIcon(), items: [
    { key: 'articles', label: 'Artigos', icon: articleIcon() },
    { key: 'categories', label: 'Categorias', icon: categoryIcon() },
    { key: 'media', label: 'Mídia', icon: imageIcon() }
  ] },
  { key: 'menus', label: 'Menus', icon: menuIcon(), items: [
    { key: 'menu', label: 'Todos os itens de menu', icon: menuIcon() }
  ] },
  { key: 'components', label: 'Componentes', icon: pluginIcon(), items: [
    { key: 'nativeComponents', label: 'Componentes nativos', icon: pluginIcon() },
    { key: 'tags', label: 'Tags', icon: tagIcon() },
    { key: 'templates', label: 'Templates', icon: pluginIcon(), href: '' },
    { key: 'templateStyles', label: 'Estilos de template', icon: desktopIcon() },
    { key: 'moduleInstances', label: 'Módulos do site', icon: moduleIcon() },
    { key: 'extensions', label: 'Extensões registradas', icon: pluginIcon() },
    { key: 'plugins', label: 'Plugins', icon: pluginIcon() },
    { key: 'installer', label: 'Gerenciar extensões', icon: pluginIcon() },
    { key: 'extensionRoots', label: 'Raízes de extensões', icon: configIcon() },
    { key: 'discoverExtensions', label: 'Descobrir extensões', icon: searchIcon() },
    { key: 'discoverTemplates', label: 'Descobrir templates', icon: searchIcon() },
    { key: 'templateRevision', label: 'Revisão de template', icon: desktopIcon() }
  ] },
  { key: 'system', label: 'Sistema', icon: configIcon(), items: [
    { key: 'config', label: 'Configuração', icon: configIcon() },
    { key: 'sampleData', label: 'Dados de exemplo', icon: articleIcon() },
    { key: 'componentOptions', label: 'Opções dos componentes', icon: configIcon() }
  ] }
];

/*
 * Regra da sidebar: cada link do menu carrega a última query lembrada da
 * listagem de destino (`recallListFilters`) já embutida no href. Assim o
 * clique no menu chega sempre como parâmetro explícito, sem depender de
 * interceptar o clique nem de saber a origem da navegação — o mesmo
 * caminho usado por qualquer outro link com filtros. Voltar pelo menu
 * depois de sair de uma lista filtrada reaplica o filtro; a primeira
 * visita (sem memória) continua abrindo a lista limpa.
 */
function sidebarHref(key, link) {
  if (key === 'home') return link('/');
  if (key === 'config') return link('/config');
  if (key === 'sampleData') return link('/sampledata');
  if (key === 'nativeComponents') return link('/components');
  if (key === 'plugins') return link('/plugins');
  if (key === 'templateStyles') return link('/templates/styles');
  if (key === 'installer') return link('/installer');
  if (key === 'extensionRoots') return link('/installer/roots');
  if (key === 'componentOptions') return link('/options');
  if (key === 'discoverExtensions') return link('/extensions/discover');
  if (key === 'discoverTemplates') return link('/templates/discover');
  if (key === 'templateRevision') return link('/templates/revision');
  return link(`/${key}`, recallListFilters(`/${key}`));
}

function renderSidebarGroups(link) {
  return SIDEBAR_GROUPS.map((group) => Array.isArray(group.items)
    ? { ...group, items: group.items.map((item) => ({ ...item, href: sidebarHref(item.key, link) })) }
    : { ...group, href: sidebarHref(group.key, link) }
  );
}

function shell({ activeKey, pageTitle, breadcrumbItems, toolbarActionsHtml, bodyHtml, link }) {
  return renderAdminShell({ activeKey, pageTitle, breadcrumbItems, toolbarActionsHtml, bodyHtml, sidebarGroups: renderSidebarGroups(link) });
}

/*
 * Painel de controle — reconstruído para parecer com a ESTRUTURA REAL
 * (não só a cor) do com_cpanel real: cards ÍCONE-ACIMA/TEXTO-ABAIXO
 * dentro de uma caixa com borda (`.card`/`.quickicon` reais), AGRUPADOS
 * sob títulos de seção "Site"/"Sistema" (mod_quickicon real: módulos
 * "Site" e "System" com `header_icon` "icon-desktop"/"icon-wrench" —
 * ver installation/sql/.../base.sql, linhas 654/655) — achado real de
 * divergência estrutural confirmado pelo usuário: a versão anterior
 * usava uma lista simples ícone-esquerda/texto-direita, sem nenhum
 * agrupamento. O agrupamento de domínios por seção segue a classificação
 * real de QuickIconHelper.php (`'group' => 'MOD_QUICKICON_SITE'` para
 * Article/Category/Tags/Menu Item/Module/Plugin Manager; só
 * com_config/com_checkin/com_cache são 'MOD_QUICKICON_SYSTEM') — por
 * isso Módulos/Extensões ficam em "Site" junto com o resto do conteúdo,
 * e "Sistema" contém só a Configuração.
 */
function renderOverviewPage(overview, link) {
  const icons = { articles: articleIcon(), categories: categoryIcon(), tags: tagIcon(), menu: menuIcon(), extensions: pluginIcon(), moduleInstances: moduleIcon() };
  const groups = [
    { label: 'Site', icon: desktopIcon(), domains: ['articles', 'categories', 'tags', 'menu', 'moduleInstances', 'extensions'] }
  ];
  const sections = groups.map((group) => {
    const items = group.domains.map((domain) => {
      const count = Number(overview?.[domain]) || 0;
      const label = domainLabel(domain);
      const description = domain === 'moduleInstances' ? MODULE_INSTANCE_COUNT_DESCRIPTION : domain === 'extensions' ? EXTENSION_COUNT_DESCRIPTION : '';
      const semantics = description ? ` title="${escapeHtml(description)}" aria-label="${escapeHtml(`${label}: ${count}. ${description}`)}"${domain === 'moduleInstances' ? ' aria-describedby="admin-module-instance-help"' : ''}` : '';
      return `<li><a href="${link(`/${domain}`)}"${semantics}><span class="admin-overview-icon">${icons[domain] ?? ''}</span><span class="admin-overview-count">${count}</span><span class="admin-overview-label">${escapeHtml(label)}</span></a></li>`;
    }).join('');
    return `<section class="admin-overview-group"><h2>${group.icon}${escapeHtml(group.label)}</h2><ul class="admin-overview">${items}</ul>${renderModuleInstanceHelp(link)}</section>`;
  }).join('');
  const extensionItems = EXTENSION_OVERVIEW_ITEMS.map((item) => `<li><a href="${link(item.route)}"><span class="admin-overview-icon">${item.icon()}</span>${item.count ? `<span class="admin-overview-count">${Number(overview?.[item.count]) || 0}</span>` : ''}<span class="admin-overview-label">${escapeHtml(item.label)}</span></a></li>`).join('');
  const extensionSection = `<section class="admin-overview-group"><h2>${pluginIcon()}Extensões</h2><ul class="admin-overview">${extensionItems}</ul></section>`;
  const systemSection = `<section class="admin-overview-group"><h2>${configIcon()}Sistema</h2><ul class="admin-overview"><li><a href="${link('/config')}"><span class="admin-overview-icon">${configIcon()}</span><span class="admin-overview-label">Configuração</span></a></li><li><a href="${link('/sampledata')}"><span class="admin-overview-icon">${articleIcon()}</span><span class="admin-overview-label">Dados de exemplo</span></a></li></ul></section>`;
  return shell({ activeKey: 'home', pageTitle: 'Painel de controle', breadcrumbItems: [{ label: 'Painel de controle' }], bodyHtml: sections + extensionSection + systemSection, link });
}

/*
 * Resolve as opções reais de cada campo relacional de `config.fields`
 * (ver field-schemas.js, `field.relation`) chamando
 * `adminService[field.relation].list()` — nunca um dropdown com dados
 * inventados ou um ID numérico cru digitado à mão. `excludeSelf` remove
 * o próprio registro em edição da lista de opções (ex.: uma categoria
 * nunca pode ser pai de si mesma); `recordId` é `undefined` na criação
 * (nada a excluir).
 */
async function resolveRelationOptions(fields, adminService, recordId, record = {}) {
  const relationFields = (Array.isArray(fields) ? fields : []).filter((field) => field.relation);
  const entries = await Promise.all(relationFields.map(async (field) => {
    // Categorias/tags: opções em árvore (indentadas), sem o próprio item nem descendentes (sem ciclos).
    const tree = ['parentId', 'categoryId'].includes(field.name) ? await adminService[field.relation]?.treeOptions?.({ excludeId: field.excludeSelf ? recordId : undefined, current: record[field.name] }) : undefined;
    const rows = tree ? [] : await adminService[field.relation]?.list?.() ?? [];
    const selectable = field.relation === 'extensions' ? rows.filter((row) => row.type === 'Module') : rows;
    const filtered = field.excludeSelf && recordId !== undefined ? selectable.filter((row) => row.id !== recordId) : selectable;
    if (field.relation === 'extensions') {
      for (const key of BUILTIN_MODULE_KEYS) if (!filtered.some((row) => row.key === key)) filtered.push({ key, title: `${key} (nativo)` });
    }
    const options = tree ?? filtered.map((row) => ({ value: row[field.valueField], label: String(row[field.labelField] ?? row[field.valueField]) }));
    const existing = field.type === 'multiselect' ? (Array.isArray(record[field.name]) ? record[field.name] : String(record[field.name] ?? '').split(',').map((value) => value.trim()).filter(Boolean)) : [record[field.name]];
    for (const value of existing) if (value !== undefined && value !== null && value !== '' && !options.some((option) => String(option.value) === String(value))) options.push({ value, label: `${value} (atual — indisponível)` });
    return [field.name, options];
  }));
  return Object.fromEntries(entries);
}

const PAGE_SIZE = 20;

/*
 * Resolve a query efetiva de uma listagem: `explicit` quando o usuário
 * chegou com parâmetros na URL; a memória da última visita quando a URL
 * vem limpa (clique na sidebar); e grava a decisão de volta — inclusive
 * apagando a memória quando uma URL limpa é aberta explicitamente por um
 * link que não seja da sidebar (ex.: clicar em "Artigos" no fim de um
 * formulário depois de usar "Limpar filtros"). Nunca muta `params`.
 *
 * A persistência em si (`sessionStorage`, com try/catch) fica em
 * list-memory.js, para ser compartilhada com extension-pages.js sem
 * import circular.
 */
function effectiveListParams(path, params, { fromSidebar = false } = {}) {
  const domain = path.replace(/^\//, '');
  /*
   * A query é normalizada para a chave canônica ANTES de ser usada e
   * memorizada. Sem isso um link legado (`col_alias=primeiro`) continuava
   * circulando com o nome antigo, e "voltar" do formulário reemitia
   * `col_alias` enquanto a listagem usava `alias` — o mesmo recorte com
   * dois nomes, que é como o filtro se perdia na volta.
   */
  const explicit = canonicalizeParams(domain, params ?? {});
  const hasExplicit = Object.keys(explicit).length > 0;
  if (hasExplicit) { rememberListFilters(path, explicit); return explicit; }
  const remembered = recallListFilters(path);
  const resolved = fromSidebar ? remembered : {};
  if (!fromSidebar) rememberListFilters(path, {});
  return resolved;
}

/*
 * Filtra `rows` por `searchTerm` (comparação case-insensitive contra
 * `config.titleField`, nunca contra todos os campos — mesmo princípio de
 * busca simples já usado por src/libraries/minijoomla/application/content-service.js para o
 * site público) e recorta a página atual. Puro: não decide a URL de
 * busca/paginação, só os dados que `renderAdminList` vai desenhar — a
 * resolução de `location.params.q`/`location.params.page` e a montagem
 * de `searchHref`/`pagination.link` continuam em `renderRoute`, abaixo.
 */
function filterAndPaginate(rows, config, searchTerm, pageNumber) {
  const term = String(searchTerm ?? '').trim().toLocaleLowerCase();
  const filtered = term ? rows.filter((row) => String(row[config.titleField] ?? '').toLocaleLowerCase().includes(term)) : rows;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(pageNumber) || 1), pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return { pageRows, pageCount, currentPage };
}

/*
 * Prefixo dos parâmetros do menu de filtro por coluna. `col_<campo>`
 * mantém os filtros de coluna separados dos filtros de gerenciamento já
 * existentes (`state`, `type`, `position`…): os dois podem coexistir na
 * mesma URL sem que um sobrescreva o outro.
 */
const COLUMN_FILTER_PREFIX = 'col_';
const columnFilterParam = (column) => `${COLUMN_FILTER_PREFIX}${column}`;

/*
 * Extrai de `params` só os filtros de coluna ativos, para o estado da
 * lista (`listState`) devolvido ao abrir/editar/voltar de um registro.
 *
 * A chave gravada é a CANÔNICA do domínio (column-filter.js), nunca o
 * alias legado `col_<campo>`: o estado precisa voltar à URL na forma
 * que o serviço lê hoje, senão o filtro escolhido no menu antigo não
 * sobrevive à ida e volta do registro. O alias continua sendo aceito na
 * leitura, para links já gravados por versões anteriores.
 */
function columnFilterParams(domain, params = {}) {
  const entries = columnsForDomain(domain).map((entry) => [entry.key, (params[entry.key] ?? params[entry.column] ?? params[columnFilterParam(entry.column)] ?? '') || undefined]);
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined && value !== ''));
}

/*
 * Colunas cujo valor é um indicador (não texto): o menu de coluna lista
 * os valores brutos ("1"/"0", "Published"…) e o rótulo amigável vem
 * daqui, senão o dropdown mostraria códigos em vez do que a coluna
 * exibe.
 */
const ICON_COLUMN_VALUES = {
  featured: { '1': 'Em destaque', '0': 'Sem destaque' },
  enabled: { '1': 'Habilitado', '0': 'Desabilitado' },
  published: { '1': 'Publicado', '0': 'Despublicado' },
  state: { Published: 'Publicado', Draft: 'Despublicado', Archived: 'Arquivado', Trashed: 'Na lixeira' },
  scopeKind: { site: 'Site', administrator: 'Administrador' }
};

/*
 * Monta um menu de filtro por coluna para cada coluna canônica do
 * domínio (column-filter.js — a ÚNICA definição de colunas e rótulos).
 * Diferente do que acontecia antes, o menu não é mais omitido quando há
 * um só valor distinto: a lista de valores continua saindo do conjunto
 * ANTES dos filtros de coluna (`managementRows`), mas a coluna é sempre
 * oferecida — esconder o botão deixava a coluna sem controle e ainda
 * mudava o cabeçalho conforme o conteúdo.
 *
 * `label` é o mesmo rótulo do cabeçalho (`COLUMN_LABELS` quando houver,
 * senão o do catálogo) e não um texto novo: é ele que dá nome acessível
 * ao botão ("Filtrar coluna Título"), então menu e cabeçalho nunca
 * divergem.
 */
function columnFilterDefinitions(domain, rows, params = {}, searchTerm = '') {
  /*
   * Regra do AutoFiltro: as opções da coluna X saem das linhas que passam
   * por TODOS os filtros ativos, EXCETO o da própria coluna X — a busca `q`
   * incluída. Antes a contagem saía de `managementRows` cru (com os filtros
   * de gerenciamento aplicados, mas sem a busca e sem os demais filtros de
   * coluna), então o menu oferecia valores que a lista não devolvia e o
   * contador não batia com o que estava na tela.
   */
  const term = String(searchTerm ?? '').trim().toLocaleLowerCase();
  const titleField = ADMIN_DOMAINS[domain]?.titleField ?? 'title';
  const matchesSearch = (row) => !term || String(row[titleField] ?? '').toLocaleLowerCase().includes(term);
  return columnsForDomain(domain).map((entry) => {
    const ownSkip = (row, paramsForRow) => filterColumnValues(domain, [row], { ...paramsForRow, [entry.key]: undefined, [entry.column]: undefined }).length > 0;
    const scoped = rows.filter((row) => matchesSearch(row) && ownSkip(row, params));
    const counts = new Map();
    let emptyCount = 0;
    for (const row of scoped) {
      const value = row[entry.key];
      if (value === undefined || value === null || value === '') { emptyCount += 1; continue; }
      const text = String(value);
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
    const labels = ICON_COLUMN_VALUES[entry.key] ?? {};
    const options = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((value) => ({ value, label: labels[value] ?? value, count: counts.get(value) }));
    // "(Vazias)" entra quando há linhas sem valor, com valor `''` (item 6 do
    // Adendo 2: `''` é ausência; `0`/`false` NÃO são).
    if (emptyCount) options.push({ value: '', label: 'Vazias', count: emptyCount });
    /*
     * O valor ativo é lido tanto pela chave canônica quanto pelos nomes
     * legados da coluna (`col_title`): a URL antiga continua valendo, e o
     * botão precisa marcar-se como ativo em qualquer uma das grafias —
     * senão o filtro funciona mas a interface diz que não há filtro.
     */
    const raw = params[entry.key] ?? entry.aliases.map((alias) => params[alias]).find((value) => value !== undefined && value !== null && value !== '') ?? '';
    return {
      key: entry.key,
      column: entry.column,
      label: COLUMN_LABELS[entry.column] ?? entry.label,
      values: parseMulti(raw),
      options
    };
  });
}

/*
 * Aplica os filtros de coluna (`col_<campo>`) por IGUALDADE EXATA do
 * valor exibido. Exato (e não "contém") porque o menu de coluna oferece
 * uma lista fechada de valores reais: escolher "Draft" deve mostrar
 * exatamente os despublicados, não tudo que contenha "Draft".
 * `extensions` exibe `type` já traduzido, então compara contra o rótulo
 * para o menu (que lista o que está na tela) continuar coerente.
 */
function filterColumnValues(domain, rows, params = {}) {
  return columnsForDomain(domain).reduce((current, entry) => {
    const raw = params[entry.key] ?? params[entry.column] ?? '';
    const selected = parseMulti(raw).map(String);
    if (!selected.length) return current;
    const reads = (row) => domain === 'extensions' && entry.key === 'type'
      ? [String(row[entry.key] ?? ''), extensionTypeLabel(row[entry.key])]
      : [String(row[entry.key] ?? '')];
    return current.filter((row) => reads(row).some((value) => selected.some((wanted) => wanted === '' ? value === '' : value === wanted)));
  }, rows);
}

function renderDomainListPage(domain, rows, link, { searchTerm, pageNumber, params = {}, now } = {}) {
  const config = ADMIN_DOMAINS[domain];
  const label = domainLabel(domain);
  /*
   * `managementRows` é o conjunto ANTES dos filtros de coluna: os menus
   * de coluna são montados a partir dele para que um filtro ativo
   * continue oferecendo as demais opções (senão o dropdown só listaria
   * o próprio valor escolhido e não haveria como trocar ou limpar).
   */
  const managementRows = filterManagementRows(domain, rows, params);
  const filteredRows = filterColumnValues(domain, managementRows, params);
  const { pageRows, pageCount, currentPage } = filterAndPaginate(filteredRows, config, searchTerm, pageNumber);
  const filters = managementFilters(domain, params).map((filter) => domain === 'extensions' && filter.name === 'type'
    ? { ...filter, options: filter.options.map(([value]) => [value, value ? extensionTypeLabel(value) : 'Módulo / Plugin']) } : filter);
  const filterParams = Object.fromEntries(filters.filter((filter) => filter.value).map((filter) => [filter.name, filter.value]));
  /*
   * Estado da lista que precisa sobreviver a "novo", "editar", "voltar":
   * os filtros de coluna ativos, os campos de gerenciamento (estado,
   * tipo, posição), a busca textual e a ordenação/limite — nunca a
   * página, que pertence à listagem seguinte e não ao registro aberto.
   * Sem isto, abrir um registro e cancelar devolvia a lista ao padrão,
   * que é o defeito relatado.
   *
   * O estado é CANONICALIZADO: a query da 0.17.14 (`col_alias`) continua
   * sendo lida, mas todo link emitido pelo painel carrega a chave que o
   * serviço lê (`alias`). Sem isso o mesmo recorte viajava como `col_alias`
   * para uma tela e `alias` para outra, e o filtro se perdia na volta.
   */
  const listState = canonicalizeParams(domain, {
    ...filterParams,
    ...columnFilterParams(domain, params),
    q: searchTerm, sort: params.sort, dir: params.dir, limit: params.limit
  });
  const columnFilters = columnFilterDefinitions(domain, managementRows, params, searchTerm);
  /*
   * Frente C2: a barra de filtros ativos descreve exatamente o que está
   * recortando a lista — os filtros de coluna ativos e os de gerenciamento
   * que viraram coluna. Os rótulos vêm do mesmo mapa de facetas usado no
   * cabeçalho, para a barra e o painel nunca discordarem sobre como um valor
   * se chama. `totalBase` é o total SEM filtro de coluna; compará-lo com o
   * total exibido é o que mostra quanto o filtro está escondendo.
   */
  const activeFilters = filters.filter((filter) => filter.value).map((filter) => {
    const values = parseMulti(String(filter.value)).map(String);
    const options = columnFilters.find((column) => column.key === filter.name || column.column === filter.name)?.options ?? [];
    const labels = new Map(options.map((option) => [String(option.value), option.label]));
    return {
      key: filter.name,
      label: filter.label,
      values: values.map((value) => labels.get(value) ?? value),
      rawValues: values
    };
  });
  /*
   * `activeFilterClearHref` foi removido nesta rodada: a barra canônica
   * ("Limpar todos" em `renderActiveFilterChips`) decide sozinha o que
   * preservar — q/sort/dir/limit — e o link calculado aqui, sobre `listState`,
   * divergia dessa regra e nunca era lido por ninguém.
   */
  /*
   * `totalBase` é o denominador do "N de M": o recorte da tela SEM filtro de
   * coluna, mas COM os filtros de gerenciamento e a busca — `managementRows`
   * já traz os primeiros, só faltava a busca. Antes valia
   * `managementRows.length`, que ignorava o termo digitado: a lista mostrava
   * "3 de 20" mesmo com a busca já reduzida a 3, escondendo o efeito dos
   * filtros de coluna.
   */
  const searchTermLower = String(searchTerm ?? '').trim().toLocaleLowerCase();
  const totalBase = searchTermLower
    ? managementRows.filter((row) => String(row[config.titleField] ?? '').toLocaleLowerCase().includes(searchTermLower)).length
    : managementRows.length;
  const body = renderAdminList({
    domain, now,
    rows: domain === 'extensions' ? pageRows.map((row) => ({ ...row, etag: row.etag, type: extensionTypeLabel(row.type) })) : pageRows,
    columns: LIST_COLUMNS[domain], columnLabels: COLUMN_LABELS, titleField: config.titleField,
    emptyLabel: searchTerm ? `Nenhum registro em "${label}" encontrado para "${searchTerm}".` : `Nenhum registro em "${label}" ainda.`,
    editHref: (id) => link(`/${domain}/${id}`, listState),
    searchValue: searchTerm, searchHref: link(`/${domain}`, listState),
    searchFilters: filters,
    activeFilters,
    total: filteredRows.length, totalBase,
    totalLabel: `${filteredRows.length} de ${totalBase} ${domain === 'articles' ? 'artigos' : 'itens'}`,
    cellRenderers: domain === 'categories'
      ? { counts: (row) => renderCategoryCounts(row, { link, domain: 'articles', listState, label: String(row.title ?? '').trim() }) }
      : {},
    tableFooter: domain === 'categories' ? renderCategoryLegend() : '',
    columnFilters,
    columnFormId: `admin-${domain}-colfilter`,
    rowActions: (row) => renderManagementActions(domain, row),
    pagination: { page: currentPage, pageCount, link: (pageNumber) => link(`/${domain}`, { ...listState, page: pageNumber > 1 ? pageNumber : undefined }) }
  });
  const newAction = ['extensions', 'templates'].includes(domain)
    ? `<a class="admin-btn admin-btn-ghost" href="${link(`/${domain}/discover`, listState)}">${searchIcon()}Descobrir</a>`
    : `<a class="admin-btn admin-btn-success" href="${link(`/${domain}/new`, listState)}">${plusIcon()}Novo</a>`;
  const status = ADMIN_CAPABILITIES[domain] ? '<p role="status" aria-live="polite" aria-atomic="true" class="admin-management-status"></p>' : '';
  const help = ['extensions', 'moduleInstances'].includes(domain) ? renderModuleInstanceHelp(link) : '';
  return shell({ activeKey: domain, pageTitle: label, breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label, href: link('/' + domain, listState) }], toolbarActionsHtml: newAction, bodyHtml: help + renderCapabilities(domain) + status + body, link });
}

function renderDomainFormPage(domain, values, { isNew, link, relationOptions, imageUpload = false, returnParams = {} }) {
  const config = ADMIN_DOMAINS[domain];
  const label = domainLabel(domain);
  const title = isNew ? `Novo registro em ${label}` : `Editar ${label}`;
  // Cancelar e o breadcrumb precisam voltar à lista COMO ELA ESTAVA (filtros,
  // busca, ordenação e página), senão editar um item filtrado devolve o
  // usuário a uma lista sem filtro e ele perde o contexto de trabalho.
  const backHref = link(`/${domain}`, returnParams);
  const fields = domain === 'moduleInstances' ? config.fields.map((field) => field.name === 'extensionKey' ? { ...field, label: 'Tipo de módulo' } : field) : config.fields;
  const displayValues = domain === 'extensions' ? { ...values, type: extensionTypeLabel(values.type) } : values;
  const form = domain === 'articles'
    ? renderArticleAdminForm({
        formId: domain,
        fields: config.fields,
        values,
        relationOptions,
        layout: ARTICLE_EDITOR_LAYOUT,
        submitLabel: isNew ? 'Criar' : 'Salvar',
        cancelHref: backHref,
        imageUpload
      })
    : renderAdminForm({ formId: domain, fields, values: displayValues, submitLabel: isNew ? 'Criar' : 'Salvar', cancelHref: backHref, relationOptions });
  // Como no Joomla, artigos/categorias/tags só são excluídos definitivamente a partir da lixeira.
  const deletable = !isNew && (!['articles', 'categories', 'tags'].includes(domain) || values.state === 'Trashed');
  const deleteButton = !deletable ? '' : `<button type="button" class="admin-btn admin-btn-danger" data-admin-delete="true" data-confirm="Excluir este registro de ${escapeHtml(label)}? Esta ação não pode ser desfeita.">${trashIcon()}Excluir</button>`;
  const body = `${renderCapabilities(domain)}<p role="status" aria-live="polite" aria-atomic="true" class="admin-form-status"></p>${form}${deleteButton}`;
  return shell({ activeKey: domain, pageTitle: title, breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label, href: backHref }, { label: isNew ? 'Novo' : 'Editar' }], bodyHtml: body, link });
}

/*
 * `record.settingsJson` chega serializado (texto), exibido/editado no
 * formulário como `settingsText` (campo declarado em
 * MODULE_INSTANCE_FIELDS) — a conversão settingsJson<->settingsText é
 * só de apresentação, nunca muda o shape persistido por
 * admin-service.js (que continua esperando `settings` como objeto ou
 * `settingsJson` como texto, nunca `settingsText`).
 */
function toModuleInstanceFormValues(record = {}) { return { ...record, settingsText: record.settingsJson ?? '' }; }
function toTemplateFormValues(record = {}) { return { ...record, positionsText: record.positionsJson ?? '[]' }; }

const CONFIG_FIELDS = SITE_CONFIG_FIELDS;

// The generic reader supports synthetic forms too; this boundary additionally
// excludes immutable/disabled controls so neither absent nor disabled fields
// become empty patches that overwrite persisted values.
function readEditableFormValues(form, fields) {
  return readAdminFormValues(form, fields.filter((field) => !field.readOnly && !form.querySelector?.(`[name="${field.name}"]`)?.disabled));
}
function renderNotFoundPage(link) {
  const body = '<p role="alert">Página administrativa não encontrada.</p>';
  return shell({ activeKey: null, pageTitle: '404', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: '404' }], bodyHtml: body, link });
}

/*
 * `documentRef`: mesmo contrato sintético já usado por createApplication
 * (src/index.js) — `body.innerHTML`/`body.querySelector`/`title`. Nunca
 * `document`/`window` reais diretamente.
 * `richTextEditorFactory`: `(elementId) => Promise<{ destroy() }>`
 * injetável (mesmo princípio de `transportFactory` em
 * createMiniJoomlaAdminApp) — tipicamente
 * `(elementId) => attachRichTextEditor(elementId, { vendorBaseUrl })`
 * de src/administrator/components/com_minijoomla/editor.js, montado por quem monta o bootstrap real
 * (nunca decidido aqui, que não sabe onde o TinyMCE está publicado).
 * Omitido, os campos `data-admin-richtext` continuam só `<textarea>`
 * sem editor rico — nunca lança, nunca bloqueia a tela.
 */
export function createAdminApplication({ adminService, discoveryService, mediaService, pluginRuntime, sampleDataService, extensionRootsService, templateRevisionService, documentRef = globalThis.document, basePath = '', autoStart = true, richTextEditorFactory, clock = () => new Date() } = {}) {
  let latestNavigation = 0;
  let stopped = false;
  let started = false;
  let starting;
  let activeRichTextEditors = [];
  let pendingRichTextElementIds = [];
  let editorMounts = Promise.resolve();

  async function renderRoute(location, navigationId) {
    const link = (path, params) => router.link(path, params);
    if (location.path === '/' || location.path === '') return { html: renderOverviewPage(await adminService.overview(), link) };
    const isCurrent = () => navigationId === latestNavigation;
    if (location.path === '/sampledata') return loadSampleDataPage({ sampleDataService, documentRef, router, shell, isCurrent });
    if (location.path === '/installer/roots') return loadExtensionRootsPage({ service: extensionRootsService, documentRef, router, shell, isCurrent });
    if (location.path === '/templates/revision') return loadTemplateRevisionPage({ templateRevisionService, adminService, documentRef, router, shell, isCurrent });
    // Toda listagem de conteúdo/extensão passa por aqui: a query efetiva é a
    // URL quando ela vem com parâmetros, ou a memória da última visita quando
    // a URL chega limpa (clique na sidebar). As páginas recebem a memória
    // resolvida via `effectiveListParams` para que sidebar, cançelar, salvar e
    // excluir caiam sempre na MESMA lista filtrada — estas listas não passam
    // pelo branch de domínio abaixo, que resolve a memória por conta própria.
    const isListRoute = /^\/(articles|categories|tags|media|moduleInstances|plugins|installer|templates\/styles|options)$/.test(location.path);
    const pagesLocation = isListRoute ? { ...location, params: effectiveListParams(location.path, location.params) } : location;
    const extensionPage = location.path === '/config' ? null : await createExtensionPages({ adminService, documentRef, router, shell, isCurrent }).render(pagesLocation);
    if (extensionPage) return extensionPage;
    const contentPage = await createContentPages({ adminService, documentRef, router, shell, mediaService, clock, isCurrent }).render(pagesLocation);
    if (contentPage) return contentPage;
    if (location.path === '/components') return { html: shell({ activeKey: 'nativeComponents', pageTitle: 'Componentes nativos', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Componentes' }], bodyHtml: renderNativeComponents(link), link }) };
    if (location.path === '/config') {
      const record = await adminService.siteConfig.get();
      const templates = adminService.templates?.available === false ? [] : await adminService.templates?.list?.() ?? [];
      return { html: renderConfigPage(record, link, templates, shell, adminService.siteConfig.defaults), etag: record?.etag };
    }
    if (location.path === '/templates/discover') {
      return loadTemplateDiscoveryPage({ adminService, discoveryService, documentRef, router, shell, isCurrent: () => navigationId === latestNavigation });
    }
    if (location.path === '/extensions/discover') {
      return loadExtensionDiscoveryPage({ adminService, discoveryService, documentRef, router, shell, isCurrent: () => navigationId === latestNavigation });
    }
    const domainMatch = location.path.match(/^\/([a-zA-Z]+)(?:\/(new|\d+))?$/);
    if (domainMatch && DOMAIN_KEYS.includes(domainMatch[1])) {
      const [, domain, idSegment] = domainMatch;
      if (domain === 'templates' && adminService.templates?.available === false) return { html: shell({ activeKey: 'templates', pageTitle: 'Templates', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Templates' }], bodyHtml: '<p role="status">Catálogo de templates não configurado. Os templates integrados continuam disponíveis na <a href="' + link('/config') + '">configuração do site</a>.</p>', link }) };
      if (idSegment === undefined) {
        // Memória por lista: parâmetros explícitos na URL passam a ser a
        // última query conhecida; uma URL limpa (ex.: "Artigos" no fim de um
        // formulário, ou "Limpar filtros") esquece a query anterior. A
        // sidebar não depende disto: ela já embute a memória no href.
        const listParams = effectiveListParams(`/${domain}`, location.params);
        let rows = await adminService[domain].list();
        let siteConfig;
        if (ADMIN_CAPABILITIES[domain]) {
          // findMany omits ETags; actions must use the snapshot captured with this screen.
          const visible = filterAndPaginate(filterManagementRows(domain, rows, listParams), ADMIN_DOMAINS[domain], listParams?.q, listParams?.page).pageRows;
          const snapshots = new Map((await Promise.all(visible.map((row) => adminService[domain].get(row.id)))).filter(Boolean).map((row) => [row.id, row]));
          rows = rows.map((row) => snapshots.get(row.id) ?? row);
          if (domain === 'templates') {
            siteConfig = await adminService.siteConfig.get();
            rows = rows.map((row) => ({ ...row, etag: row.etag, isDefault: row.key === (siteConfig?.templateKey || 'default') }));
          }
        }
        return { html: renderDomainListPage(domain, rows, link, { searchTerm: listParams?.q, pageNumber: listParams?.page, params: listParams, now: domain === 'articles' ? clock() : undefined }), management: { domain, rows, siteConfig } };
      }
      const config = ADMIN_DOMAINS[domain];
      // Voltar do formulário deve reproduzir a lista de origem. Os links de
      // edição/novo já chegam com a query da lista, então ela é regravada
      // aqui: se o usuário abrir/copiar a URL do formulário diretamente
      // (sem passar pela listagem), a memória ainda existe e Cancelar e o
      // breadcrumb voltam para o MESMO recorte em vez da lista limpa.
      // A memória guarda a CHAVE CANÔNICA: ler um link antigo com `col_alias`
      // não pode fazer o formulário devolver a lista com o nome legado, senão
      // o mesmo filtro viaja com dois nomes e a volta perde o recorte.
      if (Object.keys(location.params ?? {}).length > 0) rememberListFilters(`/${domain}`, canonicalizeParams(domain, location.params));
      const returnParams = recallListFilters(`/${domain}`);
      if (idSegment === 'new') {
        if (['extensions', 'templates'].includes(domain)) return { html: renderNotFoundPage(link) };
        const relationOptions = await resolveRelationOptions(config.fields, adminService, undefined);
        const newFormValues = domain === 'menu' ? toMenuFormValues({}) : domain === 'articles' ? toArticleFormValues({}) : domain === 'moduleInstances' ? { enabled: true, ordering: 0, scopeKind: 'All', position: 'sidebar-right' } : {};
        if (domain === 'menu') relationOptions.menuType = menuTypeOptions(newFormValues);
        return { html: renderDomainFormPage(domain, newFormValues, { isNew: true, link, relationOptions, imageUpload: Boolean(mediaService?.uploadImage), returnParams }) };
      }
      const record = await adminService[domain].get(Number(idSegment));
      if (!record) return { html: renderNotFoundPage(link) };
      const formValues = domain === 'menu' ? toMenuFormValues(record) : domain === 'moduleInstances' ? toModuleInstanceFormValues(record) : domain === 'templates' ? toTemplateFormValues(record) : domain === 'articles' ? toArticleFormValues(record) : record;
      const relationOptions = await resolveRelationOptions(config.fields, adminService, record?.id, formValues);
      if (domain === 'menu') relationOptions.menuType = menuTypeOptions(formValues);
      return { html: renderDomainFormPage(domain, formValues ?? {}, { isNew: false, link, relationOptions, imageUpload: Boolean(mediaService?.uploadImage), returnParams }), etag: record?.etag, record };
    }
    return { html: renderNotFoundPage(link) };
  }

  /*
   * `etag`: capturado no momento em que o registro foi CARREGADO para
   * esta tela (renderRoute, acima) — nunca buscado de novo aqui dentro.
   * Buscar um etag "fresco" no momento do submit anularia por completo a
   * concorrência otimista (duas edições concorrentes nunca
   * conflitariam, cada uma sobrescrevendo silenciosamente a outra) —
   * achado real ao escrever os testes desta tela: o primeiro design
   * fazia exatamente isso, mascarando o conflito com um "sucesso" falso.
   */
  function bindFormHandlers(domain, idSegment, etag, navigationId, record = {}) {
    const formElement = documentRef.body.querySelector?.('[data-admin-form]');
    if (!formElement) return;
    const status = documentRef.body.querySelector?.('.admin-form-status');
    const isCurrent = () => navigationId === latestNavigation;
    const report = (message) => { if (isCurrent() && status) status.textContent = message; };
    if (domain === 'articles') {
      const button = formElement.querySelector?.('[data-admin-article-accessibility]');
      const result = formElement.querySelector?.('[data-admin-article-accessibility-report]');
      button?.addEventListener?.('click', () => {
        if (!isCurrent() || !result) return;
        // Read the synchronized textarea only. sync() can upload images and
        // must NEVER run for a readonly analysis action.
        const analysis = analyzeArticleAccessibility(formElement.querySelector?.('[name="articletext"]')?.value ?? '');
        const labels = { error: 'Erro', warning: 'Aviso', notice: 'Informação' };
        result.innerHTML = `<p>${analysis.errorCount} erro(s), ${analysis.warningCount} aviso(s), ${analysis.noticeCount} informação(ões).</p>${analysis.issues.length ? `<ul>${analysis.issues.map((issue) => `<li><strong>${escapeHtml(labels[issue.severity])}:</strong> ${escapeHtml(issue.message)}</li>`).join('')}</ul>` : '<p>Nenhum problema detectado pelas regras locais.</p>'}`;
      });
    }
    if (domain === 'menu') {
      const typeSelect = formElement.querySelector?.('[name="menuType"]');
      const targets = { category: 'targetCategory', article: 'targetArticle', tag: 'targetTag', url: 'targetUrl' };
      const field = (name) => formElement.querySelector?.(`[name="${name}"]`);
      const sync = () => {
        const type = MENU_TYPES.find((entry) => entry.key === typeSelect.value);
        for (const [target, name] of Object.entries(targets)) { const wrapper = field(name)?.closest?.('.admin-field'); if (wrapper) wrapper.hidden = type?.target !== target; }
        const pathInput = field('path');
        if (pathInput) pathInput.value = typeSelect.value === 'custom' ? record.path ?? '' : buildMenuPath({ type: typeSelect.value, category: field('targetCategory')?.value, article: field('targetArticle')?.value, tag: field('targetTag')?.value, url: field('targetUrl')?.value }) ?? '';
      };
      if (typeSelect) {
        for (const name of ['menuType', ...Object.values(targets)]) { field(name)?.addEventListener?.('change', sync); field(name)?.addEventListener?.('input', sync); }
        sync();
      }
    }
    if (domain === 'articles' && mediaService?.uploadImage) {
      const imageMessage = (text) => { if (!isCurrent()) return; const element = formElement.querySelector?.('[data-admin-image-status]'); if (element) element.textContent = text; };
      formElement.querySelectorAll?.('[data-admin-image-upload]')?.forEach?.((button) => button.addEventListener?.('click', async () => {
        if (!isCurrent() || button.disabled) return;
        const name = button.dataset.adminImageUpload;
        const file = formElement.querySelector?.(`[data-admin-image-file="${name}"]`)?.files?.[0];
        if (!file) { imageMessage('Escolha uma imagem para enviar.'); return; }
        if (!MEDIA_MIME_TYPES.includes(String(file.type).toLowerCase())) { imageMessage(`Tipo de imagem não suportado: ${file.type || '(vazio)'}.`); return; }
        if (file.size > MEDIA_MAX_BYTES) { imageMessage('Arquivo maior que o limite de 10 MiB.'); return; }
        button.disabled = true;
        try {
          const content = await file.arrayBuffer();
          if (!isCurrent()) return;
          const { url } = await mediaService.uploadImage({ content, mimeType: file.type });
          if (!isCurrent()) return;
          const input = formElement.querySelector?.(`[name="${name}"]`);
          if (input) input.value = url;
          const preview = formElement.querySelector?.(`[data-admin-image-preview="${name}"]`);
          if (preview) { preview.src = url; preview.hidden = false; }
          imageMessage('Imagem enviada. Salve o artigo para gravar a referência.');
        } catch (error) { imageMessage(error?.name === 'ValidationError' ? error.message : 'Não foi possível enviar a imagem.'); }
        finally { button.disabled = false; }
      }));
    }
    let saving = false;
    formElement.addEventListener?.('submit', async (event) => {
      event?.preventDefault?.();
      if (!isCurrent() || saving) return;
      saving = true;
      try {
        /*
         * Achado real (supervisão): um upload automático de imagem
         * `data:`/`blob:` do TinyMCE (automatic_uploads, ver
         * src/administrator/components/com_minijoomla/editor.js) pode ainda estar em andamento, ou já ter
         * concluído sem sincronizar o `<textarea>` (nenhum dos eventos
         * change/input/undo/redo/SetContent disparou depois). Sincronizar
         * TODO editor ativo (aguardando qualquer upload pendente) ANTES
         * de ler os valores do formulário elimina essa corrida — nunca
         * depende de um evento incidental já ter disparado primeiro.
         * `sync` é um no-op seguro sem richTextEditorFactory configurado
         * (activeRichTextEditors sempre vazio nesse caso).
         */
        await editorMounts;
        if (!isCurrent()) return;
        await Promise.all(activeRichTextEditors.map((editor) => editor.sync?.()));
        if (!isCurrent()) return;
        if (domain === 'config') {
          const values = readEditableFormValues(formElement, CONFIG_FIELDS);
          await adminService.siteConfig.save(values, etag ? { etag } : {});
          if (!isCurrent()) return;
          report('Configuração salva.');
          await router.navigate(router.link('/config'));
          return;
        }
        const config = ADMIN_DOMAINS[domain];
        const rawValues = readEditableFormValues(formElement, config.fields);
        const values = domain === 'moduleInstances'
          ? { ...rawValues, ...(rawValues.settingsText !== undefined ? { settings: rawValues.settingsText ? JSON.parse(rawValues.settingsText) : null } : {}) }
          : domain === 'articles'
          ? prepareArticleFormValues(rawValues, {
              record, isNew: idSegment === 'new',
              optionValues: readEditableFormValues(formElement, ARTICLE_OPTION_FIELDS),
              groupValues: readEditableFormValues(formElement, [...ARTICLE_IMAGE_FIELDS, ...ARTICLE_LINK_FIELDS])
            })
          : domain === 'menu'
          ? prepareMenuFormValues(rawValues, record)
          : rawValues;
        if (domain === 'moduleInstances') delete values.settingsText;
        if (domain === 'templates' && values.positionsText !== undefined) { values.positions = JSON.parse(values.positionsText || '[]'); delete values.positionsText; }
        if (idSegment === 'new') { await adminService[domain].create(values); report('Criado com sucesso.'); }
        else { await adminService[domain].update(Number(idSegment), values, { etag }); report('Salvo com sucesso.'); }
        // Volta para a lista com os filtros que o usuário tinha antes de entrar
        // no formulário: sem isto, salvar um item filtrado joga o usuário numa
        // lista completa e ele perde o contexto de trabalho.
        if (isCurrent()) await router.navigate(router.link(`/${domain}`, recallListFilters(`/${domain}`)));
      } catch (error) {
        report(error?.code === 'concurrency-conflict' ? 'O registro foi alterado por outra pessoa. Recarregue antes de salvar.' : error?.name === 'ValidationError' ? error.message : (['moduleInstances', 'templates'].includes(domain) && error instanceof SyntaxError ? 'Configurações (JSON) inválido.' : 'Não foi possível salvar.'));
      } finally { saving = false; }
    });
    const deleteButton = documentRef.body.querySelector?.('[data-admin-delete]');
    deleteButton?.addEventListener?.('click', async () => {
      if (!isCurrent()) return;
      const confirmMessage = deleteButton.dataset?.confirm;
      if (confirmMessage && !globalThis.confirm?.(confirmMessage)) return;
      if (!isCurrent()) return;
      try {
        await adminService[domain].remove(Number(idSegment), { etag });
        if (isCurrent()) await router.navigate(router.link(`/${domain}`, recallListFilters(`/${domain}`)));
      } catch (error) { report(error?.code === 'concurrency-conflict' ? 'O registro foi alterado por outra pessoa. Recarregue antes de excluir.' : error?.name === 'ValidationError' ? error.message : 'Não foi possível excluir.'); }
    });
  }

  function reportManagementError(error, fallback) {
    const status = documentRef.body.querySelector?.('.admin-management-status');
    if (status) status.textContent = error?.code === 'concurrency-conflict'
      ? 'O registro ou a configuração foi alterado por outra pessoa. Recarregue antes de tentar novamente.'
      : error?.name === 'ValidationError' ? error.message : fallback;
  }

  function bindManagementHandlers(management, location, navigationId) {
    if (!management || !ADMIN_CAPABILITIES[management.domain]) return;
    const { domain, rows, siteConfig } = management;
    documentRef.body.querySelectorAll?.('[data-admin-managed-action]')?.forEach?.((button) => {
      button.addEventListener?.('click', async () => {
        if (button.disabled || navigationId !== latestNavigation) return;
        const row = rows.find((item) => Number(item.id) === Number(button.dataset.adminRowId));
        if (!row?.etag) {
          reportManagementError(null, 'Não foi possível identificar o registro ou seu ETag. Recarregue antes de tentar novamente.');
          return;
        }
        button.disabled = true;
        try {
          if (button.dataset.adminManagedAction === 'default') {
            await adminService.templates.setDefault(row.id, { etag: row.etag, configEtag: siteConfig?.etag });
          } else {
            await adminService[domain].update(row.id, { enabled: !row.enabled }, { etag: row.etag });
          }
          if (navigationId === latestNavigation) await router.navigate(router.link(location.path, location.params));
        } catch (error) { if (navigationId === latestNavigation) reportManagementError(error, 'Não foi possível alterar o registro.'); }
        finally { button.disabled = false; }
      });
      button.dataset.adminManagedBound = 'true';
    });
  }

  function bindListSearch(location, navigationId) {
    const form = documentRef.body.querySelector?.('.admin-searchbar');
    form?.addEventListener?.('submit', async (event) => {
      event?.preventDefault?.();
      if (navigationId !== latestNavigation) return;
      const names = ['q', ...managementFilters(location.path.slice(1)).map((filter) => filter.name)];
      const params = Object.fromEntries(names.map((name) => [name, form.querySelector?.(`[name="${name}"]`)?.value]).filter(([, value]) => value));
      await router.navigate(router.link(location.path, params));
    });
  }

  /*
   * Botão "hambúrguer" (só visível em telas estreitas, via media query em
   * admin.css) que abre/fecha a sidebar — equivalente ao
   * `.toggler-burger` real do template Atum do Joomla. Precisa ser
   * religado a cada navegação porque `documentRef.body.innerHTML` é
   * substituído por completo em todo `onNavigate` (mesmo motivo de
   * bindFormHandlers e os bindings de descoberta, nunca um listener
   * global sobrevivendo entre rotas).
   */
  function bindSidebarToggle() {
    const toggle = documentRef.body.querySelector?.('[data-admin-sidebar-toggle]');
    const sidebar = documentRef.body.querySelector?.('.admin-sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener?.('click', () => {
      const isOpen = sidebar.classList?.contains?.('admin-sidebar-open');
      sidebar.classList?.toggle?.('admin-sidebar-open');
      toggle.setAttribute?.('aria-expanded', isOpen ? 'false' : 'true');
    });
    const close = (event) => {
      if (event?.key !== 'Escape' || !sidebar.classList?.contains?.('admin-sidebar-open')) return;
      event.preventDefault?.();
      sidebar.classList?.toggle?.('admin-sidebar-open', false);
      toggle.setAttribute?.('aria-expanded', 'false');
      toggle.focus?.();
    };
    sidebar.addEventListener?.('keydown', close);
    toggle.addEventListener?.('keydown', close);
  }

  /*
   * Expansão/colapso de cada grupo de nível 1 da sidebar
   * (`data-admin-sidebar-group`, renderizado por render-shell.js) —
   * equivalente ao comportamento real `.has-arrow`/`.mm-collapse`/
   * `.mm-show` do mod_menu real (clicar no grupo alterna a visibilidade
   * do `<ul>` de filhos, sem navegar). O grupo que contém a rota atual
   * já nasce expandido (`isExpanded` em render-shell.js); isto só cobre
   * a interação manual do usuário depois da primeira renderização.
   * Precisa ser religado a cada navegação pelo mesmo motivo de
   * bindSidebarToggle, acima.
   */
  function bindSidebarGroups() {
    documentRef.body.querySelectorAll?.('[data-admin-sidebar-group]')?.forEach?.((toggle) => {
      toggle.addEventListener?.('click', (event) => {
        event?.preventDefault?.();
        const submenu = toggle.nextElementSibling;
        const isExpanded = toggle.getAttribute?.('aria-expanded') === 'true';
        toggle.setAttribute?.('aria-expanded', isExpanded ? 'false' : 'true');
        submenu?.classList?.toggle?.('mm-show', !isExpanded);
      });
    });
  }

  /*
   * Abas do formulário de configuração (render-form.js: `role="tablist"`
   * quando SITE_CONFIG_FIELDS declara `tab`). Padrão ARIA Tabs manual
   * (sem framework): clicar num botão mostra o painel correspondente
   * (por `aria-controls`/id) e esconde os demais, atualizando
   * `aria-selected`/`tabindex` — nunca os dois painéis visíveis ao mesmo
   * tempo. Precisa ser religado a cada navegação pelo mesmo motivo de
   * bindSidebarToggle, acima.
   *
   * Achado real confirmado por inspeção visual ao vivo: um editor
   * TinyMCE criado sobre um `<textarea>` que já está dentro de um
   * painel `hidden` mede o espaço disponível no momento exato da
   * criação (0×0, por estar oculto) e NUNCA se recalcula sozinho
   * depois — mostrar a aba de novo não resolve, o editor fica
   * permanentemente invisível/sem altura. Por isso bindRichTextEditors
   * (abaixo) nunca inicializa um campo cujo painel já nasce oculto;
   * em vez disso, guarda o id em `pendingRichTextElementIds` e esta
   * função monta o editor correspondente só no momento em que o
   * painel é revelado pelo clique (quando o DOM já tem dimensões
   * reais) — nunca ao digitar/trocar de aba repetidamente, por isso
   * `pendingRichTextElementIds` remove o id assim que é consumido.
   */
  function bindTabHandlers() {
    const navigationId = latestNavigation;
    const buttons = Array.from(documentRef.body.querySelectorAll?.('[data-admin-tab-button]') ?? []);
    const activate = (button) => {
      if (navigationId !== latestNavigation) return;
      const panelId = button.getAttribute?.('aria-controls');
      buttons.forEach?.((otherButton) => {
        const isTarget = otherButton === button;
        otherButton.setAttribute?.('aria-selected', isTarget ? 'true' : 'false');
        otherButton.setAttribute?.('tabindex', isTarget ? '0' : '-1');
        const panel = documentRef.body.querySelector?.(`#${otherButton.getAttribute?.('aria-controls')}`);
        if (panel) panel.hidden = panel.id !== panelId;
      });
      if (pendingRichTextElementIds.length) mountPendingRichTextEditorsInPanel(panelId, navigationId);
    };
    buttons.forEach?.((button, index) => {
      button.addEventListener?.('click', () => activate(button));
      button.addEventListener?.('keydown', (event) => {
        const target = event?.key === 'ArrowRight' ? (index + 1) % buttons.length : event?.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length : event?.key === 'Home' ? 0 : event?.key === 'End' ? buttons.length - 1 : null;
        if (target === null) return;
        event.preventDefault?.();
        activate(buttons[target]);
        buttons[target].focus?.();
      });
    });
  }

  /*
   * Editor rico real (src/administrator/components/com_minijoomla/editor.js) sobre cada
   * `<textarea data-admin-richtext>` da tela atual (articletext de
   * Artigos, customHtmlBody da configuração do site — ver
   * field-schemas.js). Destrói qualquer instância da navegação
   * anterior ANTES de montar as novas, mesmo motivo de
   * `documentRef.body.innerHTML` ser substituído por completo a cada
   * `onNavigate`: um editor TinyMCE "pendurado" continuaria escutando
   * eventos de um elemento que não existe mais no DOM. Sem
   * `richTextEditorFactory` informado (composição que não publicou o
   * vendor do TinyMCE ainda), os campos continuam `<textarea>` simples
   * — nunca lança, nunca bloqueia a tela.
   *
   * Um campo cujo `<textarea>` está dentro de um painel de aba já
   * `hidden` neste momento (ver bindTabHandlers acima para o porquê)
   * nunca é inicializado aqui — só entra em `pendingRichTextElementIds`,
   * para ser montado por `mountPendingRichTextEditorsInPanel` no
   * instante em que o usuário realmente revelar aquela aba.
   *
   * `data-admin-readmore` (render-form.js, só em ARTICLE_FIELDS.
   * articletext): repassado como segundo argumento de
   * `richTextEditorFactory` para que a composição real
   * (attachRichTextEditor) monte o botão real "Leia mais" — nunca
   * decidido aqui, que não sabe o que é um editor TinyMCE.
   */
  function hasReadMoreMarker(element) { return Boolean(element.hasAttribute?.('data-admin-readmore')); }

  function destroyEditors(editors) {
    for (const editor of editors) {
      try { editor.destroy?.(); } catch { /* cleanup must not block navigation */ }
    }
  }

  function cleanupRichTextEditors() {
    destroyEditors(activeRichTextEditors);
    activeRichTextEditors = [];
    pendingRichTextElementIds = [];
  }

  function mountEditors(elements, navigationId) {
    // Serialize by DOM ownership: editor.js destroys by element id. Never
    // allow an obsolete initializer to destroy a newer editor with that id.
    editorMounts = editorMounts.then(async () => {
      if (navigationId !== latestNavigation) return;
      const results = await Promise.allSettled(elements.map((element) => Promise.resolve().then(() => richTextEditorFactory(element.id, { readMoreButton: hasReadMoreMarker(element) }))));
      const editors = results.filter((result) => result.status === 'fulfilled').map((result) => result.value).filter(Boolean);
      if (navigationId !== latestNavigation) { destroyEditors(editors); return; }
      activeRichTextEditors.push(...editors);
      if (results.some((result) => result.status === 'rejected')) {
        const status = documentRef.body.querySelector?.('.admin-form-status');
        if (status) status.textContent = 'Editor rico indisponível. O campo de texto continua disponível; nenhum conteúdo foi alterado.';
      }
    });
    return editorMounts;
  }

  async function bindRichTextEditors(navigationId) {
    if (!richTextEditorFactory) return;
    const elements = Array.from(documentRef.body.querySelectorAll?.('[data-admin-richtext]') ?? []);
    const visibleElements = elements.filter((element) => !element.closest?.('[data-admin-tab-panel][hidden]'));
    const hiddenElements = elements.filter((element) => element.closest?.('[data-admin-tab-panel][hidden]'));
    pendingRichTextElementIds = hiddenElements.map((element) => element.id);
    await mountEditors(visibleElements, navigationId);
  }

  /*
   * Monta, de uma vez, todo editor rico pendente cujo `<textarea>` está
   * dentro do painel que acabou de ser revelado (`panelId`) — nunca os
   * de outros painéis, que continuam ocultos. Chamado só por
   * bindTabHandlers, no momento exato do clique que revela a aba.
   */
  function mountPendingRichTextEditorsInPanel(panelId, navigationId) {
    const panel = documentRef.body.querySelector?.(`#${panelId}`);
    if (!panel) return;
    const idsInPanel = pendingRichTextElementIds.filter((elementId) => panel.querySelector?.(`#${elementId}`));
    if (!idsInPanel.length) return;
    pendingRichTextElementIds = pendingRichTextElementIds.filter((elementId) => !idsInPanel.includes(elementId));
    mountEditors(idsInPanel.map((elementId) => panel.querySelector(`#${elementId}`)), navigationId);
  }

  const router = new Router({ base: basePath, onNavigate: async (location) => {
    if (stopped) return;
    const navigationId = ++latestNavigation;
    pluginRuntime?.cancelPending?.();
    let pluginError = false;
    if (pluginRuntime) {
      try {
        await pluginRuntime.start();
        if (navigationId !== latestNavigation || stopped) return;
        await pluginRuntime.refresh({ isCurrent: () => navigationId === latestNavigation && !stopped });
      } catch { pluginError = true; }
    }
    if (navigationId !== latestNavigation || stopped) return;
    const { html, etag, management, bind, record } = await renderRoute(location, navigationId);
    await editorMounts;
    if (navigationId !== latestNavigation) return;
    if (!documentRef) return;
    cleanupRichTextEditors();
    // Keep plugin/configuration screens available to repair the catalog. Saves
    // still recheck it and fail closed, rather than running without plugins.
    documentRef.body.innerHTML = (pluginError ? '<p role="alert">Plugins administrativos indisponíveis. Recarregue antes de salvar.</p>' : '') + html;
    bindSidebarToggle();
    bindSidebarGroups();
    bindTabHandlers();
    if (bind) { await bindRichTextEditors(navigationId); if (navigationId === latestNavigation) bind(); return; }
    bindListSearch(location, navigationId);
    bindManagementHandlers(management, location, navigationId);
    await bindRichTextEditors(navigationId);
    if (navigationId !== latestNavigation) return;
    const domainMatch = location.path.match(/^\/([a-zA-Z]+)(?:\/(new|\d+))?$/);
    if (domainMatch && DOMAIN_KEYS.includes(domainMatch[1]) && domainMatch[2] !== undefined) bindFormHandlers(domainMatch[1], domainMatch[2], etag, navigationId, record);
    else if (location.path === '/config') bindFormHandlers('config', undefined, etag, navigationId, record);
    // Listagem de domínio pura (sem `new`/id): estes menus de coluna são
    // ligados aqui porque estas páginas não têm `bind()` próprio — os
    // módulos de páginas de conteúdo/extensão ligam os seus no `bind()`.
    if (domainMatch && DOMAIN_KEYS.includes(domainMatch[1]) && domainMatch[2] === undefined) {
      const domain = domainMatch[1];
      const navigate = (href) => { if (navigationId === latestNavigation) router.navigate(href); };
      const link = (path, params) => router.link(path, params);
      bindColumnFilters({
        location, link, navigate, scope: documentRef, domain,
        filters: columnFilterDefinitions(domain, management?.rows ?? [], canonicalizeParams(domain, location.params ?? {}))
      });
    }
  }});

  const application = { router, start: () => {
    if (started) return starting;
    started = true;
    stopped = false;
    starting = router.start([{ name: 'admin', pattern: /^.*$/, keys: [] }]);
    return starting;
  }, stop: () => {
    started = false;
    stopped = true;
    latestNavigation += 1;
    router.stop();
    cleanupRichTextEditors();
    return pluginRuntime?.stop?.();
  } };
  if (autoStart) application.start();
  return application;
}
