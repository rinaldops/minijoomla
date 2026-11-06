/*
 * Equivalente ao plugin loadmodule do Joomla: `{loadmodule nome}` e `{loadposition posição}`.
 * O host injeta context.renderModule(name) e context.renderPosition(position) (podem ser
 * assíncronos); a saída é sempre sanitizada e nunca reprocessada (sem recursão: placeholders
 * dentro da saída são removidos). Nomes só aceitam [A-Za-z0-9_-]; no máximo 10 por texto,
 * os excedentes e os inválidos são removidos.
 */
import { sanitizeHtml } from '../../../libraries/minijoomla/security/sanitize.js';

const TAG = /\{(loadmodule|loadposition)\s+([A-Za-z0-9_-]{1,64})\}/g;
const ANY = /\{(?:loadmodule|loadposition)\b[^}]*\}/g;
const MAX = 10;

export async function loadModules(text = '', context = {}) {
  const source = String(text);
  const rendered = new Map();
  let count = 0;
  for (const [token, kind, name] of source.matchAll(TAG)) {
    if (rendered.has(token) || count >= MAX) continue;
    count += 1;
    const render = kind === 'loadmodule' ? context.renderModule : context.renderPosition;
    let html = '';
    try { if (typeof render === 'function') html = sanitizeHtml(String(await render(name) ?? '')).replace(ANY, ''); } catch { html = ''; }
    rendered.set(token, html);
  }
  // Uma única passada sobre o texto original: a saída dos módulos nunca é reescaneada.
  return source.replace(ANY, (token) => rendered.get(token) ?? '');
}

export const loadmodulePlugin = {
  name: 'loadmodule', group: 'content',
  events: { onContentPrepare: (text, context) => loadModules(text, context) }
};
