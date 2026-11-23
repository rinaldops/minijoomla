import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(PROJECT, 'tmp');
const SCRIPT = join(PROJECT, 'scripts', 'deploy-sharepoint.mjs');
const PUBLIC_PAGE = 'MiniJoomla.aspx';
const ADMIN_PAGE = 'Administrator.aspx';
const VERSION = '0.17.14';

/**
 * Stand-in for the FioriAgent browser bridge. Every SharePoint interaction in
 * deploy-sharepoint.mjs funnels through rpc('browser.evaluate', ...), so a
 * local HTTP server passed as --rpc records each expression the script would
 * have evaluated in a real browser and answers with deterministic values.
 * Nothing here contacts SharePoint, so the test asserts on the real execution
 * path (which pages the script addresses) without any network access.
 */
/**
 * Real staged file count, read from the release the script itself built in
 * tmp/deploy/<version>/stage. Deriving it here (instead of hardcoding a
 * number) keeps the comparison honest: the assertion is "the server agrees
 * with what we staged", not "the server agrees with a constant".
 */
function countStagedFiles() {
  const stage = join(PROJECT, 'tmp', 'deploy', VERSION, 'stage');
  const walk = (dir) => readdirSync(dir, { withFileTypes: true })
    .reduce((total, entry) => total + (entry.isDirectory() ? walk(join(dir, entry.name)) : 1), 0);
  return existsSync(stage) ? walk(stage) : 0;
}

function startBridge({ releaseExists = true, stagedFiles = 0 } = {}) {
  const seen = [];
  let canvasReads = 0;
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const { method, params } = JSON.parse(body || '{}');
      const expression = params?.expression ?? '';
      const answer = (data) => {
        const payload = JSON.stringify({ result: { ok: true, data } });
        response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
        response.end(payload);
      };
      if (method !== 'browser.evaluate') return answer({});
      seen.push(expression);
      // Release-existence probe: the script unwraps .value from this result.
      if (expression.includes(')/Exists')) return answer({ value: releaseExists });
      // Page read for the rollback file: the returned value identifies which
      // page asked for it, so the written rollback names the page.
      if (expression.includes('return current.body.CanvasContent1')) {
        canvasReads += 1;
        const page = expression.includes(PUBLIC_PAGE) ? PUBLIC_PAGE : ADMIN_PAGE;
        return answer({ value: `rollback-de-${page}-${canvasReads}` });
      }
      // Remote file-count walk: the script compares this to the staged file
      // count. The number is derived from the real stage produced by the
      // previous call in the sequence, so it never drifts when the package
      // gains or loses a file.
      if (expression.includes('return walk(')) return answer({ value: stagedFiles || countStagedFiles() });
      // listMap(): an array of [domain, descriptor] pairs, one per schema.
      if (expression.includes('const out = [];') && expression.includes('listId')) {
        const titles = expression.match(/\[\"([a-zA-Z]+)\",\"[^\"]+\"\]/g) ?? [];
        const pairs = titles.map((hit) => {
          const domain = JSON.parse(`[${hit}]`)[0];
          return [domain, { listId: `${domain}-list-guid` }];
        });
        return answer({ value: pairs });
      }
      // The MERGE expression returns the page it published; the script logs it.
      if (expression.includes('X-HTTP-Method')) {
        const page = expression.includes(PUBLIC_PAGE) ? PUBLIC_PAGE : ADMIN_PAGE;
        return answer({ value: { page } });
      }
      return answer({ value: null });
    });
  });
  return new Promise((ready) => {
    server.listen(0, '127.0.0.1', () => ready({
      port: server.address().port,
      seen,
      close: () => new Promise((done) => server.close(done)),
    }));
  });
}

async function runDeploy(args, { releaseExists = true, clean = true } = {}) {
  const bridge = await startBridge({ releaseExists });
  // The suite also runs from a staged contributor copy, where tmp/ may not exist.
  mkdirSync(TMP, { recursive: true });
  const base = mkdtempSync(join(TMP, 'deploy-pages-scope-'));
  const deployDir = join(PROJECT, 'tmp', 'deploy', VERSION);
  // The script stages into a fixed tmp/deploy/<version>/stage path and refuses
  // to overwrite, so each case starts from a clean deploy directory. The
  // two-step sequence passes clean: false to share one tree across both calls.
  if (clean) rmSync(deployDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  try {
    const child = spawn(process.execPath, [
      SCRIPT, '--version', VERSION, '--web', '/teams/camap-agp', '--session', '1',
      '--rpc', String(bridge.port), ...args,
    ], { cwd: PROJECT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const status = await new Promise((done) => child.on('close', done));
    const written = existsSync(deployDir) ? readdirSync(deployDir).filter((name) => name.startsWith('rollback-')) : [];
    return {
      status,
      stdout: String(stdout),
      stderr: String(stderr),
      seen: bridge.seen,
      written,
    };
  } finally {
    await bridge.close();
    rmSync(base, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}

/**
 * The real activation sequence: `--prepare-only` and then `--activate-existing`
 * on one shared deploy tree, with nothing removed between the two runs. The
 * second call must build its own stage instead of colliding with the first.
 */
async function runDeploySequence() {
  const deployDir = join(PROJECT, 'tmp', 'deploy', VERSION);
  rmSync(deployDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  // Step 1 uploads the release, so it must start from a release that does not
  // exist yet; step 2 then finds it present, exactly like the real activation.
  const prepare = await runDeploy(['--prepare-only', '--skip-provision'], { clean: false, releaseExists: false });
  const activate = await runDeploy(['--activate-existing', '--admin-only', '--skip-provision'], { clean: false, releaseExists: true });
  return { prepare, activate };
}

/** Page names appearing in any expression the script sent to the bridge. */
const pagesMentioned = (seen) => {
  const named = new Set();
  for (const expression of seen) {
    for (const page of [PUBLIC_PAGE, ADMIN_PAGE]) if (expression.includes(page)) named.add(page);
  }
  return [...named].sort();
};

/** Readback hashes carried in the verification envelope (64 hex chars each). */
const readbackHashes = (seen) => seen
  .flatMap((expression) => (expression.match(/"sha256":"([0-9a-f]{64})"/g) ?? []).map((hit) => hit.slice(10, 74)));

export async function runDeployPagesScopeTests() {
  const cases = [];

  // 1. --admin-only: the public page is never named in any evaluation, so it
  //    cannot be located, read, written, published, or given a rollback file.
  const adminOnly = await runDeploy(['--admin-only', '--skip-provision', '--activate-existing']);
  assert.equal(adminOnly.status, 0, `--admin-only deve concluir: ${adminOnly.stderr}`);
  assert.deepEqual(pagesMentioned(adminOnly.seen), [ADMIN_PAGE],
    '--admin-only nao pode enderecar a pagina publica em nenhuma chamada');
  assert.ok(!adminOnly.stdout.includes(PUBLIC_PAGE) && !adminOnly.stderr.includes(PUBLIC_PAGE),
    '--admin-only nao pode mencionar a pagina publica nem na saida');
  assert.deepEqual(adminOnly.written, [`rollback-${ADMIN_PAGE}.html`],
    'o rollback deve ser gerado somente para Administrator.aspx');
  cases.push('admin-only-nao-toca-a-pagina-publica');

  /*
   * --skip-provision nao pode escrever ESQUEMA. `provision()` regrava sem
   * condicao os Choices de todos os campos Choice de todas as listas
   * MiniJoomla com etag '*', porque o `inspect()` so cria campos ausentes e
   * as opcoes novas de um Choice existente exigem MERGE. A 0.17.15 nao muda
   * esquema de lista, entao nem o preparo nem a ativacao podem tocar em
   * `/fields`: e uma escrita destrutiva de configuracao, independente das
   * paginas.
   */
  const fieldWrites = (seen) => seen.filter((expression) => expression.includes('/fields'));
  assert.deepEqual(fieldWrites(adminOnly.seen), [],
    '--skip-provision nao pode enderecar /fields: nenhuma escrita de esquema');
  cases.push('skip-provision-nao-escreve-esquema');

  // 2. --pages Administrator.aspx is the explicit long form: same restriction.
  const explicit = await runDeploy(['--pages', ADMIN_PAGE, '--skip-provision', '--activate-existing']);
  assert.equal(explicit.status, 0, `--pages ${ADMIN_PAGE} deve concluir: ${explicit.stderr}`);
  assert.deepEqual(pagesMentioned(explicit.seen), [ADMIN_PAGE],
    `--pages ${ADMIN_PAGE} nao pode enderecar a pagina publica`);
  assert.deepEqual(explicit.written, [`rollback-${ADMIN_PAGE}.html`],
    `--pages ${ADMIN_PAGE} deve gerar rollback apenas do painel`);
  cases.push('pages-explicito-restrito-ao-painel');

  // 3. Exclusivity: --admin-only mixed with an explicit page choice that could
  //    reach the public page is rejected instead of silently resolved.
  const conflicting = await runDeploy(['--admin-only', '--pages', PUBLIC_PAGE, '--skip-provision']);
  assert.notEqual(conflicting.status, 0, '--admin-only com --pages deve falhar');
  assert.match(`${conflicting.stdout}${conflicting.stderr}`, /exclusivo/,
    '--admin-only com --pages deve explicar a exclusividade');
  assert.equal(conflicting.seen.length, 0, 'a recusa deve ocorrer antes de contatar o host');
  assert.deepEqual(conflicting.written, [], 'a recusa nao pode gerar rollback algum');

  const withPublicPage = await runDeploy(['--admin-only', '--public-page', PUBLIC_PAGE, '--skip-provision']);
  assert.notEqual(withPublicPage.status, 0, '--admin-only com --public-page deve falhar');
  assert.match(`${withPublicPage.stdout}${withPublicPage.stderr}`, /exclusivo/,
    '--admin-only com --public-page deve explicar a exclusividade');
  assert.equal(withPublicPage.seen.length, 0, 'a recusa deve ocorrer antes de contatar o host');
  cases.push('admin-only-e-exclusivo');

  // 4. Without the option the legacy behavior is preserved: both pages are
  //    still published and the public page still gets its rollback file.
  const defaultRun = await runDeploy(['--skip-provision', '--activate-existing']);
  assert.equal(defaultRun.status, 0, `execucao padrao deve concluir: ${defaultRun.stderr}`);
  assert.deepEqual(pagesMentioned(defaultRun.seen), [ADMIN_PAGE, PUBLIC_PAGE].sort(),
    'sem a opcao as duas paginas continuam sendo publicadas');
  assert.ok(defaultRun.written.includes(`rollback-${PUBLIC_PAGE}.html`) && defaultRun.written.includes(`rollback-${ADMIN_PAGE}.html`),
    'sem a opcao o rollback das duas paginas continua sendo gerado');
  cases.push('sem-opcao-o-comportamento-nao-muda');

  // 5. --activate-existing skips the refusal on an already-present release and
  //    still performs the full hash readback before touching any page.
  const withoutFlag = await runDeploy(['--admin-only', '--skip-provision']);
  assert.notEqual(withoutFlag.status, 0, 'release existente sem --activate-existing deve ser recusada');
  assert.match(`${withoutFlag.stdout}${withoutFlag.stderr}`, /ja existe|já existe/,
    'a recusa deve citar a release existente');
  assert.deepEqual(withoutFlag.written, [], 'a recusa nao pode gerar rollback algum');

  assert.ok(readbackHashes(adminOnly.seen).length > 0,
    '--activate-existing deve refazer o readback por hash antes de escrever na pagina');
  const firstPageWrite = adminOnly.seen.findIndex((expression) => expression.includes('X-HTTP-Method'));
  const lastReadback = adminOnly.seen.reduce((last, expression, index) => (/"sha256":"[0-9a-f]{64}"/.test(expression) ? index : last), -1);
  assert.ok(lastReadback !== -1 && (firstPageWrite === -1 || lastReadback < firstPageWrite),
    'o readback por hash deve preceder qualquer escrita em pagina');
  assert.ok(!adminOnly.seen.some((expression) => expression.includes('addusingpath') && expression.includes('overwrite=false') && expression.includes('base64')),
    '--activate-existing nao pode regravar arquivos na release');
  cases.push('activate-existing-verifica-antes-de-ativar');

  // 6. Malformed selections fail fast, before any host contact.
  for (const value of ['Administrator.aspx,X.aspx', 'garbage', '']) {
    const outcome = await runDeploy(['--pages', value, '--skip-provision']);
    assert.notEqual(outcome.status, 0, `--pages ${JSON.stringify(value)} deve falhar`);
    assert.match(`${outcome.stdout}${outcome.stderr}`, /--pages|\.aspx/,
      `--pages ${JSON.stringify(value)} deve reportar a opcao ofensora`);
    assert.equal(outcome.seen.length, 0,
      `--pages ${JSON.stringify(value)} deve falhar antes de contatar o host`);
  }
  cases.push('pages-invalido-recusado-antes-do-host');

  // 7. A non-existent release without the flag is still prepared normally.
  const fresh = await runDeploy(['--admin-only', '--skip-provision'], { releaseExists: false });
  assert.equal(fresh.status, 0, `release nova deve ser preparada: ${fresh.stderr}`);
  cases.push('release-nova-comportamento-inalterado');

  // 8. The real two-step activation sequence: --prepare-only followed by
  //    --activate-existing on the SAME tree, with nothing deleted in between.
  //    step-release.js refuses to overwrite a stage, so this is the case that
  //    catches the stage collision: the second run must build its own stage
  //    instead of dying before the readback and the panel write.
  const sequence = await runDeploySequence();
  assert.equal(sequence.prepare.status, 0,
    `--prepare-only (passo 1) deve concluir: ${sequence.prepare.stderr}`);
  assert.deepEqual(sequence.prepare.written, [],
    '--prepare-only nao pode gerar rollback: nenhuma pagina pode ser escrita');
  assert.equal(sequence.prepare.seen.some((expression) => expression.includes('X-HTTP-Method')), false,
    '--prepare-only nao pode publicar pagina alguma');
  assert.equal(sequence.activate.status, 0,
    `--activate-existing (passo 2) deve concluir apos o passo 1: ${sequence.activate.stderr}`);
  assert.deepEqual(fieldWrites(sequence.prepare.seen), [],
    'o preparo com --skip-provision nao pode escrever esquema');
  assert.deepEqual(fieldWrites(sequence.activate.seen), [],
    'a ativacao com --skip-provision nao pode escrever esquema');
  assert.deepEqual(sequence.activate.written, [`rollback-${ADMIN_PAGE}.html`],
    'o passo de ativacao deve gerar rollback somente de Administrator.aspx');
  assert.deepEqual(pagesMentioned(sequence.activate.seen), [ADMIN_PAGE],
    'a sequencia ativada com --admin-only nao pode enderecar a pagina publica');
  assert.ok(!/Destino já existe/.test(`${sequence.activate.stdout}${sequence.activate.stderr}`),
    'a ativacao nao pode colidir com o stage deixado pelo passo de preparo');
  // Both stages coexist: the second invocation did not reuse or destroy the first.
  const stageDirs = readdirSync(join(PROJECT, 'tmp', 'deploy', VERSION))
    .filter((name) => name === 'stage' || /^stage\.\d+$/.test(name)).sort();
  assert.ok(stageDirs.length >= 2,
    `o passo de ativacao deve montar o proprio stage sem apagar o do preparo: ${stageDirs.join(', ')}`);
  assert.ok(stageDirs.includes('stage'), 'o stage do passo 1 deve continuar intacto');
  cases.push('prepare-only-depois-activate-existing-na-mesma-arvore');

  /*
   * 9. `--mse-layout FullBleed` so escreve a pagina em publishPages(), ou seja,
   *    combinado com --admin-only so pode aparecer no canvas de
   *    Administrator.aspx. O wrapper FullBleed e o que destrava o painel da
   *    coluna de ~1200px; se a flag vazasse para a pagina publica, o site
   *    publico mudaria de layout numa rodada restrita ao painel.
   */
  const fullBleed = await runDeploy(['--admin-only', '--mse-layout', 'FullBleed', '--skip-provision', '--activate-existing']);
  assert.equal(fullBleed.status, 0, `--mse-layout FullBleed deve concluir: ${fullBleed.stderr}`);
  assert.deepEqual(pagesMentioned(fullBleed.seen), [ADMIN_PAGE],
    '--mse-layout com --admin-only nao pode enderecar a pagina publica');
  assert.deepEqual(fullBleed.written, [`rollback-${ADMIN_PAGE}.html`],
    '--mse-layout com --admin-only deve gerar rollback somente do painel');
  const layoutWrites = fullBleed.seen.filter((expression) => expression.includes('data-spmiddle-layout'));
  assert.ok(layoutWrites.length > 0,
    '--mse-layout FullBleed deve emitir o wrapper data-spmiddle-layout na pagina escrita');
  assert.ok(layoutWrites.every((expression) => expression.includes(ADMIN_PAGE) && !expression.includes(PUBLIC_PAGE)),
    'o wrapper FullBleed so pode aparecer no canvas de Administrator.aspx');
  cases.push('mse-layout-fullbleed-restrito-ao-painel');

  // 9b. The layout helper assets must be staged for the wrapper to work: the
  //     snippet references <release>/host/spmiddle-layout/*, copied from the
  //     real SPMIDDLE adapter. A missing file means a blank wrapper in prod.
  const layoutStage = join(PROJECT, 'tmp', 'deploy', VERSION, 'stage', 'host', 'spmiddle-layout');
  assert.ok(existsSync(layoutStage), 'o stage deve conter host/spmiddle-layout/');
  assert.deepEqual(readdirSync(layoutStage).sort(),
    ['layout.css', 'layout.js', 'spmiddle-mse-host.js'],
    'os tres ativos do adaptador SPMIDDLE devem estar no stage, no caminho exato');
  for (const name of readdirSync(layoutStage)) {
    const staged = readFileSync(join(layoutStage, name));
    const source = readFileSync(join(PROJECT, '..', 'SPMIDDLE', 'host-adapters', 'modern-script-editor', name));
    assert.ok(staged.equals(source), `host/spmiddle-layout/${name} deve ser byte-identico ao adaptador SPMIDDLE`);
  }
  cases.push('layout-spmiddle-empacotado-byte-identico');

  // 9c. An invalid layout value is rejected before any host contact.
  const badLayout = await runDeploy(['--admin-only', '--mse-layout', 'Wide', '--skip-provision']);
  assert.notEqual(badLayout.status, 0, '--mse-layout invalido deve falhar');
  assert.match(`${badLayout.stdout}${badLayout.stderr}`, /FullBleed|Contained/,
    'a recusa deve citar os valores aceitos');
  assert.equal(badLayout.seen.length, 0, 'a recusa deve ocorrer antes de contatar o host');
  cases.push('mse-layout-invalido-recusado-antes-do-host');

  return cases;
}