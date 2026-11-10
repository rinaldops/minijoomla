import assert from'node:assert/strict';
import{createApplication}from'../src/index.js';
import{createAdminService}from'../src/libraries/minijoomla/application/admin-service.js';
import{createDemoRepositories}from'../examples/demo-repositories.js';
import{createSPMiddleAdapter}from'../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
export async function runArticlesFeaturedIntegrationTests(){
 const domains=Object.fromEntries(['articles','categories','tags','menu','extensions','templates','moduleInstances','siteConfig'].map(d=>[d,[]]));
 domains.articles=[{id:1,title:'Card destacado',alias:'card',state:'Published',featured:true,introtext:'<p>Resumo sanitizado</p>',fulltext:'<p>Corpo completo</p>',attribsJson:'{"images":{"image_intro":"/image.png","image_intro_alt":"Imagem"}}'},{id:2,title:'Não destacado',alias:'not-featured',state:'Published',featured:false}];
 const memory=new Map([['minijoomla-demo-v1',JSON.stringify({revision:1,domains})]]),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
 const repos=createDemoRepositories({storage}),admin=createAdminService(repos);
 assert.ok((await admin.moduleInstances.catalog()).some(type=>type.key==='articles-featured'));
 const doc={body:{innerHTML:''},head:{appendChild(){}},baseURI:'https://site.invalid/page',createElement:()=>({setAttribute(){},remove(){}})};
 const make=()=>createApplication({documentRef:doc,autoStart:false,config:{homeView:'featured',homeCategory:'',basePath:'/portal',timezone:'UTC'},adapter:createSPMiddleAdapter({articleRepository:repos.articles,categoryRepository:repos.categories,tagRepository:repos.tags,menuRepository:repos.menu}),getModuleInstances:async()=>(await repos.moduleInstances.findMany()).items,getExtensions:async()=>[],getTemplate:async()=>[]});
 let app=make();await app.start();assert.ok(!doc.body.innerHTML.includes('module-articles-featured'),'No native instance automatically installed');app.stop();
 const instance=await admin.moduleInstances.create({title:'Imagem e resumo',extensionKey:'articles-featured',position:'main-top',settings:{limit:1},enabled:true});
 app=make();try{await app.start();assert.match(doc.body.innerHTML,/module-articles-featured/);const moduleHtml=doc.body.innerHTML.split('module-articles-featured')[1].split('</section>')[0];assert.match(moduleHtml,/Resumo sanitizado/);assert.match(moduleHtml,/src="\/image.png"/);assert.match(moduleHtml,/href="#\/portal\/article\/card"/);assert.doesNotMatch(moduleHtml,/Não destacado/);}finally{app.stop();}
 await admin.moduleInstances.update(instance.id,{enabled:false},{etag:instance.etag});app=make();try{await app.start();assert.doesNotMatch(doc.body.innerHTML,/module-articles-featured/);}finally{app.stop();}
 assert.equal((await repos.extensions.findMany()).items.length,0);assert.equal((await repos.siteConfig.findMany()).items.length,0);
 const legacy=await repos.extensions.create({key:'articles-featured',type:'Module',title:'Legacy featured',entryPointUrl:'/legacy.js',enabled:true,manifestJson:'{"params":[]}'});
 const legacyInstance=await repos.moduleInstances.create({title:'Legacy instance',extensionKey:'articles-featured',position:'main-top',enabled:true,settingsJson:'{}'});
 let imports=0;const legacyApp=createApplication({documentRef:doc,autoStart:false,getModuleInstances:async()=>[legacyInstance],getExtensions:async()=>[legacy],importModule:async url=>{assert.equal(url,'/legacy.js');imports++;return {name:'legacy-featured',settings:{},render:()=>'<p>Legacy source retained</p>'};}});
 try{await legacyApp.start();assert.match(doc.body.innerHTML,/Legacy source retained/);assert.doesNotMatch(doc.body.innerHTML,/module-articles-featured/);assert.equal(imports,1);}finally{legacyApp.stop();}
 const catalog=await admin.moduleInstances.catalog();assert.equal(catalog.filter(r=>r.key==='articles-featured').length,1);assert.equal(catalog.find(r=>r.key==='articles-featured').builtin,false);
 const pluginDoc={...doc,body:{innerHTML:''}};const nativeRow={...legacyInstance,settingsJson:'{"limit":1}'};
 const pluginApp=createApplication({documentRef:pluginDoc,autoStart:false,config:{componentParams:{content:{showReadmore:false}},homeView:'featured',homeCategory:''},adapter:createSPMiddleAdapter({articleRepository:repos.articles,categoryRepository:repos.categories}),getModuleInstances:async()=>[nativeRow],getExtensions:async()=>[],plugins:[{name:'test-preparation',events:{onContentPrepare:(text,context)=>String(text??'')+'<p>Plugin prepared</p>'+(context.renderModule?.('articles-featured')??'')}}]});
 try{await pluginApp.start();const fragment=pluginDoc.body.innerHTML.split('module-articles-featured')[1].split('</section>')[0];assert.match(fragment,/Plugin prepared/);assert.doesNotMatch(fragment,/readmore/);}finally{pluginApp.stop();}
 const mixedAdapter=createSPMiddleAdapter({articleRepository:repos.articles,categoryRepository:repos.categories});
 const originalList=mixedAdapter.listArticles;
 const adapterWithExcluded={...mixedAdapter,listArticles:async query=>{const result=await originalList(query);return query?.featured?{...result,items:[{alias:'draft-first',title:'Draft first',state:'Draft',published:false,featured:true},...result.items]}:result;}};
 const mixedApp=createApplication({documentRef:doc,autoStart:false,adapter:adapterWithExcluded,getModuleInstances:async()=>[nativeRow],getExtensions:async()=>[]});
 try{await mixedApp.start();const fragment=doc.body.innerHTML.split('module-articles-featured')[1].split('</section>')[0];assert.match(fragment,/Card destacado/);assert.doesNotMatch(fragment,/Draft first|Nenhum destaque/);}finally{mixedApp.stop();}
 const unrelatedPlugin={key:'articles-featured',type:'Plugin',enabled:false,entryPointUrl:'/plugin.js'};
 const noModuleCollision=createApplication({documentRef:doc,autoStart:false,adapter:mixedAdapter,getModuleInstances:async()=>[nativeRow],getExtensions:async()=>[unrelatedPlugin]});
 try{await noModuleCollision.start();assert.match(doc.body.innerHTML,/module-articles-featured/);}finally{noModuleCollision.stop();}
 console.log('ok - articles featured integration: native catalog, explicit instance only, saved limit, basePath cards/images, disabled suppression and no extension/config rows');
}
