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

export function createContentPages({ adminService, documentRef, router, shell, mediaService, clock = () => new Date(), isCurrent = () => true }) {
  const link = (path, params) => router.link(path, params);
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

  function batchReport(result, location) {
    if (result.failed.length) {
      report(`${result.succeeded.length} item(ns) processado(s); ${result.failed.length} falha(s): ${result.failed.map((failure) => extensionErrorMessage(failure, failure.message)).join(' ')}`);
      return undefined;
    }
    return reload(location);
  }

  /*
     * Parâmetros que compõem o estado "de lista" (filtros de barra, filtros
     * por coluna, ordenação, direção e itens por página). Qualquer navegação
     * de/para a listagem preserva este conjunto, de modo que editar, salvar,
     * cancelar, excluir ou aplicar ação em lote não perde a filtragem.
     */
    const LIST_PARAM_NAMES = ['q', 'state', 'categoryId', 'featured', 'author', 'tag', 'language', 'limit', 'fTitle', 'fName', 'fAlias', 'fCategory', 'fAuthor', 'sort', 'dir'];

    function listState(location) {
      return Object.fromEntries(LIST_PARAM_NAMES.map((name) => [name, location?.params?.[name]]).filter(([, value]) => value));
    }

    /*
     * Filtros da barra. Os campos do formulário são a fonte da verdade para os
     * nomes que ele controla: alterar tem efeito e esvaziar um campo remove o
     * parâmetro (limpar). Apenas os parâmetros de lista que *não* pertencem ao
     * formulário (ex.: filtros por coluna, ordenação, itens por página) são
     * preservados do estado atual.
     */
    function bindFilter(location, names) {
      const form = body().querySelector?.('[data-ext-filter]');
      form?.addEventListener?.('submit', async (event) => {
        event?.preventDefault?.();
        if (!isCurrent()) return;
        const params = {};
        for (const keep of LIST_PARAM_NAMES) {
          if (names.includes(keep)) continue;
          if (location.params?.[keep]) params[keep] = location.params[keep];
      }
        for (const name of names) {
          const value = form.querySelector?.(`[name="${name}"]`)?.value;
          if (value) params[name] = value;
        }
        params.page = '';
        await navigate(link(location.path, params));
      });
    }

    /*
     * Autofiltro por coluna (estilo Excel). Cada <select data-ext-column-filter>
     * vive no cabeçalho da coluna e reage a `change`, aplicando imediatamente
     * sobre o conjunto completo. Os filtros são combináveis: o valor atual de
     * cada coluna é relido do próprio controle na hora de navegar, então vários
     * dropdowns ativos coexistem. Ao mudar um filtro voltamos à página 1,
     * porque o conjunto filtrado mudou e a página anterior pode não existir.
     *
     * Os selects ficam nos <th> da tabela, não dentro do formulário oculto que
     * apenas os agrupa para submissão por Enter; por isso lemos os controles
     * reais em vez de `form.querySelector`, que sempre devolveria vazio.
     */
    function bindColumnFilters(location, names) {
      const form = body().querySelector?.('[data-ext-column-filter-form]');
      const controls = Array.from(body().querySelectorAll?.('[data-ext-column-filter]') ?? []);
      if (!form || !controls.length) return undefined;
      const valueOf = (name) => controls.find((control) => control.name === name)?.value ?? '';
      const submit = async () => {
        if (!isCurrent()) return;
        const params = {};
        for (const [key, value] of Object.entries(listState(location))) {
          if (!names.includes(key)) params[key] = value;
        }
        for (const name of names) {
          const value = valueOf(name);
          if (value) params[name] = value;
      }
        params.page = '';
        await navigate(link(location.path, params));
      };
      for (const control of controls) control.addEventListener?.('change', submit);
      form.addEventListener?.('submit', async (event) => { event?.preventDefault?.(); await submit(); });
      return undefined;
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
    const table = renderArticlesTable(result, { link, params, now });
    const actions = { ...ARTICLE_ACTIONS, ...(inTrash ? TRASH_ACTIONS : {}) };
    const listStateParams = listState(location);
        const html = page('articles', 'Artigos', [{ label: 'Artigos' }], `${status}${filters}${batchForm(actions, categoryOptions)}${table}${pagination(result, (number) => link('/articles', { ...params, page: String(number) }))}`,
          `<a class="admin-btn admin-btn-success" href="${esc(link('/articles/new', listStateParams))}">${plusIcon()}Novo</a>`);
    const bind = () => {
      bindFilter(location, ['q', 'state', 'categoryId', 'featured', 'author', 'tag', 'language', 'limit']);
            bindColumnFilters(location, ['fTitle', 'fAlias', 'fCategory', 'fAuthor']);
      bindSelectAll();
      const run = async (ids, action, extra) => batchReport(await adminService.articles.batch(ids.map((id) => ({ id: Number(id), etag: etags.get(String(id)) })), action, extra), location);
      const rowOf = (id) => result.rows.find((row) => String(row.id) === String(id));
      bindActions({
        'toggle-state': (id) => run([id], (rowOf(id)?.state ?? 'Published') === 'Published' ? 'unpublish' : 'publish'),
        'toggle-featured': (id) => run([id], rowOf(id)?.featured ? 'unfeature' : 'feature'),
        restore: (id) => run([id], 'restore'),
        // Duplicar abre a COPIA no formulario levando o estado da lista: sem
        // isso o Cancelar/Salvar da copia voltaria para a lista sem filtros,
        // exatamente o defeito que este trabalho elimina.
        duplicate: async (id) => { const created = await adminService.articles.duplicate(Number(id)); await navigate(link(`/articles/${created.id}`, listState(location))); }
      });
      bindBatch(location, run, { needsCategory: true });
    };
    return { html, bind };
  }

  // ---------- Categorias (com_categories) e Tags (com_tags) ----------

  async function taxonomyListPage(location, cfg) {
    const params = location.params ?? {};
    const service = adminService[cfg.domain];
      const result = await service.query(params);
      const rows = result.rows;
    const etags = new Map(rows.map((row) => [String(row.id), row.etag]));
    const inTrash = params.state === 'Trashed';
    const filters = filterBar(`admin-${cfg.domain}-filter`, [
      { name: 'q', label: 'Buscar por título, alias ou id:N', type: 'search', value: params.q },
      { name: 'state', label: 'Estado', value: params.state, options: TAXONOMY_STATE_OPTIONS }
    ]);
      // Categorias e tags usam a coluna de nome/título (`fTitle`/`fName`) mais
      // alias, exatamente os campos que o serviço declara para cada domínio.
      const columnFields = cfg.domain === 'categories' ? ['fTitle', 'fAlias'] : ['fName', 'fAlias'];
      const table = cfg.domain === 'categories'
        ? renderCategoriesTable(rows, { link, params, facets: result.facets })
        : renderTagsTable(rows, { link, params, facets: result.facets });
    const html = page(cfg.domain, cfg.label, [{ label: cfg.label }], `${status}${filters}${batchForm({ ...TAXONOMY_ACTIONS, ...(inTrash ? TRASH_ACTIONS : {}) })}${table}`,
        `<a class="admin-btn admin-btn-success" href="${esc(link(`/${cfg.domain}/new`, listState(location)))}">${plusIcon()}Novo</a>`);
    const bind = () => {
      bindFilter(location, ['q', 'state']);
        bindColumnFilters(location, columnFields);
      bindSelectAll();
      const run = async (ids, action) => batchReport(await service.batch(ids.map((id) => ({ id: Number(id), etag: etags.get(String(id)) })), action), location);
      const rowOf = (id) => rows.find((row) => String(row.id) === String(id));
      bindActions({
        'toggle-state': (id) => run([id], (rowOf(id)?.state || 'Published') === 'Published' ? 'unpublish' : 'publish'),
        restore: (id) => run([id], 'restore'),
        duplicate: async (id) => { const created = await service.duplicate(Number(id)); await navigate(link(`/${cfg.domain}/${created.id}`, listState(location))); }
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
