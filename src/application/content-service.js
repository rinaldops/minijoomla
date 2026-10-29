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
  const safeAdapter = adapter && typeof adapter === 'object' ? adapter : {};
  return {
    article: async (alias, options = {}) => { const item = typeof safeAdapter.getArticle === 'function' ? await safeAdapter.getArticle(alias, options) : null; return item && { ...item, siteName: config.siteName }; },
    categoryPath: async (alias) => { const path = typeof safeAdapter.getCategoryPath === 'function' ? await safeAdapter.getCategoryPath(alias) : (typeof safeAdapter.getCategory === 'function' ? [await safeAdapter.getCategory(alias)].filter(Boolean) : []); return Array.isArray(path) ? path : []; },
    category: async (alias, options = {}) => { const category = typeof safeAdapter.getCategory === 'function' ? await safeAdapter.getCategory(alias) : null; if (!category) return null; const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles({ category: alias, pageSize: config.pageSize, ...options }) : null; return { category, ...normalizePage(page, config.pageSize) }; },
    search: async (query, options = {}) => { const normalized = normalizeQuery(query); if (!normalized) return { items: [], total: 0, page: 1, pageSize: config.pageSize, pages: 0, query: normalized, emptyQuery: true }; const page = typeof safeAdapter.listArticles === 'function' ? await safeAdapter.listArticles({ search: normalized, pageSize: config.pageSize, ...options }) : null; return { ...normalizePage(page, config.pageSize), query: normalized, emptyQuery: false }; }
  };
}
