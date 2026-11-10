import { heading, limited, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';
import { renderArticleCard } from '../../../components/com_content/tmpl/article/default.js';

const PUBLISHED_STATES = new Set([true, 1, '1', 'Published', 'published', 'Publicado', 'publicado']);

// featuredArticles is an adapter-filtered snapshot; dates stay in the adapter.
// Reject explicit exclusions and invalid aliases before limiting the cards.
function visibleArticle(article) {
  return article && typeof article.alias === 'string' && article.alias.trim()
    && article.published !== false && article.featured !== false
    && (article.state === undefined || PUBLISHED_STATES.has(article.state));
}

export function renderDefault({ state = 'ready', featuredArticles = [], settings, message, articleLink = (alias) => `#/article/${encodeURIComponent(alias)}`, timezone, componentParams, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const items = selectFeaturedArticles(featuredArticles,settings);
  if (!items.length) return '<p class="module-empty" role="status">Nenhum destaque disponível.</p>';
  return `<section class="module module-articles-featured">${heading('Destaques', chrome)}<div class="article-list">${items.map((article) => renderArticleCard(article, { articleLink, timezone, componentParams })).join('')}</div></section>`;
}

export function selectFeaturedArticles(featuredArticles,settings){
  return limited((Array.isArray(featuredArticles)?featuredArticles:[]).filter(visibleArticle),settings,3);
}
