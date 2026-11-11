import assert from'node:assert/strict';import{readFile,writeFile,mkdir,mkdtemp,symlink,unlink}from'node:fs/promises';import{resolve,basename}from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';import{runInNewContext}from'node:vm';
import{stageOperationalUpgrade,readOperationalConfiguration}from'../scripts/stage-operational-upgrade.js';
const PROJECT=fileURLToPath(new URL('../',import.meta.url));
export async function runOperationalUpgradeStageTests(){
  const keys=['articles','categories','tags','menu','extensions','templates','moduleInstances','siteConfig'];
  const baseUrl='/sites/example/SiteAssets/minijoomla/packages/pilot/1.0.0/';
  const css=[`${baseUrl}media/first.css`,`${baseUrl}media/second.css`,`${baseUrl}media/first.css`];
  const config={webUrl:'/sites/example',libraryPath:'/sites/example/SiteAssets/minijoomla',lists:Object.fromEntries(keys.map((key,i)=>[key,{listId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`} ])),joomlaDiscoveryRoots:[{id:'pilot',baseUrl,inventoryHash:'a'.repeat(64),immutable:true,discover:false,future:{retain:true}}],moduleStyles:{pilot:css},moduleStyleRevisions:{pilot:{[`${baseUrl}modules/pilot/entry.js`]:css}},sampleData:{releaseBase:'/sites/example/SiteAssets/minijoomla/releases/0.8.0',mediaBase:'/sites/example/SiteAssets/minijoomla/sampledata/blog'},future:JSON.parse('{"keep":[false,null],"__proto__":{"keep":true}}')};
  config.future.text='";globalThis.executed=true;// </script> $& $` \x01 \u2028 \u2029';
  config.lists.future={unrecognized:true};
  let hooks=0;const getter=Object.defineProperty({...config},'future',{enumerable:true,get(){hooks++;return {};}});await assert.rejects(stageOperationalUpgrade({configuration:getter}));assert.equal(hooks,0);
  await assert.rejects(stageOperationalUpgrade({configuration:{...config,future:{toJSON(){hooks++;}}}}));assert.equal(hooks,0);
  const duplicate=structuredClone(config);duplicate.lists.tags.listId=duplicate.lists.articles.listId;await assert.rejects(stageOperationalUpgrade({configuration:duplicate}),/duplicadas/);
  await assert.rejects(stageOperationalUpgrade({configuration:{...config,joomlaDiscoveryRoots:Array.from({length:11},(_,i)=>({...config.joomlaDiscoveryRoots[0],id:`pilot${i}`}))}}));
  await assert.rejects(stageOperationalUpgrade({configuration:{...config,future:'x'.repeat(256*1024)}}),/256 KiB/);
  await mkdir(resolve(PROJECT,'tmp'),{recursive:true});const base=await mkdtemp(resolve(PROJECT,'tmp/operational-stage-test-'));
  const privatePath=`tmp/${basename(base)}/config.json`;await writeFile(resolve(PROJECT,privatePath),JSON.stringify(config));assert.deepEqual(await readOperationalConfiguration(privatePath),config);
  await assert.rejects(readOperationalConfiguration('tmp/../../outside.json'),/tmp/);
  const linked=resolve(base,'linked');await symlink(base,linked,process.platform==='win32'?'junction':'dir');
  try{await assert.rejects(readOperationalConfiguration(`tmp/${basename(base)}/linked/config.json`),/link\/junction/);}finally{await unlink(linked);}
  const large=`tmp/${basename(base)}/large.json`;await writeFile(resolve(PROJECT,large),'x'.repeat(256*1024+1));await assert.rejects(readOperationalConfiguration(large),/256 KiB/);
  const invalidUtf=`tmp/${basename(base)}/invalid.json`;await writeFile(resolve(PROJECT,invalidUtf),Buffer.from([0xff]));await assert.rejects(readOperationalConfiguration(invalidUtf));
  const before=JSON.stringify(config);const built=await stageOperationalUpgrade({version:'0.16.0',output:`tmp/${basename(base)}/release`,configuration:config});
  assert.equal(JSON.stringify(config),before);
  const host=await readFile(resolve(built.output,'host/host.js'),'utf8');const match=host.match(/^const PRECONFIGURED = (JSON\.parse\(.*\));$/m);assert.ok(match,'One declaration-only JSON.parse expression');
  const sandbox={};const runtime=runInNewContext(match[1],sandbox,{timeout:1000});assert.equal(JSON.stringify(runtime),before);assert.equal(sandbox.executed,undefined);
  assert.ok(Object.hasOwn(runtime.future,'__proto__'));assert.equal(Object.getPrototypeOf(runtime.future).keep,undefined);assert.equal(runtime.joomlaDiscoveryRoots[0].discover,false);assert.equal(runtime.moduleStyles.pilot.length,3);
  for(const file of built.manifest.files){const bytes=await readFile(resolve(built.output,file.path));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
  assert.equal(built.manifest.operationalUpgrade.provisioning,false);assert.equal(built.manifest.operationalUpgrade.configurationPreserved,true);
  const again=await stageOperationalUpgrade({version:'0.16.0',output:`tmp/${basename(base)}/second`,configuration:config});assert.deepEqual(again.manifest,built.manifest);assert.deepEqual(await readFile(resolve(again.output,'host/host.js')),await readFile(resolve(built.output,'host/host.js')));
  await assert.rejects(stageOperationalUpgrade({version:'0.16.0',output:`tmp/${basename(base)}/release`,configuration:config}));
  console.log('ok - operational upgrade stage: bounded unlinked private JSON, runtime __proto__/pins/discover:false/CSS order retained, deterministic hashes/new output only; no remote writes');
}
