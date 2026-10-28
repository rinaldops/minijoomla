export class Router {
  constructor({ base = '', onNavigate = () => {} } = {}) { this.base = base; this.onNavigate = onNavigate; }
  parse(href = globalThis.location?.hash || '#/') {
    const raw = href.replace(/^#/, '') || '/';
    const [path, query = ''] = raw.split('?');
    const normalizedPath = this.base && path.startsWith(this.base) ? path.slice(this.base.length) : path;
    return { path: normalizedPath || '/', params: Object.fromEntries(new URLSearchParams(query)) };
  }
  match(href, routes) {
    const location = this.parse(href);
    for (const route of routes) {
      const match = location.path.match(route.pattern);
      if (match) return { ...location, route, params: { ...location.params, ...(route.keys ?? []).reduce((a, key, i) => ({ ...a, [key]: this.decode(match[i + 1]) }), {}) } };
    }
    return { ...location, route: null };
  }
  decode(value) { try { return decodeURIComponent(value); } catch { return value; } }
  start(routes) { this.stop(); this.routes = routes; this._listener = () => { if (this._skipHashChange) { this._skipHashChange = false; return; } return this.handle(); }; this._popstateListener = () => this.handle(); globalThis.addEventListener?.('hashchange', this._listener); globalThis.addEventListener?.('popstate', this._popstateListener); return this.handle(); }
  stop() { if (this._listener) globalThis.removeEventListener?.('hashchange', this._listener); if (this._popstateListener) globalThis.removeEventListener?.('popstate', this._popstateListener); this._listener = null; this._popstateListener = null; this._skipHashChange = false; }
  handle() { return this.onNavigate(this.match(globalThis.location?.hash || '#/', this.routes ?? [])); }
  navigate(href) { if (typeof globalThis.location !== 'undefined' && href.startsWith('#')) { const targetHash = href; if (globalThis.location.hash !== targetHash) { if (globalThis.history?.pushState) globalThis.history.pushState({}, '', targetHash); else { this._skipHashChange = true; globalThis.location.hash = targetHash; } return this.onNavigate(this.match(href, this.routes ?? [])); } } return this.onNavigate(this.match(href, this.routes ?? [])); }
  link(path, params = {}) { const rawPath = String(path || '/'); const pathWithSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`; const normalizedBase = this.base ? (this.base.startsWith('/') ? this.base.replace(/\/$/, '') : `/${this.base.replace(/\/$/, '')}`) : ''; const normalizedPath = pathWithSlash === normalizedBase || pathWithSlash.startsWith(`${normalizedBase}/`) ? pathWithSlash : `${normalizedBase}${pathWithSlash}`; const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString(); return `#${normalizedPath || '/'}${query ? `?${query}` : ''}`; }
}
