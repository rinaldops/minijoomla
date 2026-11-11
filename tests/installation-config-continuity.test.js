import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createSampleDataService } from '../src/libraries/minijoomla/application/sample-data-service.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { renderConfigPage } from '../src/administrator/components/com_config/tmpl/application/default.js';

const initialSite = Object.freeze({ siteName: 'Site instalado', siteDescription: 'Descrição escolhida', timezone: 'UTC', language: 'pt-BR', pageSize: 10, templateKey: 'cassiopeia', homeView: 'featured', homeCategory: '', offline: false, offlineMessage: '' });
const domains = ['articles', 'categories', 'tags', 'menu', 'extensions', 'templates', 'moduleInstances', 'siteConfig'];
function fixture(config) {
  if (!arguments.length) config = initialSite;
  const events = [];
  const repositories = Object.fromEntries(domains.map((domain) => {
    const rows = new Map(); let version = 0;
    const snapshot = (row) => { const { etag, ...data } = row; return Object.freeze(Object.defineProperty({ ...data }, 'etag', { value: etag })); };
    return [domain, { rows,
      async findMany() { events.push({ kind: 'list', domain }); return { items: [...rows.values()].map(({ etag, ...row }) => ({ ...row })) }; },
      async findById(id) { events.push({ kind: 'get', domain }); return snapshot(rows.get(id)); },
      async create(input) {
        events.push({ kind: 'create', domain, input: { ...input } });
        assert.ok(![...rows.values()].some((row) => row.title === input.title), 'singleton Title must stay unique');
        const row = { ...(domain === 'siteConfig' ? { homeView: 'category', homeCategory: 'noticias' } : {}), ...input, id: rows.size + 1, etag: `"${++version}"` };
        rows.set(row.id, row); return snapshot(row);
      },
      async update(id, input, { etag }) {
        assert.equal(etag, rows.get(id).etag, 'only the real snapshot ETag authorizes a write');
        events.push({ kind: 'update', domain, input: { ...input }, etag });
        rows.set(id, { ...rows.get(id), ...input, etag: `"${++version}"` }); return null;
      }
    }];
  }));
  return { repositories, events, admin: createAdminService(repositories, { initialSiteConfig: config }) };
}
const writes = (h) => h.events.filter(({ kind }) => ['create', 'update'].includes(kind));
const assertInitial = (record) => { for (const [field, value] of Object.entries(initialSite)) assert.equal(record[field], value, field); };

export async function runInstallationConfigContinuityTests() {
  const h = fixture({ ...initialSite, id: 99, etag: 'forged', title: 'forged', customHtml: { html: 'ignored' }, session: 'ignored', templateParams: { brand: 'ignored' }, componentParamsJson: '{}', unknown: 'ignored' });
  assert.deepEqual(h.events, [], 'construction performs neither reads nor writes');
  assert.deepEqual(h.admin.siteConfig.defaults, initialSite);
  assert.ok(Object.isFrozen(h.admin.siteConfig.defaults));
  assert.equal(await h.admin.siteConfig.get(), null, 'defaults are not a virtual persisted row');
  const documentRef = { body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } };
  const app = createAdminApplication({ adminService: h.admin, documentRef, autoStart: false });
  try { await app.router.navigate('#/config'); } finally { app.stop(); }
  const html = documentRef.body.innerHTML;
  for (const field of ['siteName', 'timezone', 'pageSize', 'homeCategory']) assert.ok(html.includes(`name="${field}"`));
  for (const value of ['Site instalado', 'Descrição escolhida', 'UTC']) assert.ok(html.includes(value), value);
  assert.match(html, /name="pageSize"[^>]*value="10"/);
  assert.match(html, /value="cassiopeia" selected/);
  assert.match(html, /value="featured" selected/);
  assert.match(html, /name="homeCategory"[^>]*value=""/);
  assert.equal(writes(h).length, 0, 'rendering never persists initial metadata');
  let journalWrites = 0;
  const pack = { schemaVersion: 1, id: 'joomla-blog', version: 1, title: 'Local', source: { name: 'Local', revision: '1', license: 'GPL-2.0-or-later' }, domains: Object.fromEntries(domains.map((domain) => [domain, domain === 'categories' ? [{ key: 'news', values: { title: 'News', alias: 'news' } }] : []])) };
  const sampleData = createSampleDataService({ adminService: h.admin, loadPackage: async () => pack, journalStore: { read: () => null, write: () => { journalWrites++; } } });
  assert.equal((await sampleData.inspect()).status, 'ready', 'SampleData still sees all eight domains empty');
  assert.equal(writes(h).length + journalWrites, 0);

  for (const saveFirst of [
    (admin) => admin.siteConfig.save({ customHtmlTitle: 'Aviso' }),
    (admin) => admin.componentOptions.save('content', { listLimit: 17 }),
    (admin) => admin.templateStyles.save('cassiopeia-default', { title: 'Meu estilo' }),
    async (admin, repositories) => {
      const template = await repositories.templates.create({ title: 'Cassiopeia', key: 'cassiopeia', enabled: true });
      return admin.templates.setDefault(template.id, { etag: template.etag });
    }
  ]) {
    const current = fixture();
    await saveFirst(current.admin, current.repositories);
    const record = await current.admin.siteConfig.get();
    assertInitial(record);
    const creation = writes(current).find(({ domain }) => domain === 'siteConfig');
    assertInitial(creation.input);
    assert.equal(creation.input.title, 'MiniJoomlaSiteConfig');
    assert.equal(Object.hasOwn(creation.input, 'id'), false);
    assert.equal(Object.hasOwn(creation.input, 'etag'), false);
    assert.equal(current.repositories.siteConfig.rows.size, 1);
    await current.admin.siteConfig.save({ homeCategory: '' }, { etag: record.etag });
    const updated = await current.admin.siteConfig.get();
    assertInitial(updated);
    assert.notEqual(updated.etag, record.etag);
    assert.deepEqual(writes(current).at(-1).input, { title: 'MiniJoomlaSiteConfig', homeCategory: '' });
    await assert.rejects(() => current.admin.siteConfig.save({ homeView: 'category' }, { etag: updated.etag }));
    assert.equal((await current.admin.siteConfig.get()).etag, updated.etag, 'invalid home change never writes');
  }

  const legacy = fixture(undefined);
  assert.equal(legacy.admin.siteConfig.defaults, undefined);
  await legacy.admin.siteConfig.save({ customHtmlTitle: 'Legado', homeCategory: '' });
  assert.deepEqual(writes(legacy)[0].input, { title: 'MiniJoomlaSiteConfig', customHtmlTitle: 'Legado' });
  const saved = { ...initialSite, id: 1, etag: '"persisted"', title: 'MiniJoomlaSiteConfig', siteName: 'Persistido', siteDescription: '', timezone: 'Europe/Lisbon', pageSize: 23, templateKey: 'legacy-template', componentParamsJson: ' {"content":{"unknown":{"keep":true}}} ', templateStylesJson: '', metaDescription: 'Keep', metaKeywords: 'Keep too', robots: 'legacy', sitenamePagetitles: 'after', unknown: { keep: true } };
  h.repositories.siteConfig.rows.set(1, saved);
  const persistedHtml = renderConfigPage(await h.admin.siteConfig.get(), (path) => `#${path}`, [], ({ bodyHtml }) => bodyHtml, h.admin.siteConfig.defaults);
  assert.match(persistedHtml, /name="siteName"[^>]*value="Persistido"/);
  assert.match(persistedHtml, /value="legacy-template" selected/);
  assert.match(persistedHtml, /name="pageSize"[^>]*value="23"/);
  await h.admin.siteConfig.save({ offlineMessage: 'Aviso' }, { etag: saved.etag });
  const updated = await h.admin.siteConfig.get();
  for (const field of ['siteName', 'siteDescription', 'timezone', 'pageSize', 'templateKey', 'componentParamsJson', 'templateStylesJson', 'metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles', 'unknown']) assert.deepEqual(updated[field], saved[field]);
  assert.deepEqual(writes(h).at(-1).input, { title: 'MiniJoomlaSiteConfig', offlineMessage: 'Aviso' });
  const count = writes(h).length;
  await assert.rejects(() => h.admin.siteConfig.save({ siteName: 'X' }));
  assert.equal(writes(h).length, count, 'metadata never supplies a nonexistent ETag');
  console.log('ok - installation config continuity: pure defaults, empty SampleData, first partial save and persisted precedence');
}
