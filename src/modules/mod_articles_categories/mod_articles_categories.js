import { renderDefault } from './tmpl/default.js';
export const articlesCategoriesModule = { name: 'articles-categories', settingsSchema: { parent: 'string', maxLevel: 'number', showCount: 'boolean' }, settings: { position: 'sidebar', parent: '', maxLevel: 1, showCount: false, state: 'ready' }, render: renderDefault };
