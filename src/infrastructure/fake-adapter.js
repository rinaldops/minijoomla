const articles = [
  { id: 1, title: 'Bem-vindo ao MINIJOOMLA', alias: 'boas-vindas', introtext: 'Uma camada Joomla-like pequena e independente.', fulltext: '<p>Este artigo demonstra conteúdo seguro, categorias e módulos.</p>', author: 'Equipe editorial', category: 'noticias', tags: ['início', 'guia'], published: true, featured: true, publishUp: '2026-01-01' },
  { id: 2, title: 'Conteúdo modular', alias: 'conteudo-modular', introtext: 'Componentes e módulos usam contratos explícitos.', fulltext: '<p>O template não conhece detalhes do adapter de dados.</p>', author: 'Equipe editorial', category: 'noticias', tags: ['arquitetura'], published: true, featured: false, publishUp: '2026-02-01' }
];
const categories = [{ id: 1, title: 'Notícias', alias: 'noticias', parentId: null, description: 'Publicações recentes.' }];
const menus = [{ title: 'Início', path: '/' }, { title: 'Notícias', path: '/category/noticias' }];

function visible(article, now = new Date()) { return article.published && new Date(article.publishUp) <= now; }
export function createFakeAdapter(seed = {}) {
  const data = { articles: seed.articles ?? articles, categories: seed.categories ?? categories, menus: seed.menus ?? menus };
  return Object.freeze({
    async listArticles({ category, page = 1, pageSize = 5, search = '' } = {}) {
      const term = search.toLocaleLowerCase(); const items = data.articles.filter((a) => visible(a) && (!category || a.category === category) && (!term || `${a.title} ${a.introtext}`.toLocaleLowerCase().includes(term)));
      const start = (page - 1) * pageSize; return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
    },
    async getArticle(alias) { return data.articles.find((a) => a.alias === alias && visible(a)) ?? null; },
    async getCategory(alias) { return data.categories.find((c) => c.alias === alias) ?? null; },
    async listMenus() { return data.menus; },
    async listTags() { return [...new Set(data.articles.flatMap((a) => a.tags))]; }
  });
}
