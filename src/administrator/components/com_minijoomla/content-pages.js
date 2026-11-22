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

const esc = (value) => escapeHtml(String(value ?? ''));
const status = '<p class="admin-form-status admin-management-status" role="status" aria-live="polite" aria-atomic="true" data-ext-status></p>';

const ARTICLE_STATE_OPTIONS = [['', '— Estado (exceto lixeira) —'], ['Published', 'Publicados'], ['Draft', 'Despublicados'], ['Archived', 'Arquivados'], ['Trashed', 'Na lixeira'], ['*', 'Todos']];
const TAXONOMY_STATE_OPTIONS = [['', '— Estado (exceto lixeira) —'], ['Published', 'Publicados'], ['Unpublished', 'Despublicados'], ['Trashed', 'Na lixeira'], ['*', 'Todos']];
const ARTICLE_ACTIONS = { publish: 'Publicar', unpublish: 'Despublicar', archive: 'Arquivar', feature: 'Destacar', unfeature: 'Remover destaque', duplicate: 'Duplicar', trash: 'Enviar para a lixeira', move: 'Mover para a categoria' };
const TAXONOMY_ACTIONS = { publish: 'Publicar', unpublish: 'Despublicar', duplicate: 'Duplicar', trash: 'Enviar para a lixeira' };
const TRASH_ACTIONS = { restore: 'Restaurar da lixeira', delete: 'Excluir definitivamente' };
const PAGE_LIMITS = [10, 20, 50, 100];

/*
 * Nomes de parâmetro do menu de coluna. Ficam em `col_<campo>` para não
 * colidir com os filtros de gerenciamento já existentes (`state`,
 * `categoryId`, `featured`, `author`…), que continuam valendo com o
 * mesmo significado de antes.
 */
const colParam = (field) => `col_${field}`;

/*
 * Um menu por coluna, com os valores distintos REAIS das linhas já
 * carregadas. `field` é o campo usado para filtrar, `column` é a coluna
 * da tabela e `name` o parâmetro de URL — os três podem diferir: a
 * coluna Categoria tem `column: 'category'`, `name: 'col_categoryId'` e
 * `field: 'categoryId'`, porque o filtro é por ID CANÔNICO e nunca pelo
 * título (G1: duas categorias homônimas em ramos distintos têm o mesmo
 * título e o filtro por título as confundia).
 * `internal: true` marca filtros que já têm um `<select>` no
 * `filterBar` (a barra de filtros do topo): o menu de coluna existe
 * pelo princípio do pedido (filtro independente por coluna), mas os
 * valores distintos para o menu continuam vindo das linhas, e o valor
 * corrente é lido da URL para que os dois controles nunca discordem.
 */
function columnFilterDefinitions(specs, rows, params = {}) {
  return specs.map((spec) => {
    const name = spec.name ?? colParam(spec.field ?? spec.column);
    const distinct = [...new Set(rows.map((row) => spec.valueOf ? spec.valueOf(row) : row[spec.field ?? spec.column]).map((value) => (value === undefined || value === null) ? '' : String(value)).filter((value) => value !== ''))];
    const options = spec.options ? spec.options(distinct) : distinct.sort((a, b) => a.localeCompare(b, 'pt-BR')).map((value) => [value, value]);
    const selected = String(params[name] ?? '');
    // Um único valor distinto não oferece filtragem: escondê-lo evita um
    // menu que não faz nada. Se ele está ativo (mesmo com um só valor),
    // mostramos, senão o usuário não teria como desfazer o filtro.
    return { column: spec.column, name, label: spec.label, value: selected, options, keep: selected !== '' || options.length > 1 };
  }).filter((filter) => filter.keep).map(({ keep, ...filter }) => filter);
}

/**
 * Liga os menus de filtro por coluna renderizados por
 * `renderColumnFilter` (render-list.js). Contrato de teclado, igual ao
 * de um menu real:
 *   - Enter/Espaço/clique no botão abre; Escape fecha e devolve o foco
 *     ao botão (nunca deixa o foco perdido no vazio);
 *   - setas ↑/↓ percorrem as opções, Home/End vão à primeira/última;
 *   - Enter/Espaço escolhem a opção focada; a escolha navega para a
 *     mesma lista com o filtro aplicado, PRESERVANDO os outros filtros,
 *     a busca e a ordenação, e VOLTANDO para a página 1 (um filtro novo
 *     muda o conjunto de resultados; ficar numa página que talvez não
 *     exista mais mostraria lista vazia sem explicação);
 *   - clique fora fecha todos os menus abertos;
 *   - qualquer navegação durante um `await` é ignorada (`isCurrent`).
 * O filtro é aplicado por NAVEGAÇÃO (link de router), não por
 * re-render local: assim a URL sempre descreve o que está na tela, o
 * botão "voltar" funciona e recarregar a página mantém o filtro.
 */
function bindColumnFilters(location, navigate, scope) {
  const containers = Array.from(scope?.querySelectorAll?.('[data-colfilter]') ?? []);
  if (!containers.length) return;
  const closeAll = (except) => containers.forEach((container) => {
    if (container === except) return;
    container.querySelector?.('[data-colfilter-menu]')?.setAttribute('hidden', '');
    container.querySelector?.('[data-colfilter-toggle]')?.setAttribute('aria-expanded', 'false');
    container.classList.remove('is-open');
  });
  containers.forEach((container) => {
    const toggle = container.querySelector?.('[data-colfilter-toggle]');
    const menu = container.querySelector?.('[data-colfilter-menu]');
    if (!toggle || !menu) return;
    const items = () => Array.from(menu.querySelectorAll?.('[data-colfilter-option]') ?? []);
    const focusItem = (index) => { const options = items(); if (!options.length) return; const target = options[(index + options.length) % options.length]; options.forEach((option) => { option.tabIndex = option === target ? 0 : -1; }); target.focus?.(); };
    const setOpen = (open) => {
      if (open) closeAll(container);
      menu.toggleAttribute?.('hidden', !open);
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      container.classList.toggle?.('is-open', open);
      if (open) focusItem(Math.max(0, items().findIndex((option) => option.getAttribute?.('aria-checked') === 'true')));
    };
    toggle.addEventListener?.('click', (event) => { event?.preventDefault?.(); setOpen(menu.hidden !== false && menu.hasAttribute?.('hidden') !== false ? true : Boolean(menu.hidden)); });
    toggle.addEventListener?.('keydown', (event) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
      event.preventDefault?.();
      const open = !menu.hidden; setOpen(true); if (!open) focusItem(0);
    });
    menu.addEventListener?.('keydown', (event) => {
      const options = items();
      const current = options.indexOf(scope.activeElement ?? options.find((option) => option.tabIndex === 0));
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault?.();
        focusItem(event.key === 'ArrowDown' ? current + 1 : event.key === 'ArrowUp' ? current - 1 : event.key === 'Home' ? 0 : options.length - 1);
        return;
      }
      if (event.key === 'Escape') { event.preventDefault?.(); setOpen(false); toggle.focus?.(); return; }
      if (event.key === 'Tab') { setOpen(false); return; }
      if (['Enter', ' '].includes(event.key)) { event.preventDefault?.(); options[current]?.click?.(); }
    });
    items().forEach((option) => option.addEventListener?.('click', (event) => {
      event?.preventDefault?.();
      const value = option.dataset?.colfilterValue ?? '';
      const next = { ...(location.params ?? {}), [container.dataset.colfilterName]: value || undefined, page: undefined };
      setOpen(false);
      navigate(link(location.path, next));
    }));
  });
  scope?.addEventListener?.('click', (event) => { if (!containers.some((container) => container.contains?.(event.target))) closeAll(); });
  scope?.addEventListener?.('keydown', (event) => { if (event.key === 'Escape') closeAll(); });
}

export function createContentPages({ adminService, documentRef, router, shell, mediaService, clock = () => new Date(), isCurrent = () => true }) {
  const link = (path, params) => router.link(path, params);

  /*
   * Estado da LISTA que precisa sobreviver a abrir/criar/duplicar/
   * cancelar/voltar: cada filtro ativo (barra do topo e menus de
   * coluna), a busca e a ordenação/limite — nunca `page`, que pertence à
   * listagem e não ao registro aberto (voltar de um formulário para a
   * página 7 de uma lista que o filtro encolheu mostraria vazio).
   * Sem isto, "cancelar" voltava para a lista limpa, que é o defeito
   * relatado.
   */
  const listState = (params = {}, extras = {}) => Object.fromEntries(Object.entries({
    q: params.q, sort: params.sort, dir: params.dir, limit: params.limit, ...extras
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''));

  /*
   * Colunas filtráveis de cada listagem de conteúdo. `internal: true`
   * indica que a coluna já tem controle equivalente na barra de filtros
   * (Estado, Categoria, Autor, Destaque); o menu de coluna é adicional e
   * mantém o mesmo parâmetro de URL, para os dois nunca divergirem.
   */
  function columnFiltersFor(domain, source, params = {}) {
    const rows = source?.rows ?? source ?? [];
    if (domain === 'articles') {
      return columnFilterDefinitions([
        { column: 'state', label: 'Estado', valueOf: (row) => row.state, options: () => [['Published', 'Publicado'], ['Draft', 'Despublicado'], ['Archived', 'Arquivado'], ['Trashed', 'Na lixeira']] },
        { column: 'title', label: 'Título', field: 'title' },
        { column: 'alias', label: 'Alias', field: 'alias' },
        { column: 'category', label: 'Categoria', name: 'categoryId', field: 'categoryId', options: (values) => values.map((id) => [id, rows.find((row) => String(row.categoryId) === id)?.categoryPath || rows.find((row) => String(row.categoryId) === id)?.categoryTitle || id]).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')) },
        { column: 'author', label: 'Autor', field: 'author' },
        { column: 'featured', label: 'Destaque', field: 'featured', options: () => [['1', 'Em destaque'], ['0', 'Sem destaque']] },
        { column: 'id', label: 'ID', field: 'id' }
      ], rows, params);
    }
    const titleField = domain === 'categories' ? 'title' : 'name';
    return columnFilterDefinitions([
      { column: 'title', label: domain === 'categories' ? 'Título' : 'Nome', field: titleField },
      { column: 'alias', label: 'Alias', field: 'alias' },
      { column: 'id', label: 'ID', field: 'id' }
    ], rows, params);
  }
  const home = () => ({ label: 'Painel de controle', href: link('/') });
  const page = (activeKey, pageTitle, crumbs, bodyHtml, toolbarActionsHtml = '') => shell({ activeKey, pageTitle, breadcrumbItems: [home(), ...crumbs], bodyHtml, toolbarActionsHtml, link });
  const body = () => documentRef.body;
  const report = (message) => { if (!isCurrent()) return; const element = body().querySelector?.('[data-ext-status]'); if (element) element.textContent = message; };
  const navigate = (...args) => isCurrent() ? router.navigate(...args) : undefined;
  const reload = (location) => navigate(link(location.path, location.params));

  function selectedIds() {
    return Array.from(body().querySelectorAll?.('[data-ext-select]') ?? []).filter((input) => input.checked).map((input) => input.value);
  }

  function bindSelectAll() {
    const all = body().querySelector?.('[data-ext-select-all]');
    all?.addEventListener?.('change', () => { if (!isCurrent()) return; body().querySelectorAll?.('[data-ext-select]')?.forEach?.((input) => { input.checked = Boolean(all.checked); }); });
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
      if (!result.failed.length) return redirect ? redirect(location) : reload(location);
        throw Object.assign(new Error(`${result.succeeded.length} item(ns) processado(s); ${result.failed.length} falha(s): ${result.failed.map((failure) => extensionErrorMessage(failure, failure.message)).join(' ')}`), { partialBatch: true, succeeded: result.succeeded.length });
  }

  function bindFilter(location, names) {
    const form = body().querySelector?.('[data-ext-filter]');
    form?.addEventListener?.('submit', async (event) => {
      event?.preventDefault?.();
      if (!isCurrent()) return;
      const params = Object.fromEntries(names.map((name) => [name, form.querySelector?.(`[name="${name}"]`)?.value]).filter(([, value]) => value));
      for (const keep of ['sort', 'dir']) if (location.params?.[keep]) params[keep] = location.params[keep];
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
        }
      return undefined;
    }
  }

  function bindBatch(location, run, { needsCategory = false } = {}) {
    const form = body().querySelector?.('[data-ext-batch]');
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
    const category = categoryOptions ? `<label for="admin-batch-category">Categoria de destino</label><select id="admin-batch-category" name="batchCategory">${options([['', '— Categoria —'], ...categoryOptions.map((option) => [option.value, option.label])], '')}</select>` : '';
    return `<form class="admin-batch" data-ext-batch aria-label="Ações em lote"><label for="admin-batch-action">Ações em lote</label><select id="admin-batch-action" name="batchAction">${options([['', '— Selecione —'], ...Object.entries(actions)], '')}</select>${category}<button type="submit" class="admin-btn">Aplicar aos selecionados</button></form>`;
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
    const filters = filterBar('admin-articles-filter', [
      { name: 'q', label: 'Buscar por título, alias, nota ou id:N', type: 'search', value: params.q },
      { name: 'state', label: 'Estado', value: params.state, options: ARTICLE_STATE_OPTIONS },
      { name: 'categoryId', label: 'Categoria', value: params.categoryId, options: [['', '— Categoria —'], ...categoryOptions.map((option) => [String(option.value), option.label])] },
      { name: 'featured', label: 'Destaque', value: params.featured, options: [['', '— Destaque —'], ['1', 'Em destaque'], ['0', 'Sem destaque']] },
      { name: 'author', label: 'Autor', value: params.author, options: [['', '— Autor —'], ...result.facets.authors.map((author) => [author, author])] },
      { name: 'tag', label: 'Tag', value: params.tag, options: [['', '— Tag —'], ...tagRows.map((tag) => [tag.name, tag.name])] },
      { name: 'language', label: 'Idioma', value: params.language, options: [['', '— Idioma —'], ...result.facets.languages.map((language) => [language, language])] },
      { name: 'limit', label: 'Itens por página', value: params.limit || String(result.limit), options: PAGE_LIMITS.map((limit) => [String(limit), `${limit} por página`]) }
    ]);
    const table = renderArticlesTable(result, { link, params, now, columnFilters: columnFiltersFor('articles', result, params), returnParams: listState(params) });
    const actions = { ...ARTICLE_ACTIONS, ...(inTrash ? TRASH_ACTIONS : {}) };
    const html = page('articles', 'Artigos', [{ label: 'Artigos' }], `${status}${filters}${batchForm(actions, categoryOptions)}${table}${pagination(result, (number) => link('/articles', { ...params, page: String(number) }))}`,
          `<a class="admin-btn admin-btn-success" href="${esc(link('/articles/new', listState(params)))}">${plusIcon()}Novo</a>`);
    const bind = () => {
      bindFilter(location, ['q', 'state', 'categoryId', 'featured', 'author', 'tag', 'language', 'limit']);
          bindColumnFilters(location, navigate, body());
      bindSelectAll();
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
    const filters = filterBar(`admin-${cfg.domain}-filter`, [
      { name: 'q', label: 'Buscar por título, alias ou id:N', type: 'search', value: params.q },
      { name: 'state', label: 'Estado', value: params.state, options: TAXONOMY_STATE_OPTIONS }
    ]);
    const table = cfg.domain === 'categories'
          ? renderCategoriesTable(rows, { link, columnFilters: columnFiltersFor('categories', rows, params), returnParams: listState(params) })
          : renderTagsTable(rows, { link, columnFilters: columnFiltersFor('tags', rows, params), returnParams: listState(params) });
    const html = page(cfg.domain, cfg.label, [{ label: cfg.label }], `${status}${filters}${batchForm({ ...TAXONOMY_ACTIONS, ...(inTrash ? TRASH_ACTIONS : {}) })}${table}`,
          `<a class="admin-btn admin-btn-success" href="${esc(link(`/${cfg.domain}/new`, listState(params)))}">${plusIcon()}Novo</a>`);
    const bind = () => {
      bindFilter(location, ['q', 'state']);
          bindColumnFilters(location, navigate, body());
      bindSelectAll();
      const run = async (ids, action) => runBatch(() => service.batch(ids.map((id) => ({ id: Number(id), etag: etags.get(String(id)) })), action), ids, action, undefined, location);
      const rowOf = (id) => rows.find((row) => String(row.id) === String(id));
      bindActions({
        'toggle-state': (id) => run([id], (rowOf(id)?.state || 'Published') === 'Published' ? 'unpublish' : 'publish'),
        restore: (id) => run([id], 'restore'),
            duplicate: async (id) => { const created = await service.duplicate(Number(id)); await navigate(link(`/${cfg.domain}/${created.id}`, listState(params))); }
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
    if (path === '/articles' && adminService.articles?.query) return articleListPage(location);
    if (path === '/categories' && adminService.categories?.query) return taxonomyListPage(location, { domain: 'categories', label: 'Categorias' });
    if (path === '/tags' && adminService.tags?.query) return taxonomyListPage(location, { domain: 'tags', label: 'Tags' });
    if (path === '/media') return mediaPage(location);
    return null;
  }

  return { render };
}
