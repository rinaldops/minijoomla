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

async function runJsonObjectAdminTests() {
  // Exercise the public local service, without importing SPMIDDLE/composition.
  const writes = [];
  const repositories = Object.fromEntries(['extensions', 'moduleInstances'].map((domain) => {
    const repo = createFakeRepository();
    for (const operation of ['create', 'update', 'delete']) {
      const original = repo[operation];
      repo[operation] = (...args) => { writes.push(`${domain}.${operation}`); return original(...args); };
    }
    return [domain, repo];
  }));
  const snapshot = async () => Object.fromEntries(await Promise.all(Object.entries(repositories).map(async ([domain, repo]) =>
    [domain, await Promise.all((await repo.findMany()).items.map((row) => repo.findById(row.id)))])));
  const admin = createAdminService(repositories);
  const moduleInput = { title: 'JSON data', extensionKey: 'articles-latest', position: 'footer' };
  const pluginInput = { title: 'JSON params', key: 'json-params', type: 'Plugin', entryPointUrl: '/json-params.js' };
  const exact = '  {"limit":"4","unknown":{"values":[null,false,42,"",{"constructor":{"prototype":{"keep":true}}}]},"__proto__":{"keep":[1,false]},"toJSON":"data"}\n';
  const expected = JSON.stringify(JSON.parse(exact));
  const settings = Object.assign(Object.create(null), JSON.parse(exact));
  const instance = await admin.moduleInstances.create({ ...moduleInput, settings });
  const plugin = await admin.extensions.create({ ...pluginInput, params: settings });
  assert.equal(instance.settingsJson, expected);
  assert.equal(plugin.paramsJson, expected);
  assert.equal(JSON.parse(instance.settingsJson).limit, '4', 'coercion validates but does not rewrite direct-create wire values');
  assert.equal(Object.hasOwn(JSON.parse(instance.settingsJson), 'moduleClass'), false, 'validation defaults are not persisted');
  assert.ok(Object.hasOwn(JSON.parse(instance.settingsJson), '__proto__'));
  assert.equal(Object.getPrototypeOf(settings), null);
  assert.equal(JSON.stringify(settings), expected, 'serialization does not mutate the caller data');
  assert.equal({}.keep, undefined);
  assert.equal(settings.limit, '4');
  await admin.moduleInstances.update(instance.id, { settingsJson: exact }, { etag: instance.etag });
  const current = await admin.moduleInstances.get(instance.id);
  assert.equal(current.settingsJson, expected, 'explicit JSON saves retain the historical canonical serialization');
  assert.notEqual(current.etag, instance.etag);

  let executions = 0;
  const getter = Object.defineProperty({}, 'value', { enumerable: true, get() { executions += 1; return 'data'; } });
  const hookGetter = Object.defineProperty({}, 'toJSON', { get() { executions += 1; return () => ({}); } });
  const hook = { toJSON() { executions += 1; return {}; } };
  const dropHook = { toJSON() { executions += 1; return undefined; } };
  const cycle = {}; cycle.self = cycle;
  const hidden = Object.defineProperty({}, 'value', { value: 1 });
  const extraArray = [1]; extraArray.extra = true;
  let deep = {}; for (let index = 0; index < 33; index += 1) deep = { nested: deep };
  const invalid = [
    getter, hookGetter, hook, dropHook, { unknown: getter }, { unknown: hook }, cycle,
    { limit: undefined }, { unknown: undefined }, { unknown: { nested: undefined } },
    { unknown: [undefined] }, { unknown: Number.NaN }, { unknown: Infinity },
    { unknown: 1n }, { unknown() {} }, { unknown: Symbol('data') },
    { [Symbol('key')]: true }, hidden, { unknown: new Date(0) },
    { unknown: Object.create({ inherited: true }) }, { unknown: new Array(1) },
    { unknown: extraArray }, deep, { unknown: Array(50000).fill(null) }
  ];
  const before = await snapshot();
  const writeCount = writes.length;
  for (const value of invalid) {
    for (const operation of [
      () => admin.moduleInstances.create({ ...moduleInput, settings: value }),
      () => admin.moduleInstances.update(instance.id, { settings: value }, { etag: current.etag }),
      () => admin.extensions.create({ ...pluginInput, key: 'invalid-params', params: value }),
      () => admin.extensions.update(plugin.id, { params: value }, { etag: plugin.etag })
    ]) {
      await assert.rejects(operation, ValidationError);
      assert.equal(writes.length, writeCount, 'invalid data never reaches a repository write');
      assert.deepEqual(await snapshot(), before, 'invalid data preserves every row and ETag');
      assert.equal(executions, 0, 'serialization never executes getters or toJSON');
    }
  }
  for (const value of ['{broken', '[]', 'null', '42', 'true', '"text"', '{"unknown":1e400}']) {
    await assert.rejects(() => admin.moduleInstances.create({ ...moduleInput, settingsJson: value }), ValidationError);
    await assert.rejects(() => admin.moduleInstances.update(instance.id, { settingsJson: value }, { etag: current.etag }), ValidationError);
    await assert.rejects(() => admin.extensions.create({ ...pluginInput, key: 'invalid-params', params: value }), ValidationError);
    assert.equal(writes.length, writeCount);
    assert.deepEqual(await snapshot(), before);
  }
  for (const settingsJson of [undefined, null, '']) {
    const legacy = await admin.moduleInstances.create({ ...moduleInput, settingsJson });
    assert.equal(legacy.settingsJson, settingsJson === undefined ? undefined : '');
  }
  const cleared = await admin.moduleInstances.create({ ...moduleInput, settings: null });
  assert.equal(cleared.settingsJson, '', 'explicit historical null settings remain supported');
  console.log('ok - admin service: strict data-only JSON serialization rejects hooks/cycles/undefined before writes and preserves wire values/unknown own data');
}

export async function runAdminServiceTests() {
  await runJsonObjectAdminTests();
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
  console.log('admin service: cenários locais aprovados');
}
