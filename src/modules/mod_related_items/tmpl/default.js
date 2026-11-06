import { heading, limited, stateMessage } from '../../../libraries/minijoomla/modules/content-runtime.js';
import { articleItems, defaultLink, empty, relatedItems } from '../../../libraries/minijoomla/modules/module-helpers.js';

export function renderDefault({ state = 'ready', article, articles = [], settings, message, link = defaultLink, ...chrome } = {}) {
  const status = stateMessage(state, message); if (status) return status;
  const items = limited(relatedItems(article, articles), settings, 5);
  if (!items.length) return empty('Nenhum item relacionado.');
  return `<section class="module module-related-items">${heading('Itens relacionados', chrome)}${articleItems(items, link, settings?.showDate === true)}</section>`;
}
