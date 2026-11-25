import assert from 'node:assert/strict';
import { renderCategoriesTable } from '../src/administrator/components/com_categories/tmpl/categories/default.js';
import { renderTagsTable } from '../src/administrator/components/com_tags/tmpl/tags/default.js';

const link = (path, params) => `#${path}${params ? `?${Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')}` : ''}`;
const counts = (overrides = {}) => ({ Published: 2, Draft: 0, Archived: 0, Trashed: 0, ...overrides });

export function runAdminTaxonomyViewsTests() {
  for (const [render, label] of [[renderCategoriesTable, 'Categorias'], [renderTagsTable, 'Tags']]) {
    for (const empty of [[], null, undefined]) {
      assert.equal(render(empty, { link }), `<p class="admin-empty" role="status">Nenhum registro em "${label}" encontrado.</p>`);
    }
  }

  const hostile = renderCategoriesTable([
    { id: 3, title: 'Notícias <script>alert(1)</script>', alias: '" onmouseover="x', description: 'Nota & "citada"', state: 'Published', depth: 0, counts: counts() }
  ], { link });
  assert.match(hostile, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(hostile, /<script>|onmouseover="x/);
  assert.match(hostile, /Nota &amp; &quot;citada&quot;/);
  assert.match(hostile, /<th scope="col">Título<label class="visually-hidden" for="admin-categories-col-fTitle">Filtrar Título<\/label><select class="admin-col-filter"/);
  assert.match(hostile, /Artigos \(publicados, despublicados, arquivados, lixeira\)/);
  assert.equal((hostile.match(/class="admin-badge/g) ?? []).length, 4, 'categories show one badge per article state');
  assert.equal((hostile.match(/ is-muted/g) ?? []).length, 3, 'zero counts are muted');
  assert.match(hostile, /data-ext-action="toggle-state"/);
    assert.match(hostile, /data-ext-column-filter-form="admin-categories-col"/, 'categories expose the module-driven column filter form');

  const tree = renderCategoriesTable([{ id: 4, title: '   ', alias: 'a', state: 'Trashed', depth: 2, counts: counts({ Published: 0 }) }], { link });
  assert.match(tree, /<span aria-hidden="true">— — <\/span><span class="visually-hidden">Nível 3: <\/span>/);
  assert.match(tree, /aria-label="Restaurar Categoria 4">Restaurar<\/button>/, 'blank title falls back and trashed rows offer restore');
  assert.doesNotMatch(tree, /toggle-state/);
  assert.doesNotMatch(tree, /admin-list-note/, 'no description means no note block');

  const tags = renderTagsTable([
    { id: 5, name: 'Tag <b>', alias: 'tag', description: 'Com nota', state: 'Published', counts: { count: 7 } },
    { id: 6, name: '  ', alias: '', state: 'Unpublished', counts: { count: 0 } }
  ], { link });
  assert.match(tags, /<th scope="col">Nome<label class="visually-hidden" for="admin-tags-col-fName">Filtrar Nome<\/label><select class="admin-col-filter"/);
  assert.match(tags, /<th scope="col">Artigos com a tag<\/th>/);
  assert.equal((tags.match(/class="admin-badge/g) ?? []).length, 2, 'tags show a single count badge per row');
  assert.match(tags, /href="#\/articles\?tag=Tag &lt;b&gt;"/);
  assert.match(tags, /aria-label="7 artigo\(s\) com a tag Tag &lt;b&gt;"/);
  assert.match(tags, /class="admin-badge is-muted"/);
  assert.match(tags, /aria-label="Editar: Tag 6"/);
  assert.match(tags, /aria-label="Publicar Tag 6"/, 'unpublished rows offer publishing');
  assert.equal((tags.match(/<div class="admin-list-note">/g) ?? []).length, 1);

  console.log('ok - admin taxonomy views: categorias e tags com estado, árvore, contagens, fallback de título e escaping');

    // Filtros por coluna: os dropdowns leem `facets` (conjunto completo, não a
    // página atual), marcam o valor ativo e o enlace de edição carrega o estado
    // de lista para que Salvar/Cancelar voltem à listagem filtrada.
    const filtered = renderCategoriesTable([
      { id: 7, title: 'Agenda', alias: 'agenda', state: 'Published', depth: 0, counts: counts() }
    ], { link, params: { fTitle: 'Agenda', q: 'age' }, facets: { titles: ['Agenda', 'Notíci<p>as'], aliases: ['agenda'] } });
    assert.match(filtered, /<option value="Agenda" selected>Agenda<\/option>/, 'the active title facet stays selected after filtering');
    assert.match(filtered, /value="Notíci&lt;p&gt;as"/, 'facet values are escaped, not interpolated as markup');
    assert.match(filtered, /class="admin-col-filter is-active"[^>]*name="fTitle"/, 'a populated column filter is flagged active');
    assert.doesNotMatch(filtered, /name="fAlias"[^>]*is-active/, 'the untouched alias column filter is not flagged active');
    assert.match(filtered, /href="#\/categories\/7\?fTitle=Agenda&amp;q=age"/, 'edit links preserve list state');

    const filteredTags = renderTagsTable([
      { id: 8, name: 'Robótica', alias: 'robotica', state: 'Published', counts: { count: 1 } }
    ], { link, params: { fName: 'Robótica' }, facets: { fName: ['Robótica'], titles: ['Robótica'], aliases: ['robotica'] } });
    assert.match(filteredTags, /id="admin-tags-col-fName"/, 'tags filter by the real title field, which is `name`');
    assert.match(filteredTags, /href="#\/tags\/8\?fName=Rob%C3%B3tica"|href="#\/tags\/8\?fName=Robótica"/, 'tag edit link preserves the active column filter');

    const noFacets = renderCategoriesTable([
      { id: 9, title: 'Sem facets', alias: 'sem', state: 'Published', depth: 0, counts: counts() }
    ], { link });
    assert.match(noFacets, /<option value="" selected>— Todos —<\/option>/, 'absent facets degrade to the neutral option instead of throwing');
}
