import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LAYOUT_WIDTHS, KEYBOARD_CHECKS, MOBILE_KEYBOARD_CHECKS, parseLayoutArgs, layoutRpc, runLayoutKeyboard, validateKeyboardResult, validateLayoutResult } from '../scripts/test-admin-layout.js';

export async function runAdminLayoutRunnerTests() {
  assert.deepEqual(LAYOUT_WIDTHS, [320, 768, 769, 900, 1366, 1920, 2560]);
  assert.ok(Object.isFrozen(LAYOUT_WIDTHS));
  assert.deepEqual(parseLayoutArgs(['--agent', 'path with spaces/FioriAgent.exe']), { agent: resolve('path with spaces/FioriAgent.exe') });
  for (const args of [[], ['--agent'], ['--url', 'https://example.invalid'], ['--agent', 'node.exe'], ['--agent', 'OtherFioriAgent.exe'], ['--agent', '\\\\server\\share\\FioriAgent.exe'], ['--agent', 'FioriAgent.exe', '--attach', 'existing']]) {
    assert.throws(() => parseLayoutArgs(args), /Usage:/);
  }
  const script = fileURLToPath(new URL('../scripts/test-admin-layout.js', import.meta.url));
  const importOnly = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../scripts/test-admin-layout.js', import.meta.url).href)})`], { encoding: 'utf8', timeout: 10000 });
  assert.equal(importOnly.status, 0, importOnly.stderr);
  assert.equal(importOnly.stdout, '');
  const invalidCli = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 10000 });
  assert.equal(invalidCli.status, 1);
  assert.doesNotMatch(invalidCli.stderr, /sessionId|Users[\\/]|https:/);

  const checks = [{ name: 'synthetic-contract', ok: true }];
  const group = () => ({ success: true, checks: structuredClone(checks) });
  const keyboardGroup = (width) => ({ success: true, width, nativeKeys: true, mobileApplicable: width <= 768,
    checks: [...KEYBOARD_CHECKS, ...(width <= 768 ? MOBILE_KEYBOARD_CHECKS : ['mobile-menu-not-applicable'])].map((name) => ({ name, ok: true })) });
  const valid = {
    ...group(), width: 320, list: group(), overview: group(),
    fixture: { success: true, list: group(), overview: group(), titleSemantics: true, compactShortRow: true },
    localSyntheticOnly: true, tenantWrites: false, richEditorTested: false, integralVisualAcceptance: false, keyboard: keyboardGroup(320)
  };
  for (const name of ['negative-action-control-detected', 'negative-icon-control-detected', 'negative-fixture-rejected', 'fixture-recovers-after-negative-control']) valid.checks.push({ name, ok: true });
  assert.equal(validateLayoutResult(valid, 320), valid);
  for (const change of [
    (r) => { r.success = false; }, (r) => { r.width = 768; }, (r) => { r.tenantWrites = true; },
    (r) => { r.integralVisualAcceptance = true; }, (r) => { r.richEditorTested = true; },
    (r) => { r.list.checks = []; }, (r) => { r.overview.success = false; },
    (r) => { r.fixture.list.checks[0].ok = false; }, (r) => { r.fixture.titleSemantics = false; },
    (r) => { r.fixture.compactShortRow = false; }, (r) => { r.checks.pop(); },
    (r) => { delete r.keyboard; }, (r) => { r.keyboard.success = false; },
    (r) => { r.keyboard.nativeKeys = false; }, (r) => { r.keyboard.width = 768; },
    (r) => { r.keyboard.mobileApplicable = false; }, (r) => { r.keyboard.checks = []; }
  ]) {
    const broken = structuredClone(valid); change(broken);
    assert.throws(() => validateLayoutResult(broken, 320));
  }
  for (const name of [...KEYBOARD_CHECKS, ...MOBILE_KEYBOARD_CHECKS]) {
    for (const remove of [true, false]) {
      const broken = structuredClone(valid);
      if (remove) broken.keyboard.checks = broken.keyboard.checks.filter((check) => check.name !== name);
      else broken.keyboard.checks.find((check) => check.name === name).ok = false;
      assert.throws(() => validateLayoutResult(broken, 320));
    }
  }
  for (const width of LAYOUT_WIDTHS) assert.equal(validateKeyboardResult(keyboardGroup(width), width).success, true);
  const legacy = structuredClone(valid); delete legacy.keyboard;
  assert.throws(() => validateLayoutResult(legacy, 320), /keyboard/); // old reports are not new keyboard acceptance

  // Orchestration/compatibility fixture only: never native browser evidence.
  // Proves exact pressKey params, positive/negative gates and cleanup-on-fail.
  async function keyboardTransport(width, fault) {
    const calls = [], keys = [];
    let scenario, finished = false;
    const safety = ['keyboard-no-submits', 'keyboard-no-write-attempts', 'keyboard-in-memory-data-unchanged'];
    const stages = {
      'title-tab': ['title-tab-trusted', 'title-tab-focus'],
      'title-enter': ['title-enter-trusted', 'title-enter-correct-form'],
      'menu-enter': ['menu-enter-trusted', 'menu-enter-open'],
      'menu-tab-brand': ['menu-tab-brand-trusted', 'menu-tab-brand-focus'],
      'menu-tab-sidebar': ['menu-tab-sidebar-trusted', 'menu-tab-sidebar-focus'],
      'menu-escape': ['menu-escape-trusted', 'menu-escape-closed', 'menu-escape-toggle-focus']
    };
    const evaluate = async (call) => {
      calls.push(call);
      if (call === 'suite.finishKeyboard()') { finished = true; return fault === 'cleanup-missing' ? undefined : { finished: fault !== 'cleanup-fails' }; }
      if (call === 'suite.keyboardTarget()') return { success: fault !== 'target', width };
      const [, operation, value] = call.match(/^suite\.(prepareKeyboard|inspectKeyboard)\("([a-z-]+)"\)$/) ?? [];
      assert.ok(operation, call);
      if (operation === 'prepareKeyboard') {
        scenario = value; keys.length = 0;
        return fault === 'prepare-missing' ? undefined : { success: true, scenario, width };
      }
      let entries = [...stages[value], ...safety].map((name) => ({ name, ok: true }));
      let failed = keys.length === 0 ? 'title-tab-trusted'
        : scenario === 'title-tab-blocked' ? 'title-tab-focus'
        : scenario === 'title-enter-blocked' && value === 'title-enter' ? 'title-enter-correct-form'
        : scenario === 'menu-escape-blocked' && value === 'menu-escape' ? 'menu-escape-closed'
        : scenario === 'menu-focus-blocked' && value === 'menu-escape' ? 'menu-escape-toggle-focus' : null;
      if (fault === 'positive-fails' && !failed) failed = stages[value][0];
      if (fault === 'negative-passes' && failed) failed = null;
      if (failed) entries.find((check) => check.name === failed).ok = false;
      if (fault === 'checks-missing') entries = [];
      if (fault === 'writes') entries.find((check) => check.name === 'keyboard-no-write-attempts').ok = false;
      if (fault === 'mobile-result-missing' && scenario === 'menu' && value === 'menu-escape') return undefined;
      if (fault === 'mobile-negative-missing' && scenario === 'menu-focus-blocked' && value === 'menu-escape') entries = [];
      return { success: entries.every((check) => check.ok), checks: entries };
    };
    const rpc = async (method, params) => {
      assert.equal(method, 'fiori.pressKey');
      assert.deepEqual(Object.keys(params).sort(), ['key', 'sessionId']);
      assert.equal(params.sessionId, 'owned-fixture-session');
      keys.push(params.key); calls.push({ scenario, key: params.key });
      if (fault === 'rpc-rejects') throw new Error('fixture RPC rejection');
      return fault === 'press-missing' ? {} : { pressed: fault !== 'press-fails' };
    };
    try {
      const result = await runLayoutKeyboard({ rpc, evaluate, sessionId: 'owned-fixture-session', width });
      assert.equal(result.success, true);
      assert.deepEqual(calls.filter((call) => typeof call === 'object'), [
        { scenario: 'title', key: 'Tab' }, { scenario: 'title', key: 'Enter' },
        { scenario: 'title-tab-blocked', key: 'Tab' },
        { scenario: 'title-enter-blocked', key: 'Tab' }, { scenario: 'title-enter-blocked', key: 'Enter' },
        ...(width <= 768 ? ['menu', 'menu-escape-blocked', 'menu-focus-blocked'].flatMap((scenario) => ['Enter', 'Tab', 'Tab', 'Escape'].map((key) => ({ scenario, key }))) : [])
      ]);
      return result;
    } finally { assert.equal(finished, true); }
  }
  for (const width of LAYOUT_WIDTHS) await keyboardTransport(width);
  for (const fault of ['target', 'prepare-missing', 'positive-fails', 'negative-passes', 'checks-missing', 'writes', 'rpc-rejects', 'press-missing', 'press-fails', 'cleanup-missing', 'cleanup-fails', 'mobile-result-missing', 'mobile-negative-missing']) {
    await assert.rejects(keyboardTransport(320, fault));
  }
  await assert.rejects(runLayoutKeyboard({ sessionId: '', width: 320 }), /session/);

  // A transport-contract fixture, not a mocked browser/layout acceptance run.
  // No agent process, browser, tenant or profile is opened by npm test.
  let mode = 'ok', captured, requests = 0;
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    captured = { method: request.method, url: request.url, body: JSON.parse(raw) };
    requests += 1;
    response.writeHead(mode === 'http-fail' ? 503 : 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      jsonrpc: '2.0', id: mode === 'wrong-id' ? 'unrelated' : captured.body.id,
      result: { ok: mode !== 'reject', data: captured.body.method === 'fiori.pressKey'
        ? mode === 'press-missing' ? {} : { pressed: mode !== 'press-fails' }
        : { agentVersion: '0.3.3', edgeRunning: false } }
    }));
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  try {
    const port = server.address().port;
    assert.deepEqual(await layoutRpc(port, 'agent.ping'), { agentVersion: '0.3.3', edgeRunning: false });
    assert.deepEqual(captured, { method: 'POST', url: '/rpc', body: { jsonrpc: '2.0', id: 'minijoomla-local-layout', method: 'agent.ping', params: {} } });
    for (mode of ['http-fail', 'wrong-id', 'reject']) await assert.rejects(layoutRpc(port, 'agent.ping'));
    mode = 'ok';
    for (const key of ['Tab', 'Enter', 'Escape']) {
      assert.deepEqual(await layoutRpc(port, 'fiori.pressKey', { sessionId: 'owned-fixture-session', key }), { pressed: true });
      assert.deepEqual(captured.body.params, { sessionId: 'owned-fixture-session', key });
    }
    for (mode of ['press-missing', 'press-fails', 'reject']) await assert.rejects(layoutRpc(port, 'fiori.pressKey', { sessionId: 'owned-fixture-session', key: 'Tab' }));
    const beforeRejected = requests;
    for (const params of [{ key: 'Enter' }, { sessionId: '', key: 'Tab' }, { sessionId: '   ', key: 'Tab' },
      { sessionId: 'owned', key: 'Delete' }, { sessionId: 'owned', key: 'Tab', selector: { by: 'css', value: 'body' } },
      { sessionId: 'owned', key: 'Enter', timeout: 5000 }, { sessionId: 'owned' }]) {
      await assert.rejects(layoutRpc(port, 'fiori.pressKey', params), /explicit owned session/);
    }
    assert.equal(requests, beforeRejected);
    await assert.rejects(layoutRpc(0, 'agent.ping'), /Invalid RPC port/);
    await assert.rejects(layoutRpc(port, 'browser.navigate', { url: 'https://example.invalid' }), /Unsupported/);
    await assert.rejects(layoutRpc(port, 'browser.open'), /Unsupported/);
    for (const method of ['fiori.clickElement', 'fiori.fillField', 'fiori.attachSession', 'fiori.evaluate']) await assert.rejects(layoutRpc(port, method), /Unsupported/);
    await assert.rejects(layoutRpc(port, 'agent.startSession', { fioriUrl: 'https://example.invalid', headless: true }), /Only the headless/);
    const interrupted = new AbortController();
    interrupted.abort();
    await assert.rejects(layoutRpc(port, 'agent.ping', {}, interrupted.signal), (error) => error.name === 'AbortError');
  } finally { await new Promise((ok) => server.close(ok)); }

  const html = await readFile(new URL('./admin-layout.html', import.meta.url), 'utf8');
  const browser = await readFile(new URL('./admin-layout-browser.js', import.meta.url), 'utf8');
  assert.match(html, /\.\.\/src\/media\/templates\/administrator\/atum\/css\/template\.css/);
  assert.match(browser, /createDemoRepositories\(\{ storage: null \}\)/);
  assert.match(browser, /runAdminLayoutFixtureTests/);
  assert.match(browser, /event\.isTrusted/);
  assert.doesNotMatch(browser, /localStorage|sharepoint\.com|attachRichTextEditor|dispatchEvent|KeyboardEvent|\.click\(/);
  const runner = await readFile(new URL('../scripts/test-admin-layout.js', import.meta.url), 'utf8');
  assert.ok(runner.includes("join(process.env.SystemRoot || 'C:\\\\Windows', 'System32', name)"), 'Windows tools do not depend on PATH');
  assert.match(runner, /runFile\(windowsTool\('WindowsPowerShell\/v1\.0\/powershell\.exe'\)/);
  assert.match(runner, /runFile\(windowsTool\('taskkill\.exe'\)/);
  assert.match(runner, /catch\(error\)\{return \{__layoutError:/);
  assert.match(runner, /step: 'page-stop', success: ok/);
  assert.match(runner, /step: 'end-session', success: ok/);
  assert.match(runner, /step: 'owned-processes', success: true/);
  assert.doesNotMatch(runner, /report\.(?:failure|cleanup).*error\.message/);
  console.log('ok - native layout runner contracts: owned-session Tab/Enter/Escape, mandatory keyboard/negative results and cleanup; Node fixtures are not native acceptance');
}
