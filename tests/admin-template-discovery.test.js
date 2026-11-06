import assert from 'node:assert/strict';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';

const decode = (value) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function discoveryDocument() {
  let html = '', buttons = [], status;
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      status = value.includes('class="admin-management-status"') ? { textContent: '' } : null;
      buttons = [...value.matchAll(/<button\b([^>]*)>/g)].filter(([, attrs]) => /\bdata-admin-template-register="/.test(attrs)).map(([, attrs]) => {
        const listeners = new Map();
        return { disabled: false,
          dataset: Object.fromEntries([...attrs.matchAll(/\bdata-([a-z-]+)="([^"]*)"/g)].map(([, name, text]) => [name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), decode(text)])),
          addEventListener: (event, handler) => listeners.set(event, handler),
          click: () => listeners.get('click')?.()
        };
      });
    },
    querySelector: (selector) => selector === '.admin-management-status' ? status : null,
    querySelectorAll: (selector) => selector === '[data-admin-template-register]' ? buttons : []
  };
  return { documentRef: { body }, buttons: () => buttons, status: () => status };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const template = (key = 'sample') => ({ key, title: 'Template <title>', version: '1.2', entryPointUrl: './templates/sample.js', styles: '["./templates/sample.css"]', positions: ['footer'], discoveredFrom: `templates/${key}.manifest.json` });
function fixture({ entries = [template()], registered = [], scan, list, create } = {}) {
  const writes = [], records = structuredClone(registered);
  let scans = 0;
  const adminService = { templates: {
    list: list ?? (async () => records),
    create: async (input) => { writes.push(structuredClone(input)); const saved = create ? await create(input) : { id: records.length + 1, ...input }; records.push(saved); return saved; }
  } };
  const doc = discoveryDocument();
  const app = createAdminApplication({ adminService, discoveryService: { templates: { scan: async () => { scans++; return scan ? scan() : entries; } } }, documentRef: doc.documentRef, autoStart: false });
  return { app, doc, writes, scans: () => scans };
}

export async function runAdminTemplateDiscoveryTests() {
  const originalConfirm = globalThis.confirm;
  const prompts = [];
  const accept = (message) => { prompts.push(message); return true; };
  globalThis.confirm = accept;
  try {
    const entry = template();
    const expected = { ...structuredClone(entry), enabled: true };
    const f = fixture({ entries: [entry, { key: 'broken', error: '<private>' }, template('existing')], registered: [{ key: 'existing' }] });
    try {
      await f.app.router.navigate('#/templates/discover');
      assert.equal(f.doc.buttons().length, 1);
      assert.equal(f.writes.length, 0, 'scan/render never registers anything');
      assert.match(f.doc.documentRef.body.innerHTML, /&lt;private&gt;/);
      const button = f.doc.buttons()[0];
      Object.assign(button.dataset, { adminTemplateTitle: 'Injected', adminTemplateVersion: '9', adminTemplateEntry: 'javascript:x', adminTemplateStyles: 'unsafe', adminTemplatePositions: '{broken', adminTemplateFrom: 'forged' });
      const before = prompts.length;
      for (const key of ['unscanned', 'broken', 'existing']) {
        button.dataset.adminTemplateRegister = key;
        await button.click();
      }
      assert.equal(prompts.length, before);
      assert.equal(f.writes.length, 0);
      button.dataset.adminTemplateRegister = entry.key;
      entry.title = 'Changed after scan'; entry.positions.push('sidebar-right');
      await button.click();
      assert.deepEqual(f.writes, [expected], 'registration uses a detached metadata snapshot, not DOM attributes or mutable scan objects');
      assert.match(prompts.at(-1), /Registrar e habilitar/);
      assert.equal(f.scans(), 2);
    } finally { f.app.stop(); }

    for (const invalidate of ['navigate', 'stop']) {
      const f = fixture();
      try {
        await f.app.router.navigate('#/templates/discover');
        const button = f.doc.buttons()[0], before = prompts.length;
        if (invalidate === 'stop') f.app.stop(); else await f.app.router.navigate('#/unrelated');
        await button.click();
        assert.equal(f.writes.length, 0);
        assert.equal(prompts.length, before, 'detached screens do not prompt');
      } finally { f.app.stop(); }
    }

    const cancelled = fixture();
    try {
      await cancelled.app.router.navigate('#/templates/discover');
      const button = cancelled.doc.buttons()[0];
      for (const confirm of [undefined, () => false]) { globalThis.confirm = confirm; await button.click(); }
      assert.equal(cancelled.writes.length, 0);
      globalThis.confirm = accept;
      button.disabled = true;
      const before = prompts.length;
      await button.click();
      assert.equal(prompts.length, before, 'busy button does not prompt again');
    } finally { globalThis.confirm = accept; cancelled.app.stop(); }

    for (const outcome of ['resolve', 'reject']) {
      const pending = deferred();
      const f = fixture({ create: () => pending.promise });
      try {
        await f.app.router.navigate('#/templates/discover');
        const button = f.doc.buttons()[0];
        const click = button.click();
        assert.equal(button.disabled, true);
        await button.click();
        assert.equal(f.writes.length, 1, 'pending registration is not duplicated');
        await f.app.router.navigate('#/templates/discover');
        const status = f.doc.status(), html = f.doc.documentRef.body.innerHTML;
        if (outcome === 'resolve') pending.resolve({ key: 'sample' }); else pending.reject(new Error('private create error'));
        await click;
        assert.equal(f.scans(), 2, 'obsolete completion does not reload a new screen');
        assert.equal(status.textContent, '');
        assert.equal(f.doc.documentRef.body.innerHTML, html);
        assert.equal(button.disabled, false);
      } finally { f.app.stop(); }
    }

    for (const outcome of ['resolve', 'reject']) {
      const pending = deferred(), started = deferred();
      const f = fixture({ scan: () => { started.resolve(); return pending.promise; } });
      try {
        const navigation = f.app.router.navigate('#/templates/discover');
        await started.promise;
        await f.app.router.navigate('#/unrelated');
        const html = f.doc.documentRef.body.innerHTML;
        if (outcome === 'resolve') pending.resolve([template()]); else pending.reject(new Error('private scan error'));
        await navigation;
        assert.equal(f.doc.documentRef.body.innerHTML, html);
        assert.equal(f.writes.length, 0);
      } finally { f.app.stop(); }
    }

    for (const failed of ['scan', 'list']) {
      let failing = true;
      const f = fixture({ [failed]: async () => { if (failing) throw new Error('private backend details'); return failed === 'scan' ? [template()] : []; } });
      try {
        await f.app.router.navigate('#/templates/discover');
        assert.match(f.doc.documentRef.body.innerHTML, /role="alert">Não foi possível consultar a pasta de templates ou o catálogo/);
        assert.doesNotMatch(f.doc.documentRef.body.innerHTML, /private backend|data-admin-template-register=/);
        assert.equal(f.writes.length, 0);
        failing = false;
        await f.app.router.navigate('#/templates/discover');
        assert.equal(f.doc.buttons().length, 1);
      } finally { f.app.stop(); }
    }

    const failedCreate = fixture({ create: async () => { throw new Error('private create details'); } });
    try {
      await failedCreate.app.router.navigate('#/templates/discover');
      const button = failedCreate.doc.buttons()[0];
      await button.click();
      assert.equal(failedCreate.doc.status().textContent, 'Não foi possível registrar o template.');
      assert.equal(button.disabled, false);
      assert.equal(failedCreate.scans(), 1);
    } finally { failedCreate.app.stop(); }

    const changedDuringConfirmation = fixture();
    try {
      await changedDuringConfirmation.app.router.navigate('#/templates/discover');
      let navigation;
      globalThis.confirm = () => { navigation = changedDuringConfirmation.app.router.navigate('#/unrelated'); return true; };
      await changedDuringConfirmation.doc.buttons()[0].click();
      await navigation;
      assert.equal(changedDuringConfirmation.writes.length, 0);
    } finally { globalThis.confirm = accept; changedDuringConfirmation.app.stop(); }
  } finally { globalThis.confirm = originalConfirm; }
  console.log('ok - template discovery: trusted snapshots, confirmation, single submission, stale navigation and safe retryable errors');
}
