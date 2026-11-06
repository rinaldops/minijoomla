/*
 * Plano puro e conservador de atribuição legada: só propõe conversões
 * exatas. Não aplica o plano nem lê assignmentJson; um assignment já
 * declarado (inclusive desconhecido) pertence ao runtime existente.
 */
import { ASSIGNMENT_ROUTES } from './module-assignment.js';

// Ancora no fim real da string, sem aceitar nem uma quebra de linha final.
const CATEGORY_ALIAS = /^[a-z0-9][a-z0-9_-]{0,99}(?![\s\S])/;

function ownValue(record, field) {
  return record !== null && record !== undefined && Object.hasOwn(record, field) ? record[field] : undefined;
}

function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

function refusal(reason) {
  return Object.freeze({ convertible: false, reason });
}

function exact(assignment, tokens) {
  return Object.freeze({ convertible: true, reason: 'exact', assignment, assignmentTokens: Object.freeze(tokens) });
}

export function planLegacyModuleAssignment(record = {}) {
  if (ownValue(record, 'assignment')) return refusal('already-assigned');

  const persistedKind = ownValue(record, 'scopeKind');
  const kind = isEmpty(persistedKind) ? 'All' : persistedKind;
  if (kind !== 'All' && kind !== 'Route') return refusal('unsupported-kind');

  const route = ownValue(record, 'scopeRoute');
  const alias = ownValue(record, 'scopeCategoryAlias');
  if (kind === 'All') {
    // Campos obsoletos precisam de decisão explícita, mesmo se o runtime
    // legado os ignora: não apagar intenção persistida por inferência.
    if (!isEmpty(alias)) return refusal('unsupported-category');
    if (!isEmpty(route)) return refusal('unsupported-route');
    return exact('all', []);
  }

  if (!ASSIGNMENT_ROUTES.includes(route)) return refusal('unsupported-route');
  if (!isEmpty(alias)) {
    if (route !== 'category' || typeof alias !== 'string' || !CATEGORY_ALIAS.test(alias)) return refusal('unsupported-category');
    // O legado exige rota category E alias; tokens são OR, e category:X
    // também corresponde a artigos. Nenhuma dessas opções é equivalente.
    return refusal('category-intersection');
  }
  return exact('only', [`route:${route}`]);
}
