export function createContentService(adapter, config) {
  return {
    article: async (alias, options = {}) => { const item = await adapter.getArticle(alias, options); return item && { ...item, siteName: config.siteName }; },
    category: async (alias, options = {}) => { const category = await adapter.getCategory(alias); if (!category) return null; return { category, ...(await adapter.listArticles({ category: alias, pageSize: config.pageSize, ...options })) }; },
    search: (query, options = {}) => adapter.listArticles({ search: query, pageSize: config.pageSize, ...options })
  };
}
