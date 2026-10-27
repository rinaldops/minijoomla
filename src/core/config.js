export const defaultConfig = Object.freeze({
  siteName: 'MINIJOOMLA', siteDescription: 'Experiência Joomla-like modular',
  language: 'pt-BR', timezone: 'America/Sao_Paulo', basePath: '', pageSize: 5
});

export function createConfig(overrides = {}) {
  return Object.freeze({ ...defaultConfig, ...overrides });
}
