import assert from 'node:assert/strict';
import { createExtensionRootsService } from '../src/libraries/minijoomla/application/extension-roots-service.js';

const clone = value => JSON.parse(JSON.stringify(value));
const webUrl = '/sites/demo'; const libraryPath = `${webUrl}/SiteAssets/minijoomla`;
const root = (id = 'r1', discover = true) => ({ id, baseUrl: `${webUrl}/SiteAssets/packages/${id}/`, inventoryHash: 'a'.repeat(64), immutable: true, discover });
const config = (id = 'r1', discover = true) => ({ joomlaDiscoveryRoots: [root(id, discover)], moduleStyles: { example: [`${root(id).baseUrl}media/example.css`] }, moduleStyleRevisions: { example: { [`${root(id).baseUrl}modules/mod_example/example.js`]: [`${root(id).baseUrl}media/example.css`] } } });
const envelope = (roots = [], extra = {}) => ({ format: 'minijoomla-extensions-host-v1', webUrl, libraryPath, joomlaDiscoveryRoots: roots, moduleStyles: {}, moduleStyleRevisions: {}, ...extra });
function fixture(configuration = null) {
  const state = { configuration: clone(configuration), etag: configuration === null ? null : '"1"', reads: 0, verifies: 0, writes: [], version: 1 };
  const port = {
    webUrl, libraryPath,
    async read() { state.reads++; return clone({ configuration: state.configuration, etag: state.etag }); },
    async verifyPackage(configuration) { state.verifies++; return clone(configuration); },
    async write(configuration, options) {
      assert.equal(options.isCurrent(), true); assert.equal(options.expectedETag, state.etag);
      state.writes.push(clone(configuration)); state.configuration = clone(configuration); state.etag = `"${++state.version}"`;
      return clone({ configuration: state.configuration, etag: state.etag });
    }
  };
  return { state, port, service: createExtensionRootsService({ port }) };
}
const add = (service, input = config(), expectedETag = null, extra = {}) => service.add({ confirm: true, input, expectedETag, ...extra });
const blocked = result => assert.equal(result.status, 'blocked');

export async function runExtensionRootsServiceTests() {
  // 1. Absent means an empty approved envelope, not uninstalled; inspect is read-only.
  {
    const { state, service } = fixture(); const inspected = await service.inspect();
    assert.equal(inspected.status, 'ready'); assert.equal(inspected.etag, null);
    assert.deepEqual(inspected.configuration, envelope()); assert.equal(state.writes.length, 0);
    assert.deepEqual(Object.keys(service).sort(), ['add', 'inspect', 'setDiscover']);
    const { port } = fixture(); delete port.write; delete port.verifyPackage;
    const readOnly = createExtensionRootsService({ port }); assert.equal((await readOnly.inspect()).status, 'ready');
    assert.equal((await add(readOnly)).status, 'unavailable');
    const denied = fixture(); denied.port.read = async () => { throw new Error('403 secret tenant/token'); };
    const failed = await denied.service.inspect(); assert.equal(failed.status, 'unavailable');
    assert.equal(Object.hasOwn(failed, 'configuration'), false); assert.doesNotMatch(failed.message, /secret|token|403/);
  }
  // 2. Explicit confirmation/ETag/single-root approval; no implicit resume or batch.
  {
    const { state, service } = fixture();
    for (const options of [{ input: config(), expectedETag: null }, { confirm: true, input: config() }, { confirm: true, input: config(), expectedETag: undefined }, { confirm: true, input: config(), expectedETag: '*' }, { confirm: true, input: config(), expectedETag: 'W/"1"' }, { confirm: true, input: config(), expectedETag: null, resume: true }]) blocked(await service.add(options));
    blocked(await add(service, { joomlaDiscoveryRoots: [] }));
    blocked(await add(service, { joomlaDiscoveryRoots: [root(), root('r2')] }));
    for (const patch of [{ immutable: false }, { inventoryHash: 'A'.repeat(64) }, { baseUrl: '/sites/demoevil/SiteAssets/pkg/' }, { baseUrl: `${webUrl}/SiteAssets/` }, { baseUrl: `${webUrl}/Elsewhere/pkg/` }, { baseUrl: `${webUrl}/SiteAssets/../pkg/` }, { baseUrl: `${webUrl}/SiteAssets/pkg%2fother/` }, { baseUrl: `${webUrl}/SiteAssets/pkg//` }, { future: 1 }]) blocked(await add(service, { joomlaDiscoveryRoots: [{ ...root(), ...patch }] }));
    blocked(await add(service, { ...config(), future: true }));
    blocked(await add(service, { ...config(), moduleStyles: { ' example ': [] } }));
    assert.equal(state.writes.length, 0); assert.equal(state.verifies, 0);
  }
  // 3. Exclusive creation, normalized JSON and byte-equivalent receipt/readback.
  {
    const { state, service } = fixture(); const selected = config(); delete selected.joomlaDiscoveryRoots[0].discover;
    selected.joomlaDiscoveryRoots[0].baseUrl = selected.joomlaDiscoveryRoots[0].baseUrl.slice(0, -1);
    const result = await add(service, JSON.stringify(selected));
    assert.equal(result.status, 'ready'); assert.equal(result.etag, '"2"'); assert.equal(state.writes.length, 1);
    assert.equal(state.verifies, 1); assert.equal(state.reads, 3); assert.deepEqual(result.configuration.joomlaDiscoveryRoots, [root()]);
    assert.equal(Object.hasOwn(result.configuration, 'initialSite'), false);
    const again = await add(service, config(), result.etag); assert.equal(again.status, 'ready'); assert.equal(state.writes.length, 1);
  }
  // 4. Preserve all old roots, discovery flags, CSS revisions and future JSON.
  {
    const old = config(); const future = JSON.parse('{"__proto__":{"safe":true},"constructor":{"prototype":{"safe":true}},"toJSON":"data"}');
    const initial = envelope([root('r1', false)], { moduleStyles: old.moduleStyles, moduleStyleRevisions: old.moduleStyleRevisions, future, initialSite: { siteName: 'Untouched' } });
    const { state, service } = fixture(initial); const result = await add(service, config('r2'), '"1"');
    assert.equal(result.status, 'ready'); assert.deepEqual(result.configuration.joomlaDiscoveryRoots, [root('r1', false), root('r2')]);
    assert.deepEqual(result.configuration.future, future); assert.deepEqual(result.configuration.initialSite, initial.initialSite);
    assert.deepEqual(result.configuration.moduleStyles, config('r2').moduleStyles);
    assert.deepEqual(result.configuration.moduleStyleRevisions.example, { ...old.moduleStyleRevisions.example, ...config('r2').moduleStyleRevisions.example });
    assert.equal(Object.hasOwn(result.configuration.future, '__proto__'), true); assert.equal(Object.prototype.safe, undefined);
    assert.equal(state.writes.length, 1); assert.deepEqual(initial.joomlaDiscoveryRoots, [root('r1', false)]);
  }
  // 5. Corrupt/future root schemas and noncanonical stored state block, never repair.
  {
    const invalid = [envelope([{ ...root(), future: { keep: true } }]), envelope([{ ...root(), discover: undefined }]), envelope([root(), root()]), envelope([{ ...root(), baseUrl: root().baseUrl.slice(0, -1) }]), envelope([], { format: 'future-v2' }), envelope([], { webUrl: '/sites/other' }), envelope([], { moduleStyles: { ' example ': [] } })];
    for (const stored of invalid) {
      const { state, service } = fixture(stored); blocked(await service.inspect()); blocked(await add(service, config('r2'), '"1"')); assert.equal(state.writes.length, 0);
    }
    const weak = fixture(envelope()); weak.state.etag = 'W/"1"'; blocked(await weak.service.inspect());
    const mismatch = fixture(); mismatch.state.etag = '"1"'; blocked(await mismatch.service.inspect());
  }
  // 6. Ten includes discover:false; duplicate IDs/bases and immutable revisions conflict.
  {
    const ten = fixture(envelope(Array.from({ length: 10 }, (_, index) => root(`r${index}`, false))));
    blocked(await add(ten.service, config('eleven'), '"1"')); assert.equal(ten.state.writes.length, 0);
    const old = config(); const { state, service } = fixture(envelope(old.joomlaDiscoveryRoots, { moduleStyles: old.moduleStyles, moduleStyleRevisions: old.moduleStyleRevisions }));
    for (const patch of [{ baseUrl: root('other').baseUrl }, { inventoryHash: 'b'.repeat(64) }, { discover: false }]) blocked(await add(service, { ...old, joomlaDiscoveryRoots: [{ ...root(), ...patch }] }, '"1"'));
    blocked(await add(service, { joomlaDiscoveryRoots: [{ ...root(), id: 'other' }] }, '"1"'));
    const conflict = clone(old); conflict.moduleStyleRevisions.example[`${root().baseUrl}modules/mod_example/example.js`] = [`${root().baseUrl}media/other.css`];
    blocked(await add(service, conflict, '"1"')); assert.equal(state.writes.length, 0);
    const repeated = await add(ten.service, { joomlaDiscoveryRoots: [root('r0', false)] }, '"1"'); assert.equal(repeated.status, 'ready'); assert.equal(ten.state.writes.length, 0);
  }
  // 7. ETag and full-document/context rechecks after package verification.
  {
    const stale = fixture(envelope()); blocked(await add(stale.service, config(), null)); assert.equal(stale.state.verifies, 0);
    for (const change of [f => { f.state.etag = '"2"'; }, f => { f.state.configuration.future = 'changed without ETag'; }, f => { f.port.webUrl = '/sites/other'; }, f => { f.port.libraryPath += '/other'; }]) {
      const f = fixture(envelope()); f.port.verifyPackage = async selected => { change(f); return selected; };
      const result = await add(f.service, config(), '"1"'); assert.notEqual(result.status, 'ready'); assert.equal(f.state.writes.length, 0);
    }
    const mismatch = fixture(); mismatch.port.verifyPackage = async selected => ({ ...selected, extra: true });
    blocked(await add(mismatch.service)); assert.equal(mismatch.state.writes.length, 0);
    const denial = fixture(); denial.port.verifyPackage = async () => { throw new Error('private inventory/XML error'); };
    assert.equal((await add(denial.service)).status, 'unavailable'); assert.equal(denial.state.writes.length, 0);
    const mutated = fixture(); mutated.port.verifyPackage = async selected => { selected.joomlaDiscoveryRoots[0].id = 'changed'; return selected; };
    blocked(await add(mutated.service)); assert.equal(mutated.state.writes.length, 0);
  }
  // 8. Flag-only updates have no package verification, code activation or deletion.
  {
    const selected = config(); const initial = envelope(selected.joomlaDiscoveryRoots, { moduleStyles: selected.moduleStyles, moduleStyleRevisions: selected.moduleStyleRevisions, future: [1, null] });
    const { state, service } = fixture(initial);
    const changed = await service.setDiscover({ confirm: true, rootId: 'r1', discover: false, expectedETag: '"1"' });
    assert.equal(changed.status, 'ready'); const expected = clone(initial); expected.joomlaDiscoveryRoots[0].discover = false;
    assert.deepEqual(changed.configuration, expected); assert.equal(state.verifies, 0);
    assert.equal((await service.setDiscover({ confirm: true, rootId: 'r1', discover: false, expectedETag: changed.etag })).status, 'ready'); assert.equal(state.writes.length, 1);
    blocked(await service.setDiscover({ confirm: true, rootId: 'missing', discover: true, expectedETag: changed.etag }));
    blocked(await service.setDiscover({ confirm: true, rootId: 'r1', discover: 1, expectedETag: changed.etag }));
  }
  // 9. Own data only, null prototypes/dense arrays accepted; getters never execute.
  {
    let calls = 0; const getter = () => { calls++; throw new Error('never'); };
    const withGetter = config(); Object.defineProperty(withGetter.joomlaDiscoveryRoots[0], 'id', { enumerable: true, get: getter });
    const f = fixture(); blocked(await add(f.service, withGetter));
    const args = { confirm: true, expectedETag: null }; Object.defineProperty(args, 'input', { enumerable: true, get: getter }); blocked(await f.service.add(args));
    f.port.read = async () => ({ configuration: Object.defineProperty(envelope(), 'future', { enumerable: true, get: getter }), etag: '"1"' });
    blocked(await f.service.inspect()); assert.equal(calls, 0);
    const sparse = []; sparse.length = 1; blocked(await add(fixture().service, { joomlaDiscoveryRoots: sparse }));
    const exotic = config(); Object.setPrototypeOf(exotic, { inherited: true }); blocked(await add(fixture().service, exotic));
    const nulls = config(); Object.setPrototypeOf(nulls, null); Object.setPrototypeOf(nulls.joomlaDiscoveryRoots, null);
    Object.setPrototypeOf(nulls.joomlaDiscoveryRoots[0], null); assert.equal((await add(fixture().service, nulls)).status, 'ready');
    const reserved = config(); reserved.moduleStyles = JSON.parse(`{"constructor":["${root().baseUrl}media/example.css"]}`); reserved.moduleStyleRevisions = {};
    const accepted = await add(fixture().service, reserved); assert.equal(accepted.status, 'ready'); assert.equal(Object.hasOwn(accepted.configuration.moduleStyles, 'constructor'), true);
    const cycle = config(); cycle.self = cycle; blocked(await add(fixture().service, cycle));
    const symbol = config(); symbol[Symbol('hidden')] = true; blocked(await add(fixture().service, symbol));
  }
  // 10. Bounded bytes/depth/node count; no write on invalid JSON data.
  {
    let deep = null; for (let index = 0; index < 22; index++) deep = { next: deep };
    for (const future of ['x'.repeat(262145), '🚀'.repeat(70000), deep, Array.from({ length: 10000 }, () => null), { toJSON() { throw new Error('never'); } }]) {
      const f = fixture(); f.port.read = async () => ({ configuration: envelope([], { future }), etag: '"1"' });
      blocked(await f.service.inspect()); assert.equal(f.state.writes.length, 0);
    }
  }
  // 11. Sync cancellation and port-internal dispatch guard; uncertain writes never retry.
  {
    const cancelled = fixture(); assert.equal((await add(cancelled.service, config(), null, { isCurrent: () => false })).status, 'unavailable'); assert.equal(cancelled.state.reads, 0);
    let active = true; const f = fixture(); const originalWrite = f.port.write;
    f.port.write = async (configuration, options) => { active = false; assert.equal(options.isCurrent(), false); throw new Error('dispatch cancelled'); };
    const result = await add(f.service, config(), null, { isCurrent: () => active }); assert.equal(result.status, 'unavailable'); assert.match(result.message, /incerta/); assert.equal(f.state.writes.length, 0);
    f.port.write = originalWrite; assert.equal((await f.service.inspect()).status, 'ready'); assert.equal(f.state.writes.length, 0);
    for (const mode of ['throw', 'weak', 'receipt', 'readback']) {
      const t = fixture(); const write = t.port.write; let count = 0;
      t.port.write = async (configuration, options) => {
        count++; const receipt = await write(configuration, options);
        if (mode === 'throw') throw new Error('secret transport response');
        if (mode === 'weak') receipt.etag = 'W/"2"';
        if (mode === 'receipt') receipt.configuration.future = true;
        if (mode === 'readback') t.state.configuration.future = true;
        return receipt;
      };
      const failed = await add(t.service); assert.equal(failed.status, 'unavailable'); assert.match(failed.message, /incerta/); assert.doesNotMatch(failed.message, /secret/); assert.equal(count, 1);
      await t.service.inspect(); assert.equal(count, 1);
    }
    const concurrent = fixture(); let attempts = 0;
    concurrent.port.write = async () => { attempts++; concurrent.state.configuration = envelope([root('foreign')]); concurrent.state.etag = '"foreign"'; throw Object.assign(new Error('412 secret'), { status: 412 }); };
    assert.equal((await add(concurrent.service)).status, 'unavailable'); assert.equal(attempts, 1);
    const actual = await concurrent.service.inspect(); assert.deepEqual(actual.configuration.joomlaDiscoveryRoots, [root('foreign')]); assert.equal(attempts, 1);
  }
  // 12. Per-instance busy only; optional lock spans verification, writing and readback.
  {
    const f = fixture(); let release; let entered; const started = new Promise(resolve => { entered = resolve; });
    f.port.verifyPackage = async selected => { entered(); await new Promise(resolve => { release = resolve; }); return selected; };
    const pending = add(f.service); await started; blocked(await add(f.service)); blocked(await f.service.inspect());
    release(); assert.equal((await pending).status, 'ready'); assert.equal(f.state.writes.length, 1);
    const locked = fixture(); let held = false; let locks = 0;
    for (const method of ['read', 'verifyPackage', 'write']) {
      const original = locked.port[method]; locked.port[method] = async (...args) => { assert.equal(held, true); return original(...args); };
    }
    const service = createExtensionRootsService({ port: locked.port, locks: { async withLock(operation) { locks++; held = true; try { return await operation(); } finally { held = false; } } } });
    assert.equal((await service.inspect()).status, 'ready'); assert.equal((await add(service)).status, 'ready'); assert.equal(locks, 2); assert.equal(held, false);
    const moved = fixture();
    const queued = createExtensionRootsService({ port: moved.port, locks: { async withLock(operation) { moved.port.libraryPath += '/changed'; return operation(); } } });
    assert.equal((await add(queued)).status, 'unavailable'); assert.equal(moved.state.reads, 0); assert.equal(moved.state.writes.length, 0);
  }
  console.log('ok - extension roots: 12 groups cover approval, immutable merging, ETags, safe data, discovery flags and uncertain writes');
}
