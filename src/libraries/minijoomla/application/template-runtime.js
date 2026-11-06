import { renderShell, bindShell as bindCassiopeiaShell } from '../../../templates/cassiopeia/index.js';
import { renderCamapShell, bindShell as bindCamapShell } from '../../../templates/camap/index.js';

const BUILTINS = Object.freeze({
  default: { render: renderShell, bind: bindCassiopeiaShell, styles: ['../../../media/templates/site/cassiopeia/css/template.css'] },
  cassiopeia: { render: renderShell, bind: bindCassiopeiaShell, styles: ['../../../media/templates/site/cassiopeia/css/template.css'] },
  camap: { render: renderCamapShell, bind: bindCamapShell, styles: ['../../../media/templates/site/cassiopeia/css/template.css', '../../../media/templates/site/camap/css/template.css', '../../../media/templates/site/camap/css/layout.css', '../../../media/templates/site/camap/css/responsive.css'] }
});

function assetUrl(value, base, extension) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')) {
    throw new TypeError('URL de recurso do template inválida.');
  }
  const url = new URL(value, base);
  if (!['http:', 'https:', 'file:'].includes(url.protocol) || url.username || url.password || url.hash || !url.pathname.endsWith(extension)) {
    throw new TypeError('URL de recurso do template inválida.');
  }
  if (url.protocol === 'file:' && !base.startsWith('file:')) throw new TypeError('Recurso local não permitido neste host.');
  return url.href;
}

function stylesFor(row, builtin, base) {
  let styles = row?.styles;
  if (typeof styles === 'string' && styles.trim()) styles = JSON.parse(styles);
  if (styles === undefined || styles === null || styles === '') {
    return (builtin?.styles ?? []).map((path) => new URL(path, import.meta.url).href);
  }
  if (!Array.isArray(styles)) throw new TypeError('styles deve ser uma lista JSON de URLs CSS.');
  return styles.map((style) => assetUrl(style, base, '.css'));
}

export function createTemplateRuntime({ importModule = (url) => import(url), documentRef } = {}) {
  const loaded = new Map();
  const ownedLinks = [];
  let currentStyles = '';

  async function resolve(key, records) {
    const rows = Array.isArray(records) ? records : records ? [records] : [];
    const selectedKey = !Array.isArray(records) && records?.key ? records.key : key;
    const row = rows.find((item) => item.key === selectedKey);
    if (row?.enabled === false) throw new TypeError('O template selecionado está desabilitado.');
    const builtin = BUILTINS[selectedKey];
    if (!builtin && !row) throw new TypeError('Template selecionado não está registrado.');
    const base = documentRef?.baseURI ?? import.meta.url;
    const styles = stylesFor(row, builtin, base);
    if (builtin) return { key: selectedKey, render: builtin.render, bind: builtin.bind, styles };
    const url = assetUrl(row.entryPointUrl, base, '.js');
    if (!loaded.has(url)) loaded.set(url, importModule(url));
    const module = await loaded.get(url);
    const render = module.renderShell ?? module.default;
    if (typeof render !== 'function') throw new TypeError('Template deve exportar renderShell ou uma função default.');
    if (module.bindShell !== undefined && typeof module.bindShell !== 'function') throw new TypeError('bindShell deve ser uma função.');
    return { key: selectedKey, render, bind: module.bindShell, styles };
  }

  function applyStyles(template) {
    if (!documentRef?.head?.appendChild || !documentRef.createElement) return;
    const signature = JSON.stringify(template.styles);
    if (signature === currentStyles) return;
    for (const link of ownedLinks.splice(0)) link.remove();
    for (const href of template.styles) {
      const link = documentRef.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-mj-template-style', template.key);
      link.addEventListener?.('error', () => console.warn(`MINIJOOMLA: CSS indisponível para "${template.key}".`));
      documentRef.head.appendChild(link);
      ownedLinks.push(link);
    }
    currentStyles = signature;
  }

  return Object.freeze({ resolve, applyStyles });
}
