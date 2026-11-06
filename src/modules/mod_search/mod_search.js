import { renderDefault } from './tmpl/default.js';
export const searchModule = { name: 'search', settings: { position: 'search', label: 'Buscar conteúdo', buttonText: 'Buscar' }, settingsSchema: { label: 'string', buttonText: 'string' }, render: renderDefault };
