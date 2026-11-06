import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createJoomlaBlogPackage, loadJoomlaBlogPackage, sampleDataAssets } from '../src/plugins/sampledata/blog/blog.js';
import { createSampleDataService } from '../src/libraries/minijoomla/application/sample-data-service.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';

export async function runSampleDataPackageTests() {
  const pack = createJoomlaBlogPackage({ releaseBase: '/sites/example/release', mediaBase: '/sites/example/sampledata' });
  assert.deepEqual(Object.fromEntries(Object.entries(pack.domains).map(([key, rows]) => [key, rows.length])), { categories: 4, tags: 4, articles: 11, menu: 8, extensions: 4, templates: 1, moduleInstances: 7, siteConfig: 1 });
  assert.equal(pack.domains.tags[3].parentRef, pack.domains.tags[2].key);
  assert.equal(pack.domains.menu.find(m => m.key === 'category-list').parentRef, 'sample-layouts');
  assert.equal(pack.domains.articles[2].values.title, 'Welcome to your blog');
  assert.equal(pack.domains.articles[2].values.fulltext, '');
  assert.equal(JSON.parse(pack.domains.articles[2].values.attribsJson).images.image_intro, '/sites/example/sampledata/images/sampledata/cassiopeia/nasa1-1200.jpg');
  for (const asset of sampleDataAssets()) {
    const data = readFileSync(new URL('../src/media/sampledata/joomla-blog/' + asset.path, import.meta.url));
    assert.equal(data.length, asset.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
  }
  let checkedAssets = 0;
  const fetchMedia = async url => {
    checkedAssets++;
    const relative = url.slice('/sites/example/sampledata/'.length);
    const bytes = readFileSync(new URL('../src/media/sampledata/joomla-blog/' + relative, import.meta.url));
    return { ok: true, redirected: false, headers: { get: name => name === 'content-type' ? 'image/jpeg' : null }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };
  const checked = await loadJoomlaBlogPackage({ releaseBase: '/sites/example/release', mediaBase: '/sites/example/sampledata', fetchImpl: fetchMedia });
  assert.deepEqual(checked, pack); assert.equal(checkedAssets, 12);
  await assert.rejects(() => loadJoomlaBlogPackage({ releaseBase: '/sites/example/release', mediaBase: '/sites/example/sampledata', fetchImpl: async () => ({ ok: false }) }), /não disponível/);
  await assert.rejects(() => loadJoomlaBlogPackage({ releaseBase: '/sites/example/release', mediaBase: '/sites/example/sampledata', fetchImpl: async () => ({ ok: true, redirected: false, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new ArrayBuffer(1) }) }), /diverge/);
  let cancelled = false, released = false;
  const firstAsset = sampleDataAssets()[0];
  await assert.rejects(() => loadJoomlaBlogPackage({ releaseBase: '/sites/example/release', mediaBase: '/sites/example/sampledata', fetchImpl: async () => ({
    ok: true, redirected: false, headers: { get: name => name === 'content-type' ? 'image/jpeg' : null },
    body: { getReader: () => ({ read: async () => ({ done: false, value: new Uint8Array(firstAsset.bytes + 1) }), cancel: async () => { cancelled = true; }, releaseLock: () => { released = true; } }) }
  }) }), /excede/);
  assert.equal(cancelled, true); assert.equal(released, true);
  const repos = {};
  for (const domain of Object.keys(pack.domains)) {
    const rows = []; let revision = 0;
    repos[domain] = { findMany: async () => ({ items: structuredClone(rows) }), findById: async id => structuredClone(rows.find(r => r.id === id) ?? null), create: async values => { const row = { ...structuredClone(values), id: rows.length + 1, etag: `"${++revision}"` }; rows.push(row); return structuredClone(row); }, update: async () => { throw Error('No update'); }, delete: async () => { throw Error('No delete'); } };
  }
  let journal = null;
  const adminService = createAdminService(repos);
  const service = createSampleDataService({ adminService, loadPackage: async () => pack, journalStore: { read: () => journal, write: value => { journal = structuredClone(value); } } });
  assert.equal((await service.inspect()).status, 'ready');
  const bad = structuredClone(pack); bad.domains.extensions[0].values.folder = 'system';
  const invalid = createSampleDataService({ adminService, loadPackage: async () => bad, journalStore: { read: () => null, write: () => assert.fail('Invalid group must not write journal') } });
  assert.equal((await invalid.inspect()).status, 'unavailable');
  assert.equal((await invalid.install({ confirm: true })).status, 'unavailable');
  const emptyOverride = structuredClone(pack); emptyOverride.domains.extensions[0].values.folder = '';
  const emptyService = createSampleDataService({ adminService, loadPackage: async () => emptyOverride, journalStore: { read: () => null, write: () => assert.fail('Inspect must be read only') } });
  assert.equal((await emptyService.inspect()).status, 'ready');
  const installed = await service.install({ confirm: true });
  assert.equal(installed.status, 'installed', installed.message);
  assert.equal(installed.summary.completed, 40);
  assert.equal((await service.install({ confirm: true })).status, 'installed');
  const withoutJournal = createSampleDataService({ adminService, loadPackage: async () => pack, journalStore: { read: () => null, write: () => assert.fail('Existing sample must not write journal') } });
  assert.equal((await withoutJournal.inspect()).status, 'installed');
  assert.equal((await withoutJournal.install({ confirm: true })).status, 'installed');
  console.log('ok - original Joomla package: 40 records, 12 hash-verified assets, hierarchy, full service install and duplicate-free recognition');
}
