import assert from 'node:assert/strict';
import {createMapper,createRepository}from'../../SPMIDDLE/packages/data-core/src/index.js';
import {createSharePointListClient}from'../../SPMIDDLE/packages/sharepoint-rest-browser/src/index.js';
import {createSchemaMemoryTransport}from'./schema-migration.test.js';
import {MINIJOOMLA_SCHEMAS}from'../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';
import {MINIJOOMLA_FIELD_MAPPINGS}from'../src/libraries/minijoomla/infrastructure/spmiddle-repositories.js';
import {createAdminService}from'../src/libraries/minijoomla/application/admin-service.js';
import {readTemplateMetadata}from'../src/libraries/minijoomla/application/template-metadata.js';
import {createMiniJoomlaSiteApplication}from'../src/libraries/minijoomla/composition/createMiniJoomlaSiteApplication.js';
export async function runInstalledTemplateParamsSPMiddleTests(){
  const schema=MINIJOOMLA_SCHEMAS.templates;
  const transport=createSchemaMemoryTransport({webUrl:'/sites/example',title:schema.displayName,fields:schema.fields.map(field=>({InternalName:field.internalName,TypeAsString:field.type==='MultilineText'?'Note':field.type,Required:field.required===true}))});
  const client=createSharePointListClient({transport,listPath:`lists/getbytitle('${schema.displayName}')`});
  const repository=createRepository({source:'templates',schema,mapper:createMapper({mapping:MINIJOOMLA_FIELD_MAPPINGS.templates}),client});
  const admin=createAdminService({templates:repository});
  const definition=[{name:'heroTitle',type:'text',label:'Título',default:'Inicial'}];
  const row=await admin.templates.create({key:'installed-proof',title:'Installed',version:'1',entryPointUrl:'/SiteAssets/installed/index.js',positions:['custom-hero'],styles:['/SiteAssets/installed/style.css'],paramDefinitions:definition,enabled:false});
  const raw=transport.state.items.get(row.id);assert.equal(Object.hasOwn(raw,'ParamDefinitionsJson'),false);assert.equal(typeof raw.Styles,'string');
  const stored=await admin.templates.get(row.id);assert.equal(readTemplateMetadata(stored).definitions[0].name,'heroTitle');assert.ok(stored.etag);
  const transports=new Map();
  const lists={};
  for(const domain of ['articles','categories','siteConfig','templates']){
    const definition=MINIJOOMLA_SCHEMAS[domain];lists[domain]={listPath:`lists/getbytitle('${definition.displayName}')`};
    const t=domain==='templates'?transport:createSchemaMemoryTransport({webUrl:'/sites/example',title:definition.displayName,fields:definition.fields.map(f=>({InternalName:f.internalName}))});transports.set(definition.displayName,t);
  }
  const cfg=transports.get('MiniJoomlaSiteConfig');cfg.state.items.set(1,{Id:1,Title:'MiniJoomlaSiteConfig',TemplateKey:'installed-proof',HomeView:'featured',HomeCategory:'',TemplateStylesJson:'[{"id":"saved-home","template":"installed-proof","title":"Home","home":true,"params":{"heroTitle":"Persisted composition","future":{"keep":true}}}]'});
  raw.Enabled=true;
  const doc={baseURI:'https://site.invalid/SitePages/site.aspx',body:{innerHTML:''},head:{appendChild(){}},createElement:()=>({setAttribute(){},remove(){}})};
  const site=await createMiniJoomlaSiteApplication({webUrl:'/sites/example',lists,documentRef:doc,autoStart:false,transportFactory:()=>({webUrl:'/sites/example',request:(path,options)=>{const title=path.match(/getbytitle\('([^']+)'\)/)?.[1];return transports.get(title).request(path,options);}}),importModule:async()=>({renderShell:({config})=>`<h1>${config.templateParams.heroTitle}</h1><p>${config.templateParams.future.keep}</p><span>${config.templateStyleId}</span>`})});
  try{await site.application.start();assert.match(doc.body.innerHTML,/Persisted composition/);assert.match(doc.body.innerHTML,/saved-home/);assert.match(doc.body.innerHTML,/<p>true<\/p>/);}finally{site.application.stop();}
  await admin.templates.update(row.id,{title:'Renamed'},{etag:stored.etag});assert.equal(transport.state.items.get(row.id).Styles,raw.Styles);
  await assert.rejects(admin.templates.update(row.id,{title:'Stale'},{etag:stored.etag}));
  assert.equal(transport.state.requests.some(r=>r.method!=='GET'&&r.path.includes('/fields')),false,'Metadata never provisions fields');
  console.log('ok - installed template parameters: real SPMIDDLE schema/mapper/repository persists existing Styles envelope, exact metadata and ETag without a new column');
}
