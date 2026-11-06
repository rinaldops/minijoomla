import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';
import { menuPathKey } from '../../../libraries/minijoomla/application/module-assignment.js';

const PUBLISHED = new Set([true, 1, '1', 'Published', 'published', 'Publicado', 'publicado']);
const TREE_SELECTOR = '[data-menu-tree]';
const TOGGLE_SELECTOR = '[data-menu-tree-toggle]';
const SUBMENU_SELECTOR = '[data-menu-tree-submenu]';
let sequence = 0;

export function isMenuItemPublished(item) {
  if (!item || typeof item !== 'object') return false;
  return item.published === undefined || PUBLISHED.has(item.published);
}

function ordering(item) {
  const value = item.ordering;
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Sibling order: numeric `ordering` first (ascending), then title. */
export function compareMenuItems(left, right) {
  const leftOrder = ordering(left);
  const rightOrder = ordering(right);
  if (leftOrder !== null && rightOrder !== null) return leftOrder - rightOrder;
  if (leftOrder !== null) return -1;
  if (rightOrder !== null) return 1;
  return String(left.title ?? '').localeCompare(String(right.title ?? ''));
}

function key(value) {
  if (value === undefined || value === null || value === '' || value === 0 || value === '0') return null;
  if (typeof value === 'object') return key(value.id);
  return String(value);
}

/**
 * Builds a forest from flat items using `id`/`parentId`.
 * - Only published items are kept; descendants of an unpublished (or hidden) item are hidden too.
 * - Items whose parent does not exist are promoted to the top level.
 * - Cycles are broken deterministically: the first item (sibling order) of an unreachable group becomes top level.
 * Returns nodes `{ item, children, depth }`.
 */
export function buildMenuTree(menus = []) {
  const items = (Array.isArray(menus) ? menus : []).filter((item) => item && typeof item === 'object');
  const byId = new Map();
  for (const item of items) { const id = key(item.id); if (id !== null && !byId.has(id)) byId.set(id, item); }
  const visible = items.filter(isMenuItemPublished);

  const hidden = (item) => {
    const seen = new Set([item]);
    let current = byId.get(key(item.parentId));
    while (current && !seen.has(current)) {
      if (!isMenuItemPublished(current)) return true;
      seen.add(current);
      current = byId.get(key(current.parentId));
    }
    return false;
  };
  const candidates = visible.filter((item) => !hidden(item));
  const children = new Map();
  const roots = [];
  for (const item of candidates) {
    const parentKey = key(item.parentId);
    const parent = parentKey === null ? undefined : byId.get(parentKey);
    if (!parent || parent === item) { roots.push(item); continue; }
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(item);
  }

  const visited = new Set();
  const build = (item, depth) => {
    visited.add(item);
    const nested = (children.get(item) ?? []).filter((child) => !visited.has(child)).sort(compareMenuItems);
    const node = { item, depth, children: [] };
    for (const child of nested) if (!visited.has(child)) node.children.push(build(child, depth + 1));
    return node;
  };
  const forest = [];
  for (const root of roots.sort(compareMenuItems)) if (!visited.has(root)) forest.push(build(root, 1));
  let pending = candidates.filter((item) => !visited.has(item));
  while (pending.length) {
    forest.push(build([...pending].sort(compareMenuItems)[0], 1));
    pending = pending.filter((item) => !visited.has(item));
  }
  return forest.sort((left, right) => compareMenuItems(left.item, right.item));
}

function classToken(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}

function markActive(node, activePath) {
  node.current = menuPathKey(node.item.path) === menuPathKey(activePath);
  node.activeTrail = node.children.map((child) => markActive(child, activePath)).some(Boolean);
  return node.current || node.activeTrail;
}

/**
 * Renders the main menu. Without nested items the historical flat markup is returned unchanged;
 * with nested items a Cassiopeia/metismenu-like tree is rendered. Submenus stay visible until
 * `bindMenuTree()` runs, so links are never hidden without JavaScript.
 */
export function renderMenuTree({ menus = [], link = (path) => `#${path}`, activePath = '', label = 'Menu principal', idPrefix = 'mj-menu', startLevel = 1, endLevel = 0, showAllChildren = true } = {}) {
  let forest = buildMenuTree(menus);
  /* mod_menu: startLevel/endLevel/showAllChildren. startLevel>1 mostra os filhos do item ativo no nível anterior. */
  const start = Math.max(1, Math.trunc(Number(startLevel)) || 1);
  const end = Math.max(0, Math.trunc(Number(endLevel)) || 0);
  if (start > 1 || end || showAllChildren === false) {
    forest.forEach((node) => markActive(node, activePath));
    let level = 1;
    while (level < start) { forest = forest.find((node) => node.activeTrail || node.current)?.children ?? []; level += 1; }
    const prune = (node, depth) => ({ ...node, children: (end && depth >= end) || (showAllChildren === false && !node.activeTrail && !node.current) ? [] : node.children.map((child) => prune(child, depth + 1)) });
    forest = forest.map((node) => prune(node, start));
  }
  const itemLink = (item, current) => `<a href="${safeUrl(/^https?:\/\//i.test(item.path) ? item.path : link(item.path))}"${current ? ' aria-current="page"' : ''}>${escapeHtml(item.title)}</a>`;
  if (forest.every((node) => !node.children.length)) {
    return `<nav aria-label="${escapeHtml(label)}"><ul>${forest.map((node) => `<li>${itemLink(node.item, menuPathKey(node.item.path) === menuPathKey(activePath))}</li>`).join('')}</ul></nav>`;
  }
  forest.forEach((node) => markActive(node, activePath));
  const instance = `${classToken(idPrefix) || 'mj-menu'}-${++sequence}`;
  let submenus = 0;
  const renderNodes = (nodes, depth) => nodes.map((node) => {
    const id = classToken(node.item.id);
    const classes = ['metismenu-item', id ? `item-${id}` : '', `level-${depth}`, node.children.length ? 'deeper parent' : '', node.activeTrail || node.current ? 'active' : '', node.current ? 'current' : ''].filter(Boolean).join(' ');
    let nested = '';
    if (node.children.length) {
      const submenuId = `${instance}-sub-${++submenus}`;
      nested = `<button type="button" class="mm-toggler mm-toggler-link" aria-expanded="false" aria-controls="${submenuId}" aria-label="Submenu de ${escapeHtml(node.item.title)}" data-menu-tree-toggle hidden><span class="mm-toggler-icon" aria-hidden="true"></span></button>`
        + `<ul class="mm-collapse level-${depth + 1}" id="${submenuId}" data-menu-tree-submenu>${renderNodes(node.children, depth + 1)}</ul>`;
    }
    return `<li class="${classes}">${itemLink(node.item, node.current)}${nested}</li>`;
  }).join('');
  return `<nav aria-label="${escapeHtml(label)}" class="mod-menu-tree" data-menu-tree><ul class="mod-menu mod-menu_dropdown-metismenu metismenu level-1">${renderNodes(forest, 1)}</ul></nav>`;
}

function findTrees(root) {
  if (!root) return [];
  const trees = [];
  if (typeof root.matches === 'function' && root.matches(TREE_SELECTOR)) trees.push(root);
  if (typeof root.querySelectorAll === 'function') for (const tree of root.querySelectorAll(TREE_SELECTOR)) if (!trees.includes(tree)) trees.push(tree);
  return trees;
}

function submenuFor(tree, toggle) {
  const id = toggle?.getAttribute?.('aria-controls');
  return id ? tree.querySelector(`[id="${id}"]`) : null;
}

function setOpen(tree, toggle, open) {
  const submenu = submenuFor(tree, toggle);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  submenu?.classList?.toggle('mm-show', open);
  if (!open) for (const nested of submenu?.querySelectorAll?.(`${TOGGLE_SELECTOR}[aria-expanded="true"]`) ?? []) setOpen(tree, nested, false);
}

function bindTree(tree) {
  const toggles = [...(tree.querySelectorAll(TOGGLE_SELECTOR) ?? [])];
  const wasHidden = toggles.map((toggle) => toggle.hasAttribute?.('hidden') ?? true);
  tree.setAttribute('data-menu-tree-js', '');
  toggles.forEach((toggle) => toggle.removeAttribute('hidden'));
  const openToggles = () => toggles.filter((toggle) => toggle.getAttribute('aria-expanded') === 'true');

  const onClick = (event) => {
    const toggle = event?.target?.closest?.(TOGGLE_SELECTOR);
    if (!toggle || !toggles.includes(toggle)) return;
    event.preventDefault?.();
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    if (open) {
      const level = toggle.closest?.('ul');
      for (const sibling of openToggles()) if (sibling !== toggle && sibling.closest?.('ul') === level) setOpen(tree, sibling, false);
    }
    setOpen(tree, toggle, open);
  };
  const onKeydown = (event) => {
    if (event?.key !== 'Escape') return;
    const target = event.target;
    let toggle = toggles.includes(target) && target.getAttribute('aria-expanded') === 'true' ? target : null;
    if (!toggle) {
      const submenu = target?.closest?.(SUBMENU_SELECTOR);
      toggle = submenu ? toggles.find((item) => item.getAttribute('aria-controls') === submenu.getAttribute('id')) : null;
      if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle = null;
    }
    if (!toggle) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    setOpen(tree, toggle, false);
    toggle.focus?.();
  };
  const doc = tree.ownerDocument;
  const onOutside = (event) => {
    if (tree.contains?.(event?.target)) return;
    for (const toggle of openToggles()) setOpen(tree, toggle, false);
  };
  tree.addEventListener('click', onClick);
  tree.addEventListener('keydown', onKeydown);
  doc?.addEventListener?.('click', onOutside);
  return () => {
    tree.removeEventListener('click', onClick);
    tree.removeEventListener('keydown', onKeydown);
    doc?.removeEventListener?.('click', onOutside);
    toggles.forEach((toggle, index) => {
      setOpen(tree, toggle, false);
      if (wasHidden[index]) toggle.setAttribute('hidden', '');
    });
    tree.removeAttribute('data-menu-tree-js');
  };
}

/**
 * Enables submenu toggles inside `root` (document, container or the menu `nav` itself).
 * Returns an idempotent cleanup; call it before replacing the HTML.
 */
export function bindMenuTree(root = globalThis.document) {
  const cleanups = findTrees(root).filter((tree) => !tree.hasAttribute?.('data-menu-tree-js')).map(bindTree);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    cleanups.reverse().forEach((cleanup) => cleanup());
  };
}
