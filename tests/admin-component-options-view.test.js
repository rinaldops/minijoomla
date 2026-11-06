import assert from 'node:assert/strict';
import { renderComponentOptionsCatalog, renderComponentOptionsForm } from '../src/administrator/components/com_config/tmpl/components/default.js';

const link = (path) => `/administrator${path}`;

export function runAdminComponentOptionsViewTests() {
  const empty = renderComponentOptionsCatalog([], { link });
  assert.equal(empty, '<p>Parâmetros globais por componente, usados quando o item de menu ou o conteúdo não define um valor próprio.</p><ul class="admin-component-catalog"></ul>');

  const catalog = renderComponentOptionsCatalog([
    { key: 'com_content', title: 'Artigos', joomla: 'com_content' },
    { key: 'com_users', title: 'Usuários', joomla: 'com_users', available: false, unavailableReason: 'Serviço &quot;off&quot;' }
  ], { link });
  assert.match(catalog, /href="\/administrator\/options\/com_content"/);
  assert.match(catalog, /<code>com_content<\/code>/);
  assert.match(catalog, /Serviço &amp;quot;off&amp;quot;/);
  const hostile = renderComponentOptionsCatalog([{ key: 'x" onmouseover="y', title: '<img>', joomla: '<script>', available: false, unavailableReason: '<bad>&"\'' }], { link });
  assert.match(hostile, /&lt;img&gt;/);
  assert.match(hostile, /&lt;script&gt;/);
  assert.match(hostile, /&lt;bad&gt;&amp;&quot;&#39;/);
  assert.doesNotMatch(hostile, /<img>|<script>/);

  const available = renderComponentOptionsForm({ title: 'Artigos', definitions: [], values: {}, available: true }, { link });
  assert.match(available, /role="tab"/);
  assert.match(available, /Salvar e fechar/);
  assert.doesNotMatch(available, /<button[^>]*disabled/);
  assert.match(available, /Esta extensão não declara parâmetros\./);

  const unavailable = renderComponentOptionsForm({ title: '<Usuários>', definitions: [], values: {}, available: false, unavailableReason: 'Motivo <hostil> & "x"' }, { link });
  assert.match(unavailable, /<fieldset disabled>/);
  assert.match(unavailable, /Salvar indisponível<\/button>/);
  assert.match(unavailable, /<button type="submit" class="admin-btn" disabled>/);
  assert.match(unavailable, /href="\/administrator\/options">Voltar/);
  assert.match(unavailable, /&lt;Usuários&gt; — indisponível/);
  assert.match(unavailable, /Motivo &lt;hostil&gt; &amp; &quot;x&quot;/);
}
