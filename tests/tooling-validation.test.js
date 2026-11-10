import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(PROJECT, 'tmp');
const OWNED_PREFIXES = ['tooling-validation-', 'distribution-audit-test-', 'contributor-agent-', 'test-runner-', 'release-core-test-'];
const within = (root, path) => {
  const name = relative(root, path);
  return name === '' || (name !== '..' && !name.startsWith(`..${sep}`) && !isAbsolute(name));
};

/** Only an invocation's direct mkdtemp child, never tmp/workspaces globally. */
export function removeTestDirectory(base, { remove = rmSync } = {}) {
  const path = resolve(base);
  assert.equal(dirname(path), TMP, 'Cleanup requires a direct project tmp child');
  assert.ok(OWNED_PREFIXES.some(prefix => basename(path).startsWith(prefix)), 'Cleanup requires a test-owned prefix');
  for (let current = path; within(TMP, current); current = dirname(current)) {
    let stat;
    try { stat = lstatSync(current); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    assert.ok(!stat.isSymbolicLink(), 'Cleanup root/parent must not be a link');
  }
  // Node retries ENOTEMPTY/EBUSY/EPERM on Windows with linear backoff. Four
  // retries add at most 1 second per affected operation, then propagate failure.
  remove(path, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}

/** Copy only ordinary files/directories; reject junctions before descending. */
export function copyTestTree(source, destination) {
  const stat = lstatSync(source);
  assert.ok(!stat.isSymbolicLink(), 'Test fixture copy must not follow links/junctions');
  if (stat.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source).sort()) copyTestTree(join(source, name), join(destination, name));
  } else {
    assert.ok(stat.isFile(), 'Test fixture source must be regular');
    assert.equal(stat.nlink, 1, 'Test fixture source must not be hardlinked');
    mkdirSync(dirname(destination), { recursive: true });
    // cpSync performs another recursive-style metadata traversal per file on
    // Windows. Links/hardlinks were already rejected above; copy the regular
    // file directly and exclusively instead of silently overwriting a fixture.
    copyFileSync(source, destination, constants.COPYFILE_EXCL);
  }
}

export async function runToolingValidationTests() {
  mkdirSync(TMP, { recursive: true });
  const base = mkdtempSync(join(TMP, 'tooling-validation-'));
  const put = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
  try {
    const fixture = join(base, 'checkout');
    put(join(fixture, 'package.json'), '{"type":"module","scripts":{"check":"node scripts/check-syntax.js"}}');
    for (const directory of ['src', 'tests', 'examples', 'scripts']) mkdirSync(join(fixture, directory), { recursive: true });
    copyTestTree(join(PROJECT, 'scripts/check-syntax.js'), join(fixture, 'scripts/check-syntax.js'));
    // Evaluation would fail/create a file. A syntax gate must do neither.
    put(join(fixture, 'src/valid.js'), "import './missing-runtime-import.js'; throw new Error('must not evaluate');");
    put(join(fixture, 'scripts/valid.mjs'), "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('../evaluated.txt', import.meta.url), 'wrong');");
    put(join(fixture, 'scripts/nested/valid.js'), 'export const value = 1;');
    put(join(fixture, 'tmp/ignored.js'), 'export const = ;');
    const run = () => spawnSync(process.execPath, [join(fixture, 'scripts/check-syntax.js')], { cwd: base, encoding: 'utf8', timeout: 15000 });
    const clean = run();
    assert.ifError(clean.error);
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /Syntax OK: 4 JavaScript files/);
    assert.match(clean.stdout, /scripts; \.js\/\.mjs; parse only/);
    assert.ok(!existsSync(join(fixture, 'evaluated.txt')));
    for (const name of ['src/broken.js', 'tests/broken.mjs', 'examples/broken.js', 'scripts/nested/broken.js', 'scripts/broken.mjs']) {
      put(join(fixture, name), 'export const broken = ;');
      const broken = run();
      assert.ifError(broken.error);
      assert.equal(broken.status, 1, name);
      assert.match(broken.stderr, /SyntaxError/);
      assert.ok(!broken.stdout.includes('Syntax OK:'), 'Never print success for a failed parse');
      rmSync(join(fixture, name));
    }
    // Missing imports still fail when actually evaluated; syntax did not certify
    // them or transform them into an optional-integration skip.
    const missing = spawnSync(process.execPath, [join(fixture, 'src/valid.js')], { encoding: 'utf8', timeout: 10000 });
    assert.ifError(missing.error);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /ERR_MODULE_NOT_FOUND/);
    const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../scripts/check-syntax.js', import.meta.url).href)});`], { cwd: base, encoding: 'utf8', timeout: 10000 });
    assert.ifError(imported.error);
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, '', 'Importing the checker must not start checking');

    let cleanupCalls = 0;
    removeTestDirectory(base, { remove(path, options) {
      cleanupCalls += 1;
      assert.equal(path, base);
      assert.deepEqual(options, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
    } });
    assert.equal(cleanupCalls, 1);
    for (const path of [PROJECT, TMP, dirname(PROJECT), join(TMP, 'unrelated-stage'), join(base, 'child')]) assert.throws(() => removeTestDirectory(path, { remove() { assert.fail('Unsafe cleanup invoked'); } }));
    const persistent = Object.assign(new Error('synthetic busy cleanup'), { code: 'ENOTEMPTY' });
    assert.throws(() => removeTestDirectory(base, { remove() { throw persistent; } }), error => error === persistent, 'Exhausted cleanup must not be hidden');
    const source = join(base, 'copy-source');
    put(join(source, 'value.js'), 'export const value = 1;');
    put(join(source, 'nested/value.mjs'), 'export const value = 2;');
    const ordinaryCopy = join(base, 'ordinary-copy');
    copyTestTree(source, ordinaryCopy);
    for (const name of ['value.js', 'nested/value.mjs']) assert.deepEqual(readFileSync(join(ordinaryCopy, name)), readFileSync(join(source, name)));
    assert.throws(() => copyTestTree(join(source, 'value.js'), join(ordinaryCopy, 'value.js')), error => error.code === 'EEXIST', 'Fixture copying must not overwrite files');
    const link = join(source, 'cycle');
    let linked = false;
    try { symlinkSync(source, link, process.platform === 'win32' ? 'junction' : 'dir'); linked = true; }
    catch (error) { if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; }
    if (linked) {
      try { assert.throws(() => copyTestTree(source, join(base, 'copy-target')), /must not follow links/); }
      finally { rmSync(link); }
      assert.equal(readFileSync(join(source, 'value.js'), 'utf8'), 'export const value = 1;');
      const nestedLink = join(fixture, 'scripts/cycle');
      symlinkSync(fixture, nestedLink, process.platform === 'win32' ? 'junction' : 'dir');
      try {
        const rejected = run();
        assert.ifError(rejected.error);
        assert.equal(rejected.status, 1);
        assert.match(rejected.stderr, /check-syntax-links-not-allowed/);
        assert.ok(!rejected.stdout.includes('Syntax OK:'));
      } finally { rmSync(nestedLink); }
    }
    console.log('ok - tooling validation: JS/MJS in src/tests/examples/scripts, parse errors visible, no evaluation/import certification, bounded test-owned cleanup and junction rejection');
  } finally { removeTestDirectory(base); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runToolingValidationTests().catch(error => { console.error(error); process.exitCode = 1; });
}
