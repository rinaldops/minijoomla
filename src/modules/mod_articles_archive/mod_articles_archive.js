import { renderDefault } from './tmpl/default.js';

export const articlesArchiveModule = {
  name: 'articles-archive', settingsSchema: { limit: 'number' },
  settings: { position: 'sidebar', limit: 12, state: 'ready' },
  render: renderDefault
};
