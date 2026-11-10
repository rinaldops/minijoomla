import { normalizeExtensionsConfig } from './joomla-host-config.js';

const FORMAT = 'minijoomla-extensions-host-v1';
const FIELDS = ['joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions'];
const ROOT_FIELDS = ['id', 'baseUrl', 'inventoryHash', 'immutable', 'discover'];
const own = (value, key) => Object.hasOwn(value, key);
const put = (value, key, entry) => Object.defineProperty(value, key, { value: entry, enumerable: true, configurable: true, writable: true });
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
const strongETag = value => typeof value === 'string' && /^"[^"\u0000-\u001f\u007f]{1,200}"$/.test(value);
class RootsError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
const fail = (message = 'Configuração de extensões inválida.', status = 'blocked') => { throw new RootsError(message, status); };

// Data descriptors only: no getters, toJSON, sparse arrays or exotic prototypes.
// Reserved JSON keys are preserved with defineProperty, never assigned setters.
// This boundary is not a sandbox for proxies supplied by untrusted JavaScript.
function data(value) {
  const seen = new Set(); let nodes = 0; let characters = 0;
  function walk(input, depth) {
    if (++nodes > 10000 || depth > 20) fail();
    if (input === null || typeof input === 'boolean') return input;
    if (typeof input === 'string') { characters += input.length; if (characters > 262144) fail(); return input; }
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (!input || typeof input !== 'object' || seen.has(input)) fail();
    const array = Array.isArray(input); const prototype = Object.getPrototypeOf(input);
    if (array ? prototype !== Array.prototype && prototype !== null : prototype !== Object.prototype && prototype !== null) fail();
    seen.add(input);
    const descriptors = Object.getOwnPropertyDescriptors(input); const keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string') || keys.length > 10001) fail();
    const length = array ? descriptors.length.value : 0; const result = array ? [] : {};
    if (array && (length > 10000 || keys.length !== length + 1)) fail();
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key]; characters += key.length;
      if (characters > 262144 || !descriptor.enumerable || !own(descriptor, 'value') || array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) fail();
      put(result, key, walk(descriptor.value, depth + 1));
    }
    seen.delete(input); return result;
  }
  const result = walk(value, 0);
  if (new TextEncoder().encode(canonical(result)).length > 262144) fail();
  return result;
}
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value; }
function keys(value, required, optional = []) {
  object(value);
  if (required.some(key => !own(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail();
}
function path(value) {
  if (typeof value !== 'string' || value.length > 1000 || !value.startsWith('/') || value.includes('//') || /[\\?#%:'"<>\u0000-\u0020\u007f]/.test(value) || value.split('/').some(part => part === '.' || part === '..') || value !== '/' && value.endsWith('/')) fail('Contexto de extensões inválido.');
  return value;
}
function context(port) {
  const webUrl = path(port.webUrl); const libraryPath = path(port.libraryPath);
  if (libraryPath === webUrl || webUrl !== '/' && !libraryPath.startsWith(`${webUrl}/`)) fail('Contexto de extensões inválido.');
  return { webUrl, libraryPath };
}
const subset = configuration => Object.fromEntries(FIELDS.map(key => [key, configuration[key]]));
function normalize(value, ctx, stored = false) {
  keys(value, ['joomlaDiscoveryRoots'], FIELDS.slice(1));
  if (!Array.isArray(value.joomlaDiscoveryRoots)) fail();
  for (const root of value.joomlaDiscoveryRoots) {
    keys(root, stored ? ROOT_FIELDS : ROOT_FIELDS.slice(0, 4), stored ? [] : ['discover']);
    if (typeof root.id !== 'string' || typeof root.baseUrl !== 'string' || typeof root.inventoryHash !== 'string') fail();
  }
  for (const field of FIELDS.slice(1)) if (own(value, field)) {
    for (const key of Object.keys(object(value[field]))) if (key !== key.trim()) fail('Chave de módulo não canônica.');
  }
  let normalized;
  try { normalized = normalizeExtensionsConfig(value, ctx); } catch { fail(); }
  const prefix = `${ctx.webUrl === '/' ? '' : ctx.webUrl}/SiteAssets/`;
  if (normalized.joomlaDiscoveryRoots.some(root => !root.baseUrl.startsWith(prefix) || root.baseUrl === prefix)) fail('A raiz deve estar em SiteAssets deste site.');
  if (stored && canonical(normalized) !== canonical(value)) fail('Configuração armazenada não canônica; nenhuma correção automática será feita.');
  return normalized;
}
function document(value, ctx) {
  object(value);
  if (['format', 'webUrl', 'libraryPath', ...FIELDS].some(key => !own(value, key)) || value.format !== FORMAT || value.webUrl !== ctx.webUrl || value.libraryPath !== ctx.libraryPath) fail('Configuração pertence a outro contexto ou formato.');
  normalize(subset(value), ctx, true); return value;
}
function snapshot(raw, ctx) {
  const value = data(raw); keys(value, ['configuration', 'etag']);
  if (value.configuration === null) {
    if (value.etag !== null) fail();
    return { configuration: { format: FORMAT, ...ctx, joomlaDiscoveryRoots: [], moduleStyles: {}, moduleStyleRevisions: {} }, etag: null };
  }
  if (!strongETag(value.etag)) fail('ETag forte necessário.');
  document(value.configuration, ctx); return value;
}
function options(raw, action) {
  object(raw);
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const allowed = action === 'inspect' ? ['isCurrent'] : ['confirm', 'expectedETag', 'isCurrent', ...(action === 'add' ? ['input'] : ['rootId', 'discover'])];
  if (Reflect.ownKeys(descriptors).some(key => !allowed.includes(key) || !own(descriptors[key], 'value'))) fail();
  const isCurrent = descriptors.isCurrent?.value;
  if (isCurrent !== undefined && typeof isCurrent !== 'function') fail();
  const input = data(Object.fromEntries(Object.entries(descriptors).filter(([key]) => key !== 'isCurrent').map(([key, descriptor]) => [key, descriptor.value])));
  if (action !== 'inspect' && (input.confirm !== true || !own(input, 'expectedETag') || input.expectedETag !== null && !strongETag(input.expectedETag))) fail('Confirmação e ETag explícitos da inspeção são necessários.');
  return { input, isCurrent };
}
function incoming(raw, ctx) {
  let value = data(raw);
  if (typeof value === 'string') { try { value = data(JSON.parse(value)); } catch { fail('JSON de extensões inválido.'); } }
  const config = normalize(value, ctx);
  if (config.joomlaDiscoveryRoots.length !== 1) fail('Selecione exatamente uma raiz de extensão.');
  return config;
}
function append(previous, config, ctx) {
  const next = data(previous); const root = config.joomlaDiscoveryRoots[0];
  const prior = next.joomlaDiscoveryRoots.find(entry => entry.id === root.id);
  if (prior && canonical(prior) !== canonical(root) || next.joomlaDiscoveryRoots.some(entry => entry.id !== root.id && entry.baseUrl === root.baseUrl)) fail('Raiz imutável conflitante; use a ação de descoberta apenas para alterar a flag.');
  if (!prior) {
    if (next.joomlaDiscoveryRoots.length >= 10) fail('O limite de dez raízes inclui as raízes sem descoberta.');
    next.joomlaDiscoveryRoots.push(data(root));
  }
  for (const [key, urls] of Object.entries(config.moduleStyleRevisions)) {
    const revisions = own(next.moduleStyleRevisions, key) ? next.moduleStyleRevisions[key] : {};
    for (const [url, styles] of Object.entries(urls)) {
      if (own(revisions, url) && canonical(revisions[url]) !== canonical(styles)) fail('Estilos de revisão imutável conflitantes.');
      put(revisions, url, data(styles));
    }
    put(next.moduleStyleRevisions, key, revisions);
  }
  for (const [key, styles] of Object.entries(config.moduleStyles)) put(next.moduleStyles, key, data(styles));
  return document(data(next), ctx);
}

/** Pure post-installation engine. Host ensures CMS installation separately.
 * port: webUrl/libraryPath, read() -> {configuration:null|JSON, etag:null|strong},
 * verifyPackage(normalizedSingleRootConfig) -> exactly that verified config
 * (read-only inventory + complete XML descriptor closure; never import code),
 * write(configuration, {expectedETag:null|strong,isCurrent}) -> readback receipt.
 * Null expectedETag means exclusive creation, never overwrite. The port MUST
 * enforce ETags and invoke isCurrent immediately before transport dispatch.
 * Optional locks.withLock(operation) covers the whole sequence; busy protects
 * this instance only, not other instances, sessions, realms or processes.
 */
export function createExtensionRootsService({ port, locks } = {}) {
  let busy = false;
  const ready = view => ({ status: 'ready', ...data(view), message: 'Configuração de raízes verificada.' });
  async function run(action, raw = {}) {
    let acquired = false; let uncertain = false;
    try {
      const { input, isCurrent } = options(raw, action);
      if (busy) fail('Uma operação de raízes já está em andamento.');
      if (!port || typeof port.read !== 'function' || action !== 'inspect' && (typeof port.write !== 'function' || typeof port.verifyPackage !== 'function') || locks && typeof locks.withLock !== 'function') fail('Port de raízes indisponível.', 'unavailable');
      const ctx = context(port);
      busy = true; acquired = true;
      const operation = async () => {
        const guard = () => { try { return (isCurrent === undefined || isCurrent() === true) && canonical(context(port)) === canonical(ctx); } catch { return false; } };
        const current = () => { if (!guard()) fail('Operação cancelada após mudança de contexto.', 'unavailable'); };
         const load = async () => { current(); const rawView = await port.read({ isCurrent: guard }); current(); return snapshot(rawView, ctx); };
        const before = await load();
        if (action === 'inspect') return ready(before);
        if (input.expectedETag !== before.etag) fail('O destino mudou; inspecione novamente antes de confirmar.');
        let configuration;
        if (action === 'add') {
          const config = incoming(input.input, ctx); configuration = append(before.configuration, config, ctx);
           current(); const verified = data(await port.verifyPackage(data(config), { isCurrent: guard })); current();
          if (canonical(verified) !== canonical(config)) fail('A verificação do pacote divergiu da configuração aprovada.');
        } else {
          if (typeof input.rootId !== 'string' || typeof input.discover !== 'boolean') fail('Identificador e flag de descoberta inválidos.');
          configuration = data(before.configuration);
          const root = configuration.joomlaDiscoveryRoots.find(entry => entry.id === input.rootId);
          if (!root) fail('Raiz aprovada não encontrada.');
          root.discover = input.discover;
        }
        const fresh = await load();
        if (fresh.etag !== before.etag || canonical(fresh.configuration) !== canonical(before.configuration)) fail('O destino mudou durante a verificação; nenhuma escrita foi feita.');
        if (canonical(configuration) === canonical(before.configuration)) return ready(fresh);
        current(); uncertain = true;
        const receipt = snapshot(await port.write(data(configuration), { expectedETag: input.expectedETag, isCurrent: guard }), ctx); current();
        if (!strongETag(receipt.etag) || canonical(receipt.configuration) !== canonical(configuration)) fail();
        const saved = await load();
        if (saved.etag !== receipt.etag || canonical(saved.configuration) !== canonical(configuration)) fail();
        uncertain = false; return ready(saved);
      };
      return await (locks ? locks.withLock(operation) : operation());
    } catch (error) {
      return { status: uncertain ? 'unavailable' : error instanceof RootsError ? error.status : 'unavailable', etag: null, message: uncertain ? 'Escrita incerta; não repetir automaticamente. Inspecione o destino para reconciliação.' : error instanceof RootsError ? error.message : 'Não foi possível verificar ou persistir as raízes de extensões.' };
    } finally { if (acquired) busy = false; }
  }
  return Object.freeze({ inspect: options => run('inspect', options), add: options => run('add', options), setDiscover: options => run('setDiscover', options) });
}
