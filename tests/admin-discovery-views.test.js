import assert from 'node:assert/strict';
import { renderDiscoveryPage } from '../src/administrator/components/com_installer/tmpl/discover/default.js';
import { renderTemplateDiscoveryPage } from '../src/administrator/components/com_templates/tmpl/discover/default.js';

const shell = ({ bodyHtml }) => bodyHtml;
const link = (path) => `#${path}`;

export async function runAdminDiscoveryViewsTests() {
  for (const render of [renderDiscoveryPage, renderTemplateDiscoveryPage]) {
    for (const entries of [null, undefined, {}, '']) assert.match(render(entries, link, shell), /Nenhum(?:a)? .* encontrada?/);
  }
  const extension = renderDiscoveryPage([
    { key: '" onmouseover="x', title: '<img src=x>', type: 'Module', entryPointUrl: '" autofocus="', discoveredFrom: '<trustedmetadata-not-code>' },
    { key: 'bad', error: '<script>error</script>' }
  ], link, shell);
  assert.match(extension, /Extensões registradas/);
  assert.match(extension, /Módulo/);
  assert.match(extension, /&lt;trustedmetadata-not-code&gt;/);
  assert.match(extension, /&lt;script&gt;error&lt;\/script&gt;/);
  assert.equal((extension.match(/data-admin-register=/g) || []).length, 1);
  assert.doesNotMatch(extension, /onmouseover="x/);

  const template = renderTemplateDiscoveryPage([
    { key: 'tpl', title: '"<title>', version: '<1>', styles: '" onfocus="x', entryPointUrl: 'entry', discoveredFrom: 'metadata', positions: ['<main>', '" onclick="x'] },
    { key: '<bad>', error: '<error>' }
  ], link, shell);
  assert.match(template, /&quot;&lt;title&gt;/);
  assert.match(template, /&lt;1&gt;/);
  assert.match(template, /&quot; onfocus=&quot;x/);
  assert.match(template, /onclick=/);
  assert.match(template, /data-admin-template-positions="\[&quot;&lt;main&gt;&quot;,&quot;.*onclick=.*&quot;\]"/);
  assert.equal((template.match(/data-admin-template-register=/g) || []).length, 1);
  assert.doesNotMatch(template, /<li class="admin-discovery-error"[^]*?data-admin-template-register=/);
}
