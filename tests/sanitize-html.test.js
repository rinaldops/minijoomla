import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { sanitizeHtml } from '../src/libraries/minijoomla/security/sanitize.js';

// Marcação executável reconstruída por remoção de um passo: nada aqui pode virar tag ativa.
const ATTACKS = [
  '<<x>img src=x onerror=alert(1)>',
  '<<x>script>alert(1)<<x>/script>',
  '<scr<x>ipt>alert(1)</scr<x>ipt>',
  '<<b>img src=x onerror=alert(1)>',
  '<img src=x onerror=alert(1)>',
  '<img/src=x/onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="java&#10;script:alert(1)">x</a>',
  '<a href=" javascript:alert(1)">x</a>',
  '<svg onload=alert(1)>',
  '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
  '<iframe src="https://evil.example"></iframe>',
  '<form action="https://evil.example"><input name=q></form>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<p class="a&quot; onclick=&quot;alert(1)">x</p>',
  '<p title="x" onmouseover="alert(1)">x</p>',
  '<table background="javascript:alert(1)"><tr><td onclick="alert(1)">x</td></tr></table>',
  '<img alt="a>b" onerror="alert(1)" src="/a.png">',
  '<!-- --><img src=x onerror=alert(1)><!-- -->',
  '<!--><img src=x onerror=alert(1)>-->',
  '<a href="/x" target="_top" onclick=alert(1)>x</a>',
  '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  '<style>*{display:none}</style>',
  '<script>alert(1)',
  '<base href="https://evil.example/">',
  '<meta http-equiv="refresh" content="0;url=https://evil.example">',
  '<link rel="stylesheet" href="https://evil.example/x.css">'
];

// Tags que restam na saída, lidas como um navegador leria: `<` seguido de letra ou `/`.
const tagsIn = (html) => [...html.matchAll(/<\/?([a-z][^\s/>]*)([^>]*)>/gi)];

export function runSanitizeHtmlTests() {
  for (const attack of ATTACKS) {
    const output = sanitizeHtml(attack);
    for (const [, name, attributes] of tagsIn(output)) {
      assert.doesNotMatch(name, /^(?:script|svg|math|iframe|form|input|style|base|meta|link|object|embed)$/i, `${attack} -> ${output}`);
      assert.doesNotMatch(attributes, /\son[a-z]+\s*=/i, `${attack} -> ${output}`);
      assert.doesNotMatch(attributes, /javascript:|data:|\sstyle="[^"]*url/i, `${attack} -> ${output}`);
    }
  }

  // Conteúdo legítimo do editor sobrevive com estrutura.
  const article = '<h2 class="titulo">T</h2><blockquote>Q</blockquote><pre><code>x = 1</code></pre><hr><table class="table table-striped"><caption>C</caption><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td colspan="2" rowspan="3">B</td></tr></tbody></table>';
  assert.equal(sanitizeHtml(article), article);
  assert.equal(sanitizeHtml('<p style="text-align: center">x</p>'), '<p style="text-align: center">x</p>');
  assert.equal(sanitizeHtml('<p style="color: red; text-align: right">x</p>'), '<p style="text-align: right">x</p>');
  assert.equal(sanitizeHtml('<p style="position: fixed">x</p>'), '<p>x</p>');
  assert.equal(sanitizeHtml('<span class="badge bg-primary" title="dica">x</span>'), '<span class="badge bg-primary" title="dica">x</span>');
  assert.equal(sanitizeHtml('<h1 class="bad&quot;x">t</h1>'), '<h1>t</h1>');
  assert.equal(sanitizeHtml('<a href="https://joomla.org" target="_blank">x</a>'), '<a href="https://joomla.org" target="_blank" rel="noopener noreferrer">x</a>');
  assert.equal(sanitizeHtml('<img src="/a.png" alt="A" width="10" height="20">'), '<img src="/a.png" alt="A" width="10" height="20">');
  assert.equal(sanitizeHtml('<td scope="evil" colspan="x">y</td>'), '<td>y</td>');

  // Texto continua texto; entidades já escritas não são duplicadas.
  assert.equal(sanitizeHtml('1 < 2 &amp; 3 > 2'), '1 &lt; 2 &amp; 3 &gt; 2');
  assert.equal(sanitizeHtml('&#97;&#64;b'), '&#97;&#64;b');
  console.log('ok - sanitize html: reconstrução de tags, atributos, URLs e conteúdo do editor');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runSanitizeHtmlTests();
