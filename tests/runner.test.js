import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { TEST_SUITES, runTestSuites } from './run-tests.js';
import { CONTRIBUTOR_FILES } from '../scripts/stage-contributor.js';
import { copyTestTree, removeTestDirectory } from './tooling-validation.test.js';

const PROJECT = fileURLToPath(new URL('../', import.meta.url));
const OPTIONAL_FILES = [
  'admin-joomla-forms.test.js', 'admin-integrity.test.js', 'admin-extensions-service.test.js',
  'admin-extensions-app.test.js', 'spmiddle-integration.test.js',
  'site-runtime.test.js', 'component-options-runtime.test.js',
  'schema-migration.test.js', 'entity-contracts-final.test.js', 'plugin-group-storage.test.js', 'joomla-pilot-lifecycle.test.js',
  'admin-plugins-runtime.test.js', 'provisioning-model.test.js', 'query-options-main-spmiddle.test.js',
  'sharepoint-installation.test.js', 'generic-installation-package.test.js', 'generic-installation-host.test.js', 'installation-zip.test.js', 'installed-template-params-spmiddle.test.js', 'operational-upgrade-stage.test.js'
];

function put(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function runIsolated(project, files) {
  // Exercise real manifest/sources. Exclude this suite to prevent recursion;
  // negative regressions may select only the affected suites and continuations.
  const label = files ? 'negative regression' : 'complete standalone';
  // A measured full child passed in 273425ms on this Windows host (contributor
  // 179882ms, release-stage 45964ms), exceeding the previous 240s budget without
  // leaking. Keep a bounded 600s full budget, 60s for focused negatives, and
  // suite-duration checkpoints rather than turning timeouts into optional skips.
  const timeout = files ? 60000 : 600000;
  console.log(`checkpoint - runner ${label} child started; budget ${timeout / 1000}s`);
  const start = performance.now();
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { TEST_SUITES, runTestSuites } from './tests/run-tests.js';
    const files = ${JSON.stringify(files ?? null)};
    let previous = performance.now();
    const report = message => {
      console.log(message);
      const file = /^(?:ok - suite |not ok - suite |SKIP - )([^ :]+)/.exec(message)?.[1];
      if (file && TEST_SUITES.some(suite => suite.file === file)) {
        const now = performance.now();
        console.log('checkpoint - child suite ' + file + ' elapsed_ms ' + Math.round(now - previous));
        previous = now;
      }
    };
    runTestSuites({ suites: TEST_SUITES.filter(suite => suite.file !== 'runner.test.js' && (!files || files.includes(suite.file))), report })
      .catch(error => { console.error(error); process.exitCode = 1; });
  `], { cwd: project, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
  const duration = Math.round(performance.now() - start);
  console.log(`checkpoint - runner ${label} child finished: ${duration}ms; status ${result.status}; error ${result.error?.code ?? 'none'}`);
  const checkpoints = (result.stdout ?? '').split(/\r?\n/).filter(line => /^checkpoint - child suite [a-z0-9.-]+ elapsed_ms \d+$/.test(line));
  // Never print raw stderr/fixture values for timeout diagnostics. Show the last
  // completed suite labels, plus costly checkpoints, even on ETIMEDOUT.
  const detail = result.error ? checkpoints.slice(-10) : checkpoints.filter(line => Number(line.split(' ').at(-1)) >= 2000);
  for (const checkpoint of detail) console.log(checkpoint);
  const contributorCheckpoints = (result.stdout ?? '').split(/\r?\n/).filter(line => /^checkpoint - contributor [A-Za-z -]+: \d+ms; total \d+ms$/.test(line));
  for (const checkpoint of contributorCheckpoints.slice(-6)) console.log(checkpoint);
  return result;
}

// Default coverage includes the entire standalone checkout. Focal negatives
// can be run while core integration is underway without claiming a full pass.
export async function runRunnerTests({ completeStandalone = true } = {}) {
  assert.deepEqual(TEST_SUITES.filter((suite) => suite.requiresSPMiddle).map((suite) => suite.file).sort(), [...OPTIONAL_FILES].sort());
  assert.equal(new Set(TEST_SUITES.map((suite) => suite.file)).size, TEST_SUITES.length);
  // These DOM helpers are exercised by registered suites/browser fixtures, not
  // independent Node suites. Everything else must be registered explicitly.
  const helpers = ['admin-errors-dom.test.js', 'admin-layout-dom.test.js', 'admin-management-dom.test.js', 'final-acceptance-dom.test.js'];
  const discovered = readdirSync(join(PROJECT, 'tests')).filter(file => file.endsWith('.test.js'));
  assert.deepEqual(discovered.filter(file => !TEST_SUITES.some(suite => suite.file === file)).sort(), [...helpers].sort(), 'No unregistered test suites except explicit DOM helpers');
  for (const suite of TEST_SUITES) {
    assert.ok(existsSync(join(PROJECT, 'tests', suite.file)), `Declared suite must exist: ${suite.file}`);
    assert.match(readFileSync(join(PROJECT, 'tests', suite.file), 'utf8'), new RegExp(`export (?:(?:async )?function ${suite.entryPoint}\\b|\\{\\s*${suite.entryPoint}\\s*\\} from )`), `Declared entry point must be exported: ${suite.file}`);
  }
  for (const file of ['scripts/prepare-videoteca-adaptation.js', 'tests/videoteca-adaptation.test.js', 'scripts/prepare-forum-adaptation.js', 'tests/forum-adaptation.test.js']) {
    assert.ok(!CONTRIBUTOR_FILES.includes(file), 'TD-specific sources must not enter generic contributor selection');
    assert.ok(!existsSync(join(PROJECT, file)), 'TD-specific source belongs in TD, not MINIJOOMLA');
  }
  assert.ok(!TEST_SUITES.some(suite => /camap-v3|camapv3|videoteca|forum/.test(suite.file)), 'TD-specific and experimental suites must not execute');
  assert.ok(!CONTRIBUTOR_FILES.some(file => /camap-v3|camapv3/.test(file)), 'Suspended CAMAPv3 sources must not enter contributor selection');
  for (const file of ['spmiddle-adapter.test.js', 'spmiddle-error-translation.test.js', 'standalone-examples.test.js', 'query-options-main-regression.test.js', 'extension-migration-plan.test.js', 'tooling-validation.test.js']) {
    assert.equal(TEST_SUITES.find((suite) => suite.file === file).requiresSPMiddle, false);
  }

  const tmp = join(PROJECT, 'tmp');
  mkdirSync(tmp, { recursive: true });
  const base = mkdtempSync(join(tmp, 'test-runner-'));
  try {
    const project = join(base, 'standalone', 'MINIJOOMLA');
    mkdirSync(project, { recursive: true });
    // The same reviewed exact paths as contributor staging: no recursive source
    // discovery, suspended fixtures, tmp, siblings or omissions of script deps.
    for (const file of CONTRIBUTOR_FILES) copyTestTree(join(PROJECT, file), join(project, file));
    for (const suite of TEST_SUITES) assert.ok(CONTRIBUTOR_FILES.includes(`tests/${suite.file}`), `Standalone selection must include ${suite.file}`);
    const coreCount = TEST_SUITES.length - OPTIONAL_FILES.length - 1;
    if (completeStandalone) {
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
    }

    // Break a core import only in our copy and check the real process exit.
    put(join(project, 'tests', 'core.test.js'), "import './missing-core.js'; export function runTests() {}");
    const brokenCore = runIsolated(project, ['core.test.js', 'spmiddle-error-translation.test.js', ...OPTIONAL_FILES]);
    assert.ifError(brokenCore.error);
    assert.equal(brokenCore.status, 1, brokenCore.stdout + brokenCore.stderr);
    assert.ok(brokenCore.stdout.includes(`Suites: 1 passed, ${OPTIONAL_FILES.length} skipped, 1 failed`), brokenCore.stdout);
    assert.ok(brokenCore.stdout.includes('not ok - suite core.test.js:'));
    assert.ok(brokenCore.stdout.includes('ok - suite spmiddle-error-translation.test.js (core/local)'));
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
    console.log(`ok - missing actual example entry fails the core/local suite and process despite ${OPTIONAL_FILES.length} optional integration skips`);

    // An empty sibling is deliberately broken, not a middleware implementation.
    // All real integration imports must fail, rather than be skipped.
    mkdirSync(join(base, 'standalone', 'SPMIDDLE'));
    const partial = runIsolated(project, ['spmiddle-error-translation.test.js', ...OPTIONAL_FILES]);
    assert.ifError(partial.error);
    assert.equal(partial.status, 1, partial.stdout + partial.stderr);
    assert.ok(partial.stdout.includes(`Suites: 1 passed, 0 skipped, ${OPTIONAL_FILES.length} failed`), partial.stdout);
    assert.doesNotMatch(partial.stdout, /^SKIP - /m);
    for (const file of OPTIONAL_FILES) assert.ok(partial.stdout.includes(`not ok - suite ${file}:`));
    console.log(`ok - partial SPMIDDLE checkout fails all ${OPTIONAL_FILES.length} real integration suites with nonzero exit`);

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
    removeTestDirectory(base);
  }
}
