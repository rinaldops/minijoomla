import { normalizeQuery } from '../core/contracts.js';

function normalizePage(result, pageSize) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const page = Math.max(1, Number(result?.page) || 1);
  const size = Math.max(1, Number(result?.pageSize) || pageSize);
  const total = Math.max(items.length, Number(result?.total) || 0);
  const pages = Math.max(0, Number(result?.pages) || (total ? Math.ceil(total / size) : 0));
  return { items, total, page, pageSize: size, pages };
}

export function createContentService(adapter, config) {
  return {
    article: async (alias, options = {}) => { const item = await adapter.getArticle(alias, options); return item && { ...item, siteName: config.siteName }; },
    categoryPath: async (alias) => { const path = adapter.getCategoryPath ? await adapter.getCategoryPath(alias) : (adapter.getCategory ? [await adapter.getCategory(alias)].filter(Boolean) : []); return Array.isArray(path) ? path : []; },
    category: async (alias, options = {}) => { const category = await adapter.getCategory(alias); if (!category) return null; return { category, ...normalizePage(await adapter.listArticles({ category: alias, pageSize: config.pageSize, ...options }), config.pageSize) }; },
    search: async (query, options = {}) => { const normalized = normalizeQuery(query); if (!normalized) return { items: [], total: 0, page: 1, pageSize: config.pageSize, pages: 0, query: normalized, emptyQuery: true }; return { ...normalizePage(await adapter.listArticles({ search: normalized, pageSize: config.pageSize, ...options }), config.pageSize), query: normalized, emptyQuery: false }; }
  };
}
