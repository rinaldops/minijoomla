import { ValidationError } from '../core/contracts.js';
import { packageBase, packagePath } from './package-path.js';
import { extensionKey } from './extension-input.js';

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Configuracao de extensoes invalida.');
  return value;
}

export function normalizeExtensionsConfig(input = {}, { webUrl } = {}) {
  object(input);
  if (Object.keys(input).some((key) => !['joomlaDiscoveryRoots', 'moduleStyles', 'moduleStyleRevisions'].includes(key))) throw new ValidationError('Propriedade inesperada na configuracao de extensoes.');
  const site = webUrl === '/' ? '/' : packageBase(webUrl);
  const roots = input.joomlaDiscoveryRoots ?? [];
  if (!Array.isArray(roots) || roots.length > 10) throw new ValidationError('Numero de raizes invalido.');
  const normalized = roots.map((root) => {
    object(root);
    const baseUrl = packageBase(root.baseUrl);
    if (!/^[a-zA-Z0-9._-]+$/.test(root.id ?? '') || !baseUrl.startsWith(site) || root.immutable !== true || !/^[a-f0-9]{64}$/.test(root.inventoryHash ?? '') || (root.discover !== undefined && typeof root.discover !== 'boolean')) throw new ValidationError('Raiz de extensao nao aprovada para este site.');
    return { id: root.id, baseUrl, inventoryHash: root.inventoryHash, immutable: true, discover: root.discover !== false };
  });
  if (new Set(normalized.map((root) => root.id)).size !== roots.length) throw new ValidationError('Identificador de raiz duplicado.');
  function asset(value, extension, directory) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) throw new ValidationError('Recurso deve ser server-relative.');
    packagePath(value.slice(1));
    if (!value.endsWith(extension) || !normalized.some((root) => value.startsWith(`${root.baseUrl}${directory}/`))) throw new ValidationError('Recurso fora das raizes aprovadas.');
    return value;
  }
  function styles(values) {
    if (!Array.isArray(values) || values.length > 50) throw new ValidationError('Lista CSS invalida.');
    return [...new Set(values.map((value) => asset(value, '.css', 'media')))];
  }
  const moduleStyles = Object.create(null);
  for (const [key, values] of Object.entries(object(input.moduleStyles ?? {}))) moduleStyles[extensionKey(key)] = styles(values);
  const moduleStyleRevisions = Object.create(null);
  for (const [key, revisions] of Object.entries(object(input.moduleStyleRevisions ?? {}))) {
    const approved = Object.create(null);
    for (const [url, values] of Object.entries(object(revisions))) approved[asset(url, '.js', 'modules')] = styles(values);
    moduleStyleRevisions[extensionKey(key)] = approved;
  }
  return { joomlaDiscoveryRoots: normalized, moduleStyles, moduleStyleRevisions };
}

/** Earlier packages remain approved for rollback, but only the last set is discovered. */
export function mergeExtensionsConfigs(inputs, options) {
  const configs = inputs.map((input) => normalizeExtensionsConfig(input, options));
  const roots = new Map();
  const moduleStyles = Object.create(null);
  const revisions = Object.create(null);
  configs.forEach((config, index) => {
    for (const root of config.joomlaDiscoveryRoots) {
      const previous = roots.get(root.id);
      if (previous && (previous.baseUrl !== root.baseUrl || previous.inventoryHash !== root.inventoryHash)) throw new ValidationError('Revisao de raiz conflitante.');
      roots.set(root.id, { ...root, discover: index === configs.length - 1 && root.discover });
    }
    Object.assign(moduleStyles, config.moduleStyles);
    for (const [key, urls] of Object.entries(config.moduleStyleRevisions)) {
      for (const [url, styles] of Object.entries(urls)) {
        const prior = revisions[key]?.[url];
        if (prior && JSON.stringify(prior) !== JSON.stringify(styles)) throw new ValidationError('Estilos de revisao imutavel conflitantes.');
      }
      revisions[key] = { ...revisions[key], ...urls };
    }
  });
  return normalizeExtensionsConfig({ joomlaDiscoveryRoots: [...roots.values()], moduleStyles, moduleStyleRevisions: revisions }, options);
}
