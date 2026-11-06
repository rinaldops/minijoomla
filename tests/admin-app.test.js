import assert from 'node:assert/strict';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { ADMIN_DOMAINS, ARTICLE_EDITOR_LAYOUT } from '../src/administrator/components/com_minijoomla/field-schemas.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';

/*
 * Fake adminService compatível com o shape de createAdminService
 * (src/libraries/minijoomla/application/admin-service.js), mas com dados em memória — testa
 * src/administrator/components/com_minijoomla/app.js isoladamente de SPMIDDLE/SharePoint, no mesmo espírito
 * dos fakes de adapter já usados por tests/core.test.js.
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
  let config = seed.config ?? null;
  return {
    ...domains,
    siteConfig: { get: async () => config, save: async (input) => { config = { ...config, ...input, etag: '"1"' }; return config; } },
    overview: async () => Object.fromEntries(Object.entries(domains).map(([domain, api]) => [domain, 0])).constructor === Object ? { articles: (await domains.articles?.list() ?? []).length, categories: (await domains.categories?.list() ?? []).length, tags: 0, menu: 0, extensions: 0, moduleInstances: 0 } : {}
  };
}

/*
 * Fake documentRef mínimo com suporte real a addEventListener/dispatch
 * manual, suficiente para testar o fluxo completo (render -> bind ->
 * simular submit) sem depender de um DOM real. Mantém o mesmo padrão já
 * usado pelos testes de src/index.js (documentRef.body.innerHTML +
 * querySelector), estendido com um registro simples de listeners para
 * permitir disparar `submit`/`click` manualmente.
 */
function createFakeDocumentRef() {
  const listenersByElement = new Map();
  function makeElementFromHtml() {
    // Elemento fake "universal": qualquer querySelector devolve o mesmo
    // objeto reutilizável (suficiente para este painel, que só tem um
    // <form data-admin-form> e um .admin-form-status por página).
    const element = { value: '', checked: false, textContent: '', dataset: {}, addEventListener: (event, handler) => { const list = listenersByElement.get(element) ?? []; list.push({ event, handler }); listenersByElement.set(element, list); }, querySelector: () => null };
    return element;
  }
  const formElement = makeElementFromHtml();
  const statusElement = makeElementFromHtml();
  const inputsByName = new Map();
  formElement.querySelector = (selector) => {
    const match = selector.match(/\[name="(.+)"\]/);
    if (!match) return null;
    if (!inputsByName.has(match[1])) inputsByName.set(match[1], makeElementFromHtml());
    return inputsByName.get(match[1]);
  };
  const documentRef = {
    body: {
      innerHTML: '',
      querySelector: (selector) => selector === '[data-admin-form]' ? formElement : selector === '.admin-form-status' ? statusElement : null,
      querySelectorAll: () => []
    }
  };
  return { documentRef, formElement, statusElement, inputsByName, dispatch: (element, event) => { for (const entry of listenersByElement.get(element) ?? []) if (entry.event === event) entry.handler({ preventDefault: () => {} }); }, input: (name) => formElement.querySelector(`[name="${name}"]`) };
}

function createFakeArticleTabbedDocumentRef() {
  const base = createFakeDocumentRef();
  const tabs = ARTICLE_EDITOR_LAYOUT.tabs.map((tab) => ({ label: tab.label, slug: tab.key }));
  const buttonListeners = new Map();
  const buttons = tabs.map((tab, index) => {
    const attrs = { 'aria-controls': `admin-article-tab-articles-${tab.slug}-panel`, 'aria-selected': index === 0 ? 'true' : 'false', tabindex: index === 0 ? '0' : '-1' };
    const button = { textContent: tab.label, getAttribute: (name) => attrs[name], setAttribute: (name, value) => { attrs[name] = value; }, addEventListener: (event, handler) => { const list = buttonListeners.get(button) ?? []; list.push({ event, handler }); buttonListeners.set(button, list); } };
    return button;
  });
  const richtextElementId = 'admin-field-articles-articletext';
  const richtextElement = { id: richtextElementId, hasAttribute: (name) => name === 'data-admin-readmore' };
  const panelById = new Map(tabs.map((tab, index) => {
    const panel = { id: `admin-article-tab-articles-${tab.slug}-panel`, hidden: index !== 0 };
    panel.querySelector = (selector) => (tab.slug === 'content' && selector === `#${richtextElementId}`) ? richtextElement : null;
    return [panel.id, panel];
  }));
  richtextElement.closest = (selector) => {
    // content tab starts visible, so no hidden ancestor.
    const panel = panelById.get('admin-article-tab-articles-content-panel');
    return selector === '[data-admin-tab-panel][hidden]' && panel.hidden ? panel : null;
  };
  const originalQuerySelector = base.documentRef.body.querySelector;
  base.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-tab-button]' ? buttons : selector === '[data-admin-richtext]' ? [richtextElement] : [];
  base.documentRef.body.querySelector = (selector) => {
    const idMatch = selector.match(/^#(.+)$/);
    return idMatch ? (panelById.get(idMatch[1]) ?? null) : originalQuerySelector(selector);
  };
  return {
    ...base,
    tabButton: (label) => buttons.find((button) => button.textContent === label),
    tabPanel: (label) => panelById.get(`admin-article-tab-articles-${tabs.find((tab) => tab.label === label).slug}-panel`),
    richtextElementId,
    dispatchTab: (element, event) => { for (const entry of buttonListeners.get(element) ?? []) if (entry.event === event) entry.handler(); }
  };
}

/*
 * Variante de createFakeDocumentRef com suporte real a abas
 * (bindTabHandlers em src/administrator/components/com_minijoomla/app.js): simula os 3 botões/painéis que
 * SITE_CONFIG_FIELDS produz hoje (Site/Sistema/HTML personalizado),
 * reproduzindo o mesmo esquema de id de render-form.js
 * (`admin-tab-site-config-<slug>-label`/`-panel`, formId "site-config" —
 * o mesmo usado por renderConfigPage em app.js). Testa o comportamento
 * real de troca de aba sem precisar de um DOM real (projeto não usa
 * jsdom).
 *
 * Inclui um elemento `data-admin-richtext` fake dentro do painel "HTML
 * personalizado" (hidden na primeira aba), com `closest()` real o
 * suficiente para bindRichTextEditors (app.js) reconhecê-lo como "dentro
 * de um painel oculto" — reproduz o bug real encontrado por inspeção
 * visual ao vivo (ver tmp/visual-evidence/editor-customhtml-tab.png
 * nesta frente): um editor TinyMCE criado sobre um elemento já oculto
 * mede 0×0 e nunca se recalcula ao revelar a aba depois.
 */
function createFakeTabbedDocumentRef() {
  const base = createFakeDocumentRef();
  const tabs = [{ label: 'Site', slug: 'site' }, { label: 'Sistema', slug: 'sistema' }, { label: 'HTML personalizado', slug: 'html-personalizado' }];
  const buttonListeners = new Map();
  const buttons = tabs.map((tab, index) => {
    const attrs = { 'aria-controls': `admin-tab-site-config-${tab.slug}-panel`, 'aria-selected': index === 0 ? 'true' : 'false', tabindex: index === 0 ? '0' : '-1' };
    const button = { textContent: tab.label, getAttribute: (name) => attrs[name], setAttribute: (name, value) => { attrs[name] = value; }, addEventListener: (event, handler) => { const list = buttonListeners.get(button) ?? []; list.push({ event, handler }); buttonListeners.set(button, list); } };
    return button;
  });
  const richtextElementId = 'admin-field-site-config-customHtmlBody';
  const richtextElement = { id: richtextElementId };
  const panelById = new Map(tabs.map((tab, index) => {
    const panel = { id: `admin-tab-site-config-${tab.slug}-panel`, hidden: index !== 0 };
    panel.querySelector = (selector) => (tab.slug === 'html-personalizado' && selector === `#${richtextElementId}`) ? richtextElement : null;
    return [panel.id, panel];
  }));
  richtextElement.closest = (selector) => {
    const panel = panelById.get('admin-tab-site-config-html-personalizado-panel');
    return selector === '[data-admin-tab-panel][hidden]' && panel.hidden ? panel : null;
  };
  const originalQuerySelector = base.documentRef.body.querySelector;
  base.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-tab-button]' ? buttons : selector === '[data-admin-richtext]' ? [richtextElement] : [];
  base.documentRef.body.querySelector = (selector) => {
    const idMatch = selector.match(/^#(.+)$/);
    return idMatch ? (panelById.get(idMatch[1]) ?? null) : originalQuerySelector(selector);
  };
  return {
    ...base,
    tabButton: (label) => buttons.find((button) => button.textContent === label),
    tabPanel: (label) => panelById.get(`admin-tab-site-config-${tabs.find((tab) => tab.label === label).slug}-panel`),
    richtextElementId,
    dispatch: (element, event) => { for (const entry of buttonListeners.get(element) ?? []) if (entry.event === event) entry.handler(); }
  };
}

async function runModuleInstanceCountPresentationTests() {
  // Existing local fixture + real service; no transport, storage or tenant.
  for (const state of [{ enabled: true }, { enabled: false }, { enabled: false, trashed: true }]) {
    const repositories = createDemoRepositories({ storage: null });
    for (const row of (await repositories.moduleInstances.findMany()).items) await repositories.moduleInstances.delete(row.id, { etag: row.etag });
    let writes = 0;
    const tracked = Object.fromEntries(Object.entries(repositories).map(([domain, repository]) => [domain, {
      ...repository, ...Object.fromEntries(['create', 'update', 'delete'].map((method) => [method, async (...args) => { writes++; return repository[method](...args); }]))
    }]));
    const service = createAdminService(tracked);
    const { documentRef } = createFakeDocumentRef();
    const app = createAdminApplication({ adminService: service, documentRef, autoStart: false });
    const snapshot = () => Promise.all(Object.values(repositories).map((repository) => repository.findMany()));
    const html = () => documentRef.body.innerHTML;
    const checkOverview = async (instances, extensions) => {
      const before = await snapshot();
      const writesBefore = writes;
      const counts = await service.overview();
      assert.equal(counts.moduleInstances, instances);
      assert.equal(counts.extensions, extensions);
      await app.router.navigate('#/');
      assert.match(html(), new RegExp(`class="admin-overview-count">${instances}</span><span class="admin-overview-label">Módulos do site</span>`));
      assert.match(html(), new RegExp(`class="admin-overview-count">${extensions}</span><span class="admin-overview-label">Extensões registradas</span>`));
      assert.match(html(), new RegExp(`aria-label="Módulos do site: ${instances}\\. Conta todas as instâncias salvas, inclusive despublicadas e na lixeira; não indica módulos visíveis no site\\." aria-describedby="admin-module-instance-help"`));
      assert.match(html(), /title="Conta todas as instâncias salvas, inclusive despublicadas e na lixeira/);
      assert.match(html(), /<p class="admin-help" role="note" id="admin-module-instance-help">Módulo é um tipo de extensão\. O card Módulos do site conta instâncias salvas, não tipos habilitados\./);
      assert.match(html(), /href="#\/moduleInstances\/new">Criar módulo<\/a>/);
      assert.match(html(), /href="#\/moduleInstances">Configurar posição e páginas<\/a>/);
      assert.match(html(), /class="sidebar-item-title">Módulos do site<\/span>/);
      assert.match(html(), /class="sidebar-item-title">Extensões registradas<\/span>/);
      assert.equal(writes, writesBefore, 'overview rendering never writes');
      assert.deepEqual(await snapshot(), before, 'overview leaves saved records and ETags intact');
    };
    try {
      const initialExtensions = (await service.extensions.list()).length;
      assert.ok((await service.moduleInstances.catalog()).length > 0, 'native types exist before any instance');
      await checkOverview(0, initialExtensions);
      const type = await service.extensions.create({ title: 'Tipo externo', key: 'count-fixture', type: 'Module', entryPointUrl: './count-fixture.js', enabled: false });
      await checkOverview(0, initialExtensions + 1);
      await service.extensions.update(type.id, { enabled: true }, { etag: type.etag });
      await checkOverview(0, initialExtensions + 1);
      const beforePages = await snapshot();
      const writesBeforePages = writes;
      await app.router.navigate('#/extensions?type=Module');
      assert.match(html(), /<h1>Extensões registradas<\/h1>/);
      assert.match(html(), /value="Module" selected>Módulo<\/option>/);
      assert.match(html(), /<td>Módulo<\/td>/);
      assert.doesNotMatch(html(), /<td>Module<\/td>/);
      await app.router.navigate(`#/extensions/${type.id}`);
      assert.match(html(), /name="type" readonly disabled value="Módulo"/);
      assert.equal((await service.extensions.get(type.id)).type, 'Module', 'presentation never changes the stored enum');
      await app.router.navigate('#/moduleInstances/new?type=search');
      assert.match(html(), /<label for="admin-module-type">Tipo de módulo \*<\/label>/);
      assert.match(html(), /id="admin-module-type" name="extensionKey" required/);
      await app.router.navigate('#/moduleInstances/select');
      assert.match(html(), /aria-label="Tipos de módulo"/);
      assert.equal(writes, writesBeforePages);
      assert.deepEqual(await snapshot(), beforePages, 'list/type/new form presentation is read-only');
      const instance = await service.moduleInstances.create({ title: 'Primeira instância', extensionKey: 'search', position: 'search', settings: {}, ...state });
      assert.equal(instance.enabled, state.enabled);
      assert.equal(Boolean(instance.trashed), Boolean(state.trashed));
      await checkOverview(1, initialExtensions + 1);
      const saved = await snapshot();
      const writesBeforeList = writes;
      await app.router.navigate('#/moduleInstances?state=*');
      assert.match(html(), /<h1>Módulos do site<\/h1>/);
      assert.match(html(), /<th scope="col">Tipo de módulo<\/th>/);
      assert.match(html(), /for="admin-modules-filter-type" class="visually-hidden">Tipo de módulo<\/label>/);
      assert.match(html(), /Primeira instância/);
      assert.equal(writes, writesBeforeList);
      assert.deepEqual(await snapshot(), saved);
      await service.moduleInstances.create({ title: 'Outra instância do mesmo tipo', extensionKey: 'search', position: 'search', settings: {}, enabled: false, trashed: true });
      await checkOverview(2, initialExtensions + 1);
    } finally { app.stop(); }
  }
  // Legacy generic fallback gets local label overrides, not shared-schema edits.
  const fieldsBefore = structuredClone(ADMIN_DOMAINS.moduleInstances.fields);
  const fallback = createFakeAdminService({ domains: { extensions: [], moduleInstances: [{ id: 1, title: 'Legado', extensionKey: 'search', position: 'search', enabled: false }] } });
  const { documentRef } = createFakeDocumentRef();
  const app = createAdminApplication({ adminService: fallback, documentRef, autoStart: false });
  try {
    await app.router.navigate('#/moduleInstances');
    assert.match(documentRef.body.innerHTML, /<th scope="col">Tipo de módulo<\/th>/);
    await app.router.navigate('#/moduleInstances/new');
    assert.match(documentRef.body.innerHTML, /for="admin-field-moduleInstances-extensionKey">Tipo de módulo \*/);
    assert.deepEqual(ADMIN_DOMAINS.moduleInstances.fields, fieldsBefore);
    assert.equal(ADMIN_DOMAINS.moduleInstances.label, 'Módulos');
    assert.equal(ADMIN_DOMAINS.extensions.label, 'Extensões');
  } finally { app.stop(); }
  console.log('ok - admin app: real in-memory service counts saved module instances (including disabled/trash), never native/registered types; accessible labels preserve records/ETags/enums');
}

export async function runAdminAppTests() {
  await runModuleInstanceCountPresentationTests();
  // 1. painel de controle mostra contagens reais e links para cada domínio + config + descoberta.
  const admin = createFakeAdminService({ domains: { articles: [{ id: 1, title: 'A' }], categories: [] } });
  const { documentRef } = createFakeDocumentRef();
  const app = createAdminApplication({ adminService: admin, documentRef, autoStart: false });
  app.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app.router.navigate('#/');
  assert.match(documentRef.body.innerHTML, /Painel de controle/);
  assert.match(documentRef.body.innerHTML, /class="admin-overview-count">1<\/span><span class="admin-overview-label">Artigos/);
  assert.match(documentRef.body.innerHTML, /href="#\/config"/);
  assert.match(documentRef.body.innerHTML, /href="#\/extensions\/discover"/);

  // 2. listagem de domínio real mostra as linhas e um link "+ Novo".
  await app.router.navigate('#/articles');
  assert.match(documentRef.body.innerHTML, /Artigos/);
  assert.match(documentRef.body.innerHTML, /href="#\/articles\/1"/);
  assert.match(documentRef.body.innerHTML, /href="#\/articles\/new"/);

  // Clock is captured once after loading and used for every cell; navigation
  // refreshes the projection without writing a record or altering editor state.
  let scheduleNow = '2026-11-03T10:30:59.122Z';
  let clockCalls = 0;
  const scheduledRows = [
    { id: 1, title: 'Agendado', state: 'Published', featured: true, publishUp: '2026-11-03T10:30:59.123Z', publishDown: '2026-11-03T11:30:59.123Z' },
    { id: 2, title: 'Destaque futuro', state: 'Published', featured: true, featuredUp: '2026-11-03T11:30:59.123Z' }
  ];
  const scheduleAdmin = createFakeAdminService({ domains: { articles: scheduledRows, categories: [] } });
  for (const method of ['create', 'update', 'remove']) scheduleAdmin.articles[method] = async () => { throw new Error('Scheduling presentation must never write'); };
  const scheduleDocument = createFakeDocumentRef();
  const scheduleApp = createAdminApplication({ adminService: scheduleAdmin, documentRef: scheduleDocument.documentRef,
    autoStart: false, clock: () => { clockCalls++; return scheduleNow; } });
  scheduleApp.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await scheduleApp.router.navigate('#/articles');
  assert.equal(clockCalls, 1);
  assert.match(scheduleDocument.documentRef.body.innerHTML, /Publicação agendada/);
  assert.match(scheduleDocument.documentRef.body.innerHTML, /Destaque agendado/);
  scheduleNow = '2026-11-03T10:30:59.123Z';
  await scheduleApp.router.navigate('#/articles?q=Agendado');
  assert.equal(clockCalls, 2);
  assert.match(scheduleDocument.documentRef.body.innerHTML, /admin-state-icon is-active/);
  assert.match(scheduleDocument.documentRef.body.innerHTML, /admin-state-icon is-featured/);
  scheduleNow = '2026-11-03T11:30:59.123Z';
  await scheduleApp.router.navigate('#/articles?q=Agendado');
  assert.equal(clockCalls, 3);
  assert.match(scheduleDocument.documentRef.body.innerHTML, /Publicação encerrada/);
  assert.match(scheduleDocument.documentRef.body.innerHTML, /Destaque inativo/);
  const savedSchedule = await scheduleAdmin.articles.get(1);
  assert.deepEqual(savedSchedule, { etag: '"1"', ...scheduledRows[0] });
  await scheduleApp.router.navigate('#/articles/1');
  assert.equal(clockCalls, 3, 'opening the editor does not evaluate or save the schedule');
  assert.match(scheduleDocument.documentRef.body.innerHTML, /name="featured"[^>]*checked/);
  assert.match(scheduleDocument.documentRef.body.innerHTML, /value="Published" selected/);
  await scheduleApp.router.navigate('#/categories');
  assert.equal(clockCalls, 3, 'other domains never invoke the article schedule clock');

  // 2b. busca real por título (via location.params.q) filtra a listagem contra o adminService real, preservando o termo digitado na barra de busca.
  const adminWithMany = createFakeAdminService({ domains: { articles: [{ id: 101, title: 'Welcome to your blog' }, { id: 102, title: 'About' }, { id: 103, title: 'Workflows' }] } });
  const fakeSearch = createFakeDocumentRef();
  const appSearch = createAdminApplication({ adminService: adminWithMany, documentRef: fakeSearch.documentRef, autoStart: false });
  appSearch.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await appSearch.router.navigate('#/articles?q=blog');
  assert.match(fakeSearch.documentRef.body.innerHTML, /href="#\/articles\/101"/);
  assert.ok(!fakeSearch.documentRef.body.innerHTML.includes('href="#/articles/102"'));
  assert.ok(!fakeSearch.documentRef.body.innerHTML.includes('href="#/articles/103"'));
  assert.match(fakeSearch.documentRef.body.innerHTML, /value="blog"/);

  // 3. formulário de edição real: submeter com valores alterados chama update com o etag correto e navega de volta para a listagem.
  const fake2 = createFakeDocumentRef();
  const app2 = createAdminApplication({ adminService: admin, documentRef: fake2.documentRef, autoStart: false });
  app2.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app2.router.navigate('#/articles/1');
  assert.match(fake2.documentRef.body.innerHTML, /Editar Artigos/);
  fake2.input('title').value = 'Atualizado';
  fake2.input('alias').value = 'a';
  fake2.input('state').value = 'Published';
  fake2.dispatch(fake2.formElement, 'submit');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const updated = await admin.articles.get(1);
  assert.equal(updated.title, 'Atualizado');

  // 4. conflito de ETag real (admin service rejeita update com etag incorreto) é reportado no status, sem navegar.
  const fake3 = createFakeDocumentRef();
  const admin3 = createFakeAdminService({ domains: { articles: [{ id: 5, title: 'Original' }] } });
  const app3 = createAdminApplication({ adminService: admin3, documentRef: fake3.documentRef, autoStart: false });
  app3.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app3.router.navigate('#/articles/5');
  await admin3.articles.update(5, { title: 'Mudou enquanto editava' }, { etag: '"1"' }); // simula edição concorrente real
  fake3.input('title').value = 'Minha edição';
  fake3.input('alias').value = 'x';
  fake3.dispatch(fake3.formElement, 'submit');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fake3.statusElement.textContent, 'O registro foi alterado por outra pessoa. Recarregue antes de salvar.');

  // 5. exclusão real: botão de excluir chama remove com o etag atual e volta para a listagem.
  const fake4 = createFakeDocumentRef();
  fake4.documentRef.body.querySelector = (selector) => selector === '[data-admin-form]' ? fake4.formElement : selector === '.admin-form-status' ? fake4.statusElement : selector === '[data-admin-delete]' ? (fake4.deleteButton ?? (fake4.deleteButton = { dataset: {}, addEventListener: (event, handler) => { fake4.deleteHandler = handler; } })) : null;
  const admin4 = createFakeAdminService({ domains: { articles: [{ id: 9, title: 'A excluir' }] } });
  const app4 = createAdminApplication({ adminService: admin4, documentRef: fake4.documentRef, autoStart: false });
  app4.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app4.router.navigate('#/articles/9');
  await fake4.deleteHandler();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await admin4.articles.get(9), null);

  // 5b. confirmação de exclusão real: um botão com data-confirm chama window.confirm com a mensagem exata; cancelar o diálogo nativo impede a exclusão real.
  const fake4b = createFakeDocumentRef();
  fake4b.documentRef.body.querySelector = (selector) => selector === '[data-admin-form]' ? fake4b.formElement : selector === '.admin-form-status' ? fake4b.statusElement : selector === '[data-admin-delete]' ? (fake4b.deleteButton ?? (fake4b.deleteButton = { dataset: { confirm: 'Excluir este registro de Artigos? Esta ação não pode ser desfeita.' }, addEventListener: (event, handler) => { fake4b.deleteHandler = handler; } })) : null;
  const admin4b = createFakeAdminService({ domains: { articles: [{ id: 11, title: 'Protegido' }] } });
  const app4b = createAdminApplication({ adminService: admin4b, documentRef: fake4b.documentRef, autoStart: false });
  app4b.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app4b.router.navigate('#/articles/11');
  const originalConfirm = globalThis.confirm;
  let confirmMessageSeen = null;
  globalThis.confirm = (message) => { confirmMessageSeen = message; return false; }; // simula o usuário clicando "Cancelar" no diálogo nativo
  try {
    await fake4b.deleteHandler();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    globalThis.confirm = originalConfirm;
  }
  assert.equal(confirmMessageSeen, 'Excluir este registro de Artigos? Esta ação não pode ser desfeita.');
  assert.notEqual(await admin4b.articles.get(11), null); // cancelado -> registro continua existindo

  // 6. rota de domínio desconhecida resolve 404 acessível, sem lançar.
  const fake5 = createFakeDocumentRef();
  const app5 = createAdminApplication({ adminService: admin, documentRef: fake5.documentRef, autoStart: false });
  app5.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app5.router.navigate('#/rota-inexistente');
  assert.match(fake5.documentRef.body.innerHTML, /role="alert">Página administrativa não encontrada/);

  // 7. descoberta sem discoveryService informado mostra um estado explícito, não um erro genérico.
  const fake6 = createFakeDocumentRef();
  const app6 = createAdminApplication({ adminService: admin, documentRef: fake6.documentRef, autoStart: false });
  app6.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app6.router.navigate('#/extensions/discover');
  assert.match(fake6.documentRef.body.innerHTML, /Descoberta de extensões não está configurada/);

  // 8. abas reais da configuração do site (bindTabHandlers): clicar num botão de aba mostra o painel correspondente e oculta os demais, sem nenhuma navegação de rota envolvida.
  const admin7 = createFakeAdminService({ config: { siteName: 'X' } });
  const fake7 = createFakeTabbedDocumentRef();
  const app7 = createAdminApplication({ adminService: admin7, documentRef: fake7.documentRef, autoStart: false });
  app7.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app7.router.navigate('#/config');
  const siteButton = fake7.tabButton('Site');
  const systemButton = fake7.tabButton('Sistema');
  const sitePanel = fake7.tabPanel('Site');
  const systemPanel = fake7.tabPanel('Sistema');
  assert.equal(sitePanel.hidden, false); // primeira aba começa visível
  assert.equal(systemPanel.hidden, true);
  fake7.dispatch(systemButton, 'click');
  assert.equal(sitePanel.hidden, true);
  assert.equal(systemPanel.hidden, false);
  assert.equal(systemButton.getAttribute('aria-selected'), 'true');
  assert.equal(siteButton.getAttribute('aria-selected'), 'false');

  console.log('ok - admin app: painel de controle mostra contagens reais e links para cada área');
  console.log('ok - admin app: listagem real exibe linhas e link de criação');
  console.log('ok - admin app: busca real por título (location.params.q) filtra a listagem e preserva o termo na barra de busca');
  console.log('ok - admin app: formulário de edição real salva com etag correto e navega de volta');
  console.log('ok - admin app: conflito de ETag real é reportado no status sem navegar');
  console.log('ok - admin app: exclusão real usa o etag atual e navega de volta');
  console.log('ok - admin app: confirmação de exclusão real bloqueia a remoção quando o usuário cancela o diálogo nativo');
  console.log('ok - admin app: rota de domínio desconhecida resolve 404 acessível');
  console.log('ok - admin app: descoberta sem discoveryService mostra estado explícito');
  console.log('ok - admin app: clicar numa aba real da configuração do site mostra o painel correspondente e oculta os demais');

  // 9. editor de texto rico real (bindRichTextEditors): richTextEditorFactory é chamado uma vez por elemento data-admin-richtext da tela atual, com readMoreButton=true quando o elemento tem data-admin-readmore (ex.: articletext de Artigos); a instância da navegação anterior é destruída antes de montar a próxima (nunca duas instâncias "penduradas" ao mesmo tempo).
  const fake8 = createFakeDocumentRef();
  const richtextElement = { id: 'admin-field-articles-articletext', hasAttribute: (name) => name === 'data-admin-readmore' };
  fake8.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-richtext]' ? [richtextElement] : [];
  const createdEditors = [];
  const destroyedIds = [];
  const richTextEditorFactory = async (elementId, options) => {
    const editor = { elementId, readMoreButton: options?.readMoreButton, destroy: () => destroyedIds.push(elementId) };
    createdEditors.push(editor);
    return editor;
  };
  const admin8 = createFakeAdminService({ domains: { articles: [{ id: 1, title: 'A', articletext: '<p>Texto</p>' }] } });
  const app8 = createAdminApplication({ adminService: admin8, documentRef: fake8.documentRef, autoStart: false, richTextEditorFactory });
  app8.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app8.router.navigate('#/articles/1');
  assert.equal(createdEditors.length, 1);
  assert.equal(createdEditors[0].elementId, 'admin-field-articles-articletext');
  assert.equal(createdEditors[0].readMoreButton, true); // data-admin-readmore presente no elemento real
  assert.deepEqual(destroyedIds, []); // nada para destruir ainda, primeira navegação
  await app8.router.navigate('#/articles');
  assert.deepEqual(destroyedIds, ['admin-field-articles-articletext']); // instância da tela anterior destruída antes da nova tela montar

  console.log('ok - admin app: editor de texto rico real monta uma instância por campo data-admin-richtext (com readMoreButton quando data-admin-readmore presente) e destrói a instância da navegação anterior');

  // 10. editor de texto rico real dentro de uma aba que nasce oculta (bindTabHandlers + bindRichTextEditors): NUNCA inicializado enquanto a aba está hidden (mediria 0×0, achado real confirmado por inspeção visual ao vivo nesta frente); só monta a instância no momento em que o usuário revela a aba pelo clique.
  const admin9 = createFakeAdminService({ config: { siteName: 'X', customHtmlBody: '<p>Aviso</p>' } });
  const fake9 = createFakeTabbedDocumentRef();
  const createdEditors9 = [];
  const richTextEditorFactory9 = async (elementId) => { const editor = { elementId, destroy: () => {} }; createdEditors9.push(editor); return editor; };
  const app9 = createAdminApplication({ adminService: admin9, documentRef: fake9.documentRef, autoStart: false, richTextEditorFactory: richTextEditorFactory9 });
  app9.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app9.router.navigate('#/config');
  assert.equal(createdEditors9.length, 0); // o único campo richtext (customHtmlBody) está na aba "HTML personalizado", oculta por padrão
  const customHtmlButton = fake9.tabButton('HTML personalizado');
  fake9.dispatch(customHtmlButton, 'click');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(createdEditors9.length, 1); // revelar a aba monta a instância pendente
  assert.equal(createdEditors9[0].elementId, fake9.richtextElementId);

  console.log('ok - admin app: editor de texto rico real dentro de uma aba oculta só é inicializado quando a aba é revelada, nunca enquanto está hidden');

  // 11. achado real de 2ª rodada: articletext de Artigos compõe/decompõe introtext+fulltext EXATAMENTE como o Joomla real (ArticleModel.php/Content.php::bind()) — sem "Leia mais" no texto salvo, todo o conteúdo fica em introtext e fulltext fica vazio (caso normal, nunca um erro); com o marcador, introtext/fulltext recebem as duas metades reais.
  const admin10 = createFakeAdminService({ domains: { articles: [{ id: 20, title: 'Sem leia mais', introtext: 'Tudo aqui.', fulltext: '' }, { id: 21, title: 'Com leia mais', introtext: 'Resumo.', fulltext: 'Resto do texto.' }] } });
  const fake10 = createFakeDocumentRef();
  const app10 = createAdminApplication({ adminService: admin10, documentRef: fake10.documentRef, autoStart: false });
  app10.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app10.router.navigate('#/articles/20');
  assert.match(fake10.documentRef.body.innerHTML, /<textarea id="admin-field-articles-articletext" name="articletext" data-admin-richtext data-admin-readmore rows="4">Tudo aqui\.<\/textarea>/); // sem fulltext: articletext é só introtext, sem marcador
  await app10.router.navigate('#/articles/21');
  assert.match(fake10.documentRef.body.innerHTML, /Resumo\.&lt;hr id=&quot;system-readmore&quot;&gt;Resto do texto\./); // com fulltext: articletext intercala o marcador real (escapado pelo textarea)
  fake10.input('title').value = 'Com leia mais';
  fake10.input('alias').value = 'com-leia-mais';
  fake10.input('articletext').value = 'Nova intro<hr id="system-readmore">Novo resto';
  fake10.dispatch(fake10.formElement, 'submit');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const updatedArticle = await admin10.articles.get(21);
  assert.equal(updatedArticle.introtext, 'Nova intro'); // decomposto corretamente a partir do marcador real digitado
  assert.equal(updatedArticle.fulltext, 'Novo resto');
  assert.equal('articletext' in updatedArticle, false); // articletext nunca é persistido por si só

  console.log('ok - admin app: articletext de Artigos compõe/decompõe introtext+fulltext via o marcador real "Leia mais", replicando a lógica real do Joomla (ArticleModel.php/Content.php::bind())');

  // 11b. achado real de supervisão: um upload automático de imagem data:/blob: do TinyMCE
  // (automatic_uploads, src/administrator/components/com_minijoomla/editor.js) pode concluir e atualizar o DOM do editor SEM
  // disparar nenhum dos eventos que sincronizam o <textarea> — salvar antes dessa sincronização
  // persistiria o data: URI antigo. bindFormHandlers deve chamar editor.sync() em TODO editor
  // ativo antes de ler os valores do formulário, nunca depender de um evento incidental.
  const admin10b = createFakeAdminService({ domains: { articles: [{ id: 22, title: 'Com imagem', alias: 'com-imagem', introtext: 'data:image/png;base64,OLD', fulltext: '' }] } });
  const fake10b = createFakeDocumentRef();
  const richtextElement10b = { id: 'admin-field-articles-articletext', hasAttribute: (name) => name === 'data-admin-readmore' };
  fake10b.documentRef.body.querySelectorAll = (selector) => selector === '[data-admin-richtext]' ? [richtextElement10b] : [];
  let syncCalls = 0;
  const richTextEditorFactory10b = async () => ({
    destroy: () => {},
    // Simulates editor.uploadImages()+editor.save() resolving the pending upload and
    // only THEN writing the real (uploaded) URL into the textarea — exactly the real
    // race this fix closes: the textarea read by readAdminFormValues must reflect this,
    // never a value captured before sync() ran.
    sync: async () => { syncCalls += 1; fake10b.input('articletext').value = '/teams/SAPScripting/SiteAssets/minijoomla/uploads/real.png'; }
  });
  const app10b = createAdminApplication({ adminService: admin10b, documentRef: fake10b.documentRef, autoStart: false, richTextEditorFactory: richTextEditorFactory10b });
  app10b.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app10b.router.navigate('#/articles/22');
  fake10b.input('title').value = 'Com imagem';
  fake10b.input('alias').value = 'com-imagem';
  // The textarea still holds the STALE data: URI at submit time (as a real pending/just-finished
  // upload would leave it, with no incidental event having re-synced it yet) — sync() must run
  // before the value is read, never after.
  fake10b.input('articletext').value = 'data:image/png;base64,OLD';
  fake10b.dispatch(fake10b.formElement, 'submit');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(syncCalls, 1, 'editor.sync() must be called exactly once per active editor on submit');
  const persistedWithImage = await admin10b.articles.get(22);
  assert.equal(persistedWithImage.introtext, '/teams/SAPScripting/SiteAssets/minijoomla/uploads/real.png', 'the persisted value must reflect the post-sync real URL, never the stale data: URI present at submit time');
  assert.doesNotMatch(persistedWithImage.introtext, /^data:/, 'a data: URI must never reach persistence when a rich text editor is active');

  console.log('ok - admin app: bindFormHandlers sincroniza todo editor rico ativo (aguardando upload de imagem pendente) antes de ler os valores do formulário, eliminando a corrida que persistia data: URI obsoleto');

  // 12. abas do editor de artigo (Fase 1): clicar em "Publicação" deve alternar os painéis sem navegação.
  const admin11 = createFakeAdminService({ domains: { articles: [{ id: 30, title: 'X', alias: 'x', introtext: 'A', fulltext: '' }] } });
  const fake11 = createFakeArticleTabbedDocumentRef();
  const app11 = createAdminApplication({ adminService: admin11, documentRef: fake11.documentRef, autoStart: false });
  app11.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];
  await app11.router.navigate('#/articles/30');
  const contentPanel = fake11.tabPanel('Conteúdo');
  const publishingPanel = fake11.tabPanel('Publicação');
  assert.equal(contentPanel.hidden, false);
  assert.equal(publishingPanel.hidden, true);
  const publishingButton = fake11.tabButton('Publicação');
  fake11.dispatchTab(publishingButton, 'click');
  assert.equal(contentPanel.hidden, true);
  assert.equal(publishingPanel.hidden, false);
  assert.equal(publishingButton.getAttribute('aria-selected'), 'true');
  console.log('ok - admin app: article editor tabs toggle the visible panel without route navigation');

  console.log('admin app: 17 grupos de testes aprovados');
}
