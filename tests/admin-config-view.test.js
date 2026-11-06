import assert from 'node:assert/strict';
import { defaultConfig } from '../src/libraries/minijoomla/core/config.js';
import { renderConfigPage } from '../src/administrator/components/com_config/tmpl/application/default.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';

export async function runAdminConfigViewTests() {
  const link = (path) => `#${path}`;
  const shell = ({ bodyHtml }) => bodyHtml;
  const html = renderConfigPage({}, link, [
    { key: 'active', title: 'Ativo <script>', enabled: true },
    { key: 'inactive', title: 'Desativado', enabled: false }
  ], shell);
  for (const [name, value] of Object.entries(defaultConfig)) assert.ok(html.includes(`name="${name}"`), `default field ${name} rendered`);
  for (const key of ['default', 'cassiopeia', 'camap']) assert.ok(html.includes(`${key} (integrado)`));
  assert.ok(html.includes('Ativo &lt;script&gt;'));
  assert.ok(!html.includes('value="inactive"'));

  const unavailable = renderConfigPage({ templateKey: 'missing<&', siteName: '<img src=x onerror=alert(1)>' }, link, [], shell);
  assert.match(unavailable, /missing&lt;&amp; \(atual — indisponível\)/);
  assert.match(unavailable, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(unavailable, /<img src=x/);

  const record = Object.freeze(Object.defineProperty({ siteName: 'Frozen' }, 'etag', { value: '"one"', enumerable: false }));
  const before = { ...record, etag: record.etag };
  renderConfigPage(record, link, [], shell);
  assert.deepEqual({ ...record, etag: record.etag }, before);
  assert.equal(Object.hasOwn(record, 'sitenamePagetitles'), false);

  // Only these controls exist in this synthetic form; absent/disabled fields must not be patches.
  const snapshot = (data, etag) => Object.freeze(Object.defineProperty({ ...data }, 'etag', { value: etag, enumerable: false }));
  let current = snapshot({ siteName: 'Original', robots: 'legacy', metaDescription: 'Keep', customHtmlBody: '<p>Keep</p>', pageSize: 20 }, '"loaded"');
  let submit, reads = 0, writes = 0;
  const attempts = [], status = { textContent: '' };
  const inputs = { siteName: { value: 'Novo' }, pageSize: { value: 'forged', disabled: true }, robots: { value: 'forged' } };
  const form = { querySelector: (selector) => inputs[selector.match(/name="([^"]+)"/)?.[1]] ?? null,
    addEventListener: (event, handler) => { if (event === 'submit') submit = handler; } };
  const documentRef = { body: { innerHTML: '', querySelector: (selector) => selector === '[data-admin-form]' ? form : selector === '.admin-form-status' ? status : null, querySelectorAll: () => [] } };
  const adminService = { templates: { available: false }, siteConfig: {
    get: async () => { reads++; return current; },
    save: async (values, { etag }) => {
      attempts.push({ values: { ...values }, etag });
      if (etag !== current.etag) throw Object.assign(new Error('conflict'), { code: 'concurrency-conflict' });
      writes++; current = snapshot({ ...current, ...values }, '"saved"'); return current;
    }
  } };
  const app = createAdminApplication({ adminService, documentRef, autoStart: false });
  try {
    await app.router.navigate('#/config');
    current = snapshot({ ...current, siteName: 'Concurrent' }, '"concurrent"');
    await submit({ preventDefault() {} });
    assert.equal(attempts[0].etag, '"loaded"');
    assert.equal(reads, 1, 'submit must not refresh the ETag');
    assert.equal(writes, 0);
    assert.match(status.textContent, /Recarregue antes de salvar/);
    await app.router.navigate('#/config');
    await submit({ preventDefault() {} });
    assert.deepEqual(attempts[1], { values: { siteName: 'Novo' }, etag: '"concurrent"' });
    assert.equal(writes, 1);
    assert.equal(current.customHtmlBody, '<p>Keep</p>');
    assert.equal(current.robots, 'legacy');
    assert.equal(current.pageSize, 20);
    assert.equal(current.metaDescription, 'Keep');
  } finally { app.stop(); }
  console.log('ok - admin config view: defaults, template options, escaping and frozen ETag snapshot');
}
