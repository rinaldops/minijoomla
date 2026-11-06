import { parseJsonObject } from '../../../../../libraries/minijoomla/application/declared-params.js';

/** Snapshot ETags with the screen, never after an update confirmation. */
export async function prepareDiscoveryEntries(found, registered, extensions) {
  const result = [];
  for (const candidate of found) {
    const matches = registered.filter((row) => row.key === candidate.key);
    if (!matches.length) { result.push(candidate); continue; }
    if (!candidate.candidateId) continue;
    if (candidate.error) { result.push(candidate); continue; }
    if (matches.length !== 1) { result.push({ ...candidate, error: 'Chave instalada duplicada.' }); continue; }
    const row = await extensions.get(matches[0].id);
    if (!row) { result.push({ ...candidate, error: 'Registro alterado; repita a descoberta.' }); continue; }
    const meta = parseJsonObject(row.manifestJson, { strict: true, field: 'manifestJson' });
    const current = meta.miniJoomla;
    if (!current?.fingerprint || !current.inventoryHash) {
      result.push({ ...candidate, error: 'Registro JSON legado requer migracao assistida para XML.' });
      continue;
    }
    const action = current?.fingerprint === candidate.fingerprint ? (current.previousRevision ? 'rollback' : null) : 'upgrade';
    if (action) result.push({ ...candidate, action, installedId: row.id, installedEtag: row.etag, installedVersion: meta.version ?? '',
      targetVersion: action === 'rollback' ? current.previousRevision.manifest?.version ?? '' : candidate.version,
      displaySource: action === 'rollback' ? current.previousRevision.entryPointUrl : candidate.discoveredFrom });
  }
  return result;
}
