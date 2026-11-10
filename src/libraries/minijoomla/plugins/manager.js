/*
 * API de plugins do MINIJOOMLA — inspirada no sistema de eventos de
 * conteúdo/sistema do Joomla oficial (plugins `onContentPrepare` e
 * equivalentes), mas com nomes próprios onde não há uma correspondência
 * literal e documentada (ver comentário de cada evento abaixo). Plugins são
 * **opt-in** (array vazio por padrão, nenhuma mudança de comportamento sem
 * registro explícito), **declarativos** (um objeto com `name` e um mapa
 * `events` de funções nomeadas, não um script) e **testáveis** (funções
 * puras, sem acesso a rede/DOM por si só).
 *
 * Nunca executa JavaScript arbitrário vindo de conteúdo ou configuração:
 * `register()` exige que cada entrada em `events` já seja uma função real
 * (`typeof handler === 'function'`), nunca uma string avaliada em tempo de
 * execução — plugins só podem vir do código que monta a aplicação
 * (`createApplication`), nunca de dados de artigo, settings de módulo ou
 * qualquer entrada do usuário.
 */

import { sanitizeHtml } from '../security/sanitize.js';
import { ValidationError } from '../core/contracts.js';

/* Grupos opcionais, como em Joomla (`folder` do plugin). */
export const PLUGIN_GROUPS = Object.freeze(['content', 'system', 'search']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} deve ser um objeto.`);
  return value;
}

function validatePlugin(plugin) {
  object(plugin, 'plugin');
  if (typeof plugin.name !== 'string' || !plugin.name.trim()) throw new TypeError('plugin.name deve ser um texto não vazio.');
  if (plugin.group !== undefined && !PLUGIN_GROUPS.includes(plugin.group)) throw new TypeError(`plugin.group (${plugin.name}) deve ser um de: ${PLUGIN_GROUPS.join(', ')}.`);
  if (plugin.events !== undefined) {
    object(plugin.events, `plugin.events (${plugin.name})`);
    for (const [event, handler] of Object.entries(plugin.events)) {
      if (typeof handler !== 'function') throw new TypeError(`plugin.events.${event} (${plugin.name}) deve ser uma função — nunca uma string ou valor de configuração.`);
    }
  }
  return plugin;
}

/* Parâmetros declarativos são snapshots: congela também objetos/arrays aninhados, sem tocar o original. */
function immutableParams(value, copies = new WeakMap()) {
  if (!value || typeof value !== 'object') return value;
  if (copies.has(value)) return copies.get(value);
  const copy = Array.isArray(value) ? [] : {};
  copies.set(value, copy);
  for (const [key, nested] of Object.entries(value)) {
    Object.defineProperty(copy, key, { value: immutableParams(nested, copies), enumerable: true, configurable: true, writable: true });
  }
  return Object.freeze(copy);
}

export function createPluginManager() {
  const plugins = [];
  const lifecycle = new WeakMap();

  /*
   * Encadeia os filtros registrados para `eventName`: cada handler recebe a
   * saída do anterior (`value`) mais um `context` fixo, acrescido de
   * `params` (os parâmetros declarativos persistidos do próprio plugin —
   * ver `register()`, abaixo — sempre um objeto, nunca `undefined`, para
   * que um handler possa ler `context.params` sem checagem extra), e pode
   * devolver um valor novo ou `undefined` (= sem mudança). Um handler que
   * lança erro não interrompe a cadeia nem propaga para o chamador —
   * mantém o valor anterior, seguindo o mesmo princípio já usado pelo
   * registry de módulos (`modules/registry.js`) e pelo `onAfterRender`
   * observacional de `src/index.js`: um plugin com defeito não pode
   * derrubar a renderização.
   */
  async function pipeline(eventName, value, context) {
    let result = value;
    for (const plugin of [...plugins]) {
      const handler = plugin.enabled !== false ? plugin.events?.[eventName] : undefined;
      if (typeof handler !== 'function') continue;
      try { const next = await handler(result, { ...context, params: plugin.params ?? {} }); if (next !== undefined) result = next; }
      catch { /* um plugin com defeito preserva o valor anterior, nunca interrompe a cadeia */ }
    }
    return result;
  }

  /* Save hooks are stricter than render filters: beforeSave failures and
   * explicit vetoes must reach the persistence boundary unchanged. */
  async function savePipeline(eventName, value, context, { strict = false, targets = [...plugins] } = {}) {
    let result = value;
    for (const plugin of targets) {
      const handler = plugin.enabled !== false ? plugin.events?.[eventName] : undefined;
      if (typeof handler !== 'function') continue;
      try {
        const next = await handler(result, { ...context, params: plugin.params ?? {} });
        if (strict && next === false) throw new ValidationError('onContentBeforeSave vetou a gravação.');
        if (next !== undefined) result = next;
      } catch (error) {
        if (strict) throw error;
      }
    }
    return result;
  }

  /*
   * Eventos de exibição (onContentAfterTitle/BeforeDisplay/AfterDisplay): cada plugin devolve
   * um fragmento HTML; cada fragmento passa por sanitizeHtml e os resultados são concatenados
   * na ordem dos plugins. Falha de um plugin é ignorada.
   */
  async function collect(eventName, context) {
    let html = '';
    for (const plugin of [...plugins]) {
      const handler = plugin.enabled !== false ? plugin.events?.[eventName] : undefined;
      if (typeof handler !== 'function') continue;
      try { const part = await handler({ ...context, params: plugin.params ?? {} }); if (typeof part === 'string') html += sanitizeHtml(part); }
      catch { /* um plugin com defeito não afeta os demais */ }
    }
    return html;
  }

  /* Reserva o ciclo antes de executar o hook: finalize repetido compartilha a
   * operação mesmo enquanto await está pendente. Init após finalize abre outro
   * ciclo, em sequência; um registro novo tem seu próprio estado (não a key). */
  function lifecycleOperation(plugin, eventName, context) {
    const previous = lifecycle.get(plugin);
    if (previous?.eventName === eventName) return { promise: previous.promise, start: () => {} };
    let resolve;
    const operation = { eventName, pending: true, promise: new Promise((done) => { resolve = done; }) };
    lifecycle.set(plugin, operation);
    const finish = () => { operation.pending = false; resolve(); };
    const invoke = () => {
      try {
        const result = plugin.events?.[eventName]?.({ ...context, params: plugin.params ?? {} });
        if (result && typeof result.then === 'function') Promise.resolve(result).then(finish, finish);
        else finish();
      } catch { finish(); /* hooks são observacionais, inclusive quando rejeitam */ }
    };
    return { promise: operation.promise, start: () => {
      if (previous?.pending) previous.promise.then(invoke);
      else invoke();
    } };
  }

  async function broadcast(eventName, context, name) {
    // Reserva TODOS os alvos antes do primeiro await: stop não pode finalizar
    // duas vezes um alvo posterior enquanto um plugin anterior ainda bloqueia.
    const operations = plugins.filter((plugin) => (name === undefined || plugin.name === name) && plugin.enabled !== false)
      .map((plugin) => lifecycleOperation(plugin, eventName, context));
    for (const operation of operations) {
      operation.start();
      await operation.promise;
    }
  }

  return Object.freeze({
    /*
     * `plugin.params`: objeto opcional de parâmetros declarativos
     * persistidos (ex.: `extension.paramsJson` já normalizado pelo
     * chamador — ver `modules/dynamic-modules.js`
     * `ensurePluginsRegistered`) — nunca uma string nem código; cada
     * handler recebe via `context.params` um snapshot de objetos/arrays
     * profundamente congelados (nunca o objeto persistido em si).
     */
    register(plugin) {
      const validated = validatePlugin(plugin);
      if (plugins.some((entry) => entry.name === validated.name)) throw new TypeError(`Plugin já registrado: ${validated.name}.`);
      plugins.push({
        ...validated,
        events: plugin.events ? { ...plugin.events } : undefined,
        params: plugin.params && typeof plugin.params === 'object' && !Array.isArray(plugin.params) ? immutableParams(plugin.params) : Object.freeze({})
      });
      return this;
    },
    has(name) { return plugins.some((plugin) => plugin.name === name); },
    unregister(name) {
      for (let index = plugins.length - 1; index >= 0; index -= 1) {
        if (plugins[index].name === name) plugins.splice(index, 1);
      }
    },
    /* Reordena somente os nomes indicados, preservando objetos e posições dos plugins estáticos. */
    reorder(names) {
      const order = new Map([...new Set(names)].map((name, index) => [name, index]));
      const ordered = plugins.filter((plugin) => order.has(plugin.name)).sort((left, right) => order.get(left.name) - order.get(right.name));
      let index = 0;
      for (let slot = 0; slot < plugins.length; slot += 1) {
        if (order.has(plugins[slot].name)) plugins[slot] = ordered[index++];
      }
    },
    /* `onContentPrepare`: equivalente ao plugin de conteúdo `onContentPrepare` do Joomla — transforma o HTML de um artigo (introtext/fulltext) antes da sanitização final (sanitizeHtml em security/sanitize.js continua sendo a única fronteira de segurança; um plugin nunca a substitui). Também é o ponto de extensão para filtros de link dentro do corpo do artigo (ex.: adicionar rel="nofollow" a links externos), já que links de conteúdo são HTML dentro desse mesmo texto — não há um hook síncrono separado para links de navegação interna (menu/breadcrumbs), que ficam deliberadamente fora do alcance de plugins para preservar as garantias de roteamento. */
    prepareContent(text, context = {}) { return pipeline('onContentPrepare', text, context); },
    /* `onSearchPrepare`: ponto de extensão de busca/indexação — um plugin pode transformar o termo de busca (ex.: sinônimos, normalização) antes de chegar ao adapter; não existe um equivalente de nome único no Joomla oficial para este hook específico, por isso o nome é próprio do MINIJOOMLA. */
    prepareSearchQuery(query, context = {}) { return pipeline('onSearchPrepare', query, context); },
    /* Eventos de conteúdo do Joomla: HTML sanitizado concatenado (After/Before display) ou filtros encadeados (save/route). */
    contentAfterTitle(context = {}) { return collect('onContentAfterTitle', context); },
    contentBeforeDisplay(context = {}) { return collect('onContentBeforeDisplay', context); },
    contentAfterDisplay(context = {}) { return collect('onContentAfterDisplay', context); },
    /* `onContentBeforeSave`: filtra/valida os dados antes de gravar (valor devolvido substitui o anterior). */
    beforeSave(data, context = {}) { return savePipeline('onContentBeforeSave', data, context, { strict: true }); },
    afterSave(data, context = {}) { return savePipeline('onContentAfterSave', data, context); },
    /* One handle per persistence operation, not a global "last save" snapshot.
     * Reconciliation/unregister/stop cannot change its handlers or immutable
     * params; concurrent writes may complete in any order. */
    captureSaveOperation() {
      const targets = [...plugins];
      return Object.freeze({
        beforeSave: (data, context = {}) => savePipeline('onContentBeforeSave', data, context, { strict: true, targets }),
        afterSave: (data, context = {}) => savePipeline('onContentAfterSave', data, context, { targets })
      });
    },
    afterRoute(location, context = {}) { return pipeline('onAfterRoute', location, context); },
    /* Nomes dos plugins de um grupo (content/system/search); sem argumento, todos. */
    list(group) { return plugins.filter((plugin) => group === undefined || plugin.group === group).map((plugin) => plugin.name); },
    /* `onAppInit`/`onAppFinalize`: idempotentes por registro/ciclo (init abre outro ciclo após finalize); chamadas concorrentes compartilham a operação pendente. Nomes próprios do MINIJOOMLA, sem correspondência literal de nome no Joomla oficial. */
    init(context = {}, name) { return broadcast('onAppInit', context, name); },
    finalize(context = {}, name) { return broadcast('onAppFinalize', context, name); }
  });
}
