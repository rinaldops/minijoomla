import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProjectRelease } from '../scripts/release-check.js';

export function runReleaseCheckTests() {
  const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const parent = join(project, 'tmp', 'release-check-tests');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'fixture-'));
  for (const path of ['src', 'tests', 'scripts', 'examples', 'docs/licenses']) mkdirSync(join(root, path), { recursive: true });
  for (const path of ['README.md', 'LICENSE.md', 'docs/THIRD-PARTY-NOTICES.md', 'docs/licenses/GPL-2.0.txt']) copyFileSync(join(project, path), join(root, path));
  const save = (patch = {}) => writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'minijoomla', version: '1.2.3', license: 'GPL-2.0-or-later', private: true, ...patch }));
  save();
  const first = checkProjectRelease({ root });
  assert.equal(first.packageVersion, '1.2.3');
  assert.equal(first.scope, 'local-structure-only');
  assert.equal(first.publicationApproved, false);
  assert.equal(first.npmPublicationDisabled, true);
  assert.equal(checkProjectRelease({ root }).structuralDigest, first.structuralDigest);
  save({ version: '2.0.0-beta.1', private: false });
  assert.equal(checkProjectRelease({ root }).npmPublicationDisabled, false);
  save({ version: 'not-a-version' });
  assert.throws(() => checkProjectRelease({ root }), /semver/);
  save({ version: '01.2.3' });
  assert.throws(() => checkProjectRelease({ root }), /semver/);
  save({ version: '1.2.3-01' });
  assert.throws(() => checkProjectRelease({ root }), /semver/);
  save({ version: '1.2.3-beta.1+build.42' });
  assert.equal(checkProjectRelease({ root }).packageVersion, '1.2.3-beta.1+build.42');
  save({ license: 'UNLICENSED' });
  assert.throws(() => checkProjectRelease({ root }), /GPL/);
  save();
  writeFileSync(join(root, 'docs/licenses/GPL-2.0.txt'), 'truncated');
  assert.throws(() => checkProjectRelease({ root }), /GPL/);
  console.log('ok - portable offline release structural gate; no historical host/version requirement and no public-readiness claim');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runReleaseCheckTests();
