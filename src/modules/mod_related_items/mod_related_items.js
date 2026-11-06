import { renderDefault } from './tmpl/default.js';
export const relatedItemsModule = { name: 'related-items', settingsSchema: { limit: 'number', showDate: 'boolean' }, settings: { position: 'sidebar', limit: 5, showDate: false, state: 'ready' }, render: renderDefault };
