import assert from 'node:assert/strict';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { rememberListFilters, recallListFilters, listFilterKey, configureListMemoryScope, currentMemoryScope, SCOPE_ABSENT } from '../src/administrator/components/com_minijoomla/list-memory.js';
import { buildColumnFacets, renderColumnFilterPanel } from '../src/administrator/components/com_minijoomla/column-filter.js';

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
      get: async (id) => store.get(id) ?? store.get(Number(id)) ?? null,
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
  // `com_templates` tem superfície própria: a tela de edição chama
  // `templateStyles.save` (não `update`), e a listagem chama `setDefault`/
  // `duplicate`. Sem `save` o botão de gravar falha em silêncio e a navegação
  // de volta nunca acontece — foi exatamente o que o teste pegou.
  if (domains.templateStyles) service.templateStyles = {
    ...domains.templateStyles,
    save: (id, input, options) => domains.templateStyles.update(id, input, options),
    setDefault: async (id) => domains.templateStyles.get(id),
    duplicate: async (id) => domains.templateStyles.create({ ...(await domains.templateStyles.get(id)) })
  };
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
    // `bindColumnFilters` constrói a camada flutuante dos painéis por
    // `createElement` + `appendChild`: o fake precisa oferecer as duas para
    // que o binding registre listeners em vez de abortar na guarda defensiva.
    createElement: (tag) => element(`created:${tag}`),
    body: {
      _html: '',
      get innerHTML() { return this._html; },
      set innerHTML(html) { this._html = String(html ?? ''); wireOnRender(documentRef.body, html); },
      ownerDocument: null,
      appendChild: () => {},
      querySelector: (selector) => {
        // A camada dos painéis de filtro é procurada pelo próprio módulo
        // canônico; sem resolver aqui ele criaria outra a cada binding.
        if (selector === '.admin-colfilter-layer') return registry.get('[data-colfilter-layer]') ?? null;
        // O formulário resolve para um elemento sintético próprio, que
        // responde a `[name="..."]` (mesmo contrato do fake de
        // tests/admin-app.test.js). Sem isso `readAdminFormValues` não lê
        // nenhum campo e o salvamento enviaria um payload vazio.
        if (selector === '[data-admin-form]') return formElement;
        // Os formulários de edição do painel são resolvidos pelo seletor
        // exato do módulo (`[data-ext-form="module"]` etc.). O binding do
        // `submit` acontece DENTRO da navegação, então o nó precisa existir
        // ANTES: criá-lo aqui (memorizado por endereço) é o que permite ao
        // teste capturar o listener de gravação depois.
        if (/^\[data-ext-form=/.test(selector)) return element(selector);
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
  // Cliques delegados: o ligador canônico registra UM listener no documento
  // e resolve o alvo por `event.target.closest('[data-colfilter-toggle]')`.
  documentRef.addEventListener = (event, handler) => {
    const list = listenersByElement.get('document') ?? [];
    list.push({ event, handler });
    listenersByElement.set('document', list);
  };
  // `bindColumnFilters` procura a camada pelo DOCUMENTO (`doc.querySelector`),
  // não só pelo `body`: os módulos de página de extensão passam `scope =
  // body()`, cujo `ownerDocument` é este objeto. Sem resolver a camada aqui o
  // ligador criaria uma segunda camada e o HTML do painel nunca chegaria à
  // camada que o teste observa.
  documentRef.querySelector = (selector) => {
    if (selector === '.admin-colfilter-layer') return registry.get('[data-colfilter-layer]') ?? null;
    if (selector === '[data-minijoomla-admin-root]') return null;
    return element(selector);
  };
  // As páginas de extensão passam `scope = body()`, cujo `ownerDocument` é
  // este documento: `bindColumnFilters` lista os botões por aqui. O `setList`
  // de `wireColumnFilters` registra a coleção no registry, então basta
  // expor a mesma leitura que o `body` já faz.
  documentRef.querySelectorAll = (selector) => registry.get(selector) ?? [];
  return {
    documentRef,
    element,
    set: (key, value) => registry.set(key, value),
    setList: (selector, items) => registry.set(selector, items),
    // Registra os filhos de `parent|selector` para `querySelector`/`All`.
    setChildren: (parentSelector, selector, items) => registry.set(`${parentSelector}|${selector}`, items),
    setWireOnRender: (fn) => { wireOnRender = fn; },
    // Listeners já registrados num endereço. Necessário porque o binding de
    // `submit` das telas de edição acontece DENTRO da navegação: o teste não
    // tem como interceptar `addEventListener` depois, só ler o que já foi
    // gravado no registry pela própria página.
    listenersFor: (key, event) => (listenersByElement.get(key) ?? []).filter((entry) => entry.event === event).map((entry) => entry.handler),
    // HTML que o ligador escreveu na camada flutuante (o painel aberto).
    // A chave é a mesma que `documentRef.querySelector` resolve — o fake é
    // chaveado por seletor, então usar outro nome leria uma camada vazia.
    layerHtml: (selector) => {
      const node = selector === '.admin-colfilter-layer'
        ? registry.get('[data-colfilter-layer]')
        : registry.get(selector);
      return node?.innerHTML ?? '';
    },
    get activeElement() { return activeElement; },
    // A lista de listeners é copiada antes de iterar: um handler pode
    // re-renderizar a tela e registrar novos listeners no MESMO elemento,
    // e iterar o array vivo faria o dispatch nunca terminar.
    dispatch: async (key, event, options = {}) => {
      const targets = key === 'document' ? ['document'] : [key];
      const payload = { preventDefault: () => {}, target: options.target ?? null, key: options.key ?? '', shiftKey: Boolean(options.shiftKey), ...(options.extra ?? {}) };
      for (const address of targets) for (const entry of [...(listenersByElement.get(address) ?? [])]) if (entry.event === event) await entry.handler(payload);
    }
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
 * verdade os botões de filtro por coluna (e não só a aparência do HTML),
 * esta rotina lê o markup JÁ RENDERIZADO e materializa exatamente os
 * elementos que `bindColumnFilters` procura: os botões `[data-colfilter-toggle]`
 * (com `data-colfilter-key`/`data-colfilter-column`/`data-colfilter-label`) e
 * sua camada flutuante de painéis. O painel NÃO vem no HTML: quem o constrói
 * é `renderColumnFilterPanel`, sob demanda, dentro de `.admin-colfilter-layer`.
 * Sem esta rotina o binding seria um no-op e o teste "provaria" um clique que
 * nunca chegou a nenhum listener.
 */
function wireColumnFilters(fake, html) {
  const toggles = [];
  const specByKey = new Map();
  const toggleRe = /<button[^>]*data-colfilter-toggle[^>]*>/g;
  let match;
  while ((match = toggleRe.exec(html))) {
    const tag = match[0];
    const attr = (name) => (new RegExp(`${name}="([^"]*)"`).exec(tag) ?? [])[1] ?? '';
    const key = attr('data-colfilter-key');
    const column = attr('data-colfilter-column');
    const label = attr('data-colfilter-label');
    if (!key) continue;
    const toggle = fake.element(`toggle:${key}`);
    toggle.dataset = { colfilterToggle: '', colfilterKey: key, colfilterColumn: column, colfilterLabel: label };
    toggle.attributes = { 'aria-expanded': 'false' };
    // O ligador usa UM listener delegado no documento e resolve o botão por
    // `event.target.closest('[data-colfilter-toggle]')`. O fake precisa
    // responder esse `closest` a partir do próprio botão, senão o clique
    // disparado pelo teste morre antes de chegar a `openPanel`.
    toggle.closest = (selector) => (selector === '[data-colfilter-toggle]' ? toggle : null);
    toggles.push(toggle);
    specByKey.set(key, { key, column, label });
  }
  // A camada é criada por `bindColumnFilters` via `createElement`; o fake
  // precisa expor `appendChild` para que a guarda defensiva do módulo não
  // aborte o binding antes de registrar os listeners. A camada também
  // registra o HTML do painel que o ligador escreve nela: é por ali que o
  // painel de uma coluna chega à tela.
  const layer = fake.element('layer:.admin-colfilter-layer');
  layer._panelHtml = '';
  Object.defineProperty(layer, 'innerHTML', {
    get() { return this._panelHtml; },
    set(value) { this._panelHtml = String(value ?? ''); },
    configurable: true
  });
  layer.appendChild = () => {};
  /*
   * O diálogo do painel é criado AQUI, antes de o ligador abrir o painel, e
   * não em `wirePanelControls`: o ligador registra seus listeners nos
   * objetos devolvidos por `querySelector` no momento da abertura, então um
   * diálogo criado depois faria o clique do teste cair em outro elemento.
   */
  const dialog = fake.element('panel:open');
  dialog.hidden = true;
  dialog.offsetWidth = 320;
  dialog.offsetHeight = 240;
  dialog.style = {};
  dialog.querySelector = (selector) => {
    const single = {
      '[data-colfilter-search]': 'panelsearch',
      '[data-colfilter-ok]': 'panelok',
      '[data-colfilter-clear]': 'panelclear',
      '[data-colfilter-all]': 'panelall',
      '[data-colfilter-all-label]': 'panelalllabel',
      '[data-colfilter-error]': 'panelerror',
      '[data-colfilter-cancel]': 'panelcancel'
    }[selector];
    return single ? fake.element(single) : null;
  };
  dialog.querySelectorAll = () => [];
  layer.querySelector = (selector) => {
    if (selector === '[data-colfilter-panel]' && layer._panelHtml) {
      return dialog;
    }
    return null;
  };
  fake.set('[data-colfilter-layer]', layer);
  fake.setList('[data-colfilter-toggle]', toggles);
  fake.lastColumnFilters = { toggles, specByKey };
  // O ligador escuta cliques no DOCUMENTO (delegação), não em cada botão:
  // sem registrar o listener na raiz, o clique do teste nunca chega a
  // `openPanel` e o painel nunca é materializado.
  fake.registerDocumentListener = (event, handler) => {
    const list = listenersByElement.get('document') ?? [];
    list.push({ event, handler });
    listenersByElement.set('document', list);
  };
  /*
   * Frente C2: a barra de filtros ativos é HTML puro dentro do `<body>`, e o
   * ligador a alcança por `closest('[data-activefilters]')` a partir do
   * elemento clicado. O fake genérico não materializa árvore, então o clique
   * do teste morreria em `closest` nulo e o teste "provaria" só que o
   * markup existe. Aqui cada botão da barra recebe um `closest` que resolve
   * o ancestral de verdade a partir do HTML renderizado.
   */
  const bar = /<div class="admin-activefilters"[^>]*data-activefilters[^>]*>/.exec(html);
  if (bar) {
    const barNode = fake.element('activefilters');
    const bindBarButton = (address, ownSelector, attribute, value) => {
      const node = fake.element(address);
      node.closest = (selector) => {
        if (selector === '[data-activefilters]') return barNode;
        if (selector === ownSelector) return node;
        return null;
      };
      node.getAttribute = (name) => (name === attribute ? value : null);
      return node;
    };
    for (const match of html.matchAll(/data-activefilter-remove="([^"]*)"/g)) bindBarButton(`attr:data-activefilter-remove=${match[1]}`, '[data-activefilter-remove]', 'data-activefilter-remove', match[1]);
    if (/data-activefilter-clearall/.test(html)) bindBarButton('attr:data-activefilter-clearall=', '[data-activefilter-clearall]', 'data-activefilter-clearall', '');
  }
  return { toggles, specByKey };
}

/*
 * O painel de uma coluna é escrito na camada flutuante pelo ligador e é
 * construído em tempo de execução, então o fake precisa materializar os
 * controles que ele contém (checkbox de cada valor e o botão OK) para que
 * um clique do teste chegue a um listener de verdade — o mesmo papel de
 * `wireColumnFilters` para os botões do cabeçalho.
 */
function wirePanelControls(fake, panelHtml, key) {
  const boxes = [];
  for (const match of panelHtml.matchAll(/data-colfilter-value="([^"]*)"[\s\S]*?<input type="checkbox" value="([^"]*)"([^>]*)>/g)) {
    const [, , value, attrs] = match;
    const box = fake.element(`panelopt:${value}`);
    box.value = value;
    box.checked = /checked/.test(attrs);
    box.closest = () => ({ hidden: false });
    boxes.push(box);
  }
  /*
   * O rótulo e a contagem vivem em `<span>`s dentro do `<label>` da opção,
   * não no input. O teste de cadeia precisa deles para provar que o painel
   * mostra "Publicado"/"Despublicado"/"Arquivado" com as contagens certas —
   * e não uma caixa anônima cujo `value` casa por acidente.
   */
  const options = [];
  for (const match of panelHtml.matchAll(/<label[^>]*data-colfilter-option[^>]*>([\s\S]*?)<\/label>/g)) {
    const block = match[1];
    const value = (/value="([^"]*)"/.exec(block) ?? [])[1] ?? '';
    const label = (/data-colfilter-value="[^"]*"[\s\S]*?<span class="admin-colfilter-option-label"[^>]*>([\s\S]*?)<\/span>/.exec(match[0]) ?? /<span class="admin-colfilter-option-label"[^>]*>([\s\S]*?)<\/span>/.exec(block) ?? [])[1];
    const count = Number((/<span class="admin-colfilter-option-count"[^>]*>(\d+)<\/span>/.exec(block) ?? [])[1]);
    const depth = Number((/data-colfilter-depth="(\d+)"/.exec(block) ?? [])[1]);
    options.push({ value, label: String(label ?? '').replace(/<[^>]*>/g, '').trim(), count, depth: Number.isFinite(depth) ? depth : 0, checked: /checked/.test(block) });
  }
  options.forEach((option) => {
    const box = boxes.find((candidate) => candidate.value === option.value);
    if (box) { box.label = option.label; box.count = option.count; box.depth = option.depth; }
  });
  fake.panelOptionBoxes = () => boxes;
  fake.panelOptions = () => options;
  const dialog = fake.element('panel:open');
  dialog.hidden = false;
  dialog.offsetWidth = 320;
  dialog.offsetHeight = 240;
  dialog.style = {};
  // O diálogo já foi pré-criado por `wireColumnFilters` com o mapa de
  // controles; aqui só se acrescenta a coleção REAL de checkboxes lidos do
  // painel renderizado, que é o que o ligador itera em `boxes()`.
  dialog.querySelectorAll = (selector) => (selector === '[data-colfilter-values] input[type="checkbox"]' ? boxes : []);
  fake.set('panel:open', dialog);
  fake.element('panelok').disabled = false;
  fake.element('panelcancel').hidden = true;
  fake.element('panelerror').hidden = true;
  return { dialog, boxes };
}

/*
 * Captura o handler de `submit` de um formulário REAL do painel.
 *
 * O fake de documento não materializa a árvore, então o `submit` de um
 * formulário de edição não pode ser disparado por propagação: o módulo da
 * página o registra direto no elemento (`form.addEventListener('submit')`)
 * e não há uma raiz que o delegue. Aqui o elemento é criado com o MESMO
 * endereço que o `querySelector` do módulo resolve (`formElement =
 * element('[data-admin-form]')`), então o listener registrado fica neste
 * registry e pode ser chamado com um evento sintético. É o único jeito de
 * exercitar o caminho de gravação de verdade em vez de só inspecionar o
 * href do botão de cancelar.
 */
function captureFormSubmit(fake, selector = '[data-admin-form]') {
  const node = fake.element(selector);
  fake.submitForm = async (options = {}) => {
    const listeners = fake.listenersFor(selector, 'submit');
    if (!listeners.length) throw new Error(`nenhum listener de submit registrado em ${selector}`);
    for (const handler of listeners) await handler({ preventDefault: () => {}, target: node, ...options });
  };
  return node;
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
  assert.equal(listFilterKey('/articles'), 'minijoomla.admin.listFilters:-:-:/articles');

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
      assert.match(all, /data-colfilter-column="title"/, 'Título tem filtro próprio');
      assert.match(all, /data-colfilter-column="alias"/, 'Alias tem coluna própria');
      assert.match(all, /data-colfilter-key="title"/);
      assert.match(all, /data-colfilter-key="alias"/);

      // Filtrar por Alias não pode tocar no Título: cada coluna é independente.
      await app.router.navigate('#/articles?alias=segundo');
      const byAlias = fake.documentRef.body.innerHTML;
      assert.match(byAlias, /href="#\/articles\/2(\?[^"]*)?"/);
      assert.ok(!byAlias.includes('href="#/articles/1'), 'linha de outro alias não aparece');
      assert.match(byAlias, /data-colfilter-column="title"/, 'o filtro de Título continua disponível com outro filtro ativo');

      // O alias legado (`col_alias`) continua valendo na LEITURA, e o link
      // emitido para a lista normaliza para a chave canônica: uma chave por
      // coluna, sem duplicidade.
      await app.router.navigate('#/articles?col_alias=primeiro');
      const legacy = fake.documentRef.body.innerHTML;
      assert.match(legacy, /href="#\/articles\/1(\?[^"]*)?"/, 'alias legado ainda filtra');
      const backLinks = [...legacy.matchAll(/href="#\/articles\?([^"]*)"/g)].map((match) => match[1]);
      assert.ok(backLinks.length > 0, 'a lista tem links de volta');
      assert.ok(backLinks.every((query) => !/col_alias=/.test(query)), 'o alias cru não é reemitido nos links da lista');
      assert.ok(backLinks.some((query) => /alias=primeiro/.test(query)), 'os links da lista usam a chave canônica');

      // Dois filtros de coluna coexistem (interseção), sem um sobrescrever o outro.
      await app.router.navigate('#/articles?alias=primeiro&state=Draft');
      const empty = fake.documentRef.body.innerHTML;
      assert.match(empty, /admin-empty/, 'interseção vazia não inventa linha');
      assert.match(empty, /data-colfilter-column="title"/, 'mesmo vazia a lista mantém o cabeçalho para o usuário desfazer o filtro');
      assert.ok(!empty.includes('href="#/articles/1'), 'nenhuma linha sobrevive à interseção vazia');

      // A busca textual da barra do topo convive com o filtro de coluna.
      await app.router.navigate('#/articles?state=Published&q=Primeiro');
      const combined = fake.documentRef.body.innerHTML;
      assert.match(combined, /href="#\/articles\/1(\?[^"]*)?"/);
      assert.ok(!combined.includes('href="#/articles/3'), 'a busca estreita o resultado do filtro de coluna');

      // A faceta traz somente valores REAIS das linhas, com contagem agregada:
      // título repetido aparece UMA vez com o total, não uma linha por registro.
      await app.router.navigate('#/articles');
      const facets = buildColumnFacets(await admin.articles.list(), [
        { key: 'title', reads: (row) => row.title },
        { key: 'state', reads: (row) => row.state }
      ]);
      assert.deepEqual(facets.title.map((item) => item.value).sort(), ['Primeiro', 'Segundo', 'Terceiro'], 'a faceta de Título lista os valores distintos');
      assert.deepEqual(facets.state.map((item) => [item.value, item.count]), [['Draft', 1], ['Published', 2]], 'a faceta agrega a contagem por valor');
      assert.match(fake.documentRef.body.innerHTML, /aria-label="Filtrar coluna Título"/, 'o controle anuncia qual coluna filtra');
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
      await app.router.navigate('#/articles?alias=beta&q=Beta');
      assert.deepEqual(recallListFilters('/articles', storage), { alias: 'beta', q: 'Beta' });

      // O link de edição leva a lista consigo: voltar do formulário não é um
      // caminho "limpo" que perde o contexto de trabalho.
      const listHtml = fake.documentRef.body.innerHTML;
      assert.match(listHtml, /href="#\/articles\/2\?[^"]*alias=beta/);
      assert.match(listHtml, /href="#\/articles\/new\?[^"]*alias=beta/, 'Novo também preserva a lista');

      // CANCELAR: o href do formulário aponta de volta para a lista filtrada.
      await app.router.navigate('#/articles/2?alias=beta&q=Beta');
      const formHtml = fake.documentRef.body.innerHTML;
      assert.match(formHtml, /class="[^"]*admin-form-cancel[^"]*" href="#\/articles\?[^"]*alias=beta/, 'Cancelar volta à lista filtrada');
      assert.match(formHtml, /href="#\/articles\?[^"]*alias=beta[^"]*"[^>]*>Artigos<\/a>/, 'o breadcrumb volta à lista filtrada');

      /*
       * TODO caminho de volta carrega o recorte. O defeito relatado no
       * reteste da 0.17.14 era o recorte sumir na volta; por isso a prova
       * parte da lista com filtro de BARRA (`q`) E de COLUNA (`state`,
       * `title`) ativos ao mesmo tempo — é a combinação que exercita as
       * duas fontes de estado — e confere cada ponto de saída do
       * formulário: "Salvar" (submit), "Cancelar" e o breadcrumb.
       */
      await app.router.navigate('#/articles?q=Beta&state=Published&title=Beta');
      assert.match(fake.documentRef.body.innerHTML, /data-colfilter-toggle/, 'a lista combinada expõe os menus de coluna');

      const returnHrefs = async () => {
        await app.router.navigate('#/articles/2?q=Beta&state=Published&title=Beta');
        const html = fake.documentRef.body.innerHTML;
        const cancel = html.match(/class="admin-btn[^"]*admin-form-cancel" href="([^"]+)"/);
        assert.ok(cancel, 'Cancelar existe no formulário');
        const crumb = html.match(/href="(#[^"]+)"[^>]*>Artigos<\/a>/);
        assert.ok(crumb, 'o breadcrumb volta para Artigos');
        return { cancel: cancel[1], crumb: crumb[1] };
      };
      for (const [name, href] of Object.entries(await returnHrefs())) {
        assert.match(href, /q=Beta/, `${name} mantém a busca`);
        assert.match(href, /state=Published/, `${name} mantém o filtro de coluna Estado`);
        assert.match(href, /title=Beta/, `${name} mantém o filtro de coluna Título`);
        assert.ok(!/[?&]page=/.test(href), `${name} não devolve a página à lista`);
      }

      // O `href` prova a intenção; a lista também precisa re-renderizar com
      // o recorte vindo da memória depois de um "Cancelar" real.
      await app.router.navigate('#/articles/2?q=Beta&state=Published&title=Beta');
      const beforeBack = fake.documentRef.body.innerHTML;
      assert.match(beforeBack, /admin-form-cancel/, 'o formulário oferece o caminho de volta');
      const backHref = beforeBack.match(/class="admin-btn[^"]*admin-form-cancel" href="([^"]+)"/)[1];
      await app.router.navigate(backHref);
      assert.match(fake.documentRef.body.innerHTML, /data-colfilter-toggle/, 'a lista de volta re-renderiza com os menus');

      // SALVAR: após gravar, a navegação reaplica a memória da lista, então o
      // usuário volta para o MESMO recorte, e não para a lista completa.
      await app.router.navigate('#/articles/2?alias=beta&q=Beta');
      fake.element('name:title').value = 'Beta atualizado';
      fake.element('name:alias').value = 'beta';
      fake.element('name:state').value = 'Published';
      await fake.dispatch('[data-admin-form]', 'submit');
      assert.equal((await admin.articles.get(2)).title, 'Beta atualizado', 'o registro foi realmente gravado');
      assert.match(fake.documentRef.body.innerHTML, /href="#\/articles\/2(\?[^"]*)?"/, 'salvar devolve à lista de origem, não ao painel');
      assert.ok(!fake.documentRef.body.innerHTML.includes('href="#/articles/1'), 'a lista de retorno ainda respeita o filtro');

      // Voltar pelo menu lateral (link com a query embutida) reaplica o filtro.
      await app.router.navigate('#/articles?alias=beta&q=Beta');
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
        await app.router.navigate('#/articles?state=Published');
        assert.match(fake.documentRef.body.innerHTML, /href="#\/articles\/new\?[^"]*state=Published/);
        await app.router.navigate('#/articles/new?state=Published');
        assert.match(fake.documentRef.body.innerHTML, /Novo registro em Artigos/);
        assert.match(fake.documentRef.body.innerHTML, /class="[^"]*admin-form-cancel[^"]*" href="#\/articles\?[^"]*state=Published/);
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
      await app.router.navigate('#/articles?state=Published');
      const first = fake.documentRef.body.innerHTML;
      assert.match(first, /admin-pagination/, '45 registros com filtro ainda são paginados');
      assert.match(first, /href="#\/articles\?[^"]*state=Published[^"]*page=2/, 'a paginação carrega o filtro de coluna');

      // A memória guarda o filtro e a ordenação, mas NUNCA a página: voltar de
      // um formulário para uma página que o filtro encolheu mostraria vazio.
      await app.router.navigate('#/articles?state=Published&page=3&sort=title&dir=desc');
      const remembered = recallListFilters('/articles', storage);
      assert.equal(remembered.state, 'Published');
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

  // SUCESSO TOTAL: recarrega a MESMA lista, com o filtro de coluna ainda ativo,
  // e DEIXA O RECADO VISÍVEL. Sem a mensagem, o usuário só percebia que a ação
  // funcionou pelo estado das linhas mudar — indistinguível de um filtro.
  // O recado precisa SOBREVIVER à recarga: a lista é re-renderizada depois de
  // navegar, e um status gravado só no DOM antigo se perderia no caminho.
  await withModuleList(async () => ({ succeeded: [{ id: 1 }], failed: [] }), async ({ fake, navigations, storage }) => {
    assert.ok(navigations.length > 0, 'sucesso total recarrega a lista');
    assert.match(String(navigations[navigations.length - 1]), /col_position=sidebar-right/, 'a recarga preserva o filtro de coluna');
    assert.equal(recallListFilters('/moduleInstances', storage).col_position, 'sidebar-right');
    const status = String(fake.element('[data-ext-status]').textContent);
    assert.ok(/atualizado/.test(status), `o sucesso total e comunicado com a palavra do aceite: ${status}`);
    assert.ok(/1 item\(ns\)/.test(status), `a mensagem de sucesso carrega a contagem: ${status}`);
  });

  // O mesmo desfecho, mas navegando de verdade: a memória do recado é o que
  // faz a mensagem reaparecer na lista re-renderizada.
  await withModuleList(async () => ({ succeeded: [{ id: 1 }, { id: 2 }], failed: [] }), async ({ fake }) => {
    const status = String(fake.element('[data-ext-status]').textContent);
    assert.ok(/2 item\(ns\) atualizado\(s\)/.test(status), `o recado reaparece na lista recarregada: ${status}`);
  });

  // FALHA PARCIAL: reporta a falha E recarrega, porque parte do estado mudou —
  // sem isso os itens que mudaram continuariam exibindo o estado antigo.
  // A redação separa o que mudou do que não mudou.
  await withModuleList(async () => ({ succeeded: [{ id: 1 }], failed: [{ id: 2, message: 'Negado' }] }), async ({ fake, navigations }) => {
    const status = String(fake.element('[data-ext-status]').textContent);
    assert.ok(/Negado/.test(status), 'a falha parcial é comunicada ao usuário');
    assert.ok(/1 atualizado\(s\), 1 com falha/.test(status), `falha parcial separa o que mudou do que falhou: ${status}`);
    assert.ok(navigations.length > 0, 'falha parcial recarrega o que realmente mudou');
    assert.match(String(navigations[navigations.length - 1]), /col_position=sidebar-right/, 'a recarga da falha parcial preserva o filtro');
  });

  // FALHA TOTAL: reporta e NÃO navega — nada mudou, então recarregar seria
  // apresentar como bem-sucedida uma ação que não alterou estado nenhum.
  await withModuleList(async () => ({ succeeded: [], failed: [{ id: 1, message: 'Negado' }, { id: 2, message: 'Negado' }] }), async ({ fake, navigations }) => {
    const status = String(fake.element('[data-ext-status]').textContent);
    assert.ok(/Negado/.test(status), 'a falha total é comunicada ao usuário');
    assert.ok(/Nenhum item foi atualizado/.test(status), `falha total diz explicitamente que nada mudou: ${status}`);
    assert.equal(navigations.length, 0, 'falha total não navega: nenhum estado novo a apresentar');
  });

  /*
   * Artigos passam pelo MESMO contrato de lote, mas por um arquivo
   * diferente (`content-pages.js`). Sem esta prova, o recado poderia
   * reaparecer nos módulos e se perder nas listas de conteúdo.
   */
  async function withArticleList(batch, run) {
    const storage = createFakeStorage();
    await withStorage(storage, async () => {
      const rows = [
        { id: 1, title: 'Alfa', alias: 'alfa', state: 'Published' },
        { id: 2, title: 'Beta', alias: 'beta', state: 'Published' }
      ];
      const admin = createFakeAdminService({
        domains: {
          articles: rows,
          categories: [{ id: 10, title: 'Institucional', alias: 'institucional', parentId: null, state: 'Published' }],
          tags: [{ id: 20, title: 'Destaque', alias: 'destaque', state: 'Published' }]
        }
      });
      // A listagem de artigos não usa `list`: ela consome o recorte paginado de
      // `articles.query` (camada de serviço) e as opções de categoria.
      admin.articles.query = async () => ({
        rows,
        total: rows.length,
        totalBase: rows.length,
        page: 1,
        limit: 20,
        facets: { authors: [], languages: [] },
        columnFacets: {}
      });
      admin.categories.treeOptions = async () => [{ value: '10', label: 'Institucional' }];
      admin.articles.batch = batch;
      const fake = createFakeDocumentRef();
      const app = await mountApp(admin, storage, fake.documentRef);
      fake.setList('[data-ext-select]', [
        { value: '1', checked: true, dataset: { extId: '1' } },
        { value: '2', checked: true, dataset: { extId: '2' } }
      ]);
      const navigations = [];
      const original = app.router.navigate.bind(app.router);
      app.router.navigate = async (href) => { navigations.push(href); return original(href); };
      try {
        await app.router.navigate('#/articles?state=Published');
        fake.element('name:batchAction').value = 'publish';
        const before = navigations.length;
        await fake.dispatch('[data-ext-batch]', 'submit');
        await new Promise((resolve) => setTimeout(resolve, 0));
        await run({ fake, navigations: navigations.slice(before) });
      } finally { app.stop(); }
    });
  }

  await withArticleList(async () => ({ succeeded: [{ id: 1 }, { id: 2 }], failed: [] }), async ({ fake, navigations }) => {
    assert.ok(navigations.length > 0, 'artigos: sucesso total recarrega a lista');
    const status = String(fake.element('[data-ext-status]').textContent);
    assert.ok(/2 item\(ns\) atualizado\(s\)/.test(status), `artigos: o recado reaparece na lista recarregada: ${status}`);
  });

  await withArticleList(async () => ({ succeeded: [], failed: [{ id: 1, message: 'Negado' }, { id: 2, message: 'Negado' }] }), async ({ fake, navigations }) => {
    const status = String(fake.element('[data-ext-status]').textContent);
    assert.ok(/Nenhum item foi atualizado/.test(status), `artigos: falha total diz que nada mudou: ${status}`);
    assert.equal(navigations.length, 0, 'artigos: falha total não navega');
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

      // O filtro ativo é sinalizado no botão da coluna (estado, não o valor):
      // o valor selecionado aparece na barra de filtros ativos.
      assert.match(html, /data-colfilter-column="title"[^>]*data-colfilter-values="Mod B"/, 'o botão da coluna marca o filtro ativo');
      assert.match(html, /class="admin-colfilter-toggle is-active"[^>]*data-colfilter-column="title"/, 'o botão ativo muda de estado visual');
      // E a listagem realmente filtrou, em vez de só exibir o rótulo.
      assert.ok(/Mod B/.test(html) && !/Mod A/.test(html), 'o filtro de coluna restringe as linhas exibidas');

      // Abrir o filtro de uma coluna renderiza o painel daquela coluna na
      // camada flutuante; escolher outra opção navega mantendo ordenação e
      // descartando a página anterior (que pertencia ao resultado antigo).
      await app.router.navigate('#/moduleInstances?col_position=sidebar-left&sort=title&dir=desc&page=2');
      const before = [];
      const original = app.router.navigate.bind(app.router);
      app.router.navigate = async (href) => { before.push(href); return original(href); };
      await fake.dispatch('document', 'click', { target: fake.element('toggle:position') });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const panelHtml = fake.layerHtml('.admin-colfilter-layer');
      assert.match(panelHtml, /data-colfilter-panel/, 'abrir o botão materializa o painel da coluna');
      assert.match(panelHtml, /sidebar-right/, 'o painel lista os valores reais da coluna Position');
      // O painel é escrito na camada pelo ligador; o fake materializa os
      // checkboxes reais do painel recém-escrito para que o clique do teste
      // chegue ao listener que o ligador registrou em `boxes()`.
      wirePanelControls(fake, panelHtml, 'position');
      const target = fake.element(`panelopt:sidebar-right`);
      target.checked = true;
      // O painel abre com o valor ativo marcado; trocar de valor significa
      // DESMARCAR o anterior — não somar a ele (Adendo 3, 1.3).
      const previous = fake.element('panelopt:sidebar-left');
      previous.checked = false;
      await fake.dispatch('panelopt:sidebar-right', 'change');
      await fake.dispatch('panelok', 'click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(before.length, 1, 'aplicar o painel navega uma vez');
      assert.match(String(before[0]), /position=sidebar-right/, 'a navegação leva o filtro escolhido');
      assert.match(String(before[0]), /sort=title/, 'a ordenação escolhida é preservada');
      assert.ok(!/page=/.test(String(before[0])), 'a página anterior é descartada ao trocar o filtro');

      await app.router.navigate('#/plugins?state=enabled');
      const pluginHtml = fake.documentRef.body.innerHTML;
      assert.match(pluginHtml, /data-colfilter-column="state"/, 'a lista de plugins oferece filtro por coluna');
      assert.ok(!/aria-label="Filtrar coluna undefined/.test(pluginHtml), 'os rótulos dos plugins também resolvem');

      /*
       * Coluna Tipo de extensão (Adendo 3, 3.1): o painel publicava o
       * identificador do manifesto cru ("module"), enquanto a barra de busca
       * da mesma tela já traduzia ("Módulo"). Duas traduções para a mesma
       * coluna é o defeito; agora a tabela canônica é a única fonte.
       */
      const typePanel = renderColumnFilterPanel({ domain: 'extensions', key: 'type', column: 'type', label: 'Tipo', options: ['plugin', 'component', 'module'] });
      const typeLabels = [...typePanel.matchAll(/data-colfilter-value="([^"]*)"><input[^>]*>\s*<span class="admin-colfilter-option-label"[^>]*>([^<]*)</g)]
        .map(([, value, label]) => [value, label.trim()]);
      assert.deepEqual(typeLabels, [['component', 'Componente'], ['module', 'Módulo'], ['plugin', 'Plugin']], 'a coluna Tipo mostra o rótulo humano, na ordem da tabela canônica, e guarda o valor cru');
    } finally { app.stop(); }
  });

  console.log('ok - listas de extensoes: colunas separadas com menu por cabecalho e rotulos acessiveis');
}

// ---------------------------------------------------------------------------
// 5b. /templates/styles — Estilo e Template com menus por coluna (item 3)
// ---------------------------------------------------------------------------

async function runTemplateStylesColumnTests() {
  /*
   * A listagem `/templates/styles` tinha só a barra única com "Template":
   * a coluna Estilo não tinha filtro próprio, e o filtro de coluna nem
   * existia. Aqui se prova que as DUAS colunas de valor têm menu
   * independente, que o menu realmente restringe as linhas, que os filtros
   * coexistem na URL e que `/installer` continua com a barra única (o
   * pedido permite).
   */
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const catalog = [{ key: 'cassiopeia', title: 'Cassiopeia' }, { key: 'atlas', title: 'Atlas' }];
    const styles = [
      { id: 'cassiopeia-0', title: 'Cassiopeia - Padrão', template: 'cassiopeia', templateTitle: 'Cassiopeia', home: '1', isDefault: true },
      { id: 'atlas-0', title: 'Atlas - Azul', template: 'atlas', templateTitle: 'Atlas', home: '1', isDefault: false },
      { id: 'atlas-1', title: 'Atlas - Escuro', template: 'atlas', templateTitle: 'Atlas', home: '0', isDefault: false }
    ];
    const admin = createFakeAdminService({});
    admin.templateStyles = {
      list: async () => ({ etag: '"styles"', styles, catalog }),
      setDefault: async () => {},
      duplicate: async () => 'atlas-2',
      remove: async () => {}
    };
    const fake = createFakeDocumentRef();
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/templates/styles');
      const html = fake.documentRef.body.innerHTML;
      const columns = [...html.matchAll(/data-colfilter-column="([^"]*)"/g)].map((match) => match[1]);
      assert.ok(columns.includes('style'), 'a coluna Estilo tem menu de filtro próprio');
      assert.ok(columns.includes('template'), 'a coluna Template tem menu de filtro próprio');

      const labels = [...html.matchAll(/aria-label="(Filtrar coluna [^"]*)"/g)].map((match) => match[1]);
      assert.ok(labels.some((label) => /Estilo/.test(label)), 'o menu da coluna Estilo tem rótulo acessível');
      assert.ok(labels.some((label) => /Template/.test(label)), 'o menu da coluna Template tem rótulo acessível');
      assert.ok(!labels.some((label) => /undefined/.test(label)), 'nenhum rótulo acessível cai em "undefined"');

      // As opções do Template usam o TÍTULO do catálogo, não a chave crua —
      // o usuário não deveria ler "cassiopeia" no menu. O painel é construído
      // em tempo de execução por `bindColumnFilters` (que recebe o catálogo
      // como `options`); o fake registra o HTML escrito na camada flutuante.
      const panelHtml = fake.layerHtml('.admin-colfilter-layer');
      if (panelHtml) {
        const rawLabels = [...panelHtml.matchAll(/data-colfilter-option[^>]*>([\s\S]*?)<\/label>/g)].map(([, text]) => text.replace(/<[^>]*>/g, '').trim());
        if (rawLabels.length) {
          assert.ok(rawLabels.some((label) => /Cassiopeia/.test(label)), 'o menu de Template rotula pelo título do catálogo');
          assert.ok(!rawLabels.some((label) => /^cassiopeia$/.test(label)), 'o menu de Template não expõe a chave crua como rótulo');
        }
      }

      // Filtrar por Estilo restringe de verdade (não é só rótulo no botão).
      // A comparação é feita sobre as LINHAS da tabela: o catálogo de
      // templates alimenta o <select> da barra e faria o HTML inteiro casar.
      const bodyRows = (rendered) => {
        const table = /<tbody>([\s\S]*?)<\/tbody>/.exec(rendered);
        return table ? table[1] : '';
      };
      await app.router.navigate('#/templates/styles?col_style=Atlas%20-%20Escuro');
      const styleRows = bodyRows(fake.documentRef.body.innerHTML);
      assert.ok(/Atlas - Escuro/.test(styleRows), 'o estilo filtrado aparece');
      assert.ok(!/Atlas - Azul/.test(styleRows), 'o filtro por Estilo restringe as linhas exibidas');
      assert.ok(!/Cassiopeia/.test(styleRows), 'o filtro por Estilo descarta os demais templates');

      // E os filtros das duas colunas convivem na mesma URL.
      await app.router.navigate('#/templates/styles?col_template=atlas');
      const templateRows = bodyRows(fake.documentRef.body.innerHTML);
      assert.ok(/Atlas - Azul/.test(templateRows) && /Atlas - Escuro/.test(templateRows), 'o filtro por Template mantém os estilos do template');
      assert.ok(!/Cassiopeia/.test(templateRows), 'o filtro por Template descarta os estilos dos outros templates');

      await app.router.navigate('#/templates/styles?col_template=atlas&col_style=Atlas%20-%20Azul');
      const bothRows = bodyRows(fake.documentRef.body.innerHTML);
      assert.ok(/Atlas - Azul/.test(bothRows), 'com os dois filtros o estilo escolhido aparece');
      assert.ok(!/Atlas - Escuro/.test(bothRows), 'as duas colunas filtram ao mesmo tempo');

      // Sem resultado o cabeçalho (e os menus) precisam sobreviver, senão o
      // usuário não teria como voltar a "Todos".
      await app.router.navigate('#/templates/styles?col_style=Inexistente');
      const emptyHtml = fake.documentRef.body.innerHTML;
      assert.match(emptyHtml, /data-colfilter-column="style"/, 'o menu sobrevive ao estado vazio');
      assert.match(emptyHtml, /admin-empty/, 'o estado vazio é anunciado');

      // `/installer` fica com a barra única, por decisão do pedido.
      await app.router.navigate('#/installer');
      const installerHtml = fake.documentRef.body.innerHTML;
      assert.ok(!/data-colfilter-column=/.test(installerHtml), 'a lista de instalador mantém a barra única');
    } finally { app.stop(); }
  });

  console.log('ok - estilos de template: Estilo e Template com menu por coluna independente');
}

// ---------------------------------------------------------------------------
// 5c. Cadeia obrigatória em Artigos (Adendo 3, 1.6) — cobre 1.1 a 1.3
// ---------------------------------------------------------------------------

/*
 * Repositório de artigos no formato de `createRepository`, com a
 * distribuição exigida pelo item 1.6: 20 artigos, 3 Publicados, 2
 * Despublicados, 1 Arquivado, 1 na lixeira e os 13 restantes divididos
 * entre Publicado e Despublicado (7 + 6). O adendo fala em "5 linhas" no
 * recorte Publicado+Despublicado, mas a própria distribuição que ele
 * descreve soma 20 artigos e não fecha em 5; as contagens abaixo são as
 * reais dessa distribuição e ficam expostas em `expected` para as
 * asserções não repetirem números mágicos.
 */
function articleChainRepository() {
  /*
   * Distribuição pedida pelo item 1.6, explícita: 3 Publicados, 2
   * Despublicados, 1 Arquivado, 1 na lixeira e os 13 restantes divididos
   * entre Publicado e Despublicado. Sem os números à mão o "resto
   * distribuído" vira um chute e as contagens do painel não têm como ser
   * conferidas.
   */
  const states = [
    'Published', 'Published', 'Published', 'Draft', 'Draft', 'Archived', 'Trashed',
    ...Array.from({ length: 13 }, (_, index) => (index < 7 ? 'Published' : 'Draft'))
  ];
  const expected = { Published: 10, Draft: 8, Archived: 1, Trashed: 1 };
  const articles = states.map((state, index) => ({
    id: 100 + index,
    title: `Artigo ${String(index + 1).padStart(2, '0')}`,
    alias: `artigo-${index + 1}`,
    categoryId: 10,
    state,
    featured: false
  }));
  const categories = [{ id: 10, title: 'Institucional', alias: 'institucional', parentId: null, state: 'Published' }];
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
  const repository = { categories: store(categories), articles: store(articles), tags: empty, menu: empty, extensions: empty, moduleInstances: empty, siteConfig: empty };
  return { repository, expected, articles };
}

async function runArticleChainTests() {
  /*
   * O caminho completo do usuário, numa só prova: renderizar a lista de
   * artigos, abrir o menu da coluna Estado por um clique REAL no botão,
   * ler o painel renderizado, desmarcar "Arquivado" e aplicar. Sem esta
   * cadeia, cada peça (faceta, painel, codec, serviço) podia passar
   * isolada e a soma continuar quebrada — foi exatamente o que aconteceu:
   * o painel lia arrays e o serviço invertia a visibilidade.
   */
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const chain = articleChainRepository();
    const service = createAdminService(chain.repository);
    const expected = chain.expected;
    const visible = expected.Published + expected.Draft;
    const fake = createFakeDocumentRef();
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    // Os renderizadores reais de `com_content` e a barra da lista escrevem
    // o markup por `innerHTML`; o fake só precisa materializar os controles
    // que o ligador procura depois da renderização.
    const admin = {
      ...service,
      overview: async () => ({ articles: 20, categories: 1, tags: 0, menu: 0, extensions: 0, moduleInstances: 0 })
    };
    admin.categories.treeOptions = async () => [{ value: '10', label: 'Institucional' }];
    const app = await mountApp(admin, storage, fake.documentRef);
    const navigations = [];
    const original = app.router.navigate.bind(app.router);
    app.router.navigate = async (href) => { navigations.push(String(href)); return original(href); };
    try {
      await app.router.navigate('#/articles');
      const html = fake.documentRef.body.innerHTML;
      assert.match(html, /data-colfilter-toggle[^>]*data-colfilter-column="state"/, 'a lista de artigos oferece o menu da coluna Estado');
      assert.match(html, /Publicado/, 'o botão da coluna Estado resolve o rótulo em português');

      // (1) O painel mostra os três rótulos exigidos, com as contagens
      // reais e os três MARCADOS (sem filtro = tudo marcado, 1.3).
      await fake.dispatch('document', 'click', { target: fake.element('toggle:state') });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const panelHtml = fake.layerHtml('.admin-colfilter-layer');
      assert.match(panelHtml, /data-colfilter-panel/, 'abrir o botão materializa o painel da coluna Estado');
      ['Publicado', 'Despublicado', 'Arquivado'].forEach((label) => assert.match(panelHtml, new RegExp(label), `o painel rotula "${label}"`));
      wirePanelControls(fake, panelHtml, 'state');
      const panelCounts = (fake.panelOptionBoxes?.() ?? []);
      const optionByLabel = (label) => panelCounts.find((box) => String(box.label ?? '') === label);
      const publishedOption = optionByLabel('Publicado');
      const draftOption = optionByLabel('Despublicado');
      const archivedOption = optionByLabel('Arquivado');
      assert.ok(publishedOption && draftOption && archivedOption, 'o painel expõe os três estados do domínio');
      assert.equal(publishedOption.checked, true, 'sem filtro, "Publicado" abre marcado');
      assert.equal(draftOption.checked, true, 'sem filtro, "Despublicado" abre marcado');
      assert.equal(archivedOption.checked, true, 'sem filtro, "Arquivado" abre marcado');
      assert.equal(Number(publishedOption.count), expected.Published, 'a contagem de "Publicado" é a do conjunto completo');
      assert.equal(Number(draftOption.count), expected.Draft, 'a contagem de "Despublicado" é a do conjunto completo');
      assert.equal(Number(archivedOption.count), expected.Archived, 'a contagem de "Arquivado" é a do conjunto completo');

      /*
       * Achado 10: o painel precisava OFERECER "Na lixeira" já na listagem
       * padrão, mesmo com a lixeira oculta e com contagem 0 — senão o filtro
       * não tinha como ser escolhido. E a opção "*" do `state=*` NÃO pode
       * virar uma linha do menu: ela é "tudo", não um valor.
       */
      const trashedOption = optionByLabel('Na lixeira');
      assert.ok(trashedOption, 'o painel de Estado oferece "Na lixeira" a partir da listagem padrão');
      assert.equal(trashedOption.checked, false, 'a lixeira abre DESMARCADA quando não há filtro (não é o padrão)');
      assert.equal(Number(trashedOption.count), expected.Trashed, 'mesmo oculta, a contagem da lixeira é a real');
      assert.equal(optionByLabel('*'), undefined, 'o curinga `state=*` nunca aparece como opção do menu');

      // Com `state=*` na URL o painel abre com TODAS as opções marcadas,
      // inclusive a lixeira — antes ele abria vazio, sem como editar o recorte.
      await app.router.navigate('#/articles?state=*');
      await fake.dispatch('document', 'click', { target: fake.element('toggle:state') });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const starHtml = fake.layerHtml('.admin-colfilter-layer');
      wirePanelControls(fake, starHtml, 'state');
      const starBoxes = (fake.panelOptionBoxes?.() ?? []);
      const starByLabel = (label) => starBoxes.find((box) => String(box.label ?? '') === label);
      ['Publicado', 'Despublicado', 'Arquivado', 'Na lixeira'].forEach((label) => {
        assert.equal(starByLabel(label)?.checked, true, `com state=*, "${label}" abre marcado`);
      });
      // Volta ao recorte padrão para o resto da cadeia (2) e (3).
      await app.router.navigate('#/articles');
      await fake.dispatch('document', 'click', { target: fake.element('toggle:state') });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const restoreHtml = fake.layerHtml('.admin-colfilter-layer');
      wirePanelControls(fake, restoreHtml, 'state');

      // (2) Desmarcar "Arquivado" e aplicar grava a forma multi-valor.
      const restoredArchived = (fake.panelOptionBoxes?.() ?? []).find((box) => String(box.label ?? '') === 'Arquivado');
      assert.ok(restoredArchived, 'o painel restaurado reexpõe "Arquivado"');
      restoredArchived.checked = false;
      await fake.dispatch(`panelopt:${restoredArchived.value}`, 'change');
      const before = navigations.length;
      await fake.dispatch('panelok', 'click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(navigations.length, before + 1, 'aplicar o painel navega uma vez');
      const applied = navigations[navigations.length - 1];
      // A URL chega percent-encoded (`%7Em%3APublished%2CDraft`); decodificar
      // antes de conferir evita acoplar a prova à escolha de escape do router.
      const appliedQuery = decodeURIComponent(String(applied));
      assert.match(appliedQuery, /state=~m:Published,Draft/, `a URL aplicada usa a lista multi-valor: ${appliedQuery}`);
      assert.ok(!/Trashed|Archived/.test(appliedQuery), 'os estados desmarcados ficam fora da URL');

      // (3) Renderizar a URL aplicada mostra só Publicados e Despublicados.
      await app.router.navigate(applied);
      const filtered = await service.articles.query({ state: '~m:Published,Draft' });
      assert.equal(filtered.total, visible, `a lista filtrada traz os ${visible} Publicados e Despublicados`);
      assert.ok(filtered.rows.every((row) => row.state === 'Published' || row.state === 'Draft'), 'nenhum Arquivado ou da lixeira sobra na lista filtrada');
      const filteredHtml = fake.documentRef.body.innerHTML;
      assert.match(filteredHtml, /Artigo/, 'a lista filtrada renderiza as linhas');
      assert.ok(!/Artigo 06/.test(filteredHtml), 'o artigo Arquivado sai da lista filtrada');

      // O serviço entrega exatamente o recorte de Publicado+Despublicado
      // quando o limite acompanha o conjunto (a tabela pagina por 20, então
      // aqui se prova o recorte, não a página).
      const onlyTwo = await service.articles.query({ state: '~m:Published,Draft', limit: 10 });
      assert.equal(onlyTwo.total, visible);
      assert.equal((await service.articles.query({ state: '~m:Archived' })).total, expected.Archived, 'só o Arquivado quando é ele que está marcado');
      assert.equal((await service.articles.query({ state: '~m:Trashed' })).total, expected.Trashed, 'só a lixeira quando é ela que está marcada');
      assert.equal((await service.articles.query({ state: '*' })).total, 20, 'state=* traz tudo');
      // Sem `state`, só a lixeira fica fora: Publicados + Despublicados + Arquivados.
      assert.equal((await service.articles.query({})).total, visible + expected.Archived, 'sem state, a lixeira fica fora');
    } finally { app.stop(); }
  });

  console.log('ok - cadeia em artigos: painel da coluna Estado, contagens, forma multi-valor e lista filtrada');
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

/*
 * Árvore da coluna Categoria (Adendo 3, 3.4).
 *
 * A coluna Categoria é a única hierárquica da barra de filtros: o menu
 * precisa mostrar "Pai › Filho" indentado (senão o ID cru não diz nada) e
 * marcar um pai precisa marcar os filhos presentes. O conjunto gravado é a
 * lista EXATA de ids (`~m:`), nunca o id do pai sozinho — a expansão é
 * visual, não semântica: `categoryId` simples já expande para descendentes,
 * e um `~m:10` levaria tudo o que a árvore tem, mesmo o que o usuário
 * desmarcou.
 *
 * A árvore do fixture: 10 (Institucional) › { 11 (Avisos), 12 (Avisos) };
 * 11 › 15 (Extra, neto); 14 (Avisos) é raiz solta — cobre o caso de homônima
 * em outro ramo, que já foi tratado no teste anterior.
 */
function categoryTreeRepository() {
  const categories = [
    { id: 10, title: 'Institucional', alias: 'institucional', parentId: null, state: 'Published' },
    { id: 11, title: 'Avisos', alias: 'avisos', parentId: 10, state: 'Published' },
    { id: 12, title: 'Avisos', alias: 'avisos-b', parentId: 10, state: 'Published' },
    { id: 14, title: 'Solto', alias: 'solto', parentId: null, state: 'Published' },
    { id: 15, title: 'Extra', alias: 'extra', parentId: 11, state: 'Published' }
  ];
  // Um artigo por categoria, para que cada valor do menu exista de fato na
  // faceta: `buildColumnFacets` só lista categoria presente na listagem.
  const articles = [10, 11, 12, 14, 15].map((categoryId, index) => ({ id: 300 + index, title: `Artigo ${categoryId}`, alias: `artigo-${categoryId}`, categoryId, state: 'Published' }));
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
  return { categories: store(categories), articles: store(articles), tags: empty, menu: empty, extensions: empty, moduleInstances: empty, siteConfig: empty };
}

async function runCategoryTreeTests() {
  const service = createAdminService(categoryTreeRepository());
  const facets = (await service.articles.query({})).columnFacets;
  // `columnFacets` é um mapa por dimensão (a coluna → valores), não uma lista:
  // é a forma que o painel consome para abrir o menu de uma coluna.
  const categoryFacet = facets.categoryId;
  assert.ok(Array.isArray(categoryFacet) && categoryFacet.length, 'a listagem de artigos publica a faceta de categoria');

  const byValue = new Map(categoryFacet.map((item) => [String(item.value), item]));
  /*
   * Rótulo humano: o caminho completo, não o id. Duas irmãs homônimas na
   * mesma árvore ('Avisos' 11 e 'Avisos' 12) produziriam o MESMO caminho —
   * indistinguíveis no menu — então só os rótulos repetidos ganham o
   * desempate pelo alias e, por fim, pelo `#id`. Os demais ficam com o
   * caminho puro.
   */
  assert.equal(byValue.get('10')?.label, 'Institucional', 'a raiz traz só o próprio título');
  assert.equal(byValue.get('11')?.label, 'Institucional › Avisos (avisos) · #11', 'a irmã homônima traz o caminho e o desempate');
  assert.equal(byValue.get('12')?.label, 'Institucional › Avisos (avisos-b) · #12', 'a outra irmã homônima traz o próprio desempate');
  assert.equal(byValue.get('15')?.label, 'Institucional › Avisos › Extra', 'o neto encadeia os três níveis');
  assert.equal(byValue.get('14')?.label, 'Solto', 'a raiz solta não herda caminho de ninguém');

  // Profundidade: é o que deixa o ligador reconstruir a árvore do markup
  // plano, já que o painel é uma lista de `<label>`s em ordem de documento.
  assert.equal(byValue.get('10')?.depth, 0, 'a raiz fica no nível 0');
  assert.equal(byValue.get('11')?.depth, 1, 'o filho desce um nível');
  assert.equal(byValue.get('15')?.depth, 2, 'o neto desce dois níveis');
  assert.equal(byValue.get('14')?.depth, 0, 'a raiz solta volta ao nível 0');

  // A ordem também é a da árvore (pai antes dos filhos), senão a indentação
  // por profundidade não desenharia nada coerente.
  const order = categoryFacet.map((item) => String(item.value));
  assert.ok(order.indexOf('10') < order.indexOf('11'), 'o pai aparece antes do filho');
  assert.ok(order.indexOf('11') < order.indexOf('15'), 'o pai aparece antes do neto');

  /*
   * (2) A expansão pai→filhos é visual: `renderColumnFilterPanel` emite a
   * profundidade no markup e o ligador marca/desmarca em cascata. Aqui se
   * prova pelo markup REAL, com os checkboxes lidos dele — nada de
   * `querySelector` falso.
   */
  const treeHtml = renderColumnFilterPanel({
    key: 'categoryId',
    domain: 'articles',
    label: 'Categoria',
    tree: true,
    options: categoryFacet.map((item) => ({ value: String(item.value), label: item.label, count: item.count, depth: item.depth }))
  });
  const fake = createFakeDocumentRef({ elements: {} });
  const { boxes } = wirePanelControls(fake, treeHtml, 'categoryId');
  const depthOf = (value) => Number((new RegExp(`data-colfilter-value="${value}"[\\s\\S]*?data-colfilter-depth="(\\d+)"`).exec(treeHtml) ?? [])[1]);
  assert.equal(depthOf('10'), 0, 'o markup traz a profundidade da raiz');
  assert.equal(depthOf('11'), 1, 'o markup traz a profundidade do filho');
  assert.equal(depthOf('15'), 2, 'o markup traz a profundidade do neto');
  assert.equal(boxes.length, 5, 'cada categoria presente na listagem aparece como uma caixa');
  assert.ok(treeHtml.includes('Institucional › Avisos › Extra'), 'o rótulo humano chega ao markup final, não só à faceta');

  console.log('ok - arvore de categorias: rotulo de caminho, profundidade e ordem de pai para filho');
}

/*
 * Escopo da memória (site + usuário).
 *
 * O `sessionStorage` de um tenant SharePoint é POR ORIGEM, então dois sites
 * diferentes (`/teams/camap-agp`, `/sites/outro`) escrevem no mesmo storage.
 * Sem site e usuário na chave, os filtros de um apareceriam no outro — e como
 * o recorte viaja por id de categoria/tag, o cruzamento não é só cosmético:
 * ids homônimos de outro site trariam conteúdo alheio.
 */
async function runMemoryScopeTests() {
  const storage = new Map();
  const fakeStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
    removeItem: (key) => { storage.delete(key); }
  };

  const siteA = { site: '/teams/camap-agp', user: '7' };
  const siteB = { site: '/sites/outro', user: '7' };
  const userB = { site: '/teams/camap-agp', user: '9' };

  // Dois sites: o mesmo estado de lista não pode atravessar.
  rememberListFilters('/articles', { state: 'Published', q: 'alfa' }, fakeStorage, siteA);
  assert.deepEqual(recallListFilters('/articles', fakeStorage, siteA), { state: 'Published', q: 'alfa' });
  assert.deepEqual(recallListFilters('/articles', fakeStorage, siteB), {}, 'outro site não herda a memória');

  // Dois sites, mesmo usuário: gravar no B não sobrescreve o A.
  rememberListFilters('/articles', { state: 'Draft' }, fakeStorage, siteB);
  assert.deepEqual(recallListFilters('/articles', fakeStorage, siteA), { state: 'Published', q: 'alfa' }, 'gravar no outro site não sobrescreve o primeiro');
  assert.deepEqual(recallListFilters('/articles', fakeStorage, siteB), { state: 'Draft' });

  // Dois usuários, mesmo site: isolados entre si e do primeiro.
  rememberListFilters('/articles', { state: 'Archived' }, fakeStorage, userB);
  assert.deepEqual(recallListFilters('/articles', fakeStorage, userB), { state: 'Archived' });
  assert.deepEqual(recallListFilters('/articles', fakeStorage, siteA), { state: 'Published', q: 'alfa' }, 'trocar de usuário na mesma aba não vaza o recorte');

  // Chaves distintas de fato, e com o formato documentado.
  assert.notEqual(listFilterKey('/articles', siteA), listFilterKey('/articles', siteB));
  assert.notEqual(listFilterKey('/articles', siteA), listFilterKey('/articles', userB));
  assert.match(listFilterKey('/articles', siteA), /^minijoomla\.admin\.listFilters:teams\/camap-agp:7:\/articles$/);

  // Normalização: caixa e barras do site não criam memórias paralelas para o
  // MESMO site (`/teams/CAMAP-AGP/` é o mesmo site que `/teams/camap-agp`).
  assert.equal(listFilterKey('/articles', { site: '/teams/CAMAP-AGP/', user: '7' }), listFilterKey('/articles', siteA));
  assert.equal(listFilterKey('/articles', { site: '//teams//camap-agp', user: '7' }), listFilterKey('/articles', siteA));

  // Escopo ausente/ inválido degrada para o formato por site, sem lançar nem
  // criar chave desonesta. `user` com `:` ou longo demais é descartado.
  assert.equal(listFilterKey('/articles', { site: '/teams/camap-agp', user: 'a:b' }), listFilterKey('/articles', { site: '/teams/camap-agp' }));
  assert.equal(listFilterKey('/articles', { site: '/', user: '' }), listFilterKey('/articles', { site: '' }));
  assert.equal(listFilterKey('/articles', { user: 'x'.repeat(65) }), listFilterKey('/articles', {}));
  assert.equal(listFilterKey('/articles', {}), 'minijoomla.admin.listFilters:-:-:/articles', 'escopo vazio vira o marcador -:-');

  // A regra de `page` e a de "query explícita vence" continuam valendo dentro
  // de cada escopo — o escopo restringe o alcance, não muda a semântica.
  rememberListFilters('/articles', { state: 'Published', page: '3' }, fakeStorage, siteA);
  assert.deepEqual(recallListFilters('/articles', fakeStorage, siteA), { state: 'Published' }, 'page nunca entra na memória, mesmo com escopo');

  // Storage indisponível continua sendo no-op silencioso, agora com escopo.
  const throwing = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } };
  assert.deepEqual(recallListFilters('/articles', throwing, siteA), {});
  rememberListFilters('/articles', { state: 'Published' }, throwing, siteA);

  // `configureListMemoryScope` define o escopo de módulo que o app usa, e o
  // host real passa o site e um id numérico opaco do SharePoint.
  configureListMemoryScope({ site: '/teams/camap-agp', user: '7' });
  assert.deepEqual(currentMemoryScope(), { site: 'teams/camap-agp', user: '7' });
  assert.equal(listFilterKey('/articles'), listFilterKey('/articles', siteA));
  configureListMemoryScope();
  assert.deepEqual(currentMemoryScope(), { site: SCOPE_ABSENT, user: SCOPE_ABSENT }, 'sem escopo volta ao formato por site');
  assert.match(listFilterKey('/articles'), /^minijoomla\.admin\.listFilters:-:-:\/articles$/);

  console.log('ok - escopo da memoria de filtros isola site e usuario');
}

/*
 * Frente C1 — botão de filtro só com ícone dentro do cabeçalho.
 *
 * Antes o botão mostrava "Filtrar Estado: Publicado, Despublicado": o texto
 * crescia com o filtro e empurrava a largura da coluna, desalinhando
 * cabeçalho e dados. A prova aqui é de markup: o botão não pode conter
 * texto visível, precisa continuar acessível por `aria-label`, e o `<th>`
 * não pode receber `display:flex` (é o invólucro `<div class="admin-th">`
 * que faz o flex).
 */
async function runHeaderButtonTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const chain = articleChainRepository();
    const admin = createAdminService(chain.repository);
    const fake = createFakeDocumentRef();
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/articles?state=Published');
      const html = fake.documentRef.body.innerHTML;

      const toggle = /<button[^>]*data-colfilter-toggle[^>]*data-colfilter-column="state"[^>]*>[\s\S]*?<\/button>/.exec(html);
      assert.ok(toggle, 'a coluna Estado tem botão de filtro no cabeçalho');
      const button = toggle[0];
      const inner = button.replace(/^<button[^>]*>/, '').replace(/<\/button>$/, '');
      assert.equal(inner.replace(/<[^>]*>/g, '').trim(), '', 'o botão do cabeçalho não tem texto visível — só ícone');
      assert.ok(inner.includes('<svg') || inner.includes('▾'), 'o botão traz um ícone desenhado (seta ou funil)');
      assert.match(button, /aria-label="Filtrar coluna Estado \(filtro ativo: 1 valores\)"/, 'com filtro ativo, o aria-label diz quantos valores estão aplicados');
      assert.match(button, /class="admin-colfilter-toggle is-active"/, 'o estado ativo é marcado por classe, não por texto');

      // Sem filtro o rótulo é o simples, e o botão fica inativo.
      await app.router.navigate('#/articles');
      const clean = fake.documentRef.body.innerHTML;
      const plain = /<button[^>]*data-colfilter-toggle[^>]*data-colfilter-column="state"[^>]*>/.exec(clean);
      assert.match(plain[0], /aria-label="Filtrar coluna Estado"/, 'sem filtro o aria-label não cita valores');
      assert.ok(!/admin-colfilter-toggle is-active/.test(plain[0]), 'sem filtro o botão não fica ativo');

      // O flex vive no invólucro (ou em CSS), nunca inline no <th>.
      assert.match(clean, /<th[^>]*class="[^"]*admin-th[^"]*"/, 'o cabeçalho da coluna carrega a classe admin-th');
      assert.match(clean, /<span class="admin-th-label">/, 'o rótulo da coluna fica num span próprio, à esquerda do botão');
      assert.ok(!/<th[^>]*style="[^"]*display:\s*flex/.test(clean), 'nenhum <th> recebe display:flex inline');

      console.log('ok - cabecalho C1: botao so com icone, aria-label com contagem e flex no involucro');
    } finally {
      app.dispose?.();
    }
  });
}

/*
 * Frente C3 — a barra superior não repete o que já tem coluna.
 *
 * Em `extensions` o `<select>` de Tipo duplicava o menu da coluna Tipo: dois
 * controles para o mesmo parâmetro, que podiam discordar entre si. Tipo sai
 * da barra e passa a viver só no cabeçalho. Estado/Habilitado, que NÃO tem
 * coluna correspondente na tabela, continua na URL e vai para o painel "Mais
 * filtros" — senão o recorte aplicado ficaria sem nenhuma forma de desfazer.
 *
 * Em Artigos não há duplicação a remover: a barra superior nunca teve
 * `<select>` de Estado/Categoria/Destaque/Autor — esses sempre foram
 * parâmetros de URL consumidos pelo menu da própria coluna. O teste cobre as
 * duas situações para que a regra não seja confundida com "toda lista perde
 * os selects".
 */
async function runToolbarDeduplicationTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const chain = articleChainRepository();
    const admin = createAdminService(chain.repository);
    const fake = createFakeDocumentRef();
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/extensions');
      const html = fake.documentRef.body.innerHTML;
      const bar = (/<form class="admin-searchbar"[\s\S]*?<\/form>/.exec(html) ?? [''])[0];
      const barExtras = (/<div class="admin-morefilters"[\s\S]*?<\/div>/.exec(html) ?? [''])[0];
      assert.ok(bar.includes('name="q"'), 'o campo de busca continua na barra superior');
      assert.ok(!/<select[^>]*name="type"/.test(bar), 'o select de Tipo saiu da barra — virou filtro da coluna Tipo');
      assert.ok(!/<select[^>]*name="type"/.test(barExtras), 'e não reapareceu como filtro extra: ele tem coluna');

      // O filtro de gerenciamento sem coluna continua acessível, fora da barra.
      assert.match(html, /<button[^>]*data-morefilters-toggle/, 'filtros sem coluna ficam atrás do botão "Mais filtros"');
      assert.match(barExtras, /name="enabled"/, 'Habilitado, que não tem coluna, fica no painel "Mais filtros"');

      // Em Artigos a barra também larga o que virou coluna; o que não tem
      // coluna (Tag, Idioma, itens por página) fica no painel "Mais filtros".
      await app.router.navigate('#/articles');
      const articlesHtml = fake.documentRef.body.innerHTML;
      const articlesBar = (/<form class="admin-searchbar"[\s\S]*?<\/form>/.exec(articlesHtml) ?? [''])[0];
      const articlesPanel = (/<div class="admin-morefilters"[^>]*data-morefilters[^>]*>[\s\S]*?(?=<nav|<\/body|<div class="admin-table-wrap")/.exec(articlesHtml) ?? [''])[0];
      assert.ok(articlesBar.includes('name="q"'), 'a busca de Artigos continua na barra');
      for (const name of ['state', 'categoryId', 'featured', 'author']) {
        assert.ok(!new RegExp(`<select[^>]*name="${name}"`).test(articlesBar), `Artigos: a barra não repete ${name} — o controle é a coluna`);
        assert.ok(!new RegExp(`<select[^>]*name="${name}"`).test(articlesPanel), `Artigos: ${name} também não reaparece no painel — ele TEM coluna`);
      }
      assert.match(articlesHtml, /admin-th-filterable/, 'a coluna de Artigos é que oferece o menu de filtro');
      assert.match(articlesHtml, /<button[^>]*data-morefilters-toggle/, 'os filtros sem coluna ficam atrás do botão "Mais filtros"');
      assert.match(articlesPanel, /name="tag"/, 'Tag, que não tem coluna, continua acessível no painel');
      assert.match(articlesPanel, /name="language"/, 'Idioma, que não tem coluna, continua acessível no painel');
      // Regressão: `limit` é controle de paginação e não tem coluna. Passá-lo
      // como "extra" do catálogo o marcava como coluna e o sumia da tela.
      assert.match(articlesPanel, /name="limit"/, 'Itens por página continua acessível no painel, sem virar coluna');

      console.log('ok - barra C3: select duplicado sai, filtro sem coluna vai para "Mais filtros" e a coluna é o controle único');
    } finally {
      app.dispose?.();
    }
  });
}

/*
 * Frente C2 — barra de filtros ativos.
 *
 * A barra é a única forma de ver o que está recortando a lista agora que o
 * valor saiu de dentro do botão. Ela precisa: não existir sem filtro; listar
 * cada filtro com "<Coluna>: <valores>"; marcar cada chip com um "×"; trazer
 * "Limpar todos"; e remover SÓ o filtro do chip clicado. O clique é real,
 * despachado no documento, porque `bindColumnFilters` registra um listener
 * delegado — e até esta rodada os botões da barra não tinham handler algum.
 */
async function runActiveFilterBarTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const chain = articleChainRepository();
    const admin = createAdminService(chain.repository);
    const fake = createFakeDocumentRef();
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    const app = await mountApp(admin, storage, fake.documentRef);
    const navigations = [];
    const original = app.router.navigate.bind(app.router);
    app.router.navigate = async (href) => { navigations.push(String(href)); return original(href); };
    try {
      // Sem filtro não há barra.
      await app.router.navigate('#/articles');
      assert.ok(!/data-activefilters/.test(fake.documentRef.body.innerHTML), 'sem filtro ativo, a barra não é renderizada');

      await app.router.navigate('#/articles?state=Published');
      const html = fake.documentRef.body.innerHTML;
      assert.match(html, /<div class="admin-activefilters" data-activefilters/, 'com filtro ativo a barra aparece');
      assert.match(html, /class="admin-activefilters-label">Filtros ativos:</, 'a barra tem o rótulo "Filtros ativos:"');
      assert.match(html, /class="admin-activefilter-text"[^>]*>Estado: Publicado</, 'o chip mostra "<Coluna>: <valor>" com o rótulo humano');
      assert.match(html, /data-activefilter-remove="state"/, 'o chip tem botão de remover próprio');
      assert.match(html, /aria-label="Remover filtro Estado"/, 'o botão de remover é acessível');
      assert.match(html, /data-activefilter-clearall/, 'a barra traz "Limpar todos"');

      // Mais de dois valores: só dois visíveis + "+N".
      await app.router.navigate('#/articles?state=' + encodeURIComponent('~m:Draft,Archived'));
      const many = fake.documentRef.body.innerHTML;
      assert.match(many, /Estado: Despublicado, Arquivado/, 'dois valores aparecem por extenso');

      // O "×" remove somente o filtro do próprio chip.
      await app.router.navigate('#/articles?state=Published&q=alfa');
      navigations.length = 0;
      await fake.dispatch('document', 'click', { target: fake.element('attr:data-activefilter-remove=state') });
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(navigations.length, 1, 'clicar no "×" navega uma vez');
      const removed = decodeURIComponent(String(navigations[0]));
      assert.ok(!/[?&]state=/.test(removed), 'o filtro do chip sai da URL');
      assert.ok(/[?&]q=alfa/.test(removed), 'a busca é preservada ao remover um filtro de coluna');

      // "Limpar todos" tira os filtros e preserva q/sort/dir/limit.
      await app.router.navigate('#/articles?state=Published&sort=title&dir=asc&limit=10&q=alfa');
      navigations.length = 0;
      await fake.dispatch('document', 'click', { target: fake.element('attr:data-activefilter-clearall=') });
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(navigations.length, 1, '"Limpar todos" navega uma vez');
      const cleared = decodeURIComponent(String(navigations[0]));
      assert.ok(!/[?&]state=/.test(cleared), '"Limpar todos" remove os filtros');
      ['q=alfa', 'sort=title', 'dir=asc', 'limit=10'].forEach((pair) => assert.ok(cleared.includes(pair), `"Limpar todos" preserva ${pair}`));
      assert.ok(!/[?&]page=/.test(cleared), '"Limpar todos" volta para a primeira página');

      console.log('ok - barra C2: aparece com filtro, formata valores, remove um chip e limpa todos preservando a busca');
    } finally {
      app.dispose?.();
    }
  });
}

/*
 * Frente D — colunas numéricas de Categorias e a legenda de situações.
 *
 * A listagem de Categorias ganhou quatro indicadores lado a lado (uma
 * situação cada). Cada um é um link para os Artigos daquela categoria
 * naquela situação, com `aria-label` completo — porque "12" sozinho não diz
 * nada a quem usa leitor de tela. Uma legenda abaixo da tabela explica as
 * quatro cores. A prova é de markup e de link: o destino precisa carregar
 * a categoria E a situação.
 */
async function runCategoryCountsTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const repository = {
      findMany: async () => ({ items: [], hasNextPage: false, etag: '"x"' }),
      findById: async () => null, create: async () => ({ id: '1' }), update: async () => ({}), remove: async () => {}
    };
    const admin = createAdminService({ categories: repository, articles: repository });
    const rows = [{
      id: '10', title: 'Agenda', alias: 'agenda', depth: 0, etag: '"c10"',
      counts: { Published: 12, Draft: 3, Archived: 1, Trashed: 2 }
    }];
    // `createAdminService` devolve um objeto congelado; a listagem precisa do
    // service com `categories.query` substituído, então a cópia é rasa.
    const adminService = {
      ...admin,
      categories: {
        ...(admin.categories ?? {}),
        query: async () => Object.assign(rows.slice(), { columnFacets: {}, total: 1, totalBase: 1 })
      }
    };
    const fake = createFakeDocumentRef();
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    const app = await mountApp(adminService, storage, fake.documentRef);
    try {
      await app.router.navigate('#/categories');
      const html = fake.documentRef.body.innerHTML;

      assert.match(html, /admin-count admin-count-published/, 'a contagem de publicados tem marcador próprio');
      assert.match(html, /admin-count admin-count-draft/, 'a contagem de despublicados tem marcador próprio');
      assert.match(html, /admin-count admin-count-archived/, 'a contagem de arquivados tem marcador próprio');
      assert.match(html, /admin-count admin-count-trashed/, 'a contagem de lixeira tem marcador próprio');

      // Cada indicador é um link para os artigos daquela categoria+ situação.
      const link = /<a class="admin-count admin-count-published" href="([^"]*)"/.exec(html);
      assert.ok(link, 'o indicador de publicados é um link');
      const href = decodeURIComponent(link[1]).replace(/\u0026/g, '&');
      assert.ok(/categoryId=10/.test(href) || /categoryId=%2210%22/.test(href) || /categoryId=10/.test(decodeURIComponent(href)), 'o link carrega a categoria da linha');

      // aria-label completo, com número, situação e categoria.
      const aria = /aria-label="([^"]*publicados[^"]*)"/.exec(html);
      assert.ok(aria, 'o indicador de publicados tem aria-label');
      assert.match(aria[1], /12/, 'o aria-label traz a contagem');
      assert.match(aria[1], /Agenda/, 'o aria-label nomeia a categoria');

      // A legenda das quatro situações abaixo da tabela.
      assert.match(html, /admin-count-legend/, 'a tabela de categorias traz a legenda das situações');
      ['Publicados', 'Despublicados', 'Arquivados', 'Na lixeira'].forEach((word) => assert.ok(html.includes(word), `a legenda nomeia "${word}"`));

      console.log('ok - categorias D: quatro contagens com link e aria-label, mais a legenda de situacoes');
    } finally {
      app.dispose?.();
    }
  });
}

/*
 * Regressão dos dois defeitos que derrubavam a listagem inteira e o rótulo
 * de categoria, achados na revisão 0.17.15:
 *
 *   (1) `columnFiltersFor` entregava cada LINHA ao predicado de listagem
 *       (`moduleFiltered(rows, params)`), que espera a lista. O resultado era
 *       `rows.filter is not a function` dentro do `render()` de
 *       `extension-pages.js` — a exceção era engolida e a página saía como
 *       "Falha no carregamento", sem tabela e sem nenhum menu de coluna.
 *   (2) `buildColumnFacets` lia os mapas de rótulo/profundidade só como `Map`.
 *       O de rótulos é objeto simples, então `labelMap?.get?.(value)` devolvia
 *       `undefined` e o menu de Categoria mostrava o ID cru.
 */
async function runFacetWiringRegressionTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const admin = createFakeAdminService({
      domains: {
        moduleInstances: [
          { id: 1, title: 'Mod A', extensionKey: 'mod_a', position: 'sidebar-right', ordering: 1, enabled: true, scopeKind: 'All' },
          { id: 2, title: 'Mod B', extensionKey: 'mod_b', position: 'sidebar-left', ordering: 2, enabled: true, scopeKind: 'All' }
        ]
      }
    });
    admin.moduleInstances.catalog = async () => [{ key: 'mod_a', title: 'Tipo A' }, { key: 'mod_b', title: 'Tipo B' }];
    admin.moduleInstances.positions = async () => ({ template: 'cassiopeia', positions: ['sidebar-right', 'sidebar-left'], all: ['sidebar-right', 'sidebar-left'] });
    admin.moduleInstances.batch = async (items, action) => ({ succeeded: items.map((item) => item.id), failed: [], action });
    const fake = createFakeDocumentRef();
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/moduleInstances');
      const html = fake.documentRef.body.innerHTML;
      // Com o predicado quebrado a página virava o cartão de falha; a prova de
      // que a listagem renderizou é não ter o cartão E ter as linhas reais.
      assert.ok(!/Falha no carregamento/.test(html), 'a lista de módulos não cai no cartão de falha');
      assert.ok(/Mod A/.test(html) && /Mod B/.test(html), 'as duas linhas de módulo aparecem na tabela');
      // O predicado é o da listagem, aplicado não à linha isolada: sem filtro
      // ativo os valores do menu são os de todas as linhas.
      const values = [...html.matchAll(/data-colfilter-column="position"[^>]*data-colfilter-values="([^"]*)"/g)].map((match) => match[1]);
      assert.ok(values.length > 0, 'a coluna Position publica os próprios valores');
      // E o filtro por coluna continua restringindo de verdade.
      await app.router.navigate('#/moduleInstances?col_position=sidebar-left');
      const filtered = fake.documentRef.body.innerHTML;
      assert.ok(!/Falha no carregamento/.test(filtered), 'a lista filtrada também não cai no cartão de falha');
      assert.ok(/Mod B/.test(filtered) && !/Mod A/.test(filtered), 'o filtro de Position ainda restringe as linhas');
    } finally { app.stop(); }
  });

  // (2) O rótulo de categoria chega ao menu como caminho humano, não como ID.
  const facets = buildColumnFacets(
    [{ categoryId: '10' }, { categoryId: '11' }],
    [{ key: 'categoryId', reads: (row) => row.categoryId }],
    {},
    { labels: { categoryId: { 10: 'Institucional', 11: 'Institucional › Avisos' } }, depths: { categoryId: new Map([['10', 0], ['11', 1]]) } }
  );
  const labels = new Map(facets.categoryId.map((item) => [String(item.value), item.label]));
  assert.equal(labels.get('10'), 'Institucional', 'o objeto de rótulos é lido (não só `Map`)');
  assert.equal(labels.get('11'), 'Institucional › Avisos', 'o caminho do filho chega ao menu');
  const depths = new Map(facets.categoryId.map((item) => [String(item.value), item.depth]));
  assert.equal(depths.get('11'), 1, 'a profundidade do `Map` continua sendo lida');

  console.log('ok - regressao: predicado de listagem aplicado a linha e mapas de rotulo/profundidade');
}

/*
 * (3) Navegação de ida e volta das telas de edição (revisão, achado 6).
 *
 * Abrir um módulo/plugin/estilo levava a query da listagem; salvar ou
 * CANCELAR voltava para a rota crua, sem filtro, busca, ordenação nem
 * página. O usuário perdia o recorte ao gravar uma linha — o caso mais
 * comum do dia a dia.
 */
async function runEditRoundTripTests() {
  // Espera até o microtask/promise de navegação concluir, sem depender de
  // tempo fixo: o handler de save faz um await de rede antes de navegar.
  const settle = async (attempts = 40) => { for (let i = 0; i < attempts; i += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };

  const cases = [
    {
      route: '#/moduleInstances/1?col_position=sidebar-right&q=Mod&sort=title&dir=desc&page=2',
      listPath: 'moduleInstances',
      label: 'Módulo salvo.',
      domain: 'moduleInstances',
      seed: { moduleInstances: [{ id: 1, title: 'Mod A', extensionKey: 'mod_a', position: 'sidebar-right', ordering: 1, enabled: true, scopeKind: 'All' }] },
      probes: ['col_position=', 'q=Mod', 'sort=title', 'dir=desc', 'page=2'],
      prepare: (admin) => {
        admin.moduleInstances.catalog = async () => [{ key: 'mod_a', title: 'Tipo A' }];
        admin.moduleInstances.positions = async () => ({ template: 'cassiopeia', positions: ['sidebar-right'], all: ['sidebar-right'] });
        admin.moduleInstances.batch = async (items, action) => ({ succeeded: items.map((item) => item.id), failed: [], action });
      },
      crumb: 'Módulos do site',
      formSelector: '[data-ext-form="module"]'
    },
    {
      route: '#/plugins/1?col_enabled=enabled&q=Cache&page=3',
      listPath: 'plugins',
      label: 'Plugin salvo.',
      domain: 'plugins',
      seed: { plugins: [{ id: 1, title: 'Cache', enabled: true, ordering: 1, group: 'system', element: 'cache', definitions: [] }] },
      probes: ['col_enabled=', 'q=Cache', 'page=3'],
      prepare: () => {},
      crumb: 'Plugins',
      formSelector: '[data-ext-form="plugin"]'
    },
    {
      route: '#/templates/styles/1?col_style=atum&page=4',
      listPath: 'templates/styles',
      label: 'Estilo salvo.',
      domain: 'templateStyles',
      seed: { templateStyles: [{ id: 1, title: 'Atum - Padrão', template: 'atum', style: 'atum', definitions: [] }] },
      probes: ['col_style=', 'page=4'],
      prepare: () => {},
      crumb: 'Estilos de template',
      formSelector: '[data-ext-form="style"]'
    }
  ];

  for (const testCase of cases) {
    const storage = createFakeStorage();
    // eslint-disable-next-line no-await-in-loop
    await withStorage(storage, async () => {
      const admin = createFakeAdminService({ domains: { [testCase.domain]: testCase.seed[testCase.domain] } });
      testCase.prepare(admin);
      const fake = createFakeDocumentRef();
      fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
      const app = await mountApp(admin, storage, fake.documentRef);
      try {
        await app.router.navigate(testCase.route);
        const html = fake.documentRef.body.innerHTML;

        // (a) O "Cancelar" do formulário volta COM o recorte.
        const cancel = /admin-form-cancel" href="([^"]*)"/.exec(html);
        assert.ok(cancel, `${testCase.listPath}: o formulário tem link de cancelar`);
        const cancelHref = cancel[1].replace(/&amp;/g, '&');
        for (const probe of testCase.probes) assert.ok(cancelHref.includes(probe), `${testCase.listPath}: cancelar preserva "${probe}"`);

        // (b) A migalha de volta carrega o mesmo recorte.
        const crumb = new RegExp(`href="([^"]*)"[^>]*>${testCase.crumb}`).exec(html);
        assert.ok(crumb, `${testCase.listPath}: a migalha de volta existe`);
        assert.ok(crumb[1].includes('page='), `${testCase.listPath}: a migalha preserva a página`);

        // (c) Salvar navega de volta para a LISTAGEM com o recorte. Este é o
        // caminho que o defeito realmente quebrava: o href do botão de
        // cancelar podia estar certo e a navegação de gravação errada.
        const seen = [];
        const originalNavigate = app.router.navigate.bind(app.router);
        app.router.navigate = async (href) => { seen.push(String(href)); return originalNavigate(href); };
        captureFormSubmit(fake, testCase.formSelector);
        await fake.submitForm();
        await settle();
        const back = seen.find((href) => href.includes(testCase.listPath) && !/\/\d+(\?|$)/.test(href));
        assert.ok(back, `${testCase.listPath}: salvar navega de volta para a listagem (vistos: ${seen.join(' | ') || 'nenhum'})`);
        for (const probe of testCase.saveProbes ?? testCase.probes) assert.ok(back.includes(probe), `${testCase.listPath}: salvar volta com "${probe}"`);
        assert.ok(!/\/\d+(\?|$)/.test(back), `${testCase.listPath}: salvar não volta para a tela de edição`);
      } finally { app.stop(); }
    });
  }

  console.log('ok - ida e volta da edicao: cancelar, migalha e salvar preservam o recorte da lista');
}

/*
 * (4) Teclado no painel (Adendo 3, 3.5) — revisão, achado 7.
 *
 * Na árvore de Categorias o Espaço numa caixa-mãe tem de marcar também os
 * descendentes: o `change` é o que o ligador escuta para cascatear e para
 * recalcular o tri-estado dos pais. Quando o handler do Espaço só chamava
 * `syncTristate()`, o DOM marcava uma caixa e o resto do painel continuava
 * mostrando o estado antigo — o usuário via a mãe marcada e os filhos
 * desmarcados, e o filtro aplicado não era o que estava na tela.
 */
async function runPanelKeyboardTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const admin = {
      ...createAdminService(categoryTreeRepository()),
      overview: async () => ({ articles: 4, categories: 4, tags: 0, menu: 0, extensions: 0, moduleInstances: 0 })
    };
    const fake = createFakeDocumentRef();
    fake.setWireOnRender((body, html) => wireColumnFilters(fake, html));
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/articles');
      // O painel nasce fechado: é o clique REAL no botão do cabeçalho que
      // registra os listeners de teclado no diálogo. Materializar o painel à
      // mão (como fazem os testes de conteúdo) provaria só o markup, não o
      // comportamento que o achado 7 apontava.
      await fake.dispatch('document', 'click', { target: fake.element('toggle:categoryId') });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const panelHtml = fake.layerHtml('.admin-colfilter-layer');
      assert.match(panelHtml, /data-colfilter-panel/, 'o botão da coluna Categoria materializa o painel');
      const { boxes } = wirePanelControls(fake, panelHtml, 'categoryId');
      assert.ok(boxes.length >= 4, 'o painel do artigo traz as categorias usadas');

      // O painel escuta `keydown` no diálogo e decide pelo `activeElement` —
      // é assim que o teclado chega a ele no navegador.
      const press = async (key, active) => {
        fake.documentRef.activeElement = active;
        const listeners = fake.listenersFor('panel:open', 'keydown');
        assert.ok(listeners.length, 'o painel registra um handler de teclado');
        for (const handler of listeners) {
          let defaultPrevented = false;
          await handler({ key, preventDefault: () => { defaultPrevented = true; }, target: active });
          if (defaultPrevented) return true;
        }
        return false;
      };

      const changes = new Map();
      const focused = [];
      for (const box of boxes) {
        const seen = [];
        box.dispatchEvent = (event) => { seen.push(event.type); changes.set(box.value, seen); };
        box.focus = () => { focused.push(box.value); fake.documentRef.activeElement = box; };
      }

      const boxFor = (value) => boxes.find((box) => box.value === value);
      assert.ok(boxFor('10'), 'a categoria 10 tem caixa no painel');

      // --- Espaço numa caixa da árvore -------------------------------
      boxFor('10').checked = false;
      const handled = await press(' ', boxFor('10'));
      assert.equal(handled, true, 'o Espaço no painel é tratado pelo ligador');
      assert.equal(boxFor('10').checked, true, 'o Espaço marca a caixa em foco');
      /*
       * A prova que o achado 7 exigia: a caixa AVISA o painel. O ligador
       * escuta `change` para cascatear os filhos e recalcular o tri-estado
       * dos pais. Quando o handler do Espaço só chamava `syncTristate()`, o
       * DOM marcava uma caixa e os descendentes ficavam com o estado antigo.
       */
      assert.ok((changes.get('10') ?? []).includes('change'), 'o Espaço dispara `change` para o resto do painel acompanhar');

      // Espaço de novo desmarca (o handler alterna, não fixa em `true`).
      await press(' ', boxFor('10'));
      assert.equal(boxFor('10').checked, false, 'o Espaço alterna em vez de só marcar');

      // Espaço fora das caixas não é engolido: o painel tem o campo de
      // busca, e capturar o espaço ali impediria de digitar um termo com
      // espaço ("Sao Paulo").
      const searchBox = fake.element('panelsearch');
      assert.equal(await press(' ', searchBox), false, 'o Espaço fora das caixas não é capturado pelo painel');

      // --- Setas pulam o que a busca escondeu ------------------------
      boxFor('15').closest = () => ({ hidden: true });
      focused.length = 0;
      const all = fake.element('panelall');
      all.focus = () => { focused.push('(all)'); fake.documentRef.activeElement = all; };
      await press('ArrowDown', all);
      assert.ok(focused.length > 0, 'a seta move o foco para algum alvo');
      for (const value of focused) assert.notEqual(value, '15', 'a caixa escondida pela busca é pulada pelas setas');
    } finally { app.stop(); }
  });

  console.log('ok - teclado do painel: espaco dispara change na arvore e as setas pulam o que esta escondido');
}

/*
 * Adendo 1, item 5: a barra de lote é CONTEXTUAL. Antes ela era um bloco
 * fixo de ~100px acima da tabela, visível mesmo sem nada selecionado. O
 * contrato agora é: zero linhas marcadas → a barra não existe na tela;
 * uma ou mais → uma linha só, com o contador ao vivo e "Posição/Categoria
 * de destino" apenas para a ação correspondente.
 *
 * O teste dirige o aplicativo REAL e olha o `hidden` do nó que o usuário vê,
 * porque um teste só de HTML provaria o estado inicial e nunca a transição.
 */
async function runBatchBarTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const rows = [
      { id: 1, title: 'Alfa', alias: 'alfa', state: 'Published' },
      { id: 2, title: 'Beta', alias: 'beta', state: 'Published' }
    ];
    const admin = createFakeAdminService({
      domains: {
        articles: rows,
        categories: [{ id: 10, title: 'Institucional', alias: 'institucional', parentId: null, state: 'Published' }],
        tags: []
      }
    });
    admin.articles.query = async () => ({
      rows, total: rows.length, totalBase: rows.length, page: 1, limit: 20,
      facets: { authors: [], languages: [] }, columnFacets: {}
    });
    admin.categories.treeOptions = async () => [{ value: '10', label: 'Institucional' }];
    admin.articles.batch = async () => ({ succeeded: rows.map((row) => ({ id: row.id })), failed: [] });
    const fake = createFakeDocumentRef();
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/articles');
      const bar = fake.element('[data-ext-batchbar]');
      // O endereco da contagem e o mesmo que `syncBatchBar` resolve em
      // `bar.querySelector('[data-ext-batch-count]')`: o fake chaveia por
      // `<pai>|attr:<nome>=`.
      const count = () => fake.element('[data-ext-batchbar]|attr:data-ext-batch-count=');
      const target = () => fake.element('[data-ext-batchbar]|attr:data-ext-batch-category-field=');

      // Sem seleção a barra não existe na tela: `hidden` no nó real, e não
      // uma classe cosmética que um teste de HTML poderia acidentalmente
      // satisfazer sem que nada mude para o usuário.
      assert.equal(bar.hidden, true, 'sem seleção a barra de lote fica escondida');

      // Uma seleção revela a barra e o contador passa a refletir as linhas
      // marcadas. O gesto é o `change` da caixa "selecionar todos", o mesmo
      // caminho que o navegador percorre.
      const inputs = [
        { value: '1', checked: false, dataset: { extId: '1' } },
        { value: '2', checked: false, dataset: { extId: '2' } }
      ];
      fake.setList('[data-ext-select]', inputs);
      fake.element('[data-ext-select-all]').checked = true;
      await fake.dispatch('[data-ext-select-all]', 'change');
      assert.equal(bar.hidden, false, 'com seleção a barra aparece');
      assert.match(String(count().textContent), /^2 selecionado\(s\)$/, `o contador reflete as duas linhas: ${count().textContent}`);
      // "selecionar todos" marcou as duas linhas de verdade.
      assert.ok(inputs.every((input) => input.checked), '"selecionar todos" marca as linhas visíveis');

      // "Categoria de destino" é condicional à ação de mover.
      // O gesto real é o `change` do próprio `<select name="batchAction">`
      // (que sobe por bubbling até o listener da barra); `bindBatch` o
      // registra em `form.querySelector('[name="batchAction"]')`, que neste
      // fake resolve para o endereço global `name:batchAction` — o MESMO nó
      // que `syncBatchBar` lê pelo `form` da barra.
      const action = fake.element('name:batchAction');
      action.value = 'publish';
      await fake.dispatch('name:batchAction', 'change');
      assert.equal(target().hidden, true, '"Categoria de destino" não aparece para ação que não move');
      action.value = 'move';
      await fake.dispatch('name:batchAction', 'change');
      assert.equal(target().hidden, false, '"Categoria de destino" aparece quando a ação é mover');

      // Limpar a seleção zera o contador e esconde a barra de novo. O
      // listener é direto no botão (`[data-ext-clear-selection]`), então o
      // gesto é o `click` nesse endereço — não um clique delegado no
      // documento.
      await fake.dispatch('[data-ext-clear-selection]', 'click');
      assert.equal(bar.hidden, true, 'limpar a seleção esconde a barra');
      assert.match(String(count().textContent), /^0 selecionado\(s\)$/, 'limpar a seleção zera o contador');
      assert.ok(inputs.every((input) => !input.checked), 'limpar a seleção desmarca as linhas');
      assert.equal(fake.element('[data-ext-select-all]').checked, false, 'limpar a seleção desmarca "selecionar todos"');
    } finally { app.stop(); }
  });

  // A mesma barra contextual existe nas listas de extensões. O alvo
  // condicional lá se chama "Posição de destino" e o botão de limpar é
  // `[data-ext-batch-clear]`: os atributos NÃO são os mesmos de
  // `content-pages.js`, então este trecho prova cada lista pelo seu próprio
  // contrato em vez de assumir que os dois módulos compartilham markup.
  const moduleRows = [
    { id: 101, title: 'Mod A', type: 'mod_a', position: 'sidebar-right', state: 'Published' },
    { id: 102, title: 'Mod B', type: 'mod_b', position: 'sidebar-left', state: 'Published' }
  ];
  const admin = createFakeAdminService({ domains: { moduleInstances: moduleRows } });
  admin.moduleInstances.catalog = async () => [{ key: 'mod_a', title: 'Tipo A' }, { key: 'mod_b', title: 'Tipo B' }];
  admin.moduleInstances.positions = async () => ({ template: 'cassiopeia', positions: ['sidebar-right', 'sidebar-left'], all: ['sidebar-right', 'sidebar-left'] });
  admin.moduleInstances.batch = async (items, action) => ({ succeeded: items.map((item) => item.id), failed: [], action });
  const fake = createFakeDocumentRef();
  const app = await mountApp(admin, createFakeStorage(), fake.documentRef);
  try {
    await app.router.navigate('#/moduleInstances');
    const bar = fake.element('[data-ext-batchbar]');
    const count = () => fake.element('[data-ext-batchbar]|attr:data-ext-batch-count=');
    const target = () => fake.element('[data-ext-batchbar]|attr:data-ext-batch-target-field=');

    assert.equal(bar.hidden, true, 'modulos: sem seleção a barra fica escondida');
    const inputs = [
      { value: '101', checked: false, dataset: { extId: '101' } },
      { value: '102', checked: false, dataset: { extId: '102' } }
    ];
    fake.setList('[data-ext-select]', inputs);
    fake.element('[data-ext-select-all]').checked = true;
    await fake.dispatch('[data-ext-select-all]', 'change');
    assert.equal(bar.hidden, false, 'modulos: com seleção a barra aparece');
    assert.match(String(count().textContent), /^2 selecionado\(s\)$/, `modulos: contador reflete as linhas: ${count().textContent}`);

    const action = fake.element('name:batchAction');
    action.value = 'publish';
    await fake.dispatch('name:batchAction', 'change');
    assert.equal(target().hidden, true, 'modulos: "Posição de destino" não aparece para ação que não move');
    action.value = 'move';
    await fake.dispatch('name:batchAction', 'change');
    assert.equal(target().hidden, false, 'modulos: "Posição de destino" aparece ao mover');

    await fake.dispatch('[data-ext-batch-clear]', 'click');
    assert.equal(bar.hidden, true, 'modulos: limpar a seleção esconde a barra');
    assert.ok(inputs.every((input) => !input.checked), 'modulos: limpar a seleção desmarca as linhas');
  } finally { app.stop(); }

  console.log('ok - barra de lote contextual: some sem selecao, aparece com uma linha e mostra o alvo so quando move');
}

/*
 * Adendo 1, item 2: em produção os botões de filtro de Título, Alias e
 * Categoria não apareciam na lista de Artigos. Os três são colunas de
 * primeira classe (`columnsForDomain('articles')`), então cada um precisa
 * do próprio botão no cabeçalho — e o `href` da paginação não pode carregar
 * `page=undefined` quando a lista já está na primeira página.
 */
async function runArticleColumnButtonsTests() {
  const storage = createFakeStorage();
  await withStorage(storage, async () => {
    const rows = Array.from({ length: 45 }, (_, index) => ({
      id: index + 1,
      title: `Artigo ${String(index + 1).padStart(2, '0')}`,
      alias: `artigo-${index + 1}`,
      state: 'Published',
      categoryId: 10
    }));
    const admin = createFakeAdminService({
      domains: {
        articles: rows,
        categories: [{ id: 10, title: 'Institucional', alias: 'institucional', parentId: null, state: 'Published' }],
        tags: []
      }
    });
    admin.articles.query = async () => ({
      rows: rows.slice(0, 20), total: rows.length, totalBase: rows.length, page: 1, limit: 20,
      facets: { authors: [], languages: [] },
      columnFacets: {
        title: [{ value: 'Artigo 01', label: 'Artigo 01', count: 1 }],
        alias: [{ value: 'artigo-1', label: 'artigo-1', count: 1 }],
        categoryId: [{ value: '10', label: 'Institucional', count: 45 }]
      }
    });
    admin.categories.treeOptions = async () => [{ value: '10', label: 'Institucional' }];
    const fake = createFakeDocumentRef();
    const app = await mountApp(admin, storage, fake.documentRef);
    try {
      await app.router.navigate('#/articles');
      const html = fake.documentRef.body.innerHTML;
      const toggles = [...html.matchAll(/data-colfilter-key="([^"]+)"/g)].map((match) => match[1]);
      for (const key of ['title', 'alias', 'categoryId']) {
        assert.ok(toggles.includes(key), `a coluna "${key}" oferece o próprio botão de filtro (tem: ${toggles.join(', ')})`);
      }

      // `page: undefined` na primeira página NÃO pode virar texto no href.
      assert.ok(!/page=undefined/.test(html), `nenhum link carrega page=undefined: ${(html.match(/href="[^"]*page=undefined[^"]*"/) ?? [''])[0]}`);
      assert.ok(!/undefined/.test(html), 'nenhum "undefined" vaza para o HTML renderizado');
    } finally { app.stop(); }
  });
  console.log('ok - artigos: Titulo, Alias e Categoria tem botao de filtro proprio e nenhum link carrega page=undefined');
}

export async function runAdminListFiltersTests() {
  await runListMemoryTests();
  await runMemoryScopeTests();
  await runColumnFilterTests();
  await runRoundTripTests();
  await runPaginationSortTests();
  await runBatchTests();
  await runExtensionColumnTests();
  await runTemplateStylesColumnTests();
  await runArticleChainTests();
  await runHomonymCategoryTests();
  await runCategoryTreeTests();
  await runHeaderButtonTests();
  await runToolbarDeduplicationTests();
  await runActiveFilterBarTests();
  await runCategoryCountsTests();
  await runFacetWiringRegressionTests();
  await runEditRoundTripTests();
  await runPanelKeyboardTests();
  await runBatchBarTests();
  await runArticleColumnButtonsTests();
  console.log('ok - filtros administrativos persistentes e por coluna');
}