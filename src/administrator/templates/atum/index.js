/*
 * Casca visual do painel administrativo (header + sidebar + toolbar),
 * reconstruída para parecer com a ESTRUTURA REAL do administrator/ do
 * Joomla (template Atum) — ver
 * web-devs/JOOMLA/administrator/modules/mod_menu/tmpl/default_submenu.php
 * e scss/blocks/_sidebar.scss/_sidebar-nav.scss. A sidebar real do
 * Joomla é uma ÁRVORE COLAPSÁVEL (cada seção — "Conteúdo", "Menus",
 * "Componentes", "Sistema" — é um item de nível 1 com seta que expande
 * para revelar os itens de nível 2 recuados), nunca uma lista plana de
 * domínios no mesmo nível — esse foi um achado real de divergência
 * estrutural confirmado pelo usuário comparando com um Joomla 6.2.0 real
 * (não só diferença de cor/tom, que já tinha sido corrigida antes).
 * Nunca uma cópia literal de PHP/SCSS: HTML/CSS próprios reconstruindo o
 * mesmo vocabulário de layout.
 *
 * Puro: recebe dados já resolvidos (nenhum state, nenhum DOM) e devolve
 * uma string HTML — mesmo princípio de render-form.js/render-list.js.
 * Quem monta `sidebarGroups`/`breadcrumbItems`/`toolbarActionsHtml` é
 * src/administrator/components/com_minijoomla/app.js, que conhece as rotas e os domínios; este módulo não
 * sabe o que é "um domínio administrável", só sabe desenhar a casca.
 * A expansão/colapso de cada grupo (`bindSidebarGroups`) é responsabilidade
 * de quem monta a tela, nunca deste módulo puro.
 */
import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';
import { brandIcon, chevronIcon } from '../../components/com_minijoomla/icons.js';

function renderSidebarLeaf(item, activeKey) {
  const isActive = item.key === activeKey;
  return `<li class="item"><a href="${safeUrl(item.href)}"${isActive ? ' aria-current="page"' : ''}>${item.icon ?? ''}<span class="sidebar-item-title">${escapeHtml(item.label)}</span></a></li>`;
}

/*
 * `sidebarGroups`: `[{ key, label, icon, items: [{ key, label, href, icon }] }]`
 * — cada grupo de nível 1 (equivalente a "Conteúdo"/"Menus"/
 * "Componentes"/"Sistema" do menu real). Um grupo com exatamente um
 * `items` e `href` próprio (sem sub-itens, ex.: "Painel de controle")
 * renderiza como item simples, sem seta nem expansão — mesma regra do
 * Joomla real (itens de nível 1 sem filhos, como "Painel de Controle",
 * não têm `has-arrow`). `activeGroupKey` expande o grupo que contém a
 * rota atual mesmo antes de qualquer clique do usuário.
 */
function renderSidebarGroup(group, activeKey, activeGroupKey) {
  if (!Array.isArray(group.items) || group.items.length === 0) {
    return renderSidebarLeaf({ key: group.key, label: group.label, href: group.href, icon: group.icon }, activeKey);
  }
  const isExpanded = group.key === activeGroupKey;
  const isGroupActive = group.items.some((item) => item.key === activeKey);
  const leaves = group.items.map((item) => renderSidebarLeaf(item, activeKey)).join('');
  return `<li class="item parent${isGroupActive ? ' mm-active' : ''}"><a href="#" class="has-arrow" data-admin-sidebar-group="${escapeHtml(group.key)}" aria-expanded="${isExpanded ? 'true' : 'false'}">${group.icon ?? ''}<span class="sidebar-item-title">${escapeHtml(group.label)}</span>${chevronIcon()}</a><ul class="mm-collapse${isExpanded ? ' mm-show' : ''}">${leaves}</ul></li>`;
}

function renderBreadcrumb(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  const parts = list.map((item, index) => {
    const isLast = index === list.length - 1;
    const label = escapeHtml(item.label);
    return item.href && !isLast ? `<a href="${safeUrl(item.href)}">${label}</a>` : `<span${isLast ? ' aria-current="page"' : ''}>${label}</span>`;
  });
  return `<p class="admin-breadcrumb">${parts.join(' <span aria-hidden="true">/</span> ')}</p>`;
}

/*
 * `sidebarGroups`: ver renderSidebarGroup acima.
 * `activeKey`: o item de nível 2 (ou grupo sem filhos) correspondente à
 * rota atual.
 * `breadcrumbItems`: `[{ label, href? }]`; o último item nunca tem link
 * (representa a página atual).
 * `toolbarActionsHtml`: HTML já pronto dos botões de ação da tela atual
 * (ex.: "+ Novo", "Cancelar") — este módulo só posiciona, nunca decide
 * quais botões existem.
 */
export function renderAdminShell({ activeKey, pageTitle, breadcrumbItems = [], toolbarActionsHtml = '', sidebarGroups = [], bodyHtml = '' } = {}) {
  const activeGroup = sidebarGroups.find((group) => Array.isArray(group.items) && group.items.some((item) => item.key === activeKey));
  const sidebar = sidebarGroups.map((group) => renderSidebarGroup(group, activeKey, activeGroup?.key)).join('');
  const breadcrumb = renderBreadcrumb(breadcrumbItems);
  return `<div class="admin-shell"><header class="admin-header"><button type="button" class="admin-sidebar-toggle" data-admin-sidebar-toggle aria-expanded="false" aria-controls="admin-sidebar" aria-label="Abrir/fechar menu de navegação"><svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/></svg></button><a class="admin-header-brand" href="#/">${brandIcon()}<span>MINIJOOMLA</span></a><span class="admin-header-meta">Administração</span></header><div class="admin-body"><nav id="admin-sidebar" class="admin-sidebar" aria-label="Administração"><ul class="admin-sidebar-list main-nav">${sidebar}</ul></nav><main class="admin-main"><div class="admin-toolbar"><div>${breadcrumb}<h1>${escapeHtml(pageTitle ?? '')}</h1></div><div class="admin-toolbar-actions">${toolbarActionsHtml}</div></div><div class="admin-page"><div class="admin-page-inner">${bodyHtml}</div></div></main></div></div>`;
}
