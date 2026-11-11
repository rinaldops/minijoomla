import { renderShell, bindShell as bindCassiopeiaShell } from '../../../templates/cassiopeia/index.js';
import { renderCamapShell, bindShell as bindCamapShell } from '../../../templates/camap/index.js';
import { ownDataValue } from '../core/contracts.js';
import { templatePositions } from './extension-input.js';
import { readTemplateMetadata } from './template-metadata.js';

const BUILTINS = Object.freeze({
  default: { render: renderShell, bind: bindCassiopeiaShell, styles: ['../../../media/templates/site/cassiopeia/css/template.css'] },
  cassiopeia: { render: renderShell, bind: bindCassiopeiaShell, styles: ['../../../media/templates/site/cassiopeia/css/template.css'] },
  camap: { render: renderCamapShell, bind: bindCamapShell, styles: ['../../../media/templates/site/cassiopeia/css/template.css', '../../../media/templates/site/camap/css/template.css', '../../../media/templates/site/camap/css/layout.css', '../../../media/templates/site/camap/css/responsive.css'] }
});

function assetUrl(value, base, extension) {
  if (typeof value !== 'string' || !value.trim() || /[\s\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')
    || /%(?:25|2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value) || /^[a-z]+:\/\/[^/]*@/i.test(value)) {
    throw new TypeError('URL de recurso do template inválida.');
  }
  let path;
  try { path = decodeURIComponent(value.split(/[?#]/)[0]); } catch { throw new TypeError('URL de recurso do template inválida.'); }
  if (/[\s\\\u0000-\u0020\u007f]/.test(path) || /(?:^|\/)\.\.(?:\/|$)/.test(path)) throw new TypeError('URL de recurso do template inválida.');
  const url = new URL(value, base);
  const host = new URL(base);
  if (!['http:', 'https:', 'file:'].includes(url.protocol) || url.username || url.password || url.hash || !url.pathname.endsWith(extension)) {
    throw new TypeError('URL de recurso do template inválida.');
  }
  if (url.protocol !== host.protocol || url.origin !== host.origin || (url.protocol === 'file:' && (url.host || host.host))) {
    throw new TypeError('URL de recurso do template inválida: recurso deve pertencer ao próprio host.');
  }
  return url.href;
}

function templateRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Registro de template inválido.');
  return Object.fromEntries(['key', 'enabled', 'entryPointUrl', 'styles', 'positionsJson'].map((key) => [key, ownDataValue(value, key)]));
}

function stylesFor(row, builtin, base) {
  let styles = row?.styles;
  if (row && styles!==undefined && styles!==null && styles!=='') styles=readTemplateMetadata(row).styles;
  if (typeof styles === 'string' && styles.trim()) styles = JSON.parse(styles);
  if (styles === undefined || styles === null || styles === '') {
    return (builtin?.styles ?? []).map((path) => new URL(path, import.meta.url).href);
  }
  if (!Array.isArray(styles)) throw new TypeError('styles deve ser uma lista JSON de URLs CSS.');
  const urls = [];
  for (let index = 0; index < styles.length; index += 1) urls.push(assetUrl(ownDataValue(styles, String(index)), base, '.css'));
  return urls;
}

export function createTemplateRuntime({ importModule = (url) => import(url), documentRef } = {}) {
  const loaded = new Map();
  const ownedLinks = [];
  let currentStyles = '';

  async function resolve(key, records) {
    const rows = Array.isArray(records) ? records : records ? [records] : [];
    const selectedKey = (!Array.isArray(records) && ownDataValue(records, 'key')) || key;
    if (typeof selectedKey !== 'string') throw new TypeError('Chave de template inválida.');
    const selectedRow = Array.from({length:rows.length},(_,index)=>ownDataValue(rows,String(index))).find((item) => ownDataValue(item, 'key') === selectedKey);
    const row = selectedRow === undefined ? undefined : templateRow(selectedRow);
    if (row?.enabled === false) throw new TypeError('O template selecionado está desabilitado.');
    const builtin = Object.hasOwn(BUILTINS, selectedKey) ? BUILTINS[selectedKey] : undefined;
    if (!builtin && !row) throw new TypeError('Template selecionado não está registrado.');
    const base = documentRef?.baseURI ?? import.meta.url;
    const styles = stylesFor(row, builtin, base);
    if (builtin) return { key: selectedKey, render: builtin.render, bind: builtin.bind, styles, positions: Object.freeze([]) };
    const declared = row.positionsJson;
    if (Array.isArray(declared) && Object.getPrototypeOf(declared) !== Array.prototype) throw new TypeError('positions deve ser um array de dados.');
    // `component` is valid template metadata, never an assignable module slot.
    const positions = Object.freeze(declared === undefined || declared === null || declared === '' ? [] : JSON.parse(templatePositions(declared)).filter((position) => position !== 'component'));
    const url = assetUrl(row.entryPointUrl, base, '.js');
    if (!loaded.has(url)) loaded.set(url, importModule(url));
    const module = await loaded.get(url);
    const render = module.renderShell ?? module.default;
    if (typeof render !== 'function') throw new TypeError('Template deve exportar renderShell ou uma função default.');
    if (module.bindShell !== undefined && typeof module.bindShell !== 'function') throw new TypeError('bindShell deve ser uma função.');
    return { key: selectedKey, render, bind: module.bindShell, styles, positions, definitions:readTemplateMetadata(row).definitions };
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
