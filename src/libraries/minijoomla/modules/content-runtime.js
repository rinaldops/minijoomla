import { escapeHtml } from '../security/sanitize.js';

export function stateMessage(state, message) {
  if (state === 'loading') return '<p class="module-loading" role="status" aria-live="polite" aria-atomic="true">Carregando…</p>';
  if (state === 'error') return `<p class="module-error" role="alert">${escapeHtml(message || 'Não foi possível carregar o módulo.')}</p>`;
  return '';
}

export function limited(items, settings, defaultLimit) {
  const limit = Number(settings?.limit ?? defaultLimit);
  const size = Number.isFinite(limit) ? Math.min(50, Math.max(1, Math.trunc(limit))) : defaultLimit;
  return (Array.isArray(items) ? items : []).slice(0, size);
}

const HEADER_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p']);

/*
 * Título de módulo configurável (showTitle/headerTag/headerClass, aba
 * "Avançado" real do com_modules — ver module-catalog.js
 * MODULE_ADVANCED_PARAMS e dynamic-modules.js resolveModuleEntries, que
 * extrai esses três campos de settingsJson e os entrega aqui como
 * propriedades irmãs de `settings` no context). `headerTag` só aceita
 * uma allowlist fixa — nunca interpola uma tag arbitrária vinda de dados
 * persistidos sem essa validação, mesmo que já validada no painel.
 */
export function heading(text, { showTitle = true, headerTag = 'h2', headerClass = '' } = {}) {
  if (showTitle === false) return '';
  const tag = HEADER_TAGS.has(headerTag) ? headerTag : 'h2';
  const classAttr = headerClass ? ` class="${escapeHtml(headerClass)}"` : '';
  return `<${tag}${classAttr}>${escapeHtml(text)}</${tag}>`;
}
