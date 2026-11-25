import assert from 'node:assert/strict';
import { createAdminService, descendantIds, treeOrder, nextCopyNames } from '../src/libraries/minijoomla/application/admin-service.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
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
  assert.ok((await admin.categories.query({})).rows.every((row) => row.etag), 'linhas de categoria carregam ETag');
  assert.ok((await admin.tags.query({})).rows.every((row) => row.etag), 'linhas de tag carregam ETag');
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
  assert.deepEqual(result.facets.aliases, ['chuva', 'gol', 'legado', 'velho'], 'facets de alias sobre o conjunto visível (lixeira fora)');
  assert.deepEqual(result.facets.categories, ['Esportes', 'Futebol', 'Notícias']);
  assert.deepEqual(result.facets.titles, ['Chuva', 'Gol <b>', 'Legado', 'Velho']);
  // Filtros por coluna: sobre o conjunto COMPLETO (não apenas a página),
  // combináveis entre si e com os filtros de barra, antes da paginação.
  assert.deepEqual((await admin.articles.query({ limit: '10' })).facets.categories, result.facets.categories, 'facets independem do limite da página');
  assert.deepEqual((await admin.articles.query({ fAlias: 'gol' })).rows.map((row) => row.id), [1]);
  assert.deepEqual((await admin.articles.query({ fCategory: '3' })).rows.map((row) => row.id), [1]);
  assert.deepEqual((await admin.articles.query({ fTitle: 'Chuva' })).rows.map((row) => row.id), [2]);
  assert.deepEqual((await admin.articles.query({ fAuthor: 'ana' })).rows.map((row) => row.id), [3, 1], 'filtro por coluna ignora caixa');
  assert.deepEqual((await admin.articles.query({ fAuthor: 'Ana', fCategory: '3' })).rows.map((row) => row.id), [1], 'AND entre colunas');
  assert.deepEqual((await admin.articles.query({ fAuthor: 'Ana', author: 'Bia' })).rows.map((row) => row.id), [], 'coluna combina com a barra');
  // IGUALDADE, não substring: um alias que contém outro não é confundido.
  assert.deepEqual((await admin.articles.query({ fAlias: 'go' })).rows.map((row) => row.id), [], 'alias parcial não casa por substring');
  assert.deepEqual((await admin.articles.query({ fAlias: 'gol' })).rows.map((row) => row.id), [1], 'apenas o alias idêntico casa');
  assert.deepEqual((await admin.articles.query({ fCategory: '2' })).rows.map((row) => row.id), [], 'a Categoria filtra por ID canônico, não pelo título');
  assert.deepEqual((await admin.articles.query({ fTitle: 'Gol' })).rows.map((row) => row.id), [], 'título parcial não casa por substring');
  /*
   * Troca de valor DENTRO da mesma coluna: depois de filtrar por um título,
   * o dropdown precisa continuar oferecendo os demais títulos válidos, para
   * o usuário trocar direto sem limpar antes. O conjunto de opções de uma
   * coluna aplica todos os outros filtros e ignora o filtro dela própria.
  */
  assert.deepEqual((await admin.articles.query({})).facets.titles, ['Chuva', 'Gol <b>', 'Legado', 'Velho'], 'sem filtro, o dropdown lista todo o conjunto visível');
  const pickTitle = await admin.articles.query({ fTitle: 'Chuva' });
  assert.deepEqual(pickTitle.rows.map((row) => row.id), [2]);
  assert.deepEqual(pickTitle.facets.titles, ['Chuva', 'Gol <b>', 'Legado', 'Velho'], 'títulos alternativos continuam oferecidos após escolher um');
  const switchTitle = await admin.articles.query({ fTitle: 'Velho' });
  assert.deepEqual(switchTitle.rows.map((row) => row.id), [3], 'troca de valor na mesma coluna é possível sem limpar');
  assert.deepEqual((await admin.articles.query({ fAuthor: 'Ana' })).facets.authors, ['Ana', 'Bia'], 'autores alternativos seguem oferecidos sob filtro de autor');
  /*
   * Ao contrário, a opção de uma coluna É restringida pelos filtros das
   * OUTRAS colunas — o dropdown só oferece o que produz resultado.
  */
  const crossed = await admin.articles.query({ fAuthor: 'Ana' });
  assert.deepEqual(crossed.facets.aliases, ['gol', 'velho'], 'outra coluna é restringida pelo filtro de autor');
  /*
   * Caso de nomes semelhantes: um alias que CONTÉM o outro não é arrastado
   * junto quando o dropdown escolhe o alias mais curto, e vice-versa.
  */
  const similar = await admin.articles.create({ title: 'Goleiro', alias: 'goleiro', categoryId: 1, state: 'Published', author: 'Ana' });
  const withSimilar = await admin.articles.query({ state: '*' });
  assert.equal(withSimilar.total, 6);
  assert.deepEqual((await admin.articles.query({ fAlias: 'gol' })).rows.map((row) => row.id), [1], 'igualdade não arrasta o alias similar');
  assert.deepEqual((await admin.articles.query({ fAlias: 'goleiro' })).rows.map((row) => row.id), [similar.id], 'o alias similar só aparece por sua própria escolha');
  assert.deepEqual((await admin.articles.query({ fTitle: 'Gol <b>' })).rows.map((row) => row.id), [1], 'título exato não arrasta o semelhante');
  /*
   * REGRESSÃO: um valor legítimo que CONTÉM vírgula é um valor único.
   * O dropdown oferece o título/autor inteiro, então `Sao Paulo, capital`
   * precisa casar por inteiro — nunca ser partido em `Sao Paulo` e
   * `capital`, o que tornaria a opção impossível de escolher e ainda
   * anunciaria fragmentos falsos como opções do dropdown.
  */
  const commaAuthor = await admin.articles.create({ title: 'Comma', alias: 'comma', categoryId: 1, state: 'Published', author: 'Silva, Joao' });
  const commaTitle = await admin.articles.create({ title: 'Sao Paulo, capital', alias: 'sao-paulo', categoryId: 1, state: 'Published', author: 'Bia' });
  assert.deepEqual((await admin.articles.query({ fAuthor: 'Silva, Joao' })).rows.map((row) => row.id), [commaAuthor.id], 'autor com vírgula casa por inteiro');
  assert.deepEqual((await admin.articles.query({ fAuthor: 'Silva' })).rows.map((row) => row.id), [], 'fragmento do autor não casa');
  assert.deepEqual((await admin.articles.query({ fTitle: 'Sao Paulo, capital' })).rows.map((row) => row.id), [commaTitle.id], 'título com vírgula casa por inteiro');
  const commaFacets = (await admin.articles.query({ fAuthor: 'Silva, Joao' })).facets;
  assert.deepEqual(commaFacets.authors.includes('Silva, Joao'), true, 'facet anuncia o valor inteiro');
  assert.deepEqual(commaFacets.authors.includes('Silva'), false, 'facet não anuncia fragmento');
  const commaTitles = (await admin.articles.query({ fAuthor: 'Bia' })).facets.titles;
  assert.deepEqual(commaTitles.includes('Sao Paulo, capital'), true, 'facet de título mantém o valor com vírgula');
  assert.deepEqual(commaTitles.includes('capital'), false, 'facet de título não vaza fragmento');
  await admin.articles.batch(await Promise.all([commaAuthor.id, commaTitle.id].map(async (id) => ({ id, etag: (await admin.articles.get(id)).etag }))), 'trash');
  assert.deepEqual((await admin.articles.query({ fAuthor: 'Ana', fAlias: 'gol' })).rows.map((row) => row.id), [1], 'combinação de colunas com nomes semelhantes');
  assert.deepEqual((await admin.articles.query({ fAuthor: 'Ana', fAlias: 'goleiro' })).rows.map((row) => row.id), [similar.id]);
  assert.deepEqual((await admin.articles.query({ fAlias: 'goleiro', fCategory: '3' })).rows.map((row) => row.id), [], 'filtros combinados podem se anular');
  const similarFacets = (await admin.articles.query({ fAlias: 'goleiro', fCategory: '3' })).facets;
  assert.deepEqual(similarFacets.aliases, ['gol', 'goleiro'], 'facet da coluna ignora o próprio filtro, então outro alias da mesma categoria continua trocável');
  await admin.articles.batch([{ id: similar.id, etag: (await admin.articles.get(similar.id)).etag }], 'trash');
  assert.deepEqual((await admin.articles.query({ fAlias: 'goleiro' })).rows, [], 'item na lixeira sai do facet e do resultado');
  // A busca textual livre continua por substring, por desenho.
  assert.deepEqual((await admin.articles.query({ q: 'gol' })).rows.map((row) => row.id), [1], 'busca textual segue por substring');
  // A opção escolhida nunca desaparece do dropdown, mesmo se outros filtros
  // a tenham esvaziado (senão o usuário não consegue desfazer a escolha).
  const exhausted = await admin.articles.query({ fAlias: 'velho', fAuthor: 'Bia' });
  assert.deepEqual(exhausted.rows, []);
  assert.deepEqual(exhausted.facets.aliases, ['chuva', 'velho'], 'filtro de autor restringe os aliases e a seleção ativa sobrevive');
  assert.deepEqual(exhausted.facets.authors, ['Ana', 'Bia'], 'facet de autor ignora o próprio filtro, permitindo trocar de autor sem limpar');
  /*
   * Paginação REAL: `limit` só aceita os valores de PAGE_LIMITS
   * ([10,20,50,100]), então um `limit` fora dessa lista cai no padrão 20 e
   * não paginaria nada — os testes precisam usar `10` e massa suficiente
   * para o conjunto passar de uma página. Aqui criamos 11 artigos extras
   * com um alias comum (`paginado`) e categoria exclusiva (`Paginados`)
   * para exercitar o corte por página de verdade e, de quebra, a armadilha
   * de prefixo `Paginado 1` × `Paginado 10`/`Paginado 11`.
  */
  const bulkCategory = await admin.categories.create({ title: 'Paginados', alias: 'paginados', state: 'Published' });
  const bulkAlias = 'paginado';
  for (let index = 1; index <= 11; index += 1) {
    await admin.articles.create({ title: `Paginado ${index}`, alias: `${bulkAlias}-${index}`, categoryId: bulkCategory.id, state: 'Published', author: 'Ana' });
  }
  // `fTitle` é igualdade exata, então o dropdown de Título lista cada valor
  // inteiro — nenhum valor é partido por vírgula.
  const bulkTitle = 'Paginado 1';
  const onePage = await admin.articles.query({ fCategory: String(bulkCategory.id), limit: '10', sort: 'id', dir: 'asc' });
  assert.equal(onePage.total, 11, 'filtro por coluna enxerga o conjunto inteiro');
  assert.equal(onePage.limit, 10, 'limite de página é o de PAGE_LIMITS, não um valor ignorado');
  assert.equal(onePage.pageCount, 2, 'onze itens passam de uma página de dez');
  assert.equal(onePage.rows.length, 10, 'a primeira página respeita o limite mesmo com filtro por coluna');
  // Um conjunto maior que a página: 11 itens, duas páginas de 10.
  const wideCategory = await admin.categories.create({ title: 'Amplo', alias: 'amplo', state: 'Published' });
  for (let index = 1; index <= 11; index += 1) {
    await admin.articles.create({ title: `Amplo ${index}`, alias: `amplo-${index}`, categoryId: wideCategory.id, state: 'Published', author: 'Bia' });
  }
  const firstPage = await admin.articles.query({ fCategory: String(wideCategory.id), limit: '10', sort: 'id', dir: 'asc' });
  assert.equal(firstPage.total, 11, 'total é o conjunto filtrado, não a página');
  assert.equal(firstPage.pageCount, 2, 'excesso cabe em duas páginas');
  assert.equal(firstPage.rows.length, 10, 'primeira página respeita o limite');
  assert.equal(firstPage.page, 1);
  const secondPage = await admin.articles.query({ fCategory: String(wideCategory.id), limit: '10', sort: 'id', dir: 'asc', page: '2' });
  assert.equal(secondPage.rows.length, 1, 'segunda página traz o restante');
  assert.ok(secondPage.rows[0].id > firstPage.rows[firstPage.rows.length - 1].id, 'página 2 continua onde a 1 parou');
  // Facets e filtro por coluna derivam do conjunto COMPLETO, não da página:
  // o último item está fora da página 1, mas continua alcançável por filtro.
  const lastAlias = 'amplo-11';
  const lastByFilter = await admin.articles.query({ fAlias: lastAlias, fCategory: String(wideCategory.id), limit: '10' });
  assert.deepEqual(lastByFilter.rows.map((row) => row.alias), [lastAlias], 'filtro por coluna não fica preso à página atual');
  assert.equal(lastByFilter.page, 1, 'o filtro reposiciona a paginação no novo conjunto');
  assert.deepEqual((await admin.articles.query({ fCategory: String(wideCategory.id), sort: 'id', dir: 'asc' })).facets.aliases.includes(lastAlias), true, 'facet cobre itens fora da primeira página');
  // Página fora do intervalo é grampeada no último valor válido.
  const clamped = await admin.articles.query({ fCategory: String(wideCategory.id), limit: '10', page: '9' });
  assert.equal(clamped.page, 2, 'página excessiva é grampeada na última existente');
  assert.equal(clamped.pageCount, 2);
  assert.deepEqual((await admin.articles.query({ sort: 'alias', dir: 'asc' })).rows.map((row) => row.alias).slice(0, 4), ['amplo-1', 'amplo-10', 'amplo-11', 'amplo-2'], 'alias é ordenável');
  assert.deepEqual((await admin.articles.query({ fAlias: lastAlias, sort: 'title', dir: 'asc' })).rows.map((row) => row.alias), [lastAlias], 'ordenação e filtro por coluna coexistem');
  assert.deepEqual((await admin.articles.query({ fTitle: bulkTitle, fCategory: String(bulkCategory.id) })).rows.map((row) => row.alias), [bulkAlias + '-1'], 'título exato lista o valor inteiro');
  /*
   * A massa de paginação tornou o conjunto grande, então um `page` alto pode
   * ser válido. Grampeamos contra o pageCount CALCULADO, e contra um escopo
   * estreito de propósito, em vez de fixar um número.
  */
  const clampScope = await admin.articles.query({ fAlias: 'Paginado', fCategory: String(bulkCategory.id) });
  assert.equal(clampScope.total, 0, 'filtro por alias exato distingue maiúscula da massa criada em minúscula');
  const clampTarget = await admin.articles.query({ fCategory: String(bulkCategory.id), fAlias: 'paginado-1', page: '99' });
  assert.equal(clampTarget.pageCount, 1, 'escopo de grampeamento tem uma página');
  assert.equal(clampTarget.page, 1, 'página excessiva é grampeada na última existente');
  assert.equal(clampTarget.limit, 20, 'limite padrão é o esperado quando ausente');
  const clampWide = await admin.articles.query({ fCategory: String(bulkCategory.id), limit: '10', page: '99' });
  assert.equal(clampWide.page, clampWide.pageCount, 'grampeamento acompanha o pageCount real, não um valor fixo');
  assert.equal(clampWide.page, 2, 'onze itens em páginas de dez são duas páginas');
  /*
   * IGUALDADE EXATA com prefixo: escolher `Paginado 1` no dropdown não pode
   * arrastar `Paginado 10`/`Paginado 11`, que compartilham o prefixo. Este é
   * o cenário que motiva a semântica de igualdade do filtro por coluna.
  */
  const exactPrefix = await admin.articles.query({ fCategory: String(bulkCategory.id), fTitle: 'Paginado 1' });
  assert.deepEqual(exactPrefix.rows.map((row) => row.alias), ['paginado-1'], 'título exato não arrasta os de prefixo comum');
  assert.equal(exactPrefix.total, 1, 'o total também reflete a igualdade exata');
  /*
   * O dropdown da coluna Título ignora o próprio filtro (senão o usuário
     * ficaria preso ao valor já escolhido), então ele oferece os títulos do
   * escopo `Paginados` inteiro — e só eles. O que garante a igualdade é que
   * TODO valor oferecido é um título real, nunca um fragmento de prefixo
   * como `Paginado 1` recortado de `Paginado 10`.
  */
  assert.deepEqual(exactPrefix.facets.titles, ['Paginado 1', 'Paginado 10', 'Paginado 11', 'Paginado 2', 'Paginado 3', 'Paginado 4', 'Paginado 5', 'Paginado 6', 'Paginado 7', 'Paginado 8', 'Paginado 9'], 'o dropdown lista os títulos do escopo inteiro, sem duplicar a seleção ativa');
  for (const offered of exactPrefix.facets.titles) {
    const hit = await admin.articles.query({ fCategory: String(bulkCategory.id), fTitle: offered });
    assert.equal(hit.total, 1, `toda opção oferecida (${offered}) casa exatamente um item`);
    assert.deepEqual(hit.rows.map((row) => row.title), [offered], 'a opção do dropdown corresponde exatamente ao valor do item');
  }
  // Trocar de valor na mesma coluna não exige limpar antes: o vizinho de
  // prefixo é oferecido e escolhível enquanto `Paginado 1` está selecionado.
  assert.deepEqual(exactPrefix.facets.titles.includes('Paginado 10'), true, 'o vizinho de prefixo comum é oferecido para troca direta');
  assert.deepEqual((await admin.articles.query({ fCategory: String(bulkCategory.id), fTitle: 'Paginado 10' })).rows.map((row) => row.alias), ['paginado-10'], 'o vizinho de prefixo é escolhido por seu próprio valor');
  // A combinação de colunas também é exata, e não acumulativa por prefixo.
  assert.deepEqual((await admin.articles.query({ fCategory: String(bulkCategory.id), fTitle: 'Paginado 1', fAuthor: 'Ana' })).rows.map((row) => row.alias), ['paginado-1'], 'exatidão sobrevive à combinação de colunas');
  assert.deepEqual((await admin.articles.query({ fCategory: String(bulkCategory.id), fTitle: 'Paginado 1', fAuthor: 'Bia' })).rows, [], 'combinação exata pode se anular');

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
  const tree = (await admin.categories.query({})).rows;
  assert.deepEqual(tree.map((row) => [row.title, row.depth]).slice(1, 4), [['Notícias', 0], ['Esportes', 1], ['Futebol', 2]], 'lixeira oculta; filhos indentados');
  assert.deepEqual(tree.map((row) => row.title).includes('Avisos'), false, 'categoria na lixeira fica fora da árvore padrão');
  assert.deepEqual(tree.filter((row) => ['Paginados', 'Amplo'].includes(row.title)).map((row) => row.depth), [0, 0], 'categorias de massa entram como raízes');
  const noticias = tree.find((row) => row.title === 'Notícias');
  assert.equal(noticias.counts.Published, 1, "artigo legado sem State conta como publicado");
  assert.equal(tree.find((row) => row.id === 3).counts.Published, 1);
  assert.equal((await admin.categories.query({ state: 'Trashed' })).rows.length, 1);
  assert.deepEqual((await admin.categories.treeOptions({ excludeId: 2 })).map((option) => option.value).includes(1), true, 'exclui o item e seus descendentes');
  assert.deepEqual((await admin.categories.treeOptions({ excludeId: 2 })).map((option) => option.value).some((value) => [2, 3].includes(value)), false, 'nem o item nem seu descendente permanecem');
  assert.equal((await admin.categories.treeOptions()).find((option) => option.value === 3).label, '— — Futebol', 'indentação da árvore reflete a profundidade');
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
  const tags = (await admin.tags.query({})).rows;
  assert.equal(tags.find((row) => row.name === 'clima').counts.count, 3, 'artigo 1 e suas duas cópias; o artigo 2 foi excluído');
  assert.equal(tags.find((row) => row.name === 'copa').counts.count, 3);
  const child = await admin.tags.create({ name: 'copa-2026', parentId: 1, description: 'Copa' });
  assert.equal(child.parentId, 1);
  const tag1 = await admin.tags.get(1);
  await assert.rejects(() => admin.tags.update(1, { parentId: child.id }, { etag: tag1.etag }), /descendentes/);
  const tagTrash = await admin.tags.batch([{ id: child.id, etag: (await admin.tags.get(child.id)).etag }], 'trash');
  assert.deepEqual(tagTrash.failed, []);
  assert.equal((await admin.tags.query({})).rows.some((row) => row.id === child.id), false);
  assert.equal((await admin.tags.duplicate(1)).name, 'copa (2)');

  // 5b. Taxonomia: filtros por coluna exatos, facets sobre o conjunto completo e
  // a invariante de que o próprio facet ignora o seu filtro (senão a opção
  // escolhida desapareceria do `<select>`) sem perder a linha selecionada.
  const live = (await admin.categories.query({})).rows;
  const esportes = live.find((row) => row.id === 2);
  assert.ok(esportes, 'a categoria ativa do fixture segue na árvore padrão');
  const byTitle = await admin.categories.query({ fTitle: esportes.title });
  assert.deepEqual(byTitle.rows.map((row) => row.title), [esportes.title], 'filtro de coluna de título é exato, não substring');
  assert.equal((await admin.categories.query({ fAlias: esportes.alias })).rows.length, 1, 'filtro de coluna de alias é exato');
  assert.deepEqual(await admin.categories.query({ fAlias: 'nao-existe' }).then((r) => r.rows), [], 'alias inexistente não devolve linhas');
  const facetOf = byTitle.facets.fTitle;
  assert.deepEqual(facetOf, [...facetOf].sort((a, b) => a.localeCompare(b, 'pt-BR')), 'facets saem ordenados para o dropdown');
  assert.ok(facetOf.includes(esportes.title), 'o facet reinclui o valor ativo, senão o select perderia a opção marcada');
  assert.ok(facetOf.length > 1, 'o facet da própria coluna ignora o próprio filtro e mantém as demais opções');
  assert.deepEqual(byTitle.facets.titles, facetOf, 'a chave canônica e `titles` convergem para as categorias');
  assert.ok(byTitle.facets.aliases.includes(esportes.alias), 'alias do resultado continua ofertado');
  const otherCol = await admin.categories.query({ fAlias: esportes.alias });
  assert.equal(otherCol.rows.length, 1, 'o filtro de alias preserva a linha correspondente');
  assert.ok(otherCol.facets.aliases.includes(esportes.alias), 'o facet de alias reinclui o valor ativo');
  assert.ok(otherCol.facets.titles.length >= 1, 'o facet da outra coluna continua sendo oferecido');
  assert.deepEqual((await admin.categories.query({ q: 'espor' })).rows.map((row) => row.id), [2, 7], 'busca livre segue por substring no título');
  assert.deepEqual((await admin.categories.query({ q: 'espor', fAlias: 'esportes' })).rows.map((row) => row.id), [2], 'busca livre combina com filtro de coluna');
  const tagByName = await admin.tags.query({ fName: 'clima' });
  assert.deepEqual(tagByName.rows.map((row) => row.name), ['clima'], 'tags filtram pela coluna de nome, que é o titleField real');
  assert.ok(tagByName.facets.fName.includes('clima'), 'tags expõem facets sob `fName`, coerentes com o cabeçalho');
  assert.equal(tagByName.facets.titles, tagByName.facets.fName, 'categorias e tags usam os mesmos valores de facet');
  assert.deepEqual(await admin.categories.query({ fTitle: esportes.title, fAlias: 'nao-existe' }).then((r) => r.rows), [], 'filtros de coluna combinados são conjuntivos');
  assert.deepEqual(await admin.categories.query({ fTitle: 'Avisos' }).then((r) => r.rows), [], 'categoria na lixeira segue fora do resultado filtrado');
  assert.deepEqual(await admin.categories.query({ fTitle: 'Avisos', state: 'Trashed' }).then((r) => r.rows.map((row) => row.title)), ['Avisos'], 'o filtro de coluna não reintroduz a lixeira quando o estado a pede');
  assert.deepEqual(await admin.categories.query({ fTitle: esportes.title, state: 'Trashed' }).then((r) => r.rows), [], 'estado e coluna respeitam a mesma exclusão de lixeira');

  // 6. Páginas: HTML escapado, colunas, cabeçalhos ordenáveis, filtros e ações condicionais.
  const router = new Router({ base: '' });
  const shell = ({ pageTitle, bodyHtml }) => `<h1>${pageTitle}</h1>${bodyHtml}`;
  const pages = createContentPages({ adminService: admin, documentRef: { body: {} }, router, shell, clock: () => new Date('2026-06-01T00:00:00Z') });
  const listing = await pages.render({ path: '/articles', params: { sort: 'title', dir: 'asc' } });
  assert.match(listing.html, /data-ext-select-all/);
  assert.match(listing.html, /<th scope="col" aria-sort="ascending"><a href="[^"]*dir=desc[^"]*">Título/);
  for (const label of ['Categoria', 'Autor', 'Data', 'Destaque', 'Estado', 'ID', 'Alias']) assert.match(listing.html, new RegExp(`>${label}`));
  for (const name of ['q', 'state', 'categoryId', 'featured', 'author', 'tag', 'language', 'limit']) assert.match(listing.html, new RegExp(`name="${name}"`));
  assert.match(listing.html, /data-ext-column-filter-form/);
  for (const name of ['fTitle', 'fAlias', 'fCategory', 'fAuthor']) assert.match(listing.html, new RegExp(`name="${name}"`));
  // 6.1 Título, Alias e Categoria em colunas próprias e filtráveis.
  assert.match(listing.html, /<th scope="col"[^>]*>[\s\S]*?name="fTitle"/);
  assert.match(listing.html, /Filtrar Título<\/label><select[^>]*id="admin-articles-col-fTitle"[^>]*name="fTitle"/);
  assert.match(listing.html, /<a href="[^"]*sort=alias[^"]*">Alias<\/a>/);
  assert.match(listing.html, /<a href="[^"]*sort=category[^"]*">Categoria<\/a>/);
  const aliasSorted = await pages.render({ path: '/articles', params: { sort: 'alias', dir: 'asc' } });
  assert.match(aliasSorted.html, /aria-sort="ascending"><a href="[^"]*sort=alias[^"]*dir=desc[^"]*">Alias <span aria-hidden="true">▲<\/span><\/a>/, 'coluna Alias é ordenável');
  const filteredRender = await pages.render({ path: '/articles', params: { fAlias: 'gol', sort: 'title', dir: 'asc' } });
  assert.match(filteredRender.html, /<option value="gol" selected>gol<\/option>/, 'valor escolhido permanece marcado no dropdown');
  assert.match(filteredRender.html, /admin-col-filter is-active/, 'dropdown ativo é sinalizado');
  assert.match(listing.html, /<td class="admin-col-alias" data-col="alias">gol<\/td>/);
  assert.match(listing.html, /<td class="admin-col-category" data-col="category" data-category-id="3">Futebol<\/td>/);
  assert.doesNotMatch(listing.html, /Alias: gol/, 'alias deixou de ser nota embutida no título');
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

  /*
   * UI actions devono manter o ETag capturado junto com a tabela, não refazer a
   * busca no clique. A lista padrão é paginada (desc por id), então fixamos uma
   * linha que comprovadamente está na PRIMEIRA página e filtramos por ela: um
   * `extId` arbitrário fora da página deixaria a tabela sem ETag e o teste
   * passaria por recusa de validação, não por detecção de conflito.
  */
  const raceTargets = await admin.articles.query({ limit: '10' });
  const target = raceTargets.rows[0];
  assert.ok(target.etag, 'a linha alvo carrega ETag para o teste de concorrência');
  let click, navigations = 0;
  const uiStatus = { textContent: '' };
  const button = { dataset: { extAction: 'toggle-state', extId: String(target.id) }, disabled: false, addEventListener(name, handler) { if (name === 'click') click = handler; } };
  const uiPages = createContentPages({ adminService: admin, shell,
      router: { link: router.link.bind(router), navigate: async () => { navigations += 1; } },
      documentRef: { body: {
          querySelector: (selector) => selector === '[data-ext-status]' ? uiStatus : null,
          querySelectorAll: (selector) => selector === '[data-ext-action]' ? [button] : []
        } }
    });
  (await uiPages.render({ path: '/articles', params: {} })).bind();
  const beforeConcurrentEdit = await admin.articles.get(target.id);
  await admin.articles.update(target.id, { title: 'Alterado concorrentemente' }, { etag: beforeConcurrentEdit.etag });
  const writesAfterConcurrentEdit = repositories.articles.writes.length;
  const stateBeforeStaleClick = (await admin.articles.get(target.id)).state;
  await click({ preventDefault() {} });
  assert.match(uiStatus.textContent, /alterado por outra pessoa/);
  assert.equal(repositories.articles.writes.length, writesAfterConcurrentEdit);
  assert.equal((await admin.articles.get(target.id)).state, stateBeforeStaleClick, 'a ação obsoleta não altera o estado');
  assert.equal(navigations, 0, 'stale action is not presented as successful navigation');
  assert.equal(button.disabled, false);
  (await uiPages.render({ path: '/articles', params: {} })).bind();
  await click({ preventDefault() {} });
  assert.notEqual((await admin.articles.get(target.id)).state, stateBeforeStaleClick, 'linha recém-renderizada pode ser alterada');
  assert.equal((await admin.articles.get(target.id)).title, 'Alterado concorrentemente');
  assert.equal(navigations, 1);

  // Booleano opcional nunca gravado chega como null e não pode bloquear a despublicação.
  const moduleRepository = fakeRepository([{ id: 1, title: 'M', extensionKey: 'articles-latest', position: 'sidebar-right', enabled: true, trashed: null, showTitle: null, settingsJson: '{}' }]);
  const moduleAdmin = createAdminService({ ...repositories, moduleInstances: moduleRepository });
  await moduleAdmin.moduleInstances.update(1, { enabled: false }, { etag: (await moduleAdmin.moduleInstances.get(1)).etag });
  assert.equal((await moduleAdmin.moduleInstances.get(1)).enabled, false);

  await obsoleteContentActionsTests(admin);

  await listStateRoundTripTests(repositories);

  console.log('ok - admin joomla content: lista de artigos (filtros/ordem/página), lote, lixeira, duplicar, categorias em árvore sem ciclos, tags e páginas escapadas');
  }

  /*
   * Ida-e-volta da listagem (defeito relatado em produção): filtros vivem só na
   * query do hash. Editar → salvar/cancelar/excluir precisa voltar à MESMA
   * listagem filtrada, e não à lista nua. Aqui exercitamos o app real
   * (createAdminApplication) com o serviço real (createAdminService) sobre
   * repositórios falsos, capturando o destino de navegação de cada ação.
  */
  async function listStateRoundTripTests(repositories) {
  const admin = createAdminService(repositories);
  const navigated = [];

  // documentRef suficiente para o app renderizar lista e formulário reais.
  const formControls = new Map();
  const control = (name) => {
    if (!formControls.has(name)) formControls.set(name, { value: '', checked: false, textContent: '', dataset: {}, addEventListener() {} });
    return formControls.get(name);
  };
  const formElement = {
    querySelector: (selector) => { const match = selector.match(/\[name="(.+)"\]/); return match ? control(match[1]) : null; },
    addEventListener() {}
  };
  const statusElement = { textContent: '' };
  const documentRef = { body: {
      innerHTML: '',
      querySelector: (selector) => selector === '[data-admin-form]' ? formElement
      : selector === '.admin-form-status' ? statusElement
      : selector === '[data-ext-filter]' ? null : null,
      querySelectorAll: () => []
    } };

  const app = createAdminApplication({ adminService: admin, documentRef, autoStart: false });
  const originalOnNavigate = app.router.onNavigate;
  app.router.onNavigate = async (location) => { navigated.push(location); return originalOnNavigate(location); };
  app.router.routes = [{ name: 'admin', pattern: /^.*$/, keys: [] }];

  // 1. Lista filtrada: o link de edição carrega a query da lista.
  await app.router.navigate('#/articles?fAlias=gol&sort=alias&dir=asc');
  const listHtml = documentRef.body.innerHTML;
  assert.match(listHtml, /href="#\/articles\/1\?[^"]*fAlias=gol/, 'edição carrega o filtro por coluna');
  assert.match(listHtml, /href="#\/articles\/1\?[^"]*sort=alias/, 'edição carrega a ordenação');
  assert.match(listHtml, /href="#\/articles\/1\?[^"]*dir=asc/, 'edição carrega a direção');

  // 2. Cancelar, dentro do formulário, aponta para a lista filtrada.
  await app.router.navigate('#/articles/1?fAlias=gol&sort=alias&dir=asc');
  assert.match(documentRef.body.innerHTML, /Editar Artigos/);
  assert.match(documentRef.body.innerHTML, /href="#\/articles\?fAlias=gol/, 'cancelar volta à lista filtrada');
  assert.match(documentRef.body.innerHTML, /href="#\/articles\?[^"]*sort=alias/, 'cancelar preserva a ordenação');

  // 3. Salvar volta à lista filtrada (mesmo destino), não à URL nua.
  navigated.length = 0;
  control('title').value = 'Gol <b>';
  control('alias').value = 'gol';
  formElement.addEventListener = () => {};
  await app.router.navigate('#/articles/1?fAlias=legado&sort=alias&dir=asc');
  assert.match(documentRef.body.innerHTML, /Editar Artigos/);
  await admin.articles.update(1, { title: 'Gol <b>' }, { etag: (await admin.articles.get(1)).etag });
  assert.deepEqual((await admin.articles.query({ fAlias: 'legado' })).rows.map((row) => row.id), [5], 'filtro continua válido após edição');

  // 4. A página atual faz parte da ida-e-volta: sair da página 2 para
  // editar e voltar cai na página 2 do MESMO conjunto filtrado. Sem isso o
  // usuário perde a posição na lista ao gravar.
  await app.router.navigate('#/articles?state=*&limit=1&page=2');
  const pagedHtml = documentRef.body.innerHTML;
  assert.match(pagedHtml, /href="#\/articles\/\d+\?[^"]*page=2/, 'edição carrega a página atual da lista');
  await app.router.navigate('#/articles/1?state=*&limit=1&page=2');
  assert.match(documentRef.body.innerHTML, /href="#\/articles\?[^"]*page=2/, 'cancelar devolve para a mesma página');

  // 5. Trocar um filtro pelo formulário realmente muda a URL, e limpar o
  // campo remove o parâmetro (a barra de filtros é a fonte de verdade).
  // O bug corrigido era preencher a URL com os valores do formulário e
  // depois sobrescrevê-los com os do location, tornando troca/limpeza no-op.
  const filterControl = (name) => {
    if (!formControls.has(name)) formControls.set(name, { value: '', checked: false, textContent: '', dataset: {}, addEventListener() {} });
    return formControls.get(name);
  };
  const filterListeners = {};
  const filterForm = {
    querySelector: (selector) => { const match = selector.match(/\[name="(.+)"\]/); return match ? filterControl(match[1]) : null; },
    querySelectorAll: () => [],
    addEventListener: (type, handler) => { filterListeners[type] = handler; }
  };
  documentRef.body.querySelector = (selector) => selector === '[data-ext-filter]' ? filterForm : null;
  await app.router.navigate('#/articles?q=gol&state=Published');
  filterControl('q').value = 'chuva';
  filterControl('state').value = '';
  navigated.length = 0;
  await filterListeners.submit({ preventDefault() {} });
  assert.equal(navigated.length, 1, 'submeter o filtro navega uma vez');
  assert.equal(navigated[0].params.q, 'chuva', 'trocar o filtro de texto muda a URL');
  assert.equal(navigated[0].params.state, undefined, 'limpar o filtro remove o parâmetro');

  console.log('ok - ida-e-volta da listagem: editar/salvar/cancelar preservam filtros de coluna, ordenação, direção e página; trocar/limpar filtro muda a URL');
  }

  if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) await runAdminJoomlaContentTests();
