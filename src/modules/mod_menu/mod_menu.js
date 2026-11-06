import { renderMenuTree } from './tmpl/default.js';

export const menuModule = {
  name: 'menu',
  settings: { position: 'mainnav', startLevel: 1, endLevel: 0, showAllChildren: true },
  settingsSchema: { startLevel: 'number', endLevel: 'number', showAllChildren: 'boolean' },
  render: ({ menus = [], link = (path) => `#${path}`, activePath = '', settings = {} } = {}) =>
    renderMenuTree({ menus, link, activePath, startLevel: settings?.startLevel, endLevel: settings?.endLevel, showAllChildren: settings?.showAllChildren })
};
