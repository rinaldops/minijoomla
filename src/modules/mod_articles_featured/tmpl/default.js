import { heading, limited, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';
import { renderArticleCard } from '../../../components/com_content/tmpl/article/default.js';

/*
 * `articles-featured`: variante de `articles-news` com imagem + resumo
 * reais (Decisão B, escopo adicional — ver `camap-v3`'s doc de contrato,
 * "Fechamento — Iteração 4.1"/"Iteração 5"). Reaproveita
 * `renderArticleCard()` de com_content (mesmo padrão já usado pela
 * listagem de categoria/blog) em vez de inventar um novo mecanismo de
 * imagem/resumo. `mod_articles_news` permanece intocado — continua uma
 * lista simples de títulos, usada hoje pela sidebar do `camap`/`cassiopeia`.
 */
export function renderDefault({ state = 'ready', featuredArticles = [], settings, message, articleLink = (alias) => `#/article/${encodeURIComponent(alias)}`, timezone, componentParams, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const items = limited(featuredArticles, settings, 3);
  if (!items.length) return '<p class="module-empty" role="status">Nenhum destaque disponível.</p>';
  return `<section class="module module-articles-featured">${heading('Destaques', chrome)}<div class="article-list">${items.map((article) => renderArticleCard(article, { articleLink, timezone, componentParams })).join('')}</div></section>`;
}
