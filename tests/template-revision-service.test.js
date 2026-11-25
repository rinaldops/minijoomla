import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTemplateRevisionService } from '../src/libraries/minijoomla/application/template-revision-service.js';

const WEB = '/teams/revision-fixture';
const OLD = `${WEB}/SiteAssets/templates/sample/1.0.0/`;
const BASE = `${WEB}/SiteAssets/templates/sample/1.0.1/`;
const encode = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const defs = [
  { name: 'accent', type: 'text', default: 'blue', future: { retain: true } },
  { name: 'density', type: 'select', default: 'normal', options: [{ value: 'normal', label: 'Normal' }, { value: 'compact', label: 'Compact' }] }
];
const slots = ['hero', 'menu-principal', 'main-top', 'footer'];

// Match the real SPMIDDLE repository, not an enumerable fake ETag.
function transport(record, etag) {
  const result = copy(record);
  Object.defineProperty(result, 'etag', { value: etag, enumerable: false });
  return Object.freeze(result);
}
function assertTransport(record, expectedETag) {
  assert.ok(Object.isFrozen(record), 'Repository record must be frozen');
  assert.deepEqual(Object.getOwnPropertyDescriptor(record, 'etag'), {
    value: expectedETag, enumerable: false, writable: false, configurable: false
  });
  assert.ok(!Object.keys(record).includes('etag'));
}
const activity = f => ({
  templateReads: f.state.templateReads, configReads: f.state.configReads,
  downloads: f.state.downloads.length, writes: f.state.writes.length,
  configWrites: f.state.configWrites
});
function fixture({ legacy = false } = {}) {
  const state = {
    template: {
      id: 7, key: 'sample-template', title: 'Keep title', version: '1.0.0',
      entryPointUrl: `${OLD}index.js`, enabled: false, discoveredFrom: `${OLD}manifest.json`,
      positionsJson: JSON.stringify(slots), paramDefinitionsJson: JSON.stringify(defs),
      styles: legacy ? ` [ "${OLD}theme.css" ]\n` : JSON.stringify({
        format: 'minijoomla-template-metadata-v1', styles: [`${OLD}theme.css`],
        paramDefinitions: defs, future: { opaque: ['retain', 2] }
      }), future: { opaque: 'unchanged' }
    },
    config: {
      id: 1, templateKey: 'sample-template',
      templateStylesJson: ' [{"id":"sample-home","template":"sample-template","title":"Home","home":true,"params":{"accent":"blue","future":"retain"}}] ',
      templateParamsJson: '{ "unrelated": 1 }', componentParamsJson: '{"home":{"showComponent":false}}',
      moduleParamsJson: '{}', pluginParamsJson: '{}', future: { untouched: true }
    },
    templateETag: '"template-1"', configETag: '"config-1"', writes: [], downloads: [],
    templateReads: 0, configReads: 0, configWrites: 0, ack: 'normal', beforeTemplateRead: null,
    afterUpdate: null
  };
  const manifest = {
    key: 'sample-template', title: 'New title is not a patch', version: '1.0.1', positions: copy(slots),
    paramDefinitions: copy(defs), entryPointUrl: `${BASE}index.js`, styles: [`${BASE}theme.css`]
  };
  const files = new Map([
    [`${OLD}index.js`, encode('throw new Error("legacy must not execute");')],
    [`${OLD}theme.css`, encode('body { color: black; }')],
    [`${BASE}index.js`, encode('throw new Error("candidate must not execute"); import "./not-in-inventory.js";')],
    [`${BASE}theme.css`, encode('body { color: navy; }')],
    [`${BASE}extra.txt`, encode('explicit inventory asset')]
  ]);
  let inventory;
  const candidate = { baseUrl: BASE, manifestPath: 'manifest.json', inventoryPath: 'inventory.json', inventoryHash: '' };
  function repin(editInventory) {
    files.set(`${BASE}manifest.json`, encode(manifest));
    inventory = { version: manifest.version, algorithm: 'sha256', files: [
      'manifest.json', 'index.js', 'theme.css', 'extra.txt'
    ].map(path => { const data = files.get(`${BASE}${path}`); return { path, bytes: data.length, sha256: hash(data) }; }) };
    editInventory?.(inventory);
    files.set(`${BASE}inventory.json`, encode(inventory));
    candidate.inventoryHash = hash(files.get(`${BASE}inventory.json`));
  }
  repin();
  const admin = {
    templates: { async get(id) {
      assert.equal(id, 7);
      state.templateReads++;
      state.beforeTemplateRead?.();
      return transport(state.template, state.templateETag);
    } },
    siteConfig: { async get() { state.configReads++; return transport(state.config, state.configETag); } }
  };
  const repositories = {
    templates: {
      findById: admin.templates.get,
      async update(id, patch, options) {
        state.writes.push({ id, patch: copy(patch), options: copy(options) });
        assert.equal(id, 7);
        assert.deepEqual(Object.keys(patch).sort(), ['entryPointUrl', 'styles', 'version']);
        assert.equal(options.etag, state.templateETag);
        state.template = { ...state.template, ...copy(patch) };
        state.templateETag = `"template-${state.writes.length + 1}"`;
        state.afterUpdate?.();
        if (state.ack === 'null') return null;
        if (state.ack === '204') return 204;
        if (state.ack === 'status204') return { status: 204 };
        if (state.ack === 'throw') throw new Error('lost response');
        if (state.ack === 'getter') return Object.defineProperty({}, 'status', { get() { throw new Error('must not execute'); } });
        if (state.ack === 'wrong-id') return { id: 999 };
        if (state.ack === 'partial') return { id: 7 };
        return transport(state.template, state.templateETag);
      }
    },
    siteConfig: { async update() { state.configWrites++; assert.fail('SiteConfig writes forbidden'); } }
  };
  const filePort = { async downloadFile({ folderPath, fileName }) {
    const path = `${folderPath}/${fileName}`;
    state.downloads.push(path);
    assert.ok(files.has(path), `Fixture must have ${path}`);
    return { data: files.get(path).slice() };
  } };
  const service = createTemplateRevisionService({ admin, repositories, files: filePort, webUrl: WEB });
  return { state, files, manifest, candidate, repin, service, admin, repositories, filePort };
}
const prepare = f => f.service.prepare({ templateId: 7, candidate: f.candidate });
const commit = (f, ready, extra = {}) => f.service.commit({ plan: ready.plan, expectedETag: ready.expectedETag, confirm: true, ...extra });
const rollback = (f, receipt, extra = {}) => f.service.rollback({ rollback: receipt.rollback, expectedETag: receipt.rollback.expectedETag, confirm: true, ...extra });
const status = (result, expected) => assert.equal(result.status, expected, result.message);
async function readyFixture(options) {
  const f = fixture(options), ready = await prepare(f);
  status(ready, 'ready');
  return { f, ready };
}

export async function runTemplateRevisionServiceTests() {
  let checks = 0;
  async function check(name, fn) { await fn(); checks++; console.log(`ok - template revision: ${name}`); }
  await check('real non-enumerable ETags; read-only prepare; data-only session-bound plan', async () => {
    const { f, ready } = await readyFixture();
    assertTransport(await f.admin.templates.get(7), f.state.templateETag);
    assertTransport(await f.admin.siteConfig.get(), f.state.configETag);
    assert.deepEqual(ready.expectedETag, { template: '"template-1"', config: '"config-1"' });
    assert.deepEqual(copy(ready.plan), ready.plan);
    assert.equal(ready.snapshot.template.styles, f.state.template.styles);
    assert.equal(ready.snapshot.siteConfig.templateStylesJson, f.state.config.templateStylesJson);
    assert.equal(ready.snapshot.assets.length, 2);
    assert.equal(ready.plan.candidateAssets.length, 4);
    assert.ok(!ready.plan.candidateAssets.some(asset => asset.path.endsWith('/inventory.json')));
    assert.equal(f.state.writes.length, 0);
    assert.equal(f.state.configWrites, 0);
    // An unresolved static import is deliberately not followed: this is inventory
    // integrity only, NOT AST closure or execution of the hostile entrypoint.
    assert.ok(!f.state.downloads.some(path => path.endsWith('/not-in-inventory.js')));
    ready.plan.snapshot.template.future.opaque = 'tampered';
    status(await commit(f, ready), 'validation-failed');
    assert.equal(f.state.writes.length, 0);
    status(await commit(fixture(), await prepare(f)), 'validation-failed');
  });
  await check('normal ACK and complete GET records retain frozen/non-enumerable transport ETags through commit/rollback', async () => {
    const f = fixture(), before = copy(f.state.template), config = copy(f.state.config);
    const templateGet = f.admin.templates.get, configGet = f.admin.siteConfig.get;
    const update = f.repositories.templates.update, observations = [], acknowledgments = [];
    f.admin.templates.get = async id => {
      const record = await templateGet(id);
      assertTransport(record, f.state.templateETag);
      assert.deepEqual(copy(record), f.state.template);
      observations.push({ record: copy(record), tag: record.etag, writes: f.state.writes.length });
      return record;
    };
    f.admin.siteConfig.get = async () => {
      const record = await configGet();
      assertTransport(record, f.state.configETag);
      assert.deepEqual(copy(record), config);
      return record;
    };
    f.repositories.templates.update = async (...args) => {
      const ack = await update(...args);
      assertTransport(ack, f.state.templateETag);
      assert.deepEqual(copy(ack), f.state.template);
      acknowledgments.push(ack.etag);
      return ack;
    };
    const ready = await prepare(f); status(ready, 'ready');
    assert.equal(f.state.templateReads, 2);
    assert.equal(f.state.configReads, 2);
    const receipt = await commit(f, ready); status(receipt, 'committed');
    assert.deepEqual(acknowledgments, ['"template-2"']);
    assert.deepEqual(observations.at(-1), {
      record: { ...before, ...ready.plan.after }, tag: '"template-2"', writes: 1
    });
    assert.equal(f.state.templateReads, 6); // three preflights + independent post-PATCH GET
    assert.equal(f.state.configReads, 6);
    assert.deepEqual(receipt.rollback.postTemplate, { ...before, ...ready.plan.after, etag: '"template-2"' });
    status(await rollback(f, receipt), 'rolled-back');
    assert.deepEqual(acknowledgments, ['"template-2"', '"template-3"']);
    assert.deepEqual(observations.at(-1), { record: before, tag: '"template-3"', writes: 2 });
    assert.equal(f.state.templateReads, 10);
    assert.equal(f.state.configReads, 10);
    assert.deepEqual(f.state.template, before);
    assert.deepEqual(f.state.config, config);
    assert.equal(f.state.configWrites, 0);
  });
  await check('foreign plans and receipts fail before I/O across service instances sharing the same ports', async () => {
    const { f, ready } = await readyFixture();
    const other = createTemplateRevisionService({
      admin: f.admin, repositories: f.repositories, files: f.filePort, webUrl: WEB
    });
    let before = activity(f);
    status(await other.commit({ plan: copy(ready.plan), expectedETag: ready.expectedETag, confirm: true }), 'validation-failed');
    assert.deepEqual(activity(f), before);
    const receipt = await commit(f, ready); status(receipt, 'committed');
    before = activity(f);
    status(await other.rollback({ rollback: copy(receipt.rollback), expectedETag: receipt.rollback.expectedETag, confirm: true }), 'validation-failed');
    assert.deepEqual(activity(f), before);
    // Rejection by B neither consumes A's plan nor its usable rollback receipt.
    status(await rollback(f, receipt), 'rolled-back');
    assert.equal(f.state.writes.length, 2);
    assert.equal(f.state.configWrites, 0);
  });
  for (const legacy of [false, true]) await check(`single PATCH + full readback preserves wire/config/metadata; rollback (legacy=${legacy})`, async () => {
    const { f, ready } = await readyFixture({ legacy });
    const before = copy(f.state.template), config = copy(f.state.config);
    f.state.ack = 'partial'; // response may be partial; only GET is authoritative
    const receipt = await commit(f, ready);
    status(receipt, 'committed');
    assert.equal(f.state.writes.length, 1);
    assert.deepEqual(f.state.writes[0], { id: 7, patch: ready.plan.after, options: { etag: '"template-1"' } });
    assert.deepEqual(f.state.template, { ...before, ...ready.plan.after });
    assert.deepEqual(f.state.config, config);
    assert.equal(f.state.configWrites, 0);
    if (!legacy) {
      const patched = JSON.parse(f.state.template.styles), original = JSON.parse(before.styles);
      assert.deepEqual(patched, { ...original, styles: [`${BASE}theme.css`] });
    }
    status(await commit(f, ready), 'concurrency-conflict');
    status(await rollback(f, receipt, { confirm: false }), 'confirmation-required');
    const restored = await rollback(f, receipt);
    status(restored, 'rolled-back');
    assert.equal(f.state.writes.length, 2);
    assert.deepEqual(f.state.writes[1], { id: 7, patch: {
      version: before.version, entryPointUrl: before.entryPointUrl, styles: before.styles
    }, options: { etag: '"template-2"' } });
    assert.deepEqual(f.state.template, before);
    assert.deepEqual(f.state.config, config);
    status(await rollback(f, receipt), 'concurrency-conflict');
  });
  await check('explicit confirmation, strong ETags and late predispatch cancellation do not write/consume', async () => {
    const { f, ready } = await readyFixture();
    status(await commit(f, ready, { confirm: false }), 'confirmation-required');
    for (const bad of ['*', 'W/"one"', '"a","b"', 12]) {
      status(await commit(f, ready, { expectedETag: { template: bad, config: '"config-1"' } }), 'validation-failed');
    }
    status(await commit(f, ready, { expectedETag: { template: '"different"', config: '"config-1"' } }), 'concurrency-conflict');
    let cancelled = false;
    const beforeReads = f.state.templateReads;
    // The third re-read belongs to write()'s final preflight, not a dispatched request.
    f.state.beforeTemplateRead = () => { if (f.state.templateReads === beforeReads + 3) cancelled = true; };
    status(await commit(f, ready, { isCurrent: () => !cancelled }), 'concurrency-conflict');
    assert.equal(f.state.writes.length, 0);
    f.state.beforeTemplateRead = null;
    status(await commit(f, ready), 'committed');
  });
  for (const target of ['template-etag', 'config-etag', 'template-field', 'config-field', 'legacy-bytes', 'candidate-bytes']) {
    await check(`precommit revalidation blocks ${target}`, async () => {
      const { f, ready } = await readyFixture();
      if (target === 'template-etag') f.state.templateETag = '"external"';
      if (target === 'config-etag') f.state.configETag = '"external"';
      if (target === 'template-field') f.state.template.future.opaque = 'external';
      if (target === 'config-field') f.state.config.future.untouched = false;
      if (target === 'legacy-bytes') f.files.set(`${OLD}theme.css`, encode('changed'));
      if (target === 'candidate-bytes') f.files.set(`${BASE}theme.css`, encode('changed'));
      status(await commit(f, ready), target === 'candidate-bytes' ? 'validation-failed' : 'concurrency-conflict');
      assert.equal(f.state.writes.length, 0);
    });
  }
  for (const ack of ['null', '204', 'status204', 'throw', 'getter', 'wrong-id']) {
    await check(`postdispatch ${ack} is uncertain even with favorable GET; no replay`, async () => {
      const { f, ready } = await readyFixture(); f.state.ack = ack;
      status(await commit(f, ready), 'uncertain');
      assert.equal(f.state.template.version, '1.0.1');
      assert.equal(f.state.writes.length, 1);
      status(await commit(f, ready), 'concurrency-conflict');
      assert.equal(f.state.writes.length, 1);
    });
  }
  for (const mutation of ['unrelated-field', 'config', 'no-new-etag', 'read-failure', 'obsolete']) {
    await check(`postdispatch ${mutation} cannot certify success`, async () => {
      const { f, ready } = await readyFixture(); let current = true;
      f.state.afterUpdate = () => {
        if (mutation === 'unrelated-field') f.state.template.enabled = true;
        if (mutation === 'config') f.state.configETag = '"external"';
        if (mutation === 'no-new-etag') f.state.templateETag = '"template-1"';
        if (mutation === 'read-failure') f.state.beforeTemplateRead = () => { throw new Error('GET unavailable'); };
        if (mutation === 'obsolete') current = false;
      };
      status(await commit(f, ready, { isCurrent: () => current }), 'uncertain');
      assert.equal(f.state.writes.length, 1);
    });
  }
  await check('parallel/replayed commit does not dispatch twice', async () => {
    const { f, ready } = await readyFixture();
    const results = await Promise.all([commit(f, ready), commit(f, ready)]);
    assert.deepEqual(results.map(result => result.status).sort(), ['committed', 'concurrency-conflict']);
    assert.equal(f.state.writes.length, 1);
  });
  for (const target of ['etag', 'key', 'legacy-bytes', 'candidate-bytes', 'config', 'receipt']) {
    await check(`rollback validates its own receipt and ${target}`, async () => {
      const { f, ready } = await readyFixture(); const receipt = await commit(f, ready); status(receipt, 'committed');
      if (target === 'etag') f.state.templateETag = '"external"';
      if (target === 'key') f.state.template.key = 'other-template';
      if (target === 'legacy-bytes') f.files.set(`${OLD}index.js`, encode('changed'));
      if (target === 'candidate-bytes') f.files.set(`${BASE}index.js`, encode('changed'));
      if (target === 'config') f.state.configETag = '"external"';
      if (target === 'receipt') receipt.rollback.postUpdateETag = '"tampered"';
      status(await rollback(f, receipt), ['candidate-bytes', 'receipt'].includes(target) ? 'validation-failed' : 'concurrency-conflict');
      assert.equal(f.state.writes.length, 1);
    });
  }
  await check('uncertain rollback is consumed; favorable readback does not permit replay', async () => {
    const { f, ready } = await readyFixture(); const receipt = await commit(f, ready);
    f.state.ack = 'null';
    status(await rollback(f, receipt), 'uncertain');
    assert.equal(f.state.template.version, '1.0.0');
    status(await rollback(f, receipt), 'concurrency-conflict');
    assert.equal(f.state.writes.length, 2);
  });
  const invalidCandidates = [
    ['missing-pin', f => { delete f.candidate.inventoryHash; }],
    ['non-string-pin', f => { f.candidate.inventoryHash = 1; }],
    ['bad-pin', f => { f.candidate.inventoryHash = '0'.repeat(64); }],
    ['missing-manifest-entry', f => f.repin(i => { i.files.shift(); })],
    ['missing-entrypoint', f => f.repin(i => { i.files = i.files.filter(x => x.path !== 'index.js'); })],
    ['missing-style', f => f.repin(i => { i.files = i.files.filter(x => x.path !== 'theme.css'); })],
    ['self-inventory', f => f.repin(i => { i.files.push({ path: 'inventory.json', bytes: 0, sha256: '0'.repeat(64) }); })],
    ['case-duplicate', f => f.repin(i => { i.files.push({ ...i.files[1], path: 'INDEX.js' }); })],
    ['bad-size', f => f.repin(i => { i.files[1].bytes = -1; })],
    ['non-string-hash', f => f.repin(i => { i.files[1].sha256 = 1; })],
    ['asset-hash', f => f.repin(i => { i.files[1].sha256 = '0'.repeat(64); })],
    ['total-limit', f => f.repin(i => { i.files[1].bytes = 10 * 1024 * 1024 + 1; })],
    ['entry-limit', f => f.repin(i => { i.files = Array.from({ length: 501 }, (_, n) => ({ ...i.files[0], path: `${n}.js` })); })],
    ['algorithm', f => f.repin(i => { i.algorithm = 'md5'; })],
    ['inventory-version', f => f.repin(i => { i.version = '2.0.0'; })],
    ['key', f => { f.manifest.key = 'other'; f.repin(); }],
    ['old-version', f => { f.manifest.version = '1.0.0'; f.repin(); }],
    ['slots-order', f => { f.manifest.positions.reverse(); f.repin(); }],
    ['slots-duplicate', f => { f.manifest.positions.push('hero'); f.repin(); }],
    ['defs-order', f => { f.manifest.paramDefinitions.reverse(); f.repin(); }],
    ['defs-future', f => { f.manifest.paramDefinitions[0].future.retain = false; f.repin(); }],
    ['external-url', f => { f.manifest.entryPointUrl = 'https://example.org/index.js'; f.repin(); }],
    ['other-site', f => { f.manifest.entryPointUrl = '/teams/other/index.js'; f.repin(); }],
    ['other-release', f => { f.manifest.entryPointUrl = `${OLD}index.js`; f.repin(); }],
    ['encoded-traversal', f => { f.candidate.manifestPath = '%2e%2e/manifest.json'; }],
    ['traversal', f => { f.candidate.manifestPath = '../manifest.json'; }],
    ['query', f => { f.manifest.styles[0] += '?cache=1'; f.repin(); }],
    ['duplicate-style', f => { f.manifest.styles.push(f.manifest.styles[0]); f.repin(); }],
    ['missing-extra-bytes', f => { f.files.set(`${BASE}extra.txt`, encode('changed')); }]
  ];
  for (const [name, mutate] of invalidCandidates) await check(`candidate rejects ${name} before write`, async () => {
    const f = fixture(); mutate(f); status(await prepare(f), 'validation-failed'); assert.equal(f.state.writes.length, 0);
  });
  await check('snapshot/input rejects accessors/hooks/cycles/non-JSON without execution', async () => {
    let invoked = 0;
    for (const mutate of [
      record => Object.defineProperty(record, 'styles', { enumerable: true, get() { invoked++; return '[]'; } }),
      record => { record.future.toJSON = () => { invoked++; return {}; }; },
      record => { record.future = [1, , 3]; },
      record => { record.future = { invalid: undefined }; },
      record => { record.future = record; }
    ]) {
      const f = fixture(); const hostile = copy(f.state.template); mutate(hostile);
      Object.defineProperty(hostile, 'etag', { value: '"template-1"', enumerable: false });
      f.admin.templates.get = async () => hostile;
      status(await prepare(f), 'validation-failed'); assert.equal(f.state.writes.length, 0);
    }
    const f = fixture(), input = Object.defineProperty({}, 'confirm', { get() { invoked++; return true; } });
    status(await f.service.commit(input), 'validation-failed');
    assert.equal(invoked, 0);
  });
  for (const [name, mutate] of [
    ['field-accessor', (record, touch) => Object.defineProperty(record, 'templateStylesJson', { enumerable: true, get() { touch(); return '[]'; } })],
    ['etag-accessor', (record, touch) => Object.defineProperty(record, 'etag', { get() { touch(); return '"config-1"'; } })],
    ['toJSON-hook', (record, touch) => { record.future.toJSON = () => { touch(); return {}; }; }],
    ['cycle', record => { record.future = record; }],
    ['sparse-array', record => { record.future = [1, , 3]; }],
    ['undefined', record => { record.future = { invalid: undefined }; }]
  ]) await check(`SiteConfig ${name} is rejected as data without executing hooks or downloading assets`, async () => {
    const f = fixture(), originalGet = f.admin.siteConfig.get;
    const hostile = copy(f.state.config); let invoked = 0;
    mutate(hostile, () => { invoked++; });
    if (name !== 'etag-accessor') Object.defineProperty(hostile, 'etag', { value: '"config-1"', enumerable: false });
    Object.freeze(hostile);
    f.admin.siteConfig.get = async () => { f.state.configReads++; return hostile; };
    const result = await prepare(f); status(result, 'validation-failed');
    assert.equal(invoked, 0);
    assert.ok(!Object.hasOwn(result, 'plan'));
    assert.deepEqual(activity(f), { templateReads: 1, configReads: 1, downloads: 0, writes: 0, configWrites: 0 });
    f.admin.siteConfig.get = originalGet;
    status(await prepare(f), 'ready');
    assert.equal(invoked, 0);
  });
  await check('corrupt/missing rows, weak adapter ETag and absent dependencies fail closed', async () => {
    for (const mutate of [
      f => { f.admin.templates.get = async () => null; },
      f => { f.admin.siteConfig.get = async () => null; },
      f => { f.state.templateETag = '*'; },
      f => { f.state.template.enabled = 'false'; },
      f => { f.state.config.id = 0; },
      f => { f.state.config.templateStylesJson = 'broken'; }
    ]) { const f = fixture(); mutate(f); status(await prepare(f), 'validation-failed'); assert.equal(f.state.writes.length, 0); }
    status(await createTemplateRevisionService().prepare({}), 'unavailable');
  });
  const prepareDownloads = [
    `${BASE}inventory.json`, `${BASE}manifest.json`, `${BASE}index.js`,
    `${BASE}theme.css`, `${BASE}extra.txt`, `${OLD}index.js`, `${OLD}theme.css`
  ];
  for (const target of ['initial-template', 'initial-config', ...prepareDownloads, 'final-template', 'final-config']) {
    await check(`obsolete prepare during ${target} stops before subsequent downloads/plan and frees its reservation`, async () => {
      const f = fixture(), templateGet = f.admin.templates.get, configGet = f.admin.siteConfig.get;
      const download = f.filePort.downloadFile; let current = true;
      const finalRows = target.startsWith('final-'), expectedReads = finalRows ? 2 : 1;
      f.admin.templates.get = async id => {
        const record = await templateGet(id);
        if ((target === 'initial-template' && f.state.templateReads === 1)
          || (target === 'final-template' && f.state.templateReads === 2)) current = false;
        return record;
      };
      f.admin.siteConfig.get = async () => {
        const record = await configGet();
        if ((target === 'initial-config' && f.state.configReads === 1)
          || (target === 'final-config' && f.state.configReads === 2)) current = false;
        return record;
      };
      f.filePort.downloadFile = async input => {
        const response = await download(input);
        if (`${input.folderPath}/${input.fileName}` === target) current = false;
        return response;
      };
      const result = await f.service.prepare({ templateId: 7, candidate: f.candidate, isCurrent: () => current });
      status(result, 'concurrency-conflict');
      assert.ok(!Object.hasOwn(result, 'plan'));
      assert.ok(!Object.hasOwn(result, 'snapshot'));
      const expectedDownloads = finalRows ? prepareDownloads.length : Math.max(0, prepareDownloads.indexOf(target) + 1);
      assert.deepEqual(f.state.downloads, prepareDownloads.slice(0, expectedDownloads));
      // rows() checks currency around the GET pair, not between its two reads.
      assert.equal(f.state.templateReads, expectedReads);
      assert.equal(f.state.configReads, expectedReads);
      assert.equal(f.state.writes.length, 0);
      assert.equal(f.state.configWrites, 0);
      f.admin.templates.get = templateGet; f.admin.siteConfig.get = configGet;
      f.filePort.downloadFile = download;
      // The cancelled attempt must not leave one hidden reserved/pending slot.
      for (let n = 0; n < 16; n++) status(await prepare(f), 'ready');
      const before = activity(f);
      status(await prepare(f), 'unavailable');
      assert.deepEqual(activity(f), before);
    });
  }
  await check('16 pending plans block admission without extra reads/downloads or eviction', async () => {
    const f = fixture(), pending = [];
    for (let n = 0; n < 16; n++) { const ready = await prepare(f); status(ready, 'ready'); pending.push(ready); }
    const reads = f.state.templateReads, downloads = f.state.downloads.length;
    status(await prepare(f), 'unavailable');
    assert.equal(f.state.templateReads, reads);
    assert.equal(f.state.downloads.length, downloads);
    assert.equal(f.state.writes.length, 0);
    // A predispatch failure neither consumes a plan nor releases its slot.
    status(await commit(f, pending[0], { isCurrent: () => false }), 'concurrency-conflict');
    status(await prepare(f), 'unavailable');
    // Commit transfers a slot to a usable rollback receipt, not to free capacity.
    const receipt = await commit(f, pending[0]); status(receipt, 'committed');
    status(await prepare(f), 'unavailable');
    status(await rollback(f, receipt), 'rolled-back');
    status(await prepare(f), 'ready');
    status(await prepare(f), 'unavailable');
    assert.equal(f.state.writes.length, 2);
    assert.equal(f.state.configWrites, 0);
  });
  await check('parallel prepares reserve capacity before awaiting transport', async () => {
    const f = fixture(), originalGet = f.admin.templates.get;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    f.admin.templates.get = async id => { await gate; return originalGet(id); };
    const attempts = Array.from({ length: 17 }, () => prepare(f));
    status(await attempts[16], 'unavailable');
    assert.equal(f.state.templateReads, 0);
    assert.equal(f.state.downloads.length, 0);
    release();
    const results = await Promise.all(attempts);
    assert.equal(results.filter(result => result.status === 'ready').length, 16);
    assert.equal(results.filter(result => result.status === 'unavailable').length, 1);
    status(await prepare(f), 'unavailable');
    assert.equal(f.state.writes.length, 0);
  });
  await check('failed prepare releases reservations, including async transport failures', async () => {
    const f = fixture(), originalDownload = f.filePort.downloadFile;
    f.filePort.downloadFile = async () => { throw new Error('read unavailable'); };
    const failed = await Promise.all(Array.from({ length: 16 }, () => prepare(f)));
    for (const result of failed) status(result, 'unavailable');
    f.filePort.downloadFile = originalDownload;
    for (let n = 0; n < 16; n++) status(await prepare(f), 'ready');
    status(await prepare(f), 'unavailable');
    assert.equal(f.state.writes.length, 0);
  });
  await check('uncertain commit retires payload/slot but cannot replay', async () => {
    const f = fixture(), before = copy(f.state.template), pending = [];
    for (let n = 0; n < 16; n++) { const ready = await prepare(f); status(ready, 'ready'); pending.push(ready); }
    // Simulate an indeterminate response where readback still has old release
    // fields. A fresh prepare is read-only recovery, NOT a replay of the write.
    f.state.ack = 'null'; f.state.afterUpdate = () => { f.state.template = copy(before); };
    status(await commit(f, pending[0]), 'uncertain');
    status(await commit(f, pending[0]), 'concurrency-conflict');
    assert.equal(f.state.writes.length, 1);
    status(await prepare(f), 'ready');
    status(await prepare(f), 'unavailable');
    assert.equal(f.state.writes.length, 1);
  });
  await check('uncertain rollback retires payload/slot without evicting other pending plans', async () => {
    const f = fixture(), pending = [];
    for (let n = 0; n < 16; n++) { const ready = await prepare(f); status(ready, 'ready'); pending.push(ready); }
    const receipt = await commit(f, pending[0]); status(receipt, 'committed');
    status(await prepare(f), 'unavailable');
    f.state.ack = 'null';
    status(await rollback(f, receipt), 'uncertain');
    status(await rollback(f, receipt), 'concurrency-conflict');
    status(await prepare(f), 'ready');
    status(await prepare(f), 'unavailable');
    assert.equal(f.state.writes.length, 2);
  });
  await check('terminal FIFO boundaries 128/129/133 evict only oldest tokens; current rollback stays usable', async () => {
    const f = fixture(), history = [];
    async function rejected(ready, receipt, readyStatus, receiptStatus) {
      const before = activity(f);
      if (ready) status(await commit(f, ready), readyStatus);
      if (receipt) status(await rollback(f, receipt), receiptStatus);
      assert.deepEqual(activity(f), before, 'Rejected tokens must not perform I/O');
    }
    for (let n = 1; n <= 67; n++) {
      const ready = await prepare(f); status(ready, 'ready');
      const receipt = await commit(f, ready); status(receipt, 'committed');
      history.push({ ready, receipt });
      if (n === 65) {
        // 128 prior terminal tokens + this consumed plan = 129.
        await rejected(history[0].ready, history[0].receipt, 'validation-failed', 'concurrency-conflict');
        await rejected(history[1].ready, null, 'concurrency-conflict');
      }
      if (n === 67) {
        // 133 terminal tokens: exactly the oldest five have been evicted.
        for (const item of history.slice(0, 2)) await rejected(item.ready, item.receipt, 'validation-failed', 'validation-failed');
        await rejected(history[2].ready, history[2].receipt, 'validation-failed', 'concurrency-conflict');
        await rejected(history[3].ready, null, 'concurrency-conflict');
      }
      // Even at/above terminal capacity the latest receipt is never evicted.
      status(await rollback(f, receipt), 'rolled-back');
      if (n === 64) {
        // Exactly 128 terminals: both first tokens still count as consumed.
        await rejected(history[0].ready, history[0].receipt, 'concurrency-conflict', 'concurrency-conflict');
      }
    }
    await rejected(history.at(-1).ready, history.at(-1).receipt, 'concurrency-conflict', 'concurrency-conflict');
    assert.equal(f.state.writes.length, 134);
    status(await prepare(f), 'ready');
    assert.equal(f.state.configWrites, 0);
  });
  await check('opaque future/reserved own metadata keys roundtrip as data; rollback restores exact wire', async () => {
    const f = fixture(), envelope = JSON.parse(f.state.template.styles);
    const extras = JSON.parse('{"__proto__":{"revisionPolluted":"never"},"constructor":{"opaque":true},"prototype":{"retain":1},"toJSON":{"dataOnly":true},"nested":{"__proto__":{"keep":true}}}');
    for (const [key, value] of Object.entries(extras)) Object.defineProperty(envelope, key, {
      value, enumerable: true, configurable: true, writable: true
    });
    const wire = ` \n${JSON.stringify(envelope, null, 2)}\n`;
    f.state.template.styles = wire;
    const before = copy(f.state.template), config = copy(f.state.config);
    const ready = await prepare(f); status(ready, 'ready');
    const receipt = await commit(f, ready); status(receipt, 'committed');
    const patched = JSON.parse(f.state.template.styles);
    assert.deepEqual(Object.keys(patched).sort(), Object.keys(envelope).sort());
    for (const key of Object.keys(envelope)) if (key !== 'styles') assert.deepEqual(patched[key], envelope[key]);
    assert.deepEqual(patched.styles, [`${BASE}theme.css`]);
    assert.ok(Object.hasOwn(patched, '__proto__'));
    assert.equal(Object.getPrototypeOf(patched), Object.prototype);
    assert.equal(Object.prototype.revisionPolluted, undefined);
    status(await rollback(f, receipt), 'rolled-back');
    assert.equal(f.state.template.styles, wire);
    assert.deepEqual(f.state.template, before);
    assert.deepEqual(f.state.config, config);
    assert.equal(f.state.configWrites, 0);
  });
  for (const [name, mutate] of [
    ['invalid-json', f => { f.state.template.styles = '{broken'; }],
    ['unsupported-format', f => { const x = JSON.parse(f.state.template.styles); x.format = 'other'; f.state.template.styles = JSON.stringify(x); }],
    ['missing-styles', f => { const x = JSON.parse(f.state.template.styles); delete x.styles; f.state.template.styles = JSON.stringify(x); }],
    ['non-array-styles', f => { const x = JSON.parse(f.state.template.styles); x.styles = {}; f.state.template.styles = JSON.stringify(x); }],
    ['missing-definitions', f => { const x = JSON.parse(f.state.template.styles); delete x.paramDefinitions; f.state.template.styles = JSON.stringify(x); }],
    ['mismatched-definitions', f => { const x = JSON.parse(f.state.template.styles); x.paramDefinitions = []; f.state.template.styles = JSON.stringify(x); }]
  ]) await check(`corrupt legacy/envelope ${name} fails closed without defaults or writes`, async () => {
    const f = fixture(); mutate(f);
    const before = copy(f.state.template), config = copy(f.state.config);
    status(await prepare(f), 'validation-failed');
    assert.equal(f.state.writes.length, 0);
    assert.equal(f.state.configWrites, 0);
    assert.deepEqual(f.state.template, before);
    assert.deepEqual(f.state.config, config);
  });
  console.log(`Template revision checks: ${checks} passed (memory adapters; no browser, network or publication).`);
}
