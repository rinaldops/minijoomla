import { inDateWindow } from '../core/date-window.js';
import { normalizeQuery } from '../core/contracts.js';

const DEFAULT_FIELDS = {
  article: { id: 'id', title: 'title', alias: 'alias', introtext: 'introtext', fulltext: 'fulltext', categoryId: 'categoryId', state: 'state', featured: 'featured', publishUp: 'publishUp', publishDown: 'publishDown', featuredUp: 'featuredUp', featuredDown: 'featuredDown', author: 'author', authorAlias: 'authorAlias', created: 'created', modified: 'modified', language: 'language', attribsJson: 'attribsJson', metaDescription: 'metaDescription', metaKeywords: 'metaKeywords', tags: 'tags' },
  category: { id: 'id', title: 'title', alias: 'alias', parentId: 'parentId', description: 'description', image: 'image', state: 'state' },
  tag: { id: 'id', name: 'name', alias: 'alias', state: 'state' },
  menu: { id: 'id', title: 'title', path: 'path', parentId: 'parentId', published: 'published', ordering: 'ordering' }
};

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} deve ser um objeto.`);
  return value;
}

function repository(value, name) {
  object(value, name);
  if (typeof value.findMany !== 'function') throw new TypeError(`${name}.findMany deve ser uma função.`);
  return value;
}

function read(source, mapping, name) {
  return source?.[mapping[name]];
}

function published(value) {
  return value === undefined || value === true || value === 1 || value === '1' || value === 'Published' || value === 'published' || value === 'Publicado' || value === 'publicado';
}

// Linhas anteriores à coluna State chegam com null e continuam publicadas.
const listed = (value) => value === null || value === '' || published(value);

function current(item, mapping, now) {
  if (!published(read(item, mapping, 'state'))) return false;
  return inDateWindow(read(item, mapping, 'publishUp'), read(item, mapping, 'publishDown'), now);
}

function tagName(tag) {
  if (typeof tag === 'string' || typeof tag === 'number') return String(tag);
  return tag && typeof tag === 'object' && (typeof tag.name === 'string' || typeof tag.title === 'string') ? String(tag.name ?? tag.title) : null;
}

function mapTags(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return values.map(tagName).filter(Boolean).map((tag) => tag.trim()).filter(Boolean);
}

function mapArticle(item, mapping, now) {
  const category = read(item, mapping, 'categoryId');
  return {
    id: read(item, mapping, 'id'), title: read(item, mapping, 'title') ?? '', alias: read(item, mapping, 'alias') ?? '',
    introtext: read(item, mapping, 'introtext') ?? '', fulltext: read(item, mapping, 'fulltext') ?? '',
    categoryId: category && typeof category === 'object' ? category.id : category, published: published(read(item, mapping, 'state')),
    featured: (read(item, mapping, 'featured') === true || read(item, mapping, 'featured') === 1 || read(item, mapping, 'featured') === '1') && inDateWindow(read(item, mapping, 'featuredUp'), read(item, mapping, 'featuredDown'), now),
    publishUp: read(item, mapping, 'publishUp') ?? null, publishDown: read(item, mapping, 'publishDown') ?? null,
    author: read(item, mapping, 'author') ?? '',
    ...Object.fromEntries(['authorAlias', 'language', 'attribsJson', 'created', 'modified', 'metaDescription', 'metaKeywords'].filter((name) => read(item, mapping, name) !== undefined).map((name) => [name, read(item, mapping, name) ?? ''])),
    tags: mapTags(read(item, mapping, 'tags'))
  };
}

function mapCategory(item, mapping) {
  const parent = read(item, mapping, 'parentId');
  return { id: read(item, mapping, 'id'), title: read(item, mapping, 'title') ?? '', alias: read(item, mapping, 'alias') ?? '', parentId: parent && typeof parent === 'object' ? parent.id : parent ?? null, description: read(item, mapping, 'description') ?? '', ...(read(item, mapping, 'image') ? { image: read(item, mapping, 'image') } : {}) };
}

function itemsOf(result) {
  return Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
}

function page(items, pageNumber, pageSize) {
  const start = (pageNumber - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page: pageNumber, pageSize, pages: Math.ceil(items.length / pageSize) };
}

function sortArticles(items, sort = 'publishUp', direction = 'desc') {
  const field = new Set(['publishUp', 'title', 'alias', 'id', 'author']).has(sort) ? sort : 'publishUp';
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...items].sort((left, right) => {
    const primary = left[field] < right[field] ? -1 : left[field] > right[field] ? 1 : 0;
    if (primary) return primary * multiplier;
    const leftTie = String(left.alias ?? left.id ?? '');
    const rightTie = String(right.alias ?? right.id ?? '');
    return leftTie < rightTie ? -1 : leftTie > rightTie ? 1 : 0;
  });
}

function inArchiveMonth(item, year, month) {
  if (year == null && month == null) return true;
  if (!item.publishUp) return false;
  const date = new Date(item.publishUp);
  if (Number.isNaN(date.getTime())) return false;
  return (year == null || date.getUTCFullYear() === Number(year)) && (month == null || date.getUTCMonth() + 1 === Number(month));
}

function searchMatch(article, term, mode) {
  if (!term) return true;
  const text = normalizeQuery(`${article.title} ${article.introtext} ${article.fulltext} ${article.tags.join(' ')}`, Infinity).toLowerCase();
  const tokens = term.split(' ');
  return mode === 'all' ? tokens.every((token) => text.includes(token))
    : mode === 'any' ? tokens.some((token) => text.includes(token)) : text.includes(term);
}

export function createSPMiddleAdapter({ articleRepository, categoryRepository, tagRepository, menuRepository, fields = {}, pageSize = 5, now, cacheMs = 0, clockMs = Date.now } = {}) {
  const repositories = {
    articles: repository(articleRepository, 'articleRepository'), categories: repository(categoryRepository, 'categoryRepository'),
    tags: tagRepository ? repository(tagRepository, 'tagRepository') : null, menus: menuRepository ? repository(menuRepository, 'menuRepository') : null
  };
  const mapping = { article: { ...DEFAULT_FIELDS.article, ...fields.article }, category: { ...DEFAULT_FIELDS.category, ...fields.category }, tag: { ...DEFAULT_FIELDS.tag, ...fields.tag }, menu: { ...DEFAULT_FIELDS.menu, ...fields.menu } };
  const boundedPageSize = Math.min(50, Math.max(1, Number(pageSize) || 5));
  const clock = (options) => {
    if (options?.now !== undefined) return options.now;
    if (now !== undefined) return now;
    return new Date();
  };

  // ponytail: janela fixa por lista; uma edição só aparece no site após cacheMs.
  const listCache = new Map();
  function all(repositoryValue) {
    const load = async () => itemsOf(await repositoryValue.findMany({}, { maxPages: 100, maxItems: 10000 }));
    if (!cacheMs) return load();
    const hit = listCache.get(repositoryValue);
    if (hit && clockMs() - hit.at < cacheMs) return hit.items;
    const items = load();
    listCache.set(repositoryValue, { at: clockMs(), items });
    items.catch(() => listCache.delete(repositoryValue));
    return items;
  }

  // Como no Joomla: categoria despublicada ou na lixeira esconde a si e aos seus artigos.
  // A ocultação é herdada: filho publicado de pai despublicado/na lixeira também some (com ciclos tolerados).
  async function visibleCategories() {
    const rows = await all(repositories.categories);
    const byId = new Map(rows.map((item) => [String(read(item, mapping.category, 'id')), item]));
    const hidden = new Set();
    for (const row of rows) {
      const seen = new Set();
      for (let node = row; node && !seen.has(node); ) {
        seen.add(node);
        if (!listed(read(node, mapping.category, 'state'))) { hidden.add(String(read(row, mapping.category, 'id'))); break; }
        const parent = read(node, mapping.category, 'parentId');
        node = parent == null ? null : byId.get(String(typeof parent === 'object' ? parent.id : parent));
      }
    }
    return { rows, hidden };
  }

  async function publishedCategories() {
    const { rows, hidden } = await visibleCategories();
    return rows.filter((item) => !hidden.has(String(read(item, mapping.category, 'id'))));
  }

  async function hiddenTags() {
    return new Set(repositories.tags ? (await all(repositories.tags)).filter((item) => !listed(read(item, mapping.tag, 'state'))).map((item) => tagName(read(item, mapping.tag, 'name'))) : []);
  }

  async function allArticles(options) {
    const raw = await all(repositories.articles);
    const { hidden } = await visibleCategories();
    const resolvedNow = clock(options);
    return raw.filter((item) => current(item, mapping.article, resolvedNow)).map((item) => mapArticle(item, mapping.article, resolvedNow)).filter((item) => !hidden.has(String(item.categoryId)));
  }

  return Object.freeze({
    async listArticles({ category: categoryAlias, tag, featured = false, year, month, search = '', searchMode = 'exact', titleContains = '', page: pageNumber = 1, pageSize: requestedPageSize = boundedPageSize, sort = 'publishUp', direction = 'desc', now: currentTime } = {}) {
      const categories = categoryAlias ? (await publishedCategories()).map((item) => mapCategory(item, mapping.category)) : [];
      const selectedCategory = categories.find((item) => item.alias === categoryAlias);
      if (categoryAlias && !selectedCategory) return page([], Math.max(1, Number(pageNumber) || 1), Math.min(50, Math.max(1, Number(requestedPageSize) || boundedPageSize)));
      const term = normalizeQuery(search).toLowerCase(); const titleTerm = String(titleContains).trim().toLocaleLowerCase();
      const items = sortArticles((await allArticles({ now: currentTime })).filter((item) => (!selectedCategory || item.categoryId === selectedCategory.id) && (!tag || item.tags.includes(tag)) && (!featured || item.featured) && inArchiveMonth(item, year, month) && (!titleTerm || item.title.toLocaleLowerCase().includes(titleTerm)) && searchMatch(item, term, searchMode)), sort, direction);
      return page(items, Math.max(1, Number(pageNumber) || 1), Math.min(50, Math.max(1, Number(requestedPageSize) || boundedPageSize)));
    },
    async getArticle(alias, options = {}) { return (await allArticles(options)).find((item) => item.alias === alias) ?? null; },
    async getCategory(alias) { return (await publishedCategories()).map((item) => mapCategory(item, mapping.category)).find((item) => item.alias === alias) ?? null; },
    async getCategoryPath(alias) {
      const categories = (await publishedCategories()).map((item) => mapCategory(item, mapping.category));
      const path = []; let currentCategory = categories.find((item) => item.alias === alias); const seen = new Set();
      while (currentCategory && !seen.has(currentCategory.id)) { path.unshift(currentCategory); seen.add(currentCategory.id); currentCategory = categories.find((item) => item.id === currentCategory.parentId); }
      return path;
    },
    async listCategories() { return (await publishedCategories()).map((item) => mapCategory(item, mapping.category)); },
    async listMenus() {
      if (!repositories.menus) return [];
      const items = (await all(repositories.menus)).map((item) => ({
        id: read(item, mapping.menu, 'id'),
        title: read(item, mapping.menu, 'title') ?? '',
        path: read(item, mapping.menu, 'path') ?? '/',
        parentId: read(item, mapping.menu, 'parentId') ?? null,
        ordering: read(item, mapping.menu, 'ordering') ?? null,
        published: published(read(item, mapping.menu, 'published'))
      }));
      const byId = new Map(items.filter((item) => item.id !== undefined && item.id !== null).map((item) => [String(item.id), item]));
      return items.filter((item) => {
        if (!item.published) return false;
        const visited = new Set();
        let parentId = item.parentId;
        while (parentId !== null && parentId !== undefined && byId.has(String(parentId)) && !visited.has(String(parentId))) {
          visited.add(String(parentId));
          const parent = byId.get(String(parentId));
          if (!parent.published) return false;
          parentId = parent.parentId;
        }
        return true;
      });
    },
    async listTags({ popular = false, limit = 0, now: currentTime } = {}) {
      const names = repositories.tags ? (await all(repositories.tags)).filter((item) => listed(read(item, mapping.tag, 'state'))).map((item) => tagName(read(item, mapping.tag, 'name'))).filter(Boolean) : [];
      if (!popular) return limit ? names.slice(0, Math.min(50, Math.max(0, Number(limit) || 0))) : names;
      const skip = await hiddenTags();
      const counts = (await allArticles({ now: currentTime })).flatMap((item) => item.tags).filter((name) => !skip.has(name)).reduce((result, name) => ({ ...result, [name]: (result[name] ?? 0) + 1 }), {});
      const selected = Object.keys(counts).sort((left, right) => counts[right] - counts[left] || left.localeCompare(right));
      const boundedLimit = Math.min(50, Math.max(0, Number(limit) || 0));
      return (boundedLimit ? selected.slice(0, boundedLimit) : selected).map((name) => ({ name, count: counts[name] }));
    },
    async listArticlesByTag(tag, options = {}) { return this.listArticles({ ...options, tag }); },
    async listArchive({ limit = 12, now: currentTime } = {}) {
      const articles = await allArticles({ now: currentTime });
      const counts = articles.filter((item) => item.publishUp).reduce((result, item) => {
        const date = new Date(item.publishUp);
        if (Number.isNaN(date.getTime())) return result;
        const year = date.getUTCFullYear(); const month = date.getUTCMonth() + 1;
        const key = `${year}-${String(month).padStart(2, '0')}`;
        return { ...result, [key]: { year, month, count: (result[key]?.count ?? 0) + 1 } };
      }, {});
      const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 12));
      return Object.keys(counts).sort((left, right) => right.localeCompare(left)).slice(0, boundedLimit).map((key) => counts[key]);
    },
    async listSimilarArticles(alias, { limit = 5, now: currentTime } = {}) {
      const articles = await allArticles({ now: currentTime });
      const currentArticle = articles.find((item) => item.alias === alias);
      if (!currentArticle || !currentArticle.tags.length) return [];
      const items = articles.filter((item) => item.alias !== alias && item.tags.some((name) => currentArticle.tags.includes(name))).map((item) => ({ item, shared: item.tags.filter((name) => currentArticle.tags.includes(name)).length }));
      items.sort((left, right) => right.shared - left.shared || String(right.item.publishUp ?? '').localeCompare(String(left.item.publishUp ?? '')) || String(left.item.alias).localeCompare(String(right.item.alias)));
      return items.slice(0, Math.min(50, Math.max(1, Number(limit) || 5))).map((entry) => entry.item);
    }
  });
}
