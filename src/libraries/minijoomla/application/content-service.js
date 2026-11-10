import { normalizeQuery } from '../core/contracts.js';

const own = (value, key) => value && Object.hasOwn(value, key) ? value[key] : undefined;
const ORDERS = { 'publishUp-desc': ['publishUp', 'desc'], 'publishUp-asc': ['publishUp', 'asc'], 'title-asc': ['title', 'asc'] };
const SORT_FIELDS = ['publishUp', 'title', 'author', 'alias', 'id'];
const SEARCH_MODES = ['all', 'any', 'exact'];
function limit(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 && number <= 50 ? number : undefined;
}
function savedLimit(config, component, key) {
  // Resolved component params include defaults of 10. Only an explicitly stored
  // limit replaces the historical site pageSize; inline params remain explicit.
  if (!Object.hasOwn(config, 'componentParamsJson')) return limit(own(own(config.componentParams, component), key));
  try {
    const stored = typeof config.componentParamsJson === 'string' ? JSON.parse(config.componentParamsJson) : config.componentParamsJson;
    return limit(own(own(stored, component), key));
  } catch { return undefined; }
}

export function resolveContentQuery(config, options = {}, { list = false, search = false } = {}) {
  const content = own(config.componentParams, 'content');
  const configuredOrder = own(ORDERS, own(options, 'orderBy')) ?? own(ORDERS, own(content, 'orderBy'));
  const order = configuredOrder ?? ORDERS['publishUp-desc'];
  const routeSort = own(options, 'sort');
  const sort = SORT_FIELDS.includes(routeSort) ? routeSort : order[0];
  const routeDirection = own(options, 'direction') ?? own(options, 'dir');
  const direction = ['asc', 'desc'].includes(routeDirection) ? routeDirection
    : SORT_FIELDS.includes(routeSort) ? (sort === 'publishUp' ? 'desc' : 'asc') : order[1];
  const pageSize = limit(own(options, 'pageSize'))
    ?? (search ? savedLimit(config, 'search', 'resultsLimit') : list ? savedLimit(config, 'content', 'listLimit') : undefined)
    ?? config.pageSize;
  const routeMode = own(options, 'searchMode') ?? own(options, 'searchPhrases');
  const savedMode = own(own(config.componentParams, 'search'), 'searchPhrases');
  const searchMode = SEARCH_MODES.includes(routeMode) ? routeMode : SEARCH_MODES.includes(savedMode) ? savedMode : 'all';
  const configuredSort = configuredOrder || SORT_FIELDS.includes(routeSort) || ['asc', 'desc'].includes(routeDirection);
  return { pageSize, ...(configuredSort ? { sort, direction } : {}), ...(search ? { searchMode } : {}) };
}

function portOptions({ layout, orderBy, dir, sort, direction, pageSize, searchMode, searchPhrases, ...options } = {}) { return options; }

function normalizePage(result, pageSize) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const page = Math.max(1, Number(result?.page) || 1);
  const size = Math.max(1, Number(result?.pageSize) || pageSize);
  const total = Math.max(items.length, Number(result?.total) || 0);
  const pages = Math.max(0, Number(result?.pages) || (total ? Math.ceil(total / size) : 0));
  return { items, total, page, pageSize: size, pages };
}

export function createContentService(adapter, config) {
  const safeAdapter = adapter && typeof adapter === 'object' ? adapter : {};
  const category = async (alias, options = {}) => {
    const item = typeof safeAdapter.getCategory === 'function' ? await safeAdapter.getCategory(alias) : null;
    if (!item) return null;
    const query = { ...portOptions(options), ...resolveContentQuery(config, options, { list: own(options, 'layout') === 'list' }), category: alias };
    const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles(query) : null;
    return { category: item, ...normalizePage(page, query.pageSize) };
  };
  const countIn = async (alias) => (typeof safeAdapter.listArticles === 'function' ? Number((await safeAdapter.listArticles({ category: alias, pageSize: 1 }))?.total) || 0 : 0);
  const rows = async () => { const list = typeof safeAdapter.listCategories === 'function' ? await safeAdapter.listCategories() : []; return Array.isArray(list) ? list : []; };
  const childrenOf = (all, parent) => all.filter((row) => row.parentId != null && String(row.parentId) === String(parent.id));
  const tree = async (all, parent, seen = new Set()) => Promise.all(childrenOf(all, parent).filter((row) => !seen.has(row.id)).map(async (row) => ({ category: row, count: await countIn(row.alias), children: await tree(all, row, new Set([...seen, row.id])) })));
  return {
    // Direct subcategories with article counts (category blog/list "cat-children").
    subcategories: async (parent) => Promise.all(childrenOf(await rows(), parent).map(async (row) => ({ category: row, count: await countIn(row.alias) }))),
    // Nested category tree with article counts (/categories).
    categoriesTree: async () => { const all = await rows(); const ids = new Set(all.map((row) => String(row.id))); const roots = all.filter((row) => row.parentId == null || !ids.has(String(row.parentId))); return Promise.all(roots.map(async (row) => ({ category: row, count: await countIn(row.alias), children: await tree(all, row, new Set([row.id])) }))); },
    // Tags with usage counts (/tags) and articles of one tag (/tag/:alias); null when the tag is unknown.
    tags: async () => { const list = typeof safeAdapter.listTags === 'function' ? await safeAdapter.listTags({ popular: true }) : []; return (Array.isArray(list) ? list : []).map((tag) => (typeof tag === 'string' ? { name: tag } : tag)).filter((tag) => tag?.name); },
    tag: async (name, options = {}) => {
      const query = { ...portOptions(options), ...resolveContentQuery(config, options), tag: name };
      const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles(query) : null;
      const result = normalizePage(page, query.pageSize);
      // Tag despublicada/na lixeira fica fora de listTags e, portanto, é desconhecida mesmo que ainda haja artigos.
      if (typeof safeAdapter.listTags === 'function') {
        const known = (await safeAdapter.listTags({ popular: true })).some((tag) => (typeof tag === 'string' ? tag : tag?.name) === name);
        if (!known) return null;
      }
      return { tag: name, ...result };
    },
    article: async (alias, options = {}) => {
      const item = typeof safeAdapter.getArticle === 'function' ? await safeAdapter.getArticle(alias, options) : null;
      if (!item) return null;
      let category = item.category;
      if (!category && item.categoryId != null && typeof safeAdapter.listCategories === 'function') {
        const categories = await safeAdapter.listCategories();
        category = Array.isArray(categories) ? categories.find((row) => String(row.id) === String(item.categoryId))?.title : undefined;
      }
      let categoryAlias = item.category;
      if (!item.category && item.categoryId != null && typeof safeAdapter.listCategories === 'function') {
        categoryAlias = (await safeAdapter.listCategories()).find((row) => String(row.id) === String(item.categoryId))?.alias;
      }
      return { ...item, ...(category ? { category } : {}), ...(categoryAlias ? { categoryAlias } : {}), siteName: config.siteName };
    },
    categoryPath: async (alias) => { const path = typeof safeAdapter.getCategoryPath === 'function' ? await safeAdapter.getCategoryPath(alias) : (typeof safeAdapter.getCategory === 'function' ? [await safeAdapter.getCategory(alias)].filter(Boolean) : []); return Array.isArray(path) ? path : []; },
    category,
    home: async (options = {}) => {
      if (config.homeView !== 'featured') return category(config.homeCategory ?? 'noticias', options);
      const query = { ...portOptions(options), ...resolveContentQuery(config, options), featured: true };
      const page = typeof safeAdapter.listArticles === 'function'
        ? await safeAdapter.listArticles(query)
        : null;
      return normalizePage(page, query.pageSize);
    },
    search: async (query, options = {}) => {
      const normalized = normalizeQuery(query);
      const resolved = resolveContentQuery(config, options, { search: true });
      if (!normalized) return { items: [], total: 0, page: 1, pageSize: resolved.pageSize, pages: 0, query: normalized, emptyQuery: true };
      const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles({ ...portOptions(options), ...resolved, search: normalized }) : null;
      return { ...normalizePage(page, resolved.pageSize), query: normalized, emptyQuery: false };
    },
    similarArticles: async (alias, options = {}) => { const items = typeof safeAdapter.listSimilarArticles === 'function' ? await safeAdapter.listSimilarArticles(alias, options) : []; return Array.isArray(items) ? items : []; },
    archive: async ({ year, month, ...options } = {}) => { const query = { year, month, ...portOptions(options), ...resolveContentQuery(config, options, { list: true }) }; const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles(query) : null; return normalizePage(page, query.pageSize); },
    archiveMonths: async (options = {}) => { const months = typeof safeAdapter.listArchive === 'function' ? await safeAdapter.listArchive(options) : []; return Array.isArray(months) ? months : []; }
  };
}
