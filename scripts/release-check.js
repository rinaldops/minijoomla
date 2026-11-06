import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Offline structural gate, deliberately NOT a publication or privacy approval.
export function checkProjectRelease({ root = PROJECT } = {}) {
  const required = ['package.json', 'README.md', 'LICENSE.md', 'src', 'tests', 'scripts', 'examples', 'docs', 'docs/licenses/GPL-2.0.txt', 'docs/THIRD-PARTY-NOTICES.md'];
  const missing = required.filter((entry) => !existsSync(join(root, entry)));
  if (missing.length) throw new Error(`Arquivos obrigatórios ausentes: ${missing.join(', ')}`);
  const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  if (!semver.test(metadata.version ?? '')) throw new Error('Versão de pacote inválida; esperado semver.');
  if (metadata.license !== 'GPL-2.0-or-later') throw new Error('Licença própria deve declarar GPL-2.0-or-later.');
  const license = readFileSync(join(root, 'docs/licenses/GPL-2.0.txt'), 'utf8');
  if (!license.includes('GNU GENERAL PUBLIC LICENSE') || !license.includes('Version 2, June 1991') || !license.includes('NO WARRANTY')) throw new Error('Texto integral GPL v2 não reconhecido.');
  const hash = createHash('sha256');
  for (const entry of required.filter((entry) => statSync(join(root, entry)).isFile()).sort()) {
    hash.update(entry); hash.update('\0'); hash.update(readFileSync(join(root, entry))); hash.update('\0');
  }
  return {
    packageVersion: metadata.version, license: metadata.license,
    npmPublicationDisabled: metadata.private === true,
    structuralDigest: hash.digest('hex'), offline: true,
    scope: 'local-structure-only', publicationApproved: false,
    pending: ['corporate data/history review', 'third-party corresponding source/provenance', 'visual/accessibility acceptance', 'destination-specific immutable release validation']
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(checkProjectRelease(), null, 2)); }
  catch (error) { console.error(`release-check: ${error.message}`); process.exitCode = 1; }
}
