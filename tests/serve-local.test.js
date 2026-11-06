import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalDemoServer } from '../scripts/serve-local.js';

const PROJECT = fileURLToPath(new URL('../', import.meta.url));

async function withServer(root, verify) {
  const server = createLocalDemoServer({ root });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  assert.equal(server.address().address, '127.0.0.1');
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await verify(base); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

// fetch normalizes dot segments before sending. Raw HTTP is required to test
// the server's own rejection rather than the client's URL normalization.
function rawStatus(base, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    const pending = request({ hostname: url.hostname, port: url.port, path, method: 'GET' }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    pending.on('error', reject);
    pending.end();
  });
}

export async function runServeLocalTests() {
  const tmp = fileURLToPath(new URL('../tmp/', import.meta.url));
  mkdirSync(tmp, { recursive: true });
  const root = mkdtempSync(join(tmp, 'serve-local-test-'));
  try {
    for (const dir of ['examples', 'src', 'tmp']) mkdirSync(join(root, dir));
    writeFileSync(join(root, 'examples/index.html'), '<h1>Demo</h1>');
    writeFileSync(join(root, 'src/test.js'), 'export const ok=true;');
    writeFileSync(join(root, 'tmp/private.json'), '{"notForServing":true}');
    writeFileSync(join(root, 'tmp/private.js'), 'not public');
    for (const dir of ['src/tmp', 'src/.git', 'examples/secrets', 'tests/profiles']) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, 'private.js'), 'not public');
    }
    writeFileSync(join(root, 'examples/secrets.json'), '{"notForServing":true}');
    for (const name of ['test.css', 'test.svg', 'test.jpeg', 'test.webp', 'test.woff2', 'test.otf']) writeFileSync(join(root, 'src', name), 'local asset');
    let linked = false;
    try { symlinkSync(join(root, 'tmp'), join(root, 'src/linked'), 'junction'); linked = true; }
    catch (error) { if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error; }
    await withServer(root, async (base) => {
      const index = await fetch(base + '/');
      assert.equal(index.status, 200); assert.match(index.headers.get('content-type'), /text\/html/);
      assert.equal(index.headers.get('cache-control'), 'no-store');
      assert.equal(index.headers.get('x-content-type-options'), 'nosniff');
      assert.equal((await fetch(base + '/src/test.js')).headers.get('content-type'), 'text/javascript; charset=utf-8');
      for (const [name, mime] of [['test.css', 'text/css; charset=utf-8'], ['test.svg', 'image/svg+xml'], ['test.jpeg', 'image/jpeg'], ['test.webp', 'image/webp'], ['test.woff2', 'font/woff2'], ['test.otf', 'font/otf']]) {
        const asset = await fetch(base + '/src/' + name);
        assert.equal(asset.status, 200);
        assert.equal(asset.headers.get('content-type'), mime);
        assert.equal(await asset.text(), 'local asset');
      }
      const head = await fetch(base + '/examples/index.html', { method: 'HEAD' });
      assert.equal(head.status, 200); assert.equal(await head.text(), '');
      for (const path of ['/tmp/private.json', '/.git/config', '/docs/secret.md', '/src/%2e%2e%2ftmp/private.json', '/src/%5ctmp/private.json', '/src/%ZZ', '/src/', '/src/absent.js', '/src/tmp/private.js', '/src/.git/private.js', '/examples/secrets/private.js', '/tests/profiles/private.js', '/examples/secrets.json', '/docs/LOCAL-DEMO.md', '/package.json', '/scripts/serve-local.js']) assert.equal((await fetch(base + path)).status, 404, path);
      for (const path of ['/src/../tmp/private.js', '/src/%2e%2e/tmp/private.js', '/src/%00/test.js', '/src/%2F../tmp/private.js', '/src/tmp./private.js', '/src/tmp%20/private.js', '/src/test.js:stream.js', '/src/test.js%3Astream.js']) assert.equal(await rawStatus(base, path), 404, path);
      if (linked) assert.equal((await fetch(base + '/src/linked/private.js')).status, 404);
      for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
        const denied = await fetch(base + '/src/test.js', { method });
        assert.equal(denied.status, 405);
        assert.equal(denied.headers.get('allow'), 'GET, HEAD');
      }
      assert.equal(readFileSync(join(root, 'src/test.js'), 'utf8'), 'export const ok=true;', 'Rejected writes leave source unchanged');
    });
    if (linked) {
      const linkedRoot = join(root, 'linked-root');
      symlinkSync(root, linkedRoot, 'junction');
      await withServer(linkedRoot, async (base) => assert.equal((await fetch(base + '/')).status, 404));
      rmSync(linkedRoot);
      const linkedTop = join(root, 'top-level-link');
      mkdirSync(linkedTop);
      symlinkSync(join(root, 'examples'), join(linkedTop, 'examples'), 'junction');
      await withServer(linkedTop, async (base) => assert.equal((await fetch(base + '/')).status, 404));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
  console.log('ok - loopback demo server: MIME, HEAD, no-store, no private directories, traversal or writes');

  await withServer(PROJECT, async (base) => {
    for (const page of ['index.html', 'admin.html']) {
      const response = await fetch(base + '/examples/' + page);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.equal(html, readFileSync(join(PROJECT, 'examples', page), 'utf8'), 'Serve actual example bytes, not a synthetic placeholder');
      assert.equal(Number(response.headers.get('content-length')), Buffer.byteLength(html));
      const imports = [...html.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
      assert.ok(imports.length > 0);
      const styles = [...html.matchAll(/<link\b[^>]*href=['"]([^'"]+)['"]/g)].map((match) => match[1]);
      for (const path of [...imports, ...styles]) {
        const url = new URL(path, `${base}/examples/${page}`);
        assert.equal(url.origin, base, 'Only loopback example assets');
        const asset = await fetch(url);
        assert.equal(asset.status, 200, path);
        assert.match(asset.headers.get('content-type'), /^(?:text\/javascript|text\/css); charset=utf-8$/);
      }
    }
  });
  console.log('ok - loopback demo server serves real public/admin example bytes and their direct owned module/style entrypoints');
}
