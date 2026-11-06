import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  renderCamapShell, bindShell, resolveCamapParams, CAMAP_PARAM_DEFINITIONS,
  TEMPLATE_POSITIONS, COMPONENT_POSITION, BAND_POSITIONS, BAND_TONES
} from '../src/templates/camap/index.js';
import { createApplication } from '../src/index.js';
import { renderMenuTree } from '../src/modules/mod_menu/tmpl/default.js';
import { renderArticle } from '../src/components/com_content/tmpl/article/default.js';

const templateManifest = await readFile(new URL('../src/templates/camap/templateDetails.xml', import.meta.url), 'utf8');
assert.match(templateManifest, /<extension type="template" client="site"/);
assert.match(templateManifest, /<filename>index\.js<\/filename>/);

function element(extra = {}) {
  const attributes = new Map();
  return {
    hidden: false,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    ...extra
  };
}

function testBindings() {
  const listeners = new Map();
  const mediaListeners = new Map();
  let focused = 0;
  let scrolled = 0;
  let toggleFocused = 0;
  let skipFocused = 0;
  let shellScrolled = 0;
  let mainBlur = null;
  let linkFocused = 0;
  const main = element({
    focus() { focused++; assert.equal(this.getAttribute('data-focus-origin'), 'skip', 'Skip target is marked before focus'); },
    scrollIntoView() { scrolled++; },
    removeAttribute(name) { this.setAttribute(name, ''); },
    addEventListener(name, listener, options) { assert.equal(name, 'blur'); assert.equal(options?.once, true); mainBlur = listener; },
    removeEventListener(name, listener) { assert.equal(name, 'blur'); if (mainBlur === listener) mainBlur = null; }
  });
  const skip = { focus() { skipFocused++; } };
  const anchor = element();
  anchor.setAttribute('data-shell-anchor', 'main-content');
  const topAnchor = element();
  topAnchor.setAttribute('data-shell-anchor', 'top');
  const inside = {};
  const navigation = element({ contains: (node) => node === inside, querySelector: () => ({ focus() { linkFocused++; } }) });
  const toggle = element({ focus() { toggleFocused++; } });
  toggle.setAttribute('aria-expanded', 'true');
  toggle.hidden = true;
  const media = {
    matches: true,
    addEventListener(name, listener) { mediaListeners.set(name, listener); },
    removeEventListener(name, listener) { assert.equal(mediaListeners.get(name), listener); mediaListeners.delete(name); }
  };
  const shell = {
    matches: () => true,
    contains: (node) => node === anchor || node === topAnchor,
    scrollIntoView() { shellScrolled++; },
    ownerDocument: { defaultView: { matchMedia: (query) => { assert.equal(query, '(max-width: 767px)'); return media; } } },
    querySelector(selector) {
      return ({
        '.camap-template__navigation': navigation,
        '.camap-template__menu-toggle': toggle,
        '.camap-template__skip-link': skip,
        '[data-mj-component]': main
      })[selector];
    },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { assert.equal(listeners.get(name), listener); listeners.delete(name); }
  };
  const cleanup = bindShell(shell);
  assert.equal(toggle.hidden, false, 'Mobile exposes the menu button');
  assert.equal(navigation.hidden, true, 'Mobile starts collapsed only after binding');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  const toggleClick = { target: { closest: (selector) => (selector === '.camap-template__menu-toggle' ? toggle : null) }, button: 0, preventDefault() {} };
  listeners.get('click')(toggleClick);
  assert.equal(navigation.hidden, false, 'Button opens the menu');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  listeners.get('keydown')({ key: 'Escape', target: {}, preventDefault() {} });
  assert.equal(navigation.hidden, false, 'Escape outside the menu does not close it');
  let prevented = 0;
  listeners.get('keydown')({ key: 'Escape', target: inside, preventDefault() { prevented++; } });
  assert.equal(navigation.hidden, true, 'Escape inside the menu closes it');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggleFocused, 1, 'Escape returns focus to the button');
  listeners.get('click')(toggleClick);
  listeners.get('keydown')({ key: 'Escape', target: inside, defaultPrevented: true, preventDefault() {} });
  assert.equal(navigation.hidden, false, 'Escape already handled by a menu-tree submenu does not also close the mobile panel');
  listeners.get('keydown')({ key: 'Escape', target: toggle, preventDefault() { prevented++; } });
  assert.equal(navigation.hidden, true, 'Escape on the button closes the menu');
  const click = { target: { closest: (selector) => (selector === '[data-shell-anchor]' ? anchor : null) }, button: 0, preventDefault() { prevented++; } };
  const before = prevented;
  listeners.get('click')(click);
  assert.equal(prevented, before + 1, 'Skip link does not change the hash route');
  assert.equal(focused, 1);
  assert.equal(scrolled, 1);
  assert.equal(main.getAttribute('data-focus-origin'), 'skip');
  mainBlur();
  assert.equal(main.getAttribute('data-focus-origin'), '', 'Skip marker is cleared on blur so later programmatic focus stays outline-free');
  listeners.get('click')({ ...click, ctrlKey: true });
  assert.equal(prevented, before + 1, 'Modified navigation retains native semantics');
  listeners.get('click')({ ...click, defaultPrevented: true });
  assert.equal(prevented, before + 1, 'Already handled anchors retain their owner semantics');
  anchor.setAttribute('data-shell-anchor', 'unknown');
  listeners.get('click')(click);
  assert.equal(prevented, before + 1, 'Shell does not capture anchors owned by modules');
  anchor.setAttribute('data-shell-anchor', 'main-content');
  listeners.get('click')({ ...click, target: { closest: (selector) => (selector === '[data-shell-anchor]' ? topAnchor : null) } });
  assert.equal(shellScrolled, 1, 'Back-to-top scrolls the shell');
  assert.equal(skipFocused, 1, 'Back-to-top focuses the first focusable element');
  shell.ownerDocument.activeElement = toggle;
  media.matches = false;
  mediaListeners.get('change')();
  assert.equal(toggle.hidden, true, 'Desktop hides the menu button');
  assert.equal(navigation.hidden, false, 'Desktop keeps navigation visible after resizing');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(linkFocused, 1, 'Resize to desktop moves focus from the hidden toggle to a navigation control');
  listeners.get('keydown')({ key: 'Escape', target: inside, preventDefault() {} });
  assert.equal(navigation.hidden, false, 'Desktop cannot close the hidden disclosure control');
  shell.ownerDocument.activeElement = inside;
  media.matches = true;
  mediaListeners.get('change')();
  assert.equal(navigation.hidden, true);
  assert.equal(toggleFocused, 3, 'Resize to mobile moves focus out before hiding navigation');
  listeners.get('click')(click);
  assert.equal(main.getAttribute('data-focus-origin'), 'skip');
  cleanup();
  assert.equal(listeners.size, 0);
  assert.equal(mediaListeners.size, 0);
  assert.equal(mainBlur, null, 'Cleanup removes the pending blur listener');
  assert.equal(main.getAttribute('data-focus-origin'), '', 'Cleanup clears skip focus marker');
  assert.equal(navigation.hidden, false, 'Cleanup restores a usable no-JS navigation');
  assert.equal(toggle.hidden, true);
  assert.doesNotThrow(() => bindShell(null)());
  assert.doesNotThrow(() => bindShell({ querySelector: () => null })());
  const noMenu = { matches: () => true, querySelector: () => null, addEventListener() {}, removeEventListener() {}, ownerDocument: { defaultView: { matchMedia: () => media } } };
  assert.doesNotThrow(() => bindShell(noMenu)(), 'Shell without menu/search binds safely');
}

function captureWarnings(run) {
  const original = console.warn;
  const messages = [];
  console.warn = (...args) => { messages.push(args.join(' ')); };
  try { run(); } finally { console.warn = original; }
  return messages;
}

function testMenuTree(styles) {
  const tree = renderMenuTree({
    menus: [
      { id: 1, title: 'Início', path: '/' },
      { id: 2, title: 'Serviços', path: '/servicos' },
      { id: 3, title: 'Consultoria', path: '/servicos/consultoria', parentId: 2 },
      { id: 4, title: 'Detalhe', path: '/servicos/consultoria/detalhe', parentId: 3 }
    ],
    activePath: '/servicos/consultoria'
  });
  const html = renderCamapShell({ menus: tree });
  const nav = html.slice(html.indexOf('id="camap-template-navigation"'), html.indexOf('data-template-region="search"'));
  assert.match(nav, /<nav aria-label="Menu principal" class="mod-menu-tree" data-menu-tree>/, 'Menu tree is mounted untouched in the CAMAP menu position');
  assert.match(nav, /class="mm-toggler mm-toggler-link" aria-expanded="false"[^>]*data-menu-tree-toggle hidden>/, 'Without JS, togglers stay hidden');
  assert.match(nav, /<ul class="mm-collapse level-2"[^>]*data-menu-tree-submenu>/);
  assert.doesNotMatch(html, /data-menu-tree-js/, 'The shell never claims the enhanced state');

  const css = styles.join('\n');
  assert.match(styles[0], /\.camap-template \.mod-menu-tree\[data-menu-tree-js\] \.mm-collapse:not\(\.mm-show\)\{display:none\}/, 'Submenus collapse only after the module binder runs');
  assert.doesNotMatch(css, /\.mod-menu-tree:not\(\[data-menu-tree-js\]\)[^{]*\{[^}]*display:none/, 'Links are never hidden without JS');
  assert.match(styles[0], /__position--menu \.mm-toggler\{[^}]*min-width:44px;min-height:44px/, 'Toggler touch target');
  assert.match(styles[0], /__position--menu \.mm-toggler\[hidden\]\{display:none\}/);
  assert.match(styles[0], /\.mm-toggler\[aria-expanded="true"\] \.mm-toggler-icon\{transform/, 'Chevron reflects aria-expanded');
  assert.match(styles[0], /__position--menu \.mm-collapse a\{[^}]*min-height:44px/);
  assert.match(styles[0], /__position--menu \.mm-collapse a:hover,[^{]*\.mm-collapse a:focus-visible\{/, 'Submenu hover/focus state');
  const desktop = styles[1].slice(styles[1].indexOf('@media(min-width:768px)'));
  assert.ok(desktop.length > 0 && desktop.includes('.mm-collapse{position:absolute'), 'Desktop dropdown is absolute only in the enhanced state');
  assert.match(desktop, /\[data-menu-tree-js\] li\.parent>\.mm-collapse\{position:absolute;top:100%;left:0;z-index:20;width:max-content;min-width:12rem;max-width:20rem/, 'Bounded dropdown width');
  assert.match(desktop, /li\.parent:nth-last-child\(-n\+2\)>\.mm-collapse\{left:auto;right:0\}/, 'Rightmost dropdowns open inward to avoid horizontal overflow');
  assert.match(desktop, /\.mm-collapse li\.parent>\.mm-collapse\{position:static/, 'Deeper levels nest inside the dropdown');
  assert.doesNotMatch(desktop, /li\.parent:hover[^{}]*\.mm-collapse/, 'Hover cannot override collapsed aria state or reopen after Escape');
  for (const rule of desktop.match(/[^{}]*\{[^{}]*position:absolute[^{}]*\}/g) ?? []) assert.match(rule, /\[data-menu-tree-js\]/, 'No absolute submenu without JS');
  const mobile = styles[2].slice(styles[2].indexOf('@media(max-width:767px)'), styles[2].indexOf('@media(max-width:560px)'));
  assert.match(mobile, /__position--menu \.mm-collapse\{position:static;width:100%/, 'Mobile submenus are inline accordions (no overflow)');
  assert.match(mobile, /__position--menu li\.parent>a\{flex:1 1 0;width:auto\}/, 'Link and toggler share one row on mobile');
}

function testParamWarnings() {
  const secret = 'SEGREDO-<x>@exemplo';
  const silent = captureWarnings(() => {
    resolveCamapParams();
    resolveCamapParams({});
    resolveCamapParams({ templateParams: null, styleParams: '' });
    resolveCamapParams({ templateParams: { accentColor: 'verde', brand: 'sim', bandTones: { 'top-a': 'green' } } });
    renderCamapShell({ config: { siteName: 'X' } });
  });
  assert.deepEqual(silent, [], 'Absent or valid params use defaults without warnings');
  const cases = [
    [{ templateParams: `{${secret}` }, /templateParams: JSON malformado/],
    [{ styleParams: [secret] }, /styleParams: formato inválido/],
    [{ templateParams: 42 }, /templateParams: formato inválido/],
    [{ templateParams: { accentColor: secret } }, /accentColor: cor fora da paleta/],
    [{ templateParams: { backTop: secret } }, /backTop: valor booleano inválido/],
    [{ templateParams: { bandTones: { [secret]: secret } } }, /bandTones: posição ou tom inválido/],
    [{ templateParams: { bandTones: secret } }, /bandTones: JSON malformado/],
    [{ templateParams: { heroTitle: { value: secret } } }, /heroTitle: formato inválido/]
  ];
  for (const [config, pattern] of cases) {
    let params;
    const messages = captureWarnings(() => { params = resolveCamapParams(config); });
    assert.equal(messages.length, 1, `One warning for ${pattern}`);
    assert.match(messages[0], /^MINIJOOMLA CAMAP: parâmetros de template inválidos; padrões aplicados/);
    assert.match(messages[0], pattern);
    assert.doesNotMatch(messages[0], /SEGREDO|exemplo|<x>/, 'Warnings never echo received values');
    assert.equal(params.accentColor, '#FDC82F');
    assert.equal(params.backTop, false);
  }
  const repeated = { templateParams: '{broken' };
  const once = captureWarnings(() => {
    const first = renderCamapShell({ config: repeated });
    const second = renderCamapShell({ config: repeated });
    assert.equal(first, second);
    assert.match(first, /^<div class="camap-template camap-template--site" data-template="camap">/, 'Safe default shell still renders');
  });
  assert.equal(once.length, 1, 'Warnings are deduplicated per config object across renders');
  const custom = [];
  resolveCamapParams({ templateParams: '[1]' }, { warn: (message) => custom.push(message) });
  assert.equal(custom.length, 1, 'Injected logger receives the warning');
  assert.doesNotThrow(() => resolveCamapParams({ templateParams: '{' }, { warn: () => { throw new Error('logger down'); } }), 'A failing logger never breaks rendering');
}

function testParams() {
  const defaults = resolveCamapParams();
  assert.equal(defaults.brand, true);
  assert.equal(defaults.siteTitle, 'MINIJOOMLA');
  assert.equal(defaults.siteDescription, 'ENGENHARIA, TECNOLOGIA E INOVAÇÃO');
  assert.equal(defaults.accentColor, '#FDC82F');
  assert.equal(defaults.fluidContainer, false);
  assert.equal(defaults.backTop, false);
  assert.equal(defaults.pairSections, false);
  assert.deepEqual({ ...defaults.bandTones }, { 'bottom-a': 'ocean', 'bottom-b': 'teal' });
  assert.ok(Object.isFrozen(defaults));
  for (const siteName of [undefined, null, '', ' \t ']) {
    assert.equal(resolveCamapParams({ siteName }).siteTitle, 'MINIJOOMLA', 'Only an absent site title uses the neutral fallback');
  }
  assert.equal(resolveCamapParams({ siteName: 'Portal' }).siteTitle, 'Portal');
  const saved = { siteName: 'Portal <salvo> & Co', styleParams: '{"siteTitle":"Estilo salvo","future":{"keep":true}}', templateParams: '{"siteTitle":"Título <salvo> & Co"}' };
  const beforeSaved = structuredClone(saved);
  assert.equal(resolveCamapParams(saved).siteTitle, 'Título <salvo> & Co');
  const savedShell = renderCamapShell({ config: saved });
  assert.match(savedShell, /<strong>Título &lt;salvo&gt; &amp; Co<\/strong>/);
  assert.match(savedShell, /__footer-credit">Título &lt;salvo&gt; &amp; Co<\/p>/);
  assert.deepEqual(saved, beforeSaved, 'Resolving and rendering never rewrite saved title/config bytes');
  assert.equal(resolveCamapParams({ ...saved, templateParams: '{"siteTitle":""}' }).siteTitle, saved.siteName, 'An empty overriding title keeps the existing siteName fallback');
  assert.equal(resolveCamapParams({ ...saved, templateParams: null }).siteTitle, 'Estilo salvo', 'Saved style title retains precedence over siteName');
  const merged = resolveCamapParams({
    siteName: 'Portal',
    styleParams: { siteTitle: 'Estilo', accentColor: 'verde', backTop: 'sim' },
    templateParams: '{"siteTitle":"Template","fluidContainer":"1","bandTones":{"top-a":"green","footer":"teal","bottom-b":"rosa"}}'
  });
  assert.equal(merged.siteTitle, 'Template', 'templateParams wins over styleParams');
  assert.equal(merged.accentColor, '#008542');
  assert.equal(merged.backTop, true);
  assert.equal(merged.fluidContainer, true);
  assert.deepEqual({ ...merged.bandTones }, { 'bottom-a': 'ocean', 'bottom-b': 'teal', 'top-a': 'green' }, 'Unknown positions/tones are ignored');
  for (const [value, expected] of [['#00b2a9', '#00B2A9'], ['laranja', '#ED8B00'], ['Ocean', '#006298'], ['#FF0000', '#FDC82F'], ['red;background:url(x)', '#FDC82F'], [42, '#FDC82F']]) {
    assert.equal(resolveCamapParams({ templateParams: { accentColor: value } }).accentColor, expected, `accent ${value}`);
  }
  const tolerant = resolveCamapParams({ templateParams: '{invalid', styleParams: ['x'] });
  assert.equal(tolerant.siteTitle, 'MINIJOOMLA', 'Invalid JSON and arrays fall back to defaults');
  assert.equal(resolveCamapParams({ templateParams: { brand: 'não', backTop: 'talvez' } }).brand, false);
  assert.equal(resolveCamapParams({ templateParams: { backTop: 'talvez' } }).backTop, false);
  assert.equal(resolveCamapParams({ templateParams: { siteDescription: '' } }).siteDescription, '');
  assert.deepEqual([...BAND_TONES], ['white', 'ocean', 'teal', 'green']);
  assert.deepEqual([...BAND_POSITIONS], ['topbar', 'below-top', 'top-a', 'top-b', 'main-bottom', 'bottom-a', 'bottom-b']);

  const rendered = renderCamapShell({
    config: {
      siteName: 'Ignorado',
      templateParams: {
        siteTitle: 'Portal <Teste>', siteDescription: 'Descrição & lema', accentColor: 'teal',
        fluidContainer: true, backTop: true, heroKicker: 'Bem-vindo', heroTitle: 'Título <hero>',
        heroSubtitle: 'Subtítulo "x"', heroActionLabel: 'Começar', heroActionUrl: 'javascript:alert(1)',
        bandTones: { 'top-a': 'ocean', 'bottom-a': 'white' }
      }
    },
    menus: '<nav aria-label="Menu principal"><ul><li><a href="#/">Início</a></li></ul></nav>',
    modules: { 'top-a': '<p>A</p>', 'bottom-a': '<p>C</p>' }
  });
  assert.match(rendered, /^<div class="camap-template camap-template--site camap-template--fluid" data-template="camap" style="--camap-accent:#00B2A9">/);
  assert.match(rendered, /Portal &lt;Teste&gt;/);
  assert.match(rendered, /<small>Descrição &amp; lema<\/small>/);
  assert.match(rendered, /camap-template__position--banner camap-template__position--hero"/);
  assert.match(rendered, /<p class="camap-template__hero-kicker">Bem-vindo<\/p><h2 class="camap-template__hero-title">Título &lt;hero&gt;<\/h2><p class="camap-template__hero-lead">Subtítulo &quot;x&quot;<\/p>/);
  assert.doesNotMatch(rendered, /javascript:/, 'Hero action URL passes through safeUrl');
  assert.doesNotMatch(rendered, /camap-template__hero--split|hero-divider/, 'Hero without banner modules is a single column');
  assert.match(rendered, /<a class="camap-template__back-top" href="#camap-top" data-shell-anchor="top">/);
  assert.match(rendered, /position--top-a camap-template__tone camap-template__tone--ocean"/);
  assert.doesNotMatch(rendered, /position--bottom-a camap-template__tone/, 'white tone removes the default ocean band');
  assert.match(rendered, /position--bottom-b camap-template__tone camap-template__tone--teal"/);

  const split = renderCamapShell({ config: { templateParams: { heroTitle: 'Hero', heroActionLabel: 'Ir', heroActionUrl: '#/artigos' } }, modules: { banner: '<p>Banner module</p>' } });
  assert.match(split, /camap-template__hero camap-template__hero--split/);
  assert.match(split, /<span class="camap-template__hero-divider" aria-hidden="true"><\/span><div class="camap-template__hero-media"><p>Banner module<\/p>/);
  assert.match(split, /<a class="camap-template__button camap-template__button--primary" href="#\/artigos">Ir/);
  const articleWithHero = renderCamapShell({
    config: { templateParams: { heroTitle: 'Hero editorial' } },
    content: renderArticle({ title: 'Artigo individual', introtext: '<p>Introdução</p>' })
  });
  assert.equal((articleWithHero.match(/<h1\b/g) ?? []).length, 1, 'Hero must not duplicate the article page h1');
  assert.match(articleWithHero, /<h2 class="camap-template__hero-title">Hero editorial<\/h2>/);
  assert.match(articleWithHero, /<h1>Artigo individual<\/h1>/, 'The component retains ownership of the page heading');

  const noBrand = renderCamapShell({ config: { templateParams: { brand: false, siteDescription: '' } } });
  assert.doesNotMatch(noBrand, /camap-template__brand"/);
  assert.match(noBrand, /camap-template__header-main camap-template__header-main--no-brand/);
  assert.doesNotMatch(noBrand, /footer-tagline|<small>/, 'Empty description hides the tagline');
  assert.match(noBrand, /__footer-credit">MINIJOOMLA</);

  const paired = renderCamapShell({ config: { styleParams: { pairSections: true } }, modules: { 'top-a': '<p>A</p>', 'top-b': '<p>B</p>', 'bottom-a': '<p>C</p>' } });
  assert.equal((paired.match(/camap-template__section-grid--paired/g) ?? []).length, 1, 'Only fully populated pairs become a 2-column grid');
  assert.match(paired, /section-grid--paired"><div data-template-region="top-a"[^>]*><p>A<\/p><\/div><div data-template-region="top-b"/);
  assert.match(paired, /<div class="camap-template__sections"><div data-template-region="bottom-a"/);
}

export async function runCamapTemplateTests() {
  assert.deepEqual(TEMPLATE_POSITIONS, [
    'topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs',
    'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right',
    'main-bottom', 'bottom-a', 'bottom-b', 'footer'
  ]);
  assert.equal(COMPONENT_POSITION, 'component');
  assert.ok(Object.isFrozen(TEMPLATE_POSITIONS));

  // Verify CAMAP_PARAM_DEFINITIONS correctness
  assert.ok(CAMAP_PARAM_DEFINITIONS.every((def) => Object.isFrozen(def) && 'name' in def && 'type' in def && 'default' in def), 'All CAMAP definitions are frozen and have required fields');
  assert.ok(CAMAP_PARAM_DEFINITIONS.some((def) => def.name === 'accentColor' && def.type === 'select'), 'accentColor is select type');
  const accentColor = CAMAP_PARAM_DEFINITIONS.find((def) => def.name === 'accentColor');
  assert.ok(accentColor.options.every((opt) => opt.value !== 'gray'), 'accentColor never includes gray option');
  assert.ok(accentColor.options.some((opt) => opt.value === 'green'), 'accentColor includes green');
  assert.ok(accentColor.options.some((opt) => opt.value === 'yellow'), 'accentColor includes yellow');
  assert.ok(accentColor.options.some((opt) => opt.value === 'blue'), 'accentColor includes blue');
  assert.ok(accentColor.options.some((opt) => opt.value === 'teal'), 'accentColor includes teal');
  assert.ok(CAMAP_PARAM_DEFINITIONS.some((def) => def.name === 'heroKicker' && def.type === 'text'), 'heroKicker is declared');
  assert.ok(CAMAP_PARAM_DEFINITIONS.some((def) => def.name === 'heroActionLabel' && def.type === 'text'), 'heroActionLabel is declared');
  assert.ok(CAMAP_PARAM_DEFINITIONS.some((def) => def.name === 'heroActionUrl' && def.type === 'url'), 'heroActionUrl is declared as url type');
  assert.ok(CAMAP_PARAM_DEFINITIONS.some((def) => def.name === 'pairSections' && def.type === 'checkbox'), 'pairSections is declared as checkbox');

const modules = Object.fromEntries(TEMPLATE_POSITIONS.map((name) => [name, `<p>${name} fixture</p>`]));
  const html = renderCamapShell({
    config: { siteName: 'Central CAMAP-AGP' },
    menus: '<nav aria-label="Menu principal"><ul><li><a href="#/">Início</a></li></ul></nav>',
    breadcrumbs: '<nav aria-label="Trilha"><ol><li>Início</li></ol></nav>',
    content: '<h1>Conteúdo principal</h1>', modules, busy: true
  });
  assert.match(html, /^<div class="camap-template camap-template--site" data-template="camap">/);
  assert.match(html, /<strong>Central CAMAP-AGP<\/strong>/, 'An explicitly configured legacy title is preserved, not replaced by the new default');
  for (const name of [...TEMPLATE_POSITIONS, COMPONENT_POSITION]) {
    assert.equal(html.split(`data-template-region="${name}"`).length - 1, 1, `Unique ${name} region`);
    assert.equal(html.split(`data-mj-position="${name}"`).length - 1, 1, `Stable ${name} mounting hook`);
  }
  const order = ['topbar', 'menu', 'search', 'below-top', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'sidebar-left', 'main-top', 'component', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer'];
  const indexes = order.map((name) => html.indexOf(`data-template-region="${name}"`));
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b), 'Regions follow the model order (header, hero, sections, content, bands, footer)');
  const headerHtml = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  for (const name of ['topbar', 'menu', 'search', 'below-top']) assert.match(headerHtml, new RegExp(`data-template-region="${name}"`), `${name} lives in the header`);
  const contentGrid = html.slice(html.indexOf('class="camap-template__content '), html.indexOf('data-template-region="main-bottom"'));
  assert.doesNotMatch(contentGrid, /data-template-region="(?:banner|top-a|bottom-a|footer)"/, 'Full-width bands stay outside the sidebar grid');
  assert.match(html, /<\/div><\/div><div data-template-region="main-bottom"[^>]*><div class="camap-template__band-inner"><p>main-bottom fixture/, 'main-bottom is a full-width band after the content grid');
  assert.match(html, /data-template-region="component"[^>]*id="main-content"[^>]*tabindex="-1"[^>]*aria-busy="true"[^>]*data-mj-component/);
  assert.match(html, /<header class="camap-template__header" id="camap-top" data-template-chrome="header">/);
  assert.match(html, /<footer data-template-region="footer"[^>]*camap-template__tone--green"/);
  assert.match(html, /<aside data-template-region="sidebar-left"[^>]*aria-label=/);
  assert.match(html, /<aside data-template-region="sidebar-right"[^>]*aria-label=/);
  assert.match(html, /^<div[^>]*><a class="camap-template__skip-link" href="#main-content" data-shell-anchor="main-content">/);
  assert.match(html, /ENGENHARIA, TECNOLOGIA E INOVAÇÃO/);
  assert.match(html, /position--bottom-a camap-template__tone camap-template__tone--ocean"/);
  assert.match(html, /position--bottom-b camap-template__tone camap-template__tone--teal"/);
  assert.doesNotMatch(html, /position--top-a camap-template__tone/, 'Upper home sections are white like the model');
  assert.doesNotMatch(html, /◆|camada Joomla-like|<script|onclick=|style=/);
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.equal((html.match(/<header\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /section-grid--paired|<details/, 'Sections are full-width bands by default');
  assert.match(html, /__content--has-left camap-template__content--has-right/);
  assert.match(html, /<button type="button" class="camap-template__menu-toggle" aria-expanded="true" aria-controls="camap-template-navigation" hidden>/);
  assert.match(html, /<div class="camap-template__navigation" id="camap-template-navigation"><div data-template-region="menu"/);
  assert.doesNotMatch(html, /data-template-region="(?:hero|home-[a-e]|lateral|rodape|conteudo-principal)"/);

  const empty = renderCamapShell();
  assert.match(empty, /<strong>MINIJOOMLA<\/strong>/, 'Unconfigured brand uses the neutral title');
  assert.match(empty, /__footer-credit">MINIJOOMLA<\/p>/, 'Unconfigured footer uses the same neutral title');
  assert.doesNotMatch(empty, /--has-left|--has-right|menu-toggle|aria-busy|camap-template__hero"|back-top/);
  assert.match(empty, /camap-template__sidebar--left" hidden/);
  assert.match(empty, /camap-template__sidebar--right" hidden/);
  assert.doesNotMatch(empty, /<form|<img|<svg|https?:|site-credit|classificacao/i, 'No invented assets, forms or classifications');
  const nullModules = renderCamapShell({ modules: null });
  assert.equal(nullModules, empty);
  const searchOnly = renderCamapShell({ modules: { search: '<section class="module module-search"></section>' } });
  assert.match(searchOnly, /menu-toggle/, 'Search alone still gets the mobile disclosure');
  const whitespace = renderCamapShell({ modules: { 'sidebar-left': ' \n ', 'sidebar-right': '\t' } });
  assert.doesNotMatch(whitespace, /--has-left|--has-right/);
  const leftOnly = renderCamapShell({ modules: { 'sidebar-left': '<p>Left</p>' } });
  assert.match(leftOnly, /__content--has-left/);
  assert.doesNotMatch(leftOnly, /__content--has-right/);
  const alias = renderCamapShell({ modules: { content: '<p>Legacy main</p>', sidebar: '<p>Legacy side</p>' } });
  assert.match(alias, /__content--has-right/);
  assert.doesNotMatch(alias, /__content--has-left/);
  assert.match(alias, /position--main-top"><p>Legacy main<\/p>/);
  assert.match(alias, /position--sidebar-right"[^>]*><p>Legacy side<\/p>/);
  const combined = renderCamapShell({ modules: { content: '<p>Alias main</p>', sidebar: '<p>Alias side</p>', 'main-top': '<p>Position main</p>', 'sidebar-right': '<p>Position side</p>' } });
  assert.match(combined, /position--main-top"><p>Position main<\/p><p>Alias main<\/p>/);
  assert.match(combined, /position--sidebar-right"[^>]*><p>Position side<\/p><p>Alias side<\/p>/);
  const emptyPosition = renderCamapShell({ modules: { content: '<p>Alias main</p>', sidebar: '<p>Alias side</p>', 'main-top': '', 'sidebar-right': '', footer: '' } });
  assert.match(emptyPosition, /Alias main/);
  assert.match(emptyPosition, /Alias side/);
  assert.match(emptyPosition, /__content--has-right/);
  assert.match(emptyPosition, /__footer-credit/);
  for (const footer of ['', ' \n\t ', null, undefined]) {
    const footerFallback = renderCamapShell({ config: { siteName: 'Central de teste' }, modules: { footer } });
    assert.match(footerFallback, /position--footer camap-template__tone camap-template__tone--green"><div class="camap-template__band-inner"><div class="camap-template__footer-brand"><span class="camap-template__mark" aria-hidden="true"><\/span><div class="camap-template__footer-identity"><p class="camap-template__footer-credit">Central de teste<\/p>/, 'Empty footer positions retain the base institutional footer');
  }
  const customFooter = renderCamapShell({ modules: { footer: '<p>Rodapé configurado</p>' } });
  assert.match(customFooter, /Rodapé configurado/);
  assert.doesNotMatch(customFooter, /__footer-credit/, 'A configured footer replaces the base footer');
  const menuFallback = renderCamapShell({ modules: { menu: '<nav>Menu fallback</nav>', breadcrumbs: '<nav>Trail fallback</nav>' } });
  assert.match(menuFallback, /Menu fallback/);
  assert.match(menuFallback, /Trail fallback/);
  assert.match(html, /menu fixture/, 'Menu modules coexist with the main menu');
  assert.match(html, /breadcrumbs fixture/, 'Breadcrumb modules coexist with the route trail');
  const bannerOnly = renderCamapShell({ modules: { banner: '<p>Só banner</p>' } });
  assert.match(bannerOnly, /position--banner"><div class="camap-template__band-inner"><p>Só banner/, 'Banner modules without heroTitle render as the hero band');
  const escaped = renderCamapShell({ config: { siteName: '<Nome> "Equipe" & Co' } });
  assert.match(escaped, /&lt;Nome&gt; &quot;Equipe&quot; &amp; Co/);
  assert.doesNotMatch(escaped, /<Nome>/);
  captureWarnings(() => testParams());
  testParamWarnings();
  testBindings();

  const styles = await Promise.all(['template.css', 'layout.css', 'responsive.css'].map((name) => readFile(new URL(`../src/media/templates/site/camap/css/${name}`, import.meta.url), 'utf8')));
  const css = styles.join('\n');
  testMenuTree(styles);
  assert.doesNotMatch(css, /<<<<<<<|=======|>>>>>>>|100vw|:root|@import|url\(|box-shadow|https?:/);
  for (const [index, sheet] of styles.entries()) {
    const withoutMedia = sheet.replace(/@media[^{]*\{/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const rule of withoutMedia.split('}')) {
      const selector = rule.split('{')[0].trim();
      if (!selector || !rule.includes('{')) continue;
      for (const part of selector.split(',')) assert.match(part.trim(), /^\.camap-template\b/, `Scoped selector in sheet ${index}: ${part.trim()}`);
    }
  }
  assert.match(styles[0], /--camap-ocean:#006298;--camap-green:#008542;--camap-teal:#00B2A9;--camap-sun:#FDC82F/, 'Model tokens');
  assert.match(styles[0], /font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif/, 'Optional CAMAP uses host system fonts without bundling a corporate font');
  assert.doesNotMatch(css, /@font-face/, 'No font assets are introduced by the fallback change');
  assert.match(styles[0], /--camap-width:1200px/);
  assert.match(styles[0], /__header\{[^}]*border-bottom:1px solid/);
  assert.match(styles[0], /min-height:76px/, 'Model header/menu height');
  assert.match(styles[0], /__hero-divider\{[^}]*background:var\(--camap-accent\)/);
  assert.match(styles[0], /decimal-leading-zero/, 'Numbered cards 01/02/03 like the model');
  assert.match(styles[1], /__sidebar\[hidden\]/, 'Empty sidebars must not reserve grid columns');
  assert.match(styles[1], /__content--has-left\.camap-template__content--has-right/);
  assert.match(styles[1], /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles[1], /camap-template--fluid/);
  assert.match(styles[1], /minmax\(0,1fr\) 6px minmax\(0,1fr\)/, 'Hero split with 6px divider');
  assert.match(styles[2], /max-width:767px/, 'Mobile menu breakpoint matches the binder');
  assert.match(styles[2], /min-height:44px/, 'Touch targets in the mobile menu');
  assert.match(styles[2], /prefers-reduced-motion/);
  assert.match(styles[2], /forced-colors/);
  assert.match(css, /focus-visible/);
  assert.match(css, /main\[data-mj-component\]:focus\{outline:none\}/, 'Programmatic route focus on main draws no outline');
  assert.match(css, /main\[data-mj-component\]\[data-focus-origin="skip"\]:focus\{outline:3px solid/, 'Skip-link activation keeps a visible indicator on main');
  assert.match(css, /__skip-link:focus\{transform:none\}/);
  assert.match(css, /\.camap-template :focus-visible\{outline:3px solid/, 'Keyboard focus stays visible elsewhere');
  assert.match(styles[0], /__position--breadcrumbs li\{[^}]*min-width:0;max-width:100%;overflow-wrap:anywhere/, 'Long breadcrumb flex items shrink at 320px');
  assert.match(styles[0], /__skip-link\{[^}]*max-width:calc\(100% - 2rem\)/, 'Skip link fits narrow hosts and zoom');
  assert.match(styles[0], /__button,[^{]*\{[^}]*min-width:0;max-width:100%[^}]*overflow-wrap:anywhere/, 'Long unbroken CTA text is bounded');
  assert.match(styles[0], /\.lead table,[^{]*\.article-card table,[^{]*\.custom-html table\{[^}]*overflow:auto/, 'Rich introtext, listing teasers and custom module tables scroll locally');
  assert.match(styles[0], /__position--banner \.camap-template__button:focus-visible,[^{]*\{outline-color:var\(--camap-ink\);outline-offset:-3px\}/, 'Yellow CTA receives an inset contrasting focus outline');
  assert.match(styles[2], /\[data-focus-origin="skip"\]:focus,[^{]*\{outline-color:Highlight\}/, 'Specific skip/CTA focus overrides respect forced colors');
  const articleList = styles[0].match(/\.camap-template \.article-list\{[^}]*\}/)?.[0] ?? '';
  const articleCard = styles[0].match(/\.camap-template \.article-card\{[^}]*\}/)?.[0] ?? '';
  assert.match(articleList, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, '3 columns when there are 3+ articles');
  assert.match(articleList, /background:transparent/, 'Empty tracks with 1/2 articles show no grey fill');
  assert.doesNotMatch(articleList, /background:var\(--camap-(?:line|grey-light|ink)\)|border:1px/, 'The list itself paints no artificial area');
  assert.doesNotMatch(articleList, /grid-auto-rows|min-height/, 'No phantom row height');
  assert.match(articleCard, /border:1px solid var\(--camap-line\)/, 'Each card draws its own 1px divider');
  assert.match(articleCard, /margin:-1px 0 0 -1px/, 'Adjacent borders collapse into one 1px line');
  assert.match(articleList, /padding:1px 0 0 1px/, 'Negative card margins are compensated (no overflow)');
  assert.match(styles[2], /max-width:959px\)\{[\s\S]*?\.article-list\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(styles[2], /max-width:767px\)\{[\s\S]*?\.article-list\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.camap-template \[hidden\]\{display:none!important\}/, 'Hidden toggle/navigation stay hidden despite flex rules');
  assert.doesNotMatch(css, /border-radius:\s*(?!0)[1-9]/);
  const allowedColors = new Set(['#FFFFFF', '#000000', '#008542', '#006298', '#00B2A9', '#FDC82F', '#75787B', '#E3E9ED', '#F2F7FA', '#ED8B00']);
  for (const color of css.match(/#[0-9a-f]{3,8}\b/gi) ?? []) assert.ok(allowedColors.has(color.toUpperCase()), `Identity color ${color}`);

  const documentRef = { body: { innerHTML: '' }, documentElement: {}, title: '' };
  const app = createApplication({ template: 'camap', documentRef, autoStart: false });
  app.router.routes = [{ name: 'home', pattern: /^\/$/, keys: [] }];
  await app.router.navigate('#/');
  assert.match(documentRef.body.innerHTML, /class="camap-template camap-template--site"/);
  assert.match(documentRef.body.innerHTML, /data-template-region="component"/);
  assert.match(documentRef.body.innerHTML, /data-template-region="footer"/);
  assert.match(documentRef.body.innerHTML, /data-template-region="main-top"/);
  console.log('camap template: render, 16 posições, ordem de regiões, parâmetros, tons, hero, menu móvel, CSS escopado e integração aprovados');
}
