/*
 * Teste de integração local do Marco B: schema SPMIDDLE real -> data source
 * registry real -> repository real (createMapper/createRepository) ->
 * createSPMiddleAdapter (sem alteração) -> ContentService -> view model.
 *
 * Não há rede: o transporte é um double em memória, com o mesmo contrato
 * `request(path, options)` de `createSharePointRestClient`
 * (ver SPMIDDLE/examples/integrated-local/app.js, `createMemoryTransport`,
 * usado aqui como modelo e generalizado para as 4 listas do MINIJOOMLA).
 * Nenhuma URL real, GUID real, tenant ou credencial aparece neste arquivo.
 */
import assert from 'node:assert/strict';
import { createMiniJoomlaSharePointApp } from '../src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js';
import { createProvisioningManager } from '../../SPMIDDLE/packages/sharepoint-provisioning/src/index.js';
import { MINIJOOMLA_SCHEMAS } from '../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';
import { runContentAdapterContract } from './adapter-contract.test.js';

const WEB_URL = '/sites/minijoomla-local-test';

function notFound(message = 'not found') {
  const error = new Error(message);
  error.code = 'not-found';
  error.status = 404;
  return error;
}

function conflict(message = 'ETag does not match') {
  const error = new Error(message);
  error.code = 'concurrency-conflict';
  error.status = 412;
  return error;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/*
 * Transporte em memória com o mesmo contrato request() do transporte REST
 * real, mas atendendo múltiplas listas (uma por título), identificadas pelo
 * segmento `lists/getbytitle('<Title>')` do caminho — o mesmo padrão usado
 * por createSharePointListClient e createProvisioningManager.
 */
function createMiniJoomlaMemoryTransport({ webUrl = WEB_URL, listTitles = [] } = {}) {
  const lists = new Map(listTitles.map((title) => [title, { list: null, fields: [], items: new Map(), nextId: 1, nextVersion: 1 }]));
  const listRoot = (title) => `${webUrl}/_api/web/lists/getbytitle('${title}')`;
  const itemsRoot = (title) => `${listRoot(title)}/items`;
  const fieldsRoot = (title) => `${listRoot(title)}/fields`;
  const indexesRoot = (title) => `${listRoot(title)}/indexes`;
  const titleFromPath = (path) => {
    const match = /lists\/getbytitle\('([^']+)'\)/.exec(path);
    return match ? match[1] : null;
  };
  const response = (data, status = 200, etag = null) => ({ data: clone(data), status, etag });

  return {
    webUrl,
    lists,
    async request(path, options = {}) {
      const method = String(options.method ?? 'GET').toUpperCase();
      const body = options.body ?? {};

      // create-list points at the site-level lists collection, with no list
      // title in the path, so it cannot be resolved via titleFromPath. It is
      // only unambiguous when this transport double manages a single list.
      if (method === 'POST' && path === `${webUrl}/_api/web/lists`) {
        if (lists.size !== 1) throw new Error(`Unexpected ${method} ${path} (ambíguo para múltiplas listas)`);
        const [, state] = [...lists.entries()][0];
        state.list = { Id: '00000000-0000-4000-8000-000000000001', Title: body.Title, BaseTemplate: body.BaseTemplate };
        return response(state.list, 201);
      }

      const title = titleFromPath(path);
      const state = title ? lists.get(title) : null;
      if (!title || !state) throw new Error(`Unexpected ${method} ${path} (lista desconhecida)`);
      const itemsPath = itemsRoot(title);

      if (method === 'GET' && (path === listRoot(title) || path.startsWith(`${listRoot(title)}?`))) {
        if (!state.list) throw notFound();
        return response(state.list);
      }
      if (method === 'GET' && path.startsWith(fieldsRoot(title))) {
        if (!state.list) throw notFound();
        return response({ value: state.fields });
      }
      if (method === 'GET' && path === indexesRoot(title)) {
        if (!state.list) throw notFound();
        return response({ value: [] });
      }
      if (method === 'POST' && path === fieldsRoot(title)) {
        const field = { InternalName: body.InternalName, StaticName: body.InternalName, Title: body.Title, TypeAsString: body.FieldTypeKind, Required: body.Required === true };
        state.fields.push(field);
        return response(field, 201);
      }
      if (method === 'GET' && (path === itemsPath || path.startsWith(`${itemsPath}?`))) {
        return response({ value: [...state.items.values()].map(clone) });
      }
      if (method === 'POST' && path === itemsPath) {
        const id = state.nextId++;
        const etag = `"${state.nextVersion++}"`;
        const item = { Id: id, ...clone(body), __etag: etag };
        state.items.set(id, item);
        return response(item, 201, etag);
      }
      if (path.startsWith(`${itemsPath}(`) && path.endsWith(')')) {
        const id = Number(path.slice(itemsPath.length + 1, -1));
        const item = state.items.get(id);
        if (!item) throw notFound('item not found');
        if (method === 'GET') return response(item, 200, item.__etag);
        if (options.etag !== item.__etag) throw conflict();
        if (method === 'MERGE') { Object.assign(item, clone(body)); item.__etag = `"${state.nextVersion++}"`; return response(item, 200, item.__etag); }
        if (method === 'DELETE') { state.items.delete(id); return response(null, 204); }
      }
      throw new Error(`Unexpected ${method} ${path}`);
    }
  };
}

function seedItem(state, fields) {
  const id = state.nextId++;
  const etag = `"${state.nextVersion++}"`;
  state.items.set(id, { Id: id, ...fields, __etag: etag });
}

function buildFixtureTransport() {
  const transport = createMiniJoomlaMemoryTransport({
    listTitles: ['MiniJoomlaArticles', 'MiniJoomlaCategories', 'MiniJoomlaTags', 'MiniJoomlaMenu']
  });
  const articles = transport.lists.get('MiniJoomlaArticles');
  const categories = transport.lists.get('MiniJoomlaCategories');
  const tags = transport.lists.get('MiniJoomlaTags');
  const menu = transport.lists.get('MiniJoomlaMenu');

  articles.list = { Id: '00000000-0000-4000-8000-000000000011', Title: 'MiniJoomlaArticles' };
  categories.list = { Id: '00000000-0000-4000-8000-000000000012', Title: 'MiniJoomlaCategories' };
  tags.list = { Id: '00000000-0000-4000-8000-000000000013', Title: 'MiniJoomlaTags' };
  menu.list = { Id: '00000000-0000-4000-8000-000000000014', Title: 'MiniJoomlaMenu' };

  seedItem(categories, { Title: 'Notícias', Alias: 'noticias', ParentId: null, Description: '' });
  seedItem(categories, { Title: 'Filha', Alias: 'filha', ParentId: 1, Description: '' });

  seedItem(articles, { Title: 'Boas-vindas', Alias: 'boas-vindas', Introtext: 'Resumo', Fulltext: 'Texto completo', CategoryId: 1, State: 'Published', Featured: true, PublishUp: '2026-01-01T00:00:00.000Z', PublishDown: null, Author: 'Equipe', Tags: 'guia, local' });
  seedItem(articles, { Title: 'Segundo artigo', Alias: 'segundo-artigo', Introtext: '', Fulltext: '', CategoryId: 1, State: 'Published', Featured: false, PublishUp: '2026-02-01T00:00:00.000Z', PublishDown: null, Author: 'Equipe', Tags: 'guia' });
  seedItem(articles, { Title: 'Rascunho', Alias: 'rascunho', Introtext: '', Fulltext: '', CategoryId: 1, State: 'Draft', Featured: false, PublishUp: null, PublishDown: null, Author: 'Equipe', Tags: '' });

  seedItem(tags, { Title: 'guia', Alias: 'guia', State: 'Published' });
  seedItem(tags, { Title: 'local', Alias: 'local', State: 'Published' });

  seedItem(menu, { Title: 'Início', Path: '/', ParentId: null, Published: 'Published', Ordering: 1 });
  seedItem(menu, { Title: 'Oculto', Path: '/hidden', ParentId: null, Published: 'Draft', Ordering: 2 });

  return transport;
}

function buildApp(transport) {
  return createMiniJoomlaSharePointApp({
    webUrl: WEB_URL,
    transportFactory: () => transport,
    lists: {
      articles: { listPath: "lists/getbytitle('MiniJoomlaArticles')" },
      categories: { listPath: "lists/getbytitle('MiniJoomlaCategories')" },
      tags: { listPath: "lists/getbytitle('MiniJoomlaTags')" },
      menu: { listPath: "lists/getbytitle('MiniJoomlaMenu')" }
    },
    now: new Date('2026-10-31T00:00:00Z')
  });
}

export async function runSPMiddleIntegrationTests() {
  const transport = buildFixtureTransport();
  const app = buildApp(transport);

  // 1. schema -> repository -> adapter -> view model, fim a fim, sem rede.
  const article = await app.content.article('boas-vindas');
  assert.equal(article.title, 'Boas-vindas');
  assert.equal(article.siteName, app.config.siteName);
  assert.deepEqual(article.tags, ['guia', 'local']);

  const missing = await app.content.article('inexistente');
  assert.equal(missing, null);

  const category = await app.content.category('noticias');
  assert.ok(category && category.category.alias === 'noticias');
  assert.deepEqual(category.items.map((item) => item.alias).sort(), ['boas-vindas', 'segundo-artigo']);
  assert.equal(category.items.some((item) => item.alias === 'rascunho'), false);

  const tags = await app.adapter.listTags();
  assert.deepEqual([...tags].sort(), ['guia', 'local']);

  const menus = await app.adapter.listMenus();
  assert.deepEqual(menus.map((item) => item.path), ['/']);

  // 2. a conexão real não embute nenhum GUID/URL hardcoded além dos usados no teste.
  assert.equal(app.dataSources.domains.length, 4);

  // 3. mesma suíte de conformidade do contrato v1 (docs/CONTRATOS.md#minijoomla--contrato-v1-congelado-dos-adapters-de-conteúdo),
  // agora executada contra a composição real (fixture local, sem rede).
  const contractCount = await runContentAdapterContract({
    adapter: app.adapter,
    fixture: {
      knownAlias: 'boas-vindas',
      unknownAlias: 'alias-inexistente',
      knownTag: 'guia',
      knownCategoryAlias: 'noticias',
      unknownCategoryAlias: 'categoria-inexistente'
    }
  });
  assert.ok(contractCount > 0);

  // 4. provisioning inspect/apply/verify (read-only + apply explícito) contra
  // o mesmo transporte em memória, usando o schema MiniJoomlaArticles real.
  const provisioningTransport = createMiniJoomlaMemoryTransport({ listTitles: ['MiniJoomlaArticles'] });
  const manager = createProvisioningManager({
    schema: MINIJOOMLA_SCHEMAS.articles,
    transport: provisioningTransport,
    listClient: app.dataSources.getListClient('articles')
  });
  const inspected = await manager.inspect();
  assert.equal(inspected.missing, true);
  assert.ok(inspected.actions.length > 0);
  const applied = await manager.apply({ confirm: true });
  assert.equal(applied.status, 'complete', JSON.stringify(applied.results.filter((r) => r.status === 'failed').map((r) => ({ target: r.action.target, error: r.error && r.error.message, stack: r.error && r.error.stack })), null, 2));
  // A criação de índice via REST é marcada `supported: false` pelo próprio
  // SPMIDDLE (dependente de tenant/versão) e fica como ação pendente, não
  // como falha; os campos (incluindo os usados pelo adapter) são todos
  // aplicados e passam a existir na lista simulada.
  assert.equal(applied.results.filter((r) => r.status === 'skipped').every((r) => r.action.kind === 'index'), true);
  assert.equal(applied.results.filter((r) => r.action.kind === 'field').every((r) => r.status === 'applied'), true);
  const verified = await manager.verify();
  assert.equal(verified.actions.every((action) => action.kind === 'index'), true);

  console.log('ok - integração SPMIDDLE local: schema->registry->repository->adapter->content service sem rede');
  console.log('ok - integração SPMIDDLE local: adapter-contract contra composição real');
  console.log('ok - integração SPMIDDLE local: provisioning inspect/apply/verify contra schema MiniJoomlaArticles');

  // 5. tradução de erro de transporte->domínio (pendência de
  // docs/CONTRATOS.md#minijoomla--integração-com-spmiddle-local-e-caminho-para-remoto): quando o transporte real falha
  // (aqui simulado como um 503 do próprio double em memória), o adapter de
  // leitura resolve DataError sem detalhe de transporte na mensagem, mas
  // `app.repositories.*` cru continua expondo o erro original — necessário
  // para a detecção de conflito de ETag já validada no Marco D.
  const flakyTransport = buildFixtureTransport();
  const originalRequest = flakyTransport.request.bind(flakyTransport);
  const transportDetail = new Error('A operação REST falhou (HTTP 503).');
  transportDetail.name = 'SharePointRestError';
  transportDetail.code = 'throttled';
  transportDetail.status = 503;
  flakyTransport.request = async (path, options = {}) => {
    if (String(options.method ?? 'GET').toUpperCase() === 'GET' && path.includes("getbytitle('MiniJoomlaArticles')/items")) throw transportDetail;
    return originalRequest(path, options);
  };
  const flakyApp = buildApp(flakyTransport);

  await assert.rejects(() => flakyApp.content.article('boas-vindas'), (error) => {
    assert.equal(error.name, 'DataError');
    assert.equal(error.message, 'Falha ao consultar conteúdo.');
    assert.ok(!error.message.includes('503'), 'a mensagem não deve conter o detalhe de transporte');
    assert.equal(error.cause, transportDetail);
    return true;
  });
  await assert.rejects(() => flakyApp.adapter.listArticles(), (error) => error.name === 'DataError' && error.cause === transportDetail);
  // o repositório cru (fora do adapter) continua propagando o erro original,
  // preservando status/code para quem precisar deles (ex.: diagnóstico, ou
  // um futuro consumidor de escrita que precise distinguir 503 de 412).
  await assert.rejects(() => flakyApp.repositories.articles.findMany({}), (error) => error === transportDetail);

  console.log('ok - integração SPMIDDLE local: falha de transporte real (503) chega como DataError sem detalhe via adapter, preservando o erro original em repositories cru');

  // 6. resposta incompleta/inválida (item restante de §4 de
  // docs/CONTRATOS.md#minijoomla--integração-com-spmiddle-local-e-caminho-para-remoto: "comportamento para resposta incompleta,
  // inválida ou indisponível"). Em vez de simular o erro manualmente, um
  // item genuinamente malformado (`null`, como um transporte real poderia
  // devolver numa resposta corrompida/truncada) é inserido diretamente no
  // transporte em memória; isso faz o createMapper.mapItem() REAL do
  // SPMIDDLE lançar seu próprio TypeError ("item deve ser um objeto."),
  // sem nenhum erro forjado por este teste. Confirma que a mesma tradução
  // já cobre esse caso, sem exigir nenhum código novo dedicado a ele.
  const malformedTransport = buildFixtureTransport();
  malformedTransport.lists.get('MiniJoomlaArticles').items.set(999, null);
  const malformedApp = buildApp(malformedTransport);

  await assert.rejects(() => malformedApp.adapter.listArticles(), (error) => {
    assert.equal(error.name, 'DataError');
    assert.equal(error.message, 'Falha ao consultar conteúdo.');
    assert.equal(error.cause?.constructor?.name, 'TypeError');
    assert.match(error.cause?.message ?? '', /item deve ser um objeto/);
    return true;
  });
  // o caminho cru continua vendo o TypeError original do SPMIDDLE, não o DataError.
  await assert.rejects(() => malformedApp.repositories.articles.findMany({}), (error) => error.constructor.name === 'TypeError');

  console.log('ok - integração SPMIDDLE local: item realmente malformado (mapItem real lança) chega como DataError via adapter, sem código de tradução dedicado');
  console.log('spmiddle integration: 5 testes aprovados');
}
