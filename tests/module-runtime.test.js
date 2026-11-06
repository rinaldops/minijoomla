import assert from 'node:assert/strict';
import { resolveModuleEntries, createExtensionLoader } from '../src/libraries/minijoomla/modules/dynamic-modules.js';
import { createModuleRegistry } from '../src/libraries/minijoomla/modules/registry.js';
import { createPluginManager } from '../src/libraries/minijoomla/plugins/manager.js';
import { resolveActiveMenuItemId } from '../src/libraries/minijoomla/application/module-assignment.js';
import { articlesLatestModule } from '../src/modules/mod_articles_latest/mod_articles_latest.js';
import { customHtmlModule } from '../src/modules/mod_custom/mod_custom.js';
import { MODULE_ADVANCED_PARAMS } from '../src/libraries/minijoomla/application/module-catalog.js';
import { createApplication } from '../src/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

export async function runModuleRuntimeTests() {
  // 1. assignment 'only' com token route:home aparece em home, não em search.
  const onlyHome = [{ extensionKey: 'only-home', position: 'sidebar', enabled: true, assignment: 'only', assignmentJson: JSON.stringify(['route:home']) }];
  assert.deepEqual(resolveModuleEntries(onlyHome, { route: 'home' }).sidebar.map((e) => e.name), ['only-home']);
  assert.deepEqual(resolveModuleEntries(onlyHome, { route: 'search' }).sidebar.map((e) => e.name), []);

  // 2. assignment 'except' inverte o comportamento de 'only'.
  const exceptHome = [{ extensionKey: 'except-home', position: 'sidebar', enabled: true, assignment: 'except', assignmentJson: JSON.stringify(['route:home']) }];
  assert.deepEqual(resolveModuleEntries(exceptHome, { route: 'home' }).sidebar.map((e) => e.name), []);
  assert.deepEqual(resolveModuleEntries(exceptHome, { route: 'search' }).sidebar.map((e) => e.name), ['except-home']);

  // 3. registro legado sem `assignment` continua usando scopeKind/scopeRoute/scopeCategoryAlias.
  const legacy = [{ extensionKey: 'legacy-noticias', position: 'sidebar', enabled: true, scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias: 'noticias' }];
  assert.deepEqual(resolveModuleEntries(legacy, { route: 'category', categoryAlias: 'noticias' }).sidebar.map((e) => e.name), ['legacy-noticias']);
  assert.deepEqual(resolveModuleEntries(legacy, { route: 'category', categoryAlias: 'outra' }).sidebar.map((e) => e.name), []);

  // 4. trashed exclui mesmo com enabled !== false.
  const trashed = [{ extensionKey: 'trashed-one', position: 'sidebar', enabled: true, trashed: true }];
  assert.deepEqual(resolveModuleEntries(trashed, {}).sidebar, []);

  // 5. janela de publicação (publishUp/publishDown) com `now` determinístico, incluindo limites exatos.
  const now = new Date('2026-06-15T12:00:00Z');
  const windowed = [
    { extensionKey: 'future', position: 'sidebar', enabled: true, publishUp: '2026-07-01T00:00:00Z' },
    { extensionKey: 'past', position: 'sidebar', enabled: true, publishDown: '2026-06-01T00:00:00Z' },
    { extensionKey: 'inside', position: 'sidebar', enabled: true, publishUp: '2026-01-01T00:00:00Z', publishDown: '2026-12-01T00:00:00Z' },
    { extensionKey: 'exact-up', position: 'sidebar', enabled: true, publishUp: now.toISOString() },
    { extensionKey: 'exact-down', position: 'sidebar', enabled: true, publishDown: now.toISOString() }
  ];
  // publishUp exatamente igual a `now` já é visível (>= up); publishDown exatamente igual a `now` já não é mais visível (>= down é "expirado").
  assert.deepEqual(resolveModuleEntries(windowed, {}, now).sidebar.map((e) => e.name), ['inside', 'exact-up']);

  // 5b. assignment 'none' nunca aparece em nenhuma rota.
  const noneAssigned = [{ extensionKey: 'never', position: 'sidebar', enabled: true, assignment: 'none' }];
  assert.deepEqual(resolveModuleEntries(noneAssigned, { route: 'home' }).sidebar, []);
  assert.deepEqual(resolveModuleEntries(noneAssigned, { route: 'search' }).sidebar, []);

  // 6. showTitle/moduleClass/headerTag/headerClass extraídos de settingsJson, removidos de `settings`.
  const chrome = [{ extensionKey: 'chrome-one', position: 'sidebar', enabled: true, showTitle: false, settingsJson: JSON.stringify({ limit: 7, moduleClass: 'my-class', headerTag: 'h3', headerClass: 'hdr' }) }];
  const [entry] = resolveModuleEntries(chrome, {}).sidebar;
  assert.equal(entry.showTitle, false);
  assert.equal(entry.moduleClass, 'my-class');
  assert.equal(entry.headerTag, 'h3');
  assert.equal(entry.headerClass, 'hdr');
  assert.deepEqual(entry.settings, { limit: 7 });

  // 7. registry.renderPosition: moduleClass gera wrapper; ausência não gera wrapper extra.
  const registry = createModuleRegistry().register('chrome-one', { settings: {}, render: () => '<p>ok</p>' }).register('plain', { settings: {}, render: () => '<p>plain</p>' });
  const withClass = registry.renderPosition('sidebar', [{ name: 'chrome-one', position: 'sidebar', order: 0, moduleClass: 'my-class' }], {});
  assert.equal(withClass, '<div class="module my-class"><p>ok</p></div>');
  const withoutClass = registry.renderPosition('sidebar', [{ name: 'plain', position: 'sidebar', order: 0 }], {});
  assert.equal(withoutClass, '<p>plain</p>');

  // 8. content-modules: showTitle false omite título; headerTag/headerClass customizam; headerTag inválido cai para h2.
  const latestNoTitle = articlesLatestModule.render({ articles: [{ alias: 'a', title: 'A' }], showTitle: false });
  assert.ok(!latestNoTitle.includes('<h2>') && !latestNoTitle.includes('Artigos recentes'));
  const latestCustom = articlesLatestModule.render({ articles: [{ alias: 'a', title: 'A' }], headerTag: 'h3', headerClass: 'foo' });
  assert.ok(latestCustom.includes('<h3 class="foo">Artigos recentes</h3>'));
  const latestUnsafe = articlesLatestModule.render({ articles: [{ alias: 'a', title: 'A' }], headerTag: 'script' });
  assert.ok(!latestUnsafe.includes('<script>'));
  assert.ok(latestUnsafe.includes('<h2>Artigos recentes</h2>'));

  // 9. customHtmlModule: título respeita showTitle/headerTag/headerClass quando settings.title presente.
  const customWithTitle = customHtmlModule.render({ settings: { title: 'Aviso', html: '<p>Oi</p>' }, headerTag: 'h4', headerClass: 'bar' });
  assert.ok(customWithTitle.includes('<h4 class="bar">Aviso</h4>'));
  const customNoTitleShown = customHtmlModule.render({ settings: { title: 'Aviso', html: '<p>Oi</p>' }, showTitle: false });
  assert.ok(!customNoTitleShown.includes('Aviso'));

  // 10. ensurePluginsRegistered: ordem de execução real respeita `ordering` persistido, independente da ordem de conclusão dos imports concorrentes.
  const callOrder = [];
  const importOrdering = async (url) => {
    if (url.includes('slow')) { await new Promise((resolve) => setTimeout(resolve, 20)); return { default: { events: { onContentPrepare: (value) => { callOrder.push('slow-but-first-ordering'); return value; } } } }; }
    return { default: { events: { onContentPrepare: (value) => { callOrder.push('fast-but-second-ordering'); return value; } } } };
  };
  const orderingManager = createPluginManager();
  const orderingLoader = createExtensionLoader({ importModule: importOrdering });
  await orderingLoader.ensurePluginsRegistered(orderingManager, [
    { key: 'fast-but-second-ordering', type: 'Plugin', entryPointUrl: '../extensions/fast.js', enabled: true, ordering: 20 },
    { key: 'slow-but-first-ordering', type: 'Plugin', entryPointUrl: '../extensions/slow.js', enabled: true, ordering: 10 }
  ]);
  await orderingManager.prepareContent('x');
  assert.deepEqual(callOrder, ['slow-but-first-ordering', 'fast-but-second-ordering']);

  // 11. ensurePluginsRegistered: paramsJson persistido chega como context.params no handler.
  const paramsManager = createPluginManager();
  const paramsLoader = createExtensionLoader({ importModule: async () => ({ default: { events: { onContentPrepare: (value, context) => `${value}:${context.params.greeting}` } } }) });
  await paramsLoader.ensurePluginsRegistered(paramsManager, [
    { key: 'with-params', type: 'Plugin', entryPointUrl: '../extensions/with-params.js', enabled: true, paramsJson: JSON.stringify({ greeting: 'oi' }) }
  ]);
  assert.equal(await paramsManager.prepareContent('x'), 'x:oi');

  // 11b. Snapshot efetivo: re-navigation é no-op; params/ordering/url mudados atualizam plugins ativos.
  const lifecycle = [];
  const imported = [];
  const runtimeManager = createPluginManager().register({ name: 'static', events: {
    onContentPrepare: (value) => `${value}:static`,
    onAppInit: () => lifecycle.push('init:static'), onAppFinalize: () => lifecycle.push('finalize:static')
  } });
  const runtimeLoader = createExtensionLoader({ importModule: async (url) => {
    imported.push(url);
    return { default: { events: {
      onContentPrepare: (value, { params }) => `${value}:${url}:${params.label}`,
      onSearchPrepare: (value, { params }) => `${value}:${params.label}`,
      onAppInit: ({ params }) => lifecycle.push(`init:${url}:${params.label}`),
      onAppFinalize: ({ params }) => lifecycle.push(`finalize:${url}:${params.label}`)
    } } };
  } });
  const runtimeHooks = { onRegister: (name) => runtimeManager.init({}, name), onRemove: (name) => runtimeManager.finalize({}, name) };
  const initialPlugins = [
    { key: 'b', type: 'Plugin', entryPointUrl: 'b-v1', ordering: 20, paramsJson: '{"label":"B","nested":{"z":2,"a":1}}' },
    { key: 'a', type: 'Plugin', entryPointUrl: 'a-v1', ordering: 10, paramsJson: '{"label":"A"}' },
    { key: 'static', type: 'Plugin', entryPointUrl: 'never-import-static', ordering: -100, paramsJson: '{"label":"ignored"}' }
  ];
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, initialPlugins, runtimeHooks);
  assert.deepEqual(lifecycle, ['init:a-v1:A', 'init:b-v1:B']);
  assert.equal(await runtimeManager.prepareContent('x'), 'x:static:a-v1:A:b-v1:B');
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, [...initialPlugins].reverse(), runtimeHooks);
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, initialPlugins.map((extension) => extension.key === 'b'
    ? { ...extension, paramsJson: '{ "nested": {"a":1,"z":2}, "label": "B" }', ordering: '20' } : extension), runtimeHooks);
  assert.deepEqual(lifecycle, ['init:a-v1:A', 'init:b-v1:B'], 'ordem de linhas/keys JSON e whitespace não reinicializam');
  assert.equal(imported.length, 2);
  const changedPlugins = initialPlugins.map((extension) => extension.key === 'b'
    ? { ...extension, ordering: 5, paramsJson: '{"label":"B2"}' } : extension);
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, changedPlugins, runtimeHooks);
  assert.deepEqual(lifecycle.slice(2), ['finalize:b-v1:B', 'init:b-v1:B2']);
  assert.equal(await runtimeManager.prepareContent('x'), 'x:static:b-v1:B2:a-v1:A');
  assert.equal(await runtimeManager.prepareSearchQuery('q'), 'q:B2:A');
  const reorderedPlugins = changedPlugins.map((extension) => extension.key === 'a' ? { ...extension, ordering: 1 } : extension);
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, reorderedPlugins, runtimeHooks);
  assert.deepEqual(lifecycle.slice(4), ['finalize:a-v1:A', 'init:a-v1:A']);
  assert.equal(await runtimeManager.prepareContent('x'), 'x:static:a-v1:A:b-v1:B2');
  assert.equal(imported.length, 2, 'params e reorder reutilizam o import');
  const replacementPlugins = reorderedPlugins.map((extension) => extension.key === 'a' ? { ...extension, entryPointUrl: 'a-v2' } : extension);
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, replacementPlugins, runtimeHooks);
  assert.deepEqual(lifecycle.slice(6), ['finalize:a-v1:A', 'init:a-v2:A']);
  assert.equal(await runtimeManager.prepareContent('x'), 'x:static:a-v2:A:b-v1:B2');
  const disabledPlugins = replacementPlugins.map((extension) => extension.key === 'a' ? { ...extension, enabled: false } : extension);
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, disabledPlugins, runtimeHooks);
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, disabledPlugins, runtimeHooks);
  assert.deepEqual(lifecycle.slice(8), ['finalize:a-v2:A']);
  assert.equal(await runtimeManager.prepareContent('x'), 'x:static:b-v1:B2');
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, replacementPlugins, runtimeHooks);
  assert.deepEqual(lifecycle.slice(9), ['init:a-v2:A']);
  assert.deepEqual(imported.sort(), ['a-v1', 'a-v2', 'b-v1']);
  await runtimeLoader.ensurePluginsRegistered(runtimeManager, [], runtimeHooks);
  assert.equal(await runtimeManager.prepareContent('x'), 'x:static');
  assert.ok(!lifecycle.some((event) => event.includes('static')), 'loader não gerencia lifecycle dos estáticos');

  // 11c. Params aninhados não compartilham referências com o registrador ou outros handlers.
  const originalParams = { nested: { label: 'saved', values: [{ id: 1 }] } };
  const immutableManager = createPluginManager();
  let observedParams;
  immutableManager.register({ name: 'immutable', params: originalParams, events: {
    onContentPrepare: (value, { params }) => {
      observedParams = params;
      assert.ok(Object.isFrozen(params.nested) && Object.isFrozen(params.nested.values) && Object.isFrozen(params.nested.values[0]));
      assert.throws(() => { params.nested.label = 'mutated'; }, TypeError);
      return `${value}:${params.nested.label}:${params.nested.values[0].id}`;
    }
  } });
  originalParams.nested.label = 'external';
  originalParams.nested.values[0].id = 2;
  assert.equal(await immutableManager.prepareContent('x'), 'x:saved:1');
  assert.notEqual(observedParams.nested, originalParams.nested);
  assert.throws(() => immutableManager.register({ name: 'immutable', events: {} }), /já registrado/);

  // 11d. Mesmo app relê registros em nova navegação: o adapter recebe o filtro com params salvos novos.
  const navigationQueries = [];
  const navigationLifecycle = [];
  let navigationImports = 0;
  let navigationPlugin = { key: 'navigation', type: 'Plugin', enabled: true, entryPointUrl: 'navigation-v1', paramsJson: '{"suffix":"old"}' };
  const navigationApp = createApplication({ autoStart: false, documentRef: null,
    adapter: { listMenus: async () => [], listTags: async () => [], listArticles: async ({ search } = {}) => {
      if (search) navigationQueries.push(search);
      return { items: [] };
    } },
    getModuleInstances: async () => [], getExtensions: async () => [navigationPlugin],
    importModule: async () => { navigationImports += 1; return { default: { events: {
      onSearchPrepare: (value, { params }) => `${value}-${params.suffix}`,
      onAppInit: ({ params }) => navigationLifecycle.push(`init:${params.suffix}`),
      onAppFinalize: ({ params }) => navigationLifecycle.push(`finalize:${params.suffix}`)
    } } }; }
  });
  try {
    await navigationApp.start();
    await navigationApp.router.navigate('#/search?q=first');
    navigationPlugin = { ...navigationPlugin, paramsJson: '{"suffix":"new"}' };
    await navigationApp.router.navigate('#/search?q=second');
    await navigationApp.router.navigate('#/search?q=third');
    navigationPlugin = { ...navigationPlugin, enabled: false };
    await navigationApp.router.navigate('#/search?q=fourth');
    navigationPlugin = { ...navigationPlugin, enabled: true };
    await navigationApp.router.navigate('#/search?q=fifth');
    assert.deepEqual(navigationQueries, ['first-old', 'second-new', 'third-new', 'fourth', 'fifth-new']);
    assert.deepEqual(navigationLifecycle, ['init:old', 'finalize:old', 'init:new', 'finalize:new', 'init:new']);
    assert.equal(navigationImports, 1);
  } finally { navigationApp.stop(); }
  assert.deepEqual(navigationLifecycle.slice(-1), ['finalize:new']);

  // 11e. Repro real P2: init -> disable com finalize bloqueado -> stop não duplica finalize.
  const appFinalizeGate = deferred();
  const appFinalizeStarted = deferred();
  const appFinalizeCalls = [];
  let appFinalizeEnabled = true;
  let appFinalizeImports = 0;
  const finalizingApp = createApplication({ autoStart: false, documentRef: null,
    adapter: { listMenus: async () => [], listTags: async () => [], listArticles: async () => ({ items: [] }) },
    getModuleInstances: async () => [],
    getExtensions: async () => [{ key: 'finalizing', type: 'Plugin', enabled: appFinalizeEnabled, entryPointUrl: 'finalizing' }],
    importModule: async () => { appFinalizeImports += 1; return { default: { events: {
      onAppInit: () => appFinalizeCalls.push('init'),
      onAppFinalize: async () => { appFinalizeCalls.push('finalize'); appFinalizeStarted.resolve(); await appFinalizeGate.promise; }
    } } }; }
  });
  try {
    await finalizingApp.start();
    appFinalizeEnabled = false;
    const disableNavigation = finalizingApp.router.navigate('#/search?q=disable');
    await appFinalizeStarted.promise;
    finalizingApp.stop();
    finalizingApp.stop();
    assert.deepEqual(appFinalizeCalls, ['init', 'finalize'], 'disable et stop não duplicam hook pendente');
    appFinalizeGate.resolve();
    await disableNavigation;
    assert.equal(finalizingApp.plugins.has('finalizing'), false);
    appFinalizeEnabled = true;
    await finalizingApp.start();
    assert.deepEqual(appFinalizeCalls, ['init', 'finalize', 'init']);
    assert.equal(appFinalizeImports, 1);
    finalizingApp.stop();
    await finalizingApp.plugins.finalize();
    assert.deepEqual(appFinalizeCalls, ['init', 'finalize', 'init', 'finalize']);
  } finally { appFinalizeGate.resolve(); finalizingApp.stop(); }

  // 11f. Manager reserva todos os alvos antes do await e compartilha finalize global/nomeado, mesmo rejeitado.
  const managerFinalizeGate = deferred();
  const managerFinalizeCalls = [];
  const onceManager = createPluginManager().register({ name: 'first', events: {
    onAppInit: () => managerFinalizeCalls.push('init:first'),
    onAppFinalize: async () => { managerFinalizeCalls.push('finalize:first'); await managerFinalizeGate.promise; }
  } }).register({ name: 'second', events: {
    onAppInit: () => managerFinalizeCalls.push('init:second'),
    onAppFinalize: async () => { managerFinalizeCalls.push('finalize:second'); throw new Error('rejeitado'); }
  } });
  await onceManager.init();
  await onceManager.init();
  const globalFinalize = onceManager.finalize();
  const namedFinalize = onceManager.finalize({}, 'second');
  const repeatedGlobalFinalize = onceManager.finalize();
  assert.deepEqual(managerFinalizeCalls, ['init:first', 'init:second', 'finalize:first']);
  managerFinalizeGate.resolve();
  await Promise.all([globalFinalize, namedFinalize, repeatedGlobalFinalize]);
  await onceManager.finalize();
  assert.deepEqual(managerFinalizeCalls, ['init:first', 'init:second', 'finalize:first', 'finalize:second']);
  await onceManager.init();
  await onceManager.finalize();
  assert.deepEqual(managerFinalizeCalls.slice(4), ['init:first', 'init:second', 'finalize:first', 'finalize:second'], 'init abre ciclo novo no mesmo registro após stop');

  // 11g. Init solicitado durante finalize aguarda a conclusão; finalize não pode apagar o novo ciclo.
  const cycleGate = deferred();
  const cycleCalls = [];
  const cycleManager = createPluginManager().register({ name: 'cycle', events: {
    onAppInit: () => cycleCalls.push('init'),
    onAppFinalize: async () => { cycleCalls.push('finalize'); await cycleGate.promise; }
  } });
  await cycleManager.init();
  const cycleFinalize = cycleManager.finalize();
  const cycleReinit = cycleManager.init();
  const duplicateReinit = cycleManager.init();
  assert.deepEqual(cycleCalls, ['init', 'finalize']);
  cycleGate.resolve();
  await Promise.all([cycleFinalize, cycleReinit, duplicateReinit]);
  assert.deepEqual(cycleCalls, ['init', 'finalize', 'init']);
  await cycleManager.finalize();
  assert.deepEqual(cycleCalls, ['init', 'finalize', 'init', 'finalize']);

  // 12. resolveActiveMenuItemId: resolve o único item cujo path bate exatamente; devolve undefined para ambíguo/nenhum.
  const menus = [{ id: 1, path: '/' }, { id: 2, path: '/category/noticias' }];
  assert.equal(resolveActiveMenuItemId(menus, '/category/noticias'), 2);
  assert.equal(resolveActiveMenuItemId(menus, '/rota-sem-item'), undefined);
  assert.equal(resolveActiveMenuItemId([{ id: 1, path: '/x' }, { id: 2, path: '/x' }], '/x'), undefined, 'dois itens para o mesmo path não escolhem um arbitrariamente');
  assert.equal(resolveActiveMenuItemId(null, '/'), undefined);

  // 13. resolveModuleEntries integra menuItemId resolvido ao contexto de atribuição: `menu:<id>` só casa quando o id resolvido bate.
  const menuAssigned = [{ extensionKey: 'menu-item-2-only', position: 'sidebar', enabled: true, assignment: 'only', assignmentJson: JSON.stringify(['menu:2']) }];
  assert.deepEqual(resolveModuleEntries(menuAssigned, { route: 'category', categoryAlias: 'noticias', menuItemId: resolveActiveMenuItemId(menus, '/category/noticias') }).sidebar.map((e) => e.name), ['menu-item-2-only']);
  assert.deepEqual(resolveModuleEntries(menuAssigned, { route: 'home', menuItemId: resolveActiveMenuItemId(menus, '/') }).sidebar, []);

  console.log('ok - resolveModuleEntries aplica assignment novo (only/except), preserva escopo legado, exclui trashed/fora-da-janela e extrai chrome de settingsJson');
  console.log('ok - registry.renderPosition envolve com moduleClass quando presente e propaga showTitle/headerTag/headerClass ao contexto');
  console.log('ok - módulos nativos e custom-html respeitam showTitle/headerTag/headerClass com allowlist segura de tag');
  console.log('ok - ensurePluginsRegistered executa plugins na ordem de "ordering" persistido, não na ordem de conclusão dos imports concorrentes, e propaga paramsJson como context.params');
  console.log('ok - refresh managed plugins aplica params/ordering/url, é no-op sem mudanças, finaliza disable e reativa com cache sem tocar estáticos; params aninhados são snapshots imutáveis');
  console.log('ok - nova navegação no mesmo createApplication aplica params persistidos novos ao filtro consumido pelo adapter, sem reimport nem lifecycle duplicado');
  console.log('ok - P2 real disable/finalize bloqueado/stop finaliza uma vez e re-enable mantém cache; manager deduplica alvos/ciclos e serializa reinit pendente');
  console.log('ok - resolveActiveMenuItemId resolve item único por path, devolve undefined para ambíguo/ausente, e menuItemId resolvido alimenta corretamente a atribuição menu:<id>');

  // 14. regression: o <select> real do formulário administrativo (aba
  // "Avançado") deve oferecer EXATAMENTE as mesmas 9 tags aceitas pela
  // validação do serviço (admin-service.js, "headerTag inválida") e pelo
  // runtime público (HEADER_TAGS em dynamic-modules.js/content-modules.js)
  // — achado real: a UI ficava mais restrita que o próprio contrato que
  // ela existe para configurar, impedindo h1/p mesmo sendo valores válidos
  // já aceitos pelo backend e pelo runtime.
  const headerTagField = MODULE_ADVANCED_PARAMS.find((field) => field.name === 'headerTag');
  assert.deepEqual(headerTagField.options.map((option) => option.value), ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p']);

  console.log('ok - MODULE_ADVANCED_PARAMS.headerTag options match exactly the 9 tags accepted by admin-service validation and the public runtime allowlist (h1/p were missing from the UI)');
  console.log('module runtime: 12 testes aprovados');
}
