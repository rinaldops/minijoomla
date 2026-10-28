import { normalizeQuery } from '../core/contracts.js';

export function createContentService(adapter, config) {
  return {
    article: async (alias, options = {}) => { const item = await adapter.getArticle(alias, options); return item && { ...item, siteName: config.siteName }; },
    categoryPath: async (alias) => adapter.getCategoryPath ? adapter.getCategoryPath(alias) : [await adapter.getCategory(alias)].filter(Boolean),
    category: async (alias, options = {}) => { const category = await adapter.getCategory(alias); if (!category) return null; return { category, ...(await adapter.listArticles({ category: alias, pageSize: config.pageSize, ...options })) }; },
    search: async (query, options = {}) => { const normalized = normalizeQuery(query); if (!normalized) return { items: [], total: 0, page: 1, pageSize: config.pageSize, pages: 0, query: normalized, emptyQuery: true }; return { ...(await adapter.listArticles({ search: normalized, pageSize: config.pageSize, ...options })), query: normalized, emptyQuery: false }; }
  };
}
