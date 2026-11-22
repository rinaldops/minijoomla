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
    { column: 'category', key: 'categoryId', aliases: ['col_category', 'col_categoryId'], label: 'Categoria', multiIsExact: true },
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
 * O envelope `~m:` existe porque um valor legado de Título, Alias ou Autor
 * pode conter vírgula de verdade ("Silva, Ana"). `Router.link()` passa por
 * `URLSearchParams` e `Router.parse()` devolve uma string já decodificada,
 * então a vírgula de um valor antigo é indistinguível de um separador novo
 * se o formato múltiplo não tiver um marcador próprio. Com o envelope:
 *
 *   valor sem `~m:`  -> EXATAMENTE um valor literal (mesmo com vírgula)
 *   `~m:` + itens   -> conjunto, itens separados por vírgula não escapada
 *
 * Dentro de cada item, para que a divisão seja sempre reversível: `\` vira
 * `\\`, `,` vira `\,` e um `~` inicial vira `\~`. O item vazio é o token
 * `~0`, e o texto literal `__vazio__` é escapado como `\__vazio__` para não
 * colidir com o marcador de vazio.
 */
export const MULTI_PREFIX = '~m:';
export const EMPTY_TOKEN = '~0';

/*
 * Marcador de vazio usado como VALOR de faceta e de item de conjunto.
 * `null`, `undefined` e string vazia são vazio; `0` e `false` não são
 * (são valores reais e são filtrados como qualquer outro).
 */
export const EMPTY_VALUE = '__vazio__';

export function isEmptyValue(value) {
  return value === undefined || value === null || value === '';
}

export function normalizeFacetValue(value) {
  return isEmptyValue(value) ? EMPTY_VALUE : String(value);
}

function escapeItem(item) {
  const text = String(item);
  if (text === '') return EMPTY_TOKEN;
  const escaped = text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/^~/, '\\~');
  // O texto literal `__vazio__` precisa continuar significando o texto, e
  // não o vazio, quando volta pelo codec.
  return escaped === EMPTY_VALUE ? `\\${escaped}` : escaped;
}

function unescapeItem(item) {
  if (item === EMPTY_TOKEN) return '';
  if (item === `\\${EMPTY_VALUE}`) return EMPTY_VALUE;
  let out = '';
  for (let index = 0; index < item.length; index += 1) {
    const char = item[index];
    if (char === '\\' && index + 1 < item.length) { out += item[index + 1]; index += 1; continue; }
    out += char;
  }
  return out;
}

/*
 * Separa os itens SOMENTE nas vírgulas não escapadas. Um `\` no fim da
 * string é literal: não há o que escapar depois dele.
 */
function splitItems(body) {
  const items = [];
  let current = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '\\' && index + 1 < body.length) { current += char + body[index + 1]; index += 1; continue; }
    if (char === ',') { items.push(current); current = ''; continue; }
    current += char;
  }
  items.push(current);
  return items;
}

/*
 * Valor cru da URL -> lista de valores selecionados. Sem `~m:` o valor é
 * um legado escalar e vira uma lista de um item: é o que preserva as URLs
 * de 0.17.14 com `A,B` como valor único.
 */
export function parseMulti(raw) {
  if (raw === undefined || raw === null || raw === '') return [];
  const text = String(raw);
  if (!text.startsWith(MULTI_PREFIX)) return [text];
  const body = text.slice(MULTI_PREFIX.length);
  if (body === '') return [];
  // `splitItems` nunca devolve item vazio para uma vírgula dupla (`a,,b`):
  // o item vazio é sempre o token `~0`, e por isso NÃO filtramos o
  // resultado — um filtro aqui apagaria o vazio que o menu selecionou.
  return splitItems(body).map(unescapeItem);
}

/*
 * Lista de valores -> valor cru da URL. Um único valor que não comece com
 * `~` continua saindo no formato legado (é o que mantém os links de
 * 0.17.14 válidos); qualquer outra situação — dois ou mais valores, ou um
 * valor que começa com `~` — sai no envelope.
 *
 * `multiIsExact` (Categoria) força o envelope mesmo com um valor só,
 * porque ali o conjunto é EXATO e não pode ser confundido com o valor
 * simples que expande descendentes.
 */
export function serializeMulti(values, { multiIsExact = false } = {}) {
  const list = (Array.isArray(values) ? values : [values]).map((value) => (value === undefined || value === null ? '' : String(value)));
  // `''` é o vazio SELECIONADO (`(Vazias)`): é um valor de filtro real e não
  // pode ser descartado. A lista só é considerada vazia quando não há item
  // nenhum.
  if (!list.length) return '';
  if (list.length === 1 && !multiIsExact && list[0] !== '' && !list[0].startsWith('~') && list[0] !== EMPTY_VALUE) return list[0];
  return `${MULTI_PREFIX}${list.map(escapeItem).join(',')}`;
}

/*
 * Limite de comprimento da URL. Passar dele é erro EXPLÍCITO e visível no
 * rodapé do painel: nunca descartamos valores em silêncio.
 */
export const URL_LENGTH_LIMIT = 1800;
export const URL_TOO_LONG_MESSAGE = 'Seleção grande demais para aplicar. Use a busca para reduzir os valores.';

export function urlFitsLimit(href) {
  return String(href ?? '').length <= URL_LENGTH_LIMIT;
}

// ---------------------------------------------------------------------------
// 3. Facetas por coluna
// ---------------------------------------------------------------------------

/*
 * Faceta de uma coluna X: os valores distintos de X no conjunto COMPLETO
 * da lista, considerando a busca `q`, os filtros de gerenciamento e TODOS
 * os filtros de coluna EXCETO o de X. O conjunto completo é lido uma única
 * vez pelo chamador; a função só agrega, nunca pagina nem busca.
 *
 * Sem a exclusão do próprio filtro, escolher "Estado: Publicado" apagaria
 * "Rascunho" do menu e o usuário não conseguiria trocar o valor — é o
 * comportamento que o filtro do Excel tem e que a versão anterior não
 * implementava (as opções vinham só da página atual).
 *
 * Um valor vazio (`null`, `undefined`, `''`) entra como `EMPTY_VALUE`
 * "(Vazias)" para que o usuário consiga filtrar registros sem valor.
 */
export function buildColumnFacets(rows, dimensions, params = {}, { matches = () => true } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const facets = {};
  for (const dimension of dimensions) {
    const active = new Set(parseMulti(params[dimension.key]).map((value) => (value === '' ? EMPTY_VALUE : value)));
    const ownFilterPresent = active.size > 0;
    const others = dimensions
      .filter((other) => other.key !== dimension.key && other.reads)
      .map((other) => ({ key: other.key, reads: other.reads, values: new Set(parseMulti(params[other.key]).map((value) => (value === '' ? EMPTY_VALUE : value))) }))
      .filter((other) => other.values.size > 0);
    const counts = new Map();
    for (const row of list) {
      if (!matches(row)) continue;
      if (others.some((other) => !other.values.has(normalizeFacetValue(other.reads(row))))) continue;
      const own = normalizeFacetValue(dimension.reads(row));
      // O próprio filtro não restringe a lista de opções, mas o valor
      // escolhido precisa continuar presente para poder ser desmarcado.
      if (ownFilterPresent && !active.has(own)) { /* fica visível, com contagem 0 */ }
      counts.set(own, (counts.get(own) ?? 0) + 1);
    }
    for (const value of active) if (!counts.has(value)) counts.set(value, 0);
    facets[dimension.key] = [...counts.entries()]
      .map(([value, count]) => ({ value, label: value === EMPTY_VALUE ? '(Vazias)' : value, count, empty: value === EMPTY_VALUE }))
      .sort((a, b) => (a.empty === b.empty ? a.label.localeCompare(b.label, 'pt-BR') : a.empty ? 1 : -1));
  }
  return facets;
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
  return `<label class="admin-colfilter-option" data-colfilter-option data-colfilter-value="${escapeHtml(value)}"${indent}>`
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
  const options = Array.isArray(filter.options) ? filter.options : [];
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
  const clearDisabled = selected.size === 0;
  const empty = options.length === 0;
  const rows = options.map((option) => renderValueRow(filter, option.value, option.label ?? option.value, option.count ?? 0, selected.has(option.value), { tree: filter.tree, depth: option.depth ?? 0 })).join('');
  return `<div class="admin-colfilter-panel" id="${panelId}" data-colfilter-panel role="dialog" aria-modal="false" aria-labelledby="${panelId}-title" hidden>`
    + `<h2 class="admin-colfilter-title" id="${panelId}-title">${escapeHtml(label)}</h2>${sortRow}`
    + `<button type="button" class="admin-colfilter-clear" data-colfilter-clear${clearDisabled ? ' disabled aria-disabled="true"' : ''}>Limpar filtro de "${escapeHtml(label)}"</button>`
    + `<input type="search" class="admin-colfilter-search" data-colfilter-search placeholder="Pesquisar" aria-label="${escapeHtml(`Pesquisar valores de ${label}`)}" autocomplete="off">`
    + `<div class="admin-colfilter-group" data-colfilter-group role="group" aria-label="${escapeHtml(`Valores de ${label}`)}">`
    + `<label class="admin-colfilter-option admin-colfilter-all"><input type="checkbox" data-colfilter-all><span class="admin-colfilter-option-label" data-colfilter-all-label>(Selecionar tudo)</span></label>`
    + `<div class="admin-colfilter-values" data-colfilter-values>${rows}</div></div>`
    + `<div class="admin-colfilter-footer"><button type="button" class="admin-btn admin-btn-ghost" data-colfilter-cancel>Cancelar</button>`
    + `<button type="button" class="admin-btn admin-btn-primary" data-colfilter-ok${selected.size ? '' : ' disabled'}>OK</button></div>`
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
 * posicionamento da layer. Abre abaixo do botão; se não couber e houver
 * mais espaço acima, abre acima; se nenhum dos lados comportar a altura,
 * limita a altura ao espaço disponível e o painel rola internamente
 * (`maxHeight`). A borda direita/direita alinha à borda direita do botão
 * quando o painel passaria da área visível.
 */
export function placePanel(buttonRect, panelSize, containerRect, viewport) {
  const width = Math.min(Number(panelSize?.width) || 0, Math.max(0, containerRect.width - PANEL_MARGIN * 2));
  const spaceBelow = viewport.height - (buttonRect.top - containerRect.top) - buttonRect.height - PANEL_OFFSET - PANEL_MARGIN;
  const spaceAbove = (buttonRect.top - containerRect.top) - PANEL_OFFSET - PANEL_MARGIN;
  const belowFits = panelSize.height <= spaceBelow;
  const aboveFits = panelSize.height <= spaceAbove;
  const openAbove = !belowFits && aboveFits;
  const top = openAbove
    ? (buttonRect.top - containerRect.top) - PANEL_OFFSET - panelSize.height
    : (buttonRect.top - containerRect.top) + buttonRect.height + PANEL_OFFSET;
  const maxHeight = openAbove ? spaceAbove : spaceBelow;
  let left = buttonRect.left - containerRect.left;
  const viewportRight = viewport.left + viewport.width - PANEL_MARGIN;
  if (left + width > viewportRight) left = (buttonRect.right - containerRect.left) - width;
  if (left < PANEL_MARGIN) left = PANEL_MARGIN;
  return { left, top, width, maxHeight: Math.max(0, maxHeight), openAbove };
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

function closeOpenPanel(scope) {
  const state = OPEN_PANELS.get(scope);
  if (!state) return;
  state.close();
}

export function bindColumnFilters({ location = { path: '/', params: {} }, link, navigate, scope, domain, filters = [] } = {}) {
  const doc = scope?.ownerDocument ?? scope;
  if (!doc?.querySelectorAll) return;
  const containers = Array.from(doc.querySelectorAll('[data-colfilter-toggle]'));
  if (!containers.length) return;

  const layer = (() => {
    const root = doc.querySelector('[data-minijoomla-admin-root]') ?? doc.body;
    let element = doc.querySelector('.admin-colfilter-layer');
    if (!element) {
      element = doc.createElement('div');
      element.className = 'admin-colfilter-layer';
      root?.appendChild?.(element);
    }
    return element;
  })();

  const listeners = [];
  const on = (target, type, handler, options) => { target?.addEventListener?.(type, handler, options); listeners.push(() => target?.removeEventListener?.(type, handler, options)); };
  const dispose = () => { while (listeners.length) listeners.pop()(); };

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
      if (clear) { const none = checked().length === 0; clear.disabled = none; clear.setAttribute('aria-disabled', none ? 'true' : 'false'); }
    };
    const applySearch = (term) => {
      const needle = String(term ?? '').trim().toLocaleLowerCase('pt-BR');
      for (const label of Array.from(dialog.querySelectorAll?.('[data-colfilter-values] [data-colfilter-option]') ?? [])) {
        const text = String(label.dataset?.colfilterValue ?? '').toLocaleLowerCase('pt-BR');
        label.hidden = Boolean(needle) && !text.includes(needle);
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
      const result = applyFilter(key, chosen.map((value) => (value === EMPTY_VALUE ? '' : value)), { multiIsExact: Boolean(spec.multiIsExact) });
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

    boxes().forEach((box) => box.addEventListener?.('change', syncTristate));
    all?.addEventListener?.('change', () => { const on = Boolean(all.checked); for (const box of boxes()) if (box.closest?.('label')?.hidden !== true) box.checked = on; syncTristate(); });
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