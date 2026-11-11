/*
 * Formulário de instância de módulo (com_modules do Joomla: abas Módulo,
 * Parâmetros, Atribuição de menu e Avançado). View pura: recebe os dados já
 * carregados e normalizados pelo coordenador e devolve só HTML — leitura do
 * formulário, conversão de datas, ETag e gravação continuam em
 * com_minijoomla/extension-pages.js.
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { MODULE_ADVANCED_PARAMS } from '../../../../../libraries/minijoomla/application/module-catalog.js';
import { MODULE_ASSIGNMENTS, ASSIGNMENT_ROUTES } from '../../../../../libraries/minijoomla/application/module-assignment.js';
import {
  options, paramFields, tabs, formActions, assignmentSummary,
  STATE_LABELS, ASSIGNMENT_LABELS, ROUTE_LABELS, LEGACY_ASSIGNMENT_REASONS
} from '../../../com_minijoomla/extension-pages.js';

const esc = (value) => escapeHtml(String(value ?? ''));

export function renderModuleForm({ isNew, typeKey, type, catalog, values, positions, menu, categories, settings, paramValues, state, tokens, initialDates, legacyScope, legacyPlan, link }) {
  const typeOptions = [['', '— selecione —'], ...catalog.map((entry) => [entry.key, entry.builtin ? `${entry.key} (nativo)` : `${entry.title} (${entry.key})${entry.enabled === false ? ' — desabilitado' : ''}`])];
  const typeField = isNew
    ? `<div class="admin-field"><label for="admin-module-type">Tipo de módulo *</label><select id="admin-module-type" name="extensionKey" required data-ext-type-select>${typeOptions.map(([value, label]) => `<option value="${esc(value)}"${value === typeKey && value ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></div>`
    : `<div class="admin-field"><span class="admin-field-label">Tipo de módulo</span><p><strong>${esc(type?.title ?? typeKey)}</strong> <code>${esc(typeKey)}</code></p></div>`;
  const templatePositions = positions.positions.map((position) => [position, position]);
  const otherPositions = positions.all.filter((position) => !positions.positions.includes(position)).map((position) => [position, position]);
  if (!isNew && typeof values.position === 'string' && values.position && !positions.all.includes(values.position)) otherPositions.push([values.position, `${values.position} (atual — fora do catálogo)`]);
  const positionSelect = `<div class="admin-field"><label for="admin-module-position">Posição</label><select id="admin-module-position" name="position" required><optgroup label="Template ativo (${esc(positions.template)})">${options(templatePositions, values.position)}</optgroup>${otherPositions.length ? `<optgroup label="Outras posições">${options(otherPositions, values.position)}</optgroup>` : ''}</select></div>`;
  const moduleTab = `${typeField}<div class="admin-field"><label for="admin-module-title">Título *</label><input type="text" id="admin-module-title" name="title" required value="${esc(values.title)}"></div>
<div class="admin-field admin-field-checkbox"><input type="checkbox" id="admin-module-showTitle" name="showTitle"${values.showTitle !== false ? ' checked' : ''}><label for="admin-module-showTitle">Mostrar título</label></div>
${positionSelect}<div class="admin-field"><label for="admin-module-ordering">Ordem</label><input type="number" id="admin-module-ordering" name="ordering" step="1" value="${esc(values.ordering ?? 0)}"></div>
<div class="admin-field"><label for="admin-module-state">Estado</label><select id="admin-module-state" name="state">${options(Object.entries(STATE_LABELS), state)}</select></div>
<div class="admin-field"><label for="admin-module-publishUp">Início da publicação</label><input type="datetime-local" id="admin-module-publishUp" name="publishUp" value="${esc(initialDates.publishUp)}"></div>
<div class="admin-field"><label for="admin-module-publishDown">Fim da publicação</label><input type="datetime-local" id="admin-module-publishDown" name="publishDown" value="${esc(initialDates.publishDown)}"></div>
<div class="admin-field"><label for="admin-module-note">Nota</label><input type="text" id="admin-module-note" name="note" maxlength="255" value="${esc(values.note)}"></div>`;
  const typeDefinitions = type?.params ?? [];
  const check = (token, label) => `<li><input type="checkbox" id="admin-assign-${esc(token.replace(/[^a-zA-Z0-9_-]/g, '-'))}" name="assignmentToken" value="${esc(token)}"${tokens.has(token) ? ' checked' : ''}><label for="admin-assign-${esc(token.replace(/[^a-zA-Z0-9_-]/g, '-'))}">${esc(label)}</label></li>`;
  const legacy = legacyScope ? `<p class="admin-help">Escopo legado atual: ${esc(assignmentSummary(values))}. Mantido até escolher uma nova atribuição.</p>${legacyPlan.convertible
    ? `<div class="admin-field"><p class="admin-help">Prévia equivalente: ${esc(ASSIGNMENT_LABELS[legacyPlan.assignment])}${legacyPlan.assignmentTokens.length ? ` — ${esc(legacyPlan.assignmentTokens.map((token) => ROUTE_LABELS[token.slice(6)] ?? token).join(', '))}` : ''}. Aplicar só preenche o formulário; nada é gravado antes de Salvar e fechar.</p><div><button type="button" class="admin-btn admin-btn-ghost" data-ext-legacy-apply aria-describedby="admin-legacy-assignment-status">Aplicar conversão equivalente</button> <button type="button" class="admin-btn admin-btn-ghost" data-ext-legacy-restore>Restaurar atribuição legada</button></div></div>`
    : `<p class="admin-help" role="note">${esc(LEGACY_ASSIGNMENT_REASONS[legacyPlan.reason] ?? 'Nenhuma conversão automática segura disponível.')}</p>`}<p id="admin-legacy-assignment-status" role="status" aria-live="polite" data-ext-legacy-status></p>` : '';
  const listedTokens = new Set([...menu.map((item) => `menu:${item.id}`), ...categories.filter((category) => category.alias).map((category) => `category:${category.alias}`), ...ASSIGNMENT_ROUTES.map((route) => `route:${route}`)]);
  const unlistedTokens = [...tokens].filter((token) => !listedTokens.has(token));
  const assignmentTab = `${legacy}<div class="admin-field"><label for="admin-module-assignment">Atribuição do módulo</label><select id="admin-module-assignment" name="assignment">${options([...(legacyScope ? [['', 'Manter escopo legado']] : []), ...MODULE_ASSIGNMENTS.map((key) => [key, ASSIGNMENT_LABELS[key]])], values.assignment || (legacyScope ? '' : 'all'))}</select></div>
<fieldset class="admin-assignment"><legend>Itens de menu</legend><ul>${(Array.isArray(menu) ? menu : []).map((item) => check(`menu:${item.id}`, `${item.title} (${item.path ?? ''})`)).join('') || '<li>Nenhum item de menu.</li>'}</ul></fieldset>
<fieldset class="admin-assignment"><legend>Tipos de página</legend><ul>${ASSIGNMENT_ROUTES.map((route) => check(`route:${route}`, ROUTE_LABELS[route])).join('')}</ul></fieldset>
<fieldset class="admin-assignment"><legend>Categorias</legend><ul>${(Array.isArray(categories) ? categories : []).filter((category) => category.alias).map((category) => check(`category:${category.alias}`, category.title)).join('') || '<li>Nenhuma categoria.</li>'}</ul></fieldset>${unlistedTokens.length ? `<fieldset class="admin-assignment"><legend>Atribuições existentes fora do catálogo atual</legend><ul>${unlistedTokens.map((token) => check(token, token)).join('')}</ul></fieldset>` : ''}`;
  const advancedTab = paramFields('module-advanced', MODULE_ADVANCED_PARAMS, settings);
  return `<form class="admin-form" data-ext-form="module">${tabs('module', [['module', 'Módulo', moduleTab + (type ? '' : '<p class="admin-help">Escolha o tipo para ver os parâmetros específicos.</p>')], ['params', 'Parâmetros', type ? paramFields('module', typeDefinitions, paramValues) : '<p class="admin-empty">Escolha o tipo de módulo.</p>'], ['assignment', 'Atribuição de menu', assignmentTab], ['advanced', 'Avançado', advancedTab]])}${formActions(link('/moduleInstances'), isNew ? 'Criar' : 'Salvar e fechar')}</form>`;
}
