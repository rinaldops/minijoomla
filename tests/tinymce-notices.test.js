import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(PROJECT, 'src', 'media', 'vendor', 'tinymce');
const NOTICE_SHA256 = '998c28e80bb7ffcd8c0b96d6f1bc2be79742929281b8259750613dac7376281e';
// Baseline of the 32 retained vendor files, checked byte-for-byte against the
// local package and corresponding archive entries before adding notices.txt.
// This pins local correspondence, not authenticated upstream provenance or
// complete license texts/compliance. No retained tmp files are needed to test.
const VENDOR_SHA256 = '612fcaf148918ea9794ec1d3f0bb9b35ba0d1ddda8facbb75e9647ad7c8ce0fb';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

export function runTinyMceNoticesTests() {
  const notice = readFileSync(join(VENDOR, 'notices.txt'));
  assert.equal(notice.length, 471, 'Preserve the original notice byte length.');
  assert.equal(sha256(notice), NOTICE_SHA256, 'Preserve the original notice bytes, including LF and final newline.');
  const text = notice.toString('utf8');
  assert.match(text, /dompurify - Patched by Tiny\nowner: Mario Heiderich\nrepo: https:\/\/github\.com\/cure53\/DOMPurify\nversion: 3\.2\.4\nlicense: MPL-2\.0 OR Apache-2\.0\n/);
  assert.match(text, /prismjs\nowner: Lea Verou\nrepo: https:\/\/github\.com\/PrismJS\/prism\nversion: 1\.25\.0\nlicense: MIT\n/);
  assert.match(text, /prism-themes\nowner: Lea Verou\nrepo: https:\/\/github\.com\/PrismJS\/prism-themes\nversion: 1\.9\.0\nlicense: MIT\n/);

  const paths = [];
  function walk(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(join(directory, entry.name), `${path}/`);
      else {
        assert.ok(entry.isFile(), `Vendor baseline must contain regular files: ${path}`);
        if (path !== 'notices.txt') paths.push(path);
      }
    }
  }
  walk(VENDOR);
  assert.equal(paths.length, 32, 'Only the original notice is added to the 32-file vendor baseline.');
  const manifest = paths.sort().map((path) => {
    const data = readFileSync(join(VENDOR, path));
    return `${path}\t${data.length}\t${sha256(data)}\n`;
  }).join('');
  assert.equal(sha256(manifest), VENDOR_SHA256, 'Preserve every original vendor path, byte length and SHA256.');
  console.log('ok - TinyMCE original notices: exact bytes/declarations and 32 unchanged vendor files (local baseline only)');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runTinyMceNoticesTests(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
