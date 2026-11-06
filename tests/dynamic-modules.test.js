import assert from 'node:assert/strict';
import { createExtensionLoader, resolveModuleEntries } from '../src/libraries/minijoomla/modules/dynamic-modules.js';
import { createModuleRegistry } from '../src/libraries/minijoomla/modules/registry.js';
import { createPluginManager } from '../src/libraries/minijoomla/plugins/manager.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function pluginRecord(key, entryPointUrl = key, paramsJson = '{}', ordering = 0) {
  return { key, type: 'Plugin', entryPointUrl, paramsJson, ordering, enabled: true };
}

function lifecyclePlugin(label, lifecycle) {
  return { default: { events: {
    onContentPrepare: (value) => `${value}:${label}`,
    onAppInit: ({ params }) => lifecycle.push(`init:${label}:${params.version ?? ''}`),
    onAppFinalize: ({ params }) => lifecycle.push(`finalize:${label}:${params.version ?? ''}`)
  } } };
}

function lifecycleHooks(manager) {
  return { onRegister: (key) => manager.init({}, key), onRemove: (key) => manager.finalize({}, key) };
}

export async function runDynamicModulesTests() {
  // 1. resolveModuleEntries: agrupa por posição, converte settingsJson em objeto, aplica default de posição desconhecida.
  const entries = resolveModuleEntries([
    { extensionKey: 'custom-widget', position: 'sidebar', ordering: 10, settingsJson: '{"limit":3}', enabled: true },
    { extensionKey: 'custom-widget', position: 'sidebar', ordering: 5, settingsJson: '{"limit":10}', enabled: true }, // segunda instância do MESMO extensionKey, com settings diferentes
    { extensionKey: 'inline-widget', position: 'content', ordering: 1, enabled: true },
    { extensionKey: 'posicao-desconhecida', position: 'header', ordering: 1, enabled: true }, // posição não suportada pelo template -> cai em sidebar
    { extensionKey: 'desabilitado', position: 'sidebar', ordering: 1, enabled: false }
  ]);
  assert.equal(entries.sidebar.length, 3);
  assert.deepEqual(entries.sidebar.map((entry) => entry.name), ['custom-widget', 'custom-widget', 'posicao-desconhecida']);
  assert.deepEqual(entries.sidebar[0].settings, { limit: 3 });
  assert.deepEqual(entries.sidebar[1].settings, { limit: 10 });
  assert.equal(entries.content.length, 1);
  assert.equal(entries.content[0].name, 'inline-widget');
  assert.equal(entries.content[0].settings, undefined);

  // 2. resolveModuleEntries: settingsJson malformado é tolerado (settings undefined), nunca lança.
  const malformed = resolveModuleEntries([{ extensionKey: 'quebrado', position: 'sidebar', settingsJson: 'não é json', enabled: true }]);
  assert.equal(malformed.sidebar[0].settings, undefined);

  // 3. resolveModuleEntries: escopo 'Route' filtra por rota e, para 'category', por alias.
  const scoped = [
    { extensionKey: 'home-only', position: 'sidebar', scopeKind: 'Route', scopeRoute: 'home', enabled: true },
    { extensionKey: 'noticias-only', position: 'sidebar', scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias: 'noticias', enabled: true },
    { extensionKey: 'any-category', position: 'sidebar', scopeKind: 'Route', scopeRoute: 'category', enabled: true },
    { extensionKey: 'everywhere', position: 'sidebar', scopeKind: 'All', enabled: true }
  ];
  assert.deepEqual(resolveModuleEntries(scoped, { route: 'home' }).sidebar.map((e) => e.name), ['home-only', 'everywhere']);
  assert.deepEqual(resolveModuleEntries(scoped, { route: 'category', categoryAlias: 'noticias' }).sidebar.map((e) => e.name), ['noticias-only', 'any-category', 'everywhere']);
  assert.deepEqual(resolveModuleEntries(scoped, { route: 'category', categoryAlias: 'outra' }).sidebar.map((e) => e.name), ['any-category', 'everywhere']);
  assert.deepEqual(resolveModuleEntries(scoped, { route: 'search' }).sidebar.map((e) => e.name), ['everywhere']);

  // 4. createExtensionLoader.ensureModuleRegistered: módulo nativo já registrado não dispara import nem é re-registrado.
  let importCalls = 0;
  const importModule = async (url) => { importCalls += 1; if (url === '../extensions/good-module.js') return { default: { render: () => '<p>ok</p>', settings: {} } }; throw new Error('404'); };
  const loader = createExtensionLoader({ importModule });
  const nativeRegistry = createModuleRegistry().register('articles-latest', { settings: {}, render: () => '' });
  assert.equal(await loader.ensureModuleRegistered(nativeRegistry, 'articles-latest', []), true);
  assert.equal(importCalls, 0);

  // 5. ensureModuleRegistered: extensão desconhecida/sem entrada correspondente resolve false, sem lançar.
  assert.equal(await loader.ensureModuleRegistered(nativeRegistry, 'inexistente', []), false);

  // 6. ensureModuleRegistered: extensão válida é importada, registrada, e a segunda chamada reaproveita o cache (não importa de novo).
  const extensions = [{ key: 'good-module', type: 'Module', entryPointUrl: '../extensions/good-module.js', enabled: true }];
  assert.equal(await loader.ensureModuleRegistered(nativeRegistry, 'good-module', extensions), true);
  assert.equal(nativeRegistry.has('good-module'), true);
  assert.equal(importCalls, 1);
  assert.equal(await loader.ensureModuleRegistered(nativeRegistry, 'good-module', extensions), true);
  assert.equal(importCalls, 1); // segunda chamada não importa de novo

  // 7. ensureModuleRegistered: entrypoint que falha ao importar (404/import inválido) resolve false, não lança, e tenta de novo numa chamada futura é desnecessário (cache também cobre falha).
  const brokenExtensions = [{ key: 'broken-module', type: 'Module', entryPointUrl: '../extensions/missing.js', enabled: true }];
  assert.equal(await loader.ensureModuleRegistered(nativeRegistry, 'broken-module', brokenExtensions), false);
  assert.equal(nativeRegistry.has('broken-module'), false);

  const revisionImports = [];
  const revisionLoader = createExtensionLoader({ importModule: async (url) => {
    revisionImports.push(url);
    if (url === 'invalid') throw new Error('missing');
    return { default: { settings: {}, render: () => url } };
  }, onError: () => {} });
  const revisionRegistry = createModuleRegistry();
  const moduleRevision = (entryPointUrl, enabled = true) => [{ key: 'revisioned', type: 'Module', entryPointUrl, enabled }];
  for (const url of ['v1', 'v2', 'v1']) {
    assert.equal(await revisionLoader.ensureModuleRegistered(revisionRegistry, 'revisioned', moduleRevision(url)), true);
    assert.equal(revisionRegistry.render('revisioned'), url);
  }
  assert.deepEqual(revisionImports, ['v1', 'v2'], 'rollback reuses imported code but restores the registry revision');
  assert.equal(await revisionLoader.ensureModuleRegistered(revisionRegistry, 'revisioned', moduleRevision('invalid')), false);
  assert.equal(await revisionLoader.ensureModuleRegistered(revisionRegistry, 'revisioned', []), false, 'a deleted record cannot render cached code');
  assert.equal(await revisionLoader.ensureModuleRegistered(revisionRegistry, 'revisioned', moduleRevision('v1', false)), false);
  const slowModule = deferred();
  const raceLoader = createExtensionLoader({ importModule: async (url) => url === 'slow' ? slowModule.promise : { default: { settings: {}, render: () => url } } });
  const raceRegistry = createModuleRegistry();
  const obsoleteModuleImport = raceLoader.ensureModuleRegistered(raceRegistry, 'revisioned', moduleRevision('slow'));
  await Promise.resolve();
  assert.equal(await raceLoader.ensureModuleRegistered(raceRegistry, 'revisioned', moduleRevision('latest')), true);
  slowModule.resolve({ default: { settings: {}, render: () => 'slow' } });
  assert.equal(await obsoleteModuleImport, false);
  assert.equal(raceRegistry.render('revisioned'), 'latest');
  console.log('ok - dynamic module revisions: upgrade/rollback share import cache, fail closed after removal/bad import, latest navigation wins');

  // 8. ensurePluginsRegistered: registra todos os plugins habilitados ainda não presentes, ignora desabilitados, e um plugin já registrado não é reimportado.
  const pluginManager = createPluginManager().register({ name: 'already-there', events: {} });
  const pluginExtensions = [
    { key: 'already-there', type: 'Plugin', entryPointUrl: '../extensions/already-there.js', enabled: true },
    { key: 'new-plugin', type: 'Plugin', entryPointUrl: '../extensions/good-module.js', enabled: true }, // reaproveita o mesmo manifesto fake por simplicidade
    { key: 'disabled-plugin', type: 'Plugin', entryPointUrl: '../extensions/missing.js', enabled: false }
  ];
  const pluginLoader = createExtensionLoader({ importModule });
  await pluginLoader.ensurePluginsRegistered(pluginManager, pluginExtensions);
  assert.equal(pluginManager.has('new-plugin'), true);
  assert.equal(pluginManager.has('disabled-plugin'), false);

  // 9. Público tolera corrupção, sem parser admin; contrato/import/hook rejeitados isolam o plugin defeituoso.
  const errors = [];
  const isolatedManager = createPluginManager();
  const isolatedImports = [];
  const isolatedLoader = createExtensionLoader({ importModule: (url) => {
    isolatedImports.push(url);
    if (url === 'missing') throw new Error('import síncrono rejeitado');
    if (url === 'invalid') return { default: { events: { onContentPrepare: 'nunca executar' } } };
    if (url === 'hooks-reject') return { default: { events: {
      onAppInit: async () => { throw new Error('init rejeitado'); },
      onAppFinalize: async () => { throw new Error('finalize rejeitado'); },
      onContentPrepare: async () => { throw new Error('filtro rejeitado'); }
    } } };
    return { default: { events: { onContentPrepare: (value, { params }) => `${value}:${Object.keys(params).length}` } } };
  }, onError: (event) => errors.push(event) });
  const corruptedPlugins = [null, {}, pluginRecord('', 'skip'), pluginRecord('no-url', ''),
    pluginRecord('missing'), pluginRecord('invalid'), pluginRecord('reject', 'hooks-reject'),
    pluginRecord('bad-json', 'empty-params', '{'), pluginRecord('array-json', 'empty-params', '[]'),
    pluginRecord('null-json', 'empty-params', 'null'), pluginRecord('number-json', 'empty-params', '1', { toString: 'invalid', valueOf: 'invalid' })];
  await isolatedLoader.ensurePluginsRegistered(isolatedManager, corruptedPlugins, lifecycleHooks(isolatedManager));
  assert.equal(await isolatedManager.prepareContent('x'), 'x:0:0:0:0');
  assert.equal(isolatedManager.has('missing'), false);
  assert.equal(isolatedManager.has('invalid'), false);
  await isolatedLoader.ensurePluginsRegistered(isolatedManager, corruptedPlugins, lifecycleHooks(isolatedManager));
  assert.equal(isolatedImports.filter((url) => url === 'missing').length, 1, 'falha de import também é cacheada');
  assert.ok(errors.some((event) => event.phase === 'plugin-import') && errors.some((event) => event.phase === 'plugin-registration'));
  assert.ok(!isolatedImports.includes('skip'));
  await isolatedLoader.ensurePluginsRegistered(isolatedManager, [], lifecycleHooks(isolatedManager));
  assert.equal(isolatedManager.has('reject'), false, 'hook finalize rejeitado não impede remoção');
  const callbackManager = createPluginManager();
  const callbackErrors = [];
  const callbackLoader = createExtensionLoader({ importModule: async () => lifecyclePlugin('callback', []), onError: (event) => callbackErrors.push(event.phase) });
  const rejectingCallbacks = { onRegister: async () => { throw new Error('callback init'); }, onRemove: async () => { throw new Error('callback finalize'); } };
  await callbackLoader.ensurePluginsRegistered(callbackManager, [pluginRecord('callback')], rejectingCallbacks);
  await callbackLoader.ensurePluginsRegistered(callbackManager, [], rejectingCallbacks);
  assert.equal(callbackManager.has('callback'), false);
  assert.deepEqual(callbackErrors, ['plugin-init', 'plugin-finalize']);
  const recoveryManager = createPluginManager();
  const recoveryLifecycle = [];
  const recoveryImports = [];
  const recoveryLoader = createExtensionLoader({ importModule: async (url) => {
    recoveryImports.push(url);
    if (url === 'broken-update') throw new Error('import update rejeitado');
    return lifecyclePlugin(url, recoveryLifecycle);
  }, onError: () => {} });
  await recoveryLoader.ensurePluginsRegistered(recoveryManager, [pluginRecord('recover', 'good')], lifecycleHooks(recoveryManager));
  await recoveryLoader.ensurePluginsRegistered(recoveryManager, [pluginRecord('recover', 'broken-update')], lifecycleHooks(recoveryManager));
  assert.equal(recoveryManager.has('recover'), false, 'update inválido não conserva silenciosamente a configuração antiga');
  await recoveryLoader.ensurePluginsRegistered(recoveryManager, [pluginRecord('recover', 'good')], lifecycleHooks(recoveryManager));
  assert.deepEqual(recoveryLifecycle, ['init:good:', 'finalize:good:', 'init:good:']);
  assert.deepEqual(recoveryImports, ['good', 'broken-update']);

  // 10. Keys duplicadas recebem um único registro determinístico, independentemente da ordem das linhas.
  const duplicatesManager = createPluginManager();
  const duplicateLifecycle = [];
  const duplicateImports = [];
  const duplicatesLoader = createExtensionLoader({ importModule: async (url) => { duplicateImports.push(url); return lifecyclePlugin(url, duplicateLifecycle); } });
  const duplicates = [pluginRecord('duplicate', 'v1'), pluginRecord('duplicate', 'v2'), pluginRecord('duplicate', 'v2')];
  await duplicatesLoader.ensurePluginsRegistered(duplicatesManager, duplicates, lifecycleHooks(duplicatesManager));
  await duplicatesLoader.ensurePluginsRegistered(duplicatesManager, [...duplicates].reverse(), lifecycleHooks(duplicatesManager));
  assert.equal(await duplicatesManager.prepareContent('x'), 'x:v2');
  assert.deepEqual(duplicateLifecycle, ['init:v2:']);
  assert.deepEqual(duplicateImports, ['v2']);

  // 11. Revisão mais recente vence import lento antigo; nenhuma init/finalize obsoleta.
  const importGate = deferred();
  const importStarted = deferred();
  const importRaceManager = createPluginManager();
  const importRaceLifecycle = [];
  const importRaceLoader = createExtensionLoader({ importModule: async (url) => {
    if (url === 'slow') { importStarted.resolve(); await importGate.promise; }
    return lifecyclePlugin(url, importRaceLifecycle);
  } });
  const oldImport = importRaceLoader.ensurePluginsRegistered(importRaceManager, [pluginRecord('race', 'slow')], lifecycleHooks(importRaceManager));
  await importStarted.promise;
  await importRaceLoader.ensurePluginsRegistered(importRaceManager, [pluginRecord('race', 'new')], lifecycleHooks(importRaceManager));
  importGate.resolve();
  await oldImport;
  assert.equal(await importRaceManager.prepareContent('x'), 'x:new');
  assert.deepEqual(importRaceLifecycle, ['init:new:']);

  // 12. Finalize já iniciado termina antes da revisão seguinte, inclusive ao reverter à assinatura antiga.
  const finalizeGate = deferred();
  const finalizeStarted = deferred();
  const finalizeManager = createPluginManager();
  const finalizeLifecycle = [];
  const finalizeImports = [];
  const finalizeLoader = createExtensionLoader({ importModule: async (url) => { finalizeImports.push(url); return lifecyclePlugin(url, finalizeLifecycle); } });
  const finalizeHooks = { ...lifecycleHooks(finalizeManager), onRemove: async (key) => {
    await finalizeManager.finalize({}, key);
    finalizeStarted.resolve();
    await finalizeGate.promise;
  } };
  await finalizeLoader.ensurePluginsRegistered(finalizeManager, [pluginRecord('race', 'stable')], finalizeHooks);
  const changing = finalizeLoader.ensurePluginsRegistered(finalizeManager, [pluginRecord('race', 'obsolete')], finalizeHooks);
  await finalizeStarted.promise;
  const reverting = finalizeLoader.ensurePluginsRegistered(finalizeManager, [pluginRecord('race', 'stable')], finalizeHooks);
  finalizeGate.resolve();
  await Promise.all([changing, reverting]);
  assert.equal(await finalizeManager.prepareContent('x'), 'x:stable');
  assert.deepEqual(finalizeLifecycle, ['init:stable:', 'finalize:stable:', 'init:stable:']);
  assert.deepEqual(finalizeImports, ['stable', 'obsolete'], 'reversão usa cache do registro finalizado');

  // 13. Disable durante init aguarda init e finaliza uma só vez, sem registrar o restante obsoleto.
  const initGate = deferred();
  const initStarted = deferred();
  const initManager = createPluginManager();
  const initLifecycle = [];
  const initLoader = createExtensionLoader({ importModule: async (url) => lifecyclePlugin(url, initLifecycle) });
  const initHooks = { ...lifecycleHooks(initManager), onRegister: async (key) => {
    await initManager.init({}, key);
    initStarted.resolve();
    await initGate.promise;
  } };
  const initializing = initLoader.ensurePluginsRegistered(initManager, [pluginRecord('first'), pluginRecord('second')], initHooks);
  await initStarted.promise;
  const disabling = initLoader.ensurePluginsRegistered(initManager, [], initHooks);
  initGate.resolve();
  await Promise.all([initializing, disabling]);
  assert.deepEqual(initLifecycle, ['init:first:', 'finalize:first:']);
  assert.equal(await initManager.prepareContent('x'), 'x');
  await initLoader.ensurePluginsRegistered(initManager, [pluginRecord('first')], lifecycleHooks(initManager));
  assert.deepEqual(initLifecycle, ['init:first:', 'finalize:first:', 'init:first:']);

  // 14. Chamadas concorrentes idênticas compartilham import, sem registro/init duplicados.
  const sharedGate = deferred();
  const sharedStarted = deferred();
  let sharedImports = 0;
  const sharedManager = createPluginManager();
  const sharedLifecycle = [];
  const sharedLoader = createExtensionLoader({ importModule: async () => {
    sharedImports += 1;
    sharedStarted.resolve();
    await sharedGate.promise;
    return lifecyclePlugin('shared', sharedLifecycle);
  } });
  const concurrentOld = sharedLoader.ensurePluginsRegistered(sharedManager, [pluginRecord('shared')], lifecycleHooks(sharedManager));
  await sharedStarted.promise;
  const concurrentNew = sharedLoader.ensurePluginsRegistered(sharedManager, [pluginRecord('shared')], lifecycleHooks(sharedManager));
  sharedGate.resolve();
  await Promise.all([concurrentOld, concurrentNew]);
  assert.equal(sharedImports, 1);
  assert.deepEqual(sharedLifecycle, ['init:shared:']);

  // 15. Filtro em andamento usa snapshot estável; o seguinte já enxerga o refresh, sem pular/duplicar handlers.
  const pipelineGate = deferred();
  const pipelineStarted = deferred();
  const snapshotManager = createPluginManager().register({ name: 'first', events: { onContentPrepare: async (value) => {
    pipelineStarted.resolve();
    await pipelineGate.promise;
    return `${value}:first`;
  } } }).register({ name: 'second', events: { onContentPrepare: (value) => `${value}:second` } });
  const runningFilter = snapshotManager.prepareContent('x');
  await pipelineStarted.promise;
  snapshotManager.unregister('second');
  snapshotManager.register({ name: 'third', events: { onContentPrepare: (value) => `${value}:third` } });
  pipelineGate.resolve();
  assert.equal(await runningFilter, 'x:first:second');
  assert.equal(await snapshotManager.prepareContent('x'), 'x:first:third');

  // 16. Revisões são por manager, mesmo se um loader for compartilhado por dois consumidores.
  const independentA = createPluginManager();
  const independentB = createPluginManager();
  const independentGate = deferred();
  const independentStarted = deferred();
  const independentLoader = createExtensionLoader({ importModule: async (url) => {
    if (url === 'wait') { independentStarted.resolve(); await independentGate.promise; }
    return lifecyclePlugin(url, []);
  } });
  const waitingA = independentLoader.ensurePluginsRegistered(independentA, [pluginRecord('a', 'wait')]);
  await independentStarted.promise;
  await independentLoader.ensurePluginsRegistered(independentB, [pluginRecord('b', 'ready')]);
  independentGate.resolve();
  await waitingA;
  assert.ok(independentA.has('a') && independentB.has('b'));

  // 17. Stop invalida imports pendentes: nenhum registro/init tardio; plugins existentes ficam para finalize do host.
  const cancelGate = deferred();
  const cancelStarted = deferred();
  const cancelManager = createPluginManager();
  const cancelLifecycle = [];
  const cancelRegistrations = [];
  const cancelRemovals = [];
  const cancelImports = [];
  const cancelLoader = createExtensionLoader({ importModule: async (url) => {
    cancelImports.push(url);
    if (url === 'pending') { cancelStarted.resolve(); await cancelGate.promise; }
    return lifecyclePlugin(url, cancelLifecycle);
  } });
  const cancelHooks = {
    onRegister: async (key) => { cancelRegistrations.push(key); await cancelManager.init({}, key); },
    onRemove: async (key) => { cancelRemovals.push(key); await cancelManager.finalize({}, key); }
  };
  cancelLoader.cancelPendingPlugins();
  await cancelLoader.ensurePluginsRegistered(cancelManager, [pluginRecord('existing')], cancelHooks);
  const cancelling = cancelLoader.ensurePluginsRegistered(cancelManager,
    [pluginRecord('existing', 'updated'), pluginRecord('late', 'pending')], cancelHooks);
  await cancelStarted.promise;
  cancelLoader.cancelPendingPlugins();
  cancelLoader.cancelPendingPlugins();
  assert.equal(cancelManager.has('existing'), true, 'cancel não remove o plugin já gerenciado');
  assert.deepEqual(cancelRemovals, [], 'cancel não finaliza registros existentes');
  // Equivale ao plugins.finalize chamado pelo application.stop, não pelo loader.
  await cancelManager.finalize();
  cancelGate.resolve();
  await cancelling;
  assert.equal(cancelManager.has('late'), false);
  assert.equal(await cancelManager.prepareContent('x'), 'x:existing', 'update pendente também não substitui o registro existente');
  assert.deepEqual(cancelRegistrations, ['existing']);
  assert.deepEqual(cancelRemovals, []);
  assert.deepEqual(cancelLifecycle, ['init:existing:', 'finalize:existing:']);
  await cancelLoader.ensurePluginsRegistered(cancelManager, [pluginRecord('existing'), pluginRecord('late', 'pending')], cancelHooks);
  assert.deepEqual(cancelRegistrations, ['existing', 'late'], 'novas chamadas após cancel continuam permitidas');
  assert.deepEqual(cancelImports.sort(), ['existing', 'pending', 'updated'], 'cancel preserva cache dos imports');

  // 18. Disable -> finalize bloqueado -> re-enable pendente -> stop compartilha finalize, sem duplicar hook.
  const stopFinalizeGate = deferred();
  const stopFinalizeStarted = deferred();
  const stopFinalizeLifecycle = [];
  const stopFinalizeManager = createPluginManager();
  let stopFinalizeImports = 0;
  const stopFinalizeLoader = createExtensionLoader({ importModule: async () => {
    stopFinalizeImports += 1;
    return { default: { events: {
      onAppInit: ({ params }) => stopFinalizeLifecycle.push(`init:${params.version}`),
      onAppFinalize: async ({ params }) => {
        stopFinalizeLifecycle.push(`finalize:${params.version}`);
        stopFinalizeStarted.resolve();
        await stopFinalizeGate.promise;
      },
      onContentPrepare: (value, { params }) => `${value}:${params.version}`
    } } };
  } });
  const stopFinalizeHooks = lifecycleHooks(stopFinalizeManager);
  await stopFinalizeLoader.ensurePluginsRegistered(stopFinalizeManager, [pluginRecord('stop-race', 'same-url', '{"version":1}')], stopFinalizeHooks);
  const disablingForStop = stopFinalizeLoader.ensurePluginsRegistered(stopFinalizeManager, [], stopFinalizeHooks);
  await stopFinalizeStarted.promise;
  const cancelledReenable = stopFinalizeLoader.ensurePluginsRegistered(stopFinalizeManager, [pluginRecord('stop-race', 'same-url', '{"version":2}')], stopFinalizeHooks);
  stopFinalizeLoader.cancelPendingPlugins();
  const stopFinalization = stopFinalizeManager.finalize();
  const repeatedStopFinalization = stopFinalizeManager.finalize({}, 'stop-race');
  assert.deepEqual(stopFinalizeLifecycle, ['init:1', 'finalize:1'], 'stop não executa finalize novamente enquanto disable aguarda');
  stopFinalizeGate.resolve();
  await Promise.all([disablingForStop, cancelledReenable, stopFinalization, repeatedStopFinalization]);
  assert.equal(stopFinalizeManager.has('stop-race'), false);
  assert.deepEqual(stopFinalizeLifecycle, ['init:1', 'finalize:1'], 're-enable cancelado não inicializa após stop');
  await stopFinalizeLoader.ensurePluginsRegistered(stopFinalizeManager, [pluginRecord('stop-race', 'same-url', '{"version":2}')], stopFinalizeHooks);
  assert.equal(await stopFinalizeManager.prepareContent('x'), 'x:2');
  assert.deepEqual(stopFinalizeLifecycle, ['init:1', 'finalize:1', 'init:2']);
  await Promise.all([stopFinalizeManager.finalize(), stopFinalizeManager.finalize()]);
  assert.deepEqual(stopFinalizeLifecycle, ['init:1', 'finalize:1', 'init:2', 'finalize:2']);
  assert.equal(stopFinalizeImports, 1, 're-enable após stop mantém cache');

  // 19. Re-enable/revisões durante finalize real bloqueado: só a última configuração inicializa.
  const revisionFinalizeGate = deferred();
  const revisionFinalizeStarted = deferred();
  const revisionFinalizeLifecycle = [];
  const revisionFinalizeManager = createPluginManager();
  const revisionFinalizeLoader = createExtensionLoader({ importModule: async () => ({ default: { events: {
    onAppInit: ({ params }) => revisionFinalizeLifecycle.push(`init:${params.version}`),
    onAppFinalize: async ({ params }) => {
      revisionFinalizeLifecycle.push(`finalize:${params.version}`);
      if (params.version === 1) { revisionFinalizeStarted.resolve(); await revisionFinalizeGate.promise; }
    },
    onContentPrepare: (value, { params }) => `${value}:${params.version}`
  } } }) });
  const revisionFinalizeHooks = lifecycleHooks(revisionFinalizeManager);
  await revisionFinalizeLoader.ensurePluginsRegistered(revisionFinalizeManager, [pluginRecord('latest', 'cached', '{"version":1}')], revisionFinalizeHooks);
  const disablingForRevision = revisionFinalizeLoader.ensurePluginsRegistered(revisionFinalizeManager, [], revisionFinalizeHooks);
  await revisionFinalizeStarted.promise;
  const obsoleteReenable = revisionFinalizeLoader.ensurePluginsRegistered(revisionFinalizeManager, [pluginRecord('latest', 'cached', '{"version":2}')], revisionFinalizeHooks);
  const latestReenable = revisionFinalizeLoader.ensurePluginsRegistered(revisionFinalizeManager, [pluginRecord('latest', 'cached', '{"version":3}')], revisionFinalizeHooks);
  const sharedFinalize = revisionFinalizeManager.finalize();
  assert.deepEqual(revisionFinalizeLifecycle, ['init:1', 'finalize:1']);
  revisionFinalizeGate.resolve();
  await Promise.all([disablingForRevision, obsoleteReenable, latestReenable, sharedFinalize]);
  assert.deepEqual(revisionFinalizeLifecycle, ['init:1', 'finalize:1', 'init:3']);
  assert.equal(await revisionFinalizeManager.prepareContent('x'), 'x:3');

  console.log('ok - resolveModuleEntries agrupa por posição, converte settingsJson, aplica default de posição desconhecida e filtra escopo por rota/categoria');
  console.log('ok - createExtensionLoader.ensureModuleRegistered reaproveita módulos nativos sem import, registra extensões válidas uma única vez, e falhas de import resolvem false sem lançar');
  console.log('ok - createExtensionLoader.ensurePluginsRegistered registra plugins habilitados ainda ausentes, ignora desabilitados e não reimporta plugins já registrados');
  console.log('ok - plugins isolam corrupção/import/contratos/hooks rejeitados e eliminam keys duplicadas determinísticamente');
  console.log('ok - races de import/init/finalize e revisões por manager mantêm latest-wins sem lifecycle duplicado; pipelines usam snapshot estável');
  console.log('ok - cancelPendingPlugins invalida imports pendentes sem registro/init tardio e preserva registros existentes para finalize do host');
  console.log('ok - disable/finalize bloqueado/stop compartilham finalize exactly-once; re-enable preserva cache e revisões latest-wins');
  console.log('dynamic modules: 14 testes aprovados');
}
