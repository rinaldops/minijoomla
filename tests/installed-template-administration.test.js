import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { MODULE_POSITIONS } from '../src/libraries/minijoomla/application/admin-extensions-service.js';
import { TEMPLATE_POSITIONS, STRUCTURAL_TEMPLATE_POSITIONS, BUILTIN_MODULE_KEYS, templatePositions } from '../src/libraries/minijoomla/application/extension-input.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { createExtensionPages } from '../src/administrator/components/com_minijoomla/extension-pages.js';

// Core-only fixture: findMany omits ETags; MERGE/update returns null.
function memoryRepository(seed = []) {
  const rows = new Map(seed.map((row) => [row.id, { etag: '"seed"', ...row }]));
  let version = 1;
  const conflict = () => Object.assign(new Error('ETag mismatch'), { code: 'concurrency-conflict' });
  const repository = {
    rows, reads: [], attempts: [], lastPatch: null,
    async findMany(query, options) {
      repository.reads.push({ query, options });
      return { items: [...rows.values()].map(({ etag: _etag, ...row }) => ({ ...row })), hasNextPage: false };
    },
    async findById(id) { const row = rows.get(Number(id)); return row ? { ...row } : null; },
    async create(input) {
      repository.attempts.push({ operation: 'create', input: { ...input } });
      const row = { ...input, id: Math.max(0, ...rows.keys()) + 1, etag: `"v${version++}"` };
      rows.set(row.id, row);
      return { ...row };
    },
    async update(id, input, { etag } = {}) {
      repository.attempts.push({ operation: 'update', id, input: { ...input }, etag });
      const row = rows.get(Number(id));
      if (!row || row.etag !== etag) throw conflict();
      repository.lastPatch = { ...input };
      rows.set(row.id, { ...row, ...input, etag: `"v${version++}"` });
      return null;
    },
    async delete(id, { etag } = {}) {
      repository.attempts.push({ operation: 'delete', id, etag });
      if (rows.get(Number(id))?.etag !== etag) throw conflict();
      rows.delete(Number(id));
    }
  };
  return repository;
}

function fixture() {
  return Object.fromEntries(['templates', 'moduleInstances', 'extensions', 'siteConfig'].map((domain) => [domain, memoryRepository()]));
}

const templateInput = (overrides = {}) => ({
  title: 'Custom template', key: 'custom-template', version: '1.0.0', entryPointUrl: '/templates/custom/index.js',
  positions: ['custom-hero', 'footer', 'component'], enabled: true, ...overrides
});
const moduleInput = (overrides = {}) => ({ title: 'Hero', extensionKey: 'custom-html', position: 'custom-hero', settings: { html: '<p>Hero</p>' }, ...overrides });
const snapshot = (repositories) => structuredClone(Object.fromEntries(Object.entries(repositories).map(([domain, repository]) => [domain, { rows: [...repository.rows.entries()], lastPatch: repository.lastPatch }])));
const attemptCount = (repositories) => Object.values(repositories).reduce((total, repository) => total + repository.attempts.length, 0);

async function rejectsWithoutWrites(repositories, operation, message) {
  const before = snapshot(repositories);
  const attempts = attemptCount(repositories);
  await assert.rejects(operation, ValidationError, message);
  assert.deepEqual(snapshot(repositories), before, message);
  assert.equal(attemptCount(repositories), attempts, `${message}: no repository write invoked`);
}

async function runCatalogTests() {
  const structural = ['topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer', 'component'];
  assert.deepEqual(TEMPLATE_POSITIONS, structural);
  assert.equal(TEMPLATE_POSITIONS, STRUCTURAL_TEMPLATE_POSITIONS);
  assert.deepEqual(MODULE_POSITIONS, [...structural.filter((position) => position !== 'component'), 'sidebar', 'content']);

  const repositories = fixture();
  const admin = createAdminService(repositories, { initialSiteConfig: { siteName: 'Initial site', templateKey: 'cassiopeia' } });
  const initialDefaults = structuredClone(admin.siteConfig.defaults);
  const before = snapshot(repositories);
  assert.equal(await admin.siteConfig.get(), null);
  assert.equal((await admin.moduleInstances.positions()).template, 'cassiopeia');
  assert.deepEqual((await admin.moduleInstances.catalog()).map((entry) => entry.key).sort(), [...BUILTIN_MODULE_KEYS].sort(), 'no new native feature keys');
  assert.deepEqual(snapshot(repositories), before);
  assert.equal(attemptCount(repositories), 0);

  const installed = await admin.templates.create(templateInput());
  assert.deepEqual(JSON.parse(installed.positionsJson), ['custom-hero', 'footer', 'component']);
  assert.equal(Object.hasOwn(installed, 'paramDefinitionsJson'), false, 'positions do not require a new schema column');
  const disabled = await admin.templates.create(templateInput({ key: 'disabled-template', positions: ['disabled-zone', 'footer'], enabled: false }));
  const afterInstall = snapshot(repositories);
  const reads = repositories.templates.reads.length;
  const available = await admin.moduleInstances.positions('custom-template');
  assert.equal(repositories.templates.reads.length - reads, 1, 'one bounded template read per positions query');
  assert.deepEqual(available.positions, ['custom-hero', 'footer']);
  assert.deepEqual(available.all, [...MODULE_POSITIONS, 'custom-hero', 'disabled-zone']);
  assert.equal(available.all.includes('component'), false);
  assert.equal(available.all.filter((position) => position === 'footer').length, 1);
  assert.deepEqual((await admin.moduleInstances.positions('disabled-template')).positions, ['disabled-zone', 'footer']);
  assert.deepEqual((await admin.moduleInstances.positions('default')).positions, structural.filter((position) => position !== 'component'));
  const styles = await admin.templateStyles.list();
  assert.equal(styles.catalog.find((entry) => entry.key === disabled.key).enabled, false);
  assert.deepEqual(snapshot(repositories), afterInstall, 'catalog reads never persist metadata');
  assert.equal(await admin.siteConfig.get(), null);
  assert.deepEqual(admin.siteConfig.defaults, initialDefaults);

  // Future/pending metadata survives an unrelated save byte-for-byte, without
  // implementing parameter definitions or selecting/activating this template.
  const rawDefinitions = '  [{"name":"future","type":"text"}]\n';
  repositories.templates.rows.get(installed.id).paramDefinitionsJson = rawDefinitions;
  await admin.templates.update(installed.id, { title: 'Renamed template' }, { etag: installed.etag });
  assert.deepEqual(repositories.templates.lastPatch, { title: 'Renamed template' });
  assert.equal(repositories.templates.rows.get(installed.id).paramDefinitionsJson, rawDefinitions);
  assert.equal(repositories.templates.rows.get(installed.id).positionsJson, installed.positionsJson);
  assert.equal(await admin.siteConfig.get(), null);
  assert.deepEqual(admin.siteConfig.defaults, initialDefaults);
  for (const repository of Object.values(repositories)) for (const read of repository.reads) assert.deepEqual(read.options, { maxPages: 100, maxItems: 10000 });
  console.log('ok - installed templates: structural baseline, custom/disabled position catalog, bounded read-only defaults and pending metadata preservation');
}

async function runPositionValidationTests() {
  const repositories = fixture();
  const admin = createAdminService(repositories);
  const installed = await admin.templates.create(templateInput());
  const existing = await admin.moduleInstances.create(moduleInput());
  assert.equal(existing.position, 'custom-hero');
  assert.equal(existing.extensionKey, 'custom-html');
  assert.deepEqual(JSON.parse(existing.settingsJson), { html: '<p>Hero</p>' });
  assert.equal(repositories.extensions.rows.size, 0, 'native module creates no extension row');

  const invalidNames = [null, 42, false, {}, [], 'component', 'constructor', 'prototype', '__proto__', 'Custom-hero', 'custom_hero', 'bad name', '9hero', 'x', 'x'.repeat(42)];
  for (const position of invalidNames) {
    await rejectsWithoutWrites(repositories, () => admin.moduleInstances.create(moduleInput({ position })), `invalid module position ${String(position)}`);
    await rejectsWithoutWrites(repositories, () => admin.moduleInstances.update(existing.id, { position }, { etag: existing.etag }), 'invalid position patch');
    await rejectsWithoutWrites(repositories, () => admin.moduleInstances.batch([{ id: existing.id, etag: existing.etag }], 'move', { position }), 'invalid position batch');
  }
  for (const name of invalidNames.filter((name) => name !== 'component')) {
    await rejectsWithoutWrites(repositories, () => admin.templates.create(templateInput({ key: 'invalid-template', positions: ['footer', name] })), 'invalid template position');
    await rejectsWithoutWrites(repositories, () => admin.templates.update(installed.id, { positions: [name] }, { etag: installed.etag }), 'invalid template position patch');
  }
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.create(moduleInput({ position: 'unregistered-zone' })), 'well-formed undeclared position is not permission');
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.update(existing.id, { position: 'unregistered-zone' }, { etag: existing.etag }), 'undeclared move is rejected');
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.batch([{ id: existing.id, etag: existing.etag }], 'move', { position: 'unregistered-zone' }), 'undeclared batch destination');

  let getterExecutions = 0;
  const getter = () => { getterExecutions += 1; return 'custom-hero'; };
  const arrayGetter = ['footer'];
  Object.defineProperty(arrayGetter, '0', { enumerable: true, get: getter });
  const extra = ['footer']; extra.extra = 'custom-hero';
  const hook = ['footer']; hook.toJSON = () => { getterExecutions += 1; return ['footer']; };
  for (const positions of [[], new Array(1), ['footer', , 'custom-hero'], Array(101).fill('footer'), arrayGetter, extra, hook, '{broken', '{}', 'null']) {
    await rejectsWithoutWrites(repositories, () => admin.templates.create(templateInput({ key: 'invalid-template', positions })), 'template positions must be dense bounded data');
    await rejectsWithoutWrites(repositories, () => admin.templates.update(installed.id, { positionsJson: positions }, { etag: installed.etag }), 'positionsJson uses the same strict boundary');
  }
  for (const field of ['positions', 'positionsJson']) {
    const input = templateInput({ positions: undefined });
    Object.defineProperty(input, field, { enumerable: true, get: getter });
    await rejectsWithoutWrites(repositories, () => admin.templates.create(input), 'top-level template getter');
    await rejectsWithoutWrites(repositories, () => admin.templates.update(installed.id, input, { etag: installed.etag }), 'template getter patch');
  }
  const input = moduleInput();
  Object.defineProperty(input, 'position', { enumerable: true, get: getter });
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.create(input), 'module position getter');
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.update(existing.id, input, { etag: existing.etag }), 'module position getter patch');
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.batch([{ id: existing.id, etag: existing.etag }], 'move', input), 'batch position getter');
  assert.equal(getterExecutions, 0, 'position validation never invokes getters or hooks');
  assert.deepEqual(JSON.parse(templatePositions(Array(100).fill('custom-hero'))), ['custom-hero'], '100 entries accepted and deduplicated');

  // Native/catch-all assignments need no template repository or catalog read.
  const nativeRepositories = { moduleInstances: memoryRepository() };
  const nativeAdmin = createAdminService(nativeRepositories);
  for (const position of MODULE_POSITIONS) assert.equal((await nativeAdmin.moduleInstances.create(moduleInput({ position }))).position, position);
  await rejectsWithoutWrites(nativeRepositories, () => nativeAdmin.moduleInstances.create(moduleInput()), 'missing template catalog rejects new custom positions');
  console.log('ok - installed templates: CRUD declarations, typed invalid names, dense arrays and getter-free validation reject before writes; native positions remain compatible');
}

async function runBatchAndLegacyTests() {
  const repositories = fixture();
  const admin = createAdminService(repositories);
  const installed = await admin.templates.create(templateInput());
  await admin.templates.create(templateInput({ key: 'disabled-template', positions: ['disabled-zone', 'footer'], enabled: false }));
  const first = await admin.moduleInstances.create(moduleInput({ position: 'footer' }));
  const second = await admin.moduleInstances.create(moduleInput({ title: 'Second', position: 'footer' }));
  const selected = [first, second].map(({ id, etag }) => ({ id, etag }));
  assert.deepEqual(await admin.moduleInstances.batch(selected, 'move', { position: 'custom-hero' }), { succeeded: [first.id, second.id], failed: [] });
  assert.equal((await admin.moduleInstances.get(first.id)).position, 'custom-hero');
  assert.equal((await admin.moduleInstances.get(second.id)).position, 'custom-hero');
  assert.deepEqual(repositories.moduleInstances.lastPatch, { position: 'custom-hero' });
  for (const attempt of repositories.moduleInstances.attempts.filter((attempt) => attempt.operation === 'update')) assert.equal(attempt.etag, selected.find((item) => item.id === attempt.id).etag, 'batch uses selected ETags');

  const beforeStale = snapshot(repositories);
  const stale = await admin.moduleInstances.batch(selected, 'move', { position: 'disabled-zone' });
  assert.deepEqual(stale.succeeded, []);
  assert.deepEqual(stale.failed.map(({ id, code }) => ({ id, code })), selected.map(({ id }) => ({ id, code: 'concurrency-conflict' })));
  assert.deepEqual(snapshot(repositories), beforeStale, 'stale batch preserves all stored positions and ETags');
  const fresh = await admin.moduleInstances.get(first.id);
  assert.deepEqual(await admin.moduleInstances.batch([{ id: fresh.id, etag: fresh.etag }], 'move', { position: 'disabled-zone' }), { succeeded: [fresh.id], failed: [] });
  const current = await admin.moduleInstances.get(first.id);
  const copy = await admin.moduleInstances.duplicate(current.id);
  assert.equal(copy.position, 'disabled-zone', 'disabled registered templates still declare valid metadata');
  assert.equal(copy.enabled, false);

  for (const items of [[], [{ id: current.id }], [{ id: current.id, etag: '*' }], Array(201).fill({ id: current.id, etag: current.etag })]) {
    await rejectsWithoutWrites(repositories, () => admin.moduleInstances.batch(items, 'move', { position: 'custom-hero' }), 'batch selection is bounded and requires ETags');
  }

  // Deleted template: unrelated rename / explicit same position is preserved,
  // but a duplicate is a new instance and must still have a declaration.
  await admin.templates.remove(installed.id, { etag: installed.etag });
  const old = await admin.moduleInstances.get(second.id);
  await admin.moduleInstances.update(old.id, { title: 'Retained legacy hero' }, { etag: old.etag });
  assert.deepEqual(repositories.moduleInstances.lastPatch, { title: 'Retained legacy hero' });
  const renamed = await admin.moduleInstances.get(old.id);
  assert.equal(renamed.position, 'custom-hero');
  await admin.moduleInstances.update(renamed.id, { position: 'custom-hero', note: 'Same position' }, { etag: renamed.etag });
  assert.equal((await admin.moduleInstances.get(old.id)).position, 'custom-hero');
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.duplicate(old.id), 'uncatalogued duplicate is rejected, never coerced');
  assert.equal(await admin.siteConfig.get(), null);
  console.log('ok - installed templates: dynamic batch moves use selected ETags, reject stale/oversized selections and preserve uncatalogued positions on unrelated edits');
}

async function runCorruptCatalogTests() {
  for (const positionsJson of ['{broken', '{}', 'null', '[]', '["Bad-position"]', '["footer",42]', Array(101).fill('footer')]) {
    const repositories = fixture();
    const admin = createAdminService(repositories);
    await admin.templates.create(templateInput());
    const existing = await admin.moduleInstances.create(moduleInput());
    const corrupt = await admin.templates.create(templateInput({ key: 'corrupt-template', positions: ['another-zone'] }));
    repositories.templates.rows.get(corrupt.id).positionsJson = positionsJson;
    for (const operation of [
      () => admin.moduleInstances.positions('custom-template'),
      () => admin.templateStyles.list(),
      () => admin.moduleInstances.create(moduleInput()),
      () => admin.moduleInstances.duplicate(existing.id),
      () => admin.moduleInstances.batch([{ id: existing.id, etag: existing.etag }], 'move', { position: 'custom-hero' })
    ]) await rejectsWithoutWrites(repositories, operation, 'corruption cannot silently fall back or permit new custom writes');
    await admin.moduleInstances.update(existing.id, { title: 'Rename despite unrelated catalog corruption' }, { etag: existing.etag });
    assert.equal((await admin.moduleInstances.get(existing.id)).position, 'custom-hero');
    assert.deepEqual(repositories.moduleInstances.lastPatch, { title: 'Rename despite unrelated catalog corruption' });
    const fresh = await admin.moduleInstances.get(existing.id);
    const moved = await admin.moduleInstances.batch([{id:fresh.id,etag:fresh.etag}], 'move', {position:'topbar'});
    assert.deepEqual(moved,{succeeded:[fresh.id],failed:[]},'Structural batch destinations do not depend on an unrelated corrupted template');
    assert.equal(await admin.siteConfig.get(), null);
  }
  for (const positionsJson of [undefined, null, '']) {
    const repositories = fixture();
    repositories.templates.rows.set(1, { id: 1, etag: '"legacy"', key: 'legacy-template', positionsJson, enabled: false });
    const admin = createAdminService(repositories);
    const before = snapshot(repositories);
    const positions = await admin.moduleInstances.positions('legacy-template');
    assert.deepEqual(positions.positions, []);
    assert.deepEqual(positions.all, MODULE_POSITIONS);
    assert.deepEqual(snapshot(repositories), before, 'legacy absent metadata is not backfilled');
  }
  const repositories = fixture();
  const admin = createAdminService(repositories);
  await admin.templates.create(templateInput());
  repositories.templates.findMany = async () => ({ items: [], hasNextPage: true });
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.create(moduleInput()), 'incomplete template reads block new positions');
  await rejectsWithoutWrites(repositories, () => admin.moduleInstances.positions(), 'incomplete catalog never becomes a fallback');
  console.log('ok - installed templates: malformed/incomplete catalogs block new assignments without hiding corruption; unrelated module edits and absent legacy metadata are retained');
}

async function runOrphanedPositionFormTest() {
  const repositories=fixture();repositories.menu=memoryRepository();repositories.categories=memoryRepository();
  const admin=createAdminService(repositories);const template=await admin.templates.create(templateInput());
  const module=await admin.moduleInstances.create(moduleInput());
  await admin.templates.remove(template.id,{etag:template.etag});
  let submit;
  const fields={title:{value:'Rename orphan only'},position:{value:'custom-hero'},ordering:{value:'0'},showTitle:{checked:true},state:{value:'published'},note:{value:''},assignment:{value:'all'}};
  const form={querySelector:selector=>fields[selector.match(/name="([^"]+)"/)?.[1]]??null,querySelectorAll:()=>[],addEventListener:(event,handler)=>{if(event==='submit')submit=handler;}};
  const root={querySelector:selector=>selector.includes('data-ext-form')?form:null,querySelectorAll:()=>[]};
  const page=await createExtensionPages({adminService:admin,documentRef:{body:root},router:{link:path=>`#${path}`,navigate:async()=>{}},shell:({bodyHtml})=>bodyHtml,isCurrent:()=>true}).render({path:`/moduleInstances/${module.id}`,params:{}});
  assert.match(page.html,/value="custom-hero" selected[^>]*>custom-hero \(atual — fora do catálogo\)/);
  page.bind();await submit({preventDefault(){}});
  const saved=await admin.moduleInstances.get(module.id);assert.equal(saved.title,'Rename orphan only');assert.equal(saved.position,'custom-hero');
  assert.equal(repositories.moduleInstances.lastPatch.position,'custom-hero');
}

export async function runInstalledTemplateAdministrationTests() {
  await runOrphanedPositionFormTest();
  await runCatalogTests();
  await runPositionValidationTests();
  await runBatchAndLegacyTests();
  await runCorruptCatalogTests();
}
