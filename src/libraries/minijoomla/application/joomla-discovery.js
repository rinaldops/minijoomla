import { ValidationError } from '../core/contracts.js';
import { NATIVE_MODULE_PACKAGES } from './module-catalog.js';
import { NATIVE_PLUGIN_KEYS } from './extension-input.js';
import { PLUGIN_GROUPS } from './extension-manifest.js';
import { parseJoomlaManifest, manifestBytes, packageBase, packagePath, packageAsset, MAX_MANIFEST_BYTES } from './joomla-manifest.js';

const NATIVE_FOLDERS = new Set(NATIVE_MODULE_PACKAGES.map((module) => module.folder));
const NATIVE_KEYS = new Set(NATIVE_MODULE_PACKAGES.map((module) => module.key));
const NATIVE_PLUGIN_ELEMENTS = new Set(NATIVE_PLUGIN_KEYS);
const HEX = /^[a-f0-9]{64}$/;
const failure = (message, code = 'discovery-conflict') => Object.assign(new ValidationError(message), { code });
const payload = (response) => response?.data ?? response;

export async function sha256(input) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', manifestBytes(input));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function listed(response) {
  const value = payload(response)?.value;
  if (!Array.isArray(value)) throw failure('Resposta de diretorio invalida.', 'discovery-read-error');
  return value;
}

function boundedBytes(response, max = MAX_MANIFEST_BYTES) {
  const bytes = manifestBytes(payload(response));
  if (bytes.byteLength > max) throw failure('Arquivo excede o limite de leitura.', 'discovery-limit');
  return bytes;
}

function normalizeRoot(root) {
  if (!root || typeof root.id !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(root.id)) throw new TypeError('Identificador da raiz invalido.');
  if (!root.files || !['listFolders', 'downloadFile'].every((method) => typeof root.files[method] === 'function')) throw new TypeError('Raiz XML requer cliente de diretorios e download.');
  const baseUrl = packageBase(root.baseUrl);
  const inventoryHash = root.inventoryHash ?? '';
  if (inventoryHash && !HEX.test(inventoryHash)) throw new TypeError('Hash do inventario invalido.');
  const discover = root.discover !== false;
  const configuration = JSON.stringify({ id: root.id, baseUrl, inventoryHash, immutable: root.immutable === true, discover });
  return Object.freeze({ id: root.id, baseUrl, inventoryHash, discover, immutable: root.immutable === true, files: root.files, configuration });
}

/** Files are read through injected ports; scan never imports code or writes. */
export function createJoomlaDiscoveryService({ roots = [], legacy = null, maxFolders = 500, maxCandidates = 200, timeoutMs = 60000 } = {}) {
  if (!Array.isArray(roots) || roots.length > 10) throw new TypeError('No maximo dez raizes XML.');
  for (const limit of [maxFolders, maxCandidates, timeoutMs]) if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('Limites de descoberta invalidos.');
  const sources = roots.map(normalizeRoot);
  if (new Set(sources.map((root) => root.id)).size !== sources.length) throw new TypeError('Raizes duplicadas.');
  const approvals = new Map();
  const rootsById = new Map(sources.map((root) => [root.id, root]));

  async function operation(signal, run) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('Tempo de descoberta excedido.')), timeoutMs);
    const check = () => { if (controller.signal.aborted) throw failure('Descoberta cancelada ou tempo excedido.', 'discovery-aborted'); };
    try { check(); return await run(controller.signal, check); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }

  async function read(root, path, signal, maxBytes = MAX_MANIFEST_BYTES) {
    const safe = packagePath(path);
    const slash = safe.lastIndexOf('/');
    return boundedBytes(await root.files.downloadFile({ folderPath: slash < 0 ? '' : safe.slice(0, slash), fileName: safe.slice(slash + 1), signal, maxBytes }), maxBytes);
  }

  async function scanReport({ signal } = {}) {
    approvals.clear();
    const entries = [];
    const issues = [];
    let visited = 0;
    return operation(signal, async (activeSignal, check) => {
      if (legacy) {
        try { entries.push(...await legacy.scan()); check(); }
        catch { issues.push({ rootId: 'legacy', error: 'Falha na leitura dos manifestos JSON legados.' }); }
      }

      // Scan one base folder (`modules` or `plugins/<group>`). The module
      // and plugin profiles differ only in folder naming/reserved aliases;
      // both share the same manifest parser, approval and conflict logic.
      // Names outside the expected shape are silently ignored (not a
      // candidate at all); names that match the shape but are reserved for
      // a native extension are also silently skipped; everything else that
      // fails the stricter per-prefix regex is reported as 'invalid'.
      // `optional` bases (plugin groups) that do not exist at all on a root
      // are reported as absent (zero candidates), not a scan failure — the
      // `modules` base stays mandatory and still fails the whole root.
      async function scanBase(root, basePath, { prefix, optional, isReservedFolder, isReservedKey, manifestPathFor }) {
        check();
        let folders;
        try {
          folders = listed(await root.files.listFolders({ folderPath: basePath, signal: activeSignal, maxItems: maxFolders }));
        } catch (error) {
          check();
          if (optional && error?.code !== 'discovery-aborted') return;
          throw error;
        }
        check();
        for (const folder of folders) {
          check();
          if (++visited > maxFolders) throw failure('Limite de pastas atingido.', 'discovery-limit');
          if (typeof folder?.Name !== 'string' || !folder.Name.startsWith(prefix)) continue;
          if (!new RegExp(`^${prefix}[a-z0-9_]+$`).test(folder.Name)) {
            entries.push({ key: folder.Name, title: folder.Name, type: null, entryPointUrl: null, status: 'invalid', error: `Nome de pasta deve seguir ${prefix}nome com letras minusculas e underscores.` });
            continue;
          }
          if (isReservedFolder(folder.Name)) continue;
          if (entries.length >= maxCandidates) throw failure('Limite de candidatos atingido.', 'discovery-limit');
          const manifestPath = manifestPathFor(folder.Name);
          try {
            const bytes = await read(root, manifestPath, activeSignal);
            check();
            const descriptor = parseJoomlaManifest(bytes, { baseUrl: root.baseUrl, manifestPath });
            if (isReservedKey(descriptor.key)) throw failure('Alias reservado para extensao nativa.', 'unsupported-extension');
            const fingerprint = await sha256(bytes);
            const candidateId = await sha256(`${root.configuration}\n${manifestPath}\n${fingerprint}`);
            const entry = { ...descriptor, sourceRootId: root.id, fingerprint, candidateId,
              discoveredFrom: packageAsset(root.baseUrl, manifestPath), status: 'ready', error: null };
            if (!root.immutable || !root.inventoryHash) {
              entry.status = 'unapproved';
              entry.error = 'Pacote encontrado; configure raiz imutavel e hash do inventario para instalar.';
            } else approvals.set(candidateId, { rootId: root.id, manifestPath, fingerprint, key: descriptor.key });
            entries.push(entry);
          } catch (error) {
            check();
            entries.push({ key: folder.Name, title: folder.Name, type: null, entryPointUrl: null, sourceRootId: root.id,
              discoveredFrom: packageAsset(root.baseUrl, manifestPath), status: error.code === 'unsupported-extension' ? 'unsupported' : 'invalid', error: error.message });
          }
        }
      }

      for (const root of sources) {
        if (!root.discover) continue;
        try {
          await scanBase(root, 'modules', {
            prefix: 'mod_',
            isReservedFolder: (name) => NATIVE_FOLDERS.has(name),
            isReservedKey: (key) => NATIVE_KEYS.has(key),
            manifestPathFor: (name) => `modules/${name}/${name}.xml`
          });
          for (const group of PLUGIN_GROUPS) {
            await scanBase(root, `plugins/${group}`, {
              prefix: '', optional: true,
              isReservedFolder: (name) => NATIVE_PLUGIN_ELEMENTS.has(name),
              isReservedKey: (key) => NATIVE_PLUGIN_ELEMENTS.has(key),
              manifestPathFor: (name) => `plugins/${group}/${name}/${name}.xml`
            });
          }
        } catch (error) {
          check();
          issues.push({ rootId: root.id, error: error.message });
        }
      }
      const keys = new Map();
      const identities = new Map();
      for (const entry of entries) {
        const prior = keys.get(entry.key) ?? (entry.identity ? identities.get(entry.identity) : null);
        if (prior) {
          for (const item of [prior, entry]) {
            if (item.candidateId) approvals.delete(item.candidateId);
            item.status = 'conflict'; item.error = 'Identidade/chave encontrada em mais de um manifesto; selecione uma unica origem aprovada.';
          }
        }
        keys.set(entry.key, entry);
        if (entry.identity) identities.set(entry.identity, entry);
      }
      if (issues.length) for (const entry of entries) {
        if (entry.candidateId) approvals.delete(entry.candidateId);
        if (!entry.error) { entry.status = 'incomplete'; entry.error = 'Busca incompleta; resolva as falhas das raizes antes de instalar.'; }
      }
      return { entries, issues, complete: issues.length === 0, roots: sources.map(({ id, baseUrl }) => ({ id, baseUrl })) };
    });
  }

  async function verifyApproval(approval, signal) {
    const root = rootsById.get(approval.rootId);
    if (!root?.immutable || !root.inventoryHash) throw failure('Raiz do pacote nao aprovada.');
    return operation(signal, async (activeSignal, check) => {
      const xml = await read(root, approval.manifestPath, activeSignal);
      if (await sha256(xml) !== approval.fingerprint) throw failure('Manifesto alterado desde a descoberta; execute nova busca.');
      const descriptor = parseJoomlaManifest(xml, { baseUrl: root.baseUrl, manifestPath: approval.manifestPath });
      if (descriptor.key !== approval.key) throw failure('Identidade alterada desde a descoberta.');
      const inventoryBytes = await read(root, 'MANIFEST-SHA256.json', activeSignal);
      if (await sha256(inventoryBytes) !== root.inventoryHash) throw failure('Inventario do pacote difere do aprovado pelo host.');
      let inventory;
      try { inventory = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inventoryBytes)); }
      catch { throw failure('Inventario JSON invalido.'); }
      if (inventory.format !== 'minijoomla-joomla-package-v1' || !Array.isArray(inventory.files) || inventory.files.length > 500 || !inventory.files.length) throw failure('Inventario de pacote nao suportado.');
      const identityMap = descriptor.type === 'Module' ? inventory.moduleKeys : inventory.pluginKeys;
      const stylesMap = descriptor.type === 'Module' ? inventory.moduleStyles : inventory.pluginStyles;
      const identityElement = descriptor.type === 'Module' ? descriptor.element : `${descriptor.group}/${descriptor.element}`;
      if (!identityMap || !Object.hasOwn(identityMap, identityElement) || identityMap[identityElement] !== descriptor.key) throw failure('Identidade XML nao corresponde ao inventario aprovado.');
      const declaredStyles = stylesMap && Object.hasOwn(stylesMap, descriptor.key) ? stylesMap[descriptor.key] : [];
      if (!Array.isArray(declaredStyles) || JSON.stringify(declaredStyles.map((path) => packageAsset(root.baseUrl, path)).sort()) !== JSON.stringify([...descriptor.styles].sort())) throw failure('Estilos XML nao correspondem ao inventario aprovado.');
      const paths = new Map();
      const names = new Set();
      let total = 0;
      for (const file of inventory.files) {
        check();
        const path = packagePath(file?.path);
        if (names.has(path.toLowerCase()) || !HEX.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || (total += file.bytes) > 10 * 1024 * 1024) throw failure('Arquivo duplicado ou limites/hash invalidos no inventario.');
        names.add(path.toLowerCase());
        paths.set(path, file);
      }
      if (paths.get(approval.manifestPath)?.sha256 !== approval.fingerprint) throw failure('Manifesto nao consta do inventario aprovado.');
      for (const path of descriptor.requiredFiles) if (!paths.has(path)) throw failure(`Arquivo declarado nao empacotado: ${path}`);
      for (const folder of descriptor.requiredFolders) if (![...paths.keys()].some((path) => path.startsWith(folder))) throw failure(`Pasta declarada nao empacotada: ${folder}`);
      for (const [path, file] of paths) {
        const bytes = path === approval.manifestPath ? xml : await read(root, path, activeSignal, Math.min(file.bytes + 1, 10 * 1024 * 1024));
        check();
        if (bytes.byteLength !== file.bytes || await sha256(bytes) !== file.sha256) throw failure(`Integridade do arquivo divergente: ${path}`);
      }
      const meta = JSON.parse(descriptor.manifestJson);
      meta.miniJoomla = { ...meta.miniJoomla, rootId: root.id, fingerprint: approval.fingerprint, inventoryHash: root.inventoryHash };
      return { ...descriptor, manifestJson: JSON.stringify(meta) };
    });
  }

  async function verify(candidate, { signal } = {}) {
    const approval = approvals.get(candidate?.candidateId);
    if (!approval) throw failure('Candidato ausente ou obsoleto; execute nova descoberta.');
    return verifyApproval(approval, signal);
  }

  async function verifyRevision(metadata, { signal } = {}) {
    const root = rootsById.get(metadata?.rootId);
    if (!root || root.inventoryHash !== metadata.inventoryHash || !HEX.test(metadata.fingerprint)) throw failure('Raiz anterior nao esta aprovada para reversao.');
    const descriptor = await verifyApproval({ rootId: root.id, manifestPath: metadata.manifestPath, fingerprint: metadata.fingerprint, key: metadata.key }, signal);
    return descriptor;
  }

  async function scan(options) { return (await scanReport(options)).entries; }
  async function scanUnregistered(registered, options) {
    const keys = new Set((registered ?? []).map((row) => row.key));
    return (await scan(options)).filter((entry) => !keys.has(entry.key));
  }
  return Object.freeze({ scanReport, scan, scanUnregistered, verify, verifyRevision });
}
