import assert from 'node:assert/strict';
import { renderModuleForm } from '../src/administrator/components/com_modules/tmpl/module/edit.js';
import { renderModuleTypeCatalog } from '../src/administrator/components/com_modules/tmpl/select/default.js';
import { planLegacyModuleAssignment } from '../src/libraries/minijoomla/application/legacy-module-assignment.js';

const link = (path, query) => `${path}${query ? `?type=${encodeURIComponent(query.type)}` : ''}`;
const positions = { template: 'cassiopeia', positions: ['content-top'], all: ['content-top', 'sidebar'] };
const base = {
  typeKey: '', type: null, catalog: [], values: { title: 'News', position: 'content-top', ordering: 0, showTitle: true },
  positions, menu: [{ id: 4, title: 'Home', path: '/' }], categories: [{ alias: 'news', title: 'News' }],
  settings: {}, paramValues: {}, state: 'published', tokens: new Set(['menu:4', 'route:home', 'custom:legacy']),
  initialDates: { publishUp: '2030-01-02T03:04', publishDown: '2030-04-05T06:07' },
  legacyScope: false, legacyPlan: { convertible: false, reason: 'unsupported-kind' }, link
};

export function runAdminModuleFormViewTests() {
  const fresh = renderModuleForm({ ...base, isNew: true, catalog: [{ key: 'mod_news', title: 'News', builtin: true }] });
  assert.match(fresh, /name="extensionKey" required/);
  assert.match(fresh, /mod_news \(nativo\)/);
  assert.match(fresh, /Escolha o tipo para ver os parâmetros específicos\./);
  assert.match(fresh, /name="publishUp" value="2030-01-02T03:04"/);
  assert.match(fresh, /name="publishDown" value="2030-04-05T06:07"/);
  assert.match(fresh, /name="showTitle" checked/);

  const existing = renderModuleForm({ ...base, isNew: false, typeKey: 'mod_news', type: { title: 'News', params: [] }, values: { ...base.values, showTitle: false } });
  assert.doesNotMatch(existing, /name="extensionKey"/);
  assert.match(existing, /<strong>News<\/strong> <code>mod_news<\/code>/);
  assert.match(existing, /name="showTitle"><label/);
  assert.match(existing, /value="custom:legacy" checked/);
  assert.match(existing, /name="assignmentToken" value="menu:4" checked/);
  assert.match(existing, /name="assignmentToken" value="route:home" checked/);
  assert.match(existing, /name="assignmentToken" value="category:news"/);

  const hostile = renderModuleForm({ ...base, isNew: true, typeKey: 'bad"<', catalog: [{ key: 'x"<', title: '<script>&' }], values: { ...base.values, title: '"<img>&' }, link: (path) => `${path}?x="&` });
  assert.match(hostile, /value="&quot;&lt;img&gt;&amp;"/);
  assert.match(hostile, /&lt;script&gt;&amp; \(x&quot;&lt;\)/);
  assert.match(hostile, /href="\/moduleInstances\?x=&quot;&amp;"/);

  const equivalent = planLegacyModuleAssignment({ scopeKind: 'Route', scopeRoute: 'home' });
  const legacy = renderModuleForm({ ...base, isNew: false, typeKey: 'mod_news', type: { title: 'News', params: [] }, legacyScope: true, legacyPlan: equivalent });
  assert.match(legacy, /Prévia equivalente/);
  assert.match(legacy, /data-ext-legacy-apply/);
  const unsafe = planLegacyModuleAssignment({ scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias: 'news' });
  const nonConvertible = renderModuleForm({ ...base, isNew: false, type: { title: 'News', params: [] }, legacyScope: true, legacyPlan: unsafe });
  assert.match(nonConvertible, /combina rota e categoria/);
  assert.doesNotMatch(nonConvertible, /data-ext-legacy-apply/);

  const catalogEmpty = renderModuleTypeCatalog([], { link });
  assert.match(catalogEmpty, /<ul class="admin-component-catalog"/);
  assert.doesNotMatch(catalogEmpty, /<li>/);
  const types = renderModuleTypeCatalog([
    { key: 'core', title: 'Core', description: 'Native', builtin: true },
    { key: 'external', title: 'External', description: 'Registered', enabled: false }
  ], { link });
  assert.match(types, /href="\/moduleInstances\/new\?type=core"/);
  assert.match(types, /<span class="admin-badge">nativo<\/span>/);
  assert.match(types, /<span class="admin-badge is-muted">desabilitado<\/span>/);
  assert.match(types, /external/);
}
