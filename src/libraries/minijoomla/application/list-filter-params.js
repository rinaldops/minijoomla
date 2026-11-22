/*
 * Codec dos filtros de coluna tipo Excel, compartilhado entre o SERVIÇO
 * (src/libraries/minijoomla/application/admin-service.js, que aplica o
 * filtro) e a UI (src/administrator/components/com_minijoomla/column-filter.js,
 * que monta o painel). Fica na camada de biblioteca de propósito: o
 * serviço não pode depender do administrador, e as duas pontas precisam
 * ler o MESMO formato — se divergirem, o painel mostra uma coisa e o
 * filtro aplica outra.
 *
 * Formato: um valor sem `~` é um literal único (compatível com os links
 * antigos, inclusive contendo vírgulas). A lista multi-valor usa o
 * envelope `~m:` com itens separados por vírgula; dentro de um item, `\`
 * vira `\\`, `,` vira `\,` e um `~` inicial vira `\~`. O item vazio é o
 * token `~0` e o texto literal `__vazio__` é escapado como `\__vazio__`
 * para não colidir com o marcador de vazio.
 */
export const MULTI_PREFIX = '~m:';
export const EMPTY_TOKEN = '~0';

/*
 * Marcador de vazio usado como VALOR de faceta e de item de conjunto.
 * `null`, `undefined` e string vazia são vazio; `0` e `false` não são
 * (são valores reais e são filtrados como qualquer outro).
 */
export const EMPTY_VALUE = '__vazio__';

export function isEmptyValue(value) {
  return value === undefined || value === null || value === '';
}

export function normalizeFacetValue(value) {
  return isEmptyValue(value) ? EMPTY_VALUE : String(value);
}

function escapeItem(item) {
  const text = String(item);
  if (text === '') return EMPTY_TOKEN;
  const escaped = text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/^~/, '\\~');
  // O texto literal `__vazio__` precisa continuar significando o texto, e
  // não o vazio, quando volta pelo codec.
  return escaped === EMPTY_VALUE ? `\\${escaped}` : escaped;
}

function unescapeItem(item) {
  if (item === EMPTY_TOKEN) return '';
  if (item === `\\${EMPTY_VALUE}`) return EMPTY_VALUE;
  let out = '';
  for (let index = 0; index < item.length; index += 1) {
    const char = item[index];
    if (char === '\\' && index + 1 < item.length) { out += item[index + 1]; index += 1; continue; }
    out += char;
  }
  return out;
}

/*
 * Separa os itens SOMENTE nas vírgulas não escapadas. Um `\` no fim da
 * string é literal: não há o que escapar depois dele.
 */
function splitItems(body) {
  const items = [];
  let current = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '\\' && index + 1 < body.length) { current += char + body[index + 1]; index += 1; continue; }
    if (char === ',') { items.push(current); current = ''; continue; }
    current += char;
  }
  items.push(current);
  return items;
}

/*
 * Valor cru da URL -> lista de valores selecionados. Sem `~m:` o valor é
 * um legado escalar e vira uma lista de um item: é o que preserva as URLs
 * de 0.17.14 com `A,B` como valor único.
 */
export function parseMulti(raw) {
  if (raw === undefined || raw === null || raw === '') return [];
  const text = String(raw);
  if (!text.startsWith(MULTI_PREFIX)) return [text];
  const body = text.slice(MULTI_PREFIX.length);
  if (body === '') return [];
  // `splitItems` nunca devolve item vazio para uma vírgula dupla (`a,,b`):
  // o item vazio é sempre o token `~0`, e por isso NÃO filtramos o
  // resultado — um filtro aqui apagaria o vazio que o menu selecionou.
  return splitItems(body).map(unescapeItem);
}

/*
 * Lista de valores -> valor cru da URL. Um único valor que não comece com
 * `~` continua saindo no formato legado (é o que mantém os links de
 * 0.17.14 válidos); qualquer outra situação — dois ou mais valores, ou um
 * valor que começa com `~` — sai no envelope.
 *
 * `multiIsExact` (Categoria) força o envelope mesmo com um valor só,
 * porque ali o conjunto é EXATO e não pode ser confundido com o valor
 * simples que expande descendentes.
 */
export function serializeMulti(values, { multiIsExact = false } = {}) {
  const list = (Array.isArray(values) ? values : [values]).map((value) => (value === undefined || value === null ? '' : String(value)));
  // `''` é o vazio SELECIONADO (`(Vazias)`): é um valor de filtro real e não
  // pode ser descartado. A lista só é considerada vazia quando não há item
  // nenhum.
  if (!list.length) return '';
  if (list.length === 1 && !multiIsExact && list[0] !== '' && !list[0].startsWith('~') && list[0] !== EMPTY_VALUE) return list[0];
  return `${MULTI_PREFIX}${list.map(escapeItem).join(',')}`;
}

/*
 * Facetas de coluna: para cada dimensão, as opções que o menu deve
 * oferecer COM a contagem de linhas, considerando todos os outros
 * filtros ativos mas ignorando o da própria dimensão — senão marcar um
 * valor apagaria os demais do menu e a seleção só poderia restringir,
 * nunca ampliar. `matches` deixa o serviço excluir o que não é da
 * listagem (ex.: lixeira em Artigos).
 */
export function buildColumnFacets(rows, dimensions, params = {}, { matches = () => true } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const facets = {};
  for (const dimension of dimensions) {
    const active = new Set(parseMulti(params[dimension.key]).map((value) => (value === '' ? EMPTY_VALUE : value)));
    const others = dimensions
      .filter((other) => other.key !== dimension.key && other.reads)
      .map((other) => ({ key: other.key, reads: other.reads, values: new Set(parseMulti(params[other.key]).map((value) => (value === '' ? EMPTY_VALUE : value))) }))
      .filter((other) => other.values.size > 0);
    const counts = new Map();
    for (const row of list) {
      if (!matches(row)) continue;
      if (others.some((other) => !other.values.has(normalizeFacetValue(other.reads(row))))) continue;
      counts.set(normalizeFacetValue(dimension.reads(row)), (counts.get(normalizeFacetValue(dimension.reads(row))) ?? 0) + 1);
    }
    // O valor escolhido precisa continuar presente para poder ser
    // desmarcado, mesmo que tenha ficado com zero linhas.
    for (const value of active) if (!counts.has(value)) counts.set(value, 0);
    facets[dimension.key] = [...counts.entries()]
      .map(([value, count]) => ({ value, label: value === EMPTY_VALUE ? '(Vazias)' : value, count, empty: value === EMPTY_VALUE }))
      .sort((a, b) => (a.empty === b.empty ? a.label.localeCompare(b.label, 'pt-BR') : a.empty ? 1 : -1));
  }
  return facets;
}