import assert from 'node:assert/strict';
import {
  CANONICAL_COLUMNS,
  columnsForDomain,
  canonicalKey,
  canonicalizeParams,
  parseMulti,
  serializeMulti,
  buildColumnFacets,
  countsByValue,
  isEmptyValue,
  EMPTY_VALUE,
  MULTI_PREFIX,
  URL_LENGTH_LIMIT,
  urlFitsLimit,
  renderColumnFilterPanel,
  bindColumnFilters,
  placePanel
} from '../src/administrator/components/com_minijoomla/column-filter.js';
import { Router } from '../src/libraries/minijoomla/core/router.js';

/*
 * Núcleo do filtro por coluna: tabela de parâmetros canônicos, codec do
 * formato múltiplo, agregador de facetas e o contrato de seletores entre o
 * HTML do painel e o ligador.
 *
 * O que este suite prova e por que cada prova existe:
 *  - linhas da tabela: o nome que o SERVIÇO lê (`state`, `title`, ...) é a
 *    chave canônica, e as formas `col_<campo>` da 0.17.14 continuam válidas
 *    como entrada;
 *  - codec: ida e volta pelo caminho REAL (`Router.link` -> `Router.parse`
 *    -> `parseMulti`), porque é aí que a vírgula literal de um valor antigo
 *    ("Silva, Ana") se confundiria com um separador;
 *  - facetas: a contagem de uma coluna enxerga os filtros das OUTRAS
 *    colunas e ignora o da própria (senão a lista só ofereceria o que já
 *    está selecionado);
 *  - seletores: todo `[data-colfilter-*]` que o ligador procura existe no
 *    HTML que o renderizador emite. Este é o defeito que chegou à produção
 *    na 0.17.14: o `<ul>` saía sem `data-colfilter-menu`, o ligador recebia
 *    `null` e saía em silêncio.
 */

function selectorsUsedByBinder() {
  const source = bindColumnFilters.toString();
  const found = new Set();
  for (const match of source.matchAll(/\[(data-colfilter-[a-z-]+)\]/g)) found.add(match[1]);
  return [...found];
}

function assertSelectorsPresent(html, context, { except = [] } = {}) {
  const used = selectorsUsedByBinder();
  const present = new Set([...String(html).matchAll(/(data-colfilter-[a-z-]+)/g)].map((match) => match[1]));
  const missing = used.filter((name) => !present.has(name) && !except.includes(name));
  assert.deepEqual(missing, [], `${context}: seletores sem elemento correspondente no HTML`);
}

export async function runColumnFilterCoreTests() {
  // --- linhas da tabela canônica -----------------------------------------
  // O contrato de Artigos é fechado: as oito colunas filtráveis, na ordem em
  // que a listagem as oferece. Um `>= 7` deixaria passar a perda silenciosa de
  // uma coluna (foi assim que `author` e `publishUp` sumiram sem quebrar o teste).
  assert.deepEqual(
    columnsForDomain('articles').map((entry) => entry.key),
    ['state', 'title', 'alias', 'categoryId', 'author', 'publishUp', 'featured', 'id'],
    'Artigos precisam de todas as colunas filtráveis, na ordem canônica'
  );
  for (const [domain, columns] of Object.entries(CANONICAL_COLUMNS)) {
    for (const entry of columns) {
      assert.equal(canonicalKey(domain, entry.key), entry.key, `${domain}/${entry.key}: a chave canônica resolve nela mesma`);
      for (const alias of entry.aliases) {
        assert.equal(canonicalKey(domain, alias), entry.key, `${domain}: alias ${alias} -> ${entry.key}`);
      }
      assert.notEqual(canonicalKey(domain, entry.key), undefined);
    }
  }
  // Chave desconhecida passa intacta: não inventamos canônica para o que o
  // serviço não lê.
  assert.equal(canonicalKey('articles', 'qualquer'), 'qualquer');

  // Aliases reais da 0.17.14 continuam chegando no serviço.
  assert.equal(canonicalKey('articles', 'col_state'), 'state');
  assert.equal(canonicalKey('articles', 'col_category'), 'categoryId');
  assert.equal(canonicalKey('articles', 'col_categoryId'), 'categoryId');
  assert.equal(canonicalKey('categories', 'col_title'), 'title');

  // Canônica vence o alias quando os dois vêm na mesma query.
  const merged = canonicalizeParams('articles', { col_state: 'Published', state: 'Trashed' });
  assert.equal(merged.state, 'Trashed');
  assert.equal(merged.col_state, undefined, 'o alias precisa ser descartado, não duplicado');

  // Vazio não vira parâmetro (nem na URL nem na memória).
  const sparse = canonicalizeParams('articles', { col_title: '', col_alias: null, col_author: undefined, col_featured: '1' });
  assert.deepEqual(sparse, { featured: '1' });

  // --- codec: ida e volta pelo caminho real ------------------------------
  const router = new Router();
  const roundTrip = (values, options) => {
    const raw = serializeMulti(values, options);
    const href = router.link('/artigos', { title: raw });
    return parseMulti(router.parse(href).params.title);
  };

  // Legado: um valor sem `~` continua sendo exatamente um valor, mesmo com
  // vírgula dentro — é o caso "Silva, Ana" gravado pela 0.17.14.
  assert.deepEqual(parseMulti('Publicado'), ['Publicado']);
  assert.deepEqual(parseMulti('Silva, Ana'), ['Silva, Ana']);
  assert.deepEqual(roundTrip(['Silva, Ana']), ['Silva, Ana']);

  // Múltiplos valores.
  assert.deepEqual(roundTrip(['Publicado', 'Despublicado']), ['Publicado', 'Despublicado']);
  assert.deepEqual(roundTrip(['A, B', 'C\\D']), ['A, B', 'C\\D']);

  // Barra no fim é literal.
  assert.deepEqual(roundTrip(['termina\\']), ['termina\\']);

  // Acentos sobrevivem.
  assert.deepEqual(roundTrip(['Publicação', 'Não']), ['Publicação', 'Não']);

  // O envelope só aparece quando é necessário.
  assert.equal(serializeMulti(['Publicado']), 'Publicado');
  assert.ok(serializeMulti(['Publicado', 'Arquivado']).startsWith(MULTI_PREFIX));
  assert.ok(serializeMulti(['~inicio']).startsWith(MULTI_PREFIX), 'valor que começa com ~ precisa do envelope');

  // Categoria: o conjunto é EXATO, então o envelope é obrigatório mesmo com
  // um valor só.
  assert.equal(serializeMulti(['13'], { multiIsExact: true }), `${MULTI_PREFIX}13`);
  assert.deepEqual(roundTrip(['13'], { multiIsExact: true }), ['13']);

  // Item vazio e o texto literal `__vazio__`.
  assert.deepEqual(roundTrip(['A', '']), ['A', '']);
  assert.deepEqual(roundTrip([EMPTY_VALUE]), [EMPTY_VALUE]);
  assert.notDeepEqual(roundTrip([EMPTY_VALUE]), roundTrip(['']), 'o vazio e o texto __vazio__ não podem se confundir');

  // Muitos valores continuam reversíveis.
  const many = Array.from({ length: 500 }, (_, index) => `v${index}`);
  assert.deepEqual(roundTrip(many), many);

  // O limite é explícito: não descartamos valores em silêncio.
  assert.equal(urlFitsLimit('#/artigos?title=' + 'a'.repeat(URL_LENGTH_LIMIT)), false);
  assert.equal(urlFitsLimit('#/artigos?title=curto'), true);

  // --- vazio: só null, undefined e '' contam -----------------------------
  assert.equal(isEmptyValue(''), true);
  assert.equal(isEmptyValue(null), true);
  assert.equal(isEmptyValue(undefined), true);
  assert.equal(isEmptyValue(0), false, '0 é valor real');
  assert.equal(isEmptyValue(false), false, 'false é valor real');

  // --- facetas -----------------------------------------------------------
  const rows = [
    { id: 1, state: 'Published', author: 'Ana', publishUp: '2026-11-04T10:00:00' },
    { id: 2, state: 'Published', author: 'Ana', publishUp: '2026-11-20T10:00:00' },
    { id: 3, state: 'Trashed', author: 'Bruno', publishUp: '2026-12-01T10:00:00' },
    { id: 4, state: 'Published', author: 'Bruno', publishUp: null },
    { id: 5, state: 'Archived', author: null, publishUp: '2026-11-15T10:00:00' }
  ];
  const dimensions = [
    { column: 'state', key: 'state', reads: (row) => row.state },
    { column: 'author', key: 'author', reads: (row) => row.author },
    { column: 'publishUp', key: 'publishUp', reads: (row) => row.publishUp }
  ];
  // O MESMO predicado da listagem (Adendo 3, 3.2): aplicado com a coluna da
  // vez excluída. Sem ele as facetas só agregam e a contagem de uma coluna
  // não fecha com o total da lista.
  const passesFor = (params) => (row, skipKey) => dimensions.every((dimension) => {
    if (dimension.key === skipKey) return true;
    const active = parseMulti(params[dimension.key]);
    if (!active.length) return true;
    const raw = row[dimension.key];
    const value = raw === null || raw === undefined || raw === '' ? EMPTY_VALUE : String(raw);
    return active.includes(value);
  });

  // Sem filtro: contagem cheia, vazio por último.
  const all = buildColumnFacets(rows, dimensions, {}, { passes: passesFor({}) });
  assert.deepEqual(all.state.map((option) => option.value), ['Archived', 'Published', 'Trashed']);
  assert.equal(all.state.find((option) => option.value === 'Published').count, 3);
  assert.equal(all.author[all.author.length - 1].value, EMPTY_VALUE, '(Vazias) vai por último');

  // O filtro de AUTOR não restringe a própria lista de autores, mas
  // restringe a de estados.
  const byAuthor = buildColumnFacets(rows, dimensions, { author: 'Ana' }, { passes: passesFor({ author: 'Ana' }) });
  assert.deepEqual(byAuthor.state.map((option) => option.value), ['Published']);
  assert.equal(byAuthor.author.length, 3, 'a coluna do próprio filtro continua oferecendo todas as opções, inclusive (Vazias)');

  // Valor selecionado com contagem 0 continua na lista (senão a seleção
  // desapareceria ao navegar).
  const stale = buildColumnFacets(rows, dimensions, { state: 'Published', author: 'Bruno' }, { passes: passesFor({ state: 'Published', author: 'Bruno' }) });
  // A faceta de `state` IGNORA o filtro de `state` (senão não haveria como
  // trocar de valor), mas respeita o filtro de `author`: só sobra a linha 4
  // (Published) e a linha 3 (Trashed) entre as de Bruno.
  assert.deepEqual(stale.state.map((option) => option.value), ['Published', 'Trashed']);
  assert.equal(stale.state.find((option) => option.value === 'Published').count, 1, 'contagem respeita o filtro de autor');
  assert.equal(stale.state.find((option) => option.value === 'Trashed').count, 1);
  // A faceta de `author` ignora o próprio filtro e enxerga o de `state`.
  assert.deepEqual(stale.author.map((option) => option.value), ['Ana', 'Bruno']);

  // Contagem por valor com leitura customizada.
  const counts = countsByValue(rows, (row) => row.author);
  assert.equal(counts.get('Ana'), 2);
  assert.equal(counts.get(EMPTY_VALUE), 1);

  // --- contrato de seletores --------------------------------------------
  const panelHtml = renderColumnFilterPanel({
    key: 'state',
    column: 'state',
    label: 'Estado',
    values: ['Published'],
    options: [
      { value: 'Published', label: 'Publicado', count: 3 },
      { value: 'Trashed', label: 'Na lixeira', count: 1 }
    ],
    sortActions: [{ key: 'title', dir: 'asc', label: 'Título' }]
  }, 0);
  // O gatilho do menu vive no cabeçalho da tabela (render-list.js), não no
  // painel: aqui só exigimos os seletores que o próprio painel emite.
  assertSelectorsPresent(panelHtml, 'painel da coluna', { except: ['data-colfilter-toggle'] });

  // O botão é emitido pelo módulo do núcleo? Não: ele vive em
  // render-list.js. O contrato é que o painel e o ligador falem a mesma
  // língua, e é isso que o teste acima garante.
  assert.ok(panelHtml.includes('aria-modal="false"'), 'o painel é não modal');
  assert.ok(panelHtml.includes('role="dialog"'));
  assert.ok(panelHtml.includes('value="Published" checked'), 'a seleção atual vem marcada');
}

/*
 * Posicionamento do painel (adendo 3, secao 3.4). O contrato e tabelado em
 * T1..T5 e vale a pena provar cada linha: o painel ja apareceu fora da tela
 * quando o botao estava perto da borda direita ou quando a pagina estava
 * rolada. Todas as medidas de entrada estao em coordenadas de JANELA; o
 * retorno e convertido para coordenadas da CAMADA no final.
 */
export async function runPanelPlacementTests() {
  const VIEWPORT = { left: 0, top: 0, width: 1920, height: 1080 };
  const PANEL = { width: 288, height: 420 };
  const BUTTON = { width: 24, height: 24 };

  const cases = [
    {
      name: 'T1 cabecalho no topo: abre acima',
      container: { left: 0, top: 150 },
      button: { left: 900, top: 700 },
      viewport: VIEWPORT,
      expected: { openAbove: true, left: 900, top: 126, maxHeight: 688 }
    },
    {
      name: 'T2 pagina rolada para cima: abre abaixo',
      container: { left: 0, top: -600 },
      button: { left: 900, top: 300 },
      viewport: VIEWPORT,
      expected: { openAbove: false, left: 900, top: 928, maxHeight: 744 }
    },
    {
      name: 'T3 botao colado na borda direita: encosta no limite',
      container: { left: 0, top: 150 },
      button: { left: 1880, top: 300 },
      viewport: VIEWPORT,
      expected: { openAbove: false, left: 1616, top: 178, maxHeight: 744 }
    },
    {
      name: 'T4 nenhum lado cabe: ocupa o lado com mais espaco',
      container: { left: 0, top: 0 },
      button: { left: 900, top: 280 },
      viewport: { left: 0, top: 0, width: 1920, height: 600 },
      expected: { openAbove: false, left: 900, top: 308, maxHeight: 284 }
    },
    {
      name: 'T5 raiz deslocada: converte para coordenadas da camada',
      container: { left: 300, top: 150 },
      button: { left: 1700, top: 300 },
      viewport: VIEWPORT,
      expected: { openAbove: false, left: 1136, top: 178, maxHeight: 744 }
    }
  ];

  for (const current of cases) {
    const result = placePanel(
      { ...current.button, ...BUTTON },
      PANEL,
      current.container,
      current.viewport
    );
    assert.equal(result.openAbove, current.expected.openAbove, `${current.name}: lado de abertura`);
    assert.equal(result.left, current.expected.left, `${current.name}: left`);
    assert.equal(result.top, current.expected.top, `${current.name}: top`);
    assert.equal(result.maxHeight, current.expected.maxHeight, `${current.name}: maxHeight`);
    // A largura nunca passa da janela menos as duas margens.
    assert.ok(result.width <= current.viewport.width - 16, `${current.name}: largura dentro da janela`);
    // O topo convertido, somado ao deslocamento da camada, volta ao espaco
    // de janela esperado: prova de que a conversao foi feita, e nao apenas
    // de que os numeros batem por coincidencia.
    const topInWindow = result.top + current.container.top;
    // A altura realmente ocupada e `min(panel.height, maxHeight)`: em T1 sobra
    // espaco (688 > 420) e o painel usa apenas 420, mas em T4 ele e cortado.
    // Comparar com `maxHeight` daria um falso negativo, porque `maxHeight` e o
    // ESPACO disponivel, nao a altura ocupada.
    const usedHeight = Math.min(PANEL.height, result.maxHeight);
    if (result.openAbove) {
      assert.equal(topInWindow + usedHeight, current.button.top - 4, `${current.name}: painel acima termina no offset do botao`);
    } else {
      assert.equal(topInWindow, current.button.top + BUTTON.height + 4, `${current.name}: painel abaixo comeca no offset do botao`);
    }
  }
}