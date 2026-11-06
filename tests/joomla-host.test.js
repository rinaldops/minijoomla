import assert from 'node:assert/strict';
import { normalizeExtensionsConfig, mergeExtensionsConfigs } from '../src/libraries/minijoomla/application/joomla-host-config.js';
import { createModuleStyles } from '../src/libraries/minijoomla/application/module-styles.js';
import { createAtomicExtensionKeyGuard } from '../src/libraries/minijoomla/infrastructure/spmiddle-extension-guard.js';
import { prepareDiscoveryEntries } from '../src/administrator/components/com_installer/src/Model/discovery.js';

const webUrl = '/sites/example';
const key = 'example.mod_message';
function config(version) {
  const base = `${webUrl}/SiteAssets/packages/${version}/`;
  const js = `${base}modules/mod_message/mod_message.js`;
  const css = `${base}media/mod_message/css/message.css`;
  return {
    joomlaDiscoveryRoots: [{ id: version, baseUrl: base, inventoryHash: 'a'.repeat(64), immutable: true }],
    moduleStyles: { [key]: [css] }, moduleStyleRevisions: { [key]: { [js]: [css] } }
  };
}

function documentDouble() {
  const links = [];
  return {
    links, baseURI: 'https://example.test/sites/example/page.aspx',
    head: { appendChild(link) { links.push(link); } },
    createElement() { return { setAttribute() {}, addEventListener() {}, remove() { links.splice(links.indexOf(this), 1); } }; }
  };
}

export async function runJoomlaHostTests() {
  const v1 = config('v1'); const v2 = config('v2');
  const combined = mergeExtensionsConfigs([v1, v2], { webUrl });
  assert.deepEqual(combined.joomlaDiscoveryRoots.map((root) => root.discover), [false, true]);
  assert.equal(Object.keys(combined.moduleStyleRevisions[key]).length, 2);
  assert.equal(normalizeExtensionsConfig(v1, { webUrl: '/' }).joomlaDiscoveryRoots.length, 1);
  for (const bad of ['https://external.test/a/', '//external/a/', '/sites/other/', `${webUrl}/../other/`, `${webUrl}/x%2fy/`, `${webUrl}/a?x/`]) {
    assert.throws(() => normalizeExtensionsConfig({ ...v1, joomlaDiscoveryRoots: [{ ...v1.joomlaDiscoveryRoots[0], baseUrl: bad }] }, { webUrl }));
  }
  assert.throws(() => normalizeExtensionsConfig({ ...v1, moduleStyles: { [key]: ['/sites/example/elsewhere/a.css'] } }, { webUrl }));
  assert.throws(() => mergeExtensionsConfigs([v1, { ...v1, joomlaDiscoveryRoots: [{ ...v1.joomlaDiscoveryRoots[0], inventoryHash: 'b'.repeat(64) }] }], { webUrl }), /conflitante/);
  const js1 = Object.keys(v1.moduleStyleRevisions[key])[0];
  assert.throws(() => mergeExtensionsConfigs([v1, { ...v1, moduleStyleRevisions: { [key]: { [js1]: [] } } }], { webUrl }), /conflitantes/);
  const doc = documentDouble();
  const manager = createModuleStyles({ ...combined, documentRef: doc });
  manager.apply([key, key], [{ key, entryPointUrl: js1 }]);
  assert.equal(doc.links.length, 1);
  assert.ok(doc.links[0].href.includes('/v1/'));
  const oldLink = doc.links[0];
  manager.apply([key], [{ key, entryPointUrl: js1 }]); assert.equal(doc.links[0], oldLink);
  manager.apply([key], [{ key, entryPointUrl: Object.keys(v2.moduleStyleRevisions[key])[0] }]);
  assert.equal(doc.links.length, 1); assert.ok(doc.links[0].href.includes('/v2/'));
  manager.apply([key], [{ key, entryPointUrl: '/unknown.js' }]); assert.equal(doc.links.length, 0);
  manager.apply([key], [{ key, entryPointUrl: js1 }]); manager.clear(); assert.equal(doc.links.length, 0);
  for (const bad of ['//external/a.css', '/a/../b.css', '/a%2fb.css', '/a.css?x', '/a.css#x', 'https://example.test/a.css']) {
    assert.throws(() => createModuleStyles({ moduleStyles: { [key]: [bad] }, documentRef: doc }));
  }
  const requests = [];
  let field = { InternalName: 'Key', TypeAsString: 'Text', Indexed: true, EnforceUniqueValues: true };
  const transport = { async request(url, options) { requests.push({ url, options }); return { data: field }; } };
  const guard = createAtomicExtensionKeyGuard({ transport, webUrl, listId: '11111111-1111-1111-1111-111111111111' });
  assert.equal(await guard(), true);
  field = { ...field, EnforceUniqueValues: false }; assert.equal(await guard(), false);
  assert.ok(requests.every(({ options }) => options.method === 'GET'));
  await assert.rejects(() => createAtomicExtensionKeyGuard({ transport, webUrl: '/sites/x/../z', listId: 'bad' })());

  const registered = [{ id: 9, key }];
  const entry = { key, candidateId: 'minted', fingerprint: 'new', status: 'ready', error: null };
  const extensions = { async get() { return { id: 9, key, etag: '"7"', manifestJson: JSON.stringify({ version: '1', miniJoomla: { fingerprint: 'old', inventoryHash: 'a'.repeat(64) } }) }; } };
  const entries = await prepareDiscoveryEntries([entry], registered, extensions);
  assert.equal(entries[0].action, 'upgrade'); assert.equal(entries[0].installedEtag, '"7"');
  const duplicates = await prepareDiscoveryEntries([entry], [...registered, { id: 10, key }], extensions);
  assert.ok(duplicates[0].error);
  console.log('ok - Joomla host: trusted roots, immutable CSS revisions, cleanup, atomic Key read-only gate and ETag discovery actions');
}
