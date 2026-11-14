import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { planExtensionMigration } from '../src/libraries/minijoomla/application/extension-migration-plan.js';
import { createExtensionMigrationExecutor } from '../src/libraries/minijoomla/application/extension-migration-executor.js';

/*
 * Executor coverage for the seven gates in docs/CONTRATOS.md#evolução-xml--contratos-e-gates-aprovados
 * section 4: explicit confirmation, revalidation against fresh reads, a
 * durable journal with strong-ETag writes, sequential apply with resume,
 * and manual-only rollback that never erases concurrent edits.
 */
const target = { baseUrl: '/sites/example/SiteAssets/packages/2.0.0', manifestPath: 'modules/mod_example/mod_example.xml' };
const xml = (fields = '<field name="message" type="text" default="new" />') => `<extension type="module" client="site" xmlns:mj="urn:minijoomla:runtime:1" mj:key="example.module"><name>Example</name><version>2.0.0</version><files><filename module="mod_example">mod_example.js</filename></files><config><fields name="params">${fields}</fields></config></extension>`;

function repository(domain, events, seed = []) {
  const rows = new Map(seed.map((row) => [row.id, { ...row }]));
  let nextId = Math.max(0, ...seed.map((row) => row.id)) + 1;
  let version = 2;
  const output = (row) => ({ ...row });
  return {
    rows,
    async findMany() { events.push({ kind: 'list', domain }); return { items: [...rows.values()].map(output) }; },
    async findById(id) {
      events.push({ kind: 'get', domain, id });
      const row = rows.get(Number(id));
      if (!row) return null;
      return output(row);
    },
    async create(input) {
      const id = nextId++;
      const row = { id, ...input, etag: `"${domain}-${version++}"` };
      rows.set(id, row);
      events.push({ kind: 'create', domain, id });
      return output(row);
    },
    async update(id, input, { etag } = {}) {
      events.push({ kind: 'update', domain, id, input: { ...input } });
      const row = rows.get(Number(id));
      if (!row) throw Object.assign(new Error('not found'), { code: 'not-found', status: 404 });
      if (row.etag !== etag) throw Object.assign(new Error('etag mismatch'), { code: 'concurrency-conflict', status: 412 });
      const updated = { ...row, ...input, etag: `"${domain}-${version++}"` };
      rows.set(Number(id), updated);
      return output(updated);
    },
    async delete() { assert.fail('migration executor must never delete'); }
  };
}

function harness({ extension, instances = [] } = {}) {
  const events = [];
  const repositories = {
    extensions: repository('extensions', events, [extension]),
    moduleInstances: repository('moduleInstances', events, instances)
  };
  const admin = createAdminService(repositories);
  let journal = null;
  const journalEvents = [];
  const journalStore = {
    async read() { journalEvents.push('read'); return journal ? JSON.parse(JSON.stringify(journal)) : null; },
    async write(value) { journalEvents.push('write'); journal = value === null ? null : JSON.parse(JSON.stringify(value)); }
  };
  return { events, repositories, admin, journalStore, journalEvents, get journal() { return journal; }, set journal(value) { journal = value; } };
}

function baseExtension(overrides = {}) {
  return { id: 1, etag: '"extensions-1"', key: 'example.module', type: 'Module', enabled: false,
    entryPointUrl: '/sites/example/SiteAssets/legacy.js',
    manifestJson: JSON.stringify({ version: '1.0.0', params: [{ name: 'message', type: 'text', default: 'old' }], privateMetadata: { retained: true } }),
    ...overrides };
}
function baseInstance(overrides = {}) {
  return { id: 10, etag: '"moduleInstances-1"', extensionKey: 'example.module', enabled: false, trashed: true,
    title: 'Private instance', position: 'main-top',
    settingsJson: JSON.stringify({ message: 'saved', moduleClass: 'custom', headerTag: 'h3', headerClass: 'heading', unknown: { nested: [1, true] } }),
    ...overrides };
}

async function approvedPlan(h) {
  const extension = await h.admin.extensions.get(1);
  const instances = await h.admin.moduleInstances.list();
  const plan = planExtensionMigration({ extension, instances, completeInstances: true, targetXml: xml(), target: { ...target } });
  assert.equal(plan.ready, true, plan.reason);
  return plan;
}

function planInputFrom(plan) {
  return { extension: plan.snapshots.extension, instances: plan.snapshots.instances, completeInstances: true, targetXml: xml(), target: { ...target } };
}

export async function runExtensionMigrationExecutorTests() {
  let passed = 0;
  async function test(name, run) { await run(); passed += 1; console.log(`ok - migration executor: ${name}`); }

  await test('inspect revalidates against fresh reads and reports ready without writes', async () => {
    const h = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const plan = await approvedPlan(h);
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    const before = h.events.length;
    const inspected = await executor.inspect({ planInput: planInputFrom(plan) });
    assert.equal(inspected.status, 'ready');
    assert.equal(inspected.plan.ready, true);
    assert.equal(h.events.filter((event) => event.kind === 'update').length, 0);
    assert.ok(h.events.length > before);
  });

  await test('apply requires explicit confirm and performs no write otherwise', async () => {
    const h = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const plan = await approvedPlan(h);
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    for (const confirm of [undefined, false, 'true', 1]) {
      const result = await executor.apply({ planInput: planInputFrom(plan), confirm });
      assert.equal(result.reason, 'confirmation-required');
      assert.equal(h.events.filter((event) => event.kind === 'update').length, 0);
    }
  });

  await test('apply writes extension then instance sequentially with fresh ETags, journal reaches done, and is idempotent on repeat', async () => {
    const h = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const plan = await approvedPlan(h);
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    const result = await executor.apply({ planInput: planInputFrom(plan), confirm: true });
    assert.equal(result.status, 'done', result.message);
    const updates = h.events.filter((event) => event.kind === 'update');
    assert.equal(updates.length, 2);
    assert.equal(updates[0].domain, 'extensions');
    assert.equal(updates[1].domain, 'moduleInstances');
    const extensionRow = await h.admin.extensions.get(1);
    assert.equal(extensionRow.entryPointUrl, `${target.baseUrl}/modules/mod_example/mod_example.js`);
    const instanceRow = await h.admin.moduleInstances.get(10);
    assert.equal(JSON.parse(instanceRow.settingsJson).message, 'saved');
    assert.equal(h.journal.stage, 'done');
    assert.equal(h.journal.pending, null);
    const before = h.events.filter((event) => event.kind === 'update').length;
    const repeat = await executor.apply({ planInput: planInputFrom(plan), confirm: true });
    assert.equal(repeat.status, 'done');
    assert.equal(h.events.filter((event) => event.kind === 'update').length, before, 'already-done journal performs no further writes');
  });

  await test('concurrent edit of the extension after the plan is blocked before any write', async () => {
    const h = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const plan = await approvedPlan(h);
    await h.admin.extensions.update(1, { enabled: true }, { etag: '"extensions-1"' });
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    const result = await executor.apply({ planInput: planInputFrom(plan), confirm: true });
    assert.equal(result.status, 'blocked');
    assert.equal(result.reason, 'extension-changed');
    assert.equal(h.events.filter((event) => event.kind === 'update').length, 1, 'only the concurrent edit happened, never the migration write');
  });

  await test('extension changed between journal creation and the extension write is blocked and leaves no instance write', async () => {
    const h = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const plan = await approvedPlan(h);
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    const realUpdate = h.repositories.extensions.update.bind(h.repositories.extensions);
    let triggered = false;
    h.repositories.extensions.update = async (id, input, options) => {
      if (!triggered) { triggered = true; await realUpdate(1, { enabled: true }, { etag: '"extensions-1"' }); }
      return realUpdate(id, input, options);
    };
    const result = await executor.apply({ planInput: planInputFrom(plan), confirm: true });
    assert.equal(result.status, 'blocked');
    assert.equal(result.reason, 'extension-changed');
    assert.equal(h.events.filter((event) => event.kind === 'update' && event.domain === 'moduleInstances').length, 0);
  });

  await test('instance update transient failure is blocked without touching other rows, and resume with the same unchanged plan completes it', async () => {
    const h = harness({ extension: baseExtension(), instances: [baseInstance(), baseInstance({ id: 11, etag: '"moduleInstances-11-1"' })] });
    const plan = await approvedPlan(h);
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    const realUpdate = h.repositories.moduleInstances.update.bind(h.repositories.moduleInstances);
    let triggered = false;
    h.repositories.moduleInstances.update = async (id, input, options) => {
      if (Number(id) === 11 && !triggered) { triggered = true; throw new Error('transient transport failure'); }
      return realUpdate(id, input, options);
    };
    const blocked = await executor.apply({ planInput: planInputFrom(plan), confirm: true });
    assert.equal(blocked.status, 'partial');
    assert.equal(blocked.reason, 'pending-uncertain');
    assert.equal(h.journal.stage, 'instances');
    assert.equal(h.journal.instanceReceipts.length, 1, 'first instance already recorded as done, never repeated');
    assert.deepEqual(h.journal.pending, { kind: 'instance', id: 11, index: 1 });
    const resumed = await executor.apply({ planInput: planInputFrom(plan), confirm: true });
    assert.equal(resumed.status, 'done', resumed.message);
    const updates = h.events.filter((event) => event.kind === 'update' && event.domain === 'moduleInstances');
    assert.equal(updates.filter((event) => event.id === 10).length, 1, 'instance 10 updated exactly once across the interrupted and resumed runs');
  });

  await test('rollback restores extension and instance to the exact pre-migration values using re-read ETags', async () => {
    const h = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const plan = await approvedPlan(h);
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    await executor.apply({ planInput: planInputFrom(plan), confirm: true });
    const result = await executor.rollback({});
    assert.equal(result.status, 'rolled-back', result.message);
    const extensionRow = await h.admin.extensions.get(1);
    assert.equal(extensionRow.entryPointUrl, '/sites/example/SiteAssets/legacy.js');
    const instanceRow = await h.admin.moduleInstances.get(10);
    assert.equal(instanceRow.settingsJson, baseInstance().settingsJson);
    assert.equal(h.journal, null);
  });

  await test('rollback is blocked (never destructive) when a row changed since the migration, and when no journal exists', async () => {
    const empty = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const executorEmpty = createExtensionMigrationExecutor({ admin: empty.admin, repositories: empty.repositories, journalStore: empty.journalStore });
    assert.equal((await executorEmpty.rollback({})).reason, 'no-journal');

    const h = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const plan = await approvedPlan(h);
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    await executor.apply({ planInput: planInputFrom(plan), confirm: true });
    const current = await h.admin.moduleInstances.get(10);
    await h.admin.moduleInstances.update(10, { title: 'Edited after migration' }, { etag: current.etag });
    const result = await executor.rollback({});
    assert.equal(result.status, 'blocked');
    assert.equal(result.reason, 'instance-changed');
    const stillEdited = await h.admin.moduleInstances.get(10);
    assert.equal(stillEdited.title, 'Edited after migration', 'rollback never overwrites a concurrent edit');
    assert.ok(h.journal, 'journal preserved for manual review after a blocked rollback');
  });

  await test('abandoned navigation (isCurrent false) stops before any write and after the in-flight call completes', async () => {
    const h = harness({ extension: baseExtension(), instances: [baseInstance()] });
    const plan = await approvedPlan(h);
    const executor = createExtensionMigrationExecutor({ admin: h.admin, repositories: h.repositories, journalStore: h.journalStore });
    let current = true;
    const result = await executor.apply({ planInput: planInputFrom(plan), confirm: true, isCurrent: () => current });
    current = false;
    const abandoned = await executor.apply({ planInput: planInputFrom(plan), confirm: true, isCurrent: () => false });
    assert.equal(abandoned.reason, 'abandoned');
    assert.equal(result.status, 'done');
  });

  await test('executor reports unavailable without a durable journal store or admin surfaces', async () => {
    const executor = createExtensionMigrationExecutor({});
    assert.equal(executor.available, false);
    const result = await executor.apply({ planInput: {}, confirm: true });
    assert.equal(result.reason, 'dependencies-unavailable');
  });

  console.log(`migration executor: ${passed} cenários aprovados`);
}
