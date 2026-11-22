import assert from 'node:assert/strict';
import { renderTemplateStylesTable } from '../src/administrator/components/com_templates/tmpl/styles/default.js';

const link = (path, params) => `#${path}${params ? `?${Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')}` : ''}`;
const render = (styles) => renderTemplateStylesTable(styles, { link });

export function runAdminTemplateStylesViewTests() {
  assert.match(render([]), /<p class="admin-empty" role="status">Nenhum estilo encontrado\.<\/p>/);

  const siteDefault = render([{ id: 1, title: 'Principal', template: 'base', templateTitle: 'Base', isDefault: true }]);
  assert.match(siteDefault, /<span class="admin-default-star" role="img" aria-label="Estilo padrão do site">/);
  assert.doesNotMatch(siteDefault, /data-ext-action="default"/);

  const home = render([{ id: 2, title: 'Home', template: 'base', templateTitle: 'Base', home: true }]);
  assert.match(home, /admin-list-note">Padrão deste template/);
  assert.match(home, /data-ext-action="default"[\s\S]*?<svg[^>]*fill="currentColor"/);
  assert.doesNotMatch(home, /data-ext-action="remove"/);

  const ordinary = render([{ id: 3, title: 'Alternativo', template: 'base', templateTitle: 'Base' }]);
  assert.match(ordinary, /<svg[^>]*fill="none"/);
  assert.match(ordinary, /<button[^>]*data-ext-action="remove"/);
  assert.match(ordinary, /Duplicar/);
  assert.match(ordinary, /href="#\/templates\/positions\?template=base">Posições/);
  assert.match(ordinary, /<th scope="col" class="admin-th admin-col-default"><span class="admin-th-label">Padrão<\/span><\/th>[\s\S]*<th scope="col" class="admin-th admin-col-style[^"]*"><span class="admin-th-label">Estilo<\/span>[\s\S]*<th scope="col" class="admin-th admin-col-template[^"]*"><span class="admin-th-label">Template<\/span>[\s\S]*<th scope="col" class="admin-th admin-col-action"><span class="admin-th-label">Ações<\/span><\/th>/);

  // Item 3 do spec: Estilo e Template oferecem menu de filtro por coluna
  // independente, e o form que hospeda os menus acompanha os filtros.
  const filtered = renderTemplateStylesTable([{ id: 5, title: 'Alternativo', template: 'base', templateTitle: 'Base' }], {
    link,
    columnFilters: [
      { key: 'style', column: 'style', label: 'Estilo', value: '', values: [], options: [{ value: '', label: 'Todos', count: 2 }, { value: 'Alternativo', label: 'Alternativo', count: 1 }] },
      { key: 'template', column: 'template', label: 'Template', value: 'base', values: ['base'], options: [{ value: '', label: 'Todos', count: 2 }, { value: 'base', label: 'Base', count: 2 }] }
    ]
  });
  assert.match(filtered, /<table class="admin-list" data-colfilter-form="admin-styles"/);
  assert.match(filtered, /data-colfilter-column="style"/);
  assert.match(filtered, /data-colfilter-column="template"/);
  assert.match(filtered, /class="admin-colfilter-toggle is-active"[^>]*data-colfilter-key="template"[^>]*data-colfilter-values="base"/);
  assert.match(filtered, /aria-label="Filtrar coluna Template \(filtro ativo: 1 valores\)"/);
  assert.match(filtered, /aria-label="Filtrar coluna Estilo"/);
  // Sem filtros, Estilo e Template ainda existem como colunas, mas sem menu.
  const plain = render([{ id: 6, title: 'X', template: 'base', templateTitle: 'Base' }]);
  assert.match(plain, /<span class="admin-th-label">Estilo<\/span><\/th>/);
  assert.match(plain, /<span class="admin-th-label">Template<\/span><\/th>/);
  assert.doesNotMatch(plain, /data-colfilter-toggle/);

  for (const flags of [{ home: true }, { virtual: true }]) {
    assert.doesNotMatch(render([{ id: 4, title: 'Protegido', template: 'base', templateTitle: 'Base', ...flags }]), /data-ext-action="remove"/);
  }

  const escaped = render([{ id: 'a/b ?#', title: '<script>"x"</script>', template: 'base&x', templateTitle: '"<script>bad</script>' }]);
  assert.match(escaped, /\/templates\/styles\/a%2Fb%20%3F%23/);
  assert.match(escaped, /&lt;script&gt;&quot;x&quot;&lt;\/script&gt;/);
  assert.match(escaped, /&quot;&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(escaped, /<script>/);

  console.log('ok - admin template styles view');
}
