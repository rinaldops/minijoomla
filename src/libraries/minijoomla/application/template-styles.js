/*
 * Estilos de template (equivalente funcional a `#__template_styles` /
 * com_templates "Estilos"). Persistidos como lista JSON em
 * SiteConfig.TemplateStylesJson (fonte única):
 *   [{ id, template, title, home, params }]
 * O estilo `home: true` do template ativo (siteConfig.templateKey) define
 * os parâmetros entregues aos templates como `config.templateParams`
 * (alias aceito pelos templates: `config.styleParams`) via
 * `resolveTemplateParams`.
 */
import { ValidationError, ownDataValue } from '../core/contracts.js';
import { normalizeParamDefinitions, normalizeParamValues, defaultParamValues, parseJsonObject } from './declared-params.js';
import { TEMPLATE_PARAM_DEFINITIONS as CASSIOPEIA_DEFINITIONS } from '../../../templates/cassiopeia/index.js';
import { CAMAP_PARAM_DEFINITIONS } from '../../../templates/camap/index.js';

export const BUILTIN_TEMPLATES = Object.freeze(['default', 'cassiopeia', 'camap']);

const DEFINITIONS = Object.freeze({
  default: normalizeParamDefinitions([]),
  cassiopeia: normalizeParamDefinitions(CASSIOPEIA_DEFINITIONS),
  camap: normalizeParamDefinitions(CAMAP_PARAM_DEFINITIONS)
});

function builtinDefinitions(templateKey) {
  return typeof templateKey === 'string' ? ownDataValue(DEFINITIONS, templateKey) : undefined;
}

export function templateParamDefinitions(templateKey, installedDefinitions) {
  return builtinDefinitions(templateKey) ?? normalizeParamDefinitions(installedDefinitions);
}

function definitionsFor(templateKey, definitionsByKey) {
  // Built-ins never inspect installed metadata, including inherited/accessor keys.
  return builtinDefinitions(templateKey) ?? templateParamDefinitions(templateKey, ownDataValue(definitionsByKey, templateKey));
}

const STYLE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/;
const TEMPLATE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function styleText(value) {
  if (value !== null && !['undefined', 'string', 'number', 'boolean'].includes(typeof value)) throw new ValidationError('Estilo deve conter valores simples.');
  return String(value ?? '');
}

function cloneStyleList(list) {
  if (!Array.isArray(list) || Object.getPrototypeOf(list) !== Array.prototype) throw new ValidationError('templateStyles deve ser uma lista JSON.');
  // The envelope clone checks dense own indices and recursively rejects hooks,
  // accessors, cycles and non-JSON values without reading/executing them.
  return parseJsonObject({ styles: list }, { strict: true, field: 'templateStylesJson' }).styles;
}

export function parseTemplateStyles(value, { strict = false, definitionsByKey = {} } = {}) {
  let list = value;
  if (list === undefined || list === null || list === '') return [];
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch {
      if (strict) throw new ValidationError('templateStylesJson persistido deve ser uma lista JSON válida. Nenhum dado foi alterado.');
      return [];
    }
  }
  try { list = cloneStyleList(list); } catch (error) {
    if (strict) throw error;
    return [];
  }
  const valid = (style) => style && typeof style === 'object' && !Array.isArray(style)
    && ['string', 'number', 'boolean'].includes(typeof ownDataValue(style, 'id')) && STYLE_ID.test(styleText(ownDataValue(style, 'id')))
    && typeof ownDataValue(style, 'template') === 'string';
  if (strict && list.some((style) => !valid(style)
    || (ownDataValue(style, 'home') !== undefined && typeof ownDataValue(style, 'home') !== 'boolean')
    || (ownDataValue(style, 'params') !== undefined && (!ownDataValue(style, 'params') || typeof ownDataValue(style, 'params') !== 'object' || Array.isArray(ownDataValue(style, 'params')))))) {
    throw new ValidationError('templateStylesJson persistido contém um estilo inválido. Nenhum dado foi alterado.');
  }
  const styles = list.filter(valid).map((style) => ({
    ...style,
    id: styleText(ownDataValue(style, 'id')), template: ownDataValue(style, 'template'),
    title: styleText(ownDataValue(style, 'title') ?? ownDataValue(style, 'id')), home: ownDataValue(style, 'home') === true,
    params: parseJsonObject(ownDataValue(style, 'params'), { strict, field: 'Parâmetros do estilo' })
  }));
  // Validate known values, but retain stored primitive types/unknown data when
  // reading. Editing another style/title must not coerce this detached snapshot.
  if (strict) validateTemplateStyles(styles, definitionsByKey);
  return styles;
}

export function validateTemplateStyles(styles, definitionsByKey = {}, { preserveValues = false } = {}) {
  if (!Array.isArray(styles)) throw new ValidationError('templateStyles deve ser uma lista.');
  if (styles.length > 100) throw new ValidationError('Máximo de 100 estilos de template.');
  const ids = new Set();
  const homes = new Set();
  const normalized = cloneStyleList(styles).map((style) => {
    if (!style || typeof style !== 'object' || Array.isArray(style)) throw new ValidationError('Estilo de template inválido.');
    const id = styleText(ownDataValue(style, 'id'));
    if (!STYLE_ID.test(id)) throw new ValidationError(`Identificador de estilo inválido: ${id}.`);
    if (ids.has(id)) throw new ValidationError(`Estilo duplicado: ${id}.`);
    ids.add(id);
    const template = ownDataValue(style, 'template');
    if (typeof template !== 'string' || !TEMPLATE_KEY.test(template)) throw new ValidationError('template do estilo inválido.');
    const title = styleText(ownDataValue(style, 'title')).trim();
    if (!title) throw new ValidationError('Título do estilo é obrigatório.');
    const home = ownDataValue(style, 'home');
    if (home !== undefined && typeof home !== 'boolean') throw new ValidationError('home do estilo deve ser booleano.');
    if (home === true) {
      if (homes.has(template)) throw new ValidationError(`Somente um estilo padrão por template (${template}).`);
      homes.add(template);
    }
    const storedParams = ownDataValue(style, 'params');
    if (storedParams !== undefined && (!storedParams || typeof storedParams !== 'object' || Array.isArray(storedParams))) throw new ValidationError('Parâmetros do estilo devem ser um objeto JSON.');
    const values = parseJsonObject(storedParams, { strict: true, field: 'Parâmetros do estilo' });
    const params = normalizeParamValues(definitionsFor(template, definitionsByKey), values, { keepUndeclared: true });
    return preserveValues ? { ...style } : { ...style, id, template, title: title.slice(0, 200), home: home === true, params };
  });
  return JSON.stringify(normalized);
}

/* Lista completa: estilos persistidos + um estilo padrão virtual para cada template conhecido sem estilo. */
export function effectiveTemplateStyles(storedStyles, templateKeys = BUILTIN_TEMPLATES, titles = {}, options = {}, definitionsByKey = ownDataValue(options, 'definitionsByKey') ?? {}) {
  const styles = parseTemplateStyles(storedStyles, { strict: ownDataValue(options, 'strict') === true, definitionsByKey });
  for (const key of templateKeys) {
    if (typeof key !== 'string' || !TEMPLATE_KEY.test(key)) throw new ValidationError('template do estilo inválido.');
    if (!styles.some((style) => style.template === key)) styles.push({ id: `${key}-default`, template: key, title: `${styleText(ownDataValue(titles, key) ?? key)} — Padrão`, home: true, params: defaultParamValues(definitionsFor(key, definitionsByKey)), virtual: true });
  }
  for (const key of new Set(styles.map((style) => style.template))) {
    const own = styles.filter((style) => style.template === key);
    if (!own.some((style) => style.home)) own[0].home = true;
  }
  return styles;
}

/*
 * Contrato para os templates: objeto plano com os parâmetros do estilo
 * padrão do template ativo, já mesclado com os padrões declarados.
 */
export function resolveTemplateParams(siteConfig = {}, installedDefinitions) {
  const templateKey = ownDataValue(siteConfig, 'templateKey') || 'default';
  if (typeof templateKey !== 'string' || !TEMPLATE_KEY.test(templateKey)) throw new ValidationError('template do estilo inválido.');
  const builtin = builtinDefinitions(templateKey);
  const definitions = templateParamDefinitions(templateKey, installedDefinitions);
  const definitionsByKey = Object.fromEntries([[templateKey, definitions]]);
  const styles = effectiveTemplateStyles(ownDataValue(siteConfig, 'templateStylesJson'), [templateKey], {}, { strict: !builtin }, definitionsByKey);
  const style = styles.find((entry) => entry.template === templateKey && entry.home) ?? null;
  let params;
  try { params = normalizeParamValues(definitions, style?.params ?? {}, { keepUndeclared: !builtin }); } catch (error) {
    if (!builtin) throw error;
    params = defaultParamValues(definitions);
  }
  return Object.freeze({ ...defaultParamValues(definitions), ...params });
}

export function resolveTemplateStyleId(siteConfig = {}) {
  const templateKey = siteConfig?.templateKey || 'default';
  return effectiveTemplateStyles(siteConfig?.templateStylesJson, [templateKey]).find((entry) => entry.template === templateKey && entry.home)?.id ?? `${templateKey}-default`;
}
