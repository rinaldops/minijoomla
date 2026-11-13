import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageInstallationZip } from '../scripts/stage-installation-zip.js';
import { buildZip } from '../scripts/zip-writer.js';

const PROJECT = fileURLToPath(new URL('../', import.meta.url));

async function walk(dir, base = dir) {
  let files = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) files = files.concat(await walk(full, base));
    else files.push(full.slice(base.length + 1).split('\\').join('/'));
  }
  return files;
}

export async function runInstallationZipTests() {
  // zip-writer itself: round-trips through tar (bsdtar/libarchive, used by
  // Windows/macOS/Linux shells and compatible with SharePoint's own ZIP
  // extraction) with nested folders, exact byte content and no silent
  // truncation/duplication.
  {
    const { zip } = buildZip([
      { name: 'a.txt', data: Buffer.from('top level') },
      { name: 'sub/b.txt', data: Buffer.from('nested content') },
      { name: 'sub/deep/c.txt', data: Buffer.from('deeply nested') }
    ]);
    await mkdir(resolve(PROJECT, 'tmp'), { recursive: true });
    const container = await mkdtemp(resolve(PROJECT, 'tmp/zip-writer-test-'));
    try {
      const { writeFile } = await import('node:fs/promises');
      const zipPath = join(container, 'probe.zip');
      await writeFile(zipPath, zip);
      const { execFileSync } = await import('node:child_process');
      execFileSync('tar', ['-xf', zipPath, '-C', container]);
      assert.equal((await readFile(join(container, 'a.txt'), 'utf8')), 'top level');
      assert.equal((await readFile(join(container, 'sub/b.txt'), 'utf8')), 'nested content');
      assert.equal((await readFile(join(container, 'sub/deep/c.txt'), 'utf8')), 'deeply nested');
    } finally { await rm(container, { recursive: true, force: true }); }
    assert.throws(() => buildZip([]), /entrada/);
    assert.throws(() => buildZip([{ name: '../escape', data: Buffer.from('x') }]), /inv.lido/);
    assert.throws(() => buildZip([{ name: 'dup', data: Buffer.from('a') }, { name: 'DUP', data: Buffer.from('b') }]), /duplicada/);
    console.log('ok - zip writer: real tar extraction, exact nested bytes, empty/escaping/duplicate guards');
  }

  // Full installation package wrapped as a single .zip with the definitive
  // SiteAssets/minijoomla/releases/<version>/ hierarchy plus the two
  // ready-to-paste snippet instructions at the archive root.
  await mkdir(resolve(PROJECT, 'tmp'), { recursive: true });
  const container = await mkdtemp(resolve(PROJECT, 'tmp/installation-zip-test-'));
  try {
    const zipOutput = 'tmp/' + container.split(/[\\/]/).at(-1) + '/pacote.zip';
    await assert.rejects(stageInstallationZip({ version: '1.0.0', output: 'tmp/../outside.zip' }));
    await assert.rejects(stageInstallationZip({ version: '1.0.0', output: zipOutput.replace('.zip', '.tar') }));
    const built = await stageInstallationZip({ version: '1.0.0', output: zipOutput });
    assert.ok(built.bytes > 0);
    assert.equal(built.sha256.length, 64);
    const { execFileSync } = await import('node:child_process');
    const extracted = join(container, 'extracted');
    await mkdir(extracted, { recursive: true });
    execFileSync('tar', ['-xf', built.output, '-C', extracted]);
    const rootFiles = (await readdir(extracted)).sort();
    assert.deepEqual(rootFiles, ['CODIGO-PARA-COLAR-NAS-PAGINAS.txt', 'LEIA-ME.txt', 'minijoomla']);
    const releaseRoot = join(extracted, 'minijoomla', 'releases', '1.0.0');
    const files = await walk(releaseRoot);
    assert.equal(files.length, built.manifest.files.length);
    for (const entry of built.manifest.files) {
      assert.ok(files.includes(entry.path), `Pacote extraído deve conter ${entry.path}`);
      const bytes = await readFile(join(releaseRoot, entry.path));
      assert.equal(bytes.length, entry.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `Bytes preservados exatamente: ${entry.path}`);
    }
    const instructions = await readFile(join(extracted, 'CODIGO-PARA-COLAR-NAS-PAGINAS.txt'), 'utf8');
    assert.ok(instructions.includes('data-minijoomla-site'), 'Snippet público presente');
    assert.ok(instructions.includes('data-minijoomla-admin-root'), 'Snippet administrativo presente');
    assert.ok(instructions.includes('/SiteAssets/minijoomla/releases/1.0.0/host/loader.js'), 'Caminho da release correto embutido no texto');
    assert.ok(instructions.includes('data-spmiddle-layout="FullBleed"'));
    assert.equal((instructions.match(/data-spmiddle-layout="FullBleed"/g) ?? []).length, 2, 'Ambos os snippets usam FullBleed');
    const readmeText = await readFile(join(extracted, 'LEIA-ME.txt'), 'utf8');
    assert.ok(readmeText.includes('SiteAssets'));
    assert.ok(readmeText.includes('Extrair'));
    await assert.rejects(stageInstallationZip({ version: '1.0.0', output: zipOutput }), /existe/);
    console.log('ok - installation zip: single archive extracts the definitive SiteAssets hierarchy with exact bytes and both ready-to-paste MSE snippets');
  } finally { await rm(container, { recursive: true, force: true }); }
}
