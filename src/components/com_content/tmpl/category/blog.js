import { escapeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';
import { renderArticleCard, renderEmptyResult, renderPagination } from '../article/default.js';

const count = (value, fallback, min, max) => {
  const number = Number(value);
  return value === undefined || value === null || value === '' || !Number.isFinite(number) ? fallback : Math.min(max, Math.max(min, Math.trunc(number)));
};

/*
 * com_content blog options (num_leading/num_intro/num_columns/num_links).
 * Without any configured value the page keeps the site page size: one leading
 * item and the rest as intro items (behaviour-compatible with the old list).
 */
export function blogSettings(componentParams, pageSize = 5) {
  const configured = ['numLeading', 'numIntro', 'numLinks'].some((key) => componentParams?.[key] != null);
  const columns = count(componentParams?.numColumns, 1, 1, 4);
  if (!configured) return { leading: 1, intro: Math.max(0, pageSize - 1), links: 0, columns, pageSize };
  const leading = count(componentParams.numLeading, 1, 0, 20);
  const intro = count(componentParams.numIntro, 4, 0, 40);
  const links = count(componentParams.numLinks, 4, 0, 40);
  return { leading, intro, links, columns, pageSize: Math.min(50, Math.max(1, leading + intro + links)) };
}

// components/com_content/tmpl/category/blog*.php: leading, intro columns, links.
export function renderBlog(result, { link, articleLink, settings = blogSettings(undefined), ...cardOptions } = {}) {
  if (!result?.items?.length) return renderEmptyResult(result, link);
  const card = (article) => renderArticleCard(article, { articleLink, ...cardOptions });
  const items = result.items;
  const leading = items.slice(0, settings.leading);
  const intro = items.slice(settings.leading, settings.leading + settings.intro);
  const links = items.slice(settings.leading + settings.intro);
  const href = (article) => escapeHtml(articleLink ? articleLink(article.alias) : `#/article/${encodeURIComponent(article.alias)}`);
  return `<div class="blog">${leading.length ? `<div class="blog-items items-leading">${leading.map(card).join('')}</div>` : ''}${intro.length ? `<div class="blog-items items-intro columns-${settings.columns}">${intro.map(card).join('')}</div>` : ''}${links.length ? `<ul class="blog-links" aria-label="Mais artigos">${links.map((article) => `<li><a href="${href(article)}">${escapeHtml(article.title)}</a></li>`).join('')}</ul>` : ''}</div>${renderPagination(result, link)}`;
}
