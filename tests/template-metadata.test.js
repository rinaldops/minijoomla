import assert from 'node:assert/strict';
import {readTemplateMetadata,packTemplateMetadata}from'../src/libraries/minijoomla/application/template-metadata.js';
export function runTemplateMetadataTests(){
  const defs=[{name:'bannerTitle',type:'text',label:'Título',default:'Padrão'}];
  for(const styles of [undefined,null,'',[], '["./template.css"]','./template.css'])assert.equal(readTemplateMetadata({styles}).metadataPresent,false);
  const packed=packTemplateMetadata('["./template.css"]',defs);const read=readTemplateMetadata({styles:packed});assert.equal(read.metadataPresent,true);assert.deepEqual(read.styles,['./template.css']);assert.deepEqual(read.definitions,defs);
  const unknown=JSON.stringify({...JSON.parse(packed),future:{keep:[false,null]},...JSON.parse('{"__proto__":{"keep":true}}')});
  const changed=JSON.parse(packTemplateMetadata(undefined,[...defs,{name:'limit',type:'number',default:2}],unknown));assert.deepEqual(changed.future,{keep:[false,null]});assert.deepEqual(changed.__proto__,{keep:true});assert.deepEqual(changed.styles,['./template.css']);assert.equal({}.keep,undefined);
  let getters=0;const css=Object.defineProperty([],0,{enumerable:true,get(){getters++;return './bad.css';}});assert.throws(()=>readTemplateMetadata({styles:css}));
  assert.throws(()=>readTemplateMetadata(Object.defineProperty({},'styles',{get(){getters++;return packed;}})));
  for(const styles of ['{bad','{}','{"format":"future","styles":[],"paramDefinitions":[]}',JSON.stringify({format:'minijoomla-template-metadata-v1',styles:[],paramDefinitions:[{name:'limit',type:'unknown'}]}),new Array(2),Object.assign(['./x.css'],{toJSON(){getters++;return [];}})])assert.throws(()=>readTemplateMetadata({styles}));
  assert.equal(getters,0);assert.throws(()=>readTemplateMetadata({styles:'x'.repeat(65537)}));
  assert.throws(()=>readTemplateMetadata({styles:{format:'minijoomla-template-metadata-v1',styles:[],paramDefinitions:[],future:'x'.repeat(65537)}}));
  assert.throws(()=>readTemplateMetadata({styles:['./'+'x'.repeat(65537)+'.css']}));
  Object.defineProperty(Object.prototype,'format',{configurable:true,get(){getters++;return 'minijoomla-template-metadata-v1';}});
  try{assert.throws(()=>readTemplateMetadata({styles:{styles:[],paramDefinitions:[]}}));assert.equal(getters,0);}finally{delete Object.prototype.format;}
  console.log('ok - template metadata: existing Styles envelope, legacy CSS, bounded inert declarations and unknown own data preservation without schema changes');
}
