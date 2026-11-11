import {escapeHtml}from'../../../libraries/minijoomla/security/sanitize.js';
export function renderShell({config,modules,content,busy}){
  const params=config.templateParams??{};
  return `<div class="installed-template-proof" data-installed-params-proof><h1>${escapeHtml(config.siteName)}</h1><h2 data-param-title>${escapeHtml(params.heroTitle??'')}</h2><p data-param-limit>Itens: ${escapeHtml(params.itemsLimit??'')}</p><p data-param-color>${escapeHtml(params.tone??'')}</p><section data-custom-position>${modules['custom-hero']??''}</section><main aria-busy="${Boolean(busy)}">${content??''}</main></div>`;
}
