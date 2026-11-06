import { ValidationError } from '../core/contracts.js';

export const TEMPLATE_POSITIONS = Object.freeze(['topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer', 'component']);
export const BUILTIN_MODULE_KEYS = Object.freeze(['articles-latest', 'articles-category', 'articles-news', 'tags-similar', 'tags-popular', 'articles-archive', 'custom-html', 'search', 'login', 'articles-categories', 'related-items', 'footer', 'articles']);

export const NATIVE_PLUGIN_KEYS = Object.freeze(['emailcloak', 'pagebreak', 'loadmodule', 'pagenavigation']);
export const NATIVE_PLUGIN_URLS = Object.freeze(NATIVE_PLUGIN_KEYS.map((key) => `native:${key}`));

export function extensionKey(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value.trim())) throw new ValidationError('key deve conter apenas letras, números, ponto, hífen ou underscore.');
  return value.trim();
}

export function assetUrl(value, field = 'entryPointUrl') {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(`${field} é obrigatório.`);
  const url = value.trim();
  if (/[\s\\\u0000-\u001f\u007f]/.test(url) || url.startsWith('//') || url.startsWith('#') || url.startsWith('?')) throw new ValidationError(`${field} deve ser um caminho relativo ou URL HTTPS segura.`);
  let parsed;
  try { parsed = new URL(url, 'https://minijoomla.invalid/'); } catch { throw new ValidationError(`${field} inválido.`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new ValidationError(`${field} deve ser um caminho relativo ou URL HTTPS segura.`);
  return url;
}

/*
 * Entrypoint de código (módulo ES de Module/Plugin/Template): restrição
 * MAIS FORTE que `assetUrl` — rejeita qualquer esquema/origem, nunca só
 * `javascript:`/`data:`/credenciais. O manifesto registrado aqui é
 * `import()`ado diretamente no navegador do visitante/administrador
 * (ver `modules/dynamic-modules.js` `ensureModuleRegistered`/
 * `ensurePluginsRegistered`, `application/template-runtime.js`
 * `resolve`) — uma origem externa aceita nesta validação seria execução
 * remota de código arbitrário dentro da origem do site, não apenas um
 * link malformado. Usada por TODO caminho de escrita de entrypoint
 * (instalador por manifesto colado, descoberta por pasta,
 * create/update direto do admin-service) — nunca apenas um dos
 * caminhos, para não deixar uma porta mais frouxa que as demais.
 */
export function sameSiteModuleUrl(value, field = 'entryPointUrl') {
  if (NATIVE_PLUGIN_URLS.includes(value)) return value;
  const url = assetUrl(value, field);
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//') || url.includes('\\')) throw new ValidationError(`${field} deve ser um caminho do próprio site.`);
  if (!/\.m?js(?:[?#].*)?$/i.test(url)) throw new ValidationError(`${field} deve apontar para um módulo .js.`);
  return url;
}

export function enabledValue(value, field = 'enabled') {
  if (typeof value !== 'boolean') throw new ValidationError(`${field} deve ser booleano.`);
  return value;
}

export function jsonObject(value, field = 'settings') {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { throw new ValidationError(`${field} deve ser JSON válido.`); }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || ![Object.prototype, null].includes(Object.getPrototypeOf(parsed))) throw new ValidationError(`${field} deve ser um objeto JSON.`);
  try {
    const serialized = JSON.stringify(parsed, (key, entry) => {
      if (typeof entry === 'number' && !Number.isFinite(entry) || ['function', 'undefined', 'symbol', 'bigint'].includes(typeof entry)) throw new Error();
      return entry;
    });
    return serialized;
  } catch { throw new ValidationError(`${field} deve ser um objeto JSON serializável.`); }
}

export function templatePositions(value) {
  let positions = value;
  if (typeof positions === 'string') {
    try { positions = JSON.parse(positions); } catch { throw new ValidationError('positionsJson deve ser um array JSON válido.'); }
  }
  if (!Array.isArray(positions) || !positions.length || positions.some((position) => !TEMPLATE_POSITIONS.includes(position))) throw new ValidationError('positions contém uma posição inválida.');
  return JSON.stringify([...new Set(positions)]);
}

export function templateStyles(value) {
  if (value === '' || value === null || value === undefined) return '';
  let styles = value;
  if (typeof styles === 'string') {
    const text = styles.trim();
    // Older manifests used a single path; persist the canonical array on the next save.
    if (!/^[\[{]/.test(text)) styles = [assetUrl(text, 'styles')];
    else {
      try { styles = JSON.parse(text); } catch { throw new ValidationError('styles deve ser um array JSON de URLs.'); }
    }
  }
  if (!Array.isArray(styles)) throw new ValidationError('styles deve ser um array JSON de URLs.');
  return JSON.stringify(styles.map((url) => assetUrl(url, 'styles')));
}
