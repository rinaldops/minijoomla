import { createServer } from 'node:http';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/vnd.microsoft.icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject' };
const within = (root, path) => path === root || (!relative(root, path).startsWith(`..${sep}`) && relative(root, path) !== '..' && !isAbsolute(relative(root, path)));
const PREFIX=/^packages\/[a-z0-9][a-z0-9_-]{0,63}$/;
const PRIVATE=/^(?:tmp|docs|profiles?|secrets?|credentials?|evidence|private)$/i;
const validPrefix=prefix=>typeof prefix==='string'&&PREFIX.test(prefix)&&!PRIVATE.test(prefix.split('/')[1]);
const blocked = path => !path.startsWith('/') || path.includes('//') || /[\\:\u0000-\u001f\u007f]/.test(path) || path.split('/').some(part => part.startsWith('.') || /[.\s]$/.test(part) || PRIVATE.test(part));
function mountRoots(input,projectRoot){
  if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw new TypeError('Invalid local package mounts');
  const descriptors=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(descriptors);
  if(keys.length>10)throw new TypeError('At most ten explicit local package mounts');
  const mounts=keys.map(prefix=>{
    const d=descriptors[prefix];
    if(!validPrefix(prefix)||!d.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string'||!isAbsolute(d.value))throw new TypeError('Use packages/<id> and an absolute dedicated package directory');
    const root=resolve(d.value);
    // Do not turn an alias into a way to expose otherwise excluded project
    // directories. Dedicated generated packages may live below tmp, not tmp
    // itself; private-named subtrees remain excluded regardless of URL alias.
    if(within(root,projectRoot)||['src','examples','tests','scripts','docs','host-adapters','tools','skills'].some(name=>within(resolve(projectRoot,name),root))||root===resolve(projectRoot,'tmp'))throw new TypeError('Mount must be separate from project source/private roots');
    for(let p=root;;p=dirname(p)){const name=basename(p);if(name.startsWith('.')||PRIVATE.test(name)&&!(name==='tmp'&&p!==root))throw new TypeError('Private package root/ancestor refused');if(p===dirname(p))break;}
    for(let p=root;;p=dirname(p)){if(lstatSync(p).isSymbolicLink())throw new TypeError('Linked package roots/ancestors refused');if(p===dirname(p))break;}
    if(!lstatSync(root).isDirectory())throw new TypeError('Package root must be a directory');
    return Object.freeze({prefix:`/${prefix}/`,root});
  });
  for(let i=0;i<mounts.length;i++)for(let j=0;j<i;j++)if(within(mounts[i].root,mounts[j].root)||within(mounts[j].root,mounts[i].root))throw new TypeError('Duplicate/overlapping physical package roots refused');
  return mounts;
}

// Demo server, loopback only. Private URL paths remain excluded; any dedicated
// generated assets below tmp require an explicit trusted package mount.
export function createLocalDemoServer({ root = PROJECT, extraRoots = {} } = {}) {
  root = resolve(root);
  // Trusted packages only, explicitly selected by the local operator. Dedicated
  // prefixes cannot shadow source routes or overlap; no production registration.
  const mounts=mountRoots(extraRoots,root);
  return createServer(async (request, response) => {
    const finish = (status, text) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(text); };
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); finish(405, 'Read-only local server'); return; }
    try {
      let path = decodeURIComponent((request.url ?? '/').split('?')[0]);
      if (path === '/') path = '/examples/index.html';
      // Colons/ambiguous Windows suffixes also reject alternate data streams
      // and aliases of otherwise excluded private directories.
      if (blocked(path)) { finish(404, 'Not found'); return; }
      const mount=mounts.find(m=>path.startsWith(m.prefix));
      if(!mount&&!/^\/(?:src|examples|tests)\//.test(path)){finish(404,'Not found');return;}
      const servedRoot=mount?.root??root,servedPath=mount?'/'+path.slice(mount.prefix.length):path;
      const file = resolve(servedRoot, `.${servedPath}`);
      const top = mount?servedRoot:resolve(root, path.split('/')[1]);
      if (!within(top, file)) { finish(404, 'Not found'); return; }
      // Refuse every symlink/junction, including a top-level served directory.
      let current = servedRoot;
      for(let p=servedRoot;;p=dirname(p)){if((await lstat(p)).isSymbolicLink()){finish(404,'Not found');return;}if(p===dirname(p))break;}
      for (const part of relative(servedRoot, file).split(sep)) {
        current = resolve(current, part);
        if ((await lstat(current)).isSymbolicLink()) { finish(404, 'Not found'); return; }
      }
      if (!within(servedRoot, await realpath(file)) || !(await lstat(file)).isFile() || !MIME[extname(file).toLowerCase()]) { finish(404, 'Not found'); return; }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()], 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) { finish(error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof URIError ? 404 : 500, 'Not found'); }
  });
}

export function parseLocalDemoArgs(args){
  let port=8080,portSeen=false;const extraRoots=Object.create(null);
  for(let i=0;i<args.length;i++){
    if(args[i]==='--port'&&!portSeen&&/^\d+$/.test(args[i+1]??'')){port=Number(args[++i]);portSeen=true;}
    else if(args[i]==='--extra-root'){
      const value=args[++i]??'',at=value.indexOf('='),prefix=value.slice(0,at),path=value.slice(at+1);
      if(at<1||!validPrefix(prefix)||!path||Object.hasOwn(extraRoots,prefix))throw new TypeError('Invalid or duplicate local package mount');
      extraRoots[prefix]=resolve(path);
    }else throw new TypeError('Invalid local server argument');
  }
  if(!Number.isInteger(port)||port<1024||port>65535)throw new TypeError('Port must be 1024..65535');
  return {port,extraRoots};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const {port,extraRoots}=parseLocalDemoArgs(process.argv.slice(2));
    const server = createLocalDemoServer({extraRoots});
    server.on('error', (error) => { console.error(`Local server: ${error.code}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Local demo only: http://127.0.0.1:${port}/examples/index.html and /examples/admin.html (Ctrl+C to stop)`));
  }catch(error){console.error('Usage: node scripts/serve-local.js [--port 1024..65535] [--extra-root packages/<id>=<directory> ...]');process.exitCode=1;}
}
