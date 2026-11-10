/** Isolated fixture: application ports are memory-only; layout is official SPMIDDLE. */
export async function mountLayoutProof({documentRef,applyLayout,siteFactory,adminFactory}){
  const siteRoot=documentRef.querySelector('[data-layout-proof-site]');
  const adminRoot=documentRef.querySelector('[data-layout-proof-admin]');
  const siteController=await applyLayout(siteRoot),adminController=await applyLayout(adminRoot);
  const site=await siteFactory(siteRoot),admin=await adminFactory(adminRoot);
  let mode='Contained';
  documentRef.querySelector('#layout-proof-toggle').addEventListener('click',()=>{
    mode=mode==='Contained'?'FullBleed':'Contained';
    for(const root of [siteRoot,adminRoot])root.closest('[data-spmiddle-host]').setAttribute('data-spmiddle-layout',mode);
    siteController.refresh();adminController.refresh();documentRef.querySelector('#layout-proof-mode').textContent=mode;
  });
  return {site,admin,siteController,adminController,dispose(){site.stop();admin.stop();siteController.dispose();adminController.dispose();}};
}
