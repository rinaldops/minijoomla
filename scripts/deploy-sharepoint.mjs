#!/usr/bin/env node
/*
 * Publica uma release imutável no SharePoint pela sessão autenticada do FioriAgent.
 * Uso: node scripts/deploy-sharepoint.mjs --version X.Y.Z --web /sites/site --session <id>
 *      [--rpc 47173] [--skip-provision] [--prepare-only] [--expected-origin https://tenant.sharepoint.com]
 *      [--public-page NomeReal.aspx] [--mse-layout FullBleed|Contained]
 * Recusa versão já existente. Grava em tmp/deploy/ o canvas anterior (rollback) e o
 * mapa de listas. Nenhum cookie/token é lido ou gravado: todo acesso roda no navegador.
 * --public-page informa o nome real do .aspx público já criado no site de
 * destino (default 'MiniJoomla.aspx'); o MINIJOOMLA não assume nenhum nome
 * específico de site/template.
 * --mse-layout é opcional; omitido preserva o snippet legado sem wrapper
 * (sem mudança de comportamento). Quando informado, publishPages() envolve
 * a raiz do CMS no wrapper data-spmiddle-host/data-spmiddle-layout real do
 * SPMIDDLE (ver docs/CICLO-MSE-FULLBLEED.md), e buildStage() copia
 * host/spmiddle-layout/{layout.js,layout.css,spmiddle-mse-host.js} do
 * SPMIDDLE byte-for-byte para a release — essa flag não reimplementa nem
 * modifica o algoritmo de layout em nenhum lugar.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSharePointRestClient } from '../../SPMIDDLE/packages/sharepoint-rest-browser/src/index.js';
import { createProvisioningManager } from '../../SPMIDDLE/packages/sharepoint-provisioning/src/index.js';
import { MINIJOOMLA_SCHEMAS } from '../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';
import { mergeExtensionsConfigs } from '../src/libraries/minijoomla/application/joomla-host-config.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';
import { packageAsset } from '../src/libraries/minijoomla/application/package-path.js';
import { createSharePointFileClient } from '../../SPMIDDLE/packages/sharepoint-files/src/files.js';
import { createAtomicExtensionKeyGuard } from '../src/libraries/minijoomla/infrastructure/spmiddle-extension-guard.js';
import { assertJoomlaPackageAssets } from '../src/libraries/minijoomla/application/joomla-package-assets.js';

const PROJECT = resolve(fileURLToPath(import.meta.url), '..', '..');
const MODERN_SCRIPT_EDITOR = '3a328f0a-99c4-4b28-95ab-fe0847f657a3';
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => (flag(name) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const version = option('version');
const web = option('web');
const session = option('session');
const rpcPort = option('rpc', '47173');
// Nome real do .aspx público é decidido por quem criou a página no site de
// destino (pode ser 'MiniJoomla.aspx' num site genérico ou algo específico
// do site, ex. 'CAMAP-V3.aspx') — nunca hardcodado aqui, o que violaria o
// confinamento de templates instalados fora do MINIJOOMLA.
const publicPage = option('public-page', 'MiniJoomla.aspx');
if (!publicPage.endsWith('.aspx')) throw new TypeError('--public-page requer um nome de arquivo .aspx.');
const PAGES = { [publicPage]: { attribute: 'data-minijoomla-site', instance: 'minijoomla-site' }, 'Administrator.aspx': { attribute: 'data-minijoomla-admin-root', instance: 'minijoomla-admin' } };
// Publisher's explicit choice, same two values mse-layout.js accepts; default
// preserves the legacy unwrapped snippet (no behavior change for existing
// publications that never asked for this).
const mseLayout = option('mse-layout', null);
if (mseLayout !== null && !['FullBleed', 'Contained'].includes(mseLayout)) throw new TypeError('--mse-layout aceita somente FullBleed ou Contained.');
const expectedOrigin = option('expected-origin');
if (expectedOrigin && (new URL(expectedOrigin).origin !== expectedOrigin || new URL(expectedOrigin).protocol !== 'https:')) throw new TypeError('--expected-origin requer uma origem HTTPS exata.');
if (!/^\d+\.\d+\.\d+$/.test(version ?? '') || !web?.startsWith('/') || !session || !/^\d+$/.test(rpcPort)) throw new TypeError('Informe --version X.Y.Z --web /sites/site --session <id> [--rpc <porta>].');
const extensionFiles = argv.flatMap((arg, index) => arg === '--extensions-config' ? [argv[index + 1]] : []);
if (extensionFiles.some((file) => !file || file.startsWith('--'))) throw new TypeError('--extensions-config requer caminho JSON local.');
const extensionConfig = extensionFiles.length ? mergeExtensionsConfigs(extensionFiles.map((file) => JSON.parse(readFileSync(resolve(file), 'utf8'))), { webUrl: web }) : {};
const assets = `${web}/SiteAssets/minijoomla`;
const release = `${assets}/releases/${version}`;
const output = join(PROJECT, 'tmp', 'deploy', version);
mkdirSync(output, { recursive: true });

async function rpc(method, params) {
  const response = await fetch(`http://127.0.0.1:${rpcPort}/rpc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: method, method, params }) });
  const { result, error } = await response.json();
  if (error || !result?.ok) throw new Error(`${method}: ${error?.message ?? result?.message}`);
  return result.data;
}
const evaluate = (expression) => rpc('browser.evaluate', { sessionId: session, expression });

// Funções disponíveis em toda chamada ao navegador.
const PRELUDE = `
if (${JSON.stringify(expectedOrigin ?? null)} && (location.origin !== ${JSON.stringify(expectedOrigin ?? null)} || !location.pathname.startsWith(${JSON.stringify(web + '/')}))) throw new Error('Sessao fora do destino de producao esperado.');
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const digest = async () => (await (await fetch(${JSON.stringify(web)} + '/_api/contextinfo', { method: 'POST', headers: { accept: 'application/json;odata=nometadata' } })).json()).FormDigestValue;
const call = async (path, init = {}) => {
  const response = await fetch(${JSON.stringify(web)} + '/_api/' + path, { ...init, cache: 'no-store', headers: { accept: 'application/json;odata=nometadata', ...(init.method ? { 'X-RequestDigest': await digest() } : {}), ...init.headers } });
  if (!response.ok) throw new Error(path + ' -> ' + response.status + ' ' + (await response.text()).slice(0, 300));
  const text = await response.text();
  return { etag: response.headers.get('etag'), body: text ? JSON.parse(text) : null };
};`;
// browser.evaluate devolve ok:true/data:{} quando a promessa rejeita: o erro precisa voltar como dado.
async function browser(code) {
  const outcome = await evaluate(`(async()=>{try { ${PRELUDE}\nreturn { value: await (async()=>{${code}\n})() }; } catch (error) { return { failure: String(error?.message ?? error) }; }\n})()`);
  if (outcome?.failure !== undefined) throw new Error(outcome.failure);
  if (!outcome || !('value' in outcome)) throw new Error('Resposta inválida do navegador.');
  return outcome.value;
}

function bridgeFetch(url, init = {}) {
  return evaluate(`(async()=>{const r=await fetch(${JSON.stringify(url)},{method:${JSON.stringify(init.method ?? 'GET')},headers:${JSON.stringify(init.headers ?? {})},body:${init.body === undefined ? 'undefined' : JSON.stringify(init.body)},cache:'no-store'});const h={};for(const[k,v]of r.headers.entries())h[k]=v;return{status:r.status,headers:h,text:await r.text()}})()`).then((data) => ({
    ok: data.status >= 200 && data.status < 300,
    status: data.status,
    headers: { get: (name) => data.headers[String(name).toLowerCase()] ?? null },
    text: async () => data.text,
    json: async () => (data.text ? JSON.parse(data.text) : null)
  }));
}

async function provision() {
  const transport = createSharePointRestClient({ webUrl: web, fetchImpl: bridgeFetch });
  for (const schema of Object.values(MINIJOOMLA_SCHEMAS)) {
    const manager = createProvisioningManager({ schema, transport });
    const { actions } = await manager.inspect();
    for (const action of actions) {
      if (action.supported === false) { console.log(`skip ${schema.internalName}: ${action.kind} ${action.target ?? ''}`); continue; }
      const { __metadata, ...body } = action.body ?? {};
      if (action.kind === 'field' && body.Choices) {
        // O tenant recusa Choices no POST genérico: cria o campo e aplica as opções depois.
        const { Choices, ...create } = body;
        await transport.request(action.path, { method: 'POST', body: create });
        await transport.request(`${action.path}/getbyinternalnameortitle('${body.InternalName}')`, { method: 'MERGE', body: { Choices: Choices.results ?? Choices }, etag: '*', allowWildcardEtag: true });
      } else await transport.request(action.path, { method: action.method, body });
    }
    // inspect só cria campos ausentes: opções novas de um Choice existente precisam de MERGE.
    for (const field of schema.fields.filter((item) => item.type === 'Choice')) {
      await transport.request(`${web}/_api/web/lists/getbytitle('${schema.displayName}')/fields/getbyinternalnameortitle('${field.internalName}')`, { method: 'MERGE', body: { Choices: field.choices }, etag: '*', allowWildcardEtag: true });
    }
    const pending = (await manager.verify()).actions.filter((action) => action.supported !== false);
    if (pending.length) throw new Error(`${schema.internalName}: ${pending.length} ações pendentes após provisionar.`);
    console.log(`lista ok: ${schema.internalName} (${actions.length} ações)`);
  }
}

// Published packages must already exist and match the pinned bytes before any write.
async function verifyExtensionPackages() {
  for (const root of extensionConfig.joomlaDiscoveryRoots ?? []) {
    const client = createSharePointFileClient({ transport: createSharePointRestClient({ webUrl: web, fetchImpl: bridgeFetch }), libraryPath: root.baseUrl });
    const files = {
      listFolders: client.listFoldersAll,
      async downloadFile({ folderPath, fileName, maxBytes }) {
        const path = packageAsset(root.baseUrl, [folderPath, fileName].filter(Boolean).join('/'));
        const base64 = await browser(`
          const response = await fetch(${JSON.stringify(path)}, { cache: 'no-store', credentials: 'same-origin' });
          if (!response.ok || response.redirected) throw new Error('Pacote indisponivel ou redirecionado.');
          const limit = ${JSON.stringify(maxBytes)};
          const announced = response.headers.get('content-length');
          if (announced !== null && Number(announced) > limit) { await response.body?.cancel(); throw new Error('Limite do pacote excedido.'); }
          const reader = response.body.getReader(); const chunks = []; let total = 0;
          try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength;
            if (total > limit) { await reader.cancel(); throw new Error('Limite do pacote excedido.'); } chunks.push(value); }
          } finally { reader.releaseLock(); }
          const bytes = new Uint8Array(total); let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          return btoa(binary);`);
        return { data: Buffer.from(base64, 'base64') };
      }
    };
    const service = createJoomlaDiscoveryService({ roots: [{ ...root, discover: true, files }] });
    const report = await service.scanReport();
    if (!report.complete || !report.entries.length || report.entries.some((entry) => entry.error)) throw new Error(`Preflight XML falhou: ${root.id}.`);
    const descriptors = [];
    for (const candidate of report.entries) descriptors.push(await service.verify(candidate));
    assertJoomlaPackageAssets(extensionConfig, descriptors);
    console.log(`pacote XML verificado sem executar codigo: ${root.id}`);
  }
}

async function listMap() {
  const titles = Object.fromEntries(Object.entries(MINIJOOMLA_SCHEMAS).map(([domain, schema]) => [domain, schema.displayName]));
  return Object.fromEntries(await browser(`const out = [];
    for (const [domain, title] of Object.entries(${JSON.stringify(titles)})) out.push([domain, { listId: (await call('web/lists/getbytitle(' + q(title) + ')?$select=Id')).body.Id }]);
    return out;`));
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });
}

// Só o que é global no CSS administrativo precisa virar raiz do escopo.
function scopedAdminCss(css) {
  return `@scope ([data-minijoomla-admin-root]) {\n${css.replace(/^(:root|body)\s*\{/gm, ':scope{')}\n}\n`;
}

function buildStage(lists) {
  const stage = join('tmp', 'deploy', version, 'stage');
  execFileSync(process.execPath, ['scripts/stage-release.js', '--version', version, '--output', stage, '--target', 'all'], { cwd: PROJECT, stdio: 'inherit' });
  const root = join(PROJECT, stage);
  const host = readFileSync(join(PROJECT, 'host-adapters', 'modern-script-editor', 'host.js'), 'utf8')
    .replace('/* MINIJOOMLA_CONFIG */ null', () => JSON.stringify({ webUrl: web, libraryPath: assets, lists, ...extensionConfig }));
  if (host.includes('/* MINIJOOMLA_CONFIG */ null')) throw new Error('Host com configuração não substituída.');
  mkdirSync(join(root, 'host'), { recursive: true });
  writeFileSync(join(root, 'host', 'host.js'), host);
  writeFileSync(join(root, 'host', 'installation-context.js'), readFileSync(join(PROJECT, 'host-adapters', 'modern-script-editor', 'installation-context.js')));
  writeFileSync(join(root, 'host', 'mse-layout.js'), readFileSync(join(PROJECT, 'host-adapters', 'modern-script-editor', 'mse-layout.js')));
  writeFileSync(join(root, 'host', 'loader.js'), `import(${JSON.stringify(`${release}/host/host.js`)}).catch((error) => console.error('MINIJOOMLA: falha ao importar o host.', error));\n`);
  writeFileSync(join(root, 'host', 'admin.scoped.css'), scopedAdminCss(readFileSync(join(PROJECT, 'src', 'media', 'templates', 'administrator', 'atum', 'css', 'template.css'), 'utf8')));
  // FullBleed/Contained layout wrapper assets: the real SPMIDDLE host adapter,
  // byte-for-byte, same three files scripts/stage-generic-installation.js
  // already copies for the offline copyable package. Publishing a page's
  // snippet with data-spmiddle-host/data-spmiddle-layout requires these to
  // exist at this exact path; mse-layout.js (host above) only looks for the
  // CSS/module here, it never fabricates the layout algorithm itself.
  mkdirSync(join(root, 'host', 'spmiddle-layout'), { recursive: true });
  for (const name of ['layout.js', 'layout.css', 'spmiddle-mse-host.js']) {
    writeFileSync(join(root, 'host', 'spmiddle-layout', name), readFileSync(join(PROJECT, '..', 'SPMIDDLE', 'host-adapters', 'modern-script-editor', name)));
  }
  return walk(root).map((path) => ({ path, name: relative(root, path).split(sep).join('/') }));
}

// Sites SharePoint com a feature "Document ID" ativada injetam metadados
// XML dentro do primeiro `<head>` (ou, na ausência de um, logo após o fim
// do byte original) de todo arquivo `.html` enviado via REST — confirmado
// nesta iteração por upload de sondagem descartável num site de teste real
// (ver tmp/it7-investigation, removido após a sondagem): o conteúdo
// original sempre aparece intacto como PREFIXO exato dos bytes remotos; a
// injeção é estritamente um APÊNDICE, nunca uma truncagem/alteração do
// conteúdo original. `.js`/`.css`/`.json` saem bit-a-bit idênticos (o
// recurso só atua em `.html`). Por isso, só para `.html`, a verificação
// aceita esse apêndice SE E SOMENTE SE os primeiros `byteLength` bytes
// remotos repetirem o hash SHA-256 original exato — qualquer divergência
// no prefixo (truncagem, corrupção, substituição de conteúdo) continua
// rejeitada. Todas as outras extensões mantêm a exigência de hash idêntico
// de sempre, sem excecão.
const WEAK_INTEGRITY_EXTENSIONS = new Set(['.html']);
async function upload(files) {
  const folders = [...new Set(files.flatMap(({ name }) => name.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))))].sort();
  const shared = [assets, `${assets}/releases`, `${assets}/uploads`, `${assets}/extensions`, `${assets}/templates`];
  await browser(`for (const folder of ${JSON.stringify(shared)}) {
      const node = 'web/GetFolderByServerRelativePath(decodedurl=' + q(folder) + ')/Exists';
      if (!(await call(node)).body.value) await call('web/folders/addusingpath(decodedurl=' + q(folder) + ')', { method: 'POST' });
    }
    for (const folder of ${JSON.stringify([release, ...folders.map((folder) => `${release}/${folder}`)])}) await call('web/folders/addusingpath(decodedurl=' + q(folder) + ')', { method: 'POST' });
    return true;`);
  for (let i = 0; i < files.length; i += 8) {
    const chunk = files.slice(i, i + 8).map(({ path, name }) => {
      const bytes = readFileSync(path);
      const weakIntegrity = WEAK_INTEGRITY_EXTENSIONS.has(name.slice(name.lastIndexOf('.')).toLowerCase());
      return { name, base64: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length, weakIntegrity };
    });
    await browser(`const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      await Promise.all(${JSON.stringify(chunk)}.map(async (file) => {
        const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
        const parts = file.name.split('/');
        const leaf = parts.pop();
        const folder = [${JSON.stringify(release)}, ...parts].join('/');
        await call('web/GetFolderByServerRelativePath(decodedurl=' + q(folder) + ')/Files/addusingpath(decodedurl=' + q(leaf) + ',overwrite=false)', { method: 'POST', body: bytes });
        const remote = await (await fetch(folder + '/' + leaf + '?verify=' + Date.now(), { cache: 'no-store' })).arrayBuffer();
        if (file.weakIntegrity) {
          if (remote.byteLength < file.byteLength) throw new Error('arquivo truncado pelo servidor (verificação frouxa .html): ' + file.name);
          const prefix = remote.slice(0, file.byteLength);
          if (hex(await crypto.subtle.digest('SHA-256', prefix)) !== file.sha256) throw new Error('prefixo divergente do conteúdo original (verificação frouxa .html): ' + file.name);
        } else if (hex(await crypto.subtle.digest('SHA-256', remote)) !== file.sha256) throw new Error('hash divergente: ' + file.name);
      }));
      return true;`);
    process.stdout.write(`\r${Math.min(i + 8, files.length)}/${files.length} verificados`);
  }
  console.log();
}

async function publishPages() {
  for (const [page, { attribute, instance }] of Object.entries(PAGES)) {
    const script = mseLayout
      ? `<link rel="stylesheet" data-minijoomla-mse-layout href="${release}/host/spmiddle-layout/layout.css">\n<div data-spmiddle-host data-spmiddle-instance="${instance}" data-spmiddle-layout="${mseLayout}">\n  <div ${attribute}></div>\n</div>\n<script src="${release}/host/loader.js"></script>\n`
      : `<div ${attribute}></div>\n<script src="${release}/host/loader.js"></script>\n`;
    // getbytitle('Site Pages') responde 404 ("List '...' does not exist") de
    // forma consistente neste tenant, mesmo a lista existindo (confirmado
    // nesta iteração: GetList(url) e $filter=Title eq '...' funcionam contra
    // a mesma lista) — causa raiz real do SharePoint, não um bug deste
    // script. Localizar por Id (lists(guid'...')) evita o método getbytitle
    // por completo.
    const locate = `const listId = (await call('web/lists?$select=Id&$filter=BaseTemplate eq 119')).body.value[0].Id;
      const list = "web/lists(guid'" + listId + "')";
      const row = (await call(list + '/items?$select=Id,FileRef,FileLeafRef&$filter=FileLeafRef eq ' + q(${JSON.stringify(page)}))).body.value[0];
      const current = await call(list + '/items(' + row.Id + ')?$select=CanvasContent1');`;
    // O rollback precisa existir antes da primeira escrita na página.
    writeFileSync(join(output, `rollback-${page}.html`), await browser(`${locate} return current.body.CanvasContent1;`));
    const result = await browser(`${locate}
      const canvas = new DOMParser().parseFromString(current.body.CanvasContent1, 'text/html');
      const parts = [...canvas.querySelectorAll('[data-sp-webpartdata]')].filter((node) => JSON.parse(node.getAttribute('data-sp-webpartdata')).id === ${JSON.stringify(MODERN_SCRIPT_EDITOR)});
      if (parts.length !== 1) throw new Error('esperado um Modern Script Editor em ' + row.FileLeafRef);
      const data = JSON.parse(parts[0].getAttribute('data-sp-webpartdata'));
      Object.assign(data.properties, { script: ${JSON.stringify(script)}, scriptCode: ${JSON.stringify(script)}, removePadding: true });
      parts[0].setAttribute('data-sp-webpartdata', JSON.stringify(data));
      await call(list + '/items(' + row.Id + ')', { method: 'POST', headers: { 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': current.etag }, body: JSON.stringify({ CanvasContent1: canvas.body.innerHTML }) });
      const file = 'web/GetFileByServerRelativePath(decodedurl=' + q(row.FileRef) + ')';
      const state = (await call(file + '?$select=Level')).body;
      if (state.Level !== 1) await call(file + '/Publish(' + q(${JSON.stringify(`MINIJOOMLA ${version}`)}) + ')', { method: 'POST' });
      return { page: row.FileLeafRef };`);
    console.log(`página publicada: ${result.page}`);
  }
}

// Recusa antes de qualquer escrita: versão já publicada é imutável.
if (await browser(`return (await call('web/GetFolderByServerRelativePath(decodedurl=' + q(${JSON.stringify(release)}) + ')/Exists')).body.value;`)) throw new Error(`Release ${version} já existe; publique uma versão nova.`);
await verifyExtensionPackages();
if (!flag('skip-provision')) await provision();
const lists = await listMap();
if (extensionConfig.joomlaDiscoveryRoots?.length && !await createAtomicExtensionKeyGuard({ transport: createSharePointRestClient({ webUrl: web, fetchImpl: bridgeFetch }), webUrl: web, listId: lists.extensions?.listId })()) throw new Error('Ativacao XML bloqueada: Key precisa de Indexed e EnforceUniqueValues reais no catalogo. Nenhuma pagina foi alterada.');
writeFileSync(join(output, 'lists.json'), JSON.stringify(lists, null, 2));
const files = buildStage(lists);
await upload(files);
const remote = await browser(`const walk = async (folder) => {
    const node = 'web/GetFolderByServerRelativePath(decodedurl=' + q(folder) + ')';
    const inner = (await call(node + '/Files?$select=Name')).body.value.length;
    const children = (await call(node + '/Folders?$select=ServerRelativeUrl')).body.value;
    let total = inner;
    for (const child of children) total += await walk(child.ServerRelativeUrl);
    return total;
  };
  return walk(${JSON.stringify(release)});`);
if (remote !== files.length) throw new Error(`Release incompleta no servidor: ${remote}/${files.length}.`);
console.log(`servidor confirma ${remote} arquivos`);
if (!flag('prepare-only')) {
  await publishPages();
  console.log(`release ${version} ativa em ${release}`);
} else console.log(`release ${version} preparada e verificada; paginas nao alteradas: ${release}`);
