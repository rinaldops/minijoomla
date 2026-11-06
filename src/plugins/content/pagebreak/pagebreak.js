/*
 * Equivalente ao plugin pagebreak do Joomla: `<hr class="system-pagebreak" title="..." alt="...">`
 * divide o texto em seções com título e sumário (ol). Sem JS. Se context.pageLink(n) existir,
 * só a página context.page (1-based) é emitida e o sumário aponta para pageLink; senão todas as
 * seções saem em sequência e o sumário usa âncoras #pagebreak-N. Ceiling: sanitizeHtml remove
 * `id`, então as âncoras só funcionam em hosts que as preservem; títulos ficam em <strong>.
 */
import { escapeHtml, safeUrl } from '../../../libraries/minijoomla/security/sanitize.js';

const HR = /<hr\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi; // aspas respeitadas: um `>` dentro de title não encerra a tag
const isBreak = (tag) => /\bclass\s*=\s*(?:"[^"]*\bsystem-pagebreak\b[^"]*"|'[^']*\bsystem-pagebreak\b[^']*')/i.test(tag);
const attr = (tag, name) => (new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag) ?? []).slice(1).find((v) => v !== undefined) ?? '';
// O título vem de um atributo HTML já escapado: decodifica antes de escapeHtml para não duplicar.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const plain = (value) => value.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ENTITIES[entity]).trim();

export function paginate(html = '', { page, pageLink } = {}) {
  const text = String(html);
  const breaks = [...text.matchAll(HR)].filter((match) => isBreak(match[0]));
  if (!breaks.length) return text;
  const sections = [{ title: plain(attr(breaks[0][0], 'alt')) || 'Introdução', body: text.slice(0, breaks[0].index) }];
  breaks.forEach((match, index) => {
    const title = plain(attr(match[0], 'title') || attr(match[0], 'alt')) || `Página ${index + 2}`;
    sections.push({ title, body: text.slice(match.index + match[0].length, breaks[index + 1]?.index ?? text.length) });
  });
  const paged = typeof pageLink === 'function';
  const current = Math.min(sections.length, Math.max(1, Math.trunc(Number(page)) || 1));
  const toc = `<ol>${sections.map((s, i) => `<li><a href="${safeUrl(paged ? pageLink(i + 1) : `#pagebreak-${i + 1}`)}">${escapeHtml(s.title)}</a></li>`).join('')}</ol>`;
  const shown = sections.map((s, i) => ({ ...s, n: i + 1 })).filter((s) => !paged || s.n === current);
  return toc + shown.map((s) => `<p id="pagebreak-${s.n}"><strong>${escapeHtml(s.title)}</strong></p>${s.body}`).join('');
}

export const pagebreakPlugin = {
  name: 'pagebreak', group: 'content',
  // card: listagens mostram só a introdução; sumário/paginação pertencem à página do artigo.
  events: { onContentPrepare: (text, context = {}) => (context.card ? text : paginate(text, context)) }
};
