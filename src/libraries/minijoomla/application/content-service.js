import { normalizeQuery, normalizePageSize, normalizePageNumber, queryInteger, normalizeSearchMode, ownDataValue as own, ownEnumerableData } from '../core/contracts.js';
import { parseJsonObject } from './declared-params.js';

const SORT_FIELDS = ['publishUp', 'title', 'alias', 'id', 'author'];
const ORDERINGS = { 'publishUp-desc': { sort: 'publishUp', direction: 'desc' }, 'publishUp-asc': { sort: 'publishUp', direction: 'asc' }, 'title-asc': { sort: 'title', direction: 'asc' } };
const QUERY_FIELDS = ['category', 'tag', 'featured', 'year', 'month', 'page', 'search', 'titleContains', 'now'];

// The resolved display defaults (10) are not evidence that a limit was saved.
// An own componentParamsJson, even undefined, is authoritative provenance.
export function resolveQueryParams(config = {}) {
  const source = Object.hasOwn(config, 'queryParams') ? own(config, 'queryParams')
    : Object.hasOwn(config, 'componentParamsJson') ? parseJsonObject(own(config, 'componentParamsJson'))
      : own(config, 'componentParams');
  const content = own(source, 'content'); const search = own(source, 'search');
  const listLimit = queryInteger(own(content, 'listLimit')); const resultsLimit = queryInteger(own(search, 'resultsLimit'));
  const orderBy = own(content, 'orderBy');
  return Object.freeze({
    content: Object.freeze({ ...(listLimit === undefined ? {} : { listLimit }), orderBy: typeof orderBy === 'string' && Object.hasOwn(ORDERINGS, orderBy) ? orderBy : 'publishUp-desc' }),
    search: Object.freeze({ ...(resultsLimit === undefined ? {} : { resultsLimit }), searchPhrases: normalizeSearchMode(own(search, 'searchPhrases'), 'all') })
  });
}

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
  const params = resolveQueryParams(config);
  config = ownEnumerableData(config);
  const queryOptions = (options = {}, component = 'content') => {
    options = ownEnumerableData(options);
    const fallback = ORDERINGS[params.content.orderBy];
    const explicitSort = SORT_FIELDS.includes(options.sort);
    const sort = explicitSort ? options.sort : fallback.sort;
    const direction = ['asc', 'desc'].includes(options.direction) ? options.direction
      : explicitSort ? (sort === 'publishUp' ? 'desc' : 'asc') : fallback.direction;
    return {
      pageSize: normalizePageSize(options.pageSize, params[component]?.[component === 'search' ? 'resultsLimit' : 'listLimit'] ?? config.pageSize),
      sort, direction,
      ...(component === 'search' ? { searchMode: normalizeSearchMode(options.searchMode ?? options.searchPhrases ?? options.searchphrase, params.search.searchPhrases) } : {})
    };
  };
  const listOptions = (options, component = 'content') => {
    options = ownEnumerableData(options);
    const resolved = queryOptions(options, component);
    const result = Object.fromEntries(QUERY_FIELDS.filter((key) => Object.hasOwn(options, key)).map((key) => [key, options[key]]));
    Object.assign(result, resolved);
    // Keep the historical omitted default keys, but never forward raw sort/dir.
    if (!Object.hasOwn(options, 'sort') && !Object.hasOwn(options, 'direction') && params.content.orderBy === 'publishUp-desc') { delete result.sort; delete result.direction; }
    if (Object.hasOwn(options, 'page')) result.page = normalizePageNumber(options.page);
    return result;
  };
  const category = async (alias, options = {}) => {
    const item = typeof safeAdapter.getCategory === 'function' ? await safeAdapter.getCategory(alias) : null;
    if (!item) return null;
    const query = listOptions(options);
    const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles({ ...query, category: alias }) : null;
    return { category: item, ...normalizePage(page, query.pageSize) };
  };
  const countIn = async (alias) => (typeof safeAdapter.listArticles === 'function' ? Number((await safeAdapter.listArticles({ category: alias, pageSize: 1 }))?.total) || 0 : 0);
  const rows = async () => { const list = typeof safeAdapter.listCategories === 'function' ? await safeAdapter.listCategories() : []; return Array.isArray(list) ? list : []; };
  const childrenOf = (all, parent) => all.filter((row) => row.parentId != null && String(row.parentId) === String(parent.id));
  const tree = async (all, parent, seen = new Set()) => Promise.all(childrenOf(all, parent).filter((row) => !seen.has(row.id)).map(async (row) => ({ category: row, count: await countIn(row.alias), children: await tree(all, row, new Set([...seen, row.id])) })));
  return {
    queryOptions,
    // Direct subcategories with article counts (category blog/list "cat-children").
    subcategories: async (parent) => Promise.all(childrenOf(await rows(), parent).map(async (row) => ({ category: row, count: await countIn(row.alias) }))),
    // Nested category tree with article counts (/categories).
    categoriesTree: async () => { const all = await rows(); const ids = new Set(all.map((row) => String(row.id))); const roots = all.filter((row) => row.parentId == null || !ids.has(String(row.parentId))); return Promise.all(roots.map(async (row) => ({ category: row, count: await countIn(row.alias), children: await tree(all, row, new Set([row.id])) }))); },
    // Tags with usage counts (/tags) and articles of one tag (/tag/:alias); null when the tag is unknown.
    tags: async () => { const list = typeof safeAdapter.listTags === 'function' ? await safeAdapter.listTags({ popular: true }) : []; return (Array.isArray(list) ? list : []).map((tag) => (typeof tag === 'string' ? { name: tag } : tag)).filter((tag) => tag?.name); },
    tag: async (name, options = {}) => {
      const query = listOptions(options);
      const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles({ ...query, tag: name }) : null;
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
      const query = listOptions(options);
      const page = typeof safeAdapter.listArticles === 'function'
        ? await safeAdapter.listArticles({ ...query, featured: true })
        : null;
      return normalizePage(page, query.pageSize);
    },
    search: async (query, options = {}) => { const normalized = normalizeQuery(query); const resolved = listOptions(options, 'search'); if (!normalized) return { items: [], total: 0, page: 1, pageSize: resolved.pageSize, pages: 0, query: normalized, emptyQuery: true }; const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles({ ...resolved, search: normalized }) : null; return { ...normalizePage(page, resolved.pageSize), query: normalized, emptyQuery: false }; },
    similarArticles: async (alias, options = {}) => { const items = typeof safeAdapter.listSimilarArticles === 'function' ? await safeAdapter.listSimilarArticles(alias, options) : []; return Array.isArray(items) ? items : []; },
    archive: async (options = {}) => { const query = listOptions(options); const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles(query) : null; return normalizePage(page, query.pageSize); },
    archiveMonths: async (options = {}) => { const months = typeof safeAdapter.listArchive === 'function' ? await safeAdapter.listArchive(options) : []; return Array.isArray(months) ? months : []; }
  };
}
