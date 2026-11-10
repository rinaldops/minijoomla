export class NotFoundError extends Error { constructor(message = 'Recurso não encontrado', options) { super(message, options); this.name = 'NotFoundError'; } }
export class ValidationError extends Error { constructor(message = 'Parâmetro inválido', options) { super(message, options); this.name = 'ValidationError'; } }
export class DataError extends Error { constructor(message = 'Falha ao consultar conteúdo', options) { super(message, options); this.name = 'DataError'; } }

export function normalizeQuery(value, limit = 120) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim().slice(0, limit).trim();
}

export function emptyPage(page = 1, pageSize = 5) { return { items: [], total: 0, page, pageSize, pages: 0 }; }
