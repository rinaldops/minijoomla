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
import { ValidationError } from '../core/contracts.js';
import { normalizeParamDefinitions, normalizeParamValues, defaultParamValues } from './declared-params.js';
import { TEMPLATE_PARAM_DEFINITIONS as CASSIOPEIA_DEFINITIONS } from '../../../templates/cassiopeia/index.js';
import { CAMAP_PARAM_DEFINITIONS } from '../../../templates/camap/index.js';

export const BUILTIN_TEMPLATES = Object.freeze(['default', 'cassiopeia', 'camap']);

const DEFINITIONS = Object.freeze({
  default: normalizeParamDefinitions([]),
  cassiopeia: normalizeParamDefinitions(CASSIOPEIA_DEFINITIONS),
  camap: normalizeParamDefinitions(CAMAP_PARAM_DEFINITIONS)
});

export function templateParamDefinitions(templateKey) {
  return DEFINITIONS[templateKey] ?? [];
}

const STYLE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/;

export function parseTemplateStyles(value, { strict = false } = {}) {
  let list = value;
  if (list === undefined || list === null || list === '') return [];
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch {
      if (strict) throw new ValidationError('templateStylesJson persistido deve ser uma lista JSON válida. Nenhum dado foi alterado.');
      return [];
    }
  }
  if (!Array.isArray(list)) {
    if (strict) throw new ValidationError('templateStylesJson persistido deve ser uma lista JSON válida. Nenhum dado foi alterado.');
    return [];
  }
  const valid = (style) => style && typeof style === 'object' && !Array.isArray(style) && STYLE_ID.test(String(style.id ?? '')) && typeof style.template === 'string';
  if (strict && list.some((style) => !valid(style)
    || (style.home !== undefined && typeof style.home !== 'boolean')
    || (style.params !== undefined && (!style.params || typeof style.params !== 'object' || Array.isArray(style.params))))) {
    throw new ValidationError('templateStylesJson persistido contém um estilo inválido. Nenhum dado foi alterado.');
  }
  const styles = list.filter(valid).map((style) => ({
    id: String(style.id), template: style.template, title: String(style.title ?? style.id), home: style.home === true,
    params: style.params && typeof style.params === 'object' && !Array.isArray(style.params) ? { ...style.params } : {}
  }));
  if (strict) validateTemplateStyles(styles);
  return styles;
}

export function validateTemplateStyles(styles) {
  if (!Array.isArray(styles)) throw new ValidationError('templateStyles deve ser uma lista.');
  if (styles.length > 100) throw new ValidationError('Máximo de 100 estilos de template.');
  const ids = new Set();
  const homes = new Set();
  const normalized = styles.map((style) => {
    if (!style || typeof style !== 'object') throw new ValidationError('Estilo de template inválido.');
    const id = String(style.id ?? '');
    if (!STYLE_ID.test(id)) throw new ValidationError(`Identificador de estilo inválido: ${id}.`);
    if (ids.has(id)) throw new ValidationError(`Estilo duplicado: ${id}.`);
    ids.add(id);
    if (typeof style.template !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(style.template)) throw new ValidationError('template do estilo inválido.');
    const title = String(style.title ?? '').trim();
    if (!title) throw new ValidationError('Título do estilo é obrigatório.');
    if (style.home === true) {
      if (homes.has(style.template)) throw new ValidationError(`Somente um estilo padrão por template (${style.template}).`);
      homes.add(style.template);
    }
    const params = normalizeParamValues(templateParamDefinitions(style.template), style.params ?? {}, { keepUndeclared: !DEFINITIONS[style.template] });
    return { id, template: style.template, title: title.slice(0, 200), home: style.home === true, params };
  });
  return JSON.stringify(normalized);
}

/* Lista completa: estilos persistidos + um estilo padrão virtual para cada template conhecido sem estilo. */
export function effectiveTemplateStyles(storedStyles, templateKeys = BUILTIN_TEMPLATES, titles = {}, options = {}) {
  const styles = parseTemplateStyles(storedStyles, options);
  for (const key of templateKeys) {
    if (!styles.some((style) => style.template === key)) styles.push({ id: `${key}-default`, template: key, title: `${titles[key] ?? key} — Padrão`, home: true, params: defaultParamValues(templateParamDefinitions(key)), virtual: true });
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
export function resolveTemplateParams(siteConfig = {}) {
  const templateKey = siteConfig?.templateKey || 'default';
  const styles = effectiveTemplateStyles(siteConfig?.templateStylesJson, [templateKey]);
  const style = styles.find((entry) => entry.template === templateKey && entry.home) ?? null;
  const definitions = templateParamDefinitions(templateKey);
  let params;
  try { params = normalizeParamValues(definitions, style?.params ?? {}, { keepUndeclared: !DEFINITIONS[templateKey] }); } catch { params = defaultParamValues(definitions); }
  return Object.freeze({ ...defaultParamValues(definitions), ...params });
}

export function resolveTemplateStyleId(siteConfig = {}) {
  const templateKey = siteConfig?.templateKey || 'default';
  return effectiveTemplateStyles(siteConfig?.templateStylesJson, [templateKey]).find((entry) => entry.template === templateKey && entry.home)?.id ?? `${templateKey}-default`;
}
