import assert from 'node:assert/strict';
import { loadSampleDataPage } from '../src/administrator/modules/mod_sampledata/src/Helper/sampledata.js';

export async function runSampleDataViewTests() {
  const listeners = {}; const button = { disabled: false, addEventListener: (name, callback) => { listeners[name] = callback; } };
  const status = { textContent: '' }, progress = {};
  const documentRef = { body: { querySelector: selector => ({ '[data-sample-install]': button, '[data-sample-status]': status, '[data-sample-progress]': progress }[selector]) } };
  let current = true, installs = 0, navigations = 0, resolve;
  const blocked = new Promise(done => { resolve = done; });
  const router = { link: path => '#' + path, navigate: async () => { navigations++; } };
  const shell = ({ bodyHtml }) => bodyHtml;
  const sampleDataService = { inspect: async () => ({ status: 'ready', message: '<unsafe>', summary: { total: 40, counts: { articles: 11 } } }), install: async ({ confirm, onProgress }) => { assert.equal(confirm, true); installs++; onProgress({ completed: 1, total: 40, message: 'Etapa 1' }); await blocked; return { status: 'installed', message: 'Concluído' }; } };
  const page = await loadSampleDataPage({ sampleDataService, documentRef, router, shell, isCurrent: () => current });
  assert.ok(page.html.includes('&lt;unsafe&gt;')); assert.ok(!page.html.includes('<unsafe>')); page.bind();
  const oldConfirm = globalThis.confirm;
  try {
    globalThis.confirm = () => false; await listeners.click(); assert.equal(installs, 0);
    globalThis.confirm = () => true;
    const first = listeners.click(); await listeners.click(); assert.equal(installs, 1); assert.equal(progress.value, 1);
    current = false; resolve(); await first; assert.equal(navigations, 0);
    const installed = await loadSampleDataPage({ ...{ sampleDataService: { inspect: async () => ({ status: 'installed', message: 'Já instalado' }) }, documentRef, router, shell, isCurrent: () => true } });
    assert.ok(installed.html.includes('data-sample-install disabled'));
  } finally { globalThis.confirm = oldConfirm; }
  console.log('ok - sample data view: escaped status, confirmation, single submission, installed state and no cross-screen redirect');
}
