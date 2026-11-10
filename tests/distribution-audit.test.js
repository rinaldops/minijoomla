import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDistribution } from '../scripts/audit-distribution.js';
import { stageRelease } from '../scripts/stage-release.js';
import { removeTestDirectory } from './tooling-validation.test.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(PROJECT, 'scripts', 'audit-distribution.js');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => JSON.stringify(value, null, 2);

// Synthetic adversarial inputs and a real core stage are owned under project
// tmp. The real graph uses MINIJOOMLA sources only, never sibling/Git/tenant data.
export async function runDistributionAuditTests() {
  mkdirSync(join(PROJECT, 'tmp'), { recursive: true });
  const base = mkdtempSync(join(PROJECT, 'tmp', 'distribution-audit-test-'));
  const put = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
  let serial = 0;
  const fixture = (files = { 'libraries/minijoomla/fixture.js': 'export const synthetic = true;' }) => {
    const root = join(base, `stage-${serial++}`);
    const manifest = join(root, 'manifest.json');
    const value = { version: '0.1.0', target: 'core', algorithm: 'sha256', files: Object.entries(files).map(([path, value]) => {
      const data = Buffer.from(value);
      put(join(root, path), data);
      return { path, bytes: data.length, sha256: hash(data) };
    }) };
    put(manifest, json(value));
    return { root, manifest, value };
  };
  const revise = (item, change) => { change(item.value); put(item.manifest, json(item.value)); };
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dirname(PROJECT), encoding: 'utf8', timeout: 10000 });
    assert.ifError(result.error);
    return result;
  };
  let linkChecks = 0;
  let linkSkips = 0;
  const tryLink = (target, path, type) => {
    try { symlinkSync(target, path, type); return true; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
      linkSkips += 1;
      return false;
    }
  };
  try {
    const clean = fixture({
      'libraries/minijoomla/bootstrap.js': 'export const endpoint = "https://example.invalid/api";',
      'media/templates/administrator/atum/css/template.css': '.fixture { color: black; }',
      'docs/licenses/GPL-2.0.txt': 'Synthetic license text, not a rights review.',
      'entrypoints.json': '{"target":"core"}'
    });
    const before = clean.value.files.map(({ path }) => readFileSync(join(clean.root, path)));
    const manifestBefore = readFileSync(clean.manifest);
    const inventoryBefore = readdirSync(clean.root).sort();
    const result = auditDistribution({ manifest: clean.manifest });
    assert.equal(result.status, 'no-candidates-in-manifest');
    assert.equal(result.counts.files, 4);
    assert.equal(result.counts.candidates, 0);
    assert.equal(result.integrity, 'all-declared-file-hashes-verified');
    assert.equal(result.publicDistributionApproved, false);
    assert.equal(result.rightsReviewed, false);
    assert.equal(result.privacyCertified, false);
    assert.equal(result.scope.gitHistory, 'not-read');
    assert.equal(result.scope.gitIndex, 'not-read');
    assert.equal(result.scope.network, 'not-used');
    assert.match(result.pending.join('\n'), /TinyMCE.*complete corresponding source/);
    assert.match(result.pending.join('\n'), /SPMIDDLE.*complete MIT license/);
    assert.match(result.pending.join('\n'), /including when candidates are zero/);
    assert.match(result.pending.join('\n'), /does not read Git or establish their current contents/);
    assert.doesNotMatch(result.pending.join('\n'), /Tracked tmp artifacts and aggregator Git history require/);
    assert.deepEqual(readFileSync(clean.manifest), manifestBefore);
    assert.deepEqual(readdirSync(clean.root).sort(), inventoryBefore);
    clean.value.files.forEach(({ path }, index) => assert.deepEqual(readFileSync(join(clean.root, path)), before[index]));
    assert.deepEqual(auditDistribution({ manifest: relative(PROJECT, clean.manifest) }), result);
    const validCli = cli('--manifest', join('tmp', basename(base), basename(clean.root), 'manifest.json'));
    assert.equal(validCli.status, 0, validCli.stderr);
    assert.deepEqual(JSON.parse(validCli.stdout), result);

    // Unlisted files and even unlisted links are NOT traversed. This is a
    // manifest gate, not certification of the containing tmp directory.
    put(join(clean.root, 'unlisted-private.json'), '{"token":"synthetic-out-of-scope-value"}');
    assert.deepEqual(auditDistribution({ manifest: clean.manifest }), result);
    assert.equal(result.scope.unlistedFiles, 'not-audited');

    const fakeHost = ['fixture', 'petrobras', 'com', 'br'].join('.');
    const fakeGuid = ['11111111', '2222', '4333', '8444', '555555555555'].join('-');
    const fakeSecret = 'synthetic-only-do-not-report-aaaaaaaa';
    const fakeCorporatePath = '/sites/synthetic-audit-only/SiteAssets/fixture';
    const keyHeader = `-----BEGIN ${'PRIVATE KEY'}-----`;
    const suspicious = fixture({
      'libraries/minijoomla/fixture.js': `// Synthetic candidates, never real configuration.\nconst endpoint = "https://${fakeHost}${fakeCorporatePath}";\nconst id = "${fakeGuid}";\nconst token = "${fakeSecret}";\nconst signed = "https://example.invalid/?sig=${fakeSecret}";\nconst header = "Bearer ${fakeSecret}";\n/* ${keyHeader} */`,
      'administrator/components/com_minijoomla/token-fixture.js': 'export const token = "fixture-not-a-secret";'
    });
    const blocked = auditDistribution({ manifest: suspicious.manifest });
    assert.equal(blocked.status, 'candidates-found');
    assert.equal(blocked.counts.filesWithCandidates, 2);
    for (const category of ['corporate-host', 'corporate-path', 'corporate-context', 'guid', 'credential-literal', 'private-key', 'signed-url', 'bearer-or-jwt']) assert.ok(blocked.counts.byCategory[category]?.files > 0, category);
    assert.equal(blocked.counts.byCategory['credential-literal'].files, 2, 'Fixtures are not automatically exempted.');
    assert.equal(blocked.findings[0].path, 'libraries/minijoomla/fixture.js');
    const reportText = json(blocked);
    for (const value of [fakeHost, fakeGuid, fakeSecret, fakeCorporatePath, keyHeader]) assert.ok(!reportText.includes(value), 'No matched values in report.');
    const blockedCli = cli('--manifest', suspicious.manifest);
    assert.equal(blockedCli.status, 1);
    assert.deepEqual(JSON.parse(blockedCli.stdout), blocked);
    assert.equal(blockedCli.stderr, '');

    const sensitivePath = fixture({ [`libraries/minijoomla/${fakeGuid}.js`]: 'export const fixture = true;' });
    const pathReport = auditDistribution({ manifest: sensitivePath.manifest });
    assert.equal(pathReport.findings[0].path, null);
    assert.equal(pathReport.findings[0].pathWithheld, true);
    assert.equal(pathReport.findings[0].file, 'manifest.files[0]');
    assert.ok(!json(pathReport).includes(fakeGuid));

    const privateFiles = fixture({
      '.env': 'synthetic=true',
      'tmp/fixture.js': 'export const synthetic = true;',
      'libraries/minijoomla/private/fixture.js': 'export const synthetic = true;',
      'libraries/minijoomla/credentials.json': '{}',
      'libraries/vendor/spmiddle/fixture.js': 'export const synthetic = true;',
      'administrator/components/com_minijoomla/vendor/fixture.js': 'export const synthetic = true;',
      'libraries/minijoomla/composition/fixture.js': 'export const synthetic = true;',
      'libraries/minijoomla/infrastructure/sharepoint-fixture.js': 'export const synthetic = true;',
      'libraries/minijoomla/fixture.key': 'synthetic-only',
      'libraries/minijoomla/mark.png': Buffer.from([0, 255, 1, 128]),
      'libraries/minijoomla/invalid-utf8.js': Buffer.from([255, 128])
    });
    const privateReport = auditDistribution({ manifest: privateFiles.manifest });
    assert.equal(privateReport.counts.filesWithCandidates, 11);
    assert.equal(privateReport.counts.byCategory['private-artifact'].files, 5);
    assert.equal(privateReport.counts.byCategory['opaque-content-review'].files, 2);
    assert.ok(privateReport.counts.byCategory['outside-core-scope'].files >= 8);

    const parserNames = ['libraries/vendor/parse-xml/parse-xml.js', 'libraries/vendor/parse-xml/LICENSE', 'libraries/vendor/parse-xml/notices.txt'];
    const parser = fixture(Object.fromEntries(parserNames.map(path => [path, 'Synthetic parser scope fixture.'])));
    assert.equal(auditDistribution({ manifest: parser.manifest }).counts.candidates, 0);
    // Exact path scope is not a content/signature exemption, even for notices.
    put(join(parser.root, parserNames[2]), `const token = "${fakeSecret}";`);
    revise(parser, value => {
      const data = readFileSync(join(parser.root, parserNames[2]));
      value.files[2] = { path: parserNames[2], bytes: data.length, sha256: hash(data) };
    });
    const parserCandidate = auditDistribution({ manifest: parser.manifest });
    assert.equal(parserCandidate.counts.byCategory['credential-literal'].files, 1);
    assert.ok(!parserCandidate.counts.byCategory['outside-core-scope']);
    const unauthorizedNames = ['libraries/vendor/parse-xml/extra.js', 'libraries/vendor/parse-xml/license', 'libraries/vendor/parse-xml/LICENSE.md', 'libraries/vendor/parse-xml/nested/parse-xml.js', 'libraries/vendor/other/parse-xml.js', 'libraries/vendor/spmiddle/fixture.js', 'media/vendor/tinymce/tinymce.min.js', 'administrator/components/vendor/fixture.js'];
    const unauthorized = fixture(Object.fromEntries(unauthorizedNames.map(path => [path, 'Synthetic unauthorized vendor.'])));
    assert.equal(auditDistribution({ manifest: unauthorized.manifest }).counts.byCategory['outside-core-scope'].files, unauthorizedNames.length);

    const core = stageRelease({ version: '0.3.1', output: join(base, 'real-core'), target: 'core' });
    const coreReport = auditDistribution({ manifest: join(core.output, 'manifest.json') });
    assert.equal(coreReport.target, 'core');
    assert.equal(coreReport.integrity, 'all-declared-file-hashes-verified');
    assert.equal(coreReport.counts.files, core.manifest.files.length);
    assert.equal(core.manifest.files.length, 146, 'Current real core inventory; update explicitly when its graph changes (mod_articles_featured added in the Iteração 5 destaques module, camap-v3 files removed from MINIJOOMLA in the Iteração 4.0 packaging pivot — now confined to web-devs/CAMAP-V3/minijoomla-template/)');
    assert.ok(!coreReport.counts.byCategory['outside-core-scope'], 'A real core stage must not be rejected as unauthorized vendor');
    for (const path of parserNames) assert.ok(core.manifest.files.some(entry => entry.path === path));
    assert.equal(coreReport.publicDistributionApproved, false);
    assert.equal(coreReport.rightsReviewed, false);
    assert.equal(coreReport.privacyCertified, false);
    console.log(`ok - real core distribution audit: ${coreReport.counts.files} verified staged files, exact parser scope, no vendor/signature exemption or approval`);

    const many = fixture(Object.fromEntries(Array.from({ length: 125 }, (_, index) => [`libraries/minijoomla/fixture-${index}.js`, `const token = "${fakeSecret}";`])));
    const bounded = auditDistribution({ manifest: many.manifest });
    assert.equal(bounded.counts.filesWithCandidates, 125);
    assert.equal(bounded.counts.byCategory['credential-literal'].candidates, 125);
    assert.equal(bounded.findings.length, 100);
    assert.equal(bounded.findingsTruncated, true);
    assert.equal(bounded.omittedFindingFiles, 25);
    assert.ok(!json(bounded).includes(fakeSecret));

    const changed = fixture();
    put(join(changed.root, 'libraries/minijoomla/fixture.js'), 'export const synthetic = false;');
    assert.throws(() => auditDistribution({ manifest: changed.manifest }), /audit-file-integrity-failed/);
    const sizeTamper = fixture();
    revise(sizeTamper, (value) => { value.files[0].bytes += 1; });
    assert.throws(() => auditDistribution({ manifest: sizeTamper.manifest }), /audit-file-integrity-failed/);
    const hashTamper = fixture();
    revise(hashTamper, (value) => { value.files[0].sha256 = '0'.repeat(64); });
    assert.throws(() => auditDistribution({ manifest: hashTamper.manifest }), /audit-file-integrity-failed/);
    const missing = fixture();
    rmSync(join(missing.root, 'libraries/minijoomla/fixture.js'));
    assert.throws(() => auditDistribution({ manifest: missing.manifest }), /audit-path-unavailable/);
    const directory = fixture();
    rmSync(join(directory.root, 'libraries/minijoomla/fixture.js'));
    mkdirSync(join(directory.root, 'libraries/minijoomla/fixture.js'));
    assert.throws(() => auditDistribution({ manifest: directory.manifest }), /audit-regular-file-required/);

    const invalidPaths = ['../synthetic.js', 'app/../../synthetic.js', '/synthetic.js', 'C:/synthetic.js', '\\\\synthetic\\file', 'app\\fixture.js', 'https://example.invalid/file', 'app/%2e%2e/file.js', 'app/.git/config', 'app//fixture.js', 'app/./fixture.js', 'app/fixture.js:stream', 'app/NUL.js', 'app/fixture.js.', 'app/fixture\u0000.js', 'manifest.json'];
    invalidPaths.push('app/fixture?.js', 'app/fixture*.js', 'app/fixture|.js', 'app/fixture<.js', 'app/fixture".js');
    for (const path of invalidPaths) {
      const item = fixture();
      revise(item, (value) => { value.files[0].path = path; });
      assert.throws(() => auditDistribution({ manifest: item.manifest }), /audit-file-entry-invalid/);
    }
    const duplicate = fixture();
    revise(duplicate, (value) => { value.files.push({ ...value.files[0], path: 'LIBRARIES/MINIJOOMLA/FIXTURE.JS' }); });
    assert.throws(() => auditDistribution({ manifest: duplicate.manifest }), /audit-file-entry-invalid/);
    for (const change of [
      (value) => { value.target = 'all'; },
      (value) => { value.target = 'site'; },
      (value) => { value.algorithm = 'md5'; },
      (value) => { value.token = fakeSecret; },
      (value) => { value.files[0].token = fakeSecret; },
      (value) => { value.version = '01.0.0'; },
      (value) => { value.files = []; },
      (value) => { value.files = Array(2001).fill(value.files[0]); },
      (value) => { value.files[0].bytes = -1; },
      (value) => { value.files[0].bytes = 0.5; },
      (value) => { value.files[0].bytes = 16 * 1024 * 1024 + 1; },
      (value) => { value.files[0].sha256 = fakeSecret; }
    ]) {
      const item = fixture();
      revise(item, change);
      assert.throws(() => auditDistribution({ manifest: item.manifest }), /audit-(?:core-manifest-schema|file-entry)-invalid/);
    }
    const totalLimit = fixture();
    revise(totalLimit, (value) => { value.files = Array.from({ length: 5 }, (_, index) => ({ path: `app/fixture-${index}.js`, bytes: 16 * 1024 * 1024, sha256: '0'.repeat(64) })); });
    assert.throws(() => auditDistribution({ manifest: totalLimit.manifest }), /audit-total-size-limit/);
    const manifestLimit = fixture();
    put(manifestLimit.manifest, ' '.repeat(2 * 1024 * 1024 + 1));
    assert.throws(() => auditDistribution({ manifest: manifestLimit.manifest }), /audit-size-limit/);
    const malformed = fixture();
    put(malformed.manifest, `{ "synthetic-token": "${fakeSecret}"`);
    assert.throws(() => auditDistribution({ manifest: malformed.manifest }), /audit-manifest-json-invalid/);
    const malformedCli = cli('--manifest', malformed.manifest);
    assert.equal(malformedCli.status, 2);
    assert.equal(malformedCli.stdout, '');
    assert.ok(!malformedCli.stderr.includes(fakeSecret));
    for (const path of [undefined, '', 'https://example.invalid/manifest.json', '\\\\synthetic\\manifest.json', '../MINIJOOMLA/tmp/stage/manifest.json', join(PROJECT, 'package.json'), join(PROJECT, 'tmp-other', 'stage', 'manifest.json'), join(PROJECT, 'tmp', 'manifest.json'), join(clean.root, 'not-manifest.json')]) assert.throws(() => auditDistribution({ manifest: path }), /audit-manifest/);
    assert.throws(() => auditDistribution({ manifest: join(base, '.git', 'manifest.json') }), /audit-manifest/);
    for (const args of [[], ['--unknown', clean.manifest], ['--manifest', clean.manifest, '--manifest', clean.manifest], ['--manifest', 'https://example.invalid/manifest.json']]) {
      const invalid = cli(...args);
      assert.equal(invalid.status, 2);
      assert.equal(invalid.stdout, '');
      assert.ok(!invalid.stderr.includes(clean.manifest));
    }

    const linked = fixture();
    const linkedRoot = join(base, 'linked-stage');
    if (tryLink(linked.root, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir')) {
      try { assert.throws(() => auditDistribution({ manifest: join(linkedRoot, 'manifest.json') }), /audit-links-not-allowed/); linkChecks += 1; }
      finally { rmSync(linkedRoot); }
    }
    const parentLink = join(base, 'linked-app');
    if (tryLink(join(linked.root, 'libraries'), parentLink, process.platform === 'win32' ? 'junction' : 'dir')) {
      const manifest = fixture();
      rmSync(join(manifest.root, 'libraries'), { recursive: true });
      symlinkSync(parentLink, join(manifest.root, 'libraries'), process.platform === 'win32' ? 'junction' : 'dir');
      try { assert.throws(() => auditDistribution({ manifest: manifest.manifest }), /audit-links-not-allowed/); linkChecks += 1; }
      finally { rmSync(join(manifest.root, 'libraries')); rmSync(parentLink); }
    }
    for (const dangling of [false, true]) {
      const item = fixture();
      const path = join(item.root, 'libraries/minijoomla/fixture.js');
      rmSync(path);
      if (tryLink(dangling ? join(base, 'missing-synthetic.js') : join(linked.root, 'libraries/minijoomla/fixture.js'), path, 'file')) {
        try { assert.throws(() => auditDistribution({ manifest: item.manifest }), /audit-links-not-allowed/); linkChecks += 1; }
        finally { rmSync(path); }
      }
    }
    const manifestLink = fixture();
    rmSync(manifestLink.manifest);
    if (tryLink(linked.manifest, manifestLink.manifest, 'file')) {
      try { assert.throws(() => auditDistribution({ manifest: manifestLink.manifest }), /audit-links-not-allowed/); linkChecks += 1; }
      finally { rmSync(manifestLink.manifest); }
    }
    const hardlink = fixture();
    const hardlinkPath = join(hardlink.root, 'libraries/minijoomla/fixture.js');
    rmSync(hardlinkPath);
    linkSync(join(linked.root, 'libraries/minijoomla/fixture.js'), hardlinkPath);
    assert.throws(() => auditDistribution({ manifest: hardlink.manifest }), /audit-hardlinks-not-allowed/);

    const importOnly = spawnSync(process.execPath, ['--input-type=module', '-e', `globalThis.fetch = () => { throw new Error('No network'); }; await import(${JSON.stringify(new URL('../scripts/audit-distribution.js', import.meta.url).href)});`], { encoding: 'utf8', timeout: 10000 });
    assert.ifError(importOnly.error);
    assert.equal(importOnly.status, 0, importOnly.stderr);
    assert.equal(importOnly.stdout, '');
    console.log(`ok - distribution audit: synthetic manifest-only read, verified hashes, candidate privacy/counts, bounded findings, CLI and containment; ${linkChecks} link checks, ${linkSkips} permission-limited skips; no public/rights/privacy approval`);
  } finally {
    // Only this suite's mkdtemp directory is removed; never shared tmp artifacts.
    removeTestDirectory(base);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDistributionAuditTests().catch(() => { console.error('distribution-audit tests failed; inspect assertions locally without copying candidate values.'); process.exitCode = 1; });
}
