import assert from 'node:assert/strict';
import { renderModulesTable } from '../src/administrator/components/com_modules/tmpl/modules/default.js';

const link = (path) => `#${path}`;
const positions = { positions: ['sidebar-right'], all: ['sidebar-right', 'footer'] };

export function runAdminModulesViewTests() {
  assert.equal(renderModulesTable([], { link, types: new Map(), positions }), '<p class="admin-empty">Nenhum módulo encontrado.</p>');

  const rows = [
    { id: 1, title: 'Publicado <script>alert(1)</script>', extensionKey: 'custom-html', enabled: true, position: 'sidebar-right', note: 'Nota "hostil" <script>', assignment: 'all' },
    { id: 2, title: 'Despublicado', extensionKey: 'missing-type', enabled: false, position: 'unknown', assignment: 'all' },
    { id: 3, title: 'Na lixeira', extensionKey: 'custom-html', trashed: true, position: 'sidebar-right', assignment: 'all', ordering: undefined }
  ];
  const html = renderModulesTable(rows, { link, types: new Map([['custom-html', { title: 'HTML & personalizado' }]]), positions });
  assert.match(html, /^<div class="admin-table-wrap"><table class="admin-list"><caption class="visually-hidden">Módulos do site<\/caption>/);
  assert.match(html, /<th scope="col">Estado<\/th><th scope="col">Título<\/th><th scope="col">Tipo de módulo<\/th><th scope="col">Posição<\/th><th scope="col">Páginas<\/th><th scope="col">Ordem<\/th><th scope="col">Ação<\/th>/);
  assert.match(html, /data-ext-action="unpublish"/);
  assert.match(html, /aria-label="Despublicar Publicado &lt;script&gt;alert\(1\)&lt;\/script&gt;"/);
  assert.match(html, /data-ext-action="publish"/);
  assert.match(html, /aria-label="Publicar Despublicado"/);
  assert.match(html, /data-ext-action="restore"[^>]*aria-label="Restaurar Na lixeira">Restaurar<\/button>/);
  assert.doesNotMatch(html, /data-ext-action="(?:publish|unpublish)"[^>]*data-ext-id="3"/);
  assert.equal((html.match(/data-ext-action="duplicate"/g) ?? []).length, 3);
  assert.match(html, /<td>missing-type<\/td>/, 'missing type falls back to extensionKey');
  assert.match(html, /<span class="admin-badge is-muted">unknown<\/span>/);
  assert.match(html, /<span class="admin-badge">sidebar-right<\/span>/);
  assert.match(html, /<div class="admin-list-note">Nota: Nota &quot;hostil&quot; &lt;script&gt;<\/div>/);
  assert.doesNotMatch(html, /<script>|Nota "hostil"/);
  assert.match(html, /<td>0<\/td><td class="admin-col-action">/, 'missing ordering defaults to zero');
  assert.equal((html.match(/class="admin-list-note"/g) ?? []).length, 1, 'note block is omitted when absent');
  assert.doesNotMatch(html, /<p class="admin-empty"[^>]*role=/);
}
