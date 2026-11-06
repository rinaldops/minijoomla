import assert from 'node:assert/strict';
import { createApplication } from '../src/index.js';

function documentDouble() {
  // Minimal documentRef compatible with src/index.js.
  return {
    body: {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    },
    documentElement: {},
    title: 'Host title'
  };
}

export async function runOfflineGateTests() {
  const doc = documentDouble();
  const app = createApplication({
    autoStart: false,
    documentRef: doc,
    config: { offline: true, offlineMessage: 'Mensagem de manutenção' },
    getModuleInstances: async () => [],
    adapter: {
      listMenus: async () => [],
      listTags: async () => [],
      listArticles: async () => ({ items: [], total: 0, page: 1, pageSize: 5, pages: 0 }),
      getCategory: async () => null,
      getArticle: async () => null
    }
  });
  app.router.routes = [
    { name: 'home', pattern: /^\/$/, keys: [] },
    { name: 'article', pattern: /^\/article\/([^/]+)$/, keys: ['alias'] },
    { name: 'unknown', pattern: /^\/unknown$/, keys: [] }
  ];

  await app.router.navigate('#/');
  assert.match(doc.body.innerHTML, /Site em manutenção/);
  assert.match(doc.body.innerHTML, /Mensagem de manutenção/);

  await app.router.navigate('#/article/qualquer');
  assert.match(doc.body.innerHTML, /Mensagem de manutenção/);

  await app.router.navigate('#/unknown');
  assert.match(doc.body.innerHTML, /Mensagem de manutenção/);

  const onlineDoc = documentDouble();
  const online = createApplication({
    autoStart: false,
    documentRef: onlineDoc,
    config: {},
    getModuleInstances: async () => [],
    adapter: {
      listMenus: async () => [],
      listTags: async () => [],
      listArticles: async () => ({ items: [], total: 0, page: 1, pageSize: 5, pages: 0 }),
      getCategory: async () => null,
      getArticle: async () => null
    }
  });
  online.router.routes = [{ name: 'home', pattern: /^\/$/, keys: [] }];
  await online.router.navigate('#/');
  assert.doesNotMatch(onlineDoc.body.innerHTML, /Site em manutenção/);

  console.log('offline gate: 2 testes aprovados');
}
