import { ValidationError } from '../core/contracts.js';
import { parseJsonObject } from './declared-params.js';

// Lista reservada, sempre válida, de posições ESTRUTURAIS: usada pelos
// templates builtin (`default`/`cassiopeia`/`camap`) e como piso mínimo
// para qualquer template, instalado ou não. Um template INSTALADO
// (manifesto `<key>.manifest.json`, mecanismo descrito em
// MINIJOOMLA/docs/TEMPLATE-INSTALL-CONTRACT.md) pode declarar suas
// próprias posições adicionais, fora desta lista — `templatePositions()`
// abaixo aceita qualquer nome bem-formado (`isWellFormedPositionName`),
// não só os desta lista fechada. Isso permite instalar um template com
// posições semânticas próprias (ex. `hero`, `menu-principal`) sem editar
// este arquivo a cada posição nova — generalização introduzida no pivô de
// empacotamento do `camap-v3` (ver web-devs/CAMAP-V3/minijoomla-template/),
// mas aplicável a qualquer template instalado futuro, não só a esse.
export const STRUCTURAL_TEMPLATE_POSITIONS = Object.freeze(['topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer', 'component']);
// Nome retrocompatível (mesmo valor) — alguns call sites antigos ainda o
// importam sob este nome; novo código deve preferir STRUCTURAL_TEMPLATE_POSITIONS.
export const TEMPLATE_POSITIONS = STRUCTURAL_TEMPLATE_POSITIONS;
export const BUILTIN_MODULE_KEYS = Object.freeze(['articles-latest', 'articles-category', 'articles-news', 'articles-featured', 'tags-similar', 'tags-popular', 'articles-archive', 'custom-html', 'search', 'login', 'articles-categories', 'related-items', 'footer', 'articles']);

/*
 * Formato de nome de posição declarada por um template instalado: minúsculas,
 * começa com letra, hífens permitidos, 2-41 caracteres. Verificação
 * APENAS de forma — não verifica pertencimento a nenhuma enumeração. Usada
 * por `templatePositions()` para aceitar posições fora de
 * `STRUCTURAL_TEMPLATE_POSITIONS` sem abrir a porta para valores
 * arbitrários (espaços, maiúsculas, símbolos). Também recusa nomes que
 * colidiriam com propriedades herdadas de Object (`constructor`,
 * `prototype`, `__proto__`), evitando poluição de protótipo em consumidores
 * que indexam um mapa por nome de posição.
 */
export function isWellFormedPositionName(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{1,40}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
}

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
  // Callers handle historical absent/null/empty fields explicitly. This
  // serialization boundary accepts data only, never getters or toJSON hooks.
  if (value === undefined || value === null || value === '') throw new ValidationError(`${field} deve ser um objeto JSON.`);
  return JSON.stringify(parseJsonObject(value, { strict: true, field }));
}

/*
 * `positions`: aceita qualquer combinação de posições ESTRUTURAIS
 * (`STRUCTURAL_TEMPLATE_POSITIONS`) e/ou posições declaradas por um
 * template instalado (`isWellFormedPositionName`) — mudança estritamente
 * aditiva: nada que já era aceito deixa de ser; nomes malformados
 * continuam rejeitados. Usada tanto no registro direto de template
 * (`admin-service.js`) quanto na descoberta por manifesto
 * (`extension-discovery-service.js`, `extension-manifest.js`).
 */
export function templatePositions(value) {
  let positions = value;
  if (typeof positions === 'string') {
    try { positions = JSON.parse(positions); } catch { throw new ValidationError('positionsJson deve ser um array JSON válido.'); }
  }
  if (!Array.isArray(positions) || positions.length < 1 || positions.length > 100) throw new ValidationError('positions contém uma posição inválida.');
  const descriptors = Object.getOwnPropertyDescriptors(positions);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== positions.length + 1 || keys.some(key => typeof key !== 'string' || key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))) throw new ValidationError('positions deve ser uma lista densa de dados.');
  const values = [];
  for (let index = 0; index < positions.length; index++) {
    const descriptor = descriptors[index];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw new ValidationError('positions deve ser uma lista densa de dados.');
    const value = descriptor.value;
    if (!STRUCTURAL_TEMPLATE_POSITIONS.includes(value) && !isWellFormedPositionName(value)) throw new ValidationError('positions contém uma posição inválida.');
    values.push(value);
  }
  return JSON.stringify([...new Set(values)]);
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
