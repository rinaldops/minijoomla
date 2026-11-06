/*
 * Verificacao local de acessibilidade do conteudo do artigo, inspirada no botao real
 * "Verificacao de acessibilidade" do Joomla 5/6 (barra de ferramentas do
 * formulario de Artigos, administrator/index.php?option=com_content&
 * view=article&layout=edit). Diferente do botao real (que mistura
 * validacao client-side com, em alguns casos, servicos de terceiros),
 * esta implementacao e 100% local: recebe o HTML ja composto do campo
 * `articletext` (composto pelo modelo com_content/src/Model/article.js)
 * e devolve uma lista de problemas sem fazer
 * nenhuma requisicao de rede, sem alterar o conteudo analisado e sem
 * depender de DOM real - funciona igual em Node, no mesmo espirito de
 * src/libraries/minijoomla/security/sanitize.js (regex sobre a string, nao um parser DOM
 * completo).
 *
 * Alcance desta verificacao local (heuristico, nao substitui testes com
 * tecnologias assistivas nem cobertura completa de WCAG; nao interpreta
 * semantica real e nao cobre i18n de forma exaustiva):
 * apenas as verificacoes abaixo, cada uma mapeada para uma das 3
 * severidades exigidas pelo criterio de aceite ("resultado diferencia
 * erro, aviso e informacao"):
 *
 *   - imagem sem atributo `alt`                       -> error
 *   - link sem texto acessivel                        -> error
 *   - link sem `href`                                 -> warning
 *   - heading pulando nivel (ex.: h2 direto para h4)  -> warning
 *   - tabela sem nenhum `<th>`/`<thead>`               -> notice
 *   - heading vazio                                    -> warning
 *   - id duplicado (diagnostico heuristico)             -> warning
 *   - texto de link generico sem nome mais descritivo   -> notice
 *
 * Outras verificacoes (metadados, elementos
 * semanticos genericos, "abre em nova janela" etc.) ficam para uma
 * frente futura - este arquivo cobre so o subconjunto descrito, para
 * manter o escopo isolado e revisavel.
 *
 * Nunca lanca para HTML malformado/vazio/nao-string: pior caso, devolve
 * uma lista de issues vazia (mesmo principio ja usado por
 * extension-discovery-service.js: entrada ruim e reportada como dado,
 * nunca interrompe o fluxo de quem chama). A funcao e pura: nunca
 * modifica a string recebida nem o DOM, e nao faz nenhuma chamada de
 * rede - adequado para ser chamado a qualquer momento, sem bloquear o
 * salvamento do artigo (quem decide se bloqueia ou nao e a tela que
 * eventualmente vier a consumir este modulo, fora de escopo aqui).
 */

export const ACCESSIBILITY_SEVERITY = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  NOTICE: 'notice'
});

// Mesmo padrao de atributo ja usado por src/libraries/minijoomla/security/sanitize.js
// (sanitizeHtml): nome=valor com aspas duplas, simples ou sem aspas.
const ATTRIBUTE_PATTERN = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function parseAttributes(attributeSource = '') {
  const attributes = {};
  for (const match of String(attributeSource).matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1].toLowerCase();
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

// HTML named spaces/punctuation only, not a general entity decoder. Names are case-sensitive.
const TEXT_ENTITIES = {
  amp: '&', AMP: '&', lt: '<', LT: '<', gt: '>', GT: '>', quot: '"', QUOT: '"', apos: "'",
  nbsp: '\u00a0', NonBreakingSpace: '\u00a0', ensp: '\u2002', emsp: '\u2003', emsp13: '\u2004', emsp14: '\u2005',
  numsp: '\u2007', puncsp: '\u2008', thinsp: '\u2009', ThinSpace: '\u2009', hairsp: '\u200a', VeryThinSpace: '\u200a',
  MediumSpace: '\u205f', ThickSpace: '\u205f\u200a', Tab: '\t', NewLine: '\n', NoBreak: '\u2060',
  ZeroWidthSpace: '\u200b', NegativeVeryThinSpace: '\u200b', NegativeThinSpace: '\u200b', NegativeMediumSpace: '\u200b', NegativeThickSpace: '\u200b',
  zwnj: '\u200c', zwj: '\u200d'
};

function decodeTextEntities(value = '') {
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z][a-z0-9]*);/gi, (entity, name) => {
    if (!name.startsWith('#')) return Object.hasOwn(TEXT_ENTITIES, name) ? TEXT_ENTITIES[name] : entity;
    const point = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\ufffd';
  });
}

function readableText(value = '') {
  return decodeTextEntities(value).replace(/[\u200b-\u200d\u2060]/g, '').replace(/\s+/g, ' ').trim();
}

function stripTags(value = '') {
  return readableText(String(value).replace(/<[^>]*>/g, ' '));
}

function imageAlternative(html) {
  return [...html.matchAll(/<img\b([^>]*)>/gi)].map((match) => readableText(parseAttributes(match[1]).alt ?? '')).filter(Boolean).join(' ');
}

function cleanMarkup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
}

/*
 * Imagem sem `alt` nenhum e um erro real (leitor de tela nao tem como
 * descrever a imagem). `alt=""` e uma marcacao valida e intencional de
 * imagem decorativa no HTML real - por isso a checagem e pela PRESENCA
 * do atributo (`'alt' in attributes`), nunca pelo seu conteudo estar
 * vazio.
 */
function findImagesWithoutAlt(html) {
  const issues = [];
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = parseAttributes(match[1]);
    if (!('alt' in attributes)) {
      issues.push({
        severity: ACCESSIBILITY_SEVERITY.ERROR,
        rule: 'image-missing-alt',
        message: 'Imagem sem atributo "alt": leitores de tela nao conseguem descrever esta imagem para o usuario.'
      });
    }
  }
  return issues;
}

/*
 * Para cada link: `href` ausente/vazio e aviso (o link nao leva a lugar
 * nenhum, mas pode ser um placeholder intencional em rascunho); texto
 * acessivel ausente e erro (leitor de tela anuncia "link" sem dizer
 * para onde ele leva). O texto acessivel aceita, nesta ordem, o mesmo
 * estimativa local usa aria-label, conteudo textual/imagens e title.
 * Nao calcula a arvore de acessibilidade nem resolve aria-labelledby/CSS.
 */
function findLinkIssues(html) {
  const issues = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = parseAttributes(match[1]);
    const href = (attributes.href ?? '').trim();
    if (!href) {
      issues.push({
        severity: ACCESSIBILITY_SEVERITY.WARNING,
        rule: 'link-missing-href',
        message: 'Link sem atributo "href": nao leva o usuario a lugar nenhum.'
      });
    }

    const innerText = stripTags(match[2]);
    const ariaLabel = readableText(attributes['aria-label'] ?? '');
    const title = readableText(attributes.title ?? '');
    const contentText = [innerText, imageAlternative(match[2])].filter(Boolean).join(' ');
    const accessibleText = ariaLabel || contentText || title;
    const generic = /^(?:clique aqui|leia mais|click here|read more)[.!?…]*$/i;

    if (!accessibleText) {
      issues.push({
        severity: ACCESSIBILITY_SEVERITY.ERROR,
        rule: 'link-empty-text',
        message: 'Link sem texto acessivel: leitores de tela anunciam "link" sem indicar para onde ele leva.'
      });
    } else if (generic.test(accessibleText) && !(!ariaLabel && title && !generic.test(title))) {
      issues.push({
        severity: ACCESSIBILITY_SEVERITY.NOTICE,
        rule: 'link-generic-text',
        message: 'Texto do link generico; considere um nome que descreva o destino ou a acao.'
      });
    }
  }
  return issues;
}

/*
 * Pula nivel de heading quando o nivel aumenta mais de 1 em relacao ao
 * heading anterior (ex.: h2 -> h4 sem passar por h3) - isso quebra a
 * navegacao por estrutura de titulos de leitores de tela. Voltar para
 * um nivel mais alto (h4 -> h2) e normal e nunca e reportado aqui.
 */
function findHeadingSkips(html) {
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
  const issues = [];
  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    if (current > previous + 1) {
      issues.push({
        severity: ACCESSIBILITY_SEVERITY.WARNING,
        rule: 'heading-skipped',
        message: `Nivel de titulo pulado: de <h${previous}> direto para <h${current}>, sem passar por <h${previous + 1}>.`
      });
    }
  }
  return issues;
}

function findEmptyHeadings(html) {
  const issues = [];
  for (const match of html.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1\s*>/gi)) {
    const attributes = parseAttributes(match[2]);
    if (!(readableText(attributes['aria-label'] ?? '') || stripTags(match[3]) || imageAlternative(match[3]) || readableText(attributes.title ?? ''))) {
      issues.push({
        severity: ACCESSIBILITY_SEVERITY.WARNING,
        rule: 'heading-empty',
        message: `Titulo <h${match[1]}> vazio.`
      });
    }
  }
  return issues;
}

function findDuplicateIds(html) {
  const ids = new Set();
  const duplicates = new Set();
  for (const match of html.matchAll(/<[a-z][\w:-]*\b([^>]*)>/gi)) {
    const attributes = parseAttributes(match[1]);
    const id = decodeTextEntities(attributes.id ?? '');
    if (!id.trim()) continue;
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }
  return [...duplicates].map((id) => ({
    severity: ACCESSIBILITY_SEVERITY.WARNING,
    rule: 'duplicate-id',
    message: `Atributo id duplicado: "${id}" (diagnostico heuristico).`
  }));
}

/*
 * Tabela sem nenhuma celula `<th>` (ou secao `<thead>`) impede que
 * leitores de tela associem cada celula de dado ao seu cabecalho de
 * linha/coluna. Classificada como "notice" (nao "error"/"warning") por
 * ser comum em tabelas simples de layout coladas de outra fonte, sem
 * necessariamente indicar perda de informacao grave.
 *
 * Limitacao conhecida: tabela aninhada dentro de outra tabela faz a
 * extracao nao-greedy parar na primeira `</table>` interna - aceitavel
 * porque conteudo de artigo colado via editor rico raramente tem
 * tabelas aninhadas.
 */
function findTablesWithoutHeader(html) {
  const issues = [];
  for (const match of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const body = match[1];
    if (!/<th\b/i.test(body) && !/<thead\b/i.test(body)) {
      issues.push({
        severity: ACCESSIBILITY_SEVERITY.NOTICE,
        rule: 'table-missing-header',
        message: 'Tabela sem nenhuma celula de cabecalho ("<th>"/"<thead>"): usuarios de leitor de tela podem nao conseguir associar linhas/colunas aos seus titulos.'
      });
    }
  }
  return issues;
}

/*
 * Ponto de entrada unico desta frente. `html` invalido (null,
 * undefined, numero etc.) e tratado como string vazia - nunca lanca.
 */
export function analyzeArticleAccessibility(html) {
  const source = typeof html === 'string' ? cleanMarkup(html) : '';
  const issues = [
    ...findImagesWithoutAlt(source),
    ...findLinkIssues(source),
    ...findHeadingSkips(source),
    ...findEmptyHeadings(source),
    ...findDuplicateIds(source),
    ...findTablesWithoutHeader(source)
  ];

  const errorCount = issues.filter((issue) => issue.severity === ACCESSIBILITY_SEVERITY.ERROR).length;
  const warningCount = issues.filter((issue) => issue.severity === ACCESSIBILITY_SEVERITY.WARNING).length;
  const noticeCount = issues.filter((issue) => issue.severity === ACCESSIBILITY_SEVERITY.NOTICE).length;

  return {
    issues,
    errorCount,
    warningCount,
    noticeCount,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    hasNotices: noticeCount > 0
  };
}
