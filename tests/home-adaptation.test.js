/* SPDX-License-Identifier: GPL-2.0-or-later
 * Portable pinned source DATA; optional local build never installs/publishes.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  applyHomeOverlay, finalizeHomePackage, prepareHomeAdaptation, parseHomeAdaptationArgs,
  HOME_ANCHORS, HOME_SOURCE_PATH, HOME_CSS_PATH, HOME_API_SHA256, HOME_DEFAULTS,
  SHARED_SOURCE_PATH, HOME_VALIDATION_SOURCE, HOME_CSS_OLD_ROOT, HOME_CSS_NEW_ROOT, HOME_CSS_APPEND,
  homeAdaptationXml, sha256, INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, CHANGES_LICENSE_SHA256
} from '../scripts/prepare-home-adaptation.js';
import { SAFE_URL_SOURCE, readAdaptationFiles, createAdaptationCollector, collectAdaptationDependencies, ADAPTATION_API_FILES, ADAPTATION_GENERATOR_HASHES, ADAPTATION_MIT_HASHES, ADAPTATION_ORIGIN_COMMIT } from '../scripts/prepare-editorial-adaptation.js';
import { ADOPTION_MODULES, validateAdoptionSchema } from '../scripts/prepare-module-adoption.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';
import { parseJsonObject, normalizeParamValues } from '../src/libraries/minijoomla/application/declared-params.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createJoomlaDiscoveryService } from '../src/libraries/minijoomla/application/joomla-discovery.js';
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ELEMENT = 'mod_home'; const KEY = `camap.${ELEMENT}`;
const LIB = `libraries/camap/${HOME_SOURCE_PATH}`; const SHARED = `libraries/camap/${SHARED_SOURCE_PATH}`;
const CSS = `media/${ELEMENT}/css/home.css`; const ENTRY = `modules/${ELEMENT}/${ELEMENT}.js`; const XML = `modules/${ELEMENT}/${ELEMENT}.xml`;
const FLAGS = ['publicationApproved', 'rightsApproved', 'migrated', 'tenantModified', 'hostConfigured', 'currentRecordsModified'];
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lf = bytes => Buffer.from(bytes.toString().replace(/\r\n?/g, '\n'));
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cases = []; const registerCase = (name, run) => cases.push({ name, run });

// Complete 63-line original module, copied as inert DATA, BOM retained.
const MODULE_SOURCE = '\uFEFF' + [
  "import { escapeHtml, safeUrl, stateMessage } from '../_shared/render.js';", '',
  'export const defaults = Object.freeze({',
  "  eyebrow: 'Digital workspace',",
  "  title: 'Tecnologia que conecta. Pessoas que transformam.',",
  "  primaryHighlight: 'conecta',",
  "  secondaryHighlight: 'transformam',",
  "  description: 'A shared space for useful content, discussions and learning.',",
  "  primaryAction: { label: 'Open discussions', href: '#discussions' },",
  "  secondaryAction: { label: 'Browse videos', href: '#videos' },",
  '  stats: [',
  "    { value: '17', label: 'ENCONTROS REALIZADOS' },",
  "    { value: '1×/mês', label: 'ENCONTRO AO VIVO' },",
  "    { value: '—', label: 'APRESENTAÇÕES REALIZADAS' },",
  "    { value: '—', label: 'MENSAGENS NO FÓRUM' }",
  '  ]', '});', '',
  'export const settingsSchema = Object.freeze({ version: 1, fields: {',
  "  eyebrow: { type: 'string', maxLength: 80, default: defaults.eyebrow },",
  "  title: { type: 'string', maxLength: 180, default: defaults.title },",
  "  primaryHighlight: { type: 'string', maxLength: 80, default: defaults.primaryHighlight },",
  "  secondaryHighlight: { type: 'string', maxLength: 80, default: defaults.secondaryHighlight },",
  "  description: { type: 'string', maxLength: 400, default: defaults.description },",
  "  primaryAction: { type: 'object', default: defaults.primaryAction },",
  "  secondaryAction: { type: 'object', default: defaults.secondaryAction },",
  "  stats: { type: 'array', default: defaults.stats }", '} });', '',
  'function highlight(text, term, className) {',
  "  const source = String(text ?? '');",
  "  const needle = String(term ?? '').trim();",
  '  if (!needle) return escapeHtml(source);',
  "  const index = source.toLocaleLowerCase('pt-BR').indexOf(needle.toLocaleLowerCase('pt-BR'));",
  '  if (index < 0) return escapeHtml(source);',
  '  return `${escapeHtml(source.slice(0, index))}<span class="mse-home__accent ${className}">${escapeHtml(source.slice(index, index + needle.length))}</span>${escapeHtml(source.slice(index + needle.length))}`;', '}', '',
  'function action(action, modifier) {',
  "  const label = String(action?.label ?? '').trim();",
  '  const href = safeUrl(action?.href);',
  '  return label ? `<a class="mse-home__button mse-home__button--${modifier}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : \'\';',
  '}', '',
  'function stats(items) {',
  '  const values = Array.isArray(items) && items.length ? items.slice(0, 8) : defaults.stats;',
  "  return values.filter(item => item && typeof item.value === 'string' && typeof item.label === 'string')",
  '    .map(item => `<div class="mse-home__stat"><b>${escapeHtml(item.value)}</b><span>${escapeHtml(item.label)}</span></div>`).join(\'\');',
  '}', '',
  'function decoration() {',
  "  const terms = ['RPA', 'Datasphere', 'M365', 'APIs', 'Machine Learning', 'Power BI', 'KNIME', 'Azure', 'Copilot', 'SharePoint'];",
  '  return `<div class="mse-home__constellation" aria-hidden="true"></div><div class="mse-home__lines" aria-hidden="true"><i></i><i></i></div><div class="mse-home__floaters" aria-hidden="true">${terms.map((term, i) => `<span style="--mse-home-floater-index:${i}">${escapeHtml(term)}</span>`).join(\'\')}</div>`;',
  '}', '',
  "export function renderHome(settings = {}, state = 'ready') {",
  '  if (state !== \'ready\') return `<section class="mse-home" aria-label="Home">${stateMessage(state)}</section>`;',
  '  const c = { ...defaults, ...settings, primaryAction: { ...defaults.primaryAction, ...settings.primaryAction }, secondaryAction: { ...defaults.secondaryAction, ...settings.secondaryAction } };',
  '  return `<section class="mse-home" aria-labelledby="mse-home-title">${decoration()}<div class="mse-home__inner"><span class="mse-home__eyebrow mse-home__accent--primary">${escapeHtml(c.eyebrow)}</span><h1 id="mse-home-title" class="mse-home__title">${highlight(c.title, c.primaryHighlight, \'mse-home__accent--primary\')}</h1><p class="mse-home__sub">${escapeHtml(c.description)}</p><div class="mse-home__actions">${action(c.primaryAction, \'primary\')}${action(c.secondaryAction, \'ghost\')}</div></div><div class="mse-home__stats">${stats(c.stats)}</div></section>`;',
  '}', '',
  "const module = Object.freeze({ name: 'camap.mod_home', settings: defaults, settingsSchema, render: ({ settings, state } = {}) => renderHome(settings, state) });",
  'export default module;', ''
].join('\n');
const SHARED_SOURCE = '\uFEFF' + [
  "export function escapeHtml(value = '') { return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }",
  "export function safeUrl(value, fallback = '#') { const s = String(value ?? '').trim(); return /^(#|\\/|https:\\/\\/)/i.test(s) ? s : fallback; }",
  "export function stateMessage(state, empty = 'Nenhum conteúdo disponível.') { if (state === 'loading') return '<p role=\"status\" aria-live=\"polite\">Carregando…</p>'; if (state === 'error') return '<p role=\"alert\">Não foi possível carregar este módulo.</p>'; if (state === 'empty') return `<p role=\"status\">${escapeHtml(empty)}</p>`; return ''; }", ''
].join('\n');
const CSS_SOURCE = `/* doubled selector: each module loader injects its own <link> to core.css,
   so core's .mse-app background can land after this rule in the cascade;
   matching specificity (0,1,0) alone loses that tiebreak on some pages */
[data-mse-module="home"][data-mse-module="home"] {
  --home-azul-escuro: #006298;
  --home-azul-claro: #3DDAFF;
  --home-verde-agua: #00B2A9;
  --home-verde: #008542;
  --home-amarelo: #FDC82F;
  --home-laranja: #ED8B00;
  --home-text: #FFFFFF;
  --home-line: #FFFFFF;
  --home-font-display: var(--mse-font-family, Arial, sans-serif);
  --home-font-mono: ui-monospace, "Cascadia Code", "SF Mono", Consolas, "Roboto Mono", monospace;

  /* three uneven light sources (an irregular triangle, not one centered blob) give the
     hero depth: each stop is azul-escuro tinted lighter — 85/80/90% color-to-white mix —
     fading to transparent over the flat azul-escuro base, so edges stay the darkest,
     full-strength approved blue. The wide, very diffuse 10% black layer on top is a
     subtle outer layer draws focus toward the center without dominating the base. */
  background: transparent;
  color: var(--home-text);
  border-radius: var(--mse-section-radius, 0);
  overflow: hidden;
}

@media (max-width: 760px) {
  .mse-home {
    background:
      radial-gradient(140% 140% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.1) 100%),
      radial-gradient(32rem 26rem at 62% 10%, #267AA7, transparent 60%),
      radial-gradient(34rem 28rem at 28% 50%, #3381AD, transparent 58%),
      var(--home-azul-escuro);
  }
}

.mse-home {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(130% 130% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.1) 100%),
    radial-gradient(50rem 44rem at 58% 22%, #267AA7, transparent 65%),
    radial-gradient(56rem 50rem at 37% 68%, #3381AD, transparent 62%),
    radial-gradient(62rem 54rem at 82% 52%, #1A72A2, transparent 64%),
    var(--home-azul-escuro);
  border-radius: var(--mse-section-radius, 0);
  padding: clamp(24px, 3.5vw, 40px) clamp(20px, 4vw, 56px) clamp(24px, 3.5vw, 40px);
}

.mse-home__constellation {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.6;
}

.mse-home__lines {
  /* Right-anchored at 80% width (was edge-to-edge): shrinks the lines' lateral
     spread by 20% without touching the path data — preserveAspectRatio="none"
     rescales the same viewBox into the narrower box, so the vertical tuning
     (top clearance, bottom overflow) stays exactly as calibrated. */
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 80%;
  height: 100%;
}

@media (max-width: 760px) {
  .mse-home__lines { display: none; }
}

.mse-home__floaters {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.mse-home__floater {
  position: absolute;
  font-family: var(--home-font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  color: var(--home-text);
  opacity: 0;
  white-space: nowrap;
  animation: mse-home-floater-drift 16s ease-in-out infinite;
}

@keyframes mse-home-floater-drift {
  0% { opacity: 0; transform: translateY(10px); }
  12% { opacity: 0.16; }
  50% { opacity: 0.22; transform: translateY(-14px); }
  88% { opacity: 0.14; }
  100% { opacity: 0; transform: translateY(-26px); }
}

@media (max-width: 760px) {
  .mse-home__floaters { display: none; }
}

.mse-home__inner {
  position: relative;
  z-index: 2;
  /* Percentage of the hero's own width, not vw/rem: the accent lines are positioned
     as fixed percentages of the hero (stretched SVG viewBox), so the text column has
     to scale in that same proportion to keep clear of them and stay visually balanced
     against the graphic at every hero width — a vw+rem formula grows at a different
     rate than the hero itself and drifts out of sync at both ends of the range. */
  max-width: clamp(20rem, 50%, 56rem);
}

.mse-home__eyebrow {
  font-family: var(--home-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--home-amarelo);
}

.mse-home__eyebrow-mark {
  text-decoration: underline;
}

.mse-home__title {
  font-family: var(--home-font-display);
  font-weight: 700;
  letter-spacing: 0;
  font-size: clamp(2.4rem, 2vw + 2.3rem, 5rem);
  line-height: 1.08;
  margin: 0.5em 0 0.42em;
}

.mse-home__accent {
  font-style: normal;
}

.mse-home__accent--primary {
  color: var(--home-amarelo);
}

.mse-home__accent--secondary {
  color: var(--home-laranja);
}

.mse-home__accent--custom {
  color: var(--home-amarelo);
}

[data-mse-module="home"][data-mse-theme="Lite"] {
  --home-amarelo: #75787B;
  --home-laranja: #000000;
}

.mse-home__sub {
  font-size: 1.08rem;
  color: var(--home-text);
  opacity: 0.88;
  margin: 0;
}

.mse-home__actions {
  margin-top: 2em;
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.mse-home__button {
  font-size: 0.95rem;
  font-weight: 700;
  padding: 0.85em 1.5em;
  border-radius: 0;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
  border: 1px solid transparent;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.mse-home__button:hover {
  transform: translateY(-2px);
}

.mse-home__button--primary {
  background: var(--home-amarelo);
  color: #000000;
}

.mse-home__button--primary:hover {
  background: var(--home-amarelo);
  border-color: #000000;
}

.mse-home__button--ghost {
  border-color: var(--home-line);
  color: var(--home-text);
}

.mse-home__button--ghost:hover {
  border-color: var(--home-azul-claro);
  color: var(--home-azul-claro);
}

.mse-home__stats {
  /* No position/z-index here (unlike .mse-home__inner): this row is meant to
     sit in the same paint layer as the accent lines' svg, so the lines cross
     visibly over the white rule and the numbers — full-width like the page,
     not clipped to the title column's narrower, line-safe max-width. */
  margin-top: clamp(44px, 7vw, 72px);
  padding-top: 1.6em;
  border-top: 1px solid var(--home-line);
  display: grid;
  grid-template-columns: repeat(4, auto);
  justify-content: space-between;
  gap: 2.6em;
}

.mse-home__stat b {
  display: block;
  font-family: var(--home-font-display);
  font-size: 1.7rem;
  font-weight: 700;
}

.mse-home__stat span {
  font-family: var(--home-font-mono);
  font-size: 0.7rem;
  color: var(--home-text);
  opacity: 0.82;
  letter-spacing: 0.03em;
}

@media (max-width: 760px) {
  .mse-home__stats { grid-template-columns: repeat(2, auto); }
}

@media (prefers-reduced-motion: reduce) {
  .mse-home__floater { animation: none; }
}
/* HTML fallback decoration for the string-based CAMAP2 contract. */
.mse-home__constellation{position:absolute;inset:0;opacity:.45;background-image:radial-gradient(circle at 12% 30%,rgba(255,255,255,.75) 0 1px,transparent 2px),radial-gradient(circle at 34% 65%,rgba(255,255,255,.6) 0 1px,transparent 2px),radial-gradient(circle at 74% 28%,rgba(255,255,255,.75) 0 1px,transparent 2px),radial-gradient(circle at 88% 72%,rgba(255,255,255,.6) 0 1px,transparent 2px);background-size:38% 46%,48% 58%,42% 52%,35% 44%;background-repeat:repeat;}
.mse-home__lines{position:absolute;inset:0;pointer-events:none;opacity:.5;}
.mse-home__lines i{position:absolute;display:block;width:55%;height:45%;right:0;border-top:2px solid var(--home-amarelo);transform:skewY(-14deg) rotate(8deg);top:16%;}
.mse-home__lines i+i{top:38%;border-color:var(--home-laranja);transform:skewY(12deg) rotate(-7deg);opacity:.7;}
.mse-home__floaters span{animation-delay:calc(var(--mse-home-floater-index) * 1.3s);}
@media (prefers-reduced-motion:reduce){.mse-home__floaters span{animation:none;opacity:.14;}}
`;
const originals = new Map([[SHARED_SOURCE_PATH, Buffer.from(SHARED_SOURCE)], [HOME_SOURCE_PATH, Buffer.from(MODULE_SOURCE)], [HOME_CSS_PATH, Buffer.from(CSS_SOURCE)]]);
// Trust gate MUST precede all fixture imports, including original renderer.
for (const [path, bytes] of originals) assert.equal(sha256(bytes), HOME_ANCHORS[path][1], path);
const overlay = applyHomeOverlay(originals);
const shared = await import(dataUrl(overlay.files.get(SHARED_SOURCE_PATH)));
function moduleUrl(files) {
  const source = files.get(HOME_SOURCE_PATH).toString(); const anchor = "from '../_shared/render.js';";
  assert.equal(source.split(anchor).length, 2);
  return dataUrl(source.replace(anchor, () => `from '${dataUrl(files.get(SHARED_SOURCE_PATH))}';`));
}
const loaded = await import(moduleUrl(overlay.files)); const prior = await import(moduleUrl(originals)); const render = loaded.renderHome;
const countActions = html => (html.match(/<a class="mse-home__button /g) ?? []).length;
const countStats = html => (html.match(/<div class="mse-home__stat">/g) ?? []).length;
const fixIds = (html, title) => html.replace('aria-labelledby="mse-home-title"', `aria-label="${shared.escapeHtml(title)}"`).replace('<h1 id="mse-home-title" class=', '<h1 class=');
const descriptor = parseJoomlaManifest(homeAdaptationXml('0.4.0'), { baseUrl: '/offline/home/0.4.0', manifestPath: XML });
// Inert historical notice, pinned bytes; no checkout required in portable mode.
const mit = Buffer.from(`MIT License

Copyright (c) 2026 Rinaldo Paulino de Souza

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`);
assert.equal(sha256(mit), ADAPTATION_MIT_HASHES[1]);
const gpl = await readFile(join(PROJECT, CHANGES_LICENSE_PATH)); assert.equal(sha256(gpl), CHANGES_LICENSE_SHA256);

function provenance() {
  const snapshot = [...originals].map(([path, bytes]) => ({ path, originalSha256: sha256(bytes), snapshotSha256: sha256(overlay.files.get(path)), bytes: bytes.length }));
  for (const path of ['tools/prepare-joomla-modules.js', 'package.json', ...ADOPTION_MODULES.filter(({ folder }) => folder !== ELEMENT).map(({ folder }) => `extensions/camap/${folder}/module.js`)]) {
    // Placeholder hashes are inert synthetic metadata ONLY; local audit compares every real original.
    const hash = path.startsWith('tools/') ? ADAPTATION_GENERATOR_HASHES[0] : sha256(Buffer.from(`inert fixture metadata: ${path}`));
    snapshot.push({ path, originalSha256: hash, snapshotSha256: hash, bytes: 0 });
  }
  return { changes: structuredClone(overlay.changes), licenses: [], generatorSha256: ADAPTATION_GENERATOR_HASHES[0], adoptionApiSha256: HOME_API_SHA256, snapshot,
    inheritedLicenseBytes: mit, inheritedLicense: { license: 'MIT', origin: 'aggregator root LICENSE', originCommit: ADAPTATION_ORIGIN_COMMIT, sha256: sha256(mit), historicalLfSha256: ADAPTATION_MIT_HASHES[1], packagePath: INHERITED_LICENSE_PATH, scope: [HOME_SOURCE_PATH, SHARED_SOURCE_PATH, HOME_CSS_PATH], globalVendorRightsApproved: false, evidence: 'Portable exact historical notice; actual local sources checked in explicit audit.' },
    changesLicenseBytes: gpl, changesLicenseSource: { path: CHANGES_LICENSE_PATH, sha256: CHANGES_LICENSE_SHA256, license: 'GPL-2.0-or-later', scope: 'authored adaptation changes only' } };
}
function rebuildInventory(files, version = '0.4.0') {
  const base = `/offline/home/${version}`;
  const inv = json({ format: 'minijoomla-joomla-package-v1', version, moduleKeys: { [ELEMENT]: KEY }, moduleStyles: { [KEY]: [CSS] }, files: [...files].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) });
  files.set('MANIFEST-SHA256.json', inv);
  files.set('host-config.json', json({ joomlaDiscoveryRoots: [{ id: `camap-${ELEMENT}-${version}`, baseUrl: base, inventoryHash: sha256(inv), immutable: true, discover: true }], moduleStyles: { [KEY]: [`${base}/${CSS}`] }, moduleStyleRevisions: { [KEY]: { [`${base}/${ENTRY}`]: [`${base}/${CSS}`] } } }));
  return files;
}
function stagedFixture(version = '0.4.0') {
  return rebuildInventory(new Map([[LIB, overlay.files.get(HOME_SOURCE_PATH)], [SHARED, overlay.files.get(SHARED_SOURCE_PATH)], [CSS, overlay.files.get(HOME_CSS_PATH)], [ENTRY, Buffer.from(`export { default } from '../../${LIB}';\nexport * from '../../${LIB}';\n`)], [XML, homeAdaptationXml(version)], ['docs/ADOPTION-NOTICE.md', Buffer.from('Offline fixture\n')], ['adoption-plan.json', json({ format: 'minijoomla-module-adoption-v1', profile: 'joomla-xml-v1', module: ELEMENT, key: KEY, version, base: `/offline/home/${version}`, pilot: false, validation: 'Portable fixture', licenses: [], sourceLicensePresent: false, ...Object.fromEntries(FLAGS.map(flag => [flag, false])), nextGate: 'Coordinator review', hostNote: 'One root only' })]]), version);
}

registerCase('three pinned complete original sources; exact schema/default bytes and reversible patches', () => {
  assert.equal(overlay.files.size, 3); assert.equal(overlay.changes.length, 3);
  for (const [path, bytes] of originals) assert.equal(sha256(bytes), HOME_ANCHORS[path][1]);
  assert.deepEqual(loaded.defaults, prior.defaults); assert.deepEqual(loaded.defaults, HOME_DEFAULTS);
  assert.deepEqual(loaded.settingsSchema, prior.settingsSchema);
  assert.equal(loaded.default.name, KEY); assert.equal(loaded.default.settings, loaded.defaults); assert.equal(loaded.default.settingsSchema, loaded.settingsSchema);
  assert.equal(overlay.files.get(SHARED_SOURCE_PATH).toString().replace(SAFE_URL_SOURCE, SHARED_SOURCE.split('\n')[1]), SHARED_SOURCE);
  assert.equal(overlay.files.get(HOME_CSS_PATH).toString().replace(HOME_CSS_APPEND + '\n', '').replace(HOME_CSS_NEW_ROOT + ' {', HOME_CSS_OLD_ROOT + ' {'), CSS_SOURCE);
  let reverted = overlay.files.get(HOME_SOURCE_PATH).toString();
  for (const [from, to] of [
    [HOME_VALIDATION_SOURCE + '\n\n', ''],
    ["const source = typeof text === 'string' ? text : ''; ", "const source = String(text ?? '');"],
    ["const needle = typeof term === 'string' ? term.trim() : ''; ", "const needle = String(term ?? '').trim();"],
    ["const label = action ? action.label : ''; ", "const label = String(action?.label ?? '').trim();"],
    ["const href = action ? action.href : ''; ", 'const href = safeUrl(action?.href);'],
    ['const values = items;', 'const values = Array.isArray(items) && items.length ? items.slice(0, 8) : defaults.stats;'],
    ["  state = typeof state === 'string' ? state : '';\n", ''],
    ['const c = _homeSettings(settings);', 'const c = { ...defaults, ...settings, primaryAction: { ...defaults.primaryAction, ...settings.primaryAction }, secondaryAction: { ...defaults.secondaryAction, ...settings.secondaryAction } };'],
    ['aria-label="${escapeHtml(c.title)}"', 'aria-labelledby="mse-home-title"'],
    ['<h1 class=', '<h1 id="mse-home-title" class='],
    ['render: (context = {}) => _homeRenderContext(context)', 'render: ({ settings, state } = {}) => renderHome(settings, state)']
  ]) { assert.equal(reverted.split(from).length, 2); reverted = reverted.replace(from, () => to); }
  assert.equal(reverted, MODULE_SOURCE);
});
registerCase('tampered sources/foreign overlay paths and hooked Buffer bytes refused before execution', () => {
  for (const path of originals.keys()) { const bad = new Map(originals); bad.set(path, Buffer.concat([bad.get(path), Buffer.from('// unreviewed')])); assert.throws(() => applyHomeOverlay(bad), /Unapproved original SHA-256/); }
  assert.throws(() => applyHomeOverlay(new Map()), /exactly/);
  assert.throws(() => applyHomeOverlay(new Map([...originals, ['foreign.js', Buffer.alloc(0)]])), /exactly/);
  let calls = 0;
  const bad = new Map(originals); bad.set(HOME_SOURCE_PATH, Object.defineProperty(Buffer.from(MODULE_SOURCE), 'length', { get() { calls++; throw Error('not executed'); } }));
  assert.throws(() => applyHomeOverlay(bad), /Buffer own byte indices/); assert.equal(calls, 0);
});
registerCase('shared strict URL policy rejects unsafe forms, credential/protocol/percent evasions without coercion', () => {
  for (const href of ['#', '#/local', '/local/a?q="x"&v=1', '/local/caf%C3%A9', 'https://example.invalid/a', 'HTTPS://EXAMPLE.invalid/a']) assert.equal(shared.safeUrl(href), href);
  for (const href of [null, undefined, false, 2, {}, [], '', ' ', 'relative', '?query', 'http://example.invalid', 'javascript:x', 'data:text/html,x', '//unsafe.invalid', '/\\unsafe.invalid', 'https://u:p@example.invalid', 'https://@example.invalid', 'https:///example.invalid', 'https://[invalid', '/a b', '/a\t', '/a\0', '/a\u007f', '/%2funsafe', '/%5cunsafe', '/%0a', '/%252funsafe', '/%25250a', '/%2525252f', '/bad%', '/bad%zz', '/%20x', '/%C2%A0x', ' /x', '/x ']) { assert.equal(shared.safeUrl(href), '#'); assert.equal(shared.safeUrl(href, '/local/fallback'), '/local/fallback'); }
  let calls = 0; const evil = { toString() { calls++; throw Error('not called'); } }; assert.equal(shared.safeUrl(evil, evil), '#'); assert.equal(calls, 0);
});
registerCase('all eight typed XML fields, explicit original lengths, complete actions/stats defaults unchanged', () => {
  validateAdoptionSchema(descriptor, loaded);
  assert.equal(descriptor.params.length, 8); assert.equal(loaded.settingsSchema.version, 1);
  assert.deepEqual(descriptor.params.map(p => p.default), Object.values(loaded.defaults));
  assert.deepEqual(descriptor.params.map(p => [p.name, p.type, p.maxLength, p.valueType]), [
    ['eyebrow', 'text', 80, undefined], ['title', 'text', 180, undefined], ['primaryHighlight', 'text', 80, undefined], ['secondaryHighlight', 'text', 80, undefined], ['description', 'textarea', 400, undefined], ['primaryAction', 'json', undefined, 'object'], ['secondaryAction', 'json', undefined, 'object'], ['stats', 'json', undefined, 'array']
  ]);
  for (const p of descriptor.params) { assert.equal(p.options?.length ?? 0, 0); assert.equal(Object.hasOwn(p, 'min'), false); assert.equal(Object.hasOwn(p, 'max'), false); }
});
registerCase('valid native rendering preserves all markup/classes except fixed ID and literal aria-label', () => {
  const settings = { title: 'Conecta " <& conecta', eyebrow: 'Ey <&', primaryHighlight: 'conecta', secondaryHighlight: 'Unused', description: 'Desc <&', primaryAction: { label: ' Go <& ', href: '/local/actions' }, secondaryAction: { label: ' More ', href: '#/local' }, stats: [{ value: '42 <&', label: 'LOCAL <&' }] };
  for (const input of [{}, settings, { primaryAction: {}, secondaryAction: {}, stats: [] }, { primaryAction: { label: 'Custom' } }, { secondaryAction: { href: '/local/secondary' } }]) assert.equal(render(input), fixIds(prior.renderHome(input), input.title ?? prior.defaults.title));
  assert.match(render(settings), /aria-label="Conecta &quot; &lt;&amp; conecta"/); assert.match(render(settings), /<h1 class="mse-home__title"><span class="mse-home__accent mse-home__accent--primary">Conecta<\/span>/);
  assert.equal(loaded.default.render({ settings }), render(settings));
  assert.doesNotMatch(render({ future: 'UNKNOWN', imageUrl: 'UNKNOWN', rotatingWords: ['UNKNOWN'] }), /UNKNOWN|<img/);
});
registerCase('highlight preserves first locale slice match only; secondaryHighlight not silently implemented', () => {
  const title = 'AÇÃO ação Ação';
  assert.equal(render({ title, primaryHighlight: ' ação ', secondaryHighlight: 'Ação' }), render({ title, primaryHighlight: ' ação ', secondaryHighlight: 'Other' }));
  assert.equal((render({ title, primaryHighlight: 'ação' }).match(/<span class="mse-home__accent /g) ?? []).length, 1);
  assert.match(render({ title: '<needle & needle>', primaryHighlight: 'needle' }), /&lt;<span[^]*>needle<\/span> &amp; needle&gt;/);
  assert.doesNotMatch(render({ title: 'T', primaryHighlight: '', secondaryHighlight: 'T' }), /mse-home__accent--secondary/);
});
registerCase('explicit malformed string values render empty and never coerce or mutate stored values', () => {
  let calls = 0; const evil = { toString() { calls++; throw Error('not called'); }, toJSON() { calls++; throw Error('not called'); } };
  for (const key of ['title', 'eyebrow', 'description', 'primaryHighlight', 'secondaryHighlight']) for (const value of [null, undefined, false, 7, [], {}, evil]) assert.doesNotThrow(() => render({ [key]: value }));
  assert.match(render({ title: evil }), /aria-label=""[^]*<h1 class="mse-home__title"><\/h1>/);
  assert.match(render({ eyebrow: null, description: 1 }), /mse-home__accent--primary"><\/span>[^]*mse-home__sub"><\/p>/); assert.equal(calls, 0);
});
registerCase('actions preserve valid {} and partial merges; invalid explicit overrides omit rather than restore defaults', () => {
  assert.equal(countActions(render({ primaryAction: {}, secondaryAction: {} })), 2);
  const invalid = [null, undefined, false, 1, 'action', [], { label: '' }, { label: ' ' }, { label: 4 }, { label: {} }, { href: null }, { href: undefined }, { href: {} }, { href: '' }, { href: '#' }, { href: 'javascript:x' }, { href: '//unsafe.invalid' }, Object.create({ label: 'Inherited', href: '/local' })];
  for (const primaryAction of invalid) { const html = render({ primaryAction, secondaryAction: null }); assert.equal(countActions(html), 0); assert.doesNotMatch(html, /Open discussions|#discussions|href="#"/); }
  for (const href of ['#/local', '/local/a?q="x"&v=1', 'https://example.invalid/a']) assert.equal(countActions(render({ primaryAction: { label: 'Valid', href }, secondaryAction: { label: 'Valid', href } })), 2);
  assert.match(render({ primaryAction: { href: '/local/a' }, secondaryAction: null }), /href="\/local\/a">Open discussions/);
  assert.match(render({ primaryAction: { label: 'Local' }, secondaryAction: null }), /href="#discussions">Local/);
});
registerCase('stats preserve []/legacy fallback and filter first eight dense own string rows without getters', () => {
  for (const stats of [[], null, undefined, false, {}, 'stats']) assert.equal(countStats(render({ stats })), 4);
  const rows = [{ value: '1 <&', label: 'A <&' }, null, { value: 3, label: 'BAD' }, { value: '2', label: 'B' }, {}, Object.create({ value: 'X', label: 'BAD' })];
  assert.equal(countStats(render({ stats: rows })), 2); assert.match(render({ stats: rows }), /<b>1 &lt;&amp;<\/b><span>A &lt;&amp;<\/span>/);
  assert.equal(countStats(render({ stats: Array.from({ length: 12 }, (_, index) => ({ value: String(index), label: 'Local' })) })), 8);
  assert.equal(countStats(render({ stats: [{ value: '', label: '' }] })), 1);
  assert.equal(countStats(render({ stats: [{}] })), 0);
  let calls = 0; const getter = () => { calls++; throw Error('not called'); };
  for (const stats of [Object.defineProperty([], '0', { get: getter }), Array(3), Array.from({ length: 501 }, () => null), Object.defineProperty([{ value: '1', label: 'A' }], 'extra', { get: getter }), [Object.defineProperty({ value: '1' }, 'label', { get: getter })], [Object.defineProperty({ value: '1', label: 'A' }, 'unknown', { get: getter })]]) assert.equal(countStats(render({ stats })), 0);
  assert.equal(calls, 0);
});
registerCase('own plain settings/context/actions and safe states avoid getters/toJSON/coercion', () => {
  let calls = 0; const getter = () => { calls++; throw Error('not called'); };
  const evil = { toJSON: getter, toString: getter, valueOf: getter };
  for (const settings of [null, false, 1, 'settings', [], Object.create({ title: 'Inherited' }), Object.defineProperty({}, 'title', { get: getter }), Object.defineProperty({ title: 'T' }, 'unknown', { get: getter }), evil]) assert.doesNotThrow(() => render(settings));
  assert.equal(countActions(render(Object.defineProperty({}, 'primaryAction', { get: getter }))), 0);
  for (const action of [evil, Object.defineProperty({ label: 'Go' }, 'href', { get: getter }), Object.defineProperty({ href: '/local' }, 'label', { get: getter }), Object.defineProperty({ label: 'Go', href: '/local' }, 'unknown', { get: getter })]) assert.equal(countActions(render({ primaryAction: action, secondaryAction: null })), 0);
  for (const context of [null, false, 3, [], evil, Object.create({ settings: { title: 'Inherited' } }), Object.defineProperty({}, 'settings', { get: getter }), Object.defineProperty({ settings: {} }, 'state', { get: getter })]) assert.doesNotThrow(() => loaded.default.render(context));
  assert.equal(countActions(loaded.default.render(Object.defineProperty({}, 'settings', { get: getter }))), 0);
  for (const state of ['ready', 'loading', 'error', 'empty', 'unknown']) assert.equal(render({}, state), state === 'ready' ? fixIds(prior.renderHome({}, state), prior.defaults.title) : prior.renderHome({}, state));
  for (const state of [null, false, 1, evil]) assert.equal(render({}, state), '<section class="mse-home" aria-label="Home"></section>');
  assert.equal(calls, 0);
});
registerCase('two repeated instances have zero IDs and escaped meaningful literal title labels', () => {
  const html = render({ title: 'Useful " <&' }) + render({ title: 'Other' });
  assert.equal((html.match(/<h1 class="mse-home__title">/g) ?? []).length, 2); assert.doesNotMatch(html, /\sid=|aria-labelledby|mse-home-title/);
  assert.match(html, /aria-label="Useful &quot; &lt;&amp;"/); assert.match(html, /aria-label="Other"/);
  assert.doesNotMatch(CSS_SOURCE, /mse-home-title/);
});
registerCase('CSS remaps missing root and adds scoped bounded reflow; gradient order/palette/Lite/static decoration retained', () => {
  const css = overlay.files.get(HOME_CSS_PATH).toString(); assert.equal(css, CSS_SOURCE.replace(HOME_CSS_OLD_ROOT, HOME_CSS_NEW_ROOT) + HOME_CSS_APPEND + '\n');
  assert.ok(css.indexOf('background: transparent') < css.indexOf('radial-gradient(130%')); assert.doesNotMatch(css, /\.mse-home\.mse-home|@import|url\(/);
  assert.match(css, /\[data-mse-module="home"\]\[data-mse-theme="Lite"\]/);
  assert.match(HOME_CSS_APPEND, /^\.mse-home\{overflow-wrap:anywhere\}/); assert.match(HOME_CSS_APPEND, /column-gap:min\(2\.6em,4%\)/); assert.match(HOME_CSS_APPEND, /\.mse-home__lines\{overflow:hidden\}/);
  assert.match(HOME_CSS_APPEND, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/); assert.match(HOME_CSS_APPEND, /@media\(max-width:760px\)\{\.mse-home__stats\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.doesNotMatch(HOME_CSS_APPEND, /body|header|display:none|animation|\.mse-home__title\{overflow|background|color|padding/);
  const html = render(); assert.match(html, /<span style="--mse-home-floater-index:0">RPA<\/span>/); assert.doesNotMatch(html, /class="mse-home__floater"|data-mse-theme|data-mse-module/);
  assert.doesNotMatch(overlay.files.get(HOME_SOURCE_PATH).toString(), /setInterval|setTimeout|requestAnimationFrame|Math.random|document\./);
});
registerCase('narrow-root stats use ordered content-box container queries without clipping counters or changing runtime', () => {
  const suffix = '.mse-home{container-type:inline-size}@container(max-width:320px){.mse-home__stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@container(max-width:180px){.mse-home__stats{grid-template-columns:minmax(0,1fr)}}';
  assert.ok(HOME_CSS_APPEND.endsWith(suffix));
  assert.equal((HOME_CSS_APPEND.match(/@container/g) ?? []).length, 2);
  assert.equal((HOME_CSS_APPEND.match(/container-type:/g) ?? []).length, 1);
  assert.ok(HOME_CSS_APPEND.indexOf('@media(max-width:760px)') < HOME_CSS_APPEND.indexOf(suffix));
  assert.doesNotMatch(suffix, /overflow|font|padding|display|width:0|body|header|@media/);
  const stats = Array.from({ length: 8 }, (_, index) => ({ value: 'D'.repeat(120) + index, label: 'NARROWROOT'.repeat(40) + index }));
  const html = render({ stats }); assert.equal(countStats(html), 8);
  for (const row of stats) assert.ok(html.includes(`<b>${row.value}</b><span>${row.label}</span>`));
  assert.equal(sha256(overlay.files.get(HOME_SOURCE_PATH)), 'bad4ece1107c2f6e565ab3bb643070d05fe946f915127bbd1f01ff8d33556e10');
  assert.equal(sha256(overlay.files.get(SHARED_SOURCE_PATH)), 'e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76');
});
registerCase('render and unrelated admin update preserve exact settings JSON including invalid/future keys', async () => {
  const settingsJson = '{"title":"T","stats":[null,{}, {"value":"1","label":"A"}],"primaryAction":{"label":"Go","href":"javascript:x"},"secondaryAction":{},"future":{"keep":[true]},"__proto__":{"preserved":true}}';
  let record = { id: 101, title: 'Local', extensionKey: KEY, position: 'main-top', ordering: 2, enabled: true, scopeKind: 'All', assignment: 'all', assignmentJson: '[]', settingsJson, etag: 'local-etag' }; const writes = [];
  const service = createAdminService({ moduleInstances: { async findMany() { return { items: [structuredClone(record)] }; }, async findById() { return structuredClone(record); }, async update(id, patch) { writes.push(patch); record = { ...record, ...patch }; return structuredClone(record); } }, extensions: { async findMany() { return { items: [{ key: KEY, type: 'Module', enabled: true, manifestJson: descriptor.manifestJson }] }; } } });
  const stored = JSON.parse(settingsJson); const before = JSON.stringify(stored); render(stored); assert.equal(JSON.stringify(stored), before);
  await service.moduleInstances.update(101, { enabled: false }, { etag: 'local-etag' }); assert.equal(record.settingsJson, settingsJson); assert.equal(writes.length, 1); assert.equal(Object.hasOwn(writes[0], 'settingsJson'), false);
  const params = normalizeParamValues(descriptor.params, parseJsonObject(settingsJson, { strict: true }), { keepUndeclared: true }); assert.deepEqual(params.stats, stored.stats); assert.deepEqual(params.primaryAction, stored.primaryAction); assert.deepEqual(params.future, stored.future); assert.equal(Object.hasOwn(params, '__proto__'), true);
});
registerCase('closed CLI/options reject foreign modules/versions/paths/code and noninert metadata', async () => {
  const base = ['--base', '/offline/home/0.4.0', '--output', 'tmp/home-adapt-agent-portable'];
  assert.equal(parseHomeAdaptationArgs(base).dependenciesRoot, 'tmp/step2/camap-source'); assert.equal(parseHomeAdaptationArgs(base).version, '0.4.0'); assert.deepEqual(parseHomeAdaptationArgs(['--help']), { help: true });
  for (const module of ['all', 'mod_hero', 'mod_camap_home']) assert.throws(() => parseHomeAdaptationArgs([...base, '--module', module]));
  for (const version of ['0.2.0', '0.3.0', '0.3.1', '0.3.2', '0.4.2', '01.4.0']) { assert.throws(() => parseHomeAdaptationArgs([...base, '--version', version])); assert.throws(() => homeAdaptationXml(version), /Unauthorized/); }
  for (const output of ['public/x', 'tmp/hero-adapt-agent-x', 'tmp/home-adapt-agent-x/../y', 'tmp/home-adapt-agent-x/con', 'tmp/home-adapt-agent-x/aux.']) assert.throws(() => parseHomeAdaptationArgs(['--base', '/local', '--output', output]));
  for (const extra of [['--source', '../other'], ['--source', 'tmp/step2/camap-source'], ['--source', 'tmp/home-adapt-agent-portable/source'], ['--dependencies-root', '../other'], ['--inherited-license', '../other-LICENSE'], ['--inherited-license', 'tmp/home-adapt-agent-portable/LICENSE'], ['--profile', 'open'], ['--patches', 'code'], ['--base', '/duplicate']]) assert.throws(() => parseHomeAdaptationArgs([...base, ...extra]));
  assert.throws(() => parseHomeAdaptationArgs(['--output', base[3]]));
  let calls = 0; await assert.rejects(prepareHomeAdaptation(Object.defineProperty({}, 'base', { get() { calls++; throw Error('not called'); } })), /accessor/);
  await assert.rejects(prepareHomeAdaptation({ ...parseHomeAdaptationArgs(base), hashes: {} }), /Unknown/); await assert.rejects(prepareHomeAdaptation({ toJSON() { calls++; } }), /plain metadata/); assert.equal(calls, 0);
});
registerCase('finalizer produces 5 runtime/13 total/11 inventoried files, complete notices/false gates, both versions', () => {
  const hashes = [];
  for (const version of ['0.4.0', '0.4.1']) {
    const staged = stagedFixture(version); const originalInventory = Buffer.from(staged.get('MANIFEST-SHA256.json')); const final = finalizeHomePackage(staged, provenance());
    assert.deepEqual(staged.get('MANIFEST-SHA256.json'), originalInventory); assert.equal(final.files.size, 13); assert.equal(final.inventory.files.length, 11); assert.equal(final.adaptation.changes.length, 3);
    assert.equal(final.adaptation.snapshot.filter(entry => entry.originalSha256 !== entry.snapshotSha256).length, 3); assert.equal(final.adaptation.cssModified, true); assert.equal(final.adaptation.markupModified, true); assert.equal(final.adaptation.schemaModified, false); assert.equal(final.adaptation.vendorLicenseAssigned, false);
    assert.deepEqual(final.files.get(INHERITED_LICENSE_PATH), mit); assert.deepEqual(final.files.get(CHANGES_LICENSE_PATH), gpl);
    for (const flag of FLAGS) { assert.equal(final.adaptation[flag], false); assert.equal(final.adoptionPlan[flag], false); }
    for (const entry of final.inventory.files) { assert.equal(entry.bytes, final.files.get(entry.path).length); assert.equal(entry.sha256, sha256(final.files.get(entry.path))); }
    const inv = final.files.get('MANIFEST-SHA256.json'); assert.equal(final.hostConfig.joomlaDiscoveryRoots[0].inventoryHash, sha256(inv)); assert.deepEqual(inv, finalizeHomePackage(stagedFixture(version), provenance()).files.get('MANIFEST-SHA256.json')); hashes.push(sha256(inv));
  }
  assert.notEqual(hashes[0], hashes[1]);
});
registerCase('canonical XML rejects changed actions/stats/defaults/maxLength/types/aliases/unknown attrs even rehashed', () => {
  for (const [from, to] of [['maxlength="180"', 'maxlength="1"'], ['name="title"', 'name="title" unknown="x"'], ['default="Digital workspace"', 'default="Changed"'], ['#discussions', '/invented'], ['&quot;17&quot;', '&quot;99&quot;'], ['mj:valueType="array"', 'mj:valueType="object"'], ['name="secondaryHighlight"', 'name="alternateHighlight"'], ['type="text" />', 'type="text"><option value="x">X</option></field>'], ['method="upgrade"', 'method="upgrade" unknown="x"'], ['<fieldset name="basic">', '<fieldset name="basic" required="true">']]) {
    const staged = stagedFixture(); assert.ok(staged.get(XML).toString().includes(from)); staged.set(XML, Buffer.from(staged.get(XML).toString().replace(from, to))); rebuildInventory(staged); assert.throws(() => finalizeHomePackage(staged, provenance()), /XML canonical/);
  }
});
registerCase('finalizer refuses foreign/mandatory/control/provenance forgeries and arbitrary callback/hash evidence', () => {
  for (const path of ['foreign.json', `modules/${ELEMENT}/extra.js`, `libraries/camap/${HOME_CSS_PATH}`, 'libraries/camap/extensions/camap/_shared/extra.js', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH, 'ADAPTATION.json']) { const staged = stagedFixture(); staged.set(path, Buffer.from('foreign')); rebuildInventory(staged); assert.throws(() => finalizeHomePackage(staged, provenance()), /allowlist/); }
  for (const path of [ENTRY, XML, CSS, LIB, SHARED, 'docs/ADOPTION-NOTICE.md', 'host-config.json']) { const staged = stagedFixture(); staged.delete(path); assert.throws(() => finalizeHomePackage(staged, provenance()), /mandatory/); }
  const stale = stagedFixture(); stale.set(CSS, Buffer.from('stale')); assert.throws(() => finalizeHomePackage(stale, provenance()), /integrity/);
  const forged = stagedFixture(); forged.set(LIB, Buffer.from('export default {};\n')); rebuildInventory(forged); const fp = provenance(); fp.changes[1].generatedSha256 = sha256(forged.get(LIB)); assert.throws(() => finalizeHomePackage(forged, fp), /approved patch/);
  for (const patch of [{ changes: [] }, { licenses: ['LICENSE'] }, { generatorSha256: '0'.repeat(64) }, { adoptionApiSha256: '1'.repeat(64) }, { snapshot: [] }, { inheritedLicenseBytes: Buffer.from('MIT') }, { inheritedLicense: { ...provenance().inheritedLicense, scope: ['all vendor'] } }, { changesLicenseBytes: Buffer.from('GPL') }, { arbitrary: true }]) assert.throws(() => finalizeHomePackage(stagedFixture(), { ...provenance(), ...patch }));
  for (const [path, mutate] of [['host-config.json', value => { value.arbitrary = true; }], ['host-config.json', value => { value.joomlaDiscoveryRoots[0].discover = false; }], ['host-config.json', value => { value.moduleStyles[KEY].push('/foreign.css'); }], ['adoption-plan.json', value => { value.hostConfigured = true; }], ['adoption-plan.json', value => { value.validation = {}; }]]) { const staged = stagedFixture(); const value = JSON.parse(staged.get(path)); mutate(value); staged.set(path, json(value)); if (path === 'adoption-plan.json') rebuildInventory(staged); assert.throws(() => finalizeHomePackage(staged, provenance())); }
  let calls = 0; const p = Object.defineProperty(provenance(), 'changes', { get() { calls++; throw Error('not called'); } }); assert.throws(() => finalizeHomePackage(stagedFixture(), p), /accessor/);
  const functions = provenance(); functions.snapshot[0].toJSON = () => { calls++; }; assert.throws(() => finalizeHomePackage(stagedFixture(), functions), /plain metadata/); assert.equal(calls, 0);
});
registerCase('inert Buffer guards reject hooks/own length/symbols/prototype impostors with zero getter execution', () => {
  let calls = 0; const getter = () => { calls++; throw Error('not called'); };
  for (const property of ['length', 'valueOf', 'toJSON', 'buffer', 'byteOffset', 'byteLength', 'foo', Symbol('hook')]) {
    for (const field of ['inheritedLicenseBytes', 'changesLicenseBytes']) { const p = provenance(); p[field] = Object.defineProperty(Buffer.from(p[field]), property, { get: getter }); assert.throws(() => finalizeHomePackage(stagedFixture(), p), /Buffer own byte indices/); }
    for (const [path] of stagedFixture()) { const staged = stagedFixture(); staged.set(path, Object.defineProperty(Buffer.from(staged.get(path)), property, { get: getter })); assert.throws(() => finalizeHomePackage(staged, provenance()), /Buffer own byte indices/); }
  }
  for (const bytes of [new Uint8Array([1]), Object.create(Buffer.prototype), Object.setPrototypeOf(Buffer.from('x'), Object.create(Buffer.prototype))]) { const staged = stagedFixture(); staged.set(CSS, bytes); assert.throws(() => finalizeHomePackage(staged, provenance()), /trusted exact Buffer/); }
  const oversized = provenance(); oversized.inheritedLicenseBytes = Buffer.alloc(11 * 1024 * 1024); assert.throws(() => finalizeHomePackage(stagedFixture(), oversized), /budget/);
  const dense = provenance(); dense.arbitrary = Array.from({ length: 501 }, () => null); assert.throws(() => finalizeHomePackage(stagedFixture(), dense), /bounded/);
  const staged = stagedFixture(); for (const [path, bytes] of staged) { const pool = Buffer.allocUnsafe(bytes.length + 8); bytes.copy(pool, 4); staged.set(path, pool.subarray(4, 4 + bytes.length)); }
  const final = finalizeHomePackage(staged, provenance()); assert.deepEqual(final.files.get(CSS), overlay.files.get(HOME_CSS_PATH)); assert.notEqual(final.files.get(CSS), staged.get(CSS)); assert.equal(calls, 0);
});
registerCase('native Map gates reject own hooks/subclasses/brand impostors before callbacks; normal maps preserve all bytes', () => {
  let calls = 0; let rejected = 0;
  const callback = () => { calls++; throw Error('Map callback must never run'); };
  const gates = [
    { input: () => new Map(originals), run: value => applyHomeOverlay(value) },
    { input: () => stagedFixture(), run: value => finalizeHomePackage(value, provenance()) }
  ];
  for (const { input, run } of gates) {
    for (const property of ['size', 'has', 'get', 'entries', 'set', 'extra', Symbol.iterator]) {
      for (const descriptor of [{ get: callback }, { value: callback }]) {
        const value = Object.defineProperty(input(), property, descriptor);
        assert.throws(() => run(value), /exact native Map without own properties/); rejected++;
      }
    }
    class CallbackMap extends Map {
      get size() { return callback(); }
      has() { return callback(); }
      get() { return callback(); }
      entries() { return callback(); }
      [Symbol.iterator]() { calls++; return Map.prototype.entries.call(this); }
    }
    class GetterMap extends Map {
      get size() { return callback(); }
      get has() { return callback(); }
      get get() { return callback(); }
      get entries() { return callback(); }
      get [Symbol.iterator]() { return callback(); }
    }
    for (const value of [new CallbackMap(input()), new GetterMap(input()), new (class extends Map {})(input()), Object.setPrototypeOf(input(), Object.create(Map.prototype))]) {
      assert.throws(() => run(value), /exact native Map without own properties/); rejected++;
    }
    assert.throws(() => run(Object.create(Map.prototype)), /branded native Map/); rejected++;
    for (const value of [null, undefined, false, 1, {}, []]) { assert.throws(() => run(value), /exact native Map without own properties/); rejected++; }
  }
  const invalidMap = Object.defineProperty(stagedFixture(), Symbol.iterator, { get: callback });
  const invalidEvidence = Object.defineProperty(provenance(), 'changes', { get: callback });
  assert.throws(() => finalizeHomePackage(invalidMap, invalidEvidence), /exact native Map without own properties/); rejected++;
  assert.equal(rejected, 51); assert.equal(calls, 0);
  const cleanSources = new Map(originals); const actualOverlay = applyHomeOverlay(cleanSources);
  assert.deepEqual(actualOverlay.changes, overlay.changes);
  for (const [path, bytes] of overlay.files) assert.deepEqual(actualOverlay.files.get(path), bytes);
  for (const version of ['0.4.0', '0.4.1']) {
    const cleanStaged = stagedFixture(version); const before = new Map([...cleanStaged].map(([path, bytes]) => [path, Buffer.from(bytes)]));
    const expected = finalizeHomePackage(stagedFixture(version), provenance()); const actual = finalizeHomePackage(cleanStaged, provenance());
    assert.equal(actual.files.size, 13); assert.equal(actual.inventory.files.length, 11);
    for (const [path, bytes] of expected.files) assert.deepEqual(actual.files.get(path), bytes);
    for (const [path, bytes] of before) assert.deepEqual(cleanStaged.get(path), bytes);
    assert.equal(Reflect.ownKeys(cleanStaged).length, 0);
  }
  assert.equal(Reflect.ownKeys(cleanSources).length, 0); assert.equal(calls, 0);
});

/** Explicit local read-only audit: only pinned fixture JS imported above. */
export async function auditHomeAdaptationPackage(directory, version) {
  const root = resolve(PROJECT, directory); const output = relative(PROJECT, root).replaceAll('\\', '/');
  parseHomeAdaptationArgs(['--base', `/offline/home/${version}`, '--version', version, '--output', output]);
  const files = await readAdaptationFiles(root); const invBytes = files.get('MANIFEST-SHA256.json'); const inventory = JSON.parse(invBytes);
  assert.equal(inventory.version, version); assert.equal(inventory.files.length, 11); assert.equal(files.size, 13);
  for (const entry of inventory.files) { assert.equal(files.get(entry.path).length, entry.bytes); assert.equal(sha256(files.get(entry.path)), entry.sha256); }
  assert.deepEqual([...files.keys()].sort(), [...inventory.files.map(entry => entry.path), 'MANIFEST-SHA256.json', 'host-config.json'].sort());
  assert.deepEqual(files.get(LIB), overlay.files.get(HOME_SOURCE_PATH)); assert.deepEqual(files.get(SHARED), overlay.files.get(SHARED_SOURCE_PATH)); assert.deepEqual(files.get(CSS), overlay.files.get(HOME_CSS_PATH)); assert.deepEqual(files.get(XML), homeAdaptationXml(version));
  const a = JSON.parse(files.get('ADAPTATION.json')); const plan = JSON.parse(files.get('adoption-plan.json')); const config = JSON.parse(files.get('host-config.json'));
  assert.equal(a.cssModified, true); assert.equal(a.markupModified, true); assert.equal(a.schemaModified, false); assert.equal(a.vendorLicenseAssigned, false); assert.equal(a.generator.algorithmModified, false); assert.equal(a.adoptionApi.byteIdenticalRelocation, true);
  assert.equal(a.generator.path, 'tools/prepare-joomla-modules.js'); assert.equal(a.adoptionApi.path, 'scripts/prepare-module-adoption.js');
  assert.equal(a.adoptionApi.sha256, HOME_API_SHA256); assert.equal(a.adoptionApi.sha256, sha256(await readFile(join(PROJECT, a.adoptionApi.path))));
  assert.equal(a.generator.sha256, sha256(await readFile(join(PROJECT, '..', 'CAMAP2', a.generator.path))));
  assert.equal(a.inheritedLicenseSource.originCommit, ADAPTATION_ORIGIN_COMMIT); assert.ok(ADAPTATION_MIT_HASHES.includes(sha256(files.get(INHERITED_LICENSE_PATH)))); assert.deepEqual(files.get(CHANGES_LICENSE_PATH), gpl);
  for (const flag of FLAGS) { assert.equal(plan[flag], false); assert.equal(a[flag], false); }
  const p = { changes: a.changes, licenses: a.originalLicenses, snapshot: a.snapshot, inheritedLicense: a.inheritedLicenseSource, inheritedLicenseBytes: files.get(INHERITED_LICENSE_PATH), changesLicenseSource: a.changesLicenseSource, changesLicenseBytes: files.get(CHANGES_LICENSE_PATH), generatorSha256: a.generator.sha256, adoptionApiSha256: a.adoptionApi.sha256 };
  const staged = new Map(files); for (const path of ['ADAPTATION.json', 'docs/ADAPTATION-NOTICE.md', INHERITED_LICENSE_PATH, CHANGES_LICENSE_PATH]) staged.delete(path);
  const oldPlan = { ...plan }; for (const key of ['adaptation', 'inheritedLicenseSource', 'changesLicenseSource', 'sourceRootLicensePresent']) delete oldPlan[key]; oldPlan.licenses = []; oldPlan.sourceLicensePresent = false; staged.set('adoption-plan.json', json(oldPlan));
  staged.set('MANIFEST-SHA256.json', json({ ...inventory, files: [...staged].filter(([path]) => !['MANIFEST-SHA256.json', 'host-config.json'].includes(path)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) }));
  const oldConfig = structuredClone(config); oldConfig.joomlaDiscoveryRoots[0].inventoryHash = sha256(staged.get('MANIFEST-SHA256.json')); staged.set('host-config.json', json(oldConfig));
  const final = finalizeHomePackage(staged, p); for (const [path, bytes] of final.files) assert.deepEqual(files.get(path), bytes, `reconstructed final ${path}`);
  for (const entry of a.snapshot) { const bytes = await readFile(join(PROJECT, '..', 'CAMAP2', entry.path)); assert.equal(entry.originalSha256, sha256(bytes), `actual original ${entry.path}`); assert.equal(entry.bytes, bytes.length); }
  const patched = applyHomeOverlay(new Map(await Promise.all(Object.keys(HOME_ANCHORS).map(async path => [path, await readFile(join(PROJECT, '..', 'CAMAP2', path))]))));
  for (const change of a.changes) assert.deepEqual(change, patched.changes.find(item => item.path === change.path));
  const parsed = parseJoomlaManifest(files.get(XML), { baseUrl: plan.base, manifestPath: XML }); validateAdoptionSchema(parsed, loaded); assert.deepEqual(parsed.params.map(p => p.default), Object.values(prior.defaults));
  const port = { async listFolders() { return { value: [{ Name: ELEMENT }] }; }, async downloadFile({ folderPath, fileName }) { const path = [folderPath, fileName].filter(Boolean).join('/'); assert.ok(files.has(path)); return Buffer.from(files.get(path)); } };
  const service = createJoomlaDiscoveryService({ roots: [{ ...config.joomlaDiscoveryRoots[0], files: port }] }); const discovered = await service.scan(); assert.equal(discovered.length, 1); await service.verify(discovered[0]);
  assert.equal(config.joomlaDiscoveryRoots[0].inventoryHash, sha256(invBytes));
  return { version, reviewedSources: 3, patches: 3, cssModified: true, markupModified: true, schemaFields: 8, inventoriedFiles: inventory.files.length, totalFiles: files.size, inventoryHash: sha256(invBytes), browserValidated: false, publicationApproved: false, rightsApproved: false };
}
export async function runHomeAdaptationTests() {
  assert.equal(cases.length, 20); for (const { run } of cases) await run();
  console.log('ok - Home adaptation: 20 portable cases; pinned sources/URLs/plain strings/actions/stats/context/schema/IDs/CSS/container queries/notices/inert Buffers/native Maps/integrity and preserved JSON');
  return { suite: 'home-adaptation', tests: cases.length, passed: cases.length, mode: 'portable-pinned-source', browserValidated: false, publicationApproved: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { test } = await import('node:test'); for (const { name, run } of cases) test(name, run);
  const cli = process.argv.slice(2);
  if (cli.includes('--local-build')) {
    test('explicit local build: both original-generator revisions, real CSS AST/file-port audit and unchanged sources/deps', async () => {
      assert.deepEqual(cli, ['--local-build']);
      const source = createAdaptationCollector(); const camap = join(PROJECT, '..', 'CAMAP2');
      await source.add(camap, SHARED_SOURCE_PATH); await source.add(camap, 'tools/prepare-joomla-modules.js'); await source.add(camap, 'package.json');
      for (const { folder } of ADOPTION_MODULES) { const directory = `extensions/camap/${folder}`; for (const entry of await source.list(camap, directory)) if (entry.isFile() && /\.(js|css)$/.test(entry.name)) await source.add(camap, `${directory}/${entry.name}`); }
      const deps = await collectAdaptationDependencies(join(PROJECT, 'tmp/step2/camap-source'));
      const require = createRequire(join(PROJECT, 'tmp/step2/camap-source/package.json')); const css = require('css-tree');
      const expected = css.parse(CSS_SOURCE, { positions: false }); expected.children.first.prelude = css.parse(HOME_CSS_NEW_ROOT, { context: 'selectorList' }); expected.children.appendList(css.parse(HOME_CSS_APPEND, { positions: false }).children);
      const actual = css.parse(overlay.files.get(HOME_CSS_PATH).toString(), { positions: false }); assert.equal(css.generate(expected), css.generate(actual), 'only first root selector remap and exact scoped append changed');
      const appendNodes = css.parse(HOME_CSS_APPEND, { positions: false }).children.toArray();
      assert.equal(appendNodes.length, 9);
      assert.deepEqual(appendNodes.slice(-3).map(node => css.generate(node)), [
        '.mse-home{container-type:inline-size}',
        '@container (max-width:320px){.mse-home__stats{grid-template-columns:repeat(2,minmax(0,1fr))}}',
        '@container (max-width:180px){.mse-home__stats{grid-template-columns:minmax(0,1fr)}}'
      ]);
      const api = createAdaptationCollector(); for (const path of ADAPTATION_API_FILES) await api.add(PROJECT, path); await api.add(PROJECT, CHANGES_LICENSE_PATH);
      const originalMit = await readFile(join(PROJECT, '..', 'LICENSE')); const container = await mkdtemp(join(PROJECT, 'tmp/home-adapt-agent-tests-')); const receipts = []; const params = [];
      for (const version of ['0.4.0', '0.4.1']) {
        const output = `${relative(PROJECT, container).replaceAll('\\', '/')}/${version}`; const options = { version, base: `/offline/home/${version}`, output };
        const built = await prepareHomeAdaptation(options); receipts.push({ ...await auditHomeAdaptationPackage(output, version), sourceFiles: built.originalSourceFiles, dependencyFiles: built.dependencyFiles }); params.push(built.descriptor.params);
        await assert.rejects(prepareHomeAdaptation(options), /existing output/); await assert.rejects(prepareHomeAdaptation({ ...options, sourceRoot: built.snapshot, output: `${output}-override-rejected` }), /trusted CAMAP copy/);
      }
      await Promise.all([source.check(), deps.check(), api.check()]); assert.deepEqual(await readFile(join(PROJECT, '..', 'LICENSE')), originalMit); assert.deepEqual(params[0], params[1]); assert.notEqual(receipts[0].inventoryHash, receipts[1].inventoryHash);
      console.log(JSON.stringify({ output: container, receipts }, null, 2));
    });
  } else if (cli.length) {
    test('explicit read-only package audits', async () => { assert.equal(cli.length, 3); assert.equal(cli[0], '--packages'); for (let i = 0; i < 2; i++) console.log(JSON.stringify(await auditHomeAdaptationPackage(cli[i + 1], ['0.4.0', '0.4.1'][i]))); });
  }
}
