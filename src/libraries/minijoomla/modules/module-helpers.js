/*
 * Módulos adicionais equivalentes a mod_login (sessão do host), mod_articles_categories,
 * mod_related_items, mod_footer e mod_articles. Sem dependências: os dados chegam pelo
 * contexto (nunca buscados aqui). `mod_articles_popular` (hits) e `mod_feed` ficam de fora:
 * não há fonte de contagem de acessos nem contrato de feed.
 */
import { escapeHtml } from '../security/sanitize.js';

export const empty = (text) => `<p class="module-empty" role="status">${text}</p>`;
export const defaultLink = (path) => `#${path}`;
const articleHref = (link, article) => escapeHtml(link(`/article/${encodeURIComponent(article.alias)}`));
const dateText = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); };

export function articleItems(items, link, showDate) {
  return `<ul>${items.map((article) => {
    const date = showDate && dateText(article.publishUp) ? ` <time datetime="${dateText(article.publishUp)}">${dateText(article.publishUp)}</time>` : '';
    return `<li><a href="${articleHref(link, article)}">${escapeHtml(article.title)}</a>${date}</li>`;
  }).join('')}</ul>`;
}

export const keywords = (value) => new Set(String(value ?? '').split(',').map((k) => k.trim().toLocaleLowerCase()).filter(Boolean));

/* mod_related_items: tags compartilhadas primeiro, depois metaKeywords (ou attribs.metaKeywords, se existir). */
export function relatedItems(article, candidates) {
  if (!article) return [];
  const tags = new Set((article.tags ?? []).map((t) => String(t).toLocaleLowerCase()));
  const words = keywords(article.metaKeywords ?? article.attribs?.metaKeywords);
  return (Array.isArray(candidates) ? candidates : []).filter((c) => c && c.alias && c.alias !== article.alias).map((c) => {
    const shared = (c.tags ?? []).filter((t) => tags.has(String(t).toLocaleLowerCase())).length;
    const common = [...keywords(c.metaKeywords ?? c.attribs?.metaKeywords)].filter((w) => words.has(w)).length;
    return { c, shared, common };
  }).filter((r) => r.shared || r.common).sort((a, b) => b.shared - a.shared || b.common - a.common).map((r) => r.c);
}

export const ARTICLE_ORDERINGS = { recent: (a, b) => String(b.publishUp ?? '').localeCompare(String(a.publishUp ?? '')), oldest: (a, b) => String(a.publishUp ?? '').localeCompare(String(b.publishUp ?? '')), title: (a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')) };
