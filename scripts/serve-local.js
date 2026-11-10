import { createServer } from 'node:http';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/vnd.microsoft.icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject' };
const within = (root, path) => path === root || (!relative(root, path).startsWith(`..${sep}`) && relative(root, path) !== '..' && !isAbsolute(relative(root, path)));

// Demo server, loopback only. Never serves tmp, documentation, Git or profiles.
// `extraRoots` (pivô de empacotamento, opt-in, preview local apenas): mapa
// `prefixo -> raiz absoluta`, montando pacotes externos (ex. um template
// instalado publicado fora da árvore do MINIJOOMLA, como
// web-devs/CAMAP-V3/minijoomla-template/) sob `/<prefixo>/...`, reaproveitando
// EXATAMENTE a mesma lógica de containment/symlink/MIME da raiz principal.
// Ausência de `extraRoots` preserva o comportamento atual, byte a byte —
// nenhum mecanismo equivalente existe (nem deve existir) em produção.
export function createLocalDemoServer({ root = PROJECT, extraRoots = {} } = {}) {
  root = resolve(root);
  const mounts = Object.fromEntries(Object.entries(extraRoots).map(([prefix, mountRoot]) => [prefix, resolve(mountRoot)]));
  async function serveFrom(servedRoot, path, response, method) {
    const finish = (status, text) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(text); };
    const file = resolve(servedRoot, `.${path}`);
    const top = resolve(servedRoot, path.split('/')[1]);
    if (!within(top, file)) { finish(404, 'Not found'); return; }
    // Refuse every symlink/junction, including a top-level served directory.
    let current = servedRoot;
    if ((await lstat(servedRoot)).isSymbolicLink()) { finish(404, 'Not found'); return; }
    for (const part of relative(servedRoot, file).split(sep)) {
      current = resolve(current, part);
      if ((await lstat(current)).isSymbolicLink()) { finish(404, 'Not found'); return; }
    }
    if (!within(servedRoot, await realpath(file)) || !(await lstat(file)).isFile() || !MIME[extname(file).toLowerCase()]) { finish(404, 'Not found'); return; }
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()], 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(method === 'HEAD' ? undefined : bytes);
  }
  return createServer(async (request, response) => {
    const finish = (status, text) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(text); };
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); finish(405, 'Read-only local server'); return; }
    try {
      let path = decodeURIComponent((request.url ?? '/').split('?')[0]);
      if (path === '/') path = '/examples/index.html';
      // Colons/ambiguous Windows suffixes also reject alternate data streams
      // and aliases of otherwise excluded private directories.
      if (/[\\:\u0000-\u001f\u007f]/.test(path) || path.split('/').some((part) => part.startsWith('.') || /[.\s]$/.test(part) || /^(?:tmp|docs|profiles?|secrets?|credentials?|evidence|private)$/i.test(part))) { finish(404, 'Not found'); return; }
      const mountPrefix = Object.keys(mounts).find((prefix) => path === `/${prefix}` || path.startsWith(`/${prefix}/`));
      if (mountPrefix) {
        const mountRoot = mounts[mountPrefix];
        const mountedPath = path.slice(`/${mountPrefix}`.length) || '/';
        await serveFrom(mountRoot, mountedPath, response, request.method);
        return;
      }
      if (!/^\/(?:src|examples|tests)\//.test(path)) { finish(404, 'Not found'); return; }
      await serveFrom(root, path, response, request.method);
    } catch (error) { finish(error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof URIError ? 404 : 500, 'Not found'); }
  });
}

function parseArgs(args) {
  let port = 8080;
  const extraRoots = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--port') { port = Number(args[++index]); continue; }
    if (arg === '--extra-root') {
      const value = args[++index] ?? '';
      const separatorIndex = value.indexOf('=');
      if (separatorIndex <= 0) return { error: 'Usage: --extra-root <prefixo>=<caminho>' };
      const prefix = value.slice(0, separatorIndex);
      const path = value.slice(separatorIndex + 1);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,80}$/.test(prefix) || !path) return { error: 'Usage: --extra-root <prefixo>=<caminho>' };
      extraRoots[prefix] = path;
      continue;
    }
    return { error: `Argumento desconhecido: ${arg}` };
  }
  return { port, extraRoots };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error || !Number.isInteger(parsed.port) || parsed.port < 1024 || parsed.port > 65535) {
    console.error(parsed.error ?? 'Usage: node scripts/serve-local.js [--port 1024..65535] [--extra-root <prefixo>=<caminho> ...]');
    process.exitCode = 1;
  } else {
    const server = createLocalDemoServer({ extraRoots: parsed.extraRoots });
    server.on('error', (error) => { console.error(`Local server: ${error.code}`); process.exitCode = 1; });
    server.listen(parsed.port, '127.0.0.1', () => console.log(`Local demo only: http://127.0.0.1:${parsed.port}/examples/index.html and /examples/admin.html (Ctrl+C to stop)`));
  }
}
