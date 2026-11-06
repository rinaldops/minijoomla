import { escapeHtml, safeUrl } from '../../libraries/minijoomla/security/sanitize.js';

export const TEMPLATE_POSITIONS = Object.freeze([
  'topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs',
  'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right',
  'main-bottom', 'bottom-a', 'bottom-b', 'footer'
]);
export const COMPONENT_POSITION = 'component';

// Template style parameters, in the declarative shape used by src/libraries/minijoomla/application/declared-params.js.
export const TEMPLATE_PARAM_DEFINITIONS = Object.freeze([
  { name: 'brand', type: 'select', label: 'Marca', default: 'title', options: [{ value: 'title', label: 'Título do site' }, { value: 'logo', label: 'Logotipo' }, { value: 'none', label: 'Ocultar' }] },
  { name: 'logoFile', type: 'url', label: 'Arquivo do logotipo', default: '' },
  { name: 'siteTitle', type: 'text', label: 'Título exibido', default: '' },
  { name: 'siteDescription', type: 'textarea', label: 'Descrição exibida', default: '' },
  { name: 'colorName', type: 'select', label: 'Esquema de cores', default: 'standard', options: [{ value: 'standard', label: 'Padrão — Cassiopeia azul' }, { value: 'alternative', label: 'Alternativo — Cassiopeia bordô' }] },
  { name: 'useFontScheme', type: 'select', label: 'Fonte', default: 'system', options: [{ value: 'system', label: 'Fonte do sistema' }, { value: 'roboto', label: 'Roboto instalado / fonte do sistema' }] },
  { name: 'fluidContainer', type: 'checkbox', label: 'Layout fluido', default: false },
  { name: 'stickyHeader', type: 'checkbox', label: 'Cabeçalho fixo', default: false },
  { name: 'backTop', type: 'checkbox', label: 'Botão voltar ao topo', default: true }
].map((definition) => Object.freeze(definition)));

export const TEMPLATE_METADATA = Object.freeze({
  key: 'cassiopeia', name: 'Cassiopeia', positions: TEMPLATE_POSITIONS,
  componentPosition: COMPONENT_POSITION,
  aliases: Object.freeze({ content: 'main-top', sidebar: 'sidebar-right' }),
  params: TEMPLATE_PARAM_DEFINITIONS
});

const NAVBAR_ID = 'cassiopeia-navbar-collapse';
const OFF = new Set(['0', 'false', 'no', 'off', 'none', 'hidden', 'hide']);
const ON = new Set(['1', 'true', 'yes', 'on']);

const PARAM_SOURCES = Object.freeze([
  ['templateParams', (config) => config?.templateParams],
  ['styleParams', (config) => config?.styleParams],
  ['template.params', (config) => config?.template?.params]
]);
const PARAM_WARNING = 'MINIJOOMLA: parâmetros de estilo do template Cassiopeia inválidos; padrões aplicados.';

function absent(value) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

function flag(value, fallback, name, issues) {
  if (absent(value)) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (ON.has(normalized)) return true;
  if (OFF.has(normalized)) return false;
  issues.push({ field: name, reason: 'invalid-boolean' });
  return fallback;
}

function text(value, name, issues) {
  if (absent(value)) return '';
  if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) return String(value).trim();
  issues?.push({ field: name, reason: 'invalid-text' });
  return '';
}

function choice(value, name, accepted, issues, normalize = (item) => item) {
  if (absent(value)) return '';
  const normalized = normalize(text(value, name, issues).toLowerCase());
  if (accepted.includes(normalized)) return normalized;
  if (typeof value === 'string' || typeof value === 'number') issues.push({ field: name, reason: 'invalid-option' });
  return '';
}

function paramSource(config, issues) {
  for (const [field, read] of PARAM_SOURCES) {
    let value = read(config);
    if (absent(value)) continue;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { issues.push({ field, reason: 'malformed-json' }); continue; }
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    issues.push({ field, reason: 'invalid-format' });
  }
  return {};
}

function reportParamIssues(issues, warn) {
  if (!issues.length || typeof warn !== 'function') return;
  // Only fixed field names and reason codes are logged; received values may contain sensitive text.
  try { warn(PARAM_WARNING, issues.map(({ field, reason }) => ({ field, reason }))); } catch { /* logging must not break the shell */ }
}

/**
 * Reads template style parameters. Missing values use defaults silently; malformed or invalid
 * values also fall back to defaults but emit a sanitized warning (field + reason code only).
 */
export function resolveTemplateParams(config = {}, { warn = globalThis.console?.warn?.bind(globalThis.console) } = {}) {
  const issues = [];
  const source = paramSource(config ?? {}, issues);
  const logoText = text(source.logoFile, 'logoFile', issues);
  const logo = logoText ? safeUrl(logoText) : '';
  const safeLogo = logo && logo !== '#' ? logo : '';
  if (logoText && !safeLogo) issues.push({ field: 'logoFile', reason: 'unsafe-url' });
  let brand = 'title';
  const brandChoice = typeof source.brand === 'string' && ['logo', 'title', 'none'].includes(source.brand.trim().toLowerCase())
    ? source.brand.trim().toLowerCase()
    : '';
  if (brandChoice) brand = brandChoice;
  else {
    const enabled = flag(source.brand, true, 'brand', issues);
    brand = !enabled ? 'none' : safeLogo ? 'logo' : 'title';
  }
  const color = choice(source.colorName, 'colorName', ['standard', 'alternative'], issues, (item) => {
    const alias = item.replace(/^colors_/, '');
    return alias === 'default' ? 'standard' : alias;
  });
  const fontText = absent(source.useFontScheme) ? '' : text(source.useFontScheme, 'useFontScheme', issues).toLowerCase();
  const font = fontText.includes('roboto') ? 'roboto' : 'system';
  if (fontText && font === 'system' && !['system', '0', 'none'].includes(fontText)) issues.push({ field: 'useFontScheme', reason: 'invalid-option' });
  const params = Object.freeze({
    brand,
    logoFile: safeLogo,
    siteTitle: text(source.siteTitle, 'siteTitle', issues),
    siteDescription: text(source.siteDescription, 'siteDescription', issues),
    colorName: color === 'alternative' ? 'alternative' : 'standard',
    useFontScheme: font,
    fluidContainer: flag(source.fluidContainer, false, 'fluidContainer', issues),
    stickyHeader: flag(source.stickyHeader, false, 'stickyHeader', issues),
    backTop: flag(source.backTop, true, 'backTop', issues)
  });
  reportParamIssues(issues, warn);
  return params;
}

function region(name, html = '', { tag = 'div', classes = `container-${name}`, attributes = '' } = {}) {
  if (!html) return '';
  return `<${tag} class="${classes}" data-template-region="${name}" data-mj-position="${name}"${attributes}>${html}</${tag}>`;
}

function renderBrand(params, siteName, description) {
  if (params.brand === 'none') return '';
  const title = escapeHtml(params.siteTitle || siteName);
  const mark = params.brand === 'logo' && params.logoFile
    ? `<img class="logo d-inline-block" src="${params.logoFile}" alt="${escapeHtml(siteName)}" loading="eager" decoding="async">`
    : `<span class="site-title"${params.siteTitle ? ` title="${escapeHtml(siteName)}"` : ''}>${title}</span>`;
  const descriptionHtml = description ? `<div class="site-description">${escapeHtml(description)}</div>` : '';
  return `<div class="grid-child container-brand"><div class="navbar-brand"><a class="brand-logo" href="#/">${mark}</a>${descriptionHtml}</div></div>`;
}

function renderNavigation(menu, search) {
  if (!menu && !search) return '';
  const menuHtml = menu
    ? `<div class="navbar navbar-expand-md"><button class="navbar-toggler navbar-toggler-right" type="button" aria-controls="${NAVBAR_ID}" aria-expanded="false" aria-label="Alternar navegação" data-cassiopeia-toggler><span class="icon-menu" aria-hidden="true"></span></button><div class="collapse navbar-collapse" id="${NAVBAR_ID}">${region('menu', menu)}</div></div>`
    : '';
  return `<div class="grid-child container-nav">${menuHtml}${region('search', search)}</div>`;
}

const BACK_TOP_ICON = '<svg class="icon-arrow-up icon-fw" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 2.5 13.5 8l-1.4 1.4L9 6.3V14H7V6.3L3.9 9.4 2.5 8z"/></svg>';

export function renderShell({ config = {}, menus = '', breadcrumbs = '', content = '', modules = {}, busy = false } = {}) {
  const positions = modules && typeof modules === 'object' ? modules : {};
  const safeConfig = config && typeof config === 'object' ? config : {};
  const params = resolveTemplateParams(safeConfig);
  const siteName = String(safeConfig.siteName ?? 'MINIJOOMLA');
  const description = params.siteDescription || text(safeConfig.siteDescription);
  const left = positions['sidebar-left'] ?? '';
  const right = `${positions['sidebar-right'] ?? ''}${positions.sidebar ?? ''}`;
  const menu = `${menus ?? ''}${positions.menu ?? ''}`;
  const mainTop = `${positions['main-top'] ?? ''}${positions.content ?? ''}`;
  const footer = positions.footer ?? `<p class="site-credit">${escapeHtml(siteName)}</p>`;
  const classes = [
    'cassiopeia-template', 'site', params.fluidContainer ? 'wrapper-fluid' : 'wrapper-static',
    left && 'has-sidebar-left', right && 'has-sidebar-right',
    `colors-${params.colorName}`, params.useFontScheme === 'roboto' && 'font-roboto'
  ].filter(Boolean).join(' ');
  const headerClasses = ['header', 'container-header', 'full-width', params.stickyHeader && 'position-sticky sticky-top'].filter(Boolean).join(' ');
  const backTop = params.backTop
    ? `<a href="#site-top" id="back-top" class="back-to-top-link" aria-label="Voltar ao topo" data-shell-anchor="site-top">${BACK_TOP_ICON}</a>`
    : '';
  return `<div class="${classes}" data-template="cassiopeia" data-color-name="${params.colorName}">
<a class="skip-link" href="#main-content" data-shell-anchor="main-content">Pular para o conteúdo</a>
<header id="site-top" tabindex="-1" class="${headerClasses}">
${region('topbar', positions.topbar)}
${region('below-top', positions['below-top'], { classes: 'grid-child container-below-top' })}
${renderBrand(params, siteName, description)}
${renderNavigation(menu, positions.search ?? '')}
</header>
<div class="site-grid">
${region('banner', positions.banner, { classes: 'container-banner full-width' })}
${region('top-a', positions['top-a'], { classes: 'grid-child container-top-a' })}
${region('top-b', positions['top-b'], { classes: 'grid-child container-top-b' })}
${region('sidebar-left', left, { tag: 'aside', classes: 'grid-child container-sidebar-left', attributes: ' aria-label="Coluna lateral esquerda"' })}
<div class="grid-child container-component" data-template-main-column>
${region('breadcrumbs', `${breadcrumbs ?? ''}${positions.breadcrumbs ?? ''}`)}
${region('main-top', mainTop)}
<main class="site-main" data-template-region="component" data-mj-position="component" id="main-content" tabindex="-1" aria-label="Conteúdo principal"${busy ? ' aria-busy="true"' : ''} data-mj-component>${content}</main>
${region('main-bottom', positions['main-bottom'])}
</div>
${region('sidebar-right', right, { tag: 'aside', classes: 'grid-child container-sidebar-right', attributes: ' aria-label="Coluna lateral direita"' })}
${region('bottom-a', positions['bottom-a'], { classes: 'grid-child container-bottom-a' })}
${region('bottom-b', positions['bottom-b'], { classes: 'grid-child container-bottom-b' })}
</div>
${footer ? `<footer class="container-footer footer full-width" data-template-region="footer" data-mj-position="footer"><div class="grid-child">${footer}</div></footer>` : ''}
${backTop}
</div>`;
}

function findShell(root) {
  return root?.matches?.('[data-template="cassiopeia"]')
    ? root : root?.querySelector?.('[data-template="cassiopeia"]');
}

/*
 * Binds template chrome only: skip/back-to-top anchors (focus without touching the
 * hash router), the mobile navbar toggler and the back-to-top visibility.
 * Returns a cleanup that must run before the shell HTML is replaced.
 */
export function bindShell(root = globalThis.document) {
  const shell = findShell(root);
  if (!shell?.addEventListener) return () => {};
  const cleanups = [];
  const toggler = shell.querySelector?.('[data-cassiopeia-toggler]');
  const collapse = shell.querySelector?.(`#${NAVBAR_ID}`);
  const backTop = shell.querySelector?.('#back-top');
  const view = shell.ownerDocument?.defaultView;
  const viewport = view?.matchMedia?.('(max-width: 767.98px)');
  const isMobile = () => viewport ? viewport.matches : true;
  let skipTarget;
  const clearSkipFocus = () => {
    skipTarget?.removeEventListener?.('blur', clearSkipFocus);
    skipTarget?.removeAttribute?.('data-focus-origin');
    skipTarget = null;
  };
  cleanups.push(clearSkipFocus);

  const setOpen = (open) => {
    toggler?.setAttribute?.('aria-expanded', open ? 'true' : 'false');
    collapse?.classList?.toggle?.('show', open);
  };
  const isOpen = () => toggler?.getAttribute?.('aria-expanded') === 'true';

  const handleClick = (event) => {
    if (!event || event.defaultPrevented) return;
    const target = event.target;
    if (toggler && target?.closest?.('[data-cassiopeia-toggler]') === toggler) {
      setOpen(!isOpen());
      return;
    }
    const link = target?.closest?.('[data-shell-anchor]');
    if (!link || !shell.contains(link) || event.button > 0
      || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const id = link.getAttribute('data-shell-anchor');
    if (id !== 'main-content' && id !== 'site-top') return;
    const destination = shell.querySelector(`#${id}`);
    if (!destination) return;
    event.preventDefault();
    clearSkipFocus();
    if (id === 'main-content') {
      skipTarget = destination;
      destination.setAttribute?.('data-focus-origin', 'skip');
      destination.addEventListener?.('blur', clearSkipFocus, { once: true });
    }
    destination.focus?.({ preventScroll: true });
    destination.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  };
  shell.addEventListener('click', handleClick);
  cleanups.push(() => shell.removeEventListener('click', handleClick));

  if (toggler && collapse) {
    const syncNavigation = () => {
      const active = shell.ownerDocument?.activeElement;
      if (isMobile()) {
        if (collapse.contains?.(active)) toggler.focus?.();
        setOpen(false);
      } else {
        setOpen(true);
        if (active === toggler) {
          const first = collapse.querySelector?.('a[href], button:not([hidden]), input, select, textarea, [tabindex="0"]');
          (first ?? shell.querySelector?.('#main-content'))?.focus?.({ preventScroll: true });
        }
      }
    };
    const handleKeydown = (event) => {
      if (event?.key !== 'Escape' || event.defaultPrevented || !isMobile() || !isOpen()) return;
      const focusInside = toggler === event.target || collapse.contains?.(event.target);
      if (!focusInside) return;
      setOpen(false);
      toggler.focus?.();
      event.preventDefault?.();
    };
    shell.addEventListener('keydown', handleKeydown);
    cleanups.push(() => shell.removeEventListener('keydown', handleKeydown));
    viewport?.addEventListener?.('change', syncNavigation);
    cleanups.push(() => viewport?.removeEventListener?.('change', syncNavigation));
    syncNavigation();
  }

  if (backTop && view?.addEventListener) {
    const sync = () => {
      const offset = view.scrollY ?? view.pageYOffset ?? shell.ownerDocument?.documentElement?.scrollTop ?? 0;
      backTop.classList?.toggle?.('visible', offset > 20);
    };
    sync();
    view.addEventListener('scroll', sync, { passive: true });
    cleanups.push(() => view.removeEventListener('scroll', sync, { passive: true }));
  }

  // Signals CSS that scripted chrome (toggler, back-to-top visibility) is active.
  shell.setAttribute?.('data-cassiopeia-js', '');
  cleanups.push(() => shell.removeAttribute?.('data-cassiopeia-js'));
  return () => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); };
}
