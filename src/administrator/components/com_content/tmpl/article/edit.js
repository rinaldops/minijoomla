/*
 * Renderer especializado do editor de artigos (Fase 1 do plano
 * docs/PLANO-EDITOR-ARTIGOS-JOOMLA-LIKE.md).
 *
 * Objetivo: aproximar a estrutura do formulário do Joomla real:
 * - cabeçalho com título + alias antes das abas;
 * - abas ARIA específicas de artigo;
 * - área principal (editor) + sidebar (propriedades) no desktop;
 * - sidebar abaixo no mobile.
 *
 * Restrições desta frente:
 * - não altera o modelo persistido (introtext/fulltext continuam);
 * - não altera editor.js nem TinyMCE;
 * - não altera schemas SharePoint;
 * - mantém o renderer genérico (render-form.js) para os demais domínios.
 */
import { escapeHtml, safeUrl } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { renderAdminForm } from '../../../com_minijoomla/render-form.js';
import { closeIcon, saveIcon } from '../../../com_minijoomla/icons.js';
import { ARTICLE_OPTION_FIELDS, ARTICLE_IMAGE_FIELDS, ARTICLE_LINK_FIELDS, ARTICLE_EDITOR_LIMITS } from '../../../com_minijoomla/field-schemas.js';
import { MEDIA_MIME_TYPES } from '../../../../../libraries/minijoomla/application/media-upload-service.js';
import { parseJsonObject } from '../../../../../libraries/minijoomla/application/declared-params.js';

function renderArticleOptions(formId, values) {
  let attribs;
  try { attribs = parseJsonObject(values.attribsJson, { strict: true, field: 'Opções' }); }
  catch { return '<p role="status">Opções persistidas inválidas. Controles indisponíveis; o valor original será preservado.</p>'; }
  const options = Object.fromEntries(ARTICLE_OPTION_FIELDS.map((field) => [field.name, [{ value: '', label: 'Usar padrão do componente' }, { value: '1', label: 'Exibir / Sim' }, { value: '0', label: 'Ocultar / Não' }]]));
  const fieldValues = Object.fromEntries(ARTICLE_OPTION_FIELDS.map((field) => [field.name, attribs[field.key] === true || attribs[field.key] === 1 || attribs[field.key] === '1' ? '1' : attribs[field.key] === false || attribs[field.key] === 0 || attribs[field.key] === '0' ? '0' : '']));
  return stripFormWrapper(renderAdminForm({ formId, fields: ARTICLE_OPTION_FIELDS, values: fieldValues, relationOptions: options }));
}

function section(attribs, groupName) {
  const value = attribs[groupName];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

// Aba "Imagens e links": valores em attribsJson.images / attribsJson.urls (chaves do Joomla).
function renderArticleImagesAndLinks(formId, values, imageUpload) {
  let attribs;
  try { attribs = parseJsonObject(values.attribsJson, { strict: true, field: 'Opções' }); }
  catch { return '<p role="status">Opções persistidas inválidas. Controles indisponíveis; o valor original será preservado.</p>'; }
  const fieldValues = {};
  for (const field of [...ARTICLE_IMAGE_FIELDS, ...ARTICLE_LINK_FIELDS]) fieldValues[field.name] = String(section(attribs, field.group)[field.key] ?? '');
  const block = (title, fields, uploadName) => {
    const url = fieldValues[uploadName];
    const preview = uploadName ? `<img class="admin-image-preview" data-admin-image-preview="${escapeHtml(uploadName)}" alt="" width="96" src="${url && safeUrl(url) !== '#' ? safeUrl(url) : ''}"${url && safeUrl(url) !== '#' ? '' : ' hidden'}>` : '';
    const upload = uploadName && imageUpload
      ? `<div class="admin-field"><label for="admin-image-file-${formId}-${slugify(uploadName)}">Enviar arquivo (${escapeHtml(MEDIA_MIME_TYPES.map((type) => type.replace('image/', '')).join(', '))})</label><input type="file" id="admin-image-file-${formId}-${slugify(uploadName)}" data-admin-image-file="${escapeHtml(uploadName)}" accept="${escapeHtml(MEDIA_MIME_TYPES.join(','))}"> <button type="button" class="admin-btn admin-btn-ghost" data-admin-image-upload="${escapeHtml(uploadName)}">Enviar e usar</button></div>`
      : '';
    return `<fieldset class="admin-fieldset"><legend>${escapeHtml(title)}</legend>${stripFormWrapper(renderAdminForm({ formId, fields, values: fieldValues }))}${upload}${preview}</fieldset>`;
  };
  const [intro, introAlt, introCaption, full, fullAlt, fullCaption] = ARTICLE_IMAGE_FIELDS;
  const links = ['a', 'b', 'c'].map((letter) => block(`Link ${letter.toUpperCase()}`, ARTICLE_LINK_FIELDS.filter((field) => field.key.startsWith(`url${letter}`)))).join('');
  return block('Imagem de introdução', [intro, introAlt, introCaption], intro.name) + block('Imagem do artigo completo', [full, fullAlt, fullCaption], full.name) + links + '<p id="admin-image-status" role="status" aria-live="polite" data-admin-image-status></p>';
}

function formatInfoDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : String(value ?? '');
}

// Somente leitura: id e colunas de sistema do SharePoint (Created/Modified).
function renderArticleInfo(values) {
  if (!values.id) return '';
  return `<dl class="admin-meta"><dt>ID</dt><dd>${escapeHtml(values.id)}</dd><dt>Criado em</dt><dd>${escapeHtml(formatInfoDate(values.created) || '—')}</dd><dt>Modificado em</dt><dd>${escapeHtml(formatInfoDate(values.modified) || '—')}</dd></dl>`;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'tab';
}

function stripFormWrapper(formHtml) {
  return String(formHtml)
    .replace(/^<form[^>]*>/, '')
    .replace(/<div class="admin-form-actions">[\s\S]*?<\/div><\/form>$/, '')
    .trim();
}

function fieldMap(fields) {
  return new Map((Array.isArray(fields) ? fields : []).map((field) => [field.name, field]));
}

function pickFields(map, names) {
  return (Array.isArray(names) ? names : [])
    .map((name) => map.get(name))
    .filter(Boolean);
}

function renderTabbedPanels({ formId, layout, fields, values, relationOptions, imageUpload }) {
  const tabs = Array.isArray(layout?.tabs) ? layout.tabs : [];
  const renderPanel = (panelFields) => {
    if (!panelFields.length) return '';
    const invalidDates = panelFields.filter((field) => field.type === 'datetime' && values[field.name] && !Number.isFinite(new Date(values[field.name]).getTime()));
    const renderFields = panelFields.map((field) => invalidDates.includes(field) ? { ...field, readOnly: true } : field);
    const html = renderAdminForm({ formId, fields: renderFields, values, relationOptions, submitLabel: 'Salvar', cancelHref: null });
    return stripFormWrapper(html) + invalidDates.map((field) => `<p role="status">${escapeHtml(field.label)}: data persistida inválida; valor preservado e edição indisponível.</p>`).join('');
  };

  const tabButtons = tabs.map((tab, index) => {
    const tabId = `admin-article-tab-${formId}-${slugify(tab.key ?? tab.label ?? String(index))}`;
    return `<button type="button" role="tab" id="${tabId}-label" aria-controls="${tabId}-panel" aria-selected="${index === 0 ? 'true' : 'false'}" data-admin-tab-button tabindex="${index === 0 ? '0' : '-1'}">${escapeHtml(tab.label ?? String(tab.key))}</button>`;
  }).join('');

  const fieldByName = fieldMap(fields);
  const panels = tabs.map((tab, index) => {
    const tabId = `admin-article-tab-${formId}-${slugify(tab.key ?? tab.label ?? String(index))}`;
    const mainFields = pickFields(fieldByName, tab.main);
    const sidebarFields = pickFields(fieldByName, tab.sidebar);
    const extra = tab.key === 'options' ? renderArticleOptions(formId, values) : tab.key === 'images' ? renderArticleImagesAndLinks(formId, values, imageUpload) : tab.key === 'content' ? `<button type="button" class="admin-btn admin-btn-ghost" data-admin-article-accessibility aria-controls="admin-article-accessibility-report">Verificar acessibilidade</button><div id="admin-article-accessibility-report" role="status" aria-live="polite" aria-atomic="true" data-admin-article-accessibility-report></div><p>Verificação local e somente leitura; não substitui uma auditoria de acessibilidade.</p>` : '';
    const description = tab.description ? `<p>${escapeHtml(tab.description)}</p>` : '';
    const mainHtml = description + (tab.key === 'options' ? extra + renderPanel(mainFields) : renderPanel(mainFields) + extra);
    const sidebarHtml = (sidebarFields.length ? renderPanel(sidebarFields) : '') + (tab.key === 'publishing' ? renderArticleInfo(values) : '');
    return `
      <div role="tabpanel" id="${tabId}-panel" aria-labelledby="${tabId}-label" data-admin-tab-panel${index === 0 ? '' : ' hidden'}>
        <div class="admin-article-grid">
          <div class="admin-article-main">${mainHtml}</div>
          <aside class="admin-article-sidebar" aria-label="Propriedades">${sidebarHtml}</aside>
        </div>
      </div>
    `;
  }).join('');

  // Reusa o styling padrão de abas do admin (admin.css: .admin-tabs).
  return `<div class="admin-tabs" role="tablist" aria-label="Editor de artigo">${tabButtons}</div>${panels}`;
}

export function renderArticleAdminForm({
  formId = 'articles',
  fields = [],
  values = {},
  relationOptions = {},
  layout,
  submitLabel = 'Salvar',
  cancelHref,
  imageUpload = false
} = {}) {
  const fieldByName = fieldMap(fields);
  const headerFields = pickFields(fieldByName, layout?.header);

  // Cabeçalho: título + alias antes das abas.
  const headerInner = headerFields.length
    ? stripFormWrapper(renderAdminForm({ formId, fields: headerFields, values, relationOptions, submitLabel: 'Salvar', cancelHref: null }))
    : '';

  const cancel = cancelHref ? `<a class="admin-btn admin-btn-ghost admin-form-cancel" href="${safeUrl(cancelHref)}">${closeIcon()}Cancelar</a>` : '';
  const actions = `<div class="admin-form-actions"><button type="submit" class="admin-btn admin-btn-success">${saveIcon()}${escapeHtml(submitLabel)}</button>${cancel}</div>`;

  const tabsAndPanels = renderTabbedPanels({ formId, layout, fields, values, relationOptions, imageUpload });

  return `
    <form class="admin-form admin-form-article" data-admin-form="${escapeHtml(formId)}">
      <div class="admin-article-header">${headerInner}</div>
      ${tabsAndPanels}
      <p class="admin-article-limits">${escapeHtml(ARTICLE_EDITOR_LIMITS)}</p>
      ${actions}
    </form>
  `;
}
