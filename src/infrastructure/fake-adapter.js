const articles = [
  { id: 1, title: 'Bem-vindo ao MINIJOOMLA', alias: 'boas-vindas', introtext: 'Uma camada Joomla-like pequena e independente.', fulltext: '<p>Este artigo demonstra conteúdo seguro, categorias e módulos.</p>', author: 'Equipe editorial', category: 'noticias', tags: ['início', 'guia'], published: true, featured: true, publishUp: '2026-01-01', publishDown: null },
  { id: 2, title: 'Conteúdo modular', alias: 'conteudo-modular', introtext: 'Componentes e módulos usam contratos explícitos.', fulltext: '<p>O template não conhece detalhes do adapter de dados.</p>', author: 'Equipe editorial', category: 'noticias', tags: ['arquitetura'], published: true, featured: false, publishUp: '2026-02-01', publishDown: null }
];
const categories = [{ id: 1, title: 'Notícias', alias: 'noticias', parentId: null, description: 'Publicações recentes.' }];
const menus = [{ title: 'Início', path: '/' }, { title: 'Notícias', path: '/category/noticias' }];

function visible(article, now = new Date()) { const current = new Date(now).getTime(); const start = new Date(article.publishUp ?? 0).getTime(); const end = article.publishDown ? new Date(article.publishDown).getTime() : Infinity; return article.published === true && start <= current && current < end; }
function pageOptions({ page = 1, pageSize = 5 } = {}) { return { page: Math.max(1, Number(page) || 1), pageSize: Math.min(50, Math.max(1, Number(pageSize) || 5)) }; }
const SORT_FIELDS = new Set(['publishUp', 'title', 'alias', 'id']);
function cloneArticle(article) { return article ? { ...article, tags: [...(article.tags ?? [])] } : article; }
function cloneCategory(category) { return category ? { ...category } : category; }
export function createFakeAdapter(seed = {}) {
  const data = { articles: seed.articles ?? articles, categories: seed.categories ?? categories, menus: seed.menus ?? menus };
  return Object.freeze({
    async listArticles({ category, tag, page = 1, pageSize = 5, search = '', sort = 'publishUp', direction = 'desc', now = new Date() } = {}) {
      const paging = pageOptions({ page, pageSize }); const term = String(search).toLocaleLowerCase(); const field = SORT_FIELDS.has(sort) ? sort : 'publishUp'; const multiplier = direction === 'asc' ? 1 : -1;
      const items = data.articles.filter((a) => visible(a, now) && (!category || a.category === category) && (!tag || (a.tags ?? []).includes(tag)) && (!term || `${a.title} ${a.introtext} ${a.fulltext} ${(a.tags ?? []).join(' ')}`.toLocaleLowerCase().includes(term))).sort((a, b) => { const left = a[field] ?? ''; const right = b[field] ?? ''; const primary = left < right ? -1 : left > right ? 1 : 0; if (primary) return primary * multiplier; const leftTie = String(a.alias ?? a.id ?? ''); const rightTie = String(b.alias ?? b.id ?? ''); return leftTie < rightTie ? -1 : leftTie > rightTie ? 1 : 0; });
      const start = (paging.page - 1) * paging.pageSize; return { items: items.slice(start, start + paging.pageSize).map(cloneArticle), total: items.length, page: paging.page, pageSize: paging.pageSize, pages: Math.ceil(items.length / paging.pageSize) };
    },
    async getArticle(alias, { now = new Date() } = {}) { return cloneArticle(data.articles.find((a) => a.alias === alias && visible(a, now)) ?? null); },
    async getCategory(alias) { return cloneCategory(data.categories.find((c) => c.alias === alias) ?? null); },
    async getCategoryPath(alias) {
      const path = []; let current = data.categories.find((c) => c.alias === alias); const seen = new Set();
      while (current && !seen.has(current.id)) { path.unshift(current); seen.add(current.id); current = data.categories.find((category) => category.id === current.parentId); }
      return path.map(cloneCategory);
    },
    async listCategories({ parentId = undefined } = {}) { return data.categories.filter((c) => parentId === undefined || c.parentId === parentId).map(cloneCategory); },
    async listMenus() { return data.menus.map((menu) => ({ ...menu })); },
    async listTags({ popular = false, now = new Date(), limit = 0 } = {}) { const counts = data.articles.filter((article) => visible(article, now)).flatMap((article) => article.tags ?? []).reduce((result, tag) => ({ ...result, [tag]: (result[tag] ?? 0) + 1 }), {}); const tags = Object.keys(counts).sort((a, b) => popular ? counts[b] - counts[a] || a.localeCompare(b) : a.localeCompare(b)); const boundedLimit = Math.min(50, Math.max(0, Number(limit) || 0)); const selected = boundedLimit ? tags.slice(0, boundedLimit) : tags; return popular ? selected.map((name) => ({ name, count: counts[name] })) : selected; },
    async listArticlesByTag(tag, options = {}) { return this.listArticles({ ...options, tag }); }
  });
}
