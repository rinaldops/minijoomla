import assert from 'node:assert/strict';
import { createAdminService, descendantIds, treeOrder, nextCopyNames } from '../src/libraries/minijoomla/application/admin-service.js';
import { createContentPages } from '../src/administrator/components/com_minijoomla/content-pages.js';
import { Router } from '../src/libraries/minijoomla/core/router.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';

// Fake no formato de createRepository: findMany nunca devolve etag; update/delete exigem etag.
// Como data-core: etag é não enumerável e o registro é congelado; `{ ...row }` perde o etag.
const stored = ({ etag, ...rest }) => Object.freeze(Object.defineProperty({ ...rest }, 'etag', { value: etag, enumerable: false }));

function fakeRepository(seed = []) {
  const items = new Map(seed.map((item) => [item.id, { etag: '"1"', ...item }]));
  let nextId = Math.max(0, ...seed.map((item) => item.id)) + 1;
  let version = 2;
  const writes = [];
  return {
    writes,
    async findMany() { return { items: [...items.values()].map(({ etag, ...rest }) => ({ ...rest })) }; },
    async findById(id) { const item = items.get(id); if (!item) throw Object.assign(new Error('not found'), { code: 'not-found' }); return stored(item); },
    async create(input) { const id = nextId++; const item = { id, etag: `"${version++}"`, ...input }; items.set(id, item); writes.push(['create', input]); return stored(item); },
    async update(id, input, { etag } = {}) { const item = items.get(id); if (etag !== item.etag) throw Object.assign(new Error('etag'), { code: 'concurrency-conflict' }); items.set(id, { ...item, ...input, etag: `"${version++}"` }); writes.push(['update', input]); return null; },
    async delete(id, { etag } = {}) { const item = items.get(id); if (etag !== item.etag) throw Object.assign(new Error('etag'), { code: 'concurrency-conflict' }); items.delete(id); }
  };
}

function build() {
  const repositories = {
    categories: fakeRepository([
      { id: 1, title: 'Notícias', alias: 'noticias', parentId: null },
      { id: 2, title: 'Esportes', alias: 'esportes', parentId: 1 },
      { id: 3, title: 'Futebol', alias: 'futebol', parentId: 2 },
      { id: 4, title: 'Avisos', alias: 'avisos', parentId: null, state: 'Trashed' }
    ]),
    tags: fakeRepository([{ id: 1, name: 'copa', alias: 'copa', state: 'Published' }, { id: 2, name: 'clima', alias: 'clima' }]),
    articles: fakeRepository([
      { id: 1, title: 'Gol <b>', alias: 'gol', categoryId: 3, state: 'Published', featured: true, author: 'Ana', language: 'pt-BR', tags: 'copa, clima', publishUp: '2026-01-05T10:00:00.000Z', attribsJson: '{"images":{"image_intro":"/uploads/a.png","x":1},"unknown":{"keep":true}}' },
      { id: 2, title: 'Chuva', alias: 'chuva', categoryId: 1, state: 'Draft', featured: false, author: 'Bia', language: 'en-GB', tags: 'clima' },
      { id: 3, title: 'Velho', alias: 'velho', categoryId: 2, state: 'Archived', author: 'Ana' },
      { id: 4, title: 'Lixo', alias: 'lixo', categoryId: 1, state: 'Trashed', author: 'Ana' },
      { id: 5, title: 'Legado', alias: 'legado', categoryId: 1 }
    ]),
    menu: fakeRepository([]), extensions: fakeRepository([]), moduleInstances: fakeRepository([]), siteConfig: fakeRepository([])
  };
  return { repositories, admin: createAdminService(repositories) };
}

function eventControl(extra = {}) {
  const handlers = new Map();
  return { ...extra, addEventListener: (name, handler) => handlers.set(name, handler), fire: (name) => handlers.get(name)?.({ preventDefault() {} }) };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function obsoleteContentActionsTests(admin) {
  const router = new Router({ base: '' });
  for (const outcome of ['success', 'failure', 'partial']) {
    let active = true, navigations = 0, writes = 0;
    const pending = deferred(), status = { textContent: '' };
    const button = eventControl({ dataset: { extAction: 'toggle-state', extId: '1' }, disabled: false });
    const all = eventControl({ checked: true }), selected = { value: '1', checked: false };
    const filter = eventControl({ querySelector: () => null });
    const api = { ...admin, articles: { ...admin.articles, batch: async () => { writes++; return pending.promise; } } };
    const pages = createContentPages({ adminService: api, isCurrent: () => active, shell: ({ bodyHtml }) => bodyHtml,
      router: { link: router.link.bind(router), navigate: async () => { navigations++; } },
      documentRef: { body: {
        querySelector: (selector) => ({ '[data-ext-status]': status, '[data-ext-select-all]': all, '[data-ext-filter]': filter })[selector] ?? null,
        querySelectorAll: (selector) => selector === '[data-ext-action]' ? [button] : selector === '[data-ext-select]' ? [selected] : []
      } }
    });
    (await pages.render({ path: '/articles', params: {} })).bind();
    all.fire('change'); assert.equal(selected.checked, true, 'select-all still works on the current screen');
    const first = button.fire('click'); assert.equal(writes, 1);
    active = false; selected.checked = false;
    all.fire('change'); await filter.fire('submit');
    assert.equal(selected.checked, false, 'obsolete selection must not affect the current screen');
    if (outcome === 'failure') pending.reject(new Error('late failure'));
    else pending.resolve({ succeeded: outcome === 'partial' ? [] : [1], failed: outcome === 'partial' ? [{ id: 1, message: 'late partial failure' }] : [] });
    await first; await button.fire('click');
    assert.equal(writes, 1, 'obsolete row actions never start another write');
    assert.equal(navigations, 0, 'obsolete results do not navigate');
    assert.equal(status.textContent, '', 'obsolete errors and partial failures do not report');
  }

  const confirm = globalThis.confirm;
  try {
    let active = true, removals = 0, prompts = 0, uploads = 0, reads = 0, navigations = 0;
    const fileRead = deferred(), status = { textContent: '' };
    const upload = eventControl({ querySelector: () => ({ files: [{ type: 'image/png', size: 4, arrayBuffer: () => { reads++; return fileRead.promise; } }] }) });
    const remove = eventControl({ dataset: { extAction: 'delete', extId: '0' }, disabled: false });
    const pages = createContentPages({ adminService: {}, isCurrent: () => active, shell: ({ bodyHtml }) => bodyHtml,
      router: { link: router.link.bind(router), navigate: async () => { navigations++; } },
      mediaService: { list: async () => [{ name: 'image.png', url: '/uploads/image.png', size: 4 }], canDelete: true, remove: async () => { removals++; }, uploadImage: async () => { uploads++; } },
      documentRef: { body: { querySelector: (selector) => selector === '[data-ext-upload]' ? upload : selector === '[data-ext-status]' ? status : null, querySelectorAll: (selector) => selector === '[data-ext-action]' ? [remove] : [] } }
    });
    (await pages.render({ path: '/media', params: {} })).bind();
    const reading = upload.fire('submit'); assert.equal(reads, 1);
    active = false; fileRead.resolve(new ArrayBuffer(4)); await reading; await upload.fire('submit');
    assert.equal(uploads, 0, 'navigation during file reading must prevent starting the upload');
    assert.equal(reads, 1);
    active = true;
    globalThis.confirm = () => { prompts++; active = false; return true; };
    await remove.fire('click'); await remove.fire('click');
    assert.equal(prompts, 1); assert.equal(removals, 0, 'confirmation that loses the screen must not start deletion');
    assert.equal(navigations, 0); assert.equal(status.textContent, '');
  } finally { globalThis.confirm = confirm; }
  console.log('ok - content callbacks: obsolete writes/reloads/errors/selection blocked; media file-read and confirmation boundaries guarded');
}

export async function runAdminJoomlaContentTests() {
  const { repositories, admin } = build();

  // 1. Lista: filtros, ordenação, paginação, lixeira oculta por padrão.
  let result = await admin.articles.query({});
  assert.deepEqual(result.rows.map((row) => row.id), [5, 3, 2, 1], 'padrão: id desc, sem lixeira; estado ausente conta como publicado');
  assert.ok(result.rows.every((row) => row.etag), 'linhas da página carregam ETag para as ações');
  assert.ok((await admin.categories.query({})).every((row) => row.etag), 'linhas de categoria carregam ETag');
  assert.ok((await admin.tags.query({})).every((row) => row.etag), 'linhas de tag carregam ETag');
  assert.equal(result.rows.find((row) => row.id === 1).categoryTitle, 'Futebol');
  assert.deepEqual((await admin.articles.query({ state: 'Trashed' })).rows.map((row) => row.id), [4]);
  assert.equal((await admin.articles.query({ state: '*' })).total, 5);
  assert.deepEqual((await admin.articles.query({ categoryId: '1' })).rows.map((row) => row.id), [5, 3, 2, 1], 'categoria inclui descendentes');
  assert.deepEqual((await admin.articles.query({ categoryId: '2' })).rows.map((row) => row.id), [3, 1]);
  assert.deepEqual((await admin.articles.query({ featured: '1' })).rows.map((row) => row.id), [1]);
  assert.deepEqual((await admin.articles.query({ author: 'Ana' })).rows.map((row) => row.id), [3, 1]);
  assert.deepEqual((await admin.articles.query({ tag: 'CLIMA' })).rows.map((row) => row.id), [2, 1]);
  assert.deepEqual((await admin.articles.query({ language: 'en-GB' })).rows.map((row) => row.id), [2]);
  assert.deepEqual((await admin.articles.query({ q: 'id:2' })).rows.map((row) => row.id), [2]);
  assert.deepEqual((await admin.articles.query({ q: 'GOL' })).rows.map((row) => row.id), [1]);
  assert.deepEqual((await admin.articles.query({ sort: 'title', dir: 'desc' })).rows.map((row) => row.title), ['Velho', 'Legado', 'Gol <b>', 'Chuva']);
  assert.deepEqual((await admin.articles.query({ sort: 'category' })).rows.map((row) => row.categoryTitle), ['Esportes', 'Futebol', 'Notícias', 'Notícias']);
  assert.deepEqual((await admin.articles.query({ sort: 'DROP TABLE' })).rows.map((row) => row.id), [5, 3, 2, 1], 'ordenação fora da lista branca é ignorada');
  assert.deepEqual(result.facets.authors, ['Ana', 'Bia']);
  result = await admin.articles.query({ limit: '10', page: '9' });
  assert.equal(result.page, 1);
  assert.equal(result.limit, 10);

  // 2. Lote de artigos: estados, destaque, mover, excluir só da lixeira, conflito de ETag.
  const etag = async (id) => (await admin.articles.get(id)).etag;
  const batch = async (ids, action, extra) => admin.articles.batch(await Promise.all(ids.map(async (id) => ({ id, etag: await etag(id) }))), action, extra);
  for (const [action, check] of [['archive', (row) => row.state === 'Archived'], ['trash', (row) => row.state === 'Trashed'], ['restore', (row) => row.state === 'Draft'], ['publish', (row) => row.state === 'Published'], ['unpublish', (row) => row.state === 'Draft'], ['feature', (row) => row.featured === true], ['unfeature', (row) => row.featured === false]]) {
    const outcome = await batch([2], action);
    assert.deepEqual(outcome.failed, [], action);
    assert.ok(check(await admin.articles.get(2)), action);
  }
  assert.equal((await batch([2], 'delete')).failed.length, 1, 'excluir fora da lixeira é recusado');
  assert.equal((await admin.articles.list()).some((row) => row.id === 2), true);
  await batch([2], 'trash');
  assert.deepEqual((await batch([2], 'delete')).succeeded, [2]);
  assert.equal((await admin.articles.list()).some((row) => row.id === 2), false);
  assert.deepEqual((await batch([3], 'move', { categoryId: '1' })).failed, []);
  assert.equal((await admin.articles.get(3)).categoryId, 1);
  await assert.rejects(() => batch([3], 'move', { categoryId: '99' }), ValidationError);
  await assert.rejects(() => batch([3], 'explode'), ValidationError);
  const stale = await admin.articles.batch([{ id: 3, etag: '"velho"' }], 'publish');
  assert.equal(stale.failed[0].code, 'concurrency-conflict', 'conflito de ETag vira falha por item, sem sobrescrever');

  // 3. Duplicar: "(2)"/alias-2, depois "(3)"/alias-3, preservando attribsJson inteiro.
  const copy = await admin.articles.duplicate(1);
  assert.equal(copy.title, 'Gol <b> (2)');
  assert.equal(copy.alias, 'gol-2');
  assert.equal(copy.state, 'Draft');
  assert.equal(copy.featured, false);
  assert.equal(copy.attribsJson, (await admin.articles.get(1)).attribsJson, 'chaves desconhecidas de attribsJson preservadas');
  assert.equal((await admin.articles.duplicate(1)).alias, 'gol-3');
  assert.deepEqual(nextCopyNames([{ title: 'A (2)', alias: 'a-2' }], { title: 'A', alias: 'a' }, 'title', 'alias'), { title: 'A (3)', alias: 'a-3' });
  const batchCopy = await admin.articles.batch([{ id: 5 }], 'duplicate');
  assert.deepEqual(batchCopy.failed, []);

  // 4. Categorias: árvore, contagens, ciclos, lixeira, exclusão protegida, legado sem State.
  const tree = await admin.categories.query({});
  assert.deepEqual(tree.map((row) => [row.title, row.depth]), [['Notícias', 0], ['Esportes', 1], ['Futebol', 2]], 'lixeira oculta; filhos indentados');
  assert.equal(tree[0].counts.Published, 1, "artigo legado sem State conta como publicado");
  assert.equal(tree.find((row) => row.id === 3).counts.Published, 1);
  assert.equal((await admin.categories.query({ state: 'Trashed' })).length, 1);
  assert.deepEqual((await admin.categories.treeOptions({ excludeId: 2 })).map((option) => option.value), [1], 'exclui o item e seus descendentes');
  assert.equal((await admin.categories.treeOptions())[2].label, '— — Futebol');
  const cat1 = await admin.categories.get(1);
  await assert.rejects(() => admin.categories.update(1, { parentId: 3 }, { etag: cat1.etag }), /descendentes/, 'pai descendente criaria ciclo');
  await assert.rejects(() => admin.categories.update(1, { parentId: 1 }, { etag: cat1.etag }), ValidationError);
  await assert.rejects(() => admin.categories.update(1, { parentId: 77 }, { etag: cat1.etag }), /não existe/);
  repositories.categories.writes.length = 0;
  await admin.categories.update(1, { title: 'Notícias 2', state: 'Published' }, { etag: cat1.etag });
  assert.deepEqual(repositories.categories.writes.at(-1)[1], { title: 'Notícias 2' }, 'registro legado sem State não recebe a coluna ainda não provisionada');
  await admin.categories.update(1, { state: 'Unpublished' }, { etag: (await admin.categories.get(1)).etag });
  assert.equal((await admin.categories.get(1)).state, 'Unpublished');
  assert.equal((await admin.categories.batch([{ id: 1, etag: (await admin.categories.get(1)).etag }], 'delete')).failed.length, 1, 'exclusão exige lixeira');
  const trashed = await admin.categories.batch([{ id: 3, etag: (await admin.categories.get(3)).etag }], 'trash');
  assert.deepEqual(trashed.failed, []);
  const blocked = await admin.categories.batch([{ id: 3, etag: (await admin.categories.get(3)).etag }], 'delete');
  assert.match(blocked.failed[0].message, /possui artigos/, 'categoria com artigos não é excluída');
  const dup = await admin.categories.duplicate(2);
  assert.equal(dup.alias, 'esportes-2');
  await assert.rejects(() => admin.categories.create({ title: 'X', alias: 'x', state: 'Archived' }), ValidationError);
  assert.deepEqual([...descendantIds([{ id: 1, parentId: 2 }, { id: 2, parentId: 1 }], 1)].sort(), [1, 2], 'ciclo persistido não trava');
  assert.equal(treeOrder([{ id: 1, parentId: 2, title: 'a' }, { id: 2, parentId: 1, title: 'b' }]).length, 2, 'ciclo persistido continua listado');

  // 5. Tags: contagem de artigos, pai, lixeira e proteção contra ciclo.
  const tags = await admin.tags.query({});
  assert.equal(tags.find((row) => row.name === 'clima').counts.count, 3, 'artigo 1 e suas duas cópias; o artigo 2 foi excluído');
  assert.equal(tags.find((row) => row.name === 'copa').counts.count, 3);
  const child = await admin.tags.create({ name: 'copa-2026', parentId: 1, description: 'Copa' });
  assert.equal(child.parentId, 1);
  const tag1 = await admin.tags.get(1);
  await assert.rejects(() => admin.tags.update(1, { parentId: child.id }, { etag: tag1.etag }), /descendentes/);
  const tagTrash = await admin.tags.batch([{ id: child.id, etag: (await admin.tags.get(child.id)).etag }], 'trash');
  assert.deepEqual(tagTrash.failed, []);
  assert.equal((await admin.tags.query({})).some((row) => row.id === child.id), false);
  assert.equal((await admin.tags.duplicate(1)).name, 'copa (2)');

  // 6. Páginas: HTML escapado, colunas, cabeçalhos ordenáveis, filtros e ações condicionais.
  const router = new Router({ base: '' });
  const shell = ({ pageTitle, bodyHtml }) => `<h1>${pageTitle}</h1>${bodyHtml}`;
  const pages = createContentPages({ adminService: admin, documentRef: { body: {} }, router, shell, clock: () => new Date('2026-06-01T00:00:00Z') });
  const listing = await pages.render({ path: '/articles', params: { sort: 'title', dir: 'asc' } });
  assert.match(listing.html, /data-ext-select-all/);
  assert.match(listing.html, /<th scope="col" aria-sort="ascending"><a href="[^"]*dir=desc[^"]*">Título/);
  for (const label of ['Categoria', 'Autor', 'Data', 'Destaque', 'Estado', 'ID']) assert.match(listing.html, new RegExp(`>${label}`));
  for (const name of ['q', 'state', 'categoryId', 'featured', 'author', 'tag', 'language', 'limit']) assert.match(listing.html, new RegExp(`name="${name}"`));
  assert.match(listing.html, /Alias: gol/);
  assert.match(listing.html, /Gol &lt;b&gt;/);
  assert.doesNotMatch(listing.html, /Gol <b>/);
  assert.doesNotMatch(listing.html, /value="delete"/, 'excluir definitivamente só aparece na lixeira');
  assert.match(listing.html, /role="status" aria-live="polite"/);
  const trashList = await pages.render({ path: '/articles', params: { state: 'Trashed' } });
  assert.match(trashList.html, /value="delete"/);
  assert.match(trashList.html, /value="restore"/);
  const catPage = await pages.render({ path: '/categories', params: {} });
  assert.match(catPage.html, /Nível 2: /);
  assert.match(catPage.html, /state=Published/);
  const tagPage = await pages.render({ path: '/tags', params: {} });
  assert.match(tagPage.html, /tag=copa/);
  assert.equal(await pages.render({ path: '/menu', params: {} }), null, 'rotas não relacionadas seguem para o app');

  // UI actions must keep the ETag captured with the table, not refetch one at click time.
  let click, navigations = 0;
  const uiStatus = { textContent: '' };
  const button = { dataset: { extAction: 'toggle-state', extId: '1' }, disabled: false, addEventListener(name, handler) { if (name === 'click') click = handler; } };
  const uiPages = createContentPages({ adminService: admin, shell,
    router: { link: router.link.bind(router), navigate: async () => { navigations += 1; } },
    documentRef: { body: {
      querySelector: (selector) => selector === '[data-ext-status]' ? uiStatus : null,
      querySelectorAll: (selector) => selector === '[data-ext-action]' ? [button] : []
    } }
  });
  (await uiPages.render({ path: '/articles', params: {} })).bind();
  const beforeConcurrentEdit = await admin.articles.get(1);
  await admin.articles.update(1, { title: 'Alterado concorrentemente' }, { etag: beforeConcurrentEdit.etag });
  const writesAfterConcurrentEdit = repositories.articles.writes.length;
  await click({ preventDefault() {} });
  assert.match(uiStatus.textContent, /alterado por outra pessoa/);
  assert.equal(repositories.articles.writes.length, writesAfterConcurrentEdit);
  assert.equal((await admin.articles.get(1)).state, 'Published');
  assert.equal(navigations, 0, 'stale action is not presented as successful navigation');
  assert.equal(button.disabled, false);
  (await uiPages.render({ path: '/articles', params: {} })).bind();
  await click({ preventDefault() {} });
  assert.equal((await admin.articles.get(1)).state, 'Draft', 'freshly rendered row can be changed');
  assert.equal((await admin.articles.get(1)).title, 'Alterado concorrentemente');
  assert.equal(navigations, 1);

  // Booleano opcional nunca gravado chega como null e não pode bloquear a despublicação.
  const moduleRepository = fakeRepository([{ id: 1, title: 'M', extensionKey: 'articles-latest', position: 'sidebar-right', enabled: true, trashed: null, showTitle: null, settingsJson: '{}' }]);
  const moduleAdmin = createAdminService({ ...repositories, moduleInstances: moduleRepository });
  await moduleAdmin.moduleInstances.update(1, { enabled: false }, { etag: (await moduleAdmin.moduleInstances.get(1)).etag });
  assert.equal((await moduleAdmin.moduleInstances.get(1)).enabled, false);

  await obsoleteContentActionsTests(admin);

  console.log('ok - admin joomla content: lista de artigos (filtros/ordem/página), lote, lixeira, duplicar, categorias em árvore sem ciclos, tags e páginas escapadas');
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) await runAdminJoomlaContentTests();
