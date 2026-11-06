import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';

export const MODULE_POSITIONS = Object.freeze(['topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer', 'sidebar', 'content']);

export const ADMIN_CAPABILITIES = Object.freeze({
  extensions: { label: 'Extensões', supports: ['Module', 'Plugin', 'Ativar/desativar', 'Registro de manifestos já publicados'], excludes: ['Instalação/upload de código', 'Parâmetros de plugin sem contrato persistido'] },
  templates: { label: 'Templates', supports: ['Catálogo separado', 'Ativar/desativar', 'Template padrão via configuração do site', 'Posições e folhas de estilo'], excludes: ['Editor de arquivos PHP/CSS', 'Atribuição por item de menu'] },
  moduleInstances: { label: 'Módulos do site', supports: ['Instâncias', 'Módulo nativo de busca (search)', 'Posição e ordem', 'Configuração JSON', 'Escopo por rota/categoria', 'Ativar/desativar'], excludes: ['ACL', 'Agendamento sem backend'] }
});

export function renderCapabilities(domain) {
  const capability = ADMIN_CAPABILITIES[domain];
  if (!capability) return '';
  return `<details class="admin-capabilities"><summary>Capacidades disponíveis — ${escapeHtml(capability.label)}</summary><p>${capability.supports.map(escapeHtml).join(' · ')}</p><p>Não disponível: ${capability.excludes.map(escapeHtml).join(' · ')}.</p></details>`;
}

export function managementFilters(domain, params = {}) {
  if (!ADMIN_CAPABILITIES[domain]) return [];
  const filters = [{ name: 'enabled', label: 'Estado', value: params.enabled, options: [['', 'Todos os estados'], ['true', 'Habilitados'], ['false', 'Desabilitados']] }];
  if (domain === 'extensions') filters.unshift({ name: 'type', label: 'Tipo', value: params.type, options: [['', 'Module / Plugin'], ['Module', 'Module'], ['Plugin', 'Plugin']] });
  if (domain === 'moduleInstances') filters.push({ name: 'position', label: 'Posição', value: params.position, options: [['', 'Todas as posições'], ...MODULE_POSITIONS.map((position) => [position, position])] });
  return filters;
}

export function filterManagementRows(domain, rows, params = {}) {
  if (!ADMIN_CAPABILITIES[domain]) return rows;
  return rows.filter((row) =>
    (!['true', 'false'].includes(params.enabled) || Boolean(row.enabled) === (params.enabled === 'true')) &&
    (domain !== 'extensions' || !['Module', 'Plugin'].includes(params.type) || row.type === params.type) &&
    (domain !== 'moduleInstances' || !params.position || row.position === params.position));
}

export function renderManagementActions(domain, row) {
  if (!ADMIN_CAPABILITIES[domain]) return '';
  const id = Number(row.id);
  if (!Number.isSafeInteger(id) || id < 1 || !row.etag) return '';
  const label = row.enabled ? 'Desativar' : 'Ativar';
  const toggle = row.isDefault ? '' : `<button type="button" class="admin-btn admin-btn-ghost" data-admin-managed-action="toggle" data-admin-row-id="${id}" aria-label="${label} ${escapeHtml(row.title)}">${label}</button>`;
  const defaultAction = domain !== 'templates' ? '' : row.isDefault
    ? '<span class="admin-template-default">Padrão</span>'
    : row.enabled ? `<button type="button" class="admin-btn admin-btn-ghost" data-admin-managed-action="default" data-admin-row-id="${id}" aria-label="Definir ${escapeHtml(row.title)} como padrão">Tornar padrão</button>` : '';
  return toggle + defaultAction;
}

export function renderNativeComponents(link) {
  const components = [
    ['Conteúdo', '/articles', 'Listar, criar, editar e excluir artigos.'],
    ['Categorias', '/categories', 'Organização hierárquica de conteúdo.'],
    ['Tags', '/tags', 'Classificação e estado das tags.'],
    ['Menus', '/menu', 'Itens, caminhos, hierarquia e ordem.'],
    ['Busca', '/config', 'Componente público de busca; configuração global de página.'],
    ['Módulos', '/moduleInstances', 'Instâncias configuradas e atribuídas a posições/rotas.']
  ];
  return `<p>Componentes nativos incluídos na aplicação. Não há instalação dinâmica de código, ACL ou gestão de usuários neste painel; extensões já publicadas são registradas por manifesto declarativo em <a href="${escapeHtml(link('/installer'))}">Gerenciar extensões</a> e as opções de cada componente ficam em <a href="${escapeHtml(link('/options'))}">Opções</a>.</p><ul class="admin-component-catalog">${components.map(([title, route, description]) => `<li><h2><a href="${escapeHtml(link(route))}">${escapeHtml(title)}</a></h2><p>${escapeHtml(description)}</p><code>${escapeHtml(route)}</code></li>`).join('')}</ul>`;
}
