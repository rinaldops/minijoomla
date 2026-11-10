/*
 * PRIVATE, read-only migration preview. Reports contain exact persisted values:
 * do not log/publish them. See docs/CONTRATOS-EVOLUCAO-XML.md, section 4.
 * `ready` means locally convertible, NOT approved to write or activate.
 * Only own JSON data is accepted (no accessors, toJSON, callbacks or proxies as
 * a supported input contract). XML is supplied as text, never a verified UI
 * descriptor. The caller must explicitly declare completeInstances: true and
 * supply full relevant rows, including disabled/trashed rows, with strong ETags.
 * Remote completeness, authenticity, uniqueness and package approval remain
 * unproven. No executor, remote apply, rollback or fabricated XML revision exists.
 * SPMIDDLE's own non-enumerable data `etag` is captured as enumerable snapshot
 * data; every other non-enumerable property/accessor remains unsupported.
 * This increment accepts extension-specific params only: XML/legacy schemas
 * redeclaring MODULE_ADVANCED_PARAMS (including native XML) are refused, not
 * silently deduplicated. Advanced saved settings themselves are retained.
 */
import { ValidationError } from '../core/contracts.js';
import { normalizeParamDefinitions, normalizeParamValues, parseJsonObject } from './declared-params.js';
import { MODULE_ADVANCED_PARAMS } from './module-catalog.js';
import { JOOMLA_PROFILE, parseJoomlaManifest } from './joomla-manifest.js';

const NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const RESERVED = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
const ADVANCED = new Set(MODULE_ADVANCED_PARAMS.map(({ name }) => name));
const NUMBER_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const own = (object, key) => Object.hasOwn(object, key);
const fail = (message) => { throw new ValidationError(message); };
const clone = (value, field = 'Snapshot') => parseJsonObject(value, { strict: true, field });

function captureRowEtag(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || ![Object.prototype, null].includes(Object.getPrototypeOf(row))) return row;
  const descriptors = Object.getOwnPropertyDescriptors(row);
  const etag = Object.getOwnPropertyDescriptor(row, 'etag');
  if (!etag || etag.enumerable || !own(etag, 'value')) return row;
  // Only this one storage-adapter data attribute gets an enumerable snapshot.
  // Preserve all other descriptors, so strict clone still rejects accessors,
  // hidden fields, symbols and unsupported values. Never read row.etag here.
  descriptors.etag = { ...etag, enumerable: true };
  return Object.defineProperties(Object.create(Object.getPrototypeOf(row)), descriptors);
}

function captureInput(input) {
  if (![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('Entradas devem conter somente propriedades próprias de dados.');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (own(descriptors, 'extension') && own(descriptors.extension, 'value')) descriptors.extension.value = captureRowEtag(descriptors.extension.value);
  if (own(descriptors, 'instances') && own(descriptors.instances, 'value') && Array.isArray(descriptors.instances.value)) {
    const entries = Object.getOwnPropertyDescriptors(descriptors.instances.value);
    for (const key of Object.keys(entries)) if (/^(0|[1-9][0-9]*)$/.test(key) && own(entries[key], 'value')) entries[key].value = captureRowEtag(entries[key].value);
    descriptors.instances.value = Object.defineProperties([], entries);
  }
  return clone(Object.defineProperties(Object.create(Object.getPrototypeOf(input)), descriptors), 'Entradas');
}

function freeze(value, seen = new Set()) {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    // Shared normalizers/parser shallow-freeze definitions/descriptors. Their
    // nested options/defaults must still be frozen before returning this report.
    for (const key of Object.keys(value)) freeze(value[key], seen);
    Object.freeze(value);
  }
  return value;
}

// Inputs have already been strict-cloned, so equality never invokes user code.
function equal(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left), other = Object.keys(right);
  return keys.length === other.length && keys.every((key) => own(right, key) && equal(left[key], right[key]));
}

function required(object, fields, label) {
  for (const field of fields) if (!own(object, field)) fail(`${label}: snapshot parcial (${field} ausente).`);
}

function rowSnapshot(row, fields, label) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`${label}: registro deve ser um objeto de dados.`);
  required(row, ['id', 'etag', 'enabled', ...fields], label);
  if (!Number.isSafeInteger(row.id) || row.id < 1) fail(`${label}: id deve ser um inteiro positivo, sem coerção.`);
  // RFC entity-tag, strong and singular. No *, weak tags or comma-separated list.
  if (typeof row.etag !== 'string' || !/^"[\x21\x23-\x7e\x80-\xff]*"$/.test(row.etag)) fail(`${label}: ETag forte e específico obrigatório.`);
  if (typeof row.enabled !== 'boolean') fail(`${label}: enabled deve ser booleano.`);
  if (own(row, 'status') && ['unsupported', 'skipped', 'conflict', 'invalid'].includes(row.status)) fail(`${label}: entrada não suportada ou omitida.`);
}

function persisted(object, field) {
  if (typeof object[field] !== 'string') fail(`${field}: snapshot deve conservar a string JSON persistida exata.`);
  if (object[field] === '') fail(`${field}: snapshot vazio não é um objeto JSON válido para migração.`);
  return clone(object[field], field);
}

function definitions(params) {
  const result = normalizeParamDefinitions(params);
  const original = typeof params === 'string' && params !== '' ? JSON.parse(params) : params;
  if (Array.isArray(original)) for (const definition of original) {
    if (typeof definition.name !== 'string' || !NAME.test(definition.name)) fail('Schema contém nome inseguro; normalização silenciosa de nomes não é permitida.');
    for (const [field, max] of [['label', 200], ['description', 500]]) {
      const value = own(definition, field) ? definition[field] : null;
      if (typeof value === 'string' && value.length > max) fail('Schema contém metadados que exigiriam truncamento; corrija explicitamente.');
    }
  }
  for (const { name } of result) if (RESERVED.has(name) || ADVANCED.has(name)) fail('Schema contém nome reservado ou conflito com parâmetros avançados.');
  return result;
}

function parameterMappings(map, source, target, settings) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) fail('parameterMap deve ser um objeto de nomes explícitos.');
  const destinations = new Set();
  for (const [from, to] of Object.entries(map)) {
    if (!NAME.test(from) || RESERVED.has(from) || ADVANCED.has(from) || typeof to !== 'string' || !NAME.test(to) || RESERVED.has(to) || ADVANCED.has(to)) fail('Mapeamento contém nome inseguro ou destino não textual.');
    if (!source.some(({ name }) => name === from) && !settings.some((value) => own(value, from))) fail('Mapeamento contém origem desconhecida.');
    if (!target.some(({ name }) => name === to)) fail('Mapeamento contém destino não declarado pelo XML.');
    if (destinations.has(to)) fail('Mapeamento ambíguo: destinos duplicados.');
    destinations.add(to);
    if (from !== to && (own(map, to) || source.some(({ name }) => name === to) || settings.some((value) => own(value, to)))) fail('Mapeamento ambíguo: cadeia, ciclo ou colisão com campo existente.');
  }
  return Object.entries(map).filter(([from, to]) => from !== to).map(([from, to]) => ({ from, to }));
}

function renamed(values, renames) {
  const result = clone(values);
  for (const { from, to } of renames) if (own(values, from)) {
    Object.defineProperty(result, to, { value: result[from], enumerable: true, configurable: true, writable: true });
    delete result[from];
  }
  return result;
}

function conservativeValue(definition, value) {
  // Use the shared validator, but don't accept its free simple-value coercion.
  // Canonical historical string numbers/checkboxes and structured JSON strings
  // are allowed only as explicitly reported conversions requiring review.
  if (definition.type === 'number' && !(typeof value === 'number' || typeof value === 'string' && NUMBER_TEXT.test(value) || value === null && !own(definition, 'default'))) fail(`${definition.name}: requer valor numérico corrigido explicitamente.`);
  if (!['number', 'checkbox', 'json'].includes(definition.type) && typeof value !== 'string') fail(`${definition.name}: requer valor textual corrigido explicitamente.`);
}

function normalized(defs, values) {
  const output = clone(values), errors = [], conversions = [];
  for (const definition of defs) {
    try {
      if (own(values, definition.name)) conservativeValue(definition, values[definition.name]);
      const entry = normalizeParamValues([definition], values);
      if (own(entry, definition.name)) {
        Object.defineProperty(output, definition.name, { value: entry[definition.name], enumerable: true, configurable: true, writable: true });
        if (own(values, definition.name) && !equal(values[definition.name], entry[definition.name])) conversions.push({ name: definition.name, before: values[definition.name], after: entry[definition.name] });
      }
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      errors.push({ name: definition.name, reason: error.message });
    }
  }
  return { values: errors.length ? null : output, errors, conversions };
}

function schemaChanges(source, target, renames) {
  const changes = [], consumed = new Set();
  for (const before of source) {
    const name = renames.find(({ from }) => from === before.name)?.to ?? before.name;
    const after = target.find((definition) => definition.name === name);
    if (!after) { changes.push({ kind: 'removed-declaration', name: before.name, before, unknownValuesPreserved: true }); continue; }
    consumed.add(name);
    if (name !== before.name) changes.push({ kind: 'rename', from: before.name, to: name });
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !['name', 'label', 'description'].includes(key));
    for (const field of fields) if (own(before, field) !== own(after, field) || !equal(before[field], after[field])) changes.push({ kind: field === 'default' ? 'default' : 'contract', name, field,
      before: own(before, field) ? { present: true, value: before[field] } : { present: false },
      after: own(after, field) ? { present: true, value: after[field] } : { present: false } });
  }
  for (const after of target) if (!consumed.has(after.name)) changes.push({ kind: 'added-declaration', name: after.name, after });
  return changes;
}

function instanceChanges(before, after, sourceEffective, targetEffective, renames) {
  const changes = [];
  for (const { from, to } of renames) if (own(before, from)) changes.push({ kind: 'rename', from, to, value: before[from] });
  const mappedBefore = renamed(before, renames);
  for (const name of new Set([...Object.keys(mappedBefore), ...Object.keys(after)])) {
    if (own(mappedBefore, name) !== own(after, name) || !equal(mappedBefore[name], after[name])) changes.push({ kind: own(mappedBefore, name) ? 'value' : 'default-added', name,
      before: own(mappedBefore, name) ? { present: true, value: mappedBefore[name] } : { present: false },
      after: own(after, name) ? { present: true, value: after[name] } : { present: false } });
  }
  const oldEffective = renamed(sourceEffective, renames);
  for (const name of new Set([...Object.keys(oldEffective), ...Object.keys(targetEffective)])) {
    if (!own(mappedBefore, name) && (own(oldEffective, name) !== own(targetEffective, name) || !equal(oldEffective[name], targetEffective[name]))) changes.push({ kind: 'effective-default', name,
      before: own(oldEffective, name) ? { present: true, value: oldEffective[name] } : { present: false },
      after: own(targetEffective, name) ? { present: true, value: targetEffective[name] } : { present: false } });
  }
  return changes;
}

/**
 * planExtensionMigration({ extension, instances, completeInstances: true,
 *   targetXml: string, target: { baseUrl, manifestPath }, parameterMap?: {} })
 * No parameterEdits in this increment: incompatible values require a new,
 * explicitly corrected snapshot/assisted-edit flow, not edits to this plan.
 */
export function planExtensionMigration(input) {
  const report = { ready: false, convertible: false, reason: null, sourceKind: null, changes: { extension: null, instances: [] },
    snapshots: null, target: null, packageVerified: false, executionAvailable: false,
    completenessDeclared: false, remoteCompletenessProven: false, snapshotsAuthenticityProven: false,
    requiresExplicitReview: true, containsConversions: false, containsPrivateSnapshots: true };
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Entradas devem ser um objeto próprio de snapshots, não JSON serializado.');
    const options = captureInput(input);
    required(options, ['extension', 'instances', 'completeInstances', 'targetXml', 'target'], 'Entradas');
    if (Object.keys(options).some((key) => !['extension', 'instances', 'completeInstances', 'targetXml', 'target', 'parameterMap'].includes(key))) fail('Opção não suportada: prévia aceita somente dados e XML local.');
    if (options.completeInstances !== true) fail('completeInstances: true é obrigatório; incluir instâncias desabilitadas e na lixeira.');
    report.completenessDeclared = true;
    const { extension, instances, targetXml, target } = options;
    rowSnapshot(extension, ['key', 'type', 'entryPointUrl', 'manifestJson'], 'Extensão');
    if (extension.type !== 'Module' || typeof extension.key !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(extension.key)) fail('Extensão deve conservar type Module e key válida.');
    if (typeof extension.entryPointUrl !== 'string' || !extension.entryPointUrl) fail('Extensão: referência do pacote anterior ausente.');
    if (!Array.isArray(instances)) fail('instances deve ser uma lista completa de registros.');
    const ids = new Set();
    for (const row of instances) {
      rowSnapshot(row, ['extensionKey', 'settingsJson'], 'Instância');
      if (row.extensionKey !== extension.key || own(row, 'type') && row.type !== 'Module') fail('Instância com type ou extensionKey divergente; nenhuma entrada é ignorada.');
      if (ids.has(row.id)) fail('IDs de instâncias duplicados.');
      ids.add(row.id);
      if (own(row, 'trashed') && row.trashed !== null && typeof row.trashed !== 'boolean') fail('Instância: trashed deve ser booleano ou null legado.');
    }
    report.snapshots = { extension, instances };
    report.instanceCounts = { total: instances.length, disabled: instances.filter((row) => !row.enabled).length,
      trashed: instances.filter((row) => row.trashed === true || row.state === 'Trashed').length };
    const metadata = persisted(extension, 'manifestJson');
    const settings = instances.map((row) => persisted(row, 'settingsJson'));
    if (typeof targetXml !== 'string' || !target || typeof target !== 'object' || Array.isArray(target)) fail('Alvo requer texto XML local e caminhos próprios; descriptor não é verificação.');
    required(target, ['baseUrl', 'manifestPath'], 'Alvo');
    if (Object.keys(target).some((key) => !['baseUrl', 'manifestPath'].includes(key))) fail('Alvo não aceita descriptor ou alegação de pacote verificado.');
    const descriptor = parseJoomlaManifest(targetXml, { ...target, strictMetadata: true });
    const installedRuntime = own(metadata, 'miniJoomla') ? metadata.miniJoomla : null;
    if (own(metadata, 'miniJoomla') && (!installedRuntime || typeof installedRuntime !== 'object' || Array.isArray(installedRuntime))) fail('Identidade instalada corrompida.');
    if (extension.key !== descriptor.key || extension.type !== descriptor.type
      || own(metadata, 'key') && metadata.key !== extension.key || own(metadata, 'type') && metadata.type !== extension.type
      || installedRuntime && own(installedRuntime, 'identity') && installedRuntime.identity !== descriptor.identity
      || installedRuntime && own(installedRuntime, 'key') && installedRuntime.key !== extension.key) fail('Migração não pode mudar identidade, type ou key instalados.');
    report.sourceKind = installedRuntime && own(installedRuntime, 'profile') && installedRuntime.profile === JOOMLA_PROFILE ? 'joomla-xml' : 'legacy-json';
    report.target = { xml: targetXml, baseUrl: target.baseUrl, manifestPath: target.manifestPath, descriptor,
      metadata: clone(descriptor.manifestJson), packageVerified: false };
    const sourceParams = definitions(own(metadata, 'params') ? metadata.params : []);
    const targetParams = definitions(descriptor.params);
    const map = own(options, 'parameterMap') ? options.parameterMap : {};
    const renames = parameterMappings(map, sourceParams, targetParams, settings);
    const sourceDefs = [...sourceParams, ...MODULE_ADVANCED_PARAMS], targetDefs = [...targetParams, ...MODULE_ADVANCED_PARAMS];
    report.changes.extension = { id: extension.id, etag: extension.etag,
      entryPointUrl: { before: extension.entryPointUrl, after: descriptor.entryPointUrl },
      metadataBefore: metadata, schema: schemaChanges(sourceParams, targetParams, renames),
      sourceParams, targetParams, previousXmlRevisionAvailable: false };
    for (let index = 0; index < instances.length; index++) {
      const row = instances[index], before = settings[index], mapped = renamed(before, renames);
      const source = normalized(sourceDefs, before), next = normalized(targetDefs, mapped);
      const errors = [...source.errors.map((error) => ({ ...error, stage: 'source' })), ...next.errors.map((error) => ({ ...error, stage: 'target' }))];
      const item = { id: row.id, etag: row.etag, before, after: errors.length ? null : next.values,
        compatible: !errors.length, errors, changes: [], historicalNormalizations: source.conversions,
        targetConversions: next.conversions, retainedUnknownNames: Object.keys(mapped).filter((name) => !targetDefs.some((definition) => definition.name === name)) };
      if (!errors.length) item.changes = instanceChanges(before, next.values, source.values, next.values, renames);
      report.containsConversions ||= source.conversions.length > 0 || next.conversions.length > 0;
      report.changes.instances.push(item);
    }
    if (report.changes.instances.some((item) => !item.compatible)) fail('Valores incompatíveis requerem edição assistida explícita e nova validação; nenhuma conversão foi aprovada.');
    report.ready = report.convertible = true;
  } catch (error) {
    // Never expose arbitrary caller-thrown errors or stringify caller values.
    report.reason = error instanceof ValidationError ? error.message : 'Entradas não suportadas; nenhuma alteração foi executada.';
  }
  return freeze(report);
}
