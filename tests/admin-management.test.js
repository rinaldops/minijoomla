import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { BUILTIN_TEMPLATES } from '../src/libraries/minijoomla/application/template-styles.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { renderAdminList } from '../src/administrator/components/com_minijoomla/render-list.js';
import { managementFilters, filterManagementRows, renderManagementActions } from '../src/administrator/components/com_minijoomla/extension-management.js';

function repository(seed = []) {
  const rows = new Map(seed.map((row) => [row.id, { etag: '"1"', ...row }]));
  let version = 2;
  const api = {
    reads: 0, lastPatch: null,
    async findMany() { return { items: [...rows.values()].map(({ etag, ...row }) => ({ ...row })) }; },
    async findById(id) { api.reads++; return { ...rows.get(id) }; },
    async create(input) {
      const row = { ...input, id: Math.max(0, ...rows.keys()) + 1, etag: `"${version++}"` };
      rows.set(row.id, row);
      return { ...row };
    },
    async update(id, input, { etag } = {}) {
      const row = rows.get(id);
      if (row.etag !== etag) throw Object.assign(new Error('conflict'), { code: 'concurrency-conflict' });
      api.lastPatch = { ...input };
      rows.set(id, { ...row, ...input, etag: `"${version++}"` });
      return null;
    },
    async delete(id, { etag } = {}) {
      if (rows.get(id).etag !== etag) throw Object.assign(new Error('conflict'), { code: 'concurrency-conflict' });
      rows.delete(id);
    }
  };
  return api;
}

function managementDocument() {
  let html = '';
  let buttons = [];
  let search;
  const status = { textContent: '' };
  const element = (dataset = {}) => {
    const listeners = {};
    return { dataset, disabled: false, addEventListener: (name, handler) => { listeners[name] = handler; }, fire: (name) => listeners[name]?.({ preventDefault() {} }) };
  };
  const inputs = new Map();
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      status.textContent = '';
      buttons = [...value.matchAll(/<button[^>]*data-admin-managed-action="([^"]+)"[^>]*data-admin-row-id="(\d+)"/g)].map(([, action, id]) => element({ adminManagedAction: action, adminRowId: id }));
      search = element();
      search.querySelector = (selector) => inputs.get(selector.match(/name="([^"]+)"/)?.[1]) ?? null;
    },
    querySelector(selector) {
      if (selector === '.admin-management-status') return status;
      if (selector === '.admin-searchbar') return search;
      return null;
    },
    querySelectorAll(selector) { return selector === '[data-admin-managed-action]' ? buttons : []; }
  };
  return { documentRef: { body }, status, action: (action, id) => buttons.find((button) => button.dataset.adminManagedAction === action && button.dataset.adminRowId === String(id)), search: () => search, input: (name, value) => inputs.set(name, { value }) };
}

async function staleManagementTests() {
  const build = () => {
    const extensions = repository([{ id: 7, title: 'Plugin', key: 'plugin', type: 'Plugin', entryPointUrl: './plugin.js', enabled: false }]);
    const service = createAdminService({ extensions });
    const doc = managementDocument();
    return { extensions, service, doc, app: createAdminApplication({ adminService: service, documentRef: doc.documentRef, autoStart: false }) };
  };
  for (const invalidate of ['navigate', 'stop']) {
    const f = build();
    try {
      await f.app.router.navigate('#/extensions');
      const button = f.doc.action('toggle', 7), search = f.doc.search();
      if (invalidate === 'stop') f.app.stop(); else await f.app.router.navigate('#/components');
      const html = f.doc.documentRef.body.innerHTML;
      await button.fire('click'); await search.fire('submit');
      assert.equal(f.extensions.lastPatch, null, 'obsolete management buttons never start writes');
      assert.equal(f.doc.documentRef.body.innerHTML, html, 'obsolete search never changes the current route');
    } finally { f.app.stop(); }
  }
  for (const outcome of ['success', 'failure']) {
    const f = build();
    let resolve, reject;
    const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
    const calls = [];
    f.service.extensions.update = (...args) => { calls.push(args); return pending; };
    try {
      await f.app.router.navigate('#/extensions');
      const click = f.doc.action('toggle', 7).fire('click');
      assert.equal(calls.length, 1); assert.equal(calls[0][2].etag, '"1"');
      await f.app.router.navigate('#/extensions');
      const html = f.doc.documentRef.body.innerHTML;
      if (outcome === 'success') resolve(); else reject(new Error('late backend error'));
      await click;
      assert.equal(f.doc.documentRef.body.innerHTML, html, 'obsolete completion never reloads a new screen');
      assert.equal(f.doc.status.textContent, '', 'obsolete failure never reports on a new screen');
    } finally { f.app.stop(); }
  }
  console.log('ok - admin management: stale actions/search and late reloads/errors blocked after navigation or stop');
}

export async function runAdminManagementTests() {
  const adminCss = await readFile(new URL('../src/media/templates/administrator/atum/css/template.css', import.meta.url), 'utf8');
  assert.match(adminCss, /\.admin-state-icon\s*\{[^}]*position:\s*relative\b/, 'status icon contains its absolutely positioned screen-reader label inside the scrollable table');
  assert.match(adminCss, /\.visually-hidden\s*\{[^}]*position:\s*absolute\b/, 'screen-reader text remains available without affecting layout');
  assert.match(renderAdminList({ rows: [{ id: 1, enabled: true }], columns: ['enabled'] }), /<span class="visually-hidden">Habilitado<\/span>/);
  const repositories = {
    extensions: repository([
      { id: 1, title: 'Module A', key: 'module-a', type: 'Module', entryPointUrl: '/extensions/a.js', enabled: true },
      { id: 2, title: 'Plugin B', key: 'plugin-b', type: 'Plugin', entryPointUrl: '/extensions/b.js', enabled: false }
    ]),
    templates: repository([
      { id: 1, title: 'Template A', key: 'template-a', version: '1', entryPointUrl: '/templates/a.js', positionsJson: '["footer"]', enabled: true },
      { id: 2, title: 'Template B', key: 'template-b', version: '1', entryPointUrl: '/templates/b.js', positionsJson: '["footer"]', enabled: false }
    ]),
    moduleInstances: repository(),
    siteConfig: repository([{ id: 37, title: 'MiniJoomlaSiteConfig', templateKey: 'cassiopeia', siteName: 'Existing name' }])
  };
  const service = createAdminService(repositories);
  const template = await service.templates.get(1);
  const config = await service.siteConfig.get();
  assert.equal(config.id, 37, 'configuration is not assumed to be id=1');
  await service.templates.setDefault(1, { etag: template.etag, configEtag: config.etag });
  assert.equal((await service.siteConfig.get()).templateKey, 'template-a');
  assert.equal((await service.siteConfig.get()).siteName, 'Existing name');
  assert.deepEqual(repositories.siteConfig.lastPatch, { templateKey: 'template-a' });
  await assert.rejects(() => service.templates.update(1, { enabled: false }, { etag: template.etag }), ValidationError);
  await assert.rejects(() => service.templates.remove(1, { etag: template.etag }), ValidationError);
  await assert.rejects(() => service.templates.setDefault(2, { etag: '"1"' }), ValidationError);
  await assert.rejects(() => service.templates.setDefault(1), ValidationError);
  await assert.rejects(() => service.templates.setDefault(1, { etag: '"stale"', configEtag: config.etag }), (error) => error.code === 'concurrency-conflict');
  await assert.rejects(() => service.templates.setDefault(1, { etag: template.etag, configEtag: config.etag }), (error) => error.code === 'concurrency-conflict');
  assert.equal((await service.siteConfig.get()).templateKey, 'template-a');
  await service.siteConfig.save({ templateKey: 'camap' }, { etag: (await service.siteConfig.get()).etag });
  await service.templates.update(1, { enabled: false }, { etag: template.etag });
  assert.equal((await service.templates.get(1)).enabled, false);
  await assert.rejects(async () => service.siteConfig.save({ templateKey: 'template-a' }, { etag: (await service.siteConfig.get()).etag }), ValidationError);
  await assert.rejects(() => service.extensions.update(1, { key: 'new-key' }, { etag: '"1"' }), ValidationError);
  await assert.rejects(() => service.extensions.update(1, { enabled: 'false' }, { etag: '"1"' }), ValidationError);
  await assert.rejects(() => service.extensions.update(1, { enabled: false }, { etag: '*' }), ValidationError);
  await assert.rejects(() => service.extensions.create({ title: 'Duplicate', key: 'module-a', type: 'Module', entryPointUrl: '/a.js' }), ValidationError);
  await assert.rejects(() => service.extensions.create({ title: 'Unsafe', key: 'unsafe', type: 'Plugin', entryPointUrl: 'javascript:alert(1)' }), ValidationError);
  await assert.rejects(() => service.extensions.create({ title: 'CrossOrigin', key: 'cross-origin', type: 'Plugin', entryPointUrl: 'https://evil.example/x.js' }), ValidationError, 'entryPointUrl de outra origem HTTPS deve ser rejeitado, não só javascript:/data:/credenciais');
  await assert.rejects(() => service.extensions.create({ title: 'Template', key: 'wrong', type: 'Template', entryPointUrl: '/a.js' }), ValidationError);

  const validTemplate = { title: 'C', key: 'c', version: '1', entryPointUrl: './c.js', positions: ['footer', 'footer'], styles: '["./c.css"]' };
  const createdTemplate = await service.templates.create(validTemplate);
  assert.equal(createdTemplate.positionsJson, '["footer"]');
  assert.equal(createdTemplate.styles, '["./c.css"]');
  for (const patch of [{ positions: [] }, { positions: ['UNKNOWN'] }, { positions: ['unknown slot'] }, { positions: ['bad position'] }, { positions: undefined, positionsJson: '{"footer":1}' }, { styles: '["javascript:x"]' }, { entryPointUrl: '//other.example/a.js' }, { entryPointUrl: 'https://other.example/a.js' }]) {
    await assert.rejects(() => service.templates.create({ ...validTemplate, ...patch, key: 'invalid' }), ValidationError);
  }
  // Posição bem-formada fora da lista estrutural fechada é aceita (pivô de
  // empacotamento: um template instalado pode declarar posições próprias).
  const installedPositionTemplate = await service.templates.create({ title: 'Instalado', key: 'installed-with-custom-position', version: '1', entryPointUrl: './installed.js', positions: ['custom-hero'], styles: '[]' });
  assert.equal(installedPositionTemplate.positionsJson, '["custom-hero"]');
  const instance = await service.moduleInstances.create({ title: 'Native', extensionKey: 'articles-latest', position: 'main-top', settings: { limit: 3 } });
  const searchInstance = await service.moduleInstances.create({ title: 'Search', extensionKey: 'search', position: 'search', settings: {} });
  assert.equal(searchInstance.extensionKey, 'search');
  assert.equal(searchInstance.position, 'search');
  assert.equal(instance.enabled, true);
  assert.equal(instance.settingsJson, '{"limit":3}');
  for (const patch of [{ settings: [] }, { settings: '{}' }, { settings: { limit: Infinity } }, { settingsJson: '{bad' }, { ordering: 1.5 }, { ordering: 'not-number' }, { position: 'component' }, { scopeKind: 'Route' }, { scopeCategoryAlias: 'news' }, { extensionKey: 'plugin-b' }]) {
    await assert.rejects(() => service.moduleInstances.create({ title: 'Bad', extensionKey: 'articles-latest', position: 'footer', ...patch }), ValidationError);
  }
  await service.moduleInstances.update(instance.id, { scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias: 'news' }, { etag: instance.etag });
  await assert.rejects(async () => service.moduleInstances.update(instance.id, { scopeRoute: 'home' }, { etag: (await service.moduleInstances.get(instance.id)).etag }), ValidationError);
  await service.moduleInstances.update(instance.id, { ordering: 7 }, { etag: (await service.moduleInstances.get(instance.id)).etag });
  assert.deepEqual(repositories.moduleInstances.lastPatch, { ordering: 7 }, 'validation must not write stale merged fields');
  const referenced = await service.moduleInstances.create({ title: 'External', extensionKey: 'module-a', position: 'footer', settings: {} });
  assert.ok(referenced.id);
  await assert.rejects(() => service.extensions.remove(1, { etag: '"1"' }), ValidationError);

  const noConfig = createAdminService({ templates: repository([{ ...validTemplate, id: 9, enabled: true }]), siteConfig: repository() });
  await noConfig.templates.setDefault(9, { etag: '"1"' });
  assert.equal((await noConfig.siteConfig.get()).templateKey, 'c');

  const rows = await service.extensions.list();
  assert.deepEqual(filterManagementRows('extensions', rows, { type: 'Plugin', enabled: 'false' }).map((row) => row.id), [2]);
  const list = renderAdminList({ rows: [await service.extensions.get(2)], searchHref: '#/extensions', searchFilters: managementFilters('extensions', { type: 'Plugin' }), rowActions: (row) => renderManagementActions('extensions', row) });
  assert.match(list, /name="type"/);
  assert.match(list, /value="Plugin" selected/);
  assert.match(list, /data-admin-managed-action="toggle"/);
  assert.equal(renderManagementActions('extensions', { id: 1, enabled: true }), '', 'no write controls without an ETag snapshot');

  const fake = managementDocument();
  const app = createAdminApplication({ adminService: service, documentRef: fake.documentRef, autoStart: false });
  let lastHref;
  const navigate = app.router.navigate.bind(app.router);
  app.router.navigate = (href) => { lastHref = href; return navigate(href); };
  await app.router.navigate('#/extensions?type=Plugin&enabled=false');
  assert.match(fake.documentRef.body.innerHTML, /Plugin B/);
  assert.doesNotMatch(fake.documentRef.body.innerHTML, /<td>Module A<\/td>/);
  assert.doesNotMatch(fake.documentRef.body.innerHTML, /href="#\/extensions\/new"/);
  await fake.action('toggle', 2).fire('click');
  assert.equal((await service.extensions.get(2)).enabled, true);
  assert.match(app.router.parse(lastHref).path, /extensions/);
  assert.equal(app.router.parse(lastHref).params.type, 'Plugin');
  assert.equal(app.router.parse(lastHref).params.enabled, 'false');
  await app.router.navigate('#/extensions?type=Plugin');
  const oldButton = fake.action('toggle', 2);
  const current = await service.extensions.get(2);
  await service.extensions.update(2, { title: 'Changed concurrently' }, { etag: current.etag });
  await oldButton.fire('click');
  assert.match(fake.status.textContent, /Recarregue/);
  assert.equal((await service.extensions.get(2)).enabled, true);
  assert.equal(oldButton.disabled, false);
  await app.router.navigate('#/templates');
  const defaultButton = fake.action('default', createdTemplate.id);
  await service.siteConfig.save({ siteName: 'Concurrent config' }, { etag: (await service.siteConfig.get()).etag });
  await defaultButton.fire('click');
  assert.match(fake.status.textContent, /Recarregue/);
  assert.equal((await service.siteConfig.get()).templateKey, 'camap');
  await app.router.navigate('#/templates');
  await fake.action('default', createdTemplate.id).fire('click');
  assert.equal((await service.siteConfig.get()).templateKey, 'c');
  assert.equal((await service.siteConfig.get()).siteName, 'Concurrent config');
  assert.match(fake.documentRef.body.innerHTML, /class="admin-template-default">Padrão/);
  await app.router.navigate('#/extensions');
  fake.input('q', 'Plugin');
  fake.input('type', 'Plugin');
  fake.input('enabled', 'true');
  await fake.search().fire('submit');
  assert.equal(app.router.parse(lastHref).params.q, 'Plugin');
  assert.equal(app.router.parse(lastHref).params.type, 'Plugin');
  assert.equal(app.router.parse(lastHref).params.page, undefined);
  await app.router.navigate('#/components');
  assert.match(fake.documentRef.body.innerHTML, /Componentes nativos/);
  assert.match(fake.documentRef.body.innerHTML, /Não há instalação dinâmica/);
  await app.router.navigate('#/moduleInstances/new');
  assert.match(fake.documentRef.body.innerHTML, /articles-latest \(nativo\)/);
  assert.match(fake.documentRef.body.innerHTML, /<option value="search">search \(nativo\)<\/option>/);
  assert.doesNotMatch(fake.documentRef.body.innerHTML, /<option value="plugin-b"/);
  assert.match(fake.documentRef.body.innerHTML, /value="main-top"/);
  await app.router.navigate('#/config');
  assert.match(fake.documentRef.body.innerHTML, /camap \(integrado\)/);
  assert.doesNotMatch(fake.documentRef.body.innerHTML, /<option value="template-b"/);
  await app.router.navigate('#/templates/new');
  assert.match(fake.documentRef.body.innerHTML, /Página administrativa não encontrada/);
  app.stop();
  const manyRepository = repository(Array.from({ length: 45 }, (_, index) => ({ id: index + 1, title: `Plugin ${index + 1}`, key: `plugin-${index + 1}`, type: 'Plugin', enabled: true })));
  const manyFake = managementDocument();
  const manyApp = createAdminApplication({ adminService: createAdminService({ extensions: manyRepository }), documentRef: manyFake.documentRef, autoStart: false });
  await manyApp.router.navigate('#/extensions?type=Plugin&enabled=true&page=2');
  assert.equal(manyRepository.reads, 20, 'only visible page items are hydrated for ETags');
  assert.match(manyFake.documentRef.body.innerHTML, /type=Plugin&amp;enabled=true&amp;page=3/);
  manyApp.stop();
  const builtinOnlyService = createAdminService({ siteConfig: repository([{ id: 8, templateKey: 'camap' }]) });
  assert.equal(builtinOnlyService.templates.available, false);
  const builtinOnlyFake = managementDocument();
  const builtinOnlyApp = createAdminApplication({ adminService: builtinOnlyService, documentRef: builtinOnlyFake.documentRef, autoStart: false });
  await builtinOnlyApp.router.navigate('#/config');
  for (const key of BUILTIN_TEMPLATES) assert.match(builtinOnlyFake.documentRef.body.innerHTML, new RegExp(`<option value="${key}"`));
  assert.match(builtinOnlyFake.documentRef.body.innerHTML, /<option value="camap" selected>/);
  await builtinOnlyService.siteConfig.save({ templateKey: 'cassiopeia' }, { etag: (await builtinOnlyService.siteConfig.get()).etag });
  assert.equal((await builtinOnlyService.siteConfig.get()).templateKey, 'cassiopeia');
  await builtinOnlyApp.router.navigate('#/templates');
  assert.match(builtinOnlyFake.documentRef.body.innerHTML, /Catálogo de templates não configurado/);
  await builtinOnlyApp.router.navigate('#/templates/discover');
  assert.match(builtinOnlyFake.documentRef.body.innerHTML, /Catálogo de templates não configurado/);
  builtinOnlyApp.stop();
  const stringIdsRepository = repository([{ id: '2', title: 'String ID', key: 'string-id', type: 'Plugin', enabled: false }]);
  const stringIdsFake = managementDocument();
  const stringIdsApp = createAdminApplication({ adminService: createAdminService({ extensions: stringIdsRepository }), documentRef: stringIdsFake.documentRef, autoStart: false });
  await stringIdsApp.router.navigate('#/extensions');
  const stringIdButton = stringIdsFake.action('toggle', 2);
  assert.equal(stringIdButton.dataset.adminManagedBound, 'true');
  await stringIdButton.fire('click');
  assert.equal((await stringIdsRepository.findById('2')).enabled, true, 'numeric DOM dataset must match numeric-string repository IDs');
  stringIdsApp.stop();
  await staleManagementTests();
  console.log('ok - admin management: persisted state/default, optimistic concurrency, validation, filters, native capabilities and module configuration');
}
