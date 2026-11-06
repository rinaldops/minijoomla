import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function until(predicate, message) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}

// Browser-only regression: native HTMLElement.click, real scoped root, isolated synthetic storage.
export async function runAdminManagementDomTests(documentRef = globalThis.document) {
  check(typeof documentRef?.createElement === 'function', 'A native browser document is required.');
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const repositories = createDemoRepositories({ storage });
  const service = createAdminService(repositories);
  const root = documentRef.createElement('div');
  documentRef.body.append(root);
  const app = createAdminApplication({ adminService: service, documentRef: { body: root }, autoStart: false });
  try {
    await app.router.navigate('#/templates');
    const defaultButton = root.querySelector('[data-admin-managed-action="default"][data-admin-row-id="2"]');
    check(defaultButton && !defaultButton.disabled, 'Default action must be enabled.');
    check(defaultButton.dataset.adminManagedBound === 'true', 'Default action was rendered but not bound by the currently loaded app module.');
    defaultButton.click();
    await until(async () => (await service.siteConfig.get()).templateKey === 'camap', 'Native default click did not persist templateKey.');
    await until(() => root.querySelector('.admin-template-default')?.textContent === 'Padrão', 'Default action did not finish rendering.');

    await app.router.navigate('#/extensions?type=Plugin');
    const toggleButton = root.querySelector('[data-admin-managed-action="toggle"][data-admin-row-id="2"]');
    check(toggleButton && !toggleButton.disabled, 'Plugin toggle must be enabled.');
    check(toggleButton.dataset.adminManagedBound === 'true', 'Plugin toggle was rendered but not bound by the currently loaded app module.');
    toggleButton.click();
    await until(async () => (await service.extensions.get(2)).enabled === true, 'Native toggle click did not persist plugin state.');
    await until(() => root.querySelector('[data-admin-managed-action="toggle"][data-admin-row-id="2"]')?.textContent === 'Desativar', 'Toggle action did not finish rendering.');

    await app.router.navigate('#/templates');
    const staleButton = root.querySelector('[data-admin-managed-action="default"][data-admin-row-id="1"]');
    const config = await service.siteConfig.get();
    await service.siteConfig.save({ siteName: 'Concurrent native DOM test' }, { etag: config.etag });
    staleButton.click();
    await until(() => root.querySelector('.admin-management-status')?.textContent.includes('Recarregue'), 'Stale config ETag was not announced.');
    check((await service.siteConfig.get()).templateKey === 'camap', 'Stale click overwrote templateKey.');
    check(values.has('minijoomla-demo-v1'), 'Writes did not reach isolated synthetic storage.');
    return { passed: true, checks: ['native-root-default-click', 'native-root-plugin-toggle', 'captured-etag-conflict', 'isolated-demo-storage'], confirmRequired: false };
  } finally {
    app.stop();
    root.remove();
  }
}
