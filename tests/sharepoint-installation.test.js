import assert from 'node:assert/strict';
import { createSharePointInstallationPort, validateInstallationConfiguration } from '../src/libraries/minijoomla/infrastructure/sharepoint-installation.js';
import { MINIJOOMLA_SCHEMAS } from '../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';
import { createInstallationService } from '../src/libraries/minijoomla/application/installation-service.js';
import { createSharePointRestClient } from '../../SPMIDDLE/packages/sharepoint-rest-browser/src/index.js';

const WEB = '/sites/example';
const LIBRARY = `${WEB}/SiteAssets/minijoomla`;
const DOMAINS = Object.keys(MINIJOOMLA_SCHEMAS);
const clone = value => structuredClone(value);
const guid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const restType = type => type === 'MultilineText' ? 'Note' : type;
const defaultValue = field => field.defaultValue === undefined ? null : typeof field.defaultValue === 'boolean' ? field.defaultValue ? '1' : '0' : String(field.defaultValue);

function schemaFields(domain) {
  const schema = MINIJOOMLA_SCHEMAS[domain];
  return schema.fields.filter(field => !(domain === 'extensions' && field.internalName === 'Folder')).map(field => {
    const index = schema.indexes.find(entry => entry.fields.includes(field.internalName));
    return {
      InternalName: field.internalName, Title: field.displayName ?? field.internalName,
      TypeAsString: restType(field.type), Required: field.required === true,
      Indexed: Boolean(index), EnforceUniqueValues: index?.unique === true,
      ...(field.choices ? { Choices: { results: [...field.choices] } } : {}),
      DefaultValue: defaultValue(field), revision: 1
    };
  });
}

function configuration(server) {
  return {
    format: 'minijoomla-installation-v1', state: 'installed', webUrl: server.webUrl, libraryPath: server.libraryPath,
    lists: Object.fromEntries(DOMAINS.map(domain => [domain, { listId: server.lists.get(domain).Id }])),
    initialSite: { siteName: 'Example', siteDescription: '', timezone: 'UTC', language: 'pt-BR', pageSize: 10, templateKey: 'cassiopeia', homeView: 'featured', homeCategory: '', offline: false, offlineMessage: '' },
    joomlaDiscoveryRoots: [], moduleStyles: {}, moduleStyleRevisions: {}
  };
}

/** Complete in-memory server, with exclusive creation and real ETag comparisons.
 * Neither this fixture nor the suite opens a browser, uses fetch or tenant I/O.
 */
export function createInstallationMemoryServer({ webUrl = WEB, libraryPath = `${webUrl === '/' ? '' : webUrl}/SiteAssets/minijoomla` } = {}) {
  let nextId = 1;
  const api = `${webUrl === '/' ? '' : webUrl}/_api/web`;
  const server = {
    webUrl, libraryPath, lists: new Map(), calls: [], config: null, configRevision: 1, folderExists: true,
    hook: null, fieldETag: 'strong', pageSize: Infinity, responseShape: 'minimal',
    seed(domain, { itemCount = 0 } = {}) {
      const list = { Id: guid(nextId++), Title: MINIJOOMLA_SCHEMAS[domain].displayName, BaseTemplate: 100, ItemCount: itemCount, fields: schemaFields(domain), rows: Array.from({ length: itemCount }, (_, index) => ({ Id: index + 1, Title: 'Preserve', secret: 'private-row' })) };
      server.lists.set(domain, list);
      return list;
    },
    seedAll() { DOMAINS.forEach(domain => server.seed(domain)); },
    transport: {
      webUrl: webUrl === '/' ? '' : webUrl,
      async request(url, options) {
        assert.ok(url.startsWith(`${api}/`), 'Every request stays inside the configured web');
        assert.ok(options && typeof options.method === 'string', 'Read methods are explicit');
        assert.notEqual(options.etag, '*');
        assert.notEqual(options.headers?.['If-Match'], '*');
        const call = { url, ...options, ...(options.body === undefined ? {} : { body: clone(options.body) }) };
        server.calls.push(call);
        const override = await server.hook?.(call, server);
        if (override !== undefined) return override;
        const [root, query = ''] = url.split('?');
        const params = new URLSearchParams(query);
        const output = (data, etag = null, status = 200) => ({ data: server.responseShape === 'verbose' ? { d: clone(data) } : clone(data), etag, status });
        const notFound = () => { const error = new Error('RAW server text includes private credentials'); error.status = 404; throw error; };
        const conflict = () => { const error = new Error('RAW conflict with private credentials'); error.status = 412; throw error; };
        if (root === `${api}/lists` && options.method === 'POST') {
          assert.equal(options.headers?.['Content-Type'], 'application/json;odata=verbose', '__metadata requires verbose write content type');
          const domain = DOMAINS.find(domain => MINIJOOMLA_SCHEMAS[domain].displayName === options.body.Title);
          assert.ok(domain);
          if (server.lists.has(domain)) conflict();
          const list = server.seed(domain);
          // A newly-created SharePoint list already owns native Title and Author.
          list.fields = [
            { InternalName: 'Title', Title: 'Title', TypeAsString: 'Text', Required: true, Indexed: false, EnforceUniqueValues: false, DefaultValue: null, revision: 1 },
            { InternalName: 'Author', Title: 'Created By', TypeAsString: 'User', Required: false, Indexed: false, EnforceUniqueValues: false, DefaultValue: null, revision: 1 }
          ];
          return output({ Id: list.Id, Title: list.Title }, '"list-1"', 201);
        }
        const listMatch = root.match(/\/lists(?:\/getbytitle\('([^']+)'\)|\(guid'([^']+)'\))(.*)$/);
        if (listMatch) {
          const [, title, listId, suffix] = listMatch;
          const list = [...server.lists.values()].find(list => title ? list.Title === title : list.Id === listId);
          if (!list) notFound();
          if (suffix === '' && options.method === 'GET') return output({ Id: list.Id, Title: list.Title, BaseTemplate: list.BaseTemplate, ItemCount: list.ItemCount }, '"list-1"');
          if (suffix === '' && options.method === 'DELETE') { assert.equal(options.etag,'"list-1"');assert.equal(list.ItemCount,0);server.lists.delete(DOMAINS.find(domain=>server.lists.get(domain)===list));return output(null,null,204); }
          if (suffix === '/fields' && options.method === 'GET') {
            assert.match(params.get('$select'), /TypeAsString/);
            assert.match(params.get('$select'), /Required,Indexed,EnforceUniqueValues,Choices,DefaultValue/);
            const start = Number(params.get('$skip') ?? 0), size = server.pageSize;
            const page = list.fields.slice(start, start + size).map(({ revision, ...field }) => field);
            const next = start + page.length < list.fields.length ? `${root}?$select=${params.get('$select')}&$skip=${start + page.length}` : null;
            return server.responseShape === 'verbose'
              ? { data: { d: { results: clone(page), ...(next ? { __next: next } : {}) } }, status: 200, etag: null }
              : { data: { value: clone(page), ...(next ? { 'odata.nextLink': next } : {}) }, status: 200, etag: null };
          }
          if (suffix === '/fields' && options.method === 'POST') {
            const body = options.body;
            assert.notEqual(body.InternalName, 'Title', 'Reuse native Title');
            assert.notEqual(body.InternalName, 'Folder', 'Reserved navigation member must never be created');
            assert.equal(list.ItemCount, 0);
            if (list.fields.some(field => field.InternalName === body.InternalName)) conflict();
            if (body.FieldTypeKind === 6) assert.equal(body.__metadata.type, 'SP.FieldChoice');
            const types = { 2: 'Text', 3: 'Note', 4: 'DateTime', 6: 'Choice', 8: 'Boolean', 9: 'Number' };
            list.fields.push({ InternalName: body.InternalName, Title: body.Title, TypeAsString: types[body.FieldTypeKind], Required: body.Required, Indexed: body.Indexed === true, EnforceUniqueValues: body.EnforceUniqueValues === true, ...(body.Choices ? { Choices: clone(body.Choices) } : {}), DefaultValue: body.DefaultValue ?? null, revision: 1 });
            return output({}, null, 201);
          }
          const fieldMatch = suffix.match(/^\/fields\/getbyinternalnameortitle\('([^']+)'\)$/);
          if (fieldMatch) {
            const field = list.fields.find(field => field.InternalName === fieldMatch[1]);
            if (!field) notFound();
            const expected = `"field-${field.revision}"`;
            if (options.method === 'GET') {
              const { revision, ...data } = field;
              return output(data, server.fieldETag === 'missing' ? null : server.fieldETag === 'weak' ? `W/${expected}` : server.fieldETag === 'wildcard' ? '*' : expected);
            }
            if (options.method === 'MERGE' || options.method === 'POST' && options.headers?.['X-HTTP-Method'] === 'MERGE') {
              if (options.method === 'POST') assert.equal(server.fieldETag,'missing');
              if (options.method === 'MERGE' && (options.etag !== expected || options.headers?.['If-Match'] !== expected)) conflict();
              const { __metadata, ...patch } = options.body;
              assert.ok(Object.keys(patch).every(key => ['Required', 'DefaultValue', 'Indexed', 'EnforceUniqueValues'].includes(key)));
              Object.assign(field, clone(patch)); field.revision++;
              return output(null, `"field-${field.revision}"`, 204);
            }
          }
          throw new Error(`Unexpected list request: ${options.method} ${suffix}`);
        }
        if (root.includes('/GetFileByServerRelativePath(')) {
          assert.ok(decodeURIComponent(root).includes(`${libraryPath}/installation.json`));
          if (server.config === null) notFound();
          if (root.endsWith('/$value')) return { data: clone(server.config), status: 200, etag: `"config-${server.configRevision}"` };
          return output({ Exists: true, ServerRelativeUrl: `${libraryPath}/installation.json`, ETag: `"config-${server.configRevision}"` }, `"config-${server.configRevision}"`);
        }
        if (root.includes('/GetFolderByServerRelativePath(')) {
          assert.ok(decodeURIComponent(root).includes(libraryPath));
          if (!server.folderExists) notFound();
          if (options.method === 'GET') return output({ Exists: true, ServerRelativeUrl: libraryPath });
          assert.match(root, /\/Files\/AddUsingPath\(decodedurl='installation\.json',overwrite=false\)$/);
          assert.equal(options.method, 'POST');
          assert.equal(options.headers['Content-Type'], 'application/json');
          assert.ok(options.body instanceof Uint8Array, 'Upload JSON-encoded bytes, not an object envelope');
          if (server.config !== null) conflict();
          server.config = JSON.parse(new TextDecoder().decode(options.body));
          return output({ ServerRelativeUrl: `${libraryPath}/installation.json` }, `"config-${server.configRevision}"`, 201);
        }
        throw new Error(`Unexpected request: ${options.method} ${url}`);
      }
    }
  };
  return server;
}

const memoryServer = createInstallationMemoryServer;

const portFor = server => createSharePointInstallationPort({
  transport: server.transport, webUrl: server.webUrl, libraryPath: server.libraryPath,
  mutationTransportFactory: writeGuard => ({ async request(url, options) {
    assert.ok(options.signal instanceof AbortSignal);
    await server.beforeMutationDispatch?.(url, options);
    writeGuard();
    return server.transport.request(url, options);
  } })
});

function digestPort(server, beforeDigest) {
  let digests = 0;
  const signals = [];
  const response = result => ({
    ok: result.status >= 200 && result.status < 300, status: result.status,
    headers: { get: name => name.toLowerCase() === 'etag' ? result.etag ?? null : null },
    text: async () => result.status === 204 ? '' : JSON.stringify(result.data)
  });
  const port = createSharePointInstallationPort({
    transport: server.transport, webUrl: server.webUrl, libraryPath: server.libraryPath,
    mutationTransportFactory: writeGuard => createSharePointRestClient({
      webUrl: server.webUrl, maxRetries: 0,
      fetchImpl: (url, init) => {
        if (!url.endsWith('/_api/contextinfo')) signals.push(init.signal);
        writeGuard(); // Actual dispatch check, not just entry to transport.request.
        if (url.endsWith('/_api/contextinfo')) return (async () => {
          await beforeDigest(++digests);
          return response({ status: 200, data: { FormDigestValue: 'memory-only', FormDigestTimeoutSeconds: 1800 } });
        })();
        const method = init.headers['X-HTTP-Method'] ?? init.method;
        const body = init.body instanceof Uint8Array || init.body === undefined ? init.body : JSON.parse(init.body);
        return server.transport.request(url, { method, body, etag: init.headers['If-Match'], headers: init.headers, signal: init.signal }).then(response);
      }
    })
  });
  return { port, signals };
}
const writes = server => server.calls.filter(call => call.method !== 'GET');
const listRead = call => /\/lists\/getbytitle\('[^']+'\)\?/.test(call.url);
const fileRead = call => /GetFileByServerRelativePath/.test(call.url) && !call.url.includes('/$value');

export async function runSharePointInstallationTests() {
  {
    const server=memoryServer();const port=portFor(server);const created=await port.provisionList('categories',{expectedAbsent:true});
    await assert.rejects(port.removeVerifiedEmptyList({domain:'categories',id:created.id,fingerprint:created.fingerprint},{confirm:false}));
    await port.removeVerifiedEmptyList({domain:'categories',id:created.id,fingerprint:created.fingerprint},{confirm:true});
    assert.equal(server.lists.size,0);
    const other=await port.provisionList('tags',{expectedAbsent:true});server.lists.get('tags').ItemCount=1;
    await assert.rejects(port.removeVerifiedEmptyList({domain:'tags',id:other.id,fingerprint:other.fingerprint},{confirm:true}));assert.equal(server.lists.size,1);
  }
  const cases = [];
  const test = async (name, run) => { await run(); cases.push(name); };

  await test('1. explicit context/root defaults, no fixed tenant and invalid-path rejection', async () => {
    for (const webUrl of [WEB, '/sites/another/subweb', '/']) {
      const server = memoryServer({ webUrl });
      const port = createSharePointInstallationPort({ transport: server.transport, webUrl });
      assert.equal(port.libraryPath, `${webUrl === '/' ? '' : webUrl}/SiteAssets/minijoomla`);
      assert.equal(port.webUrl, webUrl);
      assert.equal(server.calls.length, 0);
      const view = await port.inspect();
      assert.equal(view.lists.length, 8);
      assert.equal(view.configurationExists, false);
      assert.equal(writes(server).length, 0);
    }
    for (const webUrl of ['https://example.invalid/sites/a', '//example.invalid', '/sites/../a', '/sites/%2e%2e/a', '/sites/a?x=1', '/sites/a\\b', '/sites/a/']) assert.throws(() => createSharePointInstallationPort({ transport: { request() {} }, webUrl }));
    for (const libraryPath of ['/sites/other/SiteAssets/mj', `${WEB}/SiteAssetsSibling/mj`, `${WEB}/SiteAssets`, `${LIBRARY}/../other`]) assert.throws(() => createSharePointInstallationPort({ transport: { request() {} }, webUrl: WEB, libraryPath }));
    assert.throws(() => createSharePointInstallationPort({ transport: { webUrl: '/sites/other', request() {} }, webUrl: WEB }));
  });

  await test('2. only exact HTTP 404 represents missing; 403/503 and code-only errors fail closed', async () => {
    for (const status of [403, 503, undefined]) {
      const server = memoryServer();
      server.hook = call => { if (listRead(call)) throw Object.assign(new Error('private raw text'), { code: 'not-found', ...(status === undefined ? {} : { status }) }); };
      await assert.rejects(portFor(server).inspect(), error => !error.message.includes('private') && error.status === status);
      assert.equal(writes(server).length, 0);
    }
    const returned = memoryServer(); returned.hook = call => listRead(call) ? { data: { Exists: false }, status: 404 } : undefined;
    assert.ok((await portFor(returned).inspect()).lists.every(list => !list.exists));
    returned.hook = call => listRead(call) ? { status: 403, data: {} } : undefined;
    await assert.rejects(portFor(returned).inspect());
  });

  await test('3. canonical lists strict fields/indexes and unknown fields stay readonly and private', async () => {
    const server = memoryServer(); server.seedAll();
    server.lists.get('articles').fields.push({ InternalName: 'UnknownExtension', TypeAsString: 'Text', Required: false, Indexed: false, EnforceUniqueValues: false, DefaultValue: null, revision: 1 });
    server.lists.get('articles').rows.push({ Id: 1, secret: 'never-read' }); server.lists.get('articles').ItemCount = 1;
    const before = clone([...server.lists.values()]);
    const view = await portFor(server).inspect();
    assert.deepEqual(view.lists.map(list => list.title), DOMAINS.map(domain => MINIJOOMLA_SCHEMAS[domain].displayName));
    assert.ok(view.lists.every(list => list.compatible && /^[a-f0-9]{64}$/.test(list.fingerprint)));
    assert.equal(view.lists.find(list => list.domain === 'articles').empty, false);
    assert.equal(view.lists.find(list => list.domain === 'articles').itemCount, 1);
    assert.equal(JSON.stringify(view).includes('never-read'), false);
    assert.equal(JSON.stringify(view).includes('UnknownExtension'), false);
    assert.deepEqual([...server.lists.values()], before);
    assert.ok(server.calls.every(call => call.method === 'GET' && !call.url.includes('/items')));
  });

  await test('4. wrong/missing type, required, defaults, choices and indexes are incompatible', async () => {
    const mutations = [
      field => { delete field.TypeAsString; }, field => { field.TypeAsString = 'User'; },
      field => { field.Required = false; }, field => { delete field.Required; },
      field => { field.Indexed = false; }, field => { field.EnforceUniqueValues = false; },
      field => { delete field.DefaultValue; }, field => { field.DefaultValue = 'wrong'; }
    ];
    for (const mutate of mutations) {
      const server = memoryServer(), list = server.seed('articles');
      mutate(list.fields.find(field => field.InternalName === 'Alias'));
      const report = (await portFor(server).inspect()).lists.find(list => list.domain === 'articles');
      assert.equal(report.compatible, false); assert.ok(report.issues.length);
      assert.equal(writes(server).length, 0);
    }
    for (const choices of [{ results: ['Draft', 'Published', 'Archived', 'Trashed'] }, undefined]) {
      const server = memoryServer(), list = server.seed('articles');
      list.fields.find(field => field.InternalName === 'State').Choices = choices;
      assert.equal((await portFor(server).verifyList('articles', list.Id)).compatible, false);
    }
    const missing = memoryServer(), list = missing.seed('articles'); list.fields = list.fields.filter(field => field.InternalName !== 'Author0');
    assert.equal((await portFor(missing).verifyList('articles', list.Id)).compatible, false);
  });

  await test('5. complete paginated minimal/verbose collections and deterministic fingerprints', async () => {
    const server = memoryServer(); server.seedAll();
    const port = portFor(server), initial = await port.inspect();
    for (const shape of ['minimal', 'verbose']) {
      server.responseShape = shape; server.pageSize = 3;
      const view = await port.inspect(); assert.deepEqual(view, initial);
    }
    server.lists.get('articles').fields.reverse();
    assert.deepEqual(await port.inspect(), initial);
    server.lists.get('articles').fields.find(field => field.InternalName === 'Alias').Indexed = false;
    assert.notEqual((await port.inspect()).lists[0].fingerprint, initial.lists[0].fingerprint);
  });

  await test('6. incomplete collections, 404 fields, unsafe/cyclic pagination and missing metadata block', async () => {
    for (const data of [{}, { value: [], complete: false }, { value: [], truncated: true }, { value: [], 'odata.count': '20' }, { value: {}, 'odata.nextLink': null }, { value: [], 'odata.nextLink': 'https://evil.invalid/_api/web/fields' }, { value: [], 'odata.nextLink': '' }, { value: [], 'odata.nextLink': `${WEB}/_api/web/lists/getbytitle('MiniJoomlaArticles')/fields?$select=${'InternalName,Title,TypeAsString,Required,Indexed,EnforceUniqueValues,Choices,DefaultValue'}` }]) {
      const server = memoryServer(); server.seed('articles');
      server.hook = call => call.url.includes('/fields?') ? { data, status: 200 } : undefined;
      await assert.rejects(portFor(server).inspect()); assert.equal(writes(server).length, 0);
    }
    for (const status of [404, 403, 503]) {
      const server = memoryServer(); server.seed('articles');
      server.hook = call => call.url.includes('/fields?') ? { status, data: {} } : undefined;
      await assert.rejects(portFor(server).inspect());
    }
    for (const missing of ['Id', 'ItemCount', 'BaseTemplate']) {
      const server = memoryServer(), list = server.seed('articles');
      server.hook = call => { if (listRead(call)) { const data = { Id: list.Id, Title: list.Title, ItemCount: 0, BaseTemplate: 100 }; delete data[missing]; return { status: 200, data }; } };
      await assert.rejects(portFor(server).inspect());
    }
  });

  await test('7. GUID is required, unknown/mismatched IDs and identity changes cannot verify', async () => {
    const server = memoryServer(), list = server.seed('articles'), port = portFor(server);
    for (const value of ['not-a-guid', guid(99), null]) await assert.rejects(port.verifyList('articles', value));
    await assert.rejects(port.verifyList('unknown', list.Id));
    list.Id = 'not-a-guid'; await assert.rejects(port.inspect());
    list.Id = guid(1); let reads = 0;
    server.hook = call => { if (listRead(call) && call.url.includes('MiniJoomlaArticles') && ++reads === 2) list.Id = guid(2); };
    await assert.rejects(port.verifyList('articles', guid(1)));
  });

  await test('8. preexisting lists/data never adopt or mutate and creation demands expectedAbsent', async () => {
    const server = memoryServer(); server.seed('articles', { itemCount: 1 }); const before = clone([...server.lists.values()]);
    const port = portFor(server);
    await assert.rejects(port.provisionList('articles', { expectedAbsent: true }));
    await assert.rejects(port.provisionList('categories'));
    assert.deepEqual([...server.lists.values()], before); assert.equal(writes(server).length, 0);
  });

  await test('9. double absence check catches a concurrent list before POST', async () => {
    const server = memoryServer(); let reads = 0;
    server.hook = call => { if (listRead(call) && ++reads === 2) server.seed('articles', { itemCount: 1 }); };
    await assert.rejects(portFor(server).provisionList('articles', { expectedAbsent: true }));
    assert.equal(writes(server).length, 0); assert.equal(server.lists.get('articles').ItemCount, 1);
    const exclusive = memoryServer(); exclusive.hook = call => { if (call.method === 'POST' && call.url.endsWith('/lists')) exclusive.seed('articles', { itemCount: 1 }); };
    await assert.rejects(portFor(exclusive).provisionList('articles', { expectedAbsent: true }), error => error.status === 412);
    assert.equal(exclusive.lists.get('articles').ItemCount, 1);
    assert.equal(writes(exclusive).length, 1);
  });

  await test('10. create all eight empty lists: native Title, Author0, no Folder, strict defaults/choices/uniqueness', async () => {
    const server = memoryServer(), port = portFor(server);
    for (const domain of DOMAINS) {
      const result = await port.provisionList(domain, { expectedAbsent: true });
      assert.equal(result.compatible, true); assert.equal(result.empty, true); assert.equal(result.itemCount, 0);
      assert.deepEqual(await port.verifyList(domain, result.id), result);
    }
    assert.equal(server.config, null); assert.ok([...server.lists.values()].every(list => list.ItemCount === 0 && list.rows.length === 0));
    assert.equal(server.lists.get('articles').fields.find(field => field.InternalName === 'Author0').TypeAsString, 'Text');
    assert.equal(server.lists.get('articles').fields.find(field => field.InternalName === 'Author').TypeAsString, 'User');
    assert.equal(server.lists.get('extensions').fields.some(field => field.InternalName === 'Folder'), false);
    assert.equal(server.lists.get('extensions').fields.find(field => field.InternalName === 'ManifestJson').TypeAsString, 'Note');
    for (const [domain, name] of [['articles', 'Alias'], ['categories', 'Alias'], ['tags', 'Title'], ['extensions', 'Key'], ['templates', 'Key']]) {
      const field = server.lists.get(domain).fields.find(field => field.InternalName === name); assert.equal(field.Indexed, true); assert.equal(field.EnforceUniqueValues, true);
    }
    assert.equal(server.lists.get('siteConfig').fields.find(field => field.InternalName === 'Title').DefaultValue, 'MiniJoomlaSiteConfig');
    assert.ok(writes(server).length < 200, 'Avoid hundreds of repeated migration writes per list');
    assert.ok(writes(server).every(call => !/\/items|\/indexes|\/recycle|DELETE/.test(call.url)));
  });

  await test('11. narrow native Title/field patches always use fresh exact ETags', async () => {
    const server = memoryServer(); await portFor(server).provisionList('siteConfig', { expectedAbsent: true });
    const patch = server.calls.find(call => call.method === 'MERGE' && call.url.includes("('Title')"));
    assert.deepEqual(patch.body, { __metadata: { type: 'SP.Field' }, DefaultValue: 'MiniJoomlaSiteConfig' });
    assert.equal(patch.etag, '"field-1"'); assert.equal(patch.headers['If-Match'], '"field-1"');
    const position = server.calls.indexOf(patch);
    assert.equal(server.calls[position - 2].url, `${patch.url}?$select=InternalName,Title,TypeAsString,Required,Indexed,EnforceUniqueValues,Choices,DefaultValue`);
    assert.equal(server.calls[position + 1].method, 'GET');
    assert.equal(server.calls[position + 1].url.split('?')[0], patch.url);
  });

  await test('12. missing/weak/wildcard field ETags fail before any patch', async () => {
    for (const fieldETag of ['weak', 'wildcard']) {
      const server = memoryServer(); server.fieldETag = fieldETag;
      await assert.rejects(portFor(server).provisionList('siteConfig', { expectedAbsent: true }), error => error.code === 'etag-required');
      assert.equal(writes(server).length, 1); assert.equal(server.lists.get('siteConfig').ItemCount, 0);
    }
    const missing=memoryServer();missing.fieldETag='missing';await portFor(missing).provisionList('siteConfig',{expectedAbsent:true});assert.equal(missing.lists.get('siteConfig').fields.find(field=>field.InternalName==='Title').DefaultValue,'MiniJoomlaSiteConfig');
  });

  await test('13. ETag conflict and concurrent data stop owned-list field changes without cleanup', async () => {
    const server = memoryServer();
    server.hook = call => { if (call.method === 'POST' && call.url.endsWith('/lists')) { const list=server.seed('articles');list.fields=[{InternalName:'Title',Title:'Title',TypeAsString:'Text',Required:false,Indexed:false,EnforceUniqueValues:false,DefaultValue:null,revision:1}];return {status:201,data:{Id:list.Id,Title:list.Title}}; } if (call.method === 'MERGE') server.lists.get('articles').fields.find(field => field.InternalName === 'Title').revision++; };
    await assert.rejects(portFor(server).provisionList('articles', { expectedAbsent: true }), error => error.status === 412 && !error.message.includes('credentials'));
    assert.equal(server.lists.get('articles').fields.find(field => field.InternalName === 'Title').Required, false);
    assert.ok(server.lists.has('articles')); assert.equal(writes(server).length, 2);
    const data = memoryServer(); let reads = 0;
    data.hook = call => { if (listRead(call) && ++reads === 4) { const list = data.lists.get('articles'); list.ItemCount = 1; list.rows = [{ Id: 1, Title: 'Concurrent' }]; } };
    await assert.rejects(portFor(data).provisionList('articles', { expectedAbsent: true }));
    assert.equal(writes(data).length, 1); assert.equal(data.lists.get('articles').rows[0].Title, 'Concurrent');
    const ignored = memoryServer();
    ignored.hook = call => call.method === 'MERGE' ? { data: null, status: 204, etag: '\"field-2\"' } : undefined;
    await assert.rejects(portFor(ignored).provisionList('siteConfig', { expectedAbsent: true }), error => error.code === 'unverified-created-field');
    assert.equal(writes(ignored).length, 2); assert.ok(ignored.lists.has('siteConfig'));
  });

  await test('14. validated config reconstruction rejects getters, unknown keys/version/context and implicit roots/styles', async () => {
    const server = memoryServer(); server.seedAll(); const valid = configuration(server);
    assert.deepEqual(validateInstallationConfiguration(valid, { webUrl: WEB, libraryPath: LIBRARY }), valid);
    let accessed = false; const getter = { ...valid }; Object.defineProperty(getter, 'initialSite', { enumerable: true, get() { accessed = true; return valid.initialSite; } });
    assert.throws(() => validateInstallationConfiguration(getter)); assert.equal(accessed, false);
    for (const mutate of [value => { value.version = 1; }, value => { value.format = 'v2'; }, value => { value.libraryPath = '/sites/other/SiteAssets/mj'; }, value => { value.initialSite.templateKey = 'external'; }, value => { value.initialSite.pageSize = 0; }, value => { value.initialSite.homeCategory = 'noticias'; }, value => { value.joomlaDiscoveryRoots = ['/sites/other/extension']; }, value => { value.moduleStyles.external = ['/secret.css']; }, value => { value.lists.tags.listId = value.lists.articles.listId; }]) {
      const value = clone(valid); mutate(value);
      assert.throws(() => validateInstallationConfiguration(value, { webUrl: WEB, libraryPath: LIBRARY }));
    }
    await assert.rejects(portFor(server).writeConfiguration(getter, { expectedAbsent: true })); assert.equal(writes(server).length, 0);
  });

  await test('15. exclusive UTF-8 config upload, readback strong ETag and zero configuration rows', async () => {
    const server = memoryServer(); server.seedAll(); const port = portFor(server), value = configuration(server); value.initialSite.siteName = 'Instalação';
    const result = await port.writeConfiguration(value, { expectedAbsent: true });
    assert.deepEqual(result, { configuration: value, etag: '"config-1"' });
    const view = await port.inspect(); assert.deepEqual(view.configuration, value); assert.equal(view.configurationETag, result.etag);
    assert.equal(view.configurationExists, true); assert.ok(view.lists.every(list => list.empty)); assert.equal(server.lists.get('siteConfig').rows.length, 0);
    assert.equal(writes(server).length, 1);
    const upload = writes(server)[0], index = server.calls.indexOf(upload);
    assert.ok(fileRead(server.calls[index - 1]));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(upload.body)), value);
    await assert.rejects(port.writeConfiguration(value, { expectedAbsent: true })); assert.equal(writes(server).length, 1);
  });

  await test('16. config unknown keys preserved; missing/weak ETags, 403, absent base and upload races block', async () => {
    const existing = memoryServer(); existing.seedAll(); existing.config = { ...configuration(existing), future: { untouched: true } };
    const prior = clone(existing.config); const report = await portFor(existing).inspect(); assert.deepEqual(report.configuration, prior); assert.deepEqual(existing.config, prior);
    const service = createInstallationService({ port: portFor(existing), journalStore: { read: () => null, write() {} } });
    assert.equal((await service.inspect()).status, 'blocked'); assert.equal(writes(existing).length, 0);
    for (const etag of [null, '*', 'W/"file-1"']) {
      const server = memoryServer(); server.seedAll(); server.config = configuration(server);
      server.hook = call => fileRead(call) ? { data: { Exists: true, ServerRelativeUrl: `${LIBRARY}/installation.json` }, status: 200, etag } : undefined;
      await assert.rejects(portFor(server).inspect());
    }
    for (const status of [403, 503]) {
      const server = memoryServer(); server.seedAll(); server.hook = call => fileRead(call) ? { status, data: {} } : undefined;
      await assert.rejects(portFor(server).writeConfiguration(configuration(server), { expectedAbsent: true })); assert.equal(writes(server).length, 0);
    }
    const absent = memoryServer(); absent.seedAll(); absent.folderExists = false;
    await assert.rejects(portFor(absent).writeConfiguration(configuration(absent), { expectedAbsent: true })); assert.equal(writes(absent).length, 0);
    for (const raceAtUpload of [false, true]) {
      const race = memoryServer(); race.seedAll(); let reads = 0;
      race.hook = call => { if (raceAtUpload ? call.method === 'POST' : fileRead(call) && ++reads === 2) race.config = { old: 'preserve' }; };
      await assert.rejects(portFor(race).writeConfiguration(configuration(race), { expectedAbsent: true }));
      assert.deepEqual(race.config, { old: 'preserve' }); assert.equal(writes(race).length, raceAtUpload ? 1 : 0);
    }
    const changed = memoryServer(); changed.seedAll(); changed.config = configuration(changed);
    changed.hook = call => { if (call.url.endsWith('/$value')) changed.configRevision++; };
    await assert.rejects(portFor(changed).inspect());
  });

  await test('17. engine integration installs empty once, durable receipts and readonly repeated inspection', async () => {
    const server = memoryServer(), port = portFor(server); let record = null;
    const journalStore = { read: () => clone(record), write: value => { record = clone(value); } };
    const service = createInstallationService({ port, journalStore });
    const plan = await service.inspect(); assert.equal(plan.status, 'ready');
    const result = await service.install({ confirm: true, planToken: plan.plan.token, settings: { siteName: 'Example' } });
    assert.equal(result.status, 'installed', result.message);
    assert.equal(record.receipts.length, 8); assert.equal(record.pending, null); assert.equal(record.configurationReceipt.etag, '"config-1"');
    assert.equal(server.lists.size, 8); assert.ok([...server.lists.values()].every(list => list.rows.length === 0 && list.ItemCount === 0));
    assert.equal(result.configuration.initialSite.templateKey, 'cassiopeia'); assert.equal(result.configuration.initialSite.homeCategory, '');
    const before = clone([...server.lists.values()]), count = writes(server).length;
    assert.equal((await service.inspect()).status, 'installed'); assert.equal(writes(server).length, count); assert.deepEqual([...server.lists.values()], before);
    const second = createInstallationService({ port: portFor(server), journalStore: { read: () => null, write() {} } });
    assert.equal((await second.inspect()).status, 'installed'); assert.equal(writes(server).length, count);
  });

  await test('18. ordinary transport permits inspection only; missing/invalid dispatch factories fail closed', async () => {
    const server = memoryServer();
    const port = createSharePointInstallationPort({ transport: server.transport, webUrl: WEB });
    assert.equal((await port.inspect()).configurationExists, false);
    await assert.rejects(port.provisionList('articles', { expectedAbsent: true }), error => error.code === 'dispatch-guard-required');
    server.seedAll();
    await assert.rejects(port.writeConfiguration(configuration(server), { expectedAbsent: true }), error => error.code === 'dispatch-guard-required');
    assert.equal(writes(server).length, 0);
    const invalid = createSharePointInstallationPort({ transport: memoryServer().transport, webUrl: WEB, mutationTransportFactory: () => null });
    await assert.rejects(invalid.provisionList('articles', { expectedAbsent: true }), error => error.code === 'invalid-mutation-transport');
  });

  await test('19. cancellation after either awaited absence read prevents list POST', async () => {
    for (const cancelAt of [1, 2]) {
      const server = memoryServer(); let active = true, reads = 0;
      server.hook = call => { if (listRead(call) && ++reads === cancelAt) active = false; };
      await assert.rejects(portFor(server).provisionList('articles', { expectedAbsent: true, isCurrent: () => active }), error => error.code === 'stale-operation');
      assert.equal(writes(server).length, 0); assert.equal(server.calls.length, cancelAt);
    }
    const server = memoryServer();
    await assert.rejects(portFor(server).provisionList('articles', { expectedAbsent: true, isCurrent: () => false }));
    await assert.rejects(portFor(server).provisionList('articles', { expectedAbsent: true, isCurrent: false }));
    assert.equal(server.calls.length, 0);
  });

  await test('20. cancellation after awaited owned/field reads prevents field POST and MERGE', async () => {
    for (const cancelAt of [3, 4, 5]) {
      const server = memoryServer(); let active = true, reads = 0;
      server.hook = call => { if (listRead(call) && ++reads === cancelAt) active = false; };
      await assert.rejects(portFor(server).provisionList('articles', { expectedAbsent: true, isCurrent: () => active }));
      assert.equal(writes(server).length, cancelAt === 5 ? 2 : 1);
      assert.equal(server.lists.get('articles').fields.some(field => field.InternalName === 'Alias'), cancelAt === 5);
    }
    const server = memoryServer(); let active = true;
    server.hook = call => { if (call.method === 'GET' && call.url.includes("getbyinternalnameortitle('Title')")) active = false; };
    await assert.rejects(portFor(server).provisionList('articles', { expectedAbsent: true, isCurrent: () => active }));
    assert.equal(writes(server).length, 1);
    assert.equal(server.lists.get('articles').fields[0].Required, true);
    const accepted = memoryServer(); let current = true;
    accepted.hook = call => { if (call.method === 'MERGE') current = false; };
    await assert.rejects(portFor(accepted).provisionList('siteConfig', { expectedAbsent: true, isCurrent: () => current }));
    assert.equal(writes(accepted).length, 2);
    assert.equal(accepted.calls.at(-1).method, 'MERGE');
    assert.equal(accepted.calls.at(-1).signal.aborted, true);
    assert.equal(accepted.lists.get('siteConfig').fields[0].Required, true, 'Already-dispatched mutation is uncertain, not automatically rolled back');
  });

  await test('21. configuration cancellation after metadata/folder/verification reads prevents upload', async () => {
    for (const cancelAt of ['first-metadata', 'last-metadata', 'folder', 'verification']) {
      const server = memoryServer(); server.seedAll(); let active = true, metadataReads = 0;
      server.hook = call => {
        if (fileRead(call) && ++metadataReads === (cancelAt === 'last-metadata' ? 2 : 1) && cancelAt.includes('metadata')) active = false;
        if (cancelAt === 'folder' && call.url.includes('GetFolderByServerRelativePath')) active = false;
        if (cancelAt === 'verification' && call.url.includes('/fields?')) active = false;
      };
      await assert.rejects(portFor(server).writeConfiguration(configuration(server), { expectedAbsent: true, isCurrent: () => active }), error => error.code === 'stale-operation');
      assert.equal(writes(server).length, 0); assert.equal(server.config, null);
    }
  });

  await test('22. actual SPMIDDLE awaited digest boundary blocks every mutation kind and aborts its signal', async () => {
    for (const target of ['list', 'merge', 'field', 'configuration']) {
      const server = memoryServer(); let active = true;
      if (target === 'configuration') server.seedAll();
      const cancelDigest = target === 'merge' ? 2 : target === 'field' ? 3 : 1;
      const { port, signals } = digestPort(server, async count => { await Promise.resolve(); if (count === cancelDigest) active = false; });
      await assert.rejects(target === 'configuration'
        ? port.writeConfiguration(configuration(server), { expectedAbsent: true, isCurrent: () => active })
        : port.provisionList('siteConfig', { expectedAbsent: true, isCurrent: () => active }));
      assert.equal(writes(server).length, cancelDigest - 1);
      assert.equal(signals.at(-1).aborted, true, 'Dispatch guard aborts the per-mutation signal after digest resolves');
      if (target === 'list') assert.equal(server.lists.size, 0);
      if (target === 'merge') assert.equal(server.lists.get('siteConfig').fields[0].DefaultValue, null);
      if (target === 'field') assert.equal(server.lists.get('siteConfig').fields.some(field => field.InternalName === 'SiteName'), false);
      if (target === 'configuration') assert.equal(server.config, null);
    }
  });

  await test('23. explicit lifecycle AbortSignal crosses digest wait and engine retains uncertain intent', async () => {
    const server = memoryServer(), controller = new AbortController();
    const { port, signals } = digestPort(server, async () => { controller.abort(); await Promise.resolve(); });
    await assert.rejects(port.provisionList('articles', { expectedAbsent: true, signal: controller.signal }), error => error.code === 'operation-aborted');
    assert.equal(writes(server).length, 0); assert.equal(signals.at(-1).aborted, true);
    const cancelled = memoryServer(), prior = new AbortController(); prior.abort();
    await assert.rejects(portFor(cancelled).provisionList('articles', { expectedAbsent: true, signal: prior.signal }));
    assert.equal(cancelled.calls.length, 0);
    const engineServer = memoryServer(); let active = true, record = null;
    engineServer.beforeMutationDispatch = async () => { active = false; };
    const service = createInstallationService({ port: portFor(engineServer), journalStore: { read: () => clone(record), write: value => { record = clone(value); } } });
    const plan = await service.inspect();
    const result = await service.install({ confirm: true, planToken: plan.plan.token, settings: { siteName: 'Example' }, isCurrent: () => active });
    assert.equal(result.status, 'partial'); assert.equal(result.canResume, false);
    assert.deepEqual(record.pending, { kind: 'list', domain: 'categories' });
    assert.equal(writes(engineServer).length, 0);
  });

  assert.equal(cases.length, 23);
  console.log('ok - SharePoint installation: 23 in-memory cases, strict readonly inspection, ETags/exclusive creation, cancellation at every boundary and actual SPMIDDLE digest dispatch');
}
