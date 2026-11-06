import assert from 'node:assert/strict';
import { analyzeArticleAccessibility, ACCESSIBILITY_SEVERITY } from '../src/administrator/components/com_minijoomla/article-accessibility.js';

function issuesOf(result, rule) {
  return result.issues.filter((issue) => issue.rule === rule);
}

export async function runArticleAccessibilityTests() {
  // 1. HTML sem nenhum problema conhecido -> nenhuma issue, nenhum sinalizador ativo.
  const clean = analyzeArticleAccessibility('<p>Texto <a href="https://exemplo.com">link valido</a> com <img src="a.png" alt="descricao"> e <h2>Titulo</h2><h3>Subtitulo</h3>.</p>');
  assert.deepEqual(clean.issues, []);
  assert.equal(clean.errorCount, 0);
  assert.equal(clean.warningCount, 0);
  assert.equal(clean.noticeCount, 0);
  assert.equal(clean.hasErrors, false);
  assert.equal(clean.hasWarnings, false);
  assert.equal(clean.hasNotices, false);

  // Generic link names are informational unless aria-label/title gives a better name.
  const genericLinks = analyzeArticleAccessibility(
    '<a href="/a">Clique aqui</a><a href="/b">Read more</a>' +
    '<a href="/c" aria-label="Ver catalogo">Clique aqui</a>' +
    '<a href="/d" title="Detalhes do produto">Leia mais</a>'
  );
  assert.equal(issuesOf(genericLinks, 'link-generic-text').length, 2);
  assert.equal(genericLinks.noticeCount, 2);
  const encodedNames = analyzeArticleAccessibility('<a href="/a">Clique&#32;aqui!</a><a href="/b">read&nbsp;more</a><a href="/c"><img alt="Leia mais"></a><a href="/d" aria-label="Click here">A descriptive visible label</a>');
  assert.equal(issuesOf(encodedNames, 'link-generic-text').length, 4, 'numeric entities, image alternatives and aria-label participate in the heuristic name');

  // 2. Imagem sem atributo "alt" -> error; imagem com alt="" (decorativa, intencional) nao e reportada.
  const images = analyzeArticleAccessibility('<img src="a.png"><img src="b.png" alt=""><img src="c.png" alt="legenda">');
  const imageIssues = issuesOf(images, 'image-missing-alt');
  assert.equal(imageIssues.length, 1);
  assert.equal(imageIssues[0].severity, ACCESSIBILITY_SEVERITY.ERROR);
  assert.equal(images.hasErrors, true);

  // 3. Link sem href -> warning; link com href vazio tambem conta como sem href.
  const linksWithoutHref = analyzeArticleAccessibility('<a>sem href nenhum</a><a href="">href vazio</a><a href="https://exemplo.com">ok</a>');
  const hrefIssues = issuesOf(linksWithoutHref, 'link-missing-href');
  assert.equal(hrefIssues.length, 2);
  assert.equal(hrefIssues[0].severity, ACCESSIBILITY_SEVERITY.WARNING);

  // 4. Link sem nome estimado -> error; aria-label, title e alternativas de imagens evitam falsos vazios.
  const linkTexts = analyzeArticleAccessibility(
    '<a href="https://a.com"></a>' + // sem nada -> error
    '<a href="https://b.com" aria-label="Abrir pagina B"></a>' + // aria-label -> ok
    '<a href="https://c.com" title="Pagina C"></a>' + // title -> ok
    '<a href="https://d.com"><img src="icone.png" alt="Pagina D"></a>' + // alt da imagem interna -> ok
    '<a href="https://e.com">Pagina E</a>' // texto visivel -> ok
  );
  const textIssues = issuesOf(linkTexts, 'link-empty-text');
  assert.equal(textIssues.length, 1);
  assert.equal(textIssues[0].severity, ACCESSIBILITY_SEVERITY.ERROR);

  // 5. Heading pulando nivel (h2 -> h4) -> warning; sequencia correta (h2 -> h3) e retrocesso (h4 -> h2) nao sao reportados.
  const headingSkip = analyzeArticleAccessibility('<h2>A</h2><h4>B</h4><h3>C</h3><h2>D</h2>');
  const headingIssues = issuesOf(headingSkip, 'heading-skipped');
  assert.equal(headingIssues.length, 1);
  assert.equal(headingIssues[0].severity, ACCESSIBILITY_SEVERITY.WARNING);
  assert.match(headingIssues[0].message, /<h2>.*<h4>/);

  const emptyHeadings = analyzeArticleAccessibility('<H2> &nbsp; </H2><h3><!-- comment --></h3><h4>Visivel</h4>');
  assert.equal(issuesOf(emptyHeadings, 'heading-empty').length, 2);
  assert.equal(emptyHeadings.warningCount, 2);
  const namedSpaces = ['nbsp', 'NonBreakingSpace', 'ensp', 'emsp', 'emsp13', 'emsp14', 'numsp', 'puncsp', 'thinsp', 'ThinSpace', 'hairsp', 'VeryThinSpace', 'MediumSpace', 'ThickSpace', 'Tab', 'NewLine', 'NoBreak', 'ZeroWidthSpace', 'NegativeVeryThinSpace', 'NegativeThinSpace', 'NegativeMediumSpace', 'NegativeThickSpace', 'zwnj', 'zwj'];
  for (const whitespace of [...namedSpaces.map((name) => `&${name};`), '&#32;', '&#x20;', '\u200b', '&#8203;']) {
    const blank = analyzeArticleAccessibility(`<h2>${whitespace}</h2><a href="/x">${whitespace}</a><a href="/image"><img alt="${whitespace}"></a>`);
    assert.equal(issuesOf(blank, 'heading-empty').length, 1, whitespace);
    assert.equal(issuesOf(blank, 'link-empty-text').length, 2, whitespace);
    assert.equal(issuesOf(blank, 'image-missing-alt').length, 0, 'decorative alt remains present');
  }
  assert.equal(issuesOf(analyzeArticleAccessibility('<h2>&nBsP;</h2>'), 'heading-empty').length, 0, 'unknown/miscased entities remain visible literal text');
  const namedHeadings = analyzeArticleAccessibility('<h2><img alt="Titulo em imagem"></h2><h3 aria-label="Outro titulo"></h3><h4 title="Titulo auxiliar"></h4>');
  assert.equal(issuesOf(namedHeadings, 'heading-empty').length, 0);

  // Duplicate ids are a warning diagnostic, not a universal WCAG verdict.
  const duplicateIds = analyzeArticleAccessibility('<p id="same">A</p><div id="same">B</div><span id="unique">C</span>');
  assert.equal(issuesOf(duplicateIds, 'duplicate-id').length, 1);
  assert.equal(duplicateIds.warningCount, 1);
  const decodedIds = analyzeArticleAccessibility('<p id="same">A</p><p id="s&#97;me">B</p><p id="same">C</p><p id="Same">D</p><p id=" same ">E</p>');
  assert.equal(issuesOf(decodedIds, 'duplicate-id').length, 1, 'decoded ids are case-sensitive, exact values with one warning per repeated id');

  // 6. Tabela sem <th> nem <thead> -> notice; tabela com <th> ou com <thead> (mesmo sem <th>) nao e reportada.
  const tables = analyzeArticleAccessibility(
    '<table><tr><td>1</td></tr></table>' + // sem cabecalho -> notice
    '<table><tr><th>A</th></tr></table>' + // com th -> ok
    '<table><thead><tr><td>A</td></tr></thead></table>' // com thead -> ok
  );
  const tableIssues = issuesOf(tables, 'table-missing-header');
  assert.equal(tableIssues.length, 1);
  assert.equal(tableIssues[0].severity, ACCESSIBILITY_SEVERITY.NOTICE);
  assert.equal(tables.hasNotices, true);
  assert.equal(tables.hasErrors, false);

  // Comments/script/style are excluded; hostile-looking attribute content remains data.
  const ignoredMarkup = analyzeArticleAccessibility(
    '<!-- <img><h2></h2><a>Clique aqui</a> -->' +
    '<script>"<img><h2></h2><a>Clique aqui</a>"</script>' +
    '<style>.x:after{content:"<h3></h3>"}</style>' +
    '<a href="x" title="&quot; onclick=&quot;">Clique aqui</a>'
  );
  assert.equal(ignoredMarkup.issues.length, 0);

  // 7. Entradas invalidas (null, undefined, numero, string vazia) nunca lancam: sempre devolvem lista de issues vazia.
  for (const invalidInput of [null, undefined, 42, '', {}, []]) {
    const result = analyzeArticleAccessibility(invalidInput);
    assert.deepEqual(result.issues, []);
    assert.equal(result.hasErrors, false);
  }

  // 8. Funcao e pura: nao modifica a string de entrada (strings sao imutaveis em JS, mas confirma que o valor original permanece intacto apos a chamada).
  const original = '<img src="a.png">';
  analyzeArticleAccessibility(original);
  assert.equal(original, '<img src="a.png">');

  // 9. HTML real combinando varios problemas ao mesmo tempo: todas as categorias aparecem juntas, sem uma mascarar a outra.
  const combined = analyzeArticleAccessibility('<img src="x.png"><a href="">vazio</a><h2>A</h2><h5>B</h5><table><tr><td>1</td></tr></table>');
  assert.equal(combined.errorCount, 1);
  assert.equal(combined.warningCount, 2);
  assert.equal(combined.noticeCount, 1);
  assert.equal(combined.hasErrors, true);
  assert.equal(combined.hasWarnings, true);
  assert.equal(combined.hasNotices, true);

  console.log('ok - article accessibility: HTML limpo nao gera nenhuma issue');
  console.log('ok - article accessibility: imagem sem alt e error; alt="" decorativo nao e reportado');
  console.log('ok - article accessibility: link sem href e warning');
  console.log('ok - article accessibility: link sem texto acessivel e error, com fallback por aria-label/title/alt de imagem interna');
  console.log('ok - article accessibility: heading pulando nivel e warning; sequencia correta e retrocesso nao sao reportados');
  console.log('ok - article accessibility: tabela sem th/thead e notice; tabela com cabecalho nao e reportada');
  console.log('ok - article accessibility: entrada invalida nunca lanca, sempre devolve lista vazia');
  console.log('ok - article accessibility: analise e pura, nao modifica a string analisada');
  console.log('ok - article accessibility: multiplos problemas sao todos reportados juntos, sem mascaramento');
  console.log('ok - article accessibility: heading vazio, id duplicado e nome generico de link; entidades e alternativas textuais sem executar HTML');
}
