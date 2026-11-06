import { renderDefault } from './tmpl/default.js';
export const footerModule = { name: 'footer', settingsSchema: { siteName: 'string', text: 'string' }, settings: { position: 'footer', siteName: '', text: '', state: 'ready' }, render: renderDefault };
