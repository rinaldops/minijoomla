import { ValidationError } from '../core/contracts.js';
import { normalizeParamDefinitions, normalizeParamValues } from './declared-params.js';
import { MODULE_ADVANCED_PARAMS } from './module-catalog.js';

const conflict = (message) => Object.assign(new ValidationError(message), { code: 'concurrency-conflict' });

function metadata(row) {
  try {
    const data = JSON.parse(row.manifestJson || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new ValidationError('Metadados instalados invalidos; nenhum dado foi alterado.'); }
}

function etagSnapshot(row, expected) {
  if (!row || typeof expected !== 'string' || !expected.trim() || expected === '*' || row.etag !== expected) throw conflict('Registro alterado; recarregue antes de continuar.');
}

function requireIdentity(row, descriptor) {
  const old = metadata(row).miniJoomla;
  if (row.type !== 'Module' || row.key !== descriptor.key || (old?.identity && old.identity !== descriptor.identity)) throw new ValidationError('Atualizacao nao pode mudar a identidade instalada.');
}

function validationContract(params) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  return JSON.stringify(normalizeParamDefinitions(params).map(({ label: _label, description: _description, options, ...definition }) =>
    canonical({ ...definition, ...(options ? { options: options.map((option) => option.value) } : {}) }))
    .sort((left, right) => left.name.localeCompare(right.name)));
}

function requireCompatibleParams(row, descriptor) {
  // SharePoint has no transaction spanning extensions and their instances.
  // Identical validation contracts keep in-flight old-schema saves valid too.
  if (validationContract(metadata(row).params ?? []) !== validationContract(descriptor.params)) throw new ValidationError('Mudanca no contrato de parametros requer migracao assistida; atualizacao automatica bloqueada.');
}

/** The transport must enforce uniqueness atomically; client preflight is not a lock. */
export function createJoomlaExtensionInstaller({ discovery, admin, repositories, assertAtomicKey } = {}) {
  if (!discovery?.verify || !admin?.extensions || !repositories?.extensions) throw new TypeError('Composicao do instalador XML invalida.');
  const repository = repositories.extensions;

  async function installedForKey(key) {
    const rows = await admin.extensions.list();
    const matches = rows.filter((row) => row.key === key);
    if (matches.length > 1) throw conflict('Chave instalada duplicada; corrija a integridade do catalogo.');
    return matches.length ? admin.extensions.get(matches[0].id) : null;
  }

  async function install(candidate, options = {}) {
    const descriptor = await discovery.verify(candidate, options);
    const current = await installedForKey(descriptor.key);
    if (current) {
      requireIdentity(current, descriptor);
      if (current.entryPointUrl === descriptor.entryPointUrl && metadata(current).miniJoomla?.fingerprint === candidate.fingerprint) return current;
      throw conflict('Modulo ja instalado; use a acao Atualizar.');
    }
    if (typeof assertAtomicKey !== 'function' || await assertAtomicKey() !== true) throw new ValidationError('Instalacao bloqueada: unicidade de Key nao foi comprovada no armazenamento.');
    const rows = await admin.extensions.list();
    if (rows.some((row) => metadata(row).miniJoomla?.identity === descriptor.identity && row.key !== descriptor.key)) throw conflict('Identidade ja instalada com outra chave.');
    try {
      return await admin.extensions.create({ key: descriptor.key, type: descriptor.type, title: descriptor.title,
        entryPointUrl: descriptor.entryPointUrl, manifestJson: descriptor.manifestJson,
        discoveredFrom: candidate.discoveredFrom, enabled: false });
    } catch (error) {
      const raced = await installedForKey(descriptor.key);
      if (raced && raced.entryPointUrl === descriptor.entryPointUrl && metadata(raced).miniJoomla?.fingerprint === candidate.fingerprint) return raced;
      throw error;
    }
  }

  async function validateInstances(key, descriptor) {
    const instances = await admin.moduleInstances.list();
    for (const row of instances.filter((item) => item.extensionKey === key)) {
      let settings;
      try { settings = JSON.parse(row.settingsJson || '{}'); } catch { throw new ValidationError('Configuracao de instancia invalida; atualizacao cancelada.'); }
      normalizeParamValues([...descriptor.params, ...MODULE_ADVANCED_PARAMS], settings, { keepUndeclared: true });
    }
  }

  async function upgrade(id, candidate, { etag, signal } = {}) {
    const current = await admin.extensions.get(id);
    etagSnapshot(current, etag);
    const descriptor = await discovery.verify(candidate, { signal });
    requireIdentity(current, descriptor);
    requireCompatibleParams(current, descriptor);
    await validateInstances(current.key, descriptor);
    const before = metadata(current);
    if (!before.miniJoomla?.fingerprint || !before.miniJoomla?.inventoryHash) throw new ValidationError('Modulo JSON legado requer migracao assistida; atualizacao XML sem revisao reversivel foi bloqueada.');
    // Revalidate the old immutable package before recording a rollback target.
    const previous = await discovery.verifyRevision(before.miniJoomla, { signal });
    if (previous.entryPointUrl !== current.entryPointUrl) throw new ValidationError('Revisao instalada diverge do pacote aprovado.');
    if (before.miniJoomla) {
      const { previousRevision: _previous, ...priorRuntime } = before.miniJoomla;
      before.miniJoomla = priorRuntime;
    }
    const replacement = JSON.parse(descriptor.manifestJson);
    const merged = { ...before, ...replacement, miniJoomla: { ...replacement.miniJoomla,
      previousRevision: { entryPointUrl: current.entryPointUrl, manifest: before } } };
    // The captured ETag is deliberately not replaced after verifying package bytes.
    return repository.update(id, { entryPointUrl: descriptor.entryPointUrl, manifestJson: JSON.stringify(merged) }, { etag });
  }

  async function rollback(id, { etag, signal } = {}) {
    const current = await admin.extensions.get(id);
    etagSnapshot(current, etag);
    const prior = metadata(current).miniJoomla?.previousRevision;
    if (!prior?.manifest?.miniJoomla) throw new ValidationError('Nao ha revisao XML anterior disponivel para reverter.');
    const descriptor = await discovery.verifyRevision(prior.manifest.miniJoomla, { signal });
    requireIdentity(current, descriptor);
    requireCompatibleParams(current, descriptor);
    if (descriptor.entryPointUrl !== prior.entryPointUrl) throw new ValidationError('A revisao anterior nao corresponde ao pacote aprovado.');
    await validateInstances(current.key, descriptor);
    return repository.update(id, { entryPointUrl: prior.entryPointUrl, manifestJson: JSON.stringify(prior.manifest) }, { etag });
  }

  async function remove(id, options) { return admin.extensions.remove(id, options); }
  return Object.freeze({ install, upgrade, rollback, remove });
}
