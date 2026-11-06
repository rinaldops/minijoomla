import { sanitizeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { heading, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';

/* `mod_custom`: HTML administrative passa sempre pelo sanitizador público. */
export const customHtmlModule = {
  name: 'custom-html', settingsSchema: { title: 'string', html: 'string' },
  settings: { position: 'sidebar', state: 'ready', html: '' },
  render({ state = 'ready', settings = {}, message, ...chrome } = {}) {
    const status = stateMessage(state, message); if (status) return status;
    const html = sanitizeHtml(settings?.html ?? '');
    if (!html.trim()) return '<p class="module-empty" role="status">Nenhum conteúdo configurado.</p>';
    const title = settings?.title ? heading(settings.title, chrome) : '';
    return `<section class="module module-custom-html">${title}<div class="custom-html">${html}</div></section>`;
  }
};

export default customHtmlModule;
