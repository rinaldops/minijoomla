const STORAGE_KEY = 'minijoomla-demo-v1';
const clone = (value) => structuredClone(value);

function initialData() {
  return {
    articles: [
      { id: 1, title: 'Bem-vindo ao MINIJOOMLA', alias: 'boas-vindas', state: 'Published', featured: true, categoryId: 1, introtext: 'Conteúdo modular com administração independente.', fulltext: '<p>Edite este conteúdo no painel local e recarregue o site para conferir.</p>', publishUp: '2026-01-01', tags: 'guia, notícias' },
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
      { id: 5, title: 'Busca', extensionKey: 'search', position: 'search', ordering: 1, enabled: true, scopeKind: 'All' }
    ],
    templates: [
      { id: 1, title: 'Cassiopeia', key: 'cassiopeia', version: '1.0.0', entryPointUrl: new URL('../src/templates/cassiopeia/index.js', import.meta.url).href, styles: '', enabled: true },
      { id: 2, title: 'CAMAP', key: 'camap', version: '1.0.0', entryPointUrl: new URL('../src/templates/camap/index.js', import.meta.url).href, styles: '', enabled: true }
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
