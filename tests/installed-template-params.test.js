import assert from 'node:assert/strict';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { defaultParamValues, normalizeParamDefinitions } from '../src/libraries/minijoomla/application/declared-params.js';
import { BUILTIN_TEMPLATES, effectiveTemplateStyles, parseTemplateStyles, resolveTemplateParams, resolveTemplateStyleId, templateParamDefinitions, validateTemplateStyles } from '../src/libraries/minijoomla/application/template-styles.js';

const DEFINITIONS = [
  { name: 'caption', type: 'text', maxLength: 12, default: 'Installed' },
  { name: 'details', type: 'textarea', maxLength: 20, default: 'Details' },
  { name: 'ratio', type: 'number', min: 0, max: 5, default: 1.5 },
  { name: 'enabled', type: 'checkbox', default: true },
  { name: 'layout', type: 'select', options: ['wide', 'compact'], default: 'wide' },
  { name: 'tone', type: 'color', default: '#AABBCC' },
  { name: 'target', type: 'url', maxLength: 100, default: '#/home' },
  { name: 'items', type: 'json', valueType: 'array', maxLength: 150, default: [] },
  { name: 'settings', type: 'json', valueType: 'object', maxLength: 150, default: { nested: { on: true } } }
];
const style = (params = {}, extra = {}) => ({ id: 'installed-home', template: 'installed', title: 'Installed home', home: true, params, ...extra });
const config = (styles = []) => ({ templateKey: 'installed', templateStylesJson: styles });
const rejectData = (error) => error instanceof ValidationError || error instanceof TypeError;

export function runInstalledTemplateParamsTests() {
  const definitions = templateParamDefinitions('installed', DEFINITIONS);
  const byKey = { installed: DEFINITIONS };
  const defaults = defaultParamValues(definitions);
  assert.deepEqual(definitions, normalizeParamDefinitions(DEFINITIONS));
  assert.deepEqual(templateParamDefinitions('installed', JSON.stringify(DEFINITIONS)), definitions);
  assert.deepEqual(templateParamDefinitions('installed'), []);
  for (const key of ['constructor', 'prototype', '__proto__', 'toString', 'valueOf']) assert.deepEqual(templateParamDefinitions(key), [], 'no inherited built-in definitions');
  for (const key of BUILTIN_TEMPLATES) assert.equal(templateParamDefinitions(key, '{broken'), templateParamDefinitions(key), 'static definitions always win');

  const virtual = effectiveTemplateStyles([], ['installed'], { installed: 'Custom' }, { strict: true }, byKey)[0];
  assert.equal(virtual.id, 'installed-default');
  assert.equal(virtual.title, 'Custom — Padrão');
  assert.equal(virtual.virtual, true);
  assert.deepEqual(virtual.params, defaults);
  assert.deepEqual(effectiveTemplateStyles([], ['installed'], {}, { strict: true, definitionsByKey: byKey })[0].params, defaults);
  assert.deepEqual(resolveTemplateParams(config(), DEFINITIONS), defaults);
  virtual.params.settings.nested.on = false;
  assert.equal(resolveTemplateParams(config(), DEFINITIONS).settings.nested.on, true, 'virtual defaults are detached');

  const future = JSON.parse('{"future":{"nested":[{"keep":true}]},"__proto__":{"polluted":true},"constructor":{"prototype":{"keep":[1,false]}},"prototype":false}');
  const input = [style({ ...future, caption: 'Saved', details: 'Saved details', ratio: '2.5', enabled: '0', layout: 'compact', tone: '#DDEEFF', target: '/page#intro', items: '[{"title":"Home"}]', settings: '{"nested":{"on":false}}' })];
  const before = structuredClone(input);
  const saved = JSON.parse(validateTemplateStyles(input, byKey));
  assert.deepEqual(saved[0].params, { ...future, caption: 'Saved', details: 'Saved details', ratio: 2.5, enabled: false, layout: 'compact', tone: '#ddeeff', target: '/page#intro', items: [{ title: 'Home' }], settings: { nested: { on: false } } });
  assert.deepEqual(input, before, 'validation does not mutate stored rows');
  const read = parseTemplateStyles(input, { strict: true, definitionsByKey: byKey });
  assert.deepEqual(read, input, 'strict reads validate without coercing stored types');
  read[0].params.future.nested[0].keep = false;
  assert.equal(input[0].params.future.nested[0].keep, true);
  const runtime = resolveTemplateParams(config(input), DEFINITIONS);
  assert.deepEqual(runtime, saved[0].params);
  assert.ok(Object.isFrozen(runtime));
  assert.equal(Object.getPrototypeOf(runtime), Object.prototype);
  assert.ok(Object.hasOwn(runtime, '__proto__'));
  assert.equal(runtime.polluted, undefined);
  runtime.future.nested.push('detached');
  assert.deepEqual(input, before);
  assert.equal({}.polluted, undefined);
  assert.equal(resolveTemplateStyleId(config(input)), 'installed-home');
  const secondary = style({ future: { exact: [1, false] }, caption: 42 }, { id: 'other-home', template: 'other' });
  const mixed = [input[0], secondary];
  const mixedRead = parseTemplateStyles(mixed, { strict: true, definitionsByKey: byKey });
  mixedRead[0].title = 'Retitled';
  assert.deepEqual(JSON.parse(validateTemplateStyles(mixedRead, byKey))[1], secondary, 'unrelated undeclared rows keep exact JSON value types');
  assert.deepEqual(resolveTemplateParams(config([style({ ...future })])), future, 'legacy installed templates keep arbitrary plain JSON');

  const invalidValues = [
    { caption: 'x'.repeat(13) }, { details: 'x'.repeat(21) }, { ratio: -1 }, { ratio: 6 }, { ratio: 'NaN' },
    { enabled: 'maybe' }, { layout: 'unknown' }, { tone: 'red' }, { target: 'javascript:alert(1)' },
    { target: 'http://example.invalid' }, { target: '//example.invalid' }, { target: 'x'.repeat(101) },
    { items: '{}' }, { items: '{bad' }, { items: JSON.stringify(['x'.repeat(150)]) }, { settings: '[]' },
    { settings: '{"nested":{"__proto__":{"polluted":true}}}' }
  ];
  for (const params of invalidValues) {
    assert.throws(() => validateTemplateStyles([style(params)], byKey), ValidationError);
    assert.throws(() => parseTemplateStyles([style(params)], { strict: true, definitionsByKey: byKey }), ValidationError);
    assert.throws(() => resolveTemplateParams(config([style(params)]), DEFINITIONS), ValidationError, 'invalid installed values never silently fall back');
  }
  const invalidDefinitions = [
    '{broken', {}, [{ name: '__proto__' }], [{ name: 'duplicate' }, { name: 'duplicate' }],
    [{ name: 'field', type: 'callback' }], [{ name: 'field', type: 'text', maxLength: 0 }],
    [{ name: 'field', type: 'number', min: 3, max: 1 }], [{ name: 'field', type: 'number', default: 'bad' }],
    [{ name: 'field', type: 'json' }], [{ name: 'field', type: 'select', options: [] }],
    [{ name: 'field', type: 'color', default: 'red' }]
  ];
  for (const metadata of invalidDefinitions) {
    assert.throws(() => templateParamDefinitions('installed', metadata), ValidationError);
    assert.throws(() => resolveTemplateParams(config(), metadata), ValidationError);
  }
  for (const name of ['constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']) {
    const ownDefinitions = [{ name, default: 'own' }];
    const result = resolveTemplateParams(config(), ownDefinitions);
    assert.deepEqual(result, { [name]: 'own' });
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
  }

  let calls = 0;
  const hook = () => { calls++; return 'executed'; };
  const accessor = (target, key) => Object.defineProperty(target, key, { enumerable: true, get: hook });
  const invalidLists = [new Array(1), accessor([], '0'), Object.assign([], { toJSON: hook }), Object.assign([], { extra: true }), Object.assign([], { [Symbol('extra')]: true }), Object.setPrototypeOf([], { toJSON: hook }), Object.defineProperty([style()], '0', { enumerable: false })];
  const inheritedStyle = Object.assign(Object.create({ id: 'inherited', template: 'installed' }), { title: 'Inherited' });
  const badRows = [accessor(style(), 'id'), accessor(style(), 'params'), style(accessor({}, 'future')), style({ toJSON: hook }), style({ nested: { toJSON: hook } }), inheritedStyle, style({ bad: Infinity }), style({ bad: undefined }), style(new Array(1)), style(null), style(''), style({}, { title: { toString: hook } })];
  const cycle = {}; cycle.self = cycle; badRows.push(style(cycle));
  for (const list of [...invalidLists, ...badRows.map((row) => [row]), '{broken', '{}', 'null']) {
    assert.throws(() => parseTemplateStyles(list, { strict: true, definitionsByKey: byKey }), rejectData);
    assert.throws(() => validateTemplateStyles(list, byKey), rejectData);
    assert.throws(() => resolveTemplateParams(config(list), DEFINITIONS), rejectData);
  }
  for (const list of invalidLists) assert.deepEqual(parseTemplateStyles(list), []);
  for (const metadata of [accessor([], '0'), [accessor({ name: 'field' }, 'default')], [{ name: 'field', label: { toString: hook } }]]) assert.throws(() => templateParamDefinitions('installed', metadata), rejectData);
  assert.throws(() => effectiveTemplateStyles([], ['installed'], {}, { strict: true }, accessor({}, 'installed')), rejectData);
  const inheritedMap = Object.create({ installed: DEFINITIONS });
  assert.deepEqual(effectiveTemplateStyles([], ['installed'], {}, { strict: true }, inheritedMap)[0].params, {}, 'inherited definition maps are ignored');
  assert.deepEqual(effectiveTemplateStyles([], ['cassiopeia'], {}, { strict: true }, accessor({}, 'cassiopeia'))[0].params, defaultParamValues(templateParamDefinitions('cassiopeia')));
  assert.throws(() => resolveTemplateParams(accessor(config(), 'templateKey'), DEFINITIONS), rejectData);
  assert.throws(() => resolveTemplateParams(accessor(config(), 'templateStylesJson'), DEFINITIONS), rejectData);
  assert.throws(() => effectiveTemplateStyles([], ['installed'], {}, accessor({}, 'definitionsByKey')), rejectData);
  assert.throws(() => effectiveTemplateStyles([], ['installed'], {}, accessor({}, 'strict'), byKey), rejectData);
  assert.deepEqual(resolveTemplateParams(Object.create({ templateKey: 'installed', templateStylesJson: input }), DEFINITIONS), {}, 'runtime ignores inherited configuration');
  assert.deepEqual(resolveTemplateParams({ ...config(), paramDefinitionsJson: JSON.stringify(DEFINITIONS) }), {}, 'future columns never supply ghost declarations');
  assert.equal(calls, 0, 'no getters, toJSON or primitive-coercion hooks executed');

  assert.deepEqual(parseTemplateStyles([], { strict: true }), []);
  for (const value of [undefined, null, '']) assert.deepEqual(parseTemplateStyles(value, { strict: true }), []);
  assert.throws(() => validateTemplateStyles([style(), style()]), ValidationError);
  assert.throws(() => validateTemplateStyles([style(), style({}, { id: 'second' })]), ValidationError);
  assert.throws(() => validateTemplateStyles(Array.from({ length: 101 }, (_, index) => style({}, { id: `s-${index}`, home: false }))), ValidationError);
  for (const key of BUILTIN_TEMPLATES) {
    assert.deepEqual(resolveTemplateParams({ templateKey: key }, '{broken'), defaultParamValues(templateParamDefinitions(key)));
    const builtinStyle = style({ future: { keep: true } }, { template: key });
    assert.deepEqual(JSON.parse(validateTemplateStyles([builtinStyle]))[0].params.future, { keep: true }, 'persisted unknown values survive even built-in style validation');
    assert.equal(resolveTemplateParams({ templateKey: key, templateStylesJson: [builtinStyle] }).future, undefined, 'built-in runtime retains its historical declared-only contract');
  }
  assert.equal(resolveTemplateParams({ templateKey: 'cassiopeia', templateStylesJson: [style({ colorName: 'invalid' }, { template: 'cassiopeia' })] }).colorName, 'standard', 'built-in fallback remains unchanged');
  console.log('ok - installed template params: typed declarations/defaults, strict pure cloning, unknown data preservation and built-in parity');
}
