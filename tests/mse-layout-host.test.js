import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Core/local bridge contract only: no real SPMIDDLE, browser, or tenant.
const stylesheetHref = new URL('../host-adapters/modern-script-editor/spmiddle-layout/layout.css', import.meta.url).href;
const forbidden = () => { throw new Error('The bridge must not mutate publisher attributes or query SharePoint ancestors.'); };
function fixture({ loaded = true } = {}) {
  const link = Object.assign(new EventTarget(), { tagName: 'LINK', rel: 'stylesheet', href: stylesheetHref, sheet: loaded ? {} : null, disabled: false });
  link.getAttribute = name => name === 'rel' ? link.rel : name === 'href' ? link.href : name === 'data-minijoomla-mse-layout' ? '' : null;
  const documentRef = {
    querySelector(selector) { assert.equal(selector, '[data-minijoomla-mse-layout]'); return this.link; },
    querySelectorAll(selector) { assert.equal(selector, 'link[rel="stylesheet"]'); return this.link ? [this.link] : []; },
    link, baseURI: stylesheetHref
  };
  const wrapper = { parentElement: { closest: () => null }, getAttribute: name => name === 'data-spmiddle-host' ? '' : null,
    closest: selector => { assert.equal(selector, '[data-spmiddle-host]'); return wrapper; }, setAttribute: forbidden, querySelector: forbidden };
  const root = { ownerDocument: documentRef, closest: selector => { assert.equal(selector, '[data-spmiddle-host]'); return wrapper; }, setAttribute: forbidden, querySelector: forbidden };
  const calls = [];
  const raw = { refresh() { assert.equal(this, raw); calls.push('refresh'); return 'refreshed'; }, dispose() { assert.equal(this, raw); calls.push('dispose'); } };
  const hostApi = { applyMseLayout(target) { assert.equal(target, wrapper); calls.push('apply'); return raw; } };
  hostApi.ready = Promise.resolve(hostApi);
  return { root, wrapper, documentRef, link, calls, raw, hostApi };
}

export async function runMseLayoutHostTests() {
  // Import at execution time so the coordinator can create the bridge independently.
  const { prepareMseLayout } = await import('../host-adapters/modern-script-editor/mse-layout.js');
  await assert.rejects(() => prepareMseLayout(), TypeError);
  await assert.rejects(() => prepareMseLayout({ root: null }), TypeError);
  const legacy = fixture();
  legacy.root.closest = () => null;
  legacy.documentRef.querySelector = forbidden;
  legacy.documentRef.querySelectorAll = forbidden;
  const untouchedApi = { get ready() { return forbidden(); }, get applyMseLayout() { return forbidden(); } };
  assert.equal(await prepareMseLayout({ root: legacy.root, hostApi: untouchedApi }), null);
  const same = fixture(); same.root.closest = () => same.root;
  await assert.rejects(() => prepareMseLayout(same));
  assert.deepEqual(same.calls, []);

  const ready = fixture();
  let resolveReady;
  ready.hostApi.ready = new Promise(resolve => { resolveReady = resolve; });
  const preparation = prepareMseLayout(ready);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(ready.calls, [], 'apply must wait for the host API');
  resolveReady(ready.hostApi);
  const controller = await preparation;
  assert.equal(await controller.refresh(), 'refreshed');
  controller.dispose(); controller.dispose();
  assert.deepEqual(ready.calls, ['apply', 'refresh', 'dispose']);

  const css = fixture({ loaded: false });
  const cssPreparation = prepareMseLayout(css);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(css.calls, [], 'apply must wait for the exact stylesheet');
  css.link.sheet = {}; css.link.dispatchEvent(new Event('load'));
  (await cssPreparation).dispose();
  assert.deepEqual(css.calls, ['apply', 'dispose']);

  const failedCss = fixture({ loaded: false });
  const cssRejection = assert.rejects(prepareMseLayout(failedCss));
  await Promise.resolve(); await Promise.resolve();
  failedCss.link.dispatchEvent(new Event('error'));
  await cssRejection;
  assert.deepEqual(failedCss.calls, []);
  for (const change of [f => { f.documentRef.link = null; }, f => { f.link.tagName = 'STYLE'; }, f => { f.link.rel = 'preload'; }, f => { f.link.href += '.unrelated'; }]) {
    const invalid = fixture(); change(invalid);
    await assert.rejects(() => prepareMseLayout(invalid));
    assert.deepEqual(invalid.calls, [], 'missing/incorrect CSS must fail closed');
  }
  const failedReady = fixture();
  const reason = new Error('host API readiness failed');
  failedReady.hostApi.ready = Promise.reject(reason);
  await assert.rejects(() => prepareMseLayout(failedReady), error => error === reason);
  assert.deepEqual(failedReady.calls, []);
  for (const hostApi of [null, {}, { ready: Promise.resolve(), applyMseLayout: null }]) {
    await assert.rejects(() => prepareMseLayout({ ...fixture(), hostApi }));
  }
  for (const raw of [null, {}, { refresh() {} }, { dispose() {} }]) {
    const invalid = fixture(); invalid.hostApi.applyMseLayout = () => raw;
    await assert.rejects(() => prepareMseLayout(invalid));
  }
  const multi=fixture();multi.documentRef.querySelectorAll=()=>[{...multi.link,href:stylesheetHref+'.old'},multi.link];
  (await prepareMseLayout(multi)).dispose();assert.deepEqual(multi.calls,['apply','dispose']);
  const hung=fixture();hung.hostApi.ready=new Promise(()=>{});await assert.rejects(prepareMseLayout({...hung,timeoutMs:1}),/prazo/);assert.deepEqual(hung.calls,[]);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { await runMseLayoutHostTests(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
