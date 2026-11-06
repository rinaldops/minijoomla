import { createServer } from 'node:http';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/vnd.microsoft.icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject' };
const within = (root, path) => path === root || (!relative(root, path).startsWith(`..${sep}`) && relative(root, path) !== '..' && !isAbsolute(relative(root, path)));

// Demo server, loopback only. Never serves tmp, documentation, Git or profiles.
export function createLocalDemoServer({ root = PROJECT } = {}) {
  root = resolve(root);
  return createServer(async (request, response) => {
    const finish = (status, text) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(text); };
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); finish(405, 'Read-only local server'); return; }
    try {
      let path = decodeURIComponent((request.url ?? '/').split('?')[0]);
      if (path === '/') path = '/examples/index.html';
      // Colons/ambiguous Windows suffixes also reject alternate data streams
      // and aliases of otherwise excluded private directories.
      if (!/^\/(?:src|examples|tests)\//.test(path) || /[\\:\u0000-\u001f\u007f]/.test(path) || path.split('/').some((part) => part.startsWith('.') || /[.\s]$/.test(part) || /^(?:tmp|docs|profiles?|secrets?|credentials?|evidence|private)$/i.test(part))) { finish(404, 'Not found'); return; }
      const file = resolve(root, `.${path}`);
      const top = resolve(root, path.split('/')[1]);
      if (!within(top, file)) { finish(404, 'Not found'); return; }
      // Refuse every symlink/junction, including a top-level served directory.
      let current = root;
      if ((await lstat(root)).isSymbolicLink()) { finish(404, 'Not found'); return; }
      for (const part of relative(root, file).split(sep)) {
        current = resolve(current, part);
        if ((await lstat(current)).isSymbolicLink()) { finish(404, 'Not found'); return; }
      }
      if (!within(root, await realpath(file)) || !(await lstat(file)).isFile() || !MIME[extname(file).toLowerCase()]) { finish(404, 'Not found'); return; }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()], 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) { finish(error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof URIError ? 404 : 500, 'Not found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const port = args.length === 0 ? 8080 : args.length === 2 && args[0] === '--port' && /^\d+$/.test(args[1]) ? Number(args[1]) : NaN;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) { console.error('Usage: node scripts/serve-local.js [--port 1024..65535]'); process.exitCode = 1; }
  else {
    const server = createLocalDemoServer();
    server.on('error', (error) => { console.error(`Local server: ${error.code}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Local demo only: http://127.0.0.1:${port}/examples/index.html and /examples/admin.html (Ctrl+C to stop)`));
  }
}
