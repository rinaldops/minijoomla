/*
 * Telas administrativas de conteúdo no estilo do administrator/ do Joomla
 * (com_content articles, com_categories, com_tags, com_media). Mesmo
 * contrato de extension-pages.js: cada rota devolve `{ html, bind }` e toda
 * escrita usa o ETag capturado ao renderizar. Filtro/ordem/paginação de
 * artigos vêm de adminService.articles.query (camada de serviço).
 */
import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { MEDIA_MIME_TYPES, MEDIA_MAX_BYTES } from '../../../libraries/minijoomla/application/media-upload-service.js';
import { options, filterBar, pagination, extensionErrorMessage } from './extension-pages.js';
import { renderArticlesTable } from '../com_content/tmpl/articles/default.js';
import { renderCategoriesTable } from '../com_categories/tmpl/categories/default.js';
import { renderTagsTable } from '../com_tags/tmpl/tags/default.js';
import { renderMediaFiles, formatMediaSize as formatSize } from '../com_media/tmpl/media/default.js';
import { plusIcon } from './icons.js';
import { bindColumnFilters, columnsForDomain, canonicalKey, parseMulti, facetValueLabel } from './column-filter.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const status = '<p class="admin-form-status admin-management-status" role="status" aria-live="polite" aria-atomic="true" data-ext-status></p>';

/*
 * A lista se recarrega depois de um lote, e a recarga re-renderiza
 * `[data-ext-status]` do zero. Sem guardar o recado, a única pista de que a
 * ação funcionou seria o estado das linhas mudar — indistinguível de um
 * filtro. Por isso o texto sobrevive à recarga e é consumido uma única vez
 * pela renderização seguinte.
 *
 * O recado mora no ROUTER, não no módulo: `createContentPages` é
 * re-instantiado a cada renderização (a recarga destrói a instância que
 * produziu o recado), mas o router é único por aplicação. Guardá-lo no
 * módulo faria o recado vazar de uma aplicação/tela para a seguinte — um
 * lote antigo anunciado numa lista que não tinha nada a ver com ele.
 * As chaves ficam em `Symbol` para não colidir com a API do router.
 */
const PENDING_STATUS = Symbol('minijoomla.pendingBatchStatus');
const PENDING_PATH = Symbol('minijoomla.pendingBatchPath');

const ARTICLE_STATE_OPTIONS = [['', '— Estado (exceto lixeira) —'], ['Published', 'Publicados'], ['Draft', 'Despublicados'], ['Archived', 'Arquivados'], ['Trashed', 'Na lixeira'], ['*', 'Todos']];
const TAXONOMY_STATE_OPTIONS = [['', '— Estado (exceto lixeira) —'], ['Published', 'Publicados'], ['Unpublished', 'Despublicados'], ['Trashed', 'Na lixeira'], ['*', 'Todos']];
const ARTICLE_ACTIONS = { publish: 'Publicar', unpublish: 'Despublicar', archive: 'Arquivar', feature: 'Destacar', unfeature: 'Remover destaque', duplicate: 'Duplicar', trash: 'Enviar para a lixeira', move: 'Mover para a categoria' };
const TAXONOMY_ACTIONS = { publish: 'Publicar', unpublish: 'Despublicar', duplicate: 'Duplicar', trash: 'Enviar para a lixeira' };
const TRASH_ACTIONS = { restore: 'Restaurar da lixeira', delete: 'Excluir definitivamente' };
const PAGE_LIMITS = [10, 20, 50, 100];

/*
 * Filtros de GERENCIAMENTO (barra do topo) de cada listagem. Fazem parte
 * do estado da lista tanto quanto os filtros de coluna: sem eles, voltar
 * de um formulário trazia a lista sem o filtro de estado/categoria que o
 * usuário tinha aplicado.
 */
const MANAGEMENT_PARAMS = {
  articles: ['categoryId', 'author', 'featured'],
  categories: [],
  tags: []
};

/*
 * Frente C3: chaves da barra que também têm coluna filtrável na tabela.
 *
 * `extra` são controles de barra que NÃO viram coluna de propósito (ex.:
 * `limit`, itens por página). Eles entram aqui como exceção explícita para
 * que `hasColumn` os trate como "sem coluna" e eles continuem visíveis — no
 * painel "Mais filtros" quando não estão ativos — mesmo que o catálogo de
 * colunas ganhe um campo homônimo.
 */
function contentBarColumnKeys(domain, extra = []) {
  const keys = columnsForDomain(domain).map((entry) => entry.key);
  return keys.filter((key) => !extra.includes(key));
}

/*
 * Frente C2: o que a barra de filtros ativos precisa descrever.
 *
 * São exatamente os filtros ATIVOS — os de coluna e os da barra do topo —,
 * com o rótulo HUMANO do valor (o mesmo mapa de facetas do painel do
 * cabeçalho), para que a barra e o menu nunca discordem sobre como um valor
 * se chama. `rawValues` guarda a grafia da URL, que é o que o "×" precisa
 * remover.
 */
function activeFiltersFor(domain, source, params = {}, barFields = []) {
  const facets = source?.columnFacets ?? {};
  const columns = columnsForDomain(domain);
  const labelFor = (entry, value) => {
    const facet = (facets[entry.key] ?? []).find((item) => String(item.value) === String(value));
    // `facets[].label` é o rótulo da LINHA (caminho de categoria, texto livre);
    // o rótulo HUMANO de um valor enumerado vive em FACET_VALUE_LABELS e é a
    // MESMA fonte que o painel do cabeçalho usa — sem isto o chip diria
    // "Estado: Published" enquanto o menu diz "Publicado".
    return facetValueLabel(domain, entry.key, value) ?? facet?.label ?? value;
  };
  const fromColumns = columns.flatMap((entry) => {
    const raw = params[entry.key] ?? entry.aliases.map((alias) => params[alias]).find((value) => value !== undefined && value !== null && value !== '');
    if (raw === undefined || raw === null || raw === '') return [];
    const rawValues = parseMulti(String(raw)).map(String);
    return [{ key: entry.key, label: entry.label, values: rawValues.map((value) => (value === '' ? 'Vazio' : labelFor(entry, value))), rawValues }];
  });
  /*
   * Um campo da barra que também é coluna já foi descrito acima pela lista
   * canônica; descrevê-lo duas vezes duplicaria o chip.
   */
  const fromBar = barFields.flatMap((field) => {
    if (field.type === 'search') return [];
    if (columns.some((entry) => entry.key === field.name)) return [];
    const value = params[field.name];
    if (value === undefined || value === null || value === '') return [];
    const rawValues = parseMulti(String(value)).map(String);
    const labels = new Map((field.options ?? []).map(([option, label]) => [String(option), label]));
    return [{ key: field.name, label: field.label, values: rawValues.map((item) => labels.get(item) ?? item), rawValues }];
  });
  return [...fromColumns, ...fromBar];
}

/*
 * Colunas filtráveis de cada listagem de conteúdo, na forma que os
 * renderizadores de tabela esperam: `{ key, column, label, values,
 * options, multiIsExact }` — `key` é a chave canônica da URL (ver
 * column-filter.js). As opções vêm das FACETAS calculadas pelo serviço
 * (conjunto completo, antes da paginação), não das linhas desta página:
 * filtrar por um valor que só existe na página 3 seria impossível se a
 * lista de valores saísse da página 1.
 */
function columnFiltersFor(domain, source, params = {}) {
  const facets = source?.columnFacets ?? {};
  return columnsForDomain(domain).map((entry) => {
    const values = parseMulti(params[entry.key] ?? '');
    const options = Array.isArray(facets[entry.key])
      ? facets[entry.key].map((facet) => ({ value: facet.value, label: facet.label, count: facet.count, empty: facet.empty, depth: facet.depth }))
      : [];
    return {
      key: entry.key,
      column: entry.column,
      label: entry.label,
      values,
      options,
      multiIsExact: Boolean(entry.multiIsExact)
    };
  });
}

export function createContentPages({ adminService, documentRef, router, shell, mediaService, clock = () => new Date(), isCurrent = () => true }) {
  const link = (path, params) => router.link(path, params);
  let currentPath = '';

  /*
   * Estado da LISTA que precisa sobreviver a abrir/criar/duplicar/
   * cancelar/voltar: cada filtro ativo (barra do topo e menus de
   * coluna), a busca e a ordenação/limite — nunca `page`, que pertence à
   * listagem e não ao registro aberto (voltar de um formulário para a
   * página 7 de uma lista que o filtro encolheu mostraria vazio).
   * Sem isto, "cancelar" voltava para a lista limpa, que é o defeito
   * relatado.
      *
      * As chaves de coluna vêm do catálogo canônico (`columnsForDomain`)
      * mais os filtros de gerenciamento da barra do topo; a lista é fixa e
      * completa porque o destino do link é montado ANTES de a lista ser
      * recarregada — não há `params` da página nova para copiar.
   */
     const listState = (params = {}, extras = {}, domain = 'articles') => {
      const keys = [
        'q', 'sort', 'dir', 'limit',
        ...columnsForDomain(domain).map((entry) => entry.key),
        ...MANAGEMENT_PARAMS[domain]
      ];
      const state = {};
      keys.forEach((key) => {
        const value = params[key];
        if (value !== undefined && value !== null && value !== '') state[key] = value;
      });
      // Aliases `col_*` legados precisam sobreviver à LEITURA, mas o link
            // emitido usa a chave canônica: sem isso o mesmo recorte viajava com
            // `col_alias` para o formulário e `alias` para a lista, e voltar
            // perdia o filtro.
      Object.keys(params).forEach((key) => {
        const value = params[key];
              const canonical = canonicalKey(domain, key);
              if (value !== undefined && value !== null && value !== '' && !(canonical in state)) state[canonical] = value;
      });
      return Object.fromEntries(Object.entries({ ...state, ...extras }).filter(([, value]) => value !== undefined && value !== null && value !== ''));
    };

  const home = () => ({ label: 'Painel de controle', href: link('/') });
  const page = (activeKey, pageTitle, crumbs, bodyHtml, toolbarActionsHtml = '') => shell({ activeKey, pageTitle, breadcrumbItems: [home(), ...crumbs], bodyHtml, toolbarActionsHtml, link });
  const body = () => documentRef.body;
  const report = (message) => { if (!isCurrent()) return; const element = body().querySelector?.('[data-ext-status]'); if (element) element.textContent = message; };
  const navigate = (...args) => isCurrent() ? router.navigate(...args) : undefined;
  const reload = (location) => navigate(link(location.path, location.params));

  /*
   * Recado do último lote desta aplicação (ver `PENDING_STATUS`). O texto e o
   * destino vivem no router para atravessar a recarga, que re-instancia
   * estas páginas.
   */
  const armBatchStatus = (message) => {
    router[PENDING_STATUS] = message;
    router[PENDING_PATH] = currentPath;
  };

  function selectedIds() {
    return Array.from(body().querySelectorAll?.('[data-ext-select]') ?? []).filter((input) => input.checked).map((input) => input.value);
  }

  function bindSelectAll() {
    const all = body().querySelector?.('[data-ext-select-all]');
    all?.addEventListener?.('change', () => { if (!isCurrent()) return; body().querySelectorAll?.('[data-ext-select]')?.forEach?.((input) => { input.checked = Boolean(all.checked); syncBatchBar(); }); });
    for (const input of Array.from(body().querySelectorAll?.('[data-ext-select]') ?? [])) {
      input.addEventListener?.('change', () => { if (!isCurrent()) return; syncBatchBar(); });
    }
    syncBatchBar();
  }

  /*
   * Adendo 1, item 5: a barra de lote é contextual. Com zero linhas marcadas
   * ela não existe na tela; com uma ou mais, aparece em UMA linha logo acima
   * da tabela. O contador é o mesmo nó que o `aria-live` anuncia, então não
   * há como os dois divergirem.
   */
  function syncBatchBar() {
    if (!isCurrent()) return;
    const bar = body().querySelector?.('[data-ext-batchbar]');
    if (!bar) return;
    const count = selectedIds().length;
    bar.hidden = count === 0;
    const label = bar.querySelector?.('[data-ext-batch-count]');
    if (label) label.textContent = `${count} selecionado(s)`;
    const form = bar.querySelector?.('[data-ext-batch]');
    // "Categoria de destino" só faz sentido para a ação de mover.
    const action = form?.querySelector?.('[name="batchAction"]')?.value ?? '';
    const category = bar.querySelector?.('[data-ext-batch-category-field]');
    if (category) category.hidden = action !== 'move';
  }

  /*
   * Consome o recado do lote anterior. Só entrega se ele foi produzido para
   * ESTE destino: um recado pendente de outra tela (o usuário navegou antes de
   * a recarga acontecer) é descartado em vez de anunciado onde não faz sentido.
   */
  function flushBatchStatus() {
    const message = router[PENDING_STATUS];
    const target = router[PENDING_PATH];
    router[PENDING_STATUS] = '';
    router[PENDING_PATH] = '';
    if (!message || target !== currentPath) return;
    report(message);
  }

  function bindActions(handlers) {
    body().querySelectorAll?.('[data-ext-action]')?.forEach?.((button) => {
      button.addEventListener?.('click', async (event) => {
        event?.preventDefault?.();
        if (button.disabled || !isCurrent()) return;
        const handler = handlers[button.dataset?.extAction];
        if (!handler) return;
        button.disabled = true;
        try { await handler(button.dataset?.extId, button); } catch (error) { report(extensionErrorMessage(error)); } finally { button.disabled = false; }
      });
    });
  }

  /*
     * G2 — lote com FALHA PARCIAL: antes, o relatório era escrito e a lista
     * não recarregava, então os itens que realmente mudaram continuavam
     * aparecendo com o estado antigo (filtro/página "mentindo" sobre o
       * estado real). Agora o erro carrega `partialBatch` com o resumo do
       * lote e `runBatch` decide:
       *   - FALHA TOTAL (nada mudou): só reporta o motivo. Recarregar aqui
       *     seria mentir ao contrário — apresentar como sucesso/estado novo
       *     uma ação que não alterou nada — e ainda descartaria o foco;
       *   - FALHA PARCIAL (algo mudou): reporta o motivo E recarrega a MESMA
       *     lista com os MESMOS filtros e a MESMA página, para o que mudou
       *     aparecer mudado e o que falhou continuar visível;
       *   - SUCESSO: recarrega como sempre (com filtros e página).
     * `redirect` é opcional: quem recarrega fora do router (ex.: páginas de
     * extensão que re-renderizam por outro caminho) continua funcionando.
     */
    async function batchReport(result, location, { redirect } = {}) {
      /*
       * Tela obsoleta: o lote terminou depois de uma navegação/recarga, então
       * este resultado não descreve mais o que está na tela. Reportar aqui
       * escreveria a mensagem numa renderização que já morreu (e o status
       * pendente vazaria para a próxima tela). Mesma guarda do caminho de
       * erro abaixo.
       */
      if (!isCurrent()) return undefined;
      if (!result.failed.length) {
        armBatchStatus(`${result.succeeded.length} item(ns) atualizado(s).`);
        return redirect ? redirect(location) : reload(location);
      }
      armBatchStatus(`${result.succeeded.length} atualizado(s), ${result.failed.length} com falha: ${result.failed.map((failure) => extensionErrorMessage(failure, failure.message)).join(' ')}`);
      throw Object.assign(new Error(router[PENDING_STATUS]), { partialBatch: true, succeeded: result.succeeded.length });
  }

  /*
   * A busca lê os valores do DOCUMENTO, não só do `<form>`: os filtros que
   * saíram da barra (Frente C3) moram no painel "Mais filtros", que é um
   * bloco IRMÃO do formulário — fora dele, `form.querySelector` não os
   * acharia e submeter a busca apagaria silenciosamente o recorte que o
   * usuário tinha aplicado. `[name]` continua sendo a chave de leitura, então
   * o painel e a barra seguem o mesmo contrato.
   */
  function bindFilter(location, names) {
    const form = body().querySelector?.('[data-ext-filter]');
    const scope = body();
    form?.addEventListener?.('submit', async (event) => {
      event?.preventDefault?.();
      if (!isCurrent()) return;
      const params = Object.fromEntries(names.map((name) => [name, scope.querySelector?.(`[name="${name}"]`)?.value]).filter(([, value]) => value));
      /*
       * Preserva o que NÃO é campo do formulário — `sort`/`dir` e,
       * principalmente, os filtros de coluna (`col_*`/canônicos) aplicados
       * pelo menu: reconstruir a query só com os campos da barra apagava os
       * filtros que o usuário tinha acabado de escolher no menu da coluna.
       * Os campos do formulário continuam sendo a fonte da verdade; os
       * demais só sobrevivem.
       */
      for (const [key, value] of Object.entries(location.params ?? {})) {
        if (names.includes(key) || value === undefined || value === null || value === '') continue;
        if (key === 'page') continue;
        params[key] = value;
      }
      await navigate(link(location.path, params));
    });
  }

  async function runBatch(run, ids, action, extra, location) {
    try {
      return await batchReport(await run(ids, action, extra), location);
    } catch (error) {
      if (!error?.partialBatch) throw error;
        // Reporta a falha ANTES de recarregar: o reload re-renderiza a tela,
        // `isCurrent()` desta renderização passa a falso e a mensagem seria
        // engolida (o usuário veria a lista atualizada sem saber o motivo).
      if (isCurrent()) report(error.message);
        // Só recarrega quando algo realmente mudou. Numa falha total não há
        // estado novo para mostrar e recarregar apresentaria como bem-sucedida
        // uma ação que não alterou nada.
        if (error.succeeded > 0) {
          try { await reload(location); } catch { /* navegação cancelada: a falha já foi reportada */ }
        } else if (!error.succeeded) {
          // Falha total: nada recarrega, então o recado precisa dizer também
          // que NENHUM item foi alterado — senão "1 com falha" não distingue
          // "todos falharam" de "alguns passaram".
          armBatchStatus(`${error.message} Nenhum item foi atualizado.`);
          report(router[PENDING_STATUS]);
          // Não houve recarga para consumir o recado, então ele é descartado
          // aqui: deixá-lo armado faria a PRÓXIMA renderização de `/articles`
          // (mesmo destino) reanunciar uma falha que já foi mostrada.
          router[PENDING_STATUS] = '';
          router[PENDING_PATH] = '';
        }
      return undefined;
    }
  }

  function bindBatch(location, run, { needsCategory = false } = {}) {
    const form = body().querySelector?.('[data-ext-batch]');
    form?.querySelector?.('[name="batchAction"]')?.addEventListener?.('change', () => { if (!isCurrent()) return; syncBatchBar(); });
    body().querySelector?.('[data-ext-clear-selection]')?.addEventListener?.('click', () => {
      if (!isCurrent()) return;
      body().querySelectorAll?.('[data-ext-select]')?.forEach?.((input) => { input.checked = false; });
      const all = body().querySelector?.('[data-ext-select-all]');
      if (all) { all.checked = false; all.indeterminate = false; }
      syncBatchBar();
    });
    form?.addEventListener?.('submit', async (event) => {
      event?.preventDefault?.();
      if (!isCurrent()) return;
      const action = form.querySelector?.('[name="batchAction"]')?.value;
      const ids = selectedIds();
      if (!action) { report('Escolha uma ação em lote.'); return; }
      if (!ids.length) { report('Selecione ao menos um item.'); return; }
      if (action === 'delete' && !globalThis.confirm?.(`Excluir definitivamente ${ids.length} item(ns)? Esta ação não pode ser desfeita.`)) return;
      if (!isCurrent()) return;
      try { await run(ids, action, needsCategory ? { categoryId: form.querySelector?.('[name="batchCategory"]')?.value } : {}); } catch (error) { report(extensionErrorMessage(error)); }
    });
  }

  function batchForm(actions, categoryOptions) {
    const category = categoryOptions ? `<label for="admin-batch-category" data-ext-batch-category-field hidden>Categoria de destino</label><select id="admin-batch-category" name="batchCategory" data-ext-batch-category-field hidden>${options([['', '— Categoria —'], ...categoryOptions.map((option) => [option.value, option.label])], '')}</select>` : '';
    /*
     * `hidden` no primeiro render: a barra nasce escondida porque a página
     * abre sem seleção. `syncBatchBar()` a revela quando o usuário marca
     * algo. O `<span>` do contador é o mesmo que o `aria-live` lê.
     */
    return `<div class="admin-batchbar" data-ext-batchbar role="region" aria-label="Ações em lote" hidden><span class="admin-batchbar-count" data-ext-batch-count aria-live="polite">0 selecionado(s)</span><form data-ext-batch><select name="batchAction" aria-label="Ação em lote">${options([['', '— Selecione —'], ...Object.entries(actions)], '')}</select>${category}<button type="submit" class="admin-btn">Aplicar</button></form><button type="button" class="admin-btn admin-btn-ghost" data-ext-clear-selection>Limpar seleção</button></div>`;
  }

  // ---------- Artigos (com_content) ----------

  async function articleListPage(location) {
    const params = location.params ?? {};
    const [result, categoryOptions, tagRows] = await Promise.all([
      adminService.articles.query(params),
      adminService.categories.treeOptions(),
      adminService.tags?.list?.() ?? []
    ]);
    const etags = new Map(result.rows.map((row) => [String(row.id), row.etag]));
    const inTrash = params.state === 'Trashed';
    const now = clock();
    const articlesFilters = [
      { name: 'q', label: 'Buscar por título, alias, nota ou id:N', type: 'search', value: params.q },
      { name: 'state', label: 'Estado', value: params.state, options: ARTICLE_STATE_OPTIONS },
      { name: 'categoryId', label: 'Categoria', value: params.categoryId, options: [['', '— Categoria —'], ...categoryOptions.map((option) => [String(option.value), option.label])] },
      { name: 'featured', label: 'Destaque', value: params.featured, options: [['', '— Destaque —'], ['1', 'Em destaque'], ['0', 'Sem destaque']] },
      { name: 'author', label: 'Autor', value: params.author, options: [['', '— Autor —'], ...result.facets.authors.map((author) => [author, author])] },
      { name: 'tag', label: 'Tag', value: params.tag, options: [['', '— Tag —'], ...tagRows.map((tag) => [tag.name, tag.name])] },
      { name: 'language', label: 'Idioma', value: params.language, options: [['', '— Idioma —'], ...result.facets.languages.map((language) => [language, language])] },
      { name: 'limit', label: 'Itens por página', value: params.limit || String(result.limit), options: PAGE_LIMITS.map((limit) => [String(limit), `${limit} por página`]) }
    ];
    const filters = filterBar('admin-articles-filter', articlesFilters, 'Filtrar', { columnKeys: contentBarColumnKeys('articles', ['limit']) });
    const table = renderArticlesTable(result, {
      link, params, now,
      columnFilters: columnFiltersFor('articles', result, params),
      returnParams: listState(params, {}, 'articles'),
      // Frente C2: `limit` é parâmetro de paginação, não filtro de conteúdo, e
      // já aparece no seletor "Itens por página" — fora da barra de ativos.
      activeFilters: activeFiltersFor('articles', result, params, articlesFilters.filter((field) => field.name !== 'limit')),
      totalLabel: `${result.total} de ${result.totalBase ?? result.total} itens`
    });
    const actions = { ...ARTICLE_ACTIONS, ...(inTrash ? TRASH_ACTIONS : {}) };
    const html = page('articles', 'Artigos', [{ label: 'Artigos' }], `${status}${filters}${batchForm(actions, categoryOptions)}${table}${pagination(result, (number) => link('/articles', { ...params, page: String(number) }))}`,
              `<a class="admin-btn admin-btn-success" href="${esc(link('/articles/new', listState(params, {}, 'articles')))}">${plusIcon()}Novo</a>`);
    const bind = () => {
      bindFilter(location, ['q', 'state', 'categoryId', 'featured', 'author', 'tag', 'language', 'limit']);
          bindColumnFilters({ location, link, navigate, scope: body(), domain: 'articles', filters: columnFiltersFor('articles', result, params) });
      bindSelectAll();
      flushBatchStatus();
      const run = async (ids, action, extra) => runBatch(() => adminService.articles.batch(ids.map((id) => ({ id: Number(id), etag: etags.get(String(id)) })), action, extra), ids, action, extra, location);
      const rowOf = (id) => result.rows.find((row) => String(row.id) === String(id));
      bindActions({
        'toggle-state': (id) => run([id], (rowOf(id)?.state ?? 'Published') === 'Published' ? 'unpublish' : 'publish'),
        'toggle-featured': (id) => run([id], rowOf(id)?.featured ? 'unfeature' : 'feature'),
        restore: (id) => run([id], 'restore'),
        duplicate: async (id) => { const created = await adminService.articles.duplicate(Number(id)); await navigate(link(`/articles/${created.id}`)); }
      });
      bindBatch(location, run, { needsCategory: true });
    };
    return { html, bind };
  }

  // ---------- Categorias (com_categories) e Tags (com_tags) ----------

  async function taxonomyListPage(location, cfg) {
    const params = location.params ?? {};
    const service = adminService[cfg.domain];
    const rows = await service.query(params);
    const etags = new Map(rows.map((row) => [String(row.id), row.etag]));
    const inTrash = params.state === 'Trashed';
    const taxonomyFilters = [
      { name: 'q', label: 'Buscar por título, alias ou id:N', type: 'search', value: params.q },
      { name: 'state', label: 'Estado', value: params.state, options: TAXONOMY_STATE_OPTIONS }
    ];
    const filters = filterBar(`admin-${cfg.domain}-filter`, taxonomyFilters, 'Filtrar', { columnKeys: contentBarColumnKeys(cfg.domain) });
    const facets = rows.columnFacets ? rows : { columnFacets: {} };
    const taxonomyBar = activeFiltersFor(cfg.domain, facets, params, []);
    const table = cfg.domain === 'categories'
          ? renderCategoriesTable(rows, { link, columnFilters: columnFiltersFor('categories', rows, params), returnParams: listState(params, {}, 'categories'), activeFilters: taxonomyBar, totalLabel: `${rows.total ?? rows.length} de ${rows.totalBase ?? rows.total ?? rows.length} itens` })
          : renderTagsTable(rows, { link, columnFilters: columnFiltersFor('tags', rows, params), returnParams: listState(params, {}, 'tags'), activeFilters: taxonomyBar, totalLabel: `${rows.total ?? rows.length} de ${rows.totalBase ?? rows.total ?? rows.length} itens` });
    const html = page(cfg.domain, cfg.label, [{ label: cfg.label }], `${status}${filters}${batchForm({ ...TAXONOMY_ACTIONS, ...(inTrash ? TRASH_ACTIONS : {}) })}${table}`,
              `<a class="admin-btn admin-btn-success" href="${esc(link(`/${cfg.domain}/new`, listState(params, {}, cfg.domain)))}">${plusIcon()}Novo</a>`);
    const bind = () => {
      bindFilter(location, ['q', 'state']);
          bindColumnFilters({ location, link, navigate, scope: body(), domain: cfg.domain, filters: columnFiltersFor(cfg.domain, rows, params) });
      bindSelectAll();
      flushBatchStatus();
      const run = async (ids, action) => runBatch(() => service.batch(ids.map((id) => ({ id: Number(id), etag: etags.get(String(id)) })), action), ids, action, undefined, location);
      const rowOf = (id) => rows.find((row) => String(row.id) === String(id));
      bindActions({
        'toggle-state': (id) => run([id], (rowOf(id)?.state || 'Published') === 'Published' ? 'unpublish' : 'publish'),
        restore: (id) => run([id], 'restore'),
            duplicate: async (id) => { const created = await service.duplicate(Number(id)); await navigate(link(`/${cfg.domain}/${created.id}`, listState(params, {}, cfg.domain))); }
      });
      bindBatch(location, run);
    };
    return { html, bind };
  }

  // ---------- Mídia (com_media) ----------

  async function mediaPage(location) {
    if (!mediaService?.list) {
      return { html: page('media', 'Mídia', [{ label: 'Mídia' }], '<p class="admin-empty" role="status">Gerenciador de mídia não configurado nesta composição.</p>') };
    }
    const files = await mediaService.list();
    const upload = `<form class="admin-form" data-ext-upload><div class="admin-field"><label for="admin-media-file">Enviar imagem (${esc(MEDIA_MIME_TYPES.map((type) => type.replace('image/', '')).join(', '))}; até ${esc(formatSize(MEDIA_MAX_BYTES))})</label><input type="file" id="admin-media-file" name="file" accept="${esc(MEDIA_MIME_TYPES.join(','))}"></div><div class="admin-form-actions"><button type="submit" class="admin-btn admin-btn-success">${plusIcon()}Enviar</button></div></form>`;
    const table = renderMediaFiles(files, { canDelete: mediaService.canDelete });
    const note = mediaService.canDelete ? '' : '<p class="admin-help" role="note">Exclusão indisponível: o cliente de arquivos desta composição não expõe a operação de exclusão.</p>';
    const html = page('media', 'Mídia', [{ label: 'Mídia' }], `${status}${upload}${note}${table}`);
    const bind = () => {
      bindActions({
        copy: async (index) => {
          const file = files[Number(index)];
          const origin = globalThis.location?.origin ?? '';
          const absolute = `${origin}${file.url}`;
          if (globalThis.navigator?.clipboard?.writeText) { await globalThis.navigator.clipboard.writeText(absolute); report(`URL copiada: ${absolute}`); }
          else report(`Copie manualmente: ${absolute}`);
        },
        delete: async (index) => {
          const file = files[Number(index)];
          if (!globalThis.confirm?.(`Excluir definitivamente "${file.name}"? Artigos que usam este arquivo perderão a imagem.`)) return;
          if (!isCurrent()) return;
          await mediaService.remove(file.name);
          await reload(location);
        }
      });
      const form = body().querySelector?.('[data-ext-upload]');
      form?.addEventListener?.('submit', async (event) => {
        event?.preventDefault?.();
        if (!isCurrent()) return;
        const file = form.querySelector?.('[name="file"]')?.files?.[0];
        if (!file) { report('Escolha uma imagem para enviar.'); return; }
        if (!MEDIA_MIME_TYPES.includes(String(file.type).toLowerCase())) { report(`Tipo de imagem não suportado: ${file.type || '(vazio)'}.`); return; }
        if (file.size > MEDIA_MAX_BYTES) { report(`Arquivo maior que o limite de ${formatSize(MEDIA_MAX_BYTES)}.`); return; }
        try {
          const content = await file.arrayBuffer();
          if (!isCurrent()) return;
          await mediaService.uploadImage({ content, mimeType: file.type });
          await reload(location);
        } catch (error) { report(extensionErrorMessage(error, 'Não foi possível enviar o arquivo.')); }
      });
    };
    return { html, bind };
  }

  async function render(location) {
    const path = location.path;
    // Destino desta renderização; é o que amarra o recado do lote à listagem
    // que o pediu (ver `pendingBatchPath`).
    currentPath = path;
    if (path === '/articles' && adminService.articles?.query) return articleListPage(location);
    if (path === '/categories' && adminService.categories?.query) return taxonomyListPage(location, { domain: 'categories', label: 'Categorias' });
    if (path === '/tags' && adminService.tags?.query) return taxonomyListPage(location, { domain: 'tags', label: 'Tags' });
    if (path === '/media') return mediaPage(location);
    return null;
  }

  return { render };
}
