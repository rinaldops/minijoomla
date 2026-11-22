/*
 * Núcleo único do filtro por coluna do painel administrativo.
 *
 * Antes desta versão cada página (app.js, content-pages.js,
 * extension-pages.js) tinha sua própria cópia do ligador de menus, do
 * cálculo de valores distintos e do formato do parâmetro na URL. As três
 * cópias divergiam em detalhes (roving tabindex, fechamento dos outros
 * menus, precedência entre `col_<campo>` e o filtro da barra), e foi essa
 * divergência que produziu o defeito real de produção: `render-list.js`
 * emitia o `<ul>` do menu sem `data-colfilter-menu`, e nenhum dos três
 * ligadores reclamava — todos recebiam `null` e saíam em silêncio.
 *
 * Aqui vive o que é comum aos três: a TABELA de parâmetros canônicos por
 * domínio e coluna (com os aliases que a 0.17.14 já publicava), o CODEC
 * do formato múltiplo da URL e o AGREGADOR de facetas. O ligador de DOM
 * também é único (`bindColumnFilters`) e substitui as três cópias.
 *
 * Módulo puro: não lê `document`, `location` nem `storage`. O documento e
 * o router entram sempre por parâmetro, e por isso o mesmo código é
 * testável sem navegador.
 */
import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';

// ---------------------------------------------------------------------------
// 1. Chave canônica, aliases e tabela por domínio
// ---------------------------------------------------------------------------

/*
 * Chave canônica: o nome que o SERVIÇO já lê hoje (`admin-service.js`).
 * Não é o nome da coluna na tabela nem o nome do parâmetro que a 0.17.14
 * gravava. As formas `col_<campo>` da 0.17.14 são ALIASES DE ENTRADA:
 * continuam válidas na URL e na memória, e são convertidas para a chave
 * canônica na leitura. Toda URL gerada a partir desta versão usa somente a
 * chave canônica.
 */
export const CANONICAL_COLUMNS = {
  articles: [
    { column: 'state', key: 'state', aliases: ['col_state'], label: 'Estado' },
    { column: 'title', key: 'title', aliases: ['col_title'], label: 'Título' },
    { column: 'alias', key: 'alias', aliases: ['col_alias'], label: 'Alias' },
    // `categoryId` é ID canônico e tem semântica própria: um valor simples
    // inclui os descendentes (contrato antigo de Artigos), o formato
    // múltiplo significa o conjunto exato de IDs.
    { column: 'category', key: 'categoryId', aliases: ['col_category', 'col_categoryId'], label: 'Categoria', multiIsExact: true, tree: true },
    { column: 'author', key: 'author', aliases: ['col_author'], label: 'Autor' },
    { column: 'publishUp', key: 'publishUp', aliases: [], label: 'Data' },
    { column: 'featured', key: 'featured', aliases: ['col_featured'], label: 'Destaque' },
    { column: 'id', key: 'id', aliases: ['col_id'], label: 'ID' }
  ],
  categories: [
    { column: 'state', key: 'state', aliases: ['col_state'], label: 'Estado' },
    { column: 'title', key: 'title', aliases: ['col_title'], label: 'Título' },
    { column: 'alias', key: 'alias', aliases: ['col_alias'], label: 'Alias' },
    { column: 'id', key: 'id', aliases: ['col_id'], label: 'ID' }
  ],
  tags: [
    { column: 'state', key: 'state', aliases: ['col_state'], label: 'Estado' },
    { column: 'title', key: 'title', aliases: ['col_title'], label: 'Nome' },
    { column: 'alias', key: 'alias', aliases: ['col_alias'], label: 'Alias' },
    { column: 'id', key: 'id', aliases: ['col_id'], label: 'ID' }
  ],
  modules: [
    { column: 'state', key: 'state', aliases: ['col_state'], label: 'Estado' },
    { column: 'title', key: 'title', aliases: ['col_title'], label: 'Título' },
    { column: 'type', key: 'type', aliases: ['col_type'], label: 'Tipo de módulo' },
    { column: 'position', key: 'position', aliases: ['col_position'], label: 'Posição' },
    { column: 'id', key: 'id', aliases: ['col_id'], label: 'ID' }
  ],
  plugins: [
    { column: 'state', key: 'state', aliases: ['col_state'], label: 'Estado' },
    { column: 'title', key: 'title', aliases: ['col_title'], label: 'Nome do plugin' },
    { column: 'group', key: 'group', aliases: ['col_group'], label: 'Grupo' },
    { column: 'key', key: 'key', aliases: ['col_key'], label: 'Elemento' },
    { column: 'id', key: 'id', aliases: ['col_id'], label: 'ID' }
  ],
  styles: [
    { column: 'style', key: 'style', aliases: ['col_style'], label: 'Estilo' },
    { column: 'template', key: 'template', aliases: ['col_template'], label: 'Template' }
  ],
  templates: [
    { column: 'name', key: 'name', aliases: ['col_name', 'col_template'], label: 'Nome' },
    { column: 'id', key: 'id', aliases: ['col_id'], label: 'ID' }
  ],
  extensions: [
    { column: 'type', key: 'type', aliases: ['col_type'], label: 'Tipo' },
    { column: 'name', key: 'name', aliases: ['col_name'], label: 'Nome' },
    { column: 'id', key: 'id', aliases: ['col_id'], label: 'ID' }
  ],
  menus: [
    { column: 'title', key: 'title', aliases: ['col_title'], label: 'Título' },
    { column: 'id', key: 'id', aliases: ['col_id'], label: 'ID' }
  ]
};

/*
 * Índice reverso alias -> chave canônica, por domínio. `col_categoryId`
 * aparece como alias de `categoryId` porque a 0.17.14 também publicava essa
 * forma na lista de Artigos.
 */
const ALIAS_INDEX = new Map(Object.entries(CANONICAL_COLUMNS).map(([domain, columns]) => [domain, (() => {
  const index = new Map();
  for (const entry of columns) for (const alias of entry.aliases) index.set(alias, entry.key);
  return index;
})()]));

export function columnsForDomain(domain) { return CANONICAL_COLUMNS[domain] ?? []; }

export function canonicalKey(domain, name) {
  const columns = columnsForDomain(domain);
  const direct = columns.find((entry) => entry.key === name);
  if (direct) return direct.key;
  return ALIAS_INDEX.get(domain)?.get(name) ?? name;
}

/*
 * Normaliza os parâmetros que chegam da URL ou da memória para as chaves
 * canônicas. Precedência: quando a chave canônica e um alias vêm juntos na
 * mesma query, a canônica vence e o alias é descartado — a URL tem uma
 * única verdade, e a canônica é a que o serviço já lê.
 */
export function canonicalizeParams(domain, params = {}) {
  const out = {};
  const aliased = [];
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    const key = canonicalKey(domain, name);
    // Quem JÁ chegou canônico tem precedência, independentemente da ordem
    // em que apareceu na query.
    if (key === name) { out[key] = String(value); continue; }
    aliased.push([key, String(value)]);
  }
  for (const [key, value] of aliased) if (!Object.hasOwn(out, key)) out[key] = value;
  return out;
}

// ---------------------------------------------------------------------------
// 2. Codec do formato múltiplo
// ---------------------------------------------------------------------------

/*
 * O codec do filtro de coluna (envelope `~m:`, token de vazio, facetas)
 * vive na CAMADA DE BIBLIOTECA (list-filter-params.js), porque o serviço
 * que aplica o filtro não pode depender do administrador. Aqui só o
 * reexportamos: assim a UI continua importando tudo de column-filter.js e
 * as duas pontas leem exatamente o mesmo formato.
 */
import { MULTI_PREFIX, EMPTY_TOKEN, EMPTY_VALUE, isEmptyValue, normalizeFacetValue, parseMulti, serializeMulti, buildColumnFacets } from '../../../libraries/minijoomla/application/list-filter-params.js';

export { MULTI_PREFIX, EMPTY_TOKEN, EMPTY_VALUE, isEmptyValue, normalizeFacetValue, parseMulti, serializeMulti, buildColumnFacets };

/*
 * Limite de comprimento da URL. Passar dele é erro EXPLÍCITO e visível no
 * rodapé do painel: nunca descartamos valores em silêncio.
 */
export const URL_LENGTH_LIMIT = 1800;
export const URL_TOO_LONG_MESSAGE = 'Seleção grande demais para aplicar. Use a busca para reduzir os valores.';

export function urlFitsLimit(href) {
  return String(href ?? '').length <= URL_LENGTH_LIMIT;
}


/*
 * Todo `totalBase` exclui os filtros de coluna e de gerenciamento
 * selecionados, mas mantém a busca `q` e os padrões de visibilidade de
 * cada domínio (em Artigos, "todos, exceto a lixeira"). Sem isto a barra
 * de filtros ativos não teria com o que comparar o total atual.
 */
export function countsByValue(rows, read) {
  const counts = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const value = normalizeFacetValue(read(row));
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

  /*
   * Rótulos e ORDEM das opções que o valor cru esconde (Adendo 3, 3.1).
   * Sem esta tabela o menu mostra "Published"/"Draft"/"1"/"0" — os valores
   * internos — em ordem alfabética, que não é a ordem em que o usuário pensa
   * os estados. `defaultSet` é o conjunto que a lista já aplica sozinha
   * quando o parâmetro está ausente: marcar exatamente esse conjunto deve
   * REMOVER o parâmetro, não gravá-lo na URL.
   */
  export const FACET_VALUE_LABELS = {
    articles: {
      state: { order: ['Published', 'Draft', 'Archived', 'Trashed'], labels: { Published: 'Publicado', Draft: 'Despublicado', Archived: 'Arquivado', Trashed: 'Na lixeira' }, defaultSet: ['Published', 'Draft', 'Archived'] },
      featured: { order: ['1', '0'], labels: { 1: 'Em destaque', 0: 'Sem destaque' } }
    },
    categories: {
      state: { order: ['Published', 'Draft', 'Trashed'], labels: { Published: 'Publicado', Draft: 'Despublicado', Trashed: 'Na lixeira' }, defaultSet: ['Published', 'Draft'] }
    },
    tags: {
      state: { order: ['Published', 'Draft', 'Trashed'], labels: { Published: 'Publicado', Draft: 'Despublicado', Trashed: 'Na lixeira' }, defaultSet: ['Published', 'Draft'] }
    },
    /*
     * Tipo de extensão (Adendo 3, 3.1): a coluna publicava o identificador
     * cru do manifesto ("component", "module", "plugin"…) — o mesmo tipo de
     * defeito da coluna Estado, que mostrava "Published". A ordem é a de
     * exibição do Joomla (componente, módulo, plugin, template, idioma,
     * biblioteca, pacote), não alfabética.
     */
    extensions: {
      type: { order: ['component', 'module', 'plugin', 'template', 'language', 'library', 'package'], labels: { component: 'Componente', module: 'Módulo', plugin: 'Plugin', template: 'Template', language: 'Idioma', library: 'Biblioteca', package: 'Pacote' } }
    }
  };

  export function facetValueLabel(domain, key, value) {
    const table = FACET_VALUE_LABELS[domain]?.[key];
    if (!table) return null;
    return table.labels?.[value] ?? null;
  }

  export function facetValueOrder(domain, key, values) {
    const order = FACET_VALUE_LABELS[domain]?.[key]?.order;
    const list = [...values];
    if (!order) return list;
    return list.sort((a, b) => {
      const ia = order.indexOf(String(a));
      const ib = order.indexOf(String(b));
      if (ia === -1 && ib === -1) return String(a).localeCompare(String(b), 'pt-BR');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  export function facetDefaultSet(domain, key) {
    return FACET_VALUE_LABELS[domain]?.[key]?.defaultSet ?? null;
  }

// ---------------------------------------------------------------------------
// 4. Apresentação: botão e painel
// ---------------------------------------------------------------------------

function sortActions(filter) {
  return Array.isArray(filter.sortActions) ? filter.sortActions : [];
}

/*
 * Botão do cabeçalho: só o ícone, sem texto e sem o valor selecionado
 * (o valor aparece na barra de filtros ativos). Inativo é o caret cinza;
 * ativo é o funil preenchido em cor de link, com o rótulo acessível
 * dizendo quantos valores estão filtrados.
 */
export function renderColumnFilterButton(filter, index = 0) {
  const values = Array.isArray(filter.values) ? filter.values : [];
  const active = values.length > 0;
  const label = filter.label ?? filter.column;
  const described = active ? `Filtrar coluna ${label} (filtro ativo: ${values.length} valores)` : `Filtrar coluna ${label}`;
  const panelId = `admin-colfilter-panel-${index}-${String(filter.key ?? filter.column).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const icon = active
    ? '<svg class="admin-colfilter-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M1 1h10L7.2 5.6V11L4.8 9.8V5.6L1 1Z"/></svg>'
    : '<span class="admin-colfilter-caret" aria-hidden="true">▾</span>';
  return `<button type="button" class="admin-colfilter-toggle${active ? ' is-active' : ''}" data-colfilter data-colfilter-toggle`
    + ` data-colfilter-column="${escapeHtml(filter.column)}" data-colfilter-key="${escapeHtml(filter.key ?? filter.column)}"`
    + ` data-colfilter-values="${escapeHtml(values.join('\u0001'))}"`
    + ` aria-haspopup="dialog" aria-expanded="false" aria-controls="${panelId}" aria-label="${escapeHtml(described)}">${icon}</button>`;
}

function renderValueRow(filter, value, label, count, selected, { tree = false, depth = 0 } = {}) {
  const indent = tree && depth ? ` style="padding-left:${(1 + depth).toFixed(2)}rem"` : '';
  const depthAttribute = tree ? ` data-colfilter-depth="${escapeHtml(String(depth))}"` : '';
  return `<label class="admin-colfilter-option" data-colfilter-option data-colfilter-value="${escapeHtml(value)}"${depthAttribute}${indent}>`
    + `<input type="checkbox" value="${escapeHtml(value)}"${selected ? ' checked' : ''}>`
    + `<span class="admin-colfilter-option-label"${filter.tree && label !== value ? ` title="${escapeHtml(label)}"` : ''}>${escapeHtml(label)}</span>`
    + `<span class="admin-colfilter-option-count" aria-hidden="true">${escapeHtml(String(count))}</span></label>`;
}

/*
 * Painel do filtro, em HTML puro. É um diálogo NÃO MODAL: `aria-modal`
 * é "false" e o Tab não fica preso dentro (sair pelo Tab equivale a
 * Cancelar). Ordem interna: título, ordenação, divisor, limpar, busca,
 * lista de valores e rodapé com OK/Cancelar.
 */
export function renderColumnFilterPanel(filter, index = 0) {
  const values = Array.isArray(filter.values) ? filter.values : [];
  const selected = new Set(values);
    /*
     * Rótulo e ordem humanos (Adendo 3, 3.1): o valor cru ("Published",
     * "1") não é o que o usuário lê, e a ordem alfabética dos valores crus
     * não é a ordem em que ele pensa os estados. A tabela é aplicada aqui,
     * uma única vez, para os três chamadores.
     */
    const rawOptions = Array.isArray(filter.options) ? filter.options : [];
    /*
     * Os chamadores históricos passam valores crus (`['sidebar-left', …]`) e o
     * painel novo passa objetos `{value,label,count}`. Normalizar aqui, no
     * único ponto que renderiza, evita que cada lista repita a conversão — e
     * era essa divergência que fazia a coluna Tipo de extensão exibir
     * "module" cru enquanto a busca mostrava "Módulo".
     */
    const normalizedOptions = rawOptions.map((option) => (option && typeof option === 'object' ? option : { value: option }));
    const domain = filter.domain ?? '';
    const key = filter.key ?? filter.column;
    const order = facetValueOrder(domain, key, normalizedOptions.map((option) => option.value));
    const position = new Map(order.map((value, index) => [String(value), index]));
    const options = [...normalizedOptions].sort((a, b) => (position.get(String(a.value)) ?? 0) - (position.get(String(b.value)) ?? 0))
      .map((option) => ({ ...option, label: facetValueLabel(domain, key, option.value) ?? option.label ?? option.value }));
    const defaultSet = facetDefaultSet(domain, key);
    /*
     * Hierarquia (Adendo 3, 3.4): a coluna Categoria é a única com árvore, e
     * resolvê-la aqui deixa os três chamadores herdarem a regra em vez de
     * repeti-la (o mesmo critério do `defaultSet` acima).
     */
    const canonical = columnsForDomain(domain).find((entry) => entry.key === key);
    filter = { ...filter, tree: Boolean(filter.tree ?? canonical?.tree) };
  const label = filter.label ?? filter.column;
  const panelId = `admin-colfilter-panel-${index}-${String(filter.key ?? filter.column).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const sorts = sortActions(filter);
  const sortRow = sorts.length
    ? `<div class="admin-colfilter-sorts" role="group" aria-label="Ordenar por ${escapeHtml(label)}">${sorts.map((action) => {
      const isCurrent = action.current === true;
      return `<button type="button" class="admin-colfilter-sort" data-colfilter-sort data-colfilter-sort-key="${escapeHtml(action.key)}" data-colfilter-sort-dir="${escapeHtml(action.dir)}">`
        + `<span class="admin-colfilter-sort-check" aria-hidden="true">${isCurrent ? '✓' : ''}</span>${escapeHtml(action.label)}</button>`;
    }).join('')}</div><div class="admin-colfilter-divider" role="separator"></div>`
    : '';
  /*
   * "Limpar filtro" depende da URL, não das caixas (Adendo 3, 1.4): com a
   * 1.3 uma coluna sem filtro abre com TUDO marcado, então habilita-lo
   * pelo estado das caixas o deixaria sempre disponível. O único critério
   * válido é "existe um filtro ativo para esta coluna".
   */
  const clearDisabled = selected.size === 0;
  const empty = options.length === 0;
  /*
   * Sem parâmetro para a coluna, a lista abre com TUDO marcado — como o
   * AutoFiltro do Excel, onde "sem filtro" significa "todos os valores".
   * Antes, sem filtro nenhuma caixa vinha marcada e o OK nascia
   * desabilitado, sugerindo que não havia nada para confirmar.
   */
  const checked = (option) => {
    if (selected.size) return selected.has(option.value);
    if (filter.unfiltered === false) return false;
    /*
     * Sem parâmetro, a lista mostra o conjunto ATIVO de verdade — não
     * necessariamente todos os valores (Adendo 3, 3.1/1.3): em Artigos o
     * padrão é Publicado+Despublicado+Arquivado, com "Na lixeira" fora.
     */
    if (defaultSet) return defaultSet.includes(String(option.value));
    return true;
  };
  const rows = options.map((option) => renderValueRow(filter, option.value, option.label ?? option.value, option.count ?? 0, checked(option), { tree: filter.tree, depth: option.depth ?? 0 })).join('');
  const anyChecked = options.some((option) => checked(option));
  return `<div class="admin-colfilter-panel" id="${panelId}" data-colfilter-panel role="dialog" aria-modal="false" aria-labelledby="${panelId}-title" hidden>`
    + `<h2 class="admin-colfilter-title" id="${panelId}-title">${escapeHtml(label)}</h2>${sortRow}`
    + `<button type="button" class="admin-colfilter-clear" data-colfilter-clear${clearDisabled ? ' disabled aria-disabled="true"' : ''}>Limpar filtro de "${escapeHtml(label)}"</button>`
    + `<input type="search" class="admin-colfilter-search" data-colfilter-search placeholder="Pesquisar" aria-label="${escapeHtml(`Pesquisar valores de ${label}`)}" autocomplete="off">`
    + `<div class="admin-colfilter-group" data-colfilter-group role="group" aria-label="${escapeHtml(`Valores de ${label}`)}">`
    + `<label class="admin-colfilter-option admin-colfilter-all"><input type="checkbox" data-colfilter-all><span class="admin-colfilter-option-label" data-colfilter-all-label>(Selecionar tudo)</span></label>`
    + `<div class="admin-colfilter-values" data-colfilter-values>${rows}</div></div>`
    + `<div class="admin-colfilter-footer"><button type="button" class="admin-btn admin-btn-ghost" data-colfilter-cancel>Cancelar</button>`
    + `<button type="button" class="admin-btn admin-btn-primary" data-colfilter-ok${anyChecked ? '' : ' disabled'}>OK</button></div>`
    + `<p class="admin-colfilter-error" data-colfilter-error role="alert" hidden>${escapeHtml(URL_TOO_LONG_MESSAGE)}</p>`
    + `${empty ? '<p class="admin-colfilter-empty" role="status">Nenhum valor disponível.</p>' : ''}</div>`;
}

// ---------------------------------------------------------------------------
// 5. Posicionamento do painel
// ---------------------------------------------------------------------------

export const PANEL_MARGIN = 8;
export const PANEL_OFFSET = 4;

/*
 * Coordenadas (left/top) do painel em CSS px RELATIVOS à caixa de
 * posicionamento da layer. TODO o cálculo é feito em coordenadas da
 * JANELA e só no fim convertido para a layer (Adendo 3, 2.1): misturar as
 * duas coisas (medir espaço com `button.top - container.top` e comparar
 * com a altura da janela) quebra assim que a raiz do painel não começa em
 * `top: 0` — no SharePoint ela começa abaixo do cabeçalho (~150 px) — ou
 * quando a página rola.
 *
 * Abre abaixo do botão; se não couber e houver mais espaço acima, abre
 * acima; se nenhum dos lados comportar a altura, limita a altura ao
 * espaço do lado maior e o painel rola internamente (`maxHeight`). A
 * borda direita alinha à borda direita do botão quando o painel passaria
 * da área visível.
 */
export function placePanel(buttonRect, panelSize, containerRect, viewport) {
  const view = {
    left: Number(viewport?.left) || 0,
    top: Number(viewport?.top) || 0,
    width: Number(viewport?.width) || 0,
    height: Number(viewport?.height) || 0
  };
  const container = { left: Number(containerRect?.left) || 0, top: Number(containerRect?.top) || 0 };
  const button = {
    left: Number(buttonRect?.left) || 0,
    top: Number(buttonRect?.top) || 0,
    width: Number(buttonRect?.width) || 0,
    height: Number(buttonRect?.height) || 0,
    right: Number(buttonRect?.right) || (Number(buttonRect?.left) || 0) + (Number(buttonRect?.width) || 0),
    bottom: Number(buttonRect?.bottom) || (Number(buttonRect?.top) || 0) + (Number(buttonRect?.height) || 0)
  };
  const panelHeight = Number(panelSize?.height) || 0;
  const width = Math.min(Number(panelSize?.width) || 0, Math.max(0, view.width - PANEL_MARGIN * 2));
  const viewportBottom = view.top + view.height;
  const spaceBelow = viewportBottom - button.bottom - PANEL_OFFSET - PANEL_MARGIN;
  const spaceAbove = button.top - view.top - PANEL_OFFSET - PANEL_MARGIN;
  const belowFits = panelHeight <= spaceBelow;
  const aboveFits = panelHeight <= spaceAbove;
  const openAbove = !belowFits && (aboveFits || spaceAbove > spaceBelow);
  const sideSpace = openAbove ? spaceAbove : spaceBelow;
  const usedHeight = Math.min(panelHeight, Math.max(0, sideSpace));
  const topV = openAbove ? button.top - PANEL_OFFSET - usedHeight : button.bottom + PANEL_OFFSET;
  let leftV = button.left;
  if (leftV + width > view.left + view.width - PANEL_MARGIN) leftV = button.right - width;
  if (leftV < view.left + PANEL_MARGIN) leftV = view.left + PANEL_MARGIN;
  return {
    left: leftV - container.left,
    top: topV - container.top,
    width,
    maxHeight: Math.max(0, sideSpace),
    openAbove
  };
}

// ---------------------------------------------------------------------------
// 6. Ligador único de DOM
// ---------------------------------------------------------------------------

/*
 * Estado de um painel aberto vive aqui e nunca em `globalThis`: dois apps
 * no mesmo processo (testes) não podem compartilhar qual painel está
 * aberto. Um documento só pode ter um painel aberto por vez.
 */
const OPEN_PANELS = new WeakMap();

/*
 * Uma ligação ativa por DOCUMENTO. Sem isto, cada render soma um ouvinte
 * de `click` no documento (os chamadores ignoram o `dispose` devolvido) e
 * o painel deixa de fechar: o ouvinte antigo fecha e o novo reabre no
 * mesmo clique.
 */
const ACTIVE_BINDINGS = new WeakMap();

function closeOpenPanel(scope) {
  const state = OPEN_PANELS.get(scope);
  if (!state) return;
  state.close();
}

export function bindColumnFilters({ location = { path: '/', params: {} }, link, navigate, scope, domain, filters = [] } = {}) {
  const doc = scope?.ownerDocument ?? scope;
  if (!doc?.querySelectorAll) return;
  ACTIVE_BINDINGS.get(doc)?.();
  const containers = Array.from(doc.querySelectorAll('[data-colfilter-toggle]'));
  if (!containers.length) return;

  const layer = (() => {
      if (typeof doc.createElement !== 'function' || typeof (doc.querySelector('[data-minijoomla-admin-root]') ?? doc.body)?.appendChild !== 'function') return null;
    const root = doc.querySelector('[data-minijoomla-admin-root]') ?? doc.body;
    let element = doc.querySelector('.admin-colfilter-layer');
    if (!element) {
      element = doc.createElement('div');
      element.className = 'admin-colfilter-layer';
      root?.appendChild?.(element);
    }
    return element;
  })();
    if (!layer) return;

  const listeners = [];
  const on = (target, type, handler, options) => { target?.addEventListener?.(type, handler, options); listeners.push(() => target?.removeEventListener?.(type, handler, options)); };
    const dispose = () => {
      while (listeners.length) listeners.pop()();
      closeOpenPanel(scope);
      if (layer) layer.innerHTML = '';
      if (ACTIVE_BINDINGS.get(doc) === dispose) ACTIVE_BINDINGS.delete(doc);
    };
    ACTIVE_BINDINGS.set(doc, dispose);

  const applyFilter = (key, values, { multiIsExact = false, extra = {} } = {}) => {
    const raw = serializeMulti(values, { multiIsExact });
    const next = { ...(location.params ?? {}), ...extra };
    for (const [name, value] of Object.entries(next)) if (canonicalKey(domain, name) === key) delete next[name];
    if (raw) next[key] = raw;
    next.page = undefined;
    const href = link(location.path, next);
    if (!urlFitsLimit(href)) return { ok: false, message: URL_TOO_LONG_MESSAGE };
    navigate(href);
    return { ok: true };
  };

  const panels = [];
  containers.forEach((toggle, index) => {
    const key = toggle.dataset?.colfilterKey ?? '';
    const column = toggle.dataset?.colfilterColumn ?? key;
    const spec = filters.find((entry) => (entry.key ?? entry.column) === key || entry.column === column) ?? { key, column, label: column };
    panels.push({ toggle, key, column, spec, index });
  });

  // O layer recebe o HTML de um painel por vez; abrir outro fecha o anterior.
  const openPanel = (panel) => {
    closeOpenPanel(scope);
    const { toggle, key, spec, index } = panel;
    const selected = parseMulti((location.params?.[key] ?? ''));
    const filter = {
      ...spec,
          domain,
      key,
      column: spec.column ?? key,
      label: spec.label ?? key,
      values: selected.map((value) => (value === '' ? EMPTY_VALUE : value)),
      options: Array.isArray(spec.options) ? spec.options : [],
      sortActions: spec.sortActions
    };
    layer.innerHTML = renderColumnFilterPanel(filter, index);
    const dialog = layer.querySelector?.('[data-colfilter-panel]');
    if (!dialog) return;
    dialog.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    const search = dialog.querySelector?.('[data-colfilter-search]');
    search?.focus?.();

    const boxes = () => Array.from(dialog.querySelectorAll?.('[data-colfilter-values] input[type="checkbox"]') ?? []);
    const checked = () => boxes().filter((box) => box.checked).map((box) => box.value).filter((value) => value !== '');
    const ok = dialog.querySelector?.('[data-colfilter-ok]');
    const clear = dialog.querySelector?.('[data-colfilter-clear]');
    const all = dialog.querySelector?.('[data-colfilter-all]');
    const error = dialog.querySelector?.('[data-colfilter-error]');
    const syncTristate = () => {
      const visible = boxes().filter((box) => box.closest?.('label')?.hidden !== true);
      const on = visible.filter((box) => box.checked).length;
      if (all) { all.checked = visible.length > 0 && on === visible.length; all.indeterminate = on > 0 && on < visible.length; }
      if (ok) { ok.disabled = checked().length === 0; }
    };
    /*
     * Árvore de Categoria (Adendo 3, 3.4). O markup é plano, mas cada opção
     * carrega a profundidade; um filho é a opção seguinte de profundidade
     * maior até que apareça outra de profundidade menor ou igual. Marcar um
     * pai marca os descendentes presentes (e só eles — o conjunto gravado é
     * exatamente o que está na tela), e o pai fica `indeterminate` quando só
     * parte dos filhos está marcada, marcado quando todos estão. Sem
     * `filter.tree` nada disto roda: as demais colunas seguem sem hierarquia.
     */
    const treeRows = () => Array.from(dialog.querySelectorAll?.('[data-colfilter-values] [data-colfilter-option]') ?? []).map((row) => ({
      row,
      box: row.querySelector?.('input[type="checkbox"]'),
      depth: Number(row.dataset?.colfilterDepth ?? 0)
    })).filter((entry) => entry.box);
    const descendantsOf = (rows, index) => {
      const base = rows[index].depth;
      const out = [];
      for (let cursor = index + 1; cursor < rows.length && rows[cursor].depth > base; cursor += 1) out.push(rows[cursor].box);
      return out;
    };
    const refreshTreeState = () => {
      if (!filter.tree) return;
      const rows = treeRows();
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const descendants = descendantsOf(rows, index);
        if (!descendants.length) { rows[index].box.indeterminate = false; continue; }
        const on = descendants.filter((box) => box.checked).length;
        rows[index].box.checked = on === descendants.length;
        rows[index].box.indeterminate = on > 0 && on < descendants.length;
      }
    };
        /*
         * Busca pelo RÓTULO visível, sem acentos (Adendo 3, 3.3). Procurar em
         * `data-colfilter-value` falhava na Categoria (o valor é o ID, não o
         * caminho) e era sensível a acento ("agencia" não achava "Agência").
         */
        const normalizeText = (text) => String(text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
    const applySearch = (term) => {
          const needle = normalizeText(term).trim();
          for (const option of Array.from(dialog.querySelectorAll?.('[data-colfilter-values] [data-colfilter-option]') ?? [])) {
            const text = normalizeText(option.querySelector?.('[data-colfilter-option-label]')?.textContent ?? option.dataset?.colfilterValue ?? '');
            option.hidden = Boolean(needle) && !text.includes(needle);
      }
      const allLabel = dialog.querySelector?.('[data-colfilter-all-label]');
      if (allLabel) allLabel.textContent = needle ? '(Selecionar todos os resultados da pesquisa)' : '(Selecionar tudo)';
      syncTristate();
    };
    const close = (returnFocus = true) => {
      dialog.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      layer.innerHTML = '';
      OPEN_PANELS.delete(scope);
      if (returnFocus) toggle.focus?.();
    };
    const commit = () => {
      const chosen = checked();
      if (!chosen.length) return;
          /*
           * TODAS as opções marcadas equivalem a "sem filtro": não faz sentido
           * gravar a lista completa de valores na URL (o link ficaria enorme e
           * congelaria o conjunto, escondendo valores criados depois). Só a
           * coluna Estado tem um conjunto padrão diferente de "tudo": sem
           * `state`, a lista já esconde a lixeira, então o conjunto padrão
           * (Publicado+Despublicado+Arquivado) remove o parâmetro, e o
           * conjunto COM a lixeira é `state=*`.
           */
          const allValues = boxes().map((box) => box.value).filter((value) => value !== '');
          const stripped = chosen.map((value) => (value === EMPTY_VALUE ? '' : value));
          const everything = allValues.every((value) => chosen.includes(value));
                    /*
                     * O conjunto padrão vem da tabela central quando o chamador não
                     * declara um (Adendo 3, 3.1): assim os três chamadores herdam a
                     * regra de Estado sem repeti-la.
                     */
                    const defaultSet = spec.defaultSet ?? facetDefaultSet(domain, key);
                    if (everything && !defaultSet) {
            const result = applyFilter(key, []);
            if (!result.ok) { if (error) { error.hidden = false; error.textContent = result.message; } return; }
            close(false);
            return;
          }
                    if (defaultSet) {
                      const normal = [...defaultSet].sort().join('\u0001');
            const picked = [...new Set(stripped.filter((value) => value !== EMPTY_VALUE))].sort().join('\u0001');
            if (picked === normal) {
              const result = applyFilter(key, []);
              if (!result.ok) { if (error) { error.hidden = false; error.textContent = result.message; } return; }
              close(false);
              return;
            }
            if (everything) {
              const result = applyFilter(key, ['*']);
              if (!result.ok) { if (error) { error.hidden = false; error.textContent = result.message; } return; }
              close(false);
              return;
            }
          }
          const result = applyFilter(key, stripped, { multiIsExact: Boolean(spec.multiIsExact) });
      if (!result.ok) { if (error) { error.hidden = false; error.textContent = result.message; } return; }
      close(false);
    };
    const position = () => {
      const buttonRect = toggle.getBoundingClientRect?.();
      const layerRect = layer.getBoundingClientRect?.();
      const viewport = { left: 0, top: 0, width: doc.defaultView?.innerWidth ?? 0, height: doc.defaultView?.innerHeight ?? 0 };
      if (!buttonRect || !layerRect) return;
      const size = { width: dialog.offsetWidth ?? 0, height: dialog.offsetHeight ?? 0 };
      const placed = placePanel(buttonRect, size, { left: layerRect.left, top: layerRect.top, width: layerRect.width, height: layerRect.height }, viewport);
      dialog.style.left = `${placed.left}px`;
      dialog.style.top = `${placed.top}px`;
      dialog.style.width = `${placed.width}px`;
      dialog.style.maxHeight = `${placed.maxHeight}px`;
    };
    OPEN_PANELS.set(scope, { close, dispose, reposition: position });

    boxes().forEach((box) => box.addEventListener?.('change', () => {
      if (filter.tree) {
        const rows = treeRows();
        const index = rows.findIndex((entry) => entry.box === box);
        if (index >= 0) for (const child of descendantsOf(rows, index)) child.checked = Boolean(box.checked);
        refreshTreeState();
      }
      syncTristate();
    }));
    all?.addEventListener?.('change', () => { const on = Boolean(all.checked); for (const box of boxes()) if (box.closest?.('label')?.hidden !== true) box.checked = on; refreshTreeState(); syncTristate(); });
    search?.addEventListener?.('input', () => applySearch(search.value));
    search?.addEventListener?.('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault?.(); commit(); } });
    ok?.addEventListener?.('click', () => commit());
    clear?.addEventListener?.('click', () => { if (clear.disabled) return; const result = applyFilter(key, []); if (result.ok) close(false); });
    dialog.querySelector?.('[data-colfilter-cancel]')?.addEventListener?.('click', () => close());
    for (const sortButton of Array.from(dialog.querySelectorAll?.('[data-colfilter-sort]') ?? [])) {
      sortButton.addEventListener?.('click', () => {
        const next = { ...(location.params ?? {}), sort: sortButton.dataset?.colfilterSortKey, dir: sortButton.dataset?.colfilterSortDir, page: undefined };
        navigate(link(location.path, next));
      });
    }
    /*
         * Teclado na LISTA (Adendo 3, 3.5): as setas movem o foco entre
         * "(Selecionar tudo)" e as caixas VISÍVEIS (pulando as escondidas
         * pela busca) e o Espaço marca/desmarca — o comportamento nativo do
         * checkbox, que o double de DOM não garante.
         */
        dialog.addEventListener?.('keydown', (event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          const targets = [all, ...boxes().filter((box) => box.closest?.('label')?.hidden !== true)].filter(Boolean);
          if (!targets.length) return;
          event.preventDefault?.();
          const active = doc.activeElement;
          const current = targets.indexOf(active);
          const step = event.key === 'ArrowDown' ? 1 : -1;
          const next = current === -1 ? (step > 0 ? 0 : targets.length - 1) : (current + step + targets.length) % targets.length;
          targets[next]?.focus?.();
        });
        dialog.addEventListener?.('keydown', (event) => {
          if (event.key !== ' ') return;
          const box = doc.activeElement;
          if (!box || boxes().indexOf(box) === -1) return;
          event.preventDefault?.();
          box.checked = !box.checked;
          syncTristate();
        });
        dialog.addEventListener?.('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault?.(); close(); }
    });
    // Tab a partir do último controle (ou Shift+Tab do primeiro) CANCELA:
    // é um painel não modal, o foco não fica preso.
    dialog.addEventListener?.('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusables = Array.from(dialog.querySelectorAll?.('button:not([disabled]), input:not([disabled]), a[href]') ?? []);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = doc.activeElement;
      if (!event.shiftKey && active === last) { event.preventDefault?.(); close(); }
      if (event.shiftKey && active === first) { event.preventDefault?.(); close(); }
    });

    position();
    syncTristate();
  };

  on(doc, 'click', (event) => {
    const target = event?.target;
    const toggle = target?.closest?.('[data-colfilter-toggle]');
    if (!toggle) { if (!target?.closest?.('[data-colfilter-panel]')) closeOpenPanel(scope); return; }
    event.preventDefault?.();
    if (toggle.getAttribute?.('aria-expanded') === 'true') { closeOpenPanel(scope); return; }
    const panel = panels.find((entry) => entry.toggle === toggle);
    if (panel) openPanel(panel);
  });
    // Seta para baixo no botão abre o painel (Adendo 3, 3.5).
    on(doc, 'keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'Down') return;
      const toggle = event?.target?.closest?.('[data-colfilter-toggle]');
      if (!toggle || toggle.getAttribute?.('aria-expanded') === 'true') return;
      const panel = panels.find((entry) => entry.toggle === toggle);
      if (!panel) return;
      event.preventDefault?.();
      openPanel(panel);
    });
  on(doc.defaultView ?? doc, 'resize', () => { OPEN_PANELS.get(scope)?.reposition?.(); });
  on(doc.defaultView ?? doc, 'scroll', () => { OPEN_PANELS.get(scope)?.reposition?.(); }, true);

  return dispose;
}

// ---------------------------------------------------------------------------
// 7. Barra de filtros ativos
// ---------------------------------------------------------------------------

/*
 * Chips dos filtros ativos (coluna e barra do topo, exceto `q`). Cada chip
 * remove só o próprio filtro; "Limpar todos" remove apenas os filtros e
 * preserva `q`, `sort`, `dir`, `limit` e os padrões do domínio.
 */
export function renderActiveFilterChips(activeFilters, totalLabel = '') {
  if (!Array.isArray(activeFilters) || !activeFilters.length) return '';
  const chips = activeFilters.map((filter) => {
    const shown = filter.values.slice(0, 2);
    const extra = filter.values.length - shown.length;
    const text = `${filter.label}: ${shown.join(', ')}${extra > 0 ? ` +${extra}` : ''}`;
    return `<span class="admin-activefilter-chip" data-activefilter="${escapeHtml(filter.key)}">`
      + `<span class="admin-activefilter-text" title="${escapeHtml(filter.values.join(', '))}">${escapeHtml(text)}</span>`
      + `<button type="button" class="admin-activefilter-remove" data-activefilter-remove="${escapeHtml(filter.key)}" aria-label="${escapeHtml(`Remover filtro ${filter.label}`)}">×</button></span>`;
  }).join('');
  return `<div class="admin-activefilters" data-activefilters role="group" aria-label="Filtros ativos">`
    + `<span class="admin-activefilters-label">Filtros ativos:</span>${chips}`
    + `<button type="button" class="admin-activefilter-clearall" data-activefilter-clearall>Limpar todos</button>`
    + (totalLabel ? `<span class="admin-activefilters-total">${escapeHtml(totalLabel)}</span>` : '')
    + '</div>';
}

export { escapeHtml as escapeFilterHtml, safeUrl as safeFilterUrl };
