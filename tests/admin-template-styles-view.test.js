import assert from 'node:assert/strict';
import { renderTemplateStylesTable } from '../src/administrator/components/com_templates/tmpl/styles/default.js';

const link = (path, params) => `#${path}${params ? `?${Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')}` : ''}`;
const render = (styles) => renderTemplateStylesTable(styles, { link });

export function runAdminTemplateStylesViewTests() {
  assert.equal(render([]), '<p class="admin-empty">Nenhum estilo encontrado.</p>');

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
  assert.match(ordinary, /<th scope="col">Padrão<\/th>[\s\S]*<th scope="col">Estilo<\/th>[\s\S]*<th scope="col">Template<\/th>[\s\S]*<th scope="col">Ações<\/th>/);

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
