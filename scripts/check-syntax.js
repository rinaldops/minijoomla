import { lstat, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function filesIn(directory) {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('check-syntax-links-not-allowed');
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('check-syntax-links-not-allowed');
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else if (entry.isFile() && /\.(?:js|mjs)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

// Parse only: never evaluate scripts, browser assets or their imports. Missing
// imports/evaluation errors are the runner's responsibility, not syntax success.
export async function checkSyntax() {
  const files = (await Promise.all(['src', 'tests', 'examples', 'scripts'].map(directory => filesIn(join(PROJECT, directory))))).flat();
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit', timeout: 10000 });
    if (result.error) throw result.error;
    if (result.status !== 0) return { files: files.length, status: result.status ?? 1 };
  }
  return { files: files.length, status: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkSyntax();
    process.exitCode = result.status;
    if (result.status === 0) console.log(`Syntax OK: ${result.files} JavaScript files (src/tests/examples/scripts; .js/.mjs; parse only)`);
  } catch (error) {
    console.error(`check-syntax: ${error.message}`);
    process.exitCode = 1;
  }
}
