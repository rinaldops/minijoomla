/* Administrative content-save runtime, independent of the public manager.
 * Only the content group and save events are supported. Lifecycle hooks require
 * code-level `adminLifecycle: true`; a site's onAppInit is NOT admin opt-in.
 * This is event isolation, not a sandbox: approved same-site ES modules still
 * execute their top-level code on import, under the existing import trust model.
 */
import { createPluginManager } from '../plugins/manager.js';
import { createExtensionLoader, DEFAULT_IMPORT } from '../modules/dynamic-modules.js';
import { ValidationError } from '../core/contracts.js';
import { extensionKey, sameSiteModuleUrl, NATIVE_PLUGIN_URLS } from './extension-input.js';
import { parseJsonObject, normalizeParamDefinitions, normalizeParamValues } from './declared-params.js';

const SAVE_EVENTS = Object.freeze(['onContentBeforeSave', 'onContentAfterSave']);
const ADMIN_CONTEXT = Object.freeze({ client: 'administrator', context: 'com_content.article' });
const failure = () => new ValidationError('Não foi possível carregar os plugins administrativos. Recarregue antes de salvar.');
const cancelled = () => new ValidationError('A operação administrativa foi encerrada. Reabra a tela antes de salvar.');

/* Read raw admin.extensions.list rows, not public/presentation queries which
 * deliberately tolerate malformed ordering or absent catalogs. Validate all
 * plugin configurations before ANY import, using the shared strict parsers.
 */
function configurations(rows) {
  if (!Array.isArray(rows)) throw failure();
  const keys = new Set();
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || !['Plugin', 'Module'].includes(row.type)) throw failure();
    if (row.type !== 'Plugin') return [];
    if (extensionKey(row.key) !== row.key || keys.has(row.key)) throw failure();
    keys.add(row.key);
    if (row.enabled !== undefined && row.enabled !== null && typeof row.enabled !== 'boolean') throw failure();
    const manifest = parseJsonObject(row.manifestJson, { strict: true, field: 'manifestJson' });
    const groupValue = (value) => {
      if (value === undefined || value === null || value === '') return '';
      if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(value.trim())) throw failure();
      return value.trim();
    };
    const folder = groupValue(row.folder);
    const manifestGroup = groupValue(Object.hasOwn(manifest, 'group') ? manifest.group : undefined);
    const group = folder || manifestGroup || 'content';
    const ordering = row.ordering === undefined || row.ordering === null ? 0 : row.ordering;
    if (!Number.isSafeInteger(ordering)) throw failure();
    const definitions = normalizeParamDefinitions(Object.hasOwn(manifest, 'params') ? manifest.params : undefined);
    const params = normalizeParamValues(definitions, parseJsonObject(row.paramsJson, { strict: true, field: 'paramsJson' }), { keepUndeclared: true });
    const paramsJson = JSON.stringify(params);
    const url = sameSiteModuleUrl(row.entryPointUrl);
    if (NATIVE_PLUGIN_URLS.includes(url) && url !== `native:${row.key}`) throw failure();
    // Native plugins currently expose ONLY site display events. No native
    // save implementation is reviewed/allowlisted, so never import or promote
    // their render handlers. Unsupported groups remain stored, not executed.
    if (row.enabled === false || group !== 'content' || NATIVE_PLUGIN_URLS.includes(url)) return [];
    return [{ type: 'Plugin', key: row.key, entryPointUrl: url, enabled: true, ordering, paramsJson }];
  });
}

function adminDefinition(module) {
  const plugin = module?.default ?? module;
  if (!plugin || typeof plugin !== 'object' || Array.isArray(plugin)) throw failure();
  if (plugin.group !== undefined && plugin.group !== 'content') throw failure();
  if (plugin.events !== undefined && (!plugin.events || typeof plugin.events !== 'object' || Array.isArray(plugin.events))) throw failure();
  const events = {};
  for (const event of SAVE_EVENTS) {
    if (!Object.hasOwn(plugin.events ?? {}, event)) continue;
    const handler = plugin.events[event];
    if (typeof handler !== 'function') throw failure();
    // Each observer gets its own snapshot, including non-enumerable ETag.
    events[event] = event === 'onContentAfterSave' ? async (value, context) => {
      const snapshot = structuredClone(value);
      if (value.etag !== undefined) Object.defineProperty(snapshot, 'etag', { value: value.etag, enumerable: false });
      await handler(snapshot, context);
      // Observers cannot replace the baseline seen by subsequent observers.
    } : (value, context) => handler(value, context);
  }
  if (Object.hasOwn(plugin, 'adminLifecycle') && plugin.adminLifecycle === true) {
    for (const event of ['onAppInit', 'onAppFinalize']) {
      if (!Object.hasOwn(plugin.events ?? {}, event)) continue;
      if (typeof plugin.events[event] !== 'function') throw failure();
      events[event] = (context) => plugin.events[event](context);
    }
  }
  return { group: 'content', events };
}

export function createAdminPluginsRuntime({ getPlugins, importModule = DEFAULT_IMPORT } = {}) {
  if (typeof getPlugins !== 'function' || typeof importModule !== 'function') throw new TypeError('Runtime administrativo requer getPlugins e importModule.');
  const manager = createPluginManager();
  const loader = createExtensionLoader({ importModule: async (url) => adminDefinition(await importModule(sameSiteModuleUrl(url))), onError: () => {} });
  let active = false;
  let stopped = false;
  let generation = 0;
  let queue = Promise.resolve();
  let stopping = null;

  function cancelPending() { generation += 1; loader.cancelPendingPlugins(); }

  async function start() {
    const revision = generation;
    if (stopping) await stopping;
    if (revision !== generation) throw cancelled();
    stopped = false;
    active = true;
  }

  function refresh({ isCurrent = () => true } = {}) {
    const revision = generation;
    const current = () => active && generation === revision && isCurrent();
    const operation = queue.then(async () => {
      if (!current()) throw cancelled();
      try {
        const rows = configurations(await getPlugins());
        if (!current()) throw cancelled();
        await loader.ensurePluginsRegistered(manager, rows, {
          onRegister: (name) => current() ? manager.init(ADMIN_CONTEXT, name) : undefined,
          onRemove: (name) => manager.finalize(ADMIN_CONTEXT, name)
        });
        if (!current()) throw cancelled();
        // The shared loader isolates import/contract errors for public renders.
        // A save must instead fail closed when ANY enabled content plugin is
        // missing; never treat failed imports as an empty successful catalog.
        if (rows.some((row) => !manager.has(row.key))) throw failure();
        return manager.captureSaveOperation();
      } catch {
        if (!current()) throw cancelled();
        throw failure();
      }
    });
    queue = operation.catch(() => {});
    return operation;
  }

  function stop() {
    active = false;
    cancelPending();
    if (stopped) return stopping ?? Promise.resolve();
    stopped = true;
    const names = manager.list();
    const operation = manager.finalize(ADMIN_CONTEXT).then(() => { for (const name of names) manager.unregister(name); });
    stopping = operation;
    operation.finally(() => { if (stopping === operation) stopping = null; });
    return operation;
  }

  async function captureSaveOperation() {
    if (stopped) throw cancelled();
    if (!active) await start();
    const revision = generation;
    const operation = await refresh();
    if (!active || generation !== revision) throw cancelled();
    return Object.freeze({
      async beforeSave(data, context = {}) {
        if (!active || generation !== revision) throw cancelled();
        let result;
        try { result = await operation.beforeSave(data, { ...context, ...ADMIN_CONTEXT }); }
        catch { throw new ValidationError('Um plugin administrativo impediu a gravação. Nenhum dado foi alterado.'); }
        if (!active || generation !== revision) throw cancelled();
        return result;
      },
      // A write already started may finish after stop/refresh. Observe it with
      // THAT operation's handlers and params, never the new mutable manager.
      afterSave: (data, context = {}) => operation.afterSave(data, { ...context, ...ADMIN_CONTEXT })
    });
  }

  return Object.freeze({ start, refresh, cancelPending, stop, captureSaveOperation,
    list: () => manager.list(),
    async beforeSave(data, context = {}) { return (await captureSaveOperation()).beforeSave(data, context); },
    afterSave(data, context = {}) {
      // No catalog read here: an unavailable catalog after persistence must
      // never turn a completed write into a reported save failure.
      return active ? manager.afterSave(data, { ...context, ...ADMIN_CONTEXT }) : Promise.resolve();
    }
  });
}
