import assert from 'node:assert/strict';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { PARAM_TYPES, coerceParam, defaultParamValues, normalizeParamDefinitions, normalizeParamValues, parseJsonObject } from '../src/libraries/minijoomla/application/declared-params.js';
import { moduleTypeCatalog } from '../src/libraries/minijoomla/application/module-catalog.js';
import { renderParamField, readParamInputs } from '../src/administrator/components/com_minijoomla/extension-pages.js';

// Synthetic published-manifest shapes only: no tenant URLs, IDs or data.
export const PUBLISHED_PARAMETER_DEFINITIONS = [
  { name: 'items', type: 'json', valueType: 'array', label: 'Menu items', description: 'Each item has a title and link.', maxLength: 2000, default: [] },
  { name: 'bandTones', type: 'json', valueType: 'object', label: 'Band tones', maxLength: 500, default: { main: '#112233' } },
  { name: 'target', type: 'url', label: 'Target', maxLength: 120, default: '#/home' },
  { name: 'caption', type: 'text', label: 'Caption', maxLength: 12, default: 'Menu' },
  { name: 'details', type: 'textarea', label: 'Details', maxLength: 20, default: '' },
  { name: 'ratio', type: 'number', label: 'Ratio', min: 0, max: 5, default: 1.5 }
];
export const PUBLISHED_PARAMETER_VALUES = {
  items: [{ title: 'Home', href: '#/home', children: [{ title: 'More', href: '/pages/more' }] }],
  bandTones: { main: '#223344', alternate: { color: '#445566' } },
  target: '/pages/menu#section', caption: 'New menu', details: 'Menu details', ratio: 2.25
};

export function invalidPublishedParameterValues() {
  return [
    { items: '{broken<script>' }, { items: '{}' }, { bandTones: '[]' },
    ...['__proto__', 'constructor', 'prototype'].flatMap((key) => [
      { items: `[{"nested":{"${key}":{"polluted":true}}}]` },
      { bandTones: `{"nested":{"${key}":{"polluted":true}}}` }
    ]),
    { items: JSON.stringify([{ title: 'x'.repeat(2000) }]) },
    { bandTones: JSON.stringify({ main: 'x'.repeat(500) }) },
    { target: 'x'.repeat(121) }, { caption: 'x'.repeat(13) }, { details: 'x'.repeat(21) },
    { target: 'javascript:alert(1)' }, { ratio: 'NaN' }
  ];
}

export function runPublishedParameterCompatTests() {
  assert.ok(PARAM_TYPES.includes('json'));
  const definitions = normalizeParamDefinitions(PUBLISHED_PARAMETER_DEFINITIONS);
  const catalog = moduleTypeCatalog([{ key: 'published-menu', title: 'Published menu', type: 'Module', manifestJson: JSON.stringify({ params: PUBLISHED_PARAMETER_DEFINITIONS }) }]);
  assert.deepEqual(catalog.find((type) => type.key === 'published-menu').params, definitions, 'persisted module-catalog fields keep JSON array/object shapes');
  const values = normalizeParamValues(definitions, PUBLISHED_PARAMETER_VALUES);
  assert.deepEqual(values, PUBLISHED_PARAMETER_VALUES);
  assert.notEqual(values.items, PUBLISHED_PARAMETER_VALUES.items);
  assert.notEqual(values.items[0].children, PUBLISHED_PARAMETER_VALUES.items[0].children);
  assert.notEqual(values.bandTones.alternate, PUBLISHED_PARAMETER_VALUES.bandTones.alternate);
  assert.deepEqual(normalizeParamValues(definitions, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, ['items', 'bandTones'].includes(key) ? JSON.stringify(value, null, 2) : value]))), values);
  for (const input of invalidPublishedParameterValues()) assert.throws(() => normalizeParamValues(definitions, input), ValidationError);

  for (const type of ['text', 'textarea', 'url', 'json']) {
    for (const maxLength of [0, -1, 1.5, '5', NaN, Infinity, 20001]) assert.throws(() => normalizeParamDefinitions([{ name: 'field', type, maxLength, ...(type === 'json' ? { valueType: 'object' } : {}) }]), ValidationError);
  }
  for (const valueType of [undefined, 'string', 'number', {}, []]) assert.throws(() => normalizeParamDefinitions([{ name: 'field', type: 'json', valueType }]), ValidationError);
  assert.throws(() => normalizeParamDefinitions([{ name: 'field', type: 'number', min: 2, max: 1 }]), ValidationError);
  assert.throws(() => coerceParam({ name: 'field', type: 'text' }, 'x'.repeat(20001)), ValidationError);
  assert.throws(() => coerceParam({ name: 'field', type: 'url' }, 'x'.repeat(20001)), ValidationError);
  assert.throws(() => coerceParam({ name: 'field', type: 'json', valueType: 'array' }, ' '.repeat(200001) + '[]'), ValidationError);
  const compact = normalizeParamDefinitions([{ name: 'field', type: 'json', valueType: 'object', maxLength: 7, default: { a: 1 } }])[0];
  assert.deepEqual(coerceParam(compact, '  {\n  "a": 1\n}  '), { a: 1 }, 'JSON maxLength counts compact data, not editor formatting');
  assert.doesNotMatch(renderParamField('compact', compact, compact.default), /maxlength=/);
  for (const path of ['', '#', '#/home', '/pages/home#section', './home', '../home', 'home?tab=1#section', 'https://example.invalid/path#section']) assert.equal(coerceParam({ name: 'target', type: 'url' }, path), path);
  assert.equal(coerceParam({ name: 'target', type: 'url' }, '  #/home  '), '#/home');
  for (const path of ['//example.invalid', 'http://example.invalid', 'javascript:alert(1)', 'https://user:password@example.invalid', '/a b', '/a\\b', '/a\u0000', '/a"', '/a<']) assert.throws(() => coerceParam({ name: 'target', type: 'url' }, path), ValidationError);

  const defaults = defaultParamValues(definitions);
  defaults.items.push({ title: 'Changed' });
  defaults.bandTones.main = '#ffffff';
  assert.deepEqual(defaultParamValues(definitions).items, []);
  assert.deepEqual(defaultParamValues(definitions).bandTones, { main: '#112233' });
  const original = { name: 'settings', type: 'json', valueType: 'object', default: { deep: { values: [1, false] } } };
  const normalized = normalizeParamDefinitions([original]);
  original.default.deep.values.push('changed');
  const first = normalizeParamValues(normalized);
  first.settings.deep.values.push('also changed');
  assert.deepEqual(normalizeParamValues(normalized), { settings: { deep: { values: [1, false] } } });

  const unknown = JSON.parse('{"__proto__":{"polluted":true,"nested":{"constructor":{"prototype":{"keep":[1,false]}}}},"constructor":{"prototype":{"keep":true}},"prototype":false,"future":{"nested":[{"keep":true}]}}');
  for (const result of [parseJsonObject(unknown, { strict: true }), normalizeParamValues([], unknown, { keepUndeclared: true })]) {
    assert.deepEqual(result, unknown);
    assert.ok(Object.hasOwn(result, '__proto__'));
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(result.polluted, undefined);
    assert.notEqual(result.__proto__, unknown.__proto__);
    result.__proto__.nested.constructor.prototype.keep.push('changed');
    result.future.nested[0].keep = false;
  }
  assert.deepEqual(unknown.__proto__.nested.constructor.prototype.keep, [1, false]);
  assert.equal(unknown.future.nested[0].keep, true);
  assert.equal({}.polluted, undefined);
  for (const name of ['constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']) {
    const own = normalizeParamDefinitions([{ name, default: 'own' }]);
    assert.deepEqual(normalizeParamValues(own, {}), { [name]: 'own' });
    assert.deepEqual(normalizeParamValues(own, { [name]: 'explicit' }), { [name]: 'explicit' });
  }
  assert.throws(() => normalizeParamDefinitions([{ name: '__proto__' }]), ValidationError);
  const ownJsonName = normalizeParamDefinitions([{ name: 'constructor', type: 'json', valueType: 'object', default: { safe: [1, false] } }]);
  assert.deepEqual(normalizeParamValues(ownJsonName, {}), { constructor: { safe: [1, false] } }, 'reserved own field name is distinct from unsafe keys inside its structured value');
  assert.throws(() => normalizeParamValues(ownJsonName, { constructor: JSON.parse('{"nested":{"constructor":{"prototype":{"polluted":true}}}}') }), ValidationError);

  let executed = 0;
  const getter = () => { executed += 1; return 'getter ran'; };
  const accessor = (key, enumerable = true) => Object.defineProperty({}, key, { get: getter, enumerable });
  for (const value of [accessor('items'), accessor('unknown'), accessor('hidden', false), { nested: accessor('key') }, { toJSON: getter }, { nested: { toJSON: getter } }]) {
    assert.throws(() => parseJsonObject(value, { strict: true }), ValidationError);
    assert.deepEqual(parseJsonObject(value), {});
  }
  for (const value of [accessor('items'), accessor('unknown'), accessor('hidden', false)]) assert.throws(() => normalizeParamValues(definitions, value), ValidationError, 'top-level accessors fail closed, even unknown keys');
  assert.throws(() => normalizeParamValues(definitions, { items: [accessor('title')] }), ValidationError);
  assert.throws(() => normalizeParamValues([], { future: { toJSON: getter } }, { keepUndeclared: true }), ValidationError);
  assert.throws(() => normalizeParamDefinitions([accessor('name')]), ValidationError);
  const withDefaultGetter = { name: 'x' };
  Object.defineProperty(withDefaultGetter, 'default', { get: getter, enumerable: true });
  assert.throws(() => normalizeParamDefinitions([withDefaultGetter]), ValidationError);
  const option = accessor('value');
  assert.throws(() => normalizeParamDefinitions([{ name: 'x', type: 'select', options: [option] }]), ValidationError);
  const arrayAccessor = [];
  Object.defineProperty(arrayAccessor, '0', { get: getter, enumerable: true });
  assert.throws(() => coerceParam(definitions[0], arrayAccessor), ValidationError);
  const inherited = Object.create({ get items() { return getter(); }, get constructor() { return getter(); } });
  assert.deepEqual(normalizeParamValues(definitions, inherited), defaultParamValues(definitions), 'non-plain inherited values are ignored, not executed');
  for (const value of [new Date(), new Map(), new Set(), inherited, Object.assign(Object.create({}), { own: true })]) assert.throws(() => parseJsonObject(value, { strict: true }), ValidationError);
  assert.equal(executed, 0, 'normalizers and cloning never invoke getters/toJSON');

  const cycle = {}; cycle.self = cycle;
  const tooDeep = {}; let cursor = tooDeep;
  for (let depth = 0; depth < 34; depth += 1) cursor = cursor.next = {};
  const sparse = new Array(2); sparse[1] = 'x';
  const extraArray = []; extraArray.extra = true;
  const symbolKey = { [Symbol('key')]: true };
  const hidden = Object.defineProperty({}, 'key', { value: true });
  for (const value of [cycle, tooDeep, { bad: Infinity }, { bad: NaN }, { bad: undefined }, { bad: 1n }, { bad: getter }, symbolKey, hidden, { nested: new Date() }, { nested: sparse }, { nested: extraArray }, { many: Array.from({ length: 50001 }, () => null) }]) {
    assert.throws(() => coerceParam(definitions[1], value), ValidationError);
    assert.throws(() => parseJsonObject(value, { strict: true }), ValidationError);
  }
  assert.deepEqual(parseJsonObject(Object.assign(Object.create(null), { safe: { value: true } }), { strict: true }), { safe: { value: true } });
  const shared = { value: true };
  assert.deepEqual(coerceParam(definitions[1], { left: shared, right: shared }), { left: { value: true }, right: { value: true } }, 'shared references are not cycles');
  const hostilePrimitive = { valueOf: getter, toString: getter };
  assert.throws(() => coerceParam({ name: 'x', type: 'number' }, hostilePrimitive), ValidationError);
  assert.throws(() => coerceParam({ name: 'x', type: 'text' }, hostilePrimitive), ValidationError);
  assert.throws(() => normalizeParamDefinitions([{ name: 'x', type: 'number', min: hostilePrimitive }]), ValidationError);
  assert.throws(() => normalizeParamDefinitions([{ name: 'x', label: hostilePrimitive }]), ValidationError);
  assert.equal(executed, 0);

  const urlHtml = renderParamField('compat', definitions[2], '#/home');
  assert.match(urlHtml, /type="text"/);
  assert.match(urlHtml, /inputmode="url"/);
  assert.doesNotMatch(urlHtml, /type="url"/);
  assert.match(urlHtml, /maxlength="120"/);
  assert.match(urlHtml, /aria-describedby="admin-param-compat-target-help"/);
  assert.match(urlHtml, /Caminho relativo, rota # ou URL HTTPS/);
  const jsonHtml = renderParamField('compat', definitions[0], values.items);
  assert.match(jsonHtml, /<textarea[^>]*data-ext-param="json"[^>]*spellcheck="false"[^>]*rows="8"/);
  assert.match(jsonHtml, /Each item has a title and link/);
  assert.match(jsonHtml, /JSON: lista \(array\)/);
  assert.match(renderParamField('compat', definitions[1], values.bandTones), /JSON: objeto/);
  assert.match(renderParamField('compat', definitions[4], ''), /maxlength="20"[^>]*rows="5"/);
  assert.match(renderParamField('compat', definitions[5], 2.25), /min="0" max="5" step="any"/);
  const controls = { ratio: { value: '' }, items: { value: '[{"title":"Home"}]' }, bandTones: { value: '{"main":"#112233"}' } };
  const form = { querySelector: (selector) => controls[selector.match(/param:([^"\]]+)/)?.[1]] };
  assert.deepEqual(readParamInputs(form, definitions), { ratio: '', items: '[{"title":"Home"}]', bandTones: '{"main":"#112233"}' });
  assert.equal(normalizeParamValues(definitions, readParamInputs(form, definitions)).ratio, 1.5);
  controls.ratio.value = 'invalid';
  assert.equal(readParamInputs(form, definitions).ratio, 'invalid');
  assert.throws(() => normalizeParamValues(definitions, readParamInputs(form, definitions)), ValidationError);
  console.log('ok - published parameter compatibility: JSON shapes, maxLength, defaults/deep isolation, URL/hash controls and non-executing clone guards');
}
