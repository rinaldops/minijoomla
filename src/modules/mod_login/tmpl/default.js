import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';
import { heading, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';
import { empty } from '../../../libraries/minijoomla/modules/module-helpers.js';

export function renderDefault({ state = 'ready', settings = {}, session, message, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const name = String(settings?.session?.name ?? session?.name ?? '').trim();
  if (name) return `<section class="module module-login">${heading('Usuário', chrome)}<p class="login-greeting">${escapeHtml(settings?.greeting ?? 'Olá')}, <strong>${escapeHtml(name)}</strong></p></section>`;
  if (!settings?.loginUrl) return empty('Entrada indisponível.');
  return `<section class="module module-login">${heading('Usuário', chrome)}<p><a href="${safeUrl(settings.loginUrl)}">${escapeHtml(settings.loginText ?? 'Entrar')}</a></p></section>`;
}
