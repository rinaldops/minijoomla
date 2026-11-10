/*
 * Extrai e computa os overrides de configuração do site a partir de uma
 * linha de siteConfig persistida — usado tanto no painel administrativo
 * quanto na composição pública (createMiniJoomlaSiteApplication).
 *
 * Centraliza a computação de templateParams, templateStyleId e componentParams
 * em um único lugar, garantindo consistência entre admin e runtime.
 */
import { resolveTemplateParams, resolveTemplateStyleId } from './template-styles.js';
import { resolveComponentParams } from './component-options.js';

/**
 * Converte a linha única de configuração (ou `null`, se a lista estiver
 * vazia) para o shape aceito por createConfig (src/libraries/minijoomla/core/config.js) —
 * `customHtml` só aparece quando customHtmlBody tiver conteúdo, mesma
 * regra já aplicada por createConfig a uma configuração inline.
 */
export function toSiteConfigOverrides(record) {
  if (!record) return {};
  const overrides = {
    siteName: record.siteName, templateKey: record.templateKey, siteDescription: record.siteDescription, language: record.language,
    timezone: record.timezone, basePath: record.basePath, pageSize: record.pageSize
  };
  if (record.customHtmlBody) overrides.customHtml = { title: record.customHtmlTitle || undefined, html: record.customHtmlBody };
  for (const field of ['offline', 'offlineMessage', 'metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles', 'homeView', 'homeCategory']) {
    if (record[field] !== undefined && record[field] !== null && record[field] !== '') overrides[field] = record[field];
  }
  overrides.templateParams = resolveTemplateParams(record);
  overrides.templateStyleId = resolveTemplateStyleId(record);
  overrides.componentParams = resolveComponentParams(record);
  // Preserve provenance: resolved defaults are not explicitly saved limits.
  // An own undefined value keeps historical pageSize when this field is absent.
  overrides.componentParamsJson = record.componentParamsJson;
  return overrides;
}
