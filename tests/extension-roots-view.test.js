import assert from 'node:assert/strict';
import { loadExtensionRootsPage } from '../src/administrator/components/com_installer/src/Controller/roots.js';

const shell = ({bodyHtml}) => bodyHtml;
const router = {link:path=>`#${path}`};
export async function runExtensionRootsViewTests() {
  const unavailable=await loadExtensionRootsPage({documentRef:{body:{}},router,shell});
  assert.ok(!unavailable.html.includes('data-root-add'));
  let current=true,writes=0,received;
  const status={textContent:''},button={disabled:false};
  const fields={confirmed:{checked:false},configuration:{value:'{}'}};
  let submit;
  const form={querySelector:selector=>selector==='button[type="submit"]'?button:fields[selector.match(/name="([^"]+)"/)?.[1]],addEventListener:(name,handler)=>{submit=handler;}};
  const root={querySelector:selector=>selector==='[data-root-add]'?form:selector==='[data-roots-status]'?status:null,querySelectorAll:selector=>selector.startsWith('[data-root-add]')?[form]:[]};
  const service={inspect:async()=>({status:'ready',etag:'"snapshot"',message:'Ready <&',configuration:{joomlaDiscoveryRoots:[]}}),add:async input=>{writes++;received=input;return {status:'ready',message:'Configuração salva; recarregue.'};}};
  const view=await loadExtensionRootsPage({service,documentRef:{body:root},router,shell,isCurrent:()=>current});
  assert.ok(view.html.includes('Ready &lt;&amp;')&&view.html.includes('required'));
  view.bind();await submit({preventDefault(){}});assert.equal(writes,0);
  fields.confirmed.checked=true;current=false;await submit({preventDefault(){}});assert.equal(writes,0);
  current=true;await submit({preventDefault(){}});assert.equal(writes,1);assert.equal(received.expectedETag,'"snapshot"');assert.equal(received.confirm,true);assert.equal(button.disabled,true);
  await submit({preventDefault(){}});assert.equal(writes,1,'Consumed snapshot never permits another submission');
  let toggle;
  const retained={id:'root<&',baseUrl:'/sites/example/SiteAssets/packages/v1/',discover:false};
  const toggler={dataset:{rootDiscovery:retained.id},querySelector:selector=>selector.includes('confirmed')?{checked:true}:button,addEventListener:(name,handler)=>{toggle=handler;}};
  const toggleRoot={querySelector:()=>null,querySelectorAll:()=>[toggler]};
  const retainedView=await loadExtensionRootsPage({service:{inspect:async()=>({status:'ready',etag:'"2"',configuration:{joomlaDiscoveryRoots:[retained]}}),setDiscover:async input=>{received=input;return {message:'Salvo'};}},documentRef:{body:toggleRoot},router,shell});
  assert.ok(retainedView.html.includes('Retida para revisão/rollback')&&retainedView.html.includes('root&lt;&amp;'));
  retainedView.bind();await toggle({preventDefault(){}});assert.equal(received.rootId,retained.id);assert.equal(received.discover,true);
  assert.equal(received.expectedETag,'"2"');
  console.log('ok - roots view: unavailable gate, explicit approval, escaping, captured ETag, stale/duplicate rejection and retained discovery toggle without installation');
}
