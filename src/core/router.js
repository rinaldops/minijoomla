export class Router {
  constructor({ base = '', onNavigate = () => {} } = {}) { this.base = base; this.onNavigate = onNavigate; }
  parse(href = globalThis.location?.hash || '#/') {
    const raw = href.replace(/^#/, '') || '/';
    const [path, query = ''] = raw.split('?');
    return { path: path.replace(this.base, '') || '/', params: Object.fromEntries(new URLSearchParams(query)) };
  }
  match(href, routes) {
    const location = this.parse(href);
    for (const route of routes) {
      const match = location.path.match(route.pattern);
      if (match) return { ...location, route, params: { ...location.params, ...(route.keys ?? []).reduce((a, key, i) => ({ ...a, [key]: match[i + 1] }), {}) } };
    }
    return { ...location, route: null };
  }
  start(routes) { this.routes = routes; this.handle(); this._listener = () => this.handle(); globalThis.addEventListener?.('hashchange', this._listener); }
  handle() { return this.onNavigate(this.match(globalThis.location?.hash || '#/', this.routes ?? [])); }
  navigate(href) { return this.onNavigate(this.match(href, this.routes ?? [])); }
  link(path, params = {}) { const query = new URLSearchParams(params).toString(); return `#${path}${query ? `?${query}` : ''}`; }
}
