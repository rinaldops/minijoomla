import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRIBUTOR_FILES, stageContributor, verifyContributorStage } from '../scripts/stage-contributor.js';
import { auditDistribution } from '../scripts/audit-distribution.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(PROJECT, 'scripts', 'stage-contributor.js');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const put = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };

function command(root, executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 12 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result;
}

async function workflow(root) {
  assert.ok(!existsSync(join(dirname(root), 'SPMIDDLE')));
  // Use the actual package command, not a rewritten runner/suite selection.
  // npm-cli.js avoids a shell and Windows .cmd quoting; npm needs no install.
  const npm = /(?:^|[\\/])npm-cli\.js$/.test(process.env.npm_execpath ?? '')
    ? process.env.npm_execpath : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  assert.ok(existsSync(npm), 'npm CLI must be available for the contributor command check');
  const tests = command(root, process.execPath, [npm, 'test']);
  assert.equal((tests.stdout.match(/^SKIP - /gm) ?? []).length, 11);
  assert.match(tests.stdout, /Suites: \d+ passed, 11 skipped, 0 failed/);
  assert.match(tests.stdout, /ok - suite runner\.test\.js/);
  console.log(`ok - selected npm test: ${tests.stdout.match(/Suites: \d+ passed, 11 skipped, 0 failed/)[0]}; real runner child also passed`);
  const syntax = command(root, process.execPath, [npm, 'run', 'check']);
  assert.match(syntax.stdout, /Syntax OK: \d+ JavaScript files/);
  // check-syntax.js currently checks src/tests/examples, not scripts.
  for (const name of CONTRIBUTOR_FILES.filter((name) => name.startsWith('scripts/') && name.endsWith('.js'))) command(root, process.execPath, ['--check', name]);
  console.log(`ok - selected npm run check: ${syntax.stdout.match(/Syntax OK: \d+ JavaScript files/)[0]}; all selected scripts also checked`);
  const examples = command(root, process.execPath, [npm, 'run', 'test:standalone-examples']);
  assert.doesNotMatch(examples.stdout, /LIMIT/);
  console.log('ok - selected npm run test:standalone-examples: unchanged example modules and seven offline contract groups');
  command(root, process.execPath, [npm, 'run', 'release:check']);
  console.log('ok - selected npm run release:check: local structure, no approval');
  command(root, process.execPath, ['scripts/stage-release.js', '--version', '0.3.1', '--output', 'tmp/core-check', '--target', 'core']);
  console.log('ok - selected stage-release --target core: standalone local graph');
  for (const target of ['all', 'site']) {
    const gated = spawnSync(process.execPath, ['scripts/stage-release.js', '--version', '0.3.1', '--output', `tmp/${target}-check`, '--target', target], { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.ifError(gated.error);
    assert.equal(gated.status, 1);
    assert.match(gated.stderr, /Raiz de fontes ausente/);
    assert.ok(!existsSync(join(root, 'tmp', `${target}-check`)));
  }
  console.log('ok - selected release structure/core staging work; optional all/site still fail without sibling');

  // Loopback HTTP only: bytes/MIME are not browser or real editor acceptance.
  const { createLocalDemoServer } = await import('../scripts/serve-local.js');
  const server = createLocalDemoServer({ root });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  try {
    assert.equal(server.address().address, '127.0.0.1');
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [name, mime] of [
      ['examples/index.html', 'text/html; charset=utf-8'],
      ['examples/admin.html', 'text/html; charset=utf-8'],
      ['src/media/vendor/tinymce/tinymce.min.js', 'text/javascript; charset=utf-8'],
      ['src/media/vendor/tinymce/skins/ui/oxide/skin.min.css', 'text/css; charset=utf-8']
    ]) {
      const response = await fetch(`${base}/${name}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), mime);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(join(root, name)));
    }
    for (const name of ['manifest.json', 'docs/THIRD-PARTY-NOTICES.md', 'tmp/core-check/manifest.json', '.git/config']) assert.equal((await fetch(`${base}/${name}`)).status, 404);
  } finally { await new Promise((done) => server.close(done)); }
  // Only test-owned command outputs are removed. The selection script itself
  // never deletes/overwrites a destination; running commands mutates tmp only.
  rmSync(join(root, 'tmp'), { recursive: true, force: true });
  console.log('ok - selected actual demos and TinyMCE assets: exact bytes, MIME, loopback/no-store/nosniff; no browser launched');
}

// Command workflow is opt-in here to avoid nested npm-test recursion if the
// coordinator later registers this function in the main runner. The direct CLI
// always exercises it. Existing shared runner/package files remain untouched.
export async function runContributorStageTests({ commands = false } = {}) {
  mkdirSync(join(PROJECT, 'tmp'), { recursive: true });
  const base = mkdtempSync(join(PROJECT, 'tmp', 'contributor-agent-'));
  let checkedLinks = 0;
  let unavailableLinks = 0;
  const tryLink = (target, path, type) => {
    try { symlinkSync(target, path, type); return true; }
    catch (error) { if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; unavailableLinks += 1; return false; }
  };
  const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dirname(PROJECT), encoding: 'utf8', timeout: 30000 });
  try {
    assert.ok(Object.isFrozen(CONTRIBUTOR_FILES));
    assert.equal(new Set(CONTRIBUTOR_FILES).size, CONTRIBUTOR_FILES.length);
    const first = stageContributor({ output: join(base, 'first') });
    const second = stageContributor({ output: join(base, 'second') });
    assert.deepEqual(first.manifest, second.manifest);
    assert.deepEqual(readFileSync(join(first.output, 'manifest.json')), readFileSync(join(second.output, 'manifest.json')));
    assert.deepEqual(verifyContributorStage({ output: first.output }), first.manifest);
    assert.equal(first.manifest.target, 'contributor-local');
    for (const key of ['publicationApproved', 'privacyApproved', 'rightsApproved']) assert.equal(first.manifest[key], false);
    assert.deepEqual(first.manifest.files.map(({ path }) => path), CONTRIBUTOR_FILES);
    for (const entry of first.manifest.files) {
      const data = readFileSync(join(first.output, entry.path));
      assert.equal(data.length, entry.bytes);
      assert.equal(hash(data), entry.sha256);
      assert.deepEqual(data, readFileSync(join(PROJECT, entry.path)), `Never rewrite or sanitize ${entry.path}`);
      assert.ok(!/^(?:tmp\/|\.git\/|host-adapters\/|theme\/)/.test(entry.path));
    }
    const vendor = first.manifest.files.filter(({ path }) => path.startsWith('src/media/vendor/tinymce/'));
    assert.equal(vendor.length, 33);
    const notice = vendor.find(({ path }) => path.endsWith('/notices.txt'));
    assert.equal(notice.bytes, 471);
    assert.equal(notice.sha256, '998c28e80bb7ffcd8c0b96d6f1bc2be79742929281b8259750613dac7376281e');
    const audit = auditDistribution({ manifest: join(first.output, 'manifest.json') });
    assert.equal(audit.target, 'contributor-local');
    assert.equal(audit.integrity, 'all-declared-file-hashes-verified');
    assert.equal(audit.counts.files, CONTRIBUTOR_FILES.length);
    assert.equal(audit.scope.unlistedFiles, 'complete-inventory-verified-no-extras');
    assert.equal(audit.publicDistributionApproved, false);
    assert.equal(audit.rightsReviewed, false);
    assert.equal(audit.privacyCertified, false);
    assert.equal(audit.status, 'candidates-found');
    assert.ok(audit.counts.filesWithCandidates > 0);
    assert.ok(audit.findings.some(finding => finding.path === 'tests/admin-app.test.js'));
    assert.ok(audit.findings.some(finding => finding.path === 'scripts/audit-distribution.js'));
    assert.ok(!audit.counts.byCategory['outside-core-scope']);
    console.log('ok - contributor full-manifest candidate audit: exact inventory/hashes, fixtures/rules not exempted, approvals false');
    // Fixtures and audit rules are intentionally retained, never exempted from
    // a future candidate scan simply because their paths are on the allowlist.
    for (const name of ['scripts/audit-distribution.js', 'tests/distribution-audit.test.js', 'tests/admin-app.test.js', 'src/libraries/minijoomla/infrastructure/spmiddle-test-schemas.js']) assert.ok(CONTRIBUTOR_FILES.includes(name));
    console.log(`ok - contributor exact allowlist: ${first.manifest.files.length} files, ${first.manifest.files.reduce((sum, entry) => sum + entry.bytes, 0)} bytes; deterministic hashes/false approvals; 33 unchanged vendor files`);

    assert.throws(() => stageContributor({ output: first.output }), /destination-exists/);
    assert.throws(() => stageContributor({ output: join(PROJECT, 'tmp') }), /tmp-descendant/);
    if (process.platform === 'win32') {
      assert.throws(() => stageContributor({ output: join(PROJECT, 'TMP') }), /tmp-descendant/);
      assert.throws(() => stageContributor({ output: join(base, 'alias-source'), sourceRoot: join(PROJECT, 'TMP') }), /fixture-root/);
      assert.throws(() => auditDistribution({ manifest: join(PROJECT, 'TMP', 'manifest.json') }), /audit-manifest/);
    }
    for (const output of [dirname(PROJECT), join(PROJECT, 'tmp-other', 'stage'), 'tmp/../outside', 'tmp/name:stream', 'tmp/NUL', 'tmp/alias.', 'https://example.invalid/stage', '\\\\server\\share\\stage', '']) assert.throws(() => stageContributor({ output }), /contributor-output/);
    assert.throws(() => stageContributor({ output: join(base, 'outside-source'), sourceRoot: dirname(PROJECT) }), /fixture-root/);
    assert.throws(() => stageContributor({ output: join(base, 'missing-source'), sourceRoot: join(base, 'absent') }), /source-root/);
    put(join(first.output, 'extra.js'), 'synthetic only');
    assert.throws(() => verifyContributorStage({ output: first.output }), /unmanifested/);
    assert.throws(() => auditDistribution({ manifest: join(first.output, 'manifest.json') }), /audit-contributor-selection-or-inventory-invalid/);
    rmSync(join(first.output, 'extra.js'));
    mkdirSync(join(first.output, 'extra-empty-directory'));
    assert.throws(() => verifyContributorStage({ output: first.output }), /unmanifested/);
    rmSync(join(first.output, 'extra-empty-directory'), { recursive: true });
    put(join(first.output, 'README.md'), 'synthetic modification');
    assert.throws(() => verifyContributorStage({ output: first.output }), /integrity-mismatch/);
    assert.throws(() => auditDistribution({ manifest: join(first.output, 'manifest.json') }), /audit-file-integrity-failed/);
    cpSync(join(PROJECT, 'README.md'), join(first.output, 'README.md'));
    const changed = { ...first.manifest, privacyApproved: true };
    put(join(first.output, 'manifest.json'), `${JSON.stringify(changed, null, 2)}\n`);
    assert.throws(() => verifyContributorStage({ output: first.output }), /integrity-mismatch/);
    assert.throws(() => auditDistribution({ manifest: join(first.output, 'manifest.json') }), /audit-core-manifest-schema-invalid/);
    cpSync(join(second.output, 'manifest.json'), join(first.output, 'manifest.json'));
    assert.deepEqual(verifyContributorStage({ output: first.output }), first.manifest);
    const outsideSelection = structuredClone(first.manifest);
    outsideSelection.files[0].path = 'tmp/missing-evidence.js';
    put(join(first.output, 'manifest.json'), `${JSON.stringify(outsideSelection, null, 2)}\n`);
    assert.throws(() => auditDistribution({ manifest: join(first.output, 'manifest.json') }), /audit-contributor-selection-or-inventory-invalid/, 'Reject unselected nonexistent paths before reading');
    cpSync(join(second.output, 'manifest.json'), join(first.output, 'manifest.json'));
    const auditCLI = spawnSync(process.execPath, [join(PROJECT, 'scripts/audit-distribution.js'), '--manifest', join(first.output, 'manifest.json')], { cwd: PROJECT, encoding: 'utf8', timeout: 30000 });
    assert.ifError(auditCLI.error); assert.equal(auditCLI.status, 1);
    assert.deepEqual(JSON.parse(auditCLI.stdout), audit);
    assert.doesNotMatch(auditCLI.stdout, /PROJETOS[\\/]|Users[\\/]|Bearer[ \t]+[a-z0-9._~+/-]{12}/i);

    const source = join(base, 'fixture');
    for (const name of CONTRIBUTOR_FILES) { mkdirSync(dirname(join(source, name)), { recursive: true }); cpSync(join(PROJECT, name), join(source, name)); }
    for (const name of ['src/unlisted.js', 'src/private.json', '.git/config', 'tmp/evidence.js', 'host-adapters/deployment.html', 'docs/PLANO-MINIJOOMLA.md']) put(join(source, name), 'synthetic excluded content');
    const fixture = stageContributor({ output: join(base, 'fixture-stage'), sourceRoot: source });
    assert.deepEqual(fixture.manifest, first.manifest, 'Unlisted source additions cannot enter selection');
    rmSync(join(source, 'README.md'));
    assert.throws(() => stageContributor({ output: join(base, 'missing-file'), sourceRoot: source }), /selected-file/);
    assert.ok(!existsSync(join(base, 'missing-file')));
    linkSync(join(source, 'LICENSE.md'), join(source, 'README.md'));
    assert.throws(() => stageContributor({ output: join(base, 'hardlink'), sourceRoot: source }), /hardlinks/);
    rmSync(join(source, 'README.md'));
    if (tryLink(join(source, 'missing-target'), join(source, 'README.md'), 'file')) {
      assert.throws(() => stageContributor({ output: join(base, 'dangling'), sourceRoot: source }), /links-not-allowed/);
      rmSync(join(source, 'README.md')); checkedLinks += 1;
    }
    cpSync(join(PROJECT, 'README.md'), join(source, 'README.md'));
    const linkedRoot = join(base, 'linked-root');
    if (tryLink(source, linkedRoot, 'junction')) {
      assert.throws(() => stageContributor({ output: join(base, 'linked-source'), sourceRoot: linkedRoot }), /links-not-allowed/);
      assert.throws(() => stageContributor({ output: join(linkedRoot, 'new-output') }), /links-not-allowed/);
      rmSync(linkedRoot); checkedLinks += 2;
    }
    const linkedStage = join(second.output, 'extra-link');
    if (tryLink(source, linkedStage, 'junction')) {
      assert.throws(() => verifyContributorStage({ output: second.output }), /links-not-allowed/);
      rmSync(linkedStage); checkedLinks += 1;
    }
    const nestedStage = join(source, 'tmp', 'nested-stage');
    assert.throws(() => stageContributor({ output: nestedStage, sourceRoot: source }), /overlap/);
    for (const args of [[], ['--output'], ['--output', 'tmp/new', '--output', 'tmp/other'], ['--sourceRoot', source], ['--output', first.output]]) {
      const rejected = cli(...args); assert.ifError(rejected.error); assert.equal(rejected.status, 1);
      assert.doesNotMatch(rejected.stderr, /Users[\\/]|PROJETOS[\\/]|synthetic excluded/);
    }
    const successful = cli('--output', join('tmp', basename(base), 'cli-stage'));
    assert.ifError(successful.error); assert.equal(successful.status, 0, successful.stderr);
    assert.deepEqual(verifyContributorStage({ output: join(base, 'cli-stage') }), first.manifest);
    console.log(`ok - contributor immutable/containment/inventory/CLI gates; ${checkedLinks} link checks, ${unavailableLinks} link creations unavailable`);
    if (commands) {
      await workflow(second.output);
      assert.deepEqual(verifyContributorStage({ output: second.output }), second.manifest, 'Commands leave selected source files intact after test-owned tmp cleanup');
    }
  } finally { rmSync(base, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runContributorStageTests({ commands: true }).catch((error) => { console.error(error); process.exitCode = 1; });
}
