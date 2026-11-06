import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runStandaloneExamples } from '../scripts/test-standalone-examples.js';

export function runStandaloneExamplesTests() {
  assert.deepEqual(runStandaloneExamples(), { groups: 7, browserTested: false, richEditorTested: false, siblingRequired: false });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { runStandaloneExamplesTests(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
