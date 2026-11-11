import assert from 'node:assert/strict';
import { renderInstallationPage, mountInstallationPage } from '../src/installation/template.js';
import { createInstallationJournal } from '../src/libraries/minijoomla/infrastructure/installation-journal.js';
import { createConfig } from '../src/libraries/minijoomla/core/config.js';

export async function runInstallationViewTests() {
  const ready = renderInstallationPage({ status: 'ready', message: '<safe>', plan: { lists: [{ title: 'Articles <&', exists: false }] } });
  assert.ok(ready.includes('data-install-form') && ready.includes('name="confirmed" required'));
  assert.ok(ready.includes('&lt;safe&gt;') && ready.includes('Articles &lt;&amp;'));
  for (const status of ['blocked','unavailable','installed']) assert.ok(!renderInstallationPage({status}).includes('data-install-form'));
  assert.ok(!renderInstallationPage({status:'partial',canResume:false}).includes('data-install-form'));
  assert.ok(renderInstallationPage({status:'partial',canResume:true}).includes('Retomar'));
  assert.ok(!renderInstallationPage({status:'ready'},{publicView:true}).includes('<form'));
  const records = new Map(), storage = { getItem:key=>records.get(key)??null, setItem:(key,value)=>records.set(key,value) };
  const journal = createInstallationJournal({storage,key:'minijoomla:installation:/sites/example'});
  assert.equal(journal.read(),null); journal.write({version:1,pending:null}); assert.deepEqual(journal.read(),{version:1,pending:null});
  storage.setItem('minijoomla:installation:/sites/example','corrupt');assert.throws(()=>journal.read());
  const featured = createConfig({homeView:'featured',homeCategory:''});assert.equal(featured.homeCategory,'');
  assert.throws(()=>createConfig({homeView:'category',homeCategory:''}));
  let installs=0;
  const root={innerHTML:'',isConnected:true,querySelector:()=>null};
  const controller=await mountInstallationPage({root,documentRef:{body:{},documentElement:{}},service:{inspect:async()=>({status:'ready'}),install:async()=>{installs++;}}});
  controller.stop();await controller.refresh();assert.equal(installs,0);
  let received;
  const elements=new Map([['confirmed',{checked:true}],['siteName',{value:'Example'}],['siteDescription',{value:''}]]);
  let submit;
  const button={disabled:false};
  const form={elements:{namedItem:name=>elements.get(name)},querySelector:()=>button,addEventListener:(type,handler)=>{if(type==='submit')submit=handler;}};
  const formRoot={innerHTML:'',isConnected:true,querySelector:selector=>selector==='[data-install-form]'?form:null};
  const inspectedPlan={token:'explicit-plan',lists:[]};
  const c=await mountInstallationPage({root:formRoot,documentRef:{body:{},documentElement:{}},service:{inspect:async()=>({status:'ready',plan:inspectedPlan}),install:async input=>{received=input;return {status:'partial'};}}});
  await submit({preventDefault(){}});assert.equal(received.confirm,true);assert.equal(received.plan,inspectedPlan);assert.deepEqual(received.settings,{siteName:'Example',siteDescription:''});c.stop();
  const failedRoot={innerHTML:'',isConnected:true,querySelector:()=>null};
  await mountInstallationPage({root:failedRoot,documentRef:{body:{},documentElement:{}},service:{inspect:async()=>({status:'installed',configuration:{}}),install:async()=>{throw Error('Must not install');}},onInstalled:async()=>{throw Error('Missing application resource');}});
  assert.ok(failedRoot.innerHTML.includes('role="alert"')&&failedRoot.innerHTML.includes('Não reinstale'));
  assert.ok(!failedRoot.innerHTML.includes('data-install-form'));
  console.log('ok - installation view: generic confirmation/escaping, public read-only gate, private journal and empty featured home');
}
