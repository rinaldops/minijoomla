import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { runAdminManagementTests } from './admin-management.test.js';

/*
 * Fake repository compatível com a mesma interface de
 * createRepository (SPMIDDLE data-core): findMany/findById/create/
 * update/delete, com um contador de ETag simples (igual ao transporte em
 * memória de tests/spmiddle-integration.test.js), usado aqui para testar
 * admin-service.js isoladamente da composição real completa.
 */
function createFakeRepository(seed = []) {
  const items = new Map(seed.map((item) => [item.id, { ...item }]));
  let nextId = Math.max(0, ...seed.map((item) => item.id)) + 1;
  let nextVersion = 1;
  return {
    // Achado real (contra o tenant real): createRepository.findMany() do
    // SPMIDDLE NUNCA anexa etag aos itens (só findById/create/update
    // fazem isso — ver result() em packages/data-core/src/repository.js).
    // Este fake precisa reproduzir essa omissão, senão mascara qualquer
    // código de produção (admin-service.js, src/administrator/components/com_minijoomla/app.js) que dependa
    // incorretamente de list()[i].etag.
    async findMany() { return { items: [...items.values()].map(({ etag, ...rest }) => ({ ...rest })) }; },
    async findById(id) { const item = items.get(id); if (!item) throw Object.assign(new Error('not found'), { code: 'not-found', status: 404 }); return { ...item }; },
    async create(input) { const id = nextId++; const etag = `"${nextVersion++}"`; const item = { id, etag, ...input }; items.set(id, item); return { ...item }; },
    async update(id, input, { etag } = {}) { const item = items.get(id); if (!item) throw Object.assign(new Error('not found'), { code: 'not-found', status: 404 }); if (etag !== item.etag) throw Object.assign(new Error('etag mismatch'), { code: 'concurrency-conflict', status: 412 }); const updated = { ...item, ...input, etag: `"${nextVersion++}"` }; items.set(id, updated); return null; },
    async delete(id, { etag } = {}) { const item = items.get(id); if (!item) throw Object.assign(new Error('not found'), { code: 'not-found', status: 404 }); if (etag !== item.etag) throw Object.assign(new Error('etag mismatch'), { code: 'concurrency-conflict', status: 412 }); items.delete(id); }
  };
}

export async function runAdminServiceTests() {
  await runAdminManagementTests();
  const repositories = {
    articles: createFakeRepository([{ id: 1, etag: '"1"', title: 'Artigo', alias: 'artigo', introtext: '', fulltext: '', categoryId: 10, state: 'Published', featured: false, publishUp: null, publishDown: null, author: '', authorAlias: '', language: '', note: '', versionNote: '', featuredUp: null, featuredDown: null, metaDescription: '', metaKeywords: '', attribsJson: '', tags: '' }]),
    categories: createFakeRepository([{ id: 10, etag: '"1"', title: 'Notícias', alias: 'noticias', parentId: null, description: '' }]),
    tags: createFakeRepository([]),
    menu: createFakeRepository([]),
    extensions: createFakeRepository([]),
    moduleInstances: createFakeRepository([]),
    siteConfig: createFakeRepository([])
  };
  const admin = createAdminService(repositories);

  // 1. CRUD genérico: create/list/update (com conflito de ETag real)/delete, para o domínio "articles" como representante.
  const created = await admin.articles.create({ title: 'Novo', alias: 'novo' });
  assert.equal(created.title, 'Novo');
  assert.equal((await admin.articles.list()).length, 2);
  await assert.rejects(() => admin.articles.update(created.id, { title: 'x' }, { etag: '"errada"' }), (error) => error.code === 'concurrency-conflict');
  await admin.articles.update(created.id, { title: 'Atualizado' }, { etag: created.etag });
  assert.equal((await admin.articles.get(created.id)).title, 'Atualizado');
  await admin.articles.update(created.id, { state: 'Trashed' }, { etag: (await admin.articles.get(created.id)).etag }); // exclusão definitiva exige lixeira
  const refreshed = await admin.articles.get(created.id);
  await admin.articles.remove(created.id, { etag: refreshed.etag });
  assert.equal((await admin.articles.list()).length, 1);

  // 2. Validação de forma rejeita entrada inválida antes de tocar o repositório (title ausente).
  await assert.rejects(() => admin.articles.create({ alias: 'sem-titulo' }), ValidationError);
  await assert.rejects(() => admin.articles.update(1, { title: 'x' }, {}), ValidationError); // etag ausente
  await assert.rejects(() => admin.extensions.create({ title: 'Ruim', key: 'ruim', type: 'Component', entryPointUrl: 'x.js' }), ValidationError); // type inválido

  // 2b. Campos editoriais opcionais (Fase 4): normaliza strings e datas, preservando vazio como ''/null.
  const createdEditorial = await admin.articles.create({
    title: 'Editorial',
    alias: 'editorial',
    note: 'nota',
    versionNote: 'v1',
    authorAlias: 'apelido',
    language: 'pt-BR',
    featuredUp: '2026-03-01T00:00',
    featuredDown: '',
    metaDescription: 'desc',
    metaKeywords: 'a, b',
    attribsJson: { show_title: 1 }
  });
  assert.equal(createdEditorial.note, 'nota');
  assert.equal(createdEditorial.versionNote, 'v1');
  assert.equal(createdEditorial.authorAlias, 'apelido');
  assert.equal(createdEditorial.language, 'pt-BR');
  assert.equal(createdEditorial.featuredUp, '2026-03-01T00:00');
  assert.equal(createdEditorial.featuredDown, null);
  assert.equal(createdEditorial.metaDescription, 'desc');
  assert.equal(createdEditorial.metaKeywords, 'a, b');
  assert.equal(createdEditorial.attribsJson, JSON.stringify({ show_title: 1 }));

  // 2c. attribsJson: string JSON válido vira string normalizada; JSON inválido é rejeitado.
  const createdAttribsString = await admin.articles.create({ title: 'A2', alias: 'a2', attribsJson: '{"x":1}' });
  assert.equal(createdAttribsString.attribsJson, '{"x":1}');
  await assert.rejects(() => admin.articles.create({ title: 'A3', alias: 'a3', attribsJson: '{invalid' }), ValidationError);
  await assert.rejects(() => admin.articles.create({ title: 'A4', alias: 'a4', attribsJson: '123' }), ValidationError);

  // 3. Instâncias de módulo: settings (objeto) é serializado para settingsJson; scopeRoute desconhecida é rejeitada.
  const instance = await admin.moduleInstances.create({
    title: 'Artigos recentes (home)', extensionKey: 'articles-latest', position: 'sidebar',
    settings: { limit: 3 }, scopeKind: 'Route', scopeRoute: 'home'
  });
  assert.equal(instance.settingsJson, JSON.stringify({ limit: 3 }));
  await assert.rejects(() => admin.moduleInstances.create({ title: 'x', extensionKey: 'y', position: 'sidebar', scopeKind: 'Route', scopeRoute: 'rota-inexistente' }), ValidationError);

  // 4. Configuração do site: primeira chamada cria (lista vazia), segunda exige etag e atualiza a linha única existente.
  assert.equal(await admin.siteConfig.get(), null);
  const savedConfig = await admin.siteConfig.save({ siteName: 'Site de teste', pageSize: 7 });
  assert.equal(savedConfig.siteName, 'Site de teste');
  await assert.rejects(() => admin.siteConfig.save({ siteName: 'Outro' }), ValidationError); // etag ausente na 2ª chamada
  await admin.siteConfig.save({ siteName: 'Site atualizado' }, { etag: savedConfig.etag });
  assert.equal((await admin.siteConfig.get()).siteName, 'Site atualizado');
  assert.deepEqual(admin.siteConfig.toConfigOverrides(null), {});
  assert.deepEqual(admin.siteConfig.toConfigOverrides({ siteName: 'X', customHtmlBody: '<p>Y</p>', customHtmlTitle: 'Aviso' }).customHtml, { title: 'Aviso', html: '<p>Y</p>' });
  assert.equal(admin.siteConfig.toConfigOverrides({ siteName: 'X', customHtmlBody: '' }).customHtml, undefined);

  // 5. overview() agrega contagens reais de cada domínio.
  const overview = await admin.overview();
  assert.equal(overview.articles, 3); // 1 original + 'Editorial' (2b) + 'A2' (2c); A3/A4 falham na validacao antes de persistir
  assert.equal(overview.categories, 1);
  assert.equal(overview.moduleInstances, 1);

  // 6. repositório ausente na composição produz ValidationError, não um TypeError cru.
  const partialAdmin = createAdminService({ articles: repositories.articles });
  await assert.rejects(() => partialAdmin.categories.list(), ValidationError);

  console.log('ok - admin service: CRUD genérico com validação de forma e conflito de ETag real');
  console.log('ok - admin service: instâncias de módulo serializam settings e validam escopo');
  console.log('ok - admin service: configuração do site como upsert de linha única com etag');
  console.log('ok - admin service: overview agrega contagens e repositório ausente produz ValidationError');
  console.log('admin service: 4 testes aprovados');
}
