import assert from 'node:assert/strict';
import { renderPluginsTable } from '../src/administrator/components/com_plugins/tmpl/plugins/default.js';

const link = (path) => `#${path}`;

export function runAdminPluginsViewTests() {
  assert.equal(renderPluginsTable([], { link }), '<p class="admin-empty">Nenhum plugin encontrado.</p>');

  const html = renderPluginsTable([
    { id: 1, title: 'Plugin <script>"x"</script>', enabled: true, group: 'grupo <script>"x"', ordering: 0, key: 'chave"<script>', version: '', description: 'Descrição <script>"x"' },
    { id: 2, title: 'Desabilitado', enabled: false, group: 'system', ordering: 4, key: 'disabled', version: '1.0', description: '' },
    { id: 'native:virtual', title: 'Virtual', enabled: false, virtual: true, group: 'content', ordering: 0, key: 'virtual', version: '' }
  ], { link });

  assert.match(html, /aria-label="Desabilitar Plugin &lt;script&gt;&quot;x&quot;&lt;\/script&gt;"/);
  assert.match(html, /aria-label="Habilitar Desabilitado"/);
  assert.match(html, /aria-label="Habilitar Virtual"/);
  assert.match(html, /<a href="#\/plugins\/1">Plugin &lt;script&gt;&quot;x&quot;&lt;\/script&gt;<\/a>/);
  assert.match(html, /<td>Virtual<\/td>/);
  assert.doesNotMatch(html, /href="#\/plugins\/native:virtual"/);
  assert.match(html, /<div class="admin-list-note">Descrição &lt;script&gt;&quot;x&quot;<\/div>/);
  assert.equal((html.match(/admin-list-note/g) ?? []).length, 1, 'only populated descriptions render a note');
  assert.match(html, /<span class="admin-badge">grupo &lt;script&gt;&quot;x&quot;<\/span>/);
  assert.match(html, /<code>chave&quot;&lt;script&gt;<\/code>/);
  assert.match(html, /<td>0<\/td><td><code>chave/);
  assert.match(html, /<td><\/td><\/tr>/, 'empty version leaves a valid empty cell');
  assert.match(html, /<th scope="col">Nome do plugin<\/th>/);
  assert.match(html, /<th scope="col">Versão<\/th>/);

  console.log('ok - admin plugins view: tabela, estados, virtual, descrições e escaping');
}
