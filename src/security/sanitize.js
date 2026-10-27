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
  // Minimal safe subset for fixtures: strip executable elements and attributes.
  return String(value)
    .replace(/<\/?(?:script|style|iframe|object|embed|form)[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_m, a, b, c) => {
      const url = a ?? b ?? c ?? '#';
      return ` href="${safeUrl(url)}"`;
    });
}
