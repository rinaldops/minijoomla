/*
 * Contrato current: oito listas Joomla-aligned, sem ampliar o modelo relacional.
 * Schema/mapper/list client/provisioner são reais; só request() é local.
 * Uma lista nova ganha Title/Author nativos antes de inspect dos campos.
 * Não confundir apply/verify com provisionamento integral: índices são
 * unsupported, defaults não são enviados e verify só compara nomes no SPMIDDLE.
 */
import assert from 'node:assert/strict';
import { createMapper } from '../../SPMIDDLE/packages/data-core/src/index.js';
import { createProvisioningManager } from '../../SPMIDDLE/packages/sharepoint-provisioning/src/index.js';
import { createMiniJoomlaSPMiddleRepositories, MINIJOOMLA_FIELD_MAPPINGS } from '../src/libraries/minijoomla/infrastructure/spmiddle-repositories.js';
import { MINIJOOMLA_SCHEMAS } from '../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';
import { createSharePointListClient } from '../../SPMIDDLE/packages/sharepoint-rest-browser/src/index.js';
import { createSchemaMemoryTransport } from './schema-migration.test.js';

const WEB_URL = '/sites/minijoomla-provisioning-model-local';
const clone = (value) => JSON.parse(JSON.stringify(value));
const restType = (type) => type === 'MultilineText' ? 'Note' : type;
const definitionOf = (value) => typeof value === 'string' ? { internalName: value } : value;

// Expectativas independentes dos schemas: mudança de domínio, versão, campos
// obrigatórios ou índices exige um contrato explícito, não um novo baseline.
const CONTRACT = {
  articles: { name: 'MiniJoomlaArticles', version: 1, count: 20, required: ['Title', 'Alias'], indexes: ['Alias'], defaults: { State: 'Published', Featured: false } },
  categories: { name: 'MiniJoomlaCategories', version: 2, count: 5, required: ['Title', 'Alias'], indexes: ['Alias'], defaults: { State: 'Published' } },
  tags: { name: 'MiniJoomlaTags', version: 2, count: 5, required: ['Title'], indexes: ['Title'], defaults: { State: 'Published' } },
  menu: { name: 'MiniJoomlaMenu', version: 1, count: 5, required: ['Title', 'Path'], indexes: [], defaults: { Published: 'Published' } },
  extensions: { name: 'MiniJoomlaExtensions', version: 2, count: 10, required: ['Title', 'Key', 'Type', 'EntryPointUrl'], indexes: ['Key'], defaults: { Enabled: true, Ordering: 0 } },
  templates: { name: 'MiniJoomlaTemplates', version: 1, count: 9, required: ['Title', 'Key', 'Version', 'EntryPointUrl'], indexes: ['Key'], defaults: { Enabled: true } },
  moduleInstances: { name: 'MiniJoomlaModuleInstances', version: 2, count: 16, required: ['Title', 'ExtensionKey', 'Position'], indexes: [], defaults: { Position: 'sidebar', Ordering: 0, Enabled: true, ScopeKind: 'All', ShowTitle: true, Trashed: false, Assignment: 'all' } },
  siteConfig: { name: 'MiniJoomlaSiteConfig', version: 2, count: 20, required: ['Title'], indexes: [], defaults: { Title: 'MiniJoomlaSiteConfig', Offline: false, SitenamePagetitles: 'none', HomeView: 'category' } }
};

const CHOICES = {
  articles: { State: ['Published', 'Draft', 'Archived', 'Trashed'] },
  categories: { State: ['Published', 'Unpublished', 'Trashed'] },
  tags: { State: ['Published', 'Unpublished', 'Trashed'] },
  menu: { Published: ['Published', 'Draft'] },
  extensions: { Type: ['Module', 'Plugin'] },
  templates: {},
  moduleInstances: { ScopeKind: ['All', 'Route'], Assignment: ['all', 'none', 'only', 'except'] },
  siteConfig: { SitenamePagetitles: ['none', 'before', 'after'], HomeView: ['category', 'featured'] }
};

const NATIVE_FIELDS = [
  { InternalName: 'ID', TypeAsString: 'Counter', ReadOnlyField: true },
  { InternalName: 'Title', Title: 'Title', TypeAsString: 'Text', Required: true },
  { InternalName: 'Author', Title: 'Created By', TypeAsString: 'User', Required: false },
  { InternalName: 'Editor', TypeAsString: 'User', Required: false },
  { InternalName: 'Created', TypeAsString: 'DateTime', ReadOnlyField: true },
  { InternalName: 'Modified', TypeAsString: 'DateTime', ReadOnlyField: true }
];

function assertCurrentModel() {
  assert.deepEqual(Object.keys(MINIJOOMLA_SCHEMAS), Object.keys(CONTRACT));
  assert.deepEqual(Object.keys(MINIJOOMLA_FIELD_MAPPINGS), Object.keys(CONTRACT));
  assert.ok(Object.isFrozen(MINIJOOMLA_SCHEMAS));
  for (const [domain, expected] of Object.entries(CONTRACT)) {
    const schema = MINIJOOMLA_SCHEMAS[domain];
    const mapping = MINIJOOMLA_FIELD_MAPPINGS[domain];
    const fields = new Map(schema.fields.map((field) => [field.internalName, field]));
    assert.equal(schema.internalName, expected.name);
    assert.equal(schema.displayName, expected.name);
    assert.equal(schema.key, `minijoomla-${domain === 'moduleInstances' ? 'module-instances' : domain === 'siteConfig' ? 'site-config' : domain}`);
    assert.equal(schema.template, 100);
    assert.equal(schema.schemaVersion, expected.version);
    assert.equal(fields.size, expected.count);
    assert.equal(schema.fields.length, fields.size, `${domain}: nenhum nome duplicado`);
    for (const name of [schema.key, schema.internalName, schema.displayName, ...fields.keys()]) assert.doesNotMatch(name, /^(?:MSE|Test)/i, 'nenhum nome legado de outro consumidor no modelo current');
    assert.equal(fields.get('Title').type, 'Text', 'reutilizar Title nativo');
    assert.equal(fields.has('Title0'), false);
    assert.deepEqual(schema.fields.filter((field) => field.required).map((field) => field.internalName), expected.required);
    assert.deepEqual(schema.indexes, expected.indexes.map((name) => ({ fields: [name], unique: true })));
    assert.deepEqual(Object.fromEntries(schema.fields.filter((field) => Object.hasOwn(field, 'defaultValue')).map((field) => [field.internalName, field.defaultValue])), expected.defaults);
    assert.deepEqual(Object.fromEntries(schema.fields.filter((field) => field.type === 'Choice').map((field) => [field.internalName, field.choices])), CHOICES[domain]);
    for (const field of schema.fields) {
      assert.ok(['Text', 'MultilineText', 'Number', 'DateTime', 'Boolean', 'Choice'].includes(field.type), `${domain}.${field.internalName}: tipo current`);
      if (field.type === 'Choice' && Object.hasOwn(field, 'defaultValue')) assert.ok(field.choices.includes(field.defaultValue));
    }

    const writableNames = [];
    for (const [property, value] of Object.entries(mapping)) {
      const definition = definitionOf(value);
      if (['Id', 'Created', 'Modified'].includes(definition.internalName)) {
        assert.equal(definition.readOnly, true, `${domain}.${property}: sistema somente leitura`);
        assert.equal(fields.has(definition.internalName), false);
      } else {
        assert.ok(fields.has(definition.internalName), `${domain}.${property}: mapper deve referenciar campo declarado, sem aliases artificiais no teste`);
        assert.notEqual(definition.readOnly, true);
        assert.equal(definition.required === true, fields.get(definition.internalName).required === true);
        writableNames.push(definition.internalName);
      }
    }
    assert.deepEqual(new Set(writableNames), new Set(fields.keys()), `${domain}: cobertura bidirecional schema/mapper`);
    assert.equal(writableNames.length, fields.size);
    assert.deepEqual(Object.entries(mapping).filter(([, value]) => definitionOf(value).readOnly).map(([property]) => property), domain === 'articles' ? ['id', 'created', 'modified'] : ['id']);
    assert.deepEqual(mapping.id, { internalName: 'Id', readOnly: true });
  }
  const author = MINIJOOMLA_SCHEMAS.articles.fields.find((field) => field.internalName === 'Author0');
  assert.deepEqual(author, { internalName: 'Author0', displayName: 'Author', type: 'Text' });
  assert.equal(MINIJOOMLA_FIELD_MAPPINGS.articles.author, 'Author0');
  assert.equal(MINIJOOMLA_SCHEMAS.articles.fields.some((field) => field.internalName === 'Author'), false);
  // Corrigir o nome para o armazenamento já utilizado não introduz coluna de
  // domínio nem migra dados: articles permanece v1; categorias/tags são v2.
  console.log('ok - provisioning model: oito listas current, versões, tipos, defaults, choices, required, índices e todos os mappings declarados');
}

function freshListTransport(schema) {
  const base = createSchemaMemoryTransport({ webUrl: WEB_URL, title: schema.displayName });
  const collection = `${WEB_URL}/_api/web/lists`;
  const root = `${collection}/getbytitle('${schema.displayName}')`;
  let exists = false;
  return {
    webUrl: WEB_URL,
    state: base.state,
    async request(path, options = {}) {
      const method = String(options.method ?? 'GET').toUpperCase();
      if (path === collection && method === 'POST') {
        base.state.requests.push({ path, method, body: clone(options.body) });
        assert.equal(exists, false, 'criação duplicada de lista não é aceita');
        assert.deepEqual(options.body, { __metadata: { type: 'SP.List' }, Title: schema.displayName, BaseTemplate: 100 });
        exists = true;
        base.state.fields.push(...clone(NATIVE_FIELDS));
        return { data: clone(base.state.list), status: 201 };
      }
      if (!exists) {
        base.state.requests.push({ path, method });
        assert.equal(method, 'GET');
        assert.ok(path.startsWith(root));
        throw Object.assign(new Error('Lista local ainda não existe'), { status: 404, code: 'not-found' });
      }
      return base.request(path, options);
    }
  };
}

async function runFreshProvisioningContracts() {
  for (const [domain, schema] of Object.entries(MINIJOOMLA_SCHEMAS)) {
    const transport = freshListTransport(schema);
    const manager = createProvisioningManager({ schema, transport });
    const writes = () => transport.state.requests.filter(({ method }) => method !== 'GET');
    assert.equal(transport.state.requests.length, 0, 'construção não faz I/O');
    const missing = await manager.inspect();
    assert.equal(missing.missing, true);
    assert.equal(missing.list.title, CONTRACT[domain].name);
    assert.deepEqual(missing.actions.filter(({ kind }) => kind === 'field').map(({ target }) => target), schema.fields.map(({ internalName }) => internalName));
    assert.equal(writes().length, 0);
    await assert.rejects(() => manager.apply({ confirm: () => false }), (error) => error.code === 'confirmation-denied');
    assert.equal(writes().length, 0);

    // Limite atual do SPMIDDLE: o plano missing também inclui Title, antes
    // de saber que a criação da lista o gera. Não aplicar esse plano inteiro
    // nem simular uma colisão feliz. Criar a lista local e reinspecionar.
    const listAction = missing.actions.find(({ kind }) => kind === 'list');
    await transport.request(listAction.path, { method: listAction.method, body: listAction.body });
    const nativeSnapshot = clone(transport.state.fields);
    const plan = await manager.inspect();
    assert.equal(plan.list.exists, true);
    const fieldActions = plan.actions.filter(({ kind }) => kind === 'field');
    assert.deepEqual(fieldActions.map(({ target }) => target), schema.fields.filter(({ internalName }) => internalName !== 'Title').map(({ internalName }) => internalName));
    assert.equal(fieldActions.some(({ target }) => ['Title', 'Title0', 'Author', 'Editor', 'ID', 'Created', 'Modified'].includes(target)), false);
    if (domain === 'articles') assert.deepEqual(fieldActions.filter(({ target }) => target === 'Author0').map(({ body }) => body), [{ __metadata: { type: 'SP.Field' }, Title: 'Author', InternalName: 'Author0', FieldTypeKind: 2, Required: false }]);
    for (const action of fieldActions) {
      const field = schema.fields.find(({ internalName }) => internalName === action.target);
      assert.equal(action.body.Required, field.required === true);
      assert.equal(action.body.__metadata.type, field.type === 'Choice' ? 'SP.FieldChoice' : 'SP.Field');
      if (field.type === 'Choice') {
        assert.equal(action.body.FieldTypeKind, 6);
        assert.deepEqual(action.body.Choices.results, CHOICES[domain][field.internalName]);
      }
      assert.equal(Object.hasOwn(action.body, 'DefaultValue'), false, 'limite explícito: o SPMIDDLE atual não envia defaults');
    }

    const applied = await manager.apply({ confirm: true });
    assert.equal(applied.status, 'complete');
    assert.equal(applied.results.filter(({ status }) => status === 'applied').length, schema.fields.length - 1);
    assert.deepEqual(applied.results.filter(({ status }) => status === 'skipped').map(({ action, reason }) => ({ kind: action.kind, reason })), schema.indexes.map(() => ({ kind: 'index', reason: 'unsupported-rest-operation' })));
    const fieldPosts = writes().filter(({ path }) => path.endsWith('/fields'));
    assert.deepEqual(fieldPosts.map(({ body }) => body.InternalName), fieldActions.map(({ target }) => target));
    assert.equal(new Set(fieldPosts.map(({ body }) => body.InternalName)).size, fieldPosts.length);
    assert.deepEqual(transport.state.fields.slice(0, NATIVE_FIELDS.length), nativeSnapshot, 'campos nativos preservados');
    for (const expected of schema.fields) {
      const actual = transport.state.fields.find(({ InternalName }) => InternalName === expected.internalName);
      assert.equal(actual.TypeAsString, restType(expected.type), `${domain}.${expected.internalName}: conferir tipo no inventário, não apenas verify`);
      assert.equal(actual.Required, expected.required === true);
      assert.equal(actual.Title, expected.displayName);
      if (expected.type === 'Choice') assert.deepEqual(actual.Choices, CHOICES[domain][expected.internalName]);
    }
    if (domain === 'articles') assert.equal(fieldPosts.filter(({ body }) => body.InternalName === 'Author0').length, 1);
    const verified = await manager.verify();
    assert.equal(verified.actions.every(({ kind }) => kind === 'index'), true);
    assert.equal(verified.compatible, schema.indexes.length === 0, 'índices não suportados permanecem pendentes');
    const beforeRepeat = writes().length;
    const repeated = await manager.apply({ confirm: true });
    assert.equal(repeated.results.every(({ status }) => status === 'skipped'), true);
    assert.equal(writes().length, beforeRepeat, 'nenhum segundo POST de Author0 ou outro campo');
    assert.equal(transport.state.items.size, 0, 'provisionamento não grava dados');
    console.log(`ok - provisioning model: ${domain} nova lista local, Title nativo, tipos/choices e apply aditivo idempotente; limites defaults/índices explícitos`);
  }
}

async function runExistingAuthorContract() {
  const schema = MINIJOOMLA_SCHEMAS.articles;
  const fields = [
    ...clone(NATIVE_FIELDS),
    ...schema.fields.filter(({ internalName }) => internalName !== 'Title').map((field) => ({ InternalName: field.internalName, Title: field.displayName, TypeAsString: restType(field.type), Required: field.required === true, ...(field.choices ? { Choices: [...field.choices] } : {}) })),
    { InternalName: 'Title0', TypeAsString: 'Text', Required: false }
  ];
  const transport = createSchemaMemoryTransport({ webUrl: WEB_URL, title: schema.displayName, fields });
  const snapshot = clone(transport.state.fields);
  const manager = createProvisioningManager({ schema, transport });
  assert.equal((await manager.inspect()).actions.some(({ kind }) => kind === 'field'), false, 'Author0 existente não deve ser recriado');
  assert.equal((await manager.apply({ confirm: true })).results.every(({ status }) => status === 'skipped'), true);
  assert.equal(transport.state.requests.some(({ method }) => method !== 'GET'), false, 'lista atual não recebe escrita de schema');
  const mapper = createMapper({ mapping: MINIJOOMLA_FIELD_MAPPINGS.articles });
  const raw = { Id: 1, Title: 'Título nativo', Title0: 'Órfão preservado', Alias: 'existente', Author: { Id: 42, Title: 'Identidade de sistema sintética' }, Author0: 'Autor editorial existente', Created: '2026-01-01T00:00:00Z', Modified: '2026-02-01T00:00:00Z', '@odata.etag': '"1"' };
  transport.state.items.set(1, clone(raw));
  const client = createSharePointListClient({ transport, listPath: `lists/getbytitle('${schema.displayName}')` });
  const repository = createMiniJoomlaSPMiddleRepositories({ domains: ['articles'], getListClient: () => client }).articles;
  const existing = await repository.findById(1);
  assert.equal(existing.author, raw.Author0);
  assert.equal(existing.title, raw.Title);
  assert.equal(existing.created, raw.Created);
  assert.equal(existing.modified, raw.Modified);
  assert.equal(mapper.mapItem({ Author: raw.Author }).author, undefined, 'não fazer fallback de User para texto editorial');
  for (const property of ['id', 'created', 'modified']) assert.throws(() => mapper.mapUpdate({ [property]: 'proibido' }), /somente leitura/);
  const newAuthor = 'Autor editorial atualizado';
  assert.deepEqual(mapper.mapUpdate({ author: newAuthor }), { Author0: newAuthor });
  await repository.update(1, { author: newAuthor }, { etag: existing.etag });
  assert.equal((await repository.findById(1)).author, newAuthor);
  assert.deepEqual(transport.state.items.get(1).Author, raw.Author, 'Author User nativo intacto');
  assert.equal(transport.state.items.get(1).Title0, raw.Title0, 'campo órfão legado intacto');
  assert.deepEqual(transport.state.fields, snapshot, 'CRUD não altera schema nem requer migração de dados');
  const itemPost = transport.state.requests.find(({ method }) => method === 'MERGE');
  assert.deepEqual(itemPost.body, { Author0: newAuthor });
  console.log('ok - provisioning model: Author0 existente preservado, texto editorial round-trip, sistema readonly e nenhum POST de schema');
}

async function runMissingAuthorContract() {
  const schema = MINIJOOMLA_SCHEMAS.articles;
  const transport = createSchemaMemoryTransport({ webUrl: WEB_URL, title: schema.displayName, fields: [
    ...clone(NATIVE_FIELDS),
    ...schema.fields.filter(({ internalName }) => !['Title', 'Author0'].includes(internalName)).map((field) => ({ InternalName: field.internalName, TypeAsString: restType(field.type), Required: field.required === true, ...(field.choices ? { Choices: [...field.choices] } : {}) }))
  ] });
  const client = createSharePointListClient({ transport, listPath: `lists/getbytitle('${schema.displayName}')` });
  const repository = createMiniJoomlaSPMiddleRepositories({ domains: ['articles'], getListClient: () => client }).articles;
  const input = { title: 'Artigo local', alias: 'autor-texto', author: 'Equipe editorial sintética' };
  await assert.rejects(() => repository.create(input), (error) => error.status === 400 && /Author0.*does not exist/.test(error.message));
  assert.equal(transport.state.items.size, 0, 'Author User não satisfaz escrita de texto editorial');
  const manager = createProvisioningManager({ schema, transport });
  const plan = await manager.inspect();
  assert.deepEqual(plan.actions.filter(({ kind }) => kind === 'field').map(({ target }) => target), ['Author0']);
  assert.equal((await manager.verify()).compatible, false, 'presença do Author nativo não satisfaz Author0');
  const applied = await manager.apply({ confirm: true });
  assert.equal(applied.status, 'complete');
  assert.deepEqual(applied.results.filter(({ status }) => status === 'applied').map(({ action }) => action.target), ['Author0']);
  const created = await repository.create(input);
  assert.equal(created.author, input.author);
  assert.equal(transport.state.items.get(created.id).Author0, input.author);
  assert.equal(Object.hasOwn(transport.state.items.get(created.id), 'Author'), false);
  await manager.apply({ confirm: true });
  const fieldPosts = transport.state.requests.filter(({ method, path }) => method === 'POST' && path.endsWith('/fields'));
  assert.deepEqual(fieldPosts.map(({ body }) => body.InternalName), ['Author0']);
  assert.deepEqual(transport.state.fields.slice(0, NATIVE_FIELDS.length), NATIVE_FIELDS);
  console.log('ok - provisioning model: Author User sozinho não satisfaz Author0; verify expõe ausência, apply cria uma vez e texto grava sem colisão');
}

export async function runProvisioningModelTests() {
  assertCurrentModel();
  await runFreshProvisioningContracts();
  await runExistingAuthorContract();
  await runMissingAuthorContract();
  console.log('provisioning model: 11 cenários locais aprovados; nenhuma rede, browser, publicação ou exclusão');
}
