import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createExtensionPages } from '../src/administrator/components/com_minijoomla/extension-pages.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';

const decode = (value) => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Parse controls emitted by the real form. This is not browser/visual acceptance.
function formDocument() {
  let html = ''; let controls = [];
  const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value = '']) => [name, decode(value)]));
  const matches = (control, selector) => [...selector.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)].every(([, name, value]) => Object.hasOwn(control.attrs, name) && (value === undefined || control.attrs[name] === value));
  const query = (selector) => controls.filter((control) => matches(control, selector));
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value; controls = [];
      for (const match of value.matchAll(/<(input|button|form|p)\b([^>]*)>|<(select|textarea)\b([^>]*)>([\s\S]*?)<\/\3>/g)) {
        const tag = match[1] ?? match[3]; const attributes = attrs(match[2] ?? match[4]); const listeners = new Map();
        const choices = tag === 'select' ? [...match[5].matchAll(/<option([^>]*)>/g)].map(([, text]) => attrs(text)) : [];
        controls.push({ attrs: attributes, value: tag === 'select' ? (choices.find((choice) => Object.hasOwn(choice, 'selected')) ?? choices[0])?.value ?? '' : tag === 'textarea' ? decode(match[5]) : attributes.value ?? '',
          checked: Object.hasOwn(attributes, 'checked'), textContent: '',
          querySelector: (selector) => query(selector)[0] ?? null, querySelectorAll: query,
          addEventListener: (event, handler) => listeners.set(event, handler), fire: (event) => listeners.get(event)?.({ preventDefault() {} }) });
      }
    },
    querySelector: (selector) => query(selector)[0] ?? null, querySelectorAll: query
  };
  return { documentRef: { body }, field: (name) => query(`[name="${name}"]`)[0], find: (selector) => query(selector)[0], tokens: () => query('[name="assignmentToken"]') };
}

function fixture(scope) {
  let row = { id: 1, etag: '"initial"', title: 'Legacy module', extensionKey: 'search', position: 'search', enabled: true, showTitle: true, ordering: 0,
    settingsJson: '{"future":{"keep":true}}', publishUp: '2026-01-01T00:01:27.456Z', publishDown: '2027-01-01T00:01:43.789Z', futureColumn: 'untouched', ...scope };
  const writes = [];
  const repository = {
    findMany: async () => ({ items: [{ ...row }] }), findById: async () => structuredClone(row),
    update: async (id, patch, { etag }) => {
      if (etag !== row.etag) throw Object.assign(new Error('Conflict'), { code: 'concurrency-conflict' });
      writes.push(structuredClone({ id, patch, etag })); row = { ...row, ...patch, etag: '"updated"' }; return structuredClone(row);
    }
  };
  const service = createAdminService({ moduleInstances: repository, siteConfig: { findMany: async () => ({ items: [] }) } });
  const updates = []; const update = service.moduleInstances.update;
  service.moduleInstances.update = async (id, input, options) => { updates.push(structuredClone({ id, input, options })); return update(id, input, options); };
  const doc = formDocument(); const navigations = [];
  const pages = createExtensionPages({ adminService: service, documentRef: doc.documentRef, router: { link: (path) => `#${path}`, navigate: async (url) => navigations.push(url) }, shell: ({ bodyHtml }) => bodyHtml });
  return { doc, pages, writes, updates, navigations, row: () => structuredClone(row), concurrent: () => { row = { ...row, title: 'Concurrent', etag: '"concurrent"' }; } };
}

export async function runLegacyAssignmentFormTests() {
  for (const scope of [{ scopeKind: 'All' }, {}, { scopeKind: 'Route', scopeRoute: 'home' }, { scopeKind: 'Route', scopeRoute: 'category' }]) {
    const f = fixture(scope); const before = f.row();
    const page = await f.pages.render({ path: '/moduleInstances/1' }); assert.equal(typeof page.bind, 'function', page.html); f.doc.documentRef.body.innerHTML = page.html; page.bind();
    assert.ok(f.doc.find('[data-ext-legacy-apply]')); assert.match(page.html, /Prévia equivalente/); assert.match(page.html, /type="button"[^>]*data-ext-legacy-apply/);
    assert.match(page.html, /role="status" aria-live="polite" data-ext-legacy-status/);
    assert.equal(f.doc.field('assignment').value, '');
    await f.doc.find('[data-ext-legacy-apply]').fire('click');
    assert.equal(f.doc.field('assignment').value, scope.scopeKind === 'Route' ? 'only' : 'all');
    assert.deepEqual(f.doc.tokens().filter((field) => field.checked).map((field) => field.value), scope.scopeKind === 'Route' ? [`route:${scope.scopeRoute}`] : []);
    assert.deepEqual(f.row(), before); assert.equal(f.writes.length, 0); assert.equal(f.updates.length, 0);
    f.doc.field('title').value = 'Edited';
    await f.doc.find('[data-ext-legacy-restore]').fire('click');
    assert.equal(f.doc.field('assignment').value, ''); assert.equal(f.doc.field('title').value, 'Edited'); assert.deepEqual(f.row(), before);
    await f.doc.find('[data-ext-legacy-apply]').fire('click');
    await f.doc.find('[data-ext-form="module"]').fire('submit');
    assert.equal(f.writes.length, 1); assert.deepEqual(f.updates[0].options, { etag: before.etag });
    assert.equal(f.row().title, 'Edited'); assert.equal(f.updates[0].input.assignment, scope.scopeKind === 'Route' ? 'only' : 'all');
    if (scope.scopeKind === 'Route') {
      assert.equal(f.row().assignment, 'only'); assert.deepEqual(JSON.parse(f.row().assignmentJson), [`route:${scope.scopeRoute}`]);
    } else {
      // Existing service avoids writing new default columns on unprovisioned
      // legacy rows. Absence still means legacy All; never change that contract.
      assert.equal(f.row().assignment, undefined); assert.equal(f.row().assignmentJson, undefined);
    }
    for (const name of ['scopeKind', 'scopeRoute', 'scopeCategoryAlias', 'publishUp', 'publishDown', 'futureColumn']) assert.equal(f.row()[name], before[name]);
    assert.deepEqual(JSON.parse(f.row().settingsJson).future, { keep: true }); assert.deepEqual(f.navigations, ['#/moduleInstances']);
  }
  for (const scope of [{ scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias: 'news' }, { scopeKind: 'Route', scopeRoute: 'search', scopeCategoryAlias: 'news' }, { scopeKind: 'Unknown' }, { scopeKind: 'Route', scopeRoute: 'unknown' }]) {
    const f = fixture(scope); const before = f.row(); const page = await f.pages.render({ path: '/moduleInstances/1' });
    f.doc.documentRef.body.innerHTML = page.html; page.bind();
    assert.equal(f.doc.find('[data-ext-legacy-apply]'), undefined); assert.match(page.html, /role="note"/);
    assert.equal(f.doc.field('assignment').value, ''); assert.deepEqual(f.row(), before); assert.equal(f.writes.length, 0);
    if (scope.scopeCategoryAlias === 'news' && scope.scopeRoute === 'category') assert.match(page.html, /seleções atuais usam OU, não E/);
  }
  for (const action of ['preserve', 'restored-save', 'conflict', 'manual', 'cancel']) {
    const f = fixture({ scopeKind: 'Route', scopeRoute: 'home', assignmentJson: ' [ "menu:999" ] ' });
    const page = await f.pages.render({ path: '/moduleInstances/1' }); f.doc.documentRef.body.innerHTML = page.html; page.bind();
    const before = f.row();
    if (action === 'manual') {
      f.doc.field('assignment').value = 'except'; await f.doc.find('[data-ext-legacy-apply]').fire('click');
      assert.equal(f.doc.field('assignment').value, 'except'); assert.match(f.doc.find('[data-ext-legacy-status]').textContent, /foi editada/);
    } else if (action === 'preserve' || action === 'restored-save') {
      if (action === 'restored-save') {
        await f.doc.find('[data-ext-legacy-apply]').fire('click');
        await f.doc.find('[data-ext-legacy-restore]').fire('click');
        assert.equal(f.doc.find('[name="assignmentToken"][value="menu:999"]').checked, true);
      }
      f.doc.field('title').value = 'Unrelated'; await f.doc.find('[data-ext-form="module"]').fire('submit');
      assert.equal(f.row().assignment, undefined); assert.equal(f.row().assignmentJson, before.assignmentJson);
      assert.equal(f.updates[0].input.assignment, undefined); assert.equal(f.updates[0].input.assignmentTokens, undefined);
    } else {
      await f.doc.find('[data-ext-legacy-apply]').fire('click');
      if (action === 'conflict') {
        f.concurrent(); const concurrent = f.row(); await f.doc.find('[data-ext-form="module"]').fire('submit');
        assert.deepEqual(f.row(), concurrent); assert.match(f.doc.find('[data-ext-status]').textContent, /Recarregue/); assert.equal(f.writes.length, 0); assert.equal(f.navigations.length, 0);
      } else { assert.deepEqual(f.row(), before); assert.equal(f.writes.length, 0); assert.equal(f.navigations.length, 0); }
    }
  }
  const modern = fixture({ assignment: 'only', assignmentJson: '["route:home"]' });
  assert.doesNotMatch((await modern.pages.render({ path: '/moduleInstances/1' })).html, /data-ext-legacy-/);
  console.log('ok - assisted legacy assignment forms: preview/apply/restore, explicit save, preserved scope/dates/JSON, manual edits and ETag conflict; no implicit writes');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runLegacyAssignmentFormTests();
