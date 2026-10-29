export const defaultConfig = Object.freeze({
  siteName: 'MINIJOOMLA', siteDescription: 'Experiência Joomla-like modular',
  language: 'pt-BR', timezone: 'America/Sao_Paulo', basePath: '', pageSize: 5
});

export function createConfig(overrides = {}) {
  const input = overrides && typeof overrides === 'object' ? overrides : {};
  const pageSize = Number(input.pageSize);
  const basePath = String(input.basePath ?? defaultConfig.basePath).trim();
  const normalizedBasePath = basePath === '/' ? '' : `/${basePath.replace(/^#?\/+/, '').replace(/\/+$/, '')}`;
  return Object.freeze({
    ...defaultConfig,
    ...input,
    siteName: String(input.siteName ?? defaultConfig.siteName),
    siteDescription: String(input.siteDescription ?? defaultConfig.siteDescription),
    language: String(input.language ?? defaultConfig.language),
    timezone: String(input.timezone ?? defaultConfig.timezone),
    basePath: normalizedBasePath === '/' ? '' : normalizedBasePath,
    pageSize: Number.isFinite(pageSize) ? Math.min(50, Math.max(1, Math.trunc(pageSize))) : defaultConfig.pageSize
  });
}
