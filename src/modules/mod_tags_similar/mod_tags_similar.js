import { renderDefault } from './tmpl/default.js';

export const tagsSimilarModule = {
  name: 'tags-similar', settingsSchema: { limit: 'number' },
  settings: { position: 'sidebar', limit: 5, state: 'ready' },
  render: renderDefault
};
