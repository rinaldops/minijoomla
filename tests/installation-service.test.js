import assert from 'node:assert/strict';
import { createInstallationService, INSTALLATION_DOMAINS } from '../src/libraries/minijoomla/application/installation-service.js';

const clone = value => JSON.parse(JSON.stringify(value));
const selected = { siteName: 'Meu site' };
const TITLES = ['MiniJoomlaCategories', 'MiniJoomlaTags', 'MiniJoomlaArticles', 'MiniJoomlaMenu', 'MiniJoomlaExtensions', 'MiniJoomlaTemplates', 'MiniJoomlaModuleInstances', 'MiniJoomlaSiteConfig'];
const title = domain => TITLES[INSTALLATION_DOMAINS.indexOf(domain)];

function fixture() {
  const state = { lists: new Map(), configuration: null, etag: null, writes: [], events: [], journal: null, journalWrites: 0 };
  const hooks = {};
  const journalStore = {
    async clear(expected) { assert.deepEqual(state.journal, expected); state.journal = null; },
    async read() { if (hooks.get) await hooks.get(); return clone(state.journal); },
    async write(value) {
      assert.ok(JSON.stringify(value).length <= 10000, 'journal limitado a 10k');
      state.journalWrites++; state.events.push('journal');
      if (hooks.set) await hooks.set(value);
      state.journal = clone(value);
    }
  };
  const report = domain => state.lists.get(domain) ?? { domain, title: title(domain), id: null, exists: false, compatible: false, empty: true, itemCount: 0, issues: [], fingerprint: `schema:${domain}:v1` };
  const port = {
    webUrl: '/sites/example', libraryPath: '/sites/example/SiteAssets/minijoomla',
    async inspect() {
      state.events.push('inspect'); if (hooks.inspect) await hooks.inspect();
      return clone({ lists: INSTALLATION_DOMAINS.map(report), configuration: state.configuration, configurationETag: state.etag, configurationExists: state.configuration !== null });
    },
    async provisionList(domain, options) {
      assert.deepEqual(Object.keys(options).sort(), ['expectedAbsent', 'isCurrent']);
      assert.equal(options.expectedAbsent, true); assert.equal(typeof options.isCurrent, 'function');
      if (hooks.beforeCreate) await hooks.beforeCreate(options);
      if (options.isCurrent() !== true) throw Error('stale-port');
      assert.deepEqual(state.journal.pending, { kind: 'list', domain }, 'intenção antes de qualquer criação');
      assert.equal(state.journal.receipts.length, INSTALLATION_DOMAINS.indexOf(domain));
      state.writes.push(`list:${domain}`); state.events.push(`create:${domain}`);
      assert.equal(state.lists.has(domain), false, 'não adotar/repetir lista');
      const list = { domain, title: title(domain), id: `list-${domain}`, exists: true, compatible: true, empty: true, itemCount: 0, issues: [], fingerprint: `schema:${domain}:v1` };
      state.lists.set(domain, list);
      if (hooks.create) await hooks.create(domain, list);
      return clone(list);
    },
    async verifyList(domain, id) {
      state.events.push(`verify:${domain}`); if (hooks.verify) await hooks.verify(domain);
      const list = state.lists.get(domain); assert.equal(list?.id, id); return clone(list);
    },
    async writeConfiguration(configuration, options) {
      assert.deepEqual(Object.keys(options).sort(), ['expectedAbsent', 'isCurrent']);
      assert.equal(options.expectedAbsent, true); assert.equal(typeof options.isCurrent, 'function');
      if (hooks.beforeConfiguration) await hooks.beforeConfiguration(options);
      if (options.isCurrent() !== true) throw Error('stale-port');
      assert.deepEqual(state.journal.pending, { kind: 'configuration' });
      assert.equal(state.journal.receipts.length, 8);
      assert.equal(state.configuration, null); assert.equal(state.lists.size, 8);
      assert.ok([...state.lists.values()].every(list => list.itemCount === 0));
      state.writes.push('configuration'); state.events.push('configuration');
      state.configuration = clone(configuration); state.etag = '"config-1"';
      if (hooks.configuration) await hooks.configuration();
      return { configuration: clone(configuration), etag: state.etag };
    }
  };
  const service = createInstallationService({ port, journalStore });
  return { state, hooks, port, journalStore, service };
}
async function install(f, extra = {}) {
  const inspected = await f.service.inspect();
  return f.service.install({ confirm: true, plan: inspected.plan, settings: selected, ...extra });
}
async function resumable(count = 2) {
  const f = fixture();
  const result = await install(f, { onProgress({ completed }) { if (completed === count) throw Error('interruption'); } });
  assert.equal(result.status, 'partial'); assert.equal(f.state.journal.pending, null);
  f.service = createInstallationService({ port: f.port, journalStore: f.journalStore });
  return f;
}

export async function runInstallationServiceTests() {
  assert.deepEqual(INSTALLATION_DOMAINS, ['categories', 'tags', 'articles', 'menu', 'extensions', 'templates', 'moduleInstances', 'siteConfig']);
  {
    const f = fixture(); assert.equal(f.state.events.length, 0, 'construção sem I/O');
    const a = await f.service.inspect(); const b = await f.service.inspect();
    assert.equal(a.status, 'ready'); assert.equal(a.plan.token, b.plan.token); assert.equal(a.summary.existingLists, 0);
    assert.equal(a.plan.lists.length, 8); assert.equal(a.receiptPending, false);
    assert.deepEqual(f.state.writes, []); assert.equal(f.state.journalWrites, 0, 'inspect somente leitura');
    assert.equal((await f.service.install({ settings: selected, plan: a.plan })).reason, 'confirmation-required');
    const progress = [];
    const stages = [];
    const result = await install(f, { onProgress: value => progress.push(value), onStage:value=>stages.push(value) });
    assert.equal(result.status, 'installed'); assert.equal(progress.length, 8);
    assert.equal(stages[0].phase,'preflight');assert.equal(stages.filter(s=>s.phase==='lists').length,8);assert.equal(stages.at(-2).phase,'configuration');assert.equal(stages.at(-1).phase,'complete');
    assert.deepEqual(f.state.writes, [...INSTALLATION_DOMAINS.map(domain => `list:${domain}`), 'configuration']);
    assert.ok([...f.state.lists.values()].every(list => list.empty && list.itemCount === 0), 'zero conteúdo/editorial/config rows');
    assert.deepEqual(result.configuration.initialSite, { siteName: 'Meu site', siteDescription: '', timezone: 'UTC', language: 'pt-BR', pageSize: 10, templateKey: 'cassiopeia', homeView: 'featured', homeCategory: '', offline: false, offlineMessage: '' });
    assert.deepEqual(result.configuration.joomlaDiscoveryRoots, []); assert.deepEqual(result.configuration.moduleStyles, {});
    assert.equal(f.state.journal.configurationReceipt.etag, '"config-1"');
    for (const domain of INSTALLATION_DOMAINS) assert.equal(result.configuration.lists[domain].listId, `list-${domain}`);
    assert.equal((await f.service.inspect()).status, 'installed');
    for (const list of f.state.lists.values()) { list.empty = false; list.itemCount = 3; }
    assert.equal((await f.service.inspect()).status, 'installed', 'edição posterior de conteúdo não exige listas vazias');
    assert.equal((await install(f)).reason, 'stale-plan'); assert.equal(f.state.writes.length, 9, 'nunca reinstalar nem ativar plano em inspeção instalada');
    f.state.journal = null;
    assert.equal((await f.service.inspect()).status, 'installed', 'configuração válida existente pode ser lida sem journal local');
  }
  console.log('ok - installation: plano estável, confirmação, oito listas vazias, defaults Cassiopeia somente no arquivo, leitura instalada');
  {
    const f = fixture(); await install(f);
    const readOnly = { webUrl: f.port.webUrl, libraryPath: f.port.libraryPath, inspect: f.port.inspect };
    for (const journalStore of [undefined, null]) {
      const service = createInstallationService({ port: readOnly, journalStore });
      const result = await service.inspect();
      assert.equal(result.status, 'installed'); assert.deepEqual(result.configuration, f.state.configuration);
      assert.equal(result.receiptPending, false); assert.equal(f.state.writes.length, 9);
      assert.equal((await service.install({ confirm: true, plan: result.plan, settings: selected })).status, 'unavailable');
    }
    const absent = fixture(); const service = createInstallationService({ port: absent.port });
    const result = await service.inspect();
    assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'journal-unavailable'); assert.equal(result.canResume, false);
    assert.equal((await service.install({ confirm: true, plan: result.plan, settings: selected })).status, 'unavailable');
    assert.equal(absent.state.writes.length, 0); assert.equal(absent.state.journalWrites, 0);
    const readJournal = createInstallationService({ port: readOnly, journalStore: { read: () => null } });
    assert.equal((await readJournal.inspect()).status, 'installed', 'journal somente leitura não impede leitura de instalação válida');
    for (const journalStore of [{}, { read: () => ({ corrupt: true }) }, { read() { throw Error('corrupt storage'); } }]) {
      assert.notEqual((await createInstallationService({ port: readOnly, journalStore }).inspect()).status, 'installed', 'store existente ilegível/corrompido nunca equivale a ausência');
    }
    const pending = await resumable(); pending.state.journal.pending = { kind: 'list', domain: 'articles' };
    const uncertain = await createInstallationService({ port: pending.port, journalStore: { read: pending.journalStore.read } }).inspect();
    assert.equal(uncertain.status, 'partial'); assert.equal(uncertain.receiptPending, true); assert.equal(uncertain.canResume, false);
  }
  console.log('ok - installation: instalação válida sem journal é somente leitura; ausência sem journal indisponível; store corrupto/pendente fail-closed');
  {
    const f = fixture(); assert.equal((await f.service.install({ confirm: true, settings: selected, planToken: 'invented' })).reason, 'stale-plan');
    const inspected = await f.service.inspect();
    f.state.lists.set('tags', { domain: 'tags', title: 'MiniJoomlaTags', id: 'foreign', exists: true, compatible: true, empty: true, itemCount: 0, issues: [], fingerprint: 'schema:tags:v1' });
    assert.equal((await f.service.install({ confirm: true, settings: selected, plan: inspected.plan })).reason, 'stale-plan');
    assert.equal((await f.service.inspect()).status, 'blocked'); assert.equal(f.state.writes.length, 0);
    const all = fixture(); await install(all); all.state.configuration = null; all.state.etag = null; all.state.journal = null; all.state.writes = [];
    assert.equal((await install(all)).reason, 'existing-lists', 'oito listas completas nunca são adotadas sem configuração');
    assert.equal(all.state.writes.length, 0);
  }
  console.log('ok - installation: plano obsoleto, ausência integral antes de iniciar, nenhuma adoção de listas externas');
  {
    const mutations = [
      value => value.lists.pop(),
      value => value.lists[1] = value.lists[0],
      value => delete value.lists[0].fingerprint,
      value => value.lists[0].title = 'AnotherList',
      value => value.lists[0].itemCount = -1,
      value => value.lists[0].itemCount = 1,
      value => value.lists[0].exists = 'false',
      value => value.lists[0].issues = ['x'.repeat(501)],
      value => value.lists[0].extra = true,
      value => value.configurationExists = null
    ];
    for (const mutate of mutations) {
      const f = fixture(); const inspectPort = f.port.inspect;
      f.port.inspect = async () => { const value = await inspectPort(); mutate(value); return value; };
      assert.equal((await f.service.inspect()).status, 'blocked'); assert.equal(f.state.journalWrites, 0);
    }
    assert.equal((await createInstallationService().inspect()).status, 'unavailable');
    const f = fixture(); f.port.inspect = async () => { throw Error('offline'); };
    assert.equal((await f.service.inspect()).status, 'unavailable'); assert.equal(f.state.writes.length, 0);
    for (const webUrl of ['https://example.invalid', '//example.invalid', '/sites/example/../else', '/sites/%2e%2e', '/sites/example?x=1']) {
      const target = fixture(); target.port.webUrl = webUrl;
      assert.equal((await target.service.inspect()).reason, 'invalid-context'); assert.equal(target.state.events.length, 0);
    }
    const target = fixture(); target.port.libraryPath = '/sites/other/SiteAssets';
    assert.equal((await target.service.inspect()).reason, 'invalid-context');
  }
  console.log('ok - installation: relatórios incompletos/duplicados/inconsistentes e ports/contextos inválidos fail-closed');
  {
    let executed = 0;
    const getter = Object.defineProperty({}, 'siteName', { enumerable: true, get() { executed++; return 'bad'; } });
    const toJSON = { siteName: 'bad', toJSON() { executed++; return {}; } };
    const cyclic = { siteName: 'bad' }; cyclic.self = cyclic;
    const sparse = []; sparse.length = 1;
    const invalid = [getter, toJSON, cyclic, sparse, { siteName: 'x', nested: sparse }, { siteName: 'x', callback() { executed++; } }, { siteName: 'x', [Symbol('bad')]: 1 }, { siteName: 'x', timezone: 'not/a-zone' }, { siteName: 'x'.repeat(201) }, { siteName: '' }, { siteName: 'x', timezone: null }, { siteName: 'x', password: 'not-accepted' }, JSON.parse('{"siteName":"x","__proto__":{"bad":true}}'), { siteName: 'x', pageSize: NaN }];
    for (const settings of invalid) {
      const f = fixture(); const result = await install(f, { settings });
      assert.equal(result.status, 'blocked'); assert.equal(f.state.journalWrites, 0); assert.equal(f.state.writes.length, 0);
    }
    assert.equal(executed, 0, 'não executar getters/toJSON/callbacks do payload');
    const f = fixture(); const plan = (await f.service.inspect()).plan;
    const options = Object.defineProperty({ settings: selected, plan }, 'confirm', { get() { executed++; return true; } });
    assert.equal((await f.service.install(options)).reason, 'invalid-options'); assert.equal(executed, 0);
    const valid = fixture(); const result = await install(valid, { settings: { siteName: '  Site  ', siteDescription: 'Descrição', timezone: 'America/Sao_Paulo', language: 'en-US', pageSize: 20 } });
    assert.equal(result.status, 'installed'); assert.equal(result.configuration.initialSite.siteName, 'Site');
  }
  console.log('ok - installation: payload JSON limitado sem execução, chaves desconhecidas recusadas, timezone/strings/defaults validados');
  {
    const f = await resumable(3); const inspected = await f.service.inspect();
    assert.equal(inspected.status, 'partial'); assert.equal(inspected.canResume, true); assert.equal(inspected.summary.recordedLists, 3);
    assert.deepEqual(inspected.settings, { siteName: 'Meu site', siteDescription: '', timezone: 'UTC', language: 'pt-BR', pageSize: 10 });
    assert.deepEqual(inspected.plan.remainingDomains, INSTALLATION_DOMAINS.slice(3));
    const previous = f.state.writes.length;
    assert.equal((await f.service.install({ confirm: true, settings: { siteName: 'other' }, plan: inspected.plan })).reason, 'settings-conflict');
    assert.equal(f.state.writes.length, previous);
    assert.equal((await install(f)).status, 'installed'); assert.equal(f.state.writes.length, 9);
    for (const corrupt of [
      target => target.state.lists.get('categories').fingerprint = 'different-field-constraint',
      target => target.state.lists.get('categories').id = 'replacement-id',
      target => { target.state.lists.get('categories').empty = false; target.state.lists.get('categories').itemCount = 1; },
      target => target.state.lists.get('categories').compatible = false,
      target => target.state.journal.receipts[0].domain = 'tags',
      target => target.state.journal.unknown = { keep: true }
    ]) {
      const target = await resumable(); corrupt(target); const saved = clone(target.state.journal);
      const result = await target.service.inspect(); assert.equal(result.status, 'blocked');
      assert.deepEqual(target.state.journal, saved, 'nunca remover silenciosamente estado desconhecido');
      assert.equal(target.state.writes.length, 2);
    }
    const target = await resumable();
    target.hooks.verify = async domain => { if (domain === 'categories') target.state.lists.get(domain).fingerprint = 'strict-read-difference'; };
    assert.equal((await target.service.inspect()).reason, 'receipt-conflict');
  }
  console.log('ok - installation: retomada só do sufixo com IDs/fingerprints/campos estritos e listas vazias; preservar journal desconhecido');
  {
    for (const afterCreation of [true, false]) {
      const f = fixture();
      if (afterCreation) f.hooks.create = () => { throw Object.assign(Error('uncertain'), { code: 'timeout' }); };
      else f.port.provisionList = async () => { throw Object.assign(Error('denied'), { code: 'access-denied' }); };
      const result = await install(f); assert.equal(result.status, 'partial'); assert.equal(result.reason, 'uncertain-write');
      assert.equal(result.receiptPending, true);
      assert.deepEqual(f.state.journal.pending, { kind: 'list', domain: 'categories' }); assert.equal(f.state.journal.receipts.length, 0);
      f.service = createInstallationService({ port: f.port, journalStore: f.journalStore });
      const inspected = await f.service.inspect(); assert.equal(inspected.status, 'partial'); assert.equal(inspected.canResume, false);
      const writes = f.state.writes.length; await install(f); assert.equal(f.state.writes.length, writes, 'jamais replay mesmo com lista aparentemente correspondente');
    }
    const f = fixture(); f.hooks.set = value => { if (value.receipts.length === 1) throw Error('quota'); };
    assert.equal((await install(f)).reason, 'uncertain-write'); assert.equal(f.state.journal.receipts.length, 0); assert.equal(f.state.writes.length, 1);
    const noAck = fixture(); noAck.journalStore.write = () => {};
    assert.equal((await install(noAck)).reason, 'journal-not-durable'); assert.equal(noAck.state.writes.length, 0);
    const denied = fixture(); denied.journalStore.write = () => { throw Error('quota'); };
    assert.equal((await install(denied)).status, 'unavailable'); assert.equal(denied.state.writes.length, 0);
    const unreadable = fixture(); unreadable.hooks.create = () => { unreadable.hooks.get = () => { throw Error('journal unreadable'); }; };
    const uncertain = await install(unreadable);
    assert.equal(uncertain.status, 'partial'); assert.equal(uncertain.receiptPending, true); assert.equal(uncertain.canResume, false);
    assert.equal(unreadable.state.writes.length, 1, 'resultado preserva incerteza mesmo sem conseguir reler recibo');
  }
  console.log('ok - installation: intenção antes de criar, recibo durável obrigatório, falhas incertas/quota nunca repetidas nem adotadas');
  {
    for (const change of [
      f => f.hooks.configuration = () => { throw Error('lost response'); },
      f => f.hooks.configuration = () => { f.state.etag = 'W/"weak"'; },
      f => f.hooks.configuration = () => { f.state.configuration.initialSite.siteName = 'foreign'; },
      f => f.hooks.set = value => { if (value.configurationReceipt) throw Error('receipt not durable'); }
    ]) {
      const f = fixture(); change(f); assert.equal((await install(f)).reason, 'uncertain-write');
      assert.deepEqual(f.state.journal.pending, { kind: 'configuration' }); assert.equal(f.state.writes.length, 9);
      const refresh = await f.service.inspect(); assert.equal(refresh.status, 'partial'); assert.equal(refresh.receiptPending, true); assert.equal(refresh.canResume, false);
      await install(f); assert.equal(f.state.writes.length, 9, 'configuração write-once incerta não sobrescrita');
    }
    const f = fixture(); await install(f); f.state.etag = '"different"';
    assert.equal((await f.service.inspect()).reason, 'configuration-conflict');
    f.state.etag = '"config-1"'; f.state.configuration.extra = true;
    assert.equal((await f.service.inspect()).status, 'blocked'); assert.equal(f.state.writes.length, 9);
    const target = fixture();
    target.hooks.create = domain => { if (domain === 'siteConfig') { target.state.lists.get('categories').empty = false; target.state.lists.get('categories').itemCount = 1; } };
    assert.equal((await install(target)).status, 'partial'); assert.equal(target.state.configuration, null); assert.equal(target.state.writes.length, 8);
  }
  console.log('ok - installation: configuração write-once, strong ETag e readback exatos, nenhuma configuração com conteúdo editorial');
  {
    const f = fixture(); let active = true;
    const inspected = await f.service.inspect({ isCurrent: () => active });
    f.hooks.set = value => { if (value.pending) active = false; };
    const result = await f.service.install({ confirm: true, plan: inspected.plan, settings: selected, isCurrent: () => active });
    assert.equal(result.status, 'partial'); assert.equal(f.state.writes.length, 0, 'guard imediatamente antes de port write');
    assert.ok(f.state.journal.pending, 'cancelamento não apaga intenção');
    const target = fixture(); let current = true;
    target.hooks.create = () => { current = false; };
    const initial = await target.service.inspect();
    const stopped = await target.service.install({ confirm: true, plan: initial.plan, settings: selected, isCurrent: () => current });
    assert.equal(stopped.reason, 'uncertain-write'); assert.equal(target.state.writes.length, 1); assert.equal(target.state.journal.receipts.length, 0, 'nenhuma escrita de journal após navegação');
    const before = fixture(); assert.equal((await before.service.inspect({ isCurrent: () => false })).reason, 'stale'); assert.equal(before.state.events.length, 0);
    const accessor = fixture(); let getterCalled = false;
    assert.equal((await accessor.service.inspect({ get isCurrent() { getterCalled = true; return () => true; } })).reason, 'invalid-options');
    assert.equal(getterCalled, false);
    const between = fixture(); between.hooks.inspect = () => { if (between.state.lists.size === 1) { between.state.lists.get('categories').empty = false; between.state.lists.get('categories').itemCount = 1; } };
    assert.equal((await install(between)).status, 'partial'); assert.equal(between.state.writes.length, 1, 'reler todos os domínios em cada fronteira');
    const race = fixture(); race.hooks.set = value => {
      if (value.pending?.domain === 'categories') race.state.lists.set('categories', { domain: 'categories', title: title('categories'), id: 'external', exists: true, compatible: true, empty: true, itemCount: 0, issues: [], fingerprint: 'schema:categories:v1' });
    };
    assert.equal((await install(race)).reason, 'uncertain-write'); assert.equal(race.state.writes.length, 0, 'reler destino após persistir intenção antes de criar');
    const contextChange = fixture();
    assert.equal((await install(contextChange, { onProgress() { contextChange.port.libraryPath = '/sites/example/SiteAssets/other'; } })).status, 'partial');
    assert.equal(contextChange.state.writes.length, 1, 'não continuar se o contexto do port mudou');
    for (const phase of ['list', 'configuration']) {
      const target = fixture(); let active = true; const isCurrent = () => active;
      const hook = async options => { assert.equal(options.isCurrent, isCurrent, 'propagar guard original ao port'); active = false; };
      if (phase === 'list') target.hooks.beforeCreate = hook;
      else target.hooks.beforeConfiguration = hook;
      const result = await install(target, { isCurrent });
      assert.equal(result.status, 'partial'); assert.equal(result.receiptPending, true);
      assert.equal(target.state.writes.length, phase === 'list' ? 0 : 8, 'port deve cancelar imediatamente antes de mutação após await interno');
      assert.equal(target.state.configuration, null);
    }
  }
  console.log('ok - installation: cancelamento/navegação em await boundaries e rechecagem de concorrência lateral antes do sufixo');
  {
    const f = fixture(); const second = createInstallationService({ port: f.port, journalStore: f.journalStore });
    const firstPlan = (await f.service.inspect()).plan; const secondPlan = (await second.inspect()).plan;
    let release; let entered;
    const gate = new Promise(resolve => { release = resolve; }); const started = new Promise(resolve => { entered = resolve; });
    f.hooks.get = async () => { entered(); await gate; };
    const pending = f.service.install({ confirm: true, plan: firstPlan, settings: selected });
    await started;
    assert.equal((await second.install({ confirm: true, plan: secondPlan, settings: selected })).reason, 'busy');
    release(); assert.equal((await pending).status, 'installed'); assert.equal(f.state.writes.length, 9);
    const target = fixture(); let locked = 0;
    const service = createInstallationService({ port: target.port, journalStore: target.journalStore, locks: { async withLock(operation) { locked++; return operation(); } } });
    const plan = (await service.inspect()).plan;
    assert.equal((await service.install({ confirm: true, plan, settings: selected })).status, 'installed'); assert.equal(locked, 1);
    const synchronous = fixture();
    synchronous.journalStore.read = () => clone(synchronous.state.journal);
    synchronous.journalStore.write = value => { synchronous.state.journal = clone(value); };
    synchronous.port.webUrl = '/'; synchronous.port.libraryPath = '/SiteAssets/minijoomla';
    assert.equal((await install(synchronous)).status, 'installed', 'journal real read/write síncrono e contexto web raiz');
  }
  console.log('ok - installation: dois engines no mesmo journal retornam busy; lock externo opcional cobre a operação inteira sem promessa global');
  {
    const f = fixture(); let available = false;
    const preflight = async () => ({ ok: available, message: 'SPMIDDLE indisponível', checks: [{ name: 'SPMIDDLE', ok: available, message: 'Contrato verificado' }] });
    f.service = createInstallationService({ port: f.port, journalStore: f.journalStore, preflight });
    assert.equal((await f.service.inspect()).reason, 'prerequisites-unavailable');
    available = true; const plan = (await f.service.inspect()).plan; available = false;
    assert.equal((await f.service.install({ confirm: true, plan, settings: selected })).reason, 'prerequisites-unavailable');
    assert.equal(f.state.journal, null); assert.equal(f.state.writes.length, 0);
    const installed=fixture();await install(installed);
    const reader=createInstallationService({port:installed.port,journalStore:installed.journalStore,preflight:async()=>{throw Error('Readers must not run installation preflight');}});
    assert.equal((await reader.inspect()).status,'installed');
    const empty = fixture(); empty.port.provisionList = async () => { throw Error('dependency'); };
    await install(empty); const e = await empty.service.inspect(); assert.equal(e.canReset, true);
    assert.equal((await empty.service.reset({planToken:e.plan.token})).reason,'confirmation-required');
    assert.equal((await empty.service.reset({confirm:true,planToken:e.plan.token})).reason,'reset-complete');
    assert.equal(empty.state.journal,null);assert.equal((await empty.service.inspect()).status,'ready');
    const partial = await resumable(); partial.port.removeVerifiedEmptyList = async receipt => { partial.state.lists.delete(receipt.domain); };
    const p = await partial.service.inspect();assert.equal(p.canReset,true);
    assert.equal((await partial.service.reset({confirm:true,planToken:p.plan.token})).reason,'reset-complete');assert.equal(partial.state.lists.size,0);
    const foreign = fixture();foreign.hooks.create=()=>{throw Error('lost response');};await install(foreign);
    const b=await foreign.service.inspect();assert.equal(b.canReset,false);assert.equal((await foreign.service.reset({confirm:true,planToken:b.plan.token})).reason,'reset-blocked');assert.ok(foreign.state.journal.pending);
    const changed = await resumable();changed.port.removeVerifiedEmptyList=async()=>{throw Error('denied');};
    const changedPlan=await changed.service.inspect();const saved=clone(changed.state.journal);
    assert.equal((await changed.service.reset({confirm:true,planToken:changedPlan.plan.token})).status,'unavailable');assert.deepEqual(changed.state.journal,saved);
    changed.state.lists.get('categories').itemCount=1;changed.state.lists.get('categories').empty=false;
    assert.equal((await changed.service.reset({confirm:true,planToken:changedPlan.plan.token})).reason,'stale-plan');assert.deepEqual(changed.state.journal,saved);
    const corrupt=fixture();corrupt.state.journal={invalid:true};assert.equal((await corrupt.service.inspect()).status,'blocked');
    assert.equal((await corrupt.service.reset({confirm:true,planToken:'x'})).status,'blocked');assert.deepEqual(corrupt.state.journal,{invalid:true});
  }
}
