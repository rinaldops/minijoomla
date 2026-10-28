import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function runStaticUiTests() {
  const css = await readFile(new URL('../src/templates/default.css', import.meta.url), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:768px\)/);
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /@media print/);
  console.log('ok - static UI accessibility and responsive CSS checks');
}
