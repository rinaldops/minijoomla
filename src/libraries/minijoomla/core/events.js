export class EventBus {
  #listeners = new Map();
  on(name, listener) {
    if (!name || typeof listener !== 'function') throw new TypeError('Listener inválido');
    const list = this.#listeners.get(name) ?? [];
    list.push(listener); this.#listeners.set(name, list);
    return () => this.#listeners.set(name, list.filter((item) => item !== listener));
  }
  emit(name, payload) { return Promise.all((this.#listeners.get(name) ?? []).map((listener) => listener(payload))); }
}
