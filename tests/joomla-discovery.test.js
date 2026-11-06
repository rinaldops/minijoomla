import assert from 'node:assert/strict';
import { createJoomlaDiscoveryService, sha256 } from '../src/libraries/minijoomla/application/joomla-discovery.js';
import { createJoomlaExtensionInstaller } from '../src/libraries/minijoomla/application/joomla-extension-installer.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { MODULE_XML, XML_OPTIONS } from './joomla-manifest.test.js';

const xmlPath = XML_OPTIONS.manifestPath;
const entryPath = 'modules/mod_camap_corpmessage/mod_camap_corpmessage.js';
const cssPath = 'media/mod_camap_corpmessage/css/mc.css';

export async function xmlPackage({ id = 'v1', xml = MODULE_XML, discover = true } = {}) {
  const files = new Map([[xmlPath, new TextEncoder().encode(xml)], [entryPath, new TextEncoder().encode('export default {render:()=>"hello"};')], [cssPath, new TextEncoder().encode('.camap-mc{color:red}')]]);
  const inventory = { format: 'minijoomla-joomla-package-v1', moduleKeys: { mod_camap_corpmessage: 'camap.mod_camap_corpmessage' }, moduleStyles: { 'camap.mod_camap_corpmessage': [cssPath] }, files: await Promise.all([...files].map(async ([path, bytes]) => ({ path, bytes: bytes.byteLength, sha256: await sha256(bytes) }))) };
  const inventoryBytes = new TextEncoder().encode(JSON.stringify(inventory));
  files.set('MANIFEST-SHA256.json', inventoryBytes);
  const reads = [];
  const root = { id, baseUrl: `${XML_OPTIONS.baseUrl}/${id}`, inventoryHash: await sha256(inventoryBytes), immutable: true, discover,
    files: {
      async listFolders({ folderPath }) { reads.push(folderPath); return { data: { value: [{ Name: 'mod_camap_corpmessage' }, { Name: 'mod_custom' }] } }; },
      async downloadFile({ folderPath, fileName }) {
        const path = [folderPath, fileName].filter(Boolean).join('/'); reads.push(path);
        if (!files.has(path)) throw new Error('missing file');
        return { data: files.get(path) };
      }
    } };
  return { root, reads, files };
}

function repository({ unique = false } = {}) {
  const rows = new Map();
  let seq = 0;
  const copy = (value) => structuredClone(value);
  return {
    rows,
    async findMany() { return { items: [...rows.values()].map(({ etag: _etag, ...row }) => copy(row)) }; },
    async findById(id) { return copy(rows.get(id) ?? null); },
    async create(value) {
      if (unique && [...rows.values()].some((row) => row.key === value.key)) throw new Error('duplicate key');
      const row = { ...copy(value), id: ++seq, etag: `"${seq}"` }; rows.set(row.id, row); return copy(row);
    },
    async update(id, patch, { etag }) {
      const row = rows.get(id);
      if (row?.etag !== etag) throw Object.assign(new Error('ETag conflict'), { code: 'concurrency-conflict' });
      rows.set(id, { ...row, ...copy(patch), etag: `"${++seq}"` }); return null;
    },
    async delete(id, { etag }) {
      if (rows.get(id)?.etag !== etag) throw new Error('ETag conflict'); rows.delete(id);
    }
  };
}

export async function runJoomlaDiscoveryTests() {
  const pack = await xmlPackage();
  const discovery = createJoomlaDiscoveryService({ roots: [pack.root] });
  const report = await discovery.scanReport();
  assert.equal(report.complete, true);
  assert.equal(report.entries.length, 1, 'core aliases never appear as new modules');
  const candidate = report.entries[0];
  assert.equal(candidate.status, 'ready');
  assert.deepEqual(pack.reads, ['modules', xmlPath], 'scan reads folders/XML only, never JS/CSS');
  const verified = await discovery.verify(candidate);
  assert.equal(verified.key, 'camap.mod_camap_corpmessage');
  assert.ok(pack.reads.includes(entryPath));
  await assert.rejects(() => discovery.verify({ ...candidate, candidateId: 'forged', entryPointUrl: '/evil.js' }), /obsoleto/);
  const tampered = { ...candidate, entryPointUrl: '/evil.js', manifestJson: '{}' };
  assert.equal((await discovery.verify(tampered)).entryPointUrl, verified.entryPointUrl, 'install reparses approved bytes, not UI metadata');
  pack.files.set(entryPath, new TextEncoder().encode('tampered'));
  await assert.rejects(() => discovery.verify(candidate), /Integridade/);
  const unsafe = await xmlPackage({ xml: MODULE_XML.replace('.js</filename>', '.php</filename>') });
  assert.equal((await createJoomlaDiscoveryService({ roots: [unsafe.root] }).scan())[0].status, 'unsupported');
  const reserved = await xmlPackage({ xml: MODULE_XML.replace('mj:key="camap.mod_camap_corpmessage"', 'mj:key="articles-latest"') });
  assert.equal((await createJoomlaDiscoveryService({ roots: [reserved.root] }).scan())[0].status, 'unsupported');
  const duplicate = await createJoomlaDiscoveryService({ roots: [pack.root, (await xmlPackage({ id: 'v2' })).root] }).scan();
  assert.ok(duplicate.every((entry) => entry.status === 'conflict'));
  const badRoot = { ...pack.root, id: 'broken', files: { ...pack.root.files, async listFolders() { throw new Error('403'); } } };
  assert.equal((await createJoomlaDiscoveryService({ roots: [badRoot] }).scanReport()).complete, false);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(() => discovery.scan({ signal: abort.signal }), /cancelada/);
  const noApproval = { ...pack.root, inventoryHash: '' };
  assert.equal((await createJoomlaDiscoveryService({ roots: [noApproval] }).scan())[0].status, 'unapproved');

  const v1 = await xmlPackage();
  const repositories = { extensions: repository({ unique: true }), moduleInstances: repository() };
  const admin = createAdminService(repositories);
  const d1 = createJoomlaDiscoveryService({ roots: [v1.root] });
  const firstCandidate = (await d1.scan())[0];
  const blocked = createJoomlaExtensionInstaller({ discovery: d1, admin, repositories });
  await assert.rejects(() => blocked.install(firstCandidate), /unicidade/);
  const installer = createJoomlaExtensionInstaller({ discovery: d1, admin, repositories, assertAtomicKey: async () => true });
  const [one, two] = await Promise.all([installer.install(firstCandidate), installer.install(firstCandidate)]);
  assert.equal(one.id, two.id);
  assert.equal(one.enabled, false);
  assert.equal(repositories.extensions.rows.size, 1);
  await admin.moduleInstances.create({ title: 'Message', extensionKey: one.key, position: 'main-top', settings: { message: 'Hello', align: 'left', unknown: 'keep' }, enabled: true, scopeKind: 'All' });
  const settings = (await admin.moduleInstances.list())[0].settingsJson;
  const v2 = await xmlPackage({ id: 'v2', xml: MODULE_XML.replace('<version>0.1.0', '<version>0.2.0') });
  const d2 = createJoomlaDiscoveryService({ roots: [{ ...v1.root, discover: false }, v2.root] });
  const c2 = (await d2.scan())[0];
  const upgrade = createJoomlaExtensionInstaller({ discovery: d2, admin, repositories, assertAtomicKey: async () => true });
  await assert.rejects(() => upgrade.upgrade(one.id, c2, { etag: '"stale"' }), (error) => error.code === 'concurrency-conflict');
  const incompatible = await xmlPackage({ id: 'incompatible', xml: MODULE_XML.replace('type="textarea" label="Message"', 'type="textarea" maxlength="3" label="Message"') });
  const incompatibleDiscovery = createJoomlaDiscoveryService({ roots: [{ ...v1.root, discover: false }, incompatible.root] });
  const incompatibleInstaller = createJoomlaExtensionInstaller({ discovery: incompatibleDiscovery, admin, repositories });
  await assert.rejects(() => incompatibleInstaller.upgrade(one.id, c2, { etag: one.etag }), /obsoleto/);
  const incompatibleCandidate = (await incompatibleDiscovery.scan())[0];
  await assert.rejects(() => incompatibleInstaller.upgrade(one.id, incompatibleCandidate, { etag: one.etag }), /contrato de parametros/);
  assert.equal((await admin.extensions.get(one.id)).entryPointUrl, one.entryPointUrl);
  await upgrade.upgrade(one.id, c2, { etag: one.etag });
  const installedV2 = await admin.extensions.get(one.id);
  assert.equal(installedV2.key, one.key);
  assert.ok(installedV2.entryPointUrl.includes('/v2/'));
  assert.equal((await admin.moduleInstances.list())[0].settingsJson, settings);
  await assert.rejects(() => upgrade.remove(one.id, { etag: installedV2.etag }), /inst.ncias/);
  await upgrade.rollback(one.id, { etag: installedV2.etag });
  assert.equal((await admin.extensions.get(one.id)).entryPointUrl, one.entryPointUrl);
  console.log('ok - Joomla discovery/install: metadata-only scan, pinned inventory, tamper guards, atomic creation, ETag upgrade and rollback');
}
