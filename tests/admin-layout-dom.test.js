import { renderAdminList } from '../src/administrator/components/com_minijoomla/render-list.js';
import { articleIcon } from '../src/administrator/components/com_minijoomla/icons.js';
import { MODULE_INSTANCE_COUNT_DESCRIPTION, renderModuleInstanceHelp } from '../src/administrator/components/com_minijoomla/extension-pages.js';

// Native-browser layout acceptance. No routing, tenant requests or content writes.
// Call against the mounted overview/list, in addition to the Node CSS contracts.
const layoutRect = (node) => node.getBoundingClientRect();
const layoutFits = (inner, outer) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;

export function inspectAdminListLayout(root) {
  const checks = [];
  const check = (condition, name) => checks.push({ name, ok: !!condition });
  const table = root.querySelector('.admin-list');
  check(table, 'list-mounted');
  if (!table) return { success: false, checks };
  check(root.scrollWidth <= root.clientWidth + 1, 'list-root-contained');
  const buttons = [...table.querySelectorAll('.admin-col-action .admin-btn')];
  check(buttons.length, 'list-actions-present');
  for (const button of buttons) {
    const style = root.ownerDocument.defaultView.getComputedStyle(button);
    check(style.whiteSpace === 'nowrap' && style.overflowWrap === 'normal', 'action-caption-not-broken-into-letters');
    check(layoutFits(layoutRect(button), layoutRect(button.closest('td'))), 'action-fits-own-cell');
    const lineHeight = Number.parseFloat(style.lineHeight);
    const chromeHeight = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((total, name) => total + Number.parseFloat(style[name]), 0);
    const minimumHeight = Number.parseFloat(style.minHeight) || 0;
    check(layoutRect(button).height <= Math.max(minimumHeight, lineHeight + chromeHeight) + 1, 'action-height-is-single-line-control');
    const range = root.ownerDocument.createRange();
    const caption = [...button.childNodes].find((node) => node.nodeType === 3 && node.textContent.trim());
    check(caption, 'action-caption-present');
    if (caption) {
      range.selectNodeContents(caption);
      check(range.getClientRects().length === 1, 'short-action-caption-single-line');
      check(layoutFits(range.getBoundingClientRect(), layoutRect(button)), 'action-caption-contained-in-button');
    }
  }
  return { success: checks.every((entry) => entry.ok), checks, actions: buttons.length };
}

export function inspectAdminOverviewLayout(root) {
  const checks = [];
  const check = (condition, name) => checks.push({ name, ok: !!condition });
  const cards = [...root.querySelectorAll('.admin-overview li')];
  check(cards.length, 'overview-cards-present');
  check(root.scrollWidth <= root.clientWidth + 1, 'overview-root-contained');
  for (const card of cards) {
    const link = card.querySelector('a');
    const label = link?.querySelector('.admin-overview-label');
    const svg = link?.querySelector('.admin-overview-icon > svg');
    if (!link || !label || !svg) { check(false, 'overview-card-structure'); continue; }
    const rect = layoutRect(card);
    check(layoutFits(layoutRect(link), rect) && layoutFits(layoutRect(label), rect), 'overview-link-label-contained');
    const labelRange = root.ownerDocument.createRange();
    labelRange.selectNodeContents(label);
    const labelLines = [...labelRange.getClientRects()];
    check(labelLines.length > 0 && labelLines.every((line) => layoutFits(line, layoutRect(link))), 'overview-label-text-lines-contained');
    check(layoutRect(link).width >= rect.width - 3 && layoutRect(link).height >= rect.height - 3, 'overview-link-fills-card');
    const count = link.querySelector('.admin-overview-count');
    const iconRect = layoutRect(svg);
    const size = Number.parseFloat(root.ownerDocument.defaultView.getComputedStyle(root.ownerDocument.documentElement).fontSize) * 2;
    check(Math.abs(iconRect.width - size) <= 1 && Math.abs(iconRect.height - size) <= 1, 'overview-svg-uses-quickicon-size');
    check(layoutRect(label).top >= iconRect.bottom - 1, 'overview-name-below-info-row');
    if (count) {
      const countRect = layoutRect(count);
      check(countRect.left >= iconRect.right - 1 && countRect.bottom <= iconRect.bottom + 1, 'overview-count-beside-icon');
      check(layoutFits(countRect, layoutRect(link)), 'overview-count-contained-in-link');
    }
    if (['Módulos do site', 'Extensões registradas'].includes(label.textContent.trim())) {
      check(count && link.getAttribute('aria-label')?.startsWith(`${label.textContent.trim()}: ${count.textContent.trim()}. `)
        && link.getAttribute('title'), 'overview-saved-count-accessible-name');
      if (label.textContent.trim() === 'Módulos do site') {
        check(link.getAttribute('title') === MODULE_INSTANCE_COUNT_DESCRIPTION
          && link.getAttribute('aria-describedby') === 'admin-module-instance-help', 'overview-module-count-is-saved-instances');
      }
    }
  }
  const help = root.querySelector('#admin-module-instance-help');
  const semanticCards = cards.filter((card) => ['Módulos do site', 'Extensões registradas'].includes(card.querySelector('.admin-overview-label')?.textContent.trim()));
  if (semanticCards.length) {
    check(semanticCards.length === 2, 'overview-distinguishes-instances-and-extension-registry');
    check(help?.getAttribute('role') === 'note' && help.textContent.includes('Módulo é um tipo de extensão. O card Módulos do site conta instâncias salvas, não tipos habilitados.'), 'overview-instance-explanation-visible');
    if (help) {
      const style = root.ownerDocument.defaultView.getComputedStyle(help);
      check(style.display !== 'none' && style.visibility !== 'hidden' && !help.hidden
        && layoutFits(layoutRect(help), layoutRect(root)), 'overview-instance-help-contained');
      const links = [...help.querySelectorAll('a')];
      check(links.some((link) => link.textContent === 'Criar módulo' && link.getAttribute('href') === '#/moduleInstances/new')
        && links.some((link) => link.textContent === 'Configurar posição e páginas' && link.getAttribute('href') === '#/moduleInstances'), 'overview-module-create-and-location-links');
      for (const link of links) {
        const range = root.ownerDocument.createRange();
        range.selectNodeContents(link);
        const lines = [...range.getClientRects()];
        check(lines.length > 0 && lines.every((line) => layoutFits(line, layoutRect(help))), 'overview-help-link-text-contained');
      }
    }
  }
  return { success: checks.every((entry) => entry.ok), checks, cards: cards.length };
}

export function runAdminLayoutFixtureTests(documentRef = globalThis.document) {
  const host = documentRef.createElement('div');
  host.setAttribute('data-minijoomla-admin-root', 'layout-fixture');
  host.style.width = `${Math.max(200, Math.min(865, documentRef.documentElement.clientWidth - 40))}px`;
  const list = renderAdminList({
    rows: [{ id: 1, title: 'Curto', alias: 'curto' }], columns: ['title', 'alias'], editHref: () => '#/articles/1',
    rowActions: () => '<button type="button" class="admin-btn">Publicar</button><button type="button" class="admin-btn">Arquivar</button>'
  });
  const cards = [
    { label: 'Artigos', href: '#/articles', count: 123456 },
    { label: 'Módulos do site', href: '#/moduleInstances', count: 0, description: MODULE_INSTANCE_COUNT_DESCRIPTION },
    { label: 'Extensões registradas', href: '#/extensions', count: 123456, description: 'Registros de módulos e plugins, habilitados ou desabilitados.' },
    { label: 'Opções de componentes com um nome propositalmente comprido para testar reflow', href: '#/options', count: 123456 }
  ].map(({ label, href, count, description }) => `<li><a href="${href}"${description ? ` title="${description}" aria-label="${label}: ${count}. ${description}"${label === 'Módulos do site' ? ' aria-describedby="admin-module-instance-help"' : ''}` : ''}><span class="admin-overview-icon">${articleIcon()}</span><span class="admin-overview-count">${count}</span><span class="admin-overview-label">${label}</span></a></li>`).join('');
  host.innerHTML = `<div class="admin-shell"><div class="admin-page-inner">${list}<ul class="admin-overview">${cards}</ul>${renderModuleInstanceHelp((path) => `#${path}`)}</div></div>`;
  // Give the short-title fixture a known table width; its wrapper still scrolls
  // at small viewports. Long-title wrapping must not be mistaken for this bug.
  host.querySelector('.admin-list').style.minWidth = '36rem';
  documentRef.body.append(host);
  try {
    const result = inspectAdminListLayout(host);
    const overview = inspectAdminOverviewLayout(host);
    const row = host.querySelector('.admin-list tbody tr');
    const title = row.querySelector('th[scope="row"] a');
    const edit = row.querySelector('.admin-col-action a');
    const titleSemantics = !!title && title.getAttribute('href') === edit.getAttribute('href')
      && title.getAttribute('aria-label') === 'Editar: Curto' && edit.getAttribute('aria-label') === 'Editar: Curto';
    const cell = row.querySelector('td');
    const style = documentRef.defaultView.getComputedStyle(cell);
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const actionHeight = Math.max(...[...row.querySelectorAll('.admin-btn')].map((button) => layoutRect(button).height));
    const compact = layoutRect(row).height <= actionHeight + padding + 8;
    return { success: result.success && overview.success && compact && titleSemantics, list: result, overview, compactShortRow: compact, titleSemantics };
  } finally { host.remove(); }
}
