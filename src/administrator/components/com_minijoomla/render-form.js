/*
 * Renderização de formulário genérico de admin, parametrizada por
 * field-schemas.js (ARTICLE_FIELDS etc.). Puro: recebe um objeto `values`
 * e devolve HTML; não lê/escreve DOM nem estado por si só — o DOM
 * listener (bind de submit/leitura do FormData) é responsabilidade de
 * quem monta a tela (src/administrator/components/com_minijoomla/app.js), seguindo o mesmo padrão já usado
 * pelo formulário de busca público (src/components/com_finder/tmpl/search/default.js: o
 * componente só sabe renderizar, src/index.js é quem liga o evento de
 * submit real).
 *
 * Acessibilidade: cada campo tem `<label for>` associado (mesmo padrão
 * já usado pelo formulário de busca público), id previsível
 * (`admin-field-<formId>-<name>`) para suportar múltiplos formulários na
 * mesma página sem colisão de id.
 *
 * Campos relacionais (field.relation em field-schemas.js, ex.: categoria
 * de um artigo, extensão de uma instância de módulo): este módulo não
 * sabe o que é "outro domínio" — quem monta a tela (app.js) já resolveu
 * as opções reais (lista de `{ value, label }`) e passa em
 * `relationOptions[field.name]`, igual ao padrão já usado pelo resto do
 * projeto de nunca deixar um componente de apresentação decidir dados.
 *
 * Abas (field.tab em field-schemas.js, hoje só em SITE_CONFIG_FIELDS —
 * equivalente visual às abas "Site"/"Sistema" do com_config real do
 * Joomla): quando NENHUM campo declara `tab`, o formulário continua
 * plano (sem nenhum wrapper novo), preservando a saída de todo
 * formulário existente antes desta funcionalidade. Só quando pelo menos
 * um campo declara `tab` é que os campos são agrupados em
 * `role="tablist"`/`role="tabpanel"` (ARIA Tabs padrão, sem framework);
 * a troca de aba visível é responsabilidade de quem monta a tela
 * (app.js: bindTabHandlers), nunca deste módulo puro.
 *
 * `field.type === 'richtext'` (field-schemas.js): renderiza exatamente
 * como `'textarea'`, só adicionando `data-admin-richtext` — o atributo
 * é o único sinal que este módulo emite; ligar um editor TinyMCE real
 * por cima (src/administrator/components/com_minijoomla/editor.js) é responsabilidade de quem monta a
 * tela (app.js: bindRichTextEditors), nunca deste módulo puro, mesmo
 * principio das abas acima. `field.readMoreButton: true` (só em
 * ARTICLE_FIELDS.articletext) soma o atributo `data-admin-readmore`,
 * sinal para app.js montar o editor com o botão real "Leia mais" —
 * mesmo princípio de nenhuma decisão de editor nascer aqui.
 */
import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';
import { saveIcon, closeIcon } from './icons.js';

function fieldId(formId, name) { return `admin-field-${formId}-${name}`; }

function slugify(text) { return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tab'; }

/*
 * Campos sem `tab` entram na PRIMEIRA aba declarada na lista (nunca na
 * aba mais próxima anterior) — mesma regra documentada em
 * field-schemas.js, para não exigir que todo campo marque `tab`
 * explicitamente quando só uma aba real existe.
 */
function groupFieldsByTab(fields) {
  const firstTabName = fields.find((field) => field.tab)?.tab;
  if (firstTabName === undefined) return null;
  const order = [];
  const byTab = new Map();
  for (const field of fields) {
    const tabName = field.tab ?? firstTabName;
    if (!byTab.has(tabName)) { byTab.set(tabName, []); order.push(tabName); }
    byTab.get(tabName).push(field);
  }
  return order.map((tabName) => ({ tabName, fields: byTab.get(tabName) }));
}

function selectOptionsHtml(field, relationOptions, selectedValues) {
  const isSelected = (optionValue) => selectedValues.some((value) => String(value) === String(optionValue));
  const emptyOption = field.emptyOptionLabel ? [`<option value=""${isSelected('') ? ' selected' : ''}>${escapeHtml(field.emptyOptionLabel)}</option>`] : [];
  const relationList = Array.isArray(relationOptions) ? relationOptions : [];
  const plainOptions = Array.isArray(field.options) ? field.options : [];
  const optionTags = relationList.length
    ? relationList.map((option) => `<option value="${escapeHtml(String(option.value))}"${isSelected(option.value) ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
    : plainOptions.map((option) => `<option value="${escapeHtml(option)}"${isSelected(option) ? ' selected' : ''}>${escapeHtml(option || '(nenhuma)')}</option>`);
  return [...emptyOption, ...optionTags].join('');
}

function renderField(formId, field, value, relationOptions) {
  const id = fieldId(formId, field.name);
  const label = `<label for="${id}">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>`;
  const common = `id="${id}" name="${escapeHtml(field.name)}"${field.required ? ' required' : ''}${field.readOnly ? ' readonly disabled' : ''}`;
  if (field.type === 'textarea' || field.type === 'richtext') {
    const richtextAttr = field.type === 'richtext' ? ' data-admin-richtext' : '';
    const readMoreAttr = field.type === 'richtext' && field.readMoreButton ? ' data-admin-readmore' : '';
    return `<div class="admin-field">${label}<textarea ${common}${richtextAttr}${readMoreAttr} rows="4">${escapeHtml(value ?? '')}</textarea></div>`;
  }
  if (field.type === 'checkbox') return `<div class="admin-field admin-field-checkbox"><input type="checkbox" ${common} ${value ? 'checked' : ''}>${label}</div>`;
  if (field.type === 'multiselect') {
    const selectedValues = Array.isArray(value) ? value : typeof value === 'string' && value ? value.split(',').map((item) => item.trim()) : [];
    return `<div class="admin-field">${label}<select ${common} multiple size="5">${selectOptionsHtml(field, relationOptions, selectedValues)}</select></div>`;
  }
  if (field.type === 'select') {
    return `<div class="admin-field">${label}<select ${common}>${selectOptionsHtml(field, relationOptions, [value ?? ''])}</select></div>`;
  }
  const inputType = field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : 'text';
  return `<div class="admin-field">${label}<input type="${inputType}" ${common} value="${escapeHtml(value ?? '')}"></div>`;
}

/*
 * `formId`: identificador estável do formulário (usado nos ids de campo
 * e no atributo `data-admin-form`, para quem monta a tela localizar o
 * `<form>` no DOM real sem depender de um seletor por posição).
 * `values`: objeto { [field.name]: valor } — tipicamente o registro
 * atual em edição, ou `{}` para "novo".
 * `submitLabel`: texto do botão de confirmação (varia entre "Criar" e
 * "Salvar").
 * `relationOptions`: `{ [field.name]: [{ value, label }] }` — só para
 * campos com `field.relation`; ver cabeçalho do arquivo.
 */
export function renderAdminForm({ formId, fields, values = {}, submitLabel = 'Salvar', cancelHref, relationOptions = {} } = {}) {
  const fieldList = Array.isArray(fields) ? fields : [];
  const cancel = cancelHref ? `<a class="admin-btn admin-btn-ghost admin-form-cancel" href="${safeUrl(cancelHref)}">${closeIcon()}Cancelar</a>` : '';
  const actions = `<div class="admin-form-actions"><button type="submit" class="admin-btn admin-btn-success">${saveIcon()}${escapeHtml(submitLabel)}</button>${cancel}</div>`;
  const tabGroups = groupFieldsByTab(fieldList);
  if (!tabGroups) {
    const inputs = fieldList.map((field) => renderField(formId, field, values[field.name], relationOptions[field.name])).join('');
    return `<form class="admin-form" data-admin-form="${escapeHtml(formId)}">${inputs}${actions}</form>`;
  }
  const tabs = tabGroups.map(({ tabName }, index) => {
    const tabId = `admin-tab-${formId}-${slugify(tabName)}`;
    return `<button type="button" role="tab" id="${tabId}-label" aria-controls="${tabId}-panel" aria-selected="${index === 0 ? 'true' : 'false'}" data-admin-tab-button tabindex="${index === 0 ? '0' : '-1'}">${escapeHtml(tabName)}</button>`;
  }).join('');
  const panels = tabGroups.map(({ tabName, fields: tabFields }, index) => {
    const tabId = `admin-tab-${formId}-${slugify(tabName)}`;
    const inputs = tabFields.map((field) => renderField(formId, field, values[field.name], relationOptions[field.name])).join('');
    return `<div role="tabpanel" id="${tabId}-panel" aria-labelledby="${tabId}-label" data-admin-tab-panel${index === 0 ? '' : ' hidden'}>${inputs}</div>`;
  }).join('');
  return `<form class="admin-form" data-admin-form="${escapeHtml(formId)}"><div class="admin-tabs" role="tablist">${tabs}</div>${panels}${actions}</form>`;
}

/*
 * Lê os valores atuais de um `<form data-admin-form>` já renderizado por
 * renderAdminForm, convertendo cada campo para o tipo de domínio
 * esperado por admin-service.js (number/boolean/string/array) — a
 * validação de forma (obrigatório, enum) continua só em
 * admin-service.js; esta função só traduz tipos de input HTML para
 * valores JS primitivos.
 *
 * `field.valueType === 'number'`: um `<select>` relacional cujo valor
 * persistido é numérico (ex.: categoryId) — o próprio elemento é
 * `type="select-one"`, não `type="number"`, então essa conversão não
 * pode depender de `field.type` como os demais ramos.
 * `field.type === 'multiselect'`: lê `selectedOptions` (API nativa de
 * `<select multiple>`) em vez de `.value`, devolvendo um array — nunca
 * uma string separada por vírgula, que é responsabilidade exclusiva de
 * admin-service.js (fronteira de persistência).
 */
export function readAdminFormValues(formElement, fields) {
  const result = {};
  for (const field of Array.isArray(fields) ? fields : []) {
    const input = formElement.querySelector?.(`[name="${field.name}"]`);
    if (!input) continue;
    if (field.type === 'checkbox') result[field.name] = Boolean(input.checked);
    else if (field.type === 'multiselect') result[field.name] = Array.from(input.selectedOptions ?? []).map((option) => option.value).filter((value) => value !== '');
    else if (field.type === 'number' || field.valueType === 'number') result[field.name] = input.value === '' ? null : Number(input.value);
    else result[field.name] = input.value ?? '';
  }
  return result;
}
