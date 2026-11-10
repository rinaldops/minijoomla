import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { generateModuleManifests } from '../scripts/module-manifests.js';
import { NATIVE_MODULE_PACKAGES, BUILTIN_MODULE_TYPES, MODULE_ADVANCED_PARAMS } from '../src/libraries/minijoomla/application/module-catalog.js';

export function runModuleManifestsTests() {
  const paths = NATIVE_MODULE_PACKAGES.flatMap(({ folder }) => [`modules/${folder}/${folder}.js`, `modules/${folder}/tmpl/default.js`]);
  for (const path of paths) assert.ok(existsSync(new URL(`../src/${path}`, import.meta.url)), `actual native asset ${path}`);
  const manifests = generateModuleManifests(paths, '0.5.1');
  assert.equal(manifests.size, 16);
  assert.deepEqual([...manifests].map(([path, data]) => [path, data.toString()]), [...generateModuleManifests(paths, '0.5.1')].map(([path, data]) => [path, data.toString()]));
  for (const module of NATIVE_MODULE_PACKAGES) {
    const text = manifests.get(`modules/${module.folder}/${module.folder}.xml`).toString();
    assert.match(text, /<extension type="module" client="site"/);
    assert.match(text, /<version>0\.5\.1<\/version>/);
    assert.ok(text.includes(`<filename module="${module.folder}">${module.folder}.js</filename>`));
    for (const definition of [...module.params, ...MODULE_ADVANCED_PARAMS]) assert.ok(text.includes(`name="${definition.name}"`));
  }
  const latest = manifests.get('modules/mod_articles_latest/mod_articles_latest.xml').toString();
  assert.match(latest, /name="limit" type="number" label="Quantidade de itens" min="1" max="50" default="5"/);
  const menu = manifests.get('modules/mod_menu/mod_menu.xml').toString();
  assert.match(menu, /name="showAllChildren" type="radio"[^>]*default="1"/);
  assert.match(menu, /<option value="0">Não<\/option>/);
  const articles = manifests.get('modules/mod_articles/mod_articles.xml').toString();
  assert.match(articles, /name="ordering" type="list"[^>]*default="recent"/);
  for (const value of ['recent', 'oldest', 'title']) assert.ok(articles.includes(`<option value="${value}">`));
  assert.match(manifests.get('modules/mod_custom/mod_custom.xml').toString(), /name="html" type="textarea"/);
  assert.ok(BUILTIN_MODULE_TYPES.find(({ key }) => key === 'custom-html'), 'persisted keys remain unchanged');
  assert.ok(!BUILTIN_MODULE_TYPES.some(({ key }) => ['menu', 'breadcrumbs'].includes(key)), 'shell types are not added to admin selection');
  assert.equal(generateModuleManifests([], '0.5.1').size, 0);
  assert.equal(generateModuleManifests(['modules/mod_third_party/widget.js'], '0.5.1').size, 0);
  assert.equal(generateModuleManifests(paths.slice(0, 2), '0.5.1').size, 1, 'target closure controls inclusion');
  assert.throws(() => generateModuleManifests(paths.slice(0, 1), '0.5.1'), /Template de módulo ausente/);
  assert.match(generateModuleManifests(paths.slice(0, 2), '<&"').values().next().value.toString(), /<version>&lt;&amp;&quot;<\/version>/);
  console.log('ok - 16 catalogue-generated native module manifests: defaults, bounds, options, target closure and persisted keys');
}
