import { inDateWindow } from '../core/date-window.js';
import { matchesSearch, normalizeQuery, normalizePageSize, normalizePageNumber } from '../core/contracts.js';

const articles = [
  { id: 1, title: 'Bem-vindo ao MINIJOOMLA', alias: 'boas-vindas', introtext: 'Uma camada Joomla-like pequena e independente.', fulltext: '<p>Este artigo demonstra conteúdo seguro, categorias e módulos.</p>', author: 'Equipe editorial', category: 'noticias', tags: ['início', 'guia'], published: true, featured: true, publishUp: '2026-01-01', publishDown: null },
  { id: 2, title: 'Conteúdo modular', alias: 'conteudo-modular', introtext: 'Componentes e módulos usam contratos explícitos.', fulltext: '<p>O template não conhece detalhes do adapter de dados.</p>', author: 'Equipe editorial', category: 'noticias', tags: ['arquitetura', 'guia'], published: true, featured: false, publishUp: '2026-02-01', publishDown: null }
];
const categories = [{ id: 1, title: 'Notícias', alias: 'noticias', parentId: null, description: 'Publicações recentes.' }];
const menus = [{ title: 'Início', path: '/' }, { title: 'Notícias', path: '/category/noticias' }];

function visible(article, now = new Date()) {
  return article.published === true && inDateWindow(article.publishUp, article.publishDown, now);
}
function isFeatured(article, now) { return article.featured === true && inDateWindow(article.featuredUp, article.featuredDown, now); }
function inArchiveMonth(article, year, month) {
  if (year == null && month == null) return true;
  if (!article.publishUp) return false;
  const date = new Date(article.publishUp);
  if (Number.isNaN(date.getTime())) return false;
  return (year == null || date.getUTCFullYear() === Number(year)) && (month == null || date.getUTCMonth() + 1 === Number(month));
}
function pageOptions({ page = 1, pageSize = 5 } = {}) { return { page: normalizePageNumber(page), pageSize: normalizePageSize(pageSize) }; }
const SORT_FIELDS = new Set(['publishUp', 'title', 'alias', 'id', 'author']);
function cloneArticle(article) { return article ? { ...article, tags: [...(article.tags ?? [])] } : article; }
function publicArticle(article, now) { return article ? { ...cloneArticle(article), featured: isFeatured(article, now) } : article; }
function cloneCategory(category) { return category ? { ...category } : category; }
function cloneMenu(menu) { return menu ? { ...menu } : menu; }
export function createFakeAdapter(seed = {}) {
  const data = {
    articles: (seed.articles ?? articles).map(cloneArticle),
    categories: (seed.categories ?? categories).map(cloneCategory),
    menus: (seed.menus ?? menus).map(cloneMenu)
  };
  return Object.freeze({
    async listArticles({ category, tag, featured = false, year, month, page = 1, pageSize = 5, search = '', searchMode = 'exact', titleContains = '', sort = 'publishUp', direction = 'desc', now = new Date() } = {}) {
      const paging = pageOptions({ page, pageSize }); const titleTerm = normalizeQuery(titleContains).toLocaleLowerCase(); const field = SORT_FIELDS.has(sort) ? sort : 'publishUp'; const multiplier = direction === 'asc' ? 1 : -1;
      const items = data.articles.filter((a) => visible(a, now) && (!category || a.category === category) && (!tag || (a.tags ?? []).includes(tag)) && (!featured || isFeatured(a, now)) && inArchiveMonth(a, year, month) && (!titleTerm || normalizeQuery(a.title, Infinity).toLocaleLowerCase().includes(titleTerm)) && matchesSearch(a, search, searchMode)).sort((a, b) => { const left = a[field] ?? ''; const right = b[field] ?? ''; const primary = left < right ? -1 : left > right ? 1 : 0; if (primary) return primary * multiplier; const leftTie = String(a.alias ?? a.id ?? ''); const rightTie = String(b.alias ?? b.id ?? ''); return leftTie < rightTie ? -1 : leftTie > rightTie ? 1 : 0; });
      const start = (paging.page - 1) * paging.pageSize; return { items: items.slice(start, start + paging.pageSize).map((article) => publicArticle(article, now)), total: items.length, page: paging.page, pageSize: paging.pageSize, pages: Math.ceil(items.length / paging.pageSize) };
    },
    async getArticle(alias, { now = new Date() } = {}) { return publicArticle(data.articles.find((a) => a.alias === alias && visible(a, now)) ?? null, now); },
    async getCategory(alias) { return cloneCategory(data.categories.find((c) => c.alias === alias) ?? null); },
    async getCategoryPath(alias) {
      const path = []; let current = data.categories.find((c) => c.alias === alias); const seen = new Set();
      while (current && !seen.has(current.id)) { path.unshift(current); seen.add(current.id); current = data.categories.find((category) => category.id === current.parentId); }
      return path.map(cloneCategory);
    },
    async listCategories({ parentId = undefined } = {}) { return data.categories.filter((c) => parentId === undefined || c.parentId === parentId).map(cloneCategory); },
    async listMenus() { return data.menus.map(cloneMenu); },
    async listTags({ popular = false, now = new Date(), limit = 0 } = {}) { const counts = data.articles.filter((article) => visible(article, now)).flatMap((article) => article.tags ?? []).reduce((result, tag) => ({ ...result, [tag]: (result[tag] ?? 0) + 1 }), {}); const tags = Object.keys(counts).sort((a, b) => popular ? counts[b] - counts[a] || a.localeCompare(b) : a.localeCompare(b)); const boundedLimit = Math.min(50, Math.max(0, Number(limit) || 0)); const selected = boundedLimit ? tags.slice(0, boundedLimit) : tags; return popular ? selected.map((name) => ({ name, count: counts[name] })) : selected; },
    async listArticlesByTag(tag, options = {}) { return this.listArticles({ ...options, tag }); },
    async listArchive({ limit = 12, now = new Date() } = {}) {
      const counts = data.articles.filter((article) => visible(article, now) && article.publishUp).reduce((result, article) => {
        const date = new Date(article.publishUp);
        if (Number.isNaN(date.getTime())) return result;
        const year = date.getUTCFullYear(); const month = date.getUTCMonth() + 1;
        const key = `${year}-${String(month).padStart(2, '0')}`;
        return { ...result, [key]: { year, month, count: (result[key]?.count ?? 0) + 1 } };
      }, {});
      const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 12));
      return Object.keys(counts).sort((a, b) => b.localeCompare(a)).slice(0, boundedLimit).map((key) => counts[key]);
    },
    async listSimilarArticles(alias, { limit = 5, now = new Date() } = {}) {
      const current = data.articles.find((a) => a.alias === alias); const currentTags = current?.tags ?? [];
      if (!current || !currentTags.length) return [];
      const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 5));
      const scored = data.articles.filter((a) => a.alias !== alias && visible(a, now) && (a.tags ?? []).some((tag) => currentTags.includes(tag))).map((a) => ({ article: a, shared: (a.tags ?? []).filter((tag) => currentTags.includes(tag)).length }));
      scored.sort((left, right) => { if (right.shared !== left.shared) return right.shared - left.shared; const leftDate = left.article.publishUp ?? ''; const rightDate = right.article.publishUp ?? ''; const primary = leftDate < rightDate ? -1 : leftDate > rightDate ? 1 : 0; if (primary) return primary * -1; const leftTie = String(left.article.alias ?? left.article.id ?? ''); const rightTie = String(right.article.alias ?? right.article.id ?? ''); return leftTie < rightTie ? -1 : leftTie > rightTie ? 1 : 0; });
      return scored.slice(0, boundedLimit).map((entry) => publicArticle(entry.article, now));
    }
  });
}
