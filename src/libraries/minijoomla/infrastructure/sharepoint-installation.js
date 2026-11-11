/* Creation-only SharePoint installation port. Importing this module does no I/O.
 * Existing lists/fields/files are never adopted, updated, deleted or retried.
 * SPMIDDLE schemas stay in infrastructure; Folder is a reserved navigation member,
 * not a custom field in a new Extensions list (groups live in ManifestJson).
 */
import { MINIJOOMLA_SCHEMAS } from './spmiddle-schemas.js';

const DOMAINS = Object.freeze(Object.keys(MINIJOOMLA_SCHEMAS));
const FORMAT = 'minijoomla-installation-v1';
const MAX_CONFIG_BYTES = 256 * 1024;
const FIELD_SELECT = 'InternalName,Title,TypeAsString,Required,Indexed,EnforceUniqueValues,Choices,DefaultValue';
const LIST_SELECT = 'Id,Title,BaseTemplate,ItemCount';
const FIELD_TYPES = Object.freeze({ Text: 2, MultilineText: 3, Number: 9, DateTime: 4, Boolean: 8, Choice: 6 });
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const strongETag = value => typeof value === 'string' && /^"[^"\u0000-\u001f\u007f]{1,200}"$/.test(value);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);

function fail(code, status) {
  const error = new Error('A infraestrutura de instalação não pôde ser verificada ou persistida.');
  error.code = code;
  if (status !== undefined) error.status = status;
  throw error;
}

// Descriptors, not property access: getters/toJSON must never run on input data.
// Unknown own JSON keys are preserved for inspection, not silently normalized.
function jsonData(input) {
  let nodes = 0;
  const seen = new Set();
  function copy(value, depth) {
    if (++nodes > 10000 || depth > 20) fail('invalid-data');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || seen.has(value)) fail('invalid-data');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('invalid-data');
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string')) fail('invalid-data');
    if (array && (keys.length !== value.length + 1 || keys.filter(key => key !== 'length').some((key, index) => key !== String(index)))) fail('invalid-data');
    seen.add(value);
    const result = array ? [] : {};
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('invalid-data');
      Object.defineProperty(result, key, { value: copy(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    seen.delete(value);
    return result;
  }
  const result = copy(input, 0);
  if (new TextEncoder().encode(canonical(result)).length > MAX_CONFIG_BYTES) fail('invalid-data');
  return result;
}

function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) fail('unsupported-configuration');
}

function path(value) {
  if (typeof value !== 'string' || !value || value.length > 1000 || !value.startsWith('/') || value.startsWith('//') || /[\\?#%:'"<>\u0000-\u0020\u007f]/.test(value) || value.includes('//') || value.split('/').some(part => part === '.' || part === '..') || value !== '/' && value.endsWith('/')) fail('invalid-context');
  return value;
}

function installationContext(webUrl, libraryPath) {
  const web = path(webUrl);
  const siteAssets = `${web === '/' ? '' : web}/SiteAssets`;
  const library = path(libraryPath ?? `${siteAssets}/minijoomla`);
  if (!library.startsWith(`${siteAssets}/`)) fail('invalid-context');
  return { webUrl: web, libraryPath: library };
}

function id(value) {
  if (typeof value !== 'string' || !GUID.test(value) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value)) fail('invalid-list-identity');
  return value.toLowerCase();
}

const text = (value, limit, empty = false) => typeof value === 'string' && value.length <= limit && (empty || Boolean(value.trim())) && !/[\u0000-\u001f\u007f]/.test(value);

/** Validate without evaluating callbacks/getters, dropping keys or adding defaults.
 * Optional context pins a host to the current web and copied package directory.
 */
export function validateInstallationConfiguration(input, context) {
  const value = jsonData(input);
  keys(value, ['format', 'state', 'webUrl', 'libraryPath', 'lists', 'initialSite', 'joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions']);
  const ctx = installationContext(value.webUrl, value.libraryPath);
  if (value.format !== FORMAT || value.state !== 'installed' || context && (ctx.webUrl !== context.webUrl || ctx.libraryPath !== context.libraryPath)) fail('unsupported-configuration');
  keys(value.lists, DOMAINS);
  const ids = new Set();
  for (const domain of DOMAINS) {
    keys(value.lists[domain], ['listId']);
    const guid = id(value.lists[domain].listId);
    if (ids.has(guid)) fail('invalid-list-identity');
    ids.add(guid);
  }
  const site = value.initialSite;
  keys(site, ['siteName', 'siteDescription', 'timezone', 'language', 'pageSize', 'templateKey', 'homeView', 'homeCategory', 'offline', 'offlineMessage']);
  if (!text(site.siteName, 200) || site.siteName !== site.siteName.trim() || !text(site.siteDescription, 2000, true) || !text(site.timezone, 100) || !text(site.language, 35) || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(site.language) || !Number.isSafeInteger(site.pageSize) || site.pageSize < 1 || site.pageSize > 50 || site.templateKey !== 'cassiopeia' || site.homeView !== 'featured' || site.homeCategory !== '' || site.offline !== false || site.offlineMessage !== '') fail('unsupported-configuration');
  try { new Intl.DateTimeFormat('en', { timeZone: site.timezone }); } catch { fail('unsupported-configuration'); }
  // Initial installation has no extension roots/styles or native/editorial rows.
  // Later extension configuration belongs to its own explicit installation flow.
  if (!Array.isArray(value.joomlaDiscoveryRoots) || value.joomlaDiscoveryRoots.length || !value.moduleStyles || Array.isArray(value.moduleStyles) || typeof value.moduleStyles !== 'object' || Object.keys(value.moduleStyles).length || !value.moduleStyleRevisions || Array.isArray(value.moduleStyleRevisions) || typeof value.moduleStyleRevisions !== 'object' || Object.keys(value.moduleStyleRevisions).length) fail('unsupported-configuration');
  return value;
}

function policy(domain) {
  const schema = MINIJOOMLA_SCHEMAS[domain];
  if (!Object.hasOwn(MINIJOOMLA_SCHEMAS, domain)) fail('unknown-domain');
  return schema.fields.filter(field => !(domain === 'extensions' && field.internalName === 'Folder')).map(field => {
    const index = schema.indexes.find(entry => entry.fields.includes(field.internalName));
    return {
      name: field.internalName, title: field.displayName ?? field.internalName,
      type: field.type === 'MultilineText' ? 'Note' : field.type,
      kind: FIELD_TYPES[field.type], required: field.required === true,
      indexed: Boolean(index), unique: index?.unique === true,
      choices: field.choices ? [...field.choices] : null,
      defaultValue: field.defaultValue === undefined ? '' : typeof field.defaultValue === 'boolean' ? field.defaultValue ? '1' : '0' : String(field.defaultValue)
    };
  });
}

async function fingerprint(value) {
  if (!globalThis.crypto?.subtle?.digest) fail('hash-unavailable');
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

const quote = value => encodeURIComponent(value.replaceAll("'", "''"));
const entity = response => response.data?.d ?? response.data;
function etag(response) {
  const value = response.etag ?? entity(response)?.ETag ?? entity(response)?.['odata.etag'] ?? entity(response)?.['@odata.etag'] ?? entity(response)?.__metadata?.etag;
  if (!strongETag(value)) fail('etag-required');
  return value;
}

function fieldPolicy(field, expected) {
  const choices = Array.isArray(field.Choices) ? field.Choices : field.Choices?.results;
  const actual = {
    name: field.InternalName,
    type: field.TypeAsString ?? null,
    required: typeof field.Required === 'boolean' ? field.Required : null,
    indexed: typeof field.Indexed === 'boolean' ? field.Indexed : null,
    unique: typeof field.EnforceUniqueValues === 'boolean' ? field.EnforceUniqueValues : null,
    choices: expected.choices ? Array.isArray(choices) && choices.every(choice => typeof choice === 'string') ? choices : null : null,
    defaultValue: !Object.hasOwn(field, 'DefaultValue') ? null : field.DefaultValue === null ? '' : typeof field.DefaultValue === 'string' ? field.DefaultValue : null
  };
  const issues = [];
  for (const property of ['type', 'required', 'indexed', 'unique', 'choices', 'defaultValue']) if (canonical(actual[property]) !== canonical(expected[property])) issues.push(`${expected.name}:${property}`);
  return { actual, issues };
}

/** mutationTransportFactory(writeGuard) is a trusted dispatch adapter. It must
 * return a client whose fetchImpl calls writeGuard synchronously immediately
 * before actual fetch dispatch, including after awaited digest acquisition, and
 * forwards the request's AbortSignal. An ordinary transport enables reads only.
 */
export function createSharePointInstallationPort({ transport, webUrl, libraryPath, mutationTransportFactory } = {}) {
  if (!transport || typeof transport.request !== 'function') throw new TypeError('transport.request deve ser uma função.');
  if (mutationTransportFactory !== undefined && typeof mutationTransportFactory !== 'function') throw new TypeError('mutationTransportFactory deve ser uma função.');
  const ctx = installationContext(webUrl, libraryPath);
  if (transport.webUrl !== undefined && (transport.webUrl === '' ? '/' : path(transport.webUrl)) !== ctx.webUrl) fail('invalid-context');
  const api = `${ctx.webUrl === '/' ? '' : ctx.webUrl}/_api/web`;
  const listRoot = domain => { policy(domain); return `${api}/lists/getbytitle('${MINIJOOMLA_SCHEMAS[domain].displayName}')`; };
  const configPath = `${ctx.libraryPath}/installation.json`;
  const fileRoot = `${api}/GetFileByServerRelativePath(decodedurl='${quote(configPath)}')`;
  const owned = new Set();

  function writeOperation(isCurrent, signal) {
    if (isCurrent !== undefined && typeof isCurrent !== 'function') fail('invalid-current');
    if (signal !== undefined && !(signal instanceof AbortSignal)) fail('invalid-signal');
    if (!mutationTransportFactory) fail('dispatch-guard-required');
    const operation = {
      signal,
      check() {
        if (signal?.aborted) fail('operation-aborted');
        if (isCurrent !== undefined && isCurrent() !== true) fail('stale-operation');
      }
    };
    operation.check();
    return operation;
  }

  async function request(url, options, allowMissing = false, operation) {
    operation?.check();
    let client = transport, controller, abortListener;
    if (options.method !== 'GET') {
      if (!operation) fail('dispatch-guard-required');
      controller = new AbortController();
      const writeGuard = () => {
        try {
          operation.check();
          if (controller.signal.aborted) fail('operation-aborted');
        } catch (error) { controller.abort(); throw error; }
      };
      if (operation.signal) {
        abortListener = () => controller.abort();
        operation.signal.addEventListener('abort', abortListener, { once: true });
      }
      try {
        writeGuard();
        client = mutationTransportFactory(writeGuard);
        if (!client || typeof client.request !== 'function') fail('invalid-mutation-transport');
        writeGuard();
      } catch (error) {
        controller.abort();
        if (abortListener) operation.signal.removeEventListener('abort', abortListener);
        throw error;
      }
      options = { ...options, signal: controller.signal };
    } else if (operation?.signal) options = { ...options, signal: operation.signal };
    let response;
    try {
      operation?.check();
      response = await client.request(url, options);
      operation?.check();
    }
    catch (error) {
      controller?.abort();
      operation?.check();
      if (allowMissing && error?.status === 404) return null;
      fail(error?.status === 412 ? 'concurrency-conflict' : 'request-failed', Number.isInteger(error?.status) ? error.status : undefined);
    } finally {
      if (abortListener) operation.signal.removeEventListener('abort', abortListener);
    }
    if (allowMissing && response?.status === 404) return null;
    if (!Number.isInteger(response?.status) || response.status < 200 || response.status >= 300) fail(response?.status === 412 ? 'concurrency-conflict' : 'incomplete-response', Number.isInteger(response?.status) ? response.status : undefined);
    return response;
  }

  async function listInfo(domain, allowMissing = false, operation) {
    const response = await request(`${listRoot(domain)}?$select=${LIST_SELECT}`, { method: 'GET' }, allowMissing, operation);
    if (!response) return null;
    const info = entity(response);
    if (!info || typeof info !== 'object' || info.Title !== MINIJOOMLA_SCHEMAS[domain].displayName || !Number.isSafeInteger(info.ItemCount) || info.ItemCount < 0 || !Number.isSafeInteger(info.BaseTemplate)) fail('incomplete-list');
    return { id: id(info.Id), title: info.Title, template: info.BaseTemplate, itemCount: info.ItemCount };
  }

  function nextPath(value, original) {
    if (typeof value !== 'string' || !value || value.length > 4000 || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')) fail('incomplete-collection');
    let next = value;
    if (/^https?:\/\//i.test(next)) {
      const url = new URL(next);
      if (!globalThis.location?.origin || url.origin !== globalThis.location.origin || url.username || url.password || url.hash) fail('incomplete-collection');
      next = `${url.pathname}${url.search}`;
    }
    if (!next.startsWith(`${original}?`) || /%2f|%5c|%2e/i.test(next.split('?')[0])) fail('incomplete-collection');
    return next;
  }

  async function fields(domain, operation) {
    const original = `${listRoot(domain)}/fields`, result = [], visited = new Set();
    let announcedCount = null;
    let url = `${original}?$select=${FIELD_SELECT}`;
    while (url) {
      if (visited.size >= 100 || visited.has(url)) fail('incomplete-collection');
      visited.add(url);
      const response = await request(url, { method: 'GET' }, false, operation);
      const data = response.data, page = data?.value ?? data?.d?.results;
      if (!Array.isArray(page) || data?.truncated === true || data?.complete === false || data?.d?.truncated === true || data?.d?.complete === false) fail('incomplete-collection');
      const count = data?.['@odata.count'] ?? data?.['odata.count'] ?? data?.d?.__count;
      if (count !== undefined) {
        const number = typeof count === 'string' && /^\d+$/.test(count) ? Number(count) : count;
        if (!Number.isSafeInteger(number) || number < 0 || announcedCount !== null && announcedCount !== number) fail('incomplete-collection');
        announcedCount = number;
      }
      result.push(...page);
      if (result.length > 2048) fail('incomplete-collection');
      const next = data?.['@odata.nextLink'] ?? data?.['odata.nextLink'] ?? data?.d?.__next;
      url = next === undefined || next === null ? null : nextPath(next, original);
    }
    if (announcedCount !== null && announcedCount !== result.length) fail('incomplete-collection');
    const names = new Set();
    for (const field of result) {
      if (!field || typeof field.InternalName !== 'string' || !field.InternalName || names.has(field.InternalName)) fail('incomplete-collection');
      names.add(field.InternalName);
    }
    return result;
  }

  async function inspectList(domain, expectedId, operation) {
    const expected = policy(domain), info = await listInfo(domain, expectedId === undefined, operation);
    if (!info) return { domain, title: MINIJOOMLA_SCHEMAS[domain].displayName, id: null, exists: false, compatible: false, empty: true, itemCount: 0, issues: [], fingerprint: await fingerprint({ domain, exists: false, policy: expected }) };
    if (expectedId !== undefined && info.id !== id(expectedId)) fail('list-identity-conflict');
    const found = await fields(domain, operation), byName = new Map(found.map(field => [field.InternalName, field])), actual = [], issues = [];
    if (info.template !== MINIJOOMLA_SCHEMAS[domain].template) issues.push('list:template');
    for (const field of expected) {
      if (!byName.has(field.name)) { issues.push(`${field.name}:missing`); actual.push({ name: field.name, missing: true }); }
      else { const checked = fieldPolicy(byName.get(field.name), field); actual.push(checked.actual); issues.push(...checked.issues); }
    }
    // Unknown/native fields remain untouched, but schema changes alter the receipt.
    const extra = found.filter(field => !expected.some(entry => entry.name === field.InternalName)).map(field => ({ name: field.InternalName, type: field.TypeAsString ?? null, required: field.Required ?? null, indexed: field.Indexed ?? null, unique: field.EnforceUniqueValues ?? null })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const fresh = await listInfo(domain, false, operation);
    if (canonical(fresh) !== canonical(info)) fail('list-changed-during-read');
    return { domain, title: info.title, id: info.id, exists: true, compatible: issues.length === 0, empty: info.itemCount === 0, itemCount: info.itemCount, issues: issues.slice(0, 30), fingerprint: await fingerprint({ domain, id: info.id, template: info.template, policy: expected, fields: actual, extra }) };
  }

  async function verifiedList(domain, expectedId, operation) {
    id(expectedId);
    const report = await inspectList(domain, expectedId, operation);
    operation?.check();
    return { id: report.id, fingerprint: report.fingerprint, compatible: report.compatible, empty: report.empty, itemCount: report.itemCount };
  }
  const verifyList = (domain, expectedId) => verifiedList(domain, expectedId);

  async function configurationMetadata(allowMissing = false, operation) {
    const response = await request(`${fileRoot}?$select=Exists,ServerRelativeUrl,ETag`, { method: 'GET' }, allowMissing, operation);
    if (!response) return null;
    const value = entity(response);
    if (value?.Exists !== true || value?.ServerRelativeUrl !== configPath) fail('incomplete-configuration');
    return { etag: etag(response) };
  }

  async function readConfiguration(operation) {
    const metadata = await configurationMetadata(true, operation);
    if (!metadata) return { configuration: null, configurationETag: null, configurationExists: false };
    const response = await request(`${fileRoot}/$value`, { method: 'GET' }, false, operation);
    if (response.etag !== undefined && response.etag !== null && (!strongETag(response.etag) || response.etag !== metadata.etag)) fail('configuration-changed-during-read');
    let value = response.data;
    if (typeof value === 'string') {
      if (new TextEncoder().encode(value).length > MAX_CONFIG_BYTES) fail('invalid-data');
      try { value = JSON.parse(value); } catch { fail('invalid-data'); }
    }
    const configuration = jsonData(value);
    if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) fail('unsupported-configuration');
    const fresh = await configurationMetadata(false, operation);
    if (fresh.etag !== metadata.etag) fail('configuration-changed-during-read');
    return { configuration, configurationETag: fresh.etag, configurationExists: true };
  }

  async function inspect() {
    const lists = [];
    for (const domain of DOMAINS) lists.push(await inspectList(domain));
    if (new Set(lists.filter(list => list.exists).map(list => list.id)).size !== lists.filter(list => list.exists).length) fail('list-identity-conflict');
    return { lists, ...await readConfiguration() };
  }

  async function ownedEmpty(domain, expectedId, operation) {
    if (!owned.has(expectedId)) fail('list-not-owned');
    const info = await listInfo(domain, false, operation);
    if (info.id !== expectedId || info.itemCount !== 0 || info.template !== MINIJOOMLA_SCHEMAS[domain].template) fail('list-ownership-conflict');
  }

  async function configureField(domain, listId, expected, operation) {
    const root = `${api}/lists(guid'${listId}')/fields`, url = `${root}/getbyinternalnameortitle('${expected.name}')`;
    if (expected.name !== 'Title') {
      const body = { __metadata: { type: expected.type === 'Choice' ? 'SP.FieldChoice' : 'SP.Field' }, Title: expected.title, InternalName: expected.name, FieldTypeKind: expected.kind, Required: expected.required };
      if (expected.defaultValue !== '') body.DefaultValue = expected.defaultValue;
      if (expected.choices) body.Choices = { results: expected.choices };
      await ownedEmpty(domain, listId, operation);
      await request(root, { method: 'POST', body }, false, operation);
    }
    const response = await request(`${url}?$select=${FIELD_SELECT}`, { method: 'GET' }, false, operation), currentETag = etag(response), field = entity(response);
    if (!field || field.InternalName !== expected.name) fail('incomplete-field');
    const checked = fieldPolicy(field, expected);
    if (checked.issues.some(issue => issue.endsWith(':type') || issue.endsWith(':choices'))) fail('incompatible-created-field');
    const changes = {};
    for (const [property, restProperty] of [['required', 'Required'], ['defaultValue', 'DefaultValue'], ['indexed', 'Indexed'], ['unique', 'EnforceUniqueValues']]) if (canonical(checked.actual[property]) !== canonical(expected[property])) changes[restProperty] = expected[property];
    if (Object.keys(changes).length) {
      await ownedEmpty(domain, listId, operation);
      await request(url, { method: 'MERGE', etag: currentETag, headers: { 'If-Match': currentETag }, body: { __metadata: { type: expected.type === 'Choice' ? 'SP.FieldChoice' : 'SP.Field' }, ...changes } }, false, operation);
    }
    const fresh = await request(`${url}?$select=${FIELD_SELECT}`, { method: 'GET' }, false, operation);
    etag(fresh);
    if (entity(fresh)?.InternalName !== expected.name || fieldPolicy(entity(fresh), expected).issues.length) fail('unverified-created-field');
  }

  async function provisionList(domain, { expectedAbsent, isCurrent, signal } = {}) {
    const expected = policy(domain);
    if (expectedAbsent !== true) fail('expected-absence-required');
    const operation = writeOperation(isCurrent, signal);
    if (await listInfo(domain, true, operation)) fail('list-already-exists');
    // The second absence check is immediately adjacent to POST. Server-side name
    // uniqueness is still required; this is not a cross-session transaction.
    if (await listInfo(domain, true, operation)) fail('list-already-exists');
    const response = await request(`${api}/lists`, { method: 'POST', body: { __metadata: { type: 'SP.List' }, Title: MINIJOOMLA_SCHEMAS[domain].displayName, BaseTemplate: MINIJOOMLA_SCHEMAS[domain].template } }, false, operation);
    const created = entity(response), listId = id(created?.Id);
    if (created.Title !== MINIJOOMLA_SCHEMAS[domain].displayName || owned.has(listId)) fail('invalid-list-identity');
    owned.add(listId);
    await ownedEmpty(domain, listId, operation);
    for (const field of expected) await configureField(domain, listId, field, operation);
    const result = await verifiedList(domain, listId, operation);
    if (!result.compatible || !result.empty) fail('creation-unverified');
    return result;
  }

  async function writeConfiguration(input, { expectedAbsent, isCurrent, signal } = {}) {
    const configuration = validateInstallationConfiguration(input, ctx);
    if (expectedAbsent !== true) fail('expected-absence-required');
    const operation = writeOperation(isCurrent, signal);
    if (await configurationMetadata(true, operation)) fail('configuration-already-exists');
    for (const domain of DOMAINS) {
      const checked = await verifiedList(domain, configuration.lists[domain].listId, operation);
      if (!checked.compatible || !checked.empty) fail('configuration-list-conflict');
    }
    // The distributable must already have been copied. No implicit folder/library
    // creation, package upload, overwrite, native rows or extension registration.
    const folderRoot = `${api}/GetFolderByServerRelativePath(decodedurl='${quote(ctx.libraryPath)}')`;
    const folderResponse = await request(`${folderRoot}?$select=Exists,ServerRelativeUrl`, { method: 'GET' }, false, operation);
    const folder = entity(folderResponse);
    if (folder?.Exists !== true || folder?.ServerRelativeUrl !== ctx.libraryPath) fail('package-folder-unavailable');
    const bytes = new TextEncoder().encode(JSON.stringify(configuration));
    if (await configurationMetadata(true, operation)) fail('configuration-already-exists');
    await request(`${folderRoot}/Files/AddUsingPath(decodedurl='installation.json',overwrite=false)`, { method: 'POST', body: bytes, headers: { 'Content-Type': 'application/json' } }, false, operation);
    const written = await readConfiguration(operation);
    operation.check();
    if (!written.configurationExists || canonical(written.configuration) !== canonical(configuration)) fail('configuration-unverified');
    return { configuration: written.configuration, etag: written.configurationETag };
  }

  return Object.freeze({ ...ctx, inspect, provisionList, verifyList, writeConfiguration });
}
