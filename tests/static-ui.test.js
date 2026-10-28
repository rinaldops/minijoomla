import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function luminance(hex) {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(background, foreground) {
  const first = luminance(background); const second = luminance(foreground);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export async function runStaticUiTests() {
  const css = await readFile(new URL('../src/templates/default.css', import.meta.url), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:768px\)/);
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /@media print/);
  assert.ok(contrast('008542', 'FFFFFF') >= 4.5, 'verde Petrobras deve suportar texto branco');
  assert.ok(contrast('006298', 'FFFFFF') >= 4.5, 'azul Petrobras deve suportar texto branco');
  assert.ok(contrast('FDC82F', '000000') >= 4.5, 'amarelo Petrobras deve suportar texto preto');
  assert.ok(contrast('00B2A9', '000000') >= 4.5, 'verde-água Petrobras deve suportar texto preto');
  assert.ok(contrast('FFFFFF', '000000') >= 4.5, 'texto preto deve contrastar com branco');
  console.log('ok - static UI accessibility and responsive CSS checks');
}
