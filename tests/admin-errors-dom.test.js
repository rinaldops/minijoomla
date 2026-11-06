import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

// Browser-only acceptance, using native DOM and synthetic storage exclusively.
export async function runAdminErrorsDomTests(documentRef = globalThis.document) {
  check(typeof documentRef?.createElement === 'function', 'Native document required.');
  const checks = [];
  for (const [field, routes] of [
    ['componentParamsJson', ['#/options/content', '#/options/search']],
    ['templateStylesJson', ['#/templates/styles', '#/templates/styles/cassiopeia-default', '#/templates/positions']]
  ]) {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const repositories = createDemoRepositories({ storage });
    const config = await repositories.siteConfig.findById(1);
    await repositories.siteConfig.update(1, { [field]: '{invalid<script>' }, { etag: config.etag });
    const before = JSON.stringify([...values]);
    const root = documentRef.createElement('div');
    documentRef.body.append(root);
    const service = createAdminService(repositories);
    const app = createAdminApplication({ adminService: service, documentRef: { body: root }, autoStart: false });
    try {
      for (const route of routes) {
        await app.router.navigate(route);
        check(root.querySelector('[role="alert"]')?.textContent.includes(field), `${route}: missing corruption alert`);
        check(!root.querySelector('form, [data-ext-action], script, .admin-position-box'), `${route}: unsafe fallback controls`);
        check(JSON.stringify([...values]) === before, `${route}: persisted data changed`);
        checks.push(route);
      }
      let rejected = false;
      try {
        const { etag } = await service.siteConfig.get();
        if (field === 'componentParamsJson') await service.componentOptions.save('content', { showTitle: false }, { etag });
        else await service.templateStyles.duplicate('cassiopeia-default', { etag });
      } catch (error) { rejected = error?.name === 'ValidationError'; }
      check(rejected && JSON.stringify([...values]) === before, `${field}: mutation was not blocked`);
    } finally { app.stop(); root.remove(); }
  }
  for (const patch of [
    { paramsJson: '{broken<script>' },
    { manifestJson: '{broken<script>' },
    { manifestJson: '{"params":[{"name":"bad name"}]}' },
    { manifestJson: '{"params":[{"name":"limit","type":"number","min":1,"max":5}]}', paramsJson: '{"limit":999}' }
  ]) {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const repositories = createDemoRepositories({ storage });
    const plugin = await repositories.extensions.findById(2);
    await repositories.extensions.update(2, patch, { etag: plugin.etag });
    const before = JSON.stringify([...values]);
    const root = documentRef.createElement('div');
    documentRef.body.append(root);
    const service = createAdminService(repositories);
    const app = createAdminApplication({ adminService: service, documentRef: { body: root }, autoStart: false });
    try {
      for (const route of ['#/plugins', '#/plugins/2']) {
        await app.router.navigate(route);
        check(!!root.querySelector('[role="alert"]'), `${route}: missing invalid plugin alert`);
        check(!root.querySelector('form, [data-ext-action], script'), `${route}: unsafe plugin fallback controls`);
        check(JSON.stringify([...values]) === before, `${route}: plugin data changed`);
        checks.push(`plugin:${route}`);
      }
      const current = await repositories.extensions.findById(2);
      const result = await service.plugins.batch([{ id: 2, etag: current.etag }], 'enable');
      check(!result.succeeded.length && result.failed.length === 1, 'Corrupt plugin batch must fail');
      check(JSON.stringify([...values]) === before, 'Rejected plugin batch changed storage');
    } finally { app.stop(); root.remove(); }
  }
  {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const repositories = createDemoRepositories({ storage });
    const plugin = await repositories.extensions.findById(2);
    await repositories.extensions.update(2, {
      manifestJson: '{"params":[{"name":"limit","type":"number","min":1,"max":5,"default":3}]}',
      paramsJson: '{"limit":2,"advanced":{"keep":true}}'
    }, { etag: plugin.etag });
    const service = createAdminService(repositories);
    const root = documentRef.createElement('div');
    documentRef.body.append(root);
    const app = createAdminApplication({ adminService: service, documentRef: { body: root }, autoStart: false });
    try {
      await app.router.navigate('#/plugins/2');
      root.querySelector('[name="param:limit"]').value = '5';
      root.querySelector('[data-ext-form="plugin"] button[type="submit"]').click();
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline && root.querySelector('[data-ext-form="plugin"]')) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      check(!root.querySelector('[data-ext-form="plugin"]'), 'Native plugin submit did not finish');
      const saved = await service.plugins.get(2);
      check(saved.params.limit === 5 && saved.params.advanced.keep === true, 'Native save lost undeclared stored settings');
      checks.push('plugin:native-submit-preserves-advanced');
    } finally { app.stop(); root.remove(); }
  }
  for (const domain of ['siteConfig', 'templates']) {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const repositories = createDemoRepositories({ storage });
    const failing = { ...repositories, [domain]: { ...repositories[domain], findMany: async () => { throw new Error('private backend details'); } } };
    const before = JSON.stringify([...values]);
    const root = documentRef.createElement('div');
    documentRef.body.append(root);
    const app = createAdminApplication({ adminService: createAdminService(failing), documentRef: { body: root }, autoStart: false });
    try {
      for (const route of ['#/moduleInstances', '#/moduleInstances/new?type=articles-latest', '#/templates/positions']) {
        await app.router.navigate(route);
        check(root.querySelector('[role="alert"]')?.textContent.includes('Não foi possível carregar'), `${domain}: missing load alert`);
        check(!root.querySelector('form, [data-ext-action], .admin-position-box'), `${domain}: fallback actions remain`);
        check(!root.textContent.includes('private backend'), `${domain}: backend details exposed`);
        check(!root.textContent.includes('Nenhum dado foi alterado'), `${domain}: load failure misreports a preceding mutation`);
        check(JSON.stringify([...values]) === before, `${domain}: storage changed`);
        checks.push(`${domain}:${route}`);
      }
    } finally { app.stop(); root.remove(); }
  }
  return { success: true, checks, syntheticStorage: true };
}
