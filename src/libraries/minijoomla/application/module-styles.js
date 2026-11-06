import { packagePath } from './package-path.js';

// Only the publisher's host map is authoritative. Instance settings are not URLs.
export function createModuleStyles({ moduleStyles = {}, moduleStyleRevisions = {}, documentRef } = {}) {
  if (!moduleStyles || typeof moduleStyles !== 'object' || Array.isArray(moduleStyles)) throw new TypeError('moduleStyles deve mapear chaves para listas CSS.');
  function resource(value, suffix) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) throw new TypeError('Recurso deve ser server-relative.');
    packagePath(value.slice(1));
    const base = new URL(documentRef?.baseURI);
    const url = new URL(value, base);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== base.origin || !url.pathname.endsWith(suffix)) throw new TypeError('Recurso nao aprovado para esta origem.');
    return url.href;
  }
  function css(styles) {
    if (!Array.isArray(styles)) throw new TypeError('Lista de estilos invalida.');
    return [...new Set(styles.map((style) => resource(style, '.css')))];
  }
  const approved = new Map();
  for (const [key, styles] of Object.entries(moduleStyles)) {
    approved.set(key, css(styles));
  }
  const links = new Map();
  const revisionMaps = new Map();
  if (!moduleStyleRevisions || typeof moduleStyleRevisions !== 'object' || Array.isArray(moduleStyleRevisions)) throw new TypeError('Revisoes CSS invalidas.');
  for (const [key, revisions] of Object.entries(moduleStyleRevisions)) {
    if (!revisions || typeof revisions !== 'object' || Array.isArray(revisions)) throw new TypeError('Mapa de revisoes CSS invalido.');
    const map = new Map();
    for (const [url, styles] of Object.entries(revisions)) {
      resource(url, '.js');
      map.set(url, css(styles));
    }
    revisionMaps.set(key, map);
  }
  function clear() { for (const link of links.values()) link.remove(); links.clear(); }
  function apply(keys, records = []) {
    if (!documentRef?.head?.appendChild || !documentRef.createElement) return;
    const wanted = new Set(keys.flatMap((key) => revisionMaps.has(key)
      ? revisionMaps.get(key).get(records.find((row) => row.key === key)?.entryPointUrl) ?? [] : approved.get(key) ?? []));
    for (const [url, link] of links) if (!wanted.has(url)) { link.remove(); links.delete(url); }
    for (const url of wanted) if (!links.has(url)) {
      const link = documentRef.createElement('link');
      link.rel = 'stylesheet'; link.href = url;
      link.setAttribute('data-mj-module-style', '');
      link.addEventListener?.('error', () => console.warn('MINIJOOMLA: falha no CSS de modulo.'), { once: true });
      links.set(url, link); documentRef.head.appendChild(link);
    }
  }
  return Object.freeze({ apply, clear });
}
