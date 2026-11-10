(function(){
  'use strict';
  const source=document.currentScript?.src;
  if(!source)throw new TypeError('Loader externo do MINIJOOMLA ausente.');
  const entry=new URL('./host.js',source);
  if(entry.origin!==location.origin || /__[A-Z_]+__/.test(entry.href))throw new TypeError('Configure a release local do MINIJOOMLA.');
  import(entry.href).catch(()=>{
    const root=document.querySelector('[data-minijoomla-admin-root], [data-minijoomla-site]');
    if(root){root.textContent='Não foi possível carregar o host do MINIJOOMLA.';root.setAttribute('role','alert');}
    console.error('MINIJOOMLA: host indisponível.');
  });
})();
