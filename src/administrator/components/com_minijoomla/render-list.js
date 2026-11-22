/*
 * Renderização de listagem genérica de admin (equivalente visual à grid
 * real de com_content/com_categories/com_tags/com_menus do Joomla:
 * tabela com cabeçalho claro, link de edição sublinhado, indicadores de
 * estado como ÍCONE CIRCULAR SEM TEXTO VISÍVEL — ver
 * web-devs/JOOMLA/media_source/templates/administrator/atum/scss/
 * blocks/_icons.scss (`.tbody-icon`: círculo 26px com borda, cor
 * cinza quando inativo, colorida quando ativo) e
 * libraries/src/Button/PublishedButton.php/FeaturedButton.php. Achado
 * real de divergência estrutural (confirmado pelo usuário comparando
 * com um Joomla 6.2.0 real): a versão anterior usava um "badge" com
 * texto ("✓ Publicado"), que NÃO existe no Joomla real — o estado é
 * só um ícone, nunca texto ao lado. O texto continua presente para
 * leitor de tela (`<span class="visually-hidden">`), nunca removido,
 * só não aparece visualmente. Puro: recebe linhas já carregadas e
 * devolve HTML — o mesmo padrão de injeção de link já usado pelos
 * módulos/componentes públicos (src/libraries/minijoomla/modules/content-runtime.js,
 * src/components/com_content/tmpl/article/default.js), nunca uma URL hardcoded aqui.
 */
import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';
import { dateWindowStatus } from '../../../libraries/minijoomla/core/date-window.js';
import { checkIcon, banIcon, archiveIcon, starIcon, starOutlineIcon, editIcon, plusIcon, clockIcon, closeIcon, warningIcon, trashIcon } from './icons.js';
import { renderColumnFilterButton } from './column-filter.js';

const STATUS_STATE_ICONS = {
  Published: { className: 'is-active', label: 'Publicado', icon: checkIcon() },
  Draft: { className: '', label: 'Rascunho', icon: banIcon() },
  Archived: { className: '', label: 'Arquivado', icon: archiveIcon() },
  Unpublished: { className: '', label: 'Despublicado', icon: banIcon() }
};
const knownState = (value) => typeof value === 'string' && Object.hasOwn(STATUS_STATE_ICONS, value) ? STATUS_STATE_ICONS[value] : undefined;

function stateIcon(className, icon, label, tooltip = false) {
  return `<span class="admin-state-icon${className ? ` ${className}` : ''}"${tooltip ? ` title="${escapeHtml(label)}"` : ''}>${icon}<span class="visually-hidden">${escapeHtml(label)}</span></span>`;
}

// This is an article-only projection, not a rewrite of persisted state/flags.
// State aliases match the SPMIDDLE public adapter, including its legacy default.
function articlePublication(row, now) {
  const raw = row.state;
  const published = raw === undefined || raw === true || raw === 1 || raw === '1'
    || ['Published', 'published', 'Publicado', 'publicado'].includes(raw);
  if (!published) return { ...(knownState(raw) ?? { className: '', icon: banIcon(), label: `Estado desconhecido: ${String(raw ?? '')}` }), active: false };
  const window = dateWindowStatus(row.publishUp, row.publishDown, now);
  const indicators = {
    active: { ...STATUS_STATE_ICONS.Published, active: true },
    scheduled: { icon: clockIcon(), label: 'Publicação agendada' },
    expired: { icon: closeIcon(), label: 'Publicação encerrada' },
    invalid: { icon: warningIcon(), label: 'Publicação com datas inválidas' }
  };
  return indicators[window];
}

function articleFeatured(row, now) {
  if (![true, 1, '1'].includes(row.featured)) return { icon: starOutlineIcon(), label: 'Sem destaque' };
  const window = dateWindowStatus(row.featuredUp, row.featuredDown, now);
  const publication = articlePublication(row, now);
  const indicators = {
    active: { className: 'is-featured', icon: starIcon(), label: 'Destaque' },
    scheduled: { icon: clockIcon(), label: 'Destaque agendado' },
    expired: { icon: closeIcon(), label: 'Destaque encerrado' },
    invalid: { icon: warningIcon(), label: 'Destaque com datas inválidas' }
  };
  if (publication.active) return indicators[window];
  if (window === 'active') return { icon: banIcon(), label: `Destaque inativo — ${publication.label.toLocaleLowerCase()}` };
  return { ...indicators[window], label: `${indicators[window].label} — ${publication.label.toLocaleLowerCase()}` };
}

/*
 * Campos cujo valor é um estado reconhecido (ver STATUS_STATE_ICONS)
 * recebem um ícone circular sem texto visível, nunca um badge com
 * texto — mesmo princípio visual real do Joomla
 * (PublishedButton/FeaturedButton: um indicador discreto por linha,
 * sem rótulo textual). Destaque usa a mesma estrela
 * (preenchida/vazia) que o Joomla real usa para featured=true/false —
 * nunca omite a célula quando featured=false. Um valor desconhecido
 * (fora de STATUS_STATE_ICONS) cai de volta para texto simples
 * escapado, nunca lança.
 */
// Indicador de estado/destaque de um artigo (janela de agendamento incluída), reutilizado pela lista Joomla-like.
export function renderArticleIndicator(row, column, now = new Date()) {
  const indicator = column === 'state' ? articlePublication(row, now) : articleFeatured(row, now);
  return stateIcon(indicator.className, indicator.icon, indicator.label, true);
}

function renderCell(row, column, domain, now) {
  const raw = row[column];
  if (domain === 'articles' && ['state', 'featured'].includes(column)) {
    const indicator = column === 'state' ? articlePublication(row, now) : articleFeatured(row, now);
    return stateIcon(indicator.className, indicator.icon, indicator.label, true);
  }
  const state = (column === 'state' || column === 'published') ? knownState(raw) : undefined;
  if (state) return stateIcon(state.className, state.icon, state.label);
  if (column === 'featured') return raw ? stateIcon('is-featured', starIcon(), 'Destaque') : stateIcon('', starOutlineIcon(), 'Sem destaque');
  if (column === 'enabled') return raw ? stateIcon('is-active', checkIcon(), 'Habilitado') : stateIcon('', banIcon(), 'Desabilitado');
  return escapeHtml(String(raw ?? ''));
}

/*
 * `columns`: subconjunto de nomes de campo do domínio (field-schemas.js)
 * a exibir como coluna — por padrão, só `titleField`, já que mostrar
 * todos os campos (ex.: fulltext inteiro de um artigo) tornaria a
 * listagem ilegível; quem monta a tela escolhe colunas extras
 * relevantes por domínio (ex.: "alias" para artigos).
 * `columnLabels`: rótulo legível opcional por nome de coluna (ex.:
 * "state" -> "Estado") — colunas sem entrada usam o próprio nome.
 * `searchValue`/`searchHref`: quando informados, renderiza a barra de
 * busca ("searchtools" do Joomla real) acima da tabela — um `<form>`
 * `method="get"` simples, sem JavaScript de filtro no cliente (mesmo
 * padrão já usado por src/components/com_finder/tmpl/search/default.js: o servidor/serviço de
 * aplicação filtra, nunca o componente de apresentação). `searchHref`
 * decide a `action` do formulário; `searchValue` preenche o campo com o
 * termo atual, para a busca persistir visualmente após a navegação.
 * `pagination`: `{ page, pageCount, link }` opcional — `link(pageNumber)`
 * devolve o href de cada página; omitido quando `pageCount <= 1`.
 * `domain: 'articles'` avalia estado/destaque pela janela temporal; demais
 * domínios preservam a apresentação genérica. `now` é o snapshot único da
 * renderização: não há timer, normalização dos registros ou escrita aqui.
 */
function renderSearchBar(searchHref, searchValue, filters = []) {
  if (searchHref === undefined) return '';
  const id = 'admin-list-search';
  const controls = filters.map((filter) => `<label for="admin-filter-${escapeHtml(filter.name)}">${escapeHtml(filter.label)}</label><select id="admin-filter-${escapeHtml(filter.name)}" name="${escapeHtml(filter.name)}">${filter.options.map(([value, label]) => `<option value="${escapeHtml(value)}"${String(filter.value ?? '') === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>`).join('');
  return `<form class="admin-searchbar" method="get" action="${safeUrl(searchHref)}" role="search"><label for="${id}">Buscar</label><input type="search" id="${id}" name="q" value="${escapeHtml(searchValue ?? '')}" placeholder="Buscar por título...">${controls}<button type="submit" class="admin-btn admin-btn-ghost">Buscar</button></form>`;
}

/*
 * Menu de filtro por coluna (mesmo modelo do "filtro tipo Excel" do
 * Joomla real: cada cabeçalho de coluna abre a lista de valores
 * distintos daquela coluna e o filtro vale só para ela). Não usa
 * `<details>`/popover nativo porque o menu precisa continuar dentro do
 * `<th>` para ser lido junto do rótulo da coluna pelo leitor de tela e
 * precisa fechar com Escape — o comportamento é implementado em
 * app.js/content-pages.js (`bindColumnFilters`), que é quem tem acesso
 * ao router. Aqui é só apresentação pura: recebe o estado atual e
 * devolve HTML.
 *
 * `columnFilters`: `[{ column, name, label, value, options: [[value,label]] }]`
 * — `name` é o parâmetro de URL que recebe o valor (pode coincidir com o
 * nome da coluna ou ser um alias, ex. `categoryId` para a coluna
 * `categoryTitle`).
 */
/*
 * Botão de filtro por coluna no cabeçalho (mesmo modelo do "filtro tipo
 * Excel" do Joomla real: cada cabeçalho abre a lista de valores distintos
 * daquela coluna e o filtro vale só para ela). Aqui é só apresentação
 * pura; todo o comportamento (abrir/fechar, busca, tri-state, aplicar por
 * navegação) vive em `column-filter.js` (`bindColumnFilters`), o ligador
 * único — antes cada tela tinha a sua própria cópia divergente.
 *
 * `columnFilters`: `[{ key, column, label, values: [valorAtual], options,
 * multiIsExact, sortActions }]` — `key` é a chave canônica da URL.
 */
export function renderColumnFilter(filter, index) {
  return renderColumnFilterButton(filter, index);
}

function renderPagination(pagination) {
  if (!pagination || !Number.isFinite(pagination.pageCount) || pagination.pageCount <= 1) return '';
  const current = Math.max(1, Number(pagination.page) || 1);
  const items = Array.from({ length: pagination.pageCount }, (_, index) => index + 1).map((pageNumber) => pageNumber === current
    ? `<span aria-current="page">${pageNumber}</span>`
    : `<a href="${safeUrl(pagination.link(pageNumber))}">${pageNumber}</a>`
  );
  return `<nav class="admin-pagination" aria-label="Páginas"><ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul></nav>`;
}

export function renderAdminList({ rows = [], columns, columnLabels = {}, titleField = 'title', emptyLabel = 'Nenhum registro encontrado.', editHref = () => '#', newHref, searchValue, searchHref, searchFilters = [], columnFilters = [], columnFormId, rowActions = () => '', pagination, domain, now = new Date() } = {}) {
  const items = Array.isArray(rows) ? rows : [];
  const activeColumns = Array.isArray(columns) && columns.length ? columns : [titleField];
  const newLink = newHref ? `<p class="admin-list-actions"><a class="admin-new-link admin-btn admin-btn-success" href="${safeUrl(newHref)}">${plusIcon()}Novo</a></p>` : '';
  const searchBar = renderSearchBar(searchHref, searchValue, searchFilters);
  const filterFor = (column) => columnFilters.find((filter) => filter.column === column || filter.key === column);
    const headerCells = activeColumns.map((column, index) => {
    const filter = filterFor(column);
      return `<th scope="col" class="admin-th${filter ? ' admin-th-filterable' : ''}"><span class="admin-th-label">${escapeHtml(columnLabels[column] ?? column)}</span>${filter ? renderColumnFilter(filter, index) : ''}</th>`;
  }).join('');
    const headRow = `<tr>${headerCells}<th scope="col" class="admin-th"><span class="admin-th-label">Ação</span></th></tr>`;
  if (!items.length) {
    const empty = `<p class="admin-empty" role="status">${escapeHtml(emptyLabel)}</p>`;
      const emptyTable = `<div class="admin-table-wrap"><table class="admin-list" data-colfilter-form><thead>${headRow}</thead></table></div>`;
      return `${newLink}${searchBar}${emptyTable}${empty}`;
  }
  const body = items.map((row) => {
    const href = safeUrl(editHref(row.id));
    const title = String(row[titleField] ?? '').trim() || `Registro ${row.id ?? ''}`.trim();
    const editLabel = escapeHtml(`Editar: ${title}`);
    const cells = activeColumns.map((column) => column === titleField
      ? `<th scope="row"><a href="${href}" aria-label="${editLabel}">${escapeHtml(title)}</a></th>`
      : `<td>${renderCell(row, column, domain, now)}</td>`).join('');
    return `<tr>${cells}<td class="admin-col-action"><a class="admin-btn admin-btn-ghost" href="${href}" aria-label="${editLabel}">${editIcon()}Editar</a>${rowActions(row)}</td></tr>`;
  }).join('');
    const table = `<div class="admin-table-wrap"><table class="admin-list" data-colfilter-form><thead>${headRow}</thead><tbody>${body}</tbody></table></div>${renderPagination(pagination)}`;
      return `${newLink}${searchBar}${table}`;
}

export { filterIcon, filterActiveIcon } from './icons.js';
