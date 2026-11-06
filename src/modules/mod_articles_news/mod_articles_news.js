import { renderDefault } from './tmpl/default.js';

export const articlesNewsModule = {
  name: 'articles-news', settingsSchema: { limit: 'number' },
  settings: { position: 'sidebar', limit: 3, state: 'ready' },
  render: renderDefault
};
