export class NotFoundError extends Error { constructor(message = 'Recurso não encontrado', options) { super(message, options); this.name = 'NotFoundError'; } }
export class ValidationError extends Error { constructor(message = 'Parâmetro inválido', options) { super(message, options); this.name = 'ValidationError'; } }
export class DataError extends Error { constructor(message = 'Falha ao consultar conteúdo', options) { super(message, options); this.name = 'DataError'; } }

// Query/configuration envelopes are data: never read inherited values or invoke
// accessors. A present own undefined still carries provenance.
export function ownDataValue(value, key) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor && !Object.hasOwn(descriptor, 'value')) throw new TypeError(`Propriedade de dados obrigatória: ${key}.`);
  return descriptor?.value;
}

export function ownEnumerableData(value) {
  const result = Object.create(null);
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return result;
  for (const key of Object.getOwnPropertyNames(value)) {
    const entry = ownDataValue(value, key);
    if (Object.getOwnPropertyDescriptor(value, key).enumerable) result[key] = entry;
  }
  return result;
}

export function normalizeQuery(value, limit = 120) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim().slice(0, limit).trim();
}

// Route values can be numeric strings; coercible objects/booleans are not numbers.
export function queryInteger(value, min = 1, max = 50) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : undefined;
}

export function normalizePageSize(value, fallback = 5) { return queryInteger(value) ?? queryInteger(fallback) ?? 5; }
export function normalizePageNumber(value) { return queryInteger(value, 1, Number.MAX_SAFE_INTEGER) ?? 1; }
export function normalizeSearchMode(value, fallback = 'exact') { return ['all', 'any', 'exact'].includes(value) ? value : fallback; }

// Literal includes(), never a user-provided regex. Both adapters share the corpus
// and normalization so counts and pagination do not depend on the transport.
export function matchesSearch(article, query, mode = 'exact') {
  const term = normalizeQuery(query).toLocaleLowerCase();
  if (!term) return true;
  const text = normalizeQuery(`${article.title ?? ''} ${article.introtext ?? ''} ${article.fulltext ?? ''} ${(article.tags ?? []).join(' ')}`, Infinity).toLocaleLowerCase();
  const words = term.split(' ');
  const resolved = normalizeSearchMode(mode);
  return resolved === 'all' ? words.every((word) => text.includes(word)) : resolved === 'any' ? words.some((word) => text.includes(word)) : text.includes(term);
}

export function emptyPage(page = 1, pageSize = 5) { return { items: [], total: 0, page, pageSize, pages: 0 }; }
