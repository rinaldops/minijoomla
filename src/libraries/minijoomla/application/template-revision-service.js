import { ValidationError, ownDataValue } from '../core/contracts.js';
import { extensionKey, sameSiteModuleUrl, templatePositions } from './extension-input.js';
import { normalizeParamDefinitions, parseJsonObject } from './declared-params.js';
import { readTemplateMetadata } from './template-metadata.js';
import { parseTemplateStyles } from './template-styles.js';
import { readHomeShowComponent } from './home-settings.js';
import { packageAsset, packageBase, packagePath } from './package-path.js';

const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const HASH = /^[a-f0-9]{64}$/i;
const MAX_TOTAL = 10 * 1024 * 1024;
// Bound session retention by count, including prepare() calls awaiting I/O.
// Never evict pending plans or usable rollback receipts to admit new work.
const MAX_PENDING = 16;
const MAX_TOMBSTONES = 128;
const encoder = new TextEncoder();
class RevisionError extends Error {
  constructor(reason, message) { super(message); this.reason = reason; }
}
function fail(reason, message) { throw new RevisionError(reason, message); }
function requireValue(condition, message) { if (!condition) fail('validation-failed', message); }
const field = (object, key) => ownDataValue(object, key);

// Copy JSON data, not serialization hooks. Strings (including legacy wire JSON)
// remain strings; reserved own keys are copied as data, never as prototypes.
function clone(value, seen = new Set(), depth = 0, budget = { nodes: 0 }) {
  requireValue(depth <= 32 && ++budget.nodes <= 50000, 'JSON excede limites de estrutura.');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const array = Array.isArray(value);
  requireValue(value && typeof value === 'object' && !seen.has(value)
    && (array ? Object.getPrototypeOf(value) === Array.prototype
      : [Object.prototype, null].includes(Object.getPrototypeOf(value))), 'Snapshot deve conter somente dados JSON.');
  const keys = Reflect.ownKeys(value);
  requireValue(!array || keys.length === value.length + 1, 'Lista JSON deve ser densa.');
  seen.add(value);
  const result = array ? [] : {};
  for (const key of keys) {
    if (array && key === 'length') continue;
    requireValue(typeof key === 'string' && (!array || /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length), 'Chave JSON inválida.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireValue(descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'Accessors não são dados JSON.');
    Object.defineProperty(result, key, { value: clone(descriptor.value, seen, depth + 1, budget), enumerable: true, writable: true, configurable: true });
  }
  seen.delete(value);
  return result;
}
// SPMIDDLE attaches a frozen, non-enumerable ETag. Capture it as data
// separately, then normalize only this transport property for serializable plans.
function recordSnapshot(value) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'Registro deve conter dados JSON.');
  const tag = etag(field(value, 'etag'));
  const data = {};
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'etag') continue;
    Object.defineProperty(data, key, Object.getOwnPropertyDescriptor(value, key));
  }
  const result = clone(data);
  Object.defineProperty(result, 'etag', { value: tag, enumerable: true, writable: true, configurable: true });
  return result;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const equal = (left, right) => canonical(left) === canonical(right);
function json(value, name) {
  if (typeof value !== 'string') return clone(value);
  try { return clone(JSON.parse(value)); } catch { fail('validation-failed', `${name}: JSON inválido.`); }
}
function etag(value) {
  requireValue(typeof value === 'string' && /^"[^"\u0000-\u001f\u007f]+"$/.test(value), 'ETag específico e forte obrigatório.');
  return value;
}
function tags(value) {
  const copied = clone(value);
  return { template: etag(copied.template), config: etag(copied.config) };
}
function checkCurrent(callback) {
  requireValue(callback === undefined || typeof callback === 'function', 'isCurrent deve ser função.');
  if (callback && callback() !== true) fail('concurrency-conflict', 'Operação deixou de ser atual; nenhuma nova escrita permitida.');
}
function version(value) { requireValue(typeof value === 'string' && VERSION.test(value), 'Versão inválida.'); return value; }
function positions(value) {
  const list = json(value, 'positions');
  requireValue(Array.isArray(list) && equal(list, JSON.parse(templatePositions(list))), 'Posições inválidas ou duplicadas.');
  return list;
}
function definitions(value) {
  const list = value === undefined || value === null || value === '' ? [] : json(value, 'paramDefinitions');
  requireValue(Array.isArray(list), 'paramDefinitions deve ser lista.');
  normalizeParamDefinitions(list); // validate, but compare/preserve the original data
  return list;
}
function metadata(record) {
  const validated = readTemplateMetadata(record);
  let wire = record.styles;
  if (typeof wire === 'string' && /^[\[{]/.test(wire.trim())) wire = json(wire, 'Styles');
  const envelope = wire && typeof wire === 'object' && !Array.isArray(wire) ? wire : null;
  const defs = envelope ? definitions(envelope.paramDefinitions) : definitions(record.paramDefinitionsJson);
  if (envelope && record.paramDefinitionsJson !== undefined && record.paramDefinitionsJson !== null && record.paramDefinitionsJson !== '') {
    requireValue(equal(defs, definitions(record.paramDefinitionsJson)), 'Definições do registro e envelope divergem.');
  }
  return { styles: validated.styles, definitions: defs, envelope };
}
function patchStyles(info, styles) {
  const wire = JSON.stringify(info.envelope ? { ...info.envelope, styles } : styles);
  requireValue(encoder.encode(wire).byteLength <= 64 * 1024, 'Styles excede 64 KiB.');
  return wire;
}
function urlPath(value, webUrl, suffix) {
  requireValue(typeof value === 'string' && value.startsWith('/') && !value.startsWith('//'), 'Asset deve ser server-relative.');
  packagePath(value.slice(1)); // rejects encoded traversal, query/hash and dot segments
  requireValue(webUrl === '/' || value.startsWith(`${webUrl}/`), 'Asset fora do próprio site.');
  requireValue(suffix.test(value), 'Tipo de asset inválido.');
  return value;
}
function immutableBase(value, webUrl, revision) {
  const base = packageBase(value);
  requireValue(base === value && (webUrl === '/' || base.startsWith(`${webUrl}/`)), 'Base fora do site ou não canônica.');
  requireValue(base.split('/').at(-2) === revision, 'Base não corresponde à pasta de versão.');
  return base;
}
function failure(error) {
  const reason = error instanceof RevisionError ? error.reason
    : error instanceof ValidationError || error instanceof TypeError ? 'validation-failed' : 'unavailable';
  return { status: reason, reason, message: error instanceof RevisionError ? error.message : 'Falha ao verificar os dados ou dependências da revisão.' };
}

/** Separate application service: no publication, activation, import of candidate
 * code, SiteConfig write, or AST dependency closure. Receipts are session-bound. */
export function createTemplateRevisionService({ admin, repositories, files, webUrl } = {}) {
  const plans = new Map();
  const receipts = new Map();
  const consumed = new Set(); // Tokens only: terminal snapshots/assets are released.
  let preparing = 0;
  function retire(map, entry) {
    const token = entry.value.token;
    map.delete(token);
    consumed.add(token);
    if (consumed.size > MAX_TOMBSTONES) consumed.delete(consumed.values().next().value);
    // Evicted/unknown tokens still fail closed in registered(); never replay.
  }
  function dependencies() {
    if (typeof admin?.templates?.get !== 'function' || typeof admin?.siteConfig?.get !== 'function'
      || typeof repositories?.templates?.findById !== 'function' || typeof repositories?.templates?.update !== 'function'
      || typeof files?.downloadFile !== 'function' || !globalThis.crypto?.subtle || !globalThis.crypto?.randomUUID) {
      fail('unavailable', 'Dependências de revisão indisponíveis.');
    }
    requireValue(webUrl === '/' || typeof webUrl === 'string' && webUrl.startsWith('/') && !webUrl.endsWith('/'), 'webUrl inválida.');
    if (webUrl !== '/') packagePath(webUrl.slice(1));
  }
  async function bytes(path, isCurrent) {
    checkCurrent(isCurrent);
    const split = path.lastIndexOf('/');
    const response = await files.downloadFile({ folderPath: path.slice(0, split), fileName: path.slice(split + 1) });
    const raw = response instanceof ArrayBuffer || ArrayBuffer.isView(response) ? response : field(response, 'data');
    requireValue(raw instanceof ArrayBuffer || ArrayBuffer.isView(raw), 'Download deve retornar bytes.');
    const data = (raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)).slice();
    requireValue(data.byteLength <= MAX_TOTAL, 'Arquivo excede limite de bytes.');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    checkCurrent(isCurrent);
    return { data, path, bytes: data.byteLength, sha256: Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('') };
  }
  function document(result, limit, name) {
    requireValue(result.bytes <= limit, `${name} excede limite de bytes.`);
    let parsed;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result.data).replace(/^\uFEFF/, '')); }
    catch { fail('validation-failed', `${name} JSON inválido.`); }
    const copied = clone(parsed);
    requireValue(copied && typeof copied === 'object' && !Array.isArray(copied), `${name} deve ser objeto.`);
    return copied;
  }
  async function rows(id, isCurrent) {
    checkCurrent(isCurrent);
    const template = recordSnapshot(await admin.templates.get(id));
    const siteConfig = recordSnapshot(await admin.siteConfig.get());
    requireValue(template && template.id === id && siteConfig && Number.isSafeInteger(siteConfig.id) && siteConfig.id > 0, 'Template/SiteConfig válido obrigatório.');
    requireValue(extensionKey(template.key) === template.key && typeof template.enabled === 'boolean', 'Identidade do template inválida.');
    const expectedETag = { template: etag(template.etag), config: etag(siteConfig.etag) };
    const info = metadata(template);
    positions(template.positionsJson);
    version(template.version);
    if (Object.hasOwn(siteConfig, 'templateKey')) requireValue(extensionKey(siteConfig.templateKey) === siteConfig.templateKey, 'Template ativo inválido.');
    parseTemplateStyles(siteConfig.templateStylesJson, { strict: true, definitionsByKey: { [template.key]: info.definitions } });
    readHomeShowComponent(siteConfig.componentParamsJson);
    for (const name of ['templateParamsJson', 'moduleParamsJson', 'pluginParamsJson']) {
      if (Object.hasOwn(siteConfig, name)) parseJsonObject(siteConfig[name], { strict: true, field: name });
    }
    checkCurrent(isCurrent);
    return { template, siteConfig, expectedETag, info };
  }
  async function legacyAssets(record, isCurrent) {
    const urls = [urlPath(record.entryPointUrl, webUrl, /\.m?js$/i), ...metadata(record).styles.map(style => urlPath(style, webUrl, /\.css$/i))];
    const seen = new Set();
    const assets = [];
    let total = 0;
    for (const path of urls) {
      requireValue(path.split('/').slice(0, -1).includes(record.version), 'Asset legacy sem pasta de versão correspondente.');
      if (seen.has(path.toLowerCase())) continue;
      seen.add(path.toLowerCase());
      const result = await bytes(path, isCurrent);
      total += result.bytes;
      requireValue(total <= MAX_TOTAL, 'Assets legacy excedem limite de bytes.');
      assets.push({ path, bytes: result.bytes, sha256: result.sha256 });
    }
    return assets;
  }
  async function candidateData(input, record, isCurrent) {
    const candidate = clone(input);
    requireValue(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'Candidate obrigatório.');
    packagePath(candidate.manifestPath);
    packagePath(candidate.inventoryPath);
    requireValue(candidate.manifestPath.toLowerCase() !== candidate.inventoryPath.toLowerCase() && typeof candidate.inventoryHash === 'string' && HASH.test(candidate.inventoryHash), 'Manifesto/inventário/pin inválidos.');
    const base = packageBase(candidate.baseUrl);
    requireValue(base === candidate.baseUrl && (webUrl === '/' || base.startsWith(`${webUrl}/`)), 'Base fora do site ou não canônica.');
    const inventoryResult = await bytes(packageAsset(base, candidate.inventoryPath), isCurrent);
    requireValue(inventoryResult.sha256 === candidate.inventoryHash.toLowerCase(), 'Inventário diverge do pin externo.');
    const inventory = document(inventoryResult, 512 * 1024, 'Inventário');
    const manifestResult = await bytes(packageAsset(base, candidate.manifestPath), isCurrent);
    const manifest = document(manifestResult, 64 * 1024, 'Manifesto');
    requireValue(extensionKey(manifest.key) === manifest.key && manifest.key === record.key, 'Key do manifesto diferente do registro.');
    version(manifest.version);
    requireValue(manifest.version !== record.version, 'Revisão deve usar uma nova versão.');
    immutableBase(base, webUrl, manifest.version);
    requireValue(typeof manifest.title === 'string' && !!manifest.title.trim(), 'Título obrigatório.');
    const slots = positions(manifest.positions);
    const defs = definitions(manifest.paramDefinitions);
    requireValue(equal(slots, positions(record.positionsJson)) && equal(defs, metadata(record).definitions), 'Revisão altera posições/paramDefinitions.');
    const entryPointUrl = urlPath(manifest.entryPointUrl, webUrl, /\.m?js$/i);
    sameSiteModuleUrl(entryPointUrl);
    requireValue(Array.isArray(manifest.styles) && manifest.styles.length <= 50, 'Styles deve ser lista CSS.');
    const styles = manifest.styles.map(style => urlPath(style, webUrl, /\.css$/i));
    requireValue(new Set(styles.map(style => style.toLowerCase())).size === styles.length, 'Styles duplicados.');
    for (const path of [entryPointUrl, ...styles]) requireValue(path.startsWith(base), 'Asset fora da base aprovada.');
    requireValue(inventory.version === manifest.version && (inventory.algorithm === undefined || inventory.algorithm === 'sha256'), 'Versão/algoritmo do inventário inválido.');
    requireValue(Array.isArray(inventory.files) && inventory.files.length > 0 && inventory.files.length <= 500, 'Inventário deve ter 1 a 500 arquivos.');
    const expected = new Map();
    let total = 0;
    for (const item of inventory.files) {
      requireValue(item && typeof item === 'object' && !Array.isArray(item), 'Entrada de inventário inválida.');
      packagePath(item.path);
      requireValue(item.path.toLowerCase() !== candidate.inventoryPath.toLowerCase() && !expected.has(item.path.toLowerCase()), 'Inventário autorreferente ou path duplicado.');
      requireValue(Number.isSafeInteger(item.bytes) && item.bytes >= 0 && typeof item.sha256 === 'string' && HASH.test(item.sha256), 'Tamanho/hash inválido.');
      total += item.bytes;
      requireValue(total <= MAX_TOTAL, 'Inventário excede 10 MiB.');
      expected.set(item.path.toLowerCase(), item);
    }
    for (const path of [packageAsset(base, candidate.manifestPath), entryPointUrl, ...styles]) {
      const item = expected.get(path.slice(base.length).toLowerCase());
      requireValue(item && packageAsset(base, item.path) === path, 'Manifesto/entrypoint/style ausente do inventário exato.');
    }
    const assets = [];
    for (const item of expected.values()) {
      const path = packageAsset(base, item.path);
      const result = path === manifestResult.path ? manifestResult : await bytes(path, isCurrent);
      requireValue(result.bytes === item.bytes && result.sha256 === item.sha256.toLowerCase(), 'Bytes/hash de asset divergem do inventário.');
      assets.push({ path, bytes: result.bytes, sha256: result.sha256 });
    }
    return { candidate, manifest, assets, after: { version: manifest.version, entryPointUrl, styles: patchStyles(metadata(record), styles) } };
  }
  function unchanged(actual, expected, message) {
    if (!equal(actual, expected)) fail('concurrency-conflict', message);
  }
  async function freshRows(id, expected, isCurrent) {
    const fresh = await rows(id, isCurrent);
    unchanged(fresh.template, expected.template, 'Template mudou desde o snapshot.');
    unchanged(fresh.siteConfig, expected.siteConfig, 'SiteConfig mudou desde o snapshot.');
    return fresh;
  }
  function registered(map, provided, phase) {
    const copied = clone(provided);
    if (consumed.has(copied?.token)) fail('concurrency-conflict', 'Operação consumida; não repetir.');
    const entry = map.get(copied?.token);
    requireValue(entry && equal(entry.value, copied), 'Plano/receipt não pertence à sessão ou foi alterado.');
    if (entry.phase !== phase) fail('concurrency-conflict', 'Operação consumida ou em andamento; não repetir.');
    return entry;
  }
  function replaceRelease(record, patch, newTag) { return { ...record, ...patch, etag: newTag }; }

  async function prepare(input = {}) {
    let reserved = false;
    try {
      dependencies();
      if (plans.size + receipts.size + preparing >= MAX_PENDING) {
        fail('unavailable', 'Limite de 16 operações pendentes nesta sessão; nenhum plano/rollback foi descartado.');
      }
      // Reserve synchronously before the first await: parallel prepares share the cap.
      preparing++; reserved = true;
      const id = field(input, 'templateId'), isCurrent = field(input, 'isCurrent');
      requireValue(Number.isSafeInteger(id) && id > 0, 'templateId deve ser inteiro positivo.');
      const before = await rows(id, isCurrent);
      const candidate = await candidateData(field(input, 'candidate'), before.template, isCurrent);
      const assets = await legacyAssets(before.template, isCurrent);
      await freshRows(id, before, isCurrent);
      const snapshot = { template: before.template, siteConfig: before.siteConfig, assets };
      const plan = clone({ token: crypto.randomUUID(), candidate: candidate.candidate, manifest: candidate.manifest,
        candidateAssets: candidate.assets, after: candidate.after, snapshot, expectedETag: before.expectedETag });
      plans.set(plan.token, { value: clone(plan), phase: 'ready' });
      return { status: 'ready', reason: 'ready', plan: clone(plan), snapshot: clone(snapshot), expectedETag: clone(before.expectedETag) };
    } catch (error) { return failure(error); }
    finally { if (reserved) preparing--; }
  }

  // Once dispatch starts, ALL failures (including null/204 or lost responses)
  // are indeterminate, regardless of a favorable readback. No automatic replay.
  async function write(id, patch, before, expected, isCurrent, onDispatch) {
    await freshRows(id, { template: before, siteConfig: expected.siteConfig }, isCurrent);
    checkCurrent(isCurrent);
    const payload = clone(patch);
    let response, fresh, thrown;
    onDispatch();
    try { response = await repositories.templates.update(id, payload, { etag: before.etag }); }
    catch (error) { thrown = error; }
    try { fresh = recordSnapshot(await admin.templates.get(id)); } catch (error) { thrown = error; }
    try {
      requireValue(!thrown && response && typeof response === 'object' && !Array.isArray(response)
        && field(response, 'status') !== 204, 'Resposta de escrita indeterminada.');
      requireValue(fresh && fresh.id === id && etag(fresh.etag) !== before.etag, 'Readback exige novo ETag.');
      requireValue(equal(fresh, replaceRelease(before, patch, fresh.etag)), 'Readback alterou campos além do patch ou não confirma revisão.');
      if (field(response, 'id') !== undefined) requireValue(field(response, 'id') === id, 'Resposta aponta para outro registro.');
      const config = recordSnapshot(await admin.siteConfig.get());
      requireValue(equal(config, expected.siteConfig), 'SiteConfig mudou após dispatch (sem transação cross-list).');
      checkCurrent(isCurrent);
    } catch { fail('uncertain', 'Readback/concurrency pós-dispatch não confirmado; não repetir.'); }
    return fresh;
  }

  async function commit(input = {}) {
    let entry, dispatched = false;
    try {
      dependencies();
      if (field(input, 'confirm') !== true) fail('confirmation-required', 'Confirmação explícita obrigatória.');
      entry = registered(plans, field(input, 'plan'), 'ready');
      const plan = entry.value, isCurrent = field(input, 'isCurrent');
      const expected = tags(field(input, 'expectedETag'));
      unchanged(expected, plan.expectedETag, 'ETags diferentes do plano aprovado.');
      entry.phase = 'validating';
      const before = await freshRows(plan.snapshot.template.id, plan.snapshot, isCurrent);
      const candidate = await candidateData(plan.candidate, before.template, isCurrent);
      unchanged(candidate.manifest, plan.manifest, 'Manifesto mudou desde prepare.');
      unchanged(candidate.assets, plan.candidateAssets, 'Assets candidatos mudaram desde prepare.');
      unchanged(candidate.after, plan.after, 'Patch mudou desde prepare.');
      unchanged(await legacyAssets(before.template, isCurrent), plan.snapshot.assets, 'Bytes legacy mudaram desde prepare.');
      await freshRows(before.template.id, plan.snapshot, isCurrent);
      checkCurrent(isCurrent);
      const fresh = await write(before.template.id, plan.after, before.template, before, isCurrent, () => {
        entry.phase = 'dispatched'; dispatched = true;
      });
      entry.phase = 'committed';
      const rollback = clone({ token: crypto.randomUUID(), plan, postUpdateETag: fresh.etag, postTemplate: fresh,
        expectedETag: { template: fresh.etag, config: before.siteConfig.etag } });
      const retained = { value: clone(rollback), phase: 'ready' };
      retire(plans, entry); // Transfer one pending slot, preserving the rollback.
      receipts.set(rollback.token, retained);
      return { status: 'committed', reason: 'committed', plan: clone(plan), committedAt: new Date().toISOString(), postUpdateETag: fresh.etag, rollback: clone(rollback) };
    } catch (error) {
      if (entry?.phase === 'validating') entry.phase = 'ready';
      if (dispatched) {
        entry.phase = 'uncertain'; retire(plans, entry);
        return failure(new RevisionError('uncertain', 'Escrita/readback indeterminado; plano consumido, sem retry automático.'));
      }
      return failure(error);
    }
  }

  async function rollback(input = {}) {
    let entry, dispatched = false;
    try {
      dependencies();
      if (field(input, 'confirm') !== true) fail('confirmation-required', 'Confirmação explícita obrigatória.');
      entry = registered(receipts, field(input, 'rollback'), 'ready');
      const receipt = entry.value, plan = receipt.plan, isCurrent = field(input, 'isCurrent');
      unchanged(tags(field(input, 'expectedETag')), receipt.expectedETag, 'ETags diferentes do receipt próprio.');
      entry.phase = 'validating';
      const before = await freshRows(plan.snapshot.template.id, { template: receipt.postTemplate, siteConfig: plan.snapshot.siteConfig }, isCurrent);
      // Validate the pinned candidate against the original contract/version,
      // not against the post-update version (which would reject its own release).
      const candidate = await candidateData(plan.candidate, plan.snapshot.template, isCurrent);
      unchanged(candidate.manifest, plan.manifest, 'Manifesto candidato mudou desde commit.');
      unchanged(candidate.assets, plan.candidateAssets, 'Bytes candidatos mudaram desde commit.');
      unchanged(await legacyAssets(plan.snapshot.template, isCurrent), plan.snapshot.assets, 'Bytes de rollback legacy mudaram.');
      const original = plan.snapshot.template;
      const patch = { version: original.version, entryPointUrl: original.entryPointUrl, styles: original.styles };
      await freshRows(original.id, { template: receipt.postTemplate, siteConfig: plan.snapshot.siteConfig }, isCurrent);
      checkCurrent(isCurrent);
      const fresh = await write(original.id, patch, before.template, before, isCurrent, () => {
        entry.phase = 'dispatched'; dispatched = true;
      });
      entry.phase = 'rolled-back'; retire(receipts, entry);
      return { status: 'rolled-back', reason: 'rolled-back', rollbackETag: fresh.etag };
    } catch (error) {
      if (entry?.phase === 'validating') entry.phase = 'ready';
      if (dispatched) {
        entry.phase = 'uncertain'; retire(receipts, entry);
        return failure(new RevisionError('uncertain', 'Rollback indeterminado; receipt consumido, sem retry automático.'));
      }
      return failure(error);
    }
  }
  return Object.freeze({ prepare, commit, rollback });
}
