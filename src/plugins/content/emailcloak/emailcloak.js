/*
 * Equivalente ao plugin emailcloak do Joomla, sem JavaScript inline: e-mails em texto viram
 * entidades numéricas (&#NN;) e o href de links mailto: é percent-encoded. Ceiling: protege
 * apenas de coletores ingênuos (regex sobre o HTML); parsers que decodificam entidades leem o
 * endereço. Não altera valores de atributos (alt, title...), só texto e href mailto.
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const entities = (text) => [...text].map((c) => `&#${c.codePointAt(0)};`).join('');
const percent = (text) => [...new TextEncoder().encode(text)].map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
const decode = (value) => { try { return decodeURIComponent(value); } catch { return value; } };

export function cloakEmails(html = '') {
  return String(html).split(/(<[^>]*>)/).map((part) => {
    if (!part.startsWith('<')) return part.replace(EMAIL, entities);
    return part.replace(/(\bhref\s*=\s*["']?)mailto:([^"'\s>?]+)/gi, (_, prefix, address) => `${prefix}mailto:${percent(decode(address))}`);
  }).join('');
}

export const emailcloakPlugin = {
  name: 'emailcloak', group: 'content',
  events: { onContentPrepare: (text) => cloakEmails(text) }
};
