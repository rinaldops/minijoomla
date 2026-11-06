import assert from 'node:assert/strict';
import { renderPluginForm } from '../src/administrator/components/com_plugins/tmpl/plugin/edit.js';
import { renderTemplateStyleForm } from '../src/administrator/components/com_templates/tmpl/style/edit.js';
import { createExtensionPages } from '../src/administrator/components/com_minijoomla/extension-pages.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { pathToFileURL } from 'node:url';

const link = (path) => path;

function formDocument() {
  let controls = [];
  const decode = (value) => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value = '']) => [name, decode(value)]));
  const query = (selector) => controls.filter((control) => [...selector.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)].every(([, name, value]) => Object.hasOwn(control.attrs, name) && (value === undefined || control.attrs[name] === value)));
  const body = { set innerHTML(html) {
    controls = [];
    for (const match of html.matchAll(/<(input|button|form|p)\b([^>]*)>|<(select|textarea)\b([^>]*)>([\s\S]*?)<\/\3>/g)) {
      const tag = match[1] ?? match[3], attributes = attrs(match[2] ?? match[4]), listeners = new Map();
      const choices = tag === 'select' ? [...match[5].matchAll(/<option([^>]*)>/g)].map(([, text]) => attrs(text)) : [];
      controls.push({ attrs: attributes, value: tag === 'select' ? (choices.find((choice) => Object.hasOwn(choice, 'selected')) ?? choices[0])?.value ?? '' : tag === 'textarea' ? decode(match[5]) : attributes.value ?? '', checked: Object.hasOwn(attributes, 'checked'), textContent: '', querySelector: (s) => query(s)[0], querySelectorAll: query, addEventListener: (name, handler) => listeners.set(name, handler), fire: (name) => listeners.get(name)?.({ preventDefault() {} }) });
    }
  }, querySelector: (s) => query(s)[0], querySelectorAll: query };
  return { documentRef: { body }, field: (name) => query(`[name="${name}"]`)[0], form: (name) => query(`[data-ext-form="${name}"]`)[0], batch: () => query('[data-ext-batch]')[0], status: () => query('[data-ext-status]')[0],
    select(id) { const input = query('[data-ext-select]').find((input) => input.value === String(id)); assert.ok(input); input.checked = true; }
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function pluginApplicationDocument() {
  let form = null, status = null, html = '';
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      const listeners = new Map();
      const fields = { enabled: { checked: true }, ordering: { value: '2' } };
      form = { fields, addEventListener: (name, fn) => listeners.set(name, fn), querySelector: (selector) => selector === '[name="enabled"]' ? fields.enabled : selector === '[name="ordering"]' ? fields.ordering : null, fire: (name) => listeners.get(name)?.({ preventDefault() {} }) };
      status = { textContent: '' };
    },
    querySelector: (selector) => selector === '[data-ext-form="plugin"]' ? form : selector === '[data-ext-status]' || selector === '.admin-management-status' || selector === '.admin-form-status' ? status : null,
    querySelectorAll: () => []
  };
  return { documentRef: { body }, get form() { return form; }, get status() { return status; }, get html() { return html; } };
}

async function integrationNavigation(plugin, update) {
  const doc = pluginApplicationDocument(), writes = [], navigations = [];
  const application = createAdminApplication({ autoStart: false, documentRef: doc.documentRef, adminService: {
    plugins: { available: true, list: async () => [], get: async (id) => Object.freeze(Object.defineProperty({ ...plugin, id }, 'etag', { value: plugin.etag, enumerable: false })), update: (...args) => { writes.push(args); return update(...args); }, groups: () => [] },
    overview: async () => ({})
  } });
  application.router.navigate = async (url) => { navigations.push(url); };
  return { app: application, doc, writes, navigations };
}

async function integration(path, service, key, record) {
  const doc = formDocument(), navigations = [];
  const pages = createExtensionPages({ adminService: service, documentRef: doc.documentRef, router: { link: (url) => `#${url}`, navigate: async (url) => navigations.push(url) }, shell: ({ bodyHtml }) => bodyHtml });
  const page = await pages.render({ path });
  assert.ok(page?.bind, `Bound form route expected: ${path}`);
  doc.documentRef.body.innerHTML = page.html; page.bind();
  const submit = key === 'batch' ? doc.batch() : doc.form(key);
  assert.ok(submit, page.html);
  return { doc, navigations, submit, record };
}

export async function runAdminExtensionFormsViewTests() {
  const plugin = { enabled: true, ordering: 2, group: 'content', key: 'sample', version: '1', description: 'Example', definitions: [], params: {} };
  const enabled = renderPluginForm(plugin, { link });
  assert.match(enabled, /name="enabled" checked/);
  assert.match(enabled, /Esta extensão não declara parâmetros\./);
  assert.match(enabled, /<dt>Versão<\/dt><dd>1<\/dd>/);
  assert.match(enabled, /<dt>Descrição<\/dt><dd>Example<\/dd>/);
  assert.match(enabled, /href="\/plugins"/);

  const disabled = renderPluginForm({ ...plugin, enabled: false, version: '', description: '' }, { link });
  assert.match(disabled, /name="enabled"><label/);
  assert.doesNotMatch(disabled, /<dt>Versão<\/dt>|<dt>Descrição<\/dt>/);

  const hostile = renderPluginForm({ ...plugin, title: '"<script>', group: '"<x>', key: "'&", ordering: '"<1' }, { link: (path) => `${path}?x="&` });
  assert.match(hostile, /value="&quot;&lt;1"/);
  assert.match(hostile, /&quot;&lt;x&gt;/);
  assert.match(hostile, /&#39;&amp;/);
  assert.match(hostile, /href="\/plugins\?x=&quot;&amp;"/);

  const defaultStyle = renderTemplateStyleForm({ title: 'Padrão', templateTitle: 'Cassiopeia', isDefault: true, definitions: [], params: {} }, { link });
  assert.match(defaultStyle, /Template: <strong>Cassiopeia<\/strong> — estilo padrão do site\./);
  assert.match(defaultStyle, /role="tab"[^>]*>Detalhes<\/button>/);
  assert.match(defaultStyle, /role="tab"[^>]*>Avançado<\/button>/);
  assert.match(defaultStyle, /required maxlength="120" value="Padrão"/);

  const regularStyle = renderTemplateStyleForm({ title: 'Comum "x"', templateTitle: 'Template', isDefault: false, definitions: [], params: {} }, { link });
  assert.match(regularStyle, /Template: <strong>Template<\/strong>\./);
  assert.doesNotMatch(regularStyle, /estilo padrão do site/);
  assert.match(regularStyle, /value="Comum &quot;x&quot;"/);
  assert.match(regularStyle, /href="\/templates\/styles"/);

  const pluginRecord = { id: 7, etag: '"plugin-original"', title: 'Plugin', enabled: true, ordering: 2, definitions: [], params: {} };
  const pluginGate = deferred(), pluginCalls = [], pluginView = await integration('/plugins/7', { plugins: { list: async () => [], get: async () => pluginRecord, update: (...args) => { pluginCalls.push(args); return pluginGate.promise; } } }, 'plugin', pluginRecord);
  const firstPlugin = pluginView.submit.fire('submit'); const secondPlugin = pluginView.submit.fire('submit');
  await Promise.resolve(); assert.equal(pluginCalls.length, 1); assert.deepEqual(pluginView.navigations, []);
  pluginGate.resolve(); await Promise.all([firstPlugin, secondPlugin]);
  assert.equal(pluginCalls[0][2].etag, pluginRecord.etag); assert.deepEqual(pluginView.navigations, ['#/plugins']);

  const stalePlugin = await integrationNavigation(pluginRecord, () => { throw new Error('obsolete form must not write'); });
  await stalePlugin.app.router.onNavigate(stalePlugin.app.router.parse('#/plugins/7'));
  const obsoleteForm = stalePlugin.doc.form;
  await stalePlugin.app.router.onNavigate(stalePlugin.app.router.parse('#/plugins/8'));
  await obsoleteForm.fire('submit');
  assert.equal(stalePlugin.writes.length, 0); assert.deepEqual(stalePlugin.navigations, []);
  assert.match(stalePlugin.doc.html, /Plugins: Plugin/);
  const stoppedForm = stalePlugin.doc.form;
  stalePlugin.app.stop();
  await stoppedForm.fire('submit');
  assert.equal(stalePlugin.writes.length, 0, 'stop invalidates a form even without another navigation');

  const pendingPlugin = deferred(), latePlugin = Object.freeze(Object.defineProperty({ ...pluginRecord }, 'etag', { value: '"frozen-original"', enumerable: false }));
  const late = await integrationNavigation(latePlugin, () => pendingPlugin.promise);
  await late.app.router.onNavigate(late.app.router.parse('#/plugins/7'));
  const oldForm = late.doc.form, saveOld = oldForm.fire('submit');
  await Promise.resolve();
  assert.equal(late.writes.length, 1); assert.equal(late.writes[0][2].etag, latePlugin.etag);
  await late.app.router.onNavigate(late.app.router.parse('#/plugins/8'));
  const activeStatus = late.doc.status;
  pendingPlugin.resolve(); await saveOld;
  assert.deepEqual(late.navigations, []); assert.equal(activeStatus.textContent, '');

  const failingPlugin = deferred(), failureView = await integrationNavigation(pluginRecord, () => failingPlugin.promise);
  await failureView.app.router.onNavigate(failureView.app.router.parse('#/plugins/7'));
  const failed = failureView.doc.form.fire('submit'); await Promise.resolve();
  await failureView.app.router.onNavigate(failureView.app.router.parse('#/plugins/8'));
  failingPlugin.reject(new Error('offline')); await failed;
  assert.equal(failureView.doc.status.textContent, ''); assert.deepEqual(failureView.navigations, []);
  late.app.stop(); failureView.app.stop();

  const failGate = deferred(), retryCalls = [], retry = await integration('/plugins/7', { plugins: { list: async () => [], get: async () => pluginRecord, update: (...args) => { retryCalls.push(args); return retryCalls.length === 1 ? failGate.promise : Promise.resolve(); } } }, 'plugin', pluginRecord);
  const failedSubmit = retry.submit.fire('submit'); failGate.reject(new Error('offline')); await failedSubmit;
  assert.match(retry.doc.status().textContent, /Não foi possível salvar o plugin/); assert.deepEqual(retry.navigations, []);
  await retry.submit.fire('submit'); assert.equal(retryCalls.length, 2); assert.deepEqual(retry.navigations, ['#/plugins']);

  const style = { id: 'cassiopeia', etag: '"style-original"', title: 'Default', definitions: [], params: {} }, styleGate = deferred(), styleCalls = [];
  const styleView = await integration('/templates/styles/cassiopeia', { templateStyles: { list: async () => ({ styles: [], catalog: [] }), get: async () => style, save: (...args) => { styleCalls.push(args); return styleGate.promise; } } }, 'style', style);
  const styleOne = styleView.submit.fire('submit'); await styleView.submit.fire('submit'); await Promise.resolve();
  assert.equal(styleCalls.length, 1); styleGate.resolve(); await styleOne; assert.equal(styleCalls[0][2].etag, style.etag); assert.deepEqual(styleView.navigations, ['#/templates/styles']);

  const componentOptionsRecord = { key: 'com_content', title: 'Content', etag: '"options-original"', available: true, definitions: [], params: {} }, optionsGate = deferred(), optionCalls = [];
  const optionView = await integration('/options/content', { componentOptions: { list: () => [{ key: 'content' }], get: async () => componentOptionsRecord, save: (...args) => { optionCalls.push(args); return optionsGate.promise; } } }, 'options', componentOptionsRecord);
  const optionOne = optionView.submit.fire('submit'); await optionView.submit.fire('submit'); await Promise.resolve(); assert.equal(optionCalls.length, 1);
  optionsGate.resolve(); await optionOne; assert.equal(optionCalls[0][2].etag, componentOptionsRecord.etag); assert.deepEqual(optionView.navigations, ['#/options']);

  const unavailable = await integration('/options/content', { componentOptions: { list: () => [{ key: 'content' }], get: async () => ({ ...componentOptionsRecord, available: false }), save: () => assert.fail('unavailable options must not save') } }, 'options', componentOptionsRecord);
  await unavailable.submit.fire('submit'); assert.deepEqual(unavailable.navigations, []);

  const moduleGate = deferred(), moduleCreates = [];
  const moduleService = { catalog: async () => [{ key: 'custom-html', title: 'HTML', params: [] }], batch: async () => ({ succeeded: [], failed: [] }), positions: async () => ({ template: 'default', positions: ['sidebar-right'], all: ['sidebar-right'] }), create: (...args) => { moduleCreates.push(args); return moduleGate.promise; } };
  const moduleView = await integration('/moduleInstances/new', { moduleInstances: moduleService, menu: { available: false }, categories: { available: false } }, 'module', null);
  moduleView.doc.field('extensionKey').value = 'custom-html'; moduleView.doc.field('title').value = 'New'; moduleView.doc.field('assignment').value = 'all';
  const moduleOne = moduleView.submit.fire('submit'); await moduleView.submit.fire('submit'); await Promise.resolve(); assert.equal(moduleCreates.length, 1);
  moduleGate.resolve(); await moduleOne; assert.deepEqual(moduleView.navigations, ['#/moduleInstances']);

  const moduleRecord = Object.freeze(Object.defineProperty({ id: 11, title: 'Módulo', extensionKey: 'custom-html', position: 'sidebar-right', assignment: 'all', settingsJson: '{}' }, 'etag', { value: '"module-original"', enumerable: false }));
  const editGate = deferred(), editCalls = [];
  const editView = await integration('/moduleInstances/11', { moduleInstances: { ...moduleService, get: async () => moduleRecord, update: (...args) => { editCalls.push(args); return editGate.promise; } } }, 'module', moduleRecord);
  const editOne = editView.submit.fire('submit'); await editView.submit.fire('submit');
  assert.equal(editCalls.length, 1); assert.equal(editCalls[0][2].etag, moduleRecord.etag);
  editGate.resolve(); await editOne; assert.deepEqual(editView.navigations, ['#/moduleInstances']);

  const installGate = deferred(), installs = [];
  const installView = await integration('/installer', { installer: { list: async () => [], install: (manifest) => { installs.push(manifest); return installGate.promise; } } }, 'install');
  installView.doc.field('manifest').value = '{"key":"sample"}';
  const installOne = installView.submit.fire('submit'); await installView.submit.fire('submit');
  assert.deepEqual(installs, ['{"key":"sample"}']); assert.deepEqual(installView.navigations, []);
  installGate.resolve({ title: 'Sample' }); await installOne;
  assert.deepEqual(installView.navigations, ['#/installer']);

  const batchGate = deferred(), batches = [];
  const batchView = await integration('/moduleInstances', { moduleInstances: { ...moduleService, list: async () => [moduleRecord], get: async () => moduleRecord, batch: (...args) => { batches.push(args); return batchGate.promise; } } }, 'batch');
  batchView.doc.select(moduleRecord.id); batchView.doc.field('batchAction').value = 'publish';
  const batchOne = batchView.submit.fire('submit'); await batchView.submit.fire('submit');
  assert.equal(batches.length, 1); assert.deepEqual(batches[0][0], [{ id: 11, etag: moduleRecord.etag }]);
  batchGate.resolve({ succeeded: [11], failed: [] }); await batchOne;
  assert.deepEqual(batchView.navigations, ['#/moduleInstances']);
  console.log('ok - extension forms: single in-flight submission for module create/update/batch, plugin, style, options and installer; retry after failure and captured ETags');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAdminExtensionFormsViewTests();
