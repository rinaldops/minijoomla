import assert from 'node:assert/strict';
import { confirmInstallerAction } from '../src/administrator/components/com_installer/src/View/confirmation.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';

const decode = (value) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Portable DOM double: modal opening does NOT grant consent. Tests dispatch
// real-shaped click/cancel/close/keyboard events, with connected-tree ownership,
// bubbling, default Escape cancellation and explicitly controlled guard timers.
function modalDocument({ supported = true, inert = false, throwOnOpen = false } = {}) {
  const observers = new Set();
  const timers = new Map();
  let timerId = 0;
  let opens = 0;
  let html = '';
  let document;
  const notify = (target) => {
    for (const observer of observers) {
      if (!observer.target?.contains(target) || observer.pending) continue;
      observer.pending = true;
      queueMicrotask(() => { observer.pending = false; if (observers.has(observer)) observer.callback([]); });
    }
  };
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.ownerDocument = document;
      this.children = [];
      this.parentNode = null;
      this.dataset = {};
      this.style = {};
      this.attributes = new Map();
      this.handlers = new Map();
      this.disabled = false;
      this.focusCount = 0;
      this.textContent = '';
    }
    get isConnected() { return document.documentElement.contains(this); }
    get open() { return this.attributes.has('open'); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); notify(this); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); notify(this); }
    appendChild(child) { child.parentNode = this; this.children.push(child); notify(this); return child; }
    remove() {
      const parent = this.parentNode;
      if (!parent) return;
      parent.children.splice(parent.children.indexOf(this), 1);
      this.parentNode = null;
      notify(parent);
    }
    contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
    addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(handler); }
    removeEventListener(type, handler) { this.handlers.get(type)?.delete(handler); }
    dispatch(type, properties = {}) {
      const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
      const results = [];
      for (let node = this; node; node = properties.bubbles ? node.parentNode : null) {
        for (const handler of [...node.handlers.get(type) ?? []]) results.push(handler(event));
      }
      return { event, completion: Promise.all(results) };
    }
    fire(type, properties = {}) { return this.dispatch(type, { bubbles: true, ...properties }).completion; }
    focus() { if (this.isConnected && !this.disabled) { document.activeElement = this; this.focusCount++; } }
    blur() { if (document.activeElement === this) document.activeElement = document.body; }
    querySelectorAll(selector) {
      const matches = (element) => selector === 'dialog' ? element.tagName === 'DIALOG'
        : selector === 'button' ? element.tagName === 'BUTTON'
        : selector.startsWith('.') ? element.className?.split(' ').includes(selector.slice(1))
        : selector.startsWith('#') ? element.id === selector.slice(1)
        : selector === '[data-admin-register]' ? Boolean(element.dataset.adminRegister)
        : selector === '[data-admin-installer-accept]' ? Boolean(element.dataset.adminInstallerAccept)
        : selector === '[data-admin-installer-cancel]' ? Boolean(element.dataset.adminInstallerCancel) : false;
      return this.children.flatMap((child) => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    set innerHTML(value) {
      assert.equal(this.tagName, 'MAIN', 'the confirmation must never insert untrusted HTML');
      html = value;
      for (const child of this.children) child.parentNode = null;
      this.children = [];
      notify(this);
      if (value.includes('class="admin-management-status"')) {
        const status = document.createElement('p');
        status.className = 'admin-management-status';
        this.appendChild(status);
      }
      for (const [, attrs] of value.matchAll(/<button\b([^>]*)>/g)) {
        if (!/\bdata-admin-register="/.test(attrs)) continue;
        const button = document.createElement('button');
        button.dataset = Object.fromEntries([...attrs.matchAll(/\bdata-([a-z-]+)="([^"]*)"/g)].map(([, name, text]) => [name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), decode(text)]));
        this.appendChild(button);
      }
    }
    get innerHTML() { return html; }
  }
  class Dialog extends Element {
    showModal() {
      opens++;
      if (throwOnOpen) throw new Error('Dialog unavailable');
      assert.ok(this.isConnected, 'showModal needs a connected element');
      if (inert) return;
      this.previousFocus = document.activeElement;
      this.setAttribute('open', '');
      this.modal = true;
      this.querySelector('[data-admin-installer-accept]')?.focus();
    }
    close(value = '') {
      if (!this.open) return;
      this.returnValue = value;
      this.removeAttribute('open');
      this.modal = false;
      // Native dialog close restores remembered focus from body/viewport too.
      if (this.contains(document.activeElement) || document.activeElement === document.body || document.activeElement === null) this.previousFocus?.focus();
      queueMicrotask(() => this.dispatch('close'));
    }
    escape() {
      const { event } = this.dispatch('cancel');
      if (!event.defaultPrevented) this.close();
    }
    key(key, target = document.activeElement, properties = {}) {
      const { event } = target.dispatch('keydown', { key, bubbles: true, ...properties });
      if (!event.defaultPrevented && key === 'Escape') this.escape();
      if (!event.defaultPrevented && key === 'Enter' && !properties.isComposing && !properties.repeat && target.tagName === 'BUTTON') target.dispatch('click', { bubbles: true });
    }
  }
  document = {
    activeElement: null,
    createElement: (tag) => tag === 'dialog' && supported ? new Dialog(tag) : new Element(tag),
    defaultView: {
      MutationObserver: class {
        constructor(callback) { this.callback = callback; }
        observe(target) { this.target = target; observers.add(this); }
        disconnect() { observers.delete(this); }
      },
      setInterval(callback, delay) { assert.equal(delay, 100); timers.set(++timerId, callback); return timerId; },
      clearInterval(id) { timers.delete(id); }
    }
  };
  document.documentElement = document.createElement('html');
  document.body = document.createElement('body');
  document.documentElement.appendChild(document.body);
  const root = document.createElement('main');
  document.body.appendChild(root);
  // The app mounts in a container, not necessarily the browser's document.body.
  const documentRef = { body: root };
  return { document, documentRef, root, opens: () => opens,
    dialog: () => root.querySelector('dialog'),
    button: (key) => root.querySelectorAll('[data-admin-register]').find((button) => button.dataset.adminRegister === key),
    tick: () => { for (const callback of [...timers.values()]) callback(); },
    assertClean() { assert.equal(timers.size, 0, 'no guard timer survives settlement'); assert.equal(observers.size, 0, 'no observer survives settlement'); assert.equal(root.querySelectorAll('dialog').length, 0); }
  };
}

const candidate = (extra = {}) => ({ key: 'corpmessage', title: 'Mensagem <script> & "equipe"', type: 'Module', entryPointUrl: './modules/corpmessage.js', discoveredFrom: 'extensions/corpmessage/module.xml', candidateId: 'candidate-1', fingerprint: 'new', version: '0.11.0', error: null, ...extra });
function fixture({ action = 'install', write, dom = modalDocument(), scan } = {}) {
  const entry = candidate();
  const row = { id: 5, key: entry.key, etag: '"screen-etag"', manifestJson: JSON.stringify({ version: '0.10.0', miniJoomla: { fingerprint: action === 'rollback' ? 'new' : 'old', inventoryHash: 'hash', ...(action === 'rollback' ? { previousRevision: { manifest: { version: '0.9.0' }, entryPointUrl: './modules/previous.js' } } : {}) } }) };
  const calls = [];
  let scans = 0;
  let gets = 0;
  const run = async (op, args) => { calls.push({ op, args: structuredClone(args) }); return write?.(op, args); };
  const adminService = { extensions: {
    list: async () => action === 'install' ? [] : [{ id: row.id, key: row.key }],
    get: async () => { gets++; return row; },
    create: async () => { throw new Error('XML must never use legacy create'); }
  } };
  const discoveryService = { scanReport: async () => { scans++; return scan ? scan(scans) : { entries: [entry], complete: true, issues: [] }; }, installer: {
    install: (...args) => run('install', args),
    upgrade: (...args) => run('upgrade', args),
    rollback: (...args) => run('rollback', args)
  } };
  const app = createAdminApplication({ adminService, discoveryService, documentRef: dom.documentRef, autoStart: false });
  return { app, dom, row, entry, calls, scans: () => scans, gets: () => gets };
}

async function consentAndKeyboardTests() {
  for (const [action, label] of [['install', 'Registrar'], ['upgrade', 'Atualizar'], ['rollback', 'Reverter versão']]) {
    const f = fixture({ action });
    try {
      await f.app.router.navigate('#/extensions/discover');
      const button = f.dom.button(f.entry.key);
      button.focus();
      const click = button.fire('click');
      const dialog = f.dom.dialog();
      assert.ok(dialog.open && dialog.modal, 'real-shaped showModal opens without granting consent');
      assert.equal(f.dom.opens(), 1);
      assert.equal(dialog.parentNode, f.dom.root, 'dialog belongs to the administrative root, not the host body');
      assert.equal(dialog.ownerDocument, f.dom.document);
      assert.equal(f.calls.length, 0, 'no installer calls before explicit consent');
      const accept = dialog.querySelector('[data-admin-installer-accept]');
      const cancel = dialog.querySelector('[data-admin-installer-cancel]');
      assert.equal(accept.textContent, label);
      assert.equal(cancel.textContent, 'Cancelar');
      assert.equal(dialog.getAttribute('aria-modal'), 'true');
      assert.ok(dialog.querySelector(`#${dialog.getAttribute('aria-labelledby')}`).textContent);
      assert.match(dialog.querySelector(`#${dialog.getAttribute('aria-describedby')}`).textContent, /\?/);
      assert.ok(dialog.children.some((child) => child.textContent.includes(f.entry.title)), 'untrusted title is literal text, never HTML');
      assert.equal(f.dom.document.activeElement, accept);
      const getsBefore = f.gets();
      f.row.etag = '"changed-during-consent"';
      f.entry.version = 'tampered';
      f.entry.title = 'tampered';
      button.dataset.adminRegisterTitle = 'tampered';
      if (action === 'install') await accept.fire('click');
      else dialog.key('Enter');
      await click;
      assert.equal(f.calls.length, 1);
      assert.equal(f.calls[0].op, action);
      if (action === 'upgrade') {
        assert.equal(f.calls[0].args[0], 5);
        assert.equal(f.calls[0].args[1].targetVersion, '0.11.0');
        assert.deepEqual(f.calls[0].args[2], { etag: '"screen-etag"' });
      } else if (action === 'rollback') assert.deepEqual(f.calls[0].args, [5, { etag: '"screen-etag"' }]);
      else {
        assert.equal(f.calls[0].args[0].version, '0.11.0');
        assert.notEqual(f.calls[0].args[0].title, 'tampered');
      }
      assert.equal(f.gets(), getsBefore + (action === 'install' ? 0 : 1), 'only the successful route reload reads a new ETag');
      assert.equal(button.focusCount, 2, 'focus returns to the connected trigger before the write begins');
      f.dom.assertClean();
    } finally { f.app.stop(); }
  }
  for (const choice of ['cancel', 'escape', 'cancel-enter', 'external-close']) {
    const f = fixture();
    try {
      await f.app.router.navigate('#/extensions/discover');
      const button = f.dom.button(f.entry.key);
      button.focus();
      const click = button.fire('click');
      const dialog = f.dom.dialog();
      const cancel = dialog.querySelector('[data-admin-installer-cancel]');
      if (choice === 'cancel') await cancel.fire('click');
      else if (choice === 'escape') dialog.key('Escape');
      else if (choice === 'cancel-enter') { cancel.focus(); dialog.key('Enter'); }
      else dialog.close('accept'); // Only an explicit consent button/Enter may accept.
      await click;
      assert.equal(f.calls.length, 0);
      assert.equal(button.disabled, false);
      if (choice !== 'external-close') assert.equal(f.dom.document.activeElement, button);
      f.dom.assertClean();
      const retry = button.fire('click');
      await f.dom.dialog().querySelector('[data-admin-installer-cancel]').fire('click');
      await retry;
      assert.equal(f.calls.length, 0, 'cancellation releases the lock for a fresh confirmation');
      f.dom.assertClean();
    } finally { f.app.stop(); f.dom.tick(); }
  }
  console.log('ok - installer confirmation: modal consent, Portuguese labels, safe text, Enter/Escape, cancellation and screen ETags');
}

async function busyAndRetryTests() {
  const pending = deferred();
  const f = fixture({ write: () => pending.promise, scan: () => ({ entries: [candidate(), candidate({ key: 'second', candidateId: 'candidate-2' })] }) });
  try {
    await f.app.router.navigate('#/extensions/discover');
    const button = f.dom.button('corpmessage');
    const second = f.dom.button('second');
    const click = button.fire('click');
    await button.fire('click');
    await second.fire('click');
    assert.equal(f.dom.opens(), 1, 'one in-flight action across the screen while awaiting consent');
    assert.equal(f.calls.length, 0);
    await f.dom.dialog().querySelector('[data-admin-installer-accept]').fire('click');
    await flush();
    assert.equal(button.disabled, true);
    assert.equal(f.calls.length, 1);
    await button.fire('click');
    await second.fire('click');
    assert.equal(f.calls.length, 1, 'one in-flight action across consent AND write');
    assert.equal(f.dom.opens(), 1);
    f.dom.assertClean();
    pending.resolve();
    await click;
    assert.equal(button.disabled, false);
    const retry = f.dom.button('second').fire('click');
    await f.dom.dialog().querySelector('[data-admin-installer-cancel]').fire('click');
    await retry;
    f.dom.assertClean();
  } finally { pending.resolve(); f.app.stop(); f.dom.tick(); }
  console.log('ok - installer confirmation: duplicate clicks across buttons cannot open another modal or duplicate pending writes');
}

async function lifecycleTests() {
  for (const invalidate of ['navigate', 'pending-navigation', 'stop', 'replace-root-html', 'detach-root', 'swap-root', 'remove-dialog', 'remove-open', 'stale-accept', 'tampered-key']) {
    const scan = deferred();
    const f = fixture({ scan: (count) => count > 1 && invalidate === 'pending-navigation' ? scan.promise : { entries: [candidate()] } });
    try {
      await f.app.router.navigate('#/extensions/discover');
      const button = f.dom.button(f.entry.key);
      button.focus();
      const click = button.fire('click');
      const dialog = f.dom.dialog();
      const accept = dialog.querySelector('[data-admin-installer-accept]');
      let navigation;
      if (invalidate === 'navigate') await f.app.router.navigate('#/unrelated');
      else if (invalidate === 'pending-navigation') { navigation = f.app.router.navigate('#/extensions/discover'); await flush(); }
      else if (invalidate === 'stop' || invalidate === 'stale-accept') f.app.stop();
      else if (invalidate === 'replace-root-html') f.dom.root.innerHTML = '<p>Outra tela</p>';
      else if (invalidate === 'detach-root') f.dom.root.remove();
      else if (invalidate === 'swap-root') f.dom.documentRef.body = f.dom.document.createElement('main');
      else if (invalidate === 'remove-dialog') dialog.remove();
      else if (invalidate === 'remove-open') dialog.removeAttribute('open');
      else button.dataset.adminRegister = 'unscanned';
      if (invalidate === 'stale-accept' || invalidate === 'tampered-key') await accept.fire('click');
      else { await flush(); f.dom.tick(); }
      await click;
      assert.equal(f.calls.length, 0, `${invalidate} cannot initiate a write`);
      assert.equal(button.disabled, false);
      if (!['remove-dialog', 'remove-open', 'tampered-key'].includes(invalidate)) assert.equal(button.focusCount, 1, 'no focus restoration into a detached/stale screen');
      f.dom.assertClean();
      await accept.fire('click');
      if (['remove-dialog', 'remove-open'].includes(invalidate)) {
        const retry = button.fire('click');
        await f.dom.dialog().querySelector('[data-admin-installer-cancel]').fire('click');
        await retry;
        f.dom.assertClean();
      } else await button.fire('click');
      assert.equal(f.calls.length, 0, 'retained obsolete listeners cannot grant consent or write');
      if (navigation) { scan.resolve({ entries: [] }); await navigation; }
    } finally { scan.resolve({ entries: [] }); f.app.stop(); f.dom.tick(); }
  }
  for (const outcome of ['resolve', 'reject']) {
    const pending = deferred();
    const f = fixture({ write: () => pending.promise });
    try {
      await f.app.router.navigate('#/extensions/discover');
      const click = f.dom.button(f.entry.key).fire('click');
      await f.dom.dialog().querySelector('[data-admin-installer-accept]').fire('click');
      await flush();
      assert.equal(f.calls.length, 1);
      await f.app.router.navigate('#/extensions/discover');
      const status = f.dom.root.querySelector('.admin-management-status');
      const html = f.dom.root.innerHTML;
      if (outcome === 'resolve') pending.resolve();
      else pending.reject(new Error('obsolete failure'));
      await click;
      assert.equal(f.scans(), 2, 'obsolete write completion never navigates again');
      assert.equal(status.textContent, '', 'obsolete failure never reports on the new page');
      assert.equal(f.dom.root.innerHTML, html);
      f.dom.assertClean();
    } finally { pending.resolve(); f.app.stop(); f.dom.tick(); }
  }
  console.log('ok - installer confirmation: route/stop/root disposal resolves false, cleans timers/listeners and rejects stale writes/completions');
}

async function helperAndFallbackTests(fallbackCalls) {
  for (const mode of ['abort', 'disabled-focus', 'outside-focus', 'host-trigger', 'stopped-focus', 'stopped-body-focus', 'composing-enter', 'repeated-enter']) {
    const dom = modalDocument();
    const trigger = dom.document.createElement('button');
    (mode === 'host-trigger' ? dom.document.body : dom.root).appendChild(trigger);
    trigger.focus();
    const abort = new AbortController();
    let current = true;
    const confirmation = confirmInstallerAction({ documentRef: dom.documentRef, entry: candidate(), message: 'Registrar?', signal: abort.signal, isCurrent: () => current });
    const dialog = dom.dialog();
    if (mode === 'stopped-focus' || mode === 'stopped-body-focus') {
      current = false;
      if (mode === 'stopped-body-focus') dom.document.activeElement = dom.document.body;
      dom.tick();
    } else if (mode === 'abort') abort.abort();
    else {
      if (mode === 'disabled-focus') trigger.disabled = true;
      if (mode === 'outside-focus') {
        const outside = dom.document.createElement('button');
        dom.document.body.appendChild(outside);
        outside.focus();
      }
      if (mode === 'composing-enter' || mode === 'repeated-enter') {
        dialog.key('Enter', dom.document.activeElement, { isComposing: mode === 'composing-enter', repeat: mode === 'repeated-enter' });
        assert.ok(dialog.open, 'IME/repeated key events never grant consent');
      }
      await dialog.querySelector('[data-admin-installer-cancel]').fire('click');
    }
    assert.equal(await confirmation, false);
    if (['disabled-focus', 'outside-focus', 'host-trigger', 'stopped-focus', 'stopped-body-focus'].includes(mode)) assert.equal(trigger.focusCount, 1, 'cleanup does not steal focus, focus disabled controls or touch host/stopped triggers');
    dom.assertClean();
  }
  for (const config of [{ inert: true }, { throwOnOpen: true }]) {
    const dom = modalDocument(config);
    const before = fallbackCalls.length;
    assert.equal(await confirmInstallerAction({ documentRef: dom.documentRef, message: 'Registrar?', isCurrent: () => true }), false);
    assert.equal(fallbackCalls.length, before, 'supported modal failing to open fails closed, never native confirm bypass');
    dom.assertClean();
  }
  const unsupported = modalDocument({ supported: false });
  const before = fallbackCalls.length;
  assert.equal(await confirmInstallerAction({ documentRef: unsupported.documentRef, message: 'Fallback?' }), false);
  assert.deepEqual(fallbackCalls.slice(before), ['Fallback?']);
  unsupported.assertClean();
  const original = globalThis.confirm;
  try {
    const aborted = new AbortController();
    aborted.abort();
    const abortedDom = modalDocument();
    assert.equal(await confirmInstallerAction({ documentRef: abortedDom.documentRef, signal: aborted.signal, message: 'Already aborted?' }), false);
    assert.equal(abortedDom.opens(), 0);
    abortedDom.assertClean();
    globalThis.confirm = () => true;
    assert.equal(await confirmInstallerAction({ documentRef: { body: {} }, message: 'Legacy?' }), true, 'inert synthetic document keeps explicitly mocked native confirm');
    globalThis.confirm = undefined;
    assert.equal(await confirmInstallerAction({ documentRef: { body: {} }, message: 'Missing?' }), false);
    globalThis.confirm = () => { throw new Error('native unavailable'); };
    assert.equal(await confirmInstallerAction({ documentRef: { body: {} }, message: 'Error?' }), false);
    const pending = deferred();
    let current = true;
    globalThis.confirm = () => pending.promise;
    const confirmation = confirmInstallerAction({ documentRef: { body: {} }, message: 'Async?', isCurrent: () => current });
    current = false;
    pending.resolve(true);
    assert.equal(await confirmation, false, 'async fallback still requires current route after awaiting');
  } finally { globalThis.confirm = original; }
  console.log('ok - installer confirmation: optional abort, safe focus, unsupported native fallback and supported-modal failure closed');
}

async function asynchronousFallbackControllerTests() {
  const original = globalThis.confirm;
  try {
    for (const invalidate of ['none', 'navigate', 'stop']) {
      const pending = deferred();
      let prompts = 0;
      globalThis.confirm = () => { prompts++; return pending.promise; };
      const f = fixture({ dom: modalDocument({ supported: false }), action: 'upgrade' });
      try {
        await f.app.router.navigate('#/extensions/discover');
        const button = f.dom.button(f.entry.key);
        const click = button.fire('click');
        await button.fire('click');
        assert.equal(prompts, 1);
        assert.equal(f.calls.length, 0, 'a promise from the fallback is not truthy consent');
        f.row.etag = '"new-etag"';
        if (invalidate === 'navigate') await f.app.router.navigate('#/unrelated');
        else if (invalidate === 'stop') f.app.stop();
        pending.resolve(true);
        await click;
        if (invalidate === 'none') {
          assert.equal(f.calls.length, 1);
          assert.deepEqual(f.calls[0].args[2], { etag: '"screen-etag"' });
        } else assert.equal(f.calls.length, 0, 'obsolete asynchronous native fallback consent cannot write');
        f.dom.assertClean();
      } finally { pending.resolve(false); f.app.stop(); }
    }
  } finally { globalThis.confirm = original; }
  console.log('ok - installer confirmation: async fallback controller retains screen ETag, blocks duplicate prompts and rejects navigation/stop');
}

async function writeFailureTests() {
  for (const [error, expected] of [
    [Object.assign(new Error('ETag mismatch'), { code: 'concurrency-conflict' }), 'O registro ou a configuração foi alterado por outra pessoa. Recarregue antes de tentar novamente.'],
    [Object.assign(new Error('Pacote XML inválido.'), { name: 'ValidationError' }), 'Pacote XML inválido.'],
    [new Error('private backend details'), 'Não foi possível registrar a extensão.']
  ]) {
    const f = fixture({ action: 'upgrade', write: async () => { throw error; } });
    try {
      await f.app.router.navigate('#/extensions/discover');
      const button = f.dom.button(f.entry.key);
      const click = button.fire('click');
      await f.dom.dialog().querySelector('[data-admin-installer-accept]').fire('click');
      await click;
      assert.equal(f.dom.root.querySelector('.admin-management-status').textContent, expected);
      assert.equal(button.disabled, false);
      assert.equal(f.scans(), 1, 'failed write never reloads discovery');
      assert.deepEqual(f.calls[0].args[2], { etag: '"screen-etag"' });
      const retry = button.fire('click');
      await f.dom.dialog().querySelector('[data-admin-installer-cancel]').fire('click');
      await retry;
      assert.equal(f.calls.length, 1, 'retry still requires fresh consent');
      f.dom.assertClean();
    } finally { f.app.stop(); }
  }
  console.log('ok - installer confirmation: write/concurrency failures report safely, release the lock and require fresh retry consent');
}

export async function runAdminInstallerConfirmationTests() {
  const originalConfirm = globalThis.confirm;
  const fallbackCalls = [];
  globalThis.confirm = (message) => { fallbackCalls.push(message); return false; };
  try {
    await consentAndKeyboardTests();
    await busyAndRetryTests();
    await lifecycleTests();
    await writeFailureTests();
    assert.deepEqual(fallbackCalls, [], 'a capable browser DOM never uses or auto-accepts native JS confirm');
    await helperAndFallbackTests(fallbackCalls);
    await asynchronousFallbackControllerTests();
  } finally { globalThis.confirm = originalConfirm; }
}
