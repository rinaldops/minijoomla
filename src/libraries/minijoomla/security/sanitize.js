const BLOCKED_URL = /^(?:javascript|data|vbscript|file):/i;

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

export function safeUrl(value = '') {
  const url = String(value ?? '').trim();
  let parsed;
  try { parsed = new URL(url, 'https://minijoomla.invalid'); } catch { return '#'; }
  const protocol = parsed.protocol.toLowerCase();
  if (!url || BLOCKED_URL.test(url) || /[\u0000-\u0020\u007F]/.test(url) || parsed.username || parsed.password || url.startsWith('//') || url.includes('\\') || (!['http:', 'https:', 'mailto:'].includes(protocol) && !url.startsWith('/') && !url.startsWith('#'))) return '#';
  return escapeHtml(url);
}

// A narrow image-only CSS contract, not a general inline-style allowlist.
// TinyMCE image_advtab serializes hspace/vspace as paired pixel margins, and
// the image dialog's Width field / Advanced "Style" box as `width`/`float`.
// Each property below is validated against its own strict shape (enum for
// float, bounded px for width/margins) — nothing free-form like `position`,
// `background`, `calc()`, `var()` or `!important` can ever survive.
export function sanitizeImageMargins(value = '') {
  const margins = new Map();
  const sides = ['top', 'right', 'bottom', 'left'];
  const pixel = /^(?:0|(?:\d{1,3}(?:\.\d{1,2})?|\.\d{1,2})px)$/i;
  const widthPixel = /^(?:0|(?:\d{1,4}(?:\.\d{1,2})?|\.\d{1,2})px)$/i;
  let float = '';
  let width = '';
  for (const declaration of String(value).split(';')) {
    const trimmed = declaration.trim();

    const floatMatch = trimmed.match(/^float\s*:\s*(left|right|none)$/i);
    if (floatMatch) { float = floatMatch[1].toLowerCase(); continue; }

    const widthMatch = trimmed.match(/^width\s*:\s*(.+)$/i);
    if (widthMatch) {
      const token = widthMatch[1].trim();
      if (widthPixel.test(token) && parseFloat(token) <= 4000) width = `${parseFloat(token)}px`;
      continue;
    }

    const match = trimmed.match(/^(margin(?:-(?:top|right|bottom|left))?)\s*:\s*(.+)$/i);
    if (!match) continue;
    const name = match[1].toLowerCase();
    const tokens = match[2].trim().split(/\s+/);
    if (!tokens.length || tokens.length > (name === 'margin' ? 4 : 1)
      || tokens.some((token) => !pixel.test(token) || parseFloat(token) > 200)) continue;
    const normalized = tokens.map((token) => `${parseFloat(token)}px`);
    if (name === 'margin') {
      const [top, right = top, bottom = top, left = right] = normalized;
      [top, right, bottom, left].forEach((amount, index) => margins.set(sides[index], amount));
    } else margins.set(name.slice(7), normalized[0]);
  }
  const declarations = [];
  if (float) declarations.push(`float: ${float}`);
  if (width) declarations.push(`width: ${width}`);
  sides.filter((side) => margins.has(side)).forEach((side) => declarations.push(`margin-${side}: ${margins.get(side)}`));
  return declarations.join('; ');
}

const ALLOWED_TAGS = new Set([
  'p', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'sub', 'sup', 'small', 'mark', 'abbr', 'cite', 'q', 'kbd', 'code', 'pre',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'br', 'hr', 'a', 'img', 'figure', 'figcaption', 'blockquote', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
]);
const VOID_TAGS = new Set(['br', 'hr', 'img', 'col']);
const ALIGNABLE_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'td']);
const TAG = /<\/?([a-z][a-z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTRIBUTE = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const escapeText = (text) => text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Preserva entidades já escritas; aspas e sinais nunca saem crus de um atributo.
const escapeAttribute = (text) => text.replace(/&(?!#?\w+;)/g, '&amp;').replace(/["'<>]/g, (character) => escapeHtml(character));

// safeUrl já escapa a saída: decodifica o &amp; do HTML de origem para não escapá-lo duas vezes.
const unescapeAmp = (text) => text.replace(/&amp;/g, '&');

function sanitizeAttribute(tag, attribute, value) {
  if (attribute === 'class') return /^[\w -]{1,200}$/.test(value) ? value : null;
  if (attribute === 'title') return escapeAttribute(value);
  if (attribute === 'href') return tag === 'a' ? safeUrl(unescapeAmp(value)) : null;
  if (attribute === 'target') return tag === 'a' && value === '_blank' ? value : null;
  if (tag === 'img') {
    if (attribute === 'src') return safeUrl(unescapeAmp(value));
    if (attribute === 'alt') return escapeAttribute(value);
    if (attribute === 'width' || attribute === 'height') return /^\d{1,4}$/.test(value) ? value : null;
  }
  if (tag === 'th' || tag === 'td') {
    if (attribute === 'colspan' || attribute === 'rowspan') return /^\d{1,3}$/.test(value) ? value : null;
    if (attribute === 'scope') return ['col', 'row', 'colgroup', 'rowgroup'].includes(value) ? value : null;
  }
  if (attribute === 'style') {
    if (tag === 'img') return escapeHtml(sanitizeImageMargins(value)) || null;
    if (ALIGNABLE_TAGS.has(tag)) return value.match(/(?:^|;)\s*(text-align\s*:\s*(?:left|right|center|justify))\s*(?:;|$)/i)?.[1].replace(/\s*:\s*/, ': ').toLowerCase() ?? null;
  }
  return null;
}

function sanitizeTag(whole, rawName, rawAttributes) {
  const name = rawName.toLowerCase();
  if (!ALLOWED_TAGS.has(name)) return '';
  if (whole.startsWith('</')) return VOID_TAGS.has(name) ? '' : `</${name}>`;
  const attributes = [];
  for (const match of rawAttributes.matchAll(ATTRIBUTE)) {
    const attribute = match[1].toLowerCase();
    const value = sanitizeAttribute(name, attribute, match[2] ?? match[3] ?? match[4] ?? '');
    if (value !== null) attributes.push(`${attribute}="${value}"`);
  }
  if (attributes.some((item) => item.startsWith('target='))) attributes.push('rel="noopener noreferrer"');
  return `<${name}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`;
}

// Só sanitizeTag emite marcação; todo o resto vira texto escapado, de modo que
// remover uma tag nunca recompõe outra (`<<x>img onerror=...>`).
export function sanitizeHtml(value = '') {
  const source = String(value)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  let output = '';
  let cursor = 0;
  const open = [];
  for (const match of source.matchAll(TAG)) {
    output += escapeText(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const name = match[1].toLowerCase();
    if (match[0].startsWith('</') && ALLOWED_TAGS.has(name) && !VOID_TAGS.has(name)) {
      // Fechamento sem abertura correspondente é descartado; o que ficou aberto entre os dois fecha junto.
      const index = open.lastIndexOf(name);
      if (index >= 0) output += open.splice(index).reverse().map((item) => `</${item}>`).join('');
      continue;
    }
    const tag = sanitizeTag(match[0], match[1], match[2]);
    if (tag && !VOID_TAGS.has(name)) open.push(name);
    output += tag;
  }
  return output + escapeText(source.slice(cursor)) + open.reverse().map((item) => `</${item}>`).join('');
}
