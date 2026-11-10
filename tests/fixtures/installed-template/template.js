import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
export function renderShell({config,content,modules,busy}) {
  return `<div data-installed-template-proof class="installed-template-proof"><header><h1>${escapeHtml(config.siteName)}</h1></header><section data-custom-position aria-label="Posição própria do template">${modules['custom-hero']??''}</section><main aria-busy="${Boolean(busy)}">${content??''}</main><footer>${modules.footer??''}</footer></div>`;
}
