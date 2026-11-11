import assert from 'node:assert/strict';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { extensionFixture, publishedParameterFixture } from './admin-extensions-service.test.js';
import { PUBLISHED_PARAMETER_VALUES, invalidPublishedParameterValues } from './published-parameter-compat.test.js';
import { createApplication } from '../src/index.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { pluginGroupStorageFixture } from './plugin-group-storage.test.js';

/* DOM mínimo: interpreta input/select/textarea/button/form do HTML renderizado. */
function attributes(source) {
  const result = {};
  for (const [, name, , value = ''] of source.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(=("([^"]*)"))?/g)) result[name] = value;
  for (const [, name, value] of source.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g)) result[name] = value;
  return result;
}

const unescape = (value) => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function extensionDocument() {
  let html = '';
  let elements = [];
  const make = (tag, attrs, inner = '') => {
    const listeners = {};
    const dataset = Object.fromEntries(Object.entries(attrs).filter(([name]) => name.startsWith('data-')).map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    const element = { tag, attrs, dataset, disabled: false, name: attrs.name, type: attrs.type, checked: 'checked' in attrs, textContent: '', innerHTML: '',
      value: tag === 'textarea' ? unescape(inner) : unescape(attrs.value ?? ''),
      addEventListener: (event, handler) => { listeners[event] = handler; },
      fire: (event, payload = {}) => listeners[event]?.({ preventDefault() {}, target: element, ...payload }),
      getAttribute: (name) => attrs[name], setAttribute: (name, value) => { attrs[name] = value; },
      querySelector: (selector) => query(selector)[0] ?? null, querySelectorAll: (selector) => query(selector) };
    if (tag === 'select') {
      const optionsHtml = [...inner.matchAll(/<option([^>]*)>/g)].map(([, source]) => attributes(source));
      element.value = unescape((optionsHtml.find((option) => 'selected' in option) ?? optionsHtml[0] ?? {}).value ?? '');
    }
    return element;
  };
  function matches(element, selector) {
    return selector.split(',').some((part) => {
      const clean = part.trim();
      const tag = clean.match(/^([a-z]+)/)?.[1];
      if (tag && element.tag !== tag) return false;
      if (clean.startsWith('.')) return (element.attrs.class ?? '').split(/\s+/).includes(clean.slice(1));
      const conditions = [...clean.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)];
      return conditions.length > 0 && conditions.every(([, name, value]) => name in element.attrs && (value === undefined || element.attrs[name] === value));
    });
  }
  function query(selector) { return elements.filter((element) => matches(element, selector)); }
  const status = { textContent: '' };
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      elements = [];
      for (const match of value.matchAll(/<(input|button|form|p|div|span)\b([^>]*)>|<(select|textarea)\b([^>]*)>([\s\S]*?)<\/\3>/g)) {
        if (match[1]) elements.push(make(match[1], attributes(match[2])));
        else elements.push(make(match[3], attributes(match[4]), match[5]));
      }
    },
    querySelector: (selector) => query(selector)[0] ?? null,
    querySelectorAll: (selector) => query(selector)
  };
  const api = {
    documentRef: { body },
    status,
    find: (selector) => query(selector)[0],
    all: (selector) => query(selector),
    field: (name) => query(`[name="${name}"]`)[0],
    report: () => query('[data-ext-status]')[0]?.textContent ?? ''
  };
  return api;
}

export async function runOwnParamFormsRegressionTests() {
  const definitions = [
    { name: 'constructor', type: 'number', default: 3 },
    { name: 'toString', type: 'text', default: 'Text default' },
    { name: 'valueOf', type: 'text' },
    { name: 'hasOwnProperty', type: 'checkbox' },
    { name: 'isPrototypeOf', type: 'checkbox', default: false },
    { name: 'propertyIsEnumerable', type: 'checkbox', default: true },
    { name: 'toLocaleString', type: 'textarea', default: 'Locale default' }
  ];
  const defaults = { constructor: 3, toString: 'Text default', valueOf: '', hasOwnProperty: false, isPrototypeOf: false, propertyIsEnumerable: true, toLocaleString: 'Locale default' };
  const explicit = { constructor: 0, toString: '', valueOf: 'Own text', hasOwnProperty: true, isPrototypeOf: true, propertyIsEnumerable: false, toLocaleString: '' };
  const nulls = Object.fromEntries(definitions.map(({ name }) => [name, null]));
  const future = JSON.parse('{"futureKeys":{"keep":[1,false,{"nested":true}]},"__proto__":{"polluted":true,"nested":{"keep":false}}}');
  const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);

  // Exercise real service normalization, route rendering and bound submits;
  // the minimal DOM only reads the controls emitted by the application.
  for (const kind of ['plugin', 'module']) {
    for (const [label, stored, expected] of [
      ['absent JSON', undefined, defaults],
      ['empty JSON', {}, defaults],
      ['own values', { ...future, ...explicit }, explicit],
      ['own false overrides true default', { ...future, hasOwnProperty: false, isPrototypeOf: false, propertyIsEnumerable: false }, { ...defaults, propertyIsEnumerable: false }],
      ['explicit null', { ...future, ...nulls }, kind === 'module' ? defaults : { constructor: 3, toString: '', valueOf: '', hasOwnProperty: false, isPrototypeOf: false, propertyIsEnumerable: false, toLocaleString: '' }]
    ]) {
      const repos = extensionFixture();
      const manifestJson = `  ${JSON.stringify({ params: definitions, futureManifest: { keep: true } }, null, 2)}\n`;
      const domain = kind === 'plugin' ? 'extensions' : 'moduleInstances';
      const id = kind === 'plugin' ? 2 : 1;
      const jsonField = kind === 'plugin' ? 'paramsJson' : 'settingsJson';
      const route = kind === 'plugin' ? '#/plugins/2' : '#/moduleInstances/1';
      if (kind === 'plugin') repos.extensions.rows.get(2).manifestJson = manifestJson;
      else {
        repos.extensions.rows.get(1).manifestJson = manifestJson;
        repos.moduleInstances.rows.set(1, { id: 1, etag: '"own-params"', title: 'Own parameters', extensionKey: 'module-x', position: 'footer', enabled: true, showTitle: true, assignment: 'all', ordering: 0 });
      }
      if (stored !== undefined) repos[domain].rows.get(id)[jsonField] = JSON.stringify(stored);
      const snapshot = () => structuredClone(Object.fromEntries(Object.entries(repos).map(([key, repo]) => [key, { rows: [...repo.rows.entries()], lastPatch: repo.lastPatch }])));
      const before = snapshot();
      const service = createAdminService(repos);
      const namespace = kind === 'plugin' ? service.plugins : service.moduleInstances;
      const updates = [];
      const update = namespace.update;
      namespace.update = async (id, input, options) => {
        updates.push(structuredClone({ id, input, options }));
        return update(id, input, options);
      };
      const doc = extensionDocument();
      const app = createAdminApplication({ adminService: service, documentRef: doc.documentRef, autoStart: false });
      const context = `${kind}: ${label}`;
      const assertControls = () => {
        const html = doc.documentRef.body.innerHTML;
        assert.match(html, new RegExp(`data-ext-form="${kind}"`), context);
        assert.doesNotMatch(html, /\[native code\]|function (?:valueOf|hasOwnProperty|toString)|role="alert"/, context);
        for (const { name, type } of definitions) {
          const control = doc.field(`param:${name}`);
          assert.ok(control, `${context}: ${name} is rendered`);
          assert.equal(type === 'checkbox' ? control.checked : control.value, type === 'checkbox' ? expected[name] : String(expected[name]), `${context}: ${name} uses own/nullish/default semantics`);
        }
      };
      try {
        await app.router.navigate(route);
        assertControls();
        assert.deepEqual(snapshot(), before, `${context}: rendering does not change stored JSON, ETags or patches`);
        const renderedEtag = repos[domain].rows.get(id).etag;
        await doc.find(`[data-ext-form="${kind}"]`).fire('submit');
        assert.equal(updates.length, 1, `${context}: ${doc.report()}`);
        assert.deepEqual(updates[0].options, { etag: renderedEtag }, `${context}: submit uses the rendered ETag`);
        const submitted = kind === 'plugin' ? updates[0].input.params : updates[0].input.settings;
        const savedRow = repos[domain].rows.get(id);
        const saved = JSON.parse(savedRow[jsonField]);
        assert.notEqual(savedRow.etag, renderedEtag, `${context}: real repository write completed`);
        for (const { name } of definitions) {
          assert.ok(Object.hasOwn(submitted, name), `${context}: ${name} is submitted as own data`);
          const expectedSubmitted = kind === 'plugin' && definitions.find((definition) => definition.name === name).type === 'number' ? String(expected[name]) : expected[name];
          assert.equal(submitted[name], expectedSubmitted, `${context}: own numeric controls remain text until service coercion; ${name} is not synthesized from the prototype`);
          assert.ok(Object.hasOwn(saved, name), `${context}: ${name} is persisted as own data`);
          assert.equal(saved[name], expected[name]);
        }
        if (stored && Object.hasOwn(stored, '__proto__')) {
          for (const name of ['futureKeys', '__proto__']) {
            assert.ok(Object.hasOwn(saved, name), `${context}: unknown ${name} remains own data`);
            assert.deepEqual(saved[name], future[name]);
          }
          assert.equal(Object.getPrototypeOf(saved), Object.prototype);
          assert.equal(saved.polluted, undefined);
        }
        assert.equal(repos.extensions.rows.get(kind === 'plugin' ? 2 : 1).manifestJson, manifestJson, `${context}: future manifest and original bytes remain unchanged`);
        await app.router.navigate(route);
        assertControls();

        // Concurrent parameter changes must not be overwritten by an old form.
        const staleEtag = savedRow.etag;
        const concurrent = { ...saved, valueOf: 'Concurrent own text' };
        await update(id, kind === 'plugin' ? { params: concurrent } : { settings: concurrent }, { etag: staleEtag });
        const concurrentSnapshot = snapshot();
        doc.field('param:valueOf').value = 'Stale own text';
        await doc.find(`[data-ext-form="${kind}"]`).fire('submit');
        assert.deepEqual(updates.at(-1).options, { etag: staleEtag });
        assert.match(doc.report(), /Recarregue/, context);
        assert.deepEqual(snapshot(), concurrentSnapshot, `${context}: conflict preserves future params, ETags and lastPatch`);
      } finally { app.stop(); }
    }
  }
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototypeBefore);
  assert.equal({}.polluted, undefined);
  console.log('ok - admin extensions DOM: own reserved parameters render and submit without inherited values, preserving nullish/defaults, unknown JSON and ETag conflicts');
}

async function runModuleScheduleFormTests() {
  const repos = extensionFixture();
  const dates = { publishUp: '2026-04-12T00:01:27.456Z', publishDown: '2026-12-18T23:59:43.789Z' };
  repos.moduleInstances.rows.set(1, { id: 1, etag: '"schedule-1"', title: 'Scheduled', extensionKey: 'search', position: 'search', enabled: true, showTitle: true, ordering: 0, assignment: 'all', settingsJson: '{}', ...dates });
  const service = createAdminService(repos);
  const updates = [];
  const update = service.moduleInstances.update;
  service.moduleInstances.update = async (id, input, options) => {
    updates.push(structuredClone({ id, input, options }));
    return update(id, input, options);
  };
  const doc = extensionDocument();
  const app = createAdminApplication({ adminService: service, documentRef: doc.documentRef, autoStart: false });
  const localInput = (value) => {
    const date = new Date(value);
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const submit = async () => {
    const etag = repos.moduleInstances.rows.get(1).etag;
    const count = updates.length;
    await doc.find('[data-ext-form="module"]').fire('submit');
    assert.equal(updates.length, count + 1, doc.report());
    assert.equal(updates.at(-1).id, 1);
    assert.deepEqual(updates.at(-1).options, { etag }, 'save uses the ETag captured with the form');
    assert.notEqual(repos.moduleInstances.rows.get(1).etag, etag, doc.report());
    return updates.at(-1).input;
  };
  try {
    // Repeated unrelated saves must not round UTC seconds/milliseconds or
    // shift them by the machine timezone (including a local date boundary).
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await app.router.navigate('#/moduleInstances/1');
      for (const name of Object.keys(dates)) assert.equal(doc.field(name).value, localInput(dates[name]));
      if (attempt === 1) {
        doc.field('publishUp').value = '2026-04-13T08:15';
        doc.field('publishUp').value = localInput(dates.publishUp);
      }
      doc.field('title').value = 'Title only';
      const input = await submit();
      assert.equal(input.title, 'Title only');
      assert.equal(repos.moduleInstances.rows.get(1).title, 'Title only');
      for (const [name, value] of Object.entries(dates)) {
        assert.equal(name in input, false, `${name} is absent from the service update`);
        assert.equal(name in repos.moduleInstances.lastPatch, false, `${name} is absent from the repository patch`);
        assert.equal(repos.moduleInstances.rows.get(1)[name], value, `${name} remains exact UTC`);
      }
    }

    // Edit each date independently: convert local input to ISO UTC without
    // sending the other control's truncated, untouched value.
    for (const [name, edited] of [['publishUp', '2026-04-13T08:15'], ['publishDown', '2026-12-19T17:45']]) {
      const other = name === 'publishUp' ? 'publishDown' : 'publishUp';
      const untouched = repos.moduleInstances.rows.get(1)[other];
      await app.router.navigate('#/moduleInstances/1');
      doc.field(name).value = edited;
      const input = await submit();
      const iso = new Date(edited).toISOString();
      assert.equal(input[name], iso, 'service receives edited local time as ISO UTC');
      assert.equal(repos.moduleInstances.lastPatch[name], iso);
      assert.equal(repos.moduleInstances.rows.get(1)[name], iso);
      assert.equal(other in input, false);
      assert.equal(other in repos.moduleInstances.lastPatch, false);
      assert.equal(repos.moduleInstances.rows.get(1)[other], untouched);
    }

    for (const name of Object.keys(dates)) {
      const other = name === 'publishUp' ? 'publishDown' : 'publishUp';
      const untouched = repos.moduleInstances.rows.get(1)[other];
      await app.router.navigate('#/moduleInstances/1');
      doc.field(name).value = '';
      const input = await submit();
      assert.equal(input[name], null, 'clearing a populated control sends explicit null');
      assert.equal(repos.moduleInstances.lastPatch[name], null);
      assert.equal(repos.moduleInstances.rows.get(1)[name], null);
      assert.equal(other in input, false);
      assert.equal(other in repos.moduleInstances.lastPatch, false);
      assert.equal(repos.moduleInstances.rows.get(1)[other], untouched);
    }
    await app.router.navigate('#/moduleInstances/1');
    const emptyInput = await submit();
    for (const name of Object.keys(dates)) {
      assert.equal(name in emptyInput, false, 'untouched empty controls are omitted too');
      assert.equal(name in repos.moduleInstances.lastPatch, false);
      assert.equal(repos.moduleInstances.rows.get(1)[name], null);
    }

    // A concurrent schedule edit must still conflict with the rendered ETag,
    // not be overwritten using a fresh ETag obtained during submit.
    await app.router.navigate('#/moduleInstances/1');
    const renderedEtag = repos.moduleInstances.rows.get(1).etag;
    await update(1, dates, { etag: renderedEtag });
    const before = structuredClone(repos.moduleInstances.rows.get(1));
    const lastPatch = structuredClone(repos.moduleInstances.lastPatch);
    doc.field('publishUp').value = '2026-04-14T09:30';
    await doc.find('[data-ext-form="module"]').fire('submit');
    assert.deepEqual(updates.at(-1).options, { etag: renderedEtag });
    assert.match(doc.report(), /Recarregue/);
    assert.deepEqual(repos.moduleInstances.rows.get(1), before);
    assert.deepEqual(repos.moduleInstances.lastPatch, lastPatch);
  } finally { app.stop(); }
  console.log('ok - admin extensions DOM: module schedule preserves exact untouched UTC dates, converts edits, clears explicitly and retains ETag conflicts');
}

async function runPublishedParameterFormTests() {
  for (const kind of ['module', 'plugin']) {
    const { repositories, domain, id, jsonField, route, stored, manifestJson } = publishedParameterFixture(kind);
    const service = createAdminService(repositories);
    const namespace = kind === 'module' ? service.moduleInstances : service.plugins;
    const update = namespace.update;
    const updates = [];
    namespace.update = async (id, input, options) => {
      updates.push(structuredClone({ id, input, options }));
      return update(id, input, options);
    };
    const snapshot = () => structuredClone(Object.fromEntries(Object.entries(repositories).map(([key, repo]) => [key, { rows: [...repo.rows.entries()], lastPatch: repo.lastPatch }])));
    const doc = extensionDocument();
    const app = createAdminApplication({ adminService: service, documentRef: doc.documentRef, autoStart: false });
    const parsed = () => JSON.parse(repositories[domain].rows.get(id)[jsonField]);
    const fill = () => {
      for (const [key, value] of Object.entries(PUBLISHED_PARAMETER_VALUES)) doc.field(`param:${key}`).value = ['items', 'bandTones'].includes(key) ? JSON.stringify(value, null, 2) : String(value);
    };
    try {
      const before = snapshot();
      await app.router.navigate(route);
      assert.deepEqual(snapshot(), before, `${kind}: published JSON form rendering is read-only`);
      assert.equal(doc.field('param:items').tag, 'textarea');
      assert.equal(doc.field('param:items').attrs.rows, '8');
      assert.equal(doc.field('param:items').attrs.spellcheck, 'false');
      assert.equal('maxlength' in doc.field('param:items').attrs, false, 'pretty JSON is not truncated by native maxlength');
      assert.deepEqual(JSON.parse(doc.field('param:items').value), stored.items);
      assert.deepEqual(JSON.parse(doc.field('param:bandTones').value), stored.bandTones);
      assert.equal(doc.field('param:target').type, 'text', 'relative/hash URL uses text control, not browser URL constraint');
      assert.equal(doc.field('param:target').attrs.inputmode, 'url');
      assert.equal(doc.field('param:target').attrs.maxlength, '120');
      assert.equal(doc.field('param:caption').attrs.maxlength, '12');
      assert.equal(doc.field('param:details').attrs.maxlength, '20');
      assert.equal(doc.field('param:ratio').attrs.step, 'any');
      assert.match(doc.documentRef.body.innerHTML, /JSON: lista \(array\)|JSON: objeto/);
      for (const invalid of invalidPublishedParameterValues()) {
        fill();
        for (const [key, value] of Object.entries(invalid)) doc.field(`param:${key}`).value = value;
        await doc.find(`[data-ext-form="${kind}"]`).fire('submit');
        assert.ok(doc.report(), `${kind}: invalid JSON/type/unsafe key/length/URL/number has visible validation`);
        assert.deepEqual(snapshot(), before, `${kind}: invalid synthetic submit does not write/change ETag or lastPatch`);
      }
      for (const target of ['#/edited', '/pages/edited#section', './edited', 'https://example.invalid/edited']) {
        await app.router.navigate(route);
        fill();
        doc.field('param:items').value = JSON.stringify([{ title: 'Edited', href: target }], null, 2);
        doc.field('param:bandTones').value = JSON.stringify({ main: '#556677' }, null, 2);
        doc.field('param:target').value = target;
        doc.field('param:ratio').value = '';
        const etag = repositories[domain].rows.get(id).etag;
        await doc.find(`[data-ext-form="${kind}"]`).fire('submit');
        assert.notEqual(repositories[domain].rows.get(id).etag, etag, `${kind}: ${doc.report()}`);
        assert.deepEqual(updates.at(-1).options, { etag });
        const submitted = kind === 'module' ? updates.at(-1).input.settings : updates.at(-1).input.params;
        assert.equal(typeof submitted.items, kind === 'module' ? 'object' : 'string', 'module form coerces JSON; plugin service coerces raw textarea JSON');
        assert.deepEqual(parsed().items, [{ title: 'Edited', href: target }]);
        assert.deepEqual(parsed().bandTones, { main: '#556677' });
        assert.equal(parsed().target, target);
        assert.equal(parsed().ratio, 1.5, 'blank number keeps historical default coercion');
        assert.deepEqual(parsed().__proto__, stored.__proto__);
        assert.deepEqual(parsed().futureKeys, stored.futureKeys);
        assert.ok(Object.hasOwn(parsed(), '__proto__'));
        assert.equal(parsed().polluted, undefined);
      }
      await app.router.navigate(route);
      const stale = repositories[domain].rows.get(id).etag;
      await update(id, kind === 'module' ? { settings: { ...parsed(), items: [{ title: 'Concurrent', href: '#/concurrent' }] } } : { params: { items: [{ title: 'Concurrent', href: '#/concurrent' }] } }, { etag: stale });
      const concurrent = snapshot();
      doc.field('param:items').value = '[{"title":"Stale","href":"#/stale"}]';
      await doc.find(`[data-ext-form="${kind}"]`).fire('submit');
      assert.match(doc.report(), /Recarregue/);
      assert.deepEqual(updates.at(-1).options, { etag: stale });
      assert.deepEqual(snapshot(), concurrent);
      assert.equal(repositories.extensions.rows.get(kind === 'module' ? 1 : 2).manifestJson, manifestJson);
    } finally { app.stop(); }
  }
  assert.equal({}.polluted, undefined);
  console.log('ok - admin extensions DOM: published menu JSON array/object fields render and submit, validate before writes, retain unknown own data and relative/hash/HTTPS URLs with ETags');
}

async function runPluginStorageFormTests() {
  const manifest = `  ${JSON.stringify({ group: 'content', version: '1.0.0', params: [{ name: 'constructor', type: 'number', default: 3 }, { name: 'toString', type: 'checkbox', default: true }], ...JSON.parse('{"__proto__":{"keep":true},"futureManifest":{"keep":[1,false]}}') }, null, 2)}\n`;
  const params = '  {"constructor":"4","toString":false,"__proto__":{"keep":true},"futureParams":{"keep":[1,false]}}\n';
  const keys = ['emailcloak', 'pagebreak', 'loadmodule', 'pagenavigation'];
  const seed = keys.map((key, index) => ({ Id: index + 1, Title: key, Key: key, Type: 'Plugin', EntryPointUrl: `native:${key}`, Enabled: true, Ordering: index, ManifestJson: manifest, ParamsJson: params, '@odata.etag': `W/"form-native-${index}"` }));
  const { service, state } = pluginGroupStorageFixture(seed);
  const doc = extensionDocument();
  const app = createAdminApplication({ adminService: service, documentRef: doc.documentRef, autoStart: false });
  try {
    const before = structuredClone(state.items);
    await app.router.navigate('#/plugins?group=content');
    assert.deepEqual(state.items, before, 'tela real não migra nativos');
    for (const [index, key] of keys.entries()) {
      const id = index + 1;
      assert.match(doc.documentRef.body.innerHTML, new RegExp(`<code>${key}</code>`));
      const etag = (await service.plugins.get(id)).etag;
      await doc.find(`[data-ext-action="toggle"][data-ext-id="${id}"]`).fire('click');
      const write = state.requests.filter(({ method }) => method !== 'GET').at(-1);
      assert.deepEqual(write.body, { Enabled: false });
      assert.equal(write.etag, etag);
      assert.equal(state.items.get(id).ManifestJson, manifest);
      assert.equal(state.items.get(id).ParamsJson, params);
      assert.equal(Object.hasOwn(state.items.get(id), 'Folder'), false);
    }
    await app.router.navigate('#/plugins/1');
    assert.equal(doc.field('param:constructor').value, '4');
    assert.equal(doc.field('param:toString').checked, false);
    const renderedEtag = (await service.plugins.get(1)).etag;
    doc.field('param:constructor').value = '6';
    await doc.find('[data-ext-form="plugin"]').fire('submit');
    const write = state.requests.filter(({ method }) => method !== 'GET').at(-1);
    assert.equal(write.etag, renderedEtag);
    const stored = JSON.parse(state.items.get(1).ParamsJson);
    assert.equal(stored.constructor, 6);
    assert.deepEqual(stored.__proto__, { keep: true });
    assert.deepEqual(stored.futureParams, { keep: [1, false] });
    assert.ok(Object.hasOwn(stored, '__proto__'));
    assert.equal(state.items.get(1).ManifestJson, manifest);
    await app.router.navigate('#/plugins/1');
    const stale = (await service.plugins.get(1)).etag;
    await service.plugins.update(1, { ordering: 12 }, { etag: stale });
    const concurrent = structuredClone(state.items);
    doc.field('param:constructor').value = '8';
    await doc.find('[data-ext-form="plugin"]').fire('submit');
    assert.match(doc.report(), /Recarregue/);
    assert.deepEqual(state.items, concurrent);
    await app.router.navigate('#/installer');
    doc.field('manifest').value = JSON.stringify({ type: 'Plugin', title: 'Installed content', key: 'form-content', version: '1.0.0', entryPointUrl: './extensions/content.js', group: 'content' });
    await doc.find('[data-ext-form="install"]').fire('submit');
    const installed = (await service.plugins.list()).find((row) => row.key === 'form-content');
    assert.ok(installed, doc.report());
    assert.equal(installed.group, 'content');
    assert.equal(installed.enabled, false);
    assert.equal(Object.hasOwn(state.items.get(installed.id), 'Folder'), false);
    assert.equal(state.items.size, 5);
  } finally { app.stop(); }
  console.log('ok - admin extensions DOM: transporte estrito real rejeita Folder REST; quatro nativos/formulário/instalador mantêm grupo, JSON próprios e ETag renderizado');
}

export async function runAdminExtensionsAppTests() {
  await runPluginStorageFormTests();
  const repositories = extensionFixture();
  const service = createAdminService(repositories);
  const fake = extensionDocument();
  const app = createAdminApplication({ adminService: service, documentRef: fake.documentRef, autoStart: false });
  const html = () => fake.documentRef.body.innerHTML;

  // Painel e sidebar
  await app.router.navigate('#/');
  for (const route of ['#/plugins', '#/templates/styles', '#/installer', '#/options']) assert.match(html(), new RegExp(`href="${route}"`), `atalho ${route}`);
  assert.match(html(), /class="admin-overview-count">2<\/span><span class="admin-overview-label">Plugins/);
  console.log('ok - admin extensions DOM: painel e sidebar com as novas áreas');

  // Novo módulo: seleção de tipo + parâmetros + atribuição
  await app.router.navigate('#/moduleInstances/select');
  assert.match(html(), /href="#\/moduleInstances\/new\?type=articles-latest"/);
  assert.match(html(), /Module X/);
  await app.router.navigate('#/moduleInstances/new?type=articles-latest');
  assert.match(html(), /<optgroup label="Template ativo \(cassiopeia\)">/);
  assert.match(html(), /name="param:limit"/);
  assert.match(html(), /name="param:moduleClass"/);
  assert.match(html(), /value="menu:5"/);
  assert.match(html(), /value="category:noticias"/);
  fake.field('title').value = 'Recentes';
  fake.field('param:limit').value = '7';
  fake.field('param:moduleClass').value = 'card destaque';
  fake.field('showTitle').checked = false;
  fake.field('assignment').value = 'only';
  fake.find('[value="route:home"]').checked = true;
  fake.field('publishUp').value = '2026-01-01T08:00';
  await fake.find('[data-ext-form="module"]').fire('submit');
  const [createdModule] = (await service.moduleInstances.list()).filter((row) => row.title === 'Recentes');
  assert.ok(createdModule, fake.report());
  assert.equal(createdModule.extensionKey, 'articles-latest');
  assert.deepEqual(JSON.parse(createdModule.settingsJson), { limit: 7, moduleClass: 'card destaque', headerTag: 'h2', headerClass: '' });
  assert.equal(createdModule.showTitle, false);
  assert.equal(createdModule.assignment, 'only');
  assert.deepEqual(JSON.parse(createdModule.assignmentJson), ['route:home']);
  assert.equal(createdModule.publishUp, new Date('2026-01-01T08:00').toISOString());
  console.log('ok - admin extensions DOM: novo módulo com tipo, parâmetros, atribuição e agendamento');

  // Edição com validação e conflito
  await app.router.navigate(`#/moduleInstances/${createdModule.id}`);
  assert.match(html(), /value="7"/);
  fake.field('param:limit').value = '999';
  await fake.find('[data-ext-form="module"]').fire('submit');
  assert.match(fake.report(), /limit|Quantidade/i);
  await app.router.navigate(`#/moduleInstances/${createdModule.id}`);
  await service.moduleInstances.update(createdModule.id, { note: 'concorrente' }, { etag: (await service.moduleInstances.get(createdModule.id)).etag });
  fake.field('title').value = 'Outro';
  await fake.find('[data-ext-form="module"]').fire('submit');
  assert.match(fake.report(), /Recarregue/);
  console.log('ok - admin extensions DOM: edição de módulo valida parâmetros e trata conflito');

  // Lista: filtros, lote, duplicar
  await app.router.navigate('#/moduleInstances');
  assert.match(html(), /data-ext-select value="\d+"/);
  assert.match(html(), /Apenas nas páginas selecionadas \(1\)/);
  fake.find(`[data-ext-select][value="${createdModule.id}"]`).checked = true;
  fake.field('batchAction').value = 'move';
  fake.field('batchPosition').value = 'footer';
  await fake.find('[data-ext-batch]').fire('submit');
  assert.equal((await service.moduleInstances.get(createdModule.id)).position, 'footer');
  await app.router.navigate('#/moduleInstances');
  await fake.find(`[data-ext-action="duplicate"][data-ext-id="${createdModule.id}"]`).fire('click');
  assert.equal((await service.moduleInstances.list()).length, 2);
  await app.router.navigate('#/moduleInstances');
  fake.find(`[data-ext-select][value="${createdModule.id}"]`).checked = true;
  fake.field('batchAction').value = 'trash';
  await fake.find('[data-ext-batch]').fire('submit');
  await app.router.navigate('#/moduleInstances');
  assert.doesNotMatch(html(), new RegExp(`data-ext-select value="${createdModule.id}"`), 'lixeira oculta por padrão');
  await app.router.navigate('#/moduleInstances?state=trashed');
  assert.match(html(), new RegExp(`data-ext-action="restore" data-ext-id="${createdModule.id}"`));
  await app.router.navigate('#/moduleInstances?position=footer&state=*');
  assert.match(html(), /Recentes/);
  await app.router.navigate('#/templates/positions?template=cassiopeia');
  assert.match(html(), /Posições do template: cassiopeia/);
  assert.match(html(), /class="admin-position-box"/);
  console.log('ok - admin extensions DOM: lista de módulos com filtros, lote, lixeira, duplicar e posições');

  // Plugins
  await app.router.navigate('#/plugins?group=content');
  assert.match(html(), /Links/);
  assert.doesNotMatch(html(), />Audit</);
  await app.router.navigate('#/plugins/2');
  assert.match(html(), /name="param:maxLinks"/);
  fake.field('param:maxLinks').value = '6';
  fake.field('param:mode').value = 'b';
  fake.field('ordering').value = '9';
  await fake.find('[data-ext-form="plugin"]').fire('submit');
  assert.deepEqual(JSON.parse(repositories.extensions.rows.get(2).paramsJson), { maxLinks: 6, mode: 'b' });
  assert.equal(repositories.extensions.rows.get(2).ordering, 9);
  await app.router.navigate('#/plugins');
  fake.all('[data-ext-select]').forEach((input) => { input.checked = true; });
  await fake.find('[data-ext-action="batch-disable"]').fire('click');
  assert.ok((await service.plugins.list()).every((plugin) => plugin.enabled === false));
  console.log('ok - admin extensions DOM: plugins (filtro por grupo, parâmetros, ordem, lote)');

  // Plugins nativos: sempre listados; sem registro = desabilitado; habilitar cria o registro.
  await app.router.navigate('#/plugins');
  for (const key of ['emailcloak', 'pagebreak', 'loadmodule', 'pagenavigation']) assert.match(html(), new RegExp(`<code>${key}</code>`), `plugin nativo ${key} listado`);
  assert.match(html(), /Habilitar Conteúdo - Ocultar e-mails/);
  await fake.find('[data-ext-action="toggle"][data-ext-id="native:emailcloak"]').fire('click');
  const nativeRow = [...repositories.extensions.rows.values()].find((row) => row.key === 'emailcloak');
  assert.ok(nativeRow && nativeRow.type === 'Plugin' && nativeRow.enabled === true && nativeRow.entryPointUrl === 'native:emailcloak');
  await app.router.navigate('#/plugins');
  assert.match(html(), new RegExp(`data-ext-id="${nativeRow.id}"`));
  assert.equal([...repositories.extensions.rows.values()].filter((row) => row.key === 'emailcloak').length, 1);
  await fake.find(`[data-ext-action="toggle"][data-ext-id="${nativeRow.id}"]`).fire('click');
  assert.equal(repositories.extensions.rows.get(nativeRow.id).enabled, false);
  await assert.rejects(() => service.extensions.remove(nativeRow.id, { etag: repositories.extensions.rows.get(nativeRow.id).etag }), /nativos/);
  console.log('ok - admin extensions DOM: plugins nativos (listagem, habilitar cria registro, sem exclusão)');

  // Estilos de template
  await app.router.navigate('#/templates/styles');
  assert.match(html(), /aria-label="Estilo padrão do site"/);
  await fake.find('[data-ext-action="duplicate"][data-ext-id="cassiopeia-default"]').fire('click');
  assert.match(html(), /name="param:colorName"/);
  fake.field('param:colorName').value = 'alternative';
  fake.field('param:siteTitle').value = 'Portal';
  await fake.find('[data-ext-form="style"]').fire('submit');
  await app.router.navigate('#/templates/styles');
  await fake.find('[data-ext-action="default"][data-ext-id="cassiopeia-2"]').fire('click');
  const overrides = service.siteConfig.toConfigOverrides(await service.siteConfig.get());
  assert.equal(overrides.templateStyleId, 'cassiopeia-2');
  assert.equal(overrides.templateParams.siteTitle, 'Portal');
  assert.equal(overrides.templateParams.colorName, 'alternative');
  console.log('ok - admin extensions DOM: estilos (duplicar, editar parâmetros, definir padrão)');

  // Opções de componente
  await app.router.navigate('#/options');
  assert.match(html(), /href="#\/options\/content"/);
  await app.router.navigate('#/options/content');
  fake.field('param:listLimit').value = '12';
  await fake.find('[data-ext-form="options"]').fire('submit');
  assert.equal(service.siteConfig.toConfigOverrides(await service.siteConfig.get()).componentParams.content.listLimit, 12);
  console.log('ok - admin extensions DOM: opções de componente');

  // Tags are a read-only compatibility surface, not an operational form.
  repositories.siteConfig.rows.get(1).componentParamsJson = JSON.stringify({ content: { listLimit: 12 }, tags: { showTagTitle: false, tagListLimit: 7, advanced: { preserve: true } } });
  const unavailableSnapshot = structuredClone(repositories.siteConfig.rows.get(1));
  await app.router.navigate('#/options');
  assert.match(html(), /Opções de tags indisponíveis/);
  await app.router.navigate('#/options/tags');
  assert.match(html(), /<fieldset disabled>/);
  assert.match(html(), /Salvar indisponível/);
  assert.match(html(), /não há página pública de tags/);
  assert.equal(fake.field('param:tagListLimit').value, '7');
  fake.field('param:tagListLimit').value = '42';
  await fake.find('[data-ext-form="options"]').fire('submit');
  assert.deepEqual(repositories.siteConfig.rows.get(1), unavailableSnapshot);
  assert.doesNotMatch(fake.report(), /salv/i);
  console.log('ok - admin extensions DOM: tags options explicitly unavailable, synthetic submit preserves data/ETag');

  // Instalador
  await app.router.navigate('#/installer');
  assert.match(html(), /Instalar por manifesto declarativo/);
  fake.field('manifest').value = '{"type":"Plugin","key":"evil","title":"E","version":"1","entryPointUrl":"javascript:alert(1)"}';
  await fake.find('[data-ext-form="install"]').fire('submit');
  assert.match(fake.report(), /entryPointUrl|URL/i);
  fake.field('manifest').value = JSON.stringify({ type: 'Module', key: 'clock', title: 'Relógio', version: '2.0.0', entryPointUrl: './extensions/clock.js' });
  await fake.find('[data-ext-action="preview"]').fire('click');
  assert.match(fake.report(), /Manifesto válido/);
  await fake.find('[data-ext-form="install"]').fire('submit');
  const clock = (await service.extensions.list()).find((row) => row.key === 'clock');
  assert.equal(clock.enabled, false);
  await app.router.navigate('#/installer?kind=Module&q=clock');
  await fake.find('[data-ext-action="toggle"]').fire('click');
  assert.equal((await service.extensions.get(clock.id)).enabled, true);
  console.log('ok - admin extensions DOM: instalador (validar, rejeitar URL insegura, instalar, habilitar)');

  // Configuração global: novas abas
  await app.router.navigate('#/config');
  for (const name of ['homeView', 'homeCategory', 'offline', 'offlineMessage', 'metaDescription', 'robots', 'sitenamePagetitles']) assert.match(html(), new RegExp(`name="${name}"`), name);
  assert.match(html(), /Metadados e SEO indisponíveis/);
  for (const name of ['metaDescription', 'metaKeywords', 'robots', 'sitenamePagetitles']) assert.ok('disabled' in fake.field(name).attrs, `${name} is explicitly disabled`);
  assert.equal('disabled' in fake.field('offline').attrs, false);
  assert.equal(fake.find('[data-admin-form="site-config"]').attrs['data-admin-form'], 'site-config', 'keep current app submit/editor lifecycle');
  const seoValues = { metaDescription: '  Existing description  ', metaKeywords: 'one,two', robots: 'index, follow', sitenamePagetitles: 'before' };
  Object.assign(repositories.siteConfig.rows.get(1), seoValues);
  await app.router.navigate('#/config');
  fake.field('siteName').value = 'Operational config';
  fake.field('pageSize').value = '10';
  await fake.find('[data-admin-form="site-config"]').fire('submit');
  assert.equal(repositories.siteConfig.rows.get(1).siteName, 'Operational config');
  for (const [field, value] of Object.entries(seoValues)) {
    assert.equal(repositories.siteConfig.rows.get(1)[field], value);
    assert.equal(field in repositories.siteConfig.lastPatch, false, `${field} must not be reserialized in an operational save`);
  }
  console.log('ok - admin extensions DOM: operational global config retains current lifecycle with SEO controls explicitly disabled');
  app.stop();

  // Persisted corruption must produce a visible, escaped error, not default
  // fields that invite a destructive save or an unrelated administrative 404.
  for (const [field, routes] of [
    ['componentParamsJson', ['#/options/content', '#/options/search']],
    ['templateStylesJson', ['#/templates/styles', '#/templates/styles/cassiopeia-default', '#/templates/positions']]
  ]) {
    const corruptRepositories = extensionFixture();
    corruptRepositories.siteConfig.rows.get(1)[field] = '{not-json<script>';
    const snapshot = structuredClone(corruptRepositories.siteConfig.rows.get(1));
    const corruptDocument = extensionDocument();
    const corruptApp = createAdminApplication({ adminService: createAdminService(corruptRepositories), documentRef: corruptDocument.documentRef, autoStart: false });
    try {
      await corruptApp.start();
      for (const route of routes) {
        await corruptApp.router.navigate(route);
        const errorHtml = corruptDocument.documentRef.body.innerHTML;
        assert.match(errorHtml, /role="alert"/);
        assert.match(errorHtml, new RegExp(field));
        assert.match(errorHtml, /Nenhum dado foi alterado/);
        assert.doesNotMatch(errorHtml, /data-ext-form|data-ext-action|<script>|Página administrativa não encontrada/);
        assert.deepEqual(corruptRepositories.siteConfig.rows.get(1), snapshot);
        assert.equal(corruptRepositories.siteConfig.lastPatch, null);
      }
    } finally { corruptApp.stop(); }
  }
  console.log('ok - admin extensions DOM: corrupt persisted options/styles show a safe alert without default forms, actions or writes');
  for (const patch of [
    { paramsJson: '{broken<script>' },
    { paramsJson: '{"maxLinks":999,"mode":"invalid"}' },
    { manifestJson: '{broken<script>' },
    { manifestJson: '{"params":[{"name":"bad name"}]}' }
  ]) {
    const repositories = extensionFixture();
    Object.assign(repositories.extensions.rows.get(2), patch);
    const before = structuredClone([...repositories.extensions.rows.entries()]);
    const doc = extensionDocument();
    const app = createAdminApplication({ adminService: createAdminService(repositories), documentRef: doc.documentRef, autoStart: false });
    try {
      for (const route of ['#/plugins', '#/plugins/2']) {
        await app.router.navigate(route);
        assert.match(doc.documentRef.body.innerHTML, /role="alert"/);
        assert.doesNotMatch(doc.documentRef.body.innerHTML, /data-ext-form|data-ext-action|<script>/);
        assert.deepEqual([...repositories.extensions.rows.entries()], before);
        assert.equal(repositories.extensions.lastPatch, null);
      }
    } finally { app.stop(); }
  }
  console.log('ok - admin extensions DOM: corrupt plugin params/manifests prevent default forms and actions');
  for (const domain of ['siteConfig', 'templates']) {
    const failedRepositories = extensionFixture();
    const failedService = createAdminService(failedRepositories);
    const created = await failedService.moduleInstances.create({ title: 'Persistido antes da recarga', extensionKey: 'search', position: 'search', enabled: true });
    const originalFindMany = failedRepositories[domain].findMany;
    const before = structuredClone(Object.fromEntries(Object.entries(failedRepositories).map(([key, repo]) => [key, [...repo.rows.entries()]])));
    failedRepositories[domain].findMany = async () => { throw new Error('private backend <script>details</script>'); };
    const failedDocument = extensionDocument();
    const failedApp = createAdminApplication({ adminService: failedService, documentRef: failedDocument.documentRef, autoStart: false });
    try {
      for (const route of ['#/moduleInstances', '#/moduleInstances/new?type=articles-latest', '#/templates/positions']) {
        await failedApp.router.navigate(route);
        const errorHtml = failedDocument.documentRef.body.innerHTML;
        assert.match(errorHtml, /role="alert">Não foi possível carregar os dados administrativos/);
        assert.match(errorHtml, /verifique o registro após recarregar antes de repeti-la/);
        assert.doesNotMatch(errorHtml, /Nenhum dado foi alterado|private backend|<script>|data-ext-form|data-ext-action|admin-position-box|data-ext-batch/);
        assert.deepEqual(Object.fromEntries(Object.entries(failedRepositories).map(([key, repo]) => [key, [...repo.rows.entries()]])), before);
      }
      failedRepositories[domain].findMany = originalFindMany;
      await failedApp.router.navigate('#/moduleInstances');
      assert.match(failedDocument.documentRef.body.innerHTML, /Persistido antes da recarga/);
      assert.doesNotMatch(failedDocument.documentRef.body.innerHTML, /Falha no carregamento/);
      assert.equal((await failedService.moduleInstances.get(created.id)).title, 'Persistido antes da recarga');
    } finally { failedApp.stop(); }
  }
  console.log('ok - admin extensions DOM: configured repository outages show safe alerts without fallback positions or actionable forms');

  for (const [domain, rowId, field, value, routes] of [
    ['moduleInstances', 1, 'settingsJson', '{broken<script>', ['#/moduleInstances/1']],
    ['moduleInstances', 1, 'settingsJson', '{"limit":999}', ['#/moduleInstances/1']],
    ['moduleInstances', 1, 'assignmentJson', '{broken', ['#/moduleInstances', '#/moduleInstances/1']],
    ['extensions', 1, 'manifestJson', '{broken<script>', ['#/moduleInstances', '#/moduleInstances/select', '#/moduleInstances/1', '#/installer']],
    ['extensions', 1, 'manifestJson', '{"params":[{"name":"color","type":"eval"}]}', ['#/moduleInstances/select', '#/moduleInstances/1']],
    ['templates', 8, 'positionsJson', '{broken<script>', ['#/moduleInstances', '#/moduleInstances/1', '#/templates/styles', '#/templates/positions']]
  ]) {
    const repos = extensionFixture();
    repos.moduleInstances.rows.set(1, { id: 1, etag: '"1"', title: 'Stored', extensionKey: 'articles-latest', position: 'footer' });
    repos.templates.rows.set(8, { id: 8, etag: '"1"', title: 'Registered', key: 'registered', positionsJson: '["footer"]', enabled: true });
    repos[domain].rows.get(rowId)[field] = value;
    const before = structuredClone(Object.fromEntries(Object.entries(repos).map(([key, repo]) => [key, [...repo.rows.entries()]])));
    const doc = extensionDocument();
    const invalidApp = createAdminApplication({ adminService: createAdminService(repos), documentRef: doc.documentRef, autoStart: false });
    try {
      for (const route of routes) {
        await invalidApp.router.navigate(route);
        assert.match(doc.documentRef.body.innerHTML, /role="alert"/);
        assert.doesNotMatch(doc.documentRef.body.innerHTML, /data-ext-form|data-ext-action|data-ext-batch|<script>/);
        assert.deepEqual(Object.fromEntries(Object.entries(repos).map(([key, repo]) => [key, [...repo.rows.entries()]])), before);
      }
    } finally { invalidApp.stop(); }
  }
  for (const domain of ['menu', 'categories']) {
    for (const findMany of [async () => { throw new Error('private transport'); }, async () => ({ items: null })]) {
      const repos = extensionFixture();
      repos[domain].findMany = findMany;
      const before = structuredClone([...repos.moduleInstances.rows.entries()]);
      const doc = extensionDocument();
      const failedApp = createAdminApplication({ adminService: createAdminService(repos), documentRef: doc.documentRef, autoStart: false });
      try {
        await failedApp.router.navigate('#/moduleInstances/new?type=articles-latest');
        assert.match(doc.documentRef.body.innerHTML, /role="alert">Não foi possível carregar/);
        assert.doesNotMatch(doc.documentRef.body.innerHTML, /data-ext-form|private transport/);
        assert.deepEqual([...repos.moduleInstances.rows.entries()], before);
      } finally { failedApp.stop(); }
    }
  }
  console.log('ok - admin extensions DOM: invalid settings/assignment/manifests/positions and failed assignment catalogs never invite destructive default saves');

  // Tokens outside the current catalog remain selected and legacy scope is
  // not silently converted to all while editing an unrelated module field.
  for (const legacy of [false, true]) {
    const repos = extensionFixture();
    repos.moduleInstances.rows.set(1, { id: 1, etag: '"1"', title: 'Preserve', extensionKey: 'search', position: 'search', settingsJson: '{"advanced":{"keep":true}}', ...(legacy ? { scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias: 'noticias' } : { assignment: 'only', assignmentJson: '["menu:999","category:missing"]' }) });
    const doc = extensionDocument();
    const preserveApp = createAdminApplication({ adminService: createAdminService(repos), documentRef: doc.documentRef, autoStart: false });
    try {
      await preserveApp.router.navigate('#/moduleInstances/1');
      if (legacy) assert.equal(doc.field('assignment').value, '');
      else for (const token of ['menu:999', 'category:missing']) assert.equal(doc.find(`[name="assignmentToken"][value="${token}"]`).checked, true);
      doc.field('title').value = 'Changed';
      await doc.find('[data-ext-form="module"]').fire('submit');
      const row = repos.moduleInstances.rows.get(1);
      assert.equal(row.title, 'Changed');
      assert.deepEqual(JSON.parse(row.settingsJson).advanced, { keep: true });
      if (legacy) {
        assert.equal(row.assignment, undefined);
        assert.equal(row.scopeCategoryAlias, 'noticias');
      } else assert.deepEqual(JSON.parse(row.assignmentJson), ['menu:999', 'category:missing']);
    } finally { preserveApp.stop(); }
  }
  console.log('ok - admin extensions DOM: saving unrelated module fields preserves legacy scope, uncatalogued assignment tokens and advanced settings');

  for (const titleSetting of [undefined, '', 'Specific title']) {
    const repos = extensionFixture();
    repos.moduleInstances.rows.set(1, { id: 1, etag: '"1"', title: 'Legacy HTML title', extensionKey: 'custom-html', position: 'sidebar-right', enabled: true, settingsJson: JSON.stringify({ html: '<p>Body</p>', ...(titleSetting === undefined ? {} : { title: titleSetting }) }) });
    const admin = createAdminService(repos);
    const doc = extensionDocument();
    const adminApp = createAdminApplication({ adminService: admin, documentRef: doc.documentRef, autoStart: false });
    async function publicHtml() {
      const documentRef = { body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } };
      const publicApp = createApplication({ autoStart: false, documentRef, config: { templateKey: 'cassiopeia' }, adapter: createSPMiddleAdapter({ articleRepository: repos.articles, categoryRepository: repos.categories, tagRepository: repos.tags, menuRepository: repos.menu }), getModuleInstances: () => admin.moduleInstances.list() });
      try { await publicApp.start(); return documentRef.body.innerHTML; } finally { publicApp.stop(); }
    }
    try {
      await adminApp.router.navigate('#/moduleInstances/1');
      assert.equal(doc.field('param:title').value, titleSetting ?? 'Legacy HTML title');
      doc.field('param:headerTag').value = 'p';
      doc.field('param:headerClass').value = 'native-title';
      await doc.find('[data-ext-form="module"]').fire('submit');
      const savedTitle = titleSetting ?? 'Legacy HTML title';
      assert.equal(JSON.parse(repos.moduleInstances.rows.get(1).settingsJson).title, savedTitle);
      const visible = await publicHtml();
      if (savedTitle) assert.ok(visible.includes(`<p class="native-title">${savedTitle}</p>`));
      else assert.doesNotMatch(visible, /class="native-title"/);
      await adminApp.router.navigate('#/moduleInstances/1');
      doc.field('showTitle').checked = false;
      await doc.find('[data-ext-form="module"]').fire('submit');
      assert.doesNotMatch(await publicHtml(), /class="native-title"/);
    } finally { adminApp.stop(); }
  }
  {
    const repos = extensionFixture();
    const doc = extensionDocument();
    const app = createAdminApplication({ adminService: createAdminService(repos), documentRef: doc.documentRef, autoStart: false });
    try {
      await app.router.navigate('#/moduleInstances/new?type=custom-html');
      doc.field('title').value = 'New HTML title';
      doc.field('param:html').value = '<p>New body</p>';
      await doc.find('[data-ext-form="module"]').fire('submit');
      assert.equal(JSON.parse([...repos.moduleInstances.rows.values()][0].settingsJson).title, 'New HTML title');
    } finally { app.stop(); }
  }
  console.log('ok - admin extensions DOM: custom HTML title fallback persists through the current form to the public runtime and respects title chrome');
  await runOwnParamFormsRegressionTests();
  await runModuleScheduleFormTests();
  await runPublishedParameterFormTests();
}
