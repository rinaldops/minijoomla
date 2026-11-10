import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stageGenericInstallation } from '../scripts/stage-generic-installation.js';
const PROJECT=fileURLToPath(new URL('../',import.meta.url));
export async function runGenericInstallationPackageTests() {
  await assert.rejects(stageGenericInstallation({version:'1.0.0',output:'../outside'}));
  // Full SharePoint package belongs to the explicit SPMIDDLE integration suite.
  await mkdir(resolve(PROJECT,'tmp'),{recursive:true});
  const container=await mkdtemp(resolve(PROJECT,'tmp/generic-package-test-'));
  const built=await stageGenericInstallation({version:'1.0.0',output:'tmp/'+container.split(/[\\/]/).at(-1)+'/package'});
  const paths=built.manifest.files.map(f=>f.path);
  for(const path of ['host/host.js','host/installation-context.js','host/public-snippet.html','host/administrator-snippet.html','installation/template.js','media/installation/installation.css'])assert.ok(paths.includes(path));
  for(const entry of built.manifest.files){const b=await readFile(resolve(built.output,entry.path));assert.equal(b.length,entry.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),entry.sha256);}
  const host=await readFile(resolve(built.output,'host/host.js'),'utf8');assert.ok(!host.includes('__CONFIG__'));assert.ok(host.includes('createInstallationService'));
  assert.equal(host.split('/* MINIJOOMLA_CONFIG */ null').length,2,'One explicit configuration injection expression');
  const injected=host.replace('/* MINIJOOMLA_CONFIG */ null','{"webUrl":"/sites/example","lists":{}}');
  assert.ok(!injected.includes('/* MINIJOOMLA_CONFIG */ null'));
  assert.ok(!paths.some(path=>/mod_videoteca|mod_forum/.test(path)));
  const installation=JSON.parse(await readFile(resolve(built.output,'installation-entrypoints.json'),'utf8'));
  assert.equal(installation.format,'minijoomla-host-installation-v1');
  assert.equal(installation.bootstrap,'host/loader.js');
  assert.equal(installation.publicationApproved,false);
  assert.equal(installation.infrastructureCreated,false);
  assert.deepEqual(installation.initialTemplates,{site:'cassiopeia',administrator:'atum'});
  assert.ok(paths.includes(installation.publicSnippet)&&paths.includes(installation.administratorSnippet));
  assert.equal(installation.mseLayout.default,'FullBleed');
  for(const name of ['layout.js','layout.css','spmiddle-mse-host.js']){
    const path=`host/spmiddle-layout/${name}`;assert.ok(paths.includes(path));
    assert.deepEqual(await readFile(resolve(built.output,path)),await readFile(resolve(PROJECT,'../SPMIDDLE/host-adapters/modern-script-editor',name)),'Preserve official adapter bytes');
  }
  for(const snippet of [installation.publicSnippet,installation.administratorSnippet]){
    const html=await readFile(resolve(built.output,snippet),'utf8');
    assert.ok(html.includes('data-spmiddle-layout="FullBleed"'));assert.ok(html.includes('data-minijoomla-mse-layout'));assert.ok(!html.includes('type="module"'));assert.ok(html.includes('/host/loader.js'));
    assert.ok(!html.includes('src="__RELEASE_BASE__/host/spmiddle-layout/spmiddle-mse-host.js"'),'CMS loader gates official layout import after CSS, without competing autostart');
  }
  await assert.rejects(stageGenericInstallation({version:'1.0.0',output:'tmp/'+container.split(/[\\/]/).at(-1)+'/package'}),/Existing output/);
  console.log('ok - generic installation package: host/UI/bootstrap inventoried with exact hashes, new immutable output and no TD modules; no site acceptance');
}
