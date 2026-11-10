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
import { resolveQueryParams } from './content-service.js';
import { ownEnumerableData } from '../core/contracts.js';

/**
 * Converte a linha única de configuração (ou `null`, se a lista estiver
 * vazia) para o shape aceito por createConfig (src/libraries/minijoomla/core/config.js) —
 * `customHtml` só aparece quando customHtmlBody tiver conteúdo, mesma
 * regra já aplicada por createConfig a uma configuração inline.
 */
export function toSiteConfigOverrides(record) {
  if (!record) return {};
  record = ownEnumerableData(record);
  // Missing persisted values must not erase the initial operational defaults.
  // Empty strings, unlike missing/null fields, are explicit saved values here.
  const overrides = {};
  for (const field of ['siteName', 'templateKey', 'siteDescription', 'language', 'timezone', 'basePath', 'pageSize']) {
    if (record[field] !== undefined && record[field] !== null) overrides[field] = record[field];
  }
  if (record.customHtmlBody) overrides.customHtml = { title: record.customHtmlTitle || undefined, html: record.customHtmlBody };
  for (const field of ['offline', 'offlineMessage', 'metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles', 'homeView', 'homeCategory']) {
    if (record[field] !== undefined && record[field] !== null && record[field] !== '') overrides[field] = record[field];
  }
  if (record.homeView === 'featured' && record.homeCategory === '') overrides.homeCategory = '';
  overrides.templateParams = resolveTemplateParams(record);
  overrides.templateStyleId = resolveTemplateStyleId(record);
  if(record.templateStylesJson!==undefined)overrides.templateStylesJson=record.templateStylesJson;
  overrides.componentParams = resolveComponentParams(record);
  overrides.componentParamsJson = record.componentParamsJson;
  overrides.queryParams = resolveQueryParams({ componentParamsJson: record.componentParamsJson });
  return overrides;
}
