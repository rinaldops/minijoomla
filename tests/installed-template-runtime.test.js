import assert from 'node:assert/strict';
import { createApplication } from '../src/libraries/minijoomla/index.js';
import { createTemplateRuntime } from '../src/libraries/minijoomla/application/template-runtime.js';
import { resolveModuleEntries, TEMPLATE_MODULE_POSITIONS } from '../src/libraries/minijoomla/modules/dynamic-modules.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import {packTemplateMetadata}from'../src/libraries/minijoomla/application/template-metadata.js';

function documentDouble(baseURI = 'https://site.invalid/examples/index.html') {
  const links = [];
  return { baseURI, body: { innerHTML: '' }, documentElement: {}, links,
    head: { appendChild: (link) => links.push(link) },
    createElement: () => ({ setAttribute(name, value) { this[name] = value; }, remove() { links.splice(links.indexOf(this), 1); } }) };
}
const record = (positionsJson = '["hero","notice-area"]') => ({ key: 'installed', enabled: true,
  entryPointUrl: '/templates/installed.js', styles: '["/templates/installed.css"]', positionsJson });
const shell = { renderShell: ({ content = '', modules = {} } = {}) => `<main>${content}</main><aside data-slot="hero">${modules.hero ?? ''}</aside><aside data-slot="notice-area">${modules['notice-area'] ?? ''}</aside>` };
const invalidContract = (error) => error instanceof TypeError || error instanceof ValidationError;

export async function runInstalledTemplateRuntimeTests() {
  const documentRef = documentDouble(), imports = [];
  const runtime = createTemplateRuntime({ documentRef, importModule: async (url) => { imports.push(url); return shell; } });
  const source = record(['hero', 'notice-area', 'hero']), before = structuredClone(source);
  const selected = await runtime.resolve('installed', [source]);
  assert.deepEqual(selected.positions, ['hero', 'notice-area']);
  assert.ok(Object.isFrozen(selected.positions));
  assert.notEqual(selected.positions, source.positionsJson);
  assert.deepEqual(source, before, 'runtime never normalizes the source record in place');
  source.positionsJson.push('future-slot');
  assert.deepEqual(selected.positions, ['hero', 'notice-area'], 'resolved metadata is detached');
  await runtime.resolve('installed', [record()]);
  assert.deepEqual((await runtime.resolve('installed', [record('["component","hero"]')])).positions, ['hero']);
  assert.deepEqual(imports, ['https://site.invalid/templates/installed.js']);
  runtime.applyStyles(selected);
  assert.equal(documentRef.links[0].href, 'https://site.invalid/templates/installed.css');

  const row = { extensionKey: 'custom-html', position: 'hero', enabled: true, settingsJson: '{"html":"<p>slot-html</p>"}' };
  const grouped = resolveModuleEntries([row], {}, new Date(), selected.positions);
  assert.equal(grouped.hero.length, 1);
  assert.equal(grouped.sidebar.length, 0);
  assert.equal(grouped.hero[0].settings.html, '<p>slot-html</p>');
  assert.deepEqual(row, { extensionKey: 'custom-html', position: 'hero', enabled: true, settingsJson: '{"html":"<p>slot-html</p>"}' });
  const legacy = resolveModuleEntries([row]);
  assert.deepEqual(Object.keys(legacy), ['sidebar', 'content', ...TEMPLATE_MODULE_POSITIONS]);
  assert.equal(legacy.sidebar[0].position, 'sidebar');
  assert.deepEqual(resolveModuleEntries([row], {}, new Date(), []), legacy);
  assert.equal(Object.hasOwn(resolveModuleEntries([row], {}, new Date(), ['notice-area']), 'hero'), false);

  let getterCalls = 0;
  const getterList = Object.defineProperty([], '0', { enumerable: true, get() { getterCalls++; return 'hero'; } });
  const hookList = Object.assign(['hero'], { toJSON() { getterCalls++; return ['hero']; } });
  const symbolList = Object.assign(['hero'], { [Symbol('unsafe')]: 'extra' });
  const inheritedList = Object.setPrototypeOf(['hero'], { toJSON() { getterCalls++; return ['hero']; } });
  const nonEnumerableList = Object.defineProperty(['hero'], '0', { enumerable: false });
  const emptyHookList = Object.assign([], { toJSON() { getterCalls++; return []; } });
  const invalidPositions = ['{', 'null', '{}', '"hero"', 4, false, {}, ['Hero'], ['x'], ['bad slot'],
    ['__proto__'], ['constructor'], ['prototype'], ['x'.repeat(42)], new Array(1), getterList, hookList,
    symbolList, inheritedList, nonEnumerableList, emptyHookList, Object.assign(['hero'], { extra: true }), Array.from({ length: 101 }, (_, index) => `slot-${index}`)];
  const rejectedImports = [];
  const rejecting = createTemplateRuntime({ documentRef, importModule: async (url) => { rejectedImports.push(url); return shell; } });
  for (const positions of invalidPositions) {
    await assert.rejects(() => rejecting.resolve('installed', [record(positions)]), invalidContract);
    assert.throws(() => resolveModuleEntries([], {}, new Date(), positions), invalidContract);
  }
  assert.throws(() => resolveModuleEntries([], {}, new Date(), ['component']), invalidContract);
  for (const field of ['key', 'enabled', 'entryPointUrl', 'styles', 'positionsJson']) {
    const poisoned = Object.defineProperty(record(), field, { enumerable: true, get() { getterCalls++; return 'hero'; } });
    await assert.rejects(() => rejecting.resolve('installed', [poisoned]), TypeError);
  }
  const unknownGetter = Object.defineProperty(record(), 'unknown', { get() { getterCalls++; } });
  await runtime.resolve('installed', [unknownGetter]);
  assert.equal(getterCalls, 0, 'metadata validation must never execute getters or toJSON hooks');
  assert.deepEqual(rejectedImports, [], 'corrupt positions fail before executable import');
  const recordsGetter=Object.defineProperty([],'0',{enumerable:true,get(){getterCalls++;return record();}});
  await assert.rejects(()=>rejecting.resolve('installed',recordsGetter),TypeError);
  assert.equal(getterCalls,0);assert.deepEqual(rejectedImports,[]);

  const unsafe = ['https://external.invalid/templates/code.js', 'http://site.invalid/templates/code.js',
    '//external.invalid/code.js', '/\\external.invalid/code.js', 'https://user:pass@site.invalid/code.js',
    'https://@site.invalid/code.js', '/templates/../code.js', '/templates/%2e%2e/code.js',
    '/templates/%252e%252e/code.js', '/templates/%2fcode.js', '/templates/%5ccode.js',
    '/templates/%00code.js', '/templates/%20code.js', '/templates/%zzcode.js', 'file:///local/code.js',
    'javascript:alert(1)', 'data:text/javascript,export default()=>{}', '/templates/code.js#fragment'];
  for (const url of unsafe) {
    await assert.rejects(() => rejecting.resolve('installed', [{ ...record(), entryPointUrl: url }]), TypeError);
    if (url.endsWith('.js')) await assert.rejects(() => rejecting.resolve('installed', [{ ...record(), styles: JSON.stringify([url.replace(/\.js$/, '.css')]) }]), invalidContract);
  }
  const cssGetter = Object.defineProperty([], '0', { enumerable: true, get() { getterCalls++; return '/templates/x.css'; } });
  await assert.rejects(() => rejecting.resolve('installed', [{ ...record(), styles: cssGetter }]), invalidContract);
  assert.equal(getterCalls, 0);
  assert.deepEqual(rejectedImports, []);
  const metadata=packTemplateMetadata(['/templates/installed.css'],[{name:'caption',type:'text',default:'Initial'}]);
  const builtinEnvelope=await runtime.resolve('cassiopeia',[{key:'cassiopeia',styles:packTemplateMetadata(['/templates/builtin.css'],[])}]);
  assert.deepEqual(builtinEnvelope.styles,['https://site.invalid/templates/builtin.css']);assert.deepEqual(builtinEnvelope.positions,[]);
  const declaredTemplate=await runtime.resolve('installed',[{...record(),styles:metadata}]);
  assert.equal(declaredTemplate.definitions[0].name,'caption');assert.deepEqual(declaredTemplate.styles,['https://site.invalid/templates/installed.css']);
  const paramsDocument=documentDouble();
  const paramsApp=createApplication({documentRef:paramsDocument,autoStart:false,config:{templateKey:'installed',templateStylesJson:'[{"id":"installed-home","template":"installed","title":"Home","home":true,"params":{"caption":"Saved caption","future":{"keep":true}}}]'},getModuleInstances:async()=>[],getTemplate:async()=>[{...record(),styles:metadata}],importModule:async()=>({renderShell:({config})=>`<h1>${config.templateParams.caption}</h1><p>${config.templateParams.future.keep}</p>`})});
  try{await paramsApp.start();assert.match(paramsDocument.body.innerHTML,/Saved caption/);assert.match(paramsDocument.body.innerHTML,/<p>true<\/p>/);}finally{paramsApp.stop();}
  for (const base of ['https://site.invalid/examples/index.html', 'http://127.0.0.1:8787/examples/index.html', 'file:///local/examples/index.html']) {
    const local = createTemplateRuntime({ documentRef: documentDouble(base), importModule: async () => shell });
    const url = new URL('./installed.js', base).href;
    assert.equal((await local.resolve('installed', [{ ...record(), entryPointUrl: url, styles: [] }])).key, 'installed');
    assert.equal((await local.resolve('installed', [{ ...record(), entryPointUrl: './installed.js', styles: [] }])).key, 'installed');
    await assert.rejects(() => local.resolve('installed', [{ ...record(), entryPointUrl: 'file://remote/local/code.js', styles: [] }]), TypeError);
  }
  for (const positionsJson of [undefined, null, '']) assert.deepEqual((await runtime.resolve('installed', [{ ...record(), positionsJson }])).positions, []);
  const absent = record(); delete absent.positionsJson;
  assert.deepEqual((await runtime.resolve('installed', [absent])).positions, []);
  for (const key of ['default', 'cassiopeia']) {
    const builtin = await runtime.resolve(key, [{ key, positionsJson: '{', entryPointUrl: 'file:///ignored.js' }]);
    assert.deepEqual(builtin.positions, []);
    assert.ok(Object.isFrozen(builtin.positions));
    assert.ok(builtin.styles.every((url) => url.startsWith('file:')), 'native Node CSS is not checked against document HTTP origin');
  }
  await assert.rejects(() => rejecting.resolve('constructor'), TypeError);

  const siteDocument = documentDouble(), siteImports = [], modulesSource = [row,
    { ...row, position: 'notice-area', settingsJson: '{"html":"<p>notice-html</p>"}' }];
  const modulesBefore = structuredClone(modulesSource);
  let active = record();
  const app = createApplication({ documentRef: siteDocument, autoStart: false,
    getTemplate: async () => active, getModuleInstances: async () => modulesSource,
    importModule: async (url) => { siteImports.push(url); return shell; } });
  try {
    await app.start();
    assert.match(siteDocument.body.innerHTML, /data-slot="hero">[\s\S]*module-custom-html[\s\S]*slot-html[\s\S]*<\/aside>/);
    assert.match(siteDocument.body.innerHTML, /data-slot="notice-area">[\s\S]*module-custom-html[\s\S]*notice-html[\s\S]*<\/aside>/);
    assert.doesNotMatch(siteDocument.body.innerHTML, /Não foi possível carregar/);
    active = { key: 'cassiopeia', enabled: true };
    await app.router.navigate('#/');
    assert.match(siteDocument.body.innerHTML, /data-template="cassiopeia"/);
    assert.doesNotMatch(siteDocument.body.innerHTML, /data-slot="hero"/);
    assert.match(siteDocument.body.innerHTML, /slot-html/, 'unknown position retains the established sidebar fallback');
    active = record('["notice-area"]');
    await app.router.navigate('#/');
    assert.doesNotMatch(siteDocument.body.innerHTML, /slot-html/);
    assert.match(siteDocument.body.innerHTML, /notice-html/);
    assert.deepEqual(siteImports, ['https://site.invalid/templates/installed.js']);
    assert.deepEqual(modulesSource, modulesBefore);
    active = record('["component"]');
    await app.router.navigate('#/');
    assert.doesNotMatch(siteDocument.body.innerHTML, /slot-html|notice-html/);
  } finally { app.stop(); }

  const failedDocument = documentDouble(), failedImports = [];
  const failed = createApplication({ documentRef: failedDocument, autoStart: false, getModuleInstances: async () => [],
    getTemplate: async () => record('{private-corruption'), importModule: async (url) => { failedImports.push(url); return shell; } });
  const warn = console.warn; console.warn = () => {};
  try {
    await failed.start();
    assert.match(failedDocument.body.innerHTML, /Não foi possível carregar/);
    assert.doesNotMatch(failedDocument.body.innerHTML, /private-corruption/);
    assert.deepEqual(failedImports, []);
  } finally { failed.stop(); console.warn = warn; }
  console.log('ok - installed template runtime: custom slots, safe metadata before import, local assets and template switching');
}
