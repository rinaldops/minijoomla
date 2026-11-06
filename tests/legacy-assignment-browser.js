import { createExtensionPages } from '../src/administrator/components/com_minijoomla/extension-pages.js';

// Real DOM and computed geometry with synthetic, read-only services. Scripted
// clicks exercise bound handlers, not trusted keyboard/visual/tenant acceptance.
export async function runLegacyAssignmentBrowserTests(documentRef = document) {
  const checks = []; const check = (ok, name) => checks.push({ name, ok: !!ok });
  const host = documentRef.createElement('div'); host.className = 'admin-shell';
  let writes = 0; let submits = 0; let navigations = 0;
  const prevent = (event) => { submits++; event.preventDefault(); event.stopImmediatePropagation(); };
  host.addEventListener('submit', prevent, true); documentRef.body.append(host);
  const row = { id: 1, etag: '"local"', title: 'Legacy fixture', extensionKey: 'search', position: 'search', settingsJson: '{}', scopeKind: 'Route', scopeRoute: 'home' };
  const snapshot = JSON.stringify(row);
  const pages = createExtensionPages({ documentRef: { body: host }, router: { link: (path) => `#${path}`, navigate: () => { navigations++; } }, shell: ({ bodyHtml }) => `<div class="admin-page-inner">${bodyHtml}</div>`,
    adminService: { moduleInstances: {
      get: async () => row, catalog: async () => [{ key: 'search', title: 'Search', params: [] }], positions: async () => ({ template: 'cassiopeia', positions: ['search'], all: ['search'] }),
      update: async () => { writes++; throw Error('Read-only fixture'); },
      batch: async () => { writes++; throw Error('Read-only fixture'); }
    }, menu: { available: false }, categories: { available: false } }
  });
  const render = async () => {
    const page = await pages.render({ path: '/moduleInstances/1' }); host.innerHTML = page.html;
    if (!page.bind) throw Error('Legacy browser form missing'); page.bind();
    // Reveal the assignment panel without presenting this as native tab input.
    for (const panel of host.querySelectorAll('[data-admin-tab-panel]')) panel.hidden = !panel.id.includes('-assignment-');
  };
  try {
    await render();
    const apply = host.querySelector('[data-ext-legacy-apply]'); const restore = host.querySelector('[data-ext-legacy-restore]');
    const assignment = host.querySelector('[name="assignment"]'); const token = host.querySelector('[name="assignmentToken"][value="route:home"]');
    const status = host.querySelector('[data-ext-legacy-status]');
    check(apply?.type === 'button' && restore?.type === 'button', 'legacy-controls-do-not-submit');
    check(status?.getAttribute('aria-live') === 'polite' && apply?.getAttribute('aria-describedby') === status?.id, 'legacy-status-associated-live-region');
    check(assignment?.value === '', 'legacy-initial-preserves-scope');
    const controls = [apply, restore];
    check(controls.every((control) => {
      const rect = control?.getBoundingClientRect(); const style = control && getComputedStyle(control);
      return rect?.width > 0 && rect.height > 0 && rect.left >= -1 && rect.right <= innerWidth + 1 && style.visibility !== 'hidden';
    }), 'legacy-controls-visible-contained');
    check(documentRef.documentElement.scrollWidth <= innerWidth + 1, 'legacy-form-no-document-overflow');
    apply.click();
    check(assignment.value === 'only' && token.checked && host.querySelectorAll('[name="assignmentToken"]:checked').length === 1, 'legacy-scripted-apply-exact-route');
    host.querySelector('[name="title"]').value = 'Edited locally';
    restore.click();
    check(assignment.value === '' && !token.checked && host.querySelector('[name="title"]').value === 'Edited locally', 'legacy-scripted-restore-keeps-other-edits');
    assignment.value = 'except'; apply.click();
    check(assignment.value === 'except' && status.textContent.includes('foi editada'), 'legacy-scripted-apply-does-not-overwrite-manual-edit');
    restore.click(); token.remove(); apply.click();
    check(assignment.value === '' && status.textContent.includes('não está disponível'), 'legacy-negative-missing-token-refuses-apply');
    row.scopeRoute = 'category'; row.scopeCategoryAlias = 'news'; await render();
    check(!host.querySelector('[data-ext-legacy-apply]') && host.textContent.includes('seleções atuais usam OU, não E'), 'legacy-category-intersection-no-action');
    delete row.scopeCategoryAlias; row.scopeRoute = 'home'; row.assignment = 'only'; row.assignmentJson = '["route:home"]'; await render();
    check(!host.querySelector('[data-ext-legacy-apply]'), 'legacy-modern-record-no-conversion');
    delete row.assignment; delete row.assignmentJson;
    check(writes === 0 && submits === 0 && navigations === 0 && JSON.stringify(row) === snapshot, 'legacy-browser-no-writes-submits-navigation');
  } finally { host.removeEventListener('submit', prevent, true); host.remove(); }
  check(!documentRef.querySelector('[data-ext-legacy-apply]'), 'legacy-browser-fixture-cleanup');
  return { success: checks.every((entry) => entry.ok), checks, scriptedClicksOnly: true, tenantWrites: false };
}
