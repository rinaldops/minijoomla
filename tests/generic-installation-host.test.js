import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGenericInstallationHost } from '../scripts/test-generic-installation-host.js';

export async function runGenericInstallationHostTests() {
  assert.deepEqual(await runGenericInstallationHost(), { groups: 8, browserTested: false, richEditorTested: false, tenantTested: false, stagedTarget: 'all', realSPMiddle: true });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { await runGenericInstallationHostTests(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
