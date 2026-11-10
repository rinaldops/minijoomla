/** Private same-browser journal; no cross-user/browser transaction or tenant writes. */
export function createInstallationJournal({ storage, key } = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof key !== 'string' || !key.startsWith('minijoomla:installation:')) throw new TypeError('Diário privado de instalação indisponível.');
  return Object.freeze({
    read() {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      if (typeof raw !== 'string' || raw.length > 256 * 1024) throw new TypeError('Diário inválido.');
      return JSON.parse(raw);
    },
    write(value) {
      const raw = JSON.stringify(value);
      if (typeof raw !== 'string' || raw.length > 256 * 1024) throw new TypeError('Diário excede limite.');
      storage.setItem(key, raw);
      if (storage.getItem(key) !== raw) throw new TypeError('Diário não confirmado.');
    }
  });
}
