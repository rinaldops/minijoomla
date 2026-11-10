/*
 * Host do Modern Script Editor para o site público e o painel administrativo.
 * scripts/deploy-sharepoint.mjs injeta a configuração e publica este arquivo em
 * host/ de cada release imutável; a mesma release nunca é regravada.
 * O painel é escolhido pelo contêiner da página, nunca pela URL.
 */
const CONFIG = __CONFIG__;
const SITE_ROOT = '[data-minijoomla-site]';
const ADMIN_ROOT = '[data-minijoomla-admin-root]';

function waitForRoot(timeoutMs = 8000) {
  const find = () => document.querySelector(`${SITE_ROOT},${ADMIN_ROOT}`);
  return new Promise((resolve) => {
    const found = find();
    if (found) return resolve(found);
    const observer = new MutationObserver(() => {
      const root = find();
      if (!root) return;
      observer.disconnect();
      resolve(root);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(find()); }, timeoutMs);
  });
}

async function mountSite(root) {
  const [{ mountMiniJoomlaSite }, { createSharePointRestClient }] = await Promise.all([
    import('../libraries/minijoomla/composition/mountMiniJoomlaSite.js'),
    import('../libraries/vendor/spmiddle/sharepoint-rest-browser/src/index.js')
  ]);
  // Sem autenticação própria: a sessão exibida pelo módulo de login é a do SharePoint.
  const user = await fetch(`${CONFIG.webUrl}/_api/web/currentuser?$select=Title`, { headers: { accept: 'application/json;odata=nometadata' } })
    .then((response) => (response.ok ? response.json() : null)).catch(() => null);
  await mountMiniJoomlaSite({
    root,
    moduleStyles: CONFIG.moduleStyles ?? {},
    moduleStyleRevisions: CONFIG.moduleStyleRevisions ?? {},
    config: { session: user?.Title ? { name: user.Title } : undefined },
    webUrl: CONFIG.webUrl,
    lists: CONFIG.lists,
    cacheMs: 5000,
    transportFactory: ({ webUrl }) => createSharePointRestClient({ webUrl })
  });
}

async function mountAdmin(root) {
  const [{ createMiniJoomlaAdminApp }, { createAdminApplication }, { attachRichTextEditor }, { createSharePointFileClient }, { createSharePointRestClient }, { createAtomicExtensionKeyGuard }] = await Promise.all([
    import('../libraries/minijoomla/composition/createMiniJoomlaAdminApp.js'),
    import('../administrator/components/com_minijoomla/app.js'),
    import('../administrator/components/com_minijoomla/editor.js'),
    import('../libraries/vendor/spmiddle/sharepoint-files/src/files.js'),
    import('../libraries/vendor/spmiddle/sharepoint-rest-browser/src/index.js'),
    import('../libraries/minijoomla/infrastructure/spmiddle-extension-guard.js')
  ]);
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./admin.scoped.css', import.meta.url).href;
  document.head.append(stylesheet);
  const fileClient = ({ webUrl }) => {
    const transport = createSharePointRestClient({ webUrl });
    const client = createSharePointFileClient({ transport, libraryPath: CONFIG.libraryPath });
    return {
      ...client,
      // O cliente do SPMIDDLE não exclui arquivos; recycle() mantém a exclusão recuperável pela lixeira.
      deleteFile: ({ folderPath, fileName }) => transport.request(`${webUrl}/_api/web/GetFileByServerRelativeUrl('${CONFIG.libraryPath}/${folderPath}/${encodeURIComponent(fileName).replaceAll("'", "''")}')/recycle()`, { method: 'POST' })
    };
  };
  const app = createMiniJoomlaAdminApp({
    webUrl: CONFIG.webUrl,
    transportFactory: ({ webUrl }) => createSharePointRestClient({ webUrl }),
    extensionsFileClientFactory: fileClient,
    joomlaDiscoveryRoots: CONFIG.joomlaDiscoveryRoots ?? [],
    joomlaFileClientFactory: ({ webUrl, root }) => {
      const client = createSharePointFileClient({ transport: createSharePointRestClient({ webUrl }), libraryPath: root.baseUrl });
      return { listFolders: client.listFoldersAll, listFiles: client.listFilesAll, downloadFile: client.downloadFile };
    },
    assertAtomicExtensionKey: createAtomicExtensionKeyGuard({ transport: createSharePointRestClient({ webUrl: CONFIG.webUrl }), webUrl: CONFIG.webUrl, listId: CONFIG.lists.extensions?.listId }),
    mediaFileClientFactory: fileClient,
    lists: CONFIG.lists
  });
  const application = createAdminApplication({
    adminService: app.admin,
    pluginRuntime: app.adminPlugins,
    autoStart: false,
    discoveryService: app.discovery,
    mediaService: app.media,
    documentRef: { body: root, documentElement: null, title: '' },
    richTextEditorFactory: (elementId, options) => attachRichTextEditor(elementId, {
      vendorBaseUrl: new URL('../media/vendor/tinymce', import.meta.url).pathname,
      documentRef: document,
      uploadImage: app.media?.uploadImage,
      ...options
    })
  });
  await application.start();
}

const root = await waitForRoot();
try {
  if (!root) throw new TypeError('Contêiner do MINIJOOMLA ausente.');
  await (root.matches(ADMIN_ROOT) ? mountAdmin(root) : mountSite(root));
} catch (error) {
  console.error('MINIJOOMLA: falha ao iniciar no host.', error);
  if (root) {
    root.textContent = 'Não foi possível iniciar o MINIJOOMLA.';
    root.setAttribute('role', 'alert');
  }
}
