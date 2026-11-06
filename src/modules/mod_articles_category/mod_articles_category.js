import { renderDefault } from './tmpl/default.js';

export const articlesCategoryModule = {
  name: 'articles-category', settingsSchema: { limit: 'number', category: 'string' },
  settings: { position: 'content', limit: 5, state: 'ready' },
  render: renderDefault
};
