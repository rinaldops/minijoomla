/*
 * Contratos locais das oito entidades: schemas/mappings reais do consumidor,
 * registry/list client/mapper/repository/provisioner reais do SPMIDDLE.
 * Só request() é fake; não há rede, browser, publicação de assets ou tenant.
 */
import assert from 'node:assert/strict';
import { createProvisioningManager } from '../../SPMIDDLE/packages/sharepoint-provisioning/src/index.js';
import { createMiniJoomlaSharePointApp } from '../src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { MINIJOOMLA_SCHEMAS } from '../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';
import { MINIJOOMLA_FIELD_MAPPINGS } from '../src/libraries/minijoomla/infrastructure/spmiddle-repositories.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { createSchemaMemoryTransport } from './schema-migration.test.js';

const WEB_URL = '/sites/minijoomla-entity-contracts-local';
const NOW = new Date('2026-11-03T12:00:00Z');
const clone = (value) => JSON.parse(JSON.stringify(value));
const isConflict = (error) => error.status === 412 && error.code === 'concurrency-conflict';

// Nomes esperados independentes do mapping sob teste; ordem corresponde a
// Object.entries(input). Cobre todos os campos graváveis, inclusive Author0.
const FIXTURES = {
  articles: {
    input: { title: 'Artigo local', alias: 'artigo-local', introtext: 'Resumo', fulltext: '<p>Texto</p>', categoryId: 1, state: 'Published', featured: false, publishUp: '2026-01-01T00:00:00Z', publishDown: null, author: 'Equipe sintética', authorAlias: 'equipe', language: 'pt-BR', note: 'Nota', versionNote: 'Revisão local', featuredUp: null, featuredDown: null, metaDescription: 'Descrição', metaKeywords: 'local, teste', attribsJson: '{"show_title":1}', tags: 'local, teste' },
    names: 'Title Alias Introtext Fulltext CategoryId State Featured PublishUp PublishDown Author0 AuthorAlias Language Note VersionNote FeaturedUp FeaturedDown MetaDescription MetaKeywords AttribsJson Tags',
    added: 'AuthorAlias Language Note VersionNote FeaturedUp FeaturedDown MetaDescription MetaKeywords AttribsJson', clear: 'publishDown', readOnly: ['created', 'modified']
  },
  categories: {
    input: { title: 'Categoria local', alias: 'categoria-local', parentId: null, description: 'Descrição', state: 'Unpublished' },
    names: 'Title Alias ParentId Description State', added: 'State', clear: 'parentId'
  },
  tags: {
    input: { name: 'local', alias: 'local', state: 'Published', description: 'Tag local', parentId: null },
    names: 'Title Alias State Description ParentId', added: 'Description ParentId', clear: 'alias'
  },
  menu: {
    input: { title: 'Menu local', path: '/article/artigo-local', parentId: null, published: 'Published', ordering: 0 },
    names: 'Title Path ParentId Published Ordering', added: '', clear: 'parentId'
  },
  extensions: {
    input: { title: 'Plugin local', key: 'local-plugin', type: 'Plugin', entryPointUrl: 'extensions/local-plugin/index.js', discoveredFrom: 'local-plugin/manifest.json', enabled: false, ordering: 3, folder: 'content', paramsJson: '{"active":false}', manifestJson: '{"version":"1.0.0","params":[]}' },
    names: 'Title Key Type EntryPointUrl DiscoveredFrom Enabled Ordering Folder ParamsJson ManifestJson',
    added: 'Ordering Folder ParamsJson ManifestJson', clear: 'paramsJson'
  },
  moduleInstances: {
    input: { title: 'Módulo local', extensionKey: 'articles-latest', position: 'sidebar', ordering: 0, settingsJson: '{"limit":3}', enabled: true, scopeKind: 'All', scopeRoute: '', scopeCategoryAlias: '', showTitle: false, publishUp: '2026-01-01T00:00:00.000Z', publishDown: '2027-01-01T00:00:00.000Z', trashed: true, assignment: 'only', assignmentJson: '["route:home"]', note: 'Nota local' },
    names: 'Title ExtensionKey Position Ordering SettingsJson Enabled ScopeKind ScopeRoute ScopeCategoryAlias ShowTitle PublishUp PublishDown Trashed Assignment AssignmentJson Note',
    added: 'ShowTitle PublishUp PublishDown Trashed Assignment AssignmentJson Note', clear: 'publishDown'
  },
  siteConfig: {
    input: { title: 'MiniJoomlaSiteConfig', siteName: 'Site local', templateKey: 'cassiopeia', siteDescription: 'Descrição local', language: 'pt-BR', timezone: 'America/Sao_Paulo', basePath: '', pageSize: 7, customHtmlTitle: 'Aviso', customHtmlBody: '<p>Local</p>', offline: true, offlineMessage: 'Indisponível', metaDescription: 'Descrição', metaKeywords: 'local', robots: 'noindex, nofollow', sitenamePagetitles: 'after', homeView: 'featured', homeCategory: 'categoria-local', templateStylesJson: '[{"id":"local-style","template":"local-template","title":"Local","home":true,"params":{}}]', componentParamsJson: '{"com_content":{"show_author":false}}' },
    names: 'Title SiteName TemplateKey SiteDescription Language Timezone BasePath PageSize CustomHtmlTitle CustomHtmlBody Offline OfflineMessage MetaDescription MetaKeywords Robots SitenamePagetitles HomeView HomeCategory TemplateStylesJson ComponentParamsJson',
    added: 'Offline OfflineMessage MetaDescription MetaKeywords Robots SitenamePagetitles HomeView HomeCategory TemplateStylesJson ComponentParamsJson', clear: 'customHtmlBody'
  },
  templates: {
    input: { title: 'Template local', key: 'local-template', version: '1.0.0', entryPointUrl: 'templates/local-template/index.js', styles: '["templates/local-template/theme.css"]', positionsJson: '["topbar","sidebar-right","component"]', paramDefinitionsJson: '[]', discoveredFrom: 'local-template/manifest.json', enabled: true },
    names: 'Title Key Version EntryPointUrl Styles PositionsJson ParamDefinitionsJson DiscoveredFrom Enabled', added: 'ParamDefinitionsJson', clear: 'discoveredFrom'
  }
};

function pairs(fixture) {
  const names = fixture.names.split(' ');
  assert.equal(names.length, Object.keys(fixture.input).length);
  return Object.entries(fixture.input).map(([field, value], index) => ({ field, value, name: names[index] }));
}

function inventory(domain, { legacy = false } = {}) {
  const fixture = FIXTURES[domain];
  const added = new Set(fixture.added.split(' ').filter(Boolean));
  const fields = MINIJOOMLA_SCHEMAS[domain].fields
    .filter((field) => !legacy || !added.has(field.internalName))
    .map((field) => ({ InternalName: field.internalName, TypeAsString: field.type === 'MultilineText' ? 'Note' : field.type, Required: field.required, ...(field.choices ? { Choices: [...field.choices] } : {}) }));
  // Author de sistema não substitui o Author0 Text declarado no schema.
  if (domain === 'articles') {
    fields.push({ InternalName: 'Author', TypeAsString: 'User', Required: false });
  }
  return fields;
}

function buildFixture({ legacy = false } = {}) {
  const transports = new Map(Object.keys(FIXTURES).map((domain) => [domain, createSchemaMemoryTransport({ webUrl: WEB_URL, title: MINIJOOMLA_SCHEMAS[domain].displayName, fields: inventory(domain, { legacy }) })]));
  const transport = {
    webUrl: WEB_URL,
    async request(path, options) {
      const entry = [...transports.entries()].find(([domain]) => path.includes(`lists/getbytitle('${MINIJOOMLA_SCHEMAS[domain].displayName}')`));
      if (!entry) throw new Error(`Caminho inesperado no transporte exclusivamente local: ${path}`);
      return entry[1].request(path, options);
    }
  };
  const lists = Object.fromEntries(Object.keys(FIXTURES).map((domain) => [domain, { listPath: `lists/getbytitle('${MINIJOOMLA_SCHEMAS[domain].displayName}')` }]));
  const app = createMiniJoomlaSharePointApp({ webUrl: WEB_URL, transportFactory: () => transport, lists, now: NOW });
  return { app, admin: createAdminService(app.repositories), transports };
}

async function runEntityCrudContracts() {
  const { app, admin, transports } = buildFixture();
  assert.deepEqual(new Set(app.dataSources.domains), new Set(Object.keys(FIXTURES)));
  assert.ok([...transports.values()].every(({ state }) => state.requests.length === 0), 'compor repositories não faz I/O');

  for (const [domain, fixture] of Object.entries(FIXTURES)) {
    const repository = app.repositories[domain];
    const state = transports.get(domain).state;
    const expected = pairs(fixture);
    const schemaNames = MINIJOOMLA_SCHEMAS[domain].fields.map((field) => field.internalName);
    assert.deepEqual(new Set(schemaNames), new Set(expected.map(({ name }) => name)), `${domain}: schema e fixture devem concordar`);
    assert.deepEqual(new Set(Object.keys(MINIJOOMLA_FIELD_MAPPINGS[domain])), new Set(['id', ...(fixture.readOnly ?? []), ...Object.keys(fixture.input)]));
    for (const { field, name } of expected) {
      const definition = MINIJOOMLA_FIELD_MAPPINGS[domain][field];
      assert.equal(typeof definition === 'string' ? definition : definition.internalName, name, `${domain}.${field}`);
    }
    assert.equal(MINIJOOMLA_FIELD_MAPPINGS[domain].id.readOnly, true);

    const beforeInvalid = state.requests.length;
    await assert.rejects(() => repository.create({ ...fixture.input, id: 99 }), /somente leitura/);
    await assert.rejects(() => repository.create({ ...fixture.input, unknown: true }), /Campo desconhecido/);
    await assert.rejects(() => repository.create({}), /obrigatório/);
    assert.equal(state.requests.length, beforeInvalid, 'mapper rejeita antes do transporte');

    // Admin real para os sete CRUDs. siteConfig bruto cobre todos os mappings
    // de persistência (inclusive SEO legado); save/get operacional é testado
    // separadamente e não deve ser usado como permissão de editar SEO do host.
    // tags v2 (Description/ParentId) omitem null/vazio no admin para listas legadas; coberto em admin-joomla-content.test.js.
    const created = ['siteConfig', 'tags'].includes(domain) ? await repository.create(fixture.input) : await admin[domain].create(fixture.input);
    const raw = state.items.get(created.id);
    for (const { field, value, name } of expected) {
      assert.deepEqual(raw[name], value, `${domain}: payload interno ${name}`);
      assert.deepEqual(created[field], value, `${domain}: round-trip ${field}`);
    }
    assert.deepEqual(Object.keys(raw).sort(), ['Id', '@odata.etag', ...expected.map(({ name }) => name)].sort());
    const listed = (await repository.findMany()).items;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, created.id);
    assert.equal(listed[0].etag, created.etag, 'ETag da coleção vem do metadata do item, não de header da lista');
    assert.equal(Object.getOwnPropertyDescriptor(created, 'etag').enumerable, false);

    // Confere tradução de query, sem afirmar que o double executa OData.
    const label = domain === 'tags' ? 'name' : 'title';
    await repository.findMany({ select: ['id', label], filter: { field: label, op: 'eq', value: "O'Brien" }, orderBy: { field: label, direction: 'desc' }, top: 3 });
    const query = new URLSearchParams(state.requests.at(-1).path.split('?')[1]);
    assert.equal(query.get('$select'), 'Id,Title');
    assert.equal(query.get('$filter'), "Title eq 'O''Brien'");
    assert.equal(query.get('$orderby'), 'Title desc');
    assert.equal(query.get('$top'), '3');

    const snapshot = clone(raw);
    const invalidStart = state.requests.length;
    await assert.rejects(() => repository.update(created.id, { [label]: 'Sem ETag' }), /etag/i);
    await assert.rejects(() => repository.delete(created.id), /etag/i);
    await assert.rejects(() => repository.update(created.id, { id: 2 }, { etag: created.etag }), /somente leitura/);
    assert.equal(state.requests.length, invalidStart);
    await assert.rejects(() => repository.update(created.id, { [label]: 'Conflito' }, { etag: '"stale"' }), isConflict);
    await assert.rejects(() => repository.delete(created.id, { etag: '"stale"' }), isConflict);
    assert.deepEqual(state.items.get(created.id), snapshot);

    assert.equal(await repository.update(created.id, { [label]: 'Alterado', [fixture.clear]: null }, { etag: created.etag }), null, 'MERGE 204 não promete entidade');
    const changed = await repository.findById(created.id);
    assert.equal(changed[label], 'Alterado');
    assert.equal(changed[fixture.clear], null, 'null explícito limpa; omissão não limpa');
    for (const { field, value } of expected) if (![label, fixture.clear].includes(field)) assert.deepEqual(changed[field], value, `${domain}: update parcial preserva ${field}`);
    await assert.rejects(() => repository.update(created.id, fixture.input, { etag: created.etag }), isConflict);
    assert.equal(await repository.update(created.id, fixture.input, { etag: changed.etag }), null);
    const restored = await repository.findById(created.id);
    for (const { field, value } of expected) assert.deepEqual(restored[field], value, `${domain}: snapshot restaurado`);
    await repository.delete(created.id, { etag: restored.etag });
    assert.equal((await repository.findMany()).items.length, 0);
    await assert.rejects(() => repository.findById(created.id), (error) => error.status === 404);
    assert.equal(state.fields.length, inventory(domain).length, 'reversão de dados preserva schema');
    console.log(`ok - entity contracts: ${domain} mapping/schema, CRUD, MERGE 204, ETag, update parcial e undo local`);
  }
}

async function runLegacyInventoryContracts() {
  const { app, transports } = buildFixture({ legacy: true });
  for (const [domain, fixture] of Object.entries(FIXTURES)) {
    const transport = transports.get(domain);
    const repository = app.repositories[domain];
    const added = new Set(fixture.added.split(' ').filter(Boolean));
    const legacyInput = Object.fromEntries(pairs(fixture).filter(({ name }) => !added.has(name)).map(({ field, value }) => [field, value]));
    const legacy = await repository.create(legacyInput);
    const snapshot = clone(transport.state.items.get(legacy.id));
    for (const { field, name } of pairs(fixture)) if (added.has(name)) assert.equal((await repository.findById(legacy.id))[field], undefined, 'leitura antiga não fabrica defaults');
    if (added.size) {
      await assert.rejects(() => repository.create(fixture.input), (error) => error.status === 400 && /does not exist/.test(error.message));
      await assert.rejects(() => repository.update(legacy.id, fixture.input, { etag: legacy.etag }), (error) => error.status === 400);
      assert.equal(transport.state.items.size, 1);
      assert.deepEqual(transport.state.items.get(legacy.id), snapshot);
    }
    const manager = createProvisioningManager({ schema: MINIJOOMLA_SCHEMAS[domain], transport });
    const writes = () => transport.state.requests.filter(({ method }) => method !== 'GET').length;
    const beforeInspect = writes();
    const plan = await manager.inspect();
    assert.equal(writes(), beforeInspect);
    assert.deepEqual(new Set(plan.actions.filter(({ kind }) => kind === 'field').map(({ target }) => target)), added);
    const applied = await manager.apply({ confirm: true });
    assert.equal(applied.status, 'complete');
    assert.equal(applied.results.filter(({ status }) => status === 'applied').length, added.size);
    for (const result of applied.results.filter(({ status }) => status === 'skipped')) {
      assert.equal(result.action.kind, 'index');
      assert.equal(result.reason, 'unsupported-rest-operation');
    }
    const verified = await manager.verify();
    assert.equal(verified.actions.every(({ kind }) => kind === 'index'), true);
    assert.equal(verified.compatible, MINIJOOMLA_SCHEMAS[domain].indexes.length === 0, 'índice pendente não é compatibilidade total');
    assert.deepEqual(transport.state.items.get(legacy.id), snapshot, 'provisionar não migra dados');
    assert.equal(await repository.update(legacy.id, fixture.input, { etag: legacy.etag }), null);
    const upgraded = await repository.findById(legacy.id);
    for (const [field, value] of Object.entries(fixture.input)) assert.deepEqual(upgraded[field], value);
    const beforeRepeat = writes();
    const repeat = await manager.apply({ confirm: true });
    assert.equal(repeat.results.every(({ status }) => status === 'skipped'), true);
    assert.equal(writes(), beforeRepeat, 'repetir apply não escreve campos nem tenta índice unsupported');
    assert.equal(new Set(transport.state.fields.map(({ InternalName }) => InternalName)).size, transport.state.fields.length);
    console.log(`ok - entity contracts: ${domain} inventário antigo/atual, apply aditivo idempotente e limites de verify`);
  }
}

async function runLegacyAdminDefaults() {
  const { admin, transports } = buildFixture({ legacy: true });
  const extension = await admin.extensions.create({ title: 'Legado', key: 'legacy-plugin', type: 'Plugin', entryPointUrl: 'extensions/legacy-plugin/index.js', ordering: 0, folder: '', paramsJson: '', manifestJson: '' });
  const module = await admin.moduleInstances.create({ title: 'Legado', extensionKey: 'articles-latest', position: 'sidebar', showTitle: true, publishUp: null, publishDown: null, trashed: false, assignment: 'all', assignmentJson: '[]', note: '' });
  const config = await admin.siteConfig.save({ siteName: 'Legado', offline: false, offlineMessage: '', metaDescription: '', metaKeywords: '', robots: '', sitenamePagetitles: 'none', homeView: 'category', homeCategory: 'noticias', templateStylesJson: '', componentParamsJson: '' });
  for (const [domain, record] of [['extensions', extension], ['moduleInstances', module], ['siteConfig', config]]) {
    const raw = transports.get(domain).state.items.get(record.id);
    for (const name of FIXTURES[domain].added.split(' ')) assert.equal(Object.hasOwn(raw, name), false, `${domain}: default novo não deve ser enviado`);
    const snapshot = clone(transports.get(domain).state.items.get(record.id));
    const patch = domain === 'extensions' ? { ordering: 1 } : domain === 'moduleInstances' ? { showTitle: false } : { offline: true };
    const operation = domain === 'siteConfig' ? () => admin.siteConfig.save(patch, { etag: record.etag }) : () => admin[domain].update(record.id, patch, { etag: record.etag });
    await assert.rejects(operation, (error) => error.status === 400);
    assert.deepEqual(transports.get(domain).state.items.get(record.id), snapshot, 'valor novo não-padrão falha sem mutação em lista antiga');
  }
  console.log('ok - entity contracts: admin omite defaults v2 em listas antigas e não mascara campo novo ausente');
}

async function runLocalPublicationReversal() {
  const { app, admin, transports } = buildFixture();
  await admin.categories.create({ ...FIXTURES.categories.input, state: 'Published' });
  const article = await admin.articles.create(FIXTURES.articles.input);
  assert.equal((await app.content.article(article.alias)).title, article.title);
  await admin.articles.update(article.id, { state: 'Draft' }, { etag: article.etag });
  assert.equal(await app.content.article(article.alias), null);
  const hidden = await admin.articles.get(article.id);
  await assert.rejects(() => admin.articles.update(article.id, { state: 'Published' }, { etag: article.etag }), isConflict);
  await admin.articles.update(article.id, { state: article.state }, { etag: hidden.etag });
  assert.equal((await app.content.article(article.alias)).title, article.title);

  const template = await admin.templates.create(FIXTURES.templates.input);
  const config = await admin.siteConfig.save({ siteName: 'Preservar', templateKey: 'cassiopeia' });
  await assert.rejects(() => admin.siteConfig.save({ siteName: 'Sem ETag' }), ValidationError);
  await admin.templates.setDefault(template.id, { etag: template.etag, configEtag: config.etag });
  assert.equal((await admin.siteConfig.get()).templateKey, template.key);
  await assert.rejects(() => admin.templates.remove(template.id, { etag: template.etag }), ValidationError);
  const current = await admin.siteConfig.get();
  await assert.rejects(() => admin.siteConfig.save({ templateKey: config.templateKey }, { etag: config.etag }), isConflict);
  await admin.siteConfig.save({ templateKey: config.templateKey }, { etag: current.etag });
  assert.equal((await admin.siteConfig.get()).templateKey, 'cassiopeia');
  assert.equal((await admin.siteConfig.get()).siteName, 'Preservar');
  assert.equal(transports.get('siteConfig').state.items.size, 1, 'upsert não cria uma segunda configuração');
  await admin.templates.remove(template.id, { etag: template.etag });

  // Persistência de campos legados não equivale a contrato de edição do SEO
  // global do host. Edição operacional deve preservar, não sobrescrever.
  const beforeSeed = await admin.siteConfig.get();
  const seoSnapshot = { metaDescription: 'Legado', metaKeywords: 'original', robots: 'index, follow', sitenamePagetitles: 'before' };
  await app.repositories.siteConfig.update(beforeSeed.id, seoSnapshot, { etag: beforeSeed.etag });
  const seeded = await admin.siteConfig.get();
  const writesBeforeBlocked = transports.get('siteConfig').state.requests.filter(({ method }) => method !== 'GET').length;
  await assert.rejects(() => admin.siteConfig.save({ metaDescription: 'Substituir' }, { etag: seeded.etag }), ValidationError);
  assert.equal(transports.get('siteConfig').state.requests.filter(({ method }) => method !== 'GET').length, writesBeforeBlocked);
  await admin.siteConfig.save({ siteName: 'Operacional', ...seoSnapshot }, { etag: seeded.etag });
  const preserved = await admin.siteConfig.get();
  assert.equal(preserved.siteName, 'Operacional');
  for (const [field, value] of Object.entries(seoSnapshot)) assert.equal(preserved[field], value);
  console.log('ok - entity contracts: reversão local de visibilidade Published/Draft e ponteiro templateKey com ETag relido; nenhuma publicação de assets');
  console.log('ok - entity contracts: SEO legado legível/preservado e alteração administrativa sem contrato rejeitada antes da escrita');
}

export async function runEntityContractsFinalTests() {
  await runEntityCrudContracts();
  await runLegacyInventoryContracts();
  await runLegacyAdminDefaults();
  await runLocalPublicationReversal();
  console.log('entity contracts final: 19 cenários locais aprovados (8 CRUD + 8 inventários + defaults + reversão + SEO legado)');
}
