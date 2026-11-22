import assert from 'node:assert/strict';
import { renderCategoriesTable } from '../src/administrator/components/com_categories/tmpl/categories/default.js';
import { renderTagsTable } from '../src/administrator/components/com_tags/tmpl/tags/default.js';

const link = (path, params) => `#${path}${params ? `?${Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')}` : ''}`;
const counts = (overrides = {}) => ({ Published: 2, Draft: 0, Archived: 0, Trashed: 0, ...overrides });

export function runAdminTaxonomyViewsTests() {
  for (const [render, label] of [[renderCategoriesTable, 'Categorias'], [renderTagsTable, 'Tags']]) {
    for (const empty of [[], null, undefined]) {
      assert.match(render(empty, { link }), new RegExp(`<p class="admin-empty" role="status">Nenhum registro em "${label}" encontrado\\.</p>`));
      assert.match(render(empty, { link }), /<thead><tr>[\s\S]*<\/tr><\/thead>/, 'o cabecalho com os botoes de filtro sobrevive ao resultado vazio');
    }
  }

  const hostile = renderCategoriesTable([
    { id: 3, title: 'Notícias <script>alert(1)</script>', alias: '" onmouseover="x', description: 'Nota & "citada"', state: 'Published', depth: 0, counts: counts() }
  ], { link });
  assert.match(hostile, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(hostile, /<script>|onmouseover="x/);
  assert.match(hostile, /Nota &amp; &quot;citada&quot;/);
  assert.match(hostile, /<th scope="col"[^>]*><span class="admin-th-label">Título<\/span><\/th>/);
  assert.match(hostile, /Artigos<span class="visually-hidden"> \(publicados, despublicados, arquivados, lixeira\)<\/span><\/span>/, 'a coluna de contagem mantém rótulo curto visível e rótulo completo acessível');
  assert.equal((hostile.match(/class="admin-badge/g) ?? []).length, 4, 'categories show one badge per article state');
  assert.equal((hostile.match(/ is-muted/g) ?? []).length, 3, 'zero counts are muted');
  assert.match(hostile, /data-ext-action="toggle-state"/);

  const tree = renderCategoriesTable([{ id: 4, title: '   ', alias: 'a', state: 'Trashed', depth: 2, counts: counts({ Published: 0 }) }], { link });
  assert.match(tree, /<span aria-hidden="true">— — <\/span><span class="visually-hidden">Nível 3: <\/span>/);
  assert.match(tree, /aria-label="Restaurar Categoria 4">Restaurar<\/button>/, 'blank title falls back and trashed rows offer restore');
  assert.doesNotMatch(tree, /toggle-state/);
  assert.doesNotMatch(tree, /admin-list-note/, 'no description means no note block');

  const tags = renderTagsTable([
    { id: 5, name: 'Tag <b>', alias: 'tag', description: 'Com nota', state: 'Published', counts: { count: 7 } },
    { id: 6, name: '  ', alias: '', state: 'Unpublished', counts: { count: 0 } }
  ], { link });
  assert.match(tags, /<th scope="col"[^>]*><span class="admin-th-label">Nome<\/span><\/th>/);
  // A coluna de contagem usa o mesmo padrão das demais: texto curto visível e
  // rótulo completo acessível, para o cabeçalho não destoar dos vizinhos.
  assert.match(tags, /<th scope="col" class="[^"]*admin-col-count[^"]*"[^>]*><span class="admin-th-label">Artigos<span class="visually-hidden"> \(Artigos com a tag\)<\/span><\/span>/);
  assert.equal((tags.match(/class="admin-badge/g) ?? []).length, 2, 'tags show a single count badge per row');
  assert.match(tags, /href="#\/articles\?tag=Tag &lt;b&gt;"/);
  assert.match(tags, /aria-label="7 artigo\(s\) com a tag Tag &lt;b&gt;"/);
  assert.match(tags, /class="admin-badge is-muted"/);
  assert.match(tags, /aria-label="Editar: Tag 6"/);
  assert.match(tags, /aria-label="Publicar Tag 6"/, 'unpublished rows offer publishing');
  assert.equal((tags.match(/<div class="admin-list-note">/g) ?? []).length, 1);

  console.log('ok - admin taxonomy views: categorias e tags com estado, árvore, contagens, fallback de título e escaping');
}
