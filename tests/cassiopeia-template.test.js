import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderShell, bindShell, resolveTemplateParams, TEMPLATE_POSITIONS, TEMPLATE_METADATA, TEMPLATE_PARAM_DEFINITIONS, COMPONENT_POSITION } from '../src/templates/cassiopeia/index.js';
import { menuModule } from '../src/libraries/minijoomla/modules/registry.js';
import { breadcrumbsModule } from '../src/modules/mod_breadcrumbs/mod_breadcrumbs.js';
import { searchModule } from '../src/modules/mod_search/mod_search.js';

const templateManifest = await readFile(new URL('../src/templates/cassiopeia/templateDetails.xml', import.meta.url), 'utf8');
assert.match(templateManifest, /<extension type="template" client="site"/);
assert.match(templateManifest, /<filename>index\.js<\/filename>/);

function fakeElement(attributes = {}) {
  const classes = new Set();
  return {
    attributes: { ...attributes },
    focused: 0,
    classList: { toggle: (name, force) => { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); }, contains: (name) => classes.has(name) },
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() { this.focused += 1; },
    contains(node) { return node === this || node?.parent === this; }
  };
}

function bindingFixture({ scrollY = 0, mobile = true } = {}) {
  const listeners = new Map();
  const windowListeners = new Map();
  const mediaListeners = new Map();
  const viewport = {
    matches: mobile,
    addEventListener: (type, listener) => mediaListeners.set(type, listener),
    removeEventListener: (type, listener) => { if (mediaListeners.get(type) === listener) mediaListeners.delete(type); }
  };
  const toggler = fakeElement({ 'aria-expanded': 'false' });
  const collapse = fakeElement();
  const backTop = fakeElement();
  const firstLink = fakeElement();
  collapse.querySelector = () => firstLink;
  const view = {
    scrollY,
    matchMedia: (query) => { assert.equal(query, '(max-width: 767.98px)'); return viewport; },
    addEventListener: (type, listener) => windowListeners.set(type, listener),
    removeEventListener: (type, listener) => { if (windowListeners.get(type) === listener) windowListeners.delete(type); }
  };
  const shell = fakeElement();
  Object.assign(shell, {
    ownerDocument: { defaultView: view },
    matches: (selector) => selector === '[data-template="cassiopeia"]',
    contains: () => true,
    querySelector: (selector) => ({ '[data-cassiopeia-toggler]': toggler, '#cassiopeia-navbar-collapse': collapse, '#back-top': backTop })[selector],
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); }
  });
  return { shell, toggler, collapse, backTop, firstLink, view, viewport, listeners, windowListeners, mediaListeners };
}


function occurrences(html, value) {
  return html.split(value).length - 1;
}

export async function runCassiopeiaTemplateTests() {
  const expected = ['topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer'];
  assert.deepEqual(TEMPLATE_POSITIONS, expected);
  assert.equal(COMPONENT_POSITION, 'component');
  assert.equal(TEMPLATE_METADATA.key, 'cassiopeia');
  assert.equal(TEMPLATE_METADATA.positions, TEMPLATE_POSITIONS);
  assert.deepEqual(TEMPLATE_METADATA.aliases, { content: 'main-top', sidebar: 'sidebar-right' });
  assert.ok(Object.isFrozen(TEMPLATE_POSITIONS));
  assert.ok(Object.isFrozen(TEMPLATE_METADATA));
  assert.doesNotMatch(JSON.stringify(TEMPLATE_PARAM_DEFINITIONS), /Petrobras/i, 'rótulos padrão descrevem o template neutro, não marca corporativa');
  assert.deepEqual(TEMPLATE_PARAM_DEFINITIONS.find(p => p.name === 'colorName').options.map(o => o.value), ['standard', 'alternative']);
  assert.deepEqual(TEMPLATE_PARAM_DEFINITIONS.find(p => p.name === 'useFontScheme').options.map(o => o.value), ['system', 'roboto']);

  const menus = menuModule.render({ menus: [{ title: 'Início', path: '/' }], activePath: '/' });
  const breadcrumbs = breadcrumbsModule.render({ items: ['Início', 'Artigo'] });
  const modules = Object.fromEntries(expected.map((position) => [position, `<p>slot:${position}</p>`]));
  const html = renderShell({
    config: { siteName: '<Portal & equipe>', siteDescription: '<Descrição>' },
    menus, breadcrumbs, content: '<article><h1>Artigo</h1></article>', modules, busy: true
  });
  assert.match(html, /class="cassiopeia-template site wrapper-static has-sidebar-left has-sidebar-right colors-standard"/);
  assert.match(html, /data-template="cassiopeia"/);
  for (const position of expected) {
    assert.equal(occurrences(html, `data-template-region="${position}"`), 1, position);
    assert.equal(occurrences(html, `data-mj-position="${position}"`), 1, position);
    assert.equal(occurrences(html, `slot:${position}</p>`), 1, position);
  }
  assert.match(html, /&lt;Portal &amp; equipe&gt;/);
  assert.match(html, /&lt;Descrição&gt;/);
  assert.doesNotMatch(html, /<Portal|<Descrição/);
  assert.equal(occurrences(html, '<main '), 1);
  assert.match(html, /<main[^>]*data-template-region="component"[^>]*id="main-content"[^>]*tabindex="-1"[^>]*aria-busy="true"/);
  assert.match(html, /<nav aria-label="Menu principal">/);
  assert.match(html, /aria-current="page"/);
  assert.equal(occurrences(html, '<nav '), 2, 'renderer must not nest the navigation components in extra nav landmarks');
  assert.ok(html.indexOf('data-template-region="breadcrumbs"') < html.indexOf('<main '));
  assert.ok(html.indexOf('data-template-region="main-top"') < html.indexOf('<main '));
  assert.ok(html.indexOf('</main>') < html.indexOf('data-template-region="main-bottom"'));
  assert.ok(html.indexOf('data-template-region="bottom-b"') < html.indexOf('<footer '));

  const empty = renderShell();
  assert.doesNotMatch(empty, /has-sidebar|<aside|aria-busy|container-nav|site-description/);
  assert.doesNotMatch(empty, /data-template-region="(?:topbar|below-top|banner|top-a|top-b|breadcrumbs|main-top|main-bottom|bottom-a|bottom-b)"/);
  assert.match(empty, /MINIJOOMLA/);
  assert.match(empty, /data-shell-anchor="main-content"/);
  assert.match(empty, /data-shell-anchor="site-top"/);
  assert.match(empty, /id="site-top" tabindex="-1"/);
  assert.doesNotMatch(empty, /<button|onclick=|<script|https?:\/\//);
  assert.doesNotThrow(() => renderShell({ modules: null }));
  assert.doesNotThrow(() => renderShell({ modules: '' }));

  const legacy = renderShell({ content: '<p>component</p>', modules: { content: '<p>legacy-main</p>', sidebar: '<p>legacy-sidebar</p>' } });
  assert.match(legacy, /has-sidebar-right/);
  assert.doesNotMatch(legacy, /has-sidebar-left/);
  assert.match(legacy, /data-template-region="main-top"[^>]*><p>legacy-main/);
  assert.match(legacy, /data-template-region="sidebar-right"[^>]*><p>legacy-sidebar/);
  const combined = renderShell({ modules: {
    'main-top': '<p>canonical-main</p>', content: '<p>legacy-main</p>',
    'sidebar-right': '<p>canonical-sidebar</p>', sidebar: '<p>legacy-sidebar</p>'
  } });
  assert.match(combined, /<p>canonical-main<\/p><p>legacy-main<\/p>/);
  assert.match(combined, /<p>canonical-sidebar<\/p><p>legacy-sidebar<\/p>/);
  for (const marker of ['canonical-main', 'legacy-main', 'canonical-sidebar', 'legacy-sidebar']) {
    assert.equal(occurrences(combined, `<p>${marker}</p>`), 1);
  }
  const legacyWithEmptyCanonical = renderShell({ modules: {
    'main-top': '', content: '<p>legacy-main</p>', 'sidebar-right': '', sidebar: '<p>legacy-sidebar</p>'
  } });
  assert.match(legacyWithEmptyCanonical, /legacy-main/);
  assert.match(legacyWithEmptyCanonical, /legacy-sidebar/);
  assert.match(legacyWithEmptyCanonical, /has-sidebar-right/);
  const canonicalOnly = renderShell({ modules: {
    'main-top': '<p>canonical-main</p>', 'sidebar-right': '<p>canonical-sidebar</p>'
  } });
  assert.equal(occurrences(canonicalOnly, '<p>canonical-main</p>'), 1);
  assert.equal(occurrences(canonicalOnly, '<p>canonical-sidebar</p>'), 1);
  const leftOnly = renderShell({ modules: { 'sidebar-left': '<p>left</p>' } });
  assert.match(leftOnly, /has-sidebar-left/);
  assert.doesNotMatch(leftOnly, /has-sidebar-right/);
  assert.doesNotMatch(renderShell({ modules: { footer: '' } }), /site-credit/);

  let handler;
  const removed = [];
  const calls = [];
  const targets = {
    'main-content': { focus: (options) => calls.push(['main-focus', options]), scrollIntoView: (options) => calls.push(['main-scroll', options]) },
    'site-top': { focus: (options) => calls.push(['top-focus', options]), scrollIntoView: (options) => calls.push(['top-scroll', options]) }
  };
  const shell = {
    matches: (selector) => selector === '[data-template="cassiopeia"]',
    contains: (link) => link.inside !== false,
    querySelector: (selector) => targets[selector.slice(1)],
    addEventListener: (type, listener) => { assert.equal(type, 'click'); handler = listener; },
    removeEventListener: (...args) => removed.push(args)
  };
  const cleanup = bindShell(shell);
  const click = (id, overrides = {}) => {
    let prevented = false;
    const link = { getAttribute: () => id };
    handler({ target: { closest: () => link }, button: 0, preventDefault: () => { prevented = true; }, ...overrides });
    return prevented;
  };
  assert.equal(click('main-content'), true);
  assert.equal(click('site-top'), true);
  assert.deepEqual(calls.map(([name]) => name), ['main-focus', 'main-scroll', 'top-focus', 'top-scroll']);
  assert.deepEqual(calls[0][1], { preventScroll: true });
  assert.deepEqual(calls[1][1], { block: 'start', behavior: 'auto' });
  for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
    assert.equal(click('site-top', overrides), false);
  }
  assert.equal(click('unknown'), false);
  assert.equal(click('main-content', { target: { closest: () => ({ inside: false }) } }), false);
  assert.equal(click('main-content', { target: null }), false);
  assert.equal(calls.length, 4);
  cleanup();
  assert.deepEqual(removed, [['click', handler]]);
  assert.equal(typeof bindShell({}), 'function');
  assert.equal(typeof bindShell(null), 'function');
  assert.equal(typeof bindShell({ querySelector: () => shell }), 'function');

  // Joomla-like DOM structure and classes.
  const structured = renderShell({
    config: { siteName: 'Portal', siteDescription: 'Descrição' },
    menus, breadcrumbs, content: '<p>c</p>',
    modules: { ...modules, search: searchModule.render({}) }
  });
  assert.match(structured, /<header id="site-top" tabindex="-1" class="header container-header full-width">/);
  assert.match(structured, /<div class="container-topbar" data-template-region="topbar"/);
  assert.match(structured, /<div class="grid-child container-below-top" data-template-region="below-top"/);
  assert.match(structured, /<div class="grid-child container-brand"><div class="navbar-brand"><a class="brand-logo" href="#\/"><span class="site-title">Portal<\/span><\/a><div class="site-description">Descrição<\/div><\/div><\/div>/);
  assert.match(structured, /<div class="grid-child container-nav"><div class="navbar navbar-expand-md"><button class="navbar-toggler navbar-toggler-right" type="button" aria-controls="cassiopeia-navbar-collapse" aria-expanded="false" aria-label="[^"]+" data-cassiopeia-toggler>/);
  assert.match(structured, /<div class="collapse navbar-collapse" id="cassiopeia-navbar-collapse"><div class="container-menu" data-template-region="menu"/);
  assert.match(structured, /<\/div><\/div><div class="container-search" data-template-region="search"[^>]*><section class="module module-search">/);
  assert.match(structured, /<div class="site-grid">/);
  assert.match(structured, /<div class="container-banner full-width" data-template-region="banner"/);
  for (const name of ['top-a', 'top-b', 'bottom-a', 'bottom-b']) assert.match(structured, new RegExp(`<div class="grid-child container-${name}" data-template-region="${name}"`));
  assert.match(structured, /<aside class="grid-child container-sidebar-left" data-template-region="sidebar-left"[^>]*aria-label=/);
  assert.match(structured, /<aside class="grid-child container-sidebar-right" data-template-region="sidebar-right"[^>]*aria-label=/);
  assert.match(structured, /<div class="grid-child container-component" data-template-main-column>\s*<div class="container-breadcrumbs" data-template-region="breadcrumbs"[^>]*>[\s\S]*<div class="container-main-top"[\s\S]*<main class="site-main"[\s\S]*<\/main>\s*<div class="container-main-bottom"/);
  assert.match(structured, /<footer class="container-footer footer full-width" data-template-region="footer" data-mj-position="footer"><div class="grid-child">/);
  assert.match(structured, /<a href="#site-top" id="back-top" class="back-to-top-link" aria-label="Voltar ao topo" data-shell-anchor="site-top"><svg class="icon-arrow-up icon-fw"[^>]*aria-hidden="true"/);
  const order = ['container-header', 'container-banner', 'container-top-a', 'container-top-b', 'container-sidebar-left', 'container-component', 'container-sidebar-right', 'container-bottom-a', 'container-bottom-b', 'container-footer', 'back-to-top-link'];
  order.reduce((previous, name) => { const index = structured.indexOf(name); assert.ok(index > previous, `${name} out of order`); return index; }, -1);
  assert.ok(structured.indexOf('</header>') < structured.indexOf('<div class="site-grid">'));
  assert.ok(structured.indexOf('</main>') < structured.indexOf('container-sidebar-right'));
  assert.equal(occurrences(structured, 'class="grid-child container-component"'), 1);
  const searchOnly = renderShell({ modules: { search: '<p>s</p>' } });
  assert.match(searchOnly, /<div class="grid-child container-nav"><div class="container-search"/);
  assert.doesNotMatch(searchOnly, /navbar-toggler/);

  // Template style parameters (tolerant reading, defaults preserved).
  assert.deepEqual(TEMPLATE_PARAM_DEFINITIONS.map((definition) => definition.name),
    ['brand', 'logoFile', 'siteTitle', 'siteDescription', 'colorName', 'useFontScheme', 'fluidContainer', 'stickyHeader', 'backTop']);
  assert.ok(TEMPLATE_PARAM_DEFINITIONS.some((def) => def.name === 'logoFile' && def.type === 'url'), 'logoFile field exists and is type url');
  assert.ok(TEMPLATE_PARAM_DEFINITIONS.some((def) => def.name === 'brand' && def.type === 'select'), 'brand field is type select');
  assert.equal(TEMPLATE_METADATA.params, TEMPLATE_PARAM_DEFINITIONS);
  assert.ok(TEMPLATE_PARAM_DEFINITIONS.every((definition) => Object.isFrozen(definition) && 'default' in definition));
  assert.deepEqual({ ...resolveTemplateParams() }, { brand: 'title', logoFile: '', siteTitle: '', siteDescription: '', colorName: 'standard', useFontScheme: 'system', fluidContainer: false, stickyHeader: false, backTop: true });
  const warnings = [];
  const collectWarn = (...args) => warnings.push(args);
  const originalWarn = console.warn;
  console.warn = collectWarn;
  try {
    for (const config of [{ templateParams: null }, { templateParams: '{invalid' }, { templateParams: [] }, { styleParams: 42 }, null]) {
      assert.equal(resolveTemplateParams(config).colorName, 'standard');
      assert.doesNotThrow(() => renderShell({ config }));
    }
  } finally { console.warn = originalWarn; }
  // Absent params are silent; malformed/invalid ones warn once per resolution with sanitized details only.
  assert.equal(warnings.length, 6);
  assert.ok(warnings.every(([message]) => message === 'MINIJOOMLA: parâmetros de estilo do template Cassiopeia inválidos; padrões aplicados.'));
  assert.deepEqual(warnings[0][1], [{ field: 'templateParams', reason: 'malformed-json' }]);
  assert.deepEqual(warnings[2][1], [{ field: 'templateParams', reason: 'invalid-format' }]);
  assert.deepEqual(warnings[4][1], [{ field: 'styleParams', reason: 'invalid-format' }]);
  const logged = [];
  const capture = { warn: (...args) => logged.push(args) };
  resolveTemplateParams({ siteName: 'x' }, capture);
  resolveTemplateParams({ templateParams: { brand: '', backTop: null, colorName: '  ' } }, capture);
  assert.equal(logged.length, 0, 'absent values use defaults silently');
  const secret = 'segredo-123<script>';
  const invalid = resolveTemplateParams({ templateParams: `{"colorName":"${secret}","backTop":"${secret}","logoFile":"javascript:${secret}","siteTitle":{"x":1},"useFontScheme":"${secret}","brand":"${secret}"}`, styleParams: { colorName: 'alternative' } }, capture);
  assert.equal(invalid.colorName, 'standard', 'a valid object in the first source is used, invalid values fall back');
  assert.equal(invalid.backTop, true);
  assert.equal(invalid.brand, 'title');
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0][1].map(({ field }) => field).sort(), ['backTop', 'brand', 'colorName', 'logoFile', 'siteTitle', 'useFontScheme']);
  assert.doesNotMatch(JSON.stringify(logged), /segredo|script|javascript/);
  assert.equal(resolveTemplateParams({ templateParams: '{bad', styleParams: '{"colorName":"alternative"}' }, capture).colorName, 'alternative', 'later sources still apply');
  assert.deepEqual(logged[1][1], [{ field: 'templateParams', reason: 'malformed-json' }]);
  assert.doesNotThrow(() => resolveTemplateParams({ templateParams: '{bad' }, { warn: () => { throw new Error('logger down'); } }));
  assert.equal(resolveTemplateParams({ templateParams: { brand: 1, logoFile: '/l.png' } }, capture).brand, 'logo');
  assert.equal(resolveTemplateParams({ styleParams: '{"colorName":"colors_alternative","stickyHeader":"1"}' }).colorName, 'alternative');
  assert.equal(resolveTemplateParams({ templateParams: { colorName: 'default' } }).colorName, 'standard', 'Legacy default alias selects the standard Cassiopeia-inspired scheme');
  assert.equal(resolveTemplateParams({ templateParams: { colorName: 'colors_default' } }).colorName, 'standard');
  assert.equal(resolveTemplateParams({ template: { params: { fluidContainer: 1 } } }).fluidContainer, true);
  assert.equal(resolveTemplateParams({ templateParams: { backTop: '' } }).backTop, true);
  assert.equal(resolveTemplateParams({ templateParams: { brand: '' } }).brand, 'title');
  assert.equal(resolveTemplateParams({ templateParams: { brand: 0 } }).brand, 'none');
  assert.equal(resolveTemplateParams({ templateParams: { logoFile: 'javascript:alert(1)', brand: 'logo' } }, { warn: () => {} }).logoFile, '');
  assert.equal(resolveTemplateParams({ templateParams: { useFontScheme: 'media/templates/site/cassiopeia/css/global/fonts-local_roboto.css' } }).useFontScheme, 'roboto');
  const styled = renderShell({
    config: { siteName: 'Portal & Cia', siteDescription: 'config', templateParams: {
      brand: 'title', siteTitle: '<Meu título>', siteDescription: 'Do estilo', colorName: 'alternative',
      fluidContainer: true, stickyHeader: 'true', backTop: false, useFontScheme: 'roboto'
    } },
    menus
  });
  assert.match(styled, /class="cassiopeia-template site wrapper-fluid colors-alternative font-roboto" data-template="cassiopeia" data-color-name="alternative"/);
  assert.match(styled, /class="header container-header full-width position-sticky sticky-top"/);
  assert.match(styled, /<span class="site-title" title="Portal &amp; Cia">&lt;Meu título&gt;<\/span>/);
  assert.match(styled, /<div class="site-description">Do estilo<\/div>/);
  assert.doesNotMatch(styled, /back-to-top-link|id="back-top"/);
  const logo = renderShell({ config: { siteName: 'Portal', templateParams: { logoFile: '/images/logo.png' } } });
  assert.match(logo, /<a class="brand-logo" href="#\/"><img class="logo d-inline-block" src="\/images\/logo.png" alt="Portal" loading="eager" decoding="async"><\/a>/);
  assert.match(renderShell({ config: { templateParams: { brand: 'title', logoFile: '/images/logo.png' } } }), /<span class="site-title">MINIJOOMLA<\/span>/);
  assert.match(renderShell({ config: { templateParams: { brand: 'logo' } } }), /<span class="site-title">MINIJOOMLA<\/span>/);
  assert.doesNotMatch(renderShell({ config: { siteDescription: 'x', templateParams: { brand: 'none' } } }), /navbar-brand|site-description/);

  // Mobile menu toggler, Escape and back-to-top visibility.
  const fixture = bindingFixture({ scrollY: 0 });
  const release = bindShell(fixture.shell);
  assert.equal(fixture.shell.getAttribute('data-cassiopeia-js'), '');
  assert.equal(fixture.toggler.getAttribute('aria-expanded'), 'false');
  assert.equal(fixture.backTop.classList.contains('visible'), false);
  const clickToggler = () => fixture.listeners.get('click')({ target: { closest: (selector) => selector === '[data-cassiopeia-toggler]' ? fixture.toggler : null }, button: 0, preventDefault() {} });
  clickToggler();
  assert.equal(fixture.toggler.getAttribute('aria-expanded'), 'true');
  assert.equal(fixture.collapse.classList.contains('show'), true);
  clickToggler();
  assert.equal(fixture.toggler.getAttribute('aria-expanded'), 'false');
  assert.equal(fixture.collapse.classList.contains('show'), false);
  clickToggler();
  let escapePrevented = false;
  fixture.listeners.get('keydown')({ key: 'Escape', target: { parent: fixture.collapse }, preventDefault: () => { escapePrevented = true; } });
  assert.equal(fixture.toggler.getAttribute('aria-expanded'), 'false');
  assert.equal(fixture.collapse.classList.contains('show'), false);
  assert.equal(fixture.toggler.focused, 1);
  assert.equal(escapePrevented, true);
  clickToggler();
  fixture.listeners.get('keydown')({ key: 'Escape', target: fixture.toggler, defaultPrevented: true, preventDefault: () => assert.fail('submenu Escape must not close the shell') });
  assert.equal(fixture.toggler.getAttribute('aria-expanded'), 'true');
  fixture.listeners.get('keydown')({ key: 'Escape', target: {}, preventDefault: () => assert.fail('focus outside the menu must not be captured') });
  assert.equal(fixture.toggler.getAttribute('aria-expanded'), 'true');
  assert.equal(fixture.toggler.focused, 1);
  fixture.listeners.get('keydown')({ key: 'Enter', target: fixture.toggler, preventDefault: () => assert.fail('only Escape is handled') });
  fixture.shell.ownerDocument.activeElement = fixture.toggler;
  fixture.viewport.matches = false;
  fixture.mediaListeners.get('change')();
  assert.equal(fixture.toggler.getAttribute('aria-expanded'), 'true');
  assert.equal(fixture.firstLink.focused, 1, 'Resize to desktop moves focus off the now-hidden toggle');
  fixture.listeners.get('keydown')({ key: 'Escape', target: fixture.firstLink, preventDefault: () => assert.fail('desktop has no collapsible shell navigation') });
  fixture.shell.ownerDocument.activeElement = { parent: fixture.collapse };
  fixture.viewport.matches = true;
  fixture.mediaListeners.get('change')();
  assert.equal(fixture.toggler.getAttribute('aria-expanded'), 'false');
  assert.equal(fixture.toggler.focused, 2, 'Resize to mobile moves focus out of the closing menu');
  fixture.view.scrollY = 300;
  fixture.windowListeners.get('scroll')();
  assert.equal(fixture.backTop.classList.contains('visible'), true);
  fixture.view.scrollY = 0;
  fixture.windowListeners.get('scroll')();
  assert.equal(fixture.backTop.classList.contains('visible'), false);
  release();
  assert.equal(fixture.listeners.size, 0);
  assert.equal(fixture.windowListeners.size, 0);
  assert.equal(fixture.mediaListeners.size, 0);
  assert.equal(fixture.shell.getAttribute('data-cassiopeia-js'), null);
  const desktopFixture = bindingFixture({ mobile: false });
  bindShell(desktopFixture.shell)();
  assert.equal(desktopFixture.toggler.getAttribute('aria-expanded'), 'true', 'Desktop aria state agrees with visible menu');

  const skipFixture = bindingFixture();
  const main = fakeElement();
  const blurListeners = new Map();
  main.addEventListener = (type, listener) => blurListeners.set(type, listener);
  main.removeEventListener = (type, listener) => { if (blurListeners.get(type) === listener) blurListeners.delete(type); };
  const originalQuery = skipFixture.shell.querySelector;
  skipFixture.shell.querySelector = (selector) => selector === '#main-content' ? main : originalQuery(selector);
  const releaseSkip = bindShell(skipFixture.shell);
  const skipClick = () => skipFixture.listeners.get('click')({ target: { closest: () => ({ getAttribute: () => 'main-content' }) }, button: 0, preventDefault() {} });
  skipClick();
  assert.equal(main.getAttribute('data-focus-origin'), 'skip');
  blurListeners.get('blur')();
  assert.equal(main.getAttribute('data-focus-origin'), null);
  skipClick();
  releaseSkip();
  assert.equal(main.getAttribute('data-focus-origin'), null, 'Cleanup clears skip marker even before blur');
  assert.equal(blurListeners.size, 0);

  const css = await readFile(new URL('../src/media/templates/site/cassiopeia/css/template.css', import.meta.url), 'utf8');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of rules.split('}')) {
    const selectors = block.split('{')[0].trim();
    if (!selectors || selectors.startsWith('@') || /^(from|to|\d+%)$/.test(selectors)) continue;
    const last = selectors.split('\n').pop().trim();
    if (last.startsWith('@')) continue;
    for (const selector of selectors.replace(/^@media[^{]*/, '').split(/,(?![^(]*\))/)) {
      if (!selector.trim() || selector.trim().startsWith('@')) continue;
      assert.match(selector.trim(), /^\.cassiopeia-template\b/, `unscoped selector: ${selector.trim()}`);
    }
  }
  // Palette/contrast are checked from the actual tokens in static-ui.test.js.
  // Here keep the shell integration, selector scope and interaction contracts.
  assert.doesNotMatch(rules, /Petrobras|--(?:camap|atum)-|#(?:008542|006298|FDC82F|ED8B00|00B2A9)\b/i);
  for (const selector of ['.container-header', '.container-footer']) {
    const rule = rules.split('}').find((block) => block.split('{')[0].trim() === `.cassiopeia-template ${selector}`) ?? '';
    assert.match(rule, /color: #fff;/, `${selector} uses inverted text`);
    assert.match(rule, /background-color: var\(--cassiopeia-color-primary\)/, `${selector} has an opaque fallback`);
    assert.match(rule, /background-image: linear-gradient\(135deg, var\(--cassiopeia-color-primary\) 0%, var\(--cassiopeia-color-hover\) 100%\)/, `${selector} follows the Cassiopeia gradient direction`);
    assert.doesNotMatch(rule, /border-(?:top|bottom): 4px/, 'No corporate accent bands');
  }
  assert.match(css, /\.icon-menu::before[\s\S]*?\.icon-menu::after \{[^}]*height: 2px;[^}]*content: ""/, 'Hamburger keeps three strokes without shadows');
  assert.match(css, /:is\(button\[type="submit"\], \.btn-primary\):focus-visible \{\s*color: #fff;/, 'Primary anchor buttons do not inherit low-contrast global link hover color');
  assert.match(css, /a:not\(\.btn, \.btn-primary\)/, 'Header/footer ordinary-link colors exclude primary anchor buttons');
  assert.match(css, /\.back-to-top-link:not\(\.visible\):not\(:focus-visible\) \{ clip-path: inset\(50%\); pointer-events: none; \}/, 'Back-to-top stays discoverable by keyboard');
  assert.match(css, /\.pagination > a\[aria-current="page"\]:focus-visible \{ outline-color: #fff; outline-offset: -4px;/, 'Active pagination has contrasting inset focus');
  assert.match(css, /grid-template-columns: \[full-start\] minmax\(0, 1fr\) \[main-start\] repeat\(4, minmax\(0, 19\.875rem\)\) \[main-end\] minmax\(0, 1fr\) \[full-end\]/);
  assert.match(css, /". side-l comp comp side-r ."/);
  assert.match(css, /\.wrapper-fluid \.site-grid/);
  assert.match(css, /\.wrapper-fluid \.site-grid\s*\{\s*grid-template-columns: \[full-start\] 0 \[main-start\] repeat\(4, minmax\(0, 1fr\)\) \[main-end\] 0 \[full-end\]/, 'Fluid tracks share the space left after gutters instead of adding 100% plus gaps');
  assert.doesNotMatch(css, /repeat\(4, minmax\(0, 25%\)\)/);
  assert.match(css, /\.container-menu \[data-menu-tree-js\] li > ul \{[\s\S]*?position: absolute/, 'Dropdown positioning is limited to enhanced menus; no-JS links stay visible');
  assert.match(css, /\.container-menu \[data-menu-tree-js\] li > ul :focus-visible \{ outline-color: var\(--link-color\); outline-offset: -2px;/, 'White enhanced dropdowns must not inherit the white header outline');
  assert.doesNotMatch(css, /\.container-menu li > ul a \{[^}]*color:/, 'No-JS inline submenu links retain white header text');
  assert.doesNotMatch(css, /li\.parent:hover[^{}]*\.mm-collapse/, 'Hover must not reopen a submenu closed by Escape with aria-expanded=false');
  assert.match(css, /\.site-main\[data-focus-origin="skip"\]:focus \{ outline: 2px solid/, 'Skip destination is visibly indicated regardless of focus-visible heuristics');
  assert.doesNotMatch(css, /\.article-card\s*\{[^}]*overflow: hidden|\.content-article[^}]*overflow: hidden/, 'No clipping keyboard focus to hide article overflow');
  assert.match(css, /:is\(\.article-body, \.lead, \.article-card, \.custom-html\) table \{[^}]*overflow-x: auto/, 'Tables scroll locally even when all article HTML is introtext, including listing teasers');
  assert.match(css, /\.skip-link:focus \{[^}]*max-width: calc\(100% - 2rem\)[^}]*white-space: normal/, 'Focused skip text fits 320px and zoom');
  assert.match(css, /\.module-error \{ color: var\(--cassiopeia-error-color\); background-color: var\(--cassiopeia-error-bg\); border-color: var\(--cassiopeia-error-color\); \}/, 'Module errors use dedicated semantic colors, not corporate orange');
  assert.match(css, /> \.module \{[^}]*border-radius: 0;/, 'Structural module roots have straight corners');
  for (const breakpoint of ['576px', '768px', '767.98px', '992px', '991.98px', '1200px']) assert.ok(css.includes(breakpoint), breakpoint);
  assert.match(css, /\[data-cassiopeia-js\] \.navbar-collapse:not\(\.show\) \{ display: none; \}/);
  assert.match(css, /\.sticky-top \{ position: sticky; top: 0;/);
  assert.match(css, /\.back-to-top-link/);
  assert.match(css, /Cassiopeia do Joomla/);

  assert.match(css, /\.cassiopeia-template/);
  assert.match(css, /has-sidebar-left/);
  assert.match(css, /has-sidebar-right/);
  assert.match(css, /minmax\(0,\s*1fr\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:768px\)/);
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:/);
  console.log('ok - cassiopeia positions, aliases, layout, escaping, focus lifecycle and responsive CSS contracts (offline checks)');
}
