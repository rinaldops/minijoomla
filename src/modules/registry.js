import { escapeHtml, safeUrl } from '../security/sanitize.js';

export function createModuleRegistry() {
  const modules = new Map();
  return {
    register(name, module) { if (!name || !module || typeof module.render !== 'function' || !module.settings || (module.settingsSchema && typeof module.settingsSchema !== 'object')) throw new TypeError(`Módulo inválido: ${name}`); modules.set(name, { name, ...module }); return this; },
    render(name, context = {}) { const module = modules.get(name); if (!module || module.enabled === false) return ''; try { return module.render(context); } catch { return context.error ?? '<p class="module-error" role="alert">Não foi possível carregar este módulo.</p>'; } },
    renderPosition(position, entries = [], context = {}) { const items = Array.isArray(entries) ? entries : []; return items.filter((entry) => entry && entry.enabled !== false && (entry.position ?? 'sidebar') === position).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((entry) => this.render(entry.name, { ...context, settings: { ...this.settings(entry.name), ...(entry.settings ?? {}) } })).join(''); },
    settings(name) { return modules.get(name)?.settings ?? {}; },
    has(name) { return modules.has(name); }
  };
}

export const menuModule = { settings: { position: 'mainnav' }, render: ({ menus = [], link = (path) => `#${path}`, activePath = '' } = {}) => { const items = Array.isArray(menus) ? menus : []; return `<nav aria-label="Menu principal"><ul>${items.filter(Boolean).map((m) => { const href = link(m.path); const active = m.path === activePath; return `<li><a href="${safeUrl(href)}"${active ? ' aria-current="page"' : ''}>${escapeHtml(m.title)}</a></li>`; }).join('')}</ul></nav>`; } };
export const breadcrumbsModule = { settings: { position: 'breadcrumbs' }, render: ({ items = [] } = {}) => { const entries = Array.isArray(items) ? items : []; return `<nav aria-label="Breadcrumb"><ol>${entries.map((item, index) => `<li${index === entries.length - 1 ? ' aria-current="page"' : ''}>${escapeHtml(item)}</li>`).join('')}</ol></nav>`; } };
