/*
 * Carregamento dinâmico de módulos/plugins descobertos — extensões já
 * REGISTRADAS em MiniJoomlaExtensions (nunca lê a pasta de descoberta
 * diretamente; isso é extension-discovery-service.js, usado só pelo
 * painel administrativo). Equivalente de runtime ao fato de uma extensão
 * Joomla já instalada/ativada ser carregada ao montar a página.
 *
 * Cada par extensionKey/entryPointUrl é importado no máximo uma vez por
 * loader (cache em memória via `attempted`), inclusive após reativação.
 * Plugins gerenciados são reconciliados a cada navegação; falhas de import
 * ou contrato são isoladas (módulos resolvem `false`, plugins são omitidos):
 * o slot correspondente não é renderizado, sem interromper a
 * navegação (mesmo princípio de `modules/registry.js` render(): um módulo
 * com defeito não pode derrubar o resto do shell).
 */
import { moduleAssignmentMatches } from '../application/module-assignment.js';

export const DEFAULT_IMPORT = (url) => import(url);

function canonicalParams(value) {
  if (Array.isArray(value)) return value.map(canonicalParams);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalParams(value[key])]));
  return value;
}

function pluginOrdering(value) {
  try { const number = Number(value); return Number.isFinite(number) ? number : 0; } catch { return 0; }
}

function pluginConfigurations(extensions) {
  const entries = (Array.isArray(extensions) ? extensions : []).filter((extension) => extension?.type === 'Plugin' && extension.enabled !== false
    && typeof extension.key === 'string' && extension.key.trim() && typeof extension.entryPointUrl === 'string' && extension.entryPointUrl.trim());
  const ordered = entries.map((extension) => {
    const params = canonicalParams(safeParseSettings(extension.paramsJson) ?? {});
    const ordering = pluginOrdering(extension.ordering);
    return { key: extension.key, entryPointUrl: extension.entryPointUrl, params, ordering,
      signature: JSON.stringify([extension.key, extension.entryPointUrl, params, ordering]) };
  }).sort((left, right) => left.ordering - right.ordering || left.key.localeCompare(right.key) || left.signature.localeCompare(right.signature));
  // Dados públicos corrompidos não passam pelo parser admin: ignora linhas
  // inválidas e mantém só a última assinatura na ordenação acima por key.
  return [...new Map(ordered.map((entry) => [entry.key, entry])).values()].sort((left, right) => left.ordering - right.ordering || left.key.localeCompare(right.key));
}

function extensionByKey(extensions, key, type) {
  return (Array.isArray(extensions) ? extensions : []).find((extension) => extension.key === key && extension.type === type && extension.enabled !== false);
}

export function createExtensionLoader({ importModule = DEFAULT_IMPORT, onError = ({ key }) => console.warn(`MINIJOOMLA: falha ao carregar extensão "${key}".`) } = {}) {
  const attempted = new Map();
  const moduleStates = new WeakMap();
  const pluginStates = new WeakMap();
  let pluginRevision = 0;

  /* Invalida trabalho pendente sem remover/finalizar registros; o stop do host cuida do lifecycle existente. */
  function cancelPendingPlugins() { pluginRevision += 1; }

  function once(key, run) {
    if (!attempted.has(key)) attempted.set(key, Promise.resolve().then(run));
    return attempted.get(key);
  }

  /*
   * Garante que `extensionKey` esteja registrado em `moduleRegistry` antes
   * de renderizar — nunca toca módulos nativos (já registrados em
   * createApplication, `moduleRegistry.has(extensionKey)` já é `true`
   * para eles, então esta função não faz nada e devolve `true`
   * imediatamente, sem nenhum import).
   */
  async function ensureModuleRegistered(moduleRegistry, extensionKey, extensions) {
    if (!moduleStates.has(moduleRegistry)) moduleStates.set(moduleRegistry, { managed: new Map(), revisions: new Map() });
    const state = moduleStates.get(moduleRegistry);
    const revision = (state.revisions.get(extensionKey) ?? 0) + 1;
    state.revisions.set(extensionKey, revision);
    const pendingRevision = pluginRevision;
    const record = (Array.isArray(extensions) ? extensions : []).find((extension) => extension.key === extensionKey && extension.type === 'Module');
    if (record?.enabled === false) return false;
    // Only static/native registrations are outside this loader's ownership.
    if (moduleRegistry.has(extensionKey) && !state.managed.has(extensionKey)) return true;
    const extension = extensionByKey(extensions, extensionKey, 'Module');
    if (!extension) {
      onError({ key: extensionKey, phase: 'module-registration' });
      return false;
    }
    if (moduleRegistry.has(extensionKey) && state.managed.get(extensionKey) === extension.entryPointUrl) return true;
    const loaded = await once(`module:${extensionKey}:${extension.entryPointUrl}`, async () => {
      try {
        return await importModule(extension.entryPointUrl);
      } catch (error) {
        onError({ key: extensionKey, phase: 'module-import', error });
        return null;
      }
    });
    if (!loaded || state.revisions.get(extensionKey) !== revision || pendingRevision !== pluginRevision) return false;
    try {
      moduleRegistry.register(extensionKey, loaded.default ?? loaded);
      state.managed.set(extensionKey, extension.entryPointUrl);
      return true;
    } catch (error) {
      onError({ key: extensionKey, phase: 'module-registration', error });
      return false;
    }
  }

  /*
   * Reconcilia somente plugins registrados por este loader. A assinatura
   * key/url/params/ordering evita finalize/init em navegações sem mudança.
   * Mudanças e remoções finalizam o registro anterior antes de substituí-lo;
   * novos registros inicializam via callbacks do host. Imports são concorrentes
   * e cacheados, mas commits/lifecycle são serializados por manager, com revisão
   * latest-wins. Uma remoção já iniciada termina mesmo se ficar obsoleta, para
   * não deixar um registro finalizado ser reutilizado pela revisão seguinte.
   * O manager mantém finalize idempotente por registro enquanto onRemove aguarda,
   * compartilhando essa finalização com stop sem perder os params antigos.
   * Plugins estáticos nunca são importados, removidos ou reinicializados aqui.
   */
  async function ensurePluginsRegistered(pluginManager, extensions, { onRegister, onRemove } = {}) {
    if (!pluginStates.has(pluginManager)) pluginStates.set(pluginManager, { managed: new Map(), revision: 0, queue: Promise.resolve() });
    const state = pluginStates.get(pluginManager);
    const revision = ++state.revision;
    const pendingRevision = pluginRevision;
    const isCurrent = () => revision === state.revision && pendingRevision === pluginRevision;
    const ordered = pluginConfigurations(extensions);
    function report(key, phase, error) {
      try { onError({ key, phase, error }); } catch { /* um observador também não pode derrubar a navegação */ }
    }
    async function notify(callback, key, phase) {
      try { await callback?.(key); } catch (error) { report(key, phase, error); }
    }
    // Também consulta o cache dos inalterados: uma revisão anterior pode estar
    // finalizando esse registro enquanto esta chamada espera a fila de commit.
    const toLoad = ordered.filter((extension) => !pluginManager.has(extension.key) || state.managed.has(extension.key));
    const loaded = await Promise.all(toLoad.map(async (extension) => {
      try {
        const module = await once(JSON.stringify(['plugin', extension.key, extension.entryPointUrl]), () => importModule(extension.entryPointUrl));
        return { extension, module };
      } catch (error) {
        report(extension.key, 'plugin-import', error);
        return { extension, module: null };
      }
    }));
    if (!isCurrent()) return;
    const byKey = new Map(loaded.map((entry) => [entry.extension.key, entry.module]));
    const desired = new Map(ordered.map((extension) => [extension.key, extension]));
    const reorder = () => pluginManager.reorder?.(ordered.filter((extension) => state.managed.has(extension.key)).map((extension) => extension.key));
    const commit = state.queue.then(async () => {
      if (!isCurrent()) return;
      for (const [key, active] of state.managed) {
        if (desired.get(key)?.signature === active.signature && pluginManager.has(key)) continue;
        if (pluginManager.has(key)) {
          await notify(onRemove, key, 'plugin-finalize');
          pluginManager.unregister(key);
        }
        state.managed.delete(key);
        if (!isCurrent()) return;
      }
      for (const extension of ordered) {
        if (!isCurrent()) return;
        if (pluginManager.has(extension.key)) continue;
        const loadedModule = byKey.get(extension.key);
        if (!loadedModule) continue;
        try {
          pluginManager.register({ ...(loadedModule?.default ?? loadedModule), name: extension.key, params: extension.params });
        } catch (error) { report(extension.key, 'plugin-registration', error); continue; }
        state.managed.set(extension.key, extension);
        reorder();
        await notify(onRegister, extension.key, 'plugin-init');
      }
      if (isCurrent()) reorder();
    });
    state.queue = commit.catch(() => {});
    await commit;
  }

  return Object.freeze({ ensureModuleRegistered, ensurePluginsRegistered, cancelPendingPlugins });
}

export const TEMPLATE_MODULE_POSITIONS = Object.freeze(['topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer']);
const KNOWN_POSITIONS = new Set(['sidebar', 'content', ...TEMPLATE_MODULE_POSITIONS]);
const HEADER_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p']);

function safeParseSettings(settingsJson) {
  if (!settingsJson) return undefined;
  try { const value = JSON.parse(settingsJson); return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined; } catch { return undefined; }
}

function matchesScope(row, { route, categoryAlias } = {}) {
  if ((row.scopeKind ?? 'All') !== 'Route') return true;
  if (row.scopeRoute && row.scopeRoute !== route) return false;
  if (route === 'category' && row.scopeRoute === 'category' && row.scopeCategoryAlias) return row.scopeCategoryAlias === categoryAlias;
  return true;
}

/*
 * Publicação efetiva de uma linha para o runtime: desabilitada, na
 * lixeira ou fora da janela publishUp/publishDown nunca é resolvida —
 * mesma regra de `isModulePublished` (module-assignment.js), reaplicada
 * aqui para não importar o módulo admin inteiro no runtime público (só
 * `moduleAssignmentMatches` é importada, abaixo, por já ser puramente
 * funcional e sem dependências do painel).
 */
function isPublishedRow(row, now) {
  if (row.enabled === false || row.trashed === true) return false;
  const time = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const up = row.publishUp ? new Date(row.publishUp).getTime() : NaN;
  const down = row.publishDown ? new Date(row.publishDown).getTime() : NaN;
  if (Number.isFinite(up) && time < up) return false;
  if (Number.isFinite(down) && time >= down) return false;
  return true;
}

/*
 * Atribuição efetiva: `assignment`/`assignmentJson` (novo) tem prioridade
 * quando declarado; registros legados (sem `assignment`) continuam
 * usando o escopo antigo `scopeKind`/`scopeRoute`/`scopeCategoryAlias`
 * (matchesScope) — nunca perder a atribuição de um registro já existente
 * só porque o schema novo foi adicionado.
 */
function isAssignedRow(row, scope) {
  const assigned = moduleAssignmentMatches(row, scope);
  if (assigned !== undefined) return assigned;
  return matchesScope(row, scope);
}

/* Extrai os três avançados (chrome de apresentação) de settingsJson, sem alterar os demais parâmetros do tipo de módulo. */
function chromeAndSettings(settingsJson) {
  const parsed = safeParseSettings(settingsJson);
  if (!parsed) return { showTitle: true, moduleClass: '', headerTag: 'h2', headerClass: '', settings: undefined };
  const { moduleClass, headerTag, headerClass, ...settings } = parsed;
  return {
    moduleClass: typeof moduleClass === 'string' ? moduleClass : '',
    headerTag: HEADER_TAGS.has(headerTag) ? headerTag : 'h2',
    headerClass: typeof headerClass === 'string' ? headerClass : '',
    settings: Object.keys(settings).length ? settings : undefined
  };
}

/*
 * Converte linhas de MiniJoomlaModuleInstances (cada uma potencialmente
 * com várias instâncias do MESMO extensionKey, ex.: "artigos recentes"
 * duas vezes com `limit` diferente) em entradas prontas para
 * `moduleRegistry.renderPosition(posição, entradas, contexto)`, agrupadas
 * pela posição declarada, incluindo as posições dos templates. `sidebar`
 * e `content` permanecem aliases legados; posições desconhecidas usam
 * `sidebar`. Linhas despublicadas (desabilitadas, na lixeira ou fora da
 * janela de publicação) ou fora da atribuição/escopo da rota/categoria
 * atual são omitidas. `now` (default: momento da chamada) existe só para
 * permitir testes determinísticos da janela de publicação.
 */
export function resolveModuleEntries(moduleInstances, scope = {}, now = new Date()) {
  const rows = Array.isArray(moduleInstances) ? moduleInstances : [];
  const byPosition = { sidebar: [], content: [] };
  for (const position of TEMPLATE_MODULE_POSITIONS) byPosition[position] = [];
  for (const row of rows) {
    if (!isPublishedRow(row, now) || !isAssignedRow(row, scope)) continue;
    const position = KNOWN_POSITIONS.has(row.position) ? row.position : 'sidebar';
    const { showTitle } = row;
    const { moduleClass, headerTag, headerClass, settings } = chromeAndSettings(row.settingsJson);
    byPosition[position].push({
      name: row.extensionKey, position, order: Number(row.ordering) || 0, settings,
      showTitle: showTitle === false ? false : true, moduleClass, headerTag, headerClass
    });
  }
  return byPosition;
}
