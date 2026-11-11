/** Width belongs to the publisher's SPMIDDLE wrapper, not the CMS settings. */
export async function prepareMseLayout({root,documentRef=root?.ownerDocument,hostApi,timeoutMs=8000}={}) {
  if(!root)throw new TypeError('Raiz do MINIJOOMLA ausente.');
  const wrapper=root.closest?.('[data-spmiddle-host]');
  if(!wrapper)return null; // Existing pages keep their legacy contained mounting.
  if(wrapper===root)throw new TypeError('Wrapper de publicação deve ser separado da raiz do CMS.');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new TypeError('Prazo de layout inválido.');
  const expected=new URL('./spmiddle-layout/layout.css',import.meta.url).href;
  const candidates=documentRef?.querySelectorAll?.('link[rel="stylesheet"]')??[documentRef?.querySelector?.('[data-minijoomla-mse-layout]')];
  const style=Array.from(candidates).find(link=>{try{return link?.tagName==='LINK'&&link.rel==='stylesheet'&&link.disabled!==true&&new URL(link.href,documentRef.baseURI??import.meta.url).href===expected;}catch{return false;}});
  if(!style || style.tagName!=='LINK' || style.rel!=='stylesheet' || style.disabled===true)throw new TypeError('CSS do host MSE ausente.');
  const readiness=hostApi===undefined?null:Promise.resolve(hostApi?.ready);
  readiness?.catch(()=>{});
  if(!style.sheet)await new Promise((resolve,reject)=>{
    const clear=()=>{clearTimeout(timer);style.removeEventListener('load',loaded);style.removeEventListener('error',failed);};
    const loaded=()=>{clear();resolve();},failed=()=>{clear();reject(new TypeError('CSS do host MSE indisponível.'));};
    const timer=setTimeout(failed,timeoutMs);
    style.addEventListener('load',loaded,{once:true});style.addEventListener('error',failed,{once:true});
    if(style.sheet)loaded();
  });
  if(hostApi!==undefined&&(!hostApi?.ready||typeof hostApi.ready.then!=='function'))throw new TypeError('Host MSE/SPMIDDLE indisponível.');
  let timer;
  const pending=readiness??import('./spmiddle-layout/layout.js');
  const api=await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new TypeError('Host MSE excedeu o prazo de montagem.')),timeoutMs);})]).finally(()=>clearTimeout(timer));
  if(root.isConnected===false || wrapper.isConnected===false)throw new TypeError('Montagem MSE cancelada após remoção da raiz.');
  if(typeof api?.applyMseLayout!=='function')throw new TypeError('Contrato de layout MSE inválido.');
  const controller=api.applyMseLayout(wrapper);
  if(typeof controller?.refresh!=='function'||typeof controller?.dispose!=='function')throw new TypeError('Controlador MSE inválido.');
  let disposed=false;
  return Object.freeze({refresh(){if(!disposed)return controller.refresh();},dispose(){if(disposed)return;disposed=true;controller.dispose();}});
}
