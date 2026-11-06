import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createPluginManager } from '../src/libraries/minijoomla/plugins/manager.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';

function repo() {
  const rows = new Map();
  let id = 0;
  const snapshot = (data, etag) => Object.freeze(Object.defineProperty(data, 'etag', { value: etag, enumerable: false }));
  return {
    rows,
    async findMany() { return { items: [...rows.values()].map(({ etag, ...row }) => row) }; },
    async findById(key) { return rows.get(key); },
    async create(input) { const row = snapshot({ ...input, id: ++id, serverMetadata: { unchanged: true } }, '"new"'); rows.set(id, row); return row; },
    async update(key, input, { etag }) { const old = rows.get(key); if (!old) throw new ValidationError('missing id'); if (etag !== old.etag) throw Object.assign(new Error('stale'), { code: 'concurrency-conflict' }); const row = snapshot({ ...old, ...input }, '"updated"'); rows.set(key, row); return row; },
    async delete(key) { rows.delete(key); }
  };
}

export async function runPluginsSaveEventsTests() {
  const articles = repo();
  const baseline = createAdminService({ articles });
  assert.equal((await baseline.articles.create({ title: 'Default', alias: 'default' })).title, 'Default');

  const manager = createPluginManager();
  const seen = [];
  manager.register({ name: 'save-hooks', events: {
    onContentBeforeSave(value, { action }) { seen.push(action); return { ...value, title: `${value.title}!` }; },
    onContentAfterSave(value) { seen.push({ id: value.id, etag: value.etag, enumerable: Object.keys(value).includes('etag') }); value.serverMetadata.unchanged = false; throw new Error('ignored'); }
  } });
  const admin = createAdminService({ articles }, { pluginManager: manager });
  const created = await admin.articles.create({ title: 'Create', alias: 'create' });
  assert.equal(created.title, 'Create!');
  assert.equal(created.serverMetadata.unchanged, true, 'afterSave cannot mutate the saved result');
  assert.equal(Object.isFrozen(created), true);
  assert.deepEqual(seen[1], { id: created.id, etag: created.etag, enumerable: false });
  const input = { title: 'Update' };
  await admin.articles.update(created.id, input, { etag: created.etag });
  assert.equal(input.title, 'Update');
  assert.equal(seen[2], 'update');
  const afterCount = seen.length;
  await assert.rejects(() => admin.articles.update(created.id, { title: 'Stale' }, { etag: created.etag }), (error) => error.code === 'concurrency-conflict');
  assert.equal(seen.length, afterCount + 1, 'stale update runs beforeSave only, never afterSave');
  const totalBeforeInvalidId = articles.rows.size;
  await assert.rejects(() => baseline.articles.update(undefined, { title: 'Invalid', alias: 'invalid' }, { etag: '"new"' }), /missing id/);
  assert.equal(articles.rows.size, totalBeforeInvalidId, 'invalid update must not become create');

  const writes = articles.rows.size;
  const invalid = createPluginManager();
  invalid.register({ name: 'invalid', events: { onContentBeforeSave: () => ({ title: '' }) } });
  const invalidAdmin = createAdminService({ articles }, { pluginManager: invalid });
  await assert.rejects(() => invalidAdmin.articles.create({ title: 'Bad', alias: 'bad' }), ValidationError);
  assert.equal(articles.rows.size, writes);
  const falseVeto = createPluginManager().register({ name: 'false-veto', events: { onContentBeforeSave: () => false } });
  await assert.rejects(() => createAdminService({ articles }, { pluginManager: falseVeto }).articles.create({ title: 'No', alias: 'no' }), ValidationError);
  assert.equal(articles.rows.size, writes);
  const arrayResult = createPluginManager().register({ name: 'array', events: { onContentBeforeSave: () => [] } });
  await assert.rejects(() => createAdminService({ articles }, { pluginManager: arrayResult }).articles.create({ title: 'No', alias: 'no' }), ValidationError);
  assert.equal(articles.rows.size, writes);
  const veto = createPluginManager();
  veto.register({ name: 'veto', events: { onContentBeforeSave: () => { throw new Error('veto'); } } });
  await assert.rejects(() => createAdminService({ articles }, { pluginManager: veto }).articles.create({ title: 'No', alias: 'no' }), /veto/);
  assert.equal(articles.rows.size, writes);

  const failedManager = createPluginManager();
  let afterCalls = 0;
  failedManager.register({ name: 'observer', events: { onContentAfterSave: () => { afterCalls += 1; } } });
  const failingRepo = { ...articles, async create() { throw new Error('persistence failed'); } };
  await assert.rejects(() => createAdminService({ articles: failingRepo }, { pluginManager: failedManager }).articles.create({ title: 'Fail', alias: 'fail' }), /persistence failed/);
  assert.equal(afterCalls, 0);
  await assert.rejects(() => admin.articles.update(created.id, { title: 'Stale' }, { etag: '"stale"' }), (error) => error.code === 'concurrency-conflict');
  const duplicate = await admin.articles.duplicate(created.id);
  assert.equal(duplicate.state, 'Draft');
  assert.equal(duplicate.title.endsWith('!'), true, 'duplicate uses the same hooks');
  const fresh = await articles.findById(created.id);
  const result = await admin.articles.batch([{ id: fresh.id, etag: fresh.etag }], 'unpublish');
  assert.equal(result.failed.length, 0);
  assert.equal((await articles.findById(fresh.id)).state, 'Draft');
  assert.throws(() => createAdminService({ articles }, { pluginManager: {} }), TypeError);
  console.log('ok - article save hooks: transform/veto, post-save isolation, duplicate/batch and captured non-enumerable ETags');
}
