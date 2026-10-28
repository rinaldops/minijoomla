const BLOCKED_URL = /^(?:javascript|data|vbscript|file):/i;

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

export function safeUrl(value = '') {
  const url = String(value).trim();
  let parsed;
  try { parsed = new URL(url, 'https://minijoomla.invalid'); } catch { return '#'; }
  const protocol = parsed.protocol.toLowerCase();
  if (!url || BLOCKED_URL.test(url) || /[\u0000-\u001F]/.test(url) || parsed.username || parsed.password || (!['http:', 'https:', 'mailto:'].includes(protocol) && !url.startsWith('/') && !url.startsWith('#'))) return '#';
  return escapeHtml(url);
}

export function sanitizeHtml(value = '') {
  const allowed = new Set(['p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br', 'a', 'img']);
  const withoutExecutableBlocks = String(value).replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--([\s\S]*?)-->/g, '');
  return withoutExecutableBlocks.replace(/<\/?([a-z][a-z0-9-]*)([^>]*)>/gi, (whole, rawName, rawAttributes) => {
    const name = rawName.toLowerCase();
    if (!allowed.has(name)) return '';
    if (whole.startsWith('</')) return `</${name}>`;
    if (name === 'br') return '<br>';
    const attributes = [];
    for (const match of rawAttributes.matchAll(/([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const attribute = match[1].toLowerCase();
      if (!['href', 'src', 'alt'].includes(attribute)) continue;
      const content = attribute === 'alt' ? escapeHtml(match[2] ?? match[3] ?? match[4] ?? '') : safeUrl(match[2] ?? match[3] ?? match[4] ?? '');
      attributes.push(`${attribute}="${content}"`);
    }
    return `<${name}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`;
  });
}
