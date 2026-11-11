import{readFile,writeFile,lstat,open,realpath}from'node:fs/promises';
import{constants}from'node:fs';
import{resolve,dirname,relative,isAbsolute}from'node:path';
import{createHash}from'node:crypto';
import{fileURLToPath}from'node:url';
import{stageGenericInstallation}from'./stage-generic-installation.js';
import{normalizeExtensionsConfig}from'../src/libraries/minijoomla/application/joomla-host-config.js';
const PROJECT=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_CONFIG_BYTES=256*1024;
const LIST_KEYS=['articles','categories','tags','menu','extensions','templates','moduleInstances','siteConfig'];
/** Read only a bounded regular JSON file under this project's unlinked tmp. */
export async function readOperationalConfiguration(path){
  if(typeof path!=='string'||!path.startsWith('tmp/'))throw new TypeError('Configuração privada deve estar em tmp.');
  const file=resolve(PROJECT,path),tmp=resolve(PROJECT,'tmp');
  const contained=target=>{const p=relative(tmp,target);return p!==''&&!isAbsolute(p)&&p!=='..'&&!p.startsWith('../')&&!p.startsWith('..\\');};
  if(!contained(file))throw new TypeError('Configuração privada deve estar em tmp.');
  const noLinks=async()=>{
    for(let p=file;;p=dirname(p)){if((await lstat(p)).isSymbolicLink())throw new TypeError('Configuração por link/junction recusada.');if(p===dirname(p))break;}
    if(!contained(await realpath(file)))throw new TypeError('Configuração escapa de tmp.');
  };
  await noLinks();
  const handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size>MAX_CONFIG_BYTES)throw new TypeError('Configuração deve ser arquivo JSON regular de até 256 KiB.');
    const bytes=Buffer.alloc(MAX_CONFIG_BYTES+1);let count=0;
    while(count<bytes.length){const r=await handle.read(bytes,count,bytes.length-count,count);if(!r.bytesRead)break;count+=r.bytesRead;}
    if(count>MAX_CONFIG_BYTES)throw new TypeError('Configuração excede 256 KiB.');
    await noLinks();
    const final=await lstat(file);
    if(final.dev!==stat.dev||final.ino!==stat.ino)throw new TypeError('Arquivo de configuração mudou durante a leitura.');
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count)));
  }finally{await handle.close();}
}
/** Offline preconfigured upgrade: preserve operational data, never provision,
 * create installation receipts, install sample data or publish pages here. */
export async function stageOperationalUpgrade({version,output,configuration}={}){
  if(!configuration||typeof configuration!=='object'||Array.isArray(configuration))throw new TypeError('Configuração operacional ausente.');
  // Input should be an exported JSON file; descriptor validation rejects hooks.
  const cloned=clone(configuration);
  const web=cloned.webUrl==='/'?'':cloned.webUrl;
  const safe=value=>typeof value==='string'&&/^\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.includes('//')&&!value.endsWith('/')&&!value.split('/').some(p=>p==='.'||p==='..');
  if(typeof web!=='string'||web!==''&&!safe(web)||!safe(cloned.libraryPath)||!cloned.libraryPath.startsWith(`${web}/SiteAssets/`))throw new TypeError('Contexto operacional inválido.');
  if(!cloned.lists||Array.isArray(cloned.lists)||!LIST_KEYS.every(key=>Object.hasOwn(cloned.lists,key)&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(cloned.lists[key]?.listId??'')))throw new TypeError('Mapa operacional de listas inválido.');
  const ids=LIST_KEYS.map(key=>cloned.lists[key].listId.toLowerCase());if(new Set(ids).size!==ids.length||ids.some(id=>id==='00000000-0000-0000-0000-000000000000'))throw new TypeError('Identidades de listas duplicadas/inválidas.');
  normalizeExtensionsConfig({joomlaDiscoveryRoots:cloned.joomlaDiscoveryRoots??[],moduleStyles:cloned.moduleStyles??{},moduleStyleRevisions:cloned.moduleStyleRevisions??{}},{webUrl:cloned.webUrl});
  const built=await stageGenericInstallation({version,output});
  const hostPath=resolve(built.output,'host/host.js');
  const template=await readFile(hostPath,'utf8');
  if(template.split('/* MINIJOOMLA_CONFIG */ null').length!==2)throw new TypeError('Marcador operacional inválido.');
  // JSON.parse retains own __proto__ keys; an object literal would change their
  // semantics. Escape the string literal without evaluating any configuration.
  const json=JSON.stringify(JSON.stringify(cloned)).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  const bytes=Buffer.from(template.replace('/* MINIJOOMLA_CONFIG */ null',()=>`JSON.parse(${json})`));
  await writeFile(hostPath,bytes);
  const manifest=built.manifest;const entry=manifest.files.find(file=>file.path==='host/host.js');entry.bytes=bytes.length;entry.sha256=sha(bytes);
  manifest.operationalUpgrade={configurationPreserved:true,provisioning:false,sampleDataAutomatic:false};
  await writeFile(resolve(built.output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return {...built,manifest};
}
function clone(input){
  let nodes=0;const seen=new Set();
  const copy=(value,depth=0)=>{
    if(++nodes>10000||depth>20)throw new TypeError('Configuração excede limites.');
    if(value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value))return value;
    if(!value||typeof value!=='object'||seen.has(value)||!(Array.isArray(value)?Object.getPrototypeOf(value)===Array.prototype:[Object.prototype,null].includes(Object.getPrototypeOf(value))))throw new TypeError('Configuração deve conter apenas JSON.');
    seen.add(value);const array=Array.isArray(value),descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
    if(keys.some(key=>typeof key!=='string')||array&&(keys.length!==value.length+1||keys.filter(key=>key!=='length').some((key,index)=>key!==String(index))))throw new TypeError('Configuração JSON inválida.');
    const result=array?[]:{};
    for(const key of keys){if(array&&key==='length')continue;const d=descriptors[key];if(!d.enumerable||!Object.hasOwn(d,'value'))throw new TypeError('Configuração não admite getters.');Object.defineProperty(result,key,{value:copy(d.value,depth+1),enumerable:true,writable:true,configurable:true});}
    seen.delete(value);return result;
  };
  const value=copy(input);if(Buffer.byteLength(JSON.stringify(value))>MAX_CONFIG_BYTES)throw new TypeError('Configuração excede 256 KiB.');return value;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2);if(args.length!==6||args[0]!=='--version'||args[2]!=='--output'||args[4]!=='--configuration')throw new TypeError('Use --version X.Y.Z --output tmp/<new> --configuration tmp/<private>.json');
    const config=await readOperationalConfiguration(args[5]);const result=await stageOperationalUpgrade({version:args[1],output:args[3],configuration:config});console.log(JSON.stringify({files:result.manifest.files.length,operationalUpgrade:true,published:false}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
