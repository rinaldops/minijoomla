const STORAGE_KEY = 'minijoomla-demo-v1';
const clone = (value) => structuredClone(value);

function initialData() {
  return {
    articles: [
      { id: 1, title: 'Bem-vindo ao MINIJOOMLA', alias: 'boas-vindas', state: 'Published', featured: true, categoryId: 1, introtext: 'Conteúdo modular com administração independente.', fulltext: '<p>Edite este conteúdo no painel local e recarregue o site para conferir.</p>', publishUp: '2026-01-01', tags: 'guia, notícias', attribsJson: '{"images":{"image_intro":"/examples/assets/demo-featured.svg","image_intro_alt":"Ilustração demonstrativa do MINIJOOMLA"}}' },
      { id: 2, title: 'Organize o seu portal', alias: 'organize-seu-portal', state: 'Published', featured: false, categoryId: 1, introtext: 'Módulos, plugins e templates configuráveis.', fulltext: '<p>Escolha Cassiopeia ou CAMAP na configuração do site.</p>', publishUp: '2026-02-01', tags: 'guia' }
    ],
    categories: [{ id: 1, title: 'Notícias', alias: 'noticias', description: 'Publicações recentes.', parentId: null }],
    tags: [{ id: 1, name: 'guia', alias: 'guia', state: 'Published' }, { id: 2, name: 'notícias', alias: 'noticias', state: 'Published' }],
    menu: [
      { id: 1, title: 'Início', path: '/', published: 'Published', ordering: 1 },
      { id: 2, title: 'Notícias', path: '/category/noticias', published: 'Published', ordering: 2 },
      { id: 3, title: 'Arquivo', path: '/archive', published: 'Published', ordering: 3 },
      { id: 4, title: 'Busca', path: '/search', published: 'Published', ordering: 4 }
    ],
    extensions: [
      { id: 1, title: 'Artigos recentes', key: 'articles-latest', type: 'Module', entryPointUrl: new URL('../src/modules/mod_articles_latest/mod_articles_latest.js', import.meta.url).href, enabled: true },
      { id: 2, title: 'Nota demonstrativa no conteúdo', key: 'demo-content', type: 'Plugin', entryPointUrl: new URL('./demo-plugin.js', import.meta.url).href, enabled: false }
    ],
    moduleInstances: [
      { id: 1, title: 'Artigos recentes', extensionKey: 'articles-latest', position: 'sidebar-right', ordering: 1, settingsJson: '{"limit":5}', enabled: true, scopeKind: 'All' },
      { id: 2, title: 'Destaques', extensionKey: 'articles-news', position: 'sidebar-right', ordering: 2, settingsJson: '{"limit":3}', enabled: true, scopeKind: 'All' },
      { id: 3, title: 'Tags', extensionKey: 'tags-popular', position: 'sidebar-right', ordering: 3, enabled: true, scopeKind: 'All' },
      { id: 4, title: 'Arquivo', extensionKey: 'articles-archive', position: 'sidebar-right', ordering: 4, settingsJson: '{"limit":12}', enabled: true, scopeKind: 'All' },
      { id: 5, title: 'Busca', extensionKey: 'search', position: 'search', ordering: 1, enabled: true, scopeKind: 'All' },
      { id: 6, title: 'Destaques (imagem)', extensionKey: 'articles-featured', position: 'destaques', ordering: 1, settingsJson: '{"limit":3}', enabled: true, scopeKind: 'All' },
      // `<div>` (não `<article>`): `sanitizeHtml()` (security/sanitize.js)
      // não inclui `article` em `ALLOWED_TAGS` — tags não listadas são
      // removidas preservando o conteúdo interno (achado/corrigido na
      // Iteração 6, ver CAMAP-V3-TEMPLATE.md "Fechamento — Iteração 6").
      { id: 7, title: 'Agenda e avisos', extensionKey: 'custom-html', position: 'agenda-avisos', ordering: 1, settingsJson: '{"html":"<div><h3>Calendário de eventos</h3><p>Próximas paradas programadas.</p></div><div><h3>Prazos importantes</h3><p>Entrega de relatórios mensais.</p></div>"}', enabled: true, scopeKind: 'All' }
    ],
    templates: [
      { id: 1, title: 'Cassiopeia', key: 'cassiopeia', version: '1.0.0', entryPointUrl: new URL('../src/templates/cassiopeia/index.js', import.meta.url).href, styles: '', enabled: true },
      // `camap-v3` (pivô de empacotamento, Iteração 4.0): não é builtin do
      // web-devs/CAMAP-V3/minijoomla-template/, publicado neste preview
      // local sob o prefixo `/pkg/camap-v3/` por
      // `scripts/serve-local.js --extra-root pkg/camap-v3=../CAMAP-V3/minijoomla-template`
      // (ver docs/TEMPLATE-INSTALL-CONTRACT.md). `entryPointUrl`/`styles`
      // same-site relativos à origem do preview, resolvidos via `import()`
      // dinâmico pelo caminho de catálogo de `template-runtime.js` — nunca
      // via `BUILTINS`. `positions`/`paramDefinitionsJson` espelham
      // `camap-v3.manifest.json` do pacote.
      {
        id: 3, title: 'CAMAP V3 (em desenvolvimento)', key: 'camap-v3', version: '0.6.0',
        entryPointUrl: '/pkg/camap-v3/index.js',
        styles: '["/pkg/camap-v3/css/template.css","/pkg/camap-v3/css/layout.css","/pkg/camap-v3/css/responsive.css"]',
        // Nome de campo correto é `positionsJson` (lido por
        // `template-runtime.js`'s `resolve()` e por `admin-service.js`'s
        // `normalizeTemplateInput()`/`toTemplateFormValues()`) — não
        // `positions`. Um seed anterior usava `positions:`, que nunca era
        // lido por `resolve()` (ficava `undefined` -> `[]`), fazendo
        // `destaques`/`agenda-avisos` cair silenciosamente em `sidebar` em
        // vez de rotear para a posição declarada. Corrigido na Iteração 5.
        // Iteração 6 adiciona `links-uteis`/`search`/`main-top`/
        // `main-bottom`/`sidebar-left`/`sidebar-right` (8 → 14 posições),
        // espelhando `camap-v3.manifest.json`.
        positionsJson: '["hero","menu-principal","breadcrumbs","missao","gerencias","destaques","agenda-avisos","links-uteis","search","main-top","main-bottom","sidebar-left","sidebar-right","footer"]',
        paramDefinitionsJson: JSON.stringify([
          { name: 'siteTitle', type: 'text', label: 'Título do site (wordmark do masthead)', default: '' },
          { name: 'siteDescription', type: 'text', label: 'Descrição/tagline do masthead', default: '' },
          { name: 'heroKicker', type: 'text', label: 'Subtítulo do hero (acima do título)', default: '' },
          { name: 'heroTitle', type: 'text', label: 'Título do hero', default: '' },
          { name: 'heroLead', type: 'text', label: 'Texto do hero (abaixo do título)', default: '' },
          { name: 'heroActionLabel', type: 'text', label: 'Texto do botão de ação do hero', default: '' },
          { name: 'heroActionUrl', type: 'url', label: 'URL do botão de ação do hero', default: '' },
          { name: 'heroImage', type: 'url', label: 'Imagem institucional do hero', default: '' },
          { name: 'heroImageAlt', type: 'text', label: 'Texto alternativo da imagem do hero', default: '' },
          { name: 'accentColor', type: 'select', label: 'Cor de destaque (botão do hero)', options: [{ value: 'sun', label: 'Amarelo (sol)' }, { value: 'ocean', label: 'Azul (oceano)' }, { value: 'teal', label: 'Verde-água' }, { value: 'green', label: 'Verde' }], default: 'sun' },
          { name: 'missaoTitle', type: 'text', label: 'Título da faixa de missão', default: '' },
          { name: 'missaoText', type: 'textarea', label: 'Texto institucional da missão', default: '' },
          { name: 'missaoTag1', type: 'text', label: 'Tag de valor 1', default: '' },
          { name: 'missaoTag2', type: 'text', label: 'Tag de valor 2', default: '' },
          { name: 'missaoTag3', type: 'text', label: 'Tag de valor 3', default: '' },
          { name: 'gerenciasItems', type: 'json', valueType: 'array', label: 'Cards de gerências', default: [] }
        ]),
        enabled: true
      }
    ],
    siteConfig: [{ id: 1, title: 'MiniJoomlaSiteConfig', siteName: 'MINIJOOMLA', templateKey: 'cassiopeia', siteDescription: 'Demonstração local integrada ao painel administrativo.', language: 'pt-BR', timezone: 'America/Sao_Paulo', pageSize: 5, basePath: '' }]
  };
}

export function createDemoRepositories({ storage = globalThis.localStorage } = {}) {
  let memory;
  function read() {
    const raw = storage ? storage.getItem(STORAGE_KEY) : memory;
    if (raw) {
      const state = JSON.parse(raw);
      if (!Number.isInteger(state.revision) || !state.domains || typeof state.domains !== 'object') throw new TypeError('Dados da demonstração local inválidos.');
      return state;
    }
    const domains = Object.fromEntries(Object.entries(initialData()).map(([domain, records]) => [domain, records.map((row) => ({ ...row, etag: '"1"' }))]));
    return { revision: 1, domains };
  }
  function write(state) {
    const json = JSON.stringify(state);
    if (storage) storage.setItem(STORAGE_KEY, json);
    else memory = json;
  }
  const initial = read();
  write(initial);
  return Object.freeze(Object.fromEntries(Object.keys(initial.domains).map((domain) => {
    function mutate(id, input, etag, remove = false) {
      const state = read();
      const records = state.domains[domain];
      const index = records.findIndex((row) => row.id === id);
      if (index < 0 || !etag || records[index].etag !== etag) {
        const error = new Error('O registro local foi alterado. Recarregue antes de salvar.');
        error.code = 'concurrency-conflict';
        error.status = 412;
        throw error;
      }
      state.revision += 1;
      const updated = { ...records[index], ...clone(input), id, etag: `"${state.revision}"` };
      if (remove) records.splice(index, 1);
      else records[index] = updated;
      write(state);
      return remove ? undefined : clone(updated);
    }
    return [domain, Object.freeze({
      findMany: async () => ({ items: clone(read().domains[domain]) }),
      findById: async (id) => clone(read().domains[domain].find((row) => row.id === id) ?? null),
      create: async (input) => {
        const state = read();
        const records = state.domains[domain];
        state.revision += 1;
        const row = { ...clone(input), id: Math.max(0, ...records.map((record) => record.id)) + 1, etag: `"${state.revision}"` };
        records.push(row);
        write(state);
        return clone(row);
      },
      update: async (id, input, { etag } = {}) => mutate(id, input, etag),
      delete: async (id, { etag } = {}) => mutate(id, {}, etag, true)
    })];
  })));
}
