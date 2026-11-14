import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRIBUTOR_FILES } from '../scripts/stage-contributor.js';
import { TEST_SUITES } from './run-tests.js';
import { defaultConfig } from '../src/libraries/minijoomla/core/config.js';

const PROJECT = fileURLToPath(new URL('../', import.meta.url));
export function runGenericInstallationScopeTests() {
  for (const path of [
    'scripts/prepare-videoteca-adaptation.js', 'tests/videoteca-adaptation.test.js',
    'scripts/prepare-forum-adaptation.js', 'tests/forum-adaptation.test.js',
    'src/modules/mod_videoteca/module.js', 'src/modules/mod_forum/module.js'
  ]) {
    assert.equal(existsSync(resolve(PROJECT, path)), false, `TD-specific implementation must not be in the generic project: ${path}`);
    assert.equal(CONTRIBUTOR_FILES.includes(path), false);
  }
  assert.ok(!TEST_SUITES.some(suite => /(?:videoteca|forum)/i.test(suite.file)));
  assert.ok(!CONTRIBUTOR_FILES.some(path => /(?:videoteca|forum)/i.test(path)));
  assert.ok(['default', 'cassiopeia'].includes(defaultConfig.templateKey), 'Generic default cannot be a corporate template');
  const contract = readFileSync(resolve(PROJECT, 'docs/INSTALACAO.md'), 'utf8');
  assert.ok(contract.includes('aceite real no SharePoint pendente'), 'Local implementation cannot be announced as an accepted SharePoint installation');
  console.log('ok - generic product scope: no TD implementation/catalogue fixtures, native default and explicit initial-installation gate; bootstrap/site acceptance separate');
}
