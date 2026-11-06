import assert from 'node:assert/strict';
import { createSampleDataJournal } from '../src/libraries/minijoomla/infrastructure/sample-data-journal.js';

export async function runSampleDataJournalTests() {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const a = createSampleDataJournal({ storage, key: 'mj:sample:/sites/example' });
  assert.equal(a.read(), null);
  const data = JSON.parse('{"receipts":[{"id":1,"etag":"\\\"1\\\""}],"__proto__":{"keep":true}}');
  a.write(data); assert.deepEqual(a.read(), data); assert.equal({}.keep, undefined);
  const returned = a.read(); returned.receipts.push({ id: 2 }); assert.equal(a.read().receipts.length, 1);
  const b = createSampleDataJournal({ storage, key: 'mj:sample:/sites/example' });
  const order = [];
  await Promise.all([a.withLock(async () => { order.push('a'); await Promise.resolve(); order.push('end-a'); }), b.withLock(() => order.push('b'))]);
  assert.deepEqual(order, ['a', 'end-a', 'b']); assert.equal(a.crossTabLockAvailable, false);
  memory.set('mj:sample:/sites/example', 'not-json'); assert.throws(() => a.read());
  memory.set('mj:sample:/sites/example', ''); assert.throws(() => a.read());
  assert.throws(() => a.write({ value: 'a'.repeat(512 * 1024) }), /limite/);
  let accessed = false; const getter = { get value() { accessed = true; return 'bad'; } };
  assert.throws(() => a.write(getter)); assert.equal(accessed, false);
  const quota = createSampleDataJournal({ storage: { getItem: () => null, setItem() { throw Error('quota'); } }, key: 'quota' });
  assert.throws(() => quota.write({ value: 1 }), /quota/);
  const noAck = createSampleDataJournal({ storage: { getItem: () => null, setItem() {} }, key: 'noack' });
  assert.throws(() => noAck.write({ value: 1 }), /confirmado/);
  let request;
  const locked = createSampleDataJournal({ storage, key: 'locks', locks: { request(key, options, run) { request = { key, options }; return run(); } } });
  assert.equal(await locked.withLock(() => 42), 42); assert.equal(locked.crossTabLockAvailable, true);
  assert.deepEqual(request, { key: 'locks', options: { mode: 'exclusive' } });
  console.log('ok - sample journal: durable readback, bounded private JSON, corruption/quota failures, same-key locking and no global-session transaction claim');
}
