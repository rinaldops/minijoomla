import { escapeHtml } from '../security/sanitize.js';
import { menuModule } from '../../../modules/mod_menu/mod_menu.js';

export { menuModule };

export function createModuleRegistry() {
  const modules = new Map();
  return {
    register(name, module) { if (!name || !module || typeof module.render !== 'function' || !module.settings || (module.settingsSchema && typeof module.settingsSchema !== 'object')) throw new TypeError(`Módulo inválido: ${name}`); modules.set(name, { name, ...module, settings: { ...module.settings }, settingsSchema: module.settingsSchema ? { ...module.settingsSchema } : module.settingsSchema }); return this; },
    render(name, context = {}) { const module = modules.get(name); if (!module || module.enabled === false) return ''; try { return module.render(context); } catch { return context.error ?? '<p class="module-error" role="alert">Não foi possível carregar este módulo.</p>'; } },
    renderPosition(position, entries = [], context = {}) {
      const items = Array.isArray(entries) ? entries : [];
      return [...items.filter((entry) => entry && entry.enabled !== false && (entry.position ?? 'sidebar') === position)]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((entry) => {
          const html = this.render(entry.name, {
            ...context, settings: { ...this.settings(entry.name), ...(entry.settings ?? {}) },
            showTitle: entry.showTitle, headerTag: entry.headerTag, headerClass: entry.headerClass
          });
          return entry.moduleClass ? `<div class="module ${escapeHtml(entry.moduleClass)}">${html}</div>` : html;
        }).join('');
    },
    settings(name) { return { ...(modules.get(name)?.settings ?? {}) }; },
    has(name) { return modules.has(name); }
  };
}
