import { renderDefault } from './tmpl/default.js';

export const articlesFeaturedModule = {
  name: 'articles-featured', settingsSchema: { limit: 'number' },
  settings: { position: 'sidebar', limit: 3, state: 'ready' },
  render: renderDefault
};
