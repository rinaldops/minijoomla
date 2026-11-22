/*
 * Achados visuais do baseline no painel administrativo.
 *
 * Estes casos existem porque a inspeção visual do painel (e não o markup
 * abstrato) apontou três defeitos que nenhum teste de comportamento pegava:
 *
 *   (2) a coluna Autor aparecia vazia e a coluna Data errada, e o cabeçalho
 *       "Autor" quebrava no meio ("Au/tor");
 *   (3) a coluna de contagem de artigos em Categorias/Tags saía estrangulada.
 *
 * A causa de (2) não era o mapeamento: `author` é campo real do artigo
 * (spmiddle-adapter.js mapeia, o repositório SPMIDDLE semeia "Author0"). O
 * que faltava era (a) a CLASSE de coluna no `th` — sem ela as regras de
 * largura valiam só para o `td` e o navegador espremia o cabeçalho — e
 * (b) a data, que usava `new Date(valor)` sobre uma data sem hora e por
 * isso recuava um dia ao ser exibida em America/Sao_Paulo (UTC-3).
 *
 * Os testes de fuso rodam em processo filho com TZ=America/Sao_Paulo: em
 * UTC a asserção passaria nos dois códigos e não provaria nada.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { renderArticlesTable } from '../src/administrator/components/com_content/tmpl/articles/default.js';
import { renderCategoriesTable } from '../src/administrator/components/com_categories/tmpl/categories/default.js';
import { renderTagsTable } from '../src/administrator/components/com_tags/tmpl/tags/default.js';
import { renderMediaFiles } from '../src/administrator/components/com_media/tmpl/media/default.js';
import { formatDate, parseLocalDate } from '../src/libraries/minijoomla/core/format.js';
import { toLocalDateTimeInput } from '../src/administrator/components/com_minijoomla/extension-pages.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const link = (path) => path;

function articleRow(overrides = {}) {
  return {
    id: 7,
    title: 'Chamada',
    alias: 'chamada',
    state: 'Published',
    featured: false,
    categoryId: 3,
    categoryTitle: 'Institucional',
    publishUp: '2026-01-01',
    author: 'Ana',
    ...overrides
  };
}

function articleTableHtml(overrides = {}) {
  return renderArticlesTable({ rows: [articleRow(overrides)], total: 1 }, { link });
}

/** Cabeçalhos da tabela, na ordem, com o atributo `class` de cada um. */
function headersOf(html) {
  const thead = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? '';
  return [...thead.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/g)].map((match) => {
    const attributes = match[1];
    const label = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return { label, className: attributes.match(/class="([^"]*)"/)?.[1] ?? '' };
  });
}

/**
 * Roda um trecho de código em processo filho com fuso fixo. Importa pelo
 * caminho absoluto do módulo para não depender do cwd do filho.
 */
function runInTimeZone(script, timeZone = 'America/Sao_Paulo') {
  const formatUrl = `file:///${resolve(root, 'src/libraries/minijoomla/core/format.js').replace(/\\/g, '/')}`;
  const program = `import(${JSON.stringify(formatUrl)}).then(async (format) => { ${script} }).catch((error) => { console.error(error); process.exit(1); });`;
  return execFileSync(process.execPath, ['-e', program], {
    cwd: root,
    env: { ...process.env, TZ: timeZone },
    encoding: 'utf8'
  }).trim();
}

/** Importa um módulo do admin já formatado para uso dentro de `runInTimeZone`. */
function moduleUrl(relativePath) {
  return `file:///${resolve(root, relativePath).replace(/\\/g, '/')}`;
}

// ---------------------------------------------------------------------------
// (2) Artigos — colunas Autor e Data
// ---------------------------------------------------------------------------

async function runArticleColumnPresentationTests() {
  const headers = headersOf(articleTableHtml());
  const byLabel = new Map(headers.map((header) => [header.label, header]));

  /*
   * A classe no `th` é o que faz a largura da coluna valer de fato: em
   * `table-layout: auto` o navegador ignora o `min-width` do `td` e recalcula
   * a coluna inteira, encolhendo o cabeçalho até quebrar a palavra.
   */
  for (const [label, expected] of [
    ['Autor', 'admin-col-author'],
    ['Categoria', 'admin-col-category'],
    ['Data', 'admin-col-publishUp'],
    ['Título', 'admin-col-title'],
    ['Alias', 'admin-col-alias']
  ]) {
    assert.ok(byLabel.has(label), `a tabela de artigos tem cabeçalho ${label}`);
    assert.match(
      byLabel.get(label).className,
      new RegExp(`(?:^|\\s)${expected}(?:\\s|$)`),
      `o cabeçalho ${label} carrega ${expected} para que a largura da coluna seja respeitada`
    );
  }

  // Autor é dado real do artigo, não coluna órfã: com valor, aparece.
  const withAuthor = articleTableHtml({ author: 'Ana' });
  assert.match(withAuthor, /<td class="admin-col-author">Ana<\/td>/, 'o autor do registro é exibido na coluna Autor');

  // Sem valor, o fallback é o travessão — nunca a string "undefined".
  const withoutAuthor = articleTableHtml({ author: undefined });
  assert.match(withoutAuthor, /<td class="admin-col-author">/, 'a célula de Autor é sempre renderizada');
  assert.ok(!/undefined/.test(withoutAuthor), 'a coluna Autor nao imprime undefined quando o dado falta');
  assert.ok(!/NaN/.test(withAuthor), 'a coluna Autor nao imprime NaN');

  /*
   * A data é o defeito mais traiçoeiro: `new Date('2026-01-01')` interpreta a
   * string sem hora como meia-noite UTC, e às UTC-3 o valor exibido era
   * 31/12/2025 — o ano anterior. O processo filho com TZ fixo garante que a
   * asserção falhe no código antigo.
   */
  const shifted = runInTimeZone('console.log(format.formatDate("2026-01-01"));');
  assert.equal(shifted, '01/01/2026', 'data sem hora nao recua um dia em fuso negativo (era 31/12/2025)');

  const yearEnd = runInTimeZone('console.log(format.formatDate("2026-12-31"));');
  assert.equal(yearEnd, '31/12/2026', 'a virada do ano tambem e preservada');

  // Um instante completo continua sendo convertido para o fuso local.
  const instant = runInTimeZone('console.log(format.formatDate("2026-06-15T12:30:00Z"));');
  assert.equal(instant, '15/06/2026', 'instantes com hora seguem exibidos no fuso do usuario');

  // E o mesmo vale para o caminho de edicao, que preenche datetime-local.
  const dtLocal = runInTimeZone(
    `const ext = await import(${JSON.stringify(moduleUrl('src/administrator/components/com_minijoomla/extension-pages.js'))}); console.log(ext.toLocalDateTimeInput("2026-01-01"));`
  );
  assert.equal(dtLocal, '2026-01-01T00:00', 'data sem hora nao preenche o campo de edicao com o dia anterior');

  // Contrato do parser compartilhado.
  assert.equal(parseLocalDate('lixo'), null, 'valor invalido vira null em vez de Invalid Date');
  assert.equal(parseLocalDate(''), null, 'string vazia vira null');
  assert.equal(parseLocalDate(null), null, 'null vira null');
  assert.equal(parseLocalDate(undefined), null, 'undefined vira null');
  assert.equal(formatDate('lixo'), '', 'valor invalido nao imprime texto de erro');
  const parsed = parseLocalDate('2026-03-09');
  assert.equal(parsed.getFullYear(), 2026, 'o parser usa os componentes locais do ano');
  assert.equal(parsed.getMonth(), 2, 'o parser usa os componentes locais do mes');
  assert.equal(parsed.getDate(), 9, 'o parser usa os componentes locais do dia');

  // Media usa a mesma regra: o defeito era o mesmo codigo duplicado.
  const media = renderMediaFiles([{ name: 'foto.png', size: 2048, modified: '2026-03-05', url: '/foto.png', isImage: true }]);
  assert.match(media, /<td class="admin-col-nowrap">05\/03\/2026<\/td>/, 'a midia usa a mesma formatacao de data sem deslocamento');

  console.log('ok - artigos: colunas Autor e Data com classe de coluna e data sem deslocamento de fuso');
}

// ---------------------------------------------------------------------------
// (3) Categorias e Tags — coluna de contagem
// ---------------------------------------------------------------------------

async function runCountColumnWidthTests() {
  const categoryHeaders = headersOf(
    renderCategoriesTable([{ id: 1, title: 'Institucional', alias: 'institucional', state: 'Published', depth: 0, counts: { Published: 2, Draft: 0, Archived: 0, Trashed: 0 } }], { link })
  );
  const tagHeaders = headersOf(
    renderTagsTable([{ id: 1, name: 'Destaque', alias: 'destaque', state: 'Published', depth: 0, counts: { Published: 3, Draft: 0, Archived: 0, Trashed: 0 } }], { link })
  );

  // As colunas de texto diferem entre as duas listas: Categorias usa "Título"
  // (o registro é uma categoria) e Tags usa "Nome" (o registro é uma tag).
  for (const [name, headers, textLabels] of [
    ['categorias', categoryHeaders, ['Título', 'Alias', 'Estado']],
    ['tags', tagHeaders, ['Nome', 'Alias', 'Estado']]
  ]) {
    const counts = headers.find((header) => header.label.startsWith('Artigos'));
    assert.ok(counts, `a tabela de ${name} tem a coluna de contagem`);
    assert.match(counts.className, /(?:^|\s)admin-col-count(?:\s|$)/, `a coluna de contagem de ${name} carrega admin-col-count`);

    // Toda coluna de texto tambem precisa da classe, senao a largura da
    // coluna de contagem e recalculada a partir de uma coluna sem regra.
    for (const label of textLabels) {
      const header = headers.find((candidate) => candidate.label === label);
      assert.ok(header, `a tabela de ${name} tem cabeçalho ${label}`);
      assert.match(header.className, /admin-col-/, `o cabeçalho ${label} de ${name} carrega classe de coluna`);
    }
  }

  /*
   * O rótulo acessível tem de descrever a coluna. Ele já foi o literal
   * "admin-col-count" por um desalinhamento de parâmetros do helper.
   */
  const countsLabel = (headers) => headers.find((header) => header.label.startsWith('Artigos')).label;
  assert.match(countsLabel(categoryHeaders), /Artigos \(publicados, despublicados, arquivados, lixeira\)/, 'o rotulo acessivel de Categorias descreve os estados');
  assert.match(countsLabel(tagHeaders), /Artigos com a tag/, 'o rotulo acessivel de Tags descreve a coluna');
  assert.ok(!/admin-col-count/.test(countsLabel(categoryHeaders)), 'o rotulo nao vaza o nome da classe');
  assert.ok(!/admin-col-count/.test(countsLabel(tagHeaders)), 'o rotulo de Tags nao vaza o nome da classe');
  assert.ok(!/\(\(/.test(countsLabel(categoryHeaders)), 'o rotulo nao sai com parenteses duplicados');

  /*
   * Em Tags o rótulo longo fica num span oculto e o visível é curto. O texto
   * visível precisa ser o curto — antes o span trazia a classe do CSS.
   */
  const tagCountsHtml = renderTagsTable([{ id: 1, name: 'Destaque', alias: 'destaque', state: 'Published', depth: 0, counts: { Published: 3 } }], { link });
  assert.match(tagCountsHtml, /<span class="visually-hidden">Artigos com a tag<\/span><span aria-hidden="true">Artigos<\/span>/, 'Tags mantem rotulo curto visivel e o descritivo oculto');

  /*
   * Nem todo agregado traz todos os estados. Quando a chave faltava, o badge e
   * o `aria-label` imprimiam o literal "undefined".
   */
  const sparseCategories = renderCategoriesTable([{ id: 1, title: 'I', alias: 'i', state: 'Published', depth: 0, counts: { Published: 2 } }], { link });
  assert.ok(!/undefined/.test(sparseCategories), 'a contagem por estado nao imprime undefined quando o agregado omite a chave');
  assert.match(sparseCategories, /aria-label="0 artigo\(s\): Despublicado"/, 'estado sem artigos e contado como zero');

  const sparseTags = renderTagsTable([{ id: 1, name: 'D', alias: 'd', state: 'Published', depth: 0, counts: {} }], { link });
  assert.ok(!/undefined/.test(sparseTags), 'a contagem de Tags nao imprime undefined quando o agregado omite a chave');
  assert.match(sparseTags, /aria-label="0 artigo\(s\) com a tag D"/, 'tag sem artigos e contada como zero');

  console.log('ok - categorias e tags: coluna de contagem com classe, largura e rotulo acessivel');
}

// ---------------------------------------------------------------------------
// CSS — as regras que sustentam (2) e (3)
// ---------------------------------------------------------------------------

function runStylesheetTests() {
  const css = readFileSync(resolve(root, 'src/media/templates/administrator/atum/css/template.css'), 'utf8');

  /*
   * Um mesmo seletor pode aparecer mais de uma vez na folha (o cabeçalho tem
   * uma regra de cor e outra de quebra de linha), e regras com vários
   * seletores separados por vírgula valem para o último `th` também. Por isso
   * o teste procura cada seletor como ALTERNATIVA dentro do bloco, não como o
   * seletor inteiro.
   */
  const declarations = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[},])\\s*[^{}]*?${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, 'g');
    return [...css.matchAll(pattern)].map((match) => match[1]).join(';');
  };

  /*
   * O `th` precisa das regras: aplicar so no `td` foi exatamente o que
   * produziu "Au/tor" e a coluna de contagem estrangulada.
   */
  const headerBase = declarations('.admin-list thead th');
  assert.ok(headerBase, 'existe regra para o cabecalho da tabela administrativa');
  assert.match(headerBase, /white-space:\s*nowrap/, 'o cabecalho nao quebra por padrao');

  const countHeader = declarations('.admin-list thead th.admin-col-count');
  assert.ok(countHeader, 'existe regra de largura para o cabecalho de contagem');
  assert.match(countHeader, /min-width:\s*7rem/, 'o cabecalho de contagem reserva largura propria');

  // O `th` das colunas de texto volta a poder quebrar, senao um rótulo longo
  // empurraria a tabela inteira.
  for (const column of ['title', 'alias', 'category', 'author']) {
    const body = declarations(`.admin-list thead th.admin-col-${column}`);
    assert.ok(body, `existe regra de quebra para a coluna ${column} no cabecalho`);
    assert.match(body, /white-space:\s*normal/, `a coluna ${column} pode quebrar em varias linhas`);
  }

  console.log('ok - css: regras de cabecalho cobrem quebra de rotulo e largura da contagem');
}

export async function runVisualFindingsTests() {
  await runArticleColumnPresentationTests();
  await runCountColumnWidthTests();
  runStylesheetTests();
  console.log('ok - achados visuais do baseline');
}