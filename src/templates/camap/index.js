import { escapeHtml, safeUrl } from '../../libraries/minijoomla/security/sanitize.js';

export const TEMPLATE_POSITIONS = Object.freeze([
  'topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs',
  'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right',
  'main-bottom', 'bottom-a', 'bottom-b', 'footer'
]);
export const COMPONENT_POSITION = 'component';

/** Positions rendered as full-width editorial bands; each accepts a tone. */
export const BAND_POSITIONS = Object.freeze(['topbar', 'below-top', 'top-a', 'top-b', 'main-bottom', 'bottom-a', 'bottom-b']);
export const BAND_TONES = Object.freeze(['white', 'ocean', 'teal', 'green']);
const DEFAULT_TONES = Object.freeze({ 'bottom-a': 'ocean', 'bottom-b': 'teal' });

const ACCENTS = Object.freeze({
  '#FDC82F': '#FDC82F', yellow: '#FDC82F', amarelo: '#FDC82F', sun: '#FDC82F',
  '#008542': '#008542', green: '#008542', verde: '#008542',
  '#00B2A9': '#00B2A9', teal: '#00B2A9', 'verde-agua': '#00B2A9',
  '#006298': '#006298', blue: '#006298', ocean: '#006298', azul: '#006298', 'azul-escuro': '#006298',
  '#C4D600': '#C4D600', 'light-green': '#C4D600', 'verde-claro': '#C4D600',
  '#ED8B00': '#ED8B00', orange: '#ED8B00', laranja: '#ED8B00',
  '#3DDAFF': '#3DDAFF', 'light-blue': '#3DDAFF', 'azul-claro': '#3DDAFF'
});
const DEFAULT_ACCENT = '#FDC82F';
const DEFAULT_SITE_NAME = 'MINIJOOMLA';
const DEFAULT_DESCRIPTION = 'ENGENHARIA, TECNOLOGIA E INOVAÇÃO';
const MOBILE_QUERY = '(max-width: 767px)';

const BOOLEAN_PARAMS = Object.freeze(['brand', 'fluidContainer', 'backTop', 'pairSections']);
const TEXT_PARAMS = Object.freeze(['siteTitle', 'siteDescription', 'heroKicker', 'heroTitle', 'heroSubtitle', 'heroActionLabel', 'heroActionUrl']);
const warnedConfigs = new WeakSet();

// Template style parameters, in the declarative shape used by src/libraries/minijoomla/application/declared-params.js.
// Note: bandTones is not included here; it's a per-position object mapping that exceeds the simple form,
// so it remains configurable only via templateParams at runtime, never through the admin UI.
export const CAMAP_PARAM_DEFINITIONS = Object.freeze([
  { name: 'brand', type: 'checkbox', label: 'Exibir marca', default: true },
  { name: 'siteTitle', type: 'text', label: 'Título do site (substitui o nome do site)', default: '' },
  { name: 'siteDescription', type: 'text', label: 'Descrição/slogan', default: '' },
  { name: 'heroKicker', type: 'text', label: 'Subtítulo do destaque (acima do título)', default: '' },
  { name: 'heroTitle', type: 'text', label: 'Título do destaque (hero)', default: '' },
  { name: 'heroSubtitle', type: 'text', label: 'Subtítulo do destaque (abaixo do título)', default: '' },
  { name: 'heroActionLabel', type: 'text', label: 'Texto do botão de ação', default: '' },
  { name: 'heroActionUrl', type: 'url', label: 'URL do botão de ação', default: '' },
  { name: 'accentColor', type: 'select', label: 'Cor de destaque', options: [
    { value: 'yellow', label: 'Amarelo' },
    { value: 'green', label: 'Verde' },
    { value: 'teal', label: 'Verde-água' },
    { value: 'blue', label: 'Azul' },
    { value: 'light-green', label: 'Verde claro' },
    { value: 'orange', label: 'Laranja' },
    { value: 'light-blue', label: 'Azul claro' }
  ], default: 'yellow' },
  { name: 'fluidContainer', type: 'checkbox', label: 'Layout fluido (largura total)', default: false },
  { name: 'backTop', type: 'checkbox', label: 'Botão "Voltar ao topo"', default: false },
  { name: 'pairSections', type: 'checkbox', label: 'Parear seções em grid de 2 colunas', default: false }
].map((definition) => Object.freeze(definition)));


function markup(value) {
  return String(value ?? '').trim();
}

function absent(value) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

/** Returns a plain object; records only the parameter name when the input is malformed. */
function plainObject(value, name, issues) {
  if (absent(value)) return {};
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { issues.push(`${name}: JSON malformado`); return {}; }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  issues.push(`${name}: formato inválido (esperado objeto)`);
  return {};
}

function flag(source, name, fallback, issues) {
  const value = source[name];
  if (absent(value)) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = typeof value === 'string' || typeof value === 'number' ? String(value).trim().toLowerCase() : '';
  if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
  issues.push(`${name}: valor booleano inválido`);
  return fallback;
}

function text(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

/**
 * Normalizes `config.templateParams`/`config.styleParams` (object or JSON
 * string; templateParams wins). Missing values use defaults silently; malformed
 * or invalid values also fall back to defaults but emit one sanitized
 * `console.warn` per config object (parameter names only, never received values).
 */
export function resolveCamapParams(config = {}, { warn = (message) => globalThis.console?.warn?.(message) } = {}) {
  const issues = [];
  const source = {
    ...plainObject(config?.styleParams, 'styleParams', issues),
    ...plainObject(config?.templateParams, 'templateParams', issues)
  };
  for (const name of TEXT_PARAMS) {
    const value = source[name];
    if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') issues.push(`${name}: formato inválido (esperado texto)`);
  }
  let accent = DEFAULT_ACCENT;
  if (!absent(source.accentColor)) {
    const accentKey = text(source.accentColor);
    accent = ACCENTS[accentKey.toUpperCase()] ?? ACCENTS[accentKey.toLowerCase()];
    if (!accent) {
      issues.push('accentColor: cor fora da paleta permitida');
      accent = DEFAULT_ACCENT;
    }
  }
  const tones = { ...DEFAULT_TONES };
  let invalidTones = false;
  for (const [position, tone] of Object.entries(plainObject(source.bandTones, 'bandTones', issues))) {
    if (BAND_POSITIONS.includes(position) && BAND_TONES.includes(tone)) tones[position] = tone;
    else invalidTones = true;
  }
  if (invalidTones) issues.push('bandTones: posição ou tom inválido ignorado');
  const params = Object.freeze({
    brand: flag(source, 'brand', true, issues),
    siteTitle: text(source.siteTitle) || text(config?.siteName) || DEFAULT_SITE_NAME,
    siteDescription: source.siteDescription === undefined || source.siteDescription === null ? DEFAULT_DESCRIPTION : text(source.siteDescription),
    heroKicker: text(source.heroKicker),
    heroTitle: text(source.heroTitle),
    heroSubtitle: text(source.heroSubtitle),
    heroActionLabel: text(source.heroActionLabel),
    heroActionUrl: text(source.heroActionUrl),
    accentColor: accent,
    fluidContainer: flag(source, 'fluidContainer', false, issues),
    backTop: flag(source, 'backTop', false, issues),
    pairSections: flag(source, 'pairSections', false, issues),
    bandTones: Object.freeze(tones)
  });
  const dedupe = config && typeof config === 'object';
  if (issues.length && !(dedupe && warnedConfigs.has(config))) {
    if (dedupe) warnedConfigs.add(config);
    try { warn(`MINIJOOMLA CAMAP: parâmetros de template inválidos; padrões aplicados (${issues.join('; ')}).`); } catch { /* logging must never break rendering */ }
  }
  return params;
}

function region(name, content = '', tag = 'div', attributes = '', extraClass = '') {
  return `<${tag} data-template-region="${name}" data-mj-position="${name}" class="camap-template__position camap-template__position--${name}${extraClass}"${attributes}>${markup(content)}</${tag}>`;
}

function toneClass(name, params) {
  const tone = params.bandTones[name];
  return tone && tone !== 'white' ? ` camap-template__tone camap-template__tone--${tone}` : '';
}

function band(name, content, params, tag = 'div', attributes = '') {
  const html = markup(content);
  return region(name, html ? `<div class="camap-template__band-inner">${html}</div>` : '', tag, attributes, toneClass(name, params));
}

function sections(names, modules, params) {
  const populated = names.filter((name) => markup(modules[name])).length;
  if (params.pairSections && populated === 2) {
    return `<div class="camap-template__section-grid camap-template__section-grid--paired">${names.map((name) => region(name, modules[name], 'div', '', toneClass(name, params))).join('')}</div>`;
  }
  return `<div class="camap-template__sections">${names.map((name) => band(name, modules[name], params)).join('')}</div>`;
}

function hero(params, modules) {
  const content = markup(modules);
  if (!params.heroTitle) return content ? `<div class="camap-template__band-inner">${content}</div>` : '';
  const kicker = params.heroKicker ? `<p class="camap-template__hero-kicker">${escapeHtml(params.heroKicker)}</p>` : '';
  const subtitle = params.heroSubtitle ? `<p class="camap-template__hero-lead">${escapeHtml(params.heroSubtitle)}</p>` : '';
  const action = params.heroActionLabel && params.heroActionUrl
    ? `<p class="camap-template__hero-actions"><a class="camap-template__button camap-template__button--primary" href="${safeUrl(params.heroActionUrl)}">${escapeHtml(params.heroActionLabel)}<span aria-hidden="true">→</span></a></p>`
    : '';
  const media = content ? `<span class="camap-template__hero-divider" aria-hidden="true"></span><div class="camap-template__hero-media">${content}</div>` : '';
  return `<div class="camap-template__hero${content ? ' camap-template__hero--split' : ''}"><div class="camap-template__hero-content">${kicker}<h2 class="camap-template__hero-title">${escapeHtml(params.heroTitle)}</h2>${subtitle}${action}</div>${media}</div>`;
}

function footer(params, modules) {
  const siteName = escapeHtml(params.siteTitle);
  const custom = markup(modules);
  const top = custom || `<div class="camap-template__footer-brand"><span class="camap-template__mark" aria-hidden="true"></span><div class="camap-template__footer-identity"><p class="camap-template__footer-credit">${siteName}</p>${params.siteDescription ? `<p class="camap-template__footer-tagline">${escapeHtml(params.siteDescription)}</p>` : ''}</div></div>`;
  const backTop = params.backTop ? `<p class="camap-template__footer-bottom"><a class="camap-template__back-top" href="#camap-top" data-shell-anchor="top">Voltar ao topo<span aria-hidden="true"> ↑</span></a></p>` : '';
  return top + backTop;
}

export function renderCamapShell({ config, menus = '', breadcrumbs = '', content = '', modules = {}, busy = false } = {}) {
  const positions = modules ?? {};
  const params = resolveCamapParams(config ?? {});
  const siteName = escapeHtml(params.siteTitle);
  const menu = markup(menus) + markup(positions.menu);
  const search = markup(positions.search);
  const left = markup(positions['sidebar-left']);
  const right = markup(positions['sidebar-right']) + markup(positions.sidebar);
  const mainTop = markup(positions['main-top']) + markup(positions.content);
  const layoutClass = `camap-template__content${left ? ' camap-template__content--has-left' : ''}${right ? ' camap-template__content--has-right' : ''}`;
  const navigationBody = region('menu', menu) + region('search', search);
  // Toggle starts hidden and navigation visible: without the binder the menu remains usable.
  const navigation = menu || search
    ? `<button type="button" class="camap-template__menu-toggle" aria-expanded="true" aria-controls="camap-template-navigation" hidden><span class="camap-template__menu-icon" aria-hidden="true"></span>Menu</button><div class="camap-template__navigation" id="camap-template-navigation">${navigationBody}</div>`
    : navigationBody;
  const brand = params.brand
    ? `<a class="camap-template__brand" href="#/" aria-label="${siteName} — início"><span class="camap-template__mark" aria-hidden="true"></span><span class="camap-template__brand-label">${params.siteDescription ? `<small>${escapeHtml(params.siteDescription)}</small>` : ''}<strong>${siteName}</strong></span></a>`
    : '';
  const header = `<header class="camap-template__header" id="camap-top" data-template-chrome="header">${band('topbar', positions.topbar, params)}<div class="camap-template__header-main${params.brand ? '' : ' camap-template__header-main--no-brand'}">${brand}${navigation}</div>${band('below-top', positions['below-top'], params)}</header>`;
  const middle = `<div class="${layoutClass}"><div class="camap-template__sidebar camap-template__sidebar--left"${left ? '' : ' hidden'}>${region('sidebar-left', left, 'aside', ' aria-label="Conteúdo complementar à esquerda"')}</div><div class="camap-template__main-column" data-template-main-column>${region('main-top', mainTop)}${region(COMPONENT_POSITION, content, 'main', ` id="main-content" tabindex="-1" aria-label="Conteúdo principal"${busy ? ' aria-busy="true"' : ''} data-mj-component`)}</div><div class="camap-template__sidebar camap-template__sidebar--right"${right ? '' : ' hidden'}>${region('sidebar-right', right, 'aside', ' aria-label="Conteúdo complementar à direita"')}</div></div>`;
  const rootClass = `camap-template camap-template--site${params.fluidContainer ? ' camap-template--fluid' : ''}`;
  const accent = params.accentColor === DEFAULT_ACCENT ? '' : ` style="--camap-accent:${params.accentColor}"`;
  const banner = region('banner', hero(params, positions.banner), 'div', '', params.heroTitle ? ' camap-template__position--hero' : '');
  const trail = band('breadcrumbs', markup(breadcrumbs) + markup(positions.breadcrumbs), params);
  const siteFooter = region('footer', `<div class="camap-template__band-inner">${footer(params, positions.footer)}</div>`, 'footer', '', ' camap-template__tone camap-template__tone--green');
  return `<div class="${rootClass}" data-template="camap"${accent}><a class="camap-template__skip-link" href="#main-content" data-shell-anchor="main-content">Pular para o conteúdo</a><div class="camap-template__shell">${header}${banner}${trail}${sections(['top-a', 'top-b'], positions, params)}${middle}${band('main-bottom', positions['main-bottom'], params)}${sections(['bottom-a', 'bottom-b'], positions, params)}${siteFooter}</div></div>`;
}

/** Bind only template chrome; returns cleanup for hosts that replace innerHTML. */
export function bindShell(root) {
  const shell = root?.matches?.('[data-template="camap"]') ? root : root?.querySelector?.('[data-template="camap"]');
  if (!shell) return () => {};
  const navigation = shell.querySelector('.camap-template__navigation');
  const toggle = shell.querySelector('.camap-template__menu-toggle');
  const viewport = shell.ownerDocument?.defaultView?.matchMedia?.(MOBILE_QUERY);
  let skipTarget;
  const clearSkipFocus = () => {
    skipTarget?.removeEventListener?.('blur', clearSkipFocus);
    skipTarget?.removeAttribute?.('data-focus-origin');
    skipTarget = null;
  };
  const isOpen = () => toggle?.getAttribute?.('aria-expanded') === 'true';
  const setOpen = (open) => {
    if (!navigation || !toggle) return;
    navigation.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  const syncNavigation = () => {
    if (!navigation || !toggle) return;
    const mobile = Boolean(viewport?.matches);
    const active = shell.ownerDocument?.activeElement;
    toggle.hidden = !mobile;
    if (mobile && navigation.contains?.(active)) toggle.focus?.();
    setOpen(!mobile);
    if (!mobile && active === toggle) {
      const first = navigation.querySelector?.('a[href], button:not([hidden]), input, select, textarea, [tabindex="0"]');
      (first ?? shell.querySelector('.camap-template__skip-link'))?.focus?.({ preventScroll: true });
    }
  };
  const onClick = (event) => {
    if (!event || event.defaultPrevented) return;
    if (toggle && event.target?.closest?.('.camap-template__menu-toggle') === toggle) {
      setOpen(!isOpen());
      return;
    }
    const anchor = event.target?.closest?.('[data-shell-anchor]');
    if (!anchor || !shell.contains(anchor) || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const destination = anchor.getAttribute?.('data-shell-anchor');
    if (destination !== 'top' && destination !== 'main-content') return;
    const toTop = destination === 'top';
    const target = toTop ? shell.querySelector('.camap-template__skip-link') : shell.querySelector('[data-mj-component]');
    if (!target) return;
    event.preventDefault();
    clearSkipFocus();
    if (toTop) {
      shell.scrollIntoView?.({ block: 'start' });
      target.focus?.({ preventScroll: true });
      return;
    }
    // Programmatic focus (route changes) stays outline-free; the skip link marks its own target.
    skipTarget = target;
    target.setAttribute?.('data-focus-origin', 'skip');
    target.addEventListener?.('blur', clearSkipFocus, { once: true });
    target.focus();
    target.scrollIntoView?.({ block: 'start' });
  };
  const onKeydown = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !viewport?.matches || !isOpen()) return;
    if (!navigation?.contains?.(event.target) && event.target !== toggle) return;
    setOpen(false);
    toggle.focus?.();
    event.preventDefault();
  };
  syncNavigation();
  shell.addEventListener('click', onClick);
  shell.addEventListener('keydown', onKeydown);
  viewport?.addEventListener?.('change', syncNavigation);
  return () => {
    shell.removeEventListener('click', onClick);
    shell.removeEventListener('keydown', onKeydown);
    viewport?.removeEventListener?.('change', syncNavigation);
    clearSkipFocus();
    if (navigation && toggle) {
      navigation.hidden = false;
      toggle.hidden = true;
      toggle.setAttribute('aria-expanded', 'true');
    }
  };
}
