import { parseJsonObject } from '../application/declared-params.js';

const MAX_BYTES = 512 * 1024;
const queues = new Map();

/** Per-browser installation journal, not a transaction/lock across SharePoint sessions. */
export function createSampleDataJournal({ storage, key, locks } = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new TypeError('Armazenamento durável não disponível.');
  if (typeof key !== 'string' || !key || key.length > 240 || /[\u0000-\u001f]/.test(key)) throw new TypeError('Chave de journal inválida.');
  const clone = value => parseJsonObject(value, { strict: true, field: 'Journal' });
  return Object.freeze({
    crossTabLockAvailable: typeof locks?.request === 'function',
    read() {
      const text = storage.getItem(key);
      if (text === null) return null;
      if (typeof text !== 'string' || !text || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Journal inválido ou excede o limite.');
      return clone(text);
    },
    write(value) {
      const text = JSON.stringify(clone(value));
      if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Journal excede o limite.');
      storage.setItem(key, text);
      if (storage.getItem(key) !== text) throw new Error('Journal não confirmado pelo armazenamento.');
    },
    async withLock(operation) {
      if (typeof operation !== 'function') throw new TypeError('Operação inválida.');
      if (typeof locks?.request === 'function') return locks.request(key, { mode: 'exclusive' }, operation);
      const previous = queues.get(key) ?? Promise.resolve();
      const next = previous.catch(() => {}).then(operation);
      queues.set(key, next);
      try { return await next; }
      finally { if (queues.get(key) === next) queues.delete(key); }
    }
  });
}
