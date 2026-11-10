import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { moduleTypeCatalog } from '../src/libraries/minijoomla/application/module-catalog.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { extensionFixture } from './admin-extensions-service.test.js';

const snapshot = (repositories) => structuredClone(Object.fromEntries(Object.entries(repositories).map(([key, repo]) => [key, { rows: [...repo.rows.entries()], lastPatch: repo.lastPatch }])));

export async function runAdminIntegrityTests() {
  const checks = [
    ['siteConfig', (admin) => admin.siteConfig.get()],
    ['siteConfig', (admin) => admin.siteConfig.save({ siteName: 'Never create on failure' })],
    ['siteConfig', (admin) => admin.moduleInstances.positions()],
    ['siteConfig', (admin) => admin.templates.setDefault(8, { etag: '"1"' })],
    ['extensions', (admin) => admin.extensions.list()],
    ['extensions', (admin) => admin.extensions.create({ title: 'Duplicate', key: 'module-x', type: 'Module', entryPointUrl: '/x.js' })],
    ['extensions', (admin) => admin.moduleInstances.catalog()],
    ['templates', (admin) => admin.templates.create({ title: 'Duplicate', key: 'registered', version: '1', entryPointUrl: '/t.js', positions: ['footer'] })],
    ['templates', (admin) => admin.templateStyles.duplicate('cassiopeia-default', { etag: '"1"' })],
    ['moduleInstances', (admin) => admin.extensions.remove(1, { etag: '"1"' })]
  ];
  for (const result of [undefined, null, [], {}, { items: null }, { items: {} }, { items: '[]' }]) {
    for (const [domain, operation] of checks) {
      const repos = extensionFixture();
      repos.templates.rows.set(8, { id: 8, etag: '"1"', key: 'registered', title: 'Registered', positionsJson: '["footer"]', enabled: true });
      repos.moduleInstances.rows.set(1, { id: 1, etag: '"1"', extensionKey: 'module-x', title: 'Referenced', position: 'footer' });
      repos[domain].findMany = async () => result;
      const before = snapshot(repos);
      await assert.rejects(() => operation(createAdminService(repos)), /Resposta inválida/);
      assert.deepEqual(snapshot(repos), before, `invalid ${domain} response preserves records, ETags and lastPatch`);
    }
  }
  console.log('ok - admin integrity: malformed collection results never become empty lists, duplicate keys or singleton creates');

  const invalidObjects = ['{broken', '[]', 'null', '42', '"text"', [], 42];
  for (const settingsJson of invalidObjects) {
    for (const input of [{ title: 'Changed' }, { settings: { limit: 3 } }, { enabled: false }]) {
      const repos = extensionFixture();
      repos.moduleInstances.rows.set(1, { id: 1, etag: '"1"', title: 'Stored', extensionKey: 'articles-latest', position: 'footer', settingsJson });
      const before = snapshot(repos);
      const admin = createAdminService(repos);
      await assert.rejects(() => admin.moduleInstances.update(1, input, { etag: '"1"' }), ValidationError);
      await assert.rejects(() => admin.moduleInstances.duplicate(1), ValidationError);
      const batch = await admin.moduleInstances.batch([{ id: 1, etag: '"1"' }], 'publish');
      assert.deepEqual(batch.succeeded, []);
      assert.equal(batch.failed.length, 1);
      assert.deepEqual(snapshot(repos), before);
    }
  }
  for (const manifestJson of [...invalidObjects, '{"params":{}}', '{"params":[{"name":"color","type":"eval"}]}']) {
    const repos = extensionFixture();
    repos.extensions.rows.get(1).manifestJson = manifestJson;
    const before = snapshot(repos);
    const admin = createAdminService(repos);
    await assert.rejects(() => admin.moduleInstances.catalog(), ValidationError);
    await assert.rejects(() => admin.moduleInstances.create({ title: 'New', extensionKey: 'module-x', position: 'footer', settings: {} }), ValidationError);
    assert.deepEqual(snapshot(repos), before);
  }
  assert.throws(() => moduleTypeCatalog({}), ValidationError);
  {
    const repos = extensionFixture();
    repos.extensions.rows.get(1).manifestJson = '{broken';
    const before = snapshot(repos);
    await assert.rejects(() => createAdminService(repos).installer.list(), ValidationError);
    assert.deepEqual(snapshot(repos), before);
  }
  console.log('ok - admin integrity: invalid module settings/manifests reject changes, duplication and batch before persistence');

  for (const positionsJson of ['{broken', '{}', 'null', '[]', '["unknown slot"]', '["footer",42]']) {
    const repos = extensionFixture();
    repos.templates.rows.set(8, { id: 8, etag: '"1"', key: 'registered', title: 'Registered', positionsJson, enabled: true });
    const before = snapshot(repos);
    const admin = createAdminService(repos);
    for (const operation of [() => admin.moduleInstances.positions(), () => admin.templateStyles.list(), () => admin.templateStyles.save('cassiopeia-default', { title: 'Changed' }, { etag: '"1"' }), () => admin.templateStyles.duplicate('cassiopeia-default', { etag: '"1"' })]) {
      await assert.rejects(operation, ValidationError);
      assert.deepEqual(snapshot(repos), before);
    }
  }
  console.log('ok - admin integrity: corrupt template positions block catalog/default-style fallbacks and writes');

  for (const legacy of [undefined, null, '']) {
    const repos = extensionFixture();
    repos.moduleInstances.rows.set(1, { id: 1, etag: '"1"', title: 'Legacy', extensionKey: 'search', position: 'search', settingsJson: legacy });
    repos.extensions.rows.get(1).manifestJson = legacy;
    repos.templates.rows.set(8, { id: 8, etag: '"1"', key: 'legacy', title: 'Legacy', positionsJson: legacy, enabled: true });
    const admin = createAdminService(repos);
    assert.deepEqual((await admin.moduleInstances.catalog()).find((entry) => entry.key === 'module-x').params, []);
    assert.deepEqual((await admin.moduleInstances.positions('legacy')).positions, []);
    await admin.moduleInstances.update(1, { note: 'Changed' }, { etag: '"1"' });
    assert.equal(repos.moduleInstances.rows.get(1).settingsJson, legacy);
    assert.equal('settingsJson' in repos.moduleInstances.lastPatch, false);
    const before = snapshot(repos);
    await assert.rejects(() => admin.moduleInstances.update(1, { settings: {} }, { etag: '"1"' }), (error) => error.code === 'concurrency-conflict');
    assert.deepEqual(snapshot(repos), before);
  }
  const repos = extensionFixture();
  const exactSettings = '  {"limit":4,"advanced":{"tokens":["x",{"enabled":false}]}}\n';
  repos.moduleInstances.rows.set(1, { id: 1, etag: '"1"', title: 'Stored', extensionKey: 'articles-latest', position: 'footer', settingsJson: exactSettings });
  const admin = createAdminService(repos);
  await admin.moduleInstances.update(1, { note: 'Keep JSON' }, { etag: '"1"' });
  assert.equal(repos.moduleInstances.rows.get(1).settingsJson, exactSettings);
  await assert.rejects(() => admin.moduleInstances.create({ title: 'Invalid params', extensionKey: 'articles-latest', position: 'footer', settings: { limit: 999 } }), ValidationError);
  await assert.rejects(() => admin.moduleInstances.create({ title: 'Invalid registered params', extensionKey: 'module-x', position: 'footer', settings: { color: 'invalid' } }), ValidationError);
  console.log('ok - admin integrity: legacy absent/null/empty fields, exact settings and optimistic concurrency preserved');

  for (const existing of [null, { metaDescription: '  Preserve exact description  ', metaKeywords: 'old,keywords', robots: 'legacy robot value', sitenamePagetitles: 'before' }]) {
    const repos = extensionFixture();
    if (existing) Object.assign(repos.siteConfig.rows.get(1), existing);
    else repos.siteConfig.rows.clear();
    const admin = createAdminService(repos);
    for (const field of ['metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles']) {
      const before = snapshot(repos);
      await assert.rejects(() => admin.siteConfig.save({ siteName: 'Never save partially', [field]: 'replacement' }, existing ? { etag: '"1"' } : {}), /SEO indisponíveis/);
      assert.deepEqual(snapshot(repos), before);
    }
    await admin.siteConfig.save({ siteName: 'Operational save', ...(existing ?? {}) }, existing ? { etag: '"1"' } : {});
    const stored = await admin.siteConfig.get();
    for (const field of ['metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles']) {
      assert.equal(stored[field], existing?.[field]);
      assert.equal(field in (repos.siteConfig.lastPatch ?? {}), false);
    }
  }
  console.log('ok - admin integrity: nonoperational SEO rejects replacements atomically and preserves legacy data without backfill');
  for (const value of [undefined, null, '']) {
    const repos = extensionFixture();
    if (value !== undefined) Object.assign(repos.siteConfig.rows.get(1), { metaDescription: value, metaKeywords: value, robots: value, sitenamePagetitles: value });
    const admin = createAdminService(repos);
    await admin.siteConfig.save({ siteName: 'Changed', metaDescription: '', metaKeywords: '', robots: '', sitenamePagetitles: 'none' }, { etag: '"1"' });
    for (const field of ['metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles']) assert.equal(repos.siteConfig.rows.get(1)[field], value);
  }
}
