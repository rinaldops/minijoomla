import assert from 'node:assert/strict';
import { withSharePointMediaFolder, toSharePointFileTransport } from '../src/libraries/minijoomla/infrastructure/sharepoint-media-folder.js';
import { createMediaUploadService } from '../src/libraries/minijoomla/application/media-upload-service.js';

function fixture(webUrl='/sites/example', packageName='minijoomla') {
  const libraryPath=`${webUrl}/SiteAssets/${packageName}`, path=`${libraryPath}/uploads`;
  const state={exists:false,base:true,calls:[],uploads:[],failure:null,createFailure:null};
  const transport={webUrl,async request(url,options){
    state.calls.push({url,...options});
    if(state.failure)throw Object.assign(new Error('read denied'),{status:state.failure});
    if(options.method==='GET'){
      const target=url.includes(`decodedurl='${path}'`)?path:libraryPath;
      if(target===path?!state.exists:!state.base)throw Object.assign(new Error('missing'),{status:404});
      return {status:200,data:{Exists:true,ServerRelativeUrl:target}};
    }
    assert.equal(options.method,'POST');assert.ok(url.endsWith(`/folders/AddUsingPath(decodedurl='${path}')`));
    state.exists=true;if(state.createFailure)throw state.createFailure;
    return {status:201,data:{ServerRelativeUrl:path}};
  }};
  const fileClient={async listFiles(){return {status:200,data:{value:[]}};},async uploadFile(input){state.uploads.push(input);return {data:{ServerRelativeUrl:`${path}/${input.fileName}`}};}};
  const client=withSharePointMediaFolder({fileClient,transport,libraryPath});
  return {state,client,service:createMediaUploadService(client),transport};
}
export async function runSharePointMediaFolderTests() {
  const f=fixture();assert.deepEqual(await f.service.list(),[]);assert.equal(f.state.calls.filter(c=>c.method!=='GET').length,0);
  const image={content:new Uint8Array([1,2,3]),mimeType:'image/png'};
  await f.service.uploadImage(image);assert.equal(f.state.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.state.uploads[0].overwrite,false);
  await f.service.uploadImage(image);assert.equal(f.state.calls.filter(c=>c.method==='POST').length,1);
  for(const status of [403,503]){const denied=fixture();denied.state.failure=status;await assert.rejects(denied.service.list());await assert.rejects(denied.service.uploadImage(image));assert.equal(denied.state.uploads.length,0);assert.equal(denied.state.calls.filter(c=>c.method==='POST').length,0);}
  const broken=fixture();broken.state.base=false;await assert.rejects(broken.service.list());await assert.rejects(broken.service.uploadImage(image));assert.equal(broken.state.calls.filter(c=>c.method==='POST').length,0);
  const uncertain=fixture();uncertain.state.createFailure=Error('uncertain create');await assert.rejects(uncertain.service.uploadImage(image));assert.equal(uncertain.state.calls.filter(c=>c.method==='POST').length,1);assert.equal(uncertain.state.uploads.length,0);
  const invalid=fixture();await assert.rejects(invalid.service.uploadImage({...image,mimeType:'application/pdf'}));assert.equal(invalid.state.calls.length,0);
  await assert.rejects(f.client.uploadFile({folderPath:'../outside'}));
  const transport=toSharePointFileTransport({webUrl:'',request(){}});assert.equal(transport.webUrl,'/');
  assert.equal(toSharePointFileTransport(f.transport).webUrl,'/sites/example');
  const customized=fixture('/sites/example','minijoomla.v1');assert.deepEqual(await customized.service.list(),[]);await customized.service.uploadImage(image);assert.equal(customized.state.uploads.length,1);
  const root=fixture('');assert.deepEqual(await root.service.list(),[]);await root.service.uploadImage(image);assert.ok(root.state.calls.every(c=>c.url.startsWith('/_api/')));
  for(const libraryPath of ['/sites/other/SiteAssets/x','/sites/example/SiteAssets/x/../y','//evil/SiteAssets/x'])assert.throws(()=>withSharePointMediaFolder({fileClient:f.client,transport:f.transport,libraryPath}));
  console.log('ok - media folder: missing uploads reads empty without writes, explicit first upload creates only child once, errors fail closed, invalid images cannot create folders and root transport compatibility');
}
