import assert from 'node:assert/strict';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { rememberListFilters, recallListFilters, listFilterKey } from '../src/administrator/components/com_minijoomla/list-memory.js';

/*
 * Filtros persistentes e filtro por coluna no painel administrativo.
 *
 * Este suite cobre o comportamento que o pedido descreve, e não detalhes
 * de markup: que a LISTA DE ORIGEM (filtros + busca + ordenação, nunca a
 * página) sobrevive a editar/salvar/cancelar/novo/duplicar/lote e à ida e
 * volta pela sidebar; que cada coluna filtra independentemente; e que o
 * lote com FALHA PARCIAL reflete o estado real em vez de mentir.
 *
 * O harness é o mesmo espírito dos demais testes de app.js: um
 * documentRef sintético com um `Map` de elementos por seletor, suficiente
 * porque `app.js` só acessa `body.innerHTML`, `body.querySelector` e
 * `body.querySelectorAll`.
 */

function createFakeAdminService(seed = {}) {
  const domains = {};
  for (const [domain, rows] of Object.entries(seed.domains ?? {})) {
    let nextId = Math.max(0, ...rows.map((row) => row.id ?? 0)) + 1;
    const store = new Map(rows.map((row) => [row.id, { etag: '"1"', ...row }]));
    domains[domain] = {
      list: async () => [...store.values()],
      get: async (id) => store.get(id) ?? null,
      create: async (input) => { const id = nextId++; const record = { id, etag: '"1"', ...input }; store.set(id, record); return record; },
      update: async (id, input, { etag }) => { const current = store.get(id); if (!current || etag !== current.etag) { const error = new Error('conflito'); error.code = 'concurrency-conflict'; throw error; } const updated = { ...current, ...input, etag: '"2"' }; store.set(id, updated); return updated; },
      remove: async (id, { etag }) => { const current = store.get(id); if (!current || etag !== current.etag) { const error = new Error('conflito'); error.code = 'concurrency-conflict'; throw error; } store.delete(id); }
    };
  }
  const config = seed.config ?? null;
  const service = {
    ...domains,
    siteConfig: { get: async () => config, save: async (input) => ({ ...config, ...input, etag: '"1"' }) },
    overview: async () => ({ articles: 0, categories: 0, tags: 0, menu: 0, extensions: 0, moduleInstances: 0 })
  };
  // `com_plugins` não é uma lista de domínio: tem serviço próprio e só é
  // assumido por `extension-pages.js` quando expõe `catalog`/`list`. Sem esta
  // superfície a rota `/plugins` cai silenciosamente na listagem genérica.
  if (domains.plugins) service.plugins = {
    ...domains.plugins,
    catalog: () => domains.plugins.list(),
    groups: (rows) => [...new Set((rows ?? []).map((row) => row.group).filter(Boolean))]
  };
  if (domains.moduleInstances) service.moduleInstances = { ...domains.moduleInstances, ...(seed.moduleInstances ?? {}) };
  return service;
}

/*
 * Repositório no formato de `createRepository`, usado só pelo caso G1:
 * ali o que está sob teste é a camada de serviço (rótulos e filtro por id),
 * não a listagem renderizada.
 */
function categoryRepository() {
  const rows = [
    { id: 10, title: 'Institucional', alias: 'institucional', parentId: null, state: 'Published' },
    { id: 11, title: 'Avisos', alias: 'avisos', parentId: 10, state: 'Published' },
    { id: 12, title: 'Avisos', alias: 'avisos-a', parentId: 10, state: 'Published' },
    { id: 13, title: 'Avisos', alias: 'avisos-b', parentId: 10, state: 'Published' },
    { id: 14, title: 'Avisos', alias: 'avisos', parentId: null, state: 'Published' }
  ];
  const articles = [
    { id: 201, title: 'Da A', alias: 'da-a', categoryId: 12, state: 'Published' },
    { id: 202, title: 'Da B', alias: 'da-b', categoryId: 13, state: 'Published' }
  ];
  const store = (seed) => {
    const items = new Map(seed.map((item) => [item.id, { etag: '"1"', ...item }]));
    let nextId = Math.max(0, ...seed.map((item) => item.id)) + 1;
    const reader = (item) => Object.freeze(Object.defineProperty({ ...item }, 'etag', { value: item.etag, enumerable: false }));
    return {
      async findMany() { return { items: [...items.values()].map(({ etag, ...rest }) => ({ ...rest })) }; },
      async findById(id) { const item = items.get(id); if (!item) throw Object.assign(new Error('not found'), { code: 'not-found' }); return reader(item); },
      async create(input) { const id = nextId++; const item = { id, etag: '"1"', ...input }; items.set(id, item); return reader(item); },
      async update(id, input, { etag } = {}) { const item = items.get(id); if (etag !== item.etag) throw Object.assign(new Error('etag'), { code: 'concurrency-conflict' }); items.set(id, { ...item, ...input, etag: '"2"' }); return null; },
      async delete(id, { etag } = {}) { const item = items.get(id); if (etag !== item.etag) throw Object.assign(new Error('etag'), { code: 'concurrency-conflict' }); items.delete(id); }
    };
  };
  const empty = store([]);
  return { categories: store(rows), articles: store(articles), tags: empty, menu: empty, extensions: empty, moduleInstances: empty, siteConfig: empty };
}

/*
 * Documento sintético com dois modos de consulta:
 *   - por nome de campo (`[name="x"]`), para os formulários;
 *   - por atributo data (`[data-admin-delete]`, `[data-ext-batch]`…).
 * `innerHTML` guarda o markup renderizado, então as asserções leem o HTML
 * real (é a mesma fonte em que o navegador se basearia).
 */
function createFakeDocumentRef({ elements = {} } = {}) {
  const listenersByElement = new Map();
  const registry = new Map(Object.entries(elements));
  let activeElement = null;
  // Redeclarado abaixo como preenchido por `wireColumnFilters`: um navegador
  // real cria os elementos ANTES do script da página registrar listeners,
  // então o fake precisa materializar a estrutura de filtro por coluna a cada
  // gravação de `innerHTML`. Sem isso `bindColumnFilters` lê uma coleção vazia
  // e nenhum clique do menu chega a ter efeito.
  let wireOnRender = () => {};
  /*
   * Elemento sintético keyed por um "endereço" estável (`nome`, `attr:x=v`,
   * seletor cru…). `bindColumnFilters` localiza o menu por
   * `container.querySelector('[data-colfilter-menu]')` e as opções por
   * `menu.querySelectorAll('[data-colfilter-option]')`; por isso o fake
   * resolve seletores de atributo por endereço filho, e registra os itens
   * de `querySelectorAll` sob `<chave-pai>|<seletor>`.
   */
  function element(key) {
    if (!registry.has(key)) {
      registry.set(key, {
        value: '', checked: false, textContent: '', disabled: false, dataset: {}, attributes: {},
        addEventListener: (event, handler) => { const list = listenersByElement.get(key) ?? []; list.push({ event, handler }); listenersByElement.set(key, list); },
        // Todo elemento sintético resolve `[name="..."]` para um input próprio
        // (mesmo contrato do fake de tests/admin-app.test.js): os formulários
        // do painel leem seus campos por `form.querySelector('[name=...]')`,
        // e um stub que sempre devolve null faria o salvamento enviar um
        // payload vazio — exatamente o defeito que este teste precisa pegar.
        querySelector: (selector) => {
          const name = String(selector).match(/^\[name="(.+)"\]$/);
          if (name) return element(`name:${name[1]}`);
          const attr = String(selector).match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/);
          if (!attr) return null;
          const address = `attr:${attr[1]}=${attr[2] ?? ''}`;
          const children = registry.get(`${key}|${selector}`);
          return children?.length ? children[0] : element(`${key}|${address}`);
        },
        querySelectorAll: (selector) => registry.get(`${key}|${selector}`) ?? [],
        setAttribute: (attribute, value) => { const node = registry.get(key); node.attributes = { ...node.attributes, [attribute]: String(value ?? '') }; },
        removeAttribute: (attribute) => { const node = registry.get(key); const next = { ...node.attributes }; delete next[attribute]; node.attributes = next; },
        hasAttribute: (attribute) => Object.prototype.hasOwnProperty.call(registry.get(key).attributes, attribute),
        toggleAttribute: (attribute, force) => { if (force) registry.get(key).setAttribute(attribute, ''); else registry.get(key).removeAttribute(attribute); },
        focus: () => { activeElement = registry.get(key); },
        contains: () => false
      });
    }
    return registry.get(key);
  }
  const formElement = element('[data-admin-form]');
  const documentRef = {
    body: {
      _html: '',
      get innerHTML() { return this._html; },
      set innerHTML(html) { this._html = String(html ?? ''); wireOnRender(documentRef.body, html); },
      ownerDocument: null,
      querySelector: (selector) => {
        // O formulário resolve para um elemento sintético próprio, que
        // responde a `[name="..."]` (mesmo contrato do fake de
        // tests/admin-app.test.js). Sem isso `readAdminFormValues` não lê
        // nenhum campo e o salvamento enviaria um payload vazio.
        if (selector === '[data-admin-form]') return formElement;
        const name = selector.match(/^\[name="(.+)"\]$/);
        if (name) return element(`name:${name[1]}`);
        // Qualquer outro seletor (botão de excluir, área de status)
        // resolve para um elemento sintético: `app.js` só precisa de um
        // alvo estável para registrar listener e ler/escrever `value`.
        return element(selector);
      },
      // A seleção em lote e os containers de filtro por coluna são lidos por
      // `querySelectorAll(...)` e iterados; `setList`/`wireColumnFilters`
      // registram essas coleções.
      querySelectorAll: (selector) => (registry.get(selector) ?? []),
      contains: () => false
    }
  };
  documentRef.body.ownerDocument = documentRef;
  return {
    documentRef,
    element,
    set: (key, value) => registry.set(key, value),
    setList: (selector, items) => registry.set(selector, items),
    // Registra os filhos de `parent|selector` para `querySelector`/`All`.
    setChildren: (parentSelector, selector, items) => registry.set(`${parentSelector}|${selector}`, items),
    setWireOnRender: (fn) => { wireOnRender = fn; },
    get activeElement() { return activeElement; },
    // A lista de listeners é copiada antes de iterar: um handler pode
    // re-renderizar a tela e registrar novos listeners no MESMO elemento,
    // e iterar o array vivo faria o dispatch nunca terminar.
    dispatch: async (key, event) => { for (const entry of [...(listenersByElement.get(key) ?? [])]) if (entry.event === event) await entry.handler({ preventDefault: () => {} }); }
  };
}

/*
 * `sessionStorage` sintético: a memória de filtro é o mecanismo testado,
 * então precisa de um storage de verdade (com get/set/remove), não de um
 * stub que sempre devolve o mesmo valor.
 */
function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    get size() { return map.size; }
  };
}

async function mountApp(adminService, storage, documentRef) {
  const app = createAdminApplication({ adminService, documentRef, autoStart: false });
  app.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  return app;
}

/*
 * O fake de documento é chaveado, não é uma árvore DOM. Para exercitar de
 * verdade os menus de filtro por coluna (e não só a aparência do HTML),
 * esta rotina lê o markup JÁ RENDERIZADO e materializa exatamente a
 * estrutura que `bindColumnFilters` procura: cada `[data-colfilter]` com
 * seu toggle, seu menu e suas opções. Sem ela o binding seria um no-op e o
 * teste "provaria" um clique que nunca chegou a nenhum listener.
 */
function wireColumnFilters(fake, html) {
  const containers = [];
  const optionsByContainer = new Map();
  const containerRe = /<span class="admin-colfilter[^"]*"[^>]*data-colfilter[^>]*data-colfilter-column="([^"]*)"[^>]*data-colfilter-name="([^"]*)"[^>]*data-colfilter-value="([^"]*)"[\s\S]*?<ul class="admin-colfilter-menu"[^>]*>([\s\S]*?)<\/ul><\/span>/g;
  let match;
  while ((match = containerRe.exec(html))) {
    const [, column, name] = match;
    const container = fake.element(`attr:data-colfilter-column=${column}`);
    container.dataset = { colfilter: '', colfilterColumn: column, colfilterName: name };
    const toggle = fake.element(`toggle:${name}`);
    const menu = fake.element(`menu:${name}`);
    const options = [...match[4].matchAll(/data-colfilter-option data-colfilter-value="([^"]*)"/g)].map(([, value], index) => {
      const option = fake.element(`option:${name}:${value}:${index}`);
      option.dataset = { colfilterOption: '', colfilterValue: value };
      return option;
    });
    menu.querySelectorAll = (selector) => (selector === '[data-colfilter-option]' ? options : []);
    menu.hasAttribute = (attribute) => attribute === 'hidden';
    container.querySelector = (selector) => (selector === '[data-colfilter-toggle]' ? toggle : selector === '[data-colfilter-menu]' ? menu : null);
    containers.push(container);
    optionsByContainer.set(name, options);
  }
  fake.setList('[data-colfilter]', containers);
  fake.lastColumnFilters = { containers, optionsByContainer };
  return { containers, optionsByContainer };
}

function withStorage(storage, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true, writable: true });
  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous);
      else delete globalThis.sessionStorage;
    });
}

// ---------------------------------------------------------------------------
// 1. Memória de filtro por lista (unidade)
// ---------------------------------------------------------------------------

async function runListMemoryTests() {
  const storage = createFakeStorage();
  rememberListFilters('/articles', { q: 'blog', col_alias: 'a', state: 'Published' }, storage);
  assert.deepEqual(recallListFilters('/articles', storage), { q: 'blog', col_alias: 'a', state: 'Published' });
  assert.deepEqual(recallListFilters('/categories', storage), {}, 'a memória é por lista, nunca global');
  assert.equal(listFilterKey('/articles'), 'minijoomla.admin.listFilters:/articles');

  // Valores vazios não são lembrados: um filtro removido não pode voltar
  // como `?state=` na próxima visita.
  rememberListFilters('/articles', { q: 'blog', state: '', col_alias: undefined, page: null }, storage);
  assert.deepEqual(recallListFilters('/articles', storage), { q: 'blog' });

  // `page` é sempre descartado, mesmo presente e não-vazio: a memória é do
  // recorte de filtros, e restaurar a página de uma lista que o filtro
  // encolheu mostraria uma tela vazia.
  rememberListFilters('/articles', { col_state: 'Published', page: '7' }, storage);
  assert.deepEqual(recallListFilters('/articles', storage), { col_state: 'Published' });
  assert.deepEqual(recallListFilters('/articles', storage).page, undefined);

  // Zero filtros ativos apaga a memória daquela lista.
  rememberListFilters('/articles', {}, storage);
  assert.deepEqual(recallListFilters('/articles', storage), {});

  // Storage hostil (modo privado, cota, valor corrompido) nunca propaga erro:
  // na pior hipótese o filtro não é lembrado, que é o comportamento antigo.
  const throwing = { getItem: () => { throw new Error('negado'); }, setItem: () => { throw new Error('negado'); }, removeItem: () => { throw new Error('negado'); } };
  assert.doesNotThrow(() => rememberListFilters('/articles', { q: 'x' }, throwing));
  assert.deepEqual(recallListFilters('/articles', throwing), {});
  const corrupt = createFakeStorage();
  corrupt.setItem(listFilterKey('/articles'), '{ não é json');
  assert.deepEqual(recallListFilters('/articles', corrupt), {});
  corrupt.setItem(listFilterKey('/articles'), '[1,2,3]');
  assert.deepEqual(recallListFilters('/articles', corrupt), {}, 'um array nunca é um estado de filtro válido');

  console.log('ok - memoria de filtro: por lista, descarta vazios, apaga ao limpar e nunca lanca com storage hostil');
}

// ---------------------------------------------------------------------------
// 2. Filtro por coluna independente sobre a listagem real
// ---------------------------------------------------------------------------

async function runColumnFilterTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const admin = createFakeAdminService({ domains: { articles: [
      { id: 1, title: 'Primeiro', alias: 'primeiro', state: 'Published', featured: true },
      { id: 2, title: 'Segundo', alias: 'segundo', state: 'Draft', featured: false },
      { id: 3, title: 'Terceiro', alias: 'terceiro', state: 'Published', featured: false }
    ] } });
    const fake = createFakeDocumentRef();
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/articles');
      const all = fake.documentRef.body.innerHTML;
      assert.match(all, /data-colfilter-column="title"/, 'Título tem menu próprio');
      assert.match(all, /data-colfilter-column="alias"/, 'Alias tem coluna própria');
      assert.match(all, /data-colfilter-name="col_title"/);
      assert.match(all, /data-colfilter-name="col_alias"/);

      // Filtrar por Alias não pode tocar no Título: cada coluna é independente.
      await app.router.navigate('#/articles?col_alias=segundo');
      const byAlias = fake.documentRef.body.innerHTML;
      assert.match(byAlias, /href="#\/articles\/2(\?[^"]*)?"/);
      assert.ok(!byAlias.includes('href="#/articles/1'), 'linha de outro alias não aparece');
      assert.match(byAlias, /data-colfilter-column="title"/, 'o menu de Título continua disponível com outro filtro ativo');

      // Dois filtros de coluna coexistem (interseção), sem um sobrescrever o outro.
      await app.router.navigate('#/articles?col_alias=primeiro&col_state=Draft');
      const empty = fake.documentRef.body.innerHTML;
      assert.match(empty, /admin-empty/, 'interseção vazia não inventa linha');
      assert.match(empty, /data-colfilter-column="title"/, 'mesmo vazia a lista mantém o cabeçalho para o usuário desfazer o filtro');
      assert.ok(!empty.includes('href="#/articles/1'), 'nenhuma linha sobrevive à interseção vazia');

      // A busca textual da barra do topo convive com o filtro de coluna.
      await app.router.navigate('#/articles?col_state=Published&q=Primeiro');
      const combined = fake.documentRef.body.innerHTML;
      assert.match(combined, /href="#\/articles\/1(\?[^"]*)?"/);
      assert.ok(!combined.includes('href="#/articles/3'), 'a busca estreita o resultado do filtro de coluna');

      // O menu lista só valores REAIS das linhas, e rotula os indicadores.
      await app.router.navigate('#/articles');
      const menu = fake.documentRef.body.innerHTML;
      assert.match(menu, /data-colfilter-value="Published"[^>]*>Publicado</, 'o rótulo do indicador é legível, não o valor cru');
      assert.match(menu, /aria-label="Filtrar coluna Título"/, 'o controle anuncia qual coluna filtra');
    } finally { app.stop(); }
  });
  console.log('ok - filtro por coluna: colunas independentes, interseção entre filtros, convivência com a busca e rótulos legíveis');
}

// ---------------------------------------------------------------------------
// 3. Round-trip: editar/salvar/cancelar/novo/duplicar preservam a lista
// ---------------------------------------------------------------------------

async function runRoundTripTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const admin = createFakeAdminService({ domains: { articles: [
      { id: 1, title: 'Alfa', alias: 'alfa', state: 'Published' },
      { id: 2, title: 'Beta', alias: 'beta', state: 'Published' }
    ] } });
    const fake = createFakeDocumentRef();
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      // Entrar na lista com filtro grava a memória daquela lista.
      await app.router.navigate('#/articles?col_alias=beta&q=Beta');
      assert.deepEqual(recallListFilters('/articles', storage), { col_alias: 'beta', q: 'Beta' });

      // O link de edição leva a lista consigo: voltar do formulário não é um
      // caminho "limpo" que perde o contexto de trabalho.
      const listHtml = fake.documentRef.body.innerHTML;
      assert.match(listHtml, /href="#\/articles\/2\?[^"]*col_alias=beta/);
      assert.match(listHtml, /href="#\/articles\/new\?[^"]*col_alias=beta/, 'Novo também preserva a lista');

      // CANCELAR: o href do formulário aponta de volta para a lista filtrada.
      await app.router.navigate('#/articles/2?col_alias=beta&q=Beta');
      const formHtml = fake.documentRef.body.innerHTML;
      assert.match(formHtml, /class="[^"]*admin-form-cancel[^"]*" href="#\/articles\?[^"]*col_alias=beta/, 'Cancelar volta à lista filtrada');
      assert.match(formHtml, /href="#\/articles\?[^"]*col_alias=beta[^"]*"[^>]*>Artigos<\/a>/, 'o breadcrumb volta à lista filtrada');

      // SALVAR: após gravar, a navegação reaplica a memória da lista, então o
      // usuário volta para o MESMO recorte, e não para a lista completa.
      await app.router.navigate('#/articles/2?col_alias=beta&q=Beta');
      fake.element('name:title').value = 'Beta atualizado';
      fake.element('name:alias').value = 'beta';
      fake.element('name:state').value = 'Published';
      await fake.dispatch('[data-admin-form]', 'submit');
      assert.equal((await admin.articles.get(2)).title, 'Beta atualizado', 'o registro foi realmente gravado');
      assert.match(fake.documentRef.body.innerHTML, /href="#\/articles\/2(\?[^"]*)?"/, 'salvar devolve à lista de origem, não ao painel');
      assert.ok(!fake.documentRef.body.innerHTML.includes('href="#/articles/1'), 'a lista de retorno ainda respeita o filtro');

      // Voltar pelo menu lateral (link com a query embutida) reaplica o filtro.
      await app.router.navigate('#/articles?col_alias=beta&q=Beta');
      assert.match(fake.documentRef.body.innerHTML, /href="#\/articles\/2(\?[^"]*)?"/);
      assert.ok(!fake.documentRef.body.innerHTML.includes('href="#/articles/1'));

      // Uma visita LIMPA (ex.: "Limpar filtros") esquece a memória daquela lista.
      await app.router.navigate('#/articles');
      assert.deepEqual(recallListFilters('/articles', storage), {});
      assert.match(fake.documentRef.body.innerHTML, /href="#\/articles\/1(?:"|\?)/);
    } finally { app.stop(); }
  });

  await withStorage(createFakeStorage(), async () => {
    const admin = createFakeAdminService({ domains: {
      articles: [{ id: 1, title: 'Alfa', alias: 'alfa', state: 'Published' }]
    } });
    const storage2 = createFakeStorage();
    await withStorage(storage2, async () => {
      const fake = createFakeDocumentRef();
      const app = await mountApp(admin, storage2, fake.documentRef);
      try {
        // Novo registro numa lista filtrada: o formulário de criação também
        // recebe o estado da lista, então "Criar" devolve o usuário ao filtro.
        await app.router.navigate('#/articles?col_state=Published');
        assert.match(fake.documentRef.body.innerHTML, /href="#\/articles\/new\?[^"]*col_state=Published/);
        await app.router.navigate('#/articles/new?col_state=Published');
        assert.match(fake.documentRef.body.innerHTML, /Novo registro em Artigos/);
        assert.match(fake.documentRef.body.innerHTML, /class="[^"]*admin-form-cancel[^"]*" href="#\/articles\?[^"]*col_state=Published/);
      } finally { app.stop(); }
    });
  });
  console.log('ok - round-trip: editar/novo/cancelar/salvar preservam a lista e a memoria sobrevive a ida e volta pela sidebar');
}

// ---------------------------------------------------------------------------
// 4. Ordenação, paginação e limite convivem com os filtros
// ---------------------------------------------------------------------------

async function runPaginationSortTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const rows = Array.from({ length: 45 }, (_, index) => ({ id: index + 1, title: `Registro ${String(index + 1).padStart(2, '0')}`, alias: `r${index + 1}`, state: 'Published' }));
    const admin = createFakeAdminService({ domains: { articles: rows } });
    const fake = createFakeDocumentRef();
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/articles?col_state=Published');
      const first = fake.documentRef.body.innerHTML;
      assert.match(first, /admin-pagination/, '45 registros com filtro ainda são paginados');
      assert.match(first, /href="#\/articles\?[^"]*col_state=Published[^"]*page=2/, 'a paginação carrega o filtro de coluna');

      // A memória guarda o filtro e a ordenação, mas NUNCA a página: voltar de
      // um formulário para uma página que o filtro encolheu mostraria vazio.
      await app.router.navigate('#/articles?col_state=Published&page=3&sort=title&dir=desc');
      const remembered = recallListFilters('/articles', storage);
      assert.equal(remembered.col_state, 'Published');
      assert.equal(remembered.sort, 'title');
      assert.equal(remembered.dir, 'desc');
      assert.equal(remembered.page, undefined, 'a página pertence à listagem, nao ao registro aberto');

      // Uma listagem puramente paginada (sem filtro) não deixa memória
      // nenhuma: a memória é do RECORTE, e `page` sozinho não é recorte.
      await app.router.navigate('#/articles?page=2');
      assert.deepEqual(recallListFilters('/articles', storage), {});
    } finally { app.stop(); }
  });
  console.log('ok - paginacao e ordenacao: convivem com os filtros, viajam nos links, mas a pagina nunca entra na memoria');
}

// ---------------------------------------------------------------------------
// 5. Lote: sucesso recarrega a lista filtrada; falha parcial reporta e reflete
//    o estado real; falha total não finge sucesso (contrato G2)

/*
 * O serviço de lote já é testado em admin-joomla-content.test.js (regras de
 * negócio por item). O que se cobre AQUI é a camada de PÁGINA: quem recarrega,
 * quem reporta e quem NÃO navega. `runBatch` (extension-pages.js) tem três
 * desfechos distintos, e o defeito original estava em tratar todos igual.
 */
async function runBatchTests() {
  const moduleRows = () => [
    { id: 1, title: 'Mod A', extensionKey: 'mod_a', position: 'sidebar-right', ordering: 1, enabled: true, scopeKind: 'All' },
    { id: 2, title: 'Mod B', extensionKey: 'mod_b', position: 'sidebar-right', ordering: 2, enabled: true, scopeKind: 'All' }
  ];

  /*
   * Monta a lista de módulos com um serviço de lote controlado, dispara a
   * ação em lote pelo formulário real (`submit` em `[data-ext-batch]`, com
   * `batchAction` preenchido) e observa as três coisas que importam:
   * a mensagem de status e as navegações.
   */
  async function withModuleList(batch, run) {
    const storage = createFakeStorage();
    await withStorage(storage, async () => {
      const admin = createFakeAdminService({ domains: { moduleInstances: moduleRows() } });
      admin.moduleInstances.catalog = async () => [{ key: 'mod_a', title: 'Mod A' }, { key: 'mod_b', title: 'Mod B' }];
      admin.moduleInstances.positions = async () => ({ template: 'cassiopeia', positions: ['sidebar-right'], all: ['sidebar-right'] });
      admin.moduleInstances.batch = batch;
      const fake = createFakeDocumentRef();
      const app = await mountApp(admin, storage, fake.documentRef);
      // A seleção em lote vive em checkboxes lidos via querySelectorAll.
      fake.setList('[data-ext-select]', [
        { value: '1', checked: true, dataset: { extId: '1' } },
        { value: '2', checked: true, dataset: { extId: '2' } }
      ]);
      const navigations = [];
      const original = app.router.navigate.bind(app.router);
      app.router.navigate = async (href) => { navigations.push(href); return original(href); };
      try {
        await app.router.navigate('#/moduleInstances?state=*&col_position=sidebar-right');
        assert.match(fake.documentRef.body.innerHTML, /data-colfilter-column="position"/, 'a lista de módulos oferece filtro por coluna');
        fake.element('name:batchAction').value = 'publish';
        const before = navigations.length;
        await fake.dispatch('[data-ext-batch]', 'submit');
        await new Promise((resolve) => setTimeout(resolve, 0));
        await run({ fake, navigations: navigations.slice(before), storage });
      } finally { app.stop(); }
    });
  }

  // SUCESSO TOTAL: recarrega a MESMA lista, com o filtro de coluna ainda ativo.
  await withModuleList(async () => ({ succeeded: [{ id: 1 }], failed: [] }), async ({ navigations, storage }) => {
    assert.ok(navigations.length > 0, 'sucesso total recarrega a lista');
    assert.match(String(navigations[navigations.length - 1]), /col_position=sidebar-right/, 'a recarga preserva o filtro de coluna');
    assert.equal(recallListFilters('/moduleInstances', storage).col_position, 'sidebar-right');
  });

  // FALHA PARCIAL: reporta a falha E recarrega, porque parte do estado mudou —
  // sem isso os itens que mudaram continuariam exibindo o estado antigo.
  await withModuleList(async () => ({ succeeded: [{ id: 1 }], failed: [{ id: 2, message: 'Negado' }] }), async ({ fake, navigations }) => {
    const status = fake.element('[data-ext-status]').textContent;
    assert.ok(/Negado/.test(String(status)), 'a falha parcial é comunicada ao usuário');
    assert.ok(navigations.length > 0, 'falha parcial recarrega o que realmente mudou');
    assert.match(String(navigations[navigations.length - 1]), /col_position=sidebar-right/, 'a recarga da falha parcial preserva o filtro');
  });

  // FALHA TOTAL: reporta e NÃO navega — nada mudou, então recarregar seria
  // apresentar como bem-sucedida uma ação que não alterou estado nenhum.
  await withModuleList(async () => ({ succeeded: [], failed: [{ id: 1, message: 'Negado' }, { id: 2, message: 'Negado' }] }), async ({ fake, navigations }) => {
    assert.ok(/Negado/.test(String(fake.element('[data-ext-status]').textContent)), 'a falha total é comunicada ao usuário');
    assert.equal(navigations.length, 0, 'falha total não navega: nenhum estado novo a apresentar');
  });

  console.log('ok - lote: sucesso recarrega a lista filtrada, falha parcial reporta e recarrega, falha total nao navega');
}

async function runExtensionColumnTests() {
  /*
   * Item 2 vale para "as demais listagens": módulos e plugins também
   * separam colunas e oferecem menu por cabeçalho. Aqui se prova o contrato
   * mínimo — colunas presentes, rótulos acessíveis resolvidos (nunca
   * "undefined"), valor atual refletido no botão, e o clique numa opção
   * navegando com o filtro preservando o que o usuário já tinha escolhido.
   */
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const admin = createFakeAdminService({
      domains: {
        moduleInstances: [
          { id: 1, title: 'Mod A', extensionKey: 'mod_a', position: 'sidebar-right', ordering: 1, enabled: true, scopeKind: 'All' },
          { id: 2, title: 'Mod B', extensionKey: 'mod_b', position: 'sidebar-left', ordering: 2, enabled: true, scopeKind: 'All' }
        ],
        plugins: [
          { id: 5, title: 'Plg A', key: 'plg_a', group: 'content', ordering: 1, enabled: true, version: '1.0' }
        ]
      }
    });
    admin.moduleInstances.catalog = async () => [{ key: 'mod_a', title: 'Tipo A' }, { key: 'mod_b', title: 'Tipo B' }];
    admin.moduleInstances.positions = async () => ({ template: 'cassiopeia', positions: ['sidebar-right', 'sidebar-left'], all: ['sidebar-right', 'sidebar-left'] });
    // `extension-pages.js` só assume `/moduleInstances` quando o serviço
    // expõe `catalog` E `batch`; sem `batch` a rota cai na listagem genérica.
    admin.moduleInstances.batch = async (items, action) => ({ succeeded: items.map((item) => item.id), failed: [], action });
    const fake = createFakeDocumentRef();
    // Como num navegador, a estrutura dos menus de coluna precisa existir
    // ANTES de a página registrar seus listeners; a cada render o fake
    // rematerializa os containers a partir do markup recém-gravado.
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/moduleInstances?col_title=Mod%20B');
      const html = fake.documentRef.body.innerHTML;
      const columns = [...html.matchAll(/data-colfilter-column="([^"]*)"/g)].map((match) => match[1]);
      // O `header` do menu por coluna duplica o HTML do cabeçalho dentro do
      // formulário oculto, então cada coluna aparece duas vezes.
      for (const column of ['state', 'title', 'type', 'position']) {
        assert.ok(columns.includes(column), `a lista de módulos oferece filtro por coluna para ${column}`);
      }

      const labels = [...html.matchAll(/aria-label="(Filtrar coluna [^"]*)"/g)].map((match) => match[1]);
      assert.ok(labels.length > 0, 'os menus de coluna têm rótulo acessível');
      assert.ok(!labels.some((label) => /undefined/.test(label)), 'nenhum rótulo acessível cai em "undefined"');

      // O filtro ativo aparece no botão da coluna, como no menu do Excel.
      assert.match(html, /data-colfilter-column="title"[^>]*data-colfilter-value="Mod B"/, 'o botão da coluna mostra o valor filtrado');
      // E a listagem realmente filtrou, em vez de só exibir o rótulo.
      assert.ok(/Mod B/.test(html) && !/Mod A/.test(html), 'o filtro de coluna restringe as linhas exibidas');

      // Escolher outra opção no menu navega mantendo ordenação e descartando
      // a página anterior (que pertencia ao conjunto de resultados antigo).
      const navigations = [];
      await app.router.navigate('#/moduleInstances?col_position=sidebar-left&sort=title&dir=desc&page=2');
      const original = app.router.navigate.bind(app.router);
      app.router.navigate = async (href) => { navigations.push(href); return original(href); };
      // Os menus já foram materializados no render; localiza a opção pelo valor
      // que ela representa no domínio (a mesma que o usuário clicaria).
      const options = fake.lastColumnFilters?.optionsByContainer?.get('col_position') ?? [];
      const targetIndex = options.findIndex((option) => option.dataset.colfilterValue === 'sidebar-right');
      assert.ok(targetIndex >= 0, 'o menu de position oferece a opção sidebar-right');
      await fake.dispatch(`option:col_position:sidebar-right:${targetIndex}`, 'click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(navigations.length, 1, 'escolher uma opção do menu navega uma vez');
      assert.match(String(navigations[0]), /col_position=sidebar-right/, 'a navegação leva o filtro escolhido');
      assert.match(String(navigations[0]), /sort=title/, 'a ordenação escolhida é preservada');
      assert.ok(!/page=/.test(String(navigations[0])), 'a página anterior é descartada ao trocar o filtro');

      await app.router.navigate('#/plugins?col_state=enabled');
      const pluginHtml = fake.documentRef.body.innerHTML;
      assert.match(pluginHtml, /data-colfilter-column="state"/, 'a lista de plugins oferece filtro por coluna');
      assert.ok(!/aria-label="Filtrar coluna undefined/.test(pluginHtml), 'os rótulos dos plugins também resolvem');
    } finally { app.stop(); }
  });

  console.log('ok - listas de extensoes: colunas separadas com menu por cabecalho e rotulos acessiveis');
}

// ---------------------------------------------------------------------------
// 6. Categorias homônimas (G1) — filtro por id canônico, rótulo desambiguado
// ---------------------------------------------------------------------------

async function runHomonymCategoryTests() {
  /*
   * G1 vive na camada de serviço: o dropdown de categoria (dos artigos e
   * dos filtros de listagem) precisa de rótulos que o usuário consiga
   * distinguir. Duas categorias homônimas em ramos distintos rendiam
   * "Avisos" e "Avisos"; o rótulo passa a ser o caminho completo.
   */
  const service = createAdminService(categoryRepository());
  const options = await service.categories.treeOptions();
  const labels = options.map((option) => option.label.replace(/^[—\s]+/, ''));

  assert.equal(new Set(labels).size, labels.length, 'nenhum par de rótulos do dropdown é idêntico');

  const sharedParent = options.filter((option) => option.value === 12 || option.value === 13).map((option) => option.label);
  assert.equal(sharedParent.length, 2, 'as irmãs homônimas aparecem no dropdown');
  assert.equal(new Set(sharedParent).size, 2, 'irmãs de mesmo título sob o mesmo pai ainda se distinguem (via alias)');
  assert.ok(sharedParent.some((label) => /avisos-a/.test(label)) && sharedParent.some((label) => /avisos-b/.test(label)), 'o alias entra no rótulo quando o caminho não desambigua');
  assert.match(options.find((option) => option.value === 11).label, /Institucional › Avisos/, 'homônimas em ramos distintos usam o caminho completo');

  // O filtro por categoria precisa usar o id, não o título: senão escolher
  // uma homônima traria os artigos da outra junto.
  /*
   * O filtro por categoria vive em `articles.query` (é ele que a listagem
   * administrativa usa); `list` é o CRUD cru e ignora parâmetros.
   */
  const onlyA = await service.articles.query({ categoryId: 12, state: '*' });
  const onlyB = await service.articles.query({ categoryId: 13, state: '*' });
  assert.deepEqual(onlyA.rows.map((row) => Number(row.id)), [201], 'o filtro por id isola a categoria A');
  assert.deepEqual(onlyB.rows.map((row) => Number(row.id)), [202], 'o filtro por id isola a categoria B');

  console.log('ok - categorias homonimas: rotulos distinguiveis e filtro por id canonico');
}

export async function runAdminListFiltersTests() {
  await runListMemoryTests();
  await runColumnFilterTests();
  await runRoundTripTests();
  await runPaginationSortTests();
  await runBatchTests();
  await runExtensionColumnTests();
  await runHomonymCategoryTests();
  console.log('ok - filtros administrativos persistentes e por coluna');
}