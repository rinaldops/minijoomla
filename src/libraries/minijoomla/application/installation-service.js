/* Generic, creation-only installation. No host, transport, DOM or editorial I/O.
 * A persisted intent without a durable receipt is deliberately never replayed.
 */
export const INSTALLATION_DOMAINS = Object.freeze(['categories', 'tags', 'articles', 'menu', 'extensions', 'templates', 'moduleInstances', 'siteConfig']);
const TITLES = ['MiniJoomlaCategories', 'MiniJoomlaTags', 'MiniJoomlaArticles', 'MiniJoomlaMenu', 'MiniJoomlaExtensions', 'MiniJoomlaTemplates', 'MiniJoomlaModuleInstances', 'MiniJoomlaSiteConfig'];
const FORMAT = 'minijoomla-installation-v1';
const JOURNAL_FORMAT = 'minijoomla-installation-journal-v1';
const STORE_LOCKS = new WeakSet(); // Same object/realm only; not a distributed lock.
const own = (value, key) => Object.hasOwn(value, key);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);

class InstallationError extends Error {
  constructor(status, reason, message) { super(message); this.status = status; this.reason = reason; }
}
const fail = (reason, message = 'Dados de instalação inválidos.', status = 'blocked') => { throw new InstallationError(status, reason, message); };
const text = (value, limit, allowEmpty = false) => typeof value === 'string' && value.length <= limit && (allowEmpty || Boolean(value.trim())) && !/[\u0000-\u001f\u007f]/.test(value);
const strongETag = value => typeof value === 'string' && /^"[^"\u0000-\u001f\u007f]{1,200}"$/.test(value);

// Walk data descriptors, not properties: no getters, toJSON, callbacks, sparse
// arrays, symbols, cycles or exotic prototypes. Proxies are not a sandbox here.
function data(value, maxLength = 10000) {
  const seen = new Set(); let nodes = 0; let characters = 0;
  function walk(input, depth) {
    if (++nodes > 2000 || depth > 12) fail('invalid-data');
    if (input === null || typeof input === 'boolean') return input;
    if (typeof input === 'string') { characters += input.length; if (characters > maxLength) fail('invalid-data'); return input; }
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (!input || typeof input !== 'object' || seen.has(input)) fail('invalid-data');
    const array = Array.isArray(input); const prototype = Object.getPrototypeOf(input);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('invalid-data');
    seen.add(input);
    const descriptors = Object.getOwnPropertyDescriptors(input); const keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string') || keys.length > 1000) fail('invalid-data');
    const result = array ? [] : {};
    if (array && (input.length > 1000 || keys.length !== input.length + 1)) fail('invalid-data');
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !own(descriptor, 'value') || ['__proto__', 'constructor', 'prototype', 'toJSON'].includes(key) || array && !/^(0|[1-9]\d*)$/.test(key)) fail('invalid-data');
      Object.defineProperty(result, key, { value: walk(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    seen.delete(input); return result;
  }
  const result = walk(value, 0);
  if (canonical(result).length > maxLength) fail('invalid-data');
  return result;
}
function keys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(key => !own(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail('invalid-schema');
}
function path(value) {
  if (!text(value, 1000) || value[0] !== '/' || value.includes('//') || /[\\?#%:'"<>\u0000-\u0020\u007f]/.test(value) || value.split('/').some(part => part === '.' || part === '..') || value !== '/' && value.endsWith('/')) fail('invalid-context');
  return value;
}
function context(port) {
  const webUrl = path(port.webUrl); const libraryPath = path(port.libraryPath);
  if (libraryPath === webUrl || webUrl !== '/' && !libraryPath.startsWith(`${webUrl}/`)) fail('invalid-context');
  return { webUrl, libraryPath };
}
function settings(raw) {
  const value = data(raw);
  keys(value, ['siteName'], ['siteDescription', 'timezone', 'language', 'pageSize']);
  if (!text(value.siteName, 200) || own(value, 'siteDescription') && !text(value.siteDescription, 2000, true)) fail('invalid-settings');
  if (own(value, 'timezone') && typeof value.timezone !== 'string' || own(value, 'language') && typeof value.language !== 'string' || own(value, 'pageSize') && typeof value.pageSize !== 'number') fail('invalid-settings');
  const timezone = value.timezone ?? 'UTC';
  if (!text(timezone, 100)) fail('invalid-settings');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { fail('invalid-settings'); }
  const language = value.language ?? 'pt-BR'; const pageSize = value.pageSize ?? 10;
  if (!text(language, 35) || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(language) || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) fail('invalid-settings');
  return { siteName: value.siteName.trim(), siteDescription: value.siteDescription ?? '', timezone, language, pageSize };
}
const initialSite = value => ({ ...value, templateKey: 'cassiopeia', homeView: 'featured', homeCategory: '', offline: false, offlineMessage: '' });
function validateConfiguration(value, ctx, lists) {
  keys(value, ['format', 'webUrl', 'libraryPath', 'lists', 'initialSite', 'joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions', 'state']);
  if (value.format !== FORMAT || value.state !== 'installed' || value.webUrl !== ctx.webUrl || value.libraryPath !== ctx.libraryPath) fail('configuration-conflict');
  keys(value.lists, INSTALLATION_DOMAINS);
  for (const domain of INSTALLATION_DOMAINS) {
    keys(value.lists[domain], ['listId']);
    if (value.lists[domain].listId !== lists.find(list => list.domain === domain).id) fail('configuration-conflict');
  }
  keys(value.initialSite, ['siteName', 'siteDescription', 'timezone', 'language', 'pageSize', 'templateKey', 'homeView', 'homeCategory', 'offline', 'offlineMessage']);
  const selected = Object.fromEntries(['siteName', 'siteDescription', 'timezone', 'language', 'pageSize'].map(key => [key, value.initialSite[key]]));
  if (canonical(value.initialSite) !== canonical(initialSite(settings(selected)))) fail('configuration-conflict');
  if (!Array.isArray(value.joomlaDiscoveryRoots) || value.joomlaDiscoveryRoots.length) fail('configuration-conflict');
  for (const field of ['moduleStyles', 'moduleStyleRevisions']) if (!value[field] || typeof value[field] !== 'object' || Array.isArray(value[field]) || Object.keys(value[field]).length) fail('configuration-conflict');
  return value;
}
function listReport(list, verify = false) {
  keys(list, verify ? ['id', 'fingerprint', 'compatible', 'empty', 'itemCount'] : ['domain', 'title', 'id', 'exists', 'compatible', 'empty', 'itemCount', 'issues', 'fingerprint'], verify ? ['etag', 'domain', 'title', 'exists', 'issues'] : ['etag']);
  if (!text(list.fingerprint, 512) || typeof list.compatible !== 'boolean' || typeof list.empty !== 'boolean' || !Number.isSafeInteger(list.itemCount) || list.itemCount < 0 || list.empty !== (list.itemCount === 0)) fail('invalid-list-report');
  if (verify || list.exists === true) { if (!text(list.id, 200)) fail('invalid-list-report'); }
  else if (list.exists !== false || list.id !== null || !list.empty) fail('invalid-list-report');
  if (!verify && (!INSTALLATION_DOMAINS.includes(list.domain) || list.title !== TITLES[INSTALLATION_DOMAINS.indexOf(list.domain)] || !Array.isArray(list.issues) || list.issues.length > 30 || list.issues.some(issue => !text(issue, 500)) || list.compatible && list.issues.length)) fail('invalid-list-report');
  if (verify && (own(list, 'exists') && list.exists !== true || own(list, 'issues') && (!Array.isArray(list.issues) || list.issues.length))) fail('invalid-list-report');
  return list;
}
function snapshot(raw, ctx) {
  const value = data(raw, 30000);
  keys(value, ['lists', 'configuration', 'configurationETag', 'configurationExists']);
  if (!Array.isArray(value.lists) || value.lists.length !== 8) fail('incomplete-list-report');
  value.lists.forEach(list => listReport(list));
  if (new Set(value.lists.map(list => list.domain)).size !== 8 || new Set(value.lists.filter(list => list.exists).map(list => list.id)).size !== value.lists.filter(list => list.exists).length) fail('duplicate-list-report');
  value.lists.sort((a, b) => INSTALLATION_DOMAINS.indexOf(a.domain) - INSTALLATION_DOMAINS.indexOf(b.domain));
  if (value.configurationExists === false) {
    if (value.configuration !== null || value.configurationETag !== null) fail('configuration-conflict');
  } else if (value.configurationExists === true && strongETag(value.configurationETag)) validateConfiguration(value.configuration, ctx, value.lists);
  else fail('configuration-conflict');
  return value;
}
function journal(raw, ctx) {
  if (raw === null) return null;
  const value = data(raw);
  keys(value, ['format', 'webUrl', 'libraryPath', 'settings', 'receipts', 'pending', 'configurationReceipt']);
  if (value.format !== JOURNAL_FORMAT || value.webUrl !== ctx.webUrl || value.libraryPath !== ctx.libraryPath || canonical(value.settings) !== canonical(settings(value.settings)) || !Array.isArray(value.receipts) || value.receipts.length > 8) fail('journal-conflict');
  value.receipts.forEach((receipt, index) => {
    keys(receipt, ['domain', 'id', 'fingerprint']);
    if (receipt.domain !== INSTALLATION_DOMAINS[index] || !text(receipt.id, 200) || !text(receipt.fingerprint, 512)) fail('journal-conflict');
  });
  if (new Set(value.receipts.map(receipt => receipt.id)).size !== value.receipts.length) fail('journal-conflict');
  if (value.pending !== null) {
    keys(value.pending, ['kind'], ['domain']);
    if (value.pending.kind === 'list' ? value.pending.domain !== INSTALLATION_DOMAINS[value.receipts.length] || value.receipts.length === 8 : value.pending.kind !== 'configuration' || own(value.pending, 'domain') || value.receipts.length !== 8) fail('journal-conflict');
  }
  if (value.configurationReceipt !== null) {
    keys(value.configurationReceipt, ['etag', 'configuration']);
    if (!strongETag(value.configurationReceipt.etag) || value.receipts.length !== 8 || value.pending !== null) fail('journal-conflict');
    validateConfiguration(value.configurationReceipt.configuration, ctx, value.receipts);
  }
  return value;
}
function assessment(view, record) {
  const lists = view.lists;
  if (record?.pending) return { status: 'partial', reason: 'uncertain-write', canResume: false, message: 'Uma intenção não tem recibo durável. Reconciliação manual necessária; nenhuma escrita será repetida.' };
  if (lists.some(list => list.exists && (!list.compatible || list.issues.length))) return { status: 'blocked', reason: 'incompatible-list', canResume: false, message: 'Uma lista existente não atende ao contrato estrito.' };
  if (record) {
    const mismatch = record.receipts.some(receipt => {
      const list = lists.find(entry => entry.domain === receipt.domain);
      return !list.exists || list.id !== receipt.id || list.fingerprint !== receipt.fingerprint;
    });
    if (mismatch) return { status: 'blocked', reason: 'receipt-conflict', canResume: false, message: 'Identidade ou campos de uma lista divergiram do recibo.' };
  }
  if (view.configurationExists) {
    if (lists.some(list => !list.exists) || record && (!record.configurationReceipt || record.configurationReceipt.etag !== view.configurationETag || canonical(record.configurationReceipt.configuration) !== canonical(view.configuration))) return { status: 'blocked', reason: 'configuration-conflict', canResume: false, message: 'Configuração existente não corresponde ao estado comprovado.' };
    return { status: 'installed', reason: 'installed', canResume: false, message: 'Instalação e oito listas verificadas.', configuration: view.configuration };
  }
  if (record?.configurationReceipt) return { status: 'blocked', reason: 'configuration-conflict', canResume: false, message: 'Configuração anteriormente comprovada não está presente.' };
  if (record) {
    if (lists.some((list, index) => index < record.receipts.length ? !list.empty : list.exists)) return { status: 'blocked', reason: 'foreign-state', canResume: false, message: 'Conteúdo ou listas não comprovadas impedem a retomada.' };
    return { status: 'partial', reason: 'resumable-prefix', canResume: true, message: 'Somente o sufixo ausente pode ser criado com os recibos existentes.' };
  }
  return lists.every(list => !list.exists) ? { status: 'ready', reason: 'all-absent', canResume: false, message: 'As oito listas e a configuração estão ausentes. Confirmação explícita necessária.' } : { status: 'blocked', reason: 'existing-lists', canResume: false, message: 'Listas preexistentes não são adotadas, mesmo completas e vazias.' };
}

/** Trusted port: inspect/provisionList/verifyList/writeConfiguration + paths.
 * Trusted journalStore: read()/write(data), durable readback required.
 * Optional locks.withLock(operation) must exclude the entire operation for this
 * destination; only the lock provider may claim cross-session exclusion.
 */
export function createInstallationService({ port, journalStore, locks } = {}) {
  let lastPlan = null;
  const current = callback => { if (callback && callback() !== true) fail('stale', 'Operação cancelada após mudança de contexto.', 'unavailable'); };
  function available(writing = false) {
    if (!port || typeof port.inspect !== 'function' || writing && (['provisionList', 'verifyList', 'writeConfiguration'].some(key => typeof port[key] !== 'function') || !journalStore || typeof journalStore.read !== 'function' || typeof journalStore.write !== 'function' || locks && typeof locks.withLock !== 'function')) fail('port-unavailable', 'Ports de instalação ou journal indisponíveis.', 'unavailable');
    if (journalStore != null && typeof journalStore.read !== 'function') fail('journal-unavailable', 'Journal existente não pode ser lido.', 'unavailable');
    return context(port);
  }
  async function load(isCurrent, ctx) {
    if (canonical(context(port)) !== canonical(ctx)) fail('context-conflict');
    current(isCurrent); const record = journalStore == null ? null : journal(await journalStore.read(), ctx);
    try {
      current(isCurrent); const view = snapshot(await port.inspect(), ctx); current(isCurrent);
      return { record, view };
    } catch (error) {
      if (!record?.pending) throw error;
      const uncertain = new InstallationError('partial', 'uncertain-write', 'Intenção sem recibo durável preservada; leitura indisponível ou conflitante não autoriza repetição.');
      uncertain.receiptPending = true; uncertain.settings = record.settings; throw uncertain;
    }
  }
  function report(loaded, ctx) {
    const result = assessment(loaded.view, loaded.record);
    const token = canonical({ format: FORMAT, ...ctx, view: loaded.view, journal: loaded.record });
    const plan = { token, lists: data(loaded.view.lists, 30000), domains: [...INSTALLATION_DOMAINS], remainingDomains: INSTALLATION_DOMAINS.slice(loaded.record?.receipts.length ?? 0) };
    const selected = loaded.record?.settings ?? (result.configuration ? settings(Object.fromEntries(['siteName', 'siteDescription', 'timezone', 'language', 'pageSize'].map(key => [key, result.configuration.initialSite[key]]))) : null);
    return { ...result, receiptPending: Boolean(loaded.record?.pending), ...(selected ? { settings: data(selected) } : {}), summary: { listCount: 8, existingLists: loaded.view.lists.filter(list => list.exists).length, recordedLists: loaded.record?.receipts.length ?? 0 }, plan };
  }
  const errorResult = error => ({ status: error instanceof InstallationError ? error.status : 'unavailable', reason: error instanceof InstallationError ? error.reason : 'port-failure', message: error instanceof InstallationError ? error.message : 'Não foi possível verificar ou persistir a instalação.', canResume: false, receiptPending: error instanceof InstallationError && error.receiptPending === true, ...(error instanceof InstallationError && error.settings ? { settings: data(error.settings) } : {}) });
  async function persist(record, isCurrent, ctx) {
    const safe = journal(record, ctx);
    current(isCurrent); await journalStore.write(data(safe)); current(isCurrent);
    const saved = journal(await journalStore.read(), ctx); current(isCurrent);
    if (canonical(saved) !== canonical(safe)) fail('journal-not-durable', 'Journal não confirmou persistência durável.', 'unavailable');
  }
  async function verifyPrefix(loaded, isCurrent) {
    for (const receipt of loaded.record?.receipts ?? []) {
      if (typeof port.verifyList !== 'function') fail('port-unavailable', 'Port de verificação estrita indisponível.', 'unavailable');
      current(isCurrent); const list = listReport(data(await port.verifyList(receipt.domain, receipt.id)), true); current(isCurrent);
      if (list.id !== receipt.id || list.fingerprint !== receipt.fingerprint || !list.compatible || !list.empty) fail('receipt-conflict');
    }
  }
  async function inspect(options = {}) {
    lastPlan = null;
    try {
      const descriptors = Object.getOwnPropertyDescriptors(options);
      if (Reflect.ownKeys(descriptors).some(key => key !== 'isCurrent' || !own(descriptors[key], 'value'))) fail('invalid-options');
      const isCurrent = descriptors.isCurrent?.value;
      if (isCurrent !== undefined && typeof isCurrent !== 'function') fail('invalid-current');
      const ctx = available(); const loaded = await load(isCurrent, ctx);
      const result = report(loaded, ctx);
      if ((result.status === 'ready' || result.canResume) && (!journalStore || typeof journalStore.write !== 'function')) return { ...result, status: 'unavailable', reason: 'journal-unavailable', message: 'Journal durável indisponível; instalação e retomada não estão habilitadas.', canResume: false };
      if (result.canResume) await verifyPrefix(loaded, isCurrent);
      current(isCurrent); if (result.status !== 'installed') lastPlan = result.plan.token; return result;
    } catch (error) { return errorResult(error); }
  }
  async function install(options = {}) {
    // Callbacks are explicit cancellation/progress hooks, never action mappings.
    let input; let isCurrent; let onProgress; let record = null; let ctx; let writeUncertain = false;
    try {
      const descriptors = Object.getOwnPropertyDescriptors(options);
      if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !['confirm', 'settings', 'plan', 'planToken', 'isCurrent', 'onProgress'].includes(key) || !own(descriptors[key], 'value'))) fail('invalid-options');
      isCurrent = descriptors.isCurrent?.value; onProgress = descriptors.onProgress?.value;
      if (isCurrent !== undefined && typeof isCurrent !== 'function' || onProgress !== undefined && typeof onProgress !== 'function') fail('invalid-callback');
      input = data(Object.fromEntries(Object.entries(descriptors).filter(([key]) => !['isCurrent', 'onProgress'].includes(key)).map(([key, descriptor]) => [key, descriptor.value])), 80000);
      if (input.confirm !== true) fail('confirmation-required', 'Confirme explicitamente a instalação.');
      input.settings = settings(input.settings); ctx = available(true);
      const portIsCurrent = isCurrent ?? (() => true);
      const requestedToken = input.planToken ?? input.plan?.token;
      if (!text(requestedToken, 50000) || requestedToken !== lastPlan || input.planToken && input.plan && input.planToken !== input.plan.token) fail('stale-plan', 'Inspecione novamente e confirme o plano atual.');
      if (STORE_LOCKS.has(journalStore)) fail('busy', 'Uma instalação já está em andamento neste processo.');
      STORE_LOCKS.add(journalStore);
      try {
        const operation = async () => {
          let loaded = await load(isCurrent, ctx); let state = report(loaded, ctx);
          if (state.plan.token !== requestedToken) fail('stale-plan', 'O destino mudou desde a inspeção.');
          if (state.status !== 'ready' && !state.canResume) return state;
          record = loaded.record;
          if (record && canonical(record.settings) !== canonical(input.settings)) fail('settings-conflict', 'Retomada exige os mesmos ajustes iniciais.');
          await verifyPrefix(loaded, isCurrent);
          if (!record) {
            record = { format: JOURNAL_FORMAT, ...ctx, settings: input.settings, receipts: [], pending: null, configurationReceipt: null };
            await persist(record, isCurrent, ctx);
          }
          // Every boundary rereads all eight lists, configuration and journal.
          for (let index = record.receipts.length; index < 8; index++) {
            loaded = await load(isCurrent, ctx);
            if (canonical(loaded.record) !== canonical(record) || !assessment(loaded.view, loaded.record).canResume) fail('boundary-conflict');
            await verifyPrefix(loaded, isCurrent);
            const domain = INSTALLATION_DOMAINS[index];
            record.pending = { kind: 'list', domain }; await persist(record, isCurrent, ctx);
            loaded = await load(isCurrent, ctx);
            if (canonical(loaded.record) !== canonical(record) || loaded.view.configurationExists || loaded.view.lists.some((list, offset) => offset < index ? !list.exists || !list.empty || !list.compatible || list.id !== record.receipts[offset].id || list.fingerprint !== record.receipts[offset].fingerprint : list.exists)) fail('boundary-conflict');
            current(isCurrent); writeUncertain = true;
            const created = listReport(data(await port.provisionList(domain, { expectedAbsent: true, isCurrent: portIsCurrent })), true); current(isCurrent);
            if (!created.compatible || !created.empty || record.receipts.some(receipt => receipt.id === created.id)) fail('creation-unverified');
            record.receipts.push({ domain, id: created.id, fingerprint: created.fingerprint }); record.pending = null;
            await persist(record, isCurrent, ctx); writeUncertain = false;
            if (onProgress) { current(isCurrent); await onProgress({ phase: 'lists', domain, completed: index + 1, total: 8 }); current(isCurrent); }
          }
          loaded = await load(isCurrent, ctx);
          if (canonical(loaded.record) !== canonical(record) || !assessment(loaded.view, loaded.record).canResume) fail('boundary-conflict');
          await verifyPrefix(loaded, isCurrent);
          const configuration = { format: FORMAT, ...ctx, lists: Object.fromEntries(record.receipts.map(receipt => [receipt.domain, { listId: receipt.id }])), initialSite: initialSite(record.settings), joomlaDiscoveryRoots: [], moduleStyles: {}, moduleStyleRevisions: {}, state: 'installed' };
          record.pending = { kind: 'configuration' }; await persist(record, isCurrent, ctx);
          loaded = await load(isCurrent, ctx);
          if (canonical(loaded.record) !== canonical(record) || loaded.view.configurationExists || loaded.view.lists.some((list, index) => !list.exists || !list.empty || !list.compatible || list.id !== record.receipts[index].id || list.fingerprint !== record.receipts[index].fingerprint)) fail('boundary-conflict');
          await verifyPrefix(loaded, isCurrent);
          current(isCurrent); writeUncertain = true;
          const written = data(await port.writeConfiguration(data(configuration), { expectedAbsent: true, isCurrent: portIsCurrent })); current(isCurrent);
          keys(written, ['etag', 'configuration']);
          if (!strongETag(written.etag) || canonical(written.configuration) !== canonical(configuration)) fail('configuration-unverified');
          current(isCurrent); const verified = snapshot(await port.inspect(), ctx); current(isCurrent);
          if (!verified.configurationExists || verified.configurationETag !== written.etag || canonical(verified.configuration) !== canonical(configuration) || verified.lists.some(list => !list.exists || !list.compatible || !list.empty || list.issues.length || list.fingerprint !== record.receipts.find(receipt => receipt.domain === list.domain).fingerprint)) fail('configuration-unverified');
          record.configurationReceipt = written; record.pending = null; await persist(record, isCurrent, ctx); writeUncertain = false;
          lastPlan = null; return report({ view: verified, record }, ctx);
        };
        return await (locks ? locks.withLock(operation) : operation());
      } finally { STORE_LOCKS.delete(journalStore); }
    } catch (error) {
      lastPlan = null;
      // No clearing intents, rollback or guessed adoption after any exception.
      const result = errorResult(error);
      if (record && (record.pending || writeUncertain)) Object.assign(result, { status: 'partial', receiptPending: true, reason: 'uncertain-write', settings: data(record.settings), message: 'Escrita incerta; não repetir nem inferir sucesso sem recibo durável.' });
      if (record) {
        try {
          const saved = journal(await journalStore.read(), ctx);
          if (saved) return { ...result, status: 'partial', canResume: false, receiptPending: Boolean(saved.pending), settings: data(saved.settings), reason: saved.pending ? 'uncertain-write' : result.reason, message: saved.pending ? 'Escrita incerta; intenção preservada sem repetição automática.' : result.message };
        } catch { /* Retain the original failure; never repair an unreadable journal. */ }
      }
      return result;
    }
  }
  return Object.freeze({ inspect, install });
}
