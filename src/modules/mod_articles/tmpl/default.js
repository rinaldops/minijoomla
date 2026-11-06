import { heading, limited, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';
import { ARTICLE_ORDERINGS, articleItems, defaultLink, empty } from '../../../libraries/minijoomla/modules/module-helpers.js';

export function renderDefault({ state = 'ready', articles = [], settings = {}, message, link = defaultLink, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const rows = (Array.isArray(articles) ? articles : []).filter((a) => a && a.alias && (!settings?.category || (a.categoryAlias ?? a.category) === settings.category));
  const items = limited(rows.sort(ARTICLE_ORDERINGS[settings?.ordering] ?? ARTICLE_ORDERINGS.recent), settings, 5);
  if (!items.length) return empty('Nenhum artigo encontrado.');
  return `<section class="module module-articles">${heading('Artigos', chrome)}${articleItems(items, link, settings?.showDate === true)}</section>`;
}
