/*
 * Telas administrativas de extensões (equivalentes funcionais de
 * com_modules, com_plugins, estilos do com_templates, com_config por
 * componente e com_installer). Cada rota devolve `{ html, bind }`; o
 * `bind` liga os eventos depois que app.js injeta o HTML. Toda escrita
 * usa o ETag capturado ao renderizar a tela (concorrência otimista).
 */
import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';
import { MODULE_ADVANCED_PARAMS } from '../../../libraries/minijoomla/application/module-catalog.js';
import { BUILTIN_TEMPLATES } from '../../../libraries/minijoomla/application/template-styles.js';
import { MODULE_ASSIGNMENTS, moduleState, normalizeAssignmentTokens, normalizeAssignment } from '../../../libraries/minijoomla/application/module-assignment.js';
import { planLegacyModuleAssignment } from '../../../libraries/minijoomla/application/legacy-module-assignment.js';
import { PLUGIN_GROUPS } from '../../../libraries/minijoomla/application/extension-manifest.js';
import { normalizeParamValues, parseJsonObject } from '../../../libraries/minijoomla/application/declared-params.js';
import { renderModulesTable } from '../com_modules/tmpl/modules/default.js';
import { renderPositionsPreview } from '../com_modules/tmpl/positions/default.js';
import { renderModuleTypeCatalog } from '../com_modules/tmpl/select/default.js';
import { renderModuleForm } from '../com_modules/tmpl/module/edit.js';
import { renderPluginsTable } from '../com_plugins/tmpl/plugins/default.js';
import { renderPluginForm } from '../com_plugins/tmpl/plugin/edit.js';
import { renderTemplateStylesTable } from '../com_templates/tmpl/styles/default.js';
import { renderTemplateStyleForm } from '../com_templates/tmpl/style/edit.js';
import { renderComponentOptionsCatalog, renderComponentOptionsForm } from '../com_config/tmpl/components/default.js';
import { KIND_LABELS, renderInstalledExtensionsTable, renderInstallForm } from '../com_installer/tmpl/manage/default.js';
import { renderAdminForm } from './render-form.js';
import { SITE_CONFIG_FIELDS } from './field-schemas.js';
import { plusIcon, saveIcon, closeIcon, checkIcon, banIcon, trashIcon, moduleIcon, pluginIcon, configIcon, desktopIcon } from './icons.js';

const PAGE_SIZE = 20;
export const STATE_LABELS = { published: 'Publicado', unpublished: 'Despublicado', trashed: 'Na lixeira' };
export const ASSIGNMENT_LABELS = { all: 'Em todas as páginas', none: 'Em nenhuma página', only: 'Apenas nas páginas selecionadas', except: 'Em todas, exceto as selecionadas' };
export const ROUTE_LABELS = { home: 'Página inicial', category: 'Blog de categoria', article: 'Artigo', search: 'Busca', archive: 'Arquivo' };
const BATCH_LABELS = { publish: 'Publicar', unpublish: 'Despublicar', trash: 'Enviar para a lixeira', restore: 'Restaurar da lixeira', delete: 'Excluir definitivamente', move: 'Mover para a posição' };
export const LEGACY_ASSIGNMENT_REASONS = {
  'category-intersection': 'O escopo legado combina rota e categoria. As seleções atuais usam OU, não E; converter ampliaria as páginas visíveis. Mantenha o legado ou configure manualmente uma nova atribuição.',
  'unsupported-kind': 'Tipo de escopo legado desconhecido. Nenhuma conversão automática segura disponível.',
  'unsupported-route': 'Rota legada não representável nas seleções atuais. Nenhuma conversão automática segura disponível.',
  'unsupported-category': 'Categoria legada não representável com segurança. Nenhuma conversão automática segura disponível.'
};

const esc = (value) => escapeHtml(String(value ?? ''));
const status = '<p class="admin-form-status admin-management-status" role="status" aria-live="polite" data-ext-status></p>';

export const MODULE_INSTANCE_COUNT_DESCRIPTION = 'Conta todas as instâncias salvas, inclusive despublicadas e na lixeira; não indica módulos visíveis no site.';

export function renderModuleInstanceHelp(link) {
  return `<p class="admin-help" role="note" id="admin-module-instance-help">Módulo é um tipo de extensão. O card Módulos do site conta instâncias salvas, não tipos habilitados. ${esc(MODULE_INSTANCE_COUNT_DESCRIPTION)} <a href="${esc(link('/moduleInstances/new'))}">Criar módulo</a> · <a href="${esc(link('/moduleInstances'))}">Configurar posição e páginas</a>.</p>`;
}

export function extensionErrorMessage(error, fallback = 'Não foi possível concluir a operação.') {
  if (error?.code === 'concurrency-conflict') return 'O registro ou a configuração foi alterado por outra pessoa. Recarregue antes de tentar novamente.';
  if (error?.name === 'ValidationError' || error instanceof SyntaxError) return error.message;
  return fallback;
}

export function toLocalDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function options(list, selected) {
  return list.map(([value, label]) => `<option value="${esc(value)}"${String(value) === String(selected ?? '') ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

export function renderParamField(formId, definition, value) {
  const id = `admin-param-${formId}-${definition.name}`;
  const name = `param:${definition.name}`;
  const label = `<label for="${esc(id)}">${esc(definition.label)}</label>`;
  const hints = [definition.description];
  if (definition.type === 'json') hints.push(`JSON: ${definition.valueType === 'array' ? 'lista (array)' : 'objeto'}. O conteúdo é validado antes de salvar.`);
  if (definition.type === 'url') hints.push('Caminho relativo, rota # ou URL HTTPS.');
  const help = hints.filter(Boolean).join(' ');
  const common = `id="${esc(id)}" name="${esc(name)}" data-ext-param="${esc(definition.type)}"${help ? ` aria-describedby="${esc(id)}-help"` : ''}`;
  const helpHtml = help ? `<p class="admin-help" id="${esc(id)}-help">${esc(help)}</p>` : '';
  const wrap = (control, checkbox = false) => `<div class="admin-field${checkbox ? ' admin-field-checkbox' : ''}">${checkbox ? control + label : label + control}${helpHtml}</div>`;
  const maxLength = Number.isSafeInteger(definition.maxLength) ? ` maxlength="${definition.maxLength}"` : '';
  if (definition.type === 'checkbox') return wrap(`<input type="checkbox" ${common}${value ? ' checked' : ''}>`, true);
  if (definition.type === 'select') return wrap(`<select ${common}>${options((definition.options ?? []).map((option) => [option.value, option.label]), value)}</select>`);
  if (['textarea', 'json'].includes(definition.type)) {
    const text = definition.type === 'json' && value !== undefined ? JSON.stringify(value, null, 2) : value;
    // JSON size is checked on its compact representation by the service;
    // pretty-print whitespace must not prevent editing a valid saved value.
    return wrap(`<textarea ${common}${definition.type === 'json' ? ' spellcheck="false"' : maxLength} rows="${definition.type === 'json' ? 8 : 5}">${esc(text)}</textarea>`);
  }
  // type=url rejects server-relative/hash paths via native constraint validation.
  const type = { number: 'number', color: 'color' }[definition.type] ?? 'text';
  const limits = definition.type === 'number' ? `${Number.isFinite(definition.min) ? ` min="${definition.min}"` : ''}${Number.isFinite(definition.max) ? ` max="${definition.max}"` : ''} step="any"` : maxLength;
  return wrap(`<input type="${type}" ${common}${limits}${definition.type === 'url' ? ' inputmode="url"' : ''} value="${esc(value)}">`);
}

export function readParamInputs(form, definitions) {
  const values = {};
  for (const definition of definitions) {
    const input = form.querySelector?.(`[name="param:${definition.name}"]`);
    if (!input) continue;
    if (definition.type === 'checkbox') values[definition.name] = Boolean(input.checked);
    // Keep numeric input as text; coerceParam handles blank/default/null and invalid numbers.
    // Never introduce undefined/NaN into the JSON-safe submitted values.
    else if (definition.type === 'number') values[definition.name] = input.value ?? '';
    else values[definition.name] = input.value ?? '';
  }
  return values;
}

export function paramFields(formId, definitions, values = {}) {
  if (!definitions.length) return '<p class="admin-empty">Esta extensão não declara parâmetros.</p>';
  return definitions.map((definition) => {
    const value = Object.hasOwn(values, definition.name) ? values[definition.name] : undefined;
    return renderParamField(formId, definition, value ?? definition.default);
  }).join('');
}

export function tabs(formId, panels) {
  const buttons = panels.map(([key, label], index) => `<button type="button" role="tab" id="admin-tab-${formId}-${key}-label" aria-controls="admin-tab-${formId}-${key}-panel" aria-selected="${index === 0}" data-admin-tab-button tabindex="${index === 0 ? 0 : -1}">${esc(label)}</button>`).join('');
  const bodies = panels.map(([key, , html], index) => `<div role="tabpanel" id="admin-tab-${formId}-${key}-panel" aria-labelledby="admin-tab-${formId}-${key}-label" data-admin-tab-panel${index === 0 ? '' : ' hidden'}>${html}</div>`).join('');
  return `<div class="admin-tabs" role="tablist">${buttons}</div>${bodies}`;
}

export function formActions(cancelHref, label = 'Salvar e fechar') {
  return `<div class="admin-form-actions"><button type="submit" class="admin-btn admin-btn-success">${saveIcon()}${esc(label)}</button><a class="admin-btn admin-btn-ghost admin-form-cancel" href="${esc(cancelHref)}">${closeIcon()}Cancelar</a></div>`;
}

function paginate(rows, pageParam) {
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number.parseInt(pageParam, 10) || 1));
  return { page, pageCount, pageRows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export function pagination({ page, pageCount }, href) {
  if (pageCount <= 1) return '';
  const items = Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => number === page ? `<span aria-current="page">${number}</span>` : `<a href="${esc(href(number))}">${number}</a>`);
  return `<nav class="admin-pagination" aria-label="Páginas"><ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul></nav>`;
}

export function filterBar(id, fields, label = 'Filtrar') {
  const controls = fields.map((field) => field.type === 'search'
    ? `<label for="${id}-${field.name}">${esc(field.label)}</label><input type="search" id="${id}-${field.name}" name="${field.name}" value="${esc(field.value)}">`
    : `<label for="${id}-${field.name}" class="visually-hidden">${esc(field.label)}</label><select id="${id}-${field.name}" name="${field.name}">${options(field.options, field.value)}</select>`).join('');
  return `<form class="admin-searchbar" role="search" data-ext-filter="${id}">${controls}<button type="submit" class="admin-btn admin-btn-primary">${esc(label)}</button></form>`;
}

export function stateIcon(state, label) {
  return `<span class="admin-state-icon${state === 'published' ? ' is-active' : ''}${state === 'trashed' ? ' is-trashed' : ''}" role="img" aria-label="${esc(label)}">${state === 'published' ? checkIcon() : state === 'trashed' ? trashIcon() : banIcon()}</span>`;
}

export function selectionCell(id, title) {
  return `<td class="admin-col-check"><input type="checkbox" data-ext-select value="${esc(id)}" aria-label="Selecionar ${esc(title)}"></td>`;
}

export const selectAllCell = '<th scope="col" class="admin-col-check"><input type="checkbox" data-ext-select-all aria-label="Selecionar todos os itens visíveis"></th>';

export function assignmentSummary(row = {}) {
  const tokens = normalizeAssignmentTokens(row.assignmentJson);
  if (row.assignment && MODULE_ASSIGNMENTS.includes(row.assignment)) {
    return ['only', 'except'].includes(row.assignment) ? `${ASSIGNMENT_LABELS[row.assignment]} (${tokens.length})` : ASSIGNMENT_LABELS[row.assignment];
  }
  if (row.scopeKind === 'Route') return `Rota: ${ROUTE_LABELS[row.scopeRoute] ?? row.scopeRoute}${row.scopeCategoryAlias ? ` (${row.scopeCategoryAlias})` : ''}`;
  return ASSIGNMENT_LABELS.all;
}

export function createExtensionPages({ adminService, documentRef, router, shell, isCurrent = () => true }) {
  const link = (path, params) => router.link(path, params);
  const home = () => ({ label: 'Painel de controle', href: link('/') });
  const page = (activeKey, pageTitle, crumbs, bodyHtml, toolbarActionsHtml = '') => shell({ activeKey, pageTitle, breadcrumbItems: [home(), ...crumbs], bodyHtml, toolbarActionsHtml, link });
  const body = () => documentRef.body;
  const report = (message) => { if (!isCurrent()) return; const element = body().querySelector?.('[data-ext-status]'); if (element) element.textContent = message; };
  const navigate = (...args) => isCurrent() ? router.navigate(...args) : undefined;
  const reload = (location) => navigate(link(location.path, location.params));

  function bindSubmit(form, save) {
    let saving = false;
    form?.addEventListener?.('submit', async (event) => {
      event?.preventDefault?.();
      if (saving || !isCurrent()) return;
      saving = true;
      try { await save(); } finally { saving = false; }
    });
  }

  function bindFilter(location, names) {
    const form = body().querySelector?.('[data-ext-filter]');
    form?.addEventListener?.('submit', async (event) => {
      event?.preventDefault?.();
      if (!isCurrent()) return;
      const params = Object.fromEntries(names.map((name) => [name, form.querySelector?.(`[name="${name}"]`)?.value]).filter(([, value]) => value));
      await navigate(link(location.path, params));
    });
  }

  function selectedIds() {
    return Array.from(body().querySelectorAll?.('[data-ext-select]') ?? []).filter((input) => input.checked).map((input) => input.value);
  }

  function bindSelectAll() {
    const all = body().querySelector?.('[data-ext-select-all]');
    all?.addEventListener?.('change', () => { if (!isCurrent()) return; body().querySelectorAll?.('[data-ext-select]')?.forEach?.((input) => { input.checked = Boolean(all.checked); }); });
  }

  function bindActions(handlers) {
    body().querySelectorAll?.('[data-ext-action]')?.forEach?.((button) => {
      button.addEventListener?.('click', async (event) => {
        event?.preventDefault?.();
        if (button.disabled || !isCurrent()) return;
        const handler = handlers[button.dataset?.extAction];
        if (!handler) return;
        button.disabled = true;
        try { await handler(button.dataset?.extId, button); } catch (error) { report(extensionErrorMessage(error)); } finally { button.disabled = false; }
      });
    });
  }

  function batchReport(result, location) {
    if (result.failed.length) {
      report(`${result.succeeded.length} item(ns) processado(s); ${result.failed.length} falha(s): ${result.failed.map((failure) => extensionErrorMessage(failure, failure.message)).join(' ')}`);
      return undefined;
    }
    return reload(location);
  }

  // ---------- Módulos (com_modules) ----------

  async function moduleListPage(location) {
    const params = location.params ?? {};
    const [rows, catalog, positions] = await Promise.all([adminService.moduleInstances.list(), adminService.moduleInstances.catalog(), adminService.moduleInstances.positions()]);
    const types = new Map(catalog.map((type) => [type.key, type]));
    const term = String(params.q ?? '').trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const state = moduleState(row);
      const stateOk = params.state === '*' ? true : params.state ? state === params.state : state !== 'trashed';
      return stateOk && (!params.position || row.position === params.position) && (!params.type || row.extensionKey === params.type)
        && (!term || `${row.title} ${row.note ?? ''}`.toLowerCase().includes(term));
    }).sort((a, b) => String(a.position).localeCompare(String(b.position)) || (Number(a.ordering) || 0) - (Number(b.ordering) || 0) || Number(a.id) - Number(b.id));
    const paged = paginate(filtered, params.page);
    const snapshots = (await Promise.all(paged.pageRows.map((row) => adminService.moduleInstances.get(row.id)))).filter(Boolean);
    const etags = new Map(snapshots.map((row) => [String(row.id), row.etag]));
    const filters = filterBar('admin-modules-filter', [
      { name: 'q', label: 'Buscar', type: 'search', value: params.q },
      { name: 'state', label: 'Estado', value: params.state, options: [['', '— Estado (exceto lixeira) —'], ['published', 'Publicados'], ['unpublished', 'Despublicados'], ['trashed', 'Na lixeira'], ['*', 'Todos']] },
      { name: 'position', label: 'Posição', value: params.position, options: [['', '— Posição —'], ...positions.all.map((position) => [position, position])] },
      { name: 'type', label: 'Tipo de módulo', value: params.type, options: [['', '— Tipo de módulo —'], ...catalog.map((type) => [type.key, type.title])] }
    ]);
    const batch = `<form class="admin-batch" data-ext-batch aria-label="Ações em lote"><label for="admin-batch-action">Ações em lote</label><select id="admin-batch-action" name="batchAction">${options([['', '— Selecione —'], ...Object.entries(BATCH_LABELS)], '')}</select><label for="admin-batch-position">Posição de destino</label><select id="admin-batch-position" name="batchPosition">${options([['', '— Posição —'], ...positions.all.map((position) => [position, position])], '')}</select><button type="submit" class="admin-btn">Aplicar aos selecionados</button></form>`;
    const table = renderModulesTable(snapshots, { link, types, positions });
    const toolbar = `<a class="admin-btn admin-btn-success" href="${esc(link('/moduleInstances/select'))}">${plusIcon()}Novo</a><a class="admin-btn admin-btn-ghost" href="${esc(link('/templates/positions'))}">Pré-visualizar posições</a>`;
    const html = page('moduleInstances', 'Módulos do site', [{ label: 'Módulos do site' }], `${renderModuleInstanceHelp(link)}${status}${filters}${batch}${table}${pagination(paged, (number) => link('/moduleInstances', { ...params, page: String(number) }))}`, toolbar);
    const bind = () => {
      bindFilter(location, ['q', 'state', 'position', 'type']);
      bindSelectAll();
      const run = async (ids, action, extra) => batchReport(await adminService.moduleInstances.batch(ids.map((id) => ({ id: Number(id), etag: etags.get(String(id)) })), action, extra), location);
      bindActions({
        publish: (id) => run([id], 'publish'), unpublish: (id) => run([id], 'unpublish'), restore: (id) => run([id], 'restore'),
        duplicate: async (id) => { const created = await adminService.moduleInstances.duplicate(Number(id)); await navigate(link(`/moduleInstances/${created.id}`)); }
      });
      const form = body().querySelector?.('[data-ext-batch]');
      bindSubmit(form, async () => {
        const action = form.querySelector?.('[name="batchAction"]')?.value;
        const ids = selectedIds();
        if (!action) { report('Escolha uma ação em lote.'); return; }
        if (!ids.length) { report('Selecione ao menos um módulo.'); return; }
        try { await run(ids, action, { position: form.querySelector?.('[name="batchPosition"]')?.value }); } catch (error) { report(extensionErrorMessage(error)); }
      });
    };
    return { html, bind };
  }

  async function moduleTypeSelectPage() {
    const catalog = await adminService.moduleInstances.catalog();
    return { html: page('moduleInstances', 'Selecionar um tipo de módulo', [{ label: 'Módulos do site', href: link('/moduleInstances') }, { label: 'Novo' }], `${renderModuleInstanceHelp(link)}${renderModuleTypeCatalog(catalog, { link })}`) };
  }

  async function moduleEditPage(location, idSegment) {
    const isNew = idSegment === 'new';
    const record = isNew ? null : await adminService.moduleInstances.get(Number(idSegment));
    if (!isNew && !record) return null;
    const [catalog, positions, menu, categories] = await Promise.all([
      adminService.moduleInstances.catalog(), adminService.moduleInstances.positions(),
      adminService.menu?.available === false ? [] : adminService.menu?.list?.() ?? [], adminService.categories?.available === false ? [] : adminService.categories?.list?.() ?? []
    ]);
    const typeKey = isNew ? String(location.params?.type ?? '') : record.extensionKey;
    const type = catalog.find((entry) => entry.key === typeKey) ?? null;
    const values = record ?? { enabled: true, ordering: 0, position: positions.positions.includes('sidebar-right') ? 'sidebar-right' : positions.positions[0], showTitle: true, assignment: 'all' };
    const initialDates = Object.fromEntries(['publishUp', 'publishDown'].map((name) => [name, toLocalDateTimeInput(values[name])]));
    const settings = parseJsonObject(values.settingsJson, { strict: true, field: 'settingsJson' });
    const paramValues = typeKey === 'custom-html' && settings.title === undefined ? { ...settings, title: values.title ?? '' } : settings;
    const state = isNew ? 'published' : moduleState(values);
    const tokens = new Set(normalizeAssignmentTokens(values.assignmentJson));
    normalizeAssignment(values.assignment);
    const typeDefinitions = type?.params ?? [];
    normalizeParamValues([...typeDefinitions, ...MODULE_ADVANCED_PARAMS], settings);
    const legacyScope = !isNew && !values.assignment;
    const legacyPlan = legacyScope ? planLegacyModuleAssignment(values) : null;
    const form = renderModuleForm({ isNew, typeKey, type, catalog, values, positions, menu, categories, settings, paramValues, state, tokens, initialDates, legacyScope, legacyPlan, link });
    const title = isNew ? 'Módulos: Novo' : `Módulos: Editar — ${values.title}`;
    const html = page('moduleInstances', title, [{ label: 'Módulos do site', href: link('/moduleInstances') }, { label: isNew ? 'Novo' : String(values.title) }], status + form);
    const bind = () => {
      body().querySelector?.('[data-ext-type-select]')?.addEventListener?.('change', (event) => {
        if (!isCurrent()) return;
        const value = event?.target?.value ?? body().querySelector?.('[data-ext-type-select]')?.value;
        navigate(link('/moduleInstances/new', value ? { type: value } : {}));
      });
      const formElement = body().querySelector?.('[data-ext-form="module"]');
      if (legacyScope && legacyPlan.convertible) {
        const assignmentField = formElement?.querySelector?.('[name="assignment"]');
        const tokenFields = () => Array.from(formElement?.querySelectorAll?.('[name="assignmentToken"]') ?? []);
        const legacyReport = (message) => { const element = formElement?.querySelector?.('[data-ext-legacy-status]'); if (element) element.textContent = message; };
        formElement?.querySelector?.('[data-ext-legacy-apply]')?.addEventListener?.('click', () => {
          if (!isCurrent()) return;
          if (!assignmentField) return;
          if (assignmentField.value) { legacyReport('A atribuição foi editada. Restaure o legado antes de aplicar a conversão equivalente. Nenhum dado foi gravado.'); return; }
          const controls = tokenFields();
          if (legacyPlan.assignmentTokens.some((token) => !controls.some((field) => field.value === token))) { legacyReport('A página equivalente não está disponível no formulário. Mantenha o legado. Nenhum dado foi gravado.'); return; }
          assignmentField.value = legacyPlan.assignment;
          for (const field of controls) field.checked = legacyPlan.assignmentTokens.includes(field.value);
          legacyReport('Conversão equivalente aplicada ao formulário. Revise e salve para gravar, ou restaure o legado.');
        });
        formElement?.querySelector?.('[data-ext-legacy-restore]')?.addEventListener?.('click', () => {
          if (!isCurrent()) return;
          if (!assignmentField) return;
          assignmentField.value = '';
          for (const field of tokenFields()) field.checked = tokens.has(field.value);
          legacyReport('Atribuição legada restaurada no formulário. Os demais campos editados foram mantidos; nenhum dado foi gravado.');
        });
      }
      bindSubmit(formElement, async () => {
        try {
          const field = (name) => formElement.querySelector?.(`[name="${name}"]`);
          const chosenType = isNew ? field('extensionKey')?.value : typeKey;
          const definitions = catalog.find((entry) => entry.key === chosenType)?.params ?? [];
          const typeParams = normalizeParamValues(definitions, readParamInputs(formElement, definitions), { keepUndeclared: false });
          const advanced = normalizeParamValues(MODULE_ADVANCED_PARAMS, readParamInputs(formElement, MODULE_ADVANCED_PARAMS), { keepUndeclared: false });
          const selectedState = field('state')?.value || 'published';
          const ordering = field('ordering')?.value;
          const input = {
            title: field('title')?.value ?? '', position: field('position')?.value ?? '', ordering: ordering === '' || ordering === undefined ? 0 : Number(ordering),
            showTitle: Boolean(field('showTitle')?.checked), enabled: selectedState === 'published', trashed: selectedState === 'trashed',
            note: field('note')?.value ?? '',
            assignment: field('assignment')?.value || 'all',
            assignmentTokens: Array.from(formElement.querySelectorAll?.('[name="assignmentToken"]') ?? []).filter((input) => input.checked).map((input) => input.value),
            settings: { ...settings, ...typeParams, ...advanced }
          };
          // Minute-only controls must not truncate persisted seconds/milliseconds
          // when unchanged. Only explicit edits convert local time to UTC.
          for (const name of ['publishUp', 'publishDown']) {
            const value = field(name)?.value;
            if (value === undefined || (!isNew && value === initialDates[name])) continue;
            input[name] = value ? new Date(value).toISOString() : null;
          }
          if (chosenType === 'custom-html' && settings.title === undefined && !typeParams.title) input.settings.title = input.title;
          if (legacyScope && !field('assignment')?.value) { delete input.assignment; delete input.assignmentTokens; }
          if (isNew) {
            if (!chosenType) { report('Escolha o tipo de módulo.'); return; }
            await adminService.moduleInstances.create({ ...input, extensionKey: chosenType });
          } else {
            await adminService.moduleInstances.update(record.id, input, { etag: record.etag });
          }
          report('Módulo salvo.');
          await navigate(link('/moduleInstances'));
        } catch (error) { report(extensionErrorMessage(error, 'Não foi possível salvar o módulo.')); }
      });
    };
    return { html, bind };
  }

  // ---------- Pré-visualização de posições (tp=1) ----------

  async function positionsPage(location) {
    const catalog = await adminService.moduleInstances.positions();
    const requested = location.params?.template;
    const positions = requested ? await adminService.moduleInstances.positions(requested) : catalog;
    const templates = (await adminService.templateStyles?.list?.())?.catalog ?? [{ key: positions.template, title: positions.template }];
    const modules = (await adminService.moduleInstances.list()).filter((row) => moduleState(row) !== 'trashed');
    const filters = filterBar('admin-positions-filter', [{ name: 'template', label: 'Template', value: positions.template, options: templates.map((template) => [template.key, template.title]) }], 'Mostrar');
    const html = page('templateStyles', `Posições do template: ${positions.template}`, [{ label: 'Estilos de template', href: link('/templates/styles') }, { label: 'Posições' }], `<p>Equivalente administrativo da visualização de posições (tp=1): mostra os módulos atribuídos a cada posição declarada pelo template.</p>${filters}${renderPositionsPreview(positions, modules, { link })}`);
    return { html, bind: () => bindFilter(location, ['template']) };
  }

  // ---------- Plugins (com_plugins) ----------

  async function pluginListPage(location) {
    const params = location.params ?? {};
    const rows = await (adminService.plugins.catalog ?? adminService.plugins.list)();
    const groups = [...new Set([...PLUGIN_GROUPS, ...adminService.plugins.groups(rows)])];
    const term = String(params.q ?? '').trim().toLowerCase();
    const filtered = rows.filter((row) => (!params.group || row.group === params.group)
      && (!['true', 'false'].includes(params.enabled) || Boolean(row.enabled) === (params.enabled === 'true'))
      && (!term || `${row.title} ${row.key}`.toLowerCase().includes(term)));
    const paged = paginate(filtered, params.page);
    const snapshots = (await Promise.all(paged.pageRows.map((row) => (row.virtual ? row : adminService.plugins.get(row.id).then((fresh) => fresh && row.native ? { ...fresh, description: fresh.description || row.description } : fresh))))).filter(Boolean);
    const etags = new Map(snapshots.map((row) => [String(row.id), row.etag]));
    const filters = filterBar('admin-plugins-filter', [
      { name: 'q', label: 'Buscar', type: 'search', value: params.q },
      { name: 'group', label: 'Grupo', value: params.group, options: [['', '— Grupo —'], ...groups.map((group) => [group, group])] },
      { name: 'enabled', label: 'Estado', value: params.enabled, options: [['', '— Estado —'], ['true', 'Habilitados'], ['false', 'Desabilitados']] }
    ]);
    const batch = `<div class="admin-batch" role="group" aria-label="Ações em lote"><button type="button" class="admin-btn admin-btn-success" data-ext-action="batch-enable">Habilitar selecionados</button><button type="button" class="admin-btn admin-btn-danger" data-ext-action="batch-disable">Desabilitar selecionados</button></div>`;
    const table = renderPluginsTable(snapshots, { link });
    const toolbar = `<a class="admin-btn admin-btn-ghost" href="${esc(link('/installer'))}">${plusIcon()}Instalar</a>`;
    const html = page('plugins', 'Plugins', [{ label: 'Plugins' }], `${status}${filters}${batch}${table}${pagination(paged, (number) => link('/plugins', { ...params, page: String(number) }))}`, toolbar);
    const bind = () => {
      bindFilter(location, ['q', 'group', 'enabled']);
      bindSelectAll();
      const run = async (ids, action) => {
        if (!ids.length) { report('Selecione ao menos um plugin.'); return; }
        await batchReport(await adminService.plugins.batch(ids.map((id) => ({ id: String(id).startsWith('native:') ? id : Number(id), etag: etags.get(String(id)) })), action), location);
      };
      bindActions({
        toggle: (id) => { const row = snapshots.find((item) => String(item.id) === String(id)); return run([id], row?.enabled ? 'disable' : 'enable'); },
        'batch-enable': () => run(selectedIds(), 'enable'),
        'batch-disable': () => run(selectedIds(), 'disable')
      });
    };
    return { html, bind };
  }

  async function pluginEditPage(id) {
    const plugin = await adminService.plugins.get(Number(id));
    if (!plugin) return null;
    const form = renderPluginForm(plugin, { link });
    const html = page('plugins', `Plugins: ${plugin.title}`, [{ label: 'Plugins', href: link('/plugins') }, { label: String(plugin.title) }], status + form);
    const bind = () => {
      const formElement = body().querySelector?.('[data-ext-form="plugin"]');
      bindSubmit(formElement, async () => {
        try {
          const ordering = formElement.querySelector?.('[name="ordering"]')?.value;
          const input = { enabled: Boolean(formElement.querySelector?.('[name="enabled"]')?.checked), ordering: ordering === '' || ordering === undefined ? 0 : Number(ordering) };
          if (plugin.definitions.length) input.params = readParamInputs(formElement, plugin.definitions);
          await adminService.plugins.update(plugin.id, input, { etag: plugin.etag });
          await navigate(link('/plugins'));
        } catch (error) { report(extensionErrorMessage(error, 'Não foi possível salvar o plugin.')); }
      });
    };
    return { html, bind };
  }

  // ---------- Estilos de template (com_templates) ----------

  async function styleListPage(location) {
    const params = location.params ?? {};
    const { etag, styles, catalog } = await adminService.templateStyles.list();
    const filtered = styles.filter((style) => !params.template || style.template === params.template);
    const filters = filterBar('admin-styles-filter', [{ name: 'template', label: 'Template', value: params.template, options: [['', '— Template —'], ...catalog.map((template) => [template.key, template.title])] }]);
    const toolbar = `<a class="admin-btn admin-btn-ghost" href="${esc(link('/templates'))}">Templates registrados</a>`;
    const html = page('templateStyles', 'Templates: Estilos (Site)', [{ label: 'Estilos de template' }], `${status}${filters}${renderTemplateStylesTable(filtered, { link })}`, toolbar);
    const bind = () => {
      bindFilter(location, ['template']);
      bindActions({
        default: async (id) => { await adminService.templateStyles.setDefault(id, { etag }); await reload(location); },
        duplicate: async (id) => { const created = await adminService.templateStyles.duplicate(id, { etag }); await navigate(link(`/templates/styles/${encodeURIComponent(created)}`)); },
        remove: async (id) => { await adminService.templateStyles.remove(id, { etag }); await reload(location); }
      });
    };
    return { html, bind };
  }

  async function styleEditPage(id) {
    const style = await adminService.templateStyles.get(id);
    if (!style) return null;
    const form = renderTemplateStyleForm(style, { link });
    const html = page('templateStyles', `Templates: Editar estilo — ${style.title}`, [{ label: 'Estilos de template', href: link('/templates/styles') }, { label: String(style.title) }], status + form);
    const bind = () => {
      const formElement = body().querySelector?.('[data-ext-form="style"]');
      bindSubmit(formElement, async () => {
        try {
          const input = { title: formElement.querySelector?.('[name="title"]')?.value ?? '' };
          if (style.definitions.length) input.params = readParamInputs(formElement, style.definitions);
          await adminService.templateStyles.save(style.id, input, { etag: style.etag });
          await navigate(link('/templates/styles'));
        } catch (error) { report(extensionErrorMessage(error, 'Não foi possível salvar o estilo.')); }
      });
    };
    return { html, bind };
  }

  // ---------- Opções de componente (com_config) ----------

  function optionsListPage() {
    return { html: page('componentOptions', 'Opções dos componentes', [{ label: 'Opções' }], renderComponentOptionsCatalog(adminService.componentOptions.list(), { link })) };
  }

  async function optionsEditPage(key) {
    if (!adminService.componentOptions.list().some((component) => component.key === key)) return null;
    const options = await adminService.componentOptions.get(key);
    if (options.available === false) {
      return { html: page('componentOptions', `Opções: ${options.title}`, [{ label: 'Opções', href: link('/options') }, { label: options.title }], renderComponentOptionsForm(options, { link })), bind: () => {
        body().querySelector?.('[data-ext-form="options"]')?.addEventListener?.('submit', (event) => { event?.preventDefault?.(); });
      } };
    }
    const form = renderComponentOptionsForm(options, { link });
    const html = page('componentOptions', `Opções: ${options.title}`, [{ label: 'Opções', href: link('/options') }, { label: options.title }], status + form);
    const bind = () => {
      const formElement = body().querySelector?.('[data-ext-form="options"]');
      bindSubmit(formElement, async () => {
        try {
          await adminService.componentOptions.save(options.key, readParamInputs(formElement, options.definitions), { etag: options.etag });
          await navigate(link('/options'));
        } catch (error) { report(extensionErrorMessage(error, 'Não foi possível salvar as opções.')); }
      });
    };
    return { html, bind };
  }

  // ---------- Instalador / gerenciador de extensões (com_installer) ----------

  async function configPage() {
    const record = await adminService.siteConfig.get();
    const templates = adminService.templates?.available === false ? [] : await adminService.templates?.list?.() ?? [];
    const choices = new Map(BUILTIN_TEMPLATES.map((key) => [key, { value: key, label: `${key} (integrado)` }]));
    templates.filter((template) => template.enabled && !choices.has(template.key)).forEach((template) => choices.set(template.key, { value: template.key, label: template.title }));
    if (record?.templateKey && !choices.has(record.templateKey)) choices.set(record.templateKey, { value: record.templateKey, label: `${record.templateKey} (atual - indisponível)` });
    const unavailable = ['metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles'];
    const fields = SITE_CONFIG_FIELDS.map((field) => unavailable.includes(field.name) ? { ...field, readOnly: true, label: `${field.label} — indisponível` } : field);
    const form = renderAdminForm({ formId: 'site-config', fields, values: { homeView: 'category', homeCategory: 'noticias', sitenamePagetitles: 'none', ...record, templateKey: record?.templateKey || 'default' }, relationOptions: {
      templateKey: [...choices.values()],
      homeView: [{ value: 'category', label: 'Categoria (blog da categoria)' }, { value: 'featured', label: 'Artigos em destaque' }],
      robots: [{ value: record?.robots ?? '', label: record?.robots || 'Padrão do navegador' }],
      sitenamePagetitles: [{ value: record?.sitenamePagetitles || 'none', label: ({ none: 'Não', before: 'Antes', after: 'Depois' })[record?.sitenamePagetitles || 'none'] ?? record.sitenamePagetitles }]
    }, submitLabel: 'Salvar configuração', cancelHref: link('/') });
    // Mantém data-admin-form/ETag: app.js continua responsável pelo submit
    // e pelo ciclo de vida do editor atual do HTML personalizado.
    return { html: page('config', 'Configuração do site', [{ label: 'Configuração' }], `<p class="admin-help" role="note">Metadados e SEO indisponíveis: não há contrato para alterar os metadados globais do host. Os valores existentes serão preservados.</p><p role="status" aria-live="polite" aria-atomic="true" class="admin-form-status"></p>${form}`), etag: record?.etag };
  }

  async function installerPage(location) {
    const params = location.params ?? {};
    const rows = await adminService.installer.list();
    const term = String(params.q ?? '').trim().toLowerCase();
    const filtered = rows.filter((row) => (!params.kind || row.kind === params.kind) && (!term || `${row.title} ${row.key}`.toLowerCase().includes(term)));
    const paged = paginate(filtered, params.page);
    const snapshots = new Map((await Promise.all(paged.pageRows.filter((row) => !row.core).map(async (row) => [row.uid, await adminService[row.domain]?.get?.(row.id)]))).filter(([, record]) => record?.etag));
    const filters = filterBar('admin-installer-filter', [
      { name: 'q', label: 'Buscar', type: 'search', value: params.q },
      { name: 'kind', label: 'Tipo', value: params.kind, options: [['', '— Tipo —'], ...Object.entries(KIND_LABELS)] }
    ]);
    const table = renderInstalledExtensionsTable(paged.pageRows, { snapshots });
    const install = renderInstallForm(link);
    const html = page('installer', 'Extensões: Gerenciar', [{ label: 'Extensões' }], `${status}${install}<h2 class="admin-section-title">Extensões instaladas</h2>${filters}${table}${pagination(paged, (number) => link('/installer', { ...params, page: String(number) }))}`);
    const bind = () => {
      bindFilter(location, ['q', 'kind']);
      const formElement = body().querySelector?.('[data-ext-form="install"]');
      const manifest = () => formElement?.querySelector?.('[name="manifest"]')?.value ?? '';
      bindActions({
        toggle: async (uid) => {
          const row = rows.find((item) => item.uid === uid);
          const snapshot = snapshots.get(uid);
          if (!row || !snapshot) throw Object.assign(new Error('Registro sem ETag. Recarregue.'), { name: 'ValidationError' });
          await adminService[row.domain].update(row.id, { enabled: snapshot.enabled === false }, { etag: snapshot.etag });
          await reload(location);
        },
        preview: () => {
          const target = body().querySelector?.('[data-ext-preview]');
          const parsed = adminService.installer.preview(manifest());
          if (target) target.innerHTML = `<p>Manifesto válido: <strong>${esc(parsed.title)}</strong> — ${esc(KIND_LABELS[parsed.type] ?? parsed.type)} <code>${esc(parsed.key)}</code> versão ${esc(parsed.version)}.</p>`;
          report('Manifesto válido.');
        }
      });
      bindSubmit(formElement, async () => {
        try {
          const created = await adminService.installer.install(manifest());
          report(`Extensão "${created?.title ?? ''}" instalada (desabilitada).`);
          await navigate(link('/installer'));
        } catch (error) { report(extensionErrorMessage(error, 'Não foi possível instalar a extensão.')); }
      });
    };
    return { html, bind };
  }

  async function renderPage(location) {
    const path = location.path;
    if (path === '/config') return configPage();
    const modules = adminService.moduleInstances?.catalog && adminService.moduleInstances?.batch;
    if (modules && path === '/moduleInstances') return moduleListPage(location);
    if (modules && path === '/moduleInstances/select') return moduleTypeSelectPage();
    const moduleMatch = path.match(/^\/moduleInstances\/(new|\d+)$/);
    if (modules && moduleMatch) return moduleEditPage(location, moduleMatch[1]);
    if (modules && path === '/templates/positions') return positionsPage(location);
    if (adminService.plugins?.list && adminService.plugins.available !== false) {
      if (path === '/plugins') return pluginListPage(location);
      const match = path.match(/^\/plugins\/(\d+)$/);
      if (match) return pluginEditPage(match[1]);
    }
    if (adminService.templateStyles?.list) {
      if (path === '/templates/styles') return styleListPage(location);
      const match = path.match(/^\/templates\/styles\/([a-z0-9][a-z0-9_-]{0,80})$/i);
      if (match) return styleEditPage(match[1]);
    }
    if (adminService.componentOptions?.list) {
      if (path === '/options') return optionsListPage();
      const match = path.match(/^\/options\/([a-z]+)$/);
      if (match) return optionsEditPage(match[1]);
    }
    if (adminService.installer?.list && path === '/installer') return installerPage(location);
    return null;
  }

  async function render(location) {
    try { return await renderPage(location); }
    catch (error) {
      if (error?.name !== 'ValidationError') {
        return { html: page(null, 'Falha no carregamento', [{ label: 'Falha no carregamento' }], '<p role="alert">Não foi possível carregar os dados administrativos. Recarregue antes de tentar novamente.</p><p>Se você acabou de executar uma ação, verifique o registro após recarregar antes de repeti-la.</p>') };
      }
      return { html: page(null, 'Configuração inválida', [{ label: 'Configuração inválida' }], `<p role="alert">${esc(error.message)}</p><p>Repare a configuração persistida antes de tentar novamente. Nenhum dado foi alterado.</p>`) };
    }
  }

  return { render };
}

export const EXTENSION_OVERVIEW_ITEMS = Object.freeze([
  { key: 'plugins', label: 'Plugins', route: '/plugins', icon: pluginIcon, count: 'plugins' },
  { key: 'templateStyles', label: 'Estilos de template', route: '/templates/styles', icon: desktopIcon },
  { key: 'installer', label: 'Gerenciar extensões', route: '/installer', icon: moduleIcon },
  { key: 'componentOptions', label: 'Opções dos componentes', route: '/options', icon: configIcon }
]);
