/*
 * Seletor de tipo de item de menu (com_menus): em vez de digitar o `path`
 * à mão, o administrador escolhe um tipo e um alvo e o caminho existente
 * (/category/<alias>, /article/<alias> ...) é gerado. Caminhos já
 * persistidos que não correspondem a nenhum tipo continuam editáveis como
 * "custom" e são preservados byte a byte.
 */
import { ValidationError } from '../../../../../libraries/minijoomla/core/contracts.js';

export const MENU_TYPES = Object.freeze([
  { key: 'home', label: 'Início (página inicial)' },
  { key: 'category-blog', label: 'Categoria — blog', target: 'category' },
  { key: 'category-list', label: 'Categoria — lista', target: 'category' },
  { key: 'article', label: 'Artigo', target: 'article' },
  { key: 'tag', label: 'Tag', target: 'tag' },
  { key: 'tags', label: 'Lista de tags' },
  { key: 'search', label: 'Busca' },
  { key: 'archive', label: 'Arquivo de artigos' },
  { key: 'url', label: 'URL externa', target: 'url' }
]);

const SIMPLE = { home: '/', tags: '/tags', search: '/search', archive: '/archive' };
const segment = (value) => encodeURIComponent(String(value ?? '').trim());

/** Gera o caminho a partir de { type, category, article, tag, url }; null quando falta o alvo. */
export function buildMenuPath({ type, category, article, tag, url } = {}) {
  if (Object.hasOwn(SIMPLE, type)) return SIMPLE[type];
  if (type === 'category-blog' && category) return `/category/${segment(category)}`;
  if (type === 'category-list' && category) return `/category/${segment(category)}?layout=list`;
  if (type === 'article' && article) return `/article/${segment(article)}`;
  if (type === 'tag' && tag) return `/tag/${segment(tag)}`;
  if (type === 'url' && /^https?:\/\/[^\s]+$/i.test(String(url ?? '').trim())) return String(url).trim();
  return null;
}

/** Inverso de buildMenuPath: { type, category, article, tag, url }; type 'custom' quando não reconhecido. */
export function parseMenuPath(path) {
  const text = String(path ?? '');
  const simple = Object.entries(SIMPLE).find(([, value]) => value === text);
  if (simple) return { type: simple[0] };
  const decode = (value) => { try { return decodeURIComponent(value); } catch { return null; } };
  let match = text.match(/^\/category\/([^/?#]+)(\?layout=list)?$/);
  if (match && decode(match[1]) !== null) return { type: match[2] ? 'category-list' : 'category-blog', category: decode(match[1]) };
  match = text.match(/^\/article\/([^/?#]+)$/);
  if (match && decode(match[1]) !== null) return { type: 'article', article: decode(match[1]) };
  match = text.match(/^\/tag\/([^/?#]+)$/);
  if (match && decode(match[1]) !== null) return { type: 'tag', tag: decode(match[1]) };
  if (/^https?:\/\/[^\s]+$/i.test(text)) return { type: 'url', url: text };
  return { type: 'custom' };
}

export function toMenuFormValues(record = {}) {
  const parsed = parseMenuPath(record.path ?? '/category/noticias');
  const type = record.path === undefined ? 'category-blog' : parsed.type;
  return { ...record, menuType: type, targetCategory: parsed.category ?? '', targetArticle: parsed.article ?? '', targetTag: parsed.tag ?? '', targetUrl: parsed.url ?? '' };
}

export function menuTypeOptions(values) {
  const options = MENU_TYPES.map((type) => ({ value: type.key, label: type.label }));
  if (values.menuType === 'custom') options.push({ value: 'custom', label: `Caminho existente (preservado): ${values.path}` });
  return options;
}

export function prepareMenuFormValues(rawValues, record = {}) {
  const { menuType, targetCategory, targetArticle, targetTag, targetUrl, ...input } = rawValues;
  const path = menuType === 'custom' ? record.path : buildMenuPath({ type: menuType, category: targetCategory, article: targetArticle, tag: targetTag, url: targetUrl });
  if (!path) throw new ValidationError('Escolha o destino do item de menu (categoria, artigo, tag ou URL http/https).');
  return { ...input, path };
}
