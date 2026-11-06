import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createApplication } from '../src/index.js';
import { createFakeAdapter } from '../src/libraries/minijoomla/infrastructure/fake-adapter.js';
import { sameSiteModuleUrl } from '../src/libraries/minijoomla/application/extension-input.js';

const BODY = '<p>Fale com a@b.com</p><hr class="system-pagebreak" title="Dois"><p>{loadmodule custom-html}</p>';
const seed = () => ({
  articles: ['um', 'dois', 'tres'].map((alias, index) => ({
    id: index + 1, title: alias, alias, introtext: '<p>Intro</p>', fulltext: BODY, category: 'noticias', published: true,
    publishUp: `2026-0${index + 1}-01T00:00:00Z`
  })),
  categories: [{ id: 1, title: 'Notícias', alias: 'noticias', parentId: null, description: '' }]
});
const plugin = (key, extra = {}) => ({ id: key, type: 'Plugin', key, title: key, entryPointUrl: `native:${key}`, enabled: true, ...extra });

async function open(path, extensions, options = {}) {
  const doc = { body: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }, documentElement: {}, title: '' };
  const app = createApplication({
    autoStart: false, documentRef: doc, adapter: createFakeAdapter(seed()), getModuleInstances: async () => [],
    getExtensions: async () => extensions, config: { customHtml: { title: 'X', html: '<p>Bloco</p>' } }, ...options
  });
  await app.start();
  await app.router.navigate(path);
  return doc.body.innerHTML;
}

export async function runPluginsNativeRuntimeTests() {
  // Opt-in: sem linha habilitada o conteúdo passa intacto.
  const plain = await open('/article/dois', []);
  assert.match(plain, /a@b\.com/);
  assert.doesNotMatch(plain, /aria-label="Navegação entre artigos"|<li><a[^>]*>Anterior/);
  const disabled = await open('/article/dois', [plugin('emailcloak', { enabled: false })]);
  assert.match(disabled, /a@b\.com/, 'plugin desabilitado não roda');

  // Habilitados: cada plugin sobrevive à sanitização final da página real.
  const cloaked = await open('/article/dois', [plugin('emailcloak')]);
  assert.doesNotMatch(cloaked, /a@b\.com/);

  const paged = await open('/article/dois', [plugin('pagebreak')]);
  assert.match(paged, /<ol><li><a href="[^"]*\/article\/dois\?page=1">/, 'sumário usa links reais de página');
  assert.match(paged, /Fale com/);
  const second = await open('/article/dois?page=2', [plugin('pagebreak')]);
  assert.doesNotMatch(second, /Fale com/, 'página 2 mostra só a segunda seção');

  const navigation = await open('/article/dois', [plugin('pagenavigation')]);
  assert.match(navigation, /href="[^"]*\/article\/(um|tres)"[^>]*>(Anterior|Próximo): (um|tres)/);

  // {loadmodule}: precisa dos módulos já registrados e nunca reprocessa o resultado.
  const loaded = await open('/article/dois', [plugin('loadmodule')]);
  assert.doesNotMatch(loaded, /\{loadmodule/);

  // Módulos por instância recebem dados reais: categorias raiz e sessão do host.
  const instances = async () => [
    { id: 1, extensionKey: 'articles-categories', position: 'sidebar-right', enabled: true },
    { id: 2, extensionKey: 'login', position: 'sidebar-right', enabled: true }
  ];
  const modules = await open('/article/dois', [], { getModuleInstances: instances, config: { session: { name: 'Visitante' } } });
  assert.match(modules, /<a href="[^"]*\/category\/noticias">Notícias<\/a>/, 'categorias raiz aparecem no módulo');
  assert.match(modules, /Visitante/, 'sessão do host chega ao módulo de login');

  // Allowlist fechada: `native:` só vale para chaves conhecidas; extensões externas seguem o import normal.
  assert.equal(sameSiteModuleUrl('native:emailcloak'), 'native:emailcloak');
  assert.throws(() => sameSiteModuleUrl('native:qualquer'));
  assert.throws(() => sameSiteModuleUrl('https://evil.example/x.js'));
  const imported = [];
  await open('/article/dois', [{ id: 9, type: 'Plugin', key: 'externo', entryPointUrl: './externo.js', enabled: true }], {
    importModule: async (url) => { imported.push(url); return { default: { events: {} } }; }
  });
  assert.deepEqual(imported, ['./externo.js']);

  // Sem importModule injetado a chamada precisa alcançar o import padrão, não um identificador ausente.
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try { await open('/article/dois', [{ id: 9, type: 'Plugin', key: 'ausente', entryPointUrl: './nao-existe-mj.js', enabled: true }]); }
  finally { console.warn = warn; }
  assert.ok(warnings.every((text) => !/DEFAULT_IMPORT/.test(text)));
  console.log('ok - plugins native runtime: opt-in, sanitized output, pagination, closed allowlist');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runPluginsNativeRuntimeTests();
