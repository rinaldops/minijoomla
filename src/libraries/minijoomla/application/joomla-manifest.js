import { parseXml } from '../../vendor/parse-xml/parse-xml.js';
import { ValidationError } from '../core/contracts.js';
import { extensionKey } from './extension-input.js';
import { normalizeParamDefinitions } from './declared-params.js';
import { packagePath, packageBase, packageAsset } from './package-path.js';
export { packagePath, packageBase, packageAsset } from './package-path.js';

export const JOOMLA_PROFILE = 'joomla-xml-v1';
export const RUNTIME_NAMESPACE = 'urn:minijoomla:runtime:1';
export const MAX_MANIFEST_BYTES = 64 * 1024;
const BAD_NAMES = new Set(Object.getOwnPropertyNames(Object.prototype));
const unsupported = (message) => Object.assign(new ValidationError(message), { code: 'unsupported-extension' });
const children = (node, name) => (node?.children ?? []).filter((child) => child.type === 'element' && child.name === name);

function one(node, name, required = false) {
  const found = children(node, name);
  if (found.length > 1 || (required && !found.length)) throw new ValidationError(`XML: elemento ${name} ausente ou duplicado.`);
  return found[0];
}

function value(node, name, fallback = '') { return one(node, name)?.text?.trim() || fallback; }

function runtimeAttribute(node, name) {
  const values = Object.entries(node.attributes ?? {}).filter(([attribute]) => {
    const parts = attribute.split(':');
    if (parts.length !== 2 || parts[1] !== name || parts[0] === 'xmlns') return false;
    for (let current = node; current; current = current.parent) {
      const namespace = current.attributes?.[`xmlns:${parts[0]}`];
      if (namespace !== undefined) return namespace === RUNTIME_NAMESPACE;
    }
    throw new ValidationError(`XML: prefixo nao declarado (${parts[0]}).`);
  });
  if (values.length > 1) throw new ValidationError(`XML: atributo runtime duplicado (${name}).`);
  return values[0]?.[1];
}

export function manifestBytes(input) {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new ValidationError('Conteudo do manifesto invalido.');
}

function param(field, { strictMetadata = false } = {}) {
  const a = field.attributes;
  if (strictMetadata && (typeof a.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(a.name)
    || (a.label !== undefined && a.label.length > 200) || (a.description !== undefined && a.description.length > 500))) {
    throw new ValidationError('XML: metadados de parametro requerem correcao explicita, sem normalizacao ou truncamento.');
  }
  if (!a.name || BAD_NAMES.has(a.name)) throw new ValidationError('XML: nome de parametro invalido ou reservado.');
  const runtimeType = runtimeAttribute(field, 'type');
  const type = runtimeType ?? ({ list: 'select', radio: 'select' }[a.type] ?? a.type ?? 'text');
  const options = children(field, 'option').map((option) => ({ value: option.attributes.value ?? '', label: option.text.trim() }));
  const boolean = a.type === 'radio' && !runtimeType && options.length === 2 && options.every((option) => ['0', '1'].includes(option.value)) && new Set(options.map((option) => option.value)).size === 2;
  const result = { name: a.name, type: boolean ? 'checkbox' : type, label: a.label || a.name };
  if (a.description !== undefined) result.description = a.description;
  if (a.default !== undefined) result.default = a.default;
  if (result.type === 'select') result.options = options;
  if (a.maxlength !== undefined) result.maxLength = Number(a.maxlength);
  if (result.type === 'number') for (const bound of ['min', 'max']) if (a[bound] !== undefined) result[bound] = a[bound];
  if (result.type === 'json') {
    result.valueType = runtimeAttribute(field, 'valueType');
    if (a.default !== undefined) {
      try { result.default = JSON.parse(a.default); } catch { throw new ValidationError(`XML: default JSON invalido (${a.name}).`); }
    }
  }
  if (a.multiple === 'true' || a.multiple === '1' || a.required === 'true' || a.required === '1' || a.addfieldpath || a.validate || a.filter || a.showon) throw unsupported(`Campo ${a.name} requer comportamento nao suportado.`);
  if (children(field, 'field').length || (field.children ?? []).some((child) => child.type === 'element' && child.name !== 'option')) throw unsupported('Estrutura de campo XML nao suportada.');
  return result;
}

/** Parse metadata only: neither XML references nor JavaScript are executed. */
export function parseJoomlaManifest(input, { baseUrl, manifestPath, strictMetadata = false } = {}) {
  const bytes = manifestBytes(input);
  if (bytes.byteLength > MAX_MANIFEST_BYTES) throw new ValidationError('XML excede 64 KiB.');
  let text, doc;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    doc = parseXml(text, { preserveDocumentType: true, preserveXmlDeclaration: true });
  } catch { throw new ValidationError('Manifesto XML invalido ou UTF-8 invalido.'); }
  const stack = [[doc, 0]];
  let nodes = 0;
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (depth > 32 || ++nodes > 5000) throw new ValidationError('XML excede os limites de estrutura.');
    if (['doctype', 'pi'].includes(node.type)) throw unsupported('DTD, entidades externas e instrucoes de processamento nao sao suportadas.');
    if (node.type === 'xmldecl' && node.encoding && !/^utf-8$/i.test(node.encoding)) throw unsupported('Somente UTF-8 e suportado.');
    if (['scriptfile', 'sql'].includes(node.name)) throw unsupported('PHP, SQL e scripts de instalacao nao sao executados pelo MiniJoomla.');
    for (const child of node.children ?? []) stack.push([child, depth + 1]);
  }
  const root = doc.root;
  if (root?.name !== 'extension' || root.attributes.xmlns) throw new ValidationError('XML deve possuir raiz extension sem namespace padrao.');
  if (root.attributes.type !== 'module' || (root.attributes.client ?? 'site') !== 'site') throw unsupported('Perfil atual suporta somente modulos JavaScript de site.');
  if (root.attributes.method !== undefined && !['install', 'upgrade'].includes(root.attributes.method)) throw new ValidationError('Metodo XML invalido.');
  const path = packagePath(manifestPath);
  const match = /^modules\/(mod_[a-z0-9_]+)\/\1\.xml$/.exec(path);
  if (!match) throw new ValidationError('Modulo deve usar modules/mod_nome/mod_nome.xml.');
  const element = match[1];
  const explicitElement = value(root, 'element');
  if (explicitElement && explicitElement !== element) throw new ValidationError('Elemento XML difere da pasta do modulo.');
  const files = one(root, 'files', true);
  const entries = children(files, 'filename').filter((file) => file.attributes.module !== undefined);
  if (children(files, 'folder').some((folder) => folder.attributes.module !== undefined)) throw unsupported('Provider PHP nao e um entrypoint JavaScript.');
  if (entries.length !== 1 || entries[0].attributes.module !== element) throw new ValidationError('Entry point/atributo module ausente ou divergente.');
  const entry = packagePath(entries[0].text.trim());
  if (!/\.m?js$/.test(entry)) throw unsupported('Modulo requer adaptador JavaScript; entrypoints PHP nao sao executaveis.');
  const version = value(root, 'version');
  if (!version || version.length > 40) throw new ValidationError('Versao XML ausente ou invalida.');
  const prefix = `modules/${element}/`;
  const requiredFiles = children(files, 'filename').map((file) => `${prefix}${packagePath(file.text.trim())}`);
  const requiredFolders = children(files, 'folder').map((folder) => `${prefix}${packagePath(folder.text.trim())}/`);
  const styles = [];
  const media = one(root, 'media');
  if (media) {
    const destination = packagePath(media.attributes.destination || element);
    const mediaPrefix = `media/${destination}/`;
    for (const file of children(media, 'filename')) {
      const name = `${mediaPrefix}${packagePath(file.text.trim())}`;
      requiredFiles.push(name);
      if (name.endsWith('.css')) styles.push(packageAsset(baseUrl, name));
    }
    for (const folder of children(media, 'folder')) requiredFolders.push(`${mediaPrefix}${packagePath(folder.text.trim())}/`);
  }
  const config = one(root, 'config');
  const fields = config ? children(config, 'fields') : [];
  if (config && (config.children ?? []).some((node) => node.type === 'element' && node.name !== 'fields')) throw unsupported('Estrutura de configuracao XML nao suportada.');
  if (fields.some((field) => field.attributes.name !== 'params')) throw unsupported('Grupo de configuracao XML nao suportado.');
  const definitions = fields.flatMap((group) => {
    if ((group.children ?? []).some((node) => node.type === 'element' && !['field', 'fieldset'].includes(node.name))) throw unsupported('Parametros XML aninhados nao sao suportados.');
    for (const set of children(group, 'fieldset')) if ((set.children ?? []).some((node) => node.type === 'element' && node.name !== 'field')) throw unsupported('Fieldsets XML aninhados nao sao suportados.');
    return [...children(group, 'field'), ...children(group, 'fieldset').flatMap((set) => children(set, 'field'))].map(field => param(field, { strictMetadata }));
  });
  const params = normalizeParamDefinitions(definitions);
  const key = extensionKey(runtimeAttribute(root, 'key') ?? element);
  const identity = `module:site::${element}`;
  const title = value(root, 'name', element);
  const description = value(root, 'description');
  if (title.length > 200 || description.length > 1000 || value(root, 'author').length > 200) throw new ValidationError('Metadados XML excedem o tamanho permitido.');
  const entryPointUrl = packageAsset(baseUrl, `${prefix}${entry}`);
  const metadata = { version, description, author: value(root, 'author'), params,
    miniJoomla: { profile: JOOMLA_PROFILE, key, identity, element, client: 'site', group: '', manifestPath: path, baseUrl: packageBase(baseUrl) } };
  return Object.freeze({ key, title, type: 'Module', version, identity, element, entryPointUrl,
    styles: Object.freeze(styles), params, requiredFiles: Object.freeze([...new Set(requiredFiles)]),
    requiredFolders: Object.freeze([...new Set(requiredFolders)]), manifestJson: JSON.stringify(metadata) });
}
