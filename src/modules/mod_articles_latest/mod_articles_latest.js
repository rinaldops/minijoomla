import { renderDefault } from './tmpl/default.js';

export const articlesLatestModule = {
  name: 'articles-latest', settingsSchema: { limit: 'number' },
  settings: { position: 'sidebar', limit: 5, state: 'ready' },
  render: renderDefault
};
