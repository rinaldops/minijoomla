import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { TEST_SUITES, runTestSuites } from './run-tests.js';

const PROJECT = fileURLToPath(new URL('../', import.meta.url));
const OPTIONAL_FILES = [
  'admin-joomla-forms.test.js', 'admin-integrity.test.js', 'admin-extensions-service.test.js',
  'admin-extensions-app.test.js', 'spmiddle-integration.test.js',
  'site-runtime.test.js', 'component-options-runtime.test.js',
  'schema-migration.test.js', 'entity-contracts-final.test.js', 'plugin-group-storage.test.js', 'joomla-pilot-lifecycle.test.js'
];

function put(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function runIsolated(project, files) {
  // Exercise the real suite manifest and sources; exclude only this regression
  // suite to prevent recursively copying/running another standalone fixture.
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { TEST_SUITES, runTestSuites } from './tests/run-tests.js';
    const selected = ${JSON.stringify(files ?? null)};
    runTestSuites({ suites: TEST_SUITES.filter(suite => suite.file !== 'runner.test.js' && (!selected || selected.includes(suite.file))) })
      .catch(error => { console.error(error); process.exitCode = 1; });
  `], { cwd: project, encoding: 'utf8', timeout: 600000, maxBuffer: 8 * 1024 * 1024 });
}

export async function runRunnerTests() {
  assert.deepEqual(TEST_SUITES.filter((suite) => suite.requiresSPMiddle).map((suite) => suite.file).sort(), [...OPTIONAL_FILES].sort());
  assert.equal(new Set(TEST_SUITES.map((suite) => suite.file)).size, TEST_SUITES.length);
  for (const file of ['spmiddle-adapter.test.js', 'spmiddle-error-translation.test.js', 'standalone-examples.test.js']) {
    assert.equal(TEST_SUITES.find((suite) => suite.file === file).requiresSPMiddle, false);
  }

  const tmp = join(PROJECT, 'tmp');
  mkdirSync(tmp, { recursive: true });
  const base = mkdtempSync(join(tmp, 'test-runner-'));
  try {
    const project = join(base, 'standalone', 'MINIJOOMLA');
    mkdirSync(project, { recursive: true });
    for (const directory of ['src', 'tests', 'examples']) cpSync(join(PROJECT, directory), join(project, directory), { recursive: true });
    cpSync(join(PROJECT, 'package.json'), join(project, 'package.json'));
    mkdirSync(join(project, 'scripts'), { recursive: true });
    cpSync(join(PROJECT, 'scripts', 'module-manifests.js'), join(project, 'scripts', 'module-manifests.js'));
    cpSync(join(PROJECT, 'scripts', 'generate-joomla-sampledata.js'), join(project, 'scripts', 'generate-joomla-sampledata.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-module-adoption.js'), join(project, 'scripts', 'prepare-module-adoption.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-editorial-adaptation.js'), join(project, 'scripts', 'prepare-editorial-adaptation.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-highlights-adaptation.js'), join(project, 'scripts', 'prepare-highlights-adaptation.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-topsections-adaptation.js'), join(project, 'scripts', 'prepare-topsections-adaptation.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-xml-module-group.js'), join(project, 'scripts', 'prepare-xml-module-group.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-hero-adaptation.js'), join(project, 'scripts', 'prepare-hero-adaptation.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-home-adaptation.js'), join(project, 'scripts', 'prepare-home-adaptation.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-recursos-adaptation.js'), join(project, 'scripts', 'prepare-recursos-adaptation.js'));
    cpSync(join(PROJECT, 'scripts', 'prepare-showcase-adaptation.js'), join(project, 'scripts', 'prepare-showcase-adaptation.js'));
    mkdirSync(join(project, 'docs'), { recursive: true });
    cpSync(join(PROJECT, 'docs', 'EXTENSOES-JOOMLA.md'), join(project, 'docs', 'EXTENSOES-JOOMLA.md'));
    cpSync(join(PROJECT, 'docs', 'ETAPA-1-SAMPLE-DATA.md'), join(project, 'docs', 'ETAPA-1-SAMPLE-DATA.md'));
    for (const file of ['.gitignore', '.gitattributes', 'scripts/check-syntax.js', 'scripts/stage-contributor.js', 'scripts/release-check.js', 'scripts/serve-local.js', 'scripts/test-standalone-examples.js', 'scripts/stage-release.js', 'scripts/audit-distribution.js', 'scripts/test-admin-layout.js', 'README.md', 'LICENSE.md', 'docs/ADMIN-LAYOUT-TESTS.md', 'docs/CONTRIBUTING.md', 'docs/CONTRIBUTOR-SELECTION.md', 'docs/SECURITY.md', 'docs/RELEASE-CORE.md', 'docs/LOCAL-DEMO.md', 'docs/THIRD-PARTY-NOTICES.md', 'docs/licenses/GPL-2.0.txt']) {
      mkdirSync(dirname(join(project, file)), { recursive: true });
      cpSync(join(PROJECT, file), join(project, file));
    }
    const coreCount = TEST_SUITES.length - OPTIONAL_FILES.length - 1;
    const absent = runIsolated(project);
    assert.ifError(absent.error);
    assert.equal(absent.status, 0, absent.stdout + absent.stderr);
    assert.equal((absent.stdout.match(/^SKIP - /gm) ?? []).length, OPTIONAL_FILES.length);
    assert.ok(absent.stdout.includes(`Suites: ${coreCount} passed, ${OPTIONAL_FILES.length} skipped, 0 failed`), absent.stdout);
    for (const file of OPTIONAL_FILES) assert.ok(absent.stdout.includes(`SKIP - ${file}:`));
    assert.ok(absent.stdout.includes('ok - suite spmiddle-adapter.test.js (core/local)'));
    assert.ok(absent.stdout.includes('ok - suite spmiddle-error-translation.test.js (core/local)'));
    assert.ok(absent.stdout.includes('ok - suite standalone-examples.test.js (core/local)'));
    console.log(`ok - actual standalone checkout: ${coreCount} core/local suites pass (including actual examples); ${OPTIONAL_FILES.length} visible integration skips`);

    // Break a core import only in our copy and check the real process exit.
    put(join(project, 'tests', 'core.test.js'), "import './missing-core.js'; export function runTests() {}");
    const brokenCore = runIsolated(project, ['core.test.js', 'spmiddle-error-translation.test.js', ...OPTIONAL_FILES]);
    assert.ifError(brokenCore.error);
    assert.equal(brokenCore.status, 1, brokenCore.stdout + brokenCore.stderr);
    assert.ok(brokenCore.stdout.includes(`Suites: 1 passed, ${OPTIONAL_FILES.length} skipped, 1 failed`), brokenCore.stdout);
    assert.ok(brokenCore.stdout.includes('not ok - suite core.test.js:'));
    cpSync(join(PROJECT, 'tests', 'core.test.js'), join(project, 'tests', 'core.test.js'));
    console.log('ok - missing core import in an actual standalone checkout exits nonzero despite optional integration skips');

    const example = join(project, 'examples', 'index.html');
    const originalExample = readFileSync(example, 'utf8');
    put(example, originalExample.replace("'../src/index.js'", "'../src/missing-example-entry.js'"));
    const brokenExample = runIsolated(project, ['serve-local.test.js', 'standalone-examples.test.js', 'spmiddle-error-translation.test.js', ...OPTIONAL_FILES]);
    assert.ifError(brokenExample.error);
    assert.equal(brokenExample.status, 1, brokenExample.stdout + brokenExample.stderr);
    // Static entrypoint serving and offline evaluation both detect this defect.
    assert.ok(brokenExample.stdout.includes(`Suites: 1 passed, ${OPTIONAL_FILES.length} skipped, 2 failed`), brokenExample.stdout);
    assert.ok(brokenExample.stdout.includes('not ok - suite serve-local.test.js:'));
    assert.ok(brokenExample.stdout.includes('not ok - suite standalone-examples.test.js:'));
    put(example, originalExample);
    console.log('ok - missing actual example entry fails the core/local suite and process despite optional integration skips');

    // An empty sibling is deliberately broken, not a middleware implementation.
    // All nine real integration imports must fail, rather than be skipped.
    mkdirSync(join(base, 'standalone', 'SPMIDDLE'));
    const partial = runIsolated(project, ['spmiddle-error-translation.test.js', ...OPTIONAL_FILES]);
    assert.ifError(partial.error);
    assert.equal(partial.status, 1, partial.stdout + partial.stderr);
    assert.ok(partial.stdout.includes(`Suites: 1 passed, 0 skipped, ${OPTIONAL_FILES.length} failed`), partial.stdout);
    assert.doesNotMatch(partial.stdout, /^SKIP - /m);
    for (const file of OPTIONAL_FILES) assert.ok(partial.stdout.includes(`not ok - suite ${file}:`));
    console.log('ok - partial SPMIDDLE checkout fails all installed integration suites with nonzero exit');

    // These tiny modules test runner scheduling/error propagation only. They do
    // not stand in for SPMIDDLE or claim to validate middleware behavior.
    const fixture = join(base, 'scheduling', 'MINIJOOMLA');
    const testPath = join(fixture, 'tests');
    const testsDirectory = pathToFileURL(testPath + '/');
    put(join(fixture, 'package.json'), '{"type":"module"}');
    put(join(testPath, 'pass.js'), 'export async function run() {}');
    put(join(testPath, 'optional.js'), 'export async function run() {}');
    put(join(testPath, 'import-error.js'), "import './missing-core.js'; export function run() {}");
    put(join(testPath, 'assertion-error.js'), "export function run() { throw new Error('synthetic assertion failure'); }");
    put(join(testPath, 'evaluation-error.js'), "throw new Error('synthetic import evaluation failure');");
    put(join(testPath, 'missing-export.js'), 'export const unrelated = true;');
    const suite = (file, requiresSPMiddle = false) => ({ file, entryPoint: 'run', requiresSPMiddle });
    const messages = [];
    const run = (suites) => runTestSuites({ suites, testsDirectory, report: (message) => messages.push(message) });

    assert.deepEqual(await run([suite('pass.js'), suite('evaluation-error.js', true)]), { passed: 1, skipped: 1, failed: 0 });
    await assert.rejects(run([suite('import-error.js'), suite('assertion-error.js'), suite('missing-export.js'), suite('pass.js')]), (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors.length, 3);
      assert.equal(error.errors[0].cause.code, 'ERR_MODULE_NOT_FOUND');
      assert.match(error.errors[1].cause.message, /synthetic assertion failure/);
      assert.ok(error.errors[2].cause instanceof TypeError);
      return true;
    });
    assert.equal(messages.at(-1), 'Suites: 1 passed, 0 skipped, 3 failed');

    const sibling = join(base, 'scheduling', 'SPMIDDLE');
    mkdirSync(sibling);
    assert.deepEqual(await run([suite('pass.js'), suite('optional.js', true)]), { passed: 2, skipped: 0, failed: 0 });
    await assert.rejects(run([suite('evaluation-error.js', true), suite('assertion-error.js', true), suite('pass.js')]), (error) => {
      assert.equal(error.errors.length, 2);
      assert.match(error.errors[0].cause.message, /synthetic import evaluation failure/);
      assert.match(error.errors[1].cause.message, /synthetic assertion failure/);
      return true;
    });
    assert.equal(messages.at(-1), 'Suites: 1 passed, 0 skipped, 2 failed');
    rmSync(sibling, { recursive: true });
    put(sibling, 'not a directory');
    await assert.rejects(run([suite('optional.js', true)]), /not a directory|ENOTDIR/);
    console.log('ok - runner never hides core imports, missing exports, or installed-integration failures; later suites still run');
  } finally {
    // Only this invocation's uniquely named temporary fixture is removed.
    rmSync(base, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}
