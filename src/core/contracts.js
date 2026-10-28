export class NotFoundError extends Error { constructor(message = 'Recurso não encontrado') { super(message); this.name = 'NotFoundError'; } }
export class ValidationError extends Error { constructor(message = 'Parâmetro inválido') { super(message); this.name = 'ValidationError'; } }
export class DataError extends Error { constructor(message = 'Falha ao consultar conteúdo') { super(message); this.name = 'DataError'; } }

export function normalizeQuery(value, limit = 120) {
  return String(value ?? '').trim().slice(0, limit);
}

export function emptyPage(page = 1, pageSize = 5) { return { items: [], total: 0, page, pageSize, pages: 0 }; }
