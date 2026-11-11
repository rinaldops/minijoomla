/*
 * Parâmetros declarativos de módulos, plugins, templates e componentes.
 * Definições são dados, nunca código. JSON estruturado declara valueType
 * (array/object); valores são normalizados antes da persistência.
 */
import { ValidationError } from '../core/contracts.js';

export const PARAM_TYPES = Object.freeze(['text', 'textarea', 'number', 'checkbox', 'select', 'color', 'url', 'json']);
const NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_LENGTH = 20000;

function plainObject(value) {
  return value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function dataEntries(value) {
  if (Object.getOwnPropertySymbols(value).length) throw new ValidationError('JSON contém chave não suportada.');
  const array = Array.isArray(value);
  const keys = Object.getOwnPropertyNames(value).filter((key) => !(array && key === 'length'));
  if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) throw new ValidationError('JSON deve conter listas densas, sem propriedades adicionais.');
  return keys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !('value' in descriptor)) throw new ValidationError('JSON contém chave ou propriedade não suportada.');
    return [key, descriptor.value];
  });
}

/* No toJSON/getters/prototypes/cycles: cloning JSON data must not execute code.
 * Parameter envelopes/unknown legacy data permit reserved own keys, written
 * as data. Declared structured JSON keeps the historical unsafe-key guard.
 */
function cloneJson(value, seen = new Set(), depth = 0, budget = { nodes: 0 }, allowUnsafeKeys = false) {
  if (depth > 32 || ++budget.nodes > 50000) throw new ValidationError('JSON excede os limites de estrutura.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if ((!Array.isArray(value) && !plainObject(value)) || seen.has(value)) throw new ValidationError('JSON contém valor não suportado ou referência circular.');
  seen.add(value);
  const result = Array.isArray(value) ? [] : {};
  for (const [key, entry] of dataEntries(value)) {
    if (!allowUnsafeKeys && UNSAFE_KEYS.has(key)) throw new ValidationError('JSON contém chave ou propriedade não suportada.');
    writeParamValue(result, key, cloneJson(entry, seen, depth + 1, budget, allowUnsafeKeys));
  }
  seen.delete(value);
  return result;
}

function ownDataObject(value) {
  if (!plainObject(value)) throw new ValidationError('Cada parâmetro deve ser um objeto.');
  // Null prototype prevents inherited names/defaults from becoming metadata.
  return Object.assign(Object.create(null), Object.fromEntries(dataEntries(value)));
}

function optionList(options, name) {
  if (!Array.isArray(options) || !options.length) throw new ValidationError(`Parâmetro ${name}: options deve ser uma lista não vazia.`);
  return dataEntries(options).map(([, option]) => {
    if (typeof option === 'string') return { value: option, label: option };
    if (plainObject(option)) {
      const entry = ownDataObject(option);
      if (typeof entry.value === 'string') return { value: entry.value, label: paramText(entry.label ?? entry.value) };
    }
    throw new ValidationError(`Parâmetro ${name}: opção inválida.`);
  });
}

/* Valida e normaliza definições vindas de manifestos (dados não confiáveis). */
export function normalizeParamDefinitions(definitions) {
  if (definitions === undefined || definitions === null || definitions === '') return [];
  let list = definitions;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { throw new ValidationError('params deve ser uma lista JSON.'); }
  }
  if (!Array.isArray(list)) throw new ValidationError('params deve ser uma lista.');
  if (list.length > 50) throw new ValidationError('params aceita no máximo 50 parâmetros.');
  const seen = new Set();
  return dataEntries(list).map(([, value]) => {
    const entry = ownDataObject(value);
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!NAME.test(name)) throw new ValidationError('Nome de parâmetro inválido.');
    if (seen.has(name)) throw new ValidationError(`Parâmetro duplicado: ${name}.`);
    seen.add(name);
    const type = entry.type ?? 'text';
    if (!PARAM_TYPES.includes(type)) throw new ValidationError(`Parâmetro ${name}: tipo não suportado.`);
    const definition = { name, type, label: paramText(entry.label ?? name).slice(0, 200) };
    if (entry.description !== undefined) definition.description = paramText(entry.description).slice(0, 500);
    if (['text', 'textarea', 'url', 'json'].includes(type)) {
      const limit = entry.maxLength ?? MAX_LENGTH;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LENGTH) throw new ValidationError(`Parâmetro ${name}: maxLength inválido.`);
      if (entry.maxLength !== undefined) definition.maxLength = limit;
    }
    if (type === 'json') {
      if (!['array', 'object'].includes(entry.valueType)) throw new ValidationError(`Parâmetro ${name}: valueType deve ser array ou object.`);
      definition.valueType = entry.valueType;
    }
    if (type === 'select') definition.options = optionList(entry.options, name);
    if (type === 'number') {
      for (const bound of ['min', 'max']) if (entry[bound] !== undefined) {
        paramText(entry[bound]);
        if (!Number.isFinite(Number(entry[bound]))) throw new ValidationError(`Parâmetro ${name}: ${bound} inválido.`);
        definition[bound] = Number(entry[bound]);
      }
      if (definition.min > definition.max) throw new ValidationError(`Parâmetro ${name}: min deve ser menor ou igual a max.`);
    }
    if (entry.default !== undefined) definition.default = coerceParam(definition, entry.default);
    return Object.freeze(definition);
  });
}

function paramText(value) {
  if (value !== null && !['undefined', 'string', 'number', 'boolean'].includes(typeof value)) throw new ValidationError('Parâmetro deve conter um valor simples.');
  return value === null || value === undefined ? '' : String(value);
}

export function coerceParam(definition, value) {
  const { name, type } = definition;
  if (type === 'json') {
    let parsed = value;
    if (typeof value === 'string') {
      if (value.length > MAX_LENGTH * 10) throw new ValidationError(`${name} excede o tamanho máximo.`);
      try { parsed = JSON.parse(value); } catch { throw new ValidationError(`${name} deve ser JSON válido.`); }
    }
    if (definition.valueType === 'array' ? !Array.isArray(parsed) : !plainObject(parsed)) throw new ValidationError(`${name} deve ser um ${definition.valueType === 'array' ? 'array' : 'objeto'} JSON.`);
    const result = cloneJson(parsed);
    if (JSON.stringify(result).length > (definition.maxLength ?? MAX_LENGTH)) throw new ValidationError(`${name} excede o tamanho máximo.`);
    return result;
  }
  if (type === 'checkbox') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0 || value === '' || value === null || value === undefined) return false;
    throw new ValidationError(`${name} deve ser booleano.`);
  }
  if (type === 'number') {
    if (value === '' || value === null || value === undefined) return definition.default ?? null;
    paramText(value);
    const number = Number(value);
    if (!Number.isFinite(number)) throw new ValidationError(`${name} deve ser um número.`);
    if (definition.min !== undefined && number < definition.min) throw new ValidationError(`${name} deve ser maior ou igual a ${definition.min}.`);
    if (definition.max !== undefined && number > definition.max) throw new ValidationError(`${name} deve ser menor ou igual a ${definition.max}.`);
    return number;
  }
  const text = paramText(value);
  if (text.length > (definition.maxLength ?? MAX_LENGTH)) throw new ValidationError(`${name} excede o tamanho máximo.`);
  if (type === 'select') {
    if (text === '' && definition.default !== undefined) return definition.default;
    if (!definition.options.some((option) => option.value === text)) throw new ValidationError(`${name}: opção inválida.`);
    return text;
  }
  if (type === 'color') {
    if (text && !/^#[0-9a-fA-F]{6}$/.test(text)) throw new ValidationError(`${name} deve ser uma cor hexadecimal (#rrggbb).`);
    return text.toLowerCase();
  }
  if (type === 'url') {
    const url = text.trim();
    if (!url) return '';
    if (/[\s\\\u0000-\u001f\u007f"'<>]/.test(url) || url.startsWith('//')) throw new ValidationError(`${name} deve ser um caminho relativo ou URL HTTPS.`);
    let parsed;
    try { parsed = new URL(url, 'https://minijoomla.invalid/'); } catch { throw new ValidationError(`${name} inválido.`); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new ValidationError(`${name} deve ser um caminho relativo ou URL HTTPS.`);
    return url;
  }
  return text;
}

function writeParamValue(target, key, value) {
  // Preserve inclusive __proto__ como dado, nunca como setter herdado.
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

/*
 * Normaliza `values` contra `definitions`. Valores declarados ausentes
 * recebem o padrão; chaves não declaradas são descartadas, exceto quando
 * `keepUndeclared` preserva configurações avançadas existentes.
 */
export function normalizeParamValues(definitions, values = {}, { keepUndeclared = false } = {}) {
  const input = plainObject(values) ? Object.fromEntries(dataEntries(values)) : {};
  const result = {};
  if (keepUndeclared) {
    const budget = { nodes: 0 };
    for (const [key, value] of Object.entries(input)) if (!definitions.some((definition) => definition.name === key)) writeParamValue(result, key, cloneJson(value, new Set(), 0, budget, true));
  }
  for (const definition of definitions) {
    const value = Object.hasOwn(input, definition.name) ? input[definition.name] : undefined;
    if (value === undefined) {
      if (definition.default !== undefined) writeParamValue(result, definition.name, coerceParam(definition, definition.default));
      continue;
    }
    writeParamValue(result, definition.name, coerceParam(definition, value));
  }
  return result;
}

export function defaultParamValues(definitions) {
  return normalizeParamValues(definitions);
}

export function parseJsonObject(value, { strict = false, field = 'Parâmetros' } = {}) {
  if (value === undefined || value === null || value === '') return {};
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!plainObject(parsed)) throw new Error('Invalid object');
    return cloneJson(parsed, new Set(), 0, { nodes: 0 }, true);
  } catch {
    if (strict) throw new ValidationError(`${field} persistido deve ser um objeto JSON válido. Nenhum dado foi alterado.`);
    return {};
  }
}
