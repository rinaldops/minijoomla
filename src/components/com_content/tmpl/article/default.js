/*
 * Achado real desta frente (ver docs/CONTRATOS.md#minijoomla--integração-com-spmiddle-local-e-caminho-para-remoto): no
 * Joomla real (ArticleModel.php:417, Table/Content.php:148-161) o editor
 * do admin tem UM ÚNICO campo de texto (`articletext`), dividido em
 * `introtext`/`fulltext` só quando o autor insere manualmente a quebra
 * "Leia mais" (`<hr id="system-readmore">`). Sem essa quebra, TODO o
 * conteúdo do artigo mora em `introtext` e `fulltext` fica vazio — é o
 * caso normal e mais comum, não uma exceção. Por isso `introtext` É HTML
 * real tanto quanto `fulltext`, nos dois lugares em que aparece
 * (`sanitizeHtml`, nunca `escapeHtml`): o teaser da listagem
 * (renderArticleList) e o "lead" do artigo completo (renderArticle,
 * antes do corpo que só existe quando há "Leia mais").
 *
 * Decisão REVERTIDA nesta mesma frente: uma versão anterior tratava
 * `introtext` como texto puro (`escapeHtml`), presumindo dois campos
 * independentes — incompatível com o editor único real e a causa raiz do
 * bug relatado pelo usuário (HTML cru visível na introdução).
 */
import { escapeHtml, sanitizeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';
import { parseJsonObject } from '../../../../libraries/minijoomla/application/declared-params.js';
import { renderTags } from '../../../../layouts/joomla/content/tags.js';
import { renderDate, renderInfoBlock } from '../../../../layouts/joomla/content/info_block.js';
import { renderPagination } from '../../../../layouts/joomla/pagination/links.js';
import { renderLinks } from '../../../../layouts/joomla/content/links.js';
import { renderIntroImage } from '../../../../layouts/joomla/content/intro_image.js';
import { renderFullImage } from '../../../../layouts/joomla/content/full_image.js';

export { renderPagination };

function resolveContentParams(componentParams) {
  // Defaults must preserve the current runtime behavior exactly when
  // componentParams is omitted.
  return {
    showTitle: componentParams?.showTitle ?? true,
    linkTitles: componentParams?.linkTitles ?? true,
    showIntro: componentParams?.showIntro ?? true,
    showCategory: componentParams?.showCategory ?? true,
    showAuthor: componentParams?.showAuthor ?? true,
    showPublishDate: componentParams?.showPublishDate ?? true,
    showTags: componentParams?.showTags ?? true,
    showReadmore: componentParams?.showReadmore ?? true,
    showModifyDate: componentParams?.showModifyDate ?? true,
    showCreateDate: componentParams?.showCreateDate ?? true,
    showPrint: componentParams?.showPrint ?? false,
    listLimit: componentParams?.listLimit ?? 10,
    orderBy: componentParams?.orderBy ?? 'publishUp-desc'
  };
}

// Joomla's supported article attribs override global component options; unknown
// keys remain stored but have no effect. Invalid JSON/value falls back safely.
function resolveArticleParams(article, componentParams) {
  const params = resolveContentParams(componentParams);
  const attribs = parseJsonObject(article?.attribsJson);
  const names = { show_title: 'showTitle', link_titles: 'linkTitles', show_intro: 'showIntro', show_category: 'showCategory', show_author: 'showAuthor', show_publish_date: 'showPublishDate', show_tags: 'showTags', show_modify_date: 'showModifyDate', show_create_date: 'showCreateDate', show_print_icon: 'showPrint' };
  for (const [key, name] of Object.entries(names)) {
    if (attribs[key] === true || attribs[key] === 1 || attribs[key] === '1') params[name] = true;
    else if (attribs[key] === false || attribs[key] === 0 || attribs[key] === '0') params[name] = false;
  }
  return params;
}

function articleLanguage(article) { return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(article.language ?? '') ? ` lang="${escapeHtml(article.language)}"` : ''; }

/*
 * `highlightTerms` (component `search` option — docs/EXTENSOES.md#administracao-extensoesmodulostemplates,
 * COMPONENT_OPTIONS in application/component-options.js) safely wraps a
 * literal, case-insensitive match of `query` in `<mark>`, operating on the
 * RAW plain-text title before any HTML is produced — never via regex/string
 * replacement over an already-generated HTML string (that would be able to
 * match inside tag names/attributes and corrupt markup or, worse, re-open an
 * already-sanitized attribute). Every resulting segment (matched and
 * unmatched) is escaped individually; the only literal, unescaped markup
 * emitted is the fixed `<mark>`/`</mark>` wrapper, never attacker-controlled.
 * Deliberately NOT applied to introtext/fulltext: those are HTML content
 * (via sanitizeHtml), where a naive text-level highlight could corrupt tags
 * or attributes — documented as a known scope limit, not silently skipped.
 */
function highlightText(text, query) {
  const raw = text === null || text === undefined ? '' : String(text);
  const needle = String(query ?? '').trim();
  if (!needle) return escapeHtml(raw);
  const haystack = raw.toLocaleLowerCase();
  const needleLower = needle.toLocaleLowerCase();
  let result = '';
  let cursor = 0;
  while (cursor < raw.length) {
    const matchIndex = haystack.indexOf(needleLower, cursor);
    if (matchIndex === -1) { result += escapeHtml(raw.slice(cursor)); break; }
    result += escapeHtml(raw.slice(cursor, matchIndex));
    result += `<mark>${escapeHtml(raw.slice(matchIndex, matchIndex + needle.length))}</mark>`;
    cursor = matchIndex + needle.length;
  }
  return result;
}



export function renderArticle(article = {}, { link = (path) => `#${path}`, timezone = 'America/Sao_Paulo', componentParams, categoryLink, afterTitle = '' } = {}) {
  const params = resolveArticleParams(article, componentParams);
  const info = afterTitle + renderInfoBlock(article, params, { timezone, categoryLink });
  const print = params.showPrint ? '<p class="print-action"><button type="button" class="btn-print" data-mj-print>Imprimir</button></p>' : '';
  return `<article class="content-article"${articleLanguage(article)}>${params.showTitle ? `<h1>${escapeHtml(article.title)}</h1>` : ''}${info}${print}${params.showTags ? renderTags(article.tags, link) : ''}${renderFullImage(article)}${(params.showIntro || !article.fulltext) ? `<div class="article-intro">${sanitizeHtml(article.introtext)}</div>` : ''}<div class="article-body">${sanitizeHtml(article.fulltext)}</div>${renderLinks(article)}</article>`;
}


export function renderArticleCard(article, { articleLink = (alias) => `#/article/${encodeURIComponent(alias)}`, timezone = 'America/Sao_Paulo', componentParams, highlightQuery } = {}) {
  const params = resolveArticleParams(article, componentParams);
  const title = highlightQuery ? highlightText(article.title, highlightQuery) : escapeHtml(article.title);
  const titleHtml = !params.showTitle ? '' : params.linkTitles ? `<h2><a href="${escapeHtml(articleLink(article.alias))}">${title}</a></h2>` : `<h2>${title}</h2>`;
  const intro = params.showIntro ? `<div>${sanitizeHtml(article.introtext)}</div>` : '';
  const date = (params.showPublishDate && article.publishUp) ? `<p class="article-meta">${renderDate(article.publishUp, timezone)}</p>` : '';
  const readmore = (params.showReadmore && article.fulltext) ? `<p class="readmore"><a href="${escapeHtml(articleLink(article.alias))}">Leia mais<span class="visually-hidden">: ${escapeHtml(article.title)}</span></a></p>` : '';
  return `<article class="article-card"${articleLanguage(article)}>${titleHtml}${renderIntroImage(article)}${intro}${date}${readmore}</article>`;
}

export function renderEmptyResult(result, link = (page) => `#/category?page=${page}`) {
  if (result?.total > 0 && result.pages > 0 && result.page > result.pages) {
    const first = `<a href="${escapeHtml(link(1))}">Voltar à primeira página</a>`;
    const last = result.pages > 1 ? `<a href="${escapeHtml(link(result.pages))}">Ir à última página</a>` : '';
    return `<p class="empty-state" role="status">Esta página de resultados está indisponível.</p><nav class="pagination" aria-label="Paginação">${first}${last}</nav>`;
  }
  return '<p class="empty-state" role="status">Nenhum artigo encontrado.</p>';
}

export function renderArticleList(result, { link = (page) => `#/category?page=${page}`, ...cardOptions } = {}) {
  if (!result?.items.length) return renderEmptyResult(result, link);
  // listLimit/orderBy are applied by the adapter/content-service, not here, to keep result.page/pages/total in sync.
  return `<div class="article-list">${result.items.map((article) => renderArticleCard(article, cardOptions)).join('')}</div>${renderPagination(result, link)}`;
}
