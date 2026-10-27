export function createModuleRegistry() {
  const modules = new Map();
  return { register(name, module) { modules.set(name, module); return this; }, render(name, context) { return modules.get(name)?.render(context) ?? ''; }, settings(name) { return modules.get(name)?.settings ?? {}; } };
}

export const menuModule = { settings: { position: 'mainnav' }, render: ({ menus = [], link = (path) => `#${path}` }) => `<nav aria-label="Menu principal"><ul>${menus.map((m) => `<li><a href="${link(m.path)}">${m.title}</a></li>`).join('')}</ul></nav>` };
export const breadcrumbsModule = { settings: { position: 'breadcrumbs' }, render: ({ items = [] }) => `<nav aria-label="Breadcrumb"><ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol></nav>` };
