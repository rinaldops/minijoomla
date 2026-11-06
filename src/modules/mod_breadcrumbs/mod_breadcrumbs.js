import { renderDefault } from './tmpl/default.js';
export const breadcrumbsModule = { name: 'breadcrumbs', settings: { position: 'breadcrumbs', showHome: true, showLast: true, separator: '' }, settingsSchema: { showHome: 'boolean', showLast: 'boolean', separator: 'string' }, render: renderDefault };
