/*
 * Instalação por manifesto declarativo (equivalente funcional restrito ao
 * com_installer). O painel nunca baixa nem executa código: valida um
 * manifesto JSON (objeto ou texto) cujo `entryPointUrl` aponta para um
 * módulo ES já publicado (caminho relativo ou HTTPS), e só então grava o
 * registro. Nenhum `eval`/`Function`/import dinâmico acontece aqui.
 *
 * Manifesto aceito:
 *   { type: 'Module'|'Plugin'|'Template', key, title, version,
 *     entryPointUrl, description?, author?, group? (Plugin),
 *     params?: [definições], positions?: [...] (Template), styles? (Template) }
 */
import { ValidationError, ownDataValue } from '../core/contracts.js';
import { extensionKey, sameSiteModuleUrl, templatePositions, templateStyles } from './extension-input.js';
import { normalizeParamDefinitions } from './declared-params.js';
import { BUILTIN_MODULE_KEYS } from './extension-input.js';
import { BUILTIN_TEMPLATES } from './template-styles.js';

export const PLUGIN_GROUPS = Object.freeze(['content', 'system', 'search', 'editors', 'user', 'extension']);
const MAX_MANIFEST = 64 * 1024;

function text(value, field, max = 200, required = true) {
  const result = value === undefined || value === null ? '' : String(value).trim();
  if (required && !result) throw new ValidationError(`Manifesto: ${field} é obrigatório.`);
  if (result.length > max) throw new ValidationError(`Manifesto: ${field} excede ${max} caracteres.`);
  return result;
}


export function parseExtensionManifest(input) {
  let manifest = input;
  if (typeof manifest === 'string') {
    if (manifest.length > MAX_MANIFEST) throw new ValidationError('Manifesto excede 64 KB.');
    try { manifest = JSON.parse(manifest); } catch { throw new ValidationError('Manifesto deve ser JSON válido.'); }
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new ValidationError('Manifesto deve ser um objeto JSON.');
  const type = text(manifest.type, 'type');
  if (!['Module', 'Plugin', 'Template'].includes(type)) throw new ValidationError('Manifesto: type deve ser Module, Plugin ou Template.');
  const key = extensionKey(manifest.key);
  if (type === 'Module' && BUILTIN_MODULE_KEYS.includes(key)) throw new ValidationError('Manifesto: key colide com um módulo nativo.');
  if (type === 'Template' && BUILTIN_TEMPLATES.includes(key)) throw new ValidationError('Manifesto: key colide com um template integrado.');
  const result = {
    type, key,
    title: text(manifest.title, 'title'),
    version: text(manifest.version, 'version', 40),
    entryPointUrl: sameSiteModuleUrl(manifest.entryPointUrl),
    description: text(manifest.description, 'description', 1000, false),
    author: text(manifest.author, 'author', 200, false),
    params: type === 'Template' ? [] : normalizeParamDefinitions(manifest.params)
  };
  if (type === 'Plugin') {
    const group = text(manifest.group ?? 'content', 'group', 40);
    if (!PLUGIN_GROUPS.includes(group)) throw new ValidationError(`Manifesto: group deve ser um de ${PLUGIN_GROUPS.join(', ')}.`);
    result.group = group;
  }
  if (type === 'Template') {
    const declarations = ownDataValue(manifest, 'paramDefinitions');
    // Older templates may use params for values rather than declarations. Only
    // an absent canonical field and an array-shaped alias declare parameters.
    const alias = Object.hasOwn(manifest, 'paramDefinitions') ? undefined : ownDataValue(manifest, 'params');
    const definitions = Object.hasOwn(manifest, 'paramDefinitions') ? declarations : Array.isArray(alias) ? alias : undefined;
    if (definitions !== undefined && !Array.isArray(definitions)) throw new ValidationError('Manifesto: paramDefinitions deve ser uma lista.');
    result.paramDefinitions = normalizeParamDefinitions(definitions);
    result.positionsJson = templatePositions(manifest.positions);
    result.styles = templateStyles(manifest.styles);
  }
  return Object.freeze(result);
}

/* JSON persistido em Extensions.ManifestJson (sem campos de identidade duplicados). */
export function manifestRecordJson(manifest) {
  return JSON.stringify({ version: manifest.version, description: manifest.description, author: manifest.author, group: manifest.group, params: manifest.params });
}
