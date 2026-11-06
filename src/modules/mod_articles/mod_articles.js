import { renderDefault } from './tmpl/default.js';
export const articlesModule = { name: 'articles', settingsSchema: { category: 'string', ordering: 'string', limit: 'number', showDate: 'boolean' }, settings: { position: 'content', category: '', ordering: 'recent', limit: 5, showDate: false, state: 'ready' }, render: renderDefault };
