/*
 * Atribuição de módulos a páginas (equivalente funcional à aba "Menu
 * Assignment" do com_modules) e janela de publicação. Funções puras,
 * usadas pelo serviço admin para validar e disponíveis ao runtime público
 * para decidir visibilidade sem depender do painel.
 *
 * Tokens de página:
 *   - `menu:<id>`        item de menu (id do registro em Menu)
 *   - `route:<nome>`     rota nativa: home/category/article/search/archive
 *   - `category:<alias>` páginas da categoria com aquele alias
 */
import { ValidationError } from '../core/contracts.js';

export const MODULE_ASSIGNMENTS = Object.freeze(['all', 'none', 'only', 'except']);
export const ASSIGNMENT_ROUTES = Object.freeze(['home', 'category', 'article', 'search', 'archive']);
const TOKEN = /^(menu:\d{1,9}|route:(home|category|article|search|archive)|category:[a-z0-9][a-z0-9_-]{0,99})$/;

export function normalizeAssignment(value) {
  const assignment = value === undefined || value === null || value === '' ? 'all' : String(value);
  if (!MODULE_ASSIGNMENTS.includes(assignment)) throw new ValidationError('assignment deve ser all, none, only ou except.');
  return assignment;
}

export function normalizeAssignmentTokens(value) {
  let tokens = value;
  if (tokens === undefined || tokens === null || tokens === '') return [];
  if (typeof tokens === 'string') {
    try { tokens = JSON.parse(tokens); } catch { throw new ValidationError('assignmentJson deve ser uma lista JSON.'); }
  }
  if (!Array.isArray(tokens)) throw new ValidationError('assignmentJson deve ser uma lista.');
  if (tokens.length > 200) throw new ValidationError('Selecione no máximo 200 páginas.');
  const normalized = [...new Set(tokens.map((token) => String(token).trim()))];
  const invalid = normalized.find((token) => !TOKEN.test(token));
  if (invalid !== undefined) throw new ValidationError(`Página de atribuição inválida: ${invalid}.`);
  return normalized;
}

export function normalizeDateTime(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${field} deve ser uma data válida.`);
  return date.toISOString();
}

/*
 * Resolve o ÚNICO item de menu cujo `path` bate exatamente com a rota atual
 * — usado pelo runtime para popular `menuItemId` em `tokensFor`, abaixo
 * (nunca decidido pelo painel, que só grava o id já conhecido ao montar o
 * formulário de atribuição).
 *
 * Quando dois ou mais itens de menu PUBLICADOS apontam para o mesmo `path`
 * (cenário real do Joomla: dois itens de menu distintos, Itemids
 * diferentes, mesmo link — ex.: o mesmo artigo acessível por dois caminhos
 * de navegação), esta função devolve `undefined` em vez de escolher um
 * arbitrariamente. Resolver um dos dois "ganharia" a atribuição `menu:<id>`
 * incorretamente para o outro, atribuindo/ocultando um módulo na página
 * errada sob a perspectiva do administrador que configurou aquele item de
 * menu específico — pior que simplesmente não aplicar a atribuição por
 * item de menu nesse caso raro (o módulo continua respeitando
 * `route`/`category`, se também configurados).
 */
/* Chave de comparação de item de menu: caminho + layout=list (blog e lista da mesma categoria são itens distintos). */
export function menuPathKey(path) {
  if (typeof path !== 'string') return undefined;
  const [base, query = ''] = path.split('?');
  return new URLSearchParams(query).get('layout') === 'list' ? `${base}?layout=list` : base;
}

export function resolveActiveMenuItemId(menus, path) {
  if (!Array.isArray(menus) || typeof path !== 'string' || !path) return undefined;
  const key = menuPathKey(path);
  const matches = menus.filter((item) => item && menuPathKey(item.path) === key && item.id !== undefined && item.id !== null);
  return matches.length === 1 ? matches[0].id : undefined;
}

function tokensFor({ route, categoryAlias, menuItemId } = {}) {
  const tokens = new Set();
  if (route) tokens.add(`route:${route}`);
  if (categoryAlias) tokens.add(`category:${categoryAlias}`);
  if (menuItemId !== undefined && menuItemId !== null && menuItemId !== '') tokens.add(`menu:${menuItemId}`);
  return tokens;
}

function parseTokens(instance) {
  try { return normalizeAssignmentTokens(instance.assignmentJson ?? instance.assignmentTokens); } catch { return []; }
}

/*
 * Visibilidade completa de uma instância: publicada (enabled e fora da
 * lixeira), dentro de publishUp/publishDown e atribuída ao contexto. Quando
 * `assignment` não existe (registros legados), devolve `undefined` na
 * etapa de atribuição para que o chamador aplique o escopo legado
 * (scopeKind/scopeRoute/scopeCategoryAlias).
 */
export function moduleAssignmentMatches(instance = {}, context = {}) {
  if (!instance.assignment) return undefined;
  const assignment = MODULE_ASSIGNMENTS.includes(instance.assignment) ? instance.assignment : 'all';
  if (assignment === 'all') return true;
  if (assignment === 'none') return false;
  const current = tokensFor(context);
  const hit = parseTokens(instance).some((token) => current.has(token));
  return assignment === 'only' ? hit : !hit;
}

export function isModulePublished(instance = {}, now = new Date()) {
  if (instance.enabled === false || instance.trashed === true) return false;
  const time = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const up = instance.publishUp ? new Date(instance.publishUp).getTime() : NaN;
  const down = instance.publishDown ? new Date(instance.publishDown).getTime() : NaN;
  if (Number.isFinite(up) && time < up) return false;
  if (Number.isFinite(down) && time >= down) return false;
  return true;
}

export function moduleState(instance = {}) {
  if (instance.trashed === true) return 'trashed';
  return instance.enabled === false ? 'unpublished' : 'published';
}
