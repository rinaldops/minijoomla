import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createPluginManager } from '../src/libraries/minijoomla/plugins/manager.js';
import { emailcloakPlugin } from '../src/plugins/content/emailcloak/emailcloak.js';
import { pagebreakPlugin } from '../src/plugins/content/pagebreak/pagebreak.js';
import { loadmodulePlugin } from '../src/plugins/content/loadmodule/loadmodule.js';
import { pagenavigationPlugin } from '../src/plugins/content/pagenavigation/pagenavigation.js';

for (const key of ['emailcloak', 'pagebreak', 'loadmodule', 'pagenavigation']) {
  const manifest = readFileSync(new URL(`../src/plugins/content/${key}/${key}.xml`, import.meta.url), 'utf8');
  assert.match(manifest, /<extension type="plugin" group="content"/);
  assert.ok(manifest.includes(`${key}.js`), `${key} manifest declares its entry point`);
}

export async function runPluginsBuiltinTests() {
  const manager = createPluginManager();
  [emailcloakPlugin, pagebreakPlugin, loadmodulePlugin, pagenavigationPlugin].forEach((plugin) => manager.register(plugin));
  assert.deepEqual(manager.list('content'), ['emailcloak', 'pagebreak', 'loadmodule', 'pagenavigation']);
  assert.deepEqual(manager.list('system'), []);

  // emailcloak
  const cloaked = await manager.prepareContent('<p>a@b.com</p><a href="mailto:a@b.com?subject=x">a@b.com</a><img alt="z@y.org">');
  assert.doesNotMatch(cloaked, /a@b\.com/); assert.match(cloaked, /&#97;&#64;&#98;/);
  assert.match(cloaked, /href="mailto:%61%40%62%2E%63%6F%6D\?subject=x"/);
  assert.match(cloaked, /alt="z@y\.org"/, 'attribute values other than mailto href are untouched');
  assert.equal(await manager.prepareContent('sem email @ aqui'), 'sem email @ aqui');

  // pagebreak
  const paged = await manager.prepareContent('<p>Intro</p><hr class="system-pagebreak" title="Dois <script>x</script>"><p>Corpo 2</p><hr class="system-pagebreak"><p>Corpo 3</p>');
  assert.match(paged, /<ol><li><a href="#pagebreak-1">Introdução<\/a><\/li><li><a href="#pagebreak-2">Dois x<\/a>/);
  assert.match(paged, /Página 3/); assert.doesNotMatch(paged, /<hr|<script/);
  const single = await manager.prepareContent('<hr class="system-pagebreak" title="T"><p>B</p>', { page: 2, pageLink: (n) => `/p/${n}` });
  assert.match(single, /href="\/p\/2"/); assert.doesNotMatch(single, /pagebreak-1/);
  assert.equal(await manager.prepareContent('<hr class="other">'), '<hr class="other">');

  // loadmodule: sanitizado, sem recursão, limitado, nomes validados
  const calls = [];
  const context = { renderModule: async (name) => { calls.push(name); return '<p>M</p><script>alert(1)</script><a href="javascript:x">l</a>{loadmodule loop}'; }, renderPosition: (p) => `<ul><li>${p}</li></ul>` };
  const out = await manager.prepareContent('A {loadmodule banner} B {loadposition sidebar-left} C {loadmodule ../etc} D {loadmodule x y}', context);
  assert.deepEqual(calls, ['banner']);
  assert.doesNotMatch(out, /script|javascript:|loadmodule|loadposition|\.\./);
  assert.match(out, /<p>M<\/p>.*<li>sidebar-left<\/li>/);
  assert.equal(await manager.prepareContent('{loadmodule a}', {}), '');
  assert.equal(await manager.prepareContent('{loadmodule a}', { renderModule: () => { throw new Error('x'); } }), '');
  const many = await manager.prepareContent(Array.from({ length: 15 }, (_, i) => `{loadmodule m${i}}`).join(''), { renderModule: () => '.' });
  assert.equal(many, '.'.repeat(10));

  // pagenavigation via display events
  const siblings = [{ alias: 'a', title: 'A<1>' }, { alias: 'b', title: 'B' }, { alias: 'c', title: 'C' }];
  const nav = await manager.contentAfterDisplay({ article: { alias: 'b' }, siblings });
  assert.match(nav, /Anterior: A&lt;1&gt;/); assert.match(nav, /Próximo: C/);
  assert.equal(await manager.contentAfterDisplay({ article: { alias: 'zz' }, siblings }), '');
  assert.doesNotMatch(await manager.contentAfterDisplay({ article: { alias: 'a' }, siblings }), /Anterior/);

  // catálogo de eventos
  const events = createPluginManager();
  events.register({ name: 'one', group: 'system', events: {
    onContentAfterTitle: () => '<b>t</b><script>x</script>', onContentBeforeDisplay: () => 'x<img src="javascript:1" onerror="y">', onContentAfterDisplay: () => 1,
    onContentBeforeSave: (data) => ({ ...data, title: 'saved' }), onContentAfterSave: () => { throw new Error('boom'); }, onAfterRoute: (location) => ({ ...location, routed: true })
  } });
  events.register({ name: 'two', events: { onContentAfterTitle: () => '<i>2</i>' } });
  assert.equal(await events.contentAfterTitle({}), '<b>t</b><i>2</i>');
  assert.doesNotMatch(await events.contentBeforeDisplay({}), /javascript|onerror/);
  assert.equal(await events.contentAfterDisplay({}), '');
  assert.deepEqual(await events.beforeSave({ title: 'a' }), { title: 'saved' });
  assert.deepEqual(await events.afterSave({ id: 1 }), { id: 1 });
  assert.deepEqual(await events.afterRoute({ path: '/' }), { path: '/', routed: true });
  assert.deepEqual(events.list('system'), ['one']);
  assert.throws(() => events.register({ name: 'bad', group: 'admin' }), /group/);
  assert.throws(() => events.register({ name: 'str', events: { onContentAfterTitle: 'alert(1)' } }), /função/);
  // compatibilidade: sem novos eventos, tudo como antes
  assert.equal(await createPluginManager().prepareContent('x'), 'x');
  console.log('ok - plugins builtin: emailcloak, pagebreak, loadmodule, pagenavigation, event catalogue');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await runPluginsBuiltinTests();
