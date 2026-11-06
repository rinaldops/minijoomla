import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';

export function renderDefault({ state = 'ready', settings = {}, siteName = '', now = new Date(), message } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const date = now instanceof Date ? now : new Date(now);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  const name = String(settings?.siteName || siteName || '').trim();
  const text = settings?.text ? ` ${escapeHtml(settings.text)}` : '';
  return `<footer class="module module-footer"><p>&copy; ${year}${name ? ` ${escapeHtml(name)}` : ''}${text}</p></footer>`;
}
