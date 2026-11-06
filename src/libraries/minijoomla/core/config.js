export const defaultConfig = Object.freeze({
  siteName: 'MINIJOOMLA', templateKey: 'default', siteDescription: 'Experiência Joomla-like modular',
  language: 'pt-BR', timezone: 'America/Sao_Paulo', basePath: '', pageSize: 5,
  homeView: 'category', homeCategory: 'noticias'
});

export function createConfig(overrides = {}) {
  const input = overrides && typeof overrides === 'object' ? overrides : {};
  const pageSize = Number(input.pageSize);
  const basePath = String(input.basePath ?? defaultConfig.basePath).trim();
  const normalizedBasePath = basePath === '/' ? '' : `/${basePath.replace(/^#?\/+/, '').replace(/\/+$/, '')}`;
  const customHtmlInput = input.customHtml && typeof input.customHtml === 'object' ? input.customHtml : null;
  const homeView = input.homeView ?? defaultConfig.homeView;
  const homeCategory = input.homeCategory ?? defaultConfig.homeCategory;
  if (!['category', 'featured'].includes(homeView)) throw new TypeError('Tipo de página inicial inválido.');
  if (typeof homeCategory !== 'string' || !homeCategory.trim()) throw new TypeError('Categoria da página inicial inválida.');
  return Object.freeze({
    ...defaultConfig,
    ...input,
    siteName: String(input.siteName ?? defaultConfig.siteName),
    templateKey: typeof input.templateKey === 'string' && input.templateKey.trim() ? input.templateKey.trim() : defaultConfig.templateKey,
    homeView,
    homeCategory: homeCategory.trim(),
    siteDescription: String(input.siteDescription ?? defaultConfig.siteDescription),
    language: String(input.language ?? defaultConfig.language),
    timezone: String(input.timezone ?? defaultConfig.timezone),
    basePath: normalizedBasePath === '/' ? '' : normalizedBasePath,
    pageSize: Number.isFinite(pageSize) ? Math.min(50, Math.max(1, Math.trunc(pageSize))) : defaultConfig.pageSize,
    customHtml: customHtmlInput && String(customHtmlInput.html ?? '').trim() ? Object.freeze({ title: customHtmlInput.title ? String(customHtmlInput.title) : undefined, html: String(customHtmlInput.html) }) : null
  });
}
