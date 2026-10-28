import { escapeHtml, safeUrl } from '../security/sanitize.js';

export function createModuleRegistry() {
  const modules = new Map();
  return {
    register(name, module) { if (!name || !module || typeof module.render !== 'function' || !module.settings || (module.settingsSchema && typeof module.settingsSchema !== 'object')) throw new TypeError(`Módulo inválido: ${name}`); modules.set(name, { name, ...module }); return this; },
    render(name, context = {}) { const module = modules.get(name); if (!module || module.enabled === false) return ''; try { return module.render(context); } catch { return context.error ?? '<p class="module-error" role="alert">Não foi possível carregar este módulo.</p>'; } },
    renderPosition(position, entries = [], context = {}) { return entries.filter((entry) => entry.enabled !== false && (entry.position ?? 'sidebar') === position).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((entry) => this.render(entry.name, { ...context, settings: { ...this.settings(entry.name), ...(entry.settings ?? {}) } })).join(''); },
    settings(name) { return modules.get(name)?.settings ?? {}; },
    has(name) { return modules.has(name); }
  };
}

export const menuModule = { settings: { position: 'mainnav' }, render: ({ menus = [], link = (path) => `#${path}`, activePath = '' }) => `<nav aria-label="Menu principal"><ul>${menus.map((m) => { const href = link(m.path); const active = m.path === activePath; return `<li><a href="${safeUrl(href)}"${active ? ' aria-current="page"' : ''}>${escapeHtml(m.title)}</a></li>`; }).join('')}</ul></nav>` };
export const breadcrumbsModule = { settings: { position: 'breadcrumbs' }, render: ({ items = [] }) => `<nav aria-label="Breadcrumb"><ol>${items.map((item, index) => `<li${index === items.length - 1 ? ' aria-current="page"' : ''}>${escapeHtml(item)}</li>`).join('')}</ol></nav>` };
