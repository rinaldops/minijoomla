/*
 * Opções por componente (equivalente funcional a com_config
 * &view=component&component=com_x). Valores persistidos em
 * SiteConfig.ComponentParamsJson: `{ content: {...}, search: {...}, tags: {...} }`.
 * `resolveComponentParams` entrega ao runtime os valores já mesclados com
 * os padrões declarados.
 */
import { ValidationError } from '../core/contracts.js';
import { normalizeParamDefinitions, normalizeParamValues, defaultParamValues, parseJsonObject } from './declared-params.js';

const show = (name, label, fallback = true) => ({ name, type: 'checkbox', label, default: fallback });

export const COMPONENT_OPTIONS = Object.freeze([
  { key: 'content', title: 'Artigos', joomla: 'com_content', params: [
    show('showTitle', 'Exibir título do artigo'),
    show('linkTitles', 'Títulos como links'),
    show('showIntro', 'Exibir texto de introdução'),
    show('showCategory', 'Exibir categoria'),
    show('showAuthor', 'Exibir autor'),
    show('showPublishDate', 'Exibir data de publicação'),
    show('showTags', 'Exibir tags'),
    show('showReadmore', 'Exibir "Leia mais"'),
    show('showModifyDate', 'Exibir data de modificação'),
    show('showCreateDate', 'Exibir data de criação'),
    show('showPrint', 'Exibir botão Imprimir', false),
    { name: 'numLeading', type: 'number', label: 'Blog: artigos em destaque', min: 0, max: 20 },
    // Sem `default`: blogSettings só usa 1+(pageSize-1)+0 enquanto nada foi gravado em numLeading/numIntro/numLinks.
    { name: 'numIntro', type: 'number', label: 'Blog: artigos de introdução', min: 0, max: 40 },
    { name: 'numColumns', type: 'number', label: 'Blog: colunas', min: 1, max: 4, default: 1 },
    { name: 'numLinks', type: 'number', label: 'Blog: links adicionais', min: 0, max: 40 },
    { name: 'listLimit', type: 'number', label: 'Artigos por página nas listas', min: 1, max: 50, default: 10 },
    { name: 'orderBy', type: 'select', label: 'Ordenação das listas', options: [{ value: 'publishUp-desc', label: 'Mais recentes primeiro' }, { value: 'publishUp-asc', label: 'Mais antigos primeiro' }, { value: 'title-asc', label: 'Título (A-Z)' }], default: 'publishUp-desc' }
  ] },
  { key: 'search', title: 'Busca', joomla: 'com_search / com_finder', params: [
    { name: 'searchPhrases', type: 'select', label: 'Correspondência padrão', options: [{ value: 'all', label: 'Todas as palavras' }, { value: 'any', label: 'Qualquer palavra' }, { value: 'exact', label: 'Frase exata' }], default: 'all' },
    { name: 'resultsLimit', type: 'number', label: 'Resultados por página', min: 1, max: 50, default: 10 },
    show('highlightTerms', 'Destacar termos encontrados')
  ] },
  { key: 'tags', title: 'Tags', joomla: 'com_tags', available: false, unavailableReason: 'Opções de tags indisponíveis: não há página pública de tags que consuma estes parâmetros. Os valores existentes serão preservados.', params: [
    show('showTagTitle', 'Exibir título da tag'),
    { name: 'tagListLimit', type: 'number', label: 'Itens por página', min: 1, max: 50, default: 10 }
  ] }
].map((component) => Object.freeze({ available: true, ...component, params: normalizeParamDefinitions(component.params) })));

export function findComponentOptions(key) {
  const component = COMPONENT_OPTIONS.find((entry) => entry.key === key);
  if (!component) throw new ValidationError(`Componente sem opções configuráveis: ${String(key)}.`);
  return component;
}

export function resolveComponentParams(siteConfig = {}, { strict = false } = {}) {
  const stored = readComponentParams(siteConfig?.componentParamsJson, strict);
  return Object.freeze(Object.fromEntries(COMPONENT_OPTIONS.map((component) => {
    let values;
    try { values = normalizeParamValues(component.params, stored[component.key]); } catch (error) {
      if (strict) throw error;
      values = defaultParamValues(component.params);
    }
    return [component.key, Object.freeze(values)];
  })));
}

function readComponentParams(value, strict) {
  const stored = parseJsonObject(value, { strict, field: 'componentParamsJson' });
  if (strict) {
    for (const [key, params] of Object.entries(stored)) {
      if (!params || typeof params !== 'object' || Array.isArray(params)) throw new ValidationError('componentParamsJson persistido contém opções inválidas. Nenhum dado foi alterado.');
      const component = COMPONENT_OPTIONS.find((entry) => entry.key === key);
      if (component) normalizeParamValues(component.params, params);
    }
  }
  return stored;
}

/* Serializa o objeto completo, alterando só o componente indicado. */
export function mergeComponentParams(currentJson, key, values) {
  const component = findComponentOptions(key);
  if (!component.available) throw new ValidationError(component.unavailableReason);
  const stored = readComponentParams(currentJson, true);
  stored[key] = { ...stored[key], ...normalizeParamValues(component.params, { ...stored[key], ...parseJsonObject(values, { strict: true, field: 'Opções' }) }) };
  return JSON.stringify(stored);
}
