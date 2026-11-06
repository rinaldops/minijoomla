import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';

export async function runSampleDataSingletonTests() {
  let writes = 0;
  const siteConfig = { findMany: async () => ({ items: [{ id: 1 }, { id: 2 }] }), findById: async id => ({ id, etag: '"1"' }), create: async () => { writes++; }, update: async () => { writes++; } };
  const admin = createAdminService({ siteConfig });
  await assert.rejects(() => admin.siteConfig.get(), /duplicadas/);
  await assert.rejects(() => admin.siteConfig.save({ siteName: 'Example' }, { etag: '"1"' }), /duplicadas/);
  assert.equal(writes, 0);
  const incomplete = createAdminService({ categories: { ...siteConfig, findMany: async () => ({ items: [], hasNextPage: true }) } });
  await assert.rejects(() => incomplete.categories.list(), /incompleta/);
  console.log('ok - sample data integrity: duplicated singleton and incomplete administrative pages fail closed without writes');
}
