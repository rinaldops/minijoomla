import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseJoomlaManifest, packageAsset, packagePath } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { generateModuleManifests } from '../scripts/module-manifests.js';
import { NATIVE_MODULE_PACKAGES } from '../src/libraries/minijoomla/application/module-catalog.js';
import { PLUGIN_GROUPS } from '../src/libraries/minijoomla/application/extension-manifest.js';

export const MODULE_XML = `<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="camap.mod_camap_corpmessage">
  <name>CAMAP &amp; Message</name><version>0.1.0</version><description><![CDATA[Text message]]></description>
  <files><filename module="mod_camap_corpmessage">mod_camap_corpmessage.js</filename></files>
  <media folder="media" destination="mod_camap_corpmessage"><filename>css/mc.css</filename></media>
  <config><fields name="params"><fieldset name="basic">
    <field name="message" type="textarea" label="Message" default="" />
    <field name="align" type="list" default="left"><option value="left">Left</option><option value="right">Right</option></field>
    <field name="enabled" type="radio" default="1"><option value="1">Yes</option><option value="0">No</option></field>
    <field name="items" type="textarea" mj:type="json" mj:valueType="array" default="[]" />
  </fieldset></fields></config>
</extension>`;
export const XML_OPTIONS = { baseUrl: '/sites/example/SiteAssets/packages/0.1.0', manifestPath: 'modules/mod_camap_corpmessage/mod_camap_corpmessage.xml' };

export const PLUGIN_XML = `<?xml version="1.0" encoding="utf-8"?>
<extension type="plugin" group="content" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="camap.corptip">
  <name>CAMAP Tip</name><version>0.2.0</version><description><![CDATA[Highlights a corporate tip.]]></description>
  <files><filename plugin="corptip">corptip.js</filename></files>
  <media folder="media" destination="corptip"><filename>css/tip.css</filename></media>
  <config><fields name="params"><fieldset name="basic">
    <field name="label" type="text" label="Label" default="Tip" />
    <field name="enabled" type="radio" default="1"><option value="1">Yes</option><option value="0">No</option></field>
  </fieldset></fields></config>
</extension>`;
export const PLUGIN_XML_OPTIONS = { baseUrl: '/sites/example/SiteAssets/packages/0.2.0', manifestPath: 'plugins/content/corptip/corptip.xml' };

export async function runJoomlaManifestTests() {
  const parsed = parseJoomlaManifest(MODULE_XML, XML_OPTIONS);
  assert.equal(parsed.key, 'camap.mod_camap_corpmessage');
  assert.equal(parsed.identity, 'module:site::mod_camap_corpmessage');
  assert.equal(parsed.entryPointUrl, `${XML_OPTIONS.baseUrl}/modules/mod_camap_corpmessage/mod_camap_corpmessage.js`);
  assert.equal(parsed.title, 'CAMAP & Message');
  assert.equal(parsed.params[2].type, 'checkbox');
  assert.equal(parsed.params[2].default, true);
  assert.deepEqual(parsed.params[3].default, []);
  assert.equal(parsed.styles.length, 1);
  assert.deepEqual(parseJoomlaManifest(`\uFEFF${MODULE_XML}`, XML_OPTIONS).params, parsed.params);
  assert.deepEqual(parseJoomlaManifest(MODULE_XML.replaceAll('mj:', 'rt:').replace('xmlns:mj', 'xmlns:rt'), XML_OPTIONS).params, parsed.params);
  const radio = MODULE_XML.replace('name="align" type="list"', 'name="align" type="radio"');
  assert.equal(parseJoomlaManifest(radio, XML_OPTIONS).params[1].type, 'select');
  for (const bad of [
    MODULE_XML.replace('<name>', '<name>broken<'),
    MODULE_XML.replace('<extension ', '<!DOCTYPE extension SYSTEM "https://evil.example/x"><extension '),
    MODULE_XML.replace('<name>', '<?danger bad?><name>'),
    MODULE_XML.replace('mod_camap_corpmessage.js</filename>', 'mod_camap_corpmessage.php</filename>'),
    MODULE_XML.replace('module="mod_camap_corpmessage"', 'module="mod_other"'),
    MODULE_XML.replace('<version>0.1.0</version>', ''),
    MODULE_XML.replace('<files>', '<scriptfile>install.php</scriptfile><files>'),
    MODULE_XML.replace('name="message"', 'name="constructor"'),
    MODULE_XML.replace('name="message"', 'name="align"'),
    MODULE_XML.replace('type="textarea" label=', 'type="unknown" label='),
    MODULE_XML.replace('type="textarea" label=', 'type="textarea" required="true" label='),
    MODULE_XML.replace('<name>', '<name>&custom;'),
    MODULE_XML.replace('encoding="utf-8"', 'encoding="iso-8859-1"'),
    MODULE_XML.replace('</extension>', '<a>'.repeat(33) + '</a>'.repeat(33) + '</extension>'),
    MODULE_XML.replace('</extension>', '<a/>'.repeat(5001) + '</extension>'),
    MODULE_XML.replace('</fieldset>', '<fieldset><field name="lost" /></fieldset></fieldset>'),
    'x'.repeat(65537)
  ]) assert.throws(() => parseJoomlaManifest(bad, XML_OPTIONS), { name: 'ValidationError' });
  for (const bad of ['../x.js', '/evil/x.js', 'a/../x', 'a%2fb', '//x', 'a\\x', 'a//b', 'a?x']) assert.throws(() => packagePath(bad));
  assert.throws(() => packageAsset('https://example.org/pkg', 'x.js'));
  assert.throws(() => parseJoomlaManifest(MODULE_XML, { ...XML_OPTIONS, manifestPath: 'modules/mod_other/mod_other.xml' }));
  const paths = NATIVE_MODULE_PACKAGES.flatMap((module) => [`modules/${module.folder}/${module.folder}.js`, `modules/${module.folder}/tmpl/default.js`]);
  for (const [manifestPath, bytes] of generateModuleManifests(paths, '0.6.0')) {
    const descriptor = parseJoomlaManifest(bytes, { ...XML_OPTIONS, manifestPath });
    const native = NATIVE_MODULE_PACKAGES.find((module) => module.folder === descriptor.element);
    assert.equal(descriptor.key, native.key);
    for (const param of native.params) assert.deepEqual(descriptor.params.find((entry) => entry.name === param.name), param);
  }

  // Plugin profile: synthetic fixture with config/params/media, mirroring the module path above.
  const plugin = parseJoomlaManifest(PLUGIN_XML, PLUGIN_XML_OPTIONS);
  assert.equal(plugin.type, 'Plugin');
  assert.equal(plugin.key, 'camap.corptip');
  assert.equal(plugin.group, 'content');
  assert.equal(plugin.identity, 'plugin:content::corptip');
  assert.equal(plugin.entryPointUrl, `${PLUGIN_XML_OPTIONS.baseUrl}/plugins/content/corptip/corptip.js`);
  assert.equal(plugin.title, 'CAMAP Tip');
  assert.equal(plugin.styles.length, 1);
  assert.equal(plugin.params[1].type, 'checkbox');
  assert.equal(plugin.params[1].default, true);
  assert.equal(JSON.parse(plugin.manifestJson).miniJoomla.group, 'content');
  for (const bad of [
    PLUGIN_XML.replace('group="content"', 'group="unknown-group"'),
    PLUGIN_XML.replace('group="content" method', 'group="system" method'), // path/group mismatch
    PLUGIN_XML.replace('plugin="corptip"', 'plugin="other"'),
    PLUGIN_XML.replace('corptip.js</filename>', 'corptip.php</filename>'),
    PLUGIN_XML.replace('<version>0.2.0</version>', ''),
    PLUGIN_XML.replace('<files>', '<scriptfile>install.php</scriptfile><files>')
  ]) assert.throws(() => parseJoomlaManifest(bad, PLUGIN_XML_OPTIONS), { name: 'ValidationError' });
  assert.throws(() => parseJoomlaManifest(PLUGIN_XML, { ...PLUGIN_XML_OPTIONS, manifestPath: 'plugins/content/other/other.xml' }));
  // Element folder is the second path segment; module-shaped filename must not collide with a plugin manifest path.
  assert.throws(() => parseJoomlaManifest(MODULE_XML, { ...XML_OPTIONS, manifestPath: 'plugins/content/mod_camap_corpmessage/mod_camap_corpmessage.xml' }));

  // Real native plugin fixtures shipped under src/plugins: shape-only manifests
  // without <config>, confirming the profile accepts the simplest valid plugin.
  for (const [group, element] of [['content', 'emailcloak'], ['content', 'loadmodule'], ['content', 'pagebreak'], ['content', 'pagenavigation']]) {
    const manifestPath = `plugins/${group}/${element}/${element}.xml`;
    const xml = readFileSync(new URL(`../src/${manifestPath}`, import.meta.url), 'utf8');
    const descriptor = parseJoomlaManifest(xml, { baseUrl: '/sites/example/SiteAssets/packages/native', manifestPath });
    assert.equal(descriptor.type, 'Plugin');
    assert.equal(descriptor.group, group);
    assert.equal(descriptor.element, element);
    assert.deepEqual(descriptor.params, []);
  }
  for (const group of PLUGIN_GROUPS) assert.ok(typeof group === 'string' && group.length, 'plugin group catalogue is non-empty text');
  console.log('ok - Joomla XML: real shared parser, native roundtrips, typed params, safe paths and non-executing rejects');
}
