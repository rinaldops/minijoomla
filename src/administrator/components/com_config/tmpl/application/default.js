import { defaultConfig } from '../../../../../libraries/minijoomla/core/config.js';
import { SITE_CONFIG_FIELDS } from '../../../com_minijoomla/field-schemas.js';
import { renderAdminForm } from '../../../com_minijoomla/render-form.js';

const CONFIG_OPTION_LABELS = {
  homeView: [{ value: 'category', label: 'Categoria (blog da categoria)' }, { value: 'featured', label: 'Artigos em destaque' }],
  robots: [{ value: '', label: 'Padrão do navegador' }, ...['index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow'].map((value) => ({ value, label: value }))],
  sitenamePagetitles: [{ value: 'none', label: 'Não' }, { value: 'before', label: 'Antes' }, { value: 'after', label: 'Depois' }]
};

export function renderConfigPage(record, link, templates = [], shell) {
  const builtins = ['default', 'cassiopeia', 'camap'];
  const choices = new Map(builtins.map((key) => [key, { value: key, label: `${key} (integrado)` }]));
  templates.filter((template) => template.enabled && !builtins.includes(template.key)).forEach((template) => choices.set(template.key, { value: template.key, label: template.title }));
  if (record?.templateKey && !choices.has(record.templateKey)) choices.set(record.templateKey, { value: record.templateKey, label: `${record.templateKey} (atual — indisponível)` });
  const form = renderAdminForm({ formId: 'site-config', fields: SITE_CONFIG_FIELDS, values: { ...defaultConfig, sitenamePagetitles: 'none', ...record, templateKey: record?.templateKey || 'default' }, relationOptions: { templateKey: [...choices.values()], ...CONFIG_OPTION_LABELS }, submitLabel: 'Salvar configuração', cancelHref: link('/') });
  const bodyHtml = `<p>Metadados e SEO indisponíveis: não há contrato para alterar os metadados globais do host. Valores existentes são somente leitura e serão preservados.</p><p role="status" aria-live="polite" aria-atomic="true" class="admin-form-status"></p>${form}`;
  return shell({ activeKey: 'config', pageTitle: 'Configuração do site', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Configuração' }], bodyHtml, link });
}
