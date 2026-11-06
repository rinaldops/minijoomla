import assert from 'node:assert/strict';
import { renderInstalledExtensionsTable, renderInstallForm } from '../src/administrator/components/com_installer/tmpl/manage/default.js';

const link = (path) => `#${path}`;

export function runAdminInstallerViewTests() {
  assert.equal(renderInstalledExtensionsTable([], { snapshots: new Map() }), '<p class="admin-empty">Nenhuma extensão encontrada.</p>');

  const snapshots = new Map([
    ['enabled', { enabled: true, etag: '1' }],
    ['disabled', { enabled: false, etag: '2' }]
  ]);
  const html = renderInstalledExtensionsTable([
    { uid: 'core', core: true, title: 'Nativo', kind: 'Component', key: 'core', version: '1.0', source: 'x' },
    { uid: 'enabled', title: 'Ativo', kind: 'Plugin', key: 'enabled', version: '1.0' },
    { uid: 'disabled', title: 'Inativo', kind: 'Module', key: 'disabled', version: '2.0' },
    { uid: 'missing', title: 'Sem snapshot', kind: 'Template', key: 'missing' },
    { uid: 'hostile', title: '<script>"t</script>', kind: 'Unknown', key: '"<bad>', source: '<img src=x>' }
  ], { snapshots });

  assert.match(html, /<span class="admin-badge">Nativo<\/span>/);
  assert.match(html, /<td><span class="admin-badge">Nativo<\/span><\/td><td>Nativo/);
  assert.match(html, /aria-label="Desabilitar Ativo"/);
  assert.match(html, /aria-label="Habilitar Inativo"/);
  assert.match(html, /<td><\/td><td>Sem snapshot<\/td>/);
  assert.match(html, /<td>Unknown<\/td>/);
  assert.match(html, /&lt;script&gt;&quot;t&lt;\/script&gt;/);
  assert.match(html, /&quot;&lt;bad&gt;/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /<td><\/td><td>&lt;img src=x&gt;<\/td>/);
  assert.match(html, /<code>&quot;&lt;bad&gt;<\/code><\/td><td><\/td>/, 'missing version leaves a valid empty cell');
  assert.deepEqual(
    [...html.matchAll(/<th scope="col">(.*?)<\/th>/g)].map((match) => match[1]),
    ['Estado', 'Nome', 'Tipo', 'Elemento', 'Versão', 'Origem']
  );

  const install = renderInstallForm(link);
  assert.match(install, /<textarea id="admin-install-manifest" name="manifest" rows="8" spellcheck="false"><\/textarea>/);
  assert.match(install, /data-ext-action="preview">Validar<\/button>/);
  assert.match(install, /type="submit" class="admin-btn admin-btn-success">.*Instalar<\/button>/);
  assert.match(install, /href="#\/extensions\/discover">Descobrir extensões publicadas<\/a>/);
  assert.match(install, /href="#\/templates\/discover">Descobrir templates<\/a>/);

  console.log('ok - admin installer view: tabela, estados, escaping e formulário');
}
