/* Separate post-installation configuration. No I/O at import, no package writes,
 * installation.json changes, extension registration or JavaScript execution. */
import { normalizeExtensionsConfig } from '../application/joomla-host-config.js';
import { createJoomlaDiscoveryService } from '../application/joomla-discovery.js';
import { assertJoomlaPackageAssets } from '../application/joomla-package-assets.js';

export const EXTENSION_ROOTS_FORMAT = 'minijoomla-extensions-host-v1';
const MAX_BYTES = 256 * 1024;
const FIELDS = ['joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions'];
const strongETag = value => typeof value === 'string' && /^"[^"\u0000-\u001f\u007f]{1,200}"$/.test(value);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
function fail(code, status) {
  const error = new Error('A configuração de raízes não pôde ser verificada ou persistida.');
  error.code = code;
  if (Number.isInteger(status)) error.status = status;
  throw error;
}

// Copy data descriptors only: never evaluate getters, callbacks or toJSON.
function jsonData(input) {
  let nodes = 0, characters = 0;
  const seen = new Set();
  function copy(value, depth) {
    if (++nodes > 10000 || depth > 20) fail('invalid-data');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') { if ((characters += value.length) > MAX_BYTES) fail('invalid-data'); return value; }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || seen.has(value)) fail('invalid-data');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('invalid-data');
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.length > 10001 || keys.some(key => typeof key !== 'string')) fail('invalid-data');
    if (array && (keys.length !== descriptors.length.value + 1 || keys.filter(key => key !== 'length').some((key, index) => key !== String(index)))) fail('invalid-data');
    seen.add(value);
    const result = array ? [] : {};
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if ((characters += key.length) > MAX_BYTES || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('invalid-data');
      Object.defineProperty(result, key, { value: copy(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    seen.delete(value);
    return result;
  }
  const result = copy(input, 0);
  if (new TextEncoder().encode(canonical(result)).length > MAX_BYTES) fail('invalid-data');
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail('unsupported-configuration');
  return result;
}

function path(value) {
  if (typeof value !== 'string' || !value || value.length > 1000 || !value.startsWith('/') || value.startsWith('//') || /[\\?#%:'"<>\u0000-\u0020\u007f]/.test(value) || value.includes('//') || value.split('/').some(part => part === '.' || part === '..') || value !== '/' && value.endsWith('/')) fail('invalid-context');
  return value;
}
function context(webUrl, libraryPath) {
  const web = path(webUrl), siteAssets = `${web === '/' ? '' : web}/SiteAssets/`;
  const library = path(libraryPath ?? `${siteAssets}minijoomla`);
  if (!library.startsWith(siteAssets)) fail('invalid-context');
  return { webUrl: web, libraryPath: library };
}
function extensions(value, ctx) {
  if (FIELDS.some(key => !Object.hasOwn(value, key))) fail('unsupported-configuration');
  let normalized;
  try { normalized = normalizeExtensionsConfig(Object.fromEntries(FIELDS.map(key => [key, value[key]])), { webUrl: ctx.webUrl }); }
  catch { fail('unsupported-configuration'); }
  const boundary = `${ctx.webUrl === '/' ? '' : ctx.webUrl}/SiteAssets/`;
  if (normalized.joomlaDiscoveryRoots.some(root => !root.baseUrl.startsWith(boundary) || root.baseUrl === boundary)) fail('invalid-context');
  // Preserve unknown own JSON metadata on roots as well as the outer envelope.
  normalized.joomlaDiscoveryRoots = normalized.joomlaDiscoveryRoots.map((root, index) => ({ ...value.joomlaDiscoveryRoots[index], ...root }));
  return normalized;
}

export function validateExtensionRootsConfiguration(input, expectedContext) {
  const value = jsonData(input);
  if (['format', 'webUrl', 'libraryPath', ...FIELDS].some(key => !Object.hasOwn(value, key)) || typeof value.libraryPath !== 'string') fail('unsupported-configuration');
  const ctx = context(value.webUrl, value.libraryPath);
  if (value.format !== EXTENSION_ROOTS_FORMAT || expectedContext && (ctx.webUrl !== expectedContext.webUrl || ctx.libraryPath !== expectedContext.libraryPath)) fail('unsupported-configuration');
  return jsonData({ ...value, ...extensions(value, ctx) });
}

const quote = value => encodeURIComponent(value.replaceAll("'", "''"));
const entity = response => response.data?.d ?? response.data;
function etag(response) {
  const data = entity(response), value = response.etag ?? data?.ETag ?? data?.['odata.etag'] ?? data?.['@odata.etag'] ?? data?.__metadata?.etag;
  if (!strongETag(value)) fail('etag-required');
  return value;
}

/** mutationTransportFactory(writeGuard) must check synchronously before actual
 * fetch dispatch, also after awaiting a digest, and forward the AbortSignal.
 * An ordinary transport provides reads only; the port never retries a write. */
export function createSharePointExtensionRootsPort({ transport, webUrl, libraryPath, mutationTransportFactory, fileClientFactory } = {}) {
  if (!transport || typeof transport.request !== 'function') throw new TypeError('transport.request deve ser uma função.');
  for (const factory of [mutationTransportFactory, fileClientFactory]) if (factory !== undefined && typeof factory !== 'function') throw new TypeError('Factory deve ser uma função.');
  const ctx = context(webUrl, libraryPath);
  if (transport.webUrl !== undefined && (transport.webUrl === '' ? '/' : path(transport.webUrl)) !== ctx.webUrl) fail('invalid-context');
  const api = `${ctx.webUrl === '/' ? '' : ctx.webUrl}/_api/web`, configPath = `${ctx.libraryPath}/extensions-host.json`;
  const fileRoot = `${api}/GetFileByServerRelativePath(decodedurl='${quote(configPath)}')`;
  function operation({ isCurrent, signal } = {}) {
    if (isCurrent !== undefined && typeof isCurrent !== 'function') fail('invalid-current');
    if (signal !== undefined && !(signal instanceof AbortSignal)) fail('invalid-signal');
    const op = { signal, check() {
      if (signal?.aborted) fail('operation-aborted');
      if (isCurrent !== undefined && isCurrent() !== true) fail('stale-operation');
    } };
    op.check();
    return op;
  }
  async function request(url, options, allowMissing, op) {
    op.check();
    let client = transport, controller, abortListener;
    if (options.method !== 'GET') {
      if (!mutationTransportFactory) fail('dispatch-guard-required');
      controller = new AbortController();
      const guard = () => { try { op.check(); if (controller.signal.aborted) fail('operation-aborted'); } catch (error) { controller.abort(); throw error; } };
      if (op.signal) { abortListener = () => controller.abort(); op.signal.addEventListener('abort', abortListener, { once: true }); }
      try {
        guard(); client = mutationTransportFactory(guard);
        if (!client || typeof client.request !== 'function') fail('invalid-mutation-transport');
        if (client.webUrl !== undefined && (client.webUrl === '' ? '/' : path(client.webUrl)) !== ctx.webUrl) fail('invalid-context');
        guard();
      } catch (error) { controller.abort(); if (abortListener) op.signal.removeEventListener('abort', abortListener); throw error; }
      options = { ...options, signal: controller.signal };
    } else if (op.signal) options = { ...options, signal: op.signal };
    let response;
    try { op.check(); response = await client.request(url, options); op.check(); }
    catch (error) {
      controller?.abort(); op.check();
      if (allowMissing && error?.status === 404) return null;
      fail(error?.status === 412 ? 'concurrency-conflict' : 'request-failed', error?.status);
    } finally { if (abortListener) op.signal.removeEventListener('abort', abortListener); }
    if (allowMissing && response?.status === 404) return null;
    if (!Number.isInteger(response?.status) || response.status < 200 || response.status >= 300) fail(response?.status === 412 ? 'concurrency-conflict' : 'incomplete-response', response?.status);
    if (response.complete === false || response.truncated === true || entity(response)?.complete === false || entity(response)?.truncated === true) fail('incomplete-response');
    return response;
  }
  async function metadata(allowMissing, op) {
    const response = await request(`${fileRoot}?$select=Exists,ServerRelativeUrl,ETag`, { method: 'GET' }, allowMissing, op);
    if (!response) return null;
    const data = entity(response);
    if (data?.Exists !== true || data.ServerRelativeUrl !== configPath) fail('incomplete-configuration');
    return { etag: etag(response) };
  }
  async function readConfiguration(op) {
    const first = await metadata(true, op);
    if (!first) return { configuration: null, etag: null };
    const response = await request(`${fileRoot}/$value`, { method: 'GET', responseType: 'binary', maxResponseBytes: MAX_BYTES }, false, op);
    if (response.etag != null && (!strongETag(response.etag) || response.etag !== first.etag)) fail('configuration-changed-during-read');
    let value = response.data;
    let binary;
    try { binary = ArrayBuffer.isView(value) ? new Uint8Array(value.buffer,value.byteOffset,value.byteLength) : new Uint8Array(value,0,Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get.call(value)); } catch { /* JSON/text test ports are also supported. */ }
    if (binary) {
      const bytes = binary;
      if (bytes.byteLength > MAX_BYTES) fail('invalid-data');
      try { value = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('invalid-data'); }
    }
    if (typeof value === 'string') {
      if (new TextEncoder().encode(value).length > MAX_BYTES) fail('invalid-data');
      try { value = JSON.parse(value); } catch { fail('invalid-data'); }
    }
    const configuration = jsonData(value), fresh = await metadata(false, op);
    if (fresh.etag !== first.etag) fail('configuration-changed-during-read');
    op.check();
    return { configuration, etag: fresh.etag };
  }
  const read = options => readConfiguration(operation(options));
  async function write(input, { expectedETag, isCurrent, signal } = {}) {
    const configuration = validateExtensionRootsConfiguration(input, ctx), op = operation({ isCurrent, signal });
    if (expectedETag !== null && !strongETag(expectedETag)) fail('etag-required');
    if (!mutationTransportFactory) fail('dispatch-guard-required');
    const current = await readConfiguration(op);
    if (current.etag !== expectedETag) fail('concurrency-conflict', 412);
    const bytes = new TextEncoder().encode(canonical(configuration));
    if (bytes.byteLength > MAX_BYTES) fail('invalid-data');
    if (expectedETag === null) {
      const folderRoot = `${api}/GetFolderByServerRelativePath(decodedurl='${quote(ctx.libraryPath)}')`;
      const folder = entity(await request(`${folderRoot}?$select=Exists,ServerRelativeUrl`, { method: 'GET' }, false, op));
      if (folder?.Exists !== true || folder.ServerRelativeUrl !== ctx.libraryPath) fail('package-folder-unavailable');
      if (await metadata(true, op)) fail('concurrency-conflict', 412);
      await request(`${folderRoot}/Files/AddUsingPath(decodedurl='extensions-host.json',overwrite=false)`, { method: 'POST', body: bytes, headers: { 'Content-Type': 'application/json' } }, false, op);
    } else {
      const fresh = await metadata(false, op);
      if (fresh.etag !== expectedETag) fail('concurrency-conflict', 412);
      await request(`${fileRoot}/$value`, { method: 'POST', body: bytes, headers: { 'X-HTTP-Method': 'PUT', 'If-Match': expectedETag, 'Content-Type': 'application/json' } }, false, op);
    }
    const written = await readConfiguration(op);
    op.check();
    if (!strongETag(written.etag) || canonical(written.configuration) !== canonical(configuration)) fail('configuration-unverified');
    return written;
  }
  async function verifyPackage(input, options) {
    const op = operation(options), value = jsonData(input), config = extensions(value, ctx);
    if (config.joomlaDiscoveryRoots.length !== 1) fail('single-root-required');
    if (!fileClientFactory) fail('file-client-required');
    try {
      const original = config.joomlaDiscoveryRoots[0], root = { ...original, discover: true };
      const client = await fileClientFactory({ root: jsonData(root), webUrl: ctx.webUrl });
      op.check();
      if (!client || typeof (client.listFoldersAll ?? client.listFolders) !== 'function' || typeof client.downloadFile !== 'function') fail('invalid-file-client');
      const files = {
        async listFolders(params) {
          op.check();
          const response = await (client.listFoldersAll ?? client.listFolders).call(client, params);
          op.check();
          const data = response?.data ?? response;
          const count = data?.['@odata.count'] ?? data?.['odata.count'] ?? data?.d?.__count;
          if (Number.isInteger(response?.status) && (response.status < 200 || response.status >= 300) || response?.complete === false || response?.truncated === true || data?.complete === false || data?.truncated === true || data?.['@odata.nextLink'] != null || data?.['odata.nextLink'] != null || data?.d?.__next != null || !Array.isArray(data?.value) || data.value.length > 500 || count !== undefined && (!/^(0|[1-9]\d*)$/.test(String(count)) || Number(count) !== data.value.length)) fail('incomplete-package');
          return response;
        },
        async downloadFile(params) { op.check(); const response = await client.downloadFile(params); op.check(); if (response?.complete === false || response?.truncated === true || Number.isInteger(response?.status) && (response.status < 200 || response.status >= 300)) fail('incomplete-package'); return response; }
      };
      const discovery = createJoomlaDiscoveryService({ roots: [{ ...root, files }], maxFolders: 500, maxCandidates: 200 });
      const report = await discovery.scanReport({ signal: op.signal });
      op.check();
      if (report.complete !== true || report.issues.length || !report.entries.length || report.entries.some(entry => entry.status !== 'ready' || entry.error)) fail('package-unverified');
       const moduleStyles = Object.create(null), moduleStyleRevisions = Object.create(null), descriptors = [];
      for (const candidate of report.entries) {
        const descriptor = await discovery.verify(candidate, { signal: op.signal });
        op.check();
         descriptors.push(descriptor);
         moduleStyles[descriptor.key] = [...descriptor.styles];
        moduleStyleRevisions[descriptor.key] = { [descriptor.entryPointUrl]: moduleStyles[descriptor.key] };
      }
       assertJoomlaPackageAssets(config,descriptors);
       if (canonical(config.moduleStyles) !== canonical(moduleStyles) || canonical(config.moduleStyleRevisions) !== canonical(moduleStyleRevisions)) fail('package-assets-conflict');
      op.check();
      return jsonData({ ...value, ...config });
    } catch (error) { op.check(); fail('package-unverified', error?.status); }
  }
  return Object.freeze({ ...ctx, read, write, verifyPackage });
}
