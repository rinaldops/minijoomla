import { renderDefault } from './tmpl/default.js';
export const loginModule = { name: 'login', settingsSchema: { loginUrl: 'string', loginText: 'string', greeting: 'string', session: 'object' }, settings: { position: 'sidebar', loginText: 'Entrar', greeting: 'Olá', state: 'ready' }, render: renderDefault };
