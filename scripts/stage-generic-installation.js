import { readFile, writeFile, mkdir, lstat, mkdtemp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stageRelease } from './stage-release.js';
import { packagePath } from '../src/libraries/minijoomla/application/package-path.js';

const PROJECT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Offline copyable SharePoint package: no provisioning or page publication. */
export async function stageGenericInstallation({version,output}={}) {
  if(typeof output!=='string'||!output.startsWith('tmp/'))throw Error('New tmp output required');
  packagePath(output);
  const root=resolve(PROJECT,output);
  if(!root.startsWith(resolve(PROJECT,'tmp')+'/')&&!root.startsWith(resolve(PROJECT,'tmp')+'\\'))throw Error('Output escapes tmp');
  const noLinks=async path=>{for(let p=resolve(path);;p=dirname(p)){try{if((await lstat(p)).isSymbolicLink())throw Error('Linked output refused');}catch(e){if(e.code!=='ENOENT')throw e;}if(p===dirname(p))break;}};
  await noLinks(root);
  try{await lstat(root);throw Error('Existing output refused');}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(resolve(PROJECT,'tmp'),{recursive:true});
  const internal=await mkdtemp(resolve(PROJECT,'tmp/generic-installation-stage-'));
  const staged=stageRelease({version,output:resolve(internal,'payload'),target:'all'});
  const manifest=staged.manifest;
  const payloads=new Map(await Promise.all(manifest.files.map(async f=>[f.path,await readFile(resolve(staged.output,f.path))])));
  const hostBytes=await readFile(resolve(PROJECT,'host-adapters/modern-script-editor/host.js'));
  if(hostBytes.toString('utf8').split('/* MINIJOOMLA_CONFIG */ null').length!==2)throw Error('One generic host configuration marker required');
  const files=new Map([
    ['host/host.js',hostBytes],
    ['host/installation-context.js',await readFile(resolve(PROJECT,'host-adapters/modern-script-editor/installation-context.js'))],
    ['host/loader.js',Buffer.from("import('./host.js').catch(()=>console.error('MINIJOOMLA: host indisponível.'));\n")],
    ['host/admin.scoped.css',Buffer.from('@scope ([data-minijoomla-admin-root]) {\n'+(await readFile(resolve(PROJECT,'src/media/templates/administrator/atum/css/template.css'),'utf8')).replace(/^(:root|body)\s*\{/gm,':scope{')+'\n}\n')],
    ['host/public-snippet.html',await readFile(resolve(PROJECT,'host-adapters/modern-script-editor/public-installation-snippet.html'))],
    ['host/administrator-snippet.html',await readFile(resolve(PROJECT,'host-adapters/modern-script-editor/administrator-installation-snippet.html'))],
    ['installation-entrypoints.json',Buffer.from(JSON.stringify({
      format:'minijoomla-host-installation-v1',version,
      layout:'<web>/SiteAssets/minijoomla/releases/<version>',
      bootstrap:'host/loader.js',publicSnippet:'host/public-snippet.html',administratorSnippet:'host/administrator-snippet.html',
      configuration:'<web>/SiteAssets/minijoomla/installation.json',
      initialTemplates:{site:'cassiopeia',administrator:'atum'},
      infrastructureCreated:false,sampleDataAutomatic:false,extensionsAutomatic:false,
      publicationApproved:false
    },null,2)+'\n')]
  ]);
  for(const[path,bytes]of files){if(payloads.has(path))throw Error('Duplicate host payload');payloads.set(path,bytes);}
  // Fail closed on each literal local host import before materializing the
  // final package. Dynamic extension import gates remain the CMS contracts.
  for(const[path,bytes]of files){if(!path.endsWith('.js'))continue;for(const match of bytes.toString('utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)){
    const specifier=match[1];if(!specifier.startsWith('.'))throw Error('Nonlocal generic host import');
    const target=resolve(dirname(resolve(root,path)),specifier),relative=target.slice(root.length+1).replaceAll('\\','/');
    if(!target.startsWith(root+'/')&&!target.startsWith(root+'\\')||!payloads.has(relative))throw Error('Generic host import not inventoried');
  }}
  // Stylesheets/editor bases are not module imports, but are equally required
  // by the copied host. Directory bases must have an inventoried payload.
  for(const match of hostBytes.toString('utf8').matchAll(/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)){
    const target=resolve(root,'host',match[1]);
    const path=target===root?'':target.slice(root.length+1).replaceAll('\\','/');
    if(target!==root&&!target.startsWith(root+'/')&&!target.startsWith(root+'\\')||path&&!payloads.has(path)&&![...payloads.keys()].some(file=>file.startsWith(path.replace(/\/$/,'')+'/')))throw Error('Generic host resource not inventoried');
  }
  const finalManifest={...manifest,files:[...payloads].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes)}))};
  await noLinks(root);await mkdir(dirname(root),{recursive:true});await mkdir(root);
  for(const[path,bytes]of [...payloads,['manifest.json',Buffer.from(JSON.stringify(finalManifest,null,2)+'\n')]]){await mkdir(dirname(resolve(root,path)),{recursive:true});await noLinks(dirname(resolve(root,path)));await writeFile(resolve(root,path),bytes,{flag:'wx'});}
  return {...staged,output:root,manifest:finalManifest};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--version'||args[2]!=='--output')throw Error('Use --version X.Y.Z --output tmp/<new>');const result=await stageGenericInstallation({version:args[1],output:args[3]});console.log(`Generic copied installation: ${result.manifest.files.length} payloads; no tenant writes.`);}catch(error){console.error(error.message);process.exitCode=1;}
}
