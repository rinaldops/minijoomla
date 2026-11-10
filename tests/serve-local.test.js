import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalDemoServer, parseLocalDemoArgs } from '../scripts/serve-local.js';

const PROJECT = fileURLToPath(new URL('../', import.meta.url));

async function withServer(root, verify, extraRoots) {
  const server = createLocalDemoServer({ root, extraRoots });
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

  const packageRoot=mkdtempSync(join(tmp,'serve-package-test-'));
  try{
    const mounts={'packages/probe':packageRoot};
    for(const path of ['entry.js','modules/import.js','media/style.css','media/image.svg','media/font.woff2','docs/not-public.js','tmp/not-public.js']){mkdirSync(join(packageRoot,path,'..'),{recursive:true});writeFileSync(join(packageRoot,path),path);}
    for(const prefix of ['src','examples/p','tests/p','packages','packages/p/sub','packages/P','packages/../x','packages/p/','packages/tmp','packages/docs','packages/private','packages/profile','packages/secrets']){
      assert.throws(()=>createLocalDemoServer({extraRoots:{[prefix]:packageRoot}}));
      assert.throws(()=>parseLocalDemoArgs(['--extra-root',`${prefix}=${packageRoot}`]));
    }
    for(const dir of [PROJECT,join(PROJECT,'..'),join(PROJECT,'scripts'),join(PROJECT,'src'),join(PROJECT,'examples'),join(PROJECT,'docs'),tmp])assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/alias':dir}}),/separate/);
    assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/one':packageRoot,'packages/two':packageRoot}}),/physical/);
    assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/one':packageRoot,'packages/two':join(packageRoot,'media')}}),/physical/);
    assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/alias':join(packageRoot,'docs')}}),/Private/);
    assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/alias':join(packageRoot,'.git')}}),/Private/);
    assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/p':'relative'}}));
    assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/p':join(packageRoot,'missing')}}));
    assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/p':join(packageRoot,'entry.js')}}));
    let hooks=0;assert.throws(()=>createLocalDemoServer({extraRoots:Object.defineProperty({},'packages/p',{enumerable:true,get(){hooks++;}})}));assert.equal(hooks,0);
    assert.throws(()=>createLocalDemoServer({extraRoots:Object.fromEntries(Array.from({length:11},(_,i)=>[`packages/p${i}`,packageRoot]))}));
    for(const args of [['--port','1e4'],['--port','0x2345'],['--port',' 8080'],['--port','8080','--port','8081'],['--extra-root','packages/p='],['--extra-root',`packages/p=${packageRoot}`,'--extra-root',`packages/p=${packageRoot}`]])assert.throws(()=>parseLocalDemoArgs(args));
    assert.equal(parseLocalDemoArgs(['--port','8081','--extra-root',`packages/probe=${packageRoot}`]).extraRoots['packages/probe'],packageRoot);
    await withServer(PROJECT,async base=>{
      for(const path of ['entry.js','modules/import.js','media/style.css','media/image.svg','media/font.woff2']){
        const r=await fetch(base+'/packages/probe/'+path);assert.equal(r.status,200,path);assert.equal(await r.text(),path);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
        const h=await fetch(base+'/packages/probe/'+path,{method:'HEAD'});assert.equal(h.status,200);assert.equal(await h.text(),'');assert.equal(Number(h.headers.get('content-length')),Buffer.byteLength(path));
      }
      for(const path of ['/packages/probe','/packages/probe/','/packages/unknown/entry.js','/packages/probe/docs/not-public.js','/packages/probe/tmp/not-public.js','/packages/probe/absent.js','/packages/probe/../entry.js','/packages/probe/%2e%2e/entry.js','/packages/probe/media/%2e%2e/%2e%2e/entry.js','/packages/probe/%2f../entry.js','/packages/probe/media%5cstyle.css','/packages/probe/entry.js:stream.js','/packages//probe/entry.js','/packages/probe/%ZZ'])assert.equal(await rawStatus(base,path),404,path);
      assert.equal((await fetch(base+'/examples/index.html')).status,200);
      const denied=await fetch(base+'/packages/probe/entry.js',{method:'POST'});assert.equal(denied.status,405);assert.equal(readFileSync(join(packageRoot,'entry.js'),'utf8'),'entry.js');
    },mounts);
    let linked=false;const link=join(packageRoot,'linked');
    try{symlinkSync(packageRoot,link,'junction');linked=true;}catch(error){if(!['EPERM','EACCES','ENOTSUP'].includes(error.code))throw error;}
    if(linked){
      assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/probe':link}}),/Linked/);
      assert.throws(()=>createLocalDemoServer({extraRoots:{'packages/probe':join(link,'media')}}),/Linked/);
      await withServer(PROJECT,async base=>assert.equal(await rawStatus(base,'/packages/probe/linked/entry.js'),404),mounts);
      rmSync(link);
    }
  }finally{rmSync(packageRoot,{recursive:true,force:true});}
  console.log('ok - explicit trusted local package mounts: entry/import/CSS/media/HEAD, shared API/CLI gates, no shadowing/ambiguous prefixes/raw traversal/links/writes');
}
