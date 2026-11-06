import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRIBUTOR_FILES, verifyContributorStage } from './stage-contributor.js';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = resolve(PROJECT, 'tmp');
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 2000;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_FINDINGS = 100;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Signatures produce candidates, not a conclusion about authenticity. Even
// synthetic fixtures remain candidates; there is no whitelist or remediation.
const SIGNATURES = [
  ['corporate-host', /\b(?:[a-z0-9-]+\.)*petrobras\.(?:com\.br|dev\.br|local)\b|\bpetrobras[a-z0-9-]*\.(?:sharepoint\.com|onmicrosoft\.com)\b/gi],
  ['corporate-path', /\/(?:sites|teams)\/[^\s"'<>`]+|\b[A-Z]:\\(?:PROJETOS|Users)\\[^\s"'<>`]+|\bCAMAP-AGP\b/gi],
  ['corporate-context', /\bpetrobras\b/gi],
  ['guid', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['private-key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g],
  ['credential-literal', /["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|secret|token|authorization|cookie)["']?\s*[:=]\s*(["'`])[^"'`\r\n]+\1/gi],
  ['bearer-or-jwt', /\bBearer[ \t]+[a-z0-9._~+/-]{12,}={0,2}|\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi],
  ['signed-url', /[?&](?:sig|signature|access_token|token|client_secret|X-Amz-Signature)=[^\s&"'<>`]+/gi]
];

function within(root, path) {
  const name = relative(root, path);
  return name === '' || (name !== '..' && !name.startsWith(`..${sep}`) && !isAbsolute(name));
}

function noLinks(path) {
  // lstat (not existsSync) also detects dangling links. Junctions are links on
  // Windows. Errors never include untrusted paths or filesystem error messages.
  let current = resolve(path);
  while (true) {
    let stat;
    try { stat = lstatSync(current); }
    catch { throw new Error('audit-path-unavailable'); }
    if (stat.isSymbolicLink()) throw new Error('audit-links-not-allowed');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function regularFile(path, root, limit) {
  if (!within(root, path)) throw new Error('audit-path-outside-root');
  noLinks(path);
  const stat = lstatSync(path);
  if (!stat.isFile()) throw new Error('audit-regular-file-required');
  if (stat.nlink !== 1) throw new Error('audit-hardlinks-not-allowed');
  if (!within(realpathSync(root), realpathSync(path))) throw new Error('audit-realpath-outside-root');
  if (stat.size > limit) throw new Error('audit-size-limit');
  const data = readFileSync(path);
  noLinks(path);
  if (data.length > limit) throw new Error('audit-size-limit');
  return data;
}

function validName(name) {
  // Portable manifest paths only: no UNC, drive/ADS, URL, percent decoding,
  // traversal, control characters, Windows aliases or Git metadata reads.
  return typeof name === 'string' && name.length > 0 && name.length <= 240 &&
    !/[\\:%<>"|?*\u0000-\u0020\u007f-\u009f]/.test(name) && !name.startsWith('/') &&
    name.split('/').every((part) => part && !['.', '..', '.git'].includes(part.toLowerCase()) &&
      !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

function coreName(name) {
  if (['index.js', 'loader.js', 'entrypoints.json', 'LICENSE.md', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md'].includes(name)) return true;
  return /^(?:libraries\/minijoomla\/|modules\/|plugins\/content\/|components\/|layouts\/joomla\/|templates\/|media\/templates\/|administrator\/)/i.test(name) &&
    !/^libraries\/minijoomla\/(?:composition\/|infrastructure\/(?:spmiddle|sharepoint)[^/]*)/i.test(name) &&
    !/^media\/vendor\//i.test(name) &&
    !/(?:^|\/)vendor\//i.test(name) &&
    /\.(?:m?js|css|xml|woff2?|ttf|otf|eot|svg|png|gif|jpe?g|webp|ico)$/i.test(name);
}

function candidates(text) {
  return SIGNATURES.map(([category, expression]) => {
    let count = 0;
    const matches = text.matchAll(expression);
    while (!matches.next().done) count += 1;
    return { category, count };
  })
    .filter(({ count }) => count > 0);
}

function auditManifest({ manifest } = {}) {
  if (typeof manifest !== 'string' || !manifest || /[\u0000-\u001f]/.test(manifest) ||
      /^(?:[a-z][\w+.-]*:\/\/|[\\/]{2})/i.test(manifest) || manifest.split(/[\\/]/).includes('..')) {
    throw new Error('audit-manifest-path-invalid');
  }
  const manifestPath = resolve(PROJECT, manifest);
  const root = dirname(manifestPath);
  if (!within(TMP, root) || relative(TMP, root) === '' || relative(resolve(root, 'manifest.json'), manifestPath) !== '' ||
      !validName(relative(PROJECT, manifestPath).split(sep).join('/'))) {
    throw new Error('audit-manifest-must-be-tmp-core-manifest');
  }
  const manifestBytes = regularFile(manifestPath, TMP, MAX_MANIFEST_BYTES);
  let parsed;
  try { parsed = JSON.parse(manifestBytes.toString('utf8')); }
  catch { throw new Error('audit-manifest-json-invalid'); }
  const contributor = parsed?.target === 'contributor-local';
  const keys = contributor ? ['schemaVersion', 'target', 'algorithm', 'files', 'publicationApproved', 'privacyApproved', 'rightsApproved'] : ['version', 'target', 'algorithm', 'files'];
  if (!parsed || Object.keys(parsed).some((key) => !keys.includes(key)) ||
      (!contributor && parsed.target !== 'core') || parsed.algorithm !== 'sha256' ||
      (contributor ? parsed.schemaVersion !== 1 || ['publicationApproved', 'privacyApproved', 'rightsApproved'].some(key => parsed[key] !== false)
        : typeof parsed.version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(parsed.version)) ||
      !Array.isArray(parsed.files) || !parsed.files.length || parsed.files.length > MAX_FILES) {
    throw new Error('audit-core-manifest-schema-invalid');
  }
  const seen = new Set();
  let bytes = 0;
  // Validate ALL names and limits before opening any declared file.
  for (const entry of parsed.files) {
    if (!entry || Object.keys(entry).some((key) => !['path', 'bytes', 'sha256'].includes(key)) ||
        !validName(entry.path) || entry.path.toLowerCase() === 'manifest.json' ||
        seen.has(entry.path.toLowerCase()) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 ||
        entry.bytes > MAX_FILE_BYTES || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error('audit-file-entry-invalid');
    }
    seen.add(entry.path.toLowerCase());
    bytes += entry.bytes;
    if (bytes > MAX_TOTAL_BYTES) throw new Error('audit-total-size-limit');
  }
  if (contributor && (parsed.files.length !== CONTRIBUTOR_FILES.length || parsed.files.some((entry, index) => entry.path !== CONTRIBUTOR_FILES[index]))) {
    throw new Error('audit-contributor-selection-or-inventory-invalid');
  }
  const verified = parsed.files.map((entry) => {
    const data = regularFile(resolve(root, entry.path), root, MAX_FILE_BYTES);
    if (data.length !== entry.bytes || sha256(data) !== entry.sha256) throw new Error('audit-file-integrity-failed');
    return { entry, data };
  });
  // Apply the same bounded-read gates before the complete contributor inventory
  // check. A contributor target never exempts fixtures, vendor or documentation.
  if (contributor) {
    try { verifyContributorStage({ output: root }); }
    catch { throw new Error('audit-contributor-selection-or-inventory-invalid'); }
  }
  if (!regularFile(manifestPath, TMP, MAX_MANIFEST_BYTES).equals(manifestBytes)) throw new Error('audit-manifest-changed');

  const counts = { files: verified.length, bytes, filesWithCandidates: 0, candidates: 0, byCategory: {} };
  const findings = [];
  for (const [index, { entry, data }] of verified.entries()) {
    const pathCandidates = candidates(entry.path);
    let text;
    let opaque = false;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); opaque = text.includes('\0'); }
    catch { text = data.toString('latin1'); opaque = true; }
    const categories = new Map();
    for (const item of [...pathCandidates, ...candidates(text)]) categories.set(item.category, (categories.get(item.category) ?? 0) + item.count);
    if (contributor ? !CONTRIBUTOR_FILES.includes(entry.path) : !coreName(entry.path)) categories.set(contributor ? 'outside-contributor-scope' : 'outside-core-scope', 1);
    if (/(?:^|\/)(?:tmp|private|profiles?|\.env(?:\.[^/]+)?|(?:credentials?|secrets?|tokens?)(?:\.[^/]+)?)(?:\/|$)|\.(?:pem|key|pfx|p12|kdbx)$/i.test(entry.path)) categories.set('private-artifact', 1);
    if (opaque) categories.set('opaque-content-review', 1);
    if (!categories.size) continue;
    counts.filesWithCandidates += 1;
    for (const [category, count] of categories) {
      counts.candidates += count;
      counts.byCategory[category] ??= { files: 0, candidates: 0 };
      counts.byCategory[category].files += 1;
      counts.byCategory[category].candidates += count;
    }
    if (findings.length < MAX_FINDINGS) findings.push({
      file: `manifest.files[${index}]`,
      // A sensitive filename is itself a value. Identify its manifest index
      // rather than echo it. Candidates are still counted and block the gate.
      path: pathCandidates.length ? null : entry.path,
      pathWithheld: pathCandidates.length > 0,
      categories: [...categories].map(([category, count]) => ({ category, count }))
    });
  }
  return {
    schemaVersion: 1,
    target: parsed.target,
    manifest: 'tmp/<local-stage>/manifest.json',
    status: counts.filesWithCandidates ? 'candidates-found' : 'no-candidates-in-manifest',
    integrity: 'all-declared-file-hashes-verified',
    publicDistributionApproved: false,
    rightsReviewed: false,
    privacyCertified: false,
    counts,
    findings,
    findingsTruncated: counts.filesWithCandidates > findings.length,
    omittedFindingFiles: counts.filesWithCandidates - findings.length,
    scope: { files: 'manifest-only', unlistedFiles: contributor ? 'complete-inventory-verified-no-extras' : 'not-audited', gitIndex: 'not-read', gitHistory: 'not-read', network: 'not-used' },
    pending: [
      'Manual review of authenticity, privacy, rights and provenance remains required, including when candidates are zero.',
      'Tracked tmp artifacts and aggregator Git history require a separate authorized review; ignoring tmp does not remove tracked data or history.',
      contributor ? 'TinyMCE bytes/notices are included unchanged; provenance, complete licenses and corresponding source/build materials remain unresolved. No upstream source was downloaded.' : 'TinyMCE is excluded from core; distributions including it still require verified provenance and complete corresponding source/build materials. No upstream source was downloaded.',
      'SPMIDDLE is excluded from core; distributions copying it still require its copyright and complete MIT license. No sibling project was read.',
      'Signatures are conservative and incomplete; encoded/packed data, arbitrary personal data and unknown corporate domains are not certified. Opaque files require manual review.'
    ]
  };
}

/** Read only a core or exact contributor-local staging manifest/files in tmp. */
export function auditDistribution(options = {}) {
  try { return auditManifest(options); }
  catch (error) {
    // The library, like the CLI, does not propagate raw filesystem errors.
    const code = /^audit-[a-z-]+$/.test(error?.message ?? '') ? error.message : 'audit-local-read-failed';
    throw new Error(code);
  }
}

function main(args) {
  if (args.length !== 2 || args[0] !== '--manifest') throw new Error('audit-usage: node scripts/audit-distribution.js --manifest tmp/<stage>/manifest.json');
  const result = auditDistribution({ manifest: args[1] });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.counts.filesWithCandidates ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch {
    // Never echo exceptions: JSON/filesystem errors can contain secret values.
    console.error('audit-distribution: invalid or unverifiable local core/contributor manifest; no candidate report produced.');
    process.exitCode = 2;
  }
}
