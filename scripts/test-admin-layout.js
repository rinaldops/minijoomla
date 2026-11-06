import { spawn, execFile } from 'node:child_process';
import { createServer as createPortProbe } from 'node:net';
import { mkdir, mkdtemp, lstat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createLocalDemoServer } from './serve-local.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LAYOUT_WIDTHS = Object.freeze([320, 768, 769, 900, 1366, 1920, 2560]);
export const KEYBOARD_CHECKS = Object.freeze([
  'title-tab-trusted', 'title-tab-focus', 'title-enter-trusted', 'title-enter-correct-form',
  'keyboard-no-submits', 'keyboard-no-write-attempts', 'keyboard-in-memory-data-unchanged',
  'negative-no-key-input-detected', 'negative-title-tab-detected', 'negative-title-enter-detected'
]);
export const MOBILE_KEYBOARD_CHECKS = Object.freeze([
  'menu-enter-trusted', 'menu-enter-open', 'menu-tab-brand-trusted', 'menu-tab-brand-focus',
  'menu-tab-sidebar-trusted', 'menu-tab-sidebar-focus', 'menu-escape-trusted',
  'menu-escape-closed', 'menu-escape-toggle-focus',
  'negative-menu-escape-detected', 'negative-menu-focus-return-detected'
]);

export function parseLayoutArgs(args) {
  if (args.length !== 2 || args[0] !== '--agent' || !args[1]
      || basename(args[1]).toLowerCase() !== 'fioriagent.exe'
      || /^(?:\\\\|\/\/|[a-z]+:\/\/)/i.test(args[1]) || /[\u0000-\u001f]/.test(args[1])) {
    throw new Error('Usage: node scripts/test-admin-layout.js --agent <path-to-FioriAgent.exe>');
  }
  return { agent: resolve(args[1]) };
}

// Exact FIORI-AUTO JSON-RPC contract, loopback only, never a direct browser/CDP
// connection. Do not include agent error text/session URLs in diagnostics.
export async function layoutRpc(port, method, params = {}, signal) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid RPC port');
  if (!['agent.ping', 'agent.startSession', 'browser.setViewport', 'browser.evaluate', 'fiori.pressKey', 'agent.endSession'].includes(method)) {
    throw new Error('Unsupported layout RPC method');
  }
  if (method === 'agent.startSession' && (!/^http:\/\/127\.0\.0\.1:\d+\/tests\/admin-layout\.html$/.test(params.fioriUrl ?? '') || params.headless !== true)) {
    throw new Error('Only the headless loopback layout page is allowed');
  }
  if (method === 'fiori.pressKey' && (typeof params.sessionId !== 'string' || !params.sessionId.trim()
      || !['Tab', 'Enter', 'Escape'].includes(params.key)
      || Object.keys(params).some((key) => !['sessionId', 'key'].includes(key)))) {
    throw new Error('Layout keys require an explicit owned session and Tab/Enter/Escape without selector');
  }
  const response = await fetch(`http://127.0.0.1:${port}/rpc`, {
    method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'minijoomla-local-layout', method, params })
  });
  if (!response.ok) throw new Error('Layout RPC HTTP failure');
  const envelope = await response.json();
  if (envelope.jsonrpc !== '2.0' || envelope.id !== 'minijoomla-local-layout' || envelope.result?.ok !== true) {
    const code = /^E_[A-Z_]+$/.test(envelope.result?.code ?? '') ? envelope.result.code : 'RPC_REJECTED';
    throw new Error(`Layout RPC rejected request (${method}: ${code})`);
  }
  if (method === 'fiori.pressKey' && envelope.result.data?.pressed !== true) throw new Error('Native key press failed or missing');
  return envelope.result.data;
}

function requireChecks(group, names, message) {
  if (group?.success !== true || !Array.isArray(group.checks) || !group.checks.length
      || group.checks.some((check) => check.ok !== true || typeof check.name !== 'string')
      || names.some((name) => !group.checks.some((check) => check.name === name && check.ok === true))) {
    throw new Error(message);
  }
}

export function validateKeyboardResult(result, width) {
  if (result?.width !== width || result.nativeKeys !== true || result.mobileApplicable !== (width <= 768)) {
    throw new Error('Native keyboard acceptance failed or missing');
  }
  requireChecks(result, [...KEYBOARD_CHECKS, ...(width <= 768 ? MOBILE_KEYBOARD_CHECKS : ['mobile-menu-not-applicable'])], 'Native keyboard checks failed or missing');
  return result;
}

// Injectable transport for Node contract tests only. In the native runner both
// callbacks are bound to its proven-owned session and exact loopback test page.
export async function runLayoutKeyboard({ rpc, evaluate, sessionId, width }) {
  if (typeof sessionId !== 'string' || !sessionId.trim() || !LAYOUT_WIDTHS.includes(width)) throw new Error('Invalid keyboard session/width');
  const checks = [];
  const safety = ['keyboard-no-submits', 'keyboard-no-write-attempts', 'keyboard-in-memory-data-unchanged'];
  const inspect = (stage) => evaluate(`suite.inspectKeyboard(${JSON.stringify(stage)})`);
  const prepare = async (scenario) => {
    const ready = await evaluate(`suite.prepareKeyboard(${JSON.stringify(scenario)})`);
    if (ready?.success !== true || ready.width !== width || ready.scenario !== scenario) throw new Error('Keyboard fixture preparation failed or missing');
  };
  const press = async (key) => {
    // Also check the guarded evaluate target immediately before every key.
    const target = await evaluate('suite.keyboardTarget()');
    if (target?.success !== true || target.width !== width) throw new Error('Keyboard target not ready');
    if ((await rpc('fiori.pressKey', { sessionId, key }))?.pressed !== true) throw new Error('Native key press failed or missing');
  };
  const positive = async (stage, names) => {
    const result = await inspect(stage);
    requireChecks(result, [...names, ...safety], 'Native keyboard stage failed or missing');
    checks.push(...result.checks);
  };
  const negative = async (stage, failedName, trustedName, name) => {
    const result = await inspect(stage);
    if (result?.success !== false || !Array.isArray(result.checks)
        || !result.checks.some((check) => check.name === failedName && check.ok === false)
        || [...safety, ...(trustedName ? [trustedName] : [])].some((required) => !result.checks.some((check) => check.name === required && check.ok === true))) {
      throw new Error('Keyboard negative control failed or missing');
    }
    checks.push({ name, ok: true });
  };
  try {
    await prepare('title');
    await negative('title-tab', 'title-tab-trusted', null, 'negative-no-key-input-detected');
    await press('Tab');
    await positive('title-tab', ['title-tab-trusted', 'title-tab-focus']);
    await press('Enter');
    await positive('title-enter', ['title-enter-trusted', 'title-enter-correct-form']);

    await prepare('title-tab-blocked');
    await press('Tab');
    await negative('title-tab', 'title-tab-focus', 'title-tab-trusted', 'negative-title-tab-detected');
    await prepare('title-enter-blocked');
    await press('Tab');
    await positive('title-tab', ['title-tab-trusted', 'title-tab-focus']);
    await press('Enter');
    await negative('title-enter', 'title-enter-correct-form', 'title-enter-trusted', 'negative-title-enter-detected');

    if (width <= 768) {
      for (const scenario of ['menu', 'menu-escape-blocked', 'menu-focus-blocked']) {
        await prepare(scenario);
        await press('Enter');
        await positive('menu-enter', ['menu-enter-trusted', 'menu-enter-open']);
        await press('Tab');
        await positive('menu-tab-brand', ['menu-tab-brand-trusted', 'menu-tab-brand-focus']);
        await press('Tab');
        await positive('menu-tab-sidebar', ['menu-tab-sidebar-trusted', 'menu-tab-sidebar-focus']);
        await press('Escape');
        if (scenario === 'menu') await positive('menu-escape', ['menu-escape-trusted', 'menu-escape-closed', 'menu-escape-toggle-focus']);
        else if (scenario === 'menu-escape-blocked') await negative('menu-escape', 'menu-escape-closed', 'menu-escape-trusted', 'negative-menu-escape-detected');
        else {
          const result = await inspect('menu-escape');
          if (!result?.checks?.some((check) => check.name === 'menu-escape-closed' && check.ok === true)) throw new Error('Focus negative control must still close menu');
          await negative('menu-escape', 'menu-escape-toggle-focus', 'menu-escape-trusted', 'negative-menu-focus-return-detected');
        }
      }
    } else checks.push({ name: 'mobile-menu-not-applicable', ok: true });
  } finally {
    if ((await evaluate('suite.finishKeyboard()'))?.finished !== true) throw new Error('Keyboard fixture cleanup failed or missing');
  }
  return validateKeyboardResult({ success: true, width, nativeKeys: true, mobileApplicable: width <= 768, checks }, width);
}

export function validateLayoutResult(result, width) {
  if (!result || result.success !== true || result.width !== width
      || result.localSyntheticOnly !== true || result.tenantWrites !== false
      || result.richEditorTested !== false || result.integralVisualAcceptance !== false) {
    throw new Error('Native layout acceptance failed');
  }
  for (const group of [result, result.list, result.overview, result.fixture?.list, result.fixture?.overview]) {
    if (group?.success !== true || !Array.isArray(group.checks) || !group.checks.length || group.checks.some((check) => check.ok !== true || typeof check.name !== 'string')) {
      throw new Error('Native layout checks failed or missing');
    }
  }
  if (result.fixture.success !== true || result.fixture.titleSemantics !== true || result.fixture.compactShortRow !== true) {
    throw new Error('Native layout fixture failed');
  }
  for (const name of ['negative-action-control-detected', 'negative-icon-control-detected', 'negative-fixture-rejected', 'fixture-recovers-after-negative-control']) {
    if (!result.checks.some((check) => check.name === name && check.ok)) throw new Error('Negative control was not executed');
  }
  validateKeyboardResult(result.keyboard, width);
  return result;
}

function safeFailure(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (error?.code === 'ENOENT' && /powershell\.exe/i.test(message)) return 'powershell-unavailable';
  if (/requires windows/i.test(message)) return 'windows-required';
  if (/timed? ?out|timeout/i.test(message)) return 'timeout';
  if (/abort|interrupt/i.test(message)) return 'interrupted';
  if (/not found|missing/i.test(message)) return 'missing';
  if (/reject|rpc|http/i.test(message)) return 'rpc-failed';
  if (/ownership|owned|profile|process|listener|port/i.test(message)) return 'ownership-or-process';
  if (/permission|access|denied/i.test(message)) return 'access-denied';
  return error?.name === 'TypeError' ? 'type-error' : 'operation-failed';
}

async function reservePort() {
  const probe = createPortProbe();
  await new Promise((ok, fail) => { probe.once('error', fail); probe.listen(0, '127.0.0.1', ok); });
  return probe;
}

const runFile = promisify(execFile);
const psQuote = (text) => `'${text.replaceAll("'", "''")}'`;
const windowsTool = (name) => join(process.env.SystemRoot || 'C:\\Windows', 'System32', name);
async function processInventory(profile, debugPort) {
  // OS metadata only, no browser/CDP controller. The unique profile is the
  // cleanup capability; never output other profiles, URLs or command lines.
  const command = `$ErrorActionPreference='Stop'; $owned=@(Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains(${psQuote(`--user-data-dir="${profile}"`)}) } | ForEach-Object { [PSCustomObject]@{ pid=[int]$_.ProcessId; parent=[int]$_.ParentProcessId; debug=$_.CommandLine.Contains(${psQuote(`--remote-debugging-port=${debugPort}`)}) } }); $listeners=@(Get-NetTCPConnection -State Listen -LocalPort ${debugPort} -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.OwningProcess }); [PSCustomObject]@{ processes=$owned; listeners=$listeners } | ConvertTo-Json -Depth 4 -Compress`;
  const { stdout } = await runFile(windowsTool('WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { timeout: 20000, windowsHide: true });
  return JSON.parse(stdout);
}

async function cleanupOwnedProcesses(child, profile, debugPort) {
  // Stop the known child even if CIM fails; also prevents a timed-out startup
  // RPC from creating Edge later while cleanup is scanning its profile.
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((ok) => child.once('exit', ok));
    child.kill();
    await Promise.race([exited, new Promise((_, fail) => { const timer = setTimeout(() => fail(new Error('Agent termination timed out')), 5000); timer.unref(); })]);
  }
  const owned = await processInventory(profile, debugPort);
  for (const item of owned.processes) {
    // Kill only roots bearing this invocation's fresh profile. Never kill a
    // listener just because it happens to occupy the requested debug port.
    if (item.debug) {
      try { await runFile(windowsTool('taskkill.exe'), ['/PID', String(item.pid), '/T', '/F'], { timeout: 15000, windowsHide: true }); }
      catch { /* Process may already have exited; verify inventory below. */ }
    }
  }
  if ((await processInventory(profile, debugPort)).processes.length) throw new Error('Owned browser processes remain');
}

function startAgent(agent, rpcPort, debugPort, profile, signal) {
  const child = spawn(agent, ['--port', String(rpcPort), '--debug-port', String(debugPort), '--user-data-dir', profile], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  // Wait for this child's listener-start message, not a possibly unrelated
  // service on the port. No raw process output retained (may contain URLs).
  child.stderr.resume();
  let output = '';
  const ready = new Promise((ok, fail) => {
    const timer = setTimeout(() => done(fail, new Error('FioriAgent startup timed out')), 30000);
    const done = (callback, value) => { clearTimeout(timer); child.stdout.off('data', data); child.off('error', error); child.off('exit', exit); signal.removeEventListener('abort', abort); callback(value); };
    const data = (chunk) => {
      output = (output + chunk.toString()).slice(-2048);
      if (output.includes(`[FioriAgent] v0.3.3 | port ${rpcPort} | cdp ${debugPort}`)) done(ok, child);
    };
    const error = () => done(fail, new Error('Unable to launch FioriAgent'));
    const exit = () => done(fail, new Error('FioriAgent exited before startup'));
    const abort = () => done(fail, new Error('FioriAgent startup interrupted'));
    child.stdout.on('data', data); child.once('error', error); child.once('exit', exit);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
  // Consume output after readiness too; otherwise a full pipe can block agent.
  ready.then(() => child.stdout.resume(), () => child.stdout.resume());
  return { child, ready };
}

export async function runAdminLayout({ agent }) {
  const tmp = join(PROJECT, 'tmp');
  await mkdir(tmp, { recursive: true });
  const output = await mkdtemp(join(tmp, 'admin-layout-'));
  const server = createLocalDemoServer();
  const reservations = [];
  let child, rpcPort, debugPort, sessionId, browserOwned = false;
  const profile = join(output, 'profile');
  const interruption = new AbortController();
  const rpc = (method, params = {}) => {
    if (method === 'fiori.pressKey' && (!browserOwned || !sessionId || params.sessionId !== sessionId)) throw new Error('Keyboard session ownership not established');
    return layoutRpc(rpcPort, method, params, interruption.signal);
  };
  const interrupt = () => interruption.abort();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  const results = [];
  const report = { success: false, scope: 'native-local-layout-only', engine: 'FIORI-AUTO', widths: LAYOUT_WIDTHS, results, publicationApproved: false, cleanup: [] };
  try {
    if (process.platform !== 'win32') throw new Error('FioriAgent native layout execution requires Windows');
    if (!(await lstat(agent)).isFile()) throw new Error('FioriAgent executable is missing');
    // Hold both reservations until spawn so the ports cannot coincide. The
    // child readiness message also catches another process winning the race.
    reservations.push(await reservePort());
    reservations.push(await reservePort());
    rpcPort = reservations[0].address().port;
    debugPort = reservations[1].address().port;
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
    const localPort = server.address().port;
    await new Promise((ok) => reservations[0].close(ok));
    const startup = startAgent(agent, rpcPort, debugPort, profile, interruption.signal);
    child = startup.child;
    await startup.ready;
    const ping = await rpc('agent.ping');
    if (ping?.agentVersion !== '0.3.3' || ping.edgeRunning !== false) throw new Error('Fresh isolated FioriAgent required');
    await new Promise((ok) => reservations[1].close(ok));
    interruption.signal.throwIfAborted();
    // Unlike browser.open, startSession does not navigate a reused existing
    // tab. If it launches a fresh Edge, only that process opens our local URL.
    // Prove profile/parent/listener ownership before evaluating any page.
    const opened = await rpc('agent.startSession', { fioriUrl: `http://127.0.0.1:${localPort}/tests/admin-layout.html`, headless: true });
    if (typeof opened?.sessionId !== 'string' || !opened.sessionId) throw new Error('FioriAgent did not return a session');
    const ownership = await processInventory(profile, debugPort);
    const root = ownership.processes.find((item) => item.debug && item.parent === child.pid);
    report.ownership = { profileProcesses: ownership.processes.length, childRootFound: Boolean(root), listeners: ownership.listeners.length, listenersOwned: Boolean(root) && ownership.listeners.length > 0 && ownership.listeners.every((pid) => pid === root.pid) };
    if (!root || !ownership.listeners.length || !ownership.listeners.every((pid) => pid === root.pid)) throw new Error('Browser ownership not established; refuse navigation');
    browserOwned = true;
    sessionId = opened.sessionId;
    const evaluate = async (call) => {
      const expression = `(async()=>{try{if(location.origin!==${JSON.stringify(`http://127.0.0.1:${localPort}`)}||location.pathname!=='/tests/admin-layout.html')return {__layoutError:'unexpected-target'};const suite=await window.minijoomlaLayoutReady;if(!suite)return {__layoutError:'suite-not-ready'};return await ${call};}catch(error){return {__layoutError:error?.name==='TypeError'?'type-error':'page-operation-failed'};}})()`;
      const value = await rpc('browser.evaluate', { sessionId, expression });
      if (value && typeof value === 'object' && typeof value.__layoutError === 'string') throw new Error(value.__layoutError);
      return value;
    };
    for (const width of LAYOUT_WIDTHS) {
      interruption.signal.throwIfAborted();
      if (child.exitCode !== null) throw new Error('FioriAgent stopped during layout execution');
      await rpc('browser.setViewport', { sessionId, width, height: 1000 });
      const result = await evaluate('suite.run()');
      results.push(result);
      result.keyboard = await runLayoutKeyboard({ rpc, evaluate, sessionId, width });
      validateLayoutResult(result, width);
    }
    interruption.signal.throwIfAborted();
    report.success = true;
  } catch (error) {
    report.failure = interruption.signal.aborted ? 'interrupted' : safeFailure(error);
    throw error;
  } finally {
    // Only this newly created process/profile/session. Never attach, navigate,
    // close or restart the existing production browser. No profiles deleted.
    if (child) {
      if (browserOwned && sessionId && child.exitCode === null) {
        try {
          const value = await layoutRpc(rpcPort, 'browser.evaluate', { sessionId, expression: `(async()=>{try{const suite=await window.minijoomlaLayoutReady;if(!suite)return {ok:false,reason:'suite-not-ready'};suite.stop();return {ok:true};}catch(error){return {ok:false,reason:error?.name==='TypeError'?'type-error':'page-operation-failed'};}})()` });
          const ok = value?.ok === true;
          report.cleanup.push({ step: 'page-stop', success: ok, reason: ok ? undefined : (value?.reason ?? 'missing-result') });
          if (!ok) report.cleanupFailed = true;
        } catch (error) { report.cleanup.push({ step: 'page-stop', success: false, reason: safeFailure(error) }); report.cleanupFailed = true; }
      }
      if (browserOwned && child.exitCode === null) {
        try {
          const value = await layoutRpc(rpcPort, 'agent.endSession');
          const ok = value?.ended === true;
          report.cleanup.push({ step: 'end-session', success: ok, reason: ok ? undefined : 'missing-result' });
          if (!ok) report.cleanupFailed = true;
        } catch (error) { report.cleanup.push({ step: 'end-session', success: false, reason: safeFailure(error) }); report.cleanupFailed = true; }
      }
      try { await cleanupOwnedProcesses(child, profile, debugPort); report.cleanup.push({ step: 'owned-processes', success: true }); }
      catch (error) { report.cleanup.push({ step: 'owned-processes', success: false, reason: safeFailure(error) }); report.cleanupFailed = true; }
    }
    for (const probe of reservations) if (probe.listening) await new Promise((ok) => probe.close(ok));
    if (server.listening) await new Promise((ok) => server.close(ok));
    if (report.cleanupFailed) report.success = false;
    process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  if (!report.success) throw new Error(report.cleanupFailed ? 'Native layout cleanup failed' : 'Native layout execution failed');
  return { success: true, widths: results.length, output: `tmp/${output.slice(tmp.length + 1)}/report.json`, publicationApproved: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => runAdminLayout(parseLayoutArgs(process.argv.slice(2))))
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(`Native local layout failed (${safeFailure(error)}). Check this run's tmp/admin-layout-*/report.json; no publication was performed.`); process.exitCode = 1; });
}
